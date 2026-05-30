-- BUYCART 資料庫更新腳本
-- 用於更新現有資料庫結構，添加缺失的欄位和表
-- 執行前請先備份資料庫！

USE buycart;

-- ==========================================
-- 1. 更新 users 表 - 添加缺失的欄位
-- ==========================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS gender VARCHAR(10) COMMENT '性別' AFTER review_count,
ADD COLUMN IF NOT EXISTS city VARCHAR(100) COMMENT '城市' AFTER gender,
ADD COLUMN IF NOT EXISTS about_me TEXT COMMENT '關於我' AFTER city;

-- ==========================================
-- 2. 更新 orders 表 - 添加缺失的欄位和狀態
-- ==========================================
-- 添加 item_price 和 detail_image 欄位
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS item_price INT COMMENT '商品總金額（單位：元）' AFTER note,
ADD COLUMN IF NOT EXISTS detail_image TEXT COMMENT '代購明細圖片（Base64 或 圖片 URL）' AFTER item_price;

-- 更新 status ENUM 以包含 'expired'
-- 注意：MySQL 不支援直接修改 ENUM，需要先修改為 VARCHAR，然後再改回 ENUM
-- 如果已經有 'expired' 狀態，可以跳過此步驟
ALTER TABLE orders 
MODIFY COLUMN status ENUM('preparing', 'delivering', 'completed', 'cancelled', 'expired') DEFAULT 'preparing' COMMENT '訂單狀態';

-- ==========================================
-- 3. 創建 comment_items 表（如果不存在）
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

-- 如果 comment_items 表已存在但缺少 item_price 欄位，則添加
ALTER TABLE comment_items 
ADD COLUMN IF NOT EXISTS item_price INT COMMENT '商品單價（單位：元）' AFTER quantity;

-- ==========================================
-- 更新完成
-- ==========================================
-- 執行此腳本後，資料庫結構應該與最新的模型定義一致
-- 建議執行以下查詢驗證更新：
-- 
-- SHOW TABLES;
-- DESCRIBE users;
-- DESCRIBE orders;
-- DESCRIBE comment_items;

