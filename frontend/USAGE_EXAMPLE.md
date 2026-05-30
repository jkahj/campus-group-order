# 前端 API 使用範例

## 📋 概述

本文件說明如何在前端應用中使用 API 服務來與後端進行互動。

---

## 🔧 基礎設定

### 1. 導入 API 服務

```javascript
import apiService from '../utils/apiService';
```

### 2. 確認 API 配置

確認 `frontend/config/apiConfig.js` 中的 `baseURL` 設定正確：

```javascript
development: {
  baseURL: 'http://localhost:8000',  // 或您的電腦 IP
  timeout: 10000,
}
```

---

## 📝 使用範例

### 用戶相關操作

#### 1. 創建用戶

```javascript
try {
  const newUser = await apiService.createUser({
    id: 'user_123',
    name: '張三',
    email: 'zhang@example.com',
    phone: '0912345678',
    password: 'password123',
  });
  console.log('用戶創建成功:', newUser);
} catch (error) {
  console.error('創建用戶失敗:', error);
}
```

#### 2. 獲取用戶資料

```javascript
try {
  const user = await apiService.getUser('user_123');
  console.log('用戶資料:', user);
} catch (error) {
  console.error('獲取用戶失敗:', error);
}
```

#### 3. 更新用戶資料

```javascript
try {
  const updatedUser = await apiService.updateUser('user_123', {
    name: '張三',
    photo: 'https://example.com/photo.jpg',
  });
  console.log('用戶更新成功:', updatedUser);
} catch (error) {
  console.error('更新用戶失敗:', error);
}
```

#### 4. 用戶登入

```javascript
try {
  const result = await apiService.login('test@example.com', 'password123');
  console.log('登入成功:', result);
  // 儲存 token
  await AsyncStorage.setItem('authToken', result.token);
} catch (error) {
  console.error('登入失敗:', error);
}
```

---

### 訂單相關操作

#### 1. 創建訂單

```javascript
try {
  const newOrder = await apiService.createOrder({
    id: `order_${Date.now()}`,
    name: '麥當勞',
    address: '台北市信義區',
    phone: '02-12345678',
    line: 'mcdonalds_line',
    method: '貨到付款',
    note: '請準時到達',
    created_by: 'user_123',
    created_at: Date.now(),
    expires_at: Date.now() + 3600000, // 1小時後過期
  });
  console.log('訂單創建成功:', newOrder);
} catch (error) {
  console.error('創建訂單失敗:', error);
}
```

#### 2. 獲取所有訂單

```javascript
try {
  const orders = await apiService.getAllOrders();
  console.log('訂單列表:', orders);
} catch (error) {
  console.error('獲取訂單失敗:', error);
}
```

#### 3. 獲取用戶的訂單

```javascript
try {
  const myOrders = await apiService.getOrdersByUser('user_123');
  console.log('我的訂單:', myOrders);
} catch (error) {
  console.error('獲取訂單失敗:', error);
}
```

#### 4. 更新訂單狀態

```javascript
try {
  const updatedOrder = await apiService.updateOrder('order_123', {
    status: 'delivering',
    joined: 5,
  });
  console.log('訂單更新成功:', updatedOrder);
} catch (error) {
  console.error('更新訂單失敗:', error);
}
```

---

### 留言相關操作

#### 1. 創建留言

```javascript
try {
  const newComment = await apiService.createComment({
    id: `comment_${Date.now()}`,
    order_id: 'order_123',
    commenter_id: 'user_123',
    commenter_name: '張三',
    commenter_phone: '0912345678',
    text: '我想參加這個代購',
    timestamp: Date.now(),
  });
  console.log('留言創建成功:', newComment);
} catch (error) {
  console.error('創建留言失敗:', error);
}
```

#### 2. 獲取訂單的留言

```javascript
try {
  const comments = await apiService.getCommentsByOrder('order_123');
  console.log('訂單留言:', comments);
} catch (error) {
  console.error('獲取留言失敗:', error);
}
```

#### 3. 更新留言狀態（接單）

```javascript
try {
  const updatedComment = await apiService.updateComment('comment_123', {
    delivery_status: 'accepted',
    accepted: true,
    accepted_at: Date.now(),
  });
  console.log('留言更新成功:', updatedComment);
} catch (error) {
  console.error('更新留言失敗:', error);
}
```

---

### 通知相關操作

#### 1. 發送通知

```javascript
try {
  const result = await apiService.sendNotification(
    'user_123',  // 目標用戶
    '到貨通知',   // 標題
    '您的訂單已到貨，請及時領取',  // 內容
    'order_123',  // 訂單 ID
    'arrival'     // 通知類型
  );
  console.log('通知發送成功:', result);
} catch (error) {
  console.error('發送通知失敗:', error);
}
```

#### 2. 獲取用戶的通知

```javascript
try {
  const result = await apiService.getNotificationsByUser('user_123');
  console.log('通知列表:', result.notifications);
  console.log('未讀數量:', result.unread_count);
} catch (error) {
  console.error('獲取通知失敗:', error);
}
```

#### 3. 標記通知為已讀

```javascript
try {
  const result = await apiService.markNotificationRead('user_123', 'notif_123');
  console.log('通知已標記為已讀:', result);
} catch (error) {
  console.error('標記已讀失敗:', error);
}
```

---

### 評價相關操作

#### 1. 創建評價

```javascript
try {
  const newReview = await apiService.createReview({
    id: `review_${+ Date.now()}`,
    target_user_id: 'user_123',
    reviewer_id: 'user_456',
    reviewer_name: '李四',
    rating: 5,
    comment: '服務很好，準時到達',
    order_id: 'order_123',
    order_name: '麥當勞',
    timestamp: Date.now(),
  });
  console.log('評價創建成功:', newReview);
} catch (error) {
  console.error('創建評價失敗:', error);
}
```

#### 2. 獲取用戶的評價

```javascript
try {
  const reviews = await apiService.getReviewsByUser('user_123');
  console.log('用戶評價:', reviews);
} catch (error) {
  console.error('獲取評價失敗:', error);
}
```

---

### 信譽積分相關操作

#### 1. 獲取用戶信譽等級

```javascript
try {
  const userTier = await apiService.getUserTier('user_123');
  console.log('信譽等級:', userTier);
} catch (error) {
  console.error('獲取信譽等級失敗:', error);
}
```

#### 2. 獲取積分歷史

```javascript
try {
  const history = await apiService.getScoreHistory('user_123');
  console.log('積分歷史:', history);
} catch (error) {
  console.error('獲取積分歷史失敗:', error);
}
```

---

## 🔄 與 AsyncStorage 整合

您仍然可以同時使用 AsyncStorage 進行本地存儲，API 調用作為備份：

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../utils/apiService';

// 創建訂單並同時儲存到本地和遠端
const createOrderWithSync = async (orderData) => {
  try {
    // 儲存到本地
    const existingOrders = JSON.parse(await AsyncStorage.getItem('orders') || '[]');
    existingOrders.push(orderData);
    await AsyncStorage.setItem('orders', JSON.stringify(existingOrders));
    
    // 同步到後端
    await apiService.createOrder(orderData);
    
    console.log('訂單已同步到本地和遠端');
  } catch (error) {
    console.error('同步失敗:', error);
  }
};
```

---

## ⚠️ 錯誤處理

所有 API 調用都應該包含錯誤處理：

```javascript
const handleApiCall = async () => {
  try {
    const result = await apiService.getUser('user_123');
    // 處理成功結果
  } catch (error) {
    if (error.message.includes('404')) {
      // 處理未找到的情況
      console.log('用戶不存在');
    } else if (error.message.includes('Network')) {
      // 處理網路錯誤
      console.log('網路連接失敗，請檢查網路設置');
    } else {
      // 處理其他錯誤
      console.log('發生錯誤:', error.message);
    }
  }
};
```

---

## 📚 更多資訊

詳細的 API 文檔請參考：
- `backend/INTEGRATION_GUIDE.md` - 整合指南
- `frontend/config/apiConfig.js` - API 配置
- `frontend/utils/apiService.js` - API 服務實作

