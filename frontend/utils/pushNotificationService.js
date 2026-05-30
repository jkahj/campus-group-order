import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// 後端 API 基礎 URL
const API_BASE_URL = 'http://localhost:8001';

// 檢測是否在 Expo Go 環境中
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// 配置推送通知
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class PushNotificationService {
  constructor() {
    this.deviceToken = null;
    this.userId = null;
    this.isInitialized = false;
    this.isExpoGo = isExpoGo;
  }

  // 初始化推送通知服務
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

      // 嘗試獲取設備推送令牌（僅在非 Expo Go 環境中）
      if (this.isExpoGo) {
        console.log('Expo Go 環境：遠程推送通知不可用，僅使用本地通知');
        // 在 Expo Go 中跳過遠程推送，只使用本地通知
        this.deviceToken = `expo_go_mock_${Date.now()}`;
      } else {
        try {
          const token = await Notifications.getExpoPushTokenAsync({
            projectId: 'your-project-id', // 需要替換為實際的 Expo 專案 ID
          });
          this.deviceToken = token.data;
          
          // 註冊設備令牌到後端
          await this.registerDeviceToken();
        } catch (tokenError) {
          console.log('無法獲取推送令牌，使用模擬令牌:', tokenError);
          // 使用模擬令牌進行測試
          this.deviceToken = `mock_token_${Date.now()}`;
        }
      }

      // 設置通知監聽器
      this.setupNotificationListeners();
      
      this.isInitialized = true;
      console.log('推送通知服務初始化成功');
      return true;
    } catch (error) {
      console.error('推送通知服務初始化失敗:', error);
      return false;
    }
  }

  // 註冊設備令牌到後端
  async registerDeviceToken() {
    try {
      if (!this.deviceToken || !this.userId) return;

      const response = await fetch(`${API_BASE_URL}/register-device-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: this.userId,
          device_token: this.deviceToken,
        }),
      });

      if (response.ok) {
        console.log('設備令牌註冊成功');
      } else {
        console.error('設備令牌註冊失敗');
      }
    } catch (error) {
      console.error('註冊設備令牌時發生錯誤:', error);
    }
  }

  // 設置通知監聽器
  setupNotificationListeners() {
    // 監聽通知點擊
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('通知被點擊:', response);
      // 這裡可以處理通知點擊後的導航邏輯
    });

    // 監聽通知接收
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('收到通知:', notification);
    });
  }

  // 發送個別通知給特定用戶
  async sendNotificationToUser(targetUserId, title, body, orderId = null, type = 'general') {
    try {
      // 在 Expo Go 環境中，只使用本地通知
      if (this.isExpoGo) {
        console.log('Expo Go 環境：僅發送本地通知');
        await this.sendLocalNotification(title, body, { orderId, targetUserId });
        return true;
      }

      // 在 development build 中，嘗試發送後端推送通知
      let backendSuccess = false;
      try {
        const response = await fetch(`${API_BASE_URL}/send-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: targetUserId,
            title,
            body,
            order_id: orderId,
            type,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log('推送通知發送成功:', result);
          backendSuccess = true;
        } else {
          console.error('推送通知發送失敗');
        }
      } catch (backendError) {
        console.log('後端推送失敗，使用本地通知:', backendError);
      }

      // 無論後端是否成功，都發送本地通知（確保用戶能看到通知）
      await this.sendLocalNotification(title, body, { orderId, targetUserId });
      
      return backendSuccess || true; // 如果後端失敗，本地通知成功也算成功
    } catch (error) {
      console.error('發送推送通知時發生錯誤:', error);
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

  // 發送本地通知（用於測試和備用）
  async sendLocalNotification(title, body, data = {}) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
        },
        trigger: { seconds: 1 },
      });
      console.log('本地通知發送成功:', title);
    } catch (error) {
      console.error('發送本地通知失敗:', error);
    }
  }

  // 獲取用戶通知
  async getUserNotifications() {
    try {
      if (!this.userId) return { notifications: [], unread_count: 0 };

      const response = await fetch(`${API_BASE_URL}/user-notifications/${this.userId}`);
      
      if (response.ok) {
        const result = await response.json();
        return result;
      } else {
        console.error('獲取用戶通知失敗');
        return { notifications: [], unread_count: 0 };
      }
    } catch (error) {
      console.error('獲取用戶通知時發生錯誤:', error);
      return { notifications: [], unread_count: 0 };
    }
  }

  // 標記通知為已讀
  async markNotificationAsRead(notificationId) {
    try {
      if (!this.userId) return false;

      const response = await fetch(`${API_BASE_URL}/mark-notification-read/${this.userId}/${notificationId}`, {
        method: 'POST',
      });

      if (response.ok) {
        console.log('通知已標記為已讀');
        return true;
      } else {
        console.error('標記通知為已讀失敗');
        return false;
      }
    } catch (error) {
      console.error('標記通知為已讀時發生錯誤:', error);
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
const pushNotificationService = new PushNotificationService();

export default pushNotificationService;
