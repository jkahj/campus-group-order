# BUYCART 資料庫總結

## 📁 文件結構

```
backend/database/
├── buycart_schema.sql     # MySQL 資料庫結構文件（主要文件）
├── README.md              # 詳細的使用說明文檔
├── SUMMARY.md             # 本文件
├── db_config.py           # Python 資料庫連接配置
├── models.py              # SQLAlchemy ORM 模型定義
├── __init__.py            # Python 套件初始化文件
├── install.sh             # Linux/macOS 安裝腳本
└── install.bat            # Windows 安裝腳本
```

## 🎯 核心功能

### 1. 完整的資料庫結構

創建了 **14 個資料表**，涵蓋以下功能模組：

#### 用戶系統
- **users**: 用戶基本資訊、登入方式、評分等
- **user_tiers**: 用戶信譽積分和等級（掰咖/買咖/團咖/咖王/咖皇）

#### 訂單系統
- **orders**: 代購訂單資訊
- **order_joiners**: 訂單參與者記錄
- **order_history**: 訂單操作歷史

#### 留言系統
- **comments**: 訂單留言
- **comment_items**: 留言商品項目
- **comment_replies**: 留言回覆

#### 評價系統
- **reviews**: 用戶之間的評價（評分和評論）

#### 通知系統
- **notifications**: 系統通知記錄

#### 信譽系統
- **score_history**: 信譽積分變化歷史
- **tier_history**: 等級提升歷史

#### 其他
- **user_likes**: 用戶點讚記錄
- **verification_codes**: 驗證碼管理

### 2. 主要特性

✅ **完整的關聯關係**
- 使用外鍵約束確保資料完整性
- 支援級聯刪除，保證資料一致性

✅ **優化的查詢效能**
- 為常用查詢欄位建立索引
- 合理設計資料表結構

✅ **UTF8MB4 編碼支援**
- 完整支援中文和 emoji
- 適合台灣地區使用

✅ **時間戳設計**
- 使用 BIGINT 存儲毫秒級時間戳
- 保證時間精度和國際化支援

✅ **狀態管理**
- 多種狀態欄位（訂單狀態、留言狀態、配送狀態等）
- 支援軟刪除和狀態轉換

## 🚀 快速開始

### 方法 1: 使用安裝腳本（推薦）

**Linux/macOS:**
```bash
cd backend/database
chmod +x install.sh
./install.sh
```

**Windows:**
```cmd
cd backend\database
install.bat
```

### 方法 2: 手動安裝

1. **創建資料庫**
```bash
mysql -u root -p < backend/database/buycart_schema.sql
```

2. **安裝 Python 依賴**
```bash
pip install -r backend/requirements.txt
```

3. **配置環境變數**
創建 `.env` 文件：
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=buycart
```

4. **測試連接**
```python
from backend.database import test_connection
test_connection()
```

## 📊 資料表關聯圖

```
users
 ├── orders (1:N)
 ├── comments (1:N)
 ├── notifications (1:N)
 ├── user_tiers (1:1)
 ├── reviews_received (1:N) - 作為被評價者
 ├── reviews_given (1:N) - 作為評價者
 │
orders
 ├── comments (1:N)
 ├── order_joiners (1:N)
 ├── reviews (1:N)
 │
comments
 ├── comment_replies (1:N)
```

## 💡 使用範例

### Python (SQLAlchemy)

```python
from backend.database import get_db, User, Order

# 獲取資料庫會話
db = next(get_db())

# 查詢用戶
user = db.query(User).filter(User.id == 'me').first()

# 創建訂單
new_order = Order(
    id='order_123',
    name='7-11',
    address='台北市信義區',
    created_by='me',
    created_at=1234567890000
)
db.add(new_order)
db.commit()

# 查詢訂單及其留言
order = db.query(Order).filter(Order.id == 'order_123').first()
comments = order.order_comments
```

### FastAPI 整合

```python
from fastapi import Depends
from backend.database import get_db, User

@app.get("/users/{user_id}")
def get_user(user_id: str, db = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    return user
```

## 📝 資料庫設計說明

### 命名規範
- 資料表名稱使用複數形式（如 `users`, `orders`）
- 欄位名稱使用下劃線分隔（如 `created_at`, `user_id`）
- 外鍵命名為 `表名_id`（如 `order_id`, `user_id`）

### 資料類型選擇
- **ID**: `VARCHAR(50)` - 靈活支援各種 ID 格式
- **名稱**: `VARCHAR(100-200)` - 合理的長度限制
- **文字內容**: `TEXT` - 支援長文本
- **時間戳**: `BIGINT` - 毫秒級精度
- **布林值**: `BOOLEAN` - 清晰的狀態標記
- **計數**: `INT` - 整數計數

### 狀態設計
- **訂單狀態**: preparing → delivering → completed/cancelled
- **留言狀態**: active → ignored/deleted
- **配送狀態**: pending → accepted → delivering → completed/rejected
- **參與狀態**: pending → accepted/rejected

## 🔧 維護建議

1. **定期備份**
```bash
mysqldump -u root -p buycart > backup_$(date +%Y%m%d).sql
```

2. **清理過期資料**
- 定期清理過期的驗證碼
- 歸檔舊的歷史記錄

3. **效能監控**
- 監控慢查詢日誌
- 定期優化索引

4. **資料一致性**
- 定期檢查外鍵完整性
- 驗證狀態轉換邏輯

## 📚 相關文件

- [README.md](README.md) - 詳細使用說明
- [buycart_schema.sql](buycart_schema.sql) - 資料庫結構文件
- [models.py](models.py) - ORM 模型定義

## ⚠️ 注意事項

1. **密碼安全**: 用戶密碼應使用 Hash 函數加密存儲
2. **權限管理**: 生產環境應使用專門的資料庫用戶，避免使用 root
3. **連接池**: 使用連接池管理資料庫連接，避免連接過多
4. **事務處理**: 重要操作應使用事務確保原子性
5. **時間戳**: 注意 BIGINT 和 TIMESTAMP 的區別和使用場景

## 🎉 完成！

您的 BUYCART 資料庫已經準備就緒！

如有任何問題，請查看 README.md 或聯繫開發團隊。

