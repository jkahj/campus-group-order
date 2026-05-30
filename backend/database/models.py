"""
BUYCART 資料庫模型定義
使用 SQLAlchemy ORM 定義所有資料表模型
"""

from sqlalchemy import Column, String, Integer, Boolean, Text, TIMESTAMP, BIGINT, DECIMAL, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .db_config import Base


class User(Base):
    """用戶表模型"""
    __tablename__ = 'users'
    
    id = Column(String(50), primary_key=True, comment='用戶ID')
    name = Column(String(100), nullable=False, comment='用戶名稱')
    email = Column(String(255), unique=True, comment='電子郵件')
    phone = Column(String(20), unique=True, comment='手機號碼')
    password = Column(String(255), comment='密碼（Hashed）')
    photo = Column(String(500), comment='用戶頭像URL')
    google_id = Column(String(255), unique=True, comment='Google ID')
    login_method = Column(Enum('email', 'google', 'google_demo'), default='email', comment='登入方式')
    is_demo = Column(Boolean, default=False, comment='是否為演示帳號')
    device_token = Column(String(500), comment='推送通知設備令牌')
    rating = Column(DECIMAL(3, 2), default=0.00, comment='平均評分（0-5）')
    review_count = Column(Integer, default=0, comment='被評價次數')
    gender = Column(String(10), comment='性別')
    city = Column(String(100), comment='城市')
    about_me = Column(Text, comment='關於我')
    is_active = Column(Boolean, default=True, comment='帳號是否啟用')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='創建時間')
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), comment='更新時間')
    
    # 關聯
    orders = relationship('Order', back_populates='creator', cascade='all, delete-orphan')
    # 移除 comments 和 notifications 關係，因為 Comment 和 Notification 都有多個外鍵指向 User
    # comments = relationship('Comment', foreign_keys='Comment.commenter_id', back_populates='commenter', cascade='all, delete-orphan')
    # notifications = relationship('Notification', foreign_keys='Notification.user_id', back_populates='user', cascade='all, delete-orphan')
    user_tier = relationship('UserTier', back_populates='user', uselist=False, cascade='all, delete-orphan')
    reviews_received = relationship('Review', foreign_keys='Review.target_user_id', back_populates='target_user', cascade='all, delete-orphan')
    reviews_given = relationship('Review', foreign_keys='Review.reviewer_id', back_populates='reviewer', cascade='all, delete-orphan')


class Order(Base):
    """訂單表模型"""
    __tablename__ = 'orders'
    
    id = Column(String(50), primary_key=True, comment='訂單ID')
    name = Column(String(200), nullable=False, comment='商店名稱')
    address = Column(Text, nullable=False, comment='代購地點')
    phone = Column(String(20), comment='聯絡電話')
    line = Column(String(100), comment='Line ID')
    method = Column(String(100), comment='付款方式')
    note = Column(Text, comment='備註說明')
    # 代購明細（由代購者填寫）
    item_price = Column(Integer, comment='商品總金額（單位：元）')
    detail_image = Column(Text, comment='代購明細圖片（Base64 或 圖片 URL）')
    joined = Column(Integer, default=0, comment='參與人數')
    status = Column(Enum('preparing', 'delivering', 'completed', 'cancelled', 'expired'), default='preparing', comment='訂單狀態')
    color = Column(String(20), default='green', comment='訂單顏色標記')
    comments = Column(Integer, default=0, comment='留言數量')
    liked = Column(Boolean, default=False, comment='是否已點讚')
    like_count = Column(Integer, default=0, comment='點讚數量')
    created_by = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, comment='發起者用戶ID')
    created_at = Column(BIGINT, nullable=False, comment='創建時間戳')
    expires_at = Column(BIGINT, comment='到期時間戳')
    completed_at = Column(BIGINT, comment='完成時間戳')
    cancelled_at = Column(BIGINT, comment='取消時間戳')
    cancellation_reason = Column(Text, comment='取消原因')
    
    # 關聯
    creator = relationship('User', back_populates='orders')
    order_comments = relationship('Comment', back_populates='order', cascade='all, delete-orphan')
    joiners = relationship('OrderJoiner', back_populates='order', cascade='all, delete-orphan')
    reviews = relationship('Review', back_populates='order', cascade='all, delete-orphan')


class Comment(Base):
    """留言表模型"""
    __tablename__ = 'comments'
    
    id = Column(String(50), primary_key=True, comment='留言ID')
    order_id = Column(String(50), ForeignKey('orders.id', ondelete='CASCADE'), nullable=False, comment='訂單ID')
    commenter_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, comment='留言者ID')
    commenter_name = Column(String(100), nullable=False, comment='留言者名稱')
    commenter_phone = Column(String(20), comment='留言者電話')
    commenter_line = Column(String(100), comment='留言者Line ID')
    text = Column(Text, nullable=False, comment='留言內容')
    # item_name 和 quantity 已移至 comment_items 表，不再在此表中
    is_order_request = Column(Boolean, default=True, comment='是否為接單請求')
    is_reply = Column(Boolean, default=False, comment='是否為回覆')
    parent_id = Column(String(50), ForeignKey('comments.id', ondelete='SET NULL'), comment='父留言ID（用於回覆）')
    delivery_status = Column(Enum('pending', 'accepted', 'delivering', 'completed', 'rejected'), default='pending', comment='配送狀態')
    accepted = Column(Boolean, default=False, comment='是否已接單')
    accepted_at = Column(BIGINT, comment='接單時間')
    completed = Column(Boolean, default=False, comment='是否已完成')
    completed_time = Column(BIGINT, comment='完成時間')
    rating = Column(Integer, comment='評分（1-5）')
    rating_comment = Column(Text, comment='評分留言')
    status = Column(Enum('active', 'ignored', 'deleted'), default='active', comment='留言狀態')
    ignored_reason = Column(Text, comment='忽略原因')
    ignored_by = Column(String(50), ForeignKey('users.id', ondelete='SET NULL'), comment='忽略者ID')
    ignored_at = Column(BIGINT, comment='忽略時間')
    show_new_badge = Column(Boolean, default=True, comment='顯示新留言標籤')
    new_badge_expire_time = Column(BIGINT, comment='新留言標籤過期時間')
    timestamp = Column(BIGINT, nullable=False, comment='留言時間戳')
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), comment='更新時間')
    
    # 關聯
    order = relationship('Order', back_populates='order_comments')
    commenter = relationship('User', foreign_keys=[commenter_id])  # 移除 back_populates，因為 User 中沒有 comments 關係
    replies = relationship('CommentReply', back_populates='comment', cascade='all, delete-orphan')
    items = relationship('CommentItem', back_populates='comment', cascade='all, delete-orphan')


class CommentItem(Base):
    """留言商品項目表模型"""
    __tablename__ = 'comment_items'
    
    id = Column(String(50), primary_key=True, comment='商品項目ID')
    comment_id = Column(String(50), ForeignKey('comments.id', ondelete='CASCADE'), nullable=False, comment='留言ID')
    item_name = Column(String(200), nullable=False, comment='商品名稱')
    quantity = Column(Integer, comment='商品數量')
    item_price = Column(Integer, comment='商品單價（單位：元）')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='創建時間')
    
    # 關聯
    comment = relationship('Comment', back_populates='items')


class CommentReply(Base):
    """留言回覆表模型"""
    __tablename__ = 'comment_replies'
    
    id = Column(String(50), primary_key=True, comment='回覆ID')
    comment_id = Column(String(50), ForeignKey('comments.id', ondelete='CASCADE'), nullable=False, comment='留言ID')
    user = Column(String(100), nullable=False, comment='回覆者名稱')
    text = Column(Text, nullable=False, comment='回覆內容')
    timestamp = Column(BIGINT, nullable=False, comment='回覆時間戳')
    show_new_badge = Column(Boolean, default=True, comment='顯示新回覆標籤')
    new_badge_expire_time = Column(BIGINT, comment='新回覆標籤過期時間')
    
    # 關聯
    comment = relationship('Comment', back_populates='replies')


class OrderJoiner(Base):
    """訂單參與者表模型"""
    __tablename__ = 'order_joiners'
    
    id = Column(String(50), primary_key=True, comment='參與記錄ID')
    order_id = Column(String(50), ForeignKey('orders.id', ondelete='CASCADE'), nullable=False, comment='訂單ID')
    user_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, comment='參與者用戶ID')
    name = Column(String(100), nullable=False, comment='參與者名稱')
    phone = Column(String(20), comment='電話')
    line = Column(String(100), comment='Line ID')
    join_time = Column(BIGINT, nullable=False, comment='參與時間')
    status = Column(Enum('pending', 'accepted', 'rejected'), default='pending', comment='參與狀態')
    comment_id = Column(String(50), ForeignKey('comments.id', ondelete='SET NULL'), comment='關聯的留言ID')
    accepted_at = Column(BIGINT, comment='接單時間')
    
    # 關聯
    order = relationship('Order', back_populates='joiners')
    user = relationship('User')


class Notification(Base):
    """通知表模型"""
    __tablename__ = 'notifications'
    
    id = Column(String(50), primary_key=True, comment='通知ID')
    user_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, comment='接收者用戶ID')
    type = Column(String(50), nullable=False, comment='通知類型')
    title = Column(String(200), nullable=False, comment='通知標題')
    body = Column(Text, nullable=False, comment='通知內容')
    order_id = Column(String(50), ForeignKey('orders.id', ondelete='CASCADE'), comment='關聯訂單ID')
    commenter_id = Column(String(50), ForeignKey('users.id', ondelete='SET NULL'), comment='關聯留言者ID')
    order_name = Column(String(200), comment='訂單名稱')
    read = Column(Boolean, default=False, comment='是否已讀')
    ts = Column(BIGINT, nullable=False, comment='時間戳')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='創建時間')
    
    # 關聯
    user = relationship('User', foreign_keys=[user_id])  # 移除 back_populates，避免多外鍵歧義


class UserTier(Base):
    """用戶信譽等級表模型"""
    __tablename__ = 'user_tiers'
    
    user_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True, comment='用戶ID')
    score = Column(Integer, default=100, comment='信譽積分')
    tier = Column(Enum('掰咖', '買咖', '團咖', '咖王', '咖皇'), default='買咖', comment='信譽等級')
    last_updated = Column(BIGINT, nullable=False, comment='最後更新時間')
    
    # 關聯
    user = relationship('User', back_populates='user_tier')


class Review(Base):
    """評價表模型"""
    __tablename__ = 'reviews'
    
    id = Column(String(50), primary_key=True, comment='評價ID')
    target_user_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, comment='被評價者ID')
    reviewer_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, comment='評價者ID')
    reviewer_name = Column(String(100), nullable=False, comment='評價者名稱')
    rating = Column(Integer, nullable=False, comment='評分（1-5）')
    comment = Column(Text, comment='評價內容')
    order_id = Column(String(50), ForeignKey('orders.id', ondelete='CASCADE'), nullable=False, comment='關聯訂單ID')
    order_name = Column(String(200), comment='訂單名稱')
    order_location = Column(Text, comment='訂單地點')
    order_contact = Column(String(100), comment='訂單聯絡方式')
    is_from_purchaser = Column(Boolean, default=False, comment='是否來自代購者')
    timestamp = Column(BIGINT, nullable=False, comment='評價時間戳')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='創建時間')
    
    # 關聯
    target_user = relationship('User', foreign_keys=[target_user_id], back_populates='reviews_received')
    reviewer = relationship('User', foreign_keys=[reviewer_id], back_populates='reviews_given')
    order = relationship('Order', back_populates='reviews')


class ScoreHistory(Base):
    """積分歷史表模型"""
    __tablename__ = 'score_history'
    
    id = Column(String(50), primary_key=True, comment='歷史記錄ID')
    user_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, comment='用戶ID')
    order_id = Column(String(50), ForeignKey('orders.id', ondelete='CASCADE'), comment='關聯訂單ID')
    action = Column(String(200), nullable=False, comment='操作描述')
    score_change = Column(Integer, nullable=False, comment='積分變化')
    new_score = Column(Integer, nullable=False, comment='新的積分')
    type = Column(Enum('positive', 'negative'), nullable=False, comment='變化類型')
    timestamp = Column(BIGINT, nullable=False, comment='時間戳')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='創建時間')
    
    # 關聯
    user = relationship('User')


class TierHistory(Base):
    """等級提升歷史表模型"""
    __tablename__ = 'tier_history'
    
    id = Column(String(50), primary_key=True, comment='歷史記錄ID')
    user_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, comment='用戶ID')
    old_tier = Column(String(20), nullable=False, comment='舊等級')
    new_tier = Column(String(20), nullable=False, comment='新等級')
    type = Column(String(20), default='upgrade', comment='類型')
    timestamp = Column(BIGINT, nullable=False, comment='時間戳')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='創建時間')
    
    # 關聯
    user = relationship('User')


class UserLike(Base):
    """用戶點讚表模型"""
    __tablename__ = 'user_likes'
    
    id = Column(String(50), primary_key=True, comment='點讚記錄ID')
    user_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, comment='用戶ID')
    order_id = Column(String(50), ForeignKey('orders.id', ondelete='CASCADE'), nullable=False, comment='訂單ID')
    liked = Column(Boolean, default=True, comment='是否點讚')
    timestamp = Column(BIGINT, nullable=False, comment='時間戳')
    
    # 關聯
    user = relationship('User')
    order = relationship('Order')


class OrderHistory(Base):
    """訂單歷史記錄表模型"""
    __tablename__ = 'order_history'
    
    id = Column(String(50), primary_key=True, comment='歷史記錄ID')
    order_id = Column(String(50), ForeignKey('orders.id', ondelete='CASCADE'), nullable=False, comment='訂單ID')
    user_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, comment='用戶ID')
    action = Column(String(100), nullable=False, comment='操作類型')
    description = Column(Text, comment='操作描述')
    timestamp = Column(BIGINT, nullable=False, comment='時間戳')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='創建時間')
    
    # 關聯
    order = relationship('Order')
    user = relationship('User')


class VerificationCode(Base):
    """驗證碼表模型"""
    __tablename__ = 'verification_codes'
    
    id = Column(String(50), primary_key=True, comment='驗證碼ID')
    account = Column(String(255), nullable=False, comment='帳號（email或phone）')
    code = Column(String(10), nullable=False, comment='驗證碼')
    expires_at = Column(BIGINT, nullable=False, comment='過期時間戳')
    used = Column(Boolean, default=False, comment='是否已使用')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='創建時間')

