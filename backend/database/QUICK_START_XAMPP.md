# XAMPP 快速開始指南

## 🎯 3 分鐘快速安裝

### 步驟 1: 啟動 XAMPP MySQL

1. 打開 **XAMPP Control Panel**
2. 點擊 MySQL 旁的 **Start** 按鈕
3. 等待綠燈亮起

### 步驟 2: 執行安裝腳本

雙擊執行以下文件：
```
backend/database/install_xampp.bat
```

按照提示操作即可完成安裝。

### 步驟 3: 測試連接

在命令提示字元中執行：
```bash
cd backend
python test_db.py
```

如果看到 "✅ 所有測試通過"，就表示安裝成功！

## 📋 詳細步驟

### 方法 A: 使用批處理腳本（推薦 ⭐）

**最簡單的方式**：

1. 確保 XAMPP MySQL 服務正在運行
2. 雙擊 `backend/database/install_xampp.bat`
3. 按照提示完成安裝

### 方法 B: 手動安裝

#### 1. 打開 MySQL 命令行

在 XAMPP Shell 或命令提示字元中：
```cmd
cd C:\xampp\mysql\bin
mysql -u root
```

#### 2. 創建資料庫

```sql
CREATE DATABASE IF NOT EXISTS buycart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE buycart;
```

#### 3. 導入資料表

在新的命令提示字元視窗中：
```cmd
cd C:\xampp\mysql\bin
mysql -u root buycart < "C:\Users\20031\專題5\backend\database\buycart_schema.sql"
```

**注意**：請將路徑改為您的實際專案路徑。

## 🔍 驗證安裝

### 方法 1: 使用 Python 測試

```bash
cd backend
python test_db.py
```

### 方法 2: 使用 phpMyAdmin

1. 打開瀏覽器訪問：`http://localhost/phpmyadmin`
2. 點擊左側的 `buycart` 資料庫
3. 應該看到 13 個資料表

### 方法 3: 使用 MySQL 命令行

```sql
USE buycart;
SHOW TABLES;
```

應該看到：
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

## 📝 連接資訊

```
主機: localhost
端口: 3306
用戶名: root
密碼: （空白，無密碼）
資料庫: buycart
```

環境變數（已在 .env 文件中設定）：
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=buycart
```

## 💻 在代碼中使用

### Python 範例

```python
from database import get_db, User, Order

# 獲取資料庫會話
db = next(get_db())

# 查詢用戶
users = db.query(User).all()
for user in users:
    print(f"{user.name} - {user.email}")

# 創建新訂單
new_order = Order(
    id='order_001',
    name='7-11',
    address='台北市信義區',
    created_by='me',
    created_at=1704067200000
)
db.add(new_order)
db.commit()
```

### FastAPI 範例

```python
from fastapi import Depends
from database import get_db, User

@app.get("/users")
def get_users(db = Depends(get_db)):
    users = db.query(User).all()
    return users
```

## 🌐 管理工具

### phpMyAdmin（已包含在 XAMPP 中）

訪問：`http://localhost/phpmyadmin`

功能：
- ✅ 查看資料表結構
- ✅ 編輯資料
- ✅ 執行 SQL 查詢
- ✅ 匯入/匯出資料

### MySQL Workbench（可選）

1. 下載：https://dev.mysql.com/downloads/workbench/
2. 安裝並連接：
   - Host: localhost
   - Port: 3306
   - Username: root
   - Password: （空白）

## ⚠️ 常見問題

### Q1: MySQL 服務無法啟動

**A**: 
1. 檢查是否有其他 MySQL 實例在運行
2. 查看 XAMPP Control Panel 的錯誤訊息
3. 嘗試更改 MySQL 端口號

### Q2: 找不到 schema 文件

**A**: 
使用絕對路徑而非相對路徑：
```cmd
mysql -u root buycart < "C:\完整路徑\buycart_schema.sql"
```

### Q3: 中文顯示亂碼

**A**: 
確保資料庫字符集為 utf8mb4：
```sql
SHOW CREATE DATABASE buycart;
```

### Q4: 連接被拒絕

**A**: 
1. 確認 MySQL 服務正在運行
2. 檢查防火牆設定
3. 確認端口 3306 可用

## 📚 參考文件

- [XAMPP_INSTALL.md](XAMPP_INSTALL.md) - 詳細安裝指南
- [README.md](README.md) - 完整使用說明
- [SUMMARY.md](SUMMARY.md) - 功能總結

## 🎉 安裝完成後

現在您可以：

1. ✅ 測試連接
   ```bash
   python backend/test_db.py
   ```

2. ✅ 查看資料庫
   訪問 `http://localhost/phpmyadmin`

3. ✅ 開始開發
   使用 Python 或 FastAPI 連接資料庫

## 📞 需要幫助？

如果遇到問題：

1. 查看錯誤訊息
2. 檢查 XAMPP MySQL 日誌
3. 參考 [XAMPP_INSTALL.md](XAMPP_INSTALL.md) 詳細說明

祝您使用愉快！🚀

