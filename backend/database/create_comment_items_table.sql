-- 創建 comment_items 表來存儲留言中的多個商品
CREATE TABLE IF NOT EXISTS comment_items (
    id VARCHAR(50) PRIMARY KEY COMMENT '商品項目ID',
    comment_id VARCHAR(50) NOT NULL COMMENT '留言ID',
    item_name VARCHAR(200) NOT NULL COMMENT '商品名稱',
    quantity INT COMMENT '商品數量',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '創建時間',
    INDEX idx_comment_id (comment_id),
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='留言商品項目表';

