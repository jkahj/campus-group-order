-- 為訂單新增代購明細欄位（商品金額與明細照片）
USE buycart;

ALTER TABLE orders
  ADD COLUMN item_price INT NULL COMMENT '商品總金額（單位：元）' AFTER note,
  ADD COLUMN detail_image TEXT NULL COMMENT '代購明細圖片（Base64 或圖片 URL）' AFTER item_price;



