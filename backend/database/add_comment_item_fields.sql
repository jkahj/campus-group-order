-- 為留言新增商品欄位（品名和數量）
USE buycart;

ALTER TABLE comments
  ADD COLUMN item_name VARCHAR(200) NULL COMMENT '商品名稱' AFTER text,
  ADD COLUMN quantity INT NULL COMMENT '商品數量' AFTER item_name;


