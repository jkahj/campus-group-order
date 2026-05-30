/**
 * 資料同步服務
 * 將前端操作同步到後端資料庫
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './apiService';

class DataSyncService {
  constructor() {
    this.syncEnabled = true; // 是否啟用同步
    this.apiAvailable = false;
    this.checkApiAvailability();
  }

  /**
   * 檢查 API 是否可用
   */
  async checkApiAvailability() {
    try {
      const response = await fetch('http://localhost:8001/health');
      this.apiAvailable = response.ok;
      console.log('API 可用:', this.apiAvailable);
    } catch (error) {
      this.apiAvailable = false;
      console.log('API 不可用，使用本地存儲:', error.message);
    }
  }

  /**
   * 獲取所有訂單（從本地或 API）
   */
  async getAllOrders() {
    try {
      if (this.apiAvailable && this.syncEnabled) {
        // 從 API 獲取
        const orders = await apiService.getAllOrders();
        // 同步到本地
        await AsyncStorage.setItem('orders', JSON.stringify(orders));
        return orders;
      } else {
        // 從本地獲取
        const saved = await AsyncStorage.getItem('orders');
        return saved ? JSON.parse(saved) : [];
      }
    } catch (error) {
      console.error('獲取訂單失敗:', error);
      // 失敗時回退到本地
      const saved = await AsyncStorage.getItem('orders');
      return saved ? JSON.parse(saved) : [];
    }
  }

  /**
   * 創建訂單
   */
  async createOrder(orderData) {
    try {
      // 保存到本地
      const orders = await this.getAllOrders();
      orders.push(orderData);
      await AsyncStorage.setItem('orders', JSON.stringify(orders));

      // 同步到 API
      if (this.apiAvailable && this.syncEnabled) {
        try {
          await apiService.createOrder(orderData);
          console.log('訂單已同步到資料庫');
        } catch (apiError) {
          console.log('API 同步失敗，但本地已保存:', apiError.message);
        }
      }

      return orderData;
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
      // 更新本地
      const orders = await this.getAllOrders();
      const index = orders.findIndex(o => o.id === orderId);
      if (index !== -1) {
        orders[index] = { ...orders[index], ...orderData };
        await AsyncStorage.setItem('orders', JSON.stringify(orders));
      }

      // 同步到 API
      if (this.apiAvailable && this.syncEnabled) {
        try {
          await apiService.updateOrder(orderId, orderData);
          console.log('訂單更新已同步到資料庫');
        } catch (apiError) {
          console.log('API 同步失敗，但本地已更新:', apiError.message);
        }
      }

      return orders[index];
    } catch (error) {
      console.error('更新訂單失敗:', error);
      throw error;
    }
  }

  /**
   * 刪除訂單
   */
  async deleteOrder(orderId) {
    try {
      // 從本地刪除
      const orders = await this.getAllOrders();
      const filtered = orders.filter(o => o.id !== orderId);
      await AsyncStorage.setItem('orders', JSON.stringify(filtered));

      // 同步到 API
      if (this.apiAvailable && this.syncEnabled) {
        try {
          await apiService.deleteOrder(orderId);
          console.log('訂單刪除已同步到資料庫');
        } catch (apiError) {
          console.log('API 同步失敗，但本地已刪除:', apiError.message);
        }
      }
    } catch (error) {
      console.error('刪除訂單失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取訂單的留言
   */
  async getComments(orderId) {
    try {
      if (this.apiAvailable && this.syncEnabled) {
        const comments = await apiService.getCommentsByOrder(orderId);
        // 同步到本地
        const allComments = JSON.parse(await AsyncStorage.getItem('comments') || '{}');
        allComments[orderId] = comments;
        await AsyncStorage.setItem('comments', JSON.stringify(allComments));
        return comments;
      } else {
        const allComments = JSON.parse(await AsyncStorage.getItem('comments') || '{}');
        return allComments[orderId] || [];
      }
    } catch (error) {
      console.error('獲取留言失敗:', error);
      const allComments = JSON.parse(await AsyncStorage.getItem('comments') || '{}');
      return allComments[orderId] || [];
    }
  }

  /**
   * 創建留言
   */
  async createComment(commentData) {
    try {
      // 保存到本地
      const allComments = JSON.parse(await AsyncStorage.getItem('comments') || '{}');
      const orderComments = allComments[commentData.order_id] || [];
      orderComments.push(commentData);
      allComments[commentData.order_id] = orderComments;
      await AsyncStorage.setItem('comments', JSON.stringify(allComments));

      // 同步到 API
      if (this.apiAvailable && this.syncEnabled) {
        try {
          await apiService.createComment(commentData);
          console.log('留言已同步到資料庫');
        } catch (apiError) {
          console.log('API 同步失敗，但本地已保存:', apiError.message);
        }
      }

      return commentData;
    } catch (error) {
      console.error('創建留言失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取用戶資料
   */
  async getUser(userId) {
    try {
      if (this.apiAvailable && this.syncEnabled) {
        const user = await apiService.getUser(userId);
        await AsyncStorage.setItem('userData', JSON.stringify(user));
        return user;
      } else {
        const saved = await AsyncStorage.getItem('userData');
        return saved ? JSON.parse(saved) : null;
      }
    } catch (error) {
      // 對於 404「用戶不存在」視為正常情況，使用本地快取避免干擾前端日誌
      const message = error?.message || '';
      const status = error?.status;
      const isNotFound =
        status === 404 ||
        message.includes('HTTP error! status: 404') ||
        message.includes('用戶不存在');

      if (!isNotFound) {
        console.error('獲取用戶失敗:', error);
      }

      const saved = await AsyncStorage.getItem('userData');
      return saved ? JSON.parse(saved) : null;
    }
  }

  /**
   * 同步所有本地資料到資料庫
   */
  async syncAllLocalData() {
    if (!this.apiAvailable || !this.syncEnabled) {
      console.log('API 不可用，跳過同步');
      return;
    }

    try {
      // 同步訂單
      const orders = JSON.parse(await AsyncStorage.getItem('orders') || '[]');
      for (const order of orders) {
        try {
          await apiService.createOrder(order);
        } catch (error) {
          console.log('同步訂單失敗:', order.id, error.message);
        }
      }

      // 同步留言
      const comments = JSON.parse(await AsyncStorage.getItem('comments') || '{}');
      for (const [orderId, orderComments] of Object.entries(comments)) {
        for (const comment of orderComments) {
          try {
            await apiService.createComment(comment);
          } catch (error) {
            console.log('同步留言失敗:', comment.id, error.message);
          }
        }
      }

      console.log('✅ 所有資料已同步到資料庫');
    } catch (error) {
      console.error('同步資料失敗:', error);
    }
  }
}

export default new DataSyncService();

