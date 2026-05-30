/**
 * 通知工具函數
 * 統一的通知創建和管理，確保所有通知都同步到資料庫
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './apiService';
import { AuthManager } from './authManager';
import simpleNotificationService from './simpleNotificationService';

/**
 * 創建通知（同時寫入 AsyncStorage 和資料庫）
 * @param {Object} notificationData - 通知資料
 * @param {string} notificationData.user_id - 接收者用戶ID（必填）
 * @param {string} notificationData.type - 通知類型
 * @param {string} notificationData.title - 通知標題
 * @param {string} notificationData.body - 通知內容
 * @param {string} notificationData.order_id - 關聯訂單ID（可選）
 * @param {string} notificationData.commenter_id - 關聯留言者ID（可選）
 * @param {string} notificationData.order_name - 訂單名稱（可選）
 * @param {string} notificationData.comment_id - 關聯留言ID（可選）
 * @returns {Promise<boolean>} 是否創建成功
 */
export const createNotification = async (notificationData) => {
  try {
    const {
      user_id, // 接收者用戶ID（必填）
      type = 'general',
      title,
      body,
      order_id = null,
      commenter_id = null,
      order_name = null,
      comment_id = null,
    } = notificationData;

    if (!user_id) {
      console.error('⚠️ 創建通知失敗：缺少 user_id（接收者用戶ID）', { user_id, title });
      return false;
    }

    // 如果 user_id 是 'me'，嘗試獲取當前用戶 ID
    let targetUserId = user_id;
    if (user_id === 'me') {
      try {
        const currentUser = await AuthManager.getCurrentUser();
        targetUserId = currentUser?.id || null;
        if (!targetUserId) {
          console.log('⚠️ 創建通知失敗：無法獲取當前用戶 ID（靜默處理）');
          return false;
        }
      } catch (error) {
        console.log('⚠️ 獲取當前用戶 ID 失敗（靜默處理）:', error);
        return false;
      }
    }

    // 驗證用戶 ID 格式（基本檢查）
    // 如果用戶 ID 看起來像是時間戳但格式異常，記錄但不阻止
    if (targetUserId && typeof targetUserId === 'string') {
      // 檢查是否為純數字（可能是時間戳格式的用戶 ID）
      // 這是正常的，因為註冊時使用 Date.now().toString() 作為用戶 ID
      // 所以我們只檢查是否為空或明顯無效的值
      const trimmedUserId = targetUserId.trim();
      if (!trimmedUserId || trimmedUserId.length === 0) {
        console.log('⚠️ 創建通知失敗：用戶 ID 為空（靜默處理）');
        return false;
      }
    }

    // 使用 simpleNotificationService 創建通知（會同時寫入 AsyncStorage 和資料庫）
    const notificationItem = {
      id: notificationData.id || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ts: notificationData.ts || Date.now(),
      type,
      title,
      body,
      order_id,
      user_id: targetUserId, // 確保使用正確的用戶ID
      commenter_id,
      order_name,
      comment_id,
    };

    const success = await simpleNotificationService.createNotificationInDatabase(notificationItem);
    return success;
  } catch (error) {
    console.error('創建通知失敗:', error);
    return false;
  }
};

/**
 * 發送通知給訂單發起者（當有新留言、回覆、按讚等）
 * @param {string} orderId - 訂單ID
 * @param {string} type - 通知類型
 * @param {string} title - 通知標題
 * @param {string} body - 通知內容
 * @param {Object} additionalData - 額外資料
 * @returns {Promise<boolean>} 是否發送成功
 */
export const sendNotificationToOrderCreator = async (orderId, type, title, body, additionalData = {}) => {
  try {
    let creatorId = null;
    let orderName = null;

    // 先從本地獲取訂單資料
    try {
      const orders = JSON.parse(await AsyncStorage.getItem('orders')) || [];
      const localOrder = orders.find(o => o.id === orderId);
      if (localOrder) {
        creatorId = localOrder.created_by || localOrder.createdBy;
        orderName = localOrder.name;
      }
    } catch (error) {
      console.log('從本地獲取訂單資料失敗，嘗試從後端獲取:', error);
    }

    // 如果本地沒有訂單或 created_by 是 'me'，嘗試從後端 API 獲取真實的訂單發起者
    if (!creatorId || creatorId === 'me') {
      try {
        const { default: apiService } = await import('./apiService');
        const backendOrder = await apiService.getOrder(orderId);
        if (backendOrder && backendOrder.created_by) {
          creatorId = backendOrder.created_by;
          if (backendOrder.name && !orderName) {
            orderName = backendOrder.name;
          }
          console.log('✅ 從後端獲取訂單發起者 ID:', creatorId);
        }
      } catch (apiError) {
        // 對於已刪除的訂單（特別是 'deleted' 類型通知），靜默處理
        const isDeletedNotification = type === 'deleted';
        const isOrderNotFound = apiError?.status === 404 || 
                               apiError?.message?.includes('404') ||
                               apiError?.message?.includes('不存在') ||
                               apiError?.message?.includes('not found');
        
        if (isDeletedNotification && isOrderNotFound) {
          // 已刪除訂單的通知失敗是正常情況，靜默處理
          console.log('ℹ️ 訂單已刪除，無法獲取發起者 ID（靜默處理）');
          return false;
        }
        
        console.log('⚠️ 從後端獲取訂單資料失敗:', apiError?.message || apiError);
        // 繼續使用本地資料，但如果 creatorId 仍然是 'me'，則不發送通知
        if (!creatorId || creatorId === 'me') {
          // 使用 console.log 而不是 console.error，避免觸發 LogBox
          console.log('⚠️ 無法確定訂單發起者 ID，跳過通知（靜默處理）:', orderId);
          return false;
        }
      }
    }

    // 如果仍然沒有有效的 creatorId，不發送通知
    if (!creatorId || creatorId === 'me') {
      // 使用 console.log 而不是 console.error，避免觸發 LogBox
      // 特別是對於已刪除的訂單，這是正常情況
      const isDeletedNotification = type === 'deleted';
      if (isDeletedNotification) {
        console.log('ℹ️ 無法確定已刪除訂單的發起者 ID，跳過通知（靜默處理）');
      } else {
        console.log('⚠️ 無法確定訂單發起者 ID，跳過通知（靜默處理）:', orderId);
      }
      return false;
    }

    // 特殊處理：如果是 'liked' 類型通知，確保只發送給訂單發起者
    if (type === 'liked') {
      // 驗證：'liked' 通知的接收者必須是訂單發起者
      // 這個驗證確保不會誤發給按讚者自己
      const currentUser = await AuthManager.getCurrentUser();
      const currentUserId = currentUser?.id;
      
      // 如果是自己給自己的訂單按讚，不需要通知
      if (currentUserId && currentUserId === creatorId) {
        console.log('⚠️ 自己給自己的訂單按讚，跳過通知');
        return false;
      }
    }

    // 創建通知給訂單發起者
    return await createNotification({
      user_id: creatorId, // 確保這是訂單發起者的 ID，而不是按讚者的 ID
      type,
      title,
      body,
      order_id: orderId,
      order_name: orderName || additionalData.order_name || null,
      commenter_id: additionalData.commenter_id || null,
      comment_id: additionalData.comment_id || null,
    });
  } catch (error) {
    console.error('發送通知給訂單發起者失敗:', error);
    return false;
  }
};

/**
 * 發送通知給留言者（當訂單接單、配送、完成等）
 * @param {string|Object} commenterIdOrInfo - 留言者ID 或留言者信息對象
 * @param {string} type - 通知類型
 * @param {string} title - 通知標題
 * @param {string} body - 通知內容
 * @param {Object} additionalData - 額外資料（包含 order_id, order_name, comment_id 等）
 * @returns {Promise<boolean>} 是否發送成功
 */
export const sendNotificationToCommenter = async (commenterIdOrInfo, type, title, body, additionalData = {}) => {
  try {
    // 處理參數：如果是對象（舊版本兼容），提取信息
    let commenterId = null;
    let commenterName = null;
    
    if (typeof commenterIdOrInfo === 'object' && commenterIdOrInfo !== null) {
      // 舊版本兼容：第一個參數是留言者對象
      commenterId = commenterIdOrInfo.id || commenterIdOrInfo.commenterId || commenterIdOrInfo.originalCommentId;
      commenterName = commenterIdOrInfo.name || commenterIdOrInfo.commenterName;
      // 如果第一個參數是對象，調整參數順序
      if (typeof type === 'string' && !title) {
        // 參數順序可能是: (commenterInfo, title, body, type)
        const tempTitle = type;
        const tempBody = title;
        const tempType = body || 'general';
        title = tempTitle;
        body = tempBody;
        type = tempType;
        additionalData = additionalData || {};
      }
    } else {
      // 新版本：第一個參數是留言者ID
      commenterId = commenterIdOrInfo;
    }

    if (!commenterId || commenterId === 'me') {
      // 如果留言者是 'me'，嘗試獲取當前用戶 ID
      try {
        const currentUser = await AuthManager.getCurrentUser();
        const currentUserId = currentUser?.id;
        if (!currentUserId) {
          console.error('⚠️ 無法獲取當前用戶 ID');
          return false;
        }
        commenterId = currentUserId;
      } catch (error) {
        console.error('⚠️ 獲取當前用戶 ID 失敗:', error);
        return false;
      }
    }

    // 確保 order_id 和 comment_id 正確傳遞
    const notificationData = {
      user_id: commenterId, // 接收者：留言者
      type: type || 'general',
      title: title || '通知',
      body: body || '',
      order_id: additionalData.order_id || null,
      order_name: additionalData.order_name || null,
      commenter_id: commenterId, // 留言者ID（用於識別）
      comment_id: additionalData.comment_id || null, // 留言ID（用於定位具體留言）
    };

    // 創建通知給留言者
    return await createNotification(notificationData);
  } catch (error) {
    console.error('發送通知給留言者失敗:', error);
    return false;
  }
};

export default {
  createNotification,
  sendNotificationToOrderCreator,
  sendNotificationToCommenter,
};

