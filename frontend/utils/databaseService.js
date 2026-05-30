/**
 * 資料庫服務
 * 完全使用資料庫而不是 AsyncStorage
 */

import apiService from './apiService';

class DatabaseService {
  /**
   * 檢查 API 是否可用
   */
  async checkConnection() {
    try {
      const response = await fetch('http://localhost:8001/health');
      return response.ok;
    } catch (error) {
      console.error('無法連接到資料庫:', error);
      return false;
    }
  }

  /**
   * 獲取所有訂單
   */
  async getAllOrders() {
    try {
      const orders = await apiService.getAllOrders();
      return orders || [];
    } catch (error) {
      // 靜默失敗，返回空陣列
      return [];
    }
  }

  /**
   * 創建訂單
   */
  async createOrder(orderData) {
    try {
      const order = await apiService.createOrder(orderData);
      console.log('訂單已保存到資料庫:', order.id);
      return order;
    } catch (error) {
      console.error('創建訂單失敗:', error);
      throw error;
    }
  }

  /**
   * 更新訂單
   */
  async updateOrder(orderId, orderData) {
    try {
      const order = await apiService.updateOrder(orderId, orderData);
      console.log('訂單已更新到資料庫:', orderId);
      return order;
    } catch (error) {
      // 檢查是否為可忽略的錯誤
      const errorMessage = error.message || '';
      const isNotFound = errorMessage.includes('404') || 
                        errorMessage.includes('訂單不存在');
      const isBadRequest = errorMessage.includes('400') ||
                          errorMessage.includes('訂單狀態無效');
      const isServerError = errorMessage.includes('500') ||
                           errorMessage.includes('HTTP error! status: 500');
      
      // 如果是可忽略的錯誤，重新拋出一個包含狀態碼的錯誤（不記錄錯誤）
      if (isNotFound) {
        const notFoundError = new Error(errorMessage);
        notFoundError.status = 404;
        throw notFoundError;
      }
      
      if (isBadRequest) {
        const badRequestError = new Error(errorMessage);
        badRequestError.status = 400;
        throw badRequestError;
      }
      
      if (isServerError) {
        const serverError = new Error(errorMessage);
        serverError.status = 500;
        throw serverError;
      }
      
      // 只有其他錯誤才記錄
      console.error('更新訂單失敗:', error);
      throw error;
    }
  }

  /**
   * 刪除訂單
   */
  async deleteOrder(orderId) {
    try {
      await apiService.deleteOrder(orderId);
      console.log('訂單已從資料庫刪除:', orderId);
    } catch (error) {
      // 檢查是否為可忽略的錯誤
      const errorMessage = error.message || '';
      const isNotFound = errorMessage.includes('404') || 
                        errorMessage.includes('訂單不存在');
      const isServerError = errorMessage.includes('500') ||
                           errorMessage.includes('HTTP error! status: 500');
      
      // 如果是 404 或 500，靜默處理（不記錄錯誤）
      // 404: 訂單不存在於資料庫
      // 500: 可能是資料庫問題，不影響本地功能
      if (!isNotFound && !isServerError) {
        console.error('刪除訂單失敗:', error);
      }
      throw error;
    }
  }

  /**
   * 獲取訂單的留言
   */
  async getComments(orderId) {
    try {
      const comments = await apiService.getCommentsByOrder(orderId);
      return comments || [];
    } catch (error) {
      // 靜默失敗，返回空陣列
      return [];
    }
  }

  /**
   * 創建留言
   */
  async createComment(commentData) {
    try {
      const comment = await apiService.createComment(commentData);
      console.log('留言已保存到資料庫:', comment.id);
      return comment;
    } catch (error) {
      console.error('創建留言失敗:', error);
      throw error;
    }
  }

  /**
   * 更新留言
   */
  async updateComment(commentId, commentData) {
    try {
      const comment = await apiService.updateComment(commentId, commentData);
      console.log('留言已更新到資料庫:', commentId);
      return comment;
    } catch (error) {
      console.error('更新留言失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取用戶資料
   */
  async getUser(userId) {
    try {
      const user = await apiService.getUser(userId);
      return user;
    } catch (error) {
      // 對於 404「用戶不存在」視為可接受情況，靜默處理避免干擾前端日誌
      const message = error?.message || '';
      const status = error?.status;
      const isNotFound =
        status === 404 ||
        message.includes('HTTP error! status: 404') ||
        message.includes('用戶不存在');

      if (!isNotFound) {
        // 只有真正異常才輸出錯誤日誌
        console.error('獲取用戶失敗:', error);
      }

      return null;
    }
  }

  /**
   * 獲取用戶通知
   */
  async getNotifications(userId) {
    try {
      const result = await apiService.getNotificationsByUser(userId);
      return result.notifications || [];
    } catch (error) {
      // 靜默失敗，返回空陣列
      return [];
    }
  }

  /**
   * 標記通知為已讀
   */
  async markNotificationRead(userId, notificationId) {
    try {
      await apiService.markNotificationRead(userId, notificationId);
      console.log('通知已標記為已讀:', notificationId);
    } catch (error) {
      console.error('標記通知失敗:', error);
      throw error;
    }
  }
}

export default new DatabaseService();

