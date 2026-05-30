import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, SafeAreaView,
  ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthManager from '../utils/authManager';

export default function ChangePasswordScreen({ navigation }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 建立refs用於輸入框焦點管理
  const currentPasswordRef = React.useRef(null);
  const newPasswordRef = React.useRef(null);
  const confirmPasswordRef = React.useRef(null);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('請填寫所有欄位');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('錯誤', '新密碼與確認密碼不一致');
      return;
    }

    if (newPassword.length < 4) {
      Alert.alert('錯誤', '新密碼至少需要4個字符');
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert('錯誤', '新密碼不能與當前密碼相同');
      return;
    }

    setLoading(true);
    try {
      const result = await AuthManager.changePassword(currentPassword, newPassword);
      if (result.success) {
        Alert.alert('成功', result.message, [
          {
            text: '確定',
            onPress: () => navigation.goBack()
          }
        ]);
      } else {
        Alert.alert('失敗', result.message);
      }
    } catch (error) {
      console.error('更改密碼錯誤:', error);
      Alert.alert('錯誤', '更改密碼失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.headerTitle}>更改密碼</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView 
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
        <Image
          source={require('../assets/logo2.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.brand}>BUY咖</Text>
        <Text style={styles.subtitle}>代購外送平台</Text>
        <Text style={styles.hint}>更改您的密碼</Text>

        <TextInput
          placeholder="輸入當前密碼"
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
          style={styles.input}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => newPasswordRef.current?.focus()}
          ref={currentPasswordRef}
        />
        <TextInput
          placeholder="輸入新密碼"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          style={styles.input}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => confirmPasswordRef.current?.focus()}
          ref={newPasswordRef}
        />
        <TextInput
          placeholder="再次輸入新密碼"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={handleChangePassword}
          ref={confirmPasswordRef}
        />

        <TouchableOpacity 
          style={[styles.changeButton, loading && styles.disabledButton]} 
          onPress={handleChangePassword}
          disabled={loading}
        >
          <Text style={styles.changeButtonText}>
            {loading ? '處理中...' : '更改密碼'}
          </Text>
        </TouchableOpacity>

        <View style={styles.passwordTips}>
          <Text style={styles.tipsTitle}>密碼要求：</Text>
          <Text style={styles.tipText}>• 至少4個字符</Text>
          <Text style={styles.tipText}>• 建議包含數字和字母</Text>
          <Text style={styles.tipText}>• 不要使用過於簡單的密碼</Text>
        </View>

            <Image
              source={require('../assets/logo1.png')}
              style={styles.footerImage}
              resizeMode="contain"
            />
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
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
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 12
  },
  brand: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000'
  },
  subtitle: {
    fontSize: 16,
    color: '#444'
  },
  hint: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 14,
    color: '#888'
  },
  input: {
    width: '100%',
    height: 44,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  changeButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 12,
    width: '100%',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20
  },
  disabledButton: {
    opacity: 0.6
  },
  changeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  passwordTips: {
    width: '100%',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  tipText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4
  },
  footerImage: {
    width: 100,
    height: 40,
    marginTop: 20
  }
});
