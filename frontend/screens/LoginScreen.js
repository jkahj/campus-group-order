import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image,
  ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import AuthManager from '../utils/authManager';
import { configureGoogleSignIn } from '../config/googleConfig';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  // 建立refs用於輸入框焦點管理
  const emailRef = React.useRef(null);
  const passwordRef = React.useRef(null);
  
  // 初始化Google Sign-In
  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('請輸入帳號與密碼');
      return;
    }
    
    setLoading(true);
    try {
      const isValid = await AuthManager.verifyCredentials(email, password);
      
      if (isValid === true) {
        Alert.alert('登入成功', '', [
          {
            text: '確定',
            onPress: () => {
              navigation.navigate('Main');
            }
          }
        ]);
      } else {
        Alert.alert('登入失敗', '帳號或密碼錯誤');
      }
    } catch (error) {
      Alert.alert('登入失敗', '請稍後再試');
    } finally {
      setLoading(false);
    }
  };
  
  // Google登入處理
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const result = await AuthManager.signInWithGoogle();
      
      if (result.success) {
        const welcomeMessage = result.isDemo 
          ? `歡迎使用模擬登入，${result.user.name}！`
          : `歡迎回來，${result.user.name}！`;
          
        Alert.alert('登入成功', welcomeMessage, [
          {
            text: '確定',
            onPress: () => navigation.navigate('Main')
          }
        ]);
      } else {
        // 如果需要設置，顯示設置指南
        if (result.needsSetup) {
          Alert.alert(
            'Google登入需要設置', 
            result.message + '\n\n目前可以使用模擬版本進行測試',
            [
              {
                text: '使用模擬登入',
                onPress: handleGoogleDemoLogin
              },
              {
                text: '稍後設置',
                style: 'cancel'
              }
            ]
          );
        } else if (!result.message.includes('取消')) {
          Alert.alert('Google登入失敗', result.message);
        }
      }
    } catch (error) {
      console.error('Google登入錯誤:', error);
      Alert.alert('Google登入失敗', '請稍後再試');
    } finally {
      setGoogleLoading(false);
    }
  };
  
  // 模擬Google登入（用於開發測試）
  const handleGoogleDemoLogin = async () => {
    setGoogleLoading(true);
    try {
      // 使用AuthManager的模擬登入
      const { signInWithGoogleDemo } = require('../config/googleConfig');
      const result = await signInWithGoogleDemo();
      
      if (result.success) {
        // 通過AuthManager處理模擬用戶
        const authResult = await AuthManager.signInWithGoogle(result);
        
        Alert.alert('模擬登入成功', `歡迎使用測試版本，${result.user.name}！`, [
          {
            text: '確定',
            onPress: () => navigation.navigate('Main')
          }
        ]);
      }
    } catch (error) {
      console.error('模擬登入錯誤:', error);
      Alert.alert('模擬登入失敗', '請稍後再試');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
      <Image
        source={require('../assets/logo2.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.brand}>BUY咖</Text>
      <Text style={styles.subtitle}>代購外送平台</Text>
      <Text style={styles.hint}>輸入電子郵件或手機號碼與密碼</Text>

      <TextInput
        placeholder="電子郵件或手機號碼"
        value={email}
        onChangeText={setEmail}
        keyboardType="default"
        autoCapitalize="none"
        style={styles.input}
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => passwordRef.current?.focus()}
        ref={emailRef}
      />
      <TextInput
        placeholder="密碼"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        returnKeyType="done"
        onSubmitEditing={handleLogin}
        ref={passwordRef}
      />
      <TouchableOpacity 
        style={[styles.loginButton, loading && styles.disabledButton]} 
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.loginButtonText}>
          {loading ? '登入中...' : '登入'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.or}>或是</Text>

      {/* Google 登入按鈕 */}
      <TouchableOpacity 
        style={[styles.googleButton, googleLoading && styles.disabledButton]} 
        onPress={handleGoogleLogin}
        disabled={googleLoading}
      >
        <AntDesign name="google" size={20} color="#4285F4" style={{ marginRight: 8 }} />
        <Text style={styles.googleButtonText}>
          {googleLoading ? '登入中...' : '使用 Google 登入'}
        </Text>
      </TouchableOpacity>

      <View style={styles.linkRow}>
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.link}>註冊</Text>
        </TouchableOpacity>
        <Text style={{ marginHorizontal: 4 }}>|</Text>
        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={styles.link}>忘記密碼</Text>
        </TouchableOpacity>
      </View>

          <Image
            source={require('../assets/logo1.png')}
            style={styles.footerImage}
            resizeMode="contain"
          />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  logo: {
    width: 120, height: 120, marginBottom: 12
  },
  brand: {
    fontSize: 28, fontWeight: 'bold', color: '#000'
  },
  subtitle: {
    fontSize: 16, color: '#444'
  },
  hint: {
    marginTop: 8, marginBottom: 20, fontSize: 14, color: '#888'
  },
  input: {
    width: '100%', height: 44,
    borderColor: '#ccc', borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 12,
    marginBottom: 12
  },
  loginButton: {
    backgroundColor: '#007BFF', paddingVertical: 12,
    width: '100%', borderRadius: 8, alignItems: 'center'
  },
  loginButtonText: {
    color: '#fff', fontWeight: 'bold', fontSize: 16
  },
  or: {
    marginVertical: 12, color: '#888'
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: '#f1f1f1',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  googleButtonText: {
    color: '#000',
    fontWeight: 'bold'
  },
  linkRow: {
    flexDirection: 'row', marginBottom: 16
  },
  link: {
    color: '#007BFF'
  },
  disabledButton: {
    opacity: 0.6
  },
  footerImage: {
    width: 40,
    height: 40,
    borderRadius: 40,
    marginTop: 30,
  },
});
