/**
 * API 服務類別
 * 提供統一的 API 調用接口，處理錯誤和響應
 */

import apiConfig from '../config/apiConfig';

class ApiService {
  constructor() {
    this.baseURL = apiConfig.baseURL;
    this.timeout = apiConfig.timeout;
  }

  /**
   * 發送 HTTP 請求
   * @param {string} endpoint - API 端點
   * @param {string} method - HTTP 方法
   * @param {object} data - 請求數據
   * @param {object} headers - 自定義請求頭
   */
  async request(endpoint, method = 'GET', data = null, headers = {}) {
    try {
      const url = `${this.baseURL}${endpoint}`;
      
      const config = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.body = JSON.stringify(data);
      }

      // 添加超時處理
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // 處理響應
      let responseData;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        const error = new Error(responseData.message || `HTTP error! status: ${response.status}`);
        error.status = response.status;
        error.response = responseData;
        throw error;
      }

      return responseData;

    } catch (error) {
      // 靜默處理網路錯誤，不顯示詳細錯誤訊息
      if (error.name === 'AbortError' || error.message?.includes('Network request failed')) {
        // 不記錄錯誤，靜默處理
        throw new Error('Network request failed');
      }
      throw error;
    }
  }

  // GET 請求
  async get(endpoint, headers = {}) {
    return this.request(endpoint, 'GET', null, headers);
  }

  // POST 請求
  async post(endpoint, data, headers = {}) {
    return this.request(endpoint, 'POST', data, headers);
  }

  // PUT 請求
  async put(endpoint, data, headers = {}) {
    return this.request(endpoint, 'PUT', data, headers);
  }

  // DELETE 請求
  async delete(endpoint, headers = {}) {
    return this.request(endpoint, 'DELETE', null, headers);
  }

  // PATCH 請求
  async patch(endpoint, data, headers = {}) {
    return this.request(endpoint, 'PATCH', data, headers);
  }

  // ==================== 用戶相關 API ====================
  
  async createUser(userData) {
    return this.post(apiConfig.endpoints.users, userData);
  }

  async getUser(userId) {
    return this.get(apiConfig.endpoints.userById(userId));
  }

  async updateUser(userId, userData) {
    return this.put(apiConfig.endpoints.userById(userId), userData);
  }

  async deleteUser(userId) {
    return this.delete(apiConfig.endpoints.userById(userId));
  }

  async login(email, password) {
    return this.post(apiConfig.endpoints.login, { email, password });
  }

  async register(userData) {
    return this.post(apiConfig.endpoints.register, userData);
  }

  // ==================== 訂單相關 API ====================
  
  async createOrder(orderData) {
    return this.post(apiConfig.endpoints.orders, orderData);
  }

  async getOrder(orderId) {
    return this.get(apiConfig.endpoints.orderById(orderId));
  }

  async updateOrder(orderId, orderData) {
    return this.put(apiConfig.endpoints.orderById(orderId), orderData);
  }

  async deleteOrder(orderId) {
    return this.delete(apiConfig.endpoints.orderById(orderId));
  }

  async getOrdersByUser(userId) {
    return this.get(apiConfig.endpoints.ordersByUser(userId));
  }

  async getAllOrders() {
    return this.get(apiConfig.endpoints.orders);
  }

  // ==================== 留言相關 API ====================
  
  async createComment(commentData) {
    return this.post(apiConfig.endpoints.comments, commentData);
  }

  async getComment(commentId) {
    return this.get(apiConfig.endpoints.commentById(commentId));
  }

  async updateComment(commentId, commentData, params = {}) {
    // 構建查詢參數
    const queryParams = new URLSearchParams();
    if (params.user_id) {
      queryParams.append('user_id', params.user_id);
    }
    const queryString = queryParams.toString();
    const endpoint = queryString 
      ? `${apiConfig.endpoints.commentById(commentId)}?${queryString}`
      : apiConfig.endpoints.commentById(commentId);
    return this.put(endpoint, commentData);
  }

  async deleteComment(commentId, params = {}) {
    // 構建查詢參數
    const queryParams = new URLSearchParams();
    if (params.user_id) {
      queryParams.append('user_id', params.user_id);
    }
    const queryString = queryParams.toString();
    const endpoint = queryString 
      ? `${apiConfig.endpoints.commentById(commentId)}?${queryString}`
      : apiConfig.endpoints.commentById(commentId);
    return this.delete(endpoint);
  }

  async getCommentsByOrder(orderId) {
    return this.get(apiConfig.endpoints.commentsByOrder(orderId));
  }

  async createCommentReply(replyData) {
    return this.post(apiConfig.endpoints.commentReplies, replyData);
  }

  async getCommentRepliesByComment(commentId) {
    return this.get(apiConfig.endpoints.commentRepliesByComment(commentId));
  }

  async getCommentRepliesByOrder(orderId) {
    return this.get(apiConfig.endpoints.commentRepliesByOrder(orderId));
  }

  async createUserTier(tierData) {
    return this.post(apiConfig.endpoints.userTiers, tierData);
  }

  async getUserTierSummary() {
    return this.get(apiConfig.endpoints.userTierSummaries);
  }

  async createScoreHistory(entry) {
    return this.post(apiConfig.endpoints.scoreHistory, entry);
  }

  async getScoreHistoryList(parameters = {}) {
    const query = new URLSearchParams(parameters).toString();
    const endpoint = query
      ? `${apiConfig.endpoints.scoreHistory}?${query}`
      : apiConfig.endpoints.scoreHistory;
    return this.get(endpoint);
  }

  async createTierHistory(entry) {
    return this.post(apiConfig.endpoints.tierHistory, entry);
  }

  async getTierHistoryList(parameters = {}) {
    const query = new URLSearchParams(parameters).toString();
    const endpoint = query
      ? `${apiConfig.endpoints.tierHistory}?${query}`
      : apiConfig.endpoints.tierHistory;
    return this.get(endpoint);
  }

  // ==================== 通知相關 API ====================
  
  async createNotification(notificationData) {
    return this.post(apiConfig.endpoints.notifications, notificationData);
  }

  async getNotification(notificationId) {
    return this.get(apiConfig.endpoints.notificationById(notificationId));
  }

  async updateNotification(notificationId, notificationData) {
    return this.put(apiConfig.endpoints.notificationById(notificationId), notificationData);
  }

  async deleteNotification(notificationId) {
    return this.delete(apiConfig.endpoints.notificationById(notificationId));
  }

  async getNotificationsByUser(userId) {
    return this.get(apiConfig.endpoints.notificationsByUser(userId));
  }

  async markNotificationRead(userId, notificationId) {
    return this.post(apiConfig.endpoints.markNotificationRead(userId, notificationId));
  }

  async sendNotification(userId, title, body, orderId = null, type = 'general') {
    return this.post(apiConfig.endpoints.sendNotification, {
      user_id: userId,
      title,
      body,
      order_id: orderId,
      type,
    });
  }

  async registerDeviceToken(userId, deviceToken) {
    return this.post(apiConfig.endpoints.deviceToken, {
      user_id: userId,
      device_token: deviceToken,
    });
  }

  // ==================== 評價相關 API ====================
  
  async createReview(reviewData) {
    return this.post(apiConfig.endpoints.reviews, reviewData);
  }

  async getReview(reviewId) {
    return this.get(apiConfig.endpoints.reviewById(reviewId));
  }

  async getReviewsByUser(userId) {
    return this.get(apiConfig.endpoints.reviewsByUser(userId));
  }

  async getReviewsGivenByUser(userId) {
    return this.get(apiConfig.endpoints.reviewsGivenByUser(userId));
  }

  // ==================== 信譽積分相關 API ====================
  
  async getUserTier(userId) {
    return this.get(apiConfig.endpoints.userTierById(userId));
  }

  async updateUserTier(userId, tierData) {
    return this.put(apiConfig.endpoints.userTierById(userId), tierData);
  }

  async getScoreHistoryByUser(userId) {
    return this.get(apiConfig.endpoints.scoreHistoryByUser(userId));
  }

  async getTierHistoryByUser(userId) {
    return this.get(apiConfig.endpoints.tierHistoryByUser(userId));
  }

  // ==================== 訂單參與者相關 API ====================
  
  async createOrderJoiner(joinerData) {
    return this.post(apiConfig.endpoints.orderJoiners, joinerData);
  }

  async getOrderJoiners(orderId) {
    return this.get(apiConfig.endpoints.orderJoinersByOrder(orderId));
  }

  // ==================== 點讚相關 API ====================
  
  async toggleLike(orderId, userId) {
    return this.post(apiConfig.endpoints.likesToggle, {
      order_id: orderId,
      user_id: userId
    });
  }

  async getUserLikeStatus(userId, orderId) {
    return this.get(apiConfig.endpoints.userLikeStatus(userId, orderId));
  }

  async getOrderLikeCount(orderId) {
    return this.get(apiConfig.endpoints.orderLikeCount(orderId));
  }

  async getUserLikes(userId) {
    return this.get(apiConfig.endpoints.userLikes(userId));
  }
}

// 導出單例
export default new ApiService();

