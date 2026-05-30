import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AuthManager from '../utils/authManager';
import { 
  getScoreHistory, 
  getTierHistory, 
  getUserCreditScore, 
  getUserTier,
  TIER_DEFINITIONS 
} from '../utils/creditScoreManager';

export default function CreditHistoryScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('score'); // 'score' or 'tier'
  const [scoreHistory, setScoreHistory] = useState([]);
  const [tierHistory, setTierHistory] = useState([]);
  const [currentScore, setCurrentScore] = useState(0);
  const [currentTier, setCurrentTier] = useState('掰咖');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const currentUser = await AuthManager.getCurrentUser();
      const userId = currentUser?.id || 'me';
      
      // 載入當前積分和等級
      const score = await getUserCreditScore(userId);
      const tier = await getUserTier(userId);
      setCurrentScore(score);
      setCurrentTier(tier);
      
      // 載入積分歷史
      const scoreHist = await getScoreHistory(userId);
      setScoreHistory(scoreHist);
      
      // 載入等級歷史
      const tierHist = await getTierHistory(userId);
      setTierHistory(tierHist);
      
    } catch (error) {
      console.error('載入積分歷史失敗:', error);
      Alert.alert('載入失敗', '無法載入積分歷史記錄');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  // 格式化時間
  const formatTime = (timestamp) => {
    if (!timestamp) return '時間不明';
    const date = new Date(timestamp);
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

  // 渲染積分歷史項目
  const renderScoreHistoryItem = ({ item }) => (
    <View style={[
      styles.historyItem,
      item.type === 'positive' ? styles.positiveItem : styles.negativeItem
    ]}>
      <View style={styles.historyHeader}>
        <View style={styles.historyIcon}>
          <Ionicons 
            name={item.type === 'positive' ? 'add-circle' : 'remove-circle'} 
            size={24} 
            color={item.type === 'positive' ? '#4CAF50' : '#F44336'} 
          />
        </View>
        <View style={styles.historyContent}>
          <Text style={styles.historyAction}>{item.action}</Text>
          <Text style={styles.historyTime}>{formatTime(item.timestamp)}</Text>
          {item.orderId && (
            <Text style={styles.historyOrder}>訂單ID: {item.orderId}</Text>
          )}
        </View>
        <View style={styles.historyScore}>
          <Text style={[
            styles.scoreChange,
            item.type === 'positive' ? styles.positiveScore : styles.negativeScore
          ]}>
            {item.scoreChange >= 0 ? '+' : ''}{item.scoreChange}分
          </Text>
          <Text style={styles.newScore}>{item.newScore}分</Text>
        </View>
      </View>
    </View>
  );

  // 渲染等級歷史項目
  const renderTierHistoryItem = ({ item }) => (
    <View style={styles.tierHistoryItem}>
      <View style={styles.tierHistoryHeader}>
        <View style={styles.tierIcon}>
          <Ionicons name="trophy" size={24} color="#FFD700" />
        </View>
        <View style={styles.tierContent}>
          <Text style={styles.tierChange}>
            {item.oldTier} → {item.newTier}
          </Text>
          <Text style={styles.tierTime}>{formatTime(item.timestamp)}</Text>
        </View>
        <View style={styles.tierBadge}>
          <Text style={styles.tierBadgeText}>{item.newTier}</Text>
        </View>
      </View>
    </View>
  );

  // 獲取等級顏色
  const getTierColor = (tierName) => {
    return TIER_DEFINITIONS[tierName]?.color || '#DC143C';
  };

  // 獲取等級圖標
  const getTierIcon = (tierName) => {
    return TIER_DEFINITIONS[tierName]?.icon || 'user';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部導航 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>信譽積分歷史</Text>
        <View style={styles.headerRight} />
      </View>

      {/* 當前積分和等級顯示 */}
      <View style={styles.currentStatus}>
        <View style={styles.scoreDisplay}>
          <Text style={styles.scoreLabel}>當前信譽積分</Text>
          <Text style={styles.scoreValue}>{currentScore}分</Text>
        </View>
        <View style={styles.tierDisplay}>
          <Ionicons 
            name={getTierIcon(currentTier)} 
            size={32} 
            color={getTierColor(currentTier)} 
          />
          <Text style={[styles.tierValue, { color: getTierColor(currentTier) }]}>
            {currentTier}
          </Text>
        </View>
      </View>

      {/* 標籤切換 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'score' && styles.activeTab]}
          onPress={() => setActiveTab('score')}
        >
          <Text style={[styles.tabText, activeTab === 'score' && styles.activeTabText]}>
            積分記錄 ({scoreHistory.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tier' && styles.activeTab]}
          onPress={() => setActiveTab('tier')}
        >
          <Text style={[styles.tabText, activeTab === 'tier' && styles.activeTabText]}>
            等級記錄 ({tierHistory.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 內容區域 */}
      {activeTab === 'score' ? (
        <FlatList
          data={scoreHistory}
          keyExtractor={(item) => item.id}
          renderItem={renderScoreHistoryItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>還沒有積分變化記錄</Text>
            </View>
          }
          refreshing={loading}
          onRefresh={loadData}
        />
      ) : (
        <FlatList
          data={tierHistory}
          keyExtractor={(item) => item.id}
          renderItem={renderTierHistoryItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>還沒有等級變化記錄</Text>
            </View>
          }
          refreshing={loading}
          onRefresh={loadData}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  currentStatus: {
    backgroundColor: '#fff',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  scoreDisplay: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f90',
  },
  tierDisplay: {
    alignItems: 'center',
  },
  tierValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  activeTab: {
    backgroundColor: '#f90',
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
  historyItem: {
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
  positiveItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  negativeItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyIcon: {
    marginRight: 16,
  },
  historyContent: {
    flex: 1,
  },
  historyAction: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  historyTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  historyOrder: {
    fontSize: 12,
    color: '#999',
  },
  historyScore: {
    alignItems: 'flex-end',
  },
  scoreChange: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  positiveScore: {
    color: '#4CAF50',
  },
  negativeScore: {
    color: '#F44336',
  },
  newScore: {
    fontSize: 14,
    color: '#666',
  },
  tierHistoryItem: {
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
  tierHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierIcon: {
    marginRight: 16,
  },
  tierContent: {
    flex: 1,
  },
  tierChange: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  tierTime: {
    fontSize: 14,
    color: '#666',
  },
  tierBadge: {
    backgroundColor: '#f90',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tierBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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

