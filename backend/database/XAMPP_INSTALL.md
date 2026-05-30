# XAMPP 安裝指南

## 📋 前置需求

確保您已經安裝並運行 XAMPP，並且 MySQL 服務正在運行。

## 🚀 安裝步驟

### 步驟 1: 啟動 XAMPP MySQL 服務

1. 打開 XAMPP Control Panel
2. 確認 MySQL 服務狀態為 "Running"（綠燈）
3. 如果未運行，點擊 "Start" 按鈕啟動 MySQL

### 步驟 2: 打開 MySQL 命令行

**方法 A：使用 XAMPP Shell**
1. 在 XAMPP Control Panel 中點擊 "Shell" 按鈕
2. 輸入以下命令切換到 MySQL 目錄：
```bash
cd mysql/bin
mysql -u root -p
```
3. 輸入密碼（預設為空，直接按 Enter）

**方法 B：使用命令提示字元（CMD）**
1. 打開命令提示字元（CMD）
2. 切換到 XAMPP MySQL 目錄：
```cmd
cd C:\xampp\mysql\bin
mysql -u root -p
```
3. 輸入密碼（預設為空，直接按 Enter）

### 步驟 3: 創建資料庫

在 MySQL 命令行中執行以下命令：

```sql
-- 創建資料庫
CREATE DATABASE IF NOT EXISTS buycart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 使用資料庫
USE buycart;

-- 導入資料表結構
SOURCE C:/xampp/htdocs/您的專案路徑/backend/database/buycart_schema.sql
```

**注意**：請將 "您的專案路徑" 替換為實際的專案路徑。

例如，如果您的專案在 `C:\xampp\htdocs\buycart\`，則路徑應該是：
```sql
SOURCE C:/xampp/htdocs/buycart/backend/database/buycart_schema.sql
```

### 步驟 4: 驗證安裝

執行以下 SQL 查詢驗證資料表是否創建成功：

```sql
USE buycart;
SHOW TABLES;
```

您應該看到 13 個資料表：
- users
- orders
- comments
- comment_replies
- order_joiners
- notifications
- user_tiers
- reviews
- score_history
- tier_history
- user_likes
- order_history
- verification_codes

### 步驟 5: 檢查初始資料

```sql
-- 查看用戶資料
SELECT * FROM users;

-- 查看用戶等級
SELECT * FROM user_tiers;
```

## 🔧 使用批處理腳本（快速安裝）

我已為您創建了一個專門針對 XAMPP 的安裝腳本：

**檔案位置**：`backend/database/install_xampp.bat`

**使用方法**：
1. 雙擊執行 `install_xampp.bat`
2. 按照提示輸入資訊
3. 等待安裝完成

## 🌐 連接到 XAMPP MySQL

### 連接資訊

```
主機: localhost 或 127.0.0.1
端口: 3306
用戶名: root
密碼: （預設為空）
資料庫: buycart
```

### Python 連接設定

在您的 `.env` 文件中設定：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=buycart
```

### 使用 phpMyAdmin 管理資料庫

1. 打開瀏覽器，訪問：`http://localhost/phpmyadmin`
2. 在左側資料庫列表中選擇 `buycart`
3. 可以查看和編輯所有資料表

## 📝 完整的 SQL 命令（複製貼上）

如果您想直接複製貼上命令，請使用以下步驟：

### 1. 打開 MySQL 命令行

```cmd
cd C:\xampp\mysql\bin
mysql -u root
```

### 2. 執行以下 SQL 命令

```sql
-- 創建資料庫
CREATE DATABASE IF NOT EXISTS buycart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 使用資料庫
USE buycart;
```

### 3. 然後在另一個視窗中執行：

```cmd
cd C:\xampp\mysql\bin
mysql -u root buycart < "C:\Users\20031\專題5\backend\database\buycart_schema.sql"
```

**注意**：請將路徑改為您的實際專案路徑。

## ✅ 測試連接

創建一個測試文件 `test_db.py`：

```python
from backend.database import test_connection

if __name__ == "__main__":
    if test_connection():
        print("✅ 資料庫連接成功！")
    else:
        print("❌ 資料庫連接失敗！")
```

執行測試：
```bash
python test_db.py
```

## 🔍 常見問題

### 問題 1: MySQL 服務無法啟動

**解決方案**：
1. 檢查是否有其他 MySQL 服務正在運行
2. 嘗試更改 MySQL 端口號
3. 查看 XAMPP 錯誤日誌

### 問題 2: 無法連接到 MySQL

**解決方案**：
1. 確認 MySQL 服務正在運行
2. 檢查防火牆設定
3. 確認端口 3306 未被抑制使用

### 問題 3: 中文顯示亂碼

**解決方案**：
1. 確認資料庫字符集為 `utf8mb4`
2. 確認資料表字符集為 `utf8mb4`
3. 重新執行 schema 文件

### 問題 4: 找不到 schema 文件

**解決方案**：
1. 確認文件路徑正確
2. 使用絕對路徑而非相對路徑
3. 確保文件權限正確

## 📊 管理工具

### phpMyAdmin

訪問地址：`http://localhost/phpmyadmin`

功能：
- 查看資料表結構
- 編輯資料
- 執行 SQL 查詢
- 匯入/匯出資料

### MySQL Workbench

XAMPP 不包含 MySQL Workbench，但您可以單獨安裝：
1. 下載：https://dev.mysql.com/downloads/workbench/
2. 安裝後連接本地 MySQL 伺服器

## 🎯 下一步

安裝完成後，您可以：

1. **測試後端連接**
   ```bash
   cd backend
   python -c "from database import test_connection; test_connection()"
   ```

2. **啟動後端服務**
   ```bash
   cd backend
   python app/main.py
   ```

3. **使用 phpMyAdmin 查看資料**
   訪問 `http://localhost/phpmyadmin` 並選擇 `buycart` 資料庫

## 📞 需要幫助？

如果遇到問題：
1. 檢查 XAMPP MySQL 錯誤日誌
2. 確認路徑設定正確
3. 查看 `README.md` 了解更多詳細資訊

祝您使用愉快！🎉

