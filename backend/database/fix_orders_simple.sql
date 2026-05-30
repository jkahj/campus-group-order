-- ============================================
-- 簡單版本：修復 orders 表缺少的欄位
-- 解決錯誤: Unknown column 'orders.item_price' in 'field list'
-- 
-- 使用方法：
-- 1. 在 phpMyAdmin 中選擇 buycart 資料庫
-- 2. 點擊「SQL」標籤
-- 3. 複製並執行此腳本
-- 
-- 注意：如果欄位已存在，會顯示錯誤，但可以忽略
-- ============================================

USE buycart;

-- 添加 item_price 欄位
-- 如果出現 "Duplicate column name" 錯誤，表示欄位已存在，可以忽略
ALTER TABLE orders
ADD COLUMN item_price INT NULL COMMENT '商品總金額（單位：元）' AFTER note;

-- 添加 detail_image 欄位
-- 如果出現 "Duplicate column name" 錯誤，表示欄位已存在，可以忽略
ALTER TABLE orders
ADD COLUMN detail_image TEXT NULL COMMENT '代購明細圖片（Base64 或圖片 URL）' AFTER item_price;

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
