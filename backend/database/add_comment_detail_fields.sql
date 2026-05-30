-- 為留言新增代購明細欄位（商品金額與明細照片）
ALTER TABLE comments
  ADD COLUMN item_price DECIMAL(10,2) NULL COMMENT '代購商品金額',
  ADD COLUMN detail_photo VARCHAR(500) NULL COMMENT '明細照片路徑';


