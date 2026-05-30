import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function NavigationTestScreen() {
  const navigation = useNavigation();

  const testNavigation = (screenName, title) => {
    try {
      navigation.navigate(screenName);
      console.log(`成功導航到 ${screenName}`);
    } catch (error) {
      console.error(`導航到 ${screenName} 失敗:`, error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>導航測試</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>測試所有畫面導航</Text>
        
        <View style={styles.testSection}>
          <Text style={styles.sectionTitle}>信譽積分系統</Text>
          
          <TouchableOpacity 
            style={styles.testButton}
            onPress={() => testNavigation('CreditRules', '信譽積分規則')}
          >
            <Ionicons name="document-text" size={24} color="#4CAF50" />
            <Text style={styles.testButtonText}>信譽積分規則</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.testButton}
            onPress={() => testNavigation('CreditHistory', '信譽積分歷史')}
          >
            <Ionicons name="time" size={24} color="#2196F3" />
            <Text style={styles.testButtonText}>信譽積分歷史</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.testButton}
            onPress={() => testNavigation('CreditTest', '信譽積分測試')}
          >
            <Ionicons name="flask" size={24} color="#FF9800" />
            <Text style={styles.testButtonText}>信譽積分測試</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.testSection}>
          <Text style={styles.sectionTitle}>訂單系統</Text>
          
          <TouchableOpacity 
            style={styles.testButton}
            onPress={() => testNavigation('OrderCompletion', '訂單完成狀態')}
          >
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={styles.testButtonText}>訂單完成狀態</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.testButton}
            onPress={() => testNavigation('TierRules', '分級規則')}
          >
            <Ionicons name="trophy" size={24} color="#FFD700" />
            <Text style={styles.testButtonText}>分級規則</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.testSection}>
          <Text style={styles.sectionTitle}>其他畫面</Text>
          
          <TouchableOpacity 
            style={styles.testButton}
            onPress={() => testNavigation('Settings', '設定')}
          >
            <Ionicons name="settings" size={24} color="#666" />
            <Text style={styles.testButtonText}>設定</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.testButton}
            onPress={() => testNavigation('EditProfile', '編輯帳戶資料')}
          >
            <Ionicons name="person" size={24} color="#666" />
            <Text style={styles.testButtonText}>編輯帳戶資料</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>使用說明</Text>
          <Text style={styles.infoText}>• 點擊按鈕測試導航到各個畫面</Text>
          <Text style={styles.infoText}>• 如果導航成功，會顯示相應畫面</Text>
          <Text style={styles.infoText}>• 如果導航失敗，請檢查控制台錯誤</Text>
          <Text style={styles.infoText}>• 所有畫面都應該能正常導航</Text>
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
  testSection: {
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

