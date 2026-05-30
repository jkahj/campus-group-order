import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  FlatList,
  Dimensions,
  Platform,
  Modal,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import databaseService from '../utils/databaseService';
import apiService from '../utils/apiService';
import AuthManager from '../utils/authManager';
import { getUserCreditScore, getUserTier } from '../utils/creditScoreManager';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

// 獲取螢幕尺寸
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;
const isLargeScreen = screenWidth > 414;

export default function OrderManagementScreen({ navigation, route }) {
  const { order } = route.params || {};
  const [orderData, setOrderData] = useState(order);
  const [commenters, setCommenters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userReviews, setUserReviews] = useState({});
  const [showIgnoreModal, setShowIgnoreModal] = useState(false);
  const [ignoreReason, setIgnoreReason] = useState('');
  const [currentIgnoreCommenter, setCurrentIgnoreCommenter] = useState(null);
  const [orderItemPrice, setOrderItemPrice] = useState(
    order?.item_price != null ? String(order.item_price) : order?.itemPrice != null ? String(order.itemPrice) : ''
  );
  const [orderDetailImage, setOrderDetailImage] = useState(order?.detail_image || order?.detailImage || null);
  const [priceInputs, setPriceInputs] = useState({}); // 舊格式：單一商品金額
  const [itemPriceInputs, setItemPriceInputs] = useState({}); // 新格式：每個商品的單價 { commenterId: { itemIndex: price } }
  const [detailInputs, setDetailInputs] = useState({});
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [savedItemPrices, setSavedItemPrices] = useState({}); // 追蹤每個留言者的金額是否已儲存 { commenterId: true/false }
  

  useEffect(() => {
    if (order) {
      setOrderData(order);
      loadCommenters();
      loadUserReviews();
    }
  }, [order]);

  // 當頁面獲得焦點時重新載入評價資料（確保評價完成後能正確顯示）
  useFocusEffect(
    React.useCallback(() => {
      if (order) {
        loadUserReviews();
      }
    }, [order])
  );

  // 載入用戶評價資料（從資料庫和本地）
  const loadUserReviews = async () => {
    try {
      // 從本地載入作為初始值
      const localReviews = JSON.parse(await AsyncStorage.getItem('userReviews')) || {};
      
      // 優先從資料庫載入代購者給出的評價
      try {
        const currentUser = await AuthManager.getCurrentUser();
        const userId = currentUser?.id;
        
        if (userId && userId !== 'me') {
          // 從後端載入代購者給出的評價
          const givenReviews = await apiService.getReviewsGivenByUser(userId);
          if (Array.isArray(givenReviews)) {
            // 篩選出代購者對留言者的評價（is_from_purchaser = true）
            const purchaserReviews = givenReviews.filter(review => 
              review.is_from_purchaser === true || review.isFromPurchaser === true
            );
            
            console.log(`✅ 從後端載入 ${purchaserReviews.length} 筆代購者給出的評價`);
            
            // 將資料庫評價轉換為本地格式並合併
            purchaserReviews.forEach(review => {
              const targetUserId = review.target_user_id || review.targetUserId;
              if (targetUserId) {
                if (!localReviews[targetUserId]) {
                  localReviews[targetUserId] = [];
                }
                
                // 檢查是否已存在相同評價
                const existingIndex = localReviews[targetUserId].findIndex(r => 
                  r.orderId === (review.order_id || review.orderId) &&
                  r.reviewerId === userId
                );
                
                const reviewData = {
                  id: review.id,
                  reviewerId: userId,
                  reviewerName: review.reviewer_name || review.reviewerName || '我',
                  rating: review.rating || review.rating_value,
                  comment: review.comment || review.rating_comment,
                  timestamp: review.timestamp,
                  orderId: review.order_id || review.orderId,
                  orderName: review.order_name || review.orderName,
                  isFromPurchaser: true,
                  targetUserId: targetUserId,
                  commentId: review.comment_id || review.commentId
                };
                
                if (existingIndex >= 0) {
                  localReviews[targetUserId][existingIndex] = reviewData;
                } else {
                  localReviews[targetUserId].push(reviewData);
                }
              }
            });
            
            // 更新本地快取
            await AsyncStorage.setItem('userReviews', JSON.stringify(localReviews));
          } else {
            console.log('後端返回的評價資料格式不正確，使用本地資料');
          }
        }
      } catch (dbError) {
        console.warn('從資料庫載入評價失敗，使用本地資料:', dbError?.message || dbError);
      }
      
      setUserReviews(localReviews);
    } catch (error) {
      console.error('載入評價資料失敗:', error);
    }
  };

  // 檢查是否已經評價過
  const hasRated = (commenter) => {
    const commenterId = commenter.commenterId || commenter.actualUserId || commenter.id;
    if (!commenterId) return false;
    
    const commenterReviews = userReviews[commenterId] || [];
    return commenterReviews.some(review => {
      const isFromPurchaser = review.isFromPurchaser === true || review.is_from_purchaser === true;
      const matchesOrder = review.orderId === orderData.id;
      return isFromPurchaser && matchesOrder;
    });
  };
  
  // 獲取評價資料
  const getReview = (commenter) => {
    const commenterId = commenter.commenterId || commenter.actualUserId || commenter.id;
    if (!commenterId) return null;
    
    const commenterReviews = userReviews[commenterId] || [];
    return commenterReviews.find(review => {
      const isFromPurchaser = review.isFromPurchaser === true || review.is_from_purchaser === true;
      const matchesOrder = review.orderId === orderData.id;
      return isFromPurchaser && matchesOrder;
    }) || null;
  };
  
  // 前往評價畫面（查看已完成的評價）
  const openReview = async (commenter) => {
    try {
      const review = getReview(commenter);
      if (!review) {
        Alert.alert('提示', '找不到評價資料');
        return;
      }
      
      // 獲取訂單的留言列表
      const comments = await apiService.getCommentsByOrder(orderData.id);
      if (!Array.isArray(comments) || comments.length === 0) {
        Alert.alert('提示', '此訂單暫無留言記錄');
        return;
      }
      
      // 找到對應的留言
      let commenterInfo = null;
      if (review.commentId) {
        const commentMatch = comments.find(c => c.id === review.commentId);
        if (commentMatch) {
          commenterInfo = {
            commenterId: commentMatch.commenter_id || commentMatch.commenterId,
            commenterName: commentMatch.commenter_name || commentMatch.commenterName || commenter.name,
            name: commentMatch.commenter_name || commentMatch.commenterName || commenter.name,
            id: commentMatch.id,
            originalCommentId: commentMatch.id,
          };
        }
      }
      
      // 如果沒有找到，使用 commenter 的資訊
      if (!commenterInfo) {
        commenterInfo = {
          commenterId: commenter.commenterId || commenter.actualUserId,
          commenterName: commenter.name,
          name: commenter.name,
          id: commenter.originalCommentId || commenter.originalCommentId,
          originalCommentId: commenter.originalCommentId || commenter.originalCommentId,
        };
      }
      
      navigation.navigate('OrderRating', {
        orderInfo: orderData,
        commenterInfo,
        isFromPurchaser: true, // 代購者評價留言者
        existingReview: review // 傳遞現有評價資料
      });
    } catch (error) {
      console.error('開啟評價頁面失敗:', error);
      Alert.alert('操作失敗', '無法開啟評價頁面，請稍後再試');
    }
  };

  // 載入留言者數據
  const loadCommenters = async () => {
    try {
      // 優先從資料庫載入留言（包含 item_price）
      let orderComments = [];
      try {
        const dbComments = await apiService.getCommentsByOrder(orderData.id);
        if (Array.isArray(dbComments) && dbComments.length > 0) {
          // 轉換資料庫格式到前端格式
          orderComments = dbComments.map(comment => ({
            id: comment.id,
            commenterId: comment.commenter_id || comment.commenterId,
            commenterName: comment.commenter_name || comment.commenterName,
            actualUserId: comment.commenter_id || comment.commenterId,
            text: comment.text,
            timestamp: comment.timestamp,
            deliveryStatus: comment.delivery_status || comment.deliveryStatus,
            accepted: comment.accepted,
            acceptedAt: comment.accepted_at || comment.acceptedAt,
            deliveryStartTime: comment.delivery_start_time || comment.deliveryStartTime,
            arrivalTime: comment.arrival_time || comment.arrivalTime,
            creditTier: comment.creditTier,
            creditScore: comment.creditScore,
            status: comment.status,
            isReply: comment.is_reply || comment.isReply,
            // 商品資訊（包含 item_price）
            items: comment.items && Array.isArray(comment.items) ? comment.items.map(item => ({
              item_name: item.item_name || item.itemName,
              quantity: item.quantity,
              item_price: item.item_price || null
            })) : null,
            // 舊格式兼容
            itemName: comment.itemName || comment.item_name,
            quantity: comment.quantity,
            // 聯絡資訊
            commenterPhone: comment.commenter_phone || comment.commenterPhone,
            commenterLine: comment.commenter_line || comment.commenterLine,
          }));
          console.log('✅ 從資料庫載入留言:', orderComments.length, '條');
        }
      } catch (dbError) {
        console.warn('從資料庫載入留言失敗，使用本地數據:', dbError?.message || dbError);
      }
      
      // 如果資料庫沒有留言，從本地載入
      if (orderComments.length === 0) {
        const saved = await AsyncStorage.getItem('comments');
        const parsed = saved ? JSON.parse(saved) : {};
        orderComments = parsed[orderData.id] || [];
      }
      
      // 過濾出有效的留言（排除回覆和被忽略的留言）
      const validComments = orderComments.filter(comment => {
        // 排除回覆
        if (comment.isReply) return false;
        // 排除被忽略的留言（兼容 'ignored' 與 'ignore'）
        if (comment.status === 'ignored' || comment.status === 'ignore' || comment.ignored || comment.deliveryStatus === 'ignored') return false;
        return true;
      });

      // 按照留言者 ID 分組
      const commentersMap = new Map();
      
      validComments.forEach(comment => {
        const actualUserId = comment.actualUserId || comment.commenterId || comment.id || null;
        const userIdKey = actualUserId ? String(actualUserId).trim() : `temp_${comment.id || Date.now()}`;
        
        if (!commentersMap.has(userIdKey)) {
          // 新留言者，創建記錄
          commentersMap.set(userIdKey, {
            actualUserId: actualUserId,
            commenterId: comment.commenterId || comment.id || 'unknown',
            name: comment.commenterName || comment.user || '匿名用戶',
            commenterName: comment.commenterName || comment.user || '匿名用戶',
            creditTier: comment.creditTier || '買咖',
            creditScore: comment.creditScore ?? 100,
            // 商品項目 Map（用於統整相同商品）
            itemsMap: new Map(),
            // 所有原始留言
            comments: [],
            // 聯絡資訊（使用最新的）
            commenterPhone: comment.commenterPhone || comment.commenter_phone || '',
            commenterLine: comment.commenterLine || comment.commenter_line || '',
            // 狀態資訊（使用最新的留言狀態）
            status: comment.deliveryStatus || 'pending',
            accepted: comment.accepted || false,
            acceptedAt: comment.acceptedAt,
            deliveryStartTime: comment.deliveryStartTime,
            arrivalTime: comment.arrivalTime,
            timestamp: comment.timestamp,
            // 原始留言 ID 列表
            originalCommentIds: [],
          });
        }
        
        const commenterData = commentersMap.get(userIdKey);
        
        // 添加原始留言 ID
        if (comment.id) {
          commenterData.originalCommentIds.push(comment.id);
        }
        commenterData.comments.push(comment);
        
        // 更新狀態（使用最新的留言狀態）
        const commentStatus = comment.deliveryStatus || 'pending';
        const commentAccepted = comment.accepted || false;
        if (comment.timestamp > (commenterData.timestamp || 0)) {
          commenterData.status = commentStatus;
          commenterData.accepted = commentAccepted;
          commenterData.acceptedAt = comment.acceptedAt;
          commenterData.deliveryStartTime = comment.deliveryStartTime;
          commenterData.arrivalTime = comment.arrivalTime;
          commenterData.timestamp = comment.timestamp;
          // 更新聯絡資訊（使用最新的）
          if (comment.commenterPhone || comment.commenter_phone) {
            commenterData.commenterPhone = comment.commenterPhone || comment.commenter_phone || '';
          }
          if (comment.commenterLine || comment.commenter_line) {
            commenterData.commenterLine = comment.commenterLine || comment.commenter_line || '';
          }
        }
        
        // 合併商品項目（保留 item_price 資訊）
        if (comment.items && Array.isArray(comment.items) && comment.items.length > 0) {
          // 新格式：使用 items 陣列
          comment.items.forEach(item => {
            const itemName = item.item_name || item.itemName || '';
            const quantity = parseInt(item.quantity) || 1;
            const itemPrice = item.item_price || null;
            
            if (itemName) {
              // 先嘗試用商品名稱（不含價格）查找現有商品
              // 這樣可以確保當價格更新時，更新現有商品而不是創建新商品
              let existingKey = null;
              let existingItem = null;
              
              // 查找是否有相同名稱的商品（優先使用有價格的）
              for (const [key, value] of commenterData.itemsMap.entries()) {
                if (value.item_name === itemName) {
                  existingKey = key;
                  existingItem = value;
                  // 如果找到的商品有價格，優先使用它
                  if (value.item_price) break;
                }
              }
              
              if (existingItem) {
                // 商品已存在，更新數量和價格（保留較新的價格）
                commenterData.itemsMap.set(existingKey, {
                  ...existingItem,
                  quantity: existingItem.quantity + quantity,
                  // 如果新商品有價格，使用新價格；否則保留舊價格
                  item_price: itemPrice !== null && itemPrice !== undefined ? itemPrice : existingItem.item_price
                });
              } else {
                // 新商品，添加到 Map
                const key = itemPrice ? `${itemName}_${itemPrice}` : itemName;
                commenterData.itemsMap.set(key, {
                  item_name: itemName,
                  quantity: quantity,
                  item_price: itemPrice
                });
              }
            }
          });
        } else if (comment.itemName || comment.item_name) {
          // 舊格式：單一商品
          const itemName = comment.itemName || comment.item_name || '';
          const quantity = parseInt(comment.quantity) || 1;
          
          if (itemName) {
            const key = itemName;
            if (commenterData.itemsMap.has(key)) {
              const existing = commenterData.itemsMap.get(key);
              commenterData.itemsMap.set(key, {
                ...existing,
                quantity: existing.quantity + quantity
              });
            } else {
              commenterData.itemsMap.set(key, {
                item_name: itemName,
                quantity: quantity,
                item_price: null
              });
            }
          }
        }
      });
      
      // 將 Map 轉換為留言者陣列
      const validCommentersRaw = Array.from(commentersMap.values()).map((commenterData, index) => {
        // 將 itemsMap 轉換為 items 陣列（保留 item_price）
        const items = Array.from(commenterData.itemsMap.values()).map(itemData => ({
          item_name: itemData.item_name || itemData.itemName,
          quantity: itemData.quantity,
          item_price: itemData.item_price || null
        }));
        
        // 為了向後兼容，保留 itemName 和 quantity（使用第一個商品）
        const firstItem = items.length > 0 ? items[0] : null;
        
        return {
          id: `${commenterData.commenterId}_${index}`, // 使用穩定的 ID
          name: commenterData.name,
          text: commenterData.comments.map(c => c.text).join(' | '), // 合併所有留言文字
          timestamp: commenterData.timestamp,
          status: commenterData.status,
          accepted: commenterData.accepted,
          acceptedAt: commenterData.acceptedAt,
          deliveryStartTime: commenterData.deliveryStartTime,
          arrivalTime: commenterData.arrivalTime,
          creditTier: commenterData.creditTier,
          creditScore: commenterData.creditScore,
          commenterId: commenterData.commenterId,
          commenterName: commenterData.commenterName,
          originalCommentId: commenterData.originalCommentIds[0] || null, // 使用第一個留言 ID 作為主要 ID
          originalCommentIds: commenterData.originalCommentIds, // 保留所有留言 ID
          actualUserId: commenterData.actualUserId,
          // 商品資訊（新格式）- 從資料庫載入時保留 item_price
          items: items.map(item => ({
            ...item,
            item_price: item.item_price || null // 確保 item_price 被保留
          })),
          // 商品資訊（舊格式，向後兼容）
          itemName: firstItem ? firstItem.item_name : '',
          quantity: firstItem ? firstItem.quantity : null,
          // 聯絡資訊
          commenterPhone: commenterData.commenterPhone,
          commenterLine: commenterData.commenterLine,
          // 代購填寫的金額與明細（使用第一個留言的，如果有的話）
          itemPrice: commenterData.comments[0]?.itemPrice ?? '',
          itemDetail: commenterData.comments[0]?.itemDetail ?? '',
        };
      });

      const creditCache = {};
      const commentersWithCredit = await Promise.all(
        validCommentersRaw.map(async (commenter) => {
          const normalizedId = commenter.actualUserId
            ? String(commenter.actualUserId).trim()
            : '';

          let creditScore = commenter.creditScore;
          let creditTier = commenter.creditTier;

          const isPlaceholderId =
            !normalizedId ||
            normalizedId === 'me' ||
            normalizedId === 'guest' ||
            normalizedId === 'unknown' ||
            normalizedId.startsWith('me_') ||
            normalizedId.startsWith('temp_') ||
            normalizedId.startsWith('comment_');

          if (!isPlaceholderId) {
            if (!creditCache[normalizedId]) {
              try {
                const [score, tier] = await Promise.all([
                  getUserCreditScore(normalizedId),
                  getUserTier(normalizedId)
                ]);
                creditCache[normalizedId] = {
                  score: score ?? 100,
                  tier: tier ?? '買咖'
                };
              } catch (creditError) {
                console.warn(
                  '取得留言者信譽資訊失敗，使用本地備援:',
                  normalizedId,
                  creditError?.message || creditError
                );
                creditCache[normalizedId] = {
                  score: commenter.creditScore ?? 100,
                  tier: commenter.creditTier ?? '買咖'
                };
              }
            }
            const cached = creditCache[normalizedId] || {};
            creditScore = cached.score ?? creditScore ?? 100;
            creditTier = cached.tier ?? creditTier ?? '買咖';
          }

          return {
            ...commenter,
            creditScore,
            creditTier
          };
        })
      );
      
      setCommenters(commentersWithCredit);
      console.log('載入留言者:', commentersWithCredit.length, '人');
      console.log('留言者列表:', commentersWithCredit.map(c => ({
        name: c.name,
        commenterId: c.commenterId,
        accepted: c.accepted,
        status: c.status
      })));
      
      // 初始化商品價格輸入框（保留用戶已輸入但未保存的值）
      setItemPriceInputs(prev => {
        const newInputs = {};
        const savedPrices = {};
        
        commentersWithCredit.forEach(commenter => {
          if (commenter.items && Array.isArray(commenter.items) && commenter.items.length > 0) {
            // 檢查該留言者是否所有商品都有價格（已儲存）
            const allItemsHavePrice = commenter.items.every(product => 
              product.item_price !== null && product.item_price !== undefined
            );
            
            if (allItemsHavePrice) {
              savedPrices[commenter.id] = true;
            }
            
            // 使用穩定鍵來查找舊的輸入值（originalCommentId 或 actualUserId）
            const stableKey = commenter.originalCommentId || commenter.actualUserId || commenter.commenterId;
            let oldInputs = null;
            
            // 優先使用當前 commenter.id 查找
            if (prev[commenter.id]) {
              oldInputs = prev[commenter.id];
            }
            // 如果找不到，使用穩定鍵查找（處理 ID 改變的情況）
            else if (stableKey) {
              Object.keys(prev).forEach(oldId => {
                // 如果舊 ID 包含穩定鍵，則使用該輸入值
                if (oldId.includes(String(stableKey)) || oldId === String(stableKey)) {
                  oldInputs = prev[oldId];
                }
              });
            }
            
            // 初始化該留言者的輸入框
            if (!newInputs[commenter.id]) {
              newInputs[commenter.id] = {};
            }
            
            commenter.items.forEach((product, idx) => {
              // 優先使用舊的輸入值（如果存在且有效），保留用戶已輸入但未保存的值
              if (oldInputs && oldInputs[idx] !== undefined && oldInputs[idx] !== null && oldInputs[idx] !== '') {
                newInputs[commenter.id][idx] = oldInputs[idx];
              }
              // 如果沒有舊輸入值，且商品有 item_price，則從資料庫初始化
              else if (product.item_price !== null && product.item_price !== undefined) {
                newInputs[commenter.id][idx] = String(product.item_price);
              }
              // 否則保持為空（不覆蓋用戶已輸入但未保存的值）
            });
          }
        });
        
        // 更新已儲存狀態（遷移舊狀態到新 ID）
        setSavedItemPrices(prevSaved => {
          const updated = {};
          commentersWithCredit.forEach(commenter => {
            const stableKey = commenter.originalCommentId || commenter.actualUserId || commenter.commenterId;
            let found = false;
            
            // 優先使用當前 commenter.id 查找
            if (prevSaved[commenter.id]) {
              updated[commenter.id] = prevSaved[commenter.id];
              found = true;
            }
            // 如果找不到，使用穩定鍵查找
            else if (stableKey) {
              Object.keys(prevSaved).forEach(oldId => {
                if (oldId.includes(String(stableKey)) || oldId === String(stableKey)) {
                  updated[commenter.id] = prevSaved[oldId];
                  found = true;
                }
              });
            }
            
            // 如果該留言者所有商品都有價格，標記為已儲存
            if (commenter.items && commenter.items.every(product => 
              product.item_price !== null && product.item_price !== undefined
            )) {
              updated[commenter.id] = true;
            }
          });
          return updated;
        });
        
        return newInputs;
      });
    } catch (error) {
      console.error('載入留言者失敗:', error);
    }
  };

  // 獲取狀態文字
  const getStatusText = (commenter) => {
    if (!commenter.accepted) {
      return '未接單';
    } else if (commenter.status === 'accepted' || commenter.status === 'pending') {
      return '已接單';
    } else if (commenter.status === 'delivering') {
      return '配送中';
    } else if (commenter.status === 'arrived') {
      return '已到貨';
    } else if (commenter.status === 'completed') {
      return '已完成';
    } else {
      return '已接單'; // 預設為已接單狀態
    }
  };

  // 獲取狀態顏色
  const getStatusColor = (commenter) => {
    if (!commenter.accepted) {
      return '#FF6B6B'; // 紅色 - 未接單
    } else if (commenter.status === 'accepted' || commenter.status === 'pending') {
      return '#007AFF'; // 藍色 - 已接單
    } else if (commenter.status === 'delivering') {
      return '#FF9500'; // 橙色 - 配送中
    } else if (commenter.status === 'arrived') {
      return '#34C759'; // 綠色 - 已到貨
    } else if (commenter.status === 'completed') {
      return '#8E8E93'; // 灰色 - 已完成
    } else {
      return '#007AFF'; // 藍色 - 已接單
    }
  };


  // 開始配送所有訂單
  const handleStartDeliveryAll = async () => {
    try {
      setLoading(true);
      
      // 更新所有已接單的留言者狀態為配送中
      const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
      const orderComments = comments[orderData.id] || [];
      
      const updatedComments = orderComments.map(comment => {
        if (comment.accepted && !comment.deliveryStartTime) {
          return {
            ...comment,
            deliveryStatus: 'delivering',
            deliveryStartTime: Date.now()
          };
        }
        return comment;
      });
      
      comments[orderData.id] = updatedComments;
      await AsyncStorage.setItem('comments', JSON.stringify(comments));

      // 同步更新已接單留言的狀態到後端
      try {
        const deliverableComments = updatedComments.filter(comment => comment.accepted && comment.id);
        if (deliverableComments.length > 0) {
          await Promise.all(deliverableComments.map(async (comment) => {
            try {
              await apiService.updateComment(comment.id, {
                delivery_status: 'delivering',
                delivery_start_time: comment.deliveryStartTime || Date.now()
              });
            } catch (apiError) {
              console.warn(`同步配送狀態失敗（commentId: ${comment.id}）:`, apiError?.message || apiError);
            }
          }));
        }
      } catch (syncError) {
        console.warn('同步配送狀態到後端時發生錯誤（已略過）:', syncError?.message || syncError);
      }

      // 更新訂單本身的狀態為配送中
      const orders = JSON.parse(await AsyncStorage.getItem('orders')) || [];
      const updatedOrders = orders.map(order => {
        if (order.id === orderData.id) {
          return {
            ...order,
            status: 'delivering'
          };
        }
        return order;
      });
      await AsyncStorage.setItem('orders', JSON.stringify(updatedOrders));
      
      // 同步更新後端資料庫的訂單狀態
      try {
        await databaseService.updateOrder(orderData.id, { status: 'delivering' });
        console.log('訂單狀態已同步到後端資料庫');
      } catch (backendError) {
        console.warn('後端資料庫更新失敗，本地已更新:', backendError);
      }

      // 發送配送開始通知給所有已接單的留言者
      const { sendNotificationToCommenter } = require('../utils/notificationHelper');
      const acceptedCommenters = commenters.filter(c => c.accepted);
      
      // 批量發送通知給所有已接單的留言者
      await Promise.all(
        acceptedCommenters.map(commenter => 
          sendNotificationToCommenter(
            commenter.commenterId || commenter.id,
            'delivery',
            '配送已開始',
            `您的訂單「${commenter.text || orderData.name}」已開始配送！`,
            {
              order_id: orderData.id,
              order_name: orderData.name,
              comment_id: commenter.id || null,
            }
          ).catch(err => {
            console.error(`發送配送通知給 ${commenter.commenterId} 失敗:`, err);
          })
        )
      );

      await loadCommenters();
      
      // 返回上一頁後，自動導航到首頁以刷新訂單列表
      Alert.alert(
        '配送已開始', 
        '所有已接單的訂單狀態已更新為「配送中」\n\n訂單將從首頁消失',
        [
          {
            text: '確定',
            onPress: async () => {
              // 返回上一頁
              if (navigation.canGoBack()) {
                navigation.goBack();
              }
              
              // 導航到首頁標籤，觸發首頁的 useFocusEffect 刷新數據
              setTimeout(() => {
                const tabNavigator = navigation.getParent();
                if (tabNavigator) {
                  tabNavigator.navigate('Home');
                }
              }, 300);
            }
          }
        ]
      );
    } catch (error) {
      console.error('開始配送失敗:', error);
      Alert.alert('操作失敗', '請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 更新留言者狀態的通用函數
  const updateCommenterStatus = async (commenterId, newStatus, additionalData = {}) => {
    try {
      const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
      const orderComments = comments[orderData.id] || [];
      
      const updatedComments = orderComments.map(comment => {
        // 使用多種方式匹配留言者
        const matchesByCommenterId = comment.commenterId === commenterId;
        const matchesById = comment.id === commenterId;
        // 處理生成的 ID 格式：${comment.commenterId}_${index}_${timestamp}
        const matchesByGeneratedId = commenterId.includes(comment.commenterId) || commenterId.includes(comment.id);
        
        if (matchesByCommenterId || matchesById || matchesByGeneratedId) {
          return {
            ...comment,
            deliveryStatus: newStatus,
            ...additionalData
          };
        }
        return comment;
      });
      
      comments[orderData.id] = updatedComments;
      await AsyncStorage.setItem('comments', JSON.stringify(comments));
      
      return true;
    } catch (error) {
      console.error('更新留言者狀態失敗:', error);
      return false;
    }
  };

  // 通知到貨
  const handleNotifyArrival = async (commenter) => {
    try {
      setLoading(true);
      
      // 更新留言者狀態為已完成
      const success = await updateCommenterStatus(
        commenter.commenterId || commenter.id, 
        'completed', 
        { 
          completed: true, 
          completedTime: Date.now(),
          arrivalTime: Date.now()
        }
      );

      if (success) {
        // 稍微延遲以確保AsyncStorage已寫入
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 重新載入comments以獲取最新狀態
        const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
        const orderComments = comments[orderData.id] || [];
        
        // 重新載入留言者列表以獲取最新狀態（在檢查前先更新）
        await loadCommenters();
        
        // 重新獲取最新的留言者數據
        const updatedCommenters = await (async () => {
          const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
          const orderComments = comments[orderData.id] || [];
          const validComments = orderComments.filter(comment => {
            if (comment.isReply) return false;
            if (comment.status === 'ignored' || comment.status === 'ignore' || comment.ignored || comment.deliveryStatus === 'ignored') return false;
            return true;
          });
          return validComments;
        })();
        
        // 計算總留言數（排除被忽略的）
        const totalComments = updatedCommenters.length;
        
        // 計算已到貨數（包含 arrived 和 completed 狀態）
        const arrivedCount = updatedCommenters.filter(comment => {
          const status = comment.deliveryStatus || comment.status;
          return status === 'arrived' || status === 'completed';
        }).length;
        
        // 找出所有已接單的留言
        const acceptedComments = updatedCommenters.filter(comment => comment.accepted);
        
        // 檢查是否所有已接單的留言都已完成
        const allAcceptedCompleted = acceptedComments.length > 0 && 
          acceptedComments.every(comment => {
            const status = comment.deliveryStatus || comment.status;
            return status === 'completed';
          });
        
        // 檢查是否總留言數等於已到貨數（所有留言者都已完成）
        const allCommentsArrived = totalComments > 0 && totalComments === arrivedCount;
        
        console.log('檢查訂單完成狀態:', {
          totalComments,
          arrivedCount,
          acceptedCount: acceptedComments.length,
          allAcceptedCompleted,
          allCommentsArrived
        });
        
        // 如果所有留言都已完成（總留言數等於已到貨數），更新訂單本身狀態為已完成
        if (allCommentsArrived || allAcceptedCompleted) {
          const orders = JSON.parse(await AsyncStorage.getItem('orders')) || [];
          const updatedOrders = orders.map(order => {
            if (order.id === orderData.id) {
              return {
                ...order,
                status: 'completed',
                completedAt: Date.now()
              };
            }
            return order;
          });
          await AsyncStorage.setItem('orders', JSON.stringify(updatedOrders));
          
          // 更新本地狀態
          setOrderData(prev => ({ ...prev, status: 'completed', completedAt: Date.now() }));
          
          console.log('所有訂單已完成，訂單狀態已更新為completed');
        }
        
        // 重新載入留言者列表以反映最新狀態
        await loadCommenters();
        
        // 發送到貨通知給留言者
        const { sendNotificationToCommenter } = require('../utils/notificationHelper');
        await sendNotificationToCommenter(
          commenter.commenterId || commenter.id,
          'arrived',
          '訂單已完成',
          `您的訂單「${commenter.text || orderData.name}」已完成，感謝您的參與！`,
          {
            order_id: orderData.id,
            order_name: orderData.name,
            comment_id: commenter.id || null,
          }
        );

        // 檢查是否已經評價過
        if (hasRated(commenter)) {
          Alert.alert(
            '訂單已完成', 
            `${commenter.name} 的訂單已完成\n\n您已經評價過此訂單`,
            [
              {
                text: '確定',
                onPress: () => loadCommenters()
              }
            ]
          );
        } else {
          Alert.alert(
            '訂單已完成', 
            `${commenter.name} 的訂單已完成\n\n現在可以進行評價`,
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
                    commenterInfo: commenter
                  });
                }
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('通知到貨失敗:', error);
      Alert.alert('操作失敗', '請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 選擇訂單明細照片（由代購者上傳）
  const handlePickDetailImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('權限不足', '需要相簿權限才能上傳明細照片');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'image/jpeg';
      let dataUrl = null;

      if (asset.base64) {
        dataUrl = `data:${mimeType};base64,${asset.base64}`;
      } else if (asset.uri) {
        const base64Encoding =
          (FileSystem?.EncodingType && FileSystem.EncodingType.Base64) || 'base64';
        const base64Data = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: base64Encoding,
        });
        dataUrl = `data:${mimeType};base64,${base64Data}`;
      }

      if (!dataUrl) {
        Alert.alert('錯誤', '無法讀取選擇的圖片，請稍後再試');
        return;
      }

      setOrderDetailImage(dataUrl);
    } catch (error) {
      console.error('選擇明細照片失敗:', error);
      Alert.alert('錯誤', '選擇明細照片失敗，請稍後再試');
    }
  };

  // 儲存整張訂單的代購金額與明細照片（同步到後端 + 本地）
  const handleSaveOrderDetail = async () => {
    const rawPrice = (orderItemPrice || '').trim();
    let numericPrice = null;
    if (rawPrice) {
      if (isNaN(Number(rawPrice))) {
        Alert.alert('格式錯誤', '請輸入正確的金額（只能是數字）');
        return;
      }
      numericPrice = Number(rawPrice);
    }

    try {
      setLoading(true);

      const updatePayload = {
        item_price: numericPrice,
        detail_image: orderDetailImage || null,
      };

      // 優先嘗試同步到後端資料庫
      try {
        await databaseService.updateOrder(orderData.id, updatePayload);
        console.log('訂單代購明細已同步到後端');
      } catch (apiError) {
        console.warn('同步代購明細到後端失敗，僅更新本地資料:', apiError?.message || apiError);
      }

      // 更新本地 AsyncStorage 中的 orders
      const storedOrders = JSON.parse(await AsyncStorage.getItem('orders')) || [];
      const updatedOrders = storedOrders.map(o =>
        o.id === orderData.id
          ? { ...o, item_price: numericPrice, detail_image: orderDetailImage || null }
          : o
      );
      await AsyncStorage.setItem('orders', JSON.stringify(updatedOrders));

      // 同步目前畫面的狀態
      setOrderData(prev => ({
        ...prev,
        item_price: numericPrice,
        detail_image: orderDetailImage || null,
      }));

      Alert.alert('已儲存', '代購明細與金額已更新');
    } catch (error) {
      console.error('儲存訂單代購明細失敗:', error);
      Alert.alert('儲存失敗', '請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 儲存代購填寫的商品金額（同步到後端）
  const handleSaveItemPrices = async (commenter) => {
    if (!commenter.items || !Array.isArray(commenter.items) || commenter.items.length === 0) {
      Alert.alert('錯誤', '此留言沒有商品資訊');
      return;
    }

    try {
      setLoading(true);
      
      // 構建更新的商品列表（包含金額）
      const updatedItems = commenter.items.map((product, idx) => {
        const priceText = itemPriceInputs[commenter.id]?.[idx] ?? 
                         (product.item_price ? String(product.item_price) : '') ?? '';
        const price = priceText.trim() ? parseInt(priceText.trim()) : null;
        
        return {
          item_name: product.item_name || product.itemName,
          quantity: product.quantity || 1,
          item_price: price && !isNaN(price) ? price : null
        };
      });

      // 獲取該留言者的所有留言 ID
      const commentIds = commenter.originalCommentIds && commenter.originalCommentIds.length > 0 
        ? commenter.originalCommentIds 
        : (commenter.originalCommentId ? [commenter.originalCommentId] : []);

      // 獲取當前用戶（訂單發起者）的 ID
      const currentUser = await AuthManager.getCurrentUser();
      const orderCreatorId = currentUser?.id;
      
      if (!orderCreatorId || orderCreatorId === 'me') {
        Alert.alert('錯誤', '無法識別訂單發起者，請重新登入');
        return;
      }
      
      // 更新所有相關留言的商品金額到後端（使用訂單發起者的 ID）
      await Promise.all(commentIds.map(async (commentId) => {
        if (!commentId) return;
        
        try {
          await apiService.updateComment(commentId, {
            items: updatedItems
          }, { user_id: orderCreatorId });
          console.log('✅ 商品金額已同步到後端:', commentId);
        } catch (error) {
          console.warn('⚠️ 更新商品金額到後端失敗:', error?.message || error);
          throw error; // 重新拋出錯誤，讓外層處理
        }
      }));

      // 更新本地狀態
      setCommenters(prev =>
        prev.map(c => {
          if (c.id === commenter.id) {
            const updatedItemsWithPrice = c.items.map((product, idx) => ({
              ...product,
              item_price: updatedItems[idx]?.item_price || product.item_price
            }));
            return {
              ...c,
              items: updatedItemsWithPrice
            };
          }
          return c;
        })
      );

      // 標記該留言者的金額已儲存
      setSavedItemPrices(prev => ({
        ...prev,
        [commenter.id]: true
      }));

      Alert.alert('已儲存', '商品金額已更新');
    } catch (error) {
      console.error('儲存商品金額失敗:', error);
      Alert.alert('儲存失敗', '請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 儲存代購填寫的金額與明細（只寫入本地 AsyncStorage，不同步到後端）- 舊格式
  const handleSaveItemDetail = async (commenter) => {
    const priceText = priceInputs[commenter.id] ?? commenter.itemPrice ?? '';
    const detailText = detailInputs[commenter.id] ?? commenter.itemDetail ?? '';

    // 可選：簡單驗證金額
    const trimmedPrice = String(priceText).trim();
    if (trimmedPrice && isNaN(Number(trimmedPrice))) {
      Alert.alert('格式錯誤', '請輸入正確的金額（只能是數字）');
      return;
    }

    try {
      const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
      const orderComments = comments[orderData.id] || [];

      const updatedComments = orderComments.map(comment => {
        if (comment.id === commenter.originalCommentId) {
          return {
            ...comment,
            itemPrice: trimmedPrice,
            itemDetail: detailText.trim(),
          };
        }
        return comment;
      });

      comments[orderData.id] = updatedComments;
      await AsyncStorage.setItem('comments', JSON.stringify(comments));

      // 同步更新目前畫面的狀態
      setCommenters(prev =>
        prev.map(c =>
          c.id === commenter.id
            ? { ...c, itemPrice: trimmedPrice, itemDetail: detailText.trim() }
            : c
        )
      );

      Alert.alert('已儲存', '明細與金額已儲存於本機');
    } catch (error) {
      console.error('儲存明細失敗:', error);
      Alert.alert('儲存失敗', '請稍後再試');
    }
  };

  // 接單功能
  const handleAcceptOrder = async (commenter) => {
    try {
      setLoading(true);
      
      console.log('開始接單，留言者資訊:', {
        commenterId: commenter.commenterId,
        name: commenter.name,
        originalCommentId: commenter.originalCommentId,
        text: commenter.text
      });
      
      // 更新留言者的狀態為已接單
      const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
      const orderComments = comments[orderData.id] || [];
      
      console.log('訂單留言列表:', orderComments.map(c => ({
        id: c.id,
        commenterId: c.commenterId,
        actualUserId: c.actualUserId,
        text: c.text
      })));
      
      // 獲取該留言者的所有留言 ID
      const commentIds = commenter.originalCommentIds && commenter.originalCommentIds.length > 0 
        ? commenter.originalCommentIds 
        : (commenter.originalCommentId ? [commenter.originalCommentId] : []);
      
      const updatedComments = orderComments.map(comment => {
        // 檢查是否屬於該留言者的任何一條留言
        const matchesById = commentIds.includes(comment.id);
        const matchesByCommenterId = comment.commenterId === commenter.commenterId;
        
        if (matchesById || matchesByCommenterId) {
          // 額外檢查：確保不是回覆，且還沒有被接單（避免重複接單）
          if (comment.isReply || comment.accepted) {
            console.log('跳過留言（回覆或已接單）:', {
              commentId: comment.id,
              isReply: comment.isReply,
              accepted: comment.accepted
            });
            return comment; // 不處理回覆或已經接單的留言
          }
          
          console.log('找到匹配的留言，更新狀態:', {
            commentId: comment.id,
            originalCommentIds: commentIds,
            commenterId: comment.commenterId,
            text: comment.text
          });
          
          return {
            ...comment,
            accepted: true,
            acceptedAt: Date.now(),
            deliveryStatus: 'accepted'
          };
        }
        return comment;
      });
      
      comments[orderData.id] = updatedComments;
      await AsyncStorage.setItem('comments', JSON.stringify(comments));

      // 更新訂單的參與者資訊
      const orders = JSON.parse(await AsyncStorage.getItem('orders')) || [];
      const updatedOrders = orders.map(order => {
        if (order.id === orderData.id) {
          // 只使用 commentId 來匹配參與記錄，因為每個留言對應一個唯一的參與記錄
          // 不應使用 commenterId，因為同一個用戶可能有多筆留言
          const existingJoiner = order.joiners?.find(
            joiner => joiner.commentId === commenter.originalCommentId
          );
          
          if (!existingJoiner) {
            // 如果沒有參與記錄，則添加（使用第一個留言 ID）
            const primaryCommentId = commenter.originalCommentIds && commenter.originalCommentIds.length > 0
              ? commenter.originalCommentIds[0]
              : commenter.originalCommentId;
            
            const newJoiner = {
              id: commenter.commenterId,
              name: commenter.name,
              joinTime: Date.now(),
              status: 'accepted',
              userId: commenter.commenterId, // 使用實際的留言者ID
              commentId: primaryCommentId, // 關鍵：使用留言的唯一ID（第一個）
              acceptedAt: Date.now()
            };
            
            console.log('添加參與記錄:', {
              orderId: orderData.id,
              joiner: newJoiner,
              commenterId: commenter.commenterId,
              commentIds: commenter.originalCommentIds || [commenter.originalCommentId]
            });
            
            return {
              ...order,
              joiners: [...(order.joiners || []), newJoiner],
              joined: (order.joined || 0) + 1
            };
          } else {
            // 如果已有參與記錄（通過 commentId 匹配），只更新該記錄的狀態
        // 更新所有相關的參與記錄
        const commentIds = commenter.originalCommentIds && commenter.originalCommentIds.length > 0 
          ? commenter.originalCommentIds 
          : (commenter.originalCommentId ? [commenter.originalCommentId] : []);
        
        const updatedJoiners = order.joiners.map(joiner => 
          commentIds.includes(joiner.commentId)
            ? { ...joiner, status: 'accepted', acceptedAt: Date.now() }
            : joiner
        );
        
        console.log('更新參與記錄:', {
          commentIds: commentIds,
          updatedCount: updatedJoiners.filter(j => commentIds.includes(j.commentId)).length
        });
            
            return {
              ...order,
              joiners: updatedJoiners
            };
          }
        }
        return order;
      });
      
      await AsyncStorage.setItem('orders', JSON.stringify(updatedOrders));
      
      // 同步更新後端資料庫
      try {
        // 更新訂單的參與者資訊
        await databaseService.updateOrder(orderData.id, {
          joiners: updatedOrders.find(o => o.id === orderData.id)?.joiners,
          joined: updatedOrders.find(o => o.id === orderData.id)?.joined
        });
        
        // 更新留言的接單狀態（找到被接單的留言並同步）
        // 更新所有相關留言的狀態到後端
        const commentIds = commenter.originalCommentIds && commenter.originalCommentIds.length > 0 
          ? commenter.originalCommentIds 
          : (commenter.originalCommentId ? [commenter.originalCommentId] : []);
        
        const acceptedComments = updatedComments.filter(c => 
          commentIds.includes(c.id) && c.accepted === true
        );
        
        // 批量更新所有相關留言到後端
        await Promise.all(acceptedComments.map(async (acceptedComment) => {
          const commentId = acceptedComment.id;
          if (!commentId) return;
          
          // 驗證 commentId 是否有效（不是臨時 ID）
          const commentIdValid = commentId && 
            commentId.length > 5 &&
            !commentId.includes('_index') &&
            (commentId.match(/^comment_\d+_[a-z0-9]+$/) || // 允許格式：comment_1234567890_abc12
             !commentId.startsWith('comment_')); // 或者不是以 comment_ 開頭的其他有效 ID
          
          if (commentIdValid) {
            try {
              await databaseService.updateComment(commentId, {
                accepted: true,
                accepted_at: Date.now(),
                delivery_status: 'accepted'
              });
              console.log('✅ 留言接單狀態已同步到後端資料庫:', commentId);
            } catch (updateError) {
              // 如果是 404 錯誤，可能是留言不存在於資料庫中（可能是本地創建的留言）
              if (updateError?.status === 404 || updateError?.message?.includes('404')) {
                console.log('⚠️ 留言不存在於後端資料庫（可能是本地創建的留言）:', commentId);
              } else {
                console.warn('⚠️ 更新留言到後端失敗:', updateError?.message || updateError);
              }
            }
          } else {
            console.log('⚠️ 跳過更新留言（commentId 無效或為臨時 ID）:', commentId);
          }
        }));
        
        console.log('接單記錄已同步到後端資料庫');
      } catch (backendError) {
        console.warn('後端資料庫更新失敗，本地已更新:', backendError);
      }

      // 發送接單確認通知給留言者
      const { sendNotificationToCommenter } = require('../utils/notificationHelper');
      await sendNotificationToCommenter(
        commenter.commenterId || commenter.id,
        'orderAccepted',
        '代購接單確認',
        `您的留言「${commenter.text || orderData.name}」已被發起代購者確認接單！`,
        {
          order_id: orderData.id,
          order_name: orderData.name,
          comment_id: commenter.id || null,
        }
      );
      
      console.log('接單成功，參與記錄已更新:', {
        orderId: orderData.id,
        orderName: orderData.name,
        commenterId: commenter.commenterId,
        joinerId: commenter.commenterId
      });

      Alert.alert('接單成功', `${commenter.name} 的訂單已確認接單`);
      await loadCommenters();
    } catch (error) {
      console.error('接單失敗:', error);
      Alert.alert('接單失敗', '請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 刪除訂單功能
  const handleDeleteOrder = async () => {
    Alert.alert(
      '刪除歷史訂單',
      '確定要刪除此訂單嗎？此操作無法復原，所有相關的留言和資料都將被永久刪除。',
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
              setLoading(true);
              
              // 在刪除前先保存訂單發起者 ID（用於發送通知）
              const creatorId = orderData.created_by || orderData.createdBy;
              const orderName = orderData.name;
              
              // 刪除訂單 - 同時更新本地和後端
              // 先嘗試從後端刪除
              try {
                await databaseService.deleteOrder(orderData.id);
                console.log('訂單已從後端刪除:', orderData.id);
              } catch (backendError) {
                console.warn('後端刪除失敗，繼續本地刪除:', backendError);
                // 即使後端失敗，繼續本地刪除
              }
              
              // 更新本地存儲
              const orders = JSON.parse(await AsyncStorage.getItem('orders')) || [];
              const updatedOrders = orders.filter(order => order.id !== orderData.id);
              await AsyncStorage.setItem('orders', JSON.stringify(updatedOrders));
              
              // 刪除相關留言
              const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
              delete comments[orderData.id];
              await AsyncStorage.setItem('comments', JSON.stringify(comments));
              
              // 發送刪除通知給訂單發起者（如果知道發起者 ID）
              if (creatorId && creatorId !== 'me') {
                try {
                  const { createNotification } = require('../utils/notificationHelper');
                  await createNotification({
                    user_id: creatorId,
                    type: 'deleted',
                    title: '訂單已刪除',
                    body: `您已刪除訂單：${orderName}`,
                    order_id: orderData.id,
                    order_name: orderName,
                  });
                } catch (notifError) {
                  // 靜默處理通知發送失敗，不影響刪除流程
                  console.log('發送刪除通知失敗（已靜默處理）:', notifError?.message || notifError);
                }
              } else {
                // 如果無法確定發起者 ID，靜默跳過通知
                console.log('無法確定訂單發起者 ID，跳過刪除通知（已靜默處理）');
              }
              
              Alert.alert(
                '刪除成功',
                '訂單已成功刪除',
                [
                  {
                    text: '確定',
                    onPress: () => navigation.goBack()
                  }
                ]
              );
            } catch (error) {
              console.error('刪除訂單失敗:', error);
              Alert.alert('刪除失敗', '請稍後再試');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // 忽略訂單功能
  const handleIgnoreOrder = async (commenter) => {
    setCurrentIgnoreCommenter(commenter);
    setShowIgnoreModal(true);
  };

  // 確認忽略訂單
  const confirmIgnoreOrder = async () => {
    if (!ignoreReason.trim()) {
      Alert.alert('請輸入忽略原因', '必須提供忽略留言的原因');
      return;
    }

    try {
      setLoading(true);
      
      // 發送忽略通知給留言者
      const { sendNotificationToCommenter } = require('../utils/notificationHelper');
      await sendNotificationToCommenter(
        currentIgnoreCommenter.commenterId || currentIgnoreCommenter.id,
        'commentIgnored',
        '留言已被忽略',
        `${orderData.name} 的留言已被忽略\n原因: ${ignoreReason}`,
        {
          order_id: orderData.id,
          order_name: orderData.name,
          comment_id: currentIgnoreCommenter.id || null,
        }
      );

      // 刪除留言
      const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
      const orderComments = comments[orderData.id] || [];
      
      // 獲取該留言者的所有留言 ID
      const commentIds = currentIgnoreCommenter.originalCommentIds && currentIgnoreCommenter.originalCommentIds.length > 0 
        ? currentIgnoreCommenter.originalCommentIds 
        : (currentIgnoreCommenter.originalCommentId ? [currentIgnoreCommenter.originalCommentId] : []);
      
      // 過濾掉被忽略的留言（所有相關留言）
      const updatedComments = orderComments.filter(comment => {
        return !commentIds.includes(comment.id);
      });
      
      comments[orderData.id] = updatedComments;
      await AsyncStorage.setItem('comments', JSON.stringify(comments));

      // 關閉模態框並顯示成功訊息
      setShowIgnoreModal(false);
      setIgnoreReason('');
      setCurrentIgnoreCommenter(null);
      
      Alert.alert('已忽略訂單', `${currentIgnoreCommenter.name} 的訂單已被忽略`);
      await loadCommenters();
    } catch (error) {
      console.error('忽略訂單失敗:', error);
      Alert.alert('操作失敗', '請稍後再試');
    } finally {
      setLoading(false);
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
              <Text style={styles.creditText}>信譽等級: {item.creditTier}</Text>
            </View>
          </View>
        </View>
        <View style={styles.statusBadge}>
          <Text style={[styles.statusText, { color: getStatusColor(item) }]}>
            {getStatusText(item)}
          </Text>
        </View>
      </View>
      
      {/* 顯示商品資訊 */}
      {((item.items && Array.isArray(item.items) && item.items.length > 0) || item.itemName || item.item_name) ? (
        <View style={styles.itemInfoBox}>
          <Text style={styles.itemInfoLabel}>商品：</Text>
          {item.items && Array.isArray(item.items) && item.items.length > 0 ? (
            // 新格式：顯示多個商品
            <View style={styles.itemsList}>
              {item.items.map((product, idx) => (
                <Text key={idx} style={styles.itemInfoText}>
                  {product.item_name || product.itemName}
                  {product.quantity && <Text style={styles.itemInfoQty}> x{product.quantity}</Text>}
                  {idx < item.items.length - 1 && <Text style={styles.itemSeparator}>、</Text>}
                </Text>
              ))}
            </View>
          ) : (
            // 舊格式：單一商品
            <Text style={styles.itemInfoText}>
              {item.itemName || item.item_name}
              {item.quantity && <Text style={styles.itemInfoQty}> x{item.quantity}</Text>}
            </Text>
          )}
        </View>
      ) : (
        <Text style={styles.commentText}>{item.text}</Text>
      )}
      
      {/* 顯示聯絡資訊 */}
      {(item.commenterPhone || item.commenterLine) && (
        <View style={styles.contactInfoBox}>
          {item.commenterPhone && (
            <View style={styles.contactItem}>
              <Ionicons name="call-outline" size={14} color="#666" />
              <Text style={styles.contactText}>{item.commenterPhone}</Text>
            </View>
          )}
          {item.commenterLine && (
            <View style={styles.contactItem}>
              <Ionicons name="chatbubble-outline" size={14} color="#666" />
              <Text style={styles.contactText}>{item.commenterLine}</Text>
            </View>
          )}
        </View>
      )}

      {/* 僅對已接單的留言顯示「代購金額試算」區塊 */}
      {item.accepted && (
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>代購金額試算</Text>
          
          {/* 商品金額輸入列表 */}
          {item.items && Array.isArray(item.items) && item.items.length > 0 ? (
            <View style={styles.itemsPriceList}>
              {item.items.map((product, idx) => {
                const itemKey = `${item.id}_${idx}`;
                const currentPrice = (itemPriceInputs[item.id]?.[idx] ?? 
                                   (product.item_price ? String(product.item_price) : '')) || '';
                const quantity = product.quantity || 1;
                const price = parseFloat(currentPrice) || 0;
                const subtotal = price * quantity;
                
                return (
                  <View key={idx} style={styles.itemPriceRow}>
                    <View style={styles.itemPriceInfo}>
                      <Text style={styles.itemPriceName}>
                        {product.item_name || product.itemName}
                        {quantity > 1 && <Text style={styles.itemPriceQty}> x{quantity}</Text>}
                      </Text>
                    </View>
                    <View style={styles.itemPriceInputContainer}>
                      <Text style={styles.itemPriceLabel}>單價：</Text>
                      <TextInput
                        placeholder="0"
                        style={styles.itemPriceInput}
                        keyboardType="numeric"
                        value={currentPrice}
                        onChangeText={(text) => {
                          setItemPriceInputs(prev => {
                            const commenterPrices = prev[item.id] || {};
                            return {
                              ...prev,
                              [item.id]: {
                                ...commenterPrices,
                                [idx]: text
                              }
                            };
                          });
                          // 當用戶編輯金額時，清除已儲存狀態，讓按鈕變回「儲存金額」
                          setSavedItemPrices(prev => {
                            const updated = { ...prev };
                            delete updated[item.id];
                            return updated;
                          });
                        }}
                      />
                      <Text style={styles.itemPriceUnit}>元</Text>
                      {price > 0 && (
                        <Text style={styles.itemSubtotal}>
                          小計：${subtotal}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
              
              {/* 總金額顯示 */}
              {(() => {
                const totalAmount = item.items.reduce((sum, product, idx) => {
                  const currentPrice = (itemPriceInputs[item.id]?.[idx] ?? 
                                     (product.item_price ? parseFloat(product.item_price) : 0)) || 0;
                  const quantity = product.quantity || 1;
                  return sum + (currentPrice * quantity);
                }, 0);
                
                return totalAmount > 0 ? (
                  <View style={styles.totalAmountContainer}>
                    <Text style={styles.totalAmountLabel}>總金額：</Text>
                    <Text style={styles.totalAmountValue}>${totalAmount}</Text>
                  </View>
                ) : null;
              })()}
              
              <TouchableOpacity
                style={styles.saveDetailButton}
                onPress={() => handleSaveItemPrices(item)}
              >
                <Text style={styles.saveDetailButtonText}>
                  {savedItemPrices[item.id] ? '編輯金額' : '儲存金額'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            // 舊格式：單一商品
            <View style={styles.priceRow}>
              <TextInput
                placeholder="商品金額（元）"
                style={styles.priceInput}
                keyboardType="numeric"
                value={priceInputs[item.id] ?? (item.itemPrice ? String(item.itemPrice) : '')}
                onChangeText={(text) =>
                  setPriceInputs(prev => ({ ...prev, [item.id]: text }))
                }
              />
              <TouchableOpacity
                style={styles.saveDetailButton}
                onPress={() => handleSaveItemDetail(item)}
              >
                <Text style={styles.saveDetailButtonText}>儲存</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      
      <View style={styles.commenterActions}>
        {/* 未接單：顯示接單/忽略按鈕 */}
        {!item.accepted && (
          <>
            <TouchableOpacity 
              style={[styles.actionButton, styles.ignoreButton, { flex: 0.48 }]}
              onPress={() => handleIgnoreOrder(item)}
              disabled={loading}
            >
              <MaterialIcons name="close" size={isSmallScreen ? 14 : 16} color="#fff" />
              <Text style={[styles.actionButtonText, { color: '#fff' }]}>忽略訂單</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.acceptButton, { flex: 0.48 }]}
              onPress={() => handleAcceptOrder(item)}
              disabled={loading}
            >
              <MaterialIcons name="check" size={isSmallScreen ? 14 : 16} color="#fff" />
              <Text style={[styles.actionButtonText, { color: '#fff' }]}>接單</Text>
            </TouchableOpacity>
          </>
        )}
        
        {/* 配送中：顯示通知到貨按鈕 */}
        {item.status === 'delivering' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.arrivalButton, { flex: 1 }]}
            onPress={() => handleNotifyArrival(item)}
            disabled={loading}
          >
            <MaterialIcons name="check-circle" size={isSmallScreen ? 14 : 16} color="#fff" />
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>通知到貨</Text>
          </TouchableOpacity>
        )}
        
        {/* 已到貨：顯示完成訂單按鈕 */}
        {item.status === 'arrived' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.completeButton, { flex: 1 }]}
            onPress={() => {
              // 這裡可以添加完成訂單的邏輯
              Alert.alert('訂單完成', `${item.name} 的訂單已完成`);
            }}
            disabled={loading}
          >
            <MaterialIcons name="done" size={isSmallScreen ? 14 : 16} color="#fff" />
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>完成訂單</Text>
          </TouchableOpacity>
        )}
        
        {/* 已完成且已評價：顯示查看評價按鈕 */}
        {item.status === 'completed' && hasRated(item) && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.reviewButton, { flex: 1 }]}
            onPress={() => openReview(item)}
            disabled={loading}
          >
            <MaterialIcons name="star-rate" size={isSmallScreen ? 14 : 16} color="#fff" />
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>查看評價</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (!orderData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
          <Text style={styles.errorText}>無效的訂單資料</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const hasAcceptedOrders = commenters.some(c => c.accepted);
  const hasAcceptedButNotDelivering = commenters.some(c => c.accepted && c.status === 'accepted');
  const hasDeliveringOrders = commenters.some(c => c.status === 'delivering');

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部導航 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>訂單管理</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* 訂單資訊 */}
        <View style={styles.orderSection}>
          <Text style={styles.sectionTitle}>訂單資訊</Text>
          <View style={styles.orderCard}>
            <Text style={styles.orderName}>{orderData.name}</Text>
            <Text style={styles.orderLocation}>📍地點：{orderData.address}</Text>
            <Text style={styles.orderContact}>📞電話：{orderData.phone || orderData.contact}</Text>
            {orderData.line && <Text style={styles.orderLine}>💬Line ID：{orderData.line}</Text>}
            <Text style={styles.orderPayment}>💰付款方式：{orderData.method || orderData.payment}</Text>
            {orderData.limit && <Text style={styles.orderNote}>📝備註：{orderData.limit}</Text>}

            {/* 商品清單彙總（顯示所有參與者的商品） */}
            {(() => {
              // 計算商品彙總（支援新舊格式）
              const itemSummary = new Map();
              
              commenters.forEach(commenter => {
                // 優先處理新格式：items 陣列
                if (commenter.items && Array.isArray(commenter.items) && commenter.items.length > 0) {
                  commenter.items.forEach(item => {
                    const itemName = item.item_name || item.itemName || '';
                    const quantity = parseInt(item.quantity) || 1;
                    
                    if (itemName.trim()) {
                      if (itemSummary.has(itemName)) {
                        itemSummary.set(itemName, itemSummary.get(itemName) + quantity);
                      } else {
                        itemSummary.set(itemName, quantity);
                      }
                    }
                  });
                } else if (commenter.itemName || commenter.item_name) {
                  // 舊格式：單一商品
                  const itemName = commenter.itemName || commenter.item_name || '';
                  const quantity = parseInt(commenter.quantity) || 1;
                  
                  if (itemName.trim()) {
                    if (itemSummary.has(itemName)) {
                      itemSummary.set(itemName, itemSummary.get(itemName) + quantity);
                    } else {
                      itemSummary.set(itemName, quantity);
                    }
                  }
                }
              });
              
              // 將 Map 轉換為陣列並排序
              const summaryEntries = Array.from(itemSummary.entries())
                .sort((a, b) => a[0].localeCompare(b[0]));
              
              if (summaryEntries.length > 0) {
                const totalItems = summaryEntries.reduce((sum, [, qty]) => sum + qty, 0);
                
                return (
                  <View style={styles.itemSummarySection}>
                    <Text style={styles.itemSummaryTitle}>📦 商品清單彙總</Text>
                    <View style={styles.itemSummaryList}>
                      {summaryEntries.map(([itemName, totalQty], idx) => (
                        <View key={idx} style={styles.itemSummaryItem}>
                          <Text style={styles.itemSummaryName}>{itemName}</Text>
                          <Text style={styles.itemSummaryQty}>x{totalQty}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.itemSummaryHint}>
                      共 {summaryEntries.length} 種商品，總計 {totalItems} 件
                    </Text>
                  </View>
                );
              }
              return null;
            })()}

            {/* 代購明細與金額（由代購者填寫，全訂單共用） */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>代購明細與總金額（代購者可見與編輯）</Text>
              <TextInput
                placeholder="商品金額（元）"
                keyboardType="numeric"
                style={styles.priceInput}
                value={orderItemPrice}
                onChangeText={setOrderItemPrice}
              />
              <View style={styles.detailButtonsRow}>
                <TouchableOpacity
                  style={styles.pickImageButton}
                  onPress={handlePickDetailImage}
                  disabled={loading}
                >
                  <MaterialIcons name="photo-camera" size={18} color="#fff" />
                  <Text style={styles.pickImageButtonText}>
                    {orderDetailImage ? '重新選擇明細照片' : '選擇明細照片'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveDetailButton, loading && styles.disabledButton]}
                  onPress={handleSaveOrderDetail}
                  disabled={loading}
                >
                  <Text style={styles.saveDetailButtonText}>
                    {loading ? '儲存中...' : '儲存明細與金額'}
                  </Text>
                </TouchableOpacity>
              </View>
              {orderDetailImage && (
                <View style={styles.imagePreviewSection}>
                  <Text style={styles.imagePreviewLabel}>明細照片預覽：</Text>
                  <TouchableOpacity
                    style={styles.imagePreviewContainer}
                    onPress={() => {
                      setShowImageModal(true);
                      setImageError(false);
                      setImageLoading(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: orderDetailImage }}
                      style={styles.imagePreview}
                      resizeMode="cover"
                      onLoadStart={() => {
                        setImageLoading(true);
                        setImageError(false);
                      }}
                      onLoadEnd={() => {
                        setImageLoading(false);
                      }}
                      onError={(error) => {
                        console.error('圖片載入失敗:', error);
                        setImageLoading(false);
                        setImageError(true);
                      }}
                    />
                    {imageLoading && (
                      <View style={styles.imageLoadingOverlay}>
                        <ActivityIndicator size="small" color="#007BFF" />
                      </View>
                    )}
                    {imageError && (
                      <View style={styles.imageErrorOverlay}>
                        <Ionicons name="alert-circle" size={24} color="#FF6B6B" />
                        <Text style={styles.imageErrorText}>載入失敗</Text>
                      </View>
                    )}
                    <View style={styles.imagePreviewOverlay}>
                      <Ionicons name="expand" size={20} color="#fff" />
                      <Text style={styles.imagePreviewHint}>點擊查看大圖</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteImageButton}
                    onPress={() => {
                      Alert.alert(
                        '刪除照片',
                        '確定要刪除此明細照片嗎？',
                        [
                          {
                            text: '取消',
                            style: 'cancel'
                          },
                          {
                            text: '刪除',
                            style: 'destructive',
                            onPress: async () => {
                              setOrderDetailImage(null);
                              // 立即更新到本地和後端
                              try {
                                setLoading(true);
                                const updatePayload = {
                                  item_price: orderItemPrice ? Number(orderItemPrice) : null,
                                  detail_image: null,
                                };
                                
                                // 優先嘗試同步到後端資料庫
                                try {
                                  await databaseService.updateOrder(orderData.id, updatePayload);
                                  console.log('訂單代購明細已同步到後端');
                                } catch (apiError) {
                                  console.warn('同步代購明細到後端失敗，僅更新本地資料:', apiError?.message || apiError);
                                }
                                
                                // 更新本地資料
                                const orders = JSON.parse(await AsyncStorage.getItem('orders')) || [];
                                const updatedOrders = orders.map(o =>
                                  o.id === orderData.id
                                    ? { ...o, item_price: orderItemPrice ? Number(orderItemPrice) : null, detail_image: null }
                                    : o
                                );
                                await AsyncStorage.setItem('orders', JSON.stringify(updatedOrders));
                                
                                // 同步目前畫面的狀態
                                setOrderData(prev => ({
                                  ...prev,
                                  item_price: orderItemPrice ? Number(orderItemPrice) : null,
                                  detail_image: null,
                                }));
                                
                                Alert.alert('已刪除', '明細照片已刪除');
                              } catch (error) {
                                console.error('刪除明細照片失敗:', error);
                                Alert.alert('刪除失敗', '請稍後再試');
                              } finally {
                                setLoading(false);
                              }
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                    <Text style={styles.deleteImageText}>刪除照片</Text>
                  </TouchableOpacity>
                  <Text style={styles.detailHint}>
                    參與此訂單的用戶會在「參與訂單」中看到此照片。
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* 刪除訂單按鈕 */}
        <View style={styles.deleteSection}>
          <TouchableOpacity 
            style={styles.deleteOrderButton}
            onPress={handleDeleteOrder}
            disabled={loading}
          >
            <MaterialIcons name="delete-forever" size={24} color="#fff" />
            <Text style={styles.deleteOrderButtonText}>刪除歷史訂單</Text>
          </TouchableOpacity>
          <Text style={styles.deleteHint}>
            刪除後此訂單將從系統中永久移除，此操作無法復原
          </Text>
        </View>

        {/* 統計資訊 */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>統計資訊</Text>
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{commenters.length}</Text>
              <Text style={styles.statLabel}>總留言數</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{commenters.filter(c => c.accepted).length}</Text>
              <Text style={styles.statLabel}>已接單</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{commenters.filter(c => c.status === 'delivering').length}</Text>
              <Text style={styles.statLabel}>配送中</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {commenters.filter(c => c.status === 'arrived' || c.status === 'completed').length}
              </Text>
              <Text style={styles.statLabel}>已到貨</Text>
            </View>
          </View>
        </View>

        {/* 批量操作 - 當有已接單但未配送的訂單時顯示 */}
        {hasAcceptedButNotDelivering && (
          <View style={styles.bulkActionSection}>
            <Text style={styles.sectionTitle}>批量操作</Text>
            <TouchableOpacity 
              style={styles.bulkDeliveryButton}
              onPress={handleStartDeliveryAll}
              disabled={loading}
            >
              <MaterialIcons name="local-shipping" size={24} color="#fff" />
              <Text style={styles.bulkDeliveryButtonText}>開始配送所有訂單</Text>
            </TouchableOpacity>
            <Text style={styles.bulkActionHint}>
              點擊後所有已接單的訂單狀態將變更為「配送中」，並出現「通知到貨」按鈕
            </Text>
          </View>
        )}

        {/* 留言者管理 */}
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
      </ScrollView>

      {/* 忽略原因輸入模態框 */}
      <Modal
        visible={showIgnoreModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowIgnoreModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>輸入忽略原因</Text>
            <Text style={styles.modalSubtitle}>
              請說明為什麼要忽略 {currentIgnoreCommenter?.name} 的訂單，留言者將收到通知
            </Text>
            
            <TextInput
              style={styles.reasonInput}
              placeholder="請輸入忽略原因..."
              placeholderTextColor="#999"
              value={ignoreReason}
              onChangeText={setIgnoreReason}
              multiline={true}
              numberOfLines={4}
              textAlignVertical="top"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowIgnoreModal(false);
                  setIgnoreReason('');
                  setCurrentIgnoreCommenter(null);
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.confirmButton, !ignoreReason.trim() && styles.disabledButton]}
                onPress={confirmIgnoreOrder}
                disabled={!ignoreReason.trim() || loading}
              >
                <Text style={styles.confirmButtonText}>確認忽略</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 全屏圖片 Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowImageModal(false);
          setImageError(false);
          setImageLoading(false);
        }}
      >
        <View style={styles.imageModalContainer}>
          <TouchableOpacity
            style={styles.imageModalCloseButton}
            onPress={() => {
              setShowImageModal(false);
              setImageError(false);
              setImageLoading(false);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.imageModalCloseButtonInner}>
              <Ionicons name="close" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
          
          {imageLoading && !imageError && (
            <View style={styles.imageLoadingContainer}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.imageLoadingText}>載入圖片中...</Text>
            </View>
          )}
          
          {imageError && (
            <View style={styles.imageErrorContainer}>
              <Ionicons name="alert-circle" size={64} color="#fff" />
              <Text style={styles.imageErrorText}>圖片載入失敗</Text>
              <Text style={styles.imageErrorSubtext}>請檢查網路連線或圖片路徑</Text>
            </View>
          )}
          
          {orderDetailImage && !imageError && (
            <Image
              source={{ uri: orderDetailImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
              onLoadStart={() => {
                setImageLoading(true);
                setImageError(false);
              }}
              onLoadEnd={() => {
                setImageLoading(false);
              }}
              onError={(error) => {
                console.error('全屏圖片載入失敗:', error);
                setImageLoading(false);
                setImageError(true);
              }}
            />
          )}
          
          {/* 點擊背景關閉 Modal */}
          <TouchableOpacity
            style={styles.imageModalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setShowImageModal(false);
              setImageError(false);
              setImageLoading(false);
            }}
          />
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingTop: Platform.OS === 'ios' ? 44 : 8, // 適配狀態欄
  },
  headerTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    width: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingVertical: 16,
  },
  orderSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  orderCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  orderLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  orderContact: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  orderLine: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  orderPayment: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  orderNote: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  statsSection: {
    marginBottom: 20,
  },
  statsCard: {
    backgroundColor: '#fff',
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  statItem: {
    alignItems: 'center',
    minWidth: screenWidth / 4 - 20, // 確保每個統計項目有足夠空間
    marginVertical: 4,
  },
  statNumber: {
    fontSize: isSmallScreen ? 20 : 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: isSmallScreen ? 10 : 12,
    color: '#666',
    textAlign: 'center',
  },
  bulkActionSection: {
    marginBottom: 20,
  },
  bulkDeliveryButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
  },
  bulkDeliveryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  bulkActionHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  commentersSection: {
    marginBottom: 20,
  },
  commentersList: {
    marginTop: 8,
  },
  commenterCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: isSmallScreen ? 12 : 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginHorizontal: isSmallScreen ? 2 : 0,
  },
  commenterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 40, // 確保有足夠高度
  },
  commenterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: isSmallScreen ? 12 : 16, // 增加右邊距，給狀態標籤更多空間
  },
  commenterName: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  commenterDetails: {
    flex: 1,
    marginLeft: 8,
    flexShrink: 1, // 允許在必要時收縮
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
    paddingHorizontal: isSmallScreen ? 10 : 12,
    paddingVertical: isSmallScreen ? 6 : 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    alignSelf: 'flex-start',
    minWidth: isSmallScreen ? 60 : 70, // 確保有足夠寬度顯示文字
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: isSmallScreen ? 11 : 12,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 0, // 防止文字被壓縮
  },
  commentText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  itemInfoBox: {
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  itemInfoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  itemsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  itemInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  itemInfoQty: {
    color: '#007AFF',
    fontWeight: '700',
  },
  itemSeparator: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 4,
  },
  contactInfoBox: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginBottom: 12,
    gap: 6,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontSize: 13,
    color: '#666',
  },
  commenterActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isSmallScreen ? 8 : 12,
    paddingVertical: isSmallScreen ? 6 : 8,
    borderRadius: 8,
    minWidth: isSmallScreen ? screenWidth / 3 - 20 : 80,
    justifyContent: 'center',
    marginBottom: 8,
    flex: isSmallScreen ? 0.48 : 0, // 小螢幕時讓按鈕佔據更多空間
  },
  actionButtonText: {
    fontSize: isSmallScreen ? 10 : 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  deliveryButton: {
    backgroundColor: '#FF9500',
  },
  arrivalButton: {
    backgroundColor: '#34C759',
  },
  completeButton: {
    backgroundColor: '#8E8E93',
  },
  reviewButton: {
    backgroundColor: '#FF9500',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  ignoreButton: {
    backgroundColor: '#F44336',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  // 模態框樣式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
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
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
    minHeight: 100,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#F44336',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  disabledButton: {
    opacity: 0.6,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // 刪除訂單區塊樣式
  deleteSection: {
    marginBottom: 30,
    marginTop: 20,
  },
  deleteOrderButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#F44336',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  deleteOrderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  deleteHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 10,
  },
  // 商品清單彙總樣式
  itemSummarySection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  itemSummaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  itemSummaryList: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemSummaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  itemSummaryName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  itemSummaryQty: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 12,
  },
  itemSummaryHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  // 代購明細與金額（整張訂單共用）樣式
  detailSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#FAFAFA',
    marginBottom: 8,
  },
  detailButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 8,
  },
  pickImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 0.52,
  },
  pickImageButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  saveDetailButton: {
    flex: 0.48,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDetailButtonText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  // 商品金額試算樣式
  itemsPriceList: {
    marginTop: 8,
  },
  itemPriceRow: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemPriceInfo: {
    marginBottom: 8,
  },
  itemPriceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  itemPriceQty: {
    fontSize: 14,
    color: '#666',
    fontWeight: '400',
  },
  itemPriceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  itemPriceLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  itemPriceInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
    minWidth: 80,
    textAlign: 'right',
  },
  itemPriceUnit: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 12,
  },
  totalAmountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#007BFF',
    backgroundColor: '#F0F7FF',
    padding: 12,
    borderRadius: 8,
  },
  totalAmountLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalAmountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007BFF',
  },
  detailHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  // 圖片預覽樣式
  imagePreviewSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  imagePreviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
    marginBottom: 8,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imagePreviewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreviewHint: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageErrorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageErrorText: {
    marginTop: 8,
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  deleteImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFE0E0',
    marginBottom: 8,
  },
  deleteImageText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  // 全屏圖片 Modal 樣式
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
  },
  imageModalCloseButtonInner: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    zIndex: 1,
  },
  imageLoadingContainer: {
    position: 'absolute',
    zIndex: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageLoadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  imageErrorContainer: {
    position: 'absolute',
    zIndex: 5,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  imageErrorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  imageErrorSubtext: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
