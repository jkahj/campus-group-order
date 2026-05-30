import AuthManager from './authManager';
import {
  getUserCreditScore,
  getUserTier as fetchUserTierName,
  updateUserCreditScore
} from './creditScoreManager';

// 初始化標記，避免重複初始化
let isInitialized = false;
let initializationPromise = null;

// 初始化用戶信譽等級
export const initializeUserTiers = async () => {
  // 如果已經初始化過，直接返回
  if (isInitialized) {
    console.log('用戶信譽等級已初始化，跳過重複初始化');
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }
  try {
    initializationPromise = (async () => {
      const currentUser = await AuthManager.getCurrentUser?.();
      if (currentUser?.id) {
        try {
          const score = await getUserCreditScore(currentUser.id);
          const tier = await fetchUserTierName(currentUser.id);
          console.log('初始化用戶信譽等級:', currentUser.id, score, tier);
        } catch (error) {
          console.log('初始化當前用戶信譽等級失敗（略過不中斷流程）:', error?.message || error);
        }
      }

      isInitialized = true;
      initializationPromise = null;
      return {};
    })();
    return initializationPromise;
  } catch (error) {
    console.error('初始化用戶信譽等級失敗:', error);
    initializationPromise = null;
    return {};
  }
};

// 獲取用戶信譽等級
export const getUserTier = async (userId) => {
  try {
    const score = await getUserCreditScore(userId);
    const tier = await fetchUserTierName(userId);
    return { score, tier };
  } catch (error) {
    console.error('獲取用戶信譽等級失敗:', error);
    return { score: 0, tier: '掰咖' };
  }
};

// 更新用戶信譽等級
export const updateUserTier = async (userId, newScore) => {
  try {
    const currentScore = await getUserCreditScore(userId);
    const delta = newScore - currentScore;
    if (delta === 0) {
      const tier = await fetchUserTierName(userId);
      return { score: currentScore, tier };
    }
    const result = await updateUserCreditScore(userId, delta, '調整信譽積分');
    if (result) {
      return { score: result.score, tier: result.tier };
    }
    const fallbackTier = await fetchUserTierName(userId);
    return { score: newScore, tier: fallbackTier };
  } catch (error) {
    console.error('更新用戶信譽等級失敗:', error);
    return null;
  }
};

// 根據分數獲取等級信息
export const getTierInfo = (score) => {
  if (score >= 400) return { name: '咖皇', color: '#FFD700', icon: 'star' };
  if (score >= 300) return { name: '咖王', color: '#8B4513', icon: 'crown' };
  if (score >= 200) return { name: '團咖', color: '#4169E1', icon: 'users' };
  if (score >= 100) return { name: '買咖', color: '#FF8C00', icon: 'shopping-bag' };
  return { name: '掰咖', color: '#DC143C', icon: 'user-times' };
};

// 獲取等級顏色
export const getTierColor = (tierName) => {
  const tierColors = {
    '掰咖': '#DC143C',
    '買咖': '#FF8C00',
    '團咖': '#4169E1',
    '咖王': '#8B4513',
    '咖皇': '#FFD700',
  };
  return tierColors[tierName] || '#DC143C';
};

// 獲取接單建議
export const getOrderSuggestion = (score) => {
  if (score >= 200) {
    return {
      type: 'good',
      icon: 'checkmark-circle',
      color: '#4CAF50',
      text: '此用戶信譽良好，建議接單'
    };
  } else if (score >= 100) {
    return {
      type: 'warning',
      icon: 'information-circle',
      color: '#FF9800',
      text: '此用戶信譽一般，請謹慎考慮'
    };
  } else {
    return {
      type: 'danger',
      icon: 'warning',
      color: '#F44336',
      text: '此用戶信譽較低，建議拒絕接單'
    };
  }
};

