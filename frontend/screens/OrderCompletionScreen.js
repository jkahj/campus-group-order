import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Modal, FlatList, TextInput
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import simpleNotificationService from '../utils/simpleNotificationService';
import { updateUserCreditScore, CREDIT_RULES } from '../utils/creditScoreManager';
import apiService from '../utils/apiService';

export default function OrderCompletionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { order } = route.params || {};
  
  const [orderData, setOrderData] = useState(order);
  const [commenters, setCommenters] = useState([]);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedCommenter, setSelectedCommenter] = useState(null);
  const [showCommenterModal, setShowCommenterModal] = useState(false);
  const [isOrderFullyCompleted, setIsOrderFullyCompleted] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [remainingTime, setRemainingTime] = useState('');
  const [userReviews, setUserReviews] = useState({});

  useEffect(() => {
    if (order) {
      setOrderData(order);
      loadCommenters();
      loadUserReviews();
    }
  }, [order]);

  // 載入用戶評價資料
  const loadUserReviews = async () => {
    try {
      const reviews = JSON.parse(await AsyncStorage.getItem('userReviews')) || {};
      setUserReviews(reviews);
    } catch (error) {
      console.error('載入評價資料失敗:', error);
    }
  };

  // 檢查是否已經評價過
  const hasRated = (commenter) => {
    const commenterId = commenter.commenterId || commenter.id;
    const commenterReviews = userReviews[commenterId] || [];
    return commenterReviews.some(review => 
      review.reviewerId === 'me' && 
      review.orderId === orderData.id
    );
  };

  // 倒數計時器
  useEffect(() => {
    const updateRemainingTime = () => {
      // 支援多種時間欄位名稱
      const expiresAt = orderData?.expiresAt || orderData?.expires_at || orderData?.expires || null;
      
      if (expiresAt) {
        const now = Date.now();
        const remaining = expiresAt - now;
        
        if (remaining <= 0) {
          setRemainingTime('等待配送');
          return;
        }
        
        const totalSeconds = Math.floor(remaining / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        if (hours > 0) {
          setRemainingTime(`訂單截止剩餘 ${hours}小時${minutes > 0 ? minutes + '分鐘' : ''}`);
        } else if (minutes > 0) {
          setRemainingTime(`訂單截止剩餘 ${minutes}分鐘${seconds > 0 ? seconds + '秒' : ''}`);
        } else {
          setRemainingTime(`訂單截止剩餘 ${seconds}秒`);
        }
      } else {
        // 如果沒有截止時間，嘗試使用現有的 remaining 文本
        if (orderData?.remaining) {
          setRemainingTime(orderData.remaining);
        } else {
          setRemainingTime('訂單截止剩餘時間不明');
        }
      }
    };

    // 立即更新一次
    updateRemainingTime();
    
    // 每秒更新
    const timer = setInterval(updateRemainingTime, 1000);
    
    return () => clearInterval(timer);
  }, [orderData]);


  // 載入該訂單的所有留言者
  const loadCommenters = async () => {
    try {
      const saved = await AsyncStorage.getItem('comments');
      const parsed = saved ? JSON.parse(saved) : {};
      const orderComments = parsed[orderData.id] || [];
      
      console.log('載入留言者資料:', {
        orderId: orderData.id,
        orderComments: orderComments.map(c => ({ 
          id: c.id, 
          commenterId: c.commenterId, 
          deliveryStatus: c.deliveryStatus,
          accepted: c.accepted 
        }))
      });
      
      // 過濾出有效的留言者（排除回覆和被忽略的留言）
      const validCommenters = orderComments
        .filter(comment => {
          // 排除回覆
          if (comment.isReply) return false;
          // 排除被忽略的留言（檢查多個可能的忽略標記）
          if (comment.status === 'ignored' || comment.status === 'ignore' || comment.ignored || comment.deliveryStatus === 'ignored') return false;
          return true;
        })
        .map((comment, index) => ({
          id: `${comment.commenterId || comment.id || 'unknown'}_${index}`, // 使用穩定的 ID，不包含時間戳
          commenterId: comment.commenterId || comment.id || 'unknown', // 保留原始 commenterId（可能是錯誤的）
          commenterName: comment.commenterName || comment.user || '匿名用戶',
          name: comment.commenterName || comment.user || '匿名用戶',
          text: comment.text,
          timestamp: comment.timestamp,
          status: comment.deliveryStatus || 'pending', // 配送狀態
          accepted: comment.accepted || false, // 是否已接單
          acceptedAt: comment.acceptedAt,
          deliveryStartTime: comment.deliveryStartTime,
          arrivalTime: comment.arrivalTime,
          completed: comment.completed || false,
          ignored: comment.ignored || false,
          creditTier: comment.creditTier || '掰咖', // 信譽等級
          originalCommentId: comment.id, // 保存原始留言 ID，用於精確匹配（重要：用於從後端 API 獲取真實的 commenter_id）
          actualUserId: comment.actualUserId || comment.commenter_id || comment.commenterId || null, // 實際用戶 ID（留言者的真實 user_id，從後端獲取）
          creditScore: comment.creditScore || 0 // 信譽積分
        }));
      
      console.log('處理後的留言者:', validCommenters.map(c => ({ 
        id: c.id, 
        commenterId: c.commenterId, 
        status: c.status,
        accepted: c.accepted 
      })));
      
      setCommenters(validCommenters);
      
      // 檢查是否所有留言者都已完成
      checkAllCompleted(validCommenters);
    } catch (error) {
      console.error('載入留言者失敗:', error);
    }
  };

  // 發送通知給特定留言者
  const sendNotificationToCommenter = async (commenter, title, body, type = 'delivery_update') => {
    try {
      const targetUserId = commenter?.commenterId || commenter?.id;
      const commentId = commenter?.originalCommentId || commenter?.id;

      if (!targetUserId) {
        console.warn('⚠️ 無法發送通知，缺少 targetUserId', commenter);
        return false;
      }

      // 確保通知服務已初始化
      if (!simpleNotificationService.isInitialized) {
        await simpleNotificationService.initialize('me'); // 使用當前用戶ID初始化
      }

      // 使用簡化通知服務發送個別通知
      const success = await simpleNotificationService.sendNotificationToUser(
        targetUserId,
        title,
        body,
        orderData?.id,
        type
      );

      // 使用統一的通知工具函數（已包含 AsyncStorage 和資料庫同步）
      const { sendNotificationToCommenter } = require('../utils/notificationHelper');
      await sendNotificationToCommenter(
        targetUserId,
        type,
        title,
        body,
        {
          order_id: orderData?.id,
          order_name: orderData?.name,
          commenter_id: commenter?.commenterId || commenter?.id,
          comment_id: commentId || null,
        }
      );

      return success;
    } catch (error) {
      console.error('發送通知失敗:', error);
      return false;
    }
  };

  // 更新留言者的配送狀態
  const updateCommenterStatus = async (commenterId, newStatus, additionalData = {}) => {
    try {
      const saved = await AsyncStorage.getItem('comments');
      const parsed = saved ? JSON.parse(saved) : {};
      const orderComments = parsed[orderData.id] || [];
      
      console.log('更新留言者狀態 (updateCommenterStatus):', {
        commenterId,
        newStatus,
        additionalData,
        orderComments: orderComments.map(c => ({ id: c.id, commenterId: c.commenterId, deliveryStatus: c.deliveryStatus }))
      });
      
      const updatedComments = orderComments.map(comment => {
        // 只使用留言的唯一ID進行精確匹配，避免同一個用戶的多筆留言都被匹配
        // comment.id 是每個留言的唯一標識符，應該只用它來匹配
        const matchesById = comment.id === commenterId;
        
        if (matchesById) {
          console.log('找到匹配的留言，更新狀態 (updateCommenterStatus):', {
            commenterId,
            commentId: comment.id,
            commenterIdFromComment: comment.commenterId,
            newStatus,
            additionalData
          });
          return {
            ...comment,
            deliveryStatus: newStatus,
            ...additionalData
          };
        }
        return comment;
      });
      
      parsed[orderData.id] = updatedComments;
      await AsyncStorage.setItem('comments', JSON.stringify(parsed));
      
      // 更新本地狀態（只在非批量操作時更新）
      // 使用 originalCommentId 進行精確匹配
      setCommenters(prev => prev.map(c => {
        const commentId = c.originalCommentId || c.id;
        const isMatch = commentId === commenterId;
        
        if (isMatch) {
          return { ...c, status: newStatus, ...additionalData };
        }
        return c;
      }));
      
      return true;
    } catch (error) {
      console.error('更新留言者狀態失敗:', error);
      return false;
    }
  };

  // 更新留言者狀態（不更新本地狀態，用於批量操作）
  const updateCommenterStatusWithoutLocalUpdate = async (commenterId, newStatus, additionalData = {}) => {
    try {
      const saved = await AsyncStorage.getItem('comments');
      const parsed = saved ? JSON.parse(saved) : {};
      const orderComments = parsed[orderData.id] || [];
      
      console.log('更新留言者狀態:', {
        commenterId,
        newStatus,
        additionalData,
        orderComments: orderComments.map(c => ({ id: c.id, commenterId: c.commenterId, deliveryStatus: c.deliveryStatus }))
      });
      
      const updatedComments = orderComments.map(comment => {
        // 只使用留言的唯一ID進行精確匹配，避免同一個用戶的多筆留言都被匹配
        // comment.id 是每個留言的唯一標識符，應該只用它來匹配
        const matchesById = comment.id === commenterId;
        
        if (matchesById) {
          console.log('找到匹配的留言，更新狀態:', {
            commenterId,
            commentId: comment.id,
            commenterIdFromComment: comment.commenterId,
            newStatus,
            additionalData
          });
          return {
            ...comment,
            deliveryStatus: newStatus,
            ...additionalData
          };
        }
        return comment;
      });
      
      parsed[orderData.id] = updatedComments;
      await AsyncStorage.setItem('comments', JSON.stringify(parsed));
      
      // 不更新本地狀態，避免與批量操作衝突
      
      return true;
    } catch (error) {
      console.error('更新留言者狀態失敗:', error);
      return false;
    }
  };

  // 處理配送中按鈕（針對所有留言者）
  const handleDeliveryStart = () => {
    setShowDeliveryModal(true);
  };

  // 確認開始配送（針對所有留言者）
  const confirmDeliveryStart = async () => {
    try {
      // 只處理已接單的留言者
      const acceptedCommenters = commenters.filter(commenter => commenter.accepted);
      
      if (acceptedCommenters.length === 0) {
        Alert.alert('無法開始配送', '沒有已接單的留言者');
        setShowDeliveryModal(false);
        return;
      }
      
      // 先更新本地狀態，讓UI立即響應
      const updatedCommenters = commenters.map(commenter => {
        if (commenter.accepted) {
          return {
            ...commenter,
            status: 'delivering',
            deliveryStartTime: Date.now()
          };
        }
        return commenter;
      });
      setCommenters(updatedCommenters);
      
      // 將所有已接單的留言者狀態都更新為配送中
      const promises = acceptedCommenters.map(commenter => 
        updateCommenterStatusWithoutLocalUpdate(
          commenter.id, 
          'delivering', 
          { 
            deliveryStartTime: Date.now()
          }
        )
      );
      
      const results = await Promise.all(promises);
      const allSuccess = results.every(result => result === true);
      
      if (allSuccess) {
        // 更新訂單狀態為配送中，使其從首頁消失
        const stored = await AsyncStorage.getItem('orders');
        const orders = stored ? JSON.parse(stored) : [];
        const updatedOrders = orders.map(order => 
          order.id === orderData.id 
            ? { ...order, status: 'delivering', deliveryStartTime: Date.now() }
            : order
        );
        await AsyncStorage.setItem('orders', JSON.stringify(updatedOrders));
        
        // 發送通知給所有已接單的留言者
        const notificationPromises = acceptedCommenters.map(commenter =>
          sendNotificationToCommenter(
            commenter,
            '配送開始通知',
            `您的代購訂單「${orderData.name}」已開始配送，請注意查收！\n\n配送狀態將由發起者逐筆控制，請耐心等待到貨通知。`
          )
        );
        await Promise.all(notificationPromises);
        
        setShowDeliveryModal(false);
        Alert.alert(
          '配送已開始', 
          `${acceptedCommenters.length} 位已接單的留言者都已收到配送開始通知\n\n所有參與者的訂單狀態已變更為「配送中」\n\n請逐筆為每位留言者點擊「完成」按鈕`
        );
        
        // 不需要重新載入留言者數據，因為我們已經更新了本地狀態
      } else {
        // 如果更新失敗，恢復原狀態
        await loadCommenters();
      }
    } catch (error) {
      console.error('更新配送狀態失敗:', error);
      Alert.alert('操作失敗', '請稍後再試');
      // 發生錯誤時重新載入數據
      await loadCommenters();
    }
  };

  // 處理到貨通知（針對特定留言者）
  const handleArrivalNotification = (commenter) => {
    setSelectedCommenter(commenter);
    setShowArrivalModal(true);
  };

  // 確認到貨通知（針對特定留言者）
  const confirmArrivalNotification = async () => {
    if (!selectedCommenter) return;
    
    try {
      // 使用原始留言 ID 進行精確匹配，而不是生成的 ID
      const commentId = selectedCommenter.originalCommentId || selectedCommenter.id;
      const success = await updateCommenterStatus(
        commentId, 
        'completed', // 直接設置為已完成狀態
        { arrivalTime: Date.now(), completed: true, completedTime: Date.now() }
      );
      
      if (success) {
        // 發送到貨/完成通知，提示留言者可點擊通知前往評價代購者
        // 傳遞完整的訂單和留言者信息，確保通知點擊後能正確導航到評價頁面
        const commenterId = selectedCommenter.id || selectedCommenter.commenterId || selectedCommenter.originalCommentId;
        await sendNotificationToCommenter(
          commenterId,
          'orderCompleted', // 通知類型
          '訂單已完成',
          `您的代購訂單「${orderData.name}」已完成。點擊此通知即可前往評價代購者。`,
          {
            order_id: orderData.id,
            order_name: orderData.name,
            commenter_id: commenterId,
            comment_id: selectedCommenter.originalCommentId || selectedCommenter.id,
          }
        );

        // 訂單完成後雙方積分加減（維持原規則）
        try {
          // 代購發起者：訂單完成 +2 分
          await updateUserCreditScore('me', CREDIT_RULES.initiator.orderCompleted, '訂單完成', orderData.id);
          // 留言者：完成參與 +2 分（以參與度獎勵表示完成取貨）
          await updateUserCreditScore(selectedCommenter.id, CREDIT_RULES.participant.activeParticipation, '完成訂單參與', orderData.id);
        } catch (e) {
          console.log('更新完成積分時發生錯誤（略過不中斷流程）:', e);
        }

        setShowArrivalModal(false);
        // 確保傳遞完整的留言者資訊，包括 originalCommentId
        const commenterToRate = {
          ...selectedCommenter,
          // 確保 originalCommentId 存在，這是後端用來查找留言者真實 user_id 的關鍵
          originalCommentId: selectedCommenter.originalCommentId || selectedCommenter.id,
          commentId: selectedCommenter.originalCommentId || selectedCommenter.id,
        };
        setSelectedCommenter(null);

        // 檢查是否所有留言者都已完成
        await checkAllCompleted();

        // 代購者立即前往評價留言者
        // 重要：isFromPurchaser=true 表示這是發起者（orders.created_by）對留言者（comments.commenter_id）的評價
        navigation.navigate('OrderRating', {
          orderInfo: orderData,
          commenterInfo: commenterToRate,
          isFromPurchaser: true // 明確標記這是發起者評價留言者
        });

        // 不需要重新載入留言者數據，因為我們已經更新了本地狀態
      }
    } catch (error) {
      console.error('更新完成狀態失敗:', error);
      Alert.alert('操作失敗', '請稍後再試');
    }
  };

  // 處理完成訂單（針對特定留言者）
  const handleCompleteOrder = (commenter) => {
    setSelectedCommenter(commenter);
    setShowCompleteModal(true);
  };




  // 確認完成訂單（針對特定留言者）
  const confirmCompleteOrder = async () => {
    if (!selectedCommenter) return;
    
    try {
      // 使用原始留言 ID 進行精確匹配，而不是生成的 ID
      const commentId = selectedCommenter.originalCommentId || selectedCommenter.id;
      const success = await updateCommenterStatus(
        commentId, 
        'completed', 
        { completed: true, completedTime: Date.now() }
      );
      
      if (success) {
        // 發送通知，提示留言者可點擊通知前往評價代購者
        // 傳遞完整的訂單和留言者信息，確保通知點擊後能正確導航到評價頁面
        const commenterId = selectedCommenter.id || selectedCommenter.commenterId || selectedCommenter.originalCommentId;
        await sendNotificationToCommenter(
          commenterId,
          'orderCompleted', // 通知類型
          '訂單已完成',
          `您的代購訂單「${orderData.name}」已完成。點擊此通知即可前往評價代購者。`,
          {
            order_id: orderData.id,
            order_name: orderData.name,
            commenter_id: commenterId,
            comment_id: selectedCommenter.originalCommentId || selectedCommenter.id,
          }
        );

        // 訂單完成後雙方積分加減（維持原規則）
        try {
          await updateUserCreditScore('me', CREDIT_RULES.initiator.orderCompleted, '訂單完成', orderData.id);
          await updateUserCreditScore(selectedCommenter.id, CREDIT_RULES.participant.activeParticipation, '完成訂單參與', orderData.id);
        } catch (e) {
          console.log('更新完成積分時發生錯誤（略過不中斷流程）:', e);
        }
        
        setShowCompleteModal(false);
        setSelectedCommenter(null);
        
        // 導航到評價畫面（發起者評價留言者）
        // 注意：這裡是發起者（代購者）對留言者進行評價
        // isFromPurchaser: true 表示發起者評價留言者
        Alert.alert(
          '訂單已完成', 
          `${selectedCommenter.name} 的訂單已完成\n\n請為這次代購服務進行評價`,
          [
            {
              text: '稍後評價',
              style: 'cancel',
              onPress: () => loadCommenters()
            },
            {
              text: '立即評價',
              onPress: () => {
                navigation.navigate('OrderRating', {
                  orderInfo: orderData,
                  commenterInfo: selectedCommenter,
                  isFromPurchaser: true // 重要：明確標記這是發起者評價留言者
                });
              }
            }
          ]
        );
        
        // 重新載入留言者數據，檢查是否所有訂單都已完成
        loadCommenters();
      }
    } catch (error) {
      console.error('完成訂單失敗:', error);
      Alert.alert('操作失敗', '請稍後再試');
    }
  };

  // 查看留言者詳情
  const viewCommenterDetail = (commenter) => {
    setSelectedCommenter(commenter);
    setShowCommenterModal(true);
  };


  // 更新訂單狀態
  const updateOrderStatus = async (newStatus) => {
    try {
      const stored = await AsyncStorage.getItem('orders');
      const orders = stored ? JSON.parse(stored) : [];
      const updatedOrders = orders.map(o => 
        o.id === orderData.id ? { ...o, status: newStatus, completedAt: Date.now() } : o
      );
      await AsyncStorage.setItem('orders', JSON.stringify(updatedOrders));
      
      // 更新本地狀態
      setOrderData(prev => ({ ...prev, status: newStatus }));
    } catch (error) {
      console.error('更新訂單狀態失敗:', error);
    }
  };

  // 處理刪除訂單
  const handleDeleteOrder = () => {
    setShowDeleteModal(true);
  };

  // 確認刪除訂單
  const confirmDeleteOrder = async () => {
    try {
      // 從訂單列表中刪除
      const stored = await AsyncStorage.getItem('orders');
      const orders = stored ? JSON.parse(stored) : [];
      const updatedOrders = orders.filter(o => o.id !== orderData.id);
      await AsyncStorage.setItem('orders', JSON.stringify(updatedOrders));

      // 從留言中刪除
      const saved = await AsyncStorage.getItem('comments');
      const parsed = saved ? JSON.parse(saved) : {};
      delete parsed[orderData.id];
      await AsyncStorage.setItem('comments', JSON.stringify(parsed));

      // 從通知中刪除相關通知
      const inbox = JSON.parse(await AsyncStorage.getItem('inbox')) || [];
      const filteredInbox = inbox.filter(notification => notification.orderId !== orderData.id);
      await AsyncStorage.setItem('inbox', JSON.stringify(filteredInbox));

      setShowDeleteModal(false);
      Alert.alert(
        '刪除成功',
        '訂單已從歷史紀錄中刪除',
        [
          {
            text: '確定',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      console.error('刪除訂單失敗:', error);
      Alert.alert('操作失敗', '刪除訂單失敗，請稍後再試');
    }
  };

  // 獲取狀態文字
  const getStatusText = (status, accepted) => {
    if (!accepted) {
      return '未接單';
    } else if (status === 'accepted' || status === 'pending') {
      return '已接單';
    } else if (status === 'delivering') {
      return '配送中';
    } else if (status === 'completed') {
      return '已完成';
    } else {
      return '已接單'; // 預設為已接單狀態
    }
  };

  // 檢查是否所有留言者都已完成
  const checkAllCompleted = async (currentCommenters = commenters) => {
    // 只檢查已接單的留言者
    const acceptedCommenters = currentCommenters.filter(commenter => commenter.accepted);
    const allCompleted = acceptedCommenters.length > 0 && 
      acceptedCommenters.every(commenter => commenter.status === 'completed');
    
    setIsOrderFullyCompleted(allCompleted);
    
    // 如果所有已接單的留言者都已完成，更新訂單狀態為已完成
    if (allCompleted) {
      await updateOrderStatus('completed');
    }
  };

  // 檢查是否已經開始配送
  const hasStartedDelivery = () => {
    return commenters.length > 0 && 
      commenters.some(commenter => commenter.status === 'delivering' || commenter.status === 'completed');
  };

  // 獲取狀態顏色
  const getStatusColor = (status, accepted) => {
    if (!accepted) {
      return '#FF6B6B'; // 紅色 - 未接單
    } else if (status === 'accepted' || status === 'pending') {
      return '#007AFF'; // 藍色 - 已接單
    } else if (status === 'delivering') {
      return '#FF9500'; // 橙色 - 配送中
    } else if (status === 'completed') {
      return '#34C759'; // 綠色 - 已完成
    } else {
      return '#007AFF'; // 藍色 - 已接單
    }
  };

  // 渲染留言者項目
  const renderCommenterItem = ({ item }) => (
    <View style={styles.commenterCard}>
      <View style={styles.commenterHeader}>
        <View style={styles.commenterInfo}>
          <FontAwesome name="user-circle-o" size={20} color="#6BA4FF" />
          <View style={styles.commenterDetails}>
            <Text style={styles.commenterName}>{item.name}</Text>
            <View style={styles.creditBadge}>
              <FontAwesome name="star" size={12} color="#FFD700" />
              <Text style={styles.creditText}>信譽等級: {item.creditTier || '掰咖'}</Text>
            </View>
          </View>
        </View>
        <View style={styles.statusBadge}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status, item.accepted) }]}>
            {getStatusText(item.status, item.accepted)}
          </Text>
        </View>
      </View>
      
      <Text style={styles.commentText}>{item.text}</Text>
      
      <View style={styles.commenterActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => viewCommenterDetail(item)}
        >
          <MaterialIcons name="info" size={16} color="#007aff" />
          <Text style={styles.actionButtonText}>詳情</Text>
        </TouchableOpacity>
        
        {/* 配送中狀態：只顯示通知到貨按鈕 */}
        {item.status === 'delivering' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.arrivalButton]}
            onPress={() => handleArrivalNotification(item)}
          >
            <MaterialIcons name="check-circle" size={16} color="#fff" />
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>完成</Text>
          </TouchableOpacity>
        )}
        
        {/* 已完成狀態：顯示評價按鈕或已評價狀態 */}
        {item.status === 'completed' && (
          hasRated(item) ? (
            <View style={[styles.actionButton, styles.ratedButton]}>
              <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
              <Text style={[styles.actionButtonText, { color: '#4CAF50' }]}>已評價</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.actionButton, styles.ratingButton]}
              onPress={() => {
                // 導航到評價頁面，讓代購者評價留言者
                navigation.navigate('OrderRating', {
                  orderInfo: orderData,
                  commenterInfo: item,
                  isFromPurchaser: true
                });
              }}
            >
              <MaterialIcons name="star" size={16} color="#fff" />
              <Text style={[styles.actionButtonText, { color: '#fff' }]}>評價留言者</Text>
            </TouchableOpacity>
          )
        )}
        
        
      </View>
    </View>
  );

  if (!orderData) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>訂單資料載入失敗</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#007aff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>訂單管理</Text>
      </View>

      {/* 訂單基本信息 */}
      <View style={styles.orderInfo}>
        <Text style={styles.orderTitle}>{orderData.name}</Text>
        <Text style={styles.orderLocation}>📍 地點：{orderData.address}</Text>
        <Text style={styles.orderContact}>📞 聯絡方式：{orderData.phone}</Text>
        {orderData.line && <Text style={styles.orderLine}>💬 Line ID：{orderData.line}</Text>}
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <MaterialIcons name="people" size={20} color="#666" />
            <Text style={styles.statText}>留言人數：{commenters.length}</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.statText}>已接單：{commenters.filter(c => c.accepted).length}</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialIcons name="schedule" size={20} color="#666" />
            <Text style={styles.statText}>{remainingTime}</Text>
          </View>
        </View>

        {/* 全部完成狀態 */}
        {isOrderFullyCompleted && (
          <View style={styles.completionStatus}>
            <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
            <Text style={styles.completionText}>已完成所有訂單</Text>
          </View>
        )}

        {/* 開始配送按鈕 - 在刪除歷史訂單按鈕上方 */}
        {!isOrderFullyCompleted && !hasStartedDelivery() && commenters.filter(c => c.accepted).length > 0 && (
          <View style={styles.deliverySection}>
            <TouchableOpacity 
              style={styles.deliveryButton}
              onPress={handleDeliveryStart}
            >
              <MaterialIcons name="local-shipping" size={24} color="#fff" />
              <Text style={styles.deliveryButtonText}>開始配送</Text>
            </TouchableOpacity>
            <Text style={styles.deliveryHint}>
              點擊後所有已接單的留言將只顯示「完成」按鈕，訂單狀態變更為「配送中」
            </Text>
          </View>
        )}

        {/* 調試資訊 - 幫助了解當前狀態 */}
        {__DEV__ && (
          <View style={styles.debugSection}>
            <Text style={styles.debugTitle}>調試資訊</Text>
            <Text style={styles.debugText}>總留言者: {commenters.length}</Text>
            <Text style={styles.debugText}>已接單: {commenters.filter(c => c.accepted).length}</Text>
            <Text style={styles.debugText}>配送中: {commenters.filter(c => c.status === 'delivering').length}</Text>
            <Text style={styles.debugText}>已完成: {commenters.filter(c => c.status === 'completed').length}</Text>
            <Text style={styles.debugText}>是否已開始配送: {hasStartedDelivery() ? '是' : '否'}</Text>
            <Text style={styles.debugText}>是否全部完成: {isOrderFullyCompleted ? '是' : '否'}</Text>
          </View>
        )}

        {/* 刪除訂單按鈕 */}
        <View style={styles.deleteSection}>
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={handleDeleteOrder}
          >
            <MaterialIcons name="delete-forever" size={20} color="#fff" />
            <Text style={styles.deleteButtonText}>刪除歷史訂單</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 留言者列表 */}
      <View style={styles.commentersSection}>
        <Text style={styles.sectionTitle}>留言者管理</Text>
        {commenters.length > 0 ? (
          <FlatList
            data={commenters}
            keyExtractor={(item, index) => `commenter_${item.id}_${index}`}
            renderItem={renderCommenterItem}
            scrollEnabled={false}
            style={styles.commentersList}
          />
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>尚無留言者</Text>
          </View>
        )}
      </View>

      {/* 配送開始確認彈窗 */}
      <Modal
        visible={showDeliveryModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>確認開始配送</Text>
            <Text style={styles.modalMessage}>
              確定要開始配送「{orderData.name}」給所有已接單的留言者嗎？\n\n系統將自動發送配送開始通知給所有已接單的留言者，所有參與者的訂單狀態將變更為「配送中」，訂單將從首頁消失。\n\n之後請逐筆為每位留言者點擊「完成」按鈕。
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowDeliveryModal(false);
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmDeliveryStart}
              >
                <Text style={styles.confirmButtonText}>確認</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 到貨通知確認彈窗 */}
      <Modal
        visible={showArrivalModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>確認到貨通知</Text>
            <Text style={styles.modalMessage}>
              確定「{orderData.name}」已到貨，要通知 {selectedCommenter?.name} 嗎？\n\n系統將自動發送到貨通知，該留言者的訂單狀態將變更為「已到貨」。\n\n請等待該留言者完成訂單後，再為下一位留言者點擊「通知到貨」。
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowArrivalModal(false);
                  setSelectedCommenter(null);
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmArrivalNotification}
              >
                <Text style={styles.confirmButtonText}>確認</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 完成訂單確認彈窗 */}
      <Modal
        visible={showCompleteModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>確認完成訂單</Text>
            <Text style={styles.modalMessage}>
              確定要完成「{orderData.name}」給 {selectedCommenter?.name} 嗎？\n\n完成後該訂單將移至歷史紀錄。
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCompleteModal(false);
                  setSelectedCommenter(null);
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmCompleteOrder}
              >
                <Text style={styles.confirmButtonText}>確認完成</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 留言者詳情彈窗 */}
      <Modal
        visible={showCommenterModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedCommenter?.name} 的詳情</Text>
            <View style={styles.commenterDetail}>
              <Text style={styles.detailLabel}>留言內容：</Text>
              <Text style={styles.detailText}>{selectedCommenter?.text}</Text>
              
              <Text style={styles.detailLabel}>當前狀態：</Text>
              <Text style={[styles.detailText, { color: getStatusColor(selectedCommenter?.status, selectedCommenter?.accepted) }]}>
                {getStatusText(selectedCommenter?.status, selectedCommenter?.accepted)}
              </Text>
              
              
              {selectedCommenter?.deliveryStartTime && (
                <>
                  <Text style={styles.detailLabel}>開始配送：</Text>
                  <Text style={styles.detailText}>
                    {new Date(selectedCommenter.deliveryStartTime).toLocaleString()}
                  </Text>
                </>
              )}
              
              {selectedCommenter?.arrivalTime && (
                <>
                  <Text style={styles.detailLabel}>到貨時間：</Text>
                  <Text style={styles.detailText}>
                    {new Date(selectedCommenter.arrivalTime).toLocaleString()}
                  </Text>
                </>
              )}
            </View>
            <TouchableOpacity 
              style={[styles.modalButton, styles.confirmButton]}
              onPress={() => setShowCommenterModal(false)}
            >
              <Text style={styles.confirmButtonText}>關閉</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>



      {/* 刪除確認模態框 */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalHeader}>
              <MaterialIcons name="warning" size={48} color="#FF6B6B" />
            </View>
            <Text style={styles.deleteModalTitle}>確認刪除訂單</Text>
            <Text style={styles.deleteModalMessage}>
              確定要刪除「{orderData.name}」的歷史紀錄嗎？\n\n⚠️ 此操作將永久刪除：
              • 訂單資料
              • 所有留言記錄
              • 相關通知
              \n\n刪除後無法恢復！
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.deleteConfirmButton]}
                onPress={confirmDeleteOrder}
              >
                <Text style={styles.deleteConfirmButtonText}>確認刪除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9'
  },
  backButton: {
    padding: 8,
    marginRight: 12
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e'
  },
  orderInfo: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  orderTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 12
  },
  orderLocation: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8
  },
  orderContact: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8
  },
  orderLine: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  statItem: {
    alignItems: 'center',
    flex: 1
  },
  statText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4
  },
  commentersSection: {
    margin: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 16
  },
  commentersList: {
    marginBottom: 20
  },
  commenterCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  commenterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 50, // 確保有足夠的高度
    flex: 1 // 確保有足夠的空間
  },
  commenterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, // 佔用剩餘空間
    marginRight: 8 // 與狀態標籤保持距離
  },
  commenterName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 4
  },
  commenterDetails: {
    flex: 1,
    marginLeft: 8,
  },
  creditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  creditText: {
    fontSize: 10,
    color: '#F57C00',
    fontWeight: '600',
    marginLeft: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    alignSelf: 'flex-start',
    minWidth: 70, // 確保有足夠寬度顯示狀態文字
    alignItems: 'center',
    flexShrink: 0 // 防止被壓縮
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    flexWrap: 'nowrap' // 防止文字換行
  },
  commentText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20
  },
  commenterActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 8
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007aff'
  },
  deliveryButton: {
    backgroundColor: '#ff9500', // 橘色 - 開始配送
    borderColor: '#ff9500'
  },
  arrivalButton: {
    backgroundColor: '#34c759',
    borderColor: '#34c759'
  },
  completeButton: {
    backgroundColor: '#8e8e93',
    borderColor: '#8e8e93'
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    color: '#007aff'
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 12
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 32,
    width: '80%',
    maxWidth: 400
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 16,
    textAlign: 'center'
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 8
  },
  cancelButton: {
    backgroundColor: '#f1f3f4'
  },
  confirmButton: {
    backgroundColor: '#007aff'
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  commenterDetail: {
    marginBottom: 24
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 4
  },
  detailText: {
    fontSize: 16,
    color: '#1c1c1e',
    marginBottom: 8,
    lineHeight: 22
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 100
  },
  // 全部完成狀態樣式
  completionStatus: {
    backgroundColor: '#E8F5E8',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  completionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 8,
    marginBottom: 16,
  },
  ratingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  // 刪除相關樣式
  deleteSection: {
    marginTop: 16,
    alignItems: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  // 刪除模態框樣式
  deleteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 32,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  deleteModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginBottom: 16,
    textAlign: 'center',
  },
  deleteModalMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  deleteConfirmButton: {
    backgroundColor: '#FF6B6B',
  },
  deleteConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
    minHeight: 80,
    marginBottom: 20,
    textAlignVertical: 'top',
  },
  // 配送按鈕樣式
  deliverySection: {
    marginTop: 16,
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  deliveryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  deliveryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    marginLeft: 12,
  },
  deliveryHint: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  ratingButton: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700'
  },
  ratedButton: {
    backgroundColor: '#E8F5E8',
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  // 調試樣式
  debugSection: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ff9800',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
});
