import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image,
  ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import AuthManager from '../utils/authManager';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 建立 refs 用於輸入框焦點管理
  const nameRef = React.useRef(null);
  const emailRef = React.useRef(null);
  const phoneRef = React.useRef(null);
  const passwordRef = React.useRef(null);

  const handleRegister = async () => {
    setLoading(true);
    try {
      const result = await AuthManager.registerUser({
        name,
        email,
        phone,
        password
      });
      
      if (result.success) {
        Alert.alert('註冊成功', '歡迎加入！', [
          {
            text: '確定',
            onPress: () => navigation.navigate('Main')
          }
        ]);
      } else {
        // 如果是重複註冊錯誤，提供更多選項
        if (result.message.includes('已被註冊')) {
          Alert.alert(
            '帳號已存在', 
            result.message,
            [
              {
                text: '前往登入',
                onPress: () => navigation.navigate('Login')
              },
              {
                text: '忘記密碼',
                onPress: () => navigation.navigate('ForgotPassword')
              },
              {
                text: '重新輸入',
                style: 'cancel'
              }
            ]
          );
        } else {
          Alert.alert('註冊失敗', result.message);
        }
      }
    } catch (error) {
      console.error('註冊錯誤:', error);
      Alert.alert('註冊失敗', '請稍後再試');
    } finally {
      setLoading(false);
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
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Image
              source={require('../assets/logo2.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.brand}>BUY咖</Text>
            <Text style={styles.subtitle}>代購外送平台</Text>
            <Text style={styles.hint}>註冊新帳號</Text>

            <TextInput
              placeholder="姓名"
              value={name}
              onChangeText={setName}
              style={styles.input}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => emailRef.current?.focus()}
              ref={nameRef}
            />
            <TextInput
              placeholder="電子郵件"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => phoneRef.current?.focus()}
              ref={emailRef}
            />
            <TextInput
              placeholder="行動電話"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              style={styles.input}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
              ref={phoneRef}
            />
            <TextInput
              placeholder="密碼"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
              ref={passwordRef}
            />

            <TouchableOpacity 
              style={[styles.registerButton, loading && styles.disabledButton]} 
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.registerButtonText}>
                {loading ? '註冊中...' : '註冊'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.link}>已經有帳號？前往登入</Text>
            </TouchableOpacity>

            <Image
              source={require('../assets/logo1.png')}
              style={styles.footerImage}
              resizeMode="contain"
            />
          </View>
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
    padding: 24
  },
  content: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center'
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
  registerButton: {
    backgroundColor: '#007BFF', paddingVertical: 12,
    width: '100%', borderRadius: 8, alignItems: 'center',
    marginBottom: 16
  },
  registerButtonText: {
    color: '#fff', fontWeight: 'bold', fontSize: 16
  },
  link: {
    color: '#007BFF', textDecorationLine: 'underline'
  },
  disabledButton: {
    opacity: 0.6
  },
  footerImage: {
    width: 100, height: 40, marginTop: 30
  }
});
