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

export default function SystemTestScreen() {
  const navigation = useNavigation();
  const [testResults, setTestResults] = useState({});
  const [isRunning, setIsRunning] = useState(false);

  const runAllTests = async () => {
    setIsRunning(true);
    const results = {};

    try {
      // 測試1: 獲取用戶積分
      console.log('開始測試1: 獲取用戶積分');
      const score = await getUserCreditScore('me');
      results.test1 = { success: true, data: score, message: `積分: ${score}分` };
      console.log('測試1成功:', score);
    } catch (error) {
      results.test1 = { success: false, error: error.message, message: '獲取積分失敗' };
      console.error('測試1失敗:', error);
    }

    try {
      // 測試2: 獲取用戶等級
      console.log('開始測試2: 獲取用戶等級');
      const tier = await getUserTier('me');
      results.test2 = { success: true, data: tier, message: `等級: ${tier}` };
      console.log('測試2成功:', tier);
    } catch (error) {
      results.test2 = { success: false, error: error.message, message: '獲取等級失敗' };
      console.error('測試2失敗:', error);
    }

    try {
      // 測試3: 獲取積分歷史
      console.log('開始測試3: 獲取積分歷史');
      const history = await getScoreHistory('me');
      results.test3 = { success: true, data: history.length, message: `歷史記錄: ${history.length}筆` };
      console.log('測試3成功:', history.length);
    } catch (error) {
      results.test3 = { success: false, error: error.message, message: '獲取積分歷史失敗' };
      console.error('測試3失敗:', error);
    }

    try {
      // 測試4: 獲取等級歷史
      console.log('開始測試4: 獲取等級歷史');
      const tierHistory = await getTierHistory('me');
      results.test4 = { success: true, data: tierHistory.length, message: `等級歷史: ${tierHistory.length}筆` };
      console.log('測試4成功:', tierHistory.length);
    } catch (error) {
      results.test4 = { success: false, error: error.message, message: '獲取等級歷史失敗' };
      console.error('測試4失敗:', error);
    }

    try {
      // 測試5: 更新積分
      console.log('開始測試5: 更新積分');
      const result = await updateUserCreditScore('me', 1, '系統測試', 'test_order');
      results.test5 = { success: true, data: result.score, message: `新積分: ${result.score}分` };
      console.log('測試5成功:', result.score);
    } catch (error) {
      results.test5 = { success: false, error: error.message, message: '更新積分失敗' };
      console.error('測試5失敗:', error);
    }

    setTestResults(results);
    setIsRunning(false);
    
    // 顯示測試結果摘要
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.keys(results).length;
    
    Alert.alert(
      '測試完成', 
      `成功: ${successCount}/${totalCount}\n${successCount === totalCount ? '所有測試通過！' : '部分測試失敗，請查看詳細結果'}`,
      [{ text: '確定' }]
    );
  };

  const renderTestResult = (testKey, testName) => {
    const result = testResults[testKey];
    if (!result) return null;

    return (
      <View style={[
        styles.testResult,
        result.success ? styles.successResult : styles.failureResult
      ]}>
        <View style={styles.testHeader}>
          <Ionicons 
            name={result.success ? 'checkmark-circle' : 'close-circle'} 
            size={24} 
            color={result.success ? '#4CAF50' : '#F44336'} 
          />
          <Text style={styles.testName}>{testName}</Text>
          <Text style={[
            styles.testStatus,
            { color: result.success ? '#4CAF50' : '#F44336' }
          ]}>
            {result.success ? '成功' : '失敗'}
          </Text>
        </View>
        <Text style={styles.testMessage}>{result.message}</Text>
        {!result.success && (
          <Text style={styles.testError}>錯誤: {result.error}</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>系統功能測試</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>測試所有系統功能</Text>
        
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>測試說明</Text>
          <Text style={styles.infoText}>• 此頁面會測試所有信譽積分系統功能</Text>
          <Text style={styles.infoText}>• 包括積分獲取、等級獲取、歷史記錄等</Text>
          <Text style={styles.infoText}>• 測試完成後會顯示詳細結果</Text>
          <Text style={styles.infoText}>• 如有錯誤會顯示具體錯誤信息</Text>
        </View>

        <TouchableOpacity 
          style={[styles.runButton, isRunning && styles.disabledButton]}
          onPress={runAllTests}
          disabled={isRunning}
        >
          <Ionicons name="play" size={24} color="#fff" />
          <Text style={styles.runButtonText}>
            {isRunning ? '測試中...' : '開始測試'}
          </Text>
        </TouchableOpacity>

        {Object.keys(testResults).length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsTitle}>測試結果</Text>
            
            {renderTestResult('test1', '獲取用戶積分')}
            {renderTestResult('test2', '獲取用戶等級')}
            {renderTestResult('test3', '獲取積分歷史')}
            {renderTestResult('test4', '獲取等級歷史')}
            {renderTestResult('test5', '更新積分')}
          </View>
        )}

        <View style={styles.navigationSection}>
          <Text style={styles.sectionTitle}>導航測試</Text>
          
          <TouchableOpacity 
            style={styles.navButton}
            onPress={() => navigation.navigate('CreditRules')}
          >
            <Ionicons name="document-text" size={20} color="#4CAF50" />
            <Text style={styles.navButtonText}>信譽積分規則</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.navButton}
            onPress={() => navigation.navigate('CreditHistory')}
          >
            <Ionicons name="time" size={20} color="#2196F3" />
            <Text style={styles.navButtonText}>信譽積分歷史</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.navButton}
            onPress={() => navigation.navigate('CreditTest')}
          >
            <Ionicons name="flask" size={20} color="#FF9800" />
            <Text style={styles.navButtonText}>信譽積分測試</Text>
          </TouchableOpacity>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 30,
  },
  infoSection: {
    backgroundColor: '#e3f2fd',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    marginBottom: 30,
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
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    marginBottom: 30,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  runButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  resultsSection: {
    marginBottom: 30,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  testResult: {
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
  successResult: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  failureResult: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  testName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  testStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  testMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  testError: {
    fontSize: 12,
    color: '#F44336',
    fontStyle: 'italic',
  },
  navigationSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 8,
  },
  navButton: {
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
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
});




































