-- BUYCART 代購平台資料庫結構
-- 創建資料庫
CREATE DATABASE IF NOT EXISTS buycart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE buycart;

-- ==========================================
-- 1. 用戶表 (users)
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY COMMENT '用戶ID',
    name VARCHAR(100) NOT NULL COMMENT '用戶名稱',
    email VARCHAR(255) UNIQUE COMMENT '電子郵件',
    phone VARCHAR(20) UNIQUE COMMENT '手機號碼',
    password VARCHAR(255) COMMENT '密碼（Hashed）',
    photo VARCHAR(500) COMMENT '用戶頭像URL',
    google_id VARCHAR(255) UNIQUE COMMENT 'Google ID',
    login_method ENUM('email', 'google', 'google_demo') DEFAULT 'email' COMMENT '登入方式',
    is_demo BOOLEAN DEFAULT FALSE COMMENT '是否為演示帳號',
    device_token VARCHAR(500) COMMENT '推送通知設備令牌',
    rating DECIMAL(3,2) DEFAULT 0.00 COMMENT '平均評分（0-5）',
    review_count INT DEFAULT 0 COMMENT '被評價次數',
    gender VARCHAR(10) COMMENT '性別',
    city VARCHAR(100) COMMENT '城市',
    about_me TEXT COMMENT '關於我',
    is_active BOOLEAN DEFAULT TRUE COMMENT '帳號是否啟用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '創建時間',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_google_id (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用戶表';

-- ==========================================
-- 2. 訂單表 (orders)
-- ==========================================
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY COMMENT '訂單ID',
    name VARCHAR(200) NOT NULL COMMENT '商店名稱',
    address TEXT NOT NULL COMMENT '代購地點',
    phone VARCHAR(20) COMMENT '聯絡電話',
    line VARCHAR(100) COMMENT 'Line ID',
    method VARCHAR(100) COMMENT '付款方式',
    note TEXT COMMENT '備註說明',
    item_price INT COMMENT '商品總金額（單位：元）',
    detail_image TEXT COMMENT '代購明細圖片（Base64 或 圖片 URL）',
    joined INT DEFAULT 0 COMMENT '參與人數',
    status ENUM('preparing', 'delivering', 'completed', 'cancelled', 'expired') DEFAULT 'preparing' COMMENT '訂單狀態',
    color VARCHAR(20) DEFAULT 'green' COMMENT '訂單顏色標記',
    comments INT DEFAULT 0 COMMENT '留言數量',
    liked BOOLEAN DEFAULT FALSE COMMENT '是否已點讚',
    like_count INT DEFAULT 0 COMMENT '點讚數量',
    created_by VARCHAR(50) NOT NULL COMMENT '發起者用戶ID',
    created_at BIGINT NOT NULL COMMENT '創建時間戳',
    expires_at BIGINT COMMENT '到期時間戳',
    completed_at BIGINT COMMENT '完成時間戳',
    cancelled_at BIGINT COMMENT '取消時間戳',
    cancellation_reason TEXT COMMENT '取消原因',
    INDEX idx_created_by (created_by),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='訂單表';

-- ==========================================
-- 3. 留言表 (comments)
-- ==========================================
CREATE TABLE IF NOT EXISTS comments (
    id VARCHAR(50) PRIMARY KEY COMMENT '留言ID',
    order_id VARCHAR(50) NOT NULL COMMENT '訂單ID',
    commenter_id VARCHAR(50) NOT NULL COMMENT '留言者ID',
    commenter_name VARCHAR(100) NOT NULL COMMENT '留言者名稱',
    commenter_phone VARCHAR(20) COMMENT '留言者電話',
    commenter_line VARCHAR(100) COMMENT '留言者Line ID',
    text TEXT NOT NULL COMMENT '留言內容',
    is_order_request BOOLEAN DEFAULT TRUE COMMENT '是否為接單請求',
    is_reply BOOLEAN DEFAULT FALSE COMMENT '是否為回覆',
    parent_id VARCHAR(50) COMMENT '父留言ID（用於回覆）',
    delivery_status ENUM('pending', 'accepted', 'delivering', 'completed', 'rejected') DEFAULT 'pending' COMMENT '配送狀態',
    accepted BOOLEAN DEFAULT FALSE COMMENT '是否已接單',
    accepted_at BIGINT COMMENT '接單時間',
    completed BOOLEAN DEFAULT FALSE COMMENT '是否已完成',
    completed_time BIGINT COMMENT '完成時間',
    rating INT COMMENT '評分（1-5）',
    rating_comment TEXT COMMENT '評分留言',
    status ENUM('active', 'ignored', 'deleted') DEFAULT 'active' COMMENT '留言狀態',
    ignored_reason TEXT COMMENT '忽略原因',
    ignored_by VARCHAR(50) COMMENT '忽略者ID',
    ignored_at BIGINT COMMENT '忽略時間',
    show_new_badge BOOLEAN DEFAULT TRUE COMMENT '顯示新留言標籤',
    new_badge_expire_time BIGINT COMMENT '新留言標籤過期時間',
    timestamp BIGINT NOT NULL COMMENT '留言時間戳',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
    INDEX idx_order_id (order_id),
    INDEX idx_commenter_id (commenter_id),
    INDEX idx_parent_id (parent_id),
    INDEX idx_delivery_status (delivery_status),
    INDEX idx_status (status),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (commenter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE SET NULL,
    FOREIGN KEY (ignored_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='留言表';

-- ==========================================
-- 4. 留言商品項目表 (comment_items)
-- ==========================================
CREATE TABLE IF NOT EXISTS comment_items (
    id VARCHAR(50) PRIMARY KEY COMMENT '商品項目ID',
    comment_id VARCHAR(50) NOT NULL COMMENT '留言ID',
    item_name VARCHAR(200) NOT NULL COMMENT '商品名稱',
    quantity INT COMMENT '商品數量',
    item_price INT COMMENT '商品單價（單位：元）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '創建時間',
    INDEX idx_comment_id (comment_id),
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='留言商品項目表';

-- ==========================================
-- 5. 留言回覆表 (comment_replies)
-- ==========================================
CREATE TABLE IF NOT EXISTS comment_replies (
    id VARCHAR(50) PRIMARY KEY COMMENT '回覆ID',
    comment_id VARCHAR(50) NOT NULL COMMENT '留言ID',
    user VARCHAR(100) NOT NULL COMMENT '回覆者名稱',
    text TEXT NOT NULL COMMENT '回覆內容',
    timestamp BIGINT NOT NULL COMMENT '回覆時間戳',
    show_new_badge BOOLEAN DEFAULT TRUE COMMENT '顯示新回覆標籤',
    new_badge_expire_time BIGINT COMMENT '新回覆標籤過期時間',
    INDEX idx_comment_id (comment_id),
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='留言回覆表';

-- ==========================================
-- 6. 訂單參與者表 (order_joiners)
-- ==========================================
CREATE TABLE IF NOT EXISTS order_joiners (
    id VARCHAR(50) PRIMARY KEY COMMENT '參與記錄ID',
    order_id VARCHAR(50) NOT NULL COMMENT '訂單ID',
    user_id VARCHAR(50) NOT NULL COMMENT '參與者用戶ID',
    name VARCHAR(100) NOT NULL COMMENT '參與者名稱',
    phone VARCHAR(20) COMMENT '電話',
    line VARCHAR(100) COMMENT 'Line ID',
    join_time BIGINT NOT NULL COMMENT '參與時間',
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending' COMMENT '參與狀態',
    comment_id VARCHAR(50) COMMENT '關聯的留言ID',
    accepted_at BIGINT COMMENT '接單時間',
    INDEX idx_order_id (order_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='訂單參與者表';

-- ==========================================
-- 7. 通知表 (notifications)
-- ==========================================
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) PRIMARY KEY COMMENT '通知ID',
    user_id VARCHAR(50) NOT NULL COMMENT '接收者用戶ID',
    type VARCHAR(50) NOT NULL COMMENT '通知類型',
    title VARCHAR(200) NOT NULL COMMENT '通知標題',
    body TEXT NOT NULL COMMENT '通知內容',
    order_id VARCHAR(50) COMMENT '關聯訂單ID',
    commenter_id VARCHAR(50) COMMENT '關聯留言者ID',
    order_name VARCHAR(200) COMMENT '訂單名稱',
    read BOOLEAN DEFAULT FALSE COMMENT '是否已讀',
    ts BIGINT NOT NULL COMMENT '時間戳',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '創建時間',
    INDEX idx_user_id (user_id),
    INDEX idx_read (read),
    INDEX idx_ts (ts),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (commenter_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知表';

-- ==========================================
-- 8. 用戶信譽等級表 (user_tiers)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_tiers (
    user_id VARCHAR(50) PRIMARY KEY COMMENT '用戶ID',
    score INT DEFAULT 100 COMMENT '信譽積分',
    tier ENUM('掰咖', '買咖', '團咖', '咖王', '咖皇') DEFAULT '買咖' COMMENT '信譽等級',
    last_updated BIGINT NOT NULL COMMENT '最後更新時間',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用戶信譽等級表';

-- ==========================================
-- 9. 評價表 (reviews)
-- ==========================================
CREATE TABLE IF NOT EXISTS reviews (
    id VARCHAR(50) PRIMARY KEY COMMENT '評價ID',
    target_user_id VARCHAR(50) NOT NULL COMMENT '被評價者ID',
    reviewer_id VARCHAR(50) NOT NULL COMMENT '評價者ID',
    reviewer_name VARCHAR(100) NOT NULL COMMENT '評價者名稱',
    rating INT NOT NULL COMMENT '評分（1-5）',
    comment TEXT COMMENT '評價內容',
    order_id VARCHAR(50) NOT NULL COMMENT '關聯訂單ID',
    order_name VARCHAR(200) COMMENT '訂單名稱',
    order_location TEXT COMMENT '訂單地點',
    order_contact VARCHAR(100) COMMENT '訂單聯絡方式',
    is_from_purchaser BOOLEAN DEFAULT FALSE COMMENT '是否來自代購者',
    timestamp BIGINT NOT NULL COMMENT '評價時間戳',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '創建時間',
    INDEX idx_target_user_id (target_user_id),
    INDEX idx_reviewer_id (reviewer_id),
    INDEX idx_order_id (order_id),
    INDEX idx_rating (rating),
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='評價表';

-- ==========================================
-- 10. 積分歷史表 (score_history)
-- ==========================================
CREATE TABLE IF NOT EXISTS score_history (
    id VARCHAR(50) PRIMARY KEY COMMENT '歷史記錄ID',
    user_id VARCHAR(50) NOT NULL COMMENT '用戶ID',
    order_id VARCHAR(50) COMMENT '關聯訂單ID',
    action VARCHAR(200) NOT NULL COMMENT '操作描述',
    score_change INT NOT NULL COMMENT '積分變化',
    new_score INT NOT NULL COMMENT '新的積分',
    type ENUM('positive', 'negative') NOT NULL COMMENT '變化類型',
    timestamp BIGINT NOT NULL COMMENT '時間戳',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '創建時間',
    INDEX idx_user_id (user_id),
    INDEX idx_order_id (order_id),
    INDEX idx_timestamp (timestamp),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='積分歷史表';

-- ==========================================
-- 11. 等級提升歷史表 (tier_history)
-- ==========================================
CREATE TABLE IF NOT EXISTS tier_history (
    id VARCHAR(50) PRIMARY KEY COMMENT '歷史記錄ID',
    user_id VARCHAR(50) NOT NULL COMMENT '用戶ID',
    old_tier VARCHAR(20) NOT NULL COMMENT '舊等級',
    new_tier VARCHAR(20) NOT NULL COMMENT '新等級',
    type VARCHAR(20) DEFAULT 'upgrade' COMMENT '類型',
    timestamp BIGINT NOT NULL COMMENT '時間戳',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '創建時間',
    INDEX idx_user_id (user_id),
    INDEX idx_timestamp (timestamp),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='等級提升歷史表';

-- ==========================================
-- 12. 用戶點讚表 (user_likes)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_likes (
    id VARCHAR(50) PRIMARY KEY COMMENT '點讚記錄ID',
    user_id VARCHAR(50) NOT NULL COMMENT '用戶ID',
    order_id VARCHAR(50) NOT NULL COMMENT '訂單ID',
    liked BOOLEAN DEFAULT TRUE COMMENT '是否點讚',
    timestamp BIGINT NOT NULL COMMENT '時間戳',
    UNIQUE KEY unique_user_order (user_id, order_id),
    INDEX idx_user_id (user_id),
    INDEX idx_order_id (order_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用戶點讚表';

-- ==========================================
-- 13. 訂單歷史記錄表 (order_history)
-- ==========================================
CREATE TABLE IF NOT EXISTS order_history (
    id VARCHAR(50) PRIMARY KEY COMMENT '歷史記錄ID',
    order_id VARCHAR(50) NOT NULL COMMENT '訂單ID',
    user_id VARCHAR(50) NOT NULL COMMENT '用戶ID',
    action VARCHAR(100) NOT NULL COMMENT '操作類型',
    description TEXT COMMENT '操作描述',
    timestamp BIGINT NOT NULL COMMENT '時間戳',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '創建時間',
    INDEX idx_order_id (order_id),
    INDEX idx_user_id (user_id),
    INDEX idx_timestamp (timestamp),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='訂單歷史記錄表';

-- ==========================================
-- 14. 驗證碼表 (verification_codes)
-- ==========================================
CREATE TABLE IF NOT EXISTS verification_codes (
    id VARCHAR(50) PRIMARY KEY COMMENT '驗證碼ID',
    account VARCHAR(255) NOT NULL COMMENT '帳號（email或phone）',
    code VARCHAR(10) NOT NULL COMMENT '驗證碼',
    expires_at BIGINT NOT NULL COMMENT '過期時間戳',
    used BOOLEAN DEFAULT FALSE COMMENT '是否已使用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '創建時間',
    INDEX idx_account (account),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='驗證碼表';

-- ==========================================
-- 插入初始資料
-- ==========================================

-- 插入示例用戶
INSERT INTO users (id, name, email, phone, password, rating, review_count) VALUES
('me', '當前用戶', 'me@buycart.com', '0912345678', '123456', 0.00, 0),
('user001', '張三', 'zhang@example.com', '0911111111', '123456', 4.50, 10),
('user002', '李四', 'li@example.com', '0922222222', '123456', 4.80, 25),
('user003', '王五', 'wang@example.com', '0933333333', '123456', 4.20, 8);

-- 插入用戶等級資訊
INSERT INTO user_tiers (user_id, score, tier, last_updated) VALUES
('me', 100, '買咖', UNIX_TIMESTAMP()),
('user001', 150, '買咖', UNIX_TIMESTAMP()),
('user002', 250, '團咖', UNIX_TIMESTAMP()),
('user003', 120, '買咖', UNIX_TIMESTAMP());

-- ==========================================
-- 資料庫說明
-- ==========================================
-- BUYCART 代購平台資料庫
-- 
-- 主要功能模組：
-- 1. 用戶管理：註冊、登入、個人資料
-- 2. 訂單管理：創建、編輯、刪除、接單
-- 3. 留言系統：留言、回覆、忽略
-- 4. 通知系統：訂單通知、留言通知、評價通知
-- 5. 信譽系統：積分、等級、歷史記錄
-- 6. 評價系統：評分、評論
-- 7. 驗證系統：驗證碼管理
--
-- 設計特點：
-- - 使用 UTF8MB4 編碼支援完整的中文字元和 emoji
-- - 外鍵約束確保資料完整性
-- - 適當的索引優化查詢效能
-- - 使用時間戳（BIGINT）存儲精確的時間資訊
-- - 支援軟刪除和狀態管理

