import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import apiService from './apiService';

// 配置推送通知
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class SimpleNotificationService {
  constructor() {
    this.userId = null;
    this.isInitialized = false;
  }

  // 初始化通知服務
  async initialize(userId) {
    try {
      this.userId = userId;
      
      // 請求通知權限
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('通知權限被拒絕');
        return false;
      }

      // 設置通知監聽器
      this.setupNotificationListeners();
      
      this.isInitialized = true;
      console.log('簡化通知服務初始化成功');
      return true;
    } catch (error) {
      console.error('簡化通知服務初始化失敗:', error);
      return false;
    }
  }

  // 設置通知監聽器
  setupNotificationListeners() {
    // 監聽通知點擊
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('通知被點擊:', response);
    });

    // 監聽通知接收
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('收到通知:', notification);
    });
  }

  // 創建通知（同時寫入 AsyncStorage 和資料庫）
  async createNotificationInDatabase(notificationData) {
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
        console.error('⚠️ 創建通知失敗：缺少 user_id（接收者用戶ID）');
        return false;
      }

      // 生成通知 ID
      const notificationId = notificationData.id || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const timestamp = notificationData.ts || Date.now();

      // 準備資料庫通知資料
      const dbNotification = {
        id: notificationId,
        user_id: user_id, // 確保這是接收者用戶ID
        type,
        title,
        body,
        order_id,
        commenter_id,
        order_name,
        read: false,
        ts: timestamp,
      };

      // 同步到後端資料庫
      try {
        await apiService.createNotification(dbNotification);
        console.log(`✅ 通知已同步到資料庫: ${title} (user_id: ${user_id})`);
      } catch (apiError) {
        // 取得詳細錯誤訊息
        const errorMessage = apiError?.message || String(apiError);
        const errorStatus = apiError?.status;
        const errorDetail = apiError?.response?.detail || apiError?.response?.message;
        
        // 先檢查是否為用戶不存在錯誤（在輸出錯誤之前）
        const isUserNotFound = errorStatus === 404 || 
                              errorStatus === 400 || 
                              errorDetail?.includes('用戶不存在') ||
                              errorDetail?.includes('用戶不存在或無效') ||
                              errorMessage?.includes('用戶不存在') ||
                              errorMessage?.includes('用戶不存在或無效');
        
        if (isUserNotFound) {
          // 靜默處理用戶不存在的情況，使用 console.log 而不是 console.error
          // 這樣不會觸發 LogBox 顯示錯誤，提升用戶體驗
          // 因為通知已保存到本地，功能正常
          console.log(`ℹ️ 用戶 ID "${user_id}" 不存在於資料庫中，通知已保存到本地（靜默處理）`);
          // 即使資料庫同步失敗，仍然寫入本地
          // 直接返回，不執行後續的錯誤處理
        } else {
          // 其他錯誤才顯示錯誤訊息
          // 組合完整的錯誤訊息
          let fullErrorMessage = '⚠️ 通知同步至資料庫失敗（保留本地）:';
          
          if (errorStatus) {
            fullErrorMessage += ` HTTP ${errorStatus}`;
          }
          
          if (errorDetail) {
            fullErrorMessage += ` - ${errorDetail}`;
          } else if (errorMessage && !errorMessage.includes('HTTP error!')) {
            fullErrorMessage += ` - ${errorMessage}`;
          } else {
            fullErrorMessage += ` ${errorMessage}`;
          }
          
          console.error(fullErrorMessage);
        }
        
        // 即使資料庫同步失敗，仍然寫入本地
      }

      // 同時寫入本地 AsyncStorage（作為備份）
      const inbox = JSON.parse(await AsyncStorage.getItem('inbox')) || [];
      const localNotification = {
        id: notificationId,
        ts: timestamp,
        type,
        title,
        body,
        orderId: order_id,
        commenterId: commenter_id,
        commentId: comment_id,
        orderName: order_name,
        user_id: user_id, // 確保包含 user_id
        read: false,
      };
      await AsyncStorage.setItem('inbox', JSON.stringify([localNotification, ...inbox]));

      return true;
    } catch (error) {
      console.error('創建通知失敗:', error);
      return false;
    }
  }

  // 發送個別通知給特定用戶（簡化版本，已更新為同步到資料庫）
  async sendNotificationToUser(targetUserId, title, body, orderId = null, type = 'general', additionalData = {}) {
    try {
      console.log(`發送通知給用戶 ${targetUserId}: ${title}`);
      
      if (!targetUserId || targetUserId === 'me') {
        console.error('⚠️ 發送通知失敗：無效的 targetUserId');
        return false;
      }

      // 檢查通知權限
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        console.log('通知權限未授予，嘗試請求權限...');
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          console.log('通知權限被拒絕');
          // 即使權限被拒絕，仍然創建通知記錄
        }
      }

      // 發送本地通知
      try {
        await this.sendLocalNotification(title, body, { orderId, targetUserId });
      } catch (notifError) {
        console.log('本地通知發送失敗（繼續創建通知記錄）:', notifError);
      }
      
      // 創建通知記錄（同時寫入 AsyncStorage 和資料庫）
      const notificationItem = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ts: Date.now(),
        type,
        title,
        body,
        order_id: orderId,
        user_id: targetUserId, // 接收者用戶ID
        commenter_id: additionalData.commenter_id || null,
        order_name: additionalData.order_name || null,
        comment_id: additionalData.comment_id || null,
      };

      await this.createNotificationInDatabase(notificationItem);
      
      console.log('通知發送成功:', title);
      return true;
    } catch (error) {
      console.error('發送通知失敗:', error);
      return false;
    }
  }

  // 發送到貨通知
  async sendArrivalNotification(targetUserId, orderName) {
    return this.sendNotificationToUser(
      targetUserId,
      '到貨通知',
      `您的代購訂單「${orderName}」已到貨，請及時領取！`,
      null,
      'arrival'
    );
  }

  // 發送本地通知
  async sendLocalNotification(title, body, data = {}) {
    try {
      console.log('發送本地通知:', title, body);
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true, // 確保有聲音
        },
        trigger: { seconds: 1 },
      });
      
      console.log('本地通知發送成功，ID:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('發送本地通知失敗:', error);
      throw error;
    }
  }

  // 獲取用戶通知（從本地 inbox）
  async getUserNotifications() {
    try {
      const inbox = JSON.parse(await AsyncStorage.getItem('inbox')) || [];
      const userNotifications = inbox.filter(n => n.commenterId === this.userId);
      const unreadCount = userNotifications.filter(n => !n.read).length;
      
      return {
        notifications: userNotifications,
        unread_count: unreadCount
      };
    } catch (error) {
      console.error('獲取用戶通知失敗:', error);
      return { notifications: [], unread_count: 0 };
    }
  }

  // 標記通知為已讀
  async markNotificationAsRead(notificationId) {
    try {
      const inbox = JSON.parse(await AsyncStorage.getItem('inbox')) || [];
      const updatedInbox = inbox.map(notification => {
        if (notification.id === notificationId) {
          return { ...notification, read: true };
        }
        return notification;
      });
      
      await AsyncStorage.setItem('inbox', JSON.stringify(updatedInbox));
      console.log('通知已標記為已讀');
      return true;
    } catch (error) {
      console.error('標記通知為已讀失敗:', error);
      return false;
    }
  }

  // 獲取未讀通知數量
  async getUnreadCount() {
    try {
      const { unread_count } = await this.getUserNotifications();
      return unread_count;
    } catch (error) {
      console.error('獲取未讀通知數量失敗:', error);
      return 0;
    }
  }

  // 清除所有通知
  async clearAllNotifications() {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('所有通知已清除');
    } catch (error) {
      console.error('清除通知失敗:', error);
    }
  }
}

// 建立單例實例
const simpleNotificationService = new SimpleNotificationService();

export default simpleNotificationService;

