import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, SafeAreaView,
  ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthManager from '../utils/authManager';

export default function ForgotPasswordScreen({ navigation }) {
  const [account, setAccount] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  // 倒數計時器
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!account) {
      Alert.alert('請輸入電子郵件或手機號碼');
      return;
    }

    // 簡單驗證格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9]{10,}$/;
    
    if (!emailRegex.test(account) && !phoneRegex.test(account)) {
      Alert.alert('請輸入有效的電子郵件或手機號碼');
      return;
    }

    setLoading(true);
    try {
      const result = await AuthManager.sendVerificationCode(account);
      if (result.success) {
        setSent(true);
        setCountdown(180); // 3分鐘倒數
        Alert.alert(
          '驗證碼已發送', 
          `請查看您的${emailRegex.test(account) ? '電子郵件' : '簡訊'}\n\n開發環境驗證碼：${result.code}`,
          [{ text: '確定' }]
        );
      } else {
        Alert.alert('發送失敗', result.message);
      }
    } catch (error) {
      console.error('發送驗證碼錯誤:', error);
      Alert.alert('發送失敗', '請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) {
      Alert.alert('請輸入驗證碼');
      return;
    }

    setLoading(true);
    try {
      const result = await AuthManager.verifyCode(account, verificationCode);
      if (result.success) {
        setVerified(true);
        Alert.alert('驗證成功', '請設定新密碼', [
          {
            text: '確定',
            onPress: () => navigation.navigate('ResetPassword', { account })
          }
        ]);
      } else {
        Alert.alert('驗證失敗', result.message);
      }
    } catch (error) {
      console.error('驗證碼驗證錯誤:', error);
      Alert.alert('驗證失敗', '請稍後再試');
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
        <Text style={styles.headerTitle}>忘記密碼</Text>
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
        <Text style={styles.hint}>忘記密碼</Text>

        <TextInput
          placeholder="輸入電子郵件 / 行動電話"
          value={account}
          onChangeText={setAccount}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!sent}
          returnKeyType="done"
          onSubmitEditing={() => !sent && handleSendCode()}
        />
        
        <TouchableOpacity 
          style={[styles.sendButton, (loading || countdown > 0) && styles.disabledButton]} 
          onPress={handleSendCode}
          disabled={loading || countdown > 0}
        >
          <Text style={styles.sendButtonText}>
            {loading ? '發送中...' : countdown > 0 ? `重新發送 (${countdown}s)` : '取得驗證碼'}
          </Text>
        </TouchableOpacity>

        {sent && !verified && (
          <>
            <TextInput
              placeholder="輸入驗證碼"
              value={verificationCode}
              onChangeText={setVerificationCode}
              style={styles.input}
              keyboardType="numeric"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={() => !loading && handleVerifyCode()}
            />
            
            <TouchableOpacity 
              style={[styles.verifyButton, loading && styles.disabledButton]} 
              onPress={handleVerifyCode}
              disabled={loading}
            >
              <Text style={styles.verifyButtonText}>
                {loading ? '驗證中...' : '驗證'}
              </Text>
            </TouchableOpacity>
          </>
        )}

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
  sendButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 12,
    width: '100%',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16
  },
  disabledButton: {
    opacity: 0.6
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  verifyButton: {
    backgroundColor: '#28A745',
    paddingVertical: 12,
    width: '100%',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16
  },
  verifyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  footerImage: {
    width: 100,
    height: 40,
    marginTop: 40
  }
});
