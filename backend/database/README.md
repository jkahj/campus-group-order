# BUYCART 資料庫使用說明

## 概述

這是 BUYCART 代購平台的 MySQL 資料庫結構文件。資料庫名稱為 `buycart`，包含完整的用戶、訂單、留言、評價、通知等核心功能所需的資料表。

## 安裝步驟

### 1. 安裝 MySQL

確保您的系統已安裝 MySQL 資料庫伺服器（建議 MySQL 5.7+ 或 MariaDB 10.3+）

### 2. 創建資料庫

使用以下命令登入 MySQL：

```bash
mysql -u root -p
```

然後執行：

```sql
source backend/database/buycart_schema.sql
```

或者從命令列直接執行：

```bash
mysql -u root -p < backend/database/buycart_schema.sql
```

### 3. 驗證安裝

登入 MySQL 並確認資料庫已創建：

```sql
USE buycart;
SHOW TABLES;
```

應該能看到以下 14 個資料表：
- users（用戶表）
- orders（訂單表）
- comments（留言表）
- comment_items（留言商品項目表）
- comment_replies（留言回覆表）
- order_joiners（訂單參與者表）
- notifications（通知表）
- user_tiers（用戶信譽等級表）
- reviews（評價表）
- score_history（積分歷史表）
- tier_history（等級提升歷史表）
- user_likes（用戶點讚表）
- order_history（訂單歷史記錄表）
- verification_codes（驗證碼表）

## 資料表結構說明

### 1. users（用戶表）
存儲用戶基本資訊，包括登入方式、評分等。

**主要欄位：**
- `id`: 用戶唯一識別碼
- `name`: 用戶名稱
- `email`: 電子郵件（唯一）
- `phone`: 手機號碼（唯一）
- `password`: 密碼（建議使用 Hash）
- `photo`: 頭像 URL
- `google_id`: Google 登入 ID
- `login_method`: 登入方式（email/google/google_demo）
- `rating`: 平均評分（0-5）
- `review_count`: 被評價次數

### 2. orders（訂單表）
存儲代購訂單資訊。

**主要欄位：**
- `id`: 訂單唯一識別碼
- `name`: 商店名稱
- `address`: 代購地點
- `phone`: 聯絡電話
- `line`: Line ID
- `method`: 付款方式
- `status`: 訂單狀態（preparing/delivering/completed/cancelled）
- `created_by`: 發起者用戶 ID
- `created_at`: 創建時間戳
- `expires_at`: 到期時間戳

### 3. comments（留言表）
存儲訂單留言資訊。

**主要欄位：**
- `id`: 留言唯一識別碼
- `order_id`: 關聯訂單 ID
- `commenter_id`: 留言者 ID
- `text`: 留言內容
- `is_order_request`: 是否為接單請求
- `is_reply`: 是否為回覆
- `parent_id`: 父留言 ID（用於回覆）
- `delivery_status`: 配送狀態
- `status`: 留言狀態（active/ignored/deleted）

### 4. notifications（通知表）
存儲系統通知資訊。

**主要欄位：**
- `id`: 通知唯一識別碼
- `user_id`: 接收者用戶 ID
- `type`: 通知類型
- `title`: 通知標題
- `body`: 通知內容
- `order_id`: 關聯訂單 ID
- `read`: 是否已讀

### 5. user_tiers（用戶信譽等級表）
存儲用戶信譽積分和等級。

**主要欄位：**
- `user_id`: 用戶 ID
- `score`: 信譽積分
- `tier`: 信譽等級（掰咖/買咖/團咖/咖王/咖皇）

**等級定義：**
- 掰咖：0-99 分
- 買咖：100-199 分
- 團咖：200-299 分
- 咖王：300-399 分
- 咖皇：400+ 分

### 6. reviews（評價表）
存儲用戶之間的評價。

**主要欄位：**
- `id`: 評價唯一識別碼
- `target_user_id`: 被評價者 ID
- `reviewer_id`: 評價者 ID
- `rating`: 評分（1-5）
- `comment`: 評價內容
- `order_id`: 關聯訂單 ID
- `is_from_purchaser`: 是否來自代購者

### 7. score_history（積分歷史表）
記錄信譽積分的變化歷史。

**主要欄位：**
- `id`: 歷史記錄 ID
- `user_id`: 用戶 ID
- `order_id`: 關聯訂單 ID
- `action`: 操作描述
- `score_change`: 積分變化
- `new_score`: 新的積分
- `type`: 變化類型（positive/negative）

## 資料庫連接配置

在後端應用中配置資料庫連接：

### Python (使用 SQLAlchemy)

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "mysql+pymysql://username:password@localhost:3306/buycart"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

### 環境變數配置（.env）

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=buycart
```

## 常用查詢範例

### 1. 查詢用戶及其信譽等級

```sql
SELECT u.id, u.name, u.email, ut.score, ut.tier
FROM users u
LEFT JOIN user_tiers ut ON u.id = ut.user_id
WHERE u.id = 'me';
```

### 2. 查詢訂單及其參與者

```sql
SELECT o.*, 
       COUNT(oj.id) as joiner_count,
       GROUP_CONCAT(oj.name) as joiners
FROM orders o
LEFT JOIN order_joiners oj ON o.id = oj.order_id
WHERE o.id = 'order_id'
GROUP BY o.id;
```

### 3. 查詢訂單留言

```sql
SELECT c.*, u.name as commenter_name
FROM comments c
JOIN users u ON c.commenter_id = u.id
WHERE c.order_id = 'order_id'
ORDER BY c.timestamp DESC;
```

### 4. 查詢未讀通知

```sql
SELECT * FROM notifications
WHERE user_id = 'user_id' AND read = FALSE
ORDER BY ts DESC;
```

### 5. 查詢用戶評價

```sql
SELECT r.*, u.name as reviewer_name
FROM reviews r
JOIN users u ON r.reviewer_id = u.id
WHERE r.target_user_id = 'user_id'
ORDER BY r.timestamp DESC;
```

## 資料備份

定期備份資料庫：

```bash
# 備份整個資料庫
mysqldump -u root -p buycart > buycart_backup_$(date +%Y%m%d).sql

# 還原資料庫
mysql -u root -p buycart < buycart_backup_20240101.sql
```

## 注意事項

1. **密碼安全**：用戶密碼欄位建議使用 Hash 函數（如 bcrypt）加密存儲
2. **時間戳**：主要使用 BIGINT 類型存儲時間戳（毫秒級），而非 TIMESTAMP
3. **編碼**：資料庫使用 UTF8MB4 編碼，支援完整的中文字元和 emoji
4. **外鍵約束**：刪除用戶時會級聯刪除相關的訂單、留言等記錄
5. **索引優化**：已為常用查詢欄位建立索引，提升查詢效能

## 維護建議

1. 定期備份資料庫
2. 監控資料庫效能
3. 清理過期的驗證碼記錄
4. 定期分析積分歷史表以優化信譽系統
5. 檢查並清理已刪除的訂單關聯資料

## 問題排查

### 常見問題

1. **編碼問題**：確保 MySQL 配置使用 UTF8MB4
2. **外鍵約束錯誤**：確保引用的記錄存在
3. **時間戳問題**：注意 BIGINT 和 TIMESTAMP 的區別

### 聯繫支援

如有問題，請查看專案文檔或聯繫開發團隊。

