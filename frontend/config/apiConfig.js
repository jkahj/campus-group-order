/**
 * API 配置檔案
 * 用於設定後端 API 的基礎 URL 和其他配置
 * 
 * 支援環境變數：
 * - EXPO_PUBLIC_API_URL: 從環境變數讀取 API URL（優先）
 * - 如果沒有設定環境變數，則根據環境自動選擇
 */

// 從環境變數讀取 API URL（優先使用）
const getApiUrl = () => {
  // 優先使用環境變數（Expo 會自動處理 EXPO_PUBLIC_ 前綴）
  if (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // 如果沒有環境變數，根據環境自動選擇
  if (__DEV__) {
    // 開發環境：使用區域網路 IP
    // 目前 IP 地址：172.20.10.3（從 ipconfig 取得）
    // 如果 IP 地址改變，請更新此處或使用環境變數
    return 'http://172.20.10.3:8001';
  }
  
  // 生產環境：使用部署後的伺服器地址
  return 'https://your-api-server.com';
};

// 開發環境配置
const API_CONFIG = {
  // 本地開發環境（需要啟動後端服務）
  // 注意：如果使用實體設備或模擬器，需要將 localhost 改為電腦的 IP 地址
  development: {
    baseURL: getApiUrl(),
    timeout: 30000,  // 增加超時時間以處理大量數據
  },
  
  // 測試環境
  test: {
    baseURL: getApiUrl(),
    timeout: 10000,
  },
  
  // 生產環境（部署後使用實際的伺服器地址）
  production: {
    baseURL:  'https://unmalevolent-nonrousing-cristine.ngrok-free.dev',
    timeout: 10000,
  }
};

// 根據環境選擇配置
const getEnvironment = () => {
  // 在 React Native 中，你可以根據需要判斷環境
  if (__DEV__) {
    return 'development';
  }
  
  // 檢查是否為生產環境
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
    return 'production';
  }
  
  return 'production';
};

const currentConfig = API_CONFIG[getEnvironment()];

export default {
  baseURL: currentConfig.baseURL,
  timeout: currentConfig.timeout,
  
  // API 端點路徑
  endpoints: {
    // 用戶相關
    users: '/users',
    userById: (id) => `/users/${id}`,
    login: '/login',
    register: '/register',
    
    // 訂單相關
    orders: '/orders',
    orderById: (id) => `/orders/${id}`,
    ordersByUser: (userId) => `/orders/user/${userId}`,
    
    // 留言相關
    comments: '/comments',
    commentById: (id) => `/comments/${id}`,
    commentsByOrder: (orderId) => `/comments/order/${orderId}`,
    commentReplies: '/comment-replies',
    commentRepliesByComment: (commentId) => `/comment-replies/comment/${commentId}`,
    commentRepliesByOrder: (orderId) => `/comment-replies/order/${orderId}`,
    
    // 通知相關
    notifications: '/notifications',
    notificationById: (id) => `/notifications/${id}`,
    notificationsByUser: (userId) => `/notifications/user/${userId}`,
    markNotificationRead: (userId, notificationId) => `/notifications/${userId}/${notificationId}/read`,
    
    // 評價相關
    reviews: '/reviews',
    reviewById: (id) => `/reviews/${id}`,
    reviewsByUser: (userId) => `/reviews/user/${userId}`,
    reviewsGivenByUser: (userId) => `/reviews/given/${userId}`,
    
    // 信譽積分相關
    userTiers: '/user-tiers',
    userTierById: (userId) => `/user-tiers/${userId}`,
    userTierSummaries: '/user-tiers/summary',
    scoreHistory: '/score-history',
    scoreHistoryByUser: (userId) => `/score-history/user/${userId}`,
    tierHistory: '/tier-history',
    tierHistoryByUser: (userId) => `/tier-history/user/${userId}`,
    
    // 訂單參與者
    orderJoiners: '/order-joiners',
    orderJoinersByOrder: (orderId) => `/order-joiners/order/${orderId}`,
    
    // 其他
    deviceToken: '/register-device-token',
    sendNotification: '/send-notification',
    
    // 點讚相關
    likesToggle: '/likes/toggle',
    userLikeStatus: (userId, orderId) => `/likes/user/${userId}/order/${orderId}`,
    orderLikeCount: (orderId) => `/likes/order/${orderId}/count`,
    userLikes: (userId) => `/likes/user/${userId}`,
  }
};

