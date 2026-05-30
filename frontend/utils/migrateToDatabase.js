/**
 * 資料遷移工具
 * 將 AsyncStorage 中的資料遷移到資料庫
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './apiService';

class DataMigrationService {
  /**
   * 檢查 API 是否可用（帶超時機制）
   */
  async checkApiAvailability() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2秒超時
      
      const response = await fetch('http://localhost:8001/health', {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      // 靜默失敗
      return false;
    }
  }

  /**
   * 遷移訂單資料
   */
  async migrateOrders() {
    try {
      const orders = JSON.parse(await AsyncStorage.getItem('orders') || '[]');

      let successCount = 0;
      let failCount = 0;

      for (const order of orders) {
        try {
          await apiService.createOrder(order);
          successCount++;
        } catch (error) {
          failCount++;
        }
      }

      return { success: successCount, failed: failCount };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 遷移留言資料
   */
  async migrateComments() {
    try {
      const allComments = JSON.parse(await AsyncStorage.getItem('comments') || '{}');

      let successCount = 0;
      let failCount = 0;

      for (const [orderId, comments] of Object.entries(allComments)) {
        for (const comment of comments) {
          try {
            // 確保有必要的欄位
            const commentData = {
              id: comment.id || `${comment.timestamp}_${Math.random().toString(36).substr(2, 5)}`,
              order_id: orderId,
              commenter_id: comment.commenterId || comment.commenter_id || 'me',
              commenter_name: comment.commenterName || comment.commenter_name || '用戶',
              commenter_phone: comment.commenterPhone || comment.commenter_phone,
              commenter_line: comment.commenterLine || comment.commenter_line,
              text: comment.text,
              timestamp: comment.timestamp || Date.now(),
              ...comment
            };
            
            await apiService.createComment(commentData);
            successCount++;
          } catch (error) {
            failCount++;
          }
        }
      }

      return { success: successCount, failed: failCount };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 遷移用戶資料
   */
  async migrateUsers() {
    try {
      const userData = JSON.parse(await AsyncStorage.getItem('userData') || 'null');
      
      if (!userData) {
        return { success: 0, failed: 0 };
      }

      try {
        // 使用 'me' 作為用戶 ID
        const user = {
          id: 'me',
          name: userData.username || userData.name || '用戶',
          email: userData.email || 'user@example.com',
          phone: userData.mobile || userData.phone || '',
          rating: userData.rating || 0,
          review_count: userData.reviewCount || 0,
        };

        await apiService.createUser(user);
        return { success: 1, failed: 0 };
      } catch (error) {
        return { success: 0, failed: 1 };
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * 遷移所有資料
   */
  async migrateAll() {
    try {
      const apiAvailable = await this.checkApiAvailability();
      if (!apiAvailable) {
        return;
      }

      // 遷移各類資料
      const ordersResult = await this.migrateOrders();
      const commentsResult = await this.migrateComments();
      const usersResult = await this.migrateUsers();

      const totalSuccess = ordersResult.success + commentsResult.success + usersResult.success;
      const totalFailed = ordersResult.failed + commentsResult.failed + usersResult.failed;

      return {
        orders: ordersResult,
        comments: commentsResult,
        users: usersResult,
        total: { success: totalSuccess, failed: totalFailed }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 清空 AsyncStorage 資料（可選）
   */
  async clearAsyncStorage() {
    try {
      console.log('🗑️  清空 AsyncStorage 資料...');
      
      const keys = [
        'orders',
        'comments',
        'userData',
        'likes',
        'likeCounts',
        'userReviews',
        'inbox',
        'userTiers',
        'scoreHistory'
      ];

      for (const key of keys) {
        await AsyncStorage.removeItem(key);
        console.log(`✅ 已清空 ${key}`);
      }

      console.log('\n✅ AsyncStorage 已清空');
    } catch (error) {
      console.error('清空 AsyncStorage 失敗:', error);
      throw error;
    }
  }

  /**
   * 完整遷移流程（遷移 + 清空本地）
   */
  async migrateAndClear() {
    try {
      // 先遷移
      const result = await this.migrateAll();
      
      // 確認是否清空
      console.log('\n要清空本地 AsyncStorage 資料嗎？');
      console.log('（這樣將完全使用資料庫的資料）');
      
      return result;
    } catch (error) {
      console.error('遷移流程出錯:', error);
      throw error;
    }
  }
}

export default new DataMigrationService();

