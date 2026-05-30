import React, { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Ionicons, MaterialIcons, Entypo } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Pressable, Alert, Modal, Switch
} from 'react-native';
import { FontAwesome, Feather } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import CreateOrderScreen from './CreateOrderScreen';
import * as Notifications from 'expo-notifications';
import NotificationScreen from './NotificationScreen';
import { initializeUserTiers } from '../utils/userTierManager';
import databaseService from '../utils/databaseService';
import { migrateDataToDatabase } from '../快速遷移資料';
import apiService from '../utils/apiService';
import AuthManager from '../utils/authManager.js';



const Dummy = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ fontSize: 20 }}>此頁尚未建置</Text>
  </View>
);

export function HomeContent() {
  const navigation = useNavigation();
  const [orders, setOrders] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const [viewMode, setViewMode] = useState('all');
  const [menuVisibleId, setMenuVisibleId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [sortKey, setSortKey] = useState('hot'); // hot | time | comments | joined | likes
  const [sortDirections, setSortDirections] = useState({ time: 'desc', comments: 'desc' }); // 每個選項的獨立排序方向
  const [filters, setFilters] = useState({ payment: 'all' });
  const [locationKeyword, setLocationKeyword] = useState('');
  const [nowTs, setNowTs] = useState(Date.now());
  const hasAskedPermissionRef = useRef(false);

  const loadData = async () => {
    // 先嘗試執行一次資料遷移（僅執行一次，不阻塞）
    if (!hasAskedPermissionRef.current) {
      hasAskedPermissionRef.current = true;
      // 非同步執行遷移，不等待結果
      migrateDataToDatabase().catch(() => {
        // 靜默失敗
      });
    }

    // 從資料庫載入資料
    let stored = [];
    try {
      stored = await databaseService.getAllOrders();
    } catch (error) {
      // 回退到本地
      try {
        const localData = await AsyncStorage.getItem('orders');
        stored = localData ? JSON.parse(localData) : [];
      } catch (e) {
        stored = [];
      }
    }

    // 從資料庫載入點讚數據
    let dbLikes = {}; // 當前用戶的點讚狀態（每個用戶獨立）
    let dbLikeCounts = {}; // 訂單的總點讚數（所有用戶共享）
    
    // 先從訂單數據中獲取點讚數量（從資料庫訂單中，這是所有用戶的累積點讚數）
    stored.forEach(order => {
      dbLikeCounts[order.id] = order.like_count || 0;
    });
    
    // 從資料庫獲取當前用戶的點讚狀態（每個用戶獨立）
    try {
      const currentUser = await AuthManager.getCurrentUser();
      const userId = currentUser?.id || 'me';
      
      if (userId !== 'me') {
        // 只在用戶已登入時從資料庫獲取該用戶的點讚狀態
        try {
          const userLikes = await apiService.getUserLikes(userId);
          
          // 建立點讚狀態映射（只包含當前用戶點讚的訂單）
          if (Array.isArray(userLikes)) {
            userLikes.forEach(like => {
              if (like && like.order_id && like.liked === true) {
                // 只記錄用戶已點讚的訂單（liked === true）
                dbLikes[like.order_id] = true;
              }
            });
          }
          console.log('已載入當前用戶點讚狀態:', Object.keys(dbLikes).length, '個訂單');
        } catch (apiError) {
          // API 失敗時記錄但不使用本地數據（因為本地數據是全局的，不準確）
          console.log('從資料庫載入點讚狀態失敗:', apiError.message);
        }
      }
    } catch (error) {
      // 獲取用戶資訊失敗時記錄
      console.log('無法獲取用戶資訊:', error.message);
    }
    
    // 載入本地留言數據
    const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
    
    const parseRemainingMs = (text) => {
      if (!text) return null;
      const t = String(text);
      const n = parseFloat((t.match(/[\d\.]+/) || [])[0]);
      if (!isFinite(n)) return null;
      if (/小?時|hour|hr/i.test(t)) return Math.max(0, n) * 3600 * 1000;
      if (/分|minute|min/i.test(t)) return Math.max(0, n) * 60 * 1000;
      if (/秒|sec/i.test(t)) return Math.max(0, n) * 1000;
      return n > 0 ? n * 3600 * 1000 : null; // 預設當作小時
    };

    const now = Date.now();
    // 過濾掉被忽略的留言，只計算有效的留言數量
    const validComments = {};
    Object.keys(comments).forEach(orderId => {
      const orderComments = comments[orderId] || [];
      const validOrderComments = orderComments.filter(comment => comment.status !== 'ignored');
      validComments[orderId] = validOrderComments;
    });

    // 檢查訂單是否在截止時間內有接單或配送動作
    const hasOrderAction = (order) => {
      const orderComments = validComments[order.id] || [];
      
      // 檢查是否有已接單的留言（accepted === true）
      const hasAcceptedComment = orderComments.some(comment => 
        comment.accepted === true && !comment.isReply
      );
      
      // 檢查是否有配送中的留言（deliveryStatus === 'delivering' || 'completed'）
      const hasDeliveryAction = orderComments.some(comment => 
        comment.deliveryStatus === 'delivering' || 
        comment.deliveryStatus === 'completed'
      );
      
      return hasAcceptedComment || hasDeliveryAction;
    };

    // 檢查並更新過期訂單狀態（在過濾之前）
    let ordersToUpdate = [];
    const updatedStored = stored.map(order => {
      // 獲取訂單的截止時間
      const expiresAt = order.expiresAt || order.expires_at || order.expires;
      
      // 如果沒有截止時間或訂單已經有特定狀態，跳過
      if (!expiresAt || order.status === 'completed' || order.status === 'delivering' || order.status === 'cancelled' || order.status === 'expired') {
        return order;
      }
      
      // 如果訂單已過期且狀態不是 expired
      if (expiresAt < now && order.status !== 'expired') {
        // 檢查是否有接單或配送動作
        const hasAction = hasOrderAction(order);
        
        // 如果沒有接單/配送動作，標記為需要更新為 expired
        if (!hasAction) {
          ordersToUpdate.push(order.id);
          return {
            ...order,
            status: 'expired'
          };
        }
      }
      
      return order;
    });
    
    // 如果有訂單狀態被更新，保存到AsyncStorage並同步到資料庫
    if (ordersToUpdate.length > 0) {
      await AsyncStorage.setItem('orders', JSON.stringify(updatedStored));
      
      // 異步同步到資料庫（非阻塞）
      ordersToUpdate.forEach(orderId => {
        databaseService.updateOrder(orderId, { status: 'expired' }).catch(err => {
          // 靜默處理錯誤，不影響主要流程
          const errorMessage = err.message || '';
          const isIgnorable = err.status === 404 || 
                            err.status === 400 ||
                            err.status === 500 ||
                            errorMessage.includes('404') || 
                            errorMessage.includes('HTTP error! status: 404') ||
                            errorMessage.includes('HTTP error! status: 400') ||
                            errorMessage.includes('HTTP error! status: 500') ||
                            errorMessage.includes('訂單不存在') ||
                            errorMessage.includes('訂單狀態無效') ||
                            errorMessage.includes('Network request failed');
          
          if (!isIgnorable) {
            console.log(`更新訂單 ${orderId} 狀態失敗（資料庫）:`, err.message);
          }
        });
      });
    }

    const merged = updatedStored
      .filter(o => {
        // 過濾掉已完成和配送中的訂單
        if (o.status === 'completed' || o.status === 'delivering' || o.status === 'expired') {
          return false;
        }
        
        // 計算並檢查截止時間（支援多種欄位名稱）
        // 優先使用 expiresAt，然後 expires_at，最後 expires
        let migratedExpiresAt = o.expiresAt;
        if (!migratedExpiresAt && o.expires_at !== undefined && o.expires_at !== null) {
          migratedExpiresAt = o.expires_at;
        }
        if (!migratedExpiresAt && o.expires !== undefined && o.expires !== null) {
          migratedExpiresAt = o.expires;
        }
        
        // 如果還是沒有截止時間，嘗試從 remaining 計算
        if (!migratedExpiresAt) {
          const ms = parseRemainingMs(o.remaining);
          if (ms) {
            migratedExpiresAt = now + ms;
          }
        }
        
        // 如果沒有截止時間（新訂單可能還沒有設置），允許顯示
        if (!migratedExpiresAt) {
          return true;
        }
        
        // 如果截止時間還沒到（未來的時間），允許顯示
        if (migratedExpiresAt > now) {
          return true;
        }
        
        // 如果截止時間已過期
        if (migratedExpiresAt < now) {
          // 檢查是否有接單或配送動作
          const hasAction = hasOrderAction(o);
          
          // 如果沒有接單/配送動作，過濾掉此訂單（已過期且未成功）
          if (!hasAction) {
            return false;
          }
          
          // 如果有接單/配送動作，也過濾掉（因為已經在進行中，不需要在首頁顯示）
          // 但根據用戶需求，這些訂單應該在"我的訂單"中顯示，而不是首頁
          return false;
        }
        
        return true;
      })
      .map(o => {
        // 支援多種截止時間欄位名稱（與過濾邏輯保持一致）
        let migratedExpiresAt = o.expiresAt;
        if (!migratedExpiresAt && o.expires_at !== undefined && o.expires_at !== null) {
          migratedExpiresAt = o.expires_at;
        }
        if (!migratedExpiresAt && o.expires !== undefined && o.expires !== null) {
          migratedExpiresAt = o.expires;
        }
        if (!migratedExpiresAt) {
          const ms = parseRemainingMs(o.remaining);
          if (ms) {
            migratedExpiresAt = now + ms;
          }
        }
        
        // 計算有效留言數量（排除被忽略的）
        const validOrderComments = validComments[o.id] || [];
        const validCommentCount = validOrderComments.length;
        
        // 使用資料庫的點讚數據
        // liked: 當前用戶是否點讚（從資料庫獲取，每個用戶獨立）
        // likeCount: 訂單的總點讚數（從資料庫獲取，所有用戶累積）
        const liked = dbLikes[o.id] === true; // 只有明確為true才是點讚，undefined/false都表示未點讚
        const likeCount = dbLikeCounts[o.id] || 0; // 從資料庫獲取總點讚數
        
        return {
          ...o,
          expiresAt: migratedExpiresAt,
          liked: liked,
          likeCount: likeCount,
          comments: validCommentCount
        };
      });
    setOrders(merged);
  };

  // 分離初始化邏輯和數據載入邏輯
  useEffect(() => {
    // 初始化用戶信譽等級（只執行一次）
    initializeUserTiers();
    
    // 設置定時器檢查訂單截止狀態
    const deadlineCheckInterval = setInterval(() => {
      checkDeadlineNotifications();
    }, 60000); // 每分鐘檢查一次
    
    return () => clearInterval(deadlineCheckInterval);
  }, []); // 空依賴數組，只執行一次

  // 單獨的 useEffect 用於載入數據
  useEffect(() => {
    loadData();
  }, []); // 初始載入

  // 回到首頁焦點時重新載入，確保「發起」成功後立即顯示在「我的」
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // 已棄用：請使用 notificationHelper.createNotification
  // 保留此函數以保持向後兼容性，但會自動同步到資料庫
  const writeInbox = async (notif) => {
    try {
      const { createNotification, sendNotificationToOrderCreator } = require('../utils/notificationHelper');
      const { AuthManager } = require('../utils/authManager');
      
      // 嘗試獲取當前用戶 ID（作為接收者）
      let targetUserId = notif.user_id;
      if (!targetUserId || targetUserId === 'me') {
        try {
          const currentUser = await AuthManager.getCurrentUser();
          targetUserId = currentUser?.id;
          if (!targetUserId) {
            // 如果無法獲取用戶 ID，只寫入本地（向後兼容）
            const saved = JSON.parse(await AsyncStorage.getItem('inbox')) || [];
            const item = {
              id: `${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
              ts: Date.now(),
              read: false,
              ...notif
            };
            const next = [item, ...saved];
            await AsyncStorage.setItem('inbox', JSON.stringify(next));
            return;
          }
        } catch (error) {
          console.error('獲取當前用戶 ID 失敗，只寫入本地:', error);
          // 如果無法獲取用戶 ID，只寫入本地（向後兼容）
          const saved = JSON.parse(await AsyncStorage.getItem('inbox')) || [];
          const item = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
            ts: Date.now(),
            read: false,
            ...notif
          };
          const next = [item, ...saved];
          await AsyncStorage.setItem('inbox', JSON.stringify(next));
          return;
        }
      }

      // 如果有訂單ID，嘗試發送給訂單發起者
      if (notif.orderId && !notif.user_id) {
        await sendNotificationToOrderCreator(
          notif.orderId,
          notif.type || 'general',
          notif.title || '通知',
          notif.body || '',
          {
            order_name: notif.orderName,
            commenter_id: notif.commenterId,
            comment_id: notif.commentId,
          }
        );
      } else {
        // 直接創建通知
        await createNotification({
          user_id: targetUserId,
          type: notif.type || 'general',
          title: notif.title || '通知',
          body: notif.body || '',
          order_id: notif.orderId || null,
          commenter_id: notif.commenterId || null,
          order_name: notif.orderName || null,
          comment_id: notif.commentId || null,
        });
      }
    } catch (err) {
      console.error('writeInbox 失敗:', err);
      // 如果失敗，嘗試只寫入本地（向後兼容）
      try {
        const saved = JSON.parse(await AsyncStorage.getItem('inbox')) || [];
        const item = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
          ts: Date.now(),
          read: false,
          ...notif
        };
        const next = [item, ...saved];
        await AsyncStorage.setItem('inbox', JSON.stringify(next));
      } catch (fallbackErr) {
        console.error('寫入本地通知失敗:', fallbackErr);
      }
    }
  };

  // 處理有人加入代購
  const handleJoinOrder = async (orderId, joinerInfo) => {
    const updated = orders.map(o => {
      if (o.id === orderId) {
        const joiners = o.joiners || [];
        const newJoiner = {
          id: Date.now().toString(),
          name: joinerInfo.name || '匿名用戶',
          phone: joinerInfo.phone || '',
          line: joinerInfo.line || '',
          joinTime: Date.now(),
          status: 'pending', // pending, accepted, rejected
          userId: 'me' // 標記這是當前用戶
        };
        return {
          ...o,
          joiners: [...joiners, newJoiner],
          joined: (o.joined || 0) + 1,
          joinedBy: 'me' // 標記當前用戶參加了這個代購
        };
      }
      return o;
    });
    setOrders(updated);
    await AsyncStorage.setItem('orders', JSON.stringify(updated));
    
    // 寫入通知
    const target = updated.find(o => o.id === orderId);
    if (target) {
      writeInbox({ 
        type: 'joined', 
        title: '有人加入你的代購', 
        body: `${joinerInfo.name || '匿名用戶'} 加入了 ${target.name}` 
      });
    }
  };

  // 接受或拒絕加入者
  const handleJoinResponse = async (orderId, joinerId, action) => {
    const updated = orders.map(o => {
      if (o.id === orderId) {
        const joiners = o.joiners?.map(j => 
          j.id === joinerId ? { ...j, status: action } : j
        ) || [];
        return { ...o, joiners };
      }
      return o;
    });
    setOrders(updated);
    await AsyncStorage.setItem('orders', JSON.stringify(updated));
    
    // 寫入通知
    const target = updated.find(o => o.id === orderId);
    const joiner = target?.joiners?.find(j => j.id === joinerId);
    if (target && joiner) {
      const actionText = action === 'accepted' ? '接受' : '拒絕';
      writeInbox({ 
        type: 'joinResponse', 
        title: `代購加入申請${actionText}`, 
        body: `${joiner.name} 的加入申請已被${actionText}` 
      });
    }
  };


  // 測試用：模擬用戶參加一些代購
  useEffect(() => {
    const addTestJoinData = async () => {
      const existing = JSON.parse(await AsyncStorage.getItem('orders')) || [];
      if (existing.length > 0) {
        // 為前幾個代購添加參加記錄
        const updated = existing.map((order, index) => {
          if (index < 2 && order.createdBy !== 'me') {
            // 檢查是否已經有測試參加者，避免重複
            const hasTestJoiner = (order.joiners || []).some(joiner => 
              joiner.id && joiner.id.startsWith('test_joiner_')
            );
            
            if (!hasTestJoiner) {
              return {
                ...order,
                joinedBy: 'me',
                joined: (order.joined || 0) + 1,
                joiners: [
                  ...(order.joiners || []),
                  {
                    id: `test_joiner_${Date.now()}_${index}`, // 使用時間戳確保唯一性
                    name: '我',
                    phone: '0912345678',
                    line: 'myline123',
                    joinTime: Date.now() - (index + 1) * 86400000, // 1-2天前
                    status: 'accepted',
                    userId: 'me'
                  }
                ]
              };
            }
          }
          return order;
        });
        await AsyncStorage.setItem('orders', JSON.stringify(updated));
      }
    };
    addTestJoinData();
  }, []);

  // 通知權限與通道設定
  useEffect(() => {
    const ensurePermission = async () => {
      if (hasAskedPermissionRef.current) return;
      hasAskedPermissionRef.current = true;
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }
        // Android 通道
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default', importance: Notifications.AndroidImportance.DEFAULT
        });
      } catch (e) {
        // 忽略權限錯誤
      }
    };
    ensurePermission();
  }, []);

  // 每秒刷新時間並檢查過期訂單（更新狀態而不是刪除）
  useEffect(() => {
    const timer = setInterval(async () => {
      const current = Date.now();
      setNowTs(current);
      
      // 載入所有訂單數據（包括已過期的）
      const allOrders = JSON.parse(await AsyncStorage.getItem('orders')) || [];
      const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
      
      // 檢查訂單是否在截止時間內有接單或配送動作
      const hasOrderAction = (order) => {
        const orderComments = comments[order.id] || [];
        
        // 檢查是否有已接單的留言（accepted === true）
        const hasAcceptedComment = orderComments.some(comment => 
          comment.accepted === true && !comment.isReply
        );
        
        // 檢查是否有配送中的留言（deliveryStatus === 'delivering' || 'completed'）
        const hasDeliveryAction = orderComments.some(comment => 
          comment.deliveryStatus === 'delivering' || 
          comment.deliveryStatus === 'completed'
        );
        
        return hasAcceptedComment || hasDeliveryAction;
      };
      
      let ordersUpdated = false;
      const updatedOrders = allOrders.map(order => {
        // 獲取訂單的截止時間
        const expiresAt = order.expiresAt || order.expires_at || order.expires;
        
        // 如果沒有截止時間或訂單已經有特定狀態，跳過
        if (!expiresAt || order.status === 'completed' || order.status === 'delivering' || order.status === 'cancelled') {
          return order;
        }
        
        // 如果訂單已過期且狀態不是 expired
        if (expiresAt < current && order.status !== 'expired') {
          // 檢查是否有接單或配送動作
          const hasAction = hasOrderAction(order);
          
          // 如果沒有接單/配送動作，更新狀態為 expired
          if (!hasAction) {
            ordersUpdated = true;
            // 發送過期通知（僅一次）
            if (!order.expiredNotified) {
              writeInbox({ type: 'expired', title: '代購已截止', body: order.name });
            }
            return {
              ...order,
              status: 'expired',
              expiredNotified: true
            };
          }
        }
        
        return order;
      });
      
      // 如果有訂單狀態被更新，保存到AsyncStorage並同步到資料庫
      if (ordersUpdated) {
        await AsyncStorage.setItem('orders', JSON.stringify(updatedOrders));
        
        // 找出需要同步到資料庫的訂單
        const expiredOrders = updatedOrders.filter(o => 
          o.status === 'expired' && 
          allOrders.find(old => old.id === o.id && old.status !== 'expired')
        );
        
        // 異步同步到資料庫（非阻塞）
        expiredOrders.forEach(order => {
          databaseService.updateOrder(order.id, { status: 'expired' }).catch(err => {
            // 靜默處理錯誤，不影響主要流程
            const errorMessage = err.message || '';
            const isIgnorable = err.status === 404 || 
                              err.status === 400 ||
                              err.status === 500 ||
                              errorMessage.includes('404') || 
                              errorMessage.includes('HTTP error! status: 404') ||
                              errorMessage.includes('HTTP error! status: 400') ||
                              errorMessage.includes('HTTP error! status: 500') ||
                              errorMessage.includes('訂單不存在') ||
                              errorMessage.includes('訂單狀態無效') ||
                              errorMessage.includes('Network request failed');
            
            if (!isIgnorable) {
              console.log(`更新訂單 ${order.id} 狀態失敗（資料庫）:`, err.message);
            }
          });
        });
      }
      
      // 更新當前顯示的訂單列表（只顯示未過期的）
      if (orders.length) {
        const stillValid = orders.filter(o => {
          const expiresAt = o.expiresAt || o.expires_at || o.expires;
          if (!expiresAt) return true;
          if (expiresAt > current) return true;
          // 如果已過期，檢查是否有接單/配送動作
          const hasAction = hasOrderAction(o);
          // 有動作的訂單也不在首頁顯示（會在"我的訂單"中顯示）
          return false;
        });
        
        if (stillValid.length !== orders.length) {
          setOrders(stillValid);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [orders]);

  const toggleLike = async (id) => {
    try {
      // 獲取當前用戶
      const currentUser = await AuthManager.getCurrentUser();
      const userId = currentUser?.id || 'me';
      
      // 調用 API 切換點讚狀態
      const response = await apiService.toggleLike(id, userId);
      
      if (response.success) {
        // 更新本地狀態
        const updated = orders.map(o => {
          if (o.id === id) {
            return { 
              ...o, 
              liked: response.liked, // 當前用戶的點讚狀態
              likeCount: response.like_count // 訂單的總點讚數（所有用戶累積）
            };
          }
          return o;
        });
        setOrders(updated);
        
        // 注意：不再保存個人點讚狀態到 AsyncStorage
        // 因為每個用戶的點讚狀態是獨立的，應該從資料庫獲取
        // 只保存點讚總數（如果需要本地緩存的話，但最好每次都從資料庫獲取最新值）
        
        // 即時通知：有人按讚（只有點讚時才通知）
        // 注意：按讚通知必須發送給訂單發起者（created_by），而不是當前用戶（按讚者）
        if (response.liked) {
          const target = updated.find(o => o.id === id);
          if (target) {
            // 傳遞 orderId，讓 writeInbox 自動發送給訂單發起者
            writeInbox({ 
              type: 'liked', 
              title: '有人對你的代購按讚', 
              body: target?.name || '代購',
              orderId: id, // 傳遞訂單ID，確保通知發送給訂單發起者
              orderName: target?.name || '代購'
            });
          }
        }
      }
    } catch (error) {
      console.error('切換點讚狀態失敗:', error);
      // 發生錯誤時，仍然更新本地 UI（保持用戶體驗）
      const updated = orders.map(o => {
        if (o.id === id) {
          const wasLiked = o.liked;
          const newLiked = !wasLiked;
          const newLikeCount = newLiked ? (o.likeCount || 0) + 1 : Math.max(0, (o.likeCount || 0) - 1);
          return { ...o, liked: newLiked, likeCount: newLikeCount };
        }
        return o;
      });
      setOrders(updated);
    }
  };

  const handleCommentUpdate = async (id, newCount) => {
    console.log('handleCommentUpdate 被調用:', id, '新留言數量:', newCount);
    
    const updated = orders.map(o => o.id === id ? { ...o, comments: newCount } : o);
    setOrders(updated);
    
    // 即時通知：有新留言
    const target = updated.find(o => o.id === id);
    if (target) {
      console.log('找到目標訂單:', target.name, '原留言數:', target.comments, '新留言數:', newCount);
      
      // 檢查是否有新留言（留言數量增加）
      if (newCount > (target.comments || 0)) {
        console.log('創建留言通知');
        writeInbox({ 
          type: 'comment', 
          title: '你的代購有新留言', 
          body: `${target.name} 有新的留言` 
        });
      } else {
        console.log('留言數量沒有增加，不創建通知');
      }
    } else {
      console.log('找不到目標訂單:', id);
    }
  };

  const deleteOrder = async (id) => {
    // 取消通知
    try {
      const target = orders.find(o => o.id === id);
      const ids = target?.notificationIds || {};
      if (ids.preId) await Notifications.cancelScheduledNotificationAsync(ids.preId);
      if (ids.endId) await Notifications.cancelScheduledNotificationAsync(ids.endId);
    } catch {}

    const updated = orders.filter(o => o.id !== id);
    setOrders(updated);
    await AsyncStorage.setItem('orders', JSON.stringify(updated));
    setMenuVisibleId(null);
    writeInbox({ type: 'deleted', title: '你刪除了代購', body: `已刪除：${id}` });
  };

  const getRemainingMillis = (order) => {
    // 支援多種時間欄位名稱
    const expiresAt = order.expiresAt || order.expires_at || order.expires || null;
    
    if (!expiresAt) {
      // 如果有 created_at 或 createdAt，嘗試根據訂單創建時間計算
      const createdAt = order.created_at || order.createdAt || order.timestamp || null;
      if (createdAt) {
        // 假設訂單默認 2 小時有效
        const defaultDuration = 2 * 60 * 60 * 1000; // 2小時
        const calculatedExpiresAt = createdAt + defaultDuration;
        return Math.max(0, calculatedExpiresAt - nowTs);
      }
      return Number.POSITIVE_INFINITY;
    }
    
    return Math.max(0, expiresAt - nowTs);
  };

  const normalize = (v) => (v || '').toString().toLowerCase();

  const formatRemaining = (ms) => {
    if (!isFinite(ms)) return '訂單截止剩餘時間不明';
    if (ms <= 0) return '等待配送'; // 時間到期後顯示"等待配送"，而非"已截止"
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `訂單截止剩餘 ${hours}小時 ${minutes}分`;
    if (minutes > 0) return `訂單截止剩餘 ${minutes}分 ${seconds}秒`;
    return `訂單截止剩餘 ${seconds}秒`;
  };

  // 檢查剩餘時間是否少於10分鐘
  const isDeadlineSoon = (ms) => {
    if (!isFinite(ms) || ms <= 0) return false;
    return ms <= 10 * 60 * 1000; // 10分鐘 = 10 * 60 * 1000毫秒
  };

  // 檢查訂單截止狀態並發送通知
  const checkDeadlineNotifications = async () => {
    try {
      const currentTime = Date.now();
      const deadlineThreshold = 10 * 60 * 1000; // 10分鐘
      
      // 檢查是否有訂單即將在10分鐘內截止
      const ordersNearDeadline = orders.filter(order => {
        if (!order.expiresAt || order.status === 'completed' || order.status === 'delivering') {
          return false;
        }
        const remainingTime = order.expiresAt - currentTime;
        return remainingTime <= deadlineThreshold && remainingTime > 0;
      });

      // 為每個即將截止的訂單發送通知
      for (const order of ordersNearDeadline) {
        // 檢查是否已經發送過截止通知
        const hasSentDeadlineNotification = await checkDeadlineNotificationSent(order.id);
        
        if (!hasSentDeadlineNotification) {
          await sendDeadlineNotification(order);
          await markDeadlineNotificationSent(order.id);
        }
      }
    } catch (error) {
      console.error('檢查截止通知失敗:', error);
    }
  };

  // 檢查是否已經發送過截止通知
  const checkDeadlineNotificationSent = async (orderId) => {
    try {
      const sentNotifications = JSON.parse(await AsyncStorage.getItem('sentDeadlineNotifications')) || [];
      return sentNotifications.includes(orderId);
    } catch (error) {
      console.error('檢查截止通知發送狀態失敗:', error);
      return false;
    }
  };

  // 標記已發送截止通知
  const markDeadlineNotificationSent = async (orderId) => {
    try {
      const sentNotifications = JSON.parse(await AsyncStorage.getItem('sentDeadlineNotifications')) || [];
      if (!sentNotifications.includes(orderId)) {
        sentNotifications.push(orderId);
        await AsyncStorage.setItem('sentDeadlineNotifications', JSON.stringify(sentNotifications));
      }
    } catch (error) {
      console.error('標記截止通知發送狀態失敗:', error);
    }
  };

  // 發送截止通知
  const sendDeadlineNotification = async (order) => {
    try {
      const remainingMinutes = Math.ceil((order.expiresAt - Date.now()) / (60 * 1000));
      
      // 寫入通知到 inbox
      await writeInbox({
        type: 'deadline_warning',
        title: '⏰ 代購即將截止',
        body: `${order.name} 將在${remainingMinutes}分鐘內截止，請盡快完成！`
      });

      // 發送本地推送通知
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ 代購即將截止',
          body: `${order.name} 將在${remainingMinutes}分鐘內截止，請盡快完成！`,
          data: { orderId: order.id, type: 'deadline_warning' }
        },
        trigger: { seconds: 1 }
      });

      console.log(`已發送截止通知: ${order.name}`);
    } catch (error) {
      console.error('發送截止通知失敗:', error);
    }
  };

  const baseOrders = viewMode === 'mine' ? orders.filter(o => o.createdBy === 'me') : orders;

  const searchedOrders = baseOrders.filter(o => {
    if (!searchQuery) return true;
    const q = normalize(searchQuery);
    return [o.name, o.title, o.address, o.phone, o.contact, o.line, o.method, o.payment]
      .some(field => normalize(field).includes(q));
  });

  const locationFiltered = searchedOrders.filter(o => {
    if (!locationKeyword) return true;
    return normalize(o.address).includes(normalize(locationKeyword));
  });

  const paymentMatches = (order) => {
    if (filters.payment === 'all') return true;
    const pm = normalize(order.method || order.payment);
    if (filters.payment === 'transfer') return pm.includes('轉帳') || pm.includes('轉賬') || pm.includes('bank');
    if (filters.payment === 'linepay') return pm.includes('line') || pm.includes('linepay') || pm.includes('line pay');
    if (filters.payment === 'cod') return pm.includes('貨到付款') || pm.includes('cod') || pm.includes('cash on delivery');
    return true;
  };

  // 獲取狀態標籤文字
  const getStatusBadgeText = (status) => {
    switch (status) {
      case 'preparing': return '搜集中';
      case 'delivering': return '配送中';
      case 'completed': return '已完成';
      case 'cancelled': return '已取消';
      default: return '';
    }
  };

  // 獲取狀態標籤顏色
  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'delivering': return '#2196F3';
      case 'completed': return '#4CAF50';
      case 'cancelled': return '#F44336';
      default: return '#FF9800';
    }
  };

  const filteredOrders = locationFiltered
    .filter(paymentMatches)
    .slice()
    .sort((a, b) => {
      let result = 0;
      
      if (sortKey === 'time') {
        result = getRemainingMillis(b) - getRemainingMillis(a);
      } else if (sortKey === 'comments') {
        result = (b.comments || 0) - (a.comments || 0);
      } else if (sortKey === 'hot') {
        // hot: 依據愛心數量排序，愛心越多越熱門
        result = (b.likeCount || 0) - (a.likeCount || 0);
      }
      
      // 根據排序方向調整結果
      const direction = sortDirections[sortKey] || 'desc';
      return direction === 'asc' ? -result : result;
    });



  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Ionicons name="person-circle-outline" size={22} color="#6BA4FF" style={{ marginRight: 6 }} />
          <Text style={styles.header}>
            <Text style={{ color: item.color || '#1E88E5' }}>{item.name}</Text>
            {item.title ? ' ' + item.title : ''}
          </Text>
          {/* 訂單狀態標籤 */}
          {item.status && (
            <View style={[styles.statusBadge, { backgroundColor: getStatusBadgeColor(item.status) }]}>
              <Text style={styles.statusBadgeText}>
                {getStatusBadgeText(item.status)}
              </Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[
            styles.remaining,
            isDeadlineSoon(getRemainingMillis(item)) && styles.remainingUrgent
          ]}>
            {formatRemaining(getRemainingMillis(item))}
          </Text>
          <Pressable
            onPress={() => setMenuVisibleId(menuVisibleId === item.id ? null : item.id)}
            style={styles.menuIcon}
          >
            <Entypo name="dots-three-vertical" size={16} color="#888" />
          </Pressable>
        </View>
      </View>

      {menuVisibleId === item.id && (
        <View style={styles.menuBoxFloating}>
          {/* 所有用戶都可以查看訂單管理 */}
          <TouchableOpacity 
            key={`view-management-${item.id}`}
            onPress={() => {
              setMenuVisibleId(null);
              navigation.navigate('OrderManagement', { 
                order: item,
                orderId: item.id 
              });
            }}>
            <Text style={styles.menuItem}>📦 查看訂單管理</Text>
          </TouchableOpacity>
          
          {/* 只有發起者才能編輯和刪除 */}
          {item.createdBy === 'me' && (
            <>
              <TouchableOpacity 
                key={`edit-${item.id}`}
                onPress={() => {
                  setMenuVisibleId(null);
                  navigation.navigate('EditOrder', { order: item });
                }}>
                <Text style={styles.menuItem}>✏️ 編輯</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                key={`delete-${item.id}`}
                onPress={() => deleteOrder(item.id)}>
                <Text style={styles.menuItem}>🗑 刪除</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <TouchableOpacity
        onPress={() => navigation.navigate('Message', {
          orderId: item.id,
          onCommentUpdate: handleCommentUpdate,
          orderName: item.name,
          orderLocation: item.address,
          orderContact: item.phone || item.contact,
          orderLine: item.line,
          orderPayment: item.method || item.payment,
          orderNote: item.limit || item.note
        })}
      >
        <Text>📍地點：{item.address}  <Text style={{ color: 'red' }}>（{item.limit || item.note}）</Text></Text>
        <Text>📞電話：{item.phone || item.contact}</Text>
        <Text>💬Line ID：{item.line}</Text>
        <Text>💳付款方式：{item.method || item.payment}</Text>
        <View style={styles.iconRow}>
          <Pressable
            onPress={() => toggleLike(item.id)}
            onHoverIn={() => setHoveredId(item.id)}
            onHoverOut={() => setHoveredId(null)}
          >
            <Ionicons
              name={item.liked || hoveredId === item.id ? 'heart' : 'heart-outline'}
              size={18}
              color={item.liked || hoveredId === item.id ? 'red' : 'gray'}
            />
          </Pressable>
          <Text> {item.likeCount || 0}</Text>

          <Pressable
            style={{ marginLeft: 16 }}
            onPress={() => navigation.navigate('Message', {
              orderId: item.id,
              onCommentUpdate: handleCommentUpdate,
              orderName: item.name,
              orderLocation: item.address,
              orderContact: item.phone || item.contact,
              orderLine: item.line,
              orderPayment: item.method || item.payment,
              orderNote: item.limit || item.note
            })}
            onHoverIn={() => setHoveredId(item.id)}
            onHoverOut={() => setHoveredId(null)}
          >
            <Ionicons
              name={hoveredId === item.id ? 'chatbubble' : 'chatbubble-outline'}
              size={18}
              color={hoveredId === item.id ? '#007BFF' : 'gray'}
            />
          </Pressable>
          <Text> {item.comments}</Text>

        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.logoText}>BUYCART</Text>
        <Ionicons name="cart-outline" size={24} color="#fff" />
      </View>
      <TextInput
        placeholder="🔍 搜尋商品、發起人或關鍵字..."
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
        returnKeyType="search"
      />

      {/* 上方工具列 */}
      <View style={styles.toolbarRow}>
        <TouchableOpacity style={styles.toolbarButton} onPress={() => setFilterModalVisible(true)}>
          <Ionicons name="menu-outline" size={16} color="#666" />
          <Text style={styles.toolbarText}>條件篩選</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton} onPress={() => setSortModalVisible(true)}>
          <Ionicons name="swap-vertical-outline" size={16} color="#666" />
          <Text style={styles.toolbarText}>排序</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton} onPress={() => setLocationModalVisible(true)}>
          <Ionicons name="location-outline" size={16} color="#666" />
          <Text style={styles.toolbarText}>地點/距離</Text>
        </TouchableOpacity>
      </View>

      {/* 熱門/我的 區塊 */}
      <View style={styles.hotMyRow}>
        <TouchableOpacity onPress={() => setViewMode('all')} style={styles.hotLeftWrap}>
          <Text style={styles.hotEmoji}>🔥</Text>
          <Text style={[styles.hotText, viewMode === 'all' && styles.hotTextActive]}>熱門...</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.myButton, viewMode === 'mine' && styles.myButtonActive]}
          onPress={() => setViewMode('mine')}
        >
          <Text style={[styles.myButtonText, viewMode === 'mine' && styles.myButtonTextActive]}>我的</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {/* 排序 Modal */}
      <Modal visible={sortModalVisible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSortModalVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>排序方式</Text>
            {[
              { key: 'hot', label: '熱門優先（依愛心數量）', hasDirection: false },
              { key: 'time', label: '訂單截止剩餘時間', hasDirection: true },
              { key: 'comments', label: '留言數', hasDirection: true },
            ].map((opt, index) => {
              const getSortLabel = () => {
                if (!opt.hasDirection) return opt.label;
                const direction = sortDirections[opt.key] || 'desc';
                const directionText = direction === 'desc' ? '（多到少）' : '（少到多）';
                return `${opt.label}${directionText}`;
              };
              
              const handleSortPress = () => {
                if (sortKey === opt.key && opt.hasDirection) {
                  // 如果是同一個排序選項且有方向，則切換該選項的方向
                  setSortDirections(prev => ({
                    ...prev,
                    [opt.key]: prev[opt.key] === 'desc' ? 'asc' : 'desc'
                  }));
                } else {
                  // 否則切換到新的排序選項
                  setSortKey(opt.key);
                  if (opt.hasDirection) {
                    // 如果該選項還沒有方向設定，設定預設方向
                    setSortDirections(prev => ({
                      ...prev,
                      [opt.key]: prev[opt.key] || 'desc'
                    }));
                  }
                }
              };
              
              return (
                <TouchableOpacity
                  key={`sort-${opt.key}-${index}`}
                  style={[styles.optionRow, sortKey === opt.key && styles.optionRowActive]}
                  onPress={handleSortPress}
                >
                  <Text style={styles.optionText}>{getSortLabel()}</Text>
                  {opt.hasDirection && sortKey === opt.key && (
                    <Text style={styles.directionHint}>點擊切換方向</Text>
                  )}
                </TouchableOpacity>
              );
            })}
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setSortModalVisible(false)}>
                <Text style={styles.actionBtnText}>完成</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 篩選 Modal */}
      <Modal visible={filterModalVisible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setFilterModalVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>條件篩選</Text>
            <Text style={[styles.optionText, { marginTop: 10 }]}>付款方式</Text>
            <View style={styles.chipRow}>
              {[
                { key: 'all', label: '全部' },
                { key: 'transfer', label: '轉帳' },
                { key: 'linepay', label: 'LinePay' },
                { key: 'cod', label: '貨到付款' },
              ].map((opt, index) => (
                <Pressable
                  key={`payment-${opt.key}-${index}`}
                  onPress={() => setFilters(prev => ({ ...prev, payment: opt.key }))}
                  style={[styles.chip, filters.payment === opt.key && styles.chipActive]}
                >
                  <Text style={[styles.chipText, filters.payment === opt.key && styles.chipTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setFilters({ payment: 'all' })}>
                <Text style={styles.secondaryBtnText}>清除</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setFilterModalVisible(false)}>
                <Text style={styles.actionBtnText}>完成</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 地點 Modal */}
      <Modal visible={locationModalVisible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setLocationModalVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>地點關鍵字</Text>
            <TextInput
              placeholder="輸入地址/地點關鍵字，如：新北、板橋、公館"
              value={locationKeyword}
              onChangeText={setLocationKeyword}
              style={styles.input}
            />
            <Text style={styles.hintText}>目前資料未含座標，暫以關鍵字比對地址。</Text>
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setLocationKeyword('')}>
                <Text style={styles.secondaryBtnText}>清除</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setLocationModalVisible(false)}>
                <Text style={styles.actionBtnText}>完成</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function HomeScreen() {
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = async () => {
    try {
      const inbox = JSON.parse(await AsyncStorage.getItem('inbox')) || [];
      const count = inbox.filter(n => !n.read).length;
      setUnreadCount(count);
    } catch (err) {
      // 靜默處理錯誤
    }
  };

  useEffect(() => {
    loadUnread();
    const t = setInterval(loadUnread, 2000);
    return () => clearInterval(t);
  }, []);

  // 監聽通知頁的變化
  useFocusEffect(
    useCallback(() => {
      loadUnread();
    }, [])
  );

  return <HomeContent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f6f6',
    padding: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'sans-serif'
  },
  searchInput: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 10
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#efefef',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  toolbarText: {
    marginLeft: 4,
    color: '#555',
    fontSize: 12
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginTop: 8
  },
  hotMyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  hotLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  hotEmoji: {
    fontSize: 18,
  },
  hotLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'red',
    marginBottom: 8,
    marginLeft: 8
  },
  hotText: {
    marginLeft: 6,
    color: '#666',
    fontSize: 14,
    fontWeight: '600'
  },
  hotTextActive: {
    color: '#e53935'
  },
  myButton: {
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14
  },
  myButtonActive: {
    backgroundColor: '#1a73e8'
  },
  myButtonText: {
    color: '#1a73e8',
    fontWeight: '600'
  },
  myButtonTextActive: {
    color: '#fff'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  header: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 6
  },
  nameBlue: {
    color: '#1E88E5'
  },
  remaining: {
    color: '#2e7d32',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 12
  },
  remainingUrgent: {
    color: '#d32f2f',
    backgroundColor: '#ffebee',
    fontWeight: 'bold'
  },
  menuIcon: {
    padding: 6,
    marginLeft: 6
  },
  menuBoxFloating: {
    position: 'absolute',
    right: 10,
    top: 32,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderColor: '#eee',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    zIndex: 10
  },
  menuItem: {
    paddingVertical: 6,
    fontSize: 14
  },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    padding: 20
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10
  },
  optionRow: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8
  },
  optionRowActive: {
    backgroundColor: '#eef3ff'
  },
  optionText: {
    fontSize: 14,
    color: '#333'
  },
  optionRowSpace: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8
  },
  chipRow: {
    flexDirection: 'row',
    marginTop: 6
  },
  chip: {
    backgroundColor: '#eee',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8
  },
  chipActive: {
    backgroundColor: '#1a73e8'
  },
  chipText: {
    color: '#333',
    fontWeight: '600'
  },
  chipTextActive: {
    color: '#fff'
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12
  },
  actionBtn: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700'
  },
  secondaryBtn: {
    backgroundColor: '#f1f3f4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  secondaryBtnText: {
    color: '#333',
    fontWeight: '700'
  },
  hintText: {
    color: '#777',
    fontSize: 12,
    marginTop: 6
  },
  // 狀態標籤樣式
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  footerRow: {
    flexDirection: 'row',
    marginTop: 6,
    marginBottom: 4,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8
  },
  directionHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2
  }
});
