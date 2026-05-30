# 團購代購 App - 前端

## 專案概述

這是一個 React Native 團購代購應用程式的前端部分，使用 Expo 框架開發。

## 功能特色

- **個人中心**: 包含個人資料編輯、評價查看、信譽積分系統
- **信譽積分系統**: 5個等級的信譽積分制度，從掰咖到咖皇
- **評價系統**: 支援買家和賣家的相互評價
- **圖片上傳**: 支援拍照和從相簿選擇個人照片

## 安裝依賴

由於 PowerShell 執行政策限制，請使用以下方式安裝依賴：

### 方法 1: 使用命令提示字元 (CMD)
```bash
cd frontend
npm install
```

### 方法 2: 手動安裝 expo-image-picker
如果 npm install 失敗，請手動執行：
```bash
cd frontend
npm install expo-image-picker@~15.0.0
```

## 運行專案

### 開發模式
```bash
cd frontend
npx expo start
```

### 在實體裝置上運行
1. 在手機上安裝 Expo Go 應用程式
2. 掃描終端機中顯示的 QR Code

### 在模擬器上運行
```bash
npx expo start --android  # Android 模擬器
npx expo start --ios      # iOS 模擬器
```

## 專案結構

```
frontend/
├── screens/
│   ├── ProfileScreen.js      # 個人中心畫面
│   ├── TierRulesScreen.js    # 分級規則畫面
│   ├── HomeScreen.js         # 首頁
│   ├── LoginScreen.js        # 登入畫面
│   └── ...                   # 其他畫面
├── MainTabNavigator.js        # 底部標籤導航器
├── App.js                     # 主要應用程式
└── package.json               # 專案依賴
```

## 主要畫面說明

### ProfileScreen (個人中心)
- 個人資料編輯（用戶名稱、地區）
- 個人照片上傳（拍照/相簿選擇）
- 評價查看（買家/賣家評價）
- 信譽積分顯示和等級
- 編輯模式 Modal 介面

### TierRulesScreen (分級規則)
- 5個信譽積分等級的詳細說明
- 各等級的權限和特權
- 分數範圍和限制說明

## 信譽積分等級

1. **掰咖** (0-99分): 基礎權限
2. **買咖** (100-199分): 可參與團購
3. **團咖** (200-299分): 可發起團購
4. **咖王** (300-399分): 高級權限
5. **咖皇** (400分以上): 最高權限

## 技術架構

- **框架**: React Native + Expo
- **導航**: React Navigation
- **圖示**: Expo Vector Icons
- **圖片處理**: Expo Image Picker
- **本地儲存**: AsyncStorage

## 注意事項

1. 確保已安裝 Node.js 和 npm
2. 如果遇到 PowerShell 執行政策問題，請使用 CMD 或調整執行政策
3. 首次運行時需要下載依賴，請耐心等待
4. 圖片上傳功能需要相機和相簿權限

## 問題排除

### 常見問題
1. **依賴安裝失敗**: 嘗試清除 npm 快取 `npm cache clean --force`
2. **Metro 打包錯誤**: 重新啟動 Metro 服務器
3. **權限問題**: 檢查裝置權限設定

### 聯絡支援
如有問題，請檢查 Expo 官方文件或提交 Issue。
