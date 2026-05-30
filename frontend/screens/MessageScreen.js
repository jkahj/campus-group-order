import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Pressable, Alert, ScrollView, Modal
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../utils/apiService';
import AuthManager from '../utils/authManager.js';

export default function MessageScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { orderId } = route.params || {};
  
  // 使用 state 來存儲回調函數，避免將函數放在 navigation params 中（會導致序列化警告）
  const [commentUpdateCallback, setCommentUpdateCallback] = useState(null);
  
  useEffect(() => {
    // 從 route.params 獲取回調函數的引用（但不存儲在 navigation state 中）
    const callback = route.params?.onCommentUpdate;
    if (callback && typeof callback === 'function') {
      setCommentUpdateCallback(() => callback);
    } else {
      setCommentUpdateCallback(null);
    }
  }, [route.params?.onCommentUpdate]);

  // 檢查必要的參數
  useEffect(() => {
    if (!orderId) {
      console.error('MessageScreen: orderId 缺失');
    }
    if (!navigation) {
      console.error('MessageScreen: navigation 對象缺失');
    }
  }, [orderId, navigation]);

  if (!orderId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 18, color: '#c00', marginBottom: 12 }}>⚠️ 無效的留言清單</Text>
        <Text style={{ fontSize: 16, color: '#555' }}>請從首頁點選任務卡片進入留言頁面</Text>
      </View>
    );
  }

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [phone, setPhone] = useState('');
  const [lineId, setLineId] = useState('');
  const [items, setItems] = useState([{ item_name: '', quantity: '' }]); // 多個商品
  const [showFormModal, setShowFormModal] = useState(false);
  const [replyToId, setReplyToId] = useState(null);
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [showReplyInput, setShowReplyInput] = useState({});
  const [replyInputs, setReplyInputs] = useState({});
  const [showMenu, setShowMenu] = useState({});
  const [editingMessage, setEditingMessage] = useState({});
  const [editTexts, setEditTexts] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null); // 當前用戶 ID
  const [showEditModal, setShowEditModal] = useState(false); // 編輯 Modal
  const [editingCommentId, setEditingCommentId] = useState(null); // 正在編輯的留言 ID
  const [editItems, setEditItems] = useState([{ item_name: '', quantity: '' }]); // 編輯時的商品列表
  const [editPhone, setEditPhone] = useState(''); // 編輯時的電話
  const [editLineId, setEditLineId] = useState(''); // 編輯時的 LINE ID

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const currentUserInfo = await AuthManager.getCurrentUser().catch(() => null);
        const userId = currentUserInfo?.id || null;
        const currentUserName = currentUserInfo?.name || null;
        
        // 保存當前用戶 ID 到 state
        setCurrentUserId(userId);

        // 嘗試從資料庫載入留言
        const dbComments = await apiService.getCommentsByOrder(orderId);
        
        if (Array.isArray(dbComments) && dbComments.length > 0) {
          // 讀取本地忽略清單
          const ignored = JSON.parse(await AsyncStorage.getItem('ignoredComments')) || {};
          const ignoredIds = new Set(ignored[orderId] || []);
          // 轉換資料庫格式為前端格式，並過濾被忽略的留言
          const convertedMessages = dbComments
            .filter(comment => comment.status !== 'ignored' && comment.status !== 'ignore' && !ignoredIds.has(comment.id)) // 排除被忽略與本地忽略
            .map(comment => {
              // 處理商品項目：如果有items陣列就使用，否則使用item_name和quantity（向後兼容）
              let itemsArray = [];
              if (comment.items && Array.isArray(comment.items) && comment.items.length > 0) {
                itemsArray = comment.items.map(item => ({
                  item_name: item.item_name || item.itemName,
                  quantity: item.quantity
                }));
              } else if (comment.item_name) {
                itemsArray = [{
                  item_name: comment.item_name,
                  quantity: comment.quantity
                }];
              }
              
              // 判斷是否為當前用戶的留言
              const isMyComment = userId && (comment.commenter_id === userId);
              
              return {
                id: comment.id,
                user: isMyComment ? 'You' : (comment.commenter_name || '用戶'),
                text: comment.text,
                replies: [], // 需要額外載入回覆
                timestamp: comment.timestamp,
                commenterId: comment.commenter_id,
                actualUserId: comment.commenter_id,
                commenterName: comment.commenter_name,
                commenterPhone: comment.commenter_phone,
                commenterLine: comment.commenter_line,
                itemName: comment.item_name,
                quantity: comment.quantity,
                items: itemsArray,
                isOrderRequest: comment.is_order_request || true,
                deliveryStatus: comment.delivery_status || 'pending',
                accepted: comment.accepted || false,
                isReply: comment.is_reply || false,
                parentId: comment.parent_id,
                showNewBadge: comment.show_new_badge || false,
                newBadgeExpireTime: comment.new_badge_expire_time,
                status: comment.status || 'active',
                isMyComment: isMyComment // 標記是否為當前用戶的留言
              };
            });

          const repliesByComment = {};
          try {
            const backendReplies = await apiService.getCommentRepliesByOrder(orderId);
            if (Array.isArray(backendReplies)) {
              backendReplies.forEach(reply => {
                if (!reply || !reply.comment_id) {
                  return;
                }
                const originalName = typeof reply.user === 'string' && reply.user.trim().length > 0
                  ? reply.user.trim()
                  : '代購者';
                const displayName = currentUserName && originalName === currentUserName ? 'You' : originalName;
                const normalizedReply = {
                  id: reply.id,
                  user: displayName,
                  originalUserName: originalName,
                  text: reply.text,
                  timestamp: reply.timestamp,
                  isReply: true,
                  parentId: reply.comment_id,
                  showNewBadge: reply.show_new_badge,
                  newBadgeExpireTime: reply.new_badge_expire_time
                };
                if (!repliesByComment[reply.comment_id]) {
                  repliesByComment[reply.comment_id] = [];
                }
                repliesByComment[reply.comment_id].push(normalizedReply);
              });
              Object.values(repliesByComment).forEach(list => {
                list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
              });
            }
          } catch (replyError) {
            console.log('載入留言回覆失敗，將略過（不中斷流程）:', replyError?.message || replyError);
          }

          const legacyRepliesByComment = {};
          convertedMessages
            .filter(msg => msg.isReply)
            .forEach(replyMsg => {
              const parentKey = replyMsg.parentId || replyMsg.parent_id;
              if (!parentKey) return;
              const originalName = replyMsg.commenterName || replyMsg.user || '用戶';
              const displayName =
                currentUserName && originalName === currentUserName ? 'You' : originalName;
              const normalizedReply = {
                id: replyMsg.id,
                user: displayName,
                originalUserName: originalName,
                text: replyMsg.text,
                timestamp: replyMsg.timestamp,
                isReply: true,
                parentId: parentKey,
                showNewBadge: replyMsg.showNewBadge ?? replyMsg.show_new_badge ?? true,
                newBadgeExpireTime: replyMsg.newBadgeExpireTime ?? replyMsg.new_badge_expire_time
              };
              if (!legacyRepliesByComment[parentKey]) {
                legacyRepliesByComment[parentKey] = [];
              }
              legacyRepliesByComment[parentKey].push(normalizedReply);
            });
          Object.values(legacyRepliesByComment).forEach(list => {
            list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          });
          
          // 組織回覆關係
          const messagesWithReplies = convertedMessages
            .filter(m => !m.isReply)
            .map(message => {
              const mergedReplies = [];
              const seenReplyIds = new Set();

              const appendReply = (reply) => {
                if (!reply) return;
                const replyId = reply.id || `${reply.parentId || ''}_${reply.timestamp || ''}_${reply.text || ''}`;
                if (seenReplyIds.has(replyId)) return;
                seenReplyIds.add(replyId);
                mergedReplies.push(reply);
              };

              (legacyRepliesByComment[message.id] || []).forEach(appendReply);
              (repliesByComment[message.id] || []).forEach(appendReply);

              mergedReplies.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

              return { ...message, replies: mergedReplies };
            });
          
          console.log('載入留言區留言:', messagesWithReplies.length, '則（已過濾忽略）');
          setMessages(messagesWithReplies);
          
          // 保存到本地（向後兼容）
          const parsed = {};
          parsed[orderId] = messagesWithReplies;
          await AsyncStorage.setItem('comments', JSON.stringify(parsed));
        } else {
          // 從本地載入（向後兼容）
          const saved = await AsyncStorage.getItem('comments');
          const parsed = saved ? JSON.parse(saved) : {};
          // 讀取本地忽略清單
          const ignored = JSON.parse(await AsyncStorage.getItem('ignoredComments')) || {};
          const ignoredIds = new Set(ignored[orderId] || []);
          const orderMsgs = (parsed[orderId] || []).filter(msg => msg.status !== 'ignored' && msg.status !== 'ignore' && !ignoredIds.has(msg.id)); // 過濾忽略留言
          console.log('從本地載入留言:', orderMsgs.length, '則（已過濾忽略）');
          setMessages(orderMsgs);
        }
      } catch (error) {
        console.log('從資料庫載入留言失敗，使用本地數據:', error);
        
        // 從本地載入（錯誤回退）
        const saved = await AsyncStorage.getItem('comments');
        const parsed = saved ? JSON.parse(saved) : {};
        // 讀取本地忽略清單
        const ignored = JSON.parse(await AsyncStorage.getItem('ignoredComments')) || {};
        const ignoredIds = new Set(ignored[orderId] || []);
        const orderMsgs = (parsed[orderId] || []).filter(msg => msg.status !== 'ignored' && msg.status !== 'ignore' && !ignoredIds.has(msg.id)); // 過濾忽略留言
        console.log('從本地載入留言（錯誤回退）:', orderMsgs.length, '則（已過濾忽略）');
        setMessages(orderMsgs);
      }
    };
    loadMessages();
  }, [orderId]);

  // 定期檢查並更新"新留言"標籤狀態
  useEffect(() => {
    const checkNewBadges = () => {
      const now = Date.now();
      let hasChanges = false;
      
      const updatedMessages = messages.map(msg => {
        if (msg.showNewBadge && msg.newBadgeExpireTime && now > msg.newBadgeExpireTime) {
          hasChanges = true;
          return { ...msg, showNewBadge: false };
        }
        return msg;
      });
      
      if (hasChanges) {
        setMessages(updatedMessages);
        saveMessages(updatedMessages);
      }
    };

    // 每30秒檢查一次
    const interval = setInterval(checkNewBadges, 30000);
    
    return () => clearInterval(interval);
  }, [messages]);

  const saveMessages = async (updatedMessages) => {
    console.log('保存留言，訂單ID:', orderId, '留言數量:', updatedMessages.length);
    
    const saved = await AsyncStorage.getItem('comments');
    const parsed = saved ? JSON.parse(saved) : {};
    parsed[orderId] = updatedMessages;
    await AsyncStorage.setItem('comments', JSON.stringify(parsed));
    
    if (commentUpdateCallback) {
      const total = updatedMessages.length + updatedMessages.reduce((acc, msg) => acc + msg.replies.length, 0);
      console.log('調用 onCommentUpdate:', orderId, '總留言數:', total);
      commentUpdateCallback(orderId, total);
    } else {
      console.log('onCommentUpdate 回調不存在');
    }
  };

  const handleSend = async () => {
    // 驗證：至少需要一個有效的商品
    const validItems = items.filter(item => item.item_name && item.item_name.trim());
    if (validItems.length === 0) {
      Alert.alert('提示', '請至少輸入一個商品名稱');
      return;
    }
    
    // 驗證每個商品的數量（必填）
    const processedItems = [];
    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      // 驗證數量必填
      if (!item.quantity || !item.quantity.toString().trim()) {
        Alert.alert('提示', `第${i + 1}個商品的數量為必填項目`);
        return;
      }
      const qtyNum = parseInt(item.quantity.toString().trim(), 10);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        Alert.alert('提示', `第${i + 1}個商品的數量必須是正整數`);
        return;
      }
      processedItems.push({
        item_name: item.item_name.trim(),
        quantity: qtyNum
      });
    }
    
    // 驗證電話號碼（必填）
    const phoneValue = phone.trim();
    if (!phoneValue) {
      Alert.alert('提示', '請輸入電話號碼');
      return;
    }
    if (!/^[\d\-\s()]+$/.test(phoneValue)) {
      Alert.alert('提示', '請輸入正確的電話號碼格式');
      return;
    }
    
    // LINE ID 選填
    const lineIdValue = lineId.trim() || null;

    try {
      // 獲取當前用戶
      const currentUser = await AuthManager.getCurrentUser();
      const userId = currentUser?.id || 'me';
      const userName = currentUser?.name || '我';
      
      // 生成唯一的留言者ID和留言ID
      const uniqueCommenterId = userId === 'me' ? `me_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` : userId;
      const commentId = `comment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const timestamp = Date.now();
      
      // 組合顯示文字：所有商品
      const displayText = processedItems.map(item => 
        item.quantity ? `${item.item_name} x${item.quantity}` : item.item_name
      ).join('、');
      
      const newMsg = {
        id: commentId,
        user: 'You',
        text: displayText,
        itemName: processedItems[0]?.item_name || '', // 保留第一個商品名稱用於向後兼容
        quantity: processedItems[0]?.quantity || null, // 保留第一個商品數量用於向後兼容
        items: processedItems, // 多個商品
        commenterPhone: phoneValue,
        commenterLine: lineIdValue,
        replies: [],
        timestamp: timestamp,
        commenterId: uniqueCommenterId,
        actualUserId: userId,
        commenterName: userName,
        isOrderRequest: true,
        deliveryStatus: 'pending',
        accepted: false,
        isReply: false,
        showNewBadge: true,
        newBadgeExpireTime: timestamp + 2 * 60 * 1000
      };

      let updated = [];
      let isReply = false;
      let commentData;
      
      if (replyToId) {
        // 回覆模式
        commentData = {
          id: commentId,
          order_id: orderId,
          commenter_id: uniqueCommenterId,
          commenter_name: userName,
          text: input,
          item_name: null,
          quantity: null,
          is_order_request: false,
          is_reply: true,
          parent_id: replyToId,
          delivery_status: 'pending',
          accepted: false,
          completed: false,
          status: 'active',
          show_new_badge: true,
          new_badge_expire_time: timestamp + 2 * 60 * 1000,
          timestamp: timestamp
        };
        
        const replyMsg = {
          ...newMsg,
          isOrderRequest: false,
          isReply: true,
          parentId: replyToId
        };
        
        updated = messages.map(msg => {
          if (msg.id === replyToId) {
            return { ...msg, replies: [...msg.replies, replyMsg] };
          }
          return msg;
        });
        isReply = true;
      } else {
        // 主要留言
        // 確保 items 欄位格式正確，符合後端 CommentItemCreate 模型
        const formattedItems = processedItems.map(item => ({
          item_name: item.item_name,
          quantity: item.quantity || null
        }));
        
        commentData = {
          id: commentId,
          order_id: orderId,
          commenter_id: uniqueCommenterId,
          commenter_name: userName,
          commenter_phone: phoneValue || null,
          commenter_line: lineIdValue || null,
          text: displayText,
          item_name: processedItems[0]?.item_name || null, // 保留向後兼容
          quantity: processedItems[0]?.quantity || null, // 保留向後兼容
          items: formattedItems.length > 0 ? formattedItems : null, // 多個商品，格式符合後端要求
          is_order_request: true,
          is_reply: false,
          parent_id: null,
          delivery_status: 'pending',
          accepted: false,
          completed: false,
          status: 'active',
          show_new_badge: true,
          new_badge_expire_time: timestamp + 2 * 60 * 1000,
          timestamp: timestamp
        };
        
        updated = [newMsg, ...messages];
      }

      // 清空輸入欄位並關閉 Modal
      setItemName('');
      setQuantity('');
      setItems([{ item_name: '', quantity: '' }]);
      setPhone('');
      setLineId('');
      setShowFormModal(false);
      
      // 嘗試保存到資料庫
      try {
        // 確保 commenter_id 不是 'me' 或臨時 ID，如果是則嘗試獲取真實用戶 ID
        let finalCommenterId = uniqueCommenterId;
        if (uniqueCommenterId === 'me' || uniqueCommenterId.startsWith('me_')) {
          const currentUser = await AuthManager.getCurrentUser();
          if (currentUser?.id && currentUser.id !== 'me') {
            finalCommenterId = currentUser.id;
            commentData.commenter_id = finalCommenterId;
            newMsg.commenterId = finalCommenterId;
            newMsg.actualUserId = finalCommenterId;
          }
        }
        
        const savedComment = await apiService.createComment(commentData);
        console.log('✅ 留言已保存到資料庫:', savedComment?.id);
        // 如果保存成功，使用資料庫返回的數據更新本地狀態
        if (savedComment && savedComment.id) {
          // 更新消息ID為資料庫返回的ID（如果有變化）
          newMsg.id = savedComment.id;
          if (!isReply) {
            updated = updated.map(msg => msg.id === commentId ? { ...msg, id: savedComment.id } : msg);
          }
        }
      } catch (apiError) {
        console.error('❌ 保存到資料庫失敗:', apiError?.message || apiError);
        const errorMessage = apiError?.response?.detail || apiError?.message || '未知錯誤';
        console.error('錯誤詳情:', errorMessage);
        // 不顯示警告，因為留言已經保存到本地，用戶體驗不受影響
        // Alert.alert('警告', `留言已保存到本地，但未能同步到資料庫：${errorMessage}`);
      }

      // 更新本地狀態
      setMessages(updated);
      saveMessages(updated);
    
    // 發送通知給訂單發起者（如果不是回覆且是新留言）
    if (!isReply) {
      try {
        // 獲取訂單資料，檢查是否為發起者的訂單
        const orders = JSON.parse(await AsyncStorage.getItem('orders')) || [];
        const currentOrder = orders.find(order => order.id === orderId);
        
        if (currentOrder) {
          // 檢查是否為自己發起的訂單
          const isMyOrder = currentOrder.createdBy === 'me';
          
          // 只在非自己發起的訂單下留言時，添加參與記錄
          if (!isMyOrder) {
            // 檢查是否已經有參與記錄
            const hasJoinRecord = currentOrder.joinedBy === 'me' || 
              (currentOrder.joiners && currentOrder.joiners.some(joiner => joiner.userId === 'me'));
            
            // 如果還沒有參與記錄，添加參與記錄
            if (!hasJoinRecord) {
              const updatedOrders = orders.map(order => {
                if (order.id === orderId) {
                  const newJoiner = {
                    id: newMsg.commenterId,
                    name: '我',
                    joinTime: Date.now(),
                    status: 'pending',
                    userId: 'me',
                    commentId: newMsg.id
                  };
                  
                  return {
                    ...order,
                    joiners: [...(order.joiners || []), newJoiner],
                    joined: (order.joined || 0) + 1,
                    joinedBy: 'me'
                  };
                }
                return order;
              });
              
              await AsyncStorage.setItem('orders', JSON.stringify(updatedOrders));
              console.log('已添加參與記錄');
            }
          }
          
          // 如果訂單是我發起的，發送通知給訂單發起者
          if (isMyOrder) {
            const { sendNotificationToOrderCreator } = require('../utils/notificationHelper');
            await sendNotificationToOrderCreator(
              orderId,
              'comment',
              '你的代購有新留言',
              `${currentOrder.name} 有新的留言：${input.length > 30 ? input.substring(0, 30) + '...' : input}`,
              {
                order_name: currentOrder.name,
                commenter_id: currentUserInfo?.id || null,
                comment_id: commentId || null,
              }
            );
            console.log('已發送留言通知');
          }
        }
      } catch (error) {
        console.error('發送留言通知或添加參與記錄失敗:', error);
      }
    }
    
    setInput('');
    setReplyToId(null);
    setReplyingToMessage(null);
    } catch (error) {
      console.error('發送留言失敗:', error);
      Alert.alert('錯誤', '發送留言失敗，請重試');
    }
  };

  // 處理內聯回覆
  const handleInlineReply = async (messageId, replyText) => {
    if (!replyText.trim()) return;

    const timestamp = Date.now();
    let currentUserInfo = null;
    try {
      currentUserInfo = await AuthManager.getCurrentUser();
    } catch (resolveError) {
      console.log('取得當前用戶資訊失敗（略過不中斷流程）:', resolveError?.message || resolveError);
    }

    const replyId = `reply_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;
    const replyAuthorName = currentUserInfo?.name || '代購者';

    const replyPayload = {
      id: replyId,
      comment_id: messageId,
      user: replyAuthorName,
      text: replyText,
      timestamp,
      show_new_badge: true,
      new_badge_expire_time: timestamp + 2 * 60 * 1000
    };

    const newReply = {
      id: replyId,
      user: 'You',
      originalUserName: replyAuthorName,
      text: replyText,
      timestamp,
      isReply: true,
      parentId: messageId,
      showNewBadge: true,
      newBadgeExpireTime: timestamp + 2 * 60 * 1000
    };

    const updated = messages.map(msg => {
      if (msg.id === messageId) {
        return { ...msg, replies: [...(msg.replies || []), newReply] };
      }
      return msg;
    });

    setMessages(updated);
    saveMessages(updated);

    try {
      await apiService.createCommentReply(replyPayload);
      console.log('留言回覆已同步至後端 comment_replies');
    } catch (replyError) {
      console.log('留言回覆同步後端失敗（保留本地資料，可稍後重試）:', replyError?.message || replyError);
    }
    
    // 發送回覆通知給訂單發起者
    try {
      const orders = JSON.parse(await AsyncStorage.getItem('orders')) || [];
      const currentOrder = orders.find(order => order.id === orderId);
      
      // 如果訂單存在且是我發起的訂單，發送通知給訂單發起者
      // 注意：在實際多用戶環境中，應該檢查回覆者是否為訂單發起者
      if (currentOrder && currentOrder.createdBy === 'me') {
        const { sendNotificationToOrderCreator } = require('../utils/notificationHelper');
        await sendNotificationToOrderCreator(
          orderId,
          'reply',
          '你的代購有新回覆',
          `${currentOrder.name} 有新的回覆：${replyText.length > 30 ? replyText.substring(0, 30) + '...' : replyText}`,
          {
            order_name: currentOrder.name,
            commenter_id: replyAuthorName || null,
            comment_id: replyId || null,
          }
        );
        console.log('已發送回覆通知');
      }
    } catch (error) {
      console.error('發送回覆通知失敗:', error);
    }
    
    // 清除該留言的回覆輸入框
    setShowReplyInput(prev => ({ ...prev, [messageId]: false }));
    setReplyInputs(prev => ({ ...prev, [messageId]: '' }));
  };

  // 切換回覆輸入框顯示
  const toggleReplyInput = (messageId) => {
    setShowReplyInput(prev => ({ ...prev, [messageId]: !prev[messageId] }));
  };

  // 切換選單顯示
  const toggleMenu = (messageId) => {
    setShowMenu(prev => ({ ...prev, [messageId]: !prev[messageId] }));
  };

  // 開始編輯留言
  const startEditMessage = (messageId) => {
    const message = messages.find(msg => msg.id === messageId);
    if (!message) return;
    
    // 設置編輯的留言 ID
    setEditingCommentId(messageId);
    
    // 預填商品資料
    if (message.items && message.items.length > 0) {
      setEditItems(message.items.map(item => ({
        item_name: item.item_name || item.itemName || '',
        quantity: item.quantity ? item.quantity.toString() : ''
      })));
    } else if (message.itemName || message.item_name) {
      setEditItems([{
        item_name: message.itemName || message.item_name || '',
        quantity: message.quantity ? message.quantity.toString() : ''
      }]);
    } else {
      setEditItems([{ item_name: '', quantity: '' }]);
    }
    
    // 預填聯絡資訊
    setEditPhone(message.commenterPhone || message.commenter_phone || '');
    setEditLineId(message.commenterLine || message.commenter_line || '');
    
    // 關閉選單，打開編輯 Modal
    setShowMenu(prev => ({ ...prev, [messageId]: false }));
    setShowEditModal(true);
  };

  // 取消編輯
  const cancelEdit = () => {
    setShowEditModal(false);
    setEditingCommentId(null);
    setEditItems([{ item_name: '', quantity: '' }]);
    setEditPhone('');
    setEditLineId('');
  };

  // 保存編輯
  const saveEditMessage = async () => {
    if (!editingCommentId) return;
    
    // 驗證：至少需要一個有效的商品
    const validItems = editItems.filter(item => item.item_name && item.item_name.trim());
    if (validItems.length === 0) {
      Alert.alert('提示', '請至少輸入一個商品名稱');
      return;
    }
    
    // 驗證每個商品的數量（必填）
    const processedItems = [];
    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      if (!item.quantity || !item.quantity.toString().trim()) {
        Alert.alert('提示', `第${i + 1}個商品的數量為必填項目`);
        return;
      }
      const qtyNum = parseInt(item.quantity.toString().trim(), 10);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        Alert.alert('提示', `第${i + 1}個商品的數量必須是正整數`);
        return;
      }
      processedItems.push({
        item_name: item.item_name.trim(),
        quantity: qtyNum
      });
    }
    
    // 驗證電話號碼（必填）
    const phoneValue = editPhone.trim();
    if (!phoneValue) {
      Alert.alert('提示', '請輸入電話號碼');
      return;
    }
    if (!/^[\d\-\s()]+$/.test(phoneValue)) {
      Alert.alert('提示', '請輸入正確的電話號碼格式');
      return;
    }
    
    // LINE ID 選填
    const lineIdValue = editLineId.trim() || null;
    
    // 組合顯示文字：所有商品
    const displayText = processedItems.map(item => 
      item.quantity ? `${item.item_name} x${item.quantity}` : item.item_name
    ).join('、');

    try {
      // 同步更新到後端
      if (currentUserId) {
        await apiService.updateComment(editingCommentId, {
          text: displayText,
          commenter_phone: phoneValue,
          commenter_line: lineIdValue,
          items: processedItems
        }, { user_id: currentUserId });
        console.log('✅ 留言已更新到資料庫:', editingCommentId);
      }
    } catch (error) {
      console.error('❌ 更新留言到後端失敗:', error);
      Alert.alert('警告', '留言已更新到本地，但未能同步到資料庫');
    }

    // 更新本地狀態
    const updated = messages.map(msg => {
      if (msg.id === editingCommentId) {
        return {
          ...msg,
          text: displayText,
          items: processedItems,
          itemName: processedItems[0]?.item_name || '',
          quantity: processedItems[0]?.quantity || null,
          commenterPhone: phoneValue,
          commenterLine: lineIdValue,
          commenter_phone: phoneValue,
          commenter_line: lineIdValue
        };
      }
      return msg;
    });
    
    setMessages(updated);
    saveMessages(updated);
    
    // 關閉編輯 Modal
    cancelEdit();
    
    Alert.alert('成功', '留言已更新');
  };

  // 刪除留言功能
  const deleteMessage = async (messageId) => {
    Alert.alert(
      '刪除留言',
      '確定要刪除這則留言嗎？此操作無法復原。',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            try {
              // 同步刪除到後端
              if (currentUserId) {
                await apiService.deleteComment(messageId, { user_id: currentUserId });
                console.log('✅ 留言已從資料庫刪除:', messageId);
              }
            } catch (error) {
              console.error('❌ 刪除留言到後端失敗:', error);
              // 即使後端刪除失敗，也更新本地狀態
              Alert.alert('警告', '留言已從本地刪除，但未能同步到資料庫');
            }

            const updated = messages.filter(msg => msg.id !== messageId);
            setMessages(updated);
            saveMessages(updated);
          },
        },
      ]
    );
  };

  // 刪除回覆功能
  const deleteReply = (parentMessageId, replyId) => {
    Alert.alert(
      '刪除回覆',
      '確定要刪除這則回覆嗎？此操作無法復原。',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '刪除',
          style: 'destructive',
          onPress: () => {
            const updated = messages.map(msg => {
              if (msg.id === parentMessageId) {
                return {
                  ...msg,
                  replies: msg.replies.filter(reply => reply.id !== replyId)
                };
              }
              return msg;
            });
            setMessages(updated);
            saveMessages(updated);
          },
        },
      ]
    );
  };


  const renderReplies = (replies, parentMessageId) => {
    // 確保 replies 是陣列
    if (!replies || !Array.isArray(replies)) {
      return null;
    }
    
    return (
      <View style={styles.replyContainer}>
        {replies.map((reply, index) => (
          <View key={reply.id || `reply-${index}`} style={styles.replyBox}>
            <View style={styles.replyHeader}>
              <View style={styles.replyHeaderLeft}>
                <Text style={styles.replyUser}>
                  <FontAwesome name="user-circle-o" size={14} /> {reply.user || reply.originalUserName || '代購者'}
                </Text>
                {reply.showNewBadge !== false && (
                  <View style={styles.replyNewBadge}>
                    <FontAwesome name="comment" size={10} color="#FF6B35" />
                    <Text style={styles.replyNewBadgeText}>新</Text>
                  </View>
                )}
              </View>
              {reply.user === 'You' && (
                <TouchableOpacity 
                  style={styles.deleteReplyButton}
                  onPress={() => deleteReply(parentMessageId, reply.id)}
                >
                  <Ionicons name="trash-outline" size={14} color="#F44336" />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.replyText}>{reply.text}</Text>
          </View>
        ))}
      </View>
    );
  };

  // 留空：留言頁不再提供「查看詳情」導覽，保留回覆/編輯/刪除等功能
  const handleCommentPress = () => {};

  const renderItem = ({ item }) => (
    <Pressable 
      style={[
        styles.messageBox, 
        item.isOrderRequest && styles.orderRequestBox,
        item.status === 'ignored' && styles.ignoredMessageBox
      ]}
      onPress={() => {
        // 僅收起選單；留言頁不再導向詳情
        setShowMenu({});
      }}
    >
      <View style={styles.messageHeader}>
        <Text style={styles.user}><FontAwesome name="user-circle-o" size={16} /> {item.user}</Text>
        <View style={styles.headerRight}>
          <View style={styles.badgesContainer}>
            {item.isOrderRequest && item.showNewBadge !== false && (
              <View style={styles.orderRequestBadge}>
                <FontAwesome name="comment" size={12} color="#FF6B35" />
                <Text style={styles.orderRequestText}>新留言</Text>
              </View>
            )}
            {item.status === 'ignored' && (
              <View style={styles.ignoredBadge}>
                <FontAwesome name="times-circle" size={12} color="#F44336" />
                <Text style={styles.ignoredText}>已忽略</Text>
              </View>
            )}
            {item.deliveryStatus === 'delivering' && (
              <View style={styles.deliveringBadge}>
                <FontAwesome name="truck" size={12} color="#2196F3" />
                <Text style={styles.deliveringText}>配送中</Text>
              </View>
            )}
          </View>
          {(item.isMyComment || item.user === 'You' || (currentUserId && item.commenterId === currentUserId)) && (
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={(e) => {
                e.stopPropagation();
                toggleMenu(item.id);
              }}
            >
              <Ionicons name="ellipsis-vertical" size={16} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 選單下拉框 */}
      {showMenu[item.id] && (
        <View style={styles.menuDropdown}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => startEditMessage(item.id, item.text)}
          >
            <Ionicons name="create-outline" size={16} color="#007BFF" />
            <Text style={styles.menuItemText}>編輯</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
              setShowMenu(prev => ({ ...prev, [item.id]: false }));
              deleteMessage(item.id);
            }}
          >
            <Ionicons name="trash-outline" size={16} color="#F44336" />
            <Text style={[styles.menuItemText, styles.deleteMenuItemText]}>刪除</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 留言內容顯示 */}
      <View>
        {item.items && item.items.length > 0 ? (
          <View style={styles.itemsList}>
            {item.items.map((commentItem, idx) => (
              <View key={idx} style={styles.itemDisplay}>
                <Text style={styles.content}>
                  <Text style={styles.itemName}>{commentItem.item_name || commentItem.itemName}</Text>
                  {commentItem.quantity && <Text style={styles.quantity}> x{commentItem.quantity}</Text>}
                </Text>
                {idx < item.items.length - 1 && <Text style={styles.itemSeparator}>、</Text>}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.content}>
            {item.itemName || item.item_name ? (
              <>
                <Text style={styles.itemName}>{item.itemName || item.item_name}</Text>
                {item.quantity && <Text style={styles.quantity}> x{item.quantity}</Text>}
              </>
            ) : (
              item.text
            )}
          </Text>
        )}
      </View>
      
      {item.status === 'ignored' && item.ignoredReason && (
        <View style={styles.ignoreReasonBox}>
          <Text style={styles.ignoreReasonLabel}>忽略原因：</Text>
          <Text style={styles.ignoreReasonText}>{item.ignoredReason}</Text>
        </View>
      )}
      
      <View style={styles.actionButtons}>
        {item.status !== 'ignored' && (
          <TouchableOpacity 
            style={styles.replyButton}
            onPress={(e) => {
              e.stopPropagation(); // 阻止觸發父組件的點擊事件
              toggleReplyInput(item.id);
            }}
          >
            <Text style={styles.reply}>Reply</Text>
          </TouchableOpacity>
        )}
        {/* 已移除「查看詳情」按鈕，避免與訂單管理頁面重複 */}
      </View>

      {/* 內聯回覆輸入區塊 */}
      {showReplyInput[item.id] && (
        <View style={styles.inlineReplySection}>
          <View style={styles.inlineReplyInputRow}>
            <TextInput
              placeholder={`回覆 ${item.user}...`}
              value={replyInputs[item.id] || ''}
              onChangeText={(text) => setReplyInputs(prev => ({ ...prev, [item.id]: text }))}
              style={styles.inlineReplyInput}
              multiline
              numberOfLines={2}
            />
            <View style={styles.inlineReplyButtons}>
              <TouchableOpacity 
                style={styles.inlineReplyCancelButton}
                onPress={() => {
                  setShowReplyInput(prev => ({ ...prev, [item.id]: false }));
                  setReplyInputs(prev => ({ ...prev, [item.id]: '' }));
                }}
              >
                <Text style={styles.inlineReplyCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.inlineReplySendButton}
                onPress={() => handleInlineReply(item.id, replyInputs[item.id])}
              >
                <Ionicons name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {item.replies && item.replies.length > 0 && renderReplies(item.replies, item.id)}
    </Pressable>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>留言區</Text>
      
      <FlatList
        data={messages || []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
      
      {/* 右下角浮動按鈕 */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => setShowFormModal(true)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* 編輯留言 Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={cancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>編輯代購需求</Text>
              <TouchableOpacity onPress={cancelEdit}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScrollView}>
              <Text style={styles.sectionTitle}>商品清單 <Text style={styles.required}>*</Text></Text>
              {editItems.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <View style={styles.itemRowHeader}>
                    <Text style={styles.itemNumber}>商品 {index + 1}</Text>
                    {editItems.length > 1 && (
                      <TouchableOpacity
                        onPress={() => {
                          const newItems = editItems.filter((_, i) => i !== index);
                          setEditItems(newItems);
                        }}
                        style={styles.removeItemButton}
                      >
                        <Ionicons name="close-circle" size={20} color="#F44336" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>商品名稱 <Text style={styles.required}>*</Text></Text>
                    <TextInput
                      placeholder="請輸入想要代購的商品名稱"
                      value={item.item_name}
                      onChangeText={(text) => {
                        const newItems = [...editItems];
                        newItems[index].item_name = text;
                        setEditItems(newItems);
                      }}
                      style={styles.formInput}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>數量 <Text style={styles.required}>*</Text></Text>
                    <TextInput
                      placeholder="請輸入數量（必填）"
                      value={item.quantity ? item.quantity.toString() : ''}
                      onChangeText={(text) => {
                        const newItems = [...editItems];
                        newItems[index].quantity = text;
                        setEditItems(newItems);
                      }}
                      keyboardType="numeric"
                      style={styles.formInput}
                    />
                  </View>
                </View>
              ))}
              
              <TouchableOpacity
                style={styles.addItemButton}
                onPress={() => {
                  setEditItems([...editItems, { item_name: '', quantity: '' }]);
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color="#007BFF" />
                <Text style={styles.addItemText}>添加商品</Text>
              </TouchableOpacity>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>電話號碼 <Text style={styles.required}>*</Text></Text>
                <TextInput
                  placeholder="請輸入您的電話號碼（必填）"
                  value={editPhone}
                  onChangeText={setEditPhone}
                  keyboardType="phone-pad"
                  style={styles.formInput}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>LINE ID</Text>
                <TextInput
                  placeholder="請輸入您的 LINE ID（選填）"
                  value={editLineId}
                  onChangeText={setEditLineId}
                  style={styles.formInput}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton, styles.modalButton]}
                onPress={cancelEdit}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  styles.modalButton,
                  (() => {
                    const validItems = editItems.filter(item => item.item_name && item.item_name.trim());
                    const allItemsHaveQuantity = validItems.length > 0 && validItems.every(item => item.quantity && item.quantity.toString().trim());
                    const hasPhone = editPhone.trim().length > 0;
                    const isValid = validItems.length > 0 && allItemsHaveQuantity && hasPhone;
                    return !isValid ? styles.submitButtonDisabled : null;
                  })()
                ]}
                onPress={saveEditMessage}
                disabled={(() => {
                  const validItems = editItems.filter(item => item.item_name && item.item_name.trim());
                  const allItemsHaveQuantity = validItems.length > 0 && validItems.every(item => item.quantity && item.quantity.toString().trim());
                  const hasPhone = editPhone.trim().length > 0;
                  return !(validItems.length > 0 && allItemsHaveQuantity && hasPhone);
                })()}
              >
                <Text style={styles.submitButtonText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 填寫代購需求 Modal */}
      <Modal
        visible={showFormModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowFormModal(false);
          setItemName('');
          setQuantity('');
          setItems([{ item_name: '', quantity: '' }]);
          setPhone('');
          setLineId('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>填寫代購需求</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowFormModal(false);
                  setItemName('');
                  setQuantity('');
                  setItems([{ item_name: '', quantity: '' }]);
                  setPhone('');
                  setLineId('');
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScrollView}>
              <Text style={styles.sectionTitle}>商品清單 <Text style={styles.required}>*</Text></Text>
              {items.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <View style={styles.itemRowHeader}>
                    <Text style={styles.itemNumber}>商品 {index + 1}</Text>
                    {items.length > 1 && (
                      <TouchableOpacity
                        onPress={() => {
                          const newItems = items.filter((_, i) => i !== index);
                          setItems(newItems);
                        }}
                        style={styles.removeItemButton}
                      >
                        <Ionicons name="close-circle" size={20} color="#F44336" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>商品名稱 <Text style={styles.required}>*</Text></Text>
                    <TextInput
                      placeholder="請輸入想要代購的商品名稱"
                      value={item.item_name}
                      onChangeText={(text) => {
                        const newItems = [...items];
                        newItems[index].item_name = text;
                        setItems(newItems);
                      }}
                      style={styles.formInput}
                      autoFocus={index === 0}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>數量 <Text style={styles.required}>*</Text></Text>
                    <TextInput
                      placeholder="請輸入數量（必填）"
                      value={item.quantity ? item.quantity.toString() : ''}
                      onChangeText={(text) => {
                        const newItems = [...items];
                        newItems[index].quantity = text;
                        setItems(newItems);
                      }}
                      keyboardType="numeric"
                      style={styles.formInput}
                    />
                  </View>
                </View>
              ))}
              
              <TouchableOpacity
                style={styles.addItemButton}
                onPress={() => {
                  setItems([...items, { item_name: '', quantity: '' }]);
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color="#007BFF" />
                <Text style={styles.addItemText}>添加商品</Text>
              </TouchableOpacity>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>電話號碼 <Text style={styles.required}>*</Text></Text>
                <TextInput
                  placeholder="請輸入您的電話號碼（必填）"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  style={styles.formInput}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>LINE ID</Text>
                <TextInput
                  placeholder="請輸入您的 LINE ID（選填）"
                  value={lineId}
                  onChangeText={setLineId}
                  style={styles.formInput}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton, styles.modalButton]}
                onPress={() => {
                  setShowFormModal(false);
                  setItemName('');
                  setQuantity('');
                  setItems([{ item_name: '', quantity: '' }]);
                  setPhone('');
                  setLineId('');
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  styles.modalButton,
                  (() => {
                    const validItems = items.filter(item => item.item_name && item.item_name.trim());
                    const allItemsHaveQuantity = validItems.length > 0 && validItems.every(item => item.quantity && item.quantity.toString().trim());
                    const hasPhone = phone.trim().length > 0;
                    const isValid = validItems.length > 0 && allItemsHaveQuantity && hasPhone;
                    return !isValid ? styles.submitButtonDisabled : null;
                  })()
                ]}
                onPress={handleSend}
                disabled={(() => {
                  const validItems = items.filter(item => item.item_name && item.item_name.trim());
                  const allItemsHaveQuantity = validItems.length > 0 && validItems.every(item => item.quantity && item.quantity.toString().trim());
                  const hasPhone = phone.trim().length > 0;
                  return !(validItems.length > 0 && allItemsHaveQuantity && hasPhone);
                })()}
              >
                <Text style={styles.submitButtonText}>送出</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9', padding: 16 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  messageBox: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ccc'
  },
  user: { fontWeight: 'bold', marginBottom: 6, color: '#555' },
  content: { fontSize: 14, marginBottom: 4 },
  reply: { color: '#007BFF', fontSize: 12 },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  replyButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  // 右下角浮動按鈕
  fabButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007BFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Modal 樣式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    marginTop: 40,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  formScrollView: {
    maxHeight: 500,
    paddingHorizontal: 20,
  },
  formGroup: {
    marginTop: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#F44336',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#007BFF',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  itemName: {
    fontWeight: 'bold',
    color: '#333'
  },
  quantity: {
    color: '#007BFF',
    fontWeight: '600'
  },
  replyContainer: {
    marginTop: 8,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#ddd'
  },
  replyBox: {
    backgroundColor: '#f3f3f3',
    borderRadius: 8,
    padding: 6,
    marginBottom: 4
  },
  replyUser: {
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 2
  },
  replyText: {
    fontSize: 13,
    color: '#444'
  },
  orderRequestBox: {
    borderLeftColor: '#FF6B35',
    borderLeftWidth: 4,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    position: 'relative',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  menuButton: {
    padding: 4,
    borderRadius: 4,
  },
  menuDropdown: {
    position: 'absolute',
    top: 30,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
    minWidth: 120,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuItemText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  deleteMenuItemText: {
    color: '#F44336',
  },
  editContainer: {
    marginBottom: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#007BFF',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F8F9FF',
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  editCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
  },
  editCancelText: {
    fontSize: 14,
    color: '#666',
  },
  editSaveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#007BFF',
  },
  editSaveText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  orderRequestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderRequestText: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600',
    marginLeft: 4,
  },
  orderRequestActions: {
    marginTop: 8,
    marginBottom: 8,
  },
  acceptOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  acceptOrderText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 6,
  },
  // 忽略狀態樣式
  ignoredMessageBox: {
    opacity: 0.6,
    borderLeftColor: '#F44336',
  },
  ignoredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ignoredText: {
    fontSize: 12,
    color: '#F44336',
    fontWeight: '600',
    marginLeft: 4,
  },
  ignoreReasonBox: {
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  ignoreReasonLabel: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '600',
    marginBottom: 4,
  },
  ignoreReasonText: {
    fontSize: 12,
    color: '#E65100',
    lineHeight: 16,
  },
  // 配送狀態樣式
  deliveringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deliveringText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
    marginLeft: 4,
  },
  // 內聯回覆區塊樣式
  inlineReplySection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  inlineReplyInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  inlineReplyInput: {
    flex: 1,
    borderColor: '#007BFF',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8F9FF',
    fontSize: 14,
    minHeight: 36,
    maxHeight: 72,
  },
  inlineReplyButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineReplyCancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
  },
  inlineReplyCancelText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  inlineReplySendButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#007BFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  replyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  replyNewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  replyNewBadgeText: {
    fontSize: 10,
    color: '#FF6B35',
    fontWeight: '600',
    marginLeft: 2,
  },
  deleteReplyButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#FFEBEE',
  },
  // 多商品相關樣式
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  itemRow: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  itemRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007BFF',
  },
  removeItemButton: {
    padding: 4,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#90CAF9',
    borderStyle: 'dashed',
  },
  addItemText: {
    fontSize: 14,
    color: '#007BFF',
    fontWeight: '500',
    marginLeft: 8,
  },
  itemsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  itemDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemSeparator: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 4,
  },
});
