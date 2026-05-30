from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import asyncio
from datetime import datetime
import uvicorn
import sys
import os
import random
import string

# 添加父目錄到 Python 路徑
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 嘗試導入資料庫模塊
try:
    from database import SessionLocal, User, Order, UserLike, Comment, CommentItem
    from sqlalchemy.orm import Session
    DB_AVAILABLE = True
except ImportError:
    DB_AVAILABLE = False
    print("警告：資料庫模塊無法導入，將使用模擬數據")

app = FastAPI()

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 模擬用戶資料庫（僅當資料庫不可用時使用）
users_db = {
    "user_1": {"id": "user_1", "name": "張三", "device_token": "device_token_1", "notifications": []},
    "user_2": {"id": "user_2", "name": "李四", "device_token": "device_token_2", "notifications": []},
    "user_3": {"id": "user_3", "name": "王五", "device_token": "device_token_3", "notifications": []},
}

# 模擬訂單資料庫（僅當資料庫不可用時使用）
orders_db = {}

# 模擬點讚數據（僅當資料庫不可用時使用）
user_likes_db = {}  # {user_id: {order_id: liked}}

def get_db():
    """獲取資料庫會話"""
    if not DB_AVAILABLE:
        return None
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class LoginRequest(BaseModel):
    email: str
    password: str

class NotificationRequest(BaseModel):
    user_id: str
    title: str
    body: str
    order_id: Optional[str] = None
    type: str = "general"

class DeviceTokenRequest(BaseModel):
    user_id: str
    device_token: str

class ToggleLikeRequest(BaseModel):
    order_id: str
    user_id: str

class CommentItemCreate(BaseModel):
    item_name: str
    quantity: Optional[int] = None

class CommentCreate(BaseModel):
    id: str
    order_id: str
    commenter_id: str
    commenter_name: str
    commenter_phone: Optional[str] = None
    commenter_line: Optional[str] = None
    text: str
    item_name: Optional[str] = None  # 保留向後兼容
    quantity: Optional[int] = None  # 保留向後兼容
    items: Optional[List[CommentItemCreate]] = None  # 多個商品
    is_order_request: bool = True
    is_reply: bool = False
    parent_id: Optional[str] = None
    delivery_status: str = 'pending'
    accepted: bool = False
    completed: bool = False
    status: str = 'active'
    show_new_badge: bool = True
    new_badge_expire_time: Optional[int] = None
    timestamp: int

class CommentUpdate(BaseModel):
    text: Optional[str] = None
    delivery_status: Optional[str] = None
    accepted: Optional[bool] = None
    completed: Optional[bool] = None
    status: Optional[str] = None

@app.post("/login")
def login(data: LoginRequest):
    # 模擬帳號密碼驗證
    if data.email == "test@buyka.com" and data.password == "123456":
        return {"token": "fake-jwt-token", "user_id": "user_1"}
    raise HTTPException(status_code=401, detail="帳號或密碼錯誤")

@app.post("/register-device-token")
def register_device_token(data: DeviceTokenRequest):
    """註冊用戶的設備推送令牌"""
    if data.user_id in users_db:
        users_db[data.user_id]["device_token"] = data.device_token
        return {"success": True, "message": "設備令牌已註冊"}
    raise HTTPException(status_code=404, detail="用戶不存在")

@app.post("/send-notification")
def send_notification(data: NotificationRequest):
    """發送個別通知給特定用戶"""
    if data.user_id not in users_db:
        raise HTTPException(status_code=404, detail="用戶不存在")
    
    # 建立通知記錄
    notification = {
        "id": f"notif_{datetime.now().timestamp()}",
        "user_id": data.user_id,
        "title": data.title,
        "body": data.body,
        "order_id": data.order_id,
        "type": data.type,
        "timestamp": datetime.now().isoformat(),
        "read": False
    }
    
    # 儲存到用戶的通知列表
    users_db[data.user_id]["notifications"].append(notification)
    
    # 這裡應該實作真正的推送通知服務（如 Firebase Cloud Messaging）
    # 目前模擬發送成功
    print(f"推送通知已發送給用戶 {data.user_id}: {data.title} - {data.body}")
    
    return {"success": True, "notification_id": notification["id"]}

@app.get("/user-notifications/{user_id}")
def get_user_notifications(user_id: str):
    """獲取用戶的所有通知"""
    if user_id not in users_db:
        raise HTTPException(status_code=404, detail="用戶不存在")
    
    return {
        "notifications": users_db[user_id]["notifications"],
        "unread_count": len([n for n in users_db[user_id]["notifications"] if not n["read"]])
    }

@app.post("/mark-notification-read/{user_id}/{notification_id}")
def mark_notification_read(user_id: str, notification_id: str):
    """標記通知為已讀"""
    if user_id not in users_db:
        raise HTTPException(status_code=404, detail="用戶不存在")
    
    for notification in users_db[user_id]["notifications"]:
        if notification["id"] == notification_id:
            notification["read"] = True
            return {"success": True, "message": "通知已標記為已讀"}
    
    raise HTTPException(status_code=404, detail="通知不存在")

@app.post("/send-arrival-notification")
def send_arrival_notification(user_id: str, order_name: str):
    """發送到貨通知"""
    return send_notification(NotificationRequest(
        user_id=user_id,
        title="到貨通知",
        body=f"您的代購訂單「{order_name}」已到貨，請及時領取！",
        type="arrival"
    ))

# ==================== 點讚 API ====================

@app.post("/likes/toggle")
def toggle_like(data: ToggleLikeRequest, db: Session = Depends(get_db) if DB_AVAILABLE else None):
    """切換點讚狀態"""
    import random
    import string
    
    if DB_AVAILABLE and db is not None:
        # 使用真正的資料庫
        order_id = data.order_id
        user_id = data.user_id
        
        # 檢查訂單是否存在
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="訂單不存在")
        
        # 檢查用戶是否存在
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="用戶不存在")
        
        # 查找現有的點讚記錄
        existing_like = db.query(UserLike).filter(
            UserLike.user_id == user_id,
            UserLike.order_id == order_id
        ).first()
        
        timestamp = int(datetime.now().timestamp() * 1000)
        
        if existing_like:
            # 如果已存在，切換狀態
            was_liked = existing_like.liked
            existing_like.liked = not was_liked
            existing_like.timestamp = timestamp
            
            # 更新訂單的點讚數量
            if not was_liked:
                order.like_count = (order.like_count or 0) + 1
            else:
                order.like_count = max(0, (order.like_count or 0) - 1)
            
            db.commit()
            db.refresh(existing_like)
            
            return {
                "success": True,
                "liked": existing_like.liked,
                "like_count": order.like_count
            }
        else:
            # 創建新的點讚記錄
            like_id = f"like_{''.join(random.choices(string.ascii_letters + string.digits, k=15))}"
            
            new_like = UserLike(
                id=like_id,
                user_id=user_id,
                order_id=order_id,
                liked=True,
                timestamp=timestamp
            )
            
            db.add(new_like)
            
            # 更新訂單的點讚數量
            order.like_count = (order.like_count or 0) + 1
            
            db.commit()
            db.refresh(new_like)
            
            return {
                "success": True,
                "liked": True,
                "like_count": order.like_count
            }
    else:
        # 使用模擬數據
        order_id = data.order_id
        user_id = data.user_id
        
        if user_id not in user_likes_db:
            user_likes_db[user_id] = {}
        
        current_liked = user_likes_db[user_id].get(order_id, False)
        new_liked = not current_liked
        user_likes_db[user_id][order_id] = new_liked
        
        return {
            "success": True,
            "liked": new_liked,
            "like_count": 0  # 模擬模式不跟蹤總數
        }

@app.get("/likes/user/{user_id}/order/{order_id}")
def get_user_like_status(user_id: str, order_id: str, db: Session = Depends(get_db) if DB_AVAILABLE else None):
    """獲取用戶對訂單的點讚狀態"""
    if DB_AVAILABLE and db is not None:
        like_record = db.query(UserLike).filter(
            UserLike.user_id == user_id,
            UserLike.order_id == order_id
        ).first()
        
        if not like_record:
            return {"liked": False, "like_count": 0}
        
        order = db.query(Order).filter(Order.id == order_id).first()
        like_count = order.like_count if order else 0
        
        return {
            "liked": like_record.liked,
            "like_count": like_count
        }
    else:
        # 使用模擬數據
        liked = user_likes_db.get(user_id, {}).get(order_id, False)
        return {"liked": liked, "like_count": 0}

@app.get("/likes/order/{order_id}/count")
def get_order_like_count(order_id: str, db: Session = Depends(get_db) if DB_AVAILABLE else None):
    """獲取訂單的點讚數量"""
    if DB_AVAILABLE and db is not None:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="訂單不存在")
        
        return {
            "order_id": order_id,
            "like_count": order.like_count or 0
        }
    else:
        return {"order_id": order_id, "like_count": 0}

@app.get("/likes/user/{user_id}")
def get_user_likes(user_id: str, db: Session = Depends(get_db) if DB_AVAILABLE else None):
    """獲取用戶的所有點讚訂單"""
    if DB_AVAILABLE and db is not None:
        likes = db.query(UserLike).filter(
            UserLike.user_id == user_id,
            UserLike.liked == True
        ).all()
        return likes
    else:
        # 使用模擬數據
        user_likes = user_likes_db.get(user_id, {})
        result = []
        for order_id, liked in user_likes.items():
            if liked:
                result.append({
                    "id": f"like_{order_id}",
                    "user_id": user_id,
                    "order_id": order_id,
                    "liked": True,
                    "timestamp": int(datetime.now().timestamp() * 1000)
                })
        return result

# ==================== 留言 API ====================

@app.post("/comments")
def create_comment(data: CommentCreate, db: Session = Depends(get_db) if DB_AVAILABLE else None):
    """創建留言"""
    if DB_AVAILABLE and db is not None:
        try:
            # 檢查訂單是否存在
            order = db.query(Order).filter(Order.id == data.order_id).first()
            if not order:
                raise HTTPException(status_code=404, detail="訂單不存在")
            
            # 驗證 commenter_id（如果是 'me' 或臨時 ID，需要特殊處理）
            commenter_id = data.commenter_id
            if commenter_id and (commenter_id == 'me' or commenter_id.startswith('me_') or commenter_id.startswith('temp_')):
                # 嘗試從 users 表中查找或創建一個臨時用戶記錄
                # 這裡我們允許使用臨時 ID，但會在資料庫中記錄
                pass  # 暫時允許，因為可能是未登入用戶
            
            # 創建留言（item_name 和 quantity 已移至 comment_items 表，不再在此處設置）
            comment = Comment(
                id=data.id,
                order_id=data.order_id,
                commenter_id=data.commenter_id,
                commenter_name=data.commenter_name,
                commenter_phone=data.commenter_phone,
                commenter_line=data.commenter_line,
                text=data.text,
                # item_name 和 quantity 已移至 comment_items 表
                is_order_request=data.is_order_request,
                is_reply=data.is_reply,
                parent_id=data.parent_id,
                delivery_status=data.delivery_status,
                accepted=data.accepted,
                completed=data.completed,
                status=data.status,
                show_new_badge=data.show_new_badge,
                new_badge_expire_time=data.new_badge_expire_time,
                timestamp=data.timestamp
            )
            
            db.add(comment)
            db.flush()  # 獲取comment.id
            
            # 處理多個商品，統一保存到 comment_items 表
            import time
            items_to_save = []
            
            # 如果有 items，使用 items
            if data.items and len(data.items) > 0:
                items_to_save = data.items
            # 如果沒有 items 但有 item_name（向後兼容），創建一個 item
            elif data.item_name:
                from pydantic import BaseModel
                class TempItem(BaseModel):
                    item_name: str
                    quantity: Optional[int] = None
                items_to_save = [TempItem(item_name=data.item_name, quantity=data.quantity)]
            
            # 保存所有商品到 comment_items 表
            for idx, item_data in enumerate(items_to_save):
                try:
                    # 處理 CommentItemCreate 對象或字典
                    if hasattr(item_data, 'item_name'):
                        item_name = item_data.item_name
                        quantity = item_data.quantity
                    elif isinstance(item_data, dict):
                        item_name = item_data.get('item_name') or item_data.get('itemName', '')
                        quantity = item_data.get('quantity')
                    else:
                        continue
                    
                    # 驗證商品資料
                    if not item_name or not item_name.strip():
                        continue  # 跳過無效的商品
                    
                    item_id = f"item_{comment.id}_{idx}_{int(time.time() * 1000)}"
                    comment_item = CommentItem(
                        id=item_id,
                        comment_id=comment.id,
                        item_name=item_name.strip(),
                        quantity=quantity if quantity is not None else None
                    )
                    db.add(comment_item)
                except Exception as item_error:
                    # 如果表不存在或其他錯誤，記錄警告但繼續處理
                    print(f"⚠️ 創建商品項目失敗: {str(item_error)}")
                    continue
            
            # 更新訂單的留言數量
            order.comments = (order.comments or 0) + 1
            
            db.commit()
            db.refresh(comment)
            
            # 載入商品項目
            if DB_AVAILABLE:
                db.refresh(comment, ['items'])
            
            return comment
        except Exception as e:
            db.rollback()
            import traceback
            error_detail = str(e)
            error_trace = traceback.format_exc()
            print(f"❌ 創建留言失敗: {error_detail}")
            print(f"錯誤堆疊: {error_trace}")
            # 提供更詳細的錯誤訊息
            if 'commenter_id' in error_detail.lower() or 'foreign key' in error_detail.lower():
                raise HTTPException(status_code=400, detail=f"留言者ID無效或不存在: {error_detail}")
            elif 'order_id' in error_detail.lower():
                raise HTTPException(status_code=404, detail=f"訂單不存在: {error_detail}")
            elif 'items' in error_detail.lower() or 'item_name' in error_detail.lower():
                raise HTTPException(status_code=400, detail=f"商品資料格式錯誤: {error_detail}")
            else:
                raise HTTPException(status_code=500, detail=f"創建留言失敗: {error_detail}")
    else:
        # 模擬模式
        return {
            "id": data.id,
            "order_id": data.order_id,
            "commenter_id": data.commenter_id,
            "commenter_name": data.commenter_name,
            "text": data.text,
            "timestamp": data.timestamp
        }

@app.get("/comments/order/{order_id}")
def get_comments_by_order(order_id: str, db: Session = Depends(get_db) if DB_AVAILABLE else None):
    """獲取訂單的所有留言"""
    if DB_AVAILABLE and db is not None:
        try:
            comments = db.query(Comment).filter(
                Comment.order_id == order_id,
                Comment.status == 'active'
            ).order_by(Comment.timestamp.desc()).all()
            
            # 為每個留言載入商品項目
            for comment in comments:
                try:
                    if hasattr(comment, 'items'):
                        # 確保items被載入
                        _ = comment.items
                except Exception as e:
                    # 如果載入items失敗（可能是表不存在），嘗試手動查詢
                    try:
                        comment_items = db.query(CommentItem).filter(CommentItem.comment_id == comment.id).all()
                        # 將商品項目轉換為字典格式
                        comment.items = [
                            {
                                'item_name': item.item_name,
                                'quantity': item.quantity
                            }
                            for item in comment_items
                        ]
                    except Exception:
                        # 如果查詢也失敗，設置為空列表
                        comment.items = []
            
            return comments
        except Exception as e:
            print(f"獲取訂單留言失敗: {str(e)}")
            # 返回空列表而不是拋出異常，避免前端崩潰
            return []
    else:
        return []

@app.get("/comments/{comment_id}")
def get_comment(comment_id: str, db: Session = Depends(get_db) if DB_AVAILABLE else None):
    """獲取單個留言"""
    if DB_AVAILABLE and db is not None:
        comment = db.query(Comment).filter(Comment.id == comment_id).first()
        if not comment:
            raise HTTPException(status_code=404, detail="留言不存在")
        return comment
    else:
        raise HTTPException(status_code=404, detail="留言不存在")

@app.put("/comments/{comment_id}")
def update_comment(comment_id: str, data: CommentUpdate, db: Session = Depends(get_db) if DB_AVAILABLE else None):
    """更新留言"""
    if DB_AVAILABLE and db is not None:
        comment = db.query(Comment).filter(Comment.id == comment_id).first()
        if not comment:
            raise HTTPException(status_code=404, detail="留言不存在")
        
        # 更新欄位
        for key, value in data.dict(exclude_unset=True).items():
            if hasattr(comment, key):
                setattr(comment, key, value)
        
        db.commit()
        db.refresh(comment)
        return comment
    else:
        return {"success": True}

@app.delete("/comments/{comment_id}")
def delete_comment(comment_id: str, db: Session = Depends(get_db) if DB_AVAILABLE else None):
    """刪除留言"""
    if DB_AVAILABLE and db is not None:
        comment = db.query(Comment).filter(Comment.id == comment_id).first()
        if not comment:
            raise HTTPException(status_code=404, detail="留言不存在")
        
        # 獲取訂單以更新計數
        order = db.query(Order).filter(Order.id == comment.order_id).first()
        
        db.delete(comment)
        
        # 更新訂單的留言數量
        if order:
            order.comments = max(0, (order.comments or 0) - 1)
        
        db.commit()
        return {"message": "留言已刪除"}
    else:
        return {"message": "留言已刪除"}

@app.get("/health")
def health_check():
    """健康檢查"""
    return {"status": "healthy", "db_available": DB_AVAILABLE}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, access_log=False)
