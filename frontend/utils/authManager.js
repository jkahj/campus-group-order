import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithGoogle, signOutFromGoogle, isSignedInToGoogle } from '../config/googleConfig';
import apiConfig from '../config/apiConfig';

// 用戶認證管理工具
export class AuthManager {
  // 註冊新用戶
  static async registerUser(userData) {
    try {
      const { name, email, phone, password } = userData;
      
      // 檢查必填欄位
      if (!name || !email || !phone || !password) {
        return { success: false, message: '請填寫所有欄位' };
      }
      
      // 電子郵件格式驗證
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, message: '請輸入有效的電子郵件地址' };
      }
      
      // 手機號碼格式驗證（台灣手機號碼格式）
      const phoneRegex = /^09\d{8}$/;
      if (!phoneRegex.test(phone)) {
        return { success: false, message: '請輸入有效的手機號碼（格式：09xxxxxxxx）' };
      }
      
      // 密碼長度檢查
      if (password.length < 4) {
        return { success: false, message: '密碼至少需要4個字符' };
      }
      
      // 【優先】調用後端 API 註冊到資料庫
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超時
        
        const userData = {
          id: Date.now().toString(),
          name,
          email,
          phone,
          password,
          login_method: 'email'
        };
        
        console.log('🔗 正在連接資料庫註冊...');
        console.log('📍 API URL:', `${apiConfig.baseURL}/register`);
        console.log('📤 發送數據:', { ...userData, password: '***' });
        
        const response = await fetch(`${apiConfig.baseURL}/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(userData),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        console.log('📥 收到響應 - 狀態碼:', response.status, response.statusText);

        if (response.ok) {
          const newUser = await response.json();
          console.log('✅ 用戶已成功註冊到資料庫:', newUser);
          
          // 保存當前登入用戶
          await this.saveCurrentUser({
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            phone: newUser.phone,
            loginAt: Date.now()
          });
          
          console.log('✅ 用戶資訊已保存到本地');
          return { success: true, message: '註冊成功', user: newUser };
        } else {
          const errorData = await response.json();
          console.error('❌ 資料庫註冊失敗 - 響應:', errorData);
          console.error('❌ 狀態碼:', response.status);
          
          // 如果用戶已存在，直接返回錯誤
          if (errorData.detail && (errorData.detail.includes('已被註冊') || errorData.detail.includes('已存在'))) {
            return { 
              success: false, 
              message: errorData.detail
            };
          }
          
          return { success: false, message: errorData.detail || '註冊失敗，請稍後再試' };
        }
      } catch (apiError) {
        // 詳細記錄錯誤
        console.error('❌ 註冊 API 連接錯誤');
        console.error('❌ 錯誤類型:', apiError.name);
        console.error('❌ 錯誤訊息:', apiError.message);
        console.error('❌ 完整錯誤:', apiError);
        
        if (apiError.name === 'AbortError' || apiError.message.includes('Failed to fetch') || apiError.message.includes('Network request failed')) {
          // 返回連接錯誤
          return { 
            success: false, 
            message: `無法連接到資料庫伺服器。請確認後端 API 正在運行（${apiConfig.baseURL}）\n\n建議：\n1. 確認後端服務器已啟動\n2. 檢查防火牆設定\n3. 稍後再試` 
          };
        } else {
          // 其他錯誤，直接返回
          return { 
            success: false, 
            message: `註冊失敗: ${apiError.message}` 
          };
        }
      }
      
      // 如果到達這裡，說明資料庫連接失敗，直接返回錯誤
      return {
        success: false,
        message: '註冊過程中發生未知錯誤'
      };
      
      // 【已移除】本地存儲後備模式
      // 現在強制使用資料庫，確保數據一致性
      // 如果需要本地存儲模式，請取消註釋上面的代碼
    } catch (error) {
      console.error('註冊用戶失敗:', error);
      return { success: false, message: '註冊失敗，請稍後再試' };
    }
  }
  
  // 獲取所有註冊用戶
  static async getAllUsers() {
    try {
      const usersData = await AsyncStorage.getItem('registeredUsers');
      return usersData ? JSON.parse(usersData) : [];
    } catch (error) {
      console.error('獲取用戶列表失敗:', error);
      return [];
    }
  }
  
  // 根據電子郵件獲取用戶
  static async getUserByEmail(email) {
    try {
      const users = await this.getAllUsers();
      return users.find(user => user.email === email) || null;
    } catch (error) {
      console.error('獲取用戶失敗:', error);
      return null;
    }
  }
  
  // 根據手機號碼獲取用戶
  static async getUserByPhone(phone) {
    try {
      const users = await this.getAllUsers();
      return users.find(user => user.phone === phone) || null;
    } catch (error) {
      console.error('獲取用戶失敗:', error);
      return null;
    }
  }
  
  // 根據電子郵件或手機號碼獲取用戶
  static async getUserByAccount(account) {
    try {
      const users = await this.getAllUsers();
      return users.find(user => user.email === account || user.phone === account) || null;
    } catch (error) {
      console.error('獲取用戶失敗:', error);
      return null;
    }
  }

  // 保存當前登入用戶資訊
  static async saveCurrentUser(user) {
    try {
      await AsyncStorage.setItem('currentUser', JSON.stringify(user));
      return true;
    } catch (error) {
      console.error('保存當前用戶失敗:', error);
      return false;
    }
  }

  // 獲取當前登入用戶
  static async getCurrentUser() {
    try {
      const userData = await AsyncStorage.getItem('currentUser');
      const user = userData ? JSON.parse(userData) : null;
      
      // 如果沒有找到當前用戶，嘗試從註冊用戶中獲取（兼容舊數據）
      if (!user) {
        const users = await this.getAllUsers();
        if (users.length > 0) {
          // 如果有註冊用戶，返回第一個（假設是最後登入的）
          const firstUser = users[0];
          await this.saveCurrentUser({
            id: firstUser.id,
            name: firstUser.name,
            email: firstUser.email,
            phone: firstUser.phone,
            loginAt: Date.now()
          });
          return { id: firstUser.id, name: firstUser.name, email: firstUser.email, phone: firstUser.phone };
        }
      }
      
      return user;
    } catch (error) {
      console.error('獲取當前用戶失敗:', error);
      return null;
    }
  }
  
  // 獲取當前用戶 ID（簡化方法）
  static async getCurrentUserId() {
    const user = await this.getCurrentUser();
    return user?.id || null;
  }

  // 驗證用戶憑證
  static async verifyCredentials(account, password) {
    try {
      // 【優先】調用後端 API 從資料庫驗證登入
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超時
        
        console.log('正在連接資料庫驗證登入...');
        
        const response = await fetch(`${apiConfig.baseURL}/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: account,
            password: password
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const result = await response.json();
          
          if (result.success && result.user) {
            // 保存當前登入用戶
            await this.saveCurrentUser({
              id: result.user.id,
              name: result.user.name,
              email: result.user.email,
              phone: result.user.phone,
              photo: result.user.photo,
              login_method: result.user.login_method,
              is_demo: result.user.is_demo,
              loginAt: Date.now()
            });
            
            console.log('✅ 資料庫登入成功');
            return true;
          }
        } else {
          // 登入失敗（帳號或密碼錯誤）
          const errorData = await response.json();
          console.log('❌ 資料庫登入失敗:', errorData.detail || '帳號或密碼錯誤');
          return false;
        }
      } catch (apiError) {
        // 【後備】資料庫不可用，回退到本地存儲驗證
        if (!(apiError.name === 'AbortError' || apiError.message.includes('Failed to fetch') || apiError.message.includes('Network request failed'))) {
          // 其他錯誤
          console.error('登入 API 錯誤:', apiError);
          return false;
        }
      }
      
      // 【後備】使用本地存儲驗證
      const user = await this.getUserByAccount(account);
      if (user && user.password === password) {
        await this.saveCurrentUser({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          photo: user.photo,
          login_method: user.loginMethod || 'email',
          is_demo: user.isDemo || false,
          loginAt: Date.now()
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('登入驗證失敗:', error);
      return false;
    }
  }
  
  // 登出
  static async logout() {
    try {
      // 檢查是否有Google登入
      const googleStatus = await isSignedInToGoogle();
      if (googleStatus.isSignedIn) {
        await signOutFromGoogle();
      }
      
      await AsyncStorage.removeItem('currentUser');
      return true;
    } catch (error) {
      console.error('登出失敗:', error);
      return false;
    }
  }
  
  // Google登入
  static async signInWithGoogle(demoResult = null) {
    try {
      let result;
      
      if (demoResult) {
        // 如果提供了模擬結果，直接使用
        result = demoResult;
      } else {
        // 否則調用真實的Google登入
        result = await signInWithGoogle();
      }
      
      if (result.success) {
        const { user } = result;
        
        // 檢查用戶是否已在本地註冊
        let existingUser = await this.getUserByEmail(user.email);
        
        if (!existingUser) {
          // 如果用戶不存在，自動創建Google用戶
          const users = await this.getAllUsers();
          const newUser = {
            id: Date.now().toString(),
            name: user.name,
            email: user.email,
            phone: '', // Google登入不需要手機號碼
            password: '', // Google登入不需要密碼
            photo: user.photo,
            googleId: user.id,
            loginMethod: result.isDemo ? 'google_demo' : 'google',
            isDemo: result.isDemo || false,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          
          users.push(newUser);
          await AsyncStorage.setItem('registeredUsers', JSON.stringify(users));
          existingUser = newUser;
        }
        
        // 保存當前登入用戶
        await this.saveCurrentUser({
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          phone: existingUser.phone || '',
          photo: user.photo,
          loginMethod: existingUser.loginMethod,
          isDemo: existingUser.isDemo || false,
          loginAt: Date.now()
        });
        
        return { 
          success: true, 
          message: result.isDemo ? '模擬登入成功' : 'Google登入成功',
          user: existingUser,
          isDemo: result.isDemo || false
        };
      } else {
        return result;
      }
    } catch (error) {
      console.error('Google登入失敗:', error);
      return { success: false, message: 'Google登入失敗，請稍後再試' };
    }
  }

  // 修改密碼
  static async changePassword(currentPassword, newPassword) {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        return { success: false, message: '請先登入' };
      }
      
      // 獲取完整用戶資訊
      const user = await this.getUserByEmail(currentUser.email);
      if (!user) {
        return { success: false, message: '用戶不存在' };
      }
      
      // 檢查當前密碼是否正確
      if (user.password !== currentPassword) {
        return { success: false, message: '當前密碼錯誤' };
      }
      
      // 密碼長度檢查
      if (newPassword.length < 4) {
        return { success: false, message: '新密碼至少需要4個字符' };
      }
      
      // 更新用戶密碼
      const users = await this.getAllUsers();
      const userIndex = users.findIndex(u => u.id === user.id);
      if (userIndex === -1) {
        return { success: false, message: '用戶不存在' };
      }
      
      users[userIndex].password = newPassword;
      users[userIndex].updatedAt = Date.now();
      
      // 保存更新後的用戶列表
      await AsyncStorage.setItem('registeredUsers', JSON.stringify(users));
      
      return { success: true, message: '密碼已成功更改' };
    } catch (error) {
      console.error('更改密碼失敗:', error);
      return { success: false, message: '更改密碼失敗，請稍後再試' };
    }
  }

  // 重設密碼
  static async resetPassword(account, newPassword) {
    try {
      // 根據帳號（電子郵件或手機號碼）找到用戶
      const user = await this.getUserByAccount(account);
      if (!user) {
        return { success: false, message: '找不到此帳號的用戶' };
      }
      
      // 密碼長度檢查
      if (newPassword.length < 4) {
        return { success: false, message: '新密碼至少需要4個字符' };
      }
      
      // 更新用戶密碼
      const users = await this.getAllUsers();
      const userIndex = users.findIndex(u => u.id === user.id);
      if (userIndex === -1) {
        return { success: false, message: '用戶不存在' };
      }
      
      users[userIndex].password = newPassword;
      users[userIndex].updatedAt = Date.now();
      
      // 保存更新後的用戶列表
      await AsyncStorage.setItem('registeredUsers', JSON.stringify(users));
      
      return { success: true, message: '密碼已成功重設' };
    } catch (error) {
      console.error('重設密碼失敗:', error);
      return { success: false, message: '重設密碼失敗，請稍後再試' };
    }
  }

  static async sendVerificationCode(account) {
    try {
      // 模擬發送驗證碼
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 保存驗證碼到本地存儲（實際應用中應該發送到服務器）
      await AsyncStorage.setItem('verificationCode', JSON.stringify({
        code: verificationCode,
        account: account,
        timestamp: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000 // 5分鐘後過期
      }));

      // 模擬發送成功
      console.log(`驗證碼已發送到 ${account}: ${verificationCode}`);
      
      return { 
        success: true, 
        message: '驗證碼已發送',
        code: verificationCode // 在開發環境中返回驗證碼用於測試
      };
    } catch (error) {
      console.error('發送驗證碼失敗:', error);
      return { success: false, message: '發送驗證碼失敗，請稍後再試' };
    }
  }

  static async verifyCode(account, code) {
    try {
      const storedData = await AsyncStorage.getItem('verificationCode');
      if (!storedData) {
        return { success: false, message: '請先獲取驗證碼' };
      }

      const { code: storedCode, account: storedAccount, expiresAt } = JSON.parse(storedData);
      
      // 檢查是否過期
      if (Date.now() > expiresAt) {
        await AsyncStorage.removeItem('verificationCode');
        return { success: false, message: '驗證碼已過期，請重新獲取' };
      }

      // 檢查驗證碼和帳號
      if (storedCode === code && storedAccount === account) {
        await AsyncStorage.removeItem('verificationCode');
        return { success: true, message: '驗證碼正確' };
      } else {
        return { success: false, message: '驗證碼錯誤' };
      }
    } catch (error) {
      console.error('驗證碼驗證失敗:', error);
      return { success: false, message: '驗證失敗，請稍後再試' };
    }
  }
}

export default AuthManager;
