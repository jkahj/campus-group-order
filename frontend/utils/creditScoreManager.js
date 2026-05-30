import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './apiService';

const USER_TIERS_CACHE_KEY = 'userTiers';
const SCORE_HISTORY_CACHE_KEY = 'scoreHistory';
const TIER_HISTORY_CACHE_KEY = 'tierHistory';

const readUserTierCache = async () => {
  try {
    const raw = await AsyncStorage.getItem(USER_TIERS_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error('讀取本地信譽積分快取失敗:', error);
    return {};
  }
};

const writeUserTierCache = async (cache) => {
  try {
    await AsyncStorage.setItem(USER_TIERS_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('寫入本地信譽積分快取失敗:', error);
  }
};

const cacheUserTierData = async (userId, data) => {
  const cache = await readUserTierCache();
  cache[userId] = {
    score: data.score,
    tier: data.tier,
    lastUpdated: data.lastUpdated ?? Date.now()
  };
  await writeUserTierCache(cache);
};

const getCachedUserTierData = async (userId) => {
  const cache = await readUserTierCache();
  return cache[userId] || null;
};

const normalizeScoreValue = (value) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric) || !Number.isFinite(numeric)) {
    return 0;
  }
  return numeric;
};

const determineTierByScore = (score) => {
  const normalizedScore = normalizeScoreValue(score);
  for (const [tierName, tierInfo] of Object.entries(TIER_DEFINITIONS)) {
    if (
      typeof tierInfo.minScore === 'number' &&
      typeof tierInfo.maxScore === 'number' &&
      normalizedScore >= tierInfo.minScore &&
      normalizedScore <= tierInfo.maxScore
    ) {
      return tierName;
    }
  }
  return '買咖';
};

const normalizeBackendTierData = (rawData) => {
  if (!rawData || typeof rawData !== 'object') {
    return null;
  }
  const score = normalizeScoreValue(rawData.score ?? rawData?.score);
  const tier =
    typeof rawData.tier === 'string' && rawData.tier.trim().length > 0
      ? rawData.tier.trim()
      : determineTierByScore(score);
  const lastUpdated =
    rawData.last_updated ??
    rawData.lastUpdated ??
    Math.max(Date.now(), 0);
  return { score, tier, lastUpdated };
};

const normalizeScoreHistoryEntry = (entry) => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const scoreChangeRaw =
    entry.score_change !== undefined ? entry.score_change : entry.scoreChange;
  const scoreChange = Number.isFinite(Number(scoreChangeRaw))
    ? Number(scoreChangeRaw)
    : 0;
  return {
    id: entry.id || entry.history_id || `score_${Date.now()}`,
    userId: entry.user_id || entry.userId || null,
    orderId: entry.order_id || entry.orderId || null,
    action: entry.action || '',
    scoreChange,
    newScore:
      entry.new_score !== undefined
        ? Number(entry.new_score)
        : Number(entry.newScore || 0),
    type:
      entry.type ||
      (scoreChange >= 0 ? 'positive' : 'negative'),
    timestamp: entry.timestamp || Date.now(),
  };
};

const normalizeTierHistoryEntry = (entry) => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  return {
    id: entry.id || entry.history_id || `tier_${Date.now()}`,
    userId: entry.user_id || entry.userId || null,
    oldTier: entry.old_tier || entry.oldTier || '',
    newTier: entry.new_tier || entry.newTier || '',
    type: entry.type || 'upgrade',
    timestamp: entry.timestamp || Date.now(),
  };
};

const ensureBackendUserTier = async (userId, fallbackData) => {
  // 如果 userId 無效，直接返回預設值
  if (!userId || userId === 'me') {
    return {
      score: fallbackData?.score ?? 100,
      tier: fallbackData?.tier ?? '買咖',
      lastUpdated: fallbackData?.lastUpdated ?? Date.now()
    };
  }

  const payload = {
    user_id: userId,
    score: fallbackData?.score ?? 100,
    tier: fallbackData?.tier ?? '買咖',
    last_updated: fallbackData?.lastUpdated ?? Date.now()
  };

  try {
    // 先嘗試獲取現有資料
    try {
      const existing = await apiService.getUserTier(userId);
      const normalized = normalizeBackendTierData(existing);
      if (normalized) {
        return normalized;
      }
    } catch (fetchError) {
      // 如果獲取失敗（404），繼續創建
      if (fetchError?.status !== 404) {
        console.log('取得既有信譽等級資料失敗（繼續創建）:', fetchError?.message || fetchError);
      }
    }

    // 如果不存在，嘗試創建
    try {
      const created = await apiService.createUserTier(payload);
      return normalizeBackendTierData(created) || {
        score: payload.score,
        tier: payload.tier,
        lastUpdated: payload.last_updated
      };
    } catch (createError) {
      // 如果創建失敗（可能是記錄已存在或其他錯誤），再次嘗試獲取
      if (createError?.status === 409 || createError?.status === 500) {
        try {
          const existing = await apiService.getUserTier(userId);
          const normalized = normalizeBackendTierData(existing);
          if (normalized) {
            return normalized;
          }
        } catch (retryError) {
          // 如果還是失敗，靜默處理，返回預設值
          console.log('創建/獲取後端信譽積分資料失敗（使用預設值）:', retryError?.message || retryError);
        }
      } else {
        console.log('創建後端信譽積分資料失敗（使用預設值）:', createError?.message || createError);
      }
    }
  } catch (error) {
    // 最終錯誤處理，靜默處理，返回預設值
    console.log('確保後端信譽積分資料失敗（使用預設值）:', error?.message || error);
  }

  // 返回預設值（不中斷流程）
  return {
    score: payload.score,
    tier: payload.tier,
    lastUpdated: payload.last_updated
  };
};

const fetchUserTierData = async (userId) => {
  if (!userId) {
    return { score: 100, tier: '買咖', lastUpdated: Date.now() };
  }

  const normalizedUserId = String(userId);
  if (normalizedUserId === 'me' || normalizedUserId === 'guest') {
    const cachedPlaceholder = await getCachedUserTierData(normalizedUserId);
    if (cachedPlaceholder) {
      return cachedPlaceholder;
    }
    const fallbackPlaceholder = { score: 100, tier: '買咖', lastUpdated: Date.now() };
    await cacheUserTierData(normalizedUserId, fallbackPlaceholder);
    return fallbackPlaceholder;
  }

  try {
    const backendData = await apiService.getUserTier(normalizedUserId);
    const normalized = normalizeBackendTierData(backendData);
    if (normalized) {
      await cacheUserTierData(normalizedUserId, normalized);
      return normalized;
    }
  } catch (error) {
    if (error?.status === 404) {
      const defaultData = await ensureBackendUserTier(normalizedUserId, {
        score: 100,
        tier: '買咖',
        lastUpdated: Date.now()
      });
      await cacheUserTierData(normalizedUserId, defaultData);
      return defaultData;
    }
    console.error('從後端獲取信譽積分失敗:', error?.message || error);
  }

  const cached = await getCachedUserTierData(normalizedUserId);
  if (cached) {
    return cached;
  }

  const fallback = { score: 100, tier: '買咖', lastUpdated: Date.now() };
  await cacheUserTierData(normalizedUserId, fallback);
  return fallback;
};


// 信譽積分規則配置
export const CREDIT_RULES = {
  // 發起代購者積分規則
  initiator: {
    // 訂單完成相關
    orderCompleted: 2,           // 訂單完成 +2分
    orderIncomplete: -5,         // 訂單未完成 -5分
    orderCancelled: -3,          // 訂單取消 -3分
    
    // 送達時間相關
    onTimeDelivery: 5,           // 準時送達 +5分
    lateDelivery: -3,            // 延遲送達 -3分
    veryLateDelivery: -8,        // 嚴重延遲 -8分
    
    // 溝通相關
    goodCommunication: 3,        // 良好溝通 +3分
    poorCommunication: -2,       // 溝通不良 -2分
    noCommunication: -5,         // 無溝通 -5分
    
    // 服務品質相關
    excellentService: 5,         // 優質服務 +5分
    goodService: 3,              // 良好服務 +3分
    poorService: -3,             // 服務不佳 -3分
    
    // 準時性相關
    alwaysOnTime: 10,            // 總是準時 +10分（連續3次）
    frequentlyLate: -5,          // 經常延遲 -5分（連續2次）
  },
  
  // 參與者積分規則
  participant: {
    // 取貨相關
    onTimePickup: 5,             // 準時取貨 +5分
    latePickup: -10,             // 未準時取貨 -10分
    noPickup: -15,               // 未取貨 -15分
    earlyPickup: 2,              // 提前取貨 +2分
    
    // 評價相關
    goodFeedback: 3,             // 好評 +3分
    badFeedback: -5,             // 差評 -5分
    excellentFeedback: 5,        // 極佳評價 +5分
    
    // 參與度相關
    activeParticipation: 2,      // 積極參與 +2分
    helpfulComment: 1,           // 有幫助的留言 +1分
    spamComment: -2,             // 垃圾留言 -2分
    
    // 付款相關
    onTimePayment: 3,            // 準時付款 +3分
    latePayment: -5,             // 延遲付款 -5分
    noPayment: -20,              // 未付款 -20分
  },
  
  // 特殊獎勵規則
  special: {
    firstOrder: 10,              // 首次代購 +10分
    milestoneOrder: 20,          // 里程碑訂單 +20分（第10、50、100單）
    seasonalBonus: 15,           // 季節性獎勵 +15分
    referralBonus: 25,           // 推薦新用戶 +25分
    communityContribution: 30,   // 社區貢獻 +30分
  }
};

// 等級定義
export const TIER_DEFINITIONS = {
  '掰咖': { minScore: 0, maxScore: 99, color: '#DC143C', icon: 'user-times' },
  '買咖': { minScore: 100, maxScore: 199, color: '#FF8C00', icon: 'shopping-bag' },
  '團咖': { minScore: 200, maxScore: 299, color: '#4169E1', icon: 'users' },
  '咖王': { minScore: 300, maxScore: 399, color: '#8B4513', icon: 'crown' },
  '咖皇': { minScore: 400, maxScore: 999, color: '#FFD700', icon: 'star' }
};

// 獲取用戶當前信譽積分
export const getUserCreditScore = async (userId) => {
  try {
    const tierData = await fetchUserTierData(userId);
    return tierData.score;
  } catch (error) {
    console.error('獲取用戶信譽積分失敗:', error);
    return 100;
  }
};

// 獲取用戶當前等級
export const getUserTier = async (userId) => {
  try {
    const tierData = await fetchUserTierData(userId);
    return tierData.tier;
  } catch (error) {
    console.error('獲取用戶等級失敗:', error);
    return '買咖';
  }
};

// 更新用戶信譽積分
export const updateUserCreditScore = async (userId, scoreChange, action, orderId = null) => {
  try {
    const normalizedUserId = userId || 'me';
    const isPlaceholder = normalizedUserId === 'me' || normalizedUserId === 'guest';

    const currentData = await fetchUserTierData(normalizedUserId);
    const currentScore = currentData.score ?? 0;
    const previousTier = currentData.tier ?? determineTierByScore(currentScore);
    const newScore = Math.max(0, currentScore + scoreChange);
    const newTier = determineTierByScore(newScore);
    const timestamp = Date.now();

    const payload = {
      score: newScore,
      tier: newTier,
      last_updated: timestamp
    };

    if (!isPlaceholder) {
      try {
        await apiService.updateUserTier(normalizedUserId, payload);
      } catch (apiError) {
        if (apiError?.status === 404) {
          await apiService.createUserTier({
            user_id: normalizedUserId,
            score: payload.score,
            tier: payload.tier,
            last_updated: payload.last_updated
          });
        } else {
          console.error('更新後端信譽積分失敗:', apiError?.message || apiError);
        }
      }
    }

    await cacheUserTierData(normalizedUserId, {
      score: newScore,
      tier: newTier,
      lastUpdated: timestamp
    });

    await recordScoreHistory(normalizedUserId, scoreChange, action, orderId, newScore);

    if (newTier !== previousTier) {
      await recordTierUpgrade(normalizedUserId, previousTier, newTier);
    }

    console.log(`用戶 ${normalizedUserId} 信譽積分更新: ${scoreChange >= 0 ? '+' : ''}${scoreChange}分，新分數: ${newScore}，新等級: ${newTier}`);
    
    return { score: newScore, tier: newTier, scoreChange };
  } catch (error) {
    console.error('更新用戶信譽積分失敗:', error);
    return null;
  }
};

// 記錄積分變化歷史
export const recordScoreHistory = async (userId, scoreChange, action, orderId, newScore) => {
  const timestamp = Date.now();
  const historyEntry = {
    id: `score_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    userId,
    orderId,
    action,
    scoreChange,
    newScore,
    type: scoreChange >= 0 ? 'positive' : 'negative'
  };

  if (userId && userId !== 'me' && userId !== 'guest') {
    try {
      await apiService.createScoreHistory({
        id: historyEntry.id,
        user_id: userId,
        order_id: orderId,
        action,
        score_change: scoreChange,
        new_score: newScore,
        type: historyEntry.type,
        timestamp: timestamp
      });
    } catch (error) {
      console.error('同步積分歷史到後端失敗:', error?.message || error);
    }
  }

  try {
    const scoreHistory = JSON.parse(await AsyncStorage.getItem(SCORE_HISTORY_CACHE_KEY) || '[]');
    await AsyncStorage.setItem(
      SCORE_HISTORY_CACHE_KEY,
      JSON.stringify([historyEntry, ...scoreHistory])
    );
  } catch (error) {
    console.error('記錄積分歷史失敗:', error);
  }
};

// 記錄等級提升
export const recordTierUpgrade = async (userId, oldTier, newTier) => {
  const timestamp = Date.now();
  const historyEntry = {
    id: `tier_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    userId,
    oldTier,
    newTier,
    type: 'upgrade'
  };

  if (userId && userId !== 'me' && userId !== 'guest') {
    try {
      await apiService.createTierHistory({
        id: historyEntry.id,
        user_id: userId,
        old_tier: oldTier,
        new_tier: newTier,
        type: historyEntry.type,
        timestamp
      });
    } catch (error) {
      console.error('同步等級歷史到後端失敗:', error?.message || error);
    }
  }

  try {
    const tierHistory = JSON.parse(await AsyncStorage.getItem(TIER_HISTORY_CACHE_KEY) || '[]');
    await AsyncStorage.setItem(
      TIER_HISTORY_CACHE_KEY,
      JSON.stringify([historyEntry, ...tierHistory])
    );
  } catch (error) {
    console.error('記錄等級提升失敗:', error);
  }
};

// 獲取積分變化歷史
export const getScoreHistory = async (userId = null) => {
  const normalizedUserId = userId || null;

  try {
    let backendHistory = [];
    if (normalizedUserId && normalizedUserId !== 'me' && normalizedUserId !== 'guest') {
      backendHistory = await apiService.getScoreHistoryByUser(normalizedUserId);
    } else {
      backendHistory = await apiService.getScoreHistoryList({ limit: 200 });
    }

    if (Array.isArray(backendHistory)) {
      const normalized = backendHistory
        .map(normalizeScoreHistoryEntry)
        .filter(Boolean);
      await AsyncStorage.setItem(SCORE_HISTORY_CACHE_KEY, JSON.stringify(normalized));
      return normalized;
    }
  } catch (error) {
    console.error('從後端獲取積分歷史失敗:', error?.message || error);
  }

  try {
    const scoreHistory = JSON.parse(await AsyncStorage.getItem(SCORE_HISTORY_CACHE_KEY) || '[]');
    const filtered = normalizedUserId
      ? scoreHistory.filter(entry => entry.userId === normalizedUserId)
      : scoreHistory;
    return filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  } catch (error) {
    console.error('獲取積分歷史失敗:', error);
    return [];
  }
};

// 獲取等級提升歷史
export const getTierHistory = async (userId = null) => {
  const normalizedUserId = userId || null;

  try {
    let backendHistory = [];
    if (normalizedUserId && normalizedUserId !== 'me' && normalizedUserId !== 'guest') {
      backendHistory = await apiService.getTierHistoryByUser(normalizedUserId);
    } else {
      backendHistory = await apiService.getTierHistoryList({ limit: 200 });
    }

    if (Array.isArray(backendHistory)) {
      const normalized = backendHistory
        .map(normalizeTierHistoryEntry)
        .filter(Boolean);
      await AsyncStorage.setItem(TIER_HISTORY_CACHE_KEY, JSON.stringify(normalized));
      return normalized;
    }
  } catch (error) {
    console.error('從後端獲取等級歷史失敗:', error?.message || error);
  }

  try {
    const tierHistory = JSON.parse(await AsyncStorage.getItem(TIER_HISTORY_CACHE_KEY) || '[]');
    const filtered = normalizedUserId
      ? tierHistory.filter(entry => entry.userId === normalizedUserId)
      : tierHistory;
    return filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  } catch (error) {
    console.error('獲取等級歷史失敗:', error);
    return [];
  }
};

// 計算訂單完成積分
export const calculateOrderCompletionScore = async (orderData, completionStatus, additionalFactors = {}) => {
  let totalScoreChange = 0;
  let actions = [];
  
  try {
    // 基本訂單完成積分
    if (completionStatus === 'completed') {
      totalScoreChange += CREDIT_RULES.initiator.orderCompleted;
      actions.push('訂單完成');
      
      // 檢查準時性
      if (additionalFactors.isOnTime) {
        totalScoreChange += CREDIT_RULES.initiator.onTimeDelivery;
        actions.push('準時送達');
      } else if (additionalFactors.isLate) {
        totalScoreChange += CREDIT_RULES.initiator.lateDelivery;
        actions.push('延遲送達');
      }
      
      // 檢查服務品質
      if (additionalFactors.serviceQuality === 'excellent') {
        totalScoreChange += CREDIT_RULES.initiator.excellentService;
        actions.push('優質服務');
      } else if (additionalFactors.serviceQuality === 'good') {
        totalScoreChange += CREDIT_RULES.initiator.goodService;
        actions.push('良好服務');
      }
      
    } else if (completionStatus === 'incomplete') {
      totalScoreChange += CREDIT_RULES.initiator.orderIncomplete;
      actions.push('訂單未完成');
      
      if (additionalFactors.reason) {
        // 根據未完成原因調整積分
        if (additionalFactors.reason.includes('不可抗力') || additionalFactors.reason.includes('天災')) {
          totalScoreChange += 2; // 減輕扣分
          actions.push('不可抗力因素');
        }
      }
    }
    
    // 檢查溝通品質
    if (additionalFactors.communicationQuality === 'good') {
      totalScoreChange += CREDIT_RULES.initiator.goodCommunication;
      actions.push('良好溝通');
    } else if (additionalFactors.communicationQuality === 'poor') {
      totalScoreChange += CREDIT_RULES.initiator.poorCommunication;
      actions.push('溝通不良');
    }
    
    return {
      scoreChange: totalScoreChange,
      actions: actions,
      description: actions.join(' + ')
    };
    
  } catch (error) {
    console.error('計算訂單完成積分失敗:', error);
    return { scoreChange: 0, actions: [], description: '計算失敗' };
  }
};

// 計算參與者積分
export const calculateParticipantScore = async (participantId, orderData, participantActions = {}) => {
  let totalScoreChange = 0;
  let actions = [];
  
  try {
    // 取貨相關積分
    if (participantActions.pickupStatus === 'onTime') {
      totalScoreChange += CREDIT_RULES.participant.onTimePickup;
      actions.push('準時取貨');
    } else if (participantActions.pickupStatus === 'late') {
      totalScoreChange += CREDIT_RULES.participant.latePickup;
      actions.push('延遲取貨');
    } else if (participantActions.pickupStatus === 'noPickup') {
      totalScoreChange += CREDIT_RULES.participant.noPickup;
      actions.push('未取貨');
    }
    
    // 評價相關積分
    if (participantActions.feedback === 'excellent') {
      totalScoreChange += CREDIT_RULES.participant.excellentFeedback;
      actions.push('極佳評價');
    } else if (participantActions.feedback === 'good') {
      totalScoreChange += CREDIT_RULES.participant.goodFeedback;
      actions.push('好評');
    } else if (participantActions.feedback === 'bad') {
      totalScoreChange += CREDIT_RULES.participant.badFeedback;
      actions.push('差評');
    }
    
    // 付款相關積分
    if (participantActions.paymentStatus === 'onTime') {
      totalScoreChange += CREDIT_RULES.participant.onTimePayment;
      actions.push('準時付款');
    } else if (participantActions.paymentStatus === 'late') {
      totalScoreChange += CREDIT_RULES.participant.latePayment;
      actions.push('延遲付款');
    }
    
    return {
      scoreChange: totalScoreChange,
      actions: actions,
      description: actions.join(' + ')
    };
    
  } catch (error) {
    console.error('計算參與者積分失敗:', error);
    return { scoreChange: 0, actions: [], description: '計算失敗' };
  }
};

// 獲取等級統計資訊
export const getTierStatistics = async () => {
  try {
    try {
      const backendSummary = await apiService.getUserTierSummary();
      if (backendSummary && typeof backendSummary === 'object') {
        return backendSummary;
      }
    } catch (backendError) {
      console.error('獲取後端等級統計失敗，回退至本地計算:', backendError?.message || backendError);
    }

    const cached = await readUserTierCache();
    const stats = {};
    Object.keys(TIER_DEFINITIONS).forEach(tier => {
      stats[tier] = 0;
    });

    Object.values(cached).forEach(entry => {
      if (entry?.tier && stats[entry.tier] !== undefined) {
        stats[entry.tier] += 1;
      }
    });

    return stats;
  } catch (error) {
    console.error('獲取等級統計失敗:', error);
    return {};
  }
};

// 重置用戶積分（管理員功能）
export const resetUserCreditScore = async (userId) => {
  try {
    const normalizedUserId = userId || 'me';
    const isPlaceholder = normalizedUserId === 'me' || normalizedUserId === 'guest';
    const timestamp = Date.now();
    const payload = {
      score: 0,
      tier: '掰咖',
      last_updated: timestamp
    };

    if (!isPlaceholder) {
      try {
        await apiService.updateUserTier(normalizedUserId, payload);
      } catch (apiError) {
        if (apiError?.status === 404) {
          await apiService.createUserTier({
            user_id: normalizedUserId,
            score: payload.score,
            tier: payload.tier,
            last_updated: payload.last_updated
          });
        } else {
          console.error('重置後端信譽積分失敗:', apiError?.message || apiError);
        }
      }
    }

    await cacheUserTierData(normalizedUserId, {
      score: 0,
      tier: '掰咖',
      lastUpdated: timestamp
    });

    console.log(`用戶 ${normalizedUserId} 積分已重置`);
    return true;
  } catch (error) {
    console.error('重置用戶積分失敗:', error);
    return false;
  }
};
