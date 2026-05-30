-- ============================================
-- 修復 orders 表缺少的欄位
-- 解決錯誤: Unknown column 'orders.item_price' in 'field list'
-- ============================================

USE buycart;

-- 方法 1: 使用 IF NOT EXISTS (MySQL 5.7.4+)
-- 如果您的 MySQL 版本支持，可以直接使用：
-- ALTER TABLE orders
-- ADD COLUMN IF NOT EXISTS item_price INT NULL COMMENT '商品總金額（單位：元）' AFTER note,
-- ADD COLUMN IF NOT EXISTS detail_image TEXT NULL COMMENT '代購明細圖片（Base64 或圖片 URL）' AFTER item_price;

-- 方法 2: 使用預存程序檢查並添加（兼容所有版本）
DELIMITER $$

DROP PROCEDURE IF EXISTS AddColumnIfNotExists$$

CREATE PROCEDURE AddColumnIfNotExists(
    IN tableName VARCHAR(128),
    IN columnName VARCHAR(128),
    IN columnDefinition TEXT
)
BEGIN
    DECLARE columnExists INT DEFAULT 0;
    
    SELECT COUNT(*) INTO columnExists
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = tableName
      AND COLUMN_NAME = columnName;
    
    IF columnExists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', tableName, ' ADD COLUMN ', columnName, ' ', columnDefinition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('✅ 已添加欄位: ', columnName) AS result;
    ELSE
        SELECT CONCAT('ℹ️ 欄位已存在: ', columnName) AS result;
    END IF;
END$$

DELIMITER ;

-- 添加 item_price 欄位
CALL AddColumnIfNotExists('orders', 'item_price', 'INT NULL COMMENT ''商品總金額（單位：元）'' AFTER note');

-- 添加 detail_image 欄位
CALL AddColumnIfNotExists('orders', 'detail_image', 'TEXT NULL COMMENT ''代購明細圖片（Base64 或圖片 URL）'' AFTER item_price');

-- 清理預存程序
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

-- 驗證結果
SELECT 
    COLUMN_NAME AS '欄位名稱',
    DATA_TYPE AS '資料類型',
    IS_NULLABLE AS '可為空',
    COLUMN_COMMENT AS '註釋'
FROM INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = 'buycart'
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME IN ('item_price', 'detail_image')
ORDER BY ORDINAL_POSITION;

SELECT '✅ orders 表結構修復完成！' AS result;
