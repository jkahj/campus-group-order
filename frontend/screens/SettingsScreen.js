import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';

export default function SettingsScreen({ navigation }) {
  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const handlePickupAddress = () => {
    // 導航到取貨地址設定
    Alert.alert('功能', '取貨地址設定功能開發中');
  };

  const handleChangePassword = () => {
    navigation.navigate('ChangePassword');
  };

  const handleLogout = () => {
    Alert.alert(
      '登出',
      '確定要登出嗎？',
      [
        { text: '取消', style: 'cancel' },
        { text: '登出', style: 'destructive', onPress: () => {
          // 清除用戶資料並導航到登入畫面
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }},
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部導航 */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>設定</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* 設定標題 */}
        <Text style={styles.settingsTitle}>設定</Text>

        {/* 設定選項列表 */}
        <View style={styles.settingsList}>
          {/* 編輯帳戶資料 */}
          <TouchableOpacity style={styles.settingItem} onPress={handleEditProfile}>
            <View style={styles.settingItemLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="person-outline" size={20} color="#666" />
              </View>
              <Text style={styles.settingText}>編輯帳戶資料</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          {/* 取貨地址 */}
          <TouchableOpacity style={styles.settingItem} onPress={handlePickupAddress}>
            <View style={styles.settingItemLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="location-outline" size={20} color="#666" />
              </View>
              <Text style={styles.settingText}>取貨地址</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          {/* 更改密碼 */}
          <TouchableOpacity style={styles.settingItem} onPress={handleChangePassword}>
            <View style={styles.settingItemLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="key-outline" size={20} color="#666" />
              </View>
              <Text style={styles.settingText}>更改密碼</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          {/* 登出 */}
          <TouchableOpacity style={styles.settingItem} onPress={handleLogout}>
            <View style={styles.settingItemLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="log-out-outline" size={20} color="#666" />
              </View>
              <Text style={[styles.settingText, styles.logoutText]}>登出</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  settingsTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF8C00',
    marginTop: 24,
    marginBottom: 32,
  },
  settingsList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  logoutText: {
    color: '#FF8C00',
  },
});

