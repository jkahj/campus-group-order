/**
 * 資料遷移畫面
 * 將 AsyncStorage 資料遷移到資料庫
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dataMigrationService from '../utils/migrateToDatabase';

export default function DataMigrationScreen({ navigation }) {
  const [migrating, setMigrating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [results, setResults] = useState(null);

  const handleMigrate = async () => {
    try {
      setMigrating(true);
      const result = await dataMigrationService.migrateAll();
      setResults(result);
      
      Alert.alert(
        '遷移完成',
        `成功遷移 ${result.total.success} 筆資料`,
        [{ text: '確定' }]
      );
    } catch (error) {
      Alert.alert('遷移失敗', error.message);
    } finally {
      setMigrating(false);
    }
  };

  const handleClearStorage = async () => {
    Alert.alert(
      '確認清空',
      '確定要清空本地資料嗎？這將刪除所有 AsyncStorage 中的資料。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確定',
          style: 'destructive',
          onPress: async () => {
            try {
              setClearing(true);
              await dataMigrationService.clearAsyncStorage();
              Alert.alert('成功', '本地資料已清空');
            } catch (error) {
              Alert.alert('失敗', error.message);
            } finally {
              setClearing(false);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="cloud-upload" size={60} color="#007aff" />
        <Text style={styles.title}>資料遷移</Text>
        <Text style={styles.subtitle}>將本地資料遷移到資料庫</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 遷移說明</Text>
        <Text style={styles.description}>
          此功能會將 AsyncStorage 中的資料遷移到 MySQL 資料庫。
          遷移後，資料將保存在資料庫中，即使重新安裝應用也不會丟失。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ 操作</Text>
        
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleMigrate}
          disabled={migrating}
        >
          {migrating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={24} color="#fff" />
              <Text style={styles.buttonText}>開始遷移資料</Text>
            </>
          )}
        </TouchableOpacity>

        {results && (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>遷移結果</Text>
            <Text style={styles.resultItem}>
              訂單: ✅ {results.orders.success} / ❌ {results.orders.failed}
            </Text>
            <Text style={styles.resultItem}>
              留言: ✅ {results.comments.success} / ❌ {results.comments.failed}
            </Text>
            <Text style={styles.resultItem}>
              用戶: ✅ {results.users.success} / ❌ {results.users.failed}
            </Text>
            <Text style={styles.resultTotal}>
              總計: ✅ {results.total.success} / ❌ {results.total.failed}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={handleClearStorage}
          disabled={clearing}
        >
          {clearing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={24} color="#fff" />
              <Text style={styles.buttonText}>清空本地資料</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚠️ 注意事項</Text>
        <Text style={styles.warning}>
          • 請確保後端 API 正在運行（http://localhost:8000）{'\n'}
          • 遷移過程中請勿關閉應用{'\n'}
          • 清空本地資料後將無法恢復{'\n'}
          • 建議先完成遷移再清空本地資料
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  section: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#007aff',
  },
  dangerButton: {
    backgroundColor: '#ff3b30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  results: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  resultItem: {
    fontSize: 14,
    marginBottom: 5,
    color: '#333',
  },
  resultTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#007aff',
  },
  warning: {
    fontSize: 14,
    color: '#ff9500',
    lineHeight: 20,
  },
});

