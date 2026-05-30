import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// 完成WebBrowser會話
WebBrowser.maybeCompleteAuthSession();

// Google OAuth 配置
const GOOGLE_CONFIG = {
  // 🚨 重要：您需要替換為您自己的Google Client ID
  // 目前使用的是示例ID，需要從Google Cloud Console獲取真實ID
  clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  
  // Expo重定向URI配置
  redirectUri: AuthSession.makeRedirectUri({
    scheme: 'frontend',
    useProxy: true, // 在Expo Go中必須使用代理
  }),
  
  // OAuth範圍
  scopes: ['openid', 'profile', 'email'],
  
  // Google OAuth端點
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  userInfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
};

// 檢查配置是否完整
const isConfigured = () => {
  return GOOGLE_CONFIG.clientId !== 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
};

// 初始化Google Sign-In配置
export const configureGoogleSignIn = () => {
  try {
    console.log('Google OAuth 配置檢查...');
    console.log('Redirect URI:', GOOGLE_CONFIG.redirectUri);
    
    if (!isConfigured()) {
      console.warn('⚠️  Google Client ID 尚未配置');
      console.warn('請按照以下步驟設置：');
      console.warn('1. 前往 https://console.cloud.google.com/');
      console.warn('2. 創建專案並啟用Google+ API');
      console.warn('3. 創建OAuth 2.0憑證');
      console.warn('4. 將Client ID替換到配置文件中');
    } else {
      console.log('✅ Google OAuth 配置完成');
    }
  } catch (error) {
    console.error('Google OAuth 配置失敗:', error);
  }
};

// Google登入功能
export const signInWithGoogle = async () => {
  try {
    // 檢查配置
    if (!isConfigured()) {
      return {
        success: false,
        message: 'Google登入尚未配置\n\n請聯繫開發人員設置Google Client ID',
        needsSetup: true
      };
    }

    console.log('開始Google登入流程...');
    
    // 創建AuthRequest
    const request = new AuthSession.AuthRequest({
      clientId: GOOGLE_CONFIG.clientId,
      scopes: GOOGLE_CONFIG.scopes,
      redirectUri: GOOGLE_CONFIG.redirectUri,
      responseType: AuthSession.ResponseType.Code,
    });

    console.log('正在打開Google登入頁面...');

    // 執行授權流程
    const result = await request.promptAsync({
      authorizationEndpoint: GOOGLE_CONFIG.authorizationEndpoint,
      useProxy: true,
    });

    console.log('授權結果:', result.type);

    if (result.type === 'success') {
      console.log('授權成功，獲取用戶信息...');
      
      // 交換授權碼獲取訪問令牌
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: GOOGLE_CONFIG.clientId,
          code: result.params.code,
          redirectUri: GOOGLE_CONFIG.redirectUri,
        },
        {
          tokenEndpoint: GOOGLE_CONFIG.tokenEndpoint,
        }
      );

      // 使用訪問令牌獲取用戶信息
      const userInfoResponse = await fetch(
        `${GOOGLE_CONFIG.userInfoEndpoint}?access_token=${tokenResponse.accessToken}`
      );
      
      if (!userInfoResponse.ok) {
        throw new Error('獲取用戶信息失敗');
      }

      const userInfo = await userInfoResponse.json();
      console.log('✅ Google登入成功:', userInfo.name);

      return {
        success: true,
        user: {
          id: userInfo.id,
          name: userInfo.name,
          email: userInfo.email,
          photo: userInfo.picture,
          familyName: userInfo.family_name,
          givenName: userInfo.given_name,
        },
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
      };
      
    } else if (result.type === 'cancel') {
      console.log('用戶取消登入');
      return { success: false, message: '用戶取消登入' };
    } else {
      console.log('登入失敗:', result.type);
      return { success: false, message: '登入過程中發生錯誤' };
    }
    
  } catch (error) {
    console.error('Google登入錯誤:', error);
    
    if (error.message.includes('Invalid client')) {
      return { 
        success: false, 
        message: 'Google Client ID無效\n請檢查配置是否正確',
        needsSetup: true
      };
    } else if (error.message.includes('network')) {
      return { 
        success: false, 
        message: '網路連線錯誤\n請檢查網路連線後重試' 
      };
    } else {
      return { 
        success: false, 
        message: `登入失敗：${error.message}` 
      };
    }
  }
};

// 臨時的模擬登入功能（用於開發測試）
export const signInWithGoogleDemo = async () => {
  console.log('使用模擬Google登入...');
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        user: {
          id: 'demo_' + Date.now(),
          name: '測試用戶',
          email: 'demo@example.com',
          photo: 'https://via.placeholder.com/100x100.png?text=Demo',
          familyName: '用戶',
          givenName: '測試',
        },
        accessToken: 'demo_token',
        isDemo: true
      });
    }, 1500);
  });
};

// Google登出功能
export const signOutFromGoogle = async () => {
  try {
    console.log('Google登出');
    return { success: true, message: '已成功登出' };
  } catch (error) {
    console.error('Google登出錯誤:', error);
    return { success: false, message: '登出失敗' };
  }
};

// 檢查登入狀態
export const isSignedInToGoogle = async () => {
  return { isSignedIn: false, user: null };
};

// 獲取設置說明
export const getSetupInstructions = () => ({
  title: 'Google登入設置指南',
  steps: [
    '1. 前往 Google Cloud Console (https://console.cloud.google.com/)',
    '2. 創建新專案或選擇現有專案',
    '3. 啟用 Google+ API 或 Google Sign-In API',
    '4. 前往「憑證」頁面',
    '5. 點擊「建立憑證」→「OAuth 2.0 用戶端 ID」',
    '6. 選擇應用程式類型：「網路應用程式」',
    '7. 在「已授權的重新導向 URI」中添加：',
    `   ${GOOGLE_CONFIG.redirectUri}`,
    '8. 複製生成的「用戶端 ID」',
    '9. 將用戶端 ID 替換到 googleConfig.js 中的 clientId',
    '10. 重新啟動應用程式'
  ],
  currentRedirectUri: GOOGLE_CONFIG.redirectUri,
  isConfigured: isConfigured()
});