-- 為 comment_items 表添加 item_price 欄位
-- 執行此腳本以添加商品單價欄位

ALTER TABLE comment_items 
ADD COLUMN item_price INT NULL COMMENT '商品單價（單位：元）' AFTER quantity;

-- 驗證欄位是否添加成功
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'comment_items' AND COLUMN_NAME = 'item_price';

