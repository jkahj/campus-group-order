# 資料庫外鍵關係總結

## 📊 外鍵關係概覽

您的 BUYCART 資料庫現在已經完全連結！所有資料表之間都有適當的外鍵約束來維護資料完整性。

---

## 🔗 完整外鍵關係列表

### 1. **users** (用戶表)
**無外鍵約束** - 這是核心表，其他表都引用它

---

### 2. **orders** (訂單表)
```
created_by → users.id (CASCADE)
```

---

### 3. **comments** (留言表)
```
order_id → orders.id (CASCADE)
commenter_id → users.id (CASCADE)
parent_id → comments.id (SET NULL) ⭐ 自引用
ignored_by → users.id (SET NULL) ⭐ 新增
```

---

### 4. **comment_replies** (留言回覆表)
```
comment_id → comments.id (CASCADE)
```

---

### 5. **order_joiners** (訂單參與者表)
```
order_id → orders.id (CASCADE)
user_id → users.id (CASCADE)
comment_id → comments.id (SET NULL) ⭐ 新增
```

---

### 6. **notifications** (通知表)
```
user_id → users.id (CASCADE)
order_id → orders.id (CASCADE) ⭐ 新增
commenter_id → users.id (SET NULL) ⭐ 新增
```

---

### 7. **user_tiers** (用戶信譽等級表)
```
user_id → users.id (CASCADE)
```

---

### 8. **reviews** (評價表)
```
target_user_id → users.id (CASCADE)
reviewer_id → users.id (CASCADE)
order_id → orders.id (CASCADE)
```

---

### 9. **score_history** (積分歷史表)
```
user_id → users.id (CASCADE)
order_id → orders.id (CASCADE) ⭐ 新增
```

---

### 10. **tier_history** (等級提升歷史表)
```
user_id → users.id (CASCADE)
```

---

### 11. **user_likes** (用戶點讚表)
```
user_id → users.id (CASCADE)
order_id → orders.id (CASCADE)
```

---

### 12. **order_history** (訂單歷史記錄表)
```
order_id → orders.id (CASCADE)
user_id → users.id (CASCADE)
```

---

### 13. **verification_codes** (驗證碼表)
**無外鍵約束** - 獨立表，不需要外鍵

---

## ⭐ 新增的外鍵約束

在本次更新中，我們添加了以下 **6 個**新的外鍵約束：

1. ✅ `comments.parent_id` → `comments.id` (SET NULL)
   - 支援留言的回覆功能

2. ✅ `comments.ignored_by` → `users.id` (SET NULL)
   - 記錄誰忽略了留言

3. ✅ `order_joiners.comment_id` → `comments.id` (SET NULL)
   - 連結參與者和留言

4. ✅ `notifications.order_id` → `orders.id` (CASCADE)
   - 確保通知與訂單的連結

5. ✅ `notifications.commenter_id` → `users.id` (SET NULL)
   - 記錄通知相關的留言者

6. ✅ `score_history.order_id` → `orders.id` (CASCADE)
   - 連結積分歷史與訂單

---

## 🛡️ 資料完整性保護

### CASCADE 刪除策略
- 當父記錄被刪除時，子記錄也會被刪除
- 適用於：訂單、留言、評價等主要記錄

### SET NULL 刪除策略
- 當父記錄被刪除時，子記錄的外鍵欄位設為 NULL
- 適用於：可選關聯、歷史記錄中的引用

---

## 📈 資料庫關係圖

```
users (核心表)
 ├── orders (created_by)
 │    ├── comments (order_id)
 │    │    ├── comment_replies (comment_id)
 │    │    └── comments (parent_id) [自引用]
 │    ├── order_joiners (order_id)
 │    │    └── comments (comment_id)
 │    ├── reviews (order_id)
 │    ├── notifications (order_id)
 │    ├── user_likes (order_id)
 │    ├── order_history (order_id)
 │    └── score_history (order_id)
 ├── comments (commenter_id)
 │    └── users (ignored_by)
 ├── order_joiners (user_id)
 ├── notifications (user_id)
 │    └── users (commenter_id)
 ├── user_tiers (user_id)
 ├── reviews (target_user_id, reviewer_id)
 ├── score_history (user_id)
 ├── tier_history (user_id)
 ├── user_likes (user_id)
 └── order_history (user_id)
```

---

## ✅ 總結

- **總計**：13 個資料表
- **有外鍵約束的表**：12 個
- **獨立表**：1 個 (verification_codes)
- **總外鍵數量**：19 個
- **新增外鍵**：6 個
- **資料完整性**：✅ 完全保護

您的資料庫現在具有完整的外鍵約束，可以確保：
- 資料完整性
- 一致性和可靠性
- 自動級聯刪除/更新
- 防止孤立記錄

