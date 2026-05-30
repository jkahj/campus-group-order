import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthManager from '../utils/authManager';
import apiService from '../utils/apiService';

export default function EditProfileScreen({ navigation }) {
  const [profileData, setProfileData] = useState({
    username: 'xxx',
    gender: '男', // 修正為性別
    city: '高雄市',
    mobile: '09xxxxxxxx',
    email: 'xxx@gmail.com',
    aboutMe: 'write something...',
    photo: null,
  });

  const [editData, setEditData] = useState({ ...profileData });

  const getScopedStorageKey = (baseKey, userId) => {
    const scopedId = userId ?? 'guest';
    return `${baseKey}_${scopedId}`;
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      // 獲取當前登入用戶
      const currentUser = await AuthManager.getCurrentUser();
      const userId = currentUser?.id ? String(currentUser.id) : null;
      const profileDataKey = getScopedStorageKey('profileData', userId);

      if (!currentUser || !currentUser.id) {
        console.log('沒有當前用戶，使用本地資料');
        // 使用本地資料作為後備方案
        const savedProfileData = await AsyncStorage.getItem(profileDataKey);
        if (savedProfileData) {
          const parsedData = JSON.parse(savedProfileData);
          setProfileData(parsedData);
          setEditData(parsedData);
        }
        return;
      }

      // 從資料庫載入用戶資料
      try {
        const userFromDB = await apiService.getUser(currentUser.id);
        console.log('從資料庫載入的資料:', userFromDB);

        if (userFromDB) {
          const loadedData = {
            username: userFromDB.name || '',
            gender: userFromDB.gender || '男',
            city: userFromDB.city || '',
            mobile: userFromDB.phone || '',
            email: userFromDB.email || '',
            aboutMe: userFromDB.about_me || '',
            photo: userFromDB.photo || null,
          };

          setProfileData(loadedData);
          setEditData(loadedData);

          // 同時更新本地儲存作為備份
          await AsyncStorage.setItem(profileDataKey, JSON.stringify(loadedData));
        }
      } catch (apiError) {
        // 對於 404「用戶不存在」不算嚴重錯誤，直接改用本地資料即可
        const message = apiError?.message || '';
        const status = apiError?.status;
        const isNotFound =
          status === 404 ||
          message.includes('HTTP error! status: 404') ||
          message.includes('用戶不存在');

        if (!isNotFound) {
          console.error('從API載入資料失敗，使用本地資料:', apiError);
        }
        // API失敗時使用本地資料
        const savedProfileData = await AsyncStorage.getItem(profileDataKey);
        if (savedProfileData) {
          const parsedData = JSON.parse(savedProfileData);
          setProfileData(parsedData);
          setEditData(parsedData);
        }
      }
    } catch (error) {
      console.error('載入個人資料失敗:', error);
      // 使用本地資料作為最後的後備方案
      try {
        const savedProfileData = await AsyncStorage.getItem(getScopedStorageKey('profileData', null));
        if (savedProfileData) {
          const parsedData = JSON.parse(savedProfileData);
          setProfileData(parsedData);
          setEditData(parsedData);
        }
      } catch (localError) {
        console.error('載入本地資料也失敗:', localError);
      }
    }
  };

  const handleSave = async () => {
    try {
      // 獲取當前登入用戶
      const currentUser = await AuthManager.getCurrentUser();
      if (!currentUser || !currentUser.id) {
        Alert.alert('錯誤', '無法取得當前用戶資訊');
        return;
      }
      const userId = String(currentUser.id);
      const profileDataKey = getScopedStorageKey('profileData', userId);

      // 驗證必填欄位
      if (!editData.username.trim() || !editData.city.trim() || !editData.mobile.trim() || !editData.email.trim()) {
        Alert.alert('錯誤', '請填寫所有必填欄位');
        return;
      }

      // 驗證email格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editData.email)) {
        Alert.alert('錯誤', '請輸入有效的Email地址');
        return;
      }

      // 驗證手機號碼格式
      const mobileRegex = /^09\d{8}$/;
      if (!mobileRegex.test(editData.mobile)) {
        Alert.alert('錯誤', '請輸入正確的手機號碼格式 (09xxxxxxxx)');
        return;
      }

      // 準備要更新的資料（映射欄位名稱）
      // 確保所有欄位都被包含，即使是空字串或 null
      const updateData = {
        name: editData.username.trim(),
        phone: editData.mobile.trim(),
        email: editData.email.trim(),
        photo: profileData.photo || null,
      };
      
      // 處理可選欄位：如果有值就發送，否則發送 null（明確設置）
      if (editData.gender !== undefined && editData.gender !== null) {
        updateData.gender = editData.gender.trim() || null;
      } else {
        updateData.gender = null;
      }
      
      if (editData.city !== undefined && editData.city !== null) {
        updateData.city = editData.city.trim() || null;
      } else {
        updateData.city = null;
      }
      
      if (editData.aboutMe !== undefined && editData.aboutMe !== null) {
        updateData.about_me = editData.aboutMe.trim() || null;
      } else {
        updateData.about_me = null;
      }

      console.log('[編輯個人資料] 準備發送的更新資料:', JSON.stringify(updateData, null, 2));
      console.log('[編輯個人資料] editData 原始值:', JSON.stringify(editData, null, 2));

      // 更新到資料庫
      try {
        const updatedUser = await apiService.updateUser(currentUser.id, updateData);
        console.log('[編輯個人資料] 更新成功，後端返回:', updatedUser);

        // 同時儲存到本地，作為備份
        await AsyncStorage.setItem(profileDataKey, JSON.stringify({
          ...profileData,
          ...editData,
        }));
        await AsyncStorage.setItem('userData', JSON.stringify({
          username: updatedUser.name || editData.username,
          location: updatedUser.city || editData.city,
          rating: updatedUser.rating ? parseFloat(updatedUser.rating) : 5.0,
          reviewCount: updatedUser.review_count || 10,
        }));

        setProfileData(prevData => ({
          ...prevData,
          ...editData,
        }));
        Alert.alert('成功', '個人資料已更新', [
          { text: '確定', onPress: () => navigation.goBack() }
        ]);
      } catch (apiError) {
        console.error('更新資料庫失敗:', apiError);
        // API失敗時只儲存到本地
        await AsyncStorage.setItem('profileData', JSON.stringify(editData));
        Alert.alert('警告', '資料已儲存到本地，但無法同步到資料庫: ' + (apiError.message || '未知錯誤'));
      }
    } catch (error) {
      console.error('儲存失敗:', error);
      Alert.alert('錯誤', '儲存失敗: ' + (error.message || '未知錯誤'));
    }
  };

  const handleCancel = () => {
    setEditData(profileData);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部導航 */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleCancel}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>編輯帳戶資料</Text>
        <TouchableOpacity style={styles.doneButton} onPress={handleSave}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* 標題 */}
        <Text style={styles.screenTitle}>編輯帳戶資料</Text>

        {/* 表單 */}
        <View style={styles.form}>
          {/* 用戶名稱 */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>用戶名稱</Text>
            <TextInput
              style={styles.textInput}
              value={editData.username}
              onChangeText={(text) => setEditData({ ...editData, username: text })}
              placeholder="請輸入用戶名稱"
              placeholderTextColor="#999"
            />
          </View>

          {/* 性別 */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>性別</Text>
            <View style={styles.genderContainer}>
              <TouchableOpacity
                style={[
                  styles.genderOption,
                  editData.gender === '男' && styles.genderOptionSelected
                ]}
                onPress={() => setEditData({ ...editData, gender: '男' })}
              >
                <Text style={[
                  styles.genderOptionText,
                  editData.gender === '男' && styles.genderOptionTextSelected
                ]}>男</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.genderOption,
                  editData.gender === '女' && styles.genderOptionSelected
                ]}
                onPress={() => setEditData({ ...editData, gender: '女' })}
              >
                <Text style={[
                  styles.genderOptionText,
                  editData.gender === '女' && styles.genderOptionTextSelected
                ]}>女</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.genderOption,
                  editData.gender === '其他' && styles.genderOptionSelected
                ]}
                onPress={() => setEditData({ ...editData, gender: '其他' })}
              >
                <Text style={[
                  styles.genderOptionText,
                  editData.gender === '其他' && styles.genderOptionTextSelected
                ]}>其他</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 城市 */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>城市</Text>
            <TextInput
              style={styles.textInput}
              value={editData.city}
              onChangeText={(text) => setEditData({ ...editData, city: text })}
              placeholder="請輸入城市"
              placeholderTextColor="#999"
            />
          </View>

          {/* 行動電話 */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>行動電話</Text>
            <TextInput
              style={styles.textInput}
              value={editData.mobile}
              onChangeText={(text) => setEditData({ ...editData, mobile: text })}
              placeholder="請輸入手機號碼"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          </View>

          {/* Email */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.textInput}
              value={editData.email}
              onChangeText={(text) => setEditData({ ...editData, email: text })}
              placeholder="請輸入Email"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* 關於我 */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>關於我...</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={editData.aboutMe}
              onChangeText={(text) => setEditData({ ...editData, aboutMe: text })}
              placeholder="寫一些關於自己的內容..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
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
  doneButton: {
    padding: 4,
  },
  doneButtonText: {
    fontSize: 16,
    color: '#007BFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF8C00',
    marginTop: 24,
    marginBottom: 32,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#F8F8F8',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  genderOptionSelected: {
    backgroundColor: '#007BFF',
    borderColor: '#007BFF',
  },
  genderOptionText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  genderOptionTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
