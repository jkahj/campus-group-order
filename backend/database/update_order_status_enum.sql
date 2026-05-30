-- 更新 orders 表的 status 欄位 ENUM 類型，添加 'expired' 狀態
-- 此腳本需要手動執行以更新資料庫結構

-- 方法 1: 使用 ALTER TABLE MODIFY（適用於 MySQL/MariaDB）
-- 注意：這會鎖定表，建議在低峰時段執行

ALTER TABLE orders MODIFY COLUMN status ENUM('preparing', 'delivering', 'completed', 'cancelled', 'expired') DEFAULT 'preparing' COMMENT '訂單狀態';

-- 如果上面的方法失敗，可以使用以下步驟：
-- 1. 創建臨時表
-- CREATE TABLE orders_temp LIKE orders;
-- ALTER TABLE orders_temp MODIFY COLUMN status ENUM('preparing', 'delivering', 'completed', 'cancelled', 'expired') DEFAULT 'preparing';
-- 
-- 2. 複製數據
-- INSERT INTO orders_temp SELECT * FROM orders;
-- 
-- 3. 刪除舊表並重命名
-- DROP TABLE orders;
-- RENAME TABLE orders_temp TO orders;
-- 
-- 4. 重新創建索引和外鍵
-- ALTER TABLE orders ADD INDEX idx_created_by (created_by);
-- ALTER TABLE orders ADD INDEX idx_status (status);
-- ALTER TABLE orders ADD INDEX idx_expires_at (expires_at);
-- ALTER TABLE orders ADD INDEX idx_created_at (created_at);
-- ALTER TABLE orders ADD FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;












