import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { 
  getUserCreditScore, 
  getUserTier, 
  updateUserCreditScore,
  getScoreHistory,
  getTierHistory
} from '../utils/creditScoreManager';

export default function CreditTestScreen() {
  const navigation = useNavigation();
  const [currentScore, setCurrentScore] = useState(0);
  const [currentTier, setCurrentTier] = useState('');
  const [scoreHistory, setScoreHistory] = useState([]);
  const [tierHistory, setTierHistory] = useState([]);

  const loadData = async () => {
    try {
      const userId = 'me';
      const score = await getUserCreditScore(userId);
      const tier = await getUserTier(userId);
      const history = await getScoreHistory(userId);
      const tierHist = await getTierHistory(userId);
      
      setCurrentScore(score);
      setCurrentTier(tier);
      setScoreHistory(history);
      setTierHistory(tierHist);
    } catch (error) {
      console.error('載入數據失敗:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const testAddPoints = async () => {
    try {
      const userId = 'me';
      const result = await updateUserCreditScore(userId, 10, '測試加分', 'test_order');
      if (result) {
        Alert.alert('成功', `積分已增加10分，新分數: ${result.score}分`);
        loadData(); // 重新載入數據
      }
    } catch (error) {
      Alert.alert('錯誤', '加分失敗: ' + error.message);
    }
  };

  const testSubtractPoints = async () => {
    try {
      const userId = 'me';
      const result = await updateUserCreditScore(userId, -5, '測試扣分', 'test_order');
      if (result) {
        Alert.alert('成功', `積分已減少5分，新分數: ${result.score}分`);
        loadData(); // 重新載入數據
      }
    } catch (error) {
      Alert.alert('錯誤', '扣分失敗: ' + error.message);
    }
  };

  const resetToInitial = async () => {
    try {
      const userId = 'me';
      const result = await updateUserCreditScore(userId, 100 - currentScore, '重置到初始分數', 'reset');
      if (result) {
        Alert.alert('成功', '已重置到初始分數100分');
        loadData(); // 重新載入數據
      }
    } catch (error) {
      Alert.alert('錯誤', '重置失敗: ' + error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部導航 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>信譽積分測試</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* 當前狀態 */}
        <View style={styles.statusSection}>
          <Text style={styles.sectionTitle}>當前狀態</Text>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>信譽積分</Text>
            <Text style={styles.statusValue}>{currentScore}分</Text>
            <Text style={styles.statusLabel}>當前等級</Text>
            <Text style={styles.statusValue}>{currentTier}</Text>
          </View>
        </View>

        {/* 測試按鈕 */}
        <View style={styles.testSection}>
          <Text style={styles.sectionTitle}>測試功能</Text>
          
          <TouchableOpacity style={styles.testButton} onPress={testAddPoints}>
            <Ionicons name="add-circle" size={24} color="#4CAF50" />
            <Text style={styles.testButtonText}>測試加分 (+10分)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testButton} onPress={testSubtractPoints}>
            <Ionicons name="remove-circle" size={24} color="#F44336" />
            <Text style={styles.testButtonText}>測試扣分 (-5分)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testButton} onPress={resetToInitial}>
            <Ionicons name="refresh" size={24} color="#2196F3" />
            <Text style={styles.testButtonText}>重置到初始分數 (100分)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testButton} onPress={loadData}>
            <Ionicons name="reload" size={24} color="#FF9800" />
            <Text style={styles.testButtonText}>重新載入數據</Text>
          </TouchableOpacity>
        </View>

        {/* 積分歷史 */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>積分歷史 ({scoreHistory.length})</Text>
          {scoreHistory.length > 0 ? (
            scoreHistory.slice(0, 5).map((item, index) => (
              <View key={item.id || `score-${index}`} style={styles.historyItem}>
                <Text style={styles.historyText}>
                  {item.action} - {item.scoreChange >= 0 ? '+' : ''}{item.scoreChange}分
                </Text>
                <Text style={styles.historyTime}>
                  {new Date(item.timestamp).toLocaleString()}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.noHistoryText}>還沒有積分變化記錄</Text>
          )}
        </View>

        {/* 等級歷史 */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>等級歷史 ({tierHistory.length})</Text>
          {tierHistory.length > 0 ? (
            tierHistory.slice(0, 5).map((item, index) => (
              <View key={item.id || `tier-${index}`} style={styles.historyItem}>
                <Text style={styles.historyText}>
                  {item.oldTier} → {item.newTier}
                </Text>
                <Text style={styles.historyTime}>
                  {new Date(item.timestamp).toLocaleString()}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.noHistoryText}>還沒有等級變化記錄</Text>
          )}
        </View>

        {/* 說明 */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>使用說明</Text>
          <Text style={styles.infoText}>• 此頁面用於測試信譽積分系統</Text>
          <Text style={styles.infoText}>• 點擊測試按鈕可以增加或減少積分</Text>
          <Text style={styles.infoText}>• 積分變化會自動記錄到歷史記錄中</Text>
          <Text style={styles.infoText}>• 等級會根據積分自動調整</Text>
          <Text style={styles.infoText}>• 初始分數設定為100分</Text>
        </View>
      </ScrollView>
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
  scrollContainer: {
    padding: 20,
    paddingBottom: 80,
  },
  statusSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statusCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statusValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f90',
    marginBottom: 16,
  },
  testSection: {
    marginBottom: 24,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  historySection: {
    marginBottom: 24,
  },
  historyItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  historyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  historyTime: {
    fontSize: 12,
    color: '#666',
  },
  noHistoryText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  infoSection: {
    backgroundColor: '#e3f2fd',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    marginBottom: 8,
    lineHeight: 20,
  },
});

