import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import databaseService from '../utils/databaseService';
import apiService from '../utils/apiService';
import { AuthManager } from '../utils/authManager';

export default function HistoryScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('purchased'); // 'purchased' or 'initiated'
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('me');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);

  const parseTimestampValue = (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return null;
      }
      if (value > 0 && value < 1e12) {
        return value * 1000; // 秒轉毫秒
      }
      return value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      if (/^\d+$/.test(trimmed)) {
        const numeric = Number(trimmed);
        if (!Number.isNaN(numeric)) {
          if (numeric > 0 && numeric < 1e12) {
            return numeric * 1000;
          }
          return numeric;
        }
      }
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return null;
  };

  const resolveOrderTimestamp = (order) => {
    if (!order || typeof order !== 'object') {
      return 0;
    }
    const candidates = [
      order.createdAt,
      order.created_at,
      order.created_at_time,
      order.createdAtTime,
      order.created_at_timestamp,
      order.createdAtTimestamp,
      order.created_at_ms,
      order.createdAtMs,
      order.created_at_millis,
      order.createdAtMillis,
      order.timestamp,
      order.created,
      order.createdTime,
      order.completed_at,
      order.completedAt,
      order.updated_at,
      order.updatedAt,
    ];

    let best = null;
    candidates.forEach((candidate) => {
      const parsed = parseTimestampValue(candidate);
      if (parsed !== null) {
        if (best === null || parsed > best) {
          best = parsed;
        }
      }
    });

    if (best !== null) {
      return best;
    }

    const parsedId = parseTimestampValue(order.id);
    if (parsedId !== null) {
      return parsedId;
    }

    return 0;
  };

  // 切換點讚狀態
  const handleToggleLike = async (orderId) => {
    try {
      // 獲取當前用戶
      const currentUser = await AuthManager.getCurrentUser();
      const userId = currentUser?.id || 'me';
      
      if (userId === 'me') {
        console.warn('⚠️ 無法切換點讚狀態：用戶未登入');
        return;
      }
      
      // 調用 API 切換點讚狀態
      const response = await apiService.toggleLike(orderId, userId);
      
      if (response && response.success) {
        // 更新本地狀態
        const updated = orders.map(o => {
          if (o.id === orderId) {
            return { 
              ...o, 
              liked: response.liked, // 當前用戶的點讚狀態
              likeCount: response.like_count || response.likeCount || 0 // 訂單的總點讚數
            };
          }
          return o;
        });
        setOrders(updated);
        
        // 同步更新 AsyncStorage 中的訂單點讚數量
        try {
          const saved = await AsyncStorage.getItem('orders');
          const parsed = saved ? JSON.parse(saved) : [];
          const updatedStorage = parsed.map(o => {
            if (o.id === orderId) {
              return { ...o, like_count: response.like_count || response.likeCount || 0 };
            }
            return o;
          });
          await AsyncStorage.setItem('orders', JSON.stringify(updatedStorage));
        } catch (storageError) {
          console.warn('更新本地點讚狀態失敗:', storageError);
        }
        
        console.log('✅ 點讚狀態已更新:', { orderId, liked: response.liked, likeCount: response.like_count });
      }
    } catch (error) {
      console.error('❌ 切換點讚狀態失敗:', error);
      // 發生錯誤時，仍然更新本地 UI（保持用戶體驗）
      const updated = orders.map(o => {
        if (o.id === orderId) {
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

  const loadOrders = 
  async () => {
    try {
      setLoading(true);
      
      // 獲取當前登入用戶 ID
      const currentUser = await AsyncStorage.getItem('currentUser');
      let userId = 'me';
      if (currentUser) {
        const userData = JSON.parse(currentUser);
        userId = userData.id || 'me';
        setCurrentUserId(userId);
      }
      
      const saved = await AsyncStorage.getItem('orders');
      let parsed = saved ? JSON.parse(saved) : [];
      
      // 去除重複訂單：使用訂單ID作為唯一標識符，保留最後一個
      const orderMap = new Map();
      parsed.forEach(order => {
        if (order && order.id) {
          orderMap.set(order.id, order);
        }
      });
      parsed = Array.from(orderMap.values());
      
      // 從資料庫載入當前用戶的點讚狀態（每個用戶獨立）
      let dbLikes = {};
      try {
        if (userId !== 'me') {
          const userLikes = await apiService.getUserLikes(userId);
          if (Array.isArray(userLikes)) {
            userLikes.forEach(like => {
              if (like && like.order_id && like.liked === true) {
                dbLikes[like.order_id] = true;
              }
            });
          }
        }
      } catch (error) {
        console.log('從資料庫載入點讚狀態失敗:', error.message);
      }
      
      // 載入留言數據
      const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
      
      // 從資料庫載入評價資料（針對參與訂單）
      try {
        if (userId !== 'me') {
          // 為每個訂單載入評價資料
          await Promise.all(parsed.map(async (order) => {
            try {
              const orderComments = await apiService.getCommentsByOrder(order.id);
              if (Array.isArray(orderComments)) {
                // 找到當前用戶的留言
                const userComment = orderComments.find(c => 
                  String(c.commenter_id) === String(userId) || 
                  String(c.commenterId) === String(userId)
                );
                
                // 如果有評價資料，更新到本地 comments
                if (userComment && (userComment.rating || userComment.rating_comment)) {
                  if (!comments[order.id]) {
                    comments[order.id] = [];
                  }
                  // 找到或創建對應的留言記錄
                  let localComment = comments[order.id].find(c => 
                    c.id === userComment.id || 
                    c.commenterId === userId ||
                    c.commenterId === 'me'
                  );
                  
                  if (localComment) {
                    // 更新評價資料
                    localComment.rating = userComment.rating || localComment.rating;
                    localComment.ratingComment = userComment.rating_comment || userComment.ratingComment || localComment.ratingComment;
                  } else {
                    // 如果本地沒有，添加評價資料
                    comments[order.id].push({
                      id: userComment.id,
                      commenterId: userId,
                      rating: userComment.rating,
                      ratingComment: userComment.rating_comment || userComment.ratingComment
                    });
                  }
                }
              }
            } catch (error) {
              // 靜默處理錯誤，不影響主要流程
              console.log(`載入訂單 ${order.id} 的評價資料失敗:`, error.message);
            }
          }));
          
          // 如果有更新，保存到 AsyncStorage
          await AsyncStorage.setItem('comments', JSON.stringify(comments));
        }
      } catch (error) {
        console.log('載入評價資料失敗:', error.message);
      }
      
      // 載入代購者給出的評價（針對發起訂單）
      let purchaserRatings = {}; // { orderId: { rating, comment, targetUserId, commentId } }
      try {
        if (userId !== 'me') {
          // 獲取當前用戶給出的所有評價
          const givenReviews = await apiService.getReviewsGivenByUser(userId);
          if (Array.isArray(givenReviews)) {
            // 篩選出代購者對留言者的評價（is_from_purchaser = true）
            const purchaserReviews = givenReviews.filter(review => 
              review.is_from_purchaser === true || review.isFromPurchaser === true
            );
            
            // 為每個評價建立 orderId 映射
            purchaserReviews.forEach(review => {
              const orderId = review.order_id || review.orderId;
              if (orderId) {
                purchaserRatings[orderId] = {
                  rating: review.rating || review.rating_value,
                  comment: review.comment || review.rating_comment,
                  targetUserId: review.target_user_id || review.targetUserId,
                  commentId: review.comment_id || review.commentId,
                  reviewId: review.id
                };
              }
            });
          }
        }
      } catch (error) {
        console.log('載入代購者評價資料失敗:', error.message);
      }
      
      // 載入已刪除參與訂單的記錄（防止重新載入已刪除的訂單）
      let deletedParticipatedOrders = {};
      try {
        const deletedStorage = await AsyncStorage.getItem('deletedParticipatedOrders');
        if (deletedStorage) {
          deletedParticipatedOrders = JSON.parse(deletedStorage);
        }
      } catch (error) {
        console.log('載入已刪除參與訂單記錄失敗:', error.message);
        deletedParticipatedOrders = {};
      }
      
      // 從資料庫獲取訂單的點讚數量
      const likeCounts = {};
      try {
        // 為每個訂單獲取點讚數量
        await Promise.all(parsed.map(async (order) => {
          try {
            const likeCountResponse = await apiService.getOrderLikeCount(order.id);
            if (likeCountResponse && typeof likeCountResponse.like_count === 'number') {
              likeCounts[order.id] = likeCountResponse.like_count;
            } else {
              likeCounts[order.id] = order.like_count || 0;
            }
          } catch (error) {
            // 如果獲取失敗，使用本地數據
            likeCounts[order.id] = order.like_count || 0;
          }
        }));
      } catch (error) {
        console.warn('從資料庫載入點讚數量失敗，使用本地數據:', error);
        parsed.forEach(order => {
          likeCounts[order.id] = order.like_count || 0;
        });
      }
      
      // 檢查並同步訂單狀態（如果所有已接單的留言者都已完成，更新訂單狀態為completed）
      let ordersUpdated = false;
      parsed = parsed.map(order => {
        const orderComments = comments[order.id] || [];
        const acceptedComments = orderComments.filter(comment => comment.accepted);
        
        // 檢查是否所有已接單的留言者都已完成
        const allCompleted = acceptedComments.length > 0 && 
          acceptedComments.every(comment => 
            comment.deliveryStatus === 'completed' || comment.status === 'completed'
          );
        
        // 如果所有已接單的留言都已完成，且訂單狀態不是completed，則更新
        if (allCompleted && order.status !== 'completed') {
          ordersUpdated = true;
          console.log('同步訂單狀態:', {
            orderId: order.id,
            orderName: order.name,
            oldStatus: order.status,
            acceptedCommentsCount: acceptedComments.length
          });
          return {
            ...order,
            status: 'completed',
            completedAt: order.completedAt || Date.now()
          };
        }
        return order;
      });
      
      // 如果有訂單狀態被更新，保存到AsyncStorage
      if (ordersUpdated) {
        await AsyncStorage.setItem('orders', JSON.stringify(parsed));
        console.log('已同步訂單狀態');
      }
      
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

      // 檢查訂單是否應標記為"時間內未發起成功"
      const shouldMarkAsFailed = (order) => {
        // 如果訂單狀態是已完成，不應該標記為失敗
        if (order.status === 'completed') {
          return false;
        }
        
        const now = Date.now();
        
        // 獲取訂單的截止時間
        const expiresAt = order.expiresAt || order.expires_at || order.expires;
        
        // 如果沒有截止時間，不需要標記
        if (!expiresAt) {
          return false;
        }
        
        // 如果訂單已過期
        if (expiresAt < now) {
          // 檢查是否有接單或配送動作
          const hasAction = hasOrderAction(order);
          
          // 如果已過期且沒有接單/配送動作，則標記為失敗
          return !hasAction;
        }
        
        return false;
      };

      // 合併數據，包括參與者狀態（確保每個訂單只處理一次）
      let ordersToUpdate = []; // 記錄需要更新狀態的訂單

      const creatorNameCache = {};
      const creatorIdsToResolve = new Set();

      parsed.forEach(order => {
        const rawCreatorId = order?.created_by ?? order?.createdBy ?? null;
        const normalizedCreatorId = typeof rawCreatorId === 'string'
          ? rawCreatorId.trim()
          : rawCreatorId !== null && rawCreatorId !== undefined
            ? String(rawCreatorId).trim()
            : null;

        if (!normalizedCreatorId || normalizedCreatorId === '' || normalizedCreatorId === 'me' || normalizedCreatorId === String(userId)) {
          return;
        }

        const existingNameCandidate = [
          order?.creatorName,
          order?.createdByName,
          order?.ownerName,
          order?.createdByUser,
          order?.createdByUserName
        ].find(nameCandidate => typeof nameCandidate === 'string' && nameCandidate.trim().length > 0);

        if (existingNameCandidate) {
          creatorNameCache[normalizedCreatorId] = existingNameCandidate.trim();
        } else {
          creatorIdsToResolve.add(normalizedCreatorId);
        }
      });

      for (const creatorId of creatorIdsToResolve) {
        let resolvedName = null;
        const cacheKey = `user_${creatorId}`;

        try {
          const cachedProfileRaw = await AsyncStorage.getItem(cacheKey);
          if (cachedProfileRaw) {
            const cachedProfile = JSON.parse(cachedProfileRaw);
            if (cachedProfile?.name) {
              resolvedName = String(cachedProfile.name).trim();
            }
          }
        } catch (cacheError) {
          console.log('讀取用戶快取失敗（略過不中斷流程）:', cacheError?.message || cacheError);
        }

        if (!resolvedName && typeof databaseService.getUser === 'function') {
          try {
            const userRecord = await databaseService.getUser(creatorId);
            if (userRecord?.name) {
              resolvedName = String(userRecord.name).trim();
              try {
                await AsyncStorage.setItem(cacheKey, JSON.stringify(userRecord));
              } catch (storeError) {
                console.log('寫入用戶快取失敗（略過不中斷流程）:', storeError?.message || storeError);
              }
            }
          } catch (dbUserError) {
            console.log('透過資料庫服務取得用戶失敗（略過不中斷流程）:', dbUserError?.message || dbUserError);
          }
        }

        if (resolvedName) {
          creatorNameCache[creatorId] = resolvedName;
        }
      }
      
      const enrichedOrders = parsed.map(order => {
        const orderComments = comments[order.id] || [];
        
        // 找出當前用戶的留言狀態（檢查各種可能的標識方式，包括評價資料）
        let userComment = orderComments.find(comment => 
          comment.commenterId === 'me' ||
          comment.actualUserId === 'me' ||
          (typeof comment.commenterId === 'string' && comment.commenterId.startsWith('me_')) ||
          String(comment.commenterId) === String(userId) ||
          String(comment.commenter_id) === String(userId)
        );
        
        // 找出當前用戶的參與者記錄（同時檢查 'me' 和當前用戶ID）
        const userJoiner = order.joiners?.find(joiner => 
          joiner.userId === 'me' || joiner.userId === userId
        );
        
        // 確定參與狀態
        let participationStatus = 'none';
        if (userComment?.accepted) {
          participationStatus = userComment.deliveryStatus || 'accepted';
        } else if (userJoiner?.status === 'accepted') {
          participationStatus = 'accepted';
        }
        
        // 檢查是否應該標記為失敗（已完成訂單不應該標記為失敗）
        const isFailed = shouldMarkAsFailed(order);
        
        // 如果訂單被標記為失敗且狀態不是 'expired' 且不是 'completed'，需要更新狀態
        if (isFailed && order.status !== 'expired' && order.status !== 'completed') {
          ordersToUpdate.push({ id: order.id, status: 'expired' });
        }
        
        const creatorIdRaw = order?.created_by ?? order?.createdBy ?? null;
        const normalizedCreatorId = typeof creatorIdRaw === 'string'
          ? creatorIdRaw.trim()
          : creatorIdRaw !== null && creatorIdRaw !== undefined
            ? String(creatorIdRaw).trim()
            : null;

        const resolvedCreatorName =
          (typeof order?.creatorName === 'string' && order.creatorName.trim().length > 0 && order.creatorName.trim()) ||
          (typeof order?.createdByName === 'string' && order.createdByName.trim().length > 0 && order.createdByName.trim()) ||
          (typeof order?.ownerName === 'string' && order.ownerName.trim().length > 0 && order.ownerName.trim()) ||
          (typeof order?.createdByUser === 'string' && order.createdByUser.trim().length > 0 && order.createdByUser.trim()) ||
          (typeof order?.createdByUserName === 'string' && order.createdByUserName.trim().length > 0 && order.createdByUserName.trim()) ||
          (normalizedCreatorId ? creatorNameCache[normalizedCreatorId] : null) ||
          null;

        return {
          ...order,
          liked: dbLikes[order.id] === true, // 從資料庫獲取當前用戶的點讚狀態
          likeCount: likeCounts[order.id] || 0, // 訂單的總點讚數（所有用戶累積）
          comments: orderComments.length || order.comments || 0,
          participationStatus,
          userComment,
          userJoiner,
          // 添加標記表示用戶是否真的參與了
          hasMyComment: !!userComment,
          hasMyJoiner: !!userJoiner,
          // 添加標記表示是否已從參與訂單中刪除
          isDeletedParticipated: deletedParticipatedOrders[order.id] === true,
          // 添加標記表示是否在時間內未發起成功
          isFailed: isFailed,
          creatorResolvedName: resolvedCreatorName,
          // 代購者對留言者的評價資料（僅針對發起訂單）
          purchaserRating: purchaserRatings[order.id] || null,
          // 如果被標記為失敗且狀態不是已完成，更新狀態為 expired
          // 已完成訂單即使過期也應該保持 completed 狀態
          status: (isFailed && order.status !== 'completed') ? 'expired' : order.status
        };
      });
      
      // 批量更新訂單狀態為 expired（非阻塞，不影響主要流程）
      if (ordersToUpdate.length > 0) {
        // 先更新本地訂單狀態（同步操作，確保狀態一致性）
        const updatedParsed = [...parsed];
        ordersToUpdate.forEach(({ id, status }) => {
          const index = updatedParsed.findIndex(o => o.id === id);
          if (index !== -1) {
            updatedParsed[index] = { ...updatedParsed[index], status };
          }
        });
        
        // 保存更新後的訂單列表
        AsyncStorage.setItem('orders', JSON.stringify(updatedParsed)).catch(() => {
          // 靜默處理錯誤
        });
        
        // 嘗試同步到資料庫（非阻塞，不影響主要流程）
        Promise.all(ordersToUpdate.map(async ({ id, status }) => {
          try {
            await databaseService.updateOrder(id, { status });
            console.log(`訂單 ${id} 狀態已更新為 expired（資料庫）`);
          } catch (dbError) {
            // 檢查是否為可忽略的錯誤（404, 400, 500 可能是資料庫 ENUM 未更新）
            const errorMessage = dbError.message || '';
            const isIgnorable = dbError.status === 404 || 
                                dbError.status === 400 ||
                                dbError.status === 500 ||
                                errorMessage.includes('404') || 
                                errorMessage.includes('HTTP error! status: 404') ||
                                errorMessage.includes('HTTP error! status: 400') ||
                                errorMessage.includes('HTTP error! status: 500') ||
                                errorMessage.includes('訂單不存在') ||
                                errorMessage.includes('訂單狀態無效') ||
                                errorMessage.includes('Network request failed');
            
            // 如果是可忽略的錯誤，靜默處理（不記錄）
            // 404: 訂單不存在於資料庫
            // 400/500: 可能是資料庫 ENUM 未更新，不影響本地功能
            if (!isIgnorable) {
              // 只有真正的錯誤才記錄
              console.log(`更新訂單 ${id} 狀態失敗（資料庫）:`, dbError.message);
            }
          }
        })).catch(() => {
          // 靜默處理錯誤
        });
      }
    
    const sortedOrders = [...enrichedOrders].sort(
      (a, b) => resolveOrderTimestamp(b) - resolveOrderTimestamp(a)
    );

    setOrders(sortedOrders);
    console.log('載入訂單:', sortedOrders.length, '筆');
    console.log('當前用戶 ID:', userId);
    
    // 調試：打印參與訂單的過濾信息
    const participatedOrders = sortedOrders.filter(order => order.hasMyComment || order.hasMyJoiner);
    console.log('參與訂單數量:', participatedOrders.length);
    if (participatedOrders.length > 0) {
      console.log('參與訂單詳情:', participatedOrders.map(o => ({
        orderName: o.name,
        hasMyComment: o.hasMyComment,
        hasMyJoiner: o.hasMyJoiner,
        userCommentAccepted: o.userComment?.accepted,
        userJoinerStatus: o.userJoiner?.status
      })));
    }
    } catch (error) {
      console.error('載入訂單失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // 每次進入頁面時重新載入數據
  useFocusEffect(
    React.useCallback(() => {
      console.log('訂單頁面獲得焦點，重新載入數據');
      loadOrders();
    }, [])
  );

  // 狀態輔助函數
  const getStatusText = (status, isFailed) => {
    // 優先檢查訂單狀態，如果已完成則顯示"已完成"
    if (status === 'completed') {
      return '已完成';
    }
    
    // 如果訂單被標記為失敗，顯示"已過期"
    if (isFailed) {
      return '已過期';
    }
    
    switch (status) {
      case 'preparing':
        return '準備中';
      case 'delivering':
        return '配送中';
      case 'arrived':
        return '已到貨';
      case 'expired':
        return '已過期';
      default:
        return '準備中';
    }
  };

  const getStatusColor = (status, isFailed) => {
    // 優先檢查訂單狀態，如果已完成則使用灰色
    if (status === 'completed') {
      return '#8e8e93';
    }
    
    // 如果訂單被標記為失敗，使用紅色
    if (isFailed) {
      return '#ff4444';
    }
    
    switch (status) {
      case 'preparing':
        return '#007aff';
      case 'delivering':
        return '#ff9500';
      case 'arrived':
        return '#34c759';
      case 'expired':
        return '#ff4444';
      default:
        return '#007aff';
    }
  };

  // 根據標籤篩選訂單
  const getFilteredOrders = () => {
    if (activeTab === 'initiated') {
      // 發起紀錄：自己創建的代購（包括已完成的）
      // 只顯示當前用戶發起的訂單
      // isFailed 標記已在 loadOrders 中設置
      const filteredOrders = orders.filter(order => {
        // 支援多種可能的欄位名稱，並確保字符串一致性
        const orderCreatorId = String(order.created_by || order.createdBy || '');
        const myUserId = String(currentUserId || 'me');
        
        // 檢查是否為當前用戶創建的訂單
        const isMyOrder = orderCreatorId === myUserId || 
                         orderCreatorId === 'me' ||
                         myUserId === 'me';
        
        // 添加調試日誌
        if (!isMyOrder && orders.length > 0) {
          console.log('過濾掉非當前用戶的訂單:', {
            orderName: order.name,
            orderCreatorId: orderCreatorId,
            myUserId: myUserId,
            isMyOrder: isMyOrder
          });
        }
        
        return isMyOrder;
      });
      
      console.log('發起訂單篩選結果:', {
        totalOrders: orders.length,
        myOrders: filteredOrders.length,
        currentUserId: currentUserId
      });
      
      return filteredOrders;
    } else {
      // 參與訂單：參加過的代購（有加入記錄的，包括已完成的）
      // 重要：排除自己發起的訂單，並使用去重邏輯
      const filtered = orders.filter(order => {
        // 首先排除已標記為已刪除參與的訂單（防止重新載入時再次顯示）
        if (order.isDeletedParticipated === true) {
          return false;
        }
        
        // 排除自己發起的訂單
        const isMyOrder = order.created_by === currentUserId || 
                         order.createdBy === currentUserId || 
                         order.createdBy === 'me' ||
                         order.created_by === 'me';
        if (isMyOrder) {
          return false;
        }
        
        // 檢查是否有參與記錄
        const hasJoinRecord = order.joinedBy === 'me' || 
          (order.joiners && order.joiners.some(joiner => joiner.userId === 'me' || joiner.userId === currentUserId));
        
        // 檢查是否有已接單的留言
        const hasAcceptedComment = order.userComment && order.userComment.accepted;
        
        // 使用載入時設置的標記（更可靠）
        const hasMyComment = order.hasMyComment === true;
        const hasMyJoiner = order.hasMyJoiner === true;
        
        // 只要有參與記錄就顯示（不要求必須有留言）
        // 如果用戶參與了訂單（有 joiners 記錄），即使沒有留言也應該顯示
        return hasJoinRecord || hasAcceptedComment || hasMyComment || hasMyJoiner;
      });
      
      // 去重：使用訂單ID作為唯一標識符，確保每個訂單只出現一次
      const uniqueOrders = [];
      const seenIds = new Set();
      
      filtered.forEach(order => {
        if (order && order.id && !seenIds.has(order.id)) {
          seenIds.add(order.id);
          uniqueOrders.push(order);
        }
      });
      
      return uniqueOrders;
    }
  };

  // 格式化時間
  const formatTime = (order) => {
    // 支援多種時間欄位名稱
    const timestamp = order.createdAt || order.created_at || order.timestamp || null;
    
    if (!timestamp) return '時間不明';
    
    const date = new Date(timestamp);
    // 檢查日期是否有效
    if (isNaN(date.getTime())) return '時間不明';
    
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}週前`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}個月前`;
    return `${Math.floor(diffDays / 365)}年前`;
  };

  // 切換選擇模式
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedOrders([]);
  };

  // 切換訂單選擇狀態
  const toggleOrderSelection = (orderId) => {
    if (selectedOrders.includes(orderId)) {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId));
    } else {
      setSelectedOrders([...selectedOrders, orderId]);
    }
  };

  // 批量刪除選中的訂單
  const handleBatchDelete = async () => {
    if (selectedOrders.length === 0) {
      Alert.alert('沒有選擇', '請選擇要刪除的訂單');
      return;
    }

    const filteredList = getFilteredOrders();
    
    Alert.alert(
      '批量刪除',
      `確定要刪除選中的 ${selectedOrders.length} 筆訂單嗎？`,
      [
        {
          text: '取消',
          style: 'cancel'
        },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            try {
              // 批量刪除選中的訂單
              for (const orderId of selectedOrders) {
                const order = filteredList.find(o => o.id === orderId);
                if (order) {
                  await deleteParticipatedOrder(order);
                }
              }

              // 清除選擇
              setSelectedOrders([]);
              setIsSelectionMode(false);

              Alert.alert('刪除成功', `已成功刪除 ${selectedOrders.length} 筆訂單`);
              
              // 重新載入
              await loadOrders();
            } catch (error) {
              console.error('批量刪除失敗:', error);
              Alert.alert('刪除失敗', '請稍後再試');
            }
          }
        }
      ]
    );
  };

  // 刪除參與訂單（實際執行刪除的函數）
  const deleteParticipatedOrder = async (order) => {
    // 標記訂單為已刪除參與（防止重新載入時再次顯示）
    try {
      let deletedParticipatedOrders = {};
      const deletedStorage = await AsyncStorage.getItem('deletedParticipatedOrders');
      if (deletedStorage) {
        deletedParticipatedOrders = JSON.parse(deletedStorage);
      }
      deletedParticipatedOrders[order.id] = true;
      await AsyncStorage.setItem('deletedParticipatedOrders', JSON.stringify(deletedParticipatedOrders));
      console.log('已標記訂單為已刪除參與:', order.id);
    } catch (error) {
      console.error('標記已刪除參與訂單失敗:', error);
    }

    // 從留言記錄中刪除用戶對該訂單的留言
    const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
    let commentsChanged = false;
    
    if (comments[order.id]) {
      // 過濾掉當前用戶的留言
      const orderComments = comments[order.id] || [];
      const beforeCount = orderComments.length;
      const filteredComments = orderComments.filter(comment => comment.commenterId !== 'me');
      const afterCount = filteredComments.length;
      
      if (beforeCount !== afterCount) {
        commentsChanged = true;
        if (filteredComments.length > 0) {
          comments[order.id] = filteredComments;
        } else {
          // 如果沒有其他留言了，刪除整個訂單的留言記錄
          delete comments[order.id];
        }
      }
    }

    if (commentsChanged) {
      await AsyncStorage.setItem('comments', JSON.stringify(comments));
    }

    // 從訂單的參與者列表中移除當前用戶
    const storedOrders = JSON.parse(await AsyncStorage.getItem('orders')) || [];
    let ordersChanged = false;
    
    const updatedOrders = storedOrders.map(o => {
      if (o.id === order.id) {
        // 移除當前用戶從訂單的參與者列表
        const updatedJoiners = o.joiners?.filter(joiner => joiner.userId !== 'me') || [];
        const hasChanges = updatedJoiners.length !== (o.joiners?.length || 0);
        
        if (hasChanges) {
          ordersChanged = true;
        }
        
        return {
          ...o,
          joiners: updatedJoiners,
          joined: Math.max(0, (o.joined || 0) - (hasChanges ? 1 : 0))
        };
      }
      return o;
    });
    
    if (ordersChanged) {
      await AsyncStorage.setItem('orders', JSON.stringify(updatedOrders));
    }

    // 注意：刪除參與訂單不應調用後端刪除訂單API
    // 因為這只是從用戶的參與記錄中移除，而不是刪除整個訂單
    // 訂單本身仍然存在，其他參與者仍然可以看到
    console.log('用戶已從參與訂單中移除:', order.id);
  };

  // 刪除參與訂單（帶確認對話框）
  const handleDeleteParticipatedOrder = async (order) => {
    Alert.alert(
      '刪除參與訂單',
      `確定要從「參與訂單」中移除此訂單嗎？\n\n此操作將：\n• 將訂單從您的參與列表移除\n• 刪除相關的留言記錄\n\n注意：此操作不會影響訂單發起者和其他參與者。`,
      [
        {
          text: '取消',
          style: 'cancel'
        },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            try {
              // 調用實際刪除函數
              await deleteParticipatedOrder(order);

              // 清除選擇模式
              setSelectedOrders([]);
              setIsSelectionMode(false);

              // 重新載入訂單列表
              await loadOrders();

              Alert.alert('刪除成功', '訂單已從「參與訂單」中移除');
            } catch (error) {
              console.error('刪除參與訂單失敗:', error);
              Alert.alert('刪除失敗', '請稍後再試');
            }
          }
        }
      ]
    );
  };

  // 前往評價畫面（留言者評價代購者）
  const openParticipatedOrderReview = async (order) => {
    if (!order) {
      return;
    }

    try {
      const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
      const orderComments = comments[order.id] || [];

      const commentMatch = orderComments.find(comment =>
        comment.id === order.userComment?.id ||
        comment.commenterId === order.userComment?.commenterId ||
        comment.commenterId === 'me' ||
        (currentUserId && comment.commenterId === currentUserId)
      );

      const commenterInfo = commentMatch ? {
        commenterId: commentMatch.commenterId || 'me',
        commenterName: commentMatch.commenterName || commentMatch.user || '我',
        name: commentMatch.commenterName || commentMatch.user || '我',
        id: commentMatch.id,
        originalCommentId: commentMatch.id,
      } : {
        commenterId: currentUserId || 'me',
        commenterName: '我',
        name: '我',
        id: order.userComment?.id || order.userJoiner?.comment_id || `${order.id}_me`,
        originalCommentId: order.userComment?.id || order.userJoiner?.comment_id || `${order.id}_me`,
      };

      navigation.navigate('OrderRating', {
        orderInfo: order,
        commenterInfo,
        isFromPurchaser: false,
      });
    } catch (error) {
      console.error('開啟評價頁面失敗:', error);
      Alert.alert('操作失敗', '無法開啟評價頁面，請稍後再試');
    }
  };

  // 前往評價畫面（代購者評價留言者）
  const openPurchaserReview = async (order) => {
    if (!order) {
      return;
    }

    try {
      // 獲取訂單的留言列表
      const comments = await apiService.getCommentsByOrder(order.id);
      if (!Array.isArray(comments) || comments.length === 0) {
        Alert.alert('提示', '此訂單暫無留言記錄');
        return;
      }

      // 找到第一個已接單的留言者（或使用評價資料中的 commentId）
      const purchaserRating = order.purchaserRating;
      let commenterInfo = null;

      if (purchaserRating && purchaserRating.commentId) {
        // 如果有評價資料，使用評價中的 commentId
        const commentMatch = comments.find(c => c.id === purchaserRating.commentId);
        if (commentMatch) {
          commenterInfo = {
            commenterId: commentMatch.commenter_id || commentMatch.commenterId,
            commenterName: commentMatch.commenter_name || commentMatch.commenterName || '留言者',
            name: commentMatch.commenter_name || commentMatch.commenterName || '留言者',
            id: commentMatch.id,
            originalCommentId: commentMatch.id,
          };
        }
      }

      // 如果沒有找到，使用第一個已接單的留言
      if (!commenterInfo) {
        const acceptedComment = comments.find(c => c.accepted === true && !c.is_reply);
        if (acceptedComment) {
          commenterInfo = {
            commenterId: acceptedComment.commenter_id || acceptedComment.commenterId,
            commenterName: acceptedComment.commenter_name || acceptedComment.commenterName || '留言者',
            name: acceptedComment.commenter_name || acceptedComment.commenterName || '留言者',
            id: acceptedComment.id,
            originalCommentId: acceptedComment.id,
          };
        } else {
          // 如果沒有已接單的留言，使用第一個留言
          const firstComment = comments.find(c => !c.is_reply);
          if (firstComment) {
            commenterInfo = {
              commenterId: firstComment.commenter_id || firstComment.commenterId,
              commenterName: firstComment.commenter_name || firstComment.commenterName || '留言者',
              name: firstComment.commenter_name || firstComment.commenterName || '留言者',
              id: firstComment.id,
              originalCommentId: firstComment.id,
            };
          }
        }
      }

      if (!commenterInfo) {
        Alert.alert('提示', '無法找到留言者資訊');
        return;
      }

      navigation.navigate('OrderRating', {
        orderInfo: order,
        commenterInfo,
        isFromPurchaser: true, // 代購者評價留言者
      });
    } catch (error) {
      console.error('開啟評價頁面失敗:', error);
      Alert.alert('操作失敗', '無法開啟評價頁面，請稍後再試');
    }
  };

  // 渲染訂單項目
  const renderOrderItem = ({ item }) => {
    const ratingValueRaw = item?.userComment?.rating || item?.userComment?.rating_value;
    const userRatingValue = ratingValueRaw !== undefined && ratingValueRaw !== null ? Number(ratingValueRaw) : NaN;
    const ratingComment = (item?.userComment?.ratingComment || item?.userComment?.rating_comment || '').trim();
    // 判斷是否有評價：有評分（>0）或有評論內容都算已完成評價
    const hasReview = (!Number.isNaN(userRatingValue) && userRatingValue > 0) || ratingComment.length > 0;
    const canRate = item?.status === 'completed';
    
    // 代購者對留言者的評價（僅針對發起訂單）
    const purchaserRating = item?.purchaserRating;
    const purchaserRatingValue = purchaserRating?.rating ? Number(purchaserRating.rating) : NaN;
    const purchaserRatingComment = (purchaserRating?.comment || '').trim();
    const hasPurchaserReview = (!Number.isNaN(purchaserRatingValue) && purchaserRatingValue > 0) || purchaserRatingComment.length > 0;

    return (
      <TouchableOpacity 
        style={[
          styles.orderCard,
          isSelectionMode && activeTab === 'purchased' && selectedOrders.includes(item.id) && styles.selectedCard
        ]}
        onPress={() => {
          if (isSelectionMode && activeTab === 'purchased') {
            toggleOrderSelection(item.id);
          } else if (activeTab === 'purchased') {
            // 參與訂單：導航到訂單詳情頁面
            navigation.navigate('ParticipatedOrderDetail', {
              orderId: item.id,
              order: item
            });
          }
        }}
      >
        {isSelectionMode && activeTab === 'purchased' && (
          <View style={styles.checkboxContainer}>
            <Ionicons 
              name={selectedOrders.includes(item.id) ? 'checkbox' : 'checkbox-outline'} 
              size={24} 
              color={selectedOrders.includes(item.id) ? '#ff6b35' : '#ccc'} 
            />
          </View>
        )}
        <View style={styles.orderHeader}>
          <View style={styles.userInfo}>
            <FontAwesome name="user-circle-o" size={20} color="#6BA4FF" />
            <Text style={styles.userName}>
              {(() => {
                const creatorId = item.created_by || item.createdBy;

                if (creatorId === currentUserId || creatorId === 'me') {
                  return '我';
                }

                if (item.creatorResolvedName && String(item.creatorResolvedName).trim()) {
                  return String(item.creatorResolvedName).trim();
                }
                if (item.creatorName && String(item.creatorName).trim()) {
                  return String(item.creatorName).trim();
                }
                if (item.createdByName && String(item.createdByName).trim()) {
                  return String(item.createdByName).trim();
                }
                if (item.ownerName && String(item.ownerName).trim()) {
                  return String(item.ownerName).trim();
                }
                if (item.createdByUser && String(item.createdByUser).trim()) {
                  return String(item.createdByUser).trim();
                }
                if (item.createdByUserName && String(item.createdByUserName).trim()) {
                  return String(item.createdByUserName).trim();
                }

                return '代購者';
              })()} {item.name}
            </Text>
          </View>
          <Text style={styles.timeText}>{formatTime(item)}</Text>
        </View>

        <View style={styles.orderDetails}>
          <Text style={styles.detailText}>
            當前地點：{item.address} {item.limit && `(${item.limit})`}
          </Text>
          <Text style={styles.detailText}>
            聯絡方式：{item.phone || item.contact}
          </Text>
          <Text style={styles.detailText}>
            Line ID：{item.line || 'xxxxxx'}
          </Text>
          <Text style={styles.detailText}>
            付款方式：{item.method || item.payment}
          </Text>
          {/* 代購者上傳的明細與金額（若有）- 只在發起訂單標籤顯示 */}
          {activeTab === 'initiated' && (item.item_price || item.itemPrice) && (
            <Text style={styles.detailText}>
              商品金額：${item.item_price || item.itemPrice}
            </Text>
          )}
          { (item.detail_image || item.detailImage) && (
            <Text style={[styles.detailText, { fontStyle: 'italic', color: '#555' }]}>
              已上傳明細照片（由代購者提供）
            </Text>
          )}
          {item.status && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusLabel}>狀態：</Text>
              <Text style={[styles.statusText, { color: getStatusColor(item.status, item.isFailed) }]}>
                {getStatusText(item.status, item.isFailed)}
              </Text>
            </View>
          )}
          
          {/* 顯示"時間內未發起成功"標記（已完成訂單不顯示此標記） */}
          {item.isFailed && item.status !== 'completed' && (
            <View style={styles.failedStatusContainer}>
              <Ionicons name="close-circle" size={16} color="#ff4444" />
              <Text style={styles.failedStatusText}>訂單未成立</Text>
            </View>
          )}
          
        </View>

        <View style={styles.orderFooter}>
          <View style={styles.statsRow}>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={async () => {
                if (isSelectionMode && activeTab === 'purchased') {
                  return; // 選擇模式下不處理點讚
                }
                await handleToggleLike(item.id);
              }}
            >
              <Ionicons 
                name={item.liked ? 'heart' : 'heart-outline'} 
                size={16} 
                color={item.liked ? '#e53935' : '#666'} 
              />
              <Text style={styles.statText}>{item.likeCount || (item.liked ? 1 : 0)}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => {
                if (isSelectionMode && activeTab === 'purchased') {
                  toggleOrderSelection(item.id);
                  return;
                }
                if (activeTab === 'initiated') {
                  // 發起訂單：直接進入留言詳情（可以忽略留言）
                  navigation.navigate('Message', { 
                    orderId: item.id, 
                    onCommentUpdate: () => loadOrders(),
                    orderName: item.name,
                    orderLocation: item.address,
                    orderContact: item.phone || item.contact,
                    orderLine: item.line,
                    orderPayment: item.method || item.payment,
                    orderNote: item.limit || item.note
                  });
                } else {
                  // 參與訂單：進入一般留言頁面
                  navigation.navigate('Message', { 
                    orderId: item.id, 
                    onCommentUpdate: () => loadOrders() 
                  });
                }
              }}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#666" />
              <Text style={styles.statText}>{item.comments}</Text>
            </TouchableOpacity>
            
          </View>

          <View style={styles.actionButtons}>
            {!isSelectionMode && activeTab === 'purchased' && (
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={() => handleDeleteParticipatedOrder(item)}
              >
                <Ionicons name="trash-outline" size={16} color="#f44336" />
                <Text style={styles.deleteButtonText}>刪除</Text>
              </TouchableOpacity>
            )}
            
            {activeTab === 'initiated' && (
              <TouchableOpacity 
                style={styles.moreButton}
                onPress={() => navigation.navigate('OrderManagement', { 
                  order: item,
                  orderId: item.id 
                })}
              >
                <Text style={styles.moreButtonText}>
                  {item.status === 'completed' ? '查看' : '查看訂單管理'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {activeTab === 'purchased' && (
          <View style={styles.reviewSection}>
            {canRate && !hasReview && (
              <Text style={styles.reviewReminderText}>
                訂單已完成，記得評價代購者
              </Text>
            )}
            <TouchableOpacity
              style={[
                styles.reviewButton,
                (!canRate || isSelectionMode) && styles.reviewButtonDisabled
              ]}
              disabled={!canRate || isSelectionMode}
              onPress={() => openParticipatedOrderReview(item)}
            >
              <Text style={styles.reviewButtonText}>
                {canRate ? (hasReview ? '查看評價' : '前往評價') : '待訂單完成'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'initiated' && hasPurchaserReview && (
          <View style={styles.reviewSection}>
            <View style={styles.reviewInfo}>
              <MaterialIcons
                name="star-rate"
                size={22}
                color="#FFD700"
              />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.reviewTitle}>我對留言者的評價（{!Number.isNaN(purchaserRatingValue) ? purchaserRatingValue.toFixed(1) : 'N/A'}★）</Text>
                {purchaserRatingComment ? (
                  <Text style={styles.reviewText} numberOfLines={2}>
                    {purchaserRatingComment}
                  </Text>
                ) : (
                  <Text style={styles.reviewTextMuted}>尚未填寫評論內容</Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={styles.reviewButton}
              onPress={() => openPurchaserReview(item)}
            >
              <Text style={styles.reviewButtonText}>查看評價</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* 頂部標題 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>我的訂單</Text>
        {activeTab === 'purchased' && (
          <TouchableOpacity 
            style={styles.batchButton}
            onPress={toggleSelectionMode}
          >
            <Text style={styles.batchButtonText}>
              {isSelectionMode ? '取消選擇' : '批量刪除'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 批量操作欄 */}
      {isSelectionMode && activeTab === 'purchased' && (
        <View style={styles.batchActionBar}>
          <Text style={styles.batchInfo}>
            已選擇 {selectedOrders.length} 項
          </Text>
          <TouchableOpacity 
            style={[
              styles.batchDeleteButton,
              selectedOrders.length === 0 && styles.batchDeleteButtonDisabled
            ]}
            onPress={handleBatchDelete}
            disabled={selectedOrders.length === 0}
          >
            <Ionicons name="trash" size={18} color="#fff" />
            <Text style={styles.batchDeleteButtonText}>批量刪除</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 標籤切換 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'purchased' && styles.activeTab]}
          onPress={() => {
            setActiveTab('purchased');
            setIsSelectionMode(false);
            setSelectedOrders([]);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'purchased' && styles.activeTabText]}>
            參與訂單
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'initiated' && styles.activeTab]}
          onPress={() => {
            setActiveTab('initiated');
            setIsSelectionMode(false);
            setSelectedOrders([]);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'initiated' && styles.activeTabText]}>
            發起訂單
          </Text>
        </TouchableOpacity>
      </View>

      {/* 訂單列表 */}
      <FlatList
        data={getFilteredOrders()}
        keyExtractor={(item) => item.id}
        renderItem={renderOrderItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>
              {activeTab === 'initiated' ? '還沒有發起過訂單' : '還沒有參與過訂單'}
            </Text>
          </View>
        }
        refreshing={loading}
        onRefresh={loadOrders}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  batchButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ff6b35',
    borderRadius: 20,
  },
  batchButtonText: {
    color: '#ff6b35',
    fontSize: 14,
    fontWeight: '600',
  },
  batchActionBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  batchInfo: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  batchDeleteButton: {
    backgroundColor: '#f44336',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  batchDeleteButtonDisabled: {
    backgroundColor: '#ccc',
  },
  batchDeleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  checkboxContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  selectedCard: {
    backgroundColor: '#fff5f0',
    borderWidth: 2,
    borderColor: '#ff6b35',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  activeTab: {
    backgroundColor: '#ff6b35',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  listContainer: {
    padding: 20,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  orderDetails: {
    marginBottom: 16,
  },
  detailText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
    lineHeight: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    padding: 6,
    backgroundColor: '#f8f9fa',
    borderRadius: 6
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 6
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600'
  },
  failedStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fff5f5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffcccc'
  },
  failedStatusText: {
    fontSize: 14,
    color: '#ff4444',
    fontWeight: '600',
    marginLeft: 6
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f44336',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  deleteButtonText: {
    color: '#f44336',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  moreButton: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  moreButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reviewSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  reviewInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  reviewText: {
    fontSize: 13,
    color: '#555',
    marginTop: 4,
    lineHeight: 18,
  },
  reviewTextMuted: {
    fontSize: 13,
    color: '#999',
  },
  reviewButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#ff6b35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  reviewButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  reviewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reviewReminderText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
});
