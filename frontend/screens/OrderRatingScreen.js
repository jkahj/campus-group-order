import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { updateUserCreditScore, CREDIT_RULES } from '../utils/creditScoreManager';
import apiService from '../utils/apiService';
import { AuthManager } from '../utils/authManager';

export default function OrderRatingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { orderInfo, commenterInfo, isFromPurchaser } = route.params || {};

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [existingReview, setExistingReview] = useState(null);

  useEffect(() => {
    if (!orderInfo || !commenterInfo) {
      Alert.alert('錯誤', '缺少必要的訂單或留言者資訊');
      navigation.goBack();
      return;
    }
    
    // 檢查是否已經評價過
    checkExistingRating();
  }, [orderInfo, commenterInfo, navigation, isFromPurchaser]);

  const transformBackendReview = (review) => {
    if (!review) return null;
    return {
      id: review.id,
      reviewerId: review.reviewer_id,
      reviewerName: review.reviewer_name,
      rating: review.rating,
      comment: review.comment,
      timestamp: review.timestamp,
      orderId: review.order_id,
      orderName: review.order_name,
      orderLocation: review.order_location,
      orderContact: review.order_contact,
      isFromPurchaser: review.is_from_purchaser,
    };
  };

  const normalizeUserId = (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const lowered = trimmed.toLowerCase();
    if (['me', 'self', 'unknown', 'none', 'null'].includes(lowered)) {
      return null;
    }
    if (trimmed.startsWith('comment_') || trimmed.startsWith('temp_')) {
      return null;
    }
    return trimmed;
  };

  const resolveReviewContext = async () => {
    const currentUser = await AuthManager.getCurrentUser();
    const currentUserId = currentUser?.id || 'me';
    const currentUserName = currentUser?.name || '我';
    
    // 確保 isFromPurchaser 是布林值
    // 從路由參數獲取，如果未傳遞或為 false，但在「評價代購服務」畫面中，應該為 true
    // 判斷邏輯：如果有 commenterInfo 且沒有明確設置為 false，則默認為 true（發起者評價留言者）
    let isFromPurchaserFlag = Boolean(isFromPurchaser);
    if (isFromPurchaser === undefined || isFromPurchaser === null) {
      // 如果未傳遞，默認為 true（發起者評價留言者）
      isFromPurchaserFlag = true;
    }
    
    console.log('🔍 resolveReviewContext 開始:', {
      isFromPurchaser,
      isFromPurchaserFlag,
      commenterInfo: commenterInfo ? { id: commenterInfo.id, commenterId: commenterInfo.commenterId, originalCommentId: commenterInfo.originalCommentId } : null,
      orderInfo: orderInfo ? { id: orderInfo.id, created_by: orderInfo.created_by } : null
    });
    
    // 獲取留言 ID（用於從後端 API 查詢留言的真實 commenter_id）
    // 優先使用 originalCommentId，這是從 OrderCompletionScreen 傳遞的原始留言 ID
    // 這是後端用來查找 comments.commenter_id 的關鍵，必須是資料庫中的真實留言 ID
    const commentId = commenterInfo?.originalCommentId || commenterInfo?.commentId || commenterInfo?.id;
    
    // 驗證並修正 commentId（確保是資料庫中的真實留言 ID，不是臨時生成的）
    let finalCommentId = commentId;
    if (commentId && (String(commentId).includes('_index') || String(commentId).startsWith('comment_'))) {
      console.warn('⚠️ 檢測到可能的臨時 ID，嘗試從本地留言數據獲取真實 ID');
      // 嘗試從本地留言數據獲取真實的留言 ID
      try {
        const commentsData = JSON.parse(await AsyncStorage.getItem('comments') || '{}');
        const orderComments = commentsData[orderInfo?.id] || [];
        const matchedComment = orderComments.find(
          c => c.commenterId === commenterInfo?.commenterId || 
               c.id === commenterInfo?.id ||
               (c.commenterId && String(c.commenterId) === String(commenterInfo?.commenterId))
        );
        if (matchedComment && matchedComment.id && !String(matchedComment.id).includes('_index')) {
          console.log('✅ 從本地留言數據獲取真實留言 ID:', matchedComment.id);
          finalCommentId = matchedComment.id; // 使用真實的留言 ID
        }
      } catch (error) {
        console.warn('從本地留言數據獲取真實 ID 失敗:', error);
      }
    }
    
    // 注意：commenterInfo.id 可能是生成的臨時 ID（如 "commenterId_index"），不是真實的 user_id
    // commenterInfo.commenterId 也可能是錯誤的或臨時的 ID
    // 所以我們不應該直接使用這些字段作為留言者的真實 user_id
    // 應該優先從後端 API 或本地留言數據中獲取真實的 commenter_id
    // 候選留言者 ID（優先順序：actualUserId > commenter_id > commenterId > userId）
    // 注意：不應該使用 commenterInfo.id，因為它可能是生成的臨時 ID
    const commenterCandidateIds = [
      commenterInfo?.actualUserId, // 實際用戶 ID（從後端獲取的真實 user_id）
      commenterInfo?.commenter_id, // 留言者 ID（從後端獲取的 commenter_id）
      commenterInfo?.commenterId,  // 留言者 ID（可能是錯誤的或臨時的）
      commenterInfo?.userId,       // 用戶 ID（備用）
    ];
    
    if (isFromPurchaserFlag) {
      // 代購者評價留言者
      // target_user_id 應該是留言者的 user_id (commenter_id)
      // reviewer_id 應該是代購者本身的 user_id (order.created_by)
      
      // 驗證當前用戶是否為訂單發起者
      const orderCreatedBy = orderInfo?.created_by || orderInfo?.createdBy || orderInfo?.creatorId || orderInfo?.createdById;
      const normalizedCurrentUserId = normalizeUserId(currentUserId);
      const normalizedOrderCreatedBy = normalizeUserId(orderCreatedBy);
      
      // 如果當前用戶 ID 與訂單發起者 ID 不一致，記錄警告
      if (normalizedCurrentUserId && normalizedOrderCreatedBy && normalizedCurrentUserId !== normalizedOrderCreatedBy) {
        console.warn('⚠️ 當前用戶 ID 與訂單發起者 ID 不一致:', {
          currentUserId: normalizedCurrentUserId,
          orderCreatedBy: normalizedOrderCreatedBy
        });
      }
      
      let resolvedTargetUserId = null;
      
      // 優先從後端 API 獲取留言的真實 commenter_id
      // 這是獲取留言者真實 user_id 的最可靠方式，因為後端直接從 comments.commenter_id 返回
      if (finalCommentId && orderInfo?.id) {
        try {
          // 嘗試從後端 API 獲取留言信息
          const comment = await apiService.getComment(finalCommentId);
          if (comment) {
            // 優先使用 commenter_id（這是 comments 資料表中的真實 commenter_id）
            // 這是關鍵：必須使用 comment.commenter_id，而不是 comment.commenterId
            const commenterIdFromBackend = comment.commenter_id || comment.commenterId;
            if (commenterIdFromBackend) {
              const normalized = normalizeUserId(commenterIdFromBackend);
              const normalizedCurrent = normalizeUserId(currentUserId);
              const orderCreatedBy = orderInfo?.created_by || orderInfo?.createdBy || orderInfo?.creatorId || orderInfo?.createdById;
              const normalizedOrderCreatedBy = normalizeUserId(orderCreatedBy);
              
              // 確保 commenter_id 不等於當前用戶（發起者）或訂單發起者
              if (normalized && normalized !== normalizedCurrent && normalized !== normalizedOrderCreatedBy) {
                resolvedTargetUserId = normalized;
                console.log('✅ 從後端 API 獲取留言者真實 user_id (comments.commenter_id):', resolvedTargetUserId);
                console.log('留言資訊:', {
                  commentId: comment.id,
                  commenter_id: comment.commenter_id,
                  commenterId: comment.commenterId,
                  commenter_name: comment.commenter_name || comment.commenterName,
                  '驗證': {
                    'commenter_id 不等於 currentUserId': normalized !== normalizedCurrent,
                    'commenter_id 不等於 order.created_by': normalized !== normalizedOrderCreatedBy
                  }
                });
              } else {
                console.warn('⚠️ 從後端獲取的 commenter_id 無效或等於當前用戶/訂單發起者:', {
                  commenterIdFromBackend,
                  normalized,
                  currentUserId: normalizedCurrent,
                  orderCreatedBy: normalizedOrderCreatedBy,
                  'comment.commenter_id': comment.commenter_id,
                  'comment.commenterId': comment.commenterId
                });
              }
            } else {
              console.warn('⚠️ 後端返回的留言沒有 commenter_id:', {
                comment: comment,
                'comment.commenter_id': comment.commenter_id,
                'comment.commenterId': comment.commenterId
              });
            }
          }
        } catch (apiError) {
          console.log('從後端 API 獲取留言失敗，嘗試其他方式:', apiError?.message || apiError);
        }
      }

      // 如果後端沒有，嘗試從本地留言數據中獲取
      // 優先順序：commenter_id > actualUserId > commenterId（commenter_id 是從後端同步的真實值）
      if (!resolvedTargetUserId && orderInfo?.id && finalCommentId) {
        try {
          const commentsData = JSON.parse(await AsyncStorage.getItem('comments') || '{}');
          const orderComments = commentsData[orderInfo.id] || [];
          const matchedComment = orderComments.find(
            existingComment =>
              existingComment.id === finalCommentId ||
              existingComment.originalCommentId === finalCommentId
          );
          if (matchedComment) {
            // 優先使用 commenter_id（這是從後端同步的真實 commenter_id），然後使用 actualUserId，最後使用 commenterId
            // 注意：commenterId 可能是錯誤的或臨時的 ID，不應該優先使用
            const normalized = normalizeUserId(matchedComment.commenter_id) || 
                              normalizeUserId(matchedComment.actualUserId) || 
                              normalizeUserId(matchedComment.commenterId);
            if (normalized && normalized !== normalizeUserId(currentUserId)) {
              // 確保不會使用當前用戶（發起者）的 ID
              resolvedTargetUserId = normalized;
              console.log('✅ 從本地留言數據獲取留言者 user_id:', resolvedTargetUserId, {
                commenter_id: matchedComment.commenter_id,
                actualUserId: matchedComment.actualUserId,
                commenterId: matchedComment.commenterId
              });
            } else {
              console.warn('⚠️ 從本地獲取的 commenter_id 無效或等於當前用戶:', {
                normalized,
                currentUserId,
                matchedComment: {
                  commenter_id: matchedComment.commenter_id,
                  actualUserId: matchedComment.actualUserId,
                  commenterId: matchedComment.commenterId
                }
              });
            }
          }
        } catch (targetResolveError) {
          console.log('從本地留言數據解析留言者用戶ID失敗:', targetResolveError?.message || targetResolveError);
        }
      }

      // 如果還是沒有，嘗試從 commenterInfo 中獲取
      // 注意：commenterInfo 中的字段可能不可靠，應該最後才使用
      if (!resolvedTargetUserId) {
        // 優先使用 actualUserId，然後使用 commenter_id，最後使用 commenterId
        for (const candidate of commenterCandidateIds) {
          const normalized = normalizeUserId(candidate);
          if (normalized && normalized !== normalizeUserId(currentUserId)) {
            // 確保不會使用當前用戶（發起者）的 ID
            resolvedTargetUserId = normalized;
            console.log('✅ 從 commenterInfo 獲取留言者 user_id:', resolvedTargetUserId);
            break;
          }
        }
      }

      // 最終驗證：確保 targetUserId 不等於 reviewerId（代購者自己）
      if (resolvedTargetUserId && normalizeUserId(resolvedTargetUserId) === normalizeUserId(currentUserId)) {
        console.error('⚠️ 錯誤：targetUserId 等於 reviewerId（代購者自己），無法評價自己');
        resolvedTargetUserId = null;
      }

      // 如果仍然無法解析留言者的真實 user_id，記錄錯誤
      if (!resolvedTargetUserId) {
        console.error('⚠️ 無法解析留言者的真實 user_id，將依賴後端根據 comment_id 自動修正');
        console.error('commenterInfo:', commenterInfo);
        console.error('finalCommentId:', finalCommentId);
        console.error('commenterCandidateIds:', commenterCandidateIds);
      }

      // 代購者評價留言者
      // 注意：即使 resolvedTargetUserId 為 null，後端 API 會根據 comment_id 自動從 comments.commenter_id 獲取
      // 使用 order.created_by 作為 reviewerId，確保與後端一致
      const reviewerIdToUse = normalizedOrderCreatedBy || normalizedCurrentUserId || currentUserId;
      
      // 最終驗證：確保 targetUserId 不等於 reviewerId（不能評價自己）
      if (resolvedTargetUserId && normalizeUserId(resolvedTargetUserId) === normalizeUserId(reviewerIdToUse)) {
        console.error('⚠️ 錯誤：targetUserId 等於 reviewerId（不能評價自己）:', {
          targetUserId: resolvedTargetUserId,
          reviewerId: reviewerIdToUse
        });
        resolvedTargetUserId = null; // 設為 null，讓後端從 comment_id 獲取
      }
      
      return {
        currentUserId,
        currentUserName,
        reviewerId: reviewerIdToUse, // 評價者：使用 order.created_by（如果可用），否則使用 currentUserId，後端會強制修正為 order.created_by
        reviewerName: currentUserName || '代購發起者',
        targetUserId: resolvedTargetUserId || null, // 被評價者：留言者（如果無法解析，後端會根據 comment_id 自動從 comments.commenter_id 獲取）
        targetUserName: commenterInfo?.commenterName || commenterInfo?.name || '留言者',
        commentId: finalCommentId, // 關鍵：必須傳遞有效的 comment_id，後端會從 comments.commenter_id 獲取留言者的真實 user_id
        isFromPurchaserFlag: isFromPurchaserFlag, // 使用正確的布林值
      };
    }
    
    // 留言者評價代購者
    return {
      currentUserId,
      currentUserName,
      reviewerId: currentUserId,
      reviewerName: currentUserName || commenterInfo?.commenterName || commenterInfo?.name || '留言者',
      targetUserId: orderInfo?.created_by || orderInfo?.createdBy || orderInfo?.creatorId || orderInfo?.createdById || 'me',
      targetUserName: orderInfo?.creatorName || orderInfo?.createdByName || orderInfo?.ownerName || '代購發起者',
      commentId: finalCommentId, // 使用修正後的 commentId
      isFromPurchaserFlag: false,
    };
  };

  // 檢查是否已經評價過
  const checkExistingRating = async () => {
    try {
      const context = await resolveReviewContext();
      if (!context?.reviewerId) {
        console.log('無法解析評價者ID，暫停已評價檢查', context);
        return;
      }

      // 如果 targetUserId 為 null（代購者評價留言者，但無法解析留言者ID），
      // 仍然可以通過 reviewerId 和 orderId 查詢評價
      // 因為後端會根據 comment_id 自動修正 target_user_id
      const targetUserIdForQuery = context.targetUserId;

      // 優先從後端查詢
      if (targetUserIdForQuery) {
        try {
          const backendResponse = await apiService.getReviewsByUser(targetUserIdForQuery);
          const backendReviews = Array.isArray(backendResponse)
            ? backendResponse
            : Array.isArray(backendResponse?.reviews)
              ? backendResponse.reviews
              : [];
          
          const existingBackendReview = backendReviews.find(review =>
            review?.reviewer_id === context.reviewerId && review?.order_id === orderInfo?.id
          );
          
          if (existingBackendReview) {
            const transformed = transformBackendReview(existingBackendReview);
            if (transformed) {
              setHasRated(true);
              setExistingReview(transformed);
              setRating(transformed.rating);
              setComment(transformed.comment || '');
              console.log('在後端找到已存在的評價:', transformed);
              return;
            }
          }
        } catch (apiError) {
          console.log('查詢後端評價失敗，將使用本地資料備援:', apiError?.message || apiError);
        }
      }

      // 後端沒有資料時，使用本地備援資料
      if (targetUserIdForQuery) {
        const userReviews = JSON.parse(await AsyncStorage.getItem('userReviews')) || {};
        const localReviews = userReviews[targetUserIdForQuery] || [];
        const existingLocalReview = localReviews.find(review =>
          review.reviewerId === context.reviewerId && review.orderId === orderInfo?.id
        );

        if (existingLocalReview) {
          setHasRated(true);
          setExistingReview(existingLocalReview);
          setRating(existingLocalReview.rating);
          setComment(existingLocalReview.comment || '');
          console.log('在本地資料找到已存在的評價:', existingLocalReview);
          return;
        }
      }

      // 如果無法確定 targetUserId，但仍然需要檢查是否評價過，
      // 可以通過 reviewerId 和 orderId 在所有評價中查找
      // 但這種情況應該很少見，因為後端會自動修正 target_user_id
      setHasRated(false);
      setExistingReview(null);
      console.log('尚未評價過（或無法確定 targetUserId）');
    } catch (error) {
      console.error('檢查評價狀態失敗:', error);
    }
  };

  // 渲染星星評分
  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => !hasRated && setRating(i)} // 已評價時不可點擊
          style={[styles.starButton, hasRated && styles.disabledStar]}
        >
          <MaterialIcons
            name={i <= rating ? 'star' : 'star-outline'}
            size={40}
            color={i <= rating ? '#FFD700' : '#D3D3D3'}
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  // 獲取評分描述
  const getRatingDescription = (rating) => {
    switch (rating) {
      case 5: return '非常滿意';
      case 4: return '滿意';
      case 3: return '普通';
      case 2: return '不滿意';
      case 1: return '非常不滿意';
      default: return '';
    }
  };

  // 提交評價
  const submitRating = async () => {
    if (hasRated) {
      Alert.alert('提示', '您已經評價過此訂單');
      return;
    }
    
    if (!String(comment || '').trim()) {
      Alert.alert('請填寫評價', '請輸入您的評價內容');
      return;
    }

    setShowConfirmModal(true);
  };

  // 確認提交評價
  const confirmSubmitRating = async () => {
    try {
      setLoading(true);
      const context = await resolveReviewContext();
      
      // 驗證必要的資料
      if (!context?.reviewerId) {
        Alert.alert('資料不足', '無法識別評價者，請稍後再試');
        setShowConfirmModal(false);
        setLoading(false);
        return;
      }

      const {
        reviewerId,
        reviewerName,
        targetUserId,
        targetUserName,
        commentId,
        isFromPurchaserFlag,
      } = context;
      
      // 當代購者評價留言者時，必須提供 comment_id
      if (isFromPurchaserFlag && !commentId) {
        Alert.alert('資料不足', '無法識別留言者，請提供留言 ID。請返回訂單頁面重新操作。');
        setShowConfirmModal(false);
        setLoading(false);
        return;
      }

      // 驗證 targetUserId（如果是代購者評價留言者，後端會根據 comment_id 自動修正）
      // 重要：當 isFromPurchaserFlag=true 時，如果 targetUserId 為 null，後端會根據 comment_id 自動從 comments.commenter_id 獲取
      // 前端驗證只在 targetUserId 明確存在且等於 reviewerId 時才報錯
      // 但如果 targetUserId 為 null，不要阻止提交，讓後端處理
      if (isFromPurchaserFlag && targetUserId) {
        const normalizedTarget = normalizeUserId(targetUserId);
        const normalizedReviewer = normalizeUserId(reviewerId);
        // 獲取訂單發起者 ID 進行比較
        const orderCreatedBy = orderInfo?.created_by || orderInfo?.createdBy || orderInfo?.creatorId || orderInfo?.createdById;
        const normalizedOrderCreatedBy = normalizeUserId(orderCreatedBy);
        
        // 如果 targetUserId 等於 reviewerId 或 order.created_by，說明有問題
        if (normalizedTarget && normalizedReviewer && normalizedTarget === normalizedReviewer) {
          console.warn('⚠️ 前端檢測到 targetUserId 等於 reviewerId，將設為 null 讓後端處理');
          // 不阻止提交，而是將 targetUserId 設為 null，讓後端從 comment_id 獲取
          // 這裡不修改 context，因為已經解構了，我們會在 payload 中處理
        } else if (normalizedTarget && normalizedOrderCreatedBy && normalizedTarget === normalizedOrderCreatedBy) {
          console.warn('⚠️ 前端檢測到 targetUserId 等於 order.created_by，將設為 null 讓後端處理');
          // 不阻止提交，而是將 targetUserId 設為 null，讓後端從 comment_id 獲取
        }
      }
      
      // 當 isFromPurchaserFlag=true 時，必須提供有效的 comment_id
      // 後端會根據 comment_id 自動從 comments.commenter_id 獲取留言者的真實 user_id
      if (isFromPurchaserFlag && !commentId) {
        Alert.alert('資料不足', '無法識別留言者，缺少留言 ID。請返回訂單頁面重新操作。');
        setShowConfirmModal(false);
        setLoading(false);
        return;
      }
      
      if (isFromPurchaserFlag && !targetUserId) {
        console.log('⚠️ 前端無法解析留言者 user_id，將依賴後端根據 comment_id 自動修正');
        console.log('commentId:', commentId);
        console.log('後端將從 comments.commenter_id 獲取留言者的真實 user_id');
      }
      
      const sanitizedComment = String(comment || '').trim();
      const reviewTimestamp = Date.now();
      
      // 準備評價物件（本地結構）
      const newReview = {
        id: `${reviewTimestamp}_${Math.random().toString(36).slice(2, 7)}`,
        reviewerId,
        reviewerName,
        rating,
        comment: sanitizedComment,
        timestamp: reviewTimestamp,
        orderId: orderInfo.id,
        orderName: orderInfo.name,
        orderLocation: orderInfo.address,
        orderContact: orderInfo.phone || orderInfo.contact,
        isFromPurchaser: isFromPurchaserFlag,
        targetUserId: targetUserId || null, // 如果為 null，後端會根據 comment_id 自動修正
        targetUserName,
        commentId, // 重要：必須傳遞 commentId
      };
      
      // 同步至後端 reviews/comments 資料表
      // 注意：後端會根據 is_from_purchaser 和 comment_id 自動修正 target_user_id 和 reviewer_id
      // 確保 is_from_purchaser 是布林值
      const isFromPurchaserBool = Boolean(isFromPurchaserFlag);
      
      // 當 isFromPurchaserFlag=true 時，如果 targetUserId 等於 reviewerId 或 order.created_by，設為 null
      // 讓後端從 comment_id 獲取正確的 commenter_id
      let finalTargetUserIdForPayload = targetUserId;
      if (isFromPurchaserFlag && targetUserId) {
        const normalizedTarget = normalizeUserId(targetUserId);
        const normalizedReviewer = normalizeUserId(reviewerId);
        const orderCreatedBy = orderInfo?.created_by || orderInfo?.createdBy || orderInfo?.creatorId || orderInfo?.createdById;
        const normalizedOrderCreatedBy = normalizeUserId(orderCreatedBy);
        
        if ((normalizedTarget && normalizedReviewer && normalizedTarget === normalizedReviewer) ||
            (normalizedTarget && normalizedOrderCreatedBy && normalizedTarget === normalizedOrderCreatedBy)) {
          console.log('⚠️ 前端檢測到 targetUserId 與 reviewerId 或 order.created_by 重複，設為 null 讓後端處理');
          finalTargetUserIdForPayload = null; // 設為 null，讓後端從 comment_id 獲取
        }
      }
      
      const reviewPayload = {
        id: newReview.id,
        target_user_id: finalTargetUserIdForPayload || null, // 如果為 null，後端會根據 comment_id 自動從 comments.commenter_id 獲取
        reviewer_id: reviewerId, // 後端會根據 is_from_purchaser=true 強制修正為 order.created_by
        reviewer_name: reviewerName,
        rating: newReview.rating,
        comment: sanitizedComment,
        order_id: newReview.orderId,
        order_name: newReview.orderName,
        order_location: newReview.orderLocation,
        order_contact: newReview.orderContact,
        is_from_purchaser: isFromPurchaserBool, // 確保是布林值，true 表示發起者評價留言者
        timestamp: newReview.timestamp,
        comment_id: commentId, // 關鍵：必須傳遞有效的 comment_id，後端會從 comments.commenter_id 獲取留言者的真實 user_id 作為 target_user_id
      };
      
      // 驗證關鍵參數
      if (isFromPurchaserFlag && !commentId) {
        console.error('❌ 缺少 commentId，無法提交評價:', {
          isFromPurchaserFlag,
          commentId,
          commenterInfo,
          orderInfo: {
            id: orderInfo?.id,
            name: orderInfo?.name,
          }
        });
        Alert.alert('資料錯誤', '缺少留言 ID，無法識別被評價者。請返回訂單頁面重新操作。');
        setShowConfirmModal(false);
        setLoading(false);
        return;
      }
      
      // 確保 comment_id 不為空字串或無效值
      const validCommentId = commentId && String(commentId).trim() && String(commentId).trim() !== 'null' && String(commentId).trim() !== 'undefined' 
        ? String(commentId).trim() 
        : null;
      
      if (isFromPurchaserFlag && !validCommentId) {
        console.error('❌ commentId 無效:', {
          originalCommentId: commentId,
          validCommentId,
          commenterInfo,
        });
        Alert.alert('資料錯誤', '留言 ID 無效，無法識別被評價者。請返回訂單頁面重新操作。');
        setShowConfirmModal(false);
        setLoading(false);
        return;
      }
      
      // 更新 reviewPayload 中的 comment_id
      reviewPayload.comment_id = validCommentId;
      
      console.log('準備提交評價到後端:', {
        ...reviewPayload,
        comment_id: validCommentId, // 確保 comment_id 已傳遞且有效
        is_from_purchaser: isFromPurchaserBool,
        '評價者 (reviewer_id)': reviewerId,
        '被評價者 (target_user_id)': finalTargetUserIdForPayload || '將由後端根據 comment_id 自動設定',
        '訂單發起者 (order.created_by)': orderInfo?.created_by || orderInfo?.createdBy || '未知',
        '說明': isFromPurchaserFlag ? '後端會將 reviewer_id 強制設為 order.created_by，target_user_id 從 comment_id 獲取 commenter_id' : '留言者評價代購者',
      });
      
      let backendReviewResponse = null;
      try {
        backendReviewResponse = await apiService.createReview(reviewPayload);
        console.log('✅ 評價已同步至後端 reviews/comments 表');
        console.log('後端返回的評價資料:', backendReviewResponse);
        
        // 如果後端返回了評價資料，使用後端返回的資料（包含後端自動修正的 target_user_id）
        if (backendReviewResponse) {
          const backendTargetUserId = backendReviewResponse.target_user_id || backendReviewResponse.targetUserId;
          if (backendTargetUserId) {
            // 使用後端返回的 target_user_id 更新 newReview
            newReview.targetUserId = backendTargetUserId;
            console.log('✅ 使用後端返回的 target_user_id:', backendTargetUserId);
          }
        }
      } catch (syncErr) {
        console.log('⚠️ 同步後端 reviews 失敗（保留本地紀錄，稍後可重試）:', syncErr?.message || syncErr);
      }
      
      // 更新本地快取（維持既有流程）
      // 使用後端返回的 target_user_id（如果有的話），否則使用前端解析的 targetUserId
      const finalTargetUserIdForStorage = newReview.targetUserId || targetUserId || 'pending';
      const userReviews = JSON.parse(await AsyncStorage.getItem('userReviews')) || {};
      if (!Array.isArray(userReviews[finalTargetUserIdForStorage])) {
        userReviews[finalTargetUserIdForStorage] = [];
      }
      const existingReviewIndex = userReviews[finalTargetUserIdForStorage].findIndex(review =>
        review.reviewerId === reviewerId && review.orderId === orderInfo.id
      );
      
      if (existingReviewIndex >= 0) {
        userReviews[finalTargetUserIdForStorage][existingReviewIndex] = newReview;
        console.log('更新現有評價:', newReview);
      } else {
        userReviews[finalTargetUserIdForStorage].push(newReview);
        console.log('新增評價:', newReview);
      }
      await AsyncStorage.setItem('userReviews', JSON.stringify(userReviews));
      
      // 更新評價狀態
      setHasRated(true);
      setExistingReview(newReview);
      
      console.log('提交評價後的 userReviews:', userReviews);
      console.log('新增的評價:', newReview);

      // 計算平均評分並更新用戶資料
      const targetUserReviews = userReviews[targetUserId || finalTargetUserIdForStorage];
      const totalRating = targetUserReviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = totalRating / targetUserReviews.length;
      
      // 更新用戶資料 - 直接更新當前用戶的資料
      const userData = JSON.parse(await AsyncStorage.getItem('userData')) || {};
      if (targetUserId === 'me') {
        // 如果是當前用戶，保留現有資料並更新評分相關欄位
        const updatedUserData = {
          ...userData, // 保留所有現有屬性
          rating: averageRating,
          reviewCount: targetUserReviews.length
        };
        await AsyncStorage.setItem('userData', JSON.stringify(updatedUserData));
      } else {
        // 如果是其他用戶，保持原有結構
        if (userData[targetUserId]) {
          userData[targetUserId].rating = averageRating;
          userData[targetUserId].reviewCount = targetUserReviews.length;
        } else {
          userData[targetUserId] = {
            username: targetUserName,
            location: '未知',
            rating: averageRating,
            reviewCount: targetUserReviews.length,
            creditScore: 100
          };
        }
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
      }

      // 更新信譽積分
      let creditScoreChange = 0;
      let creditAction = '';
      
      if (isFromPurchaserFlag) {
        // 代購者評價留言者
        if (rating >= 4) {
          creditScoreChange = CREDIT_RULES.participant.excellentFeedback;
          creditAction = '收到代購者好評';
        } else if (rating >= 3) {
          creditScoreChange = CREDIT_RULES.participant.goodFeedback;
          creditAction = '收到代購者評價';
        } else {
          creditScoreChange = CREDIT_RULES.participant.badFeedback;
          creditAction = '收到代購者差評';
        }
        
        // 給被評價的留言者加積分
        await updateUserCreditScore(targetUserId, creditScoreChange, creditAction, orderInfo.id);
        
        // 給評價者（代購者）加積分（鼓勵評價）
        await updateUserCreditScore(reviewerId, 2, '完成評價留言者', orderInfo.id);
      } else {
        // 留言者評價代購者
        if (rating >= 4) {
          creditScoreChange = CREDIT_RULES.initiator.excellentService;
          creditAction = '收到留言者好評';
        } else if (rating >= 3) {
          creditScoreChange = CREDIT_RULES.initiator.goodService;
          creditAction = '收到留言者評價';
        } else {
          creditScoreChange = CREDIT_RULES.initiator.poorService;
          creditAction = '收到留言者差評';
        }
        
        // 給被評價的代購者加積分
        await updateUserCreditScore(targetUserId, creditScoreChange, creditAction, orderInfo.id);
        
        // 給評價者（留言者）加積分（鼓勵評價）
        await updateUserCreditScore(reviewerId, 2, '完成評價代購者', orderInfo.id);
      }

      // 更新留言狀態為已完成（保留 items 和 item_price）
      const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
      const orderComments = comments[orderInfo.id] || [];
      const updatedComments = orderComments.map(existingComment => {
        const matchByCommenter = existingComment.commenterId === commenterInfo.commenterId;
        const matchById = existingComment.id === (commenterInfo.originalCommentId || commenterInfo.id);
        
        if (matchByCommenter || matchById) {
          return {
            ...existingComment,
            // 保留所有現有屬性，特別是 items 和 item_price
            items: existingComment.items || [],
            item_price: existingComment.item_price,
            itemPrice: existingComment.itemPrice,
            // 更新狀態和評價資訊
            deliveryStatus: 'completed',
            completed: true,
            completedTime: Date.now(),
            rating: rating,
            ratingComment: sanitizedComment
          };
        }
        return existingComment;
      });
      
      comments[orderInfo.id] = updatedComments;
      await AsyncStorage.setItem('comments', JSON.stringify(comments));
      
      // 同步更新後端留言狀態（保留 item_price）
      try {
        if (commentId) {
          // 先獲取現有留言的商品項目，確保不會丟失 item_price
          const currentComment = await apiService.getComment(commentId);
          const existingItems = currentComment?.items || [];
          
          // 更新留言狀態，同時保留商品項目和價格
          // 注意：如果 items 為空或 undefined，後端不會更新商品項目，這是正確的行為
          const updateData = {
            delivery_status: 'completed',
            completed: true,
            completed_time: Date.now(),
            rating: rating,
            rating_comment: sanitizedComment
          };
          
          // 只有在有商品項目時才傳遞 items，確保後端保留現有的 item_price
          if (existingItems.length > 0) {
            updateData.items = existingItems;
          }
          
          await apiService.updateComment(commentId, updateData, { user_id: commenterInfo.commenterId });
          
          console.log('✅ 留言狀態已同步到後端（保留商品價格）');
        }
      } catch (updateError) {
        console.warn('⚠️ 同步留言狀態到後端失敗（已保留本地更新）:', updateError?.message || updateError);
      }

      // 發送通知給被評價者（targetUserId）
      // 注意：後端已經自動創建通知，這裡是備份通知（如果後端通知失敗）
      // 如果 targetUserId 為 null，後端會根據 comment_id 自動獲取，所以這裡也嘗試發送
      if (targetUserId && targetUserId !== 'me') {
        try {
          const { createNotification } = require('../utils/notificationHelper');
          
          // 發送通知給被評價者（targetUserId 和 reviewerName 已從 context 解構）
          await createNotification({
            user_id: targetUserId, // 接收者用戶ID（被評價者）
            type: 'newRating',
            title: '收到新評價',
            body: `${reviewerName} 為您的代購「${orderInfo.name}」給出了 ${rating} 星評價`,
            order_id: orderInfo.id,
            commenter_id: reviewerId, // 評價者ID
            order_name: orderInfo.name,
            comment_id: commentId || null,
          });
          console.log('✅ 前端通知已發送（後端也會自動創建）');
        } catch (notifError) {
          // 前端通知失敗不影響評價流程，因為後端已經自動創建通知
          console.log('⚠️ 前端通知發送失敗（後端已自動創建通知，可忽略）:', notifError?.message || notifError);
        }
      } else {
        console.log('ℹ️ targetUserId 為空或為 "me"，跳過前端通知（後端已自動創建通知）');
      }

      setShowConfirmModal(false);
      
      Alert.alert(
        '評價成功',
        `感謝您的評價！\n\n您給出了 ${rating} 星評價：${getRatingDescription(rating)}\n\n評價已保存，${isFromPurchaser ? '留言者' : '發起者'}已收到通知。\n\n信譽積分已更新：\n• 被評價者：${creditScoreChange >= 0 ? '+' : ''}${creditScoreChange}分\n• 評價者：+2分`,
        [
          {
            text: '確定',
            onPress: () => {
              console.log('評價提交成功，返回個人檔案');
              // 直接導航到個人檔案，確保評價能正確顯示
              navigation.navigate('Main', { screen: 'Profile' });
            }
          }
        ]
      );
    } catch (error) {
      console.error('提交評價失敗:', error);
      Alert.alert('操作失敗', '評價提交失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  if (!orderInfo || !commenterInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
          <Text style={styles.errorText}>無效的評價資訊</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部導航 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isFromPurchaser ? '評價留言者' : '評價代購服務'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* 訂單資訊 */}
        <View style={styles.orderSection}>
          <Text style={styles.sectionTitle}>代購資訊</Text>
          <View style={styles.orderCard}>
            <Text style={styles.orderName}>{orderInfo.name}</Text>
            <Text style={styles.orderLocation}>📍地點：{orderInfo.address}</Text>
            <Text style={styles.orderContact}>📞電話：{orderInfo.phone || orderInfo.contact}</Text>
            {orderInfo.line && <Text style={styles.orderLine}>💬Line ID：{orderInfo.line}</Text>}
            <Text style={styles.orderPayment}>💰付款方式：{orderInfo.method || orderInfo.payment}</Text>
            {orderInfo.note && <Text style={styles.orderNote}>📝備註：{orderInfo.note}</Text>}
          </View>
        </View>

        {/* 被評價者資訊 */}
        <View style={styles.senderSection}>
          <Text style={styles.sectionTitle}>
            {isFromPurchaser ? '留言者資訊' : '代購發起者'}
          </Text>
          <View style={styles.senderCard}>
            <View style={styles.senderInfo}>
              <View style={styles.senderAvatar}>
                <MaterialIcons name="person" size={24} color="#666" />
              </View>
              <View style={styles.senderDetails}>
                <Text style={styles.senderName}>
                  {isFromPurchaser 
                    ? (commenterInfo.commenterName || commenterInfo.name || '留言者')
                    : '代購發起者'
                  }
                </Text>
                <Text style={styles.senderLocation}>
                  📍 {orderInfo.address}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 評分區域 */}
        <View style={styles.ratingSection}>
          <Text style={styles.sectionTitle}>服務評分</Text>
          <View style={styles.ratingCard}>
            <Text style={styles.ratingLabel}>
              {isFromPurchaser 
                ? '請為這位留言者的參與度評分：' 
                : '請為這次代購服務評分：'
              }
            </Text>
            <View style={styles.starsContainer}>
              {renderStars()}
            </View>
            <Text style={styles.ratingDescription}>
              {rating} 星 - {getRatingDescription(rating)}
            </Text>
          </View>
        </View>

        {/* 評價內容 */}
        <View style={styles.commentSection}>
          <Text style={styles.sectionTitle}>評價內容</Text>
          <View style={styles.commentCard}>
            <Text style={styles.commentLabel}>
              {isFromPurchaser 
                ? '請分享您對這位留言者的評價：' 
                : '請分享您的使用體驗：'
              }
            </Text>
            <TextInput
              style={styles.commentInput}
              placeholder={
                isFromPurchaser 
                  ? "請詳細描述您對這位留言者的評價，包括參與度、溝通品質、配合度等..."
                  : "請詳細描述您的代購體驗，包括服務品質、配送速度、商品狀況等..."
              }
              placeholderTextColor="#999"
              value={comment}
              onChangeText={setComment}
              multiline={true}
              numberOfLines={6}
              textAlignVertical="top"
            />
            <Text style={styles.commentHint}>
              💡 詳細的評價能幫助其他用戶做出更好的選擇
            </Text>
          </View>
        </View>

        {/* 提交按鈕 */}
        <View style={styles.submitSection}>
          <TouchableOpacity 
            style={[
              styles.submitButton, 
              loading && styles.disabledButton,
              hasRated && styles.ratedButton
            ]} 
            onPress={submitRating}
            disabled={loading || hasRated}
          >
            <MaterialIcons 
              name={hasRated ? "check-circle" : "star"} 
              size={20} 
              color="#fff" 
            />
            <Text style={styles.submitButtonText}>
              {loading ? '提交中...' : hasRated ? '已評價' : '提交評價'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 確認提交模態框 */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>確認提交評價</Text>
            <Text style={styles.modalMessage}>
              您確定要提交以下評價嗎？\n\n
              評分：{rating} 星 - {getRatingDescription(rating)}\n
              評價：{String(comment || '').trim() || '無'}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmSubmitRating}
              >
                <Text style={styles.confirmButtonText}>確認提交</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    width: 24,
  },
  content: {
    flex: 1,
    padding: 16,
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
  senderSection: {
    marginBottom: 20,
  },
  senderCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  senderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  senderDetails: {
    flex: 1,
  },
  senderName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  senderLocation: {
    fontSize: 14,
    color: '#666',
  },
  ratingSection: {
    marginBottom: 20,
  },
  ratingCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ratingLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  ratingDescription: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  commentSection: {
    marginBottom: 20,
  },
  commentCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  commentLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
    minHeight: 120,
    marginBottom: 8,
  },
  commentHint: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  submitSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 32,
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
  ratedButton: {
    backgroundColor: '#4CAF50', // 綠色表示已完成
  },
  disabledStar: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 18,
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.6,
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
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#f1f3f4',
  },
  confirmButton: {
    backgroundColor: '#FFD700',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
