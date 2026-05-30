# 地址搜尋功能設定說明

## 功能概述

代購地點輸入欄位現在支援自動地址搜尋功能。當用戶在商店名稱中輸入商店名稱（如「好市多」），並在代購地點中輸入地區（如「台南市」）時，系統會自動搜尋該地區內所有符合條件的商店地址供用戶選擇。

## 設定步驟

### 1. 取得 Google Places API Key

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案或選擇現有專案
3. 啟用以下 API：
   - Places API
   - Places API (New)
4. 建立憑證（API Key）
5. 複製 API Key

### 2. 設定 API Key

在 `frontend/utils/addressSearchService.js` 檔案中，將第 8 行的 `YOUR_GOOGLE_PLACES_API_KEY` 替換為您的實際 API Key：

```javascript
this.apiKey = 'YOUR_ACTUAL_API_KEY_HERE';
```

### 3. 設定 API 限制（建議）

為了安全起見，建議在 Google Cloud Console 中設定 API Key 的限制：

1. 應用程式限制：選擇「Android 應用程式」或「iOS 應用程式」
2. API 限制：選擇「限制金鑰」，然後只啟用 Places API

## 功能特色

### 自動搜尋
- 當用戶輸入商店名稱和地區時，系統會自動觸發搜尋
- 使用防抖動機制，避免過度 API 呼叫
- 搜尋延遲設定為 500ms

### 搜尋結果顯示
- 顯示商店名稱、完整地址和評分
- 提供選擇按鈕，點擊即可填入地址
- 支援滾動瀏覽多個搜尋結果

### 模擬模式
- 如果未設定 API Key，系統會使用模擬資料
- 模擬資料包含常見商店的範例地址
- 方便開發和測試使用

## 使用方式

1. 在「商店名稱」欄位輸入商店名稱（如：好市多、家樂福、全聯）
2. 在「代購地點」欄位輸入地區名稱（如：台南市、台北市）
3. 系統會自動搜尋並顯示符合條件的地址
4. 點擊「找到 X 個地址，點擊選擇」按鈕
5. 從搜尋結果中選擇合適的地址
6. 選擇的地址會自動填入代購地點欄位

## 注意事項

- 需要網路連線才能使用搜尋功能
- Google Places API 有使用量限制，請注意 API 呼叫次數
- 建議在正式環境中設定適當的 API Key 限制
- 模擬模式僅供開發測試使用，不適用於正式環境

## 疑難排解

### 搜尋沒有結果
- 檢查網路連線
- 確認 API Key 設定正確
- 檢查 Google Cloud Console 中的 API 使用量

### 搜尋結果不準確
- 嘗試使用更精確的商店名稱
- 確認地區名稱輸入正確
- 檢查 Google Places API 的搜尋範圍設定

## 技術細節

- 使用 Google Places Text Search API
- 支援繁體中文搜尋
- 搜尋範圍限制在台灣地區
- 包含評分和價格等級資訊
- 支援地點詳細資訊查詢
