/**
 * 數據庫連接管理器
 * 負責統一管理前端與後端的數據交互
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './apiService';
import apiConfig from '../config/apiConfig';

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.lastSyncTime = null;
    this.syncInterval = null;
  }

  /**
   * 檢查 API 連接狀態
   */
  async checkConnection() {
    try {
      // 使用 AbortController 實現超時
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超時
      
      const response = await fetch(`${apiConfig.baseURL}/health`, {
        signal: controller.signal,
        method: 'GET',
      });
      
      clearTimeout(timeoutId);
      
      const isOk = response.ok;
      this.isConnected = isOk;
      
      if (isOk) {
        console.log('✅ API 連接成功');
      } else {
        console.log('⚠️ API 連接失敗，狀態碼:', response.status);
      }
      
      return isOk;
    } catch (error) {
      // 靜默處理連接失敗，不顯示錯誤訊息
      this.isConnected = false;
      return false;
    }
  }

  /**
   * 初始化資料同步
   */
  async initializeSync() {
    try {
      // 檢查連接
      await this.checkConnection();

      // 設置定時同步（每5分鐘同步一次）
      this.syncInterval = setInterval(async () => {
        // 每次同步前重新檢查連接
        await this.checkConnection();
        if (this.isConnected) {
          await this.syncToDatabase();
        }
      }, 5 * 60 * 1000); // 5分鐘

      console.log('✅ 資料同步已初始化');
      
      // 如果連接成功，立即執行一次同步
      if (this.isConnected) {
        console.log('開始首次資料同步...');
        await this.syncToDatabase();
      }
    } catch (error) {
      console.error('初始化資料同步失敗:', error);
    }
  }

  /**
   * 同步本地資料到數據庫
   */
  async syncToDatabase() {
    if (!this.isConnected) {
      console.log('API 未連接，跳過同步');
      return;
    }

    try {
      console.log('開始同步資料到數據庫...');
      
      // 同步訂單
      await this.syncOrders();
      
      // 同步留言
      await this.syncComments();
      
      // 同步評價
      await this.syncReviews();
      
      // 同步點讚
      await this.syncLikes();
      
      this.lastSyncTime = Date.now();
      console.log('✅ 資料同步完成');
    } catch (error) {
      console.error('❌ 資料同步失敗:', error);
    }
  }

  /**
   * 同步訂單資料
   */
  async syncOrders() {
    try {
      const orders = JSON.parse(await AsyncStorage.getItem('orders') || '[]');
      
      for (const order of orders) {
        try {
          // 嘗試創建訂單（如果已存在會失敗，但不影響）
          await apiService.createOrder(order);
        } catch (error) {
          // 訂單已存在，嘗試更新
          try {
            await apiService.updateOrder(order.id, order);
          } catch (updateError) {
            // 如果是資料不存在（404）或格式錯誤（400），靜默處理
            const errorMessage = updateError.message || '';
            const isDataNotFound = updateError.status === 404 || 
                                   updateError.status === 400 ||
                                   errorMessage.includes('404') ||
                                   errorMessage.includes('400') ||
                                   errorMessage.includes('HTTP error! status: 404') ||
                                   errorMessage.includes('HTTP error! status: 400') ||
                                   errorMessage.includes('訂單不存在');
            
            if (!isDataNotFound) {
              // 只有其他錯誤才顯示
              console.log('訂單同步失敗:', order.id, errorMessage);
            }
          }
        }
      }
    } catch (error) {
      console.error('同步訂單失敗:', error);
    }
  }

  /**
   * 同步留言資料
   */
  async syncComments() {
    try {
      const commentsData = JSON.parse(await AsyncStorage.getItem('comments') || '{}');
      
      for (const [orderId, comments] of Object.entries(commentsData)) {
        for (const comment of comments) {
          try {
            await apiService.createComment(comment);
          } catch (error) {
            // 留言已存在，嘗試更新
            try {
              await apiService.updateComment(comment.id, comment);
            } catch (updateError) {
              // 如果是資料不存在（404）或格式錯誤（400），靜默處理
              const errorMessage = updateError.message || '';
              const isDataNotFound = updateError.status === 404 || 
                                     updateError.status === 400 ||
                                     errorMessage.includes('404') ||
                                     errorMessage.includes('400') ||
                                     errorMessage.includes('HTTP error! status: 404') ||
                                     errorMessage.includes('HTTP error! status: 400') ||
                                     errorMessage.includes('留言不存在') ||
                                     errorMessage.includes('訂單不存在');
              
              if (!isDataNotFound) {
                // 只有其他錯誤才顯示
                console.log('留言同步失敗:', comment.id, errorMessage);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('同步留言失敗:', error);
    }
  }

  /**
   * 同步評價資料
   */
  async syncReviews() {
    try {
      const userReviews = JSON.parse(await AsyncStorage.getItem('userReviews') || '{}');
      
      for (const [userId, reviews] of Object.entries(userReviews)) {
        for (const review of reviews) {
          try {
            await apiService.createReview(review);
          } catch (error) {
            // 如果是資料不存在（404）或格式錯誤（400），靜默處理
            const errorMessage = error.message || '';
            const isDataNotFound = error.status === 404 || 
                                   error.status === 400 ||
                                   errorMessage.includes('404') ||
                                   errorMessage.includes('400') ||
                                   errorMessage.includes('HTTP error! status: 404') ||
                                   errorMessage.includes('HTTP error! status: 400') ||
                                   errorMessage.includes('評價不存在') ||
                                   errorMessage.includes('訂單不存在');
            
            if (!isDataNotFound) {
              // 只有其他錯誤才顯示
              console.log('評價同步失敗:', review.id, errorMessage);
            }
          }
        }
      }
    } catch (error) {
      console.error('同步評價失敗:', error);
    }
  }

  /**
   * 同步點讚資料
   */
  async syncLikes() {
    try {
      const likes = JSON.parse(await AsyncStorage.getItem('likes') || '{}');
      
      for (const [orderId, liked] of Object.entries(likes)) {
        if (liked) {
          try {
            // 創建點讚記錄
            await apiService.post(`/user-likes`, {
              id: `like_${orderId}_${Date.now()}`,
              user_id: 'me', // 當前用戶ID
              order_id: orderId,
              liked: true,
              timestamp: Date.now()
            });
          } catch (error) {
            // 如果是資料不存在（404）或格式錯誤（400），靜默處理
            const errorMessage = error.message || '';
            const isDataNotFound = error.status === 404 || 
                                   error.status === 400 ||
                                   errorMessage.includes('404') ||
                                   errorMessage.includes('400') ||
                                   errorMessage.includes('HTTP error! status: 404') ||
                                   errorMessage.includes('HTTP error! status: 400') ||
                                   errorMessage.includes('訂單不存在') ||
                                   errorMessage.includes('點讚不存在');
            
            if (!isDataNotFound) {
              // 只有其他錯誤才顯示
              console.log('點讚同步失敗:', orderId, errorMessage);
            }
          }
        }
      }
    } catch (error) {
      console.error('同步點讚失敗:', error);
    }
  }

  /**
   * 停止同步
   */
  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('資料同步已停止');
    }
  }

  /**
   * 獲取用戶資料（優先從數據庫獲取）
   */
  async getUser(userId) {
    try {
      if (this.isConnected) {
        const user = await apiService.getUser(userId);
        // 緩存到本地
        await AsyncStorage.setItem(`user_${userId}`, JSON.stringify(user));
        return user;
      }
    } catch (error) {
      console.log('從數據庫獲取用戶失敗，使用本地緩存');
    }
    
    // 從本地緩存獲取
    const cachedUser = await AsyncStorage.getItem(`user_${userId}`);
    return cachedUser ? JSON.parse(cachedUser) : null;
  }

  /**
   * 獲取訂單列表（優先從數據庫獲取）
   */
  async getOrders() {
    try {
      if (this.isConnected) {
        const orders = await apiService.getAllOrders();
        // 緩存到本地
        await AsyncStorage.setItem('orders', JSON.stringify(orders));
        return orders;
      }
    } catch (error) {
      console.log('從數據庫獲取訂單失敗，使用本地緩存');
    }
    
    // 從本地緩存獲取
    const localOrders = await AsyncStorage.getItem('orders');
    return localOrders ? JSON.parse(localOrders) : [];
  }

  /**
   * 獲取訂單的留言（優先從數據庫獲取）
   */
  async getComments(orderId) {
    try {
      if (this.isConnected) {
        const comments = await apiService.getCommentsByOrder(orderId);
        // 更新本地緩存
        const allComments = JSON.parse(await AsyncStorage.getItem('comments') || '{}');
        allComments[orderId] = comments;
        await AsyncStorage.setItem('comments', JSON.stringify(allComments));
        return comments;
      }
    } catch (error) {
      console.log('從數據庫獲取留言失敗，使用本地緩存');
    }
    
    // 從本地緩存獲取
    const allComments = JSON.parse(await AsyncStorage.getItem('comments') || '{}');
    return allComments[orderId] || [];
  }

  /**
   * 創建訂單（同時保存到數據庫和本地）
   */
  async createOrder(orderData) {
    try {
      // 嘗試保存到數據庫
      if (this.isConnected) {
        await apiService.createOrder(orderData);
      }
    } catch (error) {
      console.log('保存訂單到數據庫失敗:', error.message);
    }
    
    // 無論如何都保存到本地
    const orders = JSON.parse(await AsyncStorage.getItem('orders') || '[]');
    orders.push(orderData);
    await AsyncStorage.setItem('orders', JSON.stringify(orders));
    
    return orderData;
  }

  /**
   * 創建留言（同時保存到數據庫和本地）
   */
  async createComment(commentData) {
    try {
      // 嘗試保存到數據庫
      if (this.isConnected) {
        await apiService.createComment(commentData);
      }
    } catch (error) {
      console.log('保存留言到數據庫失敗:', error.message);
    }
    
    // 無論如何都保存到本地
    const allComments = JSON.parse(await AsyncStorage.getItem('comments') || '{}');
    const orderId = commentData.order_id;
    if (!allComments[orderId]) {
      allComments[orderId] = [];
    }
    allComments[orderId].push(commentData);
    await AsyncStorage.setItem('comments', JSON.stringify(allComments));
    
    return commentData;
  }
}

// 導出單例
export default new DatabaseConnection();

