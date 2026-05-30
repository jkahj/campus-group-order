import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabNavigator from './MainTabNavigator';
import simpleNotificationService from './utils/simpleNotificationService';
import DatabaseConnection from './utils/databaseConnection';
import { configureGoogleSignIn } from './config/googleConfig';
import {
  LoginScreen,
  RegisterScreen,
  ForgotPasswordScreen,
  ResetPasswordScreen,
  HomeScreen,
  MessageScreen,
  CreateOrderScreen,
  EditOrderScreen,
  TierRulesScreen,
  OrderAcceptanceScreen,
  SettingsScreen,
  EditProfileScreen,
  OrderCompletionScreen,
  OrderManagementScreen,
  CreditHistoryScreen,
  CreditRulesScreen,
  CreditTestScreen,
  NavigationTestScreen,
  OrderRatingScreen,
  ChangePasswordScreen,
  DataMigrationScreen,
  ParticipatedOrderDetailScreen
} from './screens';

const Stack = createNativeStackNavigator();

export default function App() {
  // 初始化服務
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // 初始化資料庫連接
        await DatabaseConnection.initializeSync();
        
        // 初始化推送通知服務
        // 這裡應該使用實際的用戶 ID，目前使用模擬 ID
        await simpleNotificationService.initialize('user_1');
        
        // 初始化Google Sign-In
        configureGoogleSignIn();
        
        console.log('✅ 所有服務初始化完成');
      } catch (error) {
        console.error('❌ 初始化服務失敗:', error);
      }
    };

    initializeServices();

    // 清理函數
    return () => {
      DatabaseConnection.stopSync();
    };
  }, []);

  // 調整 Navigation 在 Web / 平板上的背景色，避免整個畫面貼邊顯得壓迫
  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#F5F5F5',
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: '登入' }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: '註冊' }} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: '忘記密碼' }} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: '重設密碼' }} />
        <Stack.Screen name="Main" component={MainTabNavigator} options={{ title: '主頁' }} />
        <Stack.Screen name="Message" component={MessageScreen} options={{ title: '留言' }}/>
        <Stack.Screen name="order" component={CreateOrderScreen} options={{ title: '發起' }}/>
        <Stack.Screen name="EditOrder" component={EditOrderScreen} options={{ title: '編輯代購' }} />
        <Stack.Screen name="TierRules" component={TierRulesScreen} options={{ title: '分級規則' }} />
        <Stack.Screen name="OrderAcceptance" component={OrderAcceptanceScreen} options={{ title: '接單確認' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '設定' }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: '編輯帳戶資料' }} />
        <Stack.Screen name="OrderCompletion" component={OrderCompletionScreen} options={{ title: '訂單完成狀態' }} />
        <Stack.Screen name="OrderManagement" component={OrderManagementScreen} options={{ title: '訂單管理' }} />
        <Stack.Screen name="CreditHistory" component={CreditHistoryScreen} options={{ title: '信譽積分歷史' }} />
        <Stack.Screen name="CreditRules" component={CreditRulesScreen} options={{ title: '信譽積分規則' }} />
        <Stack.Screen name="CreditTest" component={CreditTestScreen} options={{ title: '信譽積分測試' }} />
        <Stack.Screen name="NavigationTest" component={NavigationTestScreen} options={{ title: '導航測試' }} />
        <Stack.Screen name="OrderRating" component={OrderRatingScreen} options={{ title: '評價代購服務' }} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: '更改密碼' }} />
        <Stack.Screen name="DataMigration" component={DataMigrationScreen} options={{ title: '資料遷移' }} />
        <Stack.Screen name="ParticipatedOrderDetail" component={ParticipatedOrderDetailScreen} options={{ title: '訂單詳情' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

