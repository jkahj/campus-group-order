"""
BUYCART 完整的 FastAPI 後端 API
整合資料庫操作
"""

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging
import uvicorn
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
import sys
import os
import base64
from uuid import uuid4

# 添加父目錄到 Python 路徑
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 導入資料庫模型和配置
from database import (
    SessionLocal, User, Order, Comment, CommentItem, CommentReply, OrderJoiner,
    Notification, UserTier, Review, ScoreHistory, TierHistory,
    UserLike, OrderHistory, VerificationCode
)

app = FastAPI(title="BUYCART API", version="1.0.0")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_ROOT = os.path.join(BASE_DIR, 'static')
USER_PHOTO_ROOT = os.path.join(STATIC_ROOT, 'user_photos')
ORDER_PHOTO_ROOT = os.path.join(STATIC_ROOT, 'order_photos')
os.makedirs(USER_PHOTO_ROOT, exist_ok=True)
os.makedirs(ORDER_PHOTO_ROOT, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_ROOT), name="static")

# 配置 CORS 中間件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允許所有來源
    allow_credentials=True,
    allow_methods=["*"],  # 允許所有方法
    allow_headers=["*"],  # 允許所有標頭
)

# 資料庫依賴
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==================== Pydantic 模型 ====================

class UserCreate(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    photo: Optional[str] = None
    google_id: Optional[str] = None
    login_method: str = 'email'
    is_demo: bool = False
    device_token: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    photo: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    about_me: Optional[str] = None

class OrderCreate(BaseModel):
    id: str
    name: str
    address: str
    phone: Optional[str] = None
    line: Optional[str] = None
    method: Optional[str] = None
    note: Optional[str] = None
    # 代購明細（由代購者填寫）
    item_price: Optional[int] = None
    detail_image: Optional[str] = None
    joined: Optional[int] = 0
    color: Optional[str] = 'green'
    comments: Optional[int] = 0
    liked: Optional[bool] = False
    like_count: Optional[int] = 0
    created_by: str
    created_at: int
    expires_at: Optional[int] = None
    completed_at: Optional[int] = None
    cancelled_at: Optional[int] = None
    cancellation_reason: Optional[str] = None
    status: Optional[str] = 'preparing'

class OrderUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    joined: Optional[int] = None
    comments: Optional[int] = None
    # 允許更新代購明細
    item_price: Optional[int] = None
    detail_image: Optional[str] = None

class CommentItemCreate(BaseModel):
    item_name: str
    quantity: int  # 必填
    item_price: Optional[int] = None  # 商品單價（單位：元）

class CommentCreate(BaseModel):
    id: str
    order_id: str
    commenter_id: str
    commenter_name: str
    commenter_phone: str  # 必填
    commenter_line: Optional[str] = None
    text: str
    item_name: Optional[str] = None  # 保留向後兼容
    quantity: Optional[int] = None  # 保留向後兼容
    items: Optional[List[CommentItemCreate]] = None  # 多個商品
    timestamp: int
    # 以下欄位用於向後兼容，如果沒有提供則使用默認值
    is_order_request: Optional[bool] = True
    is_reply: Optional[bool] = False
    parent_id: Optional[str] = None
    delivery_status: Optional[str] = 'pending'
    accepted: Optional[bool] = False
    completed: Optional[bool] = False
    status: Optional[str] = 'active'
    show_new_badge: Optional[bool] = True
    new_badge_expire_time: Optional[int] = None

class CommentUpdate(BaseModel):
    text: Optional[str] = None
    item_name: Optional[str] = None  # 保留向後兼容
    quantity: Optional[int] = None  # 保留向後兼容
    items: Optional[List[CommentItemCreate]] = None  # 多個商品
    commenter_phone: Optional[str] = None
    commenter_line: Optional[str] = None
    delivery_status: Optional[str] = None
    accepted: Optional[bool] = None
    completed: Optional[bool] = None
    completed_time: Optional[int] = None
    rating: Optional[int] = None
    rating_comment: Optional[str] = None
    status: Optional[str] = None
    ignored_reason: Optional[str] = None
    ignored_by: Optional[str] = None
    ignored_at: Optional[int] = None

class CommentReplyCreate(BaseModel):
    id: Optional[str] = None
    comment_id: str
    user: str
    text: str
    timestamp: Optional[int] = None
    show_new_badge: Optional[bool] = True
    new_badge_expire_time: Optional[int] = None

class ScoreHistoryCreate(BaseModel):
    id: Optional[str] = None
    user_id: str
    order_id: Optional[str] = None
    action: str
    score_change: int
    new_score: int
    type: Optional[str] = None
    timestamp: Optional[int] = None

class TierHistoryCreate(BaseModel):
    id: Optional[str] = None
    user_id: str
    old_tier: str
    new_tier: str
    type: Optional[str] = 'upgrade'
    timestamp: Optional[int] = None

class UserTierCreate(BaseModel):
    user_id: str
    score: Optional[int] = 100
    tier: Optional[str] = '買咖'
    last_updated: Optional[int] = None

class NotificationCreate(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    body: str
    order_id: Optional[str] = None
    commenter_id: Optional[str] = None
    order_name: Optional[str] = None
    ts: int

class NotificationRequest(BaseModel):
    user_id: str
    title: str
    body: str
    order_id: Optional[str] = None
    type: str = "general"

class DeviceTokenRequest(BaseModel):
    user_id: str
    device_token: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ToggleLikeRequest(BaseModel):
    order_id: str
    user_id: str

# ==================== 用戶 API ====================

@app.post("/users")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """創建用戶"""
    # 兼容 Pydantic v1 和 v2
    if hasattr(user, 'model_dump'):
        user_data = user.model_dump()
    else:
        user_data = user.dict()
    db_user = User(**user_data)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.get("/users/list")
def get_all_users(db: Session = Depends(get_db)):
    """獲取所有用戶"""
    users = db.query(User).all()
    return users

@app.get("/users/{user_id}")
def get_user(user_id: str, db: Session = Depends(get_db)):
    """獲取用戶"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用戶不存在")
    return user


def _save_user_photo_from_data_url(user_id: str, data_url: str) -> str:
    if ';base64,' not in data_url:
        raise ValueError("圖片資料格式錯誤，缺少 base64 編碼段")
    
    header, encoded = data_url.split(';base64,', 1)
    mime_type = 'image/jpeg'
    if header.startswith('data:'):
        mime_type = header.split(':', 1)[1] or mime_type
    
    extension = mime_type.split('/')[-1].lower()
    allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif']
    if extension == 'jpeg':
        extension = 'jpg'
    if extension not in allowed_extensions:
        extension = 'jpg'
    
    try:
        image_bytes = base64.b64decode(encoded)
    except Exception as decode_error:
        raise ValueError(f"圖片資料解碼失敗: {decode_error}") from decode_error
    
    user_dir = os.path.join(USER_PHOTO_ROOT, user_id)
    os.makedirs(user_dir, exist_ok=True)
    
    file_name = f"{user_id}_{int(datetime.utcnow().timestamp())}_{uuid4().hex}.{extension}"
    file_path = os.path.join(user_dir, file_name)
    with open(file_path, 'wb') as file:
        file.write(image_bytes)
    
    relative_path = os.path.join('user_photos', user_id, file_name).replace('\\', '/')
    return f"/static/{relative_path}"


def _save_order_photo_from_data_url(order_id: str, data_url: str) -> str:
    """從 data URL 儲存訂單明細照片，回傳可供前端使用的相對路徑"""
    if ';base64,' not in data_url:
        raise ValueError("圖片資料格式錯誤，缺少 base64 編碼段")

    header, encoded = data_url.split(';base64,', 1)
    mime_type = 'image/jpeg'
    if header.startswith('data:'):
        mime_type = header.split(':', 1)[1] or mime_type

    extension = mime_type.split('/')[-1].lower()
    allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif']
    if extension == 'jpeg':
        extension = 'jpg'
    if extension not in allowed_extensions:
        extension = 'jpg'

    try:
        image_bytes = base64.b64decode(encoded)
    except Exception as decode_error:
        raise ValueError(f"圖片資料解碼失敗: {decode_error}") from decode_error

    order_dir = os.path.join(ORDER_PHOTO_ROOT, order_id)
    os.makedirs(order_dir, exist_ok=True)

    file_name = f"{order_id}_{int(datetime.utcnow().timestamp())}_{uuid4().hex}.{extension}"
    file_path = os.path.join(order_dir, file_name)
    with open(file_path, 'wb') as file:
        file.write(image_bytes)

    relative_path = os.path.join('order_photos', order_id, file_name).replace('\\', '/')
    return f"/static/{relative_path}"

@app.put("/users/{user_id}")
def update_user(user_id: str, user_data: UserUpdate, db: Session = Depends(get_db)):
    """更新用戶"""
    import sys
    sys.stdout.write(f"\n[更新用戶] 收到更新請求: user_id={user_id}\n")
    sys.stdout.flush()
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        sys.stdout.write(f"[更新用戶] ❌ 用戶不存在: {user_id}\n")
        sys.stdout.flush()
        raise HTTPException(status_code=404, detail="用戶不存在")
    
    # 兼容 Pydantic v1 和 v2
    # 不使用 exclude_unset=True，確保所有欄位都被包含，包括 None 值
    if hasattr(user_data, 'model_dump'):
        data_dict = user_data.model_dump()
    else:
        data_dict = user_data.dict()
    
    sys.stdout.write(f"[更新用戶] 接收到的更新資料: {data_dict}\n")
    sys.stdout.flush()
    
    # 記錄更新前的值
    before_values = {
        'gender': getattr(user, 'gender', None),
        'city': getattr(user, 'city', None),
        'about_me': getattr(user, 'about_me', None),
    }
    sys.stdout.write(f"[更新用戶] 更新前的值: {before_values}\n")
    sys.stdout.flush()
    
    try:
        if 'photo' in data_dict and isinstance(data_dict['photo'], str):
            raw_photo_value = data_dict['photo'].strip()
            if raw_photo_value.startswith('data:image'):
                sys.stdout.write("[更新用戶] 檢測到 data URL 圖片，開始轉檔...\n")
                sys.stdout.flush()
                try:
                    processed_photo_path = _save_user_photo_from_data_url(user_id, raw_photo_value)
                    data_dict['photo'] = processed_photo_path
                    sys.stdout.write(f"[更新用戶] 圖片已儲存為: {processed_photo_path}\n")
                    sys.stdout.flush()
                except ValueError as image_error:
                    sys.stdout.write(f"[更新用戶] ❌ 圖片處理失敗: {image_error}\n")
                    sys.stdout.flush()
                    raise HTTPException(status_code=400, detail=str(image_error))
                except Exception as unexpected_error:
                    sys.stdout.write(f"[更新用戶] ❌ 圖片儲存發生未知錯誤: {unexpected_error}\n")
                    sys.stdout.flush()
                    raise HTTPException(status_code=500, detail="圖片處理失敗，請稍後再試")
            elif not raw_photo_value:
                data_dict['photo'] = None

        # 明確處理每個欄位，確保 None 值也能正確設置
        # 只更新實際提供的欄位（排除 None 且未設置的欄位）
        fields_to_update = ['name', 'email', 'phone', 'photo', 'rating', 'review_count', 'gender', 'city', 'about_me']
        for key in fields_to_update:
            if key in data_dict:
                value = data_dict[key]
                # 如果值是空字串，轉換為 None
                if value == '':
                    value = None
                sys.stdout.write(f"[更新用戶] 設置 {key} = {value} (類型: {type(value)})\n")
                sys.stdout.flush()
                setattr(user, key, value)
        
        # 提交變更到資料庫
        db.commit()
        sys.stdout.write(f"[更新用戶] commit() 執行成功\n")
        sys.stdout.flush()
        
        # 刷新對象以從資料庫獲取最新值
        db.refresh(user)
        sys.stdout.write(f"[更新用戶] refresh() 執行成功\n")
        sys.stdout.flush()
        
        # 記錄更新後的值
        after_values = {
            'gender': getattr(user, 'gender', None),
            'city': getattr(user, 'city', None),
            'about_me': getattr(user, 'about_me', None),
        }
        sys.stdout.write(f"[更新用戶] ✅ 更新成功，更新後的值: {after_values}\n")
        sys.stdout.flush()
        
        # 再次查詢資料庫確認值已保存
        verify_user = db.query(User).filter(User.id == user_id).first()
        if verify_user:
            verify_values = {
                'gender': getattr(verify_user, 'gender', None),
                'city': getattr(verify_user, 'city', None),
                'about_me': getattr(verify_user, 'about_me', None),
            }
            sys.stdout.write(f"[更新用戶] 🔍 資料庫驗證值: {verify_values}\n")
            sys.stdout.flush()
        
        return user
    except Exception as e:
        # 如果發生錯誤，回滾事務
        db.rollback()
        error_msg = str(e)
        sys.stdout.write(f"[更新用戶] ❌ 更新失敗: {error_msg}\n")
        import traceback
        sys.stdout.write(f"[更新用戶] 錯誤詳情: {traceback.format_exc()}\n")
        sys.stdout.flush()
        raise HTTPException(status_code=500, detail=f"更新用戶失敗: {error_msg}")

@app.delete("/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db)):
    """刪除用戶"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用戶不存在")
    
    db.delete(user)
    db.commit()
    return {"message": "用戶已刪除"}

@app.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """用戶登入（支持電子郵件或手機號碼）"""
    import sys
    sys.stdout.write(f"\n[登入] 收到登入請求: email={data.email}\n")
    sys.stdout.flush()
    
    # 嘗試通過電子郵件或手機號碼查找用戶
    user = db.query(User).filter(
        or_(User.email == data.email, User.phone == data.email)
    ).first()
    
    if not user:
        sys.stdout.write(f"[登入] ❌ 用戶不存在: {data.email}\n")
        sys.stdout.flush()
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    
    sys.stdout.write(f"[登入] ✅ 找到用戶: {user.name} (ID: {user.id})\n")
    sys.stdout.flush()
    
    # 處理 None 情況並去除空白字符
    db_password = str(user.password).strip() if user.password is not None else ""
    input_password = str(data.password).strip() if data.password is not None else ""
    
    sys.stdout.write(f"[登入] 資料庫密碼: '{db_password}' vs 輸入密碼: '{input_password}'\n")
    sys.stdout.flush()
    
    if db_password != input_password:
        sys.stdout.write(f"[登入] ❌ 密碼不匹配\n")
        sys.stdout.flush()
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    
    sys.stdout.write(f"[登入] ✅ 登入成功: {user.name}\n")
    sys.stdout.flush()
    
    # 返回完整的用戶資訊
    return {
        "success": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "photo": user.photo,
            "login_method": user.login_method,
            "is_demo": user.is_demo
        }
    }

@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    """用戶註冊"""
    import sys
    sys.stdout.write(f"\n[註冊] 收到註冊請求: ID={user.id}, name={user.name}, email={user.email}, phone={user.phone}\n")
    sys.stdout.flush()
    
    # 檢查用戶 ID 是否已存在
    existing_user = db.query(User).filter(User.id == user.id).first()
    if existing_user:
        sys.stdout.write(f"[註冊] ❌ 用戶ID已存在: {user.id}\n")
        sys.stdout.flush()
        raise HTTPException(status_code=400, detail="用戶ID已存在")
    
    # 檢查手機號碼是否已存在
    if user.phone:
        existing_phone = db.query(User).filter(User.phone == user.phone).first()
        if existing_phone:
            sys.stdout.write(f"[註冊] ❌ 手機號碼已被註冊: {user.phone}\n")
            sys.stdout.flush()
            raise HTTPException(status_code=400, detail="該手機號碼已被註冊")
    
    # 檢查電子郵件是否已存在
    if user.email:
        existing_email = db.query(User).filter(User.email == user.email).first()
        if existing_email:
            sys.stdout.write(f"[註冊] ❌ 電子郵件已被註冊: {user.email}\n")
            sys.stdout.flush()
            raise HTTPException(status_code=400, detail="該電子郵件已被註冊")
    
    try:
        sys.stdout.write(f"[註冊] 準備創建用戶: ID={user.id}, name={user.name}\n")
        sys.stdout.flush()
        
        # 兼容 Pydantic v1 和 v2
        if hasattr(user, 'model_dump'):
            user_data = user.model_dump()
        else:
            user_data = user.dict()
        
        # 處理照片欄位，將 data URL 轉換成實際檔案並儲存
        if 'photo' in user_data and isinstance(user_data['photo'], str):
            raw_photo_value = user_data['photo'].strip()
            if raw_photo_value.startswith('data:image'):
                sys.stdout.write("[註冊] 檢測到 data URL 圖片，開始轉檔...\n")
                sys.stdout.flush()
                try:
                    processed_photo_path = _save_user_photo_from_data_url(user.id, raw_photo_value)
                    user_data['photo'] = processed_photo_path
                    sys.stdout.write(f"[註冊] 圖片已儲存為: {processed_photo_path}\n")
                    sys.stdout.flush()
                except ValueError as image_error:
                    sys.stdout.write(f"[註冊] ❌ 圖片處理失敗: {image_error}\n")
                    sys.stdout.flush()
                    raise HTTPException(status_code=400, detail=str(image_error))
                except Exception as unexpected_error:
                    sys.stdout.write(f"[註冊] ❌ 圖片儲存發生未知錯誤: {unexpected_error}\n")
                    sys.stdout.flush()
                    raise HTTPException(status_code=500, detail="圖片處理失敗，請稍後再試")
            elif not raw_photo_value:
                user_data['photo'] = None
        
        db_user = User(**user_data)
        db.add(db_user)
        db.commit()
        
        sys.stdout.write(f"[註冊] ✅ 用戶已成功註冊到資料庫: {db_user.id} - {db_user.name}\n")
        sys.stdout.flush()
        
        db.refresh(db_user)
        
        # 驗證用戶是否真的在資料庫中
        verify_user = db.query(User).filter(User.id == db_user.id).first()
        if verify_user:
            sys.stdout.write(f"[註冊] ✅ 驗證成功，用戶存在於資料庫中\n")
        else:
            sys.stdout.write(f"[註冊] ⚠️ 警告：用戶未在資料庫中找到\n")
        sys.stdout.flush()
        
        return db_user
    except Exception as e:
        db.rollback()
        error_detail = str(e)
        
        sys.stdout.write(f"[註冊] ❌ 註冊失敗: {error_detail}\n")
        sys.stdout.flush()
        
        # 分析錯誤類型
        if "duplicate entry" in error_detail.lower() and "phone" in error_detail.lower():
            raise HTTPException(status_code=400, detail="該手機號碼已被註冊")
        elif "duplicate entry" in error_detail.lower() and "email" in error_detail.lower():
            raise HTTPException(status_code=400, detail="該電子郵件已被註冊")
        elif "duplicate entry" in error_detail.lower():
            raise HTTPException(status_code=400, detail="該帳號資訊已被註冊")
        else:
            raise HTTPException(status_code=500, detail=f"註冊失敗: {error_detail}")

# ==================== 訂單 API ====================

@app.post("/orders")
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    """創建訂單"""
    import sys
    sys.stdout.write(f"\n[創建訂單] 收到訂單創建請求: id={order.id}, name={order.name}, created_by={order.created_by}\n")
    sys.stdout.flush()
    
    # 檢查發起者是否存在（在 try-except 外，確保返回正確的錯誤碼）
    creator = db.query(User).filter(User.id == order.created_by).first()
    if not creator:
        # 發起者已被刪除或不存在
        sys.stdout.write(f"[創建訂單] ❌ 發起者用戶不存在: user_id={order.created_by}\n")
        sys.stdout.flush()
        raise HTTPException(status_code=404, detail=f"發起者用戶不存在（ID: {order.created_by}）")
    
    sys.stdout.write(f"[創建訂單] ✅ 發起者用戶存在: {creator.name} (ID: {creator.id})\n")
    sys.stdout.flush()
    
    try:
        # 創建訂單
        # 兼容 Pydantic v1 和 v2
        if hasattr(order, 'model_dump'):
            order_data = order.model_dump()
        else:
            order_data = order.dict()
        
        sys.stdout.write(f"[創建訂單] 準備創建訂單: {order_data.get('id')} - {order_data.get('name')}\n")
        sys.stdout.flush()
        
        db_order = Order(**order_data)
        db.add(db_order)
        db.commit()
        db.refresh(db_order)
        
        sys.stdout.write(f"[創建訂單] ✅ 訂單已成功創建到資料庫: {db_order.id} - {db_order.name}\n")
        sys.stdout.flush()
        
        return db_order
    except HTTPException:
        # 重新拋出 HTTPException，避免被外層 except 捕獲
        raise
    except Exception as e:
        # 記錄詳細錯誤訊息
        error_detail = str(e)
        import traceback
        sys.stdout.write(f"[創建訂單] ❌ 創建訂單失敗: {error_detail}\n")
        sys.stdout.write(f"[創建訂單] 錯誤堆疊:\n{traceback.format_exc()}\n")
        sys.stdout.flush()
        
        db.rollback()
        
        # 分析錯誤類型並提供更詳細的錯誤訊息
        if "foreign key" in error_detail.lower() or "FOREIGN KEY" in error_detail:
            if "user_id" in error_detail.lower() or "created_by" in error_detail.lower():
                raise HTTPException(
                    status_code=400, 
                    detail=f"無法創建訂單：發起者用戶不存在或無效（ID: {order.created_by}）"
                )
            else:
                raise HTTPException(status_code=400, detail=f"無法創建訂單：外鍵約束錯誤 - {error_detail}")
        elif "duplicate" in error_detail.lower() or "UNIQUE constraint" in error_detail:
            raise HTTPException(status_code=400, detail=f"訂單ID已存在: {order.id}")
        else:
            raise HTTPException(status_code=500, detail=f"創建訂單失敗: {error_detail}")

@app.get("/orders")
def get_all_orders(db: Session = Depends(get_db)):
    """獲取所有訂單"""
    orders = db.query(Order).all()
    return orders

@app.get("/orders/{order_id}")
def get_order(order_id: str, db: Session = Depends(get_db)):
    """獲取訂單"""
    try:
        # 使用 get() 方法更安全，避免 SQL 構建錯誤
        order = db.get(Order, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="訂單不存在")
        return order
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"查詢訂單失敗 (order_id={order_id}): {str(e)}")
        # 如果 get() 失敗，嘗試使用傳統查詢方式
        try:
            order = db.query(Order).filter(Order.id == order_id).first()
            if not order:
                raise HTTPException(status_code=404, detail="訂單不存在")
            return order
        except Exception as query_error:
            logger.error(f"查詢訂單失敗（傳統方式）: {str(query_error)}")
            raise HTTPException(status_code=500, detail=f"查詢訂單失敗: {str(query_error)}")

@app.get("/orders/user/{user_id}")
def get_orders_by_user(user_id: str, db: Session = Depends(get_db)):
    """獲取用戶的訂單"""
    orders = db.query(Order).filter(Order.created_by == user_id).all()
    return orders

@app.put("/orders/{order_id}")
def update_order(order_id: str, order_data: OrderUpdate, db: Session = Depends(get_db)):
    """更新訂單"""
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="訂單不存在")
        
        # 兼容 Pydantic v1 和 v2
        if hasattr(order_data, 'model_dump'):
            data_dict = order_data.model_dump(exclude_unset=True)
        else:
            data_dict = order_data.dict(exclude_unset=True)
        
        # 驗證狀態值（如果提供）
        if 'status' in data_dict:
            valid_statuses = ['preparing', 'delivering', 'completed', 'cancelled', 'expired']
            if data_dict['status'] not in valid_statuses:
                raise HTTPException(
                    status_code=400, 
                    detail=f"無效的訂單狀態: {data_dict['status']}。有效狀態: {', '.join(valid_statuses)}"
                )
        
        for key, value in data_dict.items():
            setattr(order, key, value)
        
        db.commit()
        db.refresh(order)
        return order
    except HTTPException:
        # 重新拋出 HTTPException（如 404, 400）
        raise
    except Exception as e:
        db.rollback()
        error_detail = str(e)
        print(f"❌ 更新訂單失敗: {error_detail}")
        # 檢查是否為資料庫約束錯誤（如 ENUM 類型不匹配）
        if 'enum' in error_detail.lower() or 'invalid' in error_detail.lower():
            raise HTTPException(
                status_code=400, 
                detail=f"訂單狀態無效，請確保資料庫已更新支援 'expired' 狀態: {error_detail}"
            )
        raise HTTPException(status_code=500, detail=f"更新訂單失敗: {error_detail}")

@app.delete("/orders/{order_id}")
def delete_order(order_id: str, db: Session = Depends(get_db)):
    """刪除訂單"""
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="訂單不存在")
        
        db.delete(order)
        db.commit()
        return {"message": "訂單已刪除"}
    except HTTPException:
        # 重新拋出 HTTPException（如 404）
        raise
    except Exception as e:
        db.rollback()
        error_detail = str(e)
        print(f"❌ 刪除訂單失敗: {error_detail}")
        raise HTTPException(status_code=500, detail=f"刪除訂單失敗: {error_detail}")

# ==================== 留言 API ====================

@app.post("/comments")
def create_comment(comment: CommentCreate, db: Session = Depends(get_db)):
    """創建留言並保存到資料庫"""
    import time  # 在函數開頭導入 time 模組
    order = None  # 初始化 order 變數，避免在異常處理中未定義
    try:
        logger.info(f"收到創建留言請求: order_id={comment.order_id}, commenter={comment.commenter_name}")
        
        # 檢查訂單是否存在
        order = db.query(Order).filter(Order.id == comment.order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="訂單不存在")
        
        # 兼容 Pydantic v1 和 v2
        if hasattr(comment, 'model_dump'):
            comment_data = comment.model_dump()
        else:
            comment_data = comment.dict()
        
        # 提取items（如果有的話）
        items_data = comment_data.pop('items', None)
        
        # 移除 item_name 和 quantity（這些欄位已移至 comment_items 表）
        # 保留這些值用於向後兼容處理（創建 comment_item）
        item_name_backup = comment_data.pop('item_name', None)
        quantity_backup = comment_data.pop('quantity', None)
        
        # 明確移除這些欄位，確保它們不會被傳遞給 Comment 模型
        if 'item_name' in comment_data:
            del comment_data['item_name']
        if 'quantity' in comment_data:
            del comment_data['quantity']
        
        # 如果沒有 items_data 但有 item_name_backup，創建 items_data
        if not items_data and item_name_backup:
            items_data = [{'item_name': item_name_backup, 'quantity': quantity_backup}]
        
        # 驗證必填欄位（檢查 None 和空字符串）
        commenter_phone = comment_data.get('commenter_phone')
        if not commenter_phone or (isinstance(commenter_phone, str) and not commenter_phone.strip()):
            logger.error("電話號碼為空或無效")
            raise HTTPException(status_code=400, detail="電話號碼為必填項目")
        
        # 調試：檢查 comment_data 中是否還包含 item_name 和 quantity
        if 'item_name' in comment_data or 'quantity' in comment_data:
            logger.warning(f"⚠️ comment_data 中仍然包含 item_name 或 quantity: {comment_data.keys()}")
            # 強制移除
            comment_data.pop('item_name', None)
            comment_data.pop('quantity', None)
        
        logger.info(f"創建留言: order_id={comment_data.get('order_id')}, commenter={comment_data.get('commenter_name')}, phone={commenter_phone}, 商品數量={len(items_data) if items_data else 0}")
        logger.debug(f"comment_data 欄位: {list(comment_data.keys())}")
    
        # 只傳遞 Comment 模型實際存在的欄位
        allowed_fields = {
            'id', 'order_id', 'commenter_id', 'commenter_name', 'commenter_phone', 'commenter_line',
            'text', 'is_order_request', 'is_reply', 'parent_id', 'delivery_status', 'accepted',
            'accepted_at', 'completed', 'completed_time', 'rating', 'rating_comment', 'status',
            'ignored_reason', 'ignored_by', 'ignored_at', 'show_new_badge', 'new_badge_expire_time', 'timestamp'
        }
        filtered_comment_data = {k: v for k, v in comment_data.items() if k in allowed_fields}
        
        db_comment = Comment(**filtered_comment_data)
        db.add(db_comment)
        db.flush()  # 獲取comment.id
        logger.info(f"留言記錄已創建: comment_id={db_comment.id}")

        # 處理多個商品（如果表存在則保存，不存在則只保存到comments表）
        # 處理多個商品，統一保存到 comment_items 表
        items_saved = 0
        if items_data:
            for idx, item_data in enumerate(items_data):
                try:
                    # 處理字典格式（來自前端）或對象格式
                    if isinstance(item_data, dict):
                        item_name = item_data.get('item_name') or item_data.get('itemName', '')
                        quantity = item_data.get('quantity')
                    else:
                        # 如果是 CommentItemCreate 對象
                        item_name = item_data.item_name
                        quantity = item_data.quantity
                    
                    if not item_name:
                        logger.warning(f"第{idx + 1}個商品的商品名稱為空，跳過")
                        continue
                    if quantity is None:
                        logger.warning(f"第{idx + 1}個商品的數量為空，跳過")
                        continue
                    
                    try:
                        item_id = f"item_{db_comment.id}_{idx}_{int(time.time() * 1000)}"
                        # 提取商品單價
                        item_price = None
                        if isinstance(item_data, dict):
                            item_price = item_data.get('item_price')
                        elif hasattr(item_data, 'item_price'):
                            item_price = item_data.item_price
                        
                        comment_item = CommentItem(
                            id=item_id,
                            comment_id=db_comment.id,
                            item_name=item_name,
                            quantity=quantity,
                            item_price=item_price
                        )
                        db.add(comment_item)
                        items_saved += 1
                        logger.info(f"商品項目已創建: {item_name} x{quantity} (單價: {item_price or '未設定'}, item_id: {item_id})")
                    except Exception as item_error:
                        error_msg = str(item_error)
                        logger.warning(f"創建商品項目失敗（可能是表不存在）: {error_msg}")
                        # 如果表不存在，記錄警告但繼續處理，不中斷整個流程
                        if "doesn't exist" in error_msg.lower() or "table" in error_msg.lower() or "no such table" in error_msg.lower():
                            logger.warning("comment_items 表不存在，商品項目將不會保存。請執行: backend/database/create_comment_items_table.sql")
                        # 不拋出異常，讓留言本身能夠保存
                except Exception as e:
                    logger.warning(f"處理商品項目時出錯: {str(e)}")
                    # 繼續處理下一個商品
        
        if items_saved > 0:
            logger.info(f"成功保存 {items_saved} 個商品項目到 comment_items 表")
        else:
            logger.warning("⚠️ 沒有商品項目被保存到 comment_items 表")
        
        # 更新訂單的留言數量（確保 order 已定義）
        if order:
            order.comments = (order.comments or 0) + 1
            logger.info(f"訂單留言數量已更新: order_id={order.id}, comments={order.comments}")
        else:
            logger.warning("⚠️ order 變數未定義，無法更新訂單留言數量")
    
        db.commit()
        db.refresh(db_comment)
        
        # 載入商品項目（如果關係存在）
        try:
            if hasattr(db_comment, 'items'):
                _ = db_comment.items
                # 確保 items 包含 item_price
                if db_comment.items:
                    for item in db_comment.items:
                        if not hasattr(item, 'item_price') and not isinstance(item, dict):
                            # 如果是 ORM 對象，需要手動查詢
                            comment_items = db.query(CommentItem).filter(CommentItem.comment_id == db_comment.id).all()
                            db_comment.items = [
                                {
                                    'item_name': ci.item_name,
                                    'quantity': ci.quantity,
                                    'item_price': ci.item_price
                                }
                                for ci in comment_items
                            ]
                            break
        except Exception as item_error:
            logger.warning(f"載入商品項目關係失敗，嘗試手動查詢: {str(item_error)}")
            # 手動查詢商品項目
            try:
                comment_items = db.query(CommentItem).filter(CommentItem.comment_id == db_comment.id).all()
                db_comment.items = [
                    {
                        'item_name': item.item_name,
                        'quantity': item.quantity,
                        'item_price': item.item_price
                    }
                    for item in comment_items
                ]
            except Exception as query_error:
                logger.warning(f"手動查詢商品項目失敗: {str(query_error)}")
                db_comment.items = []
        
        logger.info(f"✅ 留言創建成功: comment_id={db_comment.id}, 商品數量={len(items_data) if items_data else 0}")
        logger.info(f"✅ 資料庫提交成功，留言已保存: comment_id={db_comment.id}")
        return db_comment
    except HTTPException as http_ex:
        # 重新拋出 HTTPException（如 404）
        db.rollback()
        logger.error(f"❌ HTTP 異常: {http_ex.status_code} - {http_ex.detail}")
        raise
    except Exception as e:
        db.rollback()
        import traceback
        error_detail = str(e)
        error_trace = traceback.format_exc()
        logger.error(f"❌ 提交留言到資料庫失敗: {error_detail}")
        logger.error(f"錯誤堆疊:\n{error_trace}")
        # 檢查是否是表不存在的錯誤
        if "doesn't exist" in error_detail.lower() or "table" in error_detail.lower() or "no such table" in error_detail.lower():
            raise HTTPException(status_code=500, detail="資料庫表不存在，請先執行資料庫遷移腳本: backend/database/create_comment_items_table.sql")
        # 檢查是否是變數未定義的錯誤
        if "not defined" in error_detail.lower() or "name" in error_detail.lower():
            logger.error(f"❌ 變數未定義錯誤，請檢查代碼: {error_detail}")
            raise HTTPException(status_code=500, detail=f"代碼錯誤: {error_detail}。請檢查後端日誌獲取詳細資訊。")
        raise HTTPException(status_code=500, detail=f"保存留言失敗: {error_detail}")

@app.get("/comments/{comment_id}")
def get_comment(comment_id: str, db: Session = Depends(get_db)):
    """獲取留言"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="留言不存在")
    
    # 載入商品項目（包含 item_price）
    try:
        if hasattr(comment, 'items'):
            # 確保items被載入
            _ = comment.items
        else:
            # 手動查詢商品項目
            comment_items = db.query(CommentItem).filter(CommentItem.comment_id == comment_id).all()
            comment.items = [
                {
                    'item_name': item.item_name,
                    'quantity': item.quantity,
                    'item_price': item.item_price
                }
                for item in comment_items
            ]
    except Exception as e:
        # 如果載入items失敗，手動查詢
        try:
            comment_items = db.query(CommentItem).filter(CommentItem.comment_id == comment_id).all()
            comment.items = [
                {
                    'item_name': item.item_name,
                    'quantity': item.quantity,
                    'item_price': item.item_price
                }
                for item in comment_items
            ]
        except Exception as item_error:
            logger.warning(f"載入留言商品項目失敗 (comment_id: {comment_id}): {str(item_error)}")
            comment.items = []
    
    return comment

@app.get("/comments/order/{order_id}")
def get_comments_by_order(order_id: str, db: Session = Depends(get_db)):
    """獲取訂單的所有留言"""
    try:
        comments = db.query(Comment).filter(Comment.order_id == order_id).all()
        
        # 為每個留言載入商品項目
        for comment in comments:
            try:
                if hasattr(comment, 'items'):
                    # 確保items被載入
                    _ = comment.items
            except Exception as e:
                # 如果載入items失敗（可能是表不存在），記錄錯誤但繼續處理
                logger.warning(f"載入留言商品項目失敗 (comment_id: {comment.id}): {str(e)}")
                # 手動查詢商品項目
                try:
                    comment_items = db.query(CommentItem).filter(CommentItem.comment_id == comment.id).all()
                    # 將商品項目轉換為字典格式
                    comment.items = [
                        {
                            'item_name': item.item_name,
                            'quantity': item.quantity,
                            'item_price': item.item_price
                        }
                        for item in comment_items
                    ]
                except Exception as item_error:
                    logger.warning(f"手動查詢商品項目失敗 (comment_id: {comment.id}): {str(item_error)}")
                    # 如果查詢也失敗，設置為空列表
                    comment.items = []
        
        logger.info(f"成功載入訂單留言: order_id={order_id}, 留言數量={len(comments)}")
        return comments
    except Exception as e:
        error_detail = str(e)
        logger.error(f"獲取訂單留言失敗 (order_id: {order_id}): {error_detail}")
        raise HTTPException(status_code=500, detail=f"獲取訂單留言失敗: {error_detail}")

@app.put("/comments/{comment_id}")
def update_comment(comment_id: str, comment_data: CommentUpdate, db: Session = Depends(get_db), user_id: Optional[str] = Query(None)):
    """更新留言（僅限留言者本人）"""
    import sys
    sys.stdout.write(f"\n[更新留言] 收到請求: comment_id={comment_id}, user_id={user_id}\n")
    sys.stdout.flush()
    
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        sys.stdout.write(f"[更新留言] ❌ 留言不存在: {comment_id}\n")
        sys.stdout.flush()
        raise HTTPException(status_code=404, detail="留言不存在")
    
    # 權限檢查：留言者本人或訂單發起者可以編輯
    if user_id:
        # 檢查是否為留言者本人
        is_commenter = comment.commenter_id == user_id
        
        # 檢查是否為訂單發起者（允許訂單發起者更新商品金額）
        is_order_creator = False
        if comment.order_id:
            order = db.query(Order).filter(Order.id == comment.order_id).first()
            if order and order.created_by == user_id:
                is_order_creator = True
        
        # 如果既不是留言者也不是訂單發起者，拒絕訪問
        if not is_commenter and not is_order_creator:
            sys.stdout.write(f"[更新留言] ❌ 權限不足: commenter_id={comment.commenter_id}, order_creator={order.created_by if order else 'N/A'}, user_id={user_id}\n")
            sys.stdout.flush()
            raise HTTPException(status_code=403, detail="只有留言者本人或訂單發起者可以編輯此留言")
        
        # 如果是訂單發起者（但不是留言者），只允許更新商品相關資訊（item_price）
        if is_order_creator and not is_commenter:
            # 提前提取 items 並檢查是否只更新 items
            if hasattr(comment_data, 'model_dump'):
                temp_data_dict = comment_data.model_dump(exclude_unset=True)
            else:
                temp_data_dict = comment_data.dict(exclude_unset=True)
            
            # 移除 items 後檢查是否還有其他欄位
            temp_items = temp_data_dict.pop('items', None)
            has_other_fields = bool(temp_data_dict)
            
            if has_other_fields:
                # 訂單發起者只能更新 items（包含 item_price），不允許更新其他欄位
                sys.stdout.write(f"[更新留言] ⚠️ 訂單發起者只能更新商品金額，不允許更新其他欄位: {list(temp_data_dict.keys())}\n")
                sys.stdout.flush()
                # 清空其他欄位，只保留 items 更新
                temp_data_dict = {}
    
    # 兼容 Pydantic v1 和 v2
    if hasattr(comment_data, 'model_dump'):
        data_dict = comment_data.model_dump(exclude_unset=True)
    else:
        data_dict = comment_data.dict(exclude_unset=True)
    
    # 提取 items（如果有的話）
    items_data = data_dict.pop('items', None)
    
    # 移除不允許更新的欄位（如 commenter_id, order_id 等）
    restricted_fields = {'commenter_id', 'order_id', 'id', 'timestamp'}
    data_dict = {k: v for k, v in data_dict.items() if k not in restricted_fields}
    
    sys.stdout.write(f"[更新留言] 更新資料: {data_dict}\n")
    sys.stdout.flush()
    
    # 更新留言基本資訊
    for key, value in data_dict.items():
        if hasattr(comment, key):
            setattr(comment, key, value)
    
    db.flush()  # 確保 comment 已更新
    
    # 處理商品項目更新（刪除舊商品，創建新商品，確保數量正確更新）
    if items_data is not None:
        import time
        # 先刪除該留言的所有舊商品項目
        existing_items = db.query(CommentItem).filter(CommentItem.comment_id == comment_id).all()
        items_deleted = len(existing_items)
        for existing_item in existing_items:
            db.delete(existing_item)
        
        if items_deleted > 0:
            sys.stdout.write(f"[更新留言] 已刪除 {items_deleted} 個舊商品項目\n")
            sys.stdout.flush()
        
        # 創建新的商品項目（使用更新後的數量和價格）
        items_created = 0
        for idx, item_data in enumerate(items_data):
            try:
                # 處理字典格式或對象格式
                if isinstance(item_data, dict):
                    item_name = item_data.get('item_name') or item_data.get('itemName', '')
                    quantity = item_data.get('quantity')
                    item_price = item_data.get('item_price')
                else:
                    item_name = item_data.item_name
                    quantity = item_data.quantity
                    item_price = getattr(item_data, 'item_price', None)
                
                if not item_name or not item_name.strip():
                    continue  # 跳過無效的商品
                
                item_name = item_name.strip()
                quantity = quantity if quantity is not None else None
                
                # 創建新商品項目（使用更新後的數量和價格）
                item_id = f"item_{comment_id}_{idx}_{int(time.time() * 1000)}"
                comment_item = CommentItem(
                    id=item_id,
                    comment_id=comment_id,
                    item_name=item_name,
                    quantity=quantity,
                    item_price=item_price
                )
                db.add(comment_item)
                items_created += 1
                sys.stdout.write(f"[更新留言] 商品項目已更新: {item_name} x{quantity} (單價: {item_price or '未設定'})\n")
                sys.stdout.flush()
            except Exception as item_error:
                sys.stdout.write(f"[更新留言] ⚠️ 處理商品項目失敗: {str(item_error)}\n")
                sys.stdout.flush()
                continue
        
        if items_created > 0:
            sys.stdout.write(f"[更新留言] 成功創建 {items_created} 個新商品項目（已替換舊商品）\n")
            sys.stdout.flush()
    
    db.commit()
    db.refresh(comment)
    
    # 載入商品項目
    try:
        if hasattr(comment, 'items'):
            _ = comment.items
    except Exception:
        try:
            comment_items = db.query(CommentItem).filter(CommentItem.comment_id == comment_id).all()
            comment.items = [
                {
                    'item_name': item.item_name,
                    'quantity': item.quantity,
                    'item_price': item.item_price
                }
                for item in comment_items
            ]
        except Exception:
            comment.items = []
    
    sys.stdout.write(f"[更新留言] ✅ 留言已更新: {comment_id}\n")
    sys.stdout.flush()
    return comment

@app.delete("/comments/{comment_id}")
def delete_comment(comment_id: str, db: Session = Depends(get_db), user_id: Optional[str] = Query(None)):
    """刪除留言（僅限留言者本人）"""
    import sys
    sys.stdout.write(f"\n[刪除留言] 收到請求: comment_id={comment_id}, user_id={user_id}\n")
    sys.stdout.flush()
    
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        sys.stdout.write(f"[刪除留言] ❌ 留言不存在: {comment_id}\n")
        sys.stdout.flush()
        raise HTTPException(status_code=404, detail="留言不存在")
    
    # 權限檢查：只有留言者本人可以刪除
    if user_id and comment.commenter_id != user_id:
        sys.stdout.write(f"[刪除留言] ❌ 權限不足: commenter_id={comment.commenter_id}, user_id={user_id}\n")
        sys.stdout.flush()
        raise HTTPException(status_code=403, detail="只有留言者本人可以刪除此留言")
    
    # 獲取訂單以更新留言數量
    order = db.query(Order).filter(Order.id == comment.order_id).first()
    
    # 刪除留言（會級聯刪除 comment_items）
    db.delete(comment)
    
    # 更新訂單的留言數量
    if order:
        order.comments = max(0, (order.comments or 0) - 1)
    
    db.commit()
    sys.stdout.write(f"[刪除留言] ✅ 留言已刪除: {comment_id}\n")
    sys.stdout.flush()
    return {"message": "留言已刪除"}

# ==================== 留言回覆 API ====================
# ... (existing comment reply endpoints remain unchanged)

# ==================== 通知 API ====================
# ==================== 留言回覆 API ====================

@app.post("/comment-replies")
def create_comment_reply(reply: CommentReplyCreate, db: Session = Depends(get_db)):
    """創建留言回覆"""
    import sys
    sys.stdout.write(f"\n[留言回覆] 收到回覆請求: {reply}\n")
    sys.stdout.flush()

    if hasattr(reply, "model_dump"):
        reply_dict = reply.model_dump()
    else:
        reply_dict = reply.dict()

    comment_id = reply_dict.get("comment_id")
    if not comment_id:
        raise HTTPException(status_code=400, detail="缺少 comment_id")

    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail=f"留言不存在: {comment_id}")

    if not reply_dict.get("id"):
        generated_id = f"reply_{int(datetime.now().timestamp() * 1000)}"
        reply_dict["id"] = generated_id
        sys.stdout.write(f"[留言回覆] 未提供回覆ID，自動生成: {generated_id}\n")
        sys.stdout.flush()

    if not reply_dict.get("timestamp"):
        auto_timestamp = int(datetime.now().timestamp() * 1000)
        reply_dict["timestamp"] = auto_timestamp
        sys.stdout.write(f"[留言回覆] 未提供 timestamp，自動補上: {auto_timestamp}\n")
        sys.stdout.flush()

    if reply_dict.get("show_new_badge") is None:
        reply_dict["show_new_badge"] = True

    if reply_dict.get("new_badge_expire_time") is None and reply_dict.get("timestamp"):
        reply_dict["new_badge_expire_time"] = reply_dict["timestamp"] + 2 * 60 * 1000

    try:
        db_reply = CommentReply(**reply_dict)
        db.add(db_reply)
        db.commit()
        db.refresh(db_reply)

        sys.stdout.write(f"[留言回覆] ✅ 回覆已創建: {db_reply.id}\n")
        sys.stdout.flush()
        return db_reply
    except Exception as create_error:
        db.rollback()
        error_detail = str(create_error)
        sys.stdout.write(f"[留言回覆] ❌ 創建回覆失敗: {error_detail}\n")
        sys.stdout.flush()
        raise HTTPException(status_code=500, detail=f"創建留言回覆失敗: {error_detail}")


@app.get("/comment-replies/comment/{comment_id}")
def get_comment_replies(comment_id: str, db: Session = Depends(get_db)):
    """獲取留言的所有回覆"""
    replies = (
        db.query(CommentReply)
        .filter(CommentReply.comment_id == comment_id)
        .order_by(CommentReply.timestamp.asc())
        .all()
    )
    return replies


@app.get("/comment-replies/order/{order_id}")
def get_comment_replies_by_order(order_id: str, db: Session = Depends(get_db)):
    """獲取訂單的所有留言回覆"""
    replies = (
        db.query(CommentReply)
        .join(Comment, Comment.id == CommentReply.comment_id)
        .filter(Comment.order_id == order_id)
        .order_by(CommentReply.timestamp.asc())
        .all()
    )
    return replies

# ==================== 通知 API ====================

@app.post("/notifications")
def create_notification(notification: NotificationCreate, db: Session = Depends(get_db)):
    """創建通知"""
    import sys
    sys.stdout.write(f"\n[創建通知] 收到通知請求: user_id={notification.user_id}, title={notification.title}\n")
    sys.stdout.flush()
    
    try:
        # 驗證用戶是否存在
        user = db.query(User).filter(User.id == notification.user_id).first()
        if not user:
            sys.stdout.write(f"[創建通知] ❌ 用戶不存在: {notification.user_id}\n")
            sys.stdout.flush()
            raise HTTPException(status_code=400, detail=f"用戶不存在或無效: {notification.user_id}")
        
        # 兼容 Pydantic v1 和 v2
        if hasattr(notification, 'model_dump'):
            notification_data = notification.model_dump()
        else:
            notification_data = notification.dict()
        
        # 驗證必填欄位
        if not notification_data.get('id'):
            notification_data['id'] = f"notif_{int(datetime.now().timestamp() * 1000)}"
        
        if not notification_data.get('ts'):
            notification_data['ts'] = int(datetime.now().timestamp() * 1000)
        
        db_notification = Notification(**notification_data)
        db.add(db_notification)
        db.commit()
        db.refresh(db_notification)
        
        sys.stdout.write(f"[創建通知] ✅ 通知已創建: {db_notification.id}\n")
        sys.stdout.flush()
        
        return db_notification
    except HTTPException:
        # 重新拋出 HTTPException（如 404）
        raise
    except Exception as e:
        db.rollback()
        error_detail = str(e)
        sys.stdout.write(f"[創建通知] ❌ 創建通知失敗: {error_detail}\n")
        import traceback
        sys.stdout.write(f"[創建通知] 錯誤堆疊:\n{traceback.format_exc()}\n")
        sys.stdout.flush()
        
        # 檢查是否為外鍵約束錯誤
        if "foreign key constraint" in error_detail.lower() or "FOREIGN KEY" in error_detail:
            if "user_id" in error_detail:
                raise HTTPException(status_code=400, detail=f"用戶不存在或無效: {notification.user_id}")
            elif "order_id" in error_detail:
                raise HTTPException(status_code=400, detail=f"訂單不存在或無效: {notification.order_id}")
            else:
                raise HTTPException(status_code=400, detail=f"外鍵約束錯誤: {error_detail}")
        
        # 檢查是否為唯一性約束錯誤
        if "duplicate entry" in error_detail.lower() or "UNIQUE constraint" in error_detail:
            raise HTTPException(status_code=400, detail=f"通知 ID 已存在: {notification_data.get('id', 'N/A')}")
        
        # 其他錯誤
        raise HTTPException(status_code=500, detail=f"創建通知失敗: {error_detail}")

@app.get("/notifications/{notification_id}")
def get_notification(notification_id: str, db: Session = Depends(get_db)):
    """獲取通知"""
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="通知不存在")
    return notification

@app.get("/notifications/user/{user_id}")
def get_notifications_by_user(user_id: str, db: Session = Depends(get_db)):
    """獲取用戶的所有通知"""
    notifications = db.query(Notification).filter(Notification.user_id == user_id).all()
    unread_count = len([n for n in notifications if not n.read])
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }

@app.put("/notifications/{notification_id}")
def update_notification(notification_id: str, notification_data: Dict[str, Any], db: Session = Depends(get_db)):
    """更新通知"""
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="通知不存在")
    
    for key, value in notification_data.items():
        if hasattr(notification, key):
            setattr(notification, key, value)
    
    db.commit()
    db.refresh(notification)
    return notification

@app.post("/notifications/{user_id}/{notification_id}/read")
def mark_notification_read(user_id: str, notification_id: str, db: Session = Depends(get_db)):
    """標記通知為已讀"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="通知不存在")
    
    notification.read = True
    db.commit()
    return {"success": True, "message": "通知已標記為已讀"}

@app.delete("/notifications/{notification_id}")
def delete_notification(notification_id: str, db: Session = Depends(get_db)):
    """刪除通知"""
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="通知不存在")
    
    db.delete(notification)
    db.commit()
    return {"message": "通知已刪除"}

@app.post("/send-notification")
def send_notification(data: NotificationRequest, db: Session = Depends(get_db)):
    """發送通知給用戶"""
    notification_id = f"notif_{datetime.now().timestamp()}"
    
    notification = Notification(
        id=notification_id,
        user_id=data.user_id,
        type=data.type,
        title=data.title,
        body=data.body,
        order_id=data.order_id,
        ts=int(datetime.now().timestamp() * 1000)
    )
    
    db.add(notification)
    db.commit()
    
    print(f"推送通知已發送給用戶 {data.user_id}: {data.title} - {data.body}")
    return {"success": True, "notification_id": notification_id}

@app.post("/register-device-token")
def register_device_token(data: DeviceTokenRequest, db: Session = Depends(get_db)):
    """註冊設備推送令牌"""
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用戶不存在")
    
    user.device_token = data.device_token
    db.commit()
    return {"success": True, "message": "設備令牌已註冊"}

# ==================== 評價 API ====================

@app.post("/reviews")
def create_review(review_data: Dict[str, Any], db: Session = Depends(get_db)):
    """創建評價"""
    import sys
    sys.stdout.write(f"\n[評價] 收到評價請求: {review_data}\n")
    sys.stdout.flush()
    
    try:
        raw_review_dict = dict(review_data)

        # 支援 camelCase 與 snake_case 欄位
        key_mapping = {
            'targetUserId': 'target_user_id',
            'reviewerId': 'reviewer_id',
            'reviewerName': 'reviewer_name',
            'orderId': 'order_id',
            'orderName': 'order_name',
            'orderLocation': 'order_location',
            'orderContact': 'order_contact',
            'isFromPurchaser': 'is_from_purchaser',
            'timestampMs': 'timestamp',
            'commentId': 'comment_id',
            'targetUserName': 'target_user_name'
        }

        normalized_dict = {}
        for key, value in raw_review_dict.items():
            normalized_key = key_mapping.get(key, key)
            normalized_dict[normalized_key] = value

        # 只保留 reviews 資料表可接受的欄位
        review_allowed_fields = {
            'id',
            'target_user_id',
            'reviewer_id',
            'reviewer_name',
            'rating',
            'comment',
            'order_id',
            'order_name',
            'order_location',
            'order_contact',
            'is_from_purchaser',
            'timestamp'
        }
        review_dict = {key: normalized_dict[key] for key in review_allowed_fields if key in normalized_dict}

        # 獲取 comment_id，處理各種可能的格式（camelCase, snake_case, 空值等）
        comment_id = normalized_dict.get('comment_id') or normalized_dict.get('commentId') or review_dict.get('comment_id')
        # 清理 comment_id：去除空白、處理 None、空字串等
        if comment_id:
            if isinstance(comment_id, str):
                comment_id = comment_id.strip()
                if not comment_id or comment_id.lower() in ('null', 'none', 'undefined', ''):
                    comment_id = None
            elif comment_id is None:
                comment_id = None
        else:
            comment_id = None
        
        target_user_id = review_dict.get('target_user_id')
        reviewer_id = review_dict.get('reviewer_id')
        order_id = review_dict.get('order_id')
        
        if not review_dict.get('id'):
            review_dict['id'] = f"review_{int(datetime.now().timestamp() * 1000)}"
            sys.stdout.write(f"[評價] 未提供評價ID，自動生成: {review_dict['id']}\n")
            sys.stdout.flush()
        
        if not review_dict.get('timestamp'):
            review_dict['timestamp'] = int(datetime.now().timestamp() * 1000)
            sys.stdout.write(f"[評價] 未提供 timestamp，自動補上: {review_dict['timestamp']}\n")
            sys.stdout.flush()

        # 轉換欄位型別
        if 'rating' in review_dict and review_dict['rating'] is not None:
            try:
                review_dict['rating'] = int(review_dict['rating'])
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="評分格式錯誤，請提供整數 1-5")
        if 'timestamp' in review_dict and review_dict['timestamp'] is not None:
            try:
                review_dict['timestamp'] = int(review_dict['timestamp'])
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="timestamp 格式錯誤")
        # 轉換 is_from_purchaser 為布林值
        if 'is_from_purchaser' in review_dict:
            raw_value = review_dict['is_from_purchaser']
            if isinstance(raw_value, str):
                review_dict['is_from_purchaser'] = raw_value.lower() in ('true', '1', 'yes')
            elif isinstance(raw_value, (int, float)):
                review_dict['is_from_purchaser'] = bool(raw_value)
            else:
                review_dict['is_from_purchaser'] = bool(raw_value)
        
        # 驗證用戶是否存在
        def _normalize_user_id(raw_value: Any) -> Optional[str]:
            if raw_value is None:
                return None
            if isinstance(raw_value, str):
                value = raw_value.strip()
            else:
                value = str(raw_value).strip()
            if not value:
                return None
            lowered = value.lower()
            if lowered in {'me', 'self', 'unknown', 'none', 'null'}:
                return None
            # 避免誤用留言ID或暫存ID作為用戶ID
            if value.startswith('comment_') or value.startswith('temp_'):
                return None
            return value

        comment_to_update = None
        if comment_id:
            comment_to_update = db.query(Comment).filter(Comment.id == comment_id).first()
            if not comment_to_update:
                sys.stdout.write(f"[評價] ⚠️ 找不到對應的留言 comment_id={comment_id}\n")
                sys.stdout.flush()
                # 列出所有該訂單的留言 ID 以便調試
                all_comments = db.query(Comment).filter(Comment.order_id == order_id).all()
                comment_ids = [c.id for c in all_comments]
                sys.stdout.write(f"[評價] 📋 該訂單的所有留言 ID: {comment_ids}\n")
                sys.stdout.flush()
            else:
                sys.stdout.write(f"[評價] 🔗 找到留言記錄: comment_id={comment_id}, commenter_id={getattr(comment_to_update, 'commenter_id', None)}\n")
                sys.stdout.flush()

        # 先取得訂單資訊，以便推斷合理的 reviewer / target
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            # 某些舊資料的訂單已被刪除，這種情況不再當作後端錯誤，只記錄簡短警告並略過
            sys.stdout.write(f"[評價] ⚠️ 訂單不存在或已刪除，略過本次評價 order_id={order_id}\n")
            sys.stdout.flush()
            return {"success": False}

        commenter_user_id = _normalize_user_id(getattr(comment_to_update, 'commenter_id', None)) if comment_to_update else None
        normalized_target_user_id = _normalize_user_id(review_dict.get('target_user_id'))
        normalized_reviewer_id = _normalize_user_id(review_dict.get('reviewer_id'))
        # 確保 is_from_purchaser_flag 是布林值
        is_from_purchaser_flag = bool(review_dict.get('is_from_purchaser', False))
        
        sys.stdout.write(f"[評價] 📋 評價參數:\n")
        sys.stdout.write(f"  - is_from_purchaser: {is_from_purchaser_flag}\n")
        sys.stdout.write(f"  - comment_id: {comment_id}\n")
        sys.stdout.write(f"  - order.created_by: {order.created_by}\n")
        sys.stdout.write(f"  - commenter_id (從留言獲取): {commenter_user_id}\n")
        sys.stdout.write(f"  - 前端傳遞的 target_user_id: {review_dict.get('target_user_id')}\n")
        sys.stdout.write(f"  - 前端傳遞的 reviewer_id: {review_dict.get('reviewer_id')}\n")
        sys.stdout.flush()

        # 代購者評價留言者：確保被評價者為留言者，評價者為訂單發起者
        if is_from_purchaser_flag:
            # 必須提供有效的 comment_id，以便從 comments.commenter_id 獲取留言者的真實 user_id
            if not comment_id:
                # 嘗試從其他來源獲取 comment_id（例如從 target_user_id 推斷，但這不是最佳實踐）
                # 如果仍然沒有，記錄詳細錯誤但不立即拋出異常，先嘗試其他方法
                sys.stdout.write(f"[評價] ⚠️ 缺少 comment_id，嘗試其他方法識別被評價者\n")
                sys.stdout.write(f"[評價] 收到的資料: comment_id={comment_id}, target_user_id={target_user_id}, reviewer_id={reviewer_id}\n")
                sys.stdout.flush()
                
                # 如果沒有 comment_id，但有 target_user_id，嘗試從訂單的留言中查找匹配的留言者
                # 注意：這只是備用方案，最佳實踐是前端總是傳遞有效的 comment_id
                if target_user_id and order_id:
                    try:
                        # 查找該訂單中 commenter_id 等於 target_user_id 的留言
                        # 優先查找已接單的留言（accepted = True），如果沒有則查找任何匹配的留言
                        matching_comment = db.query(Comment).filter(
                            Comment.order_id == order_id,
                            Comment.commenter_id == target_user_id,
                            Comment.accepted == True  # 優先查找已接單的留言
                        ).first()
                        
                        # 如果沒有已接單的留言，查找任何匹配的留言
                        if not matching_comment:
                            matching_comment = db.query(Comment).filter(
                                Comment.order_id == order_id,
                                Comment.commenter_id == target_user_id
                            ).first()
                        
                        if matching_comment:
                            comment_id = matching_comment.id
                            comment_to_update = matching_comment
                            commenter_user_id = _normalize_user_id(matching_comment.commenter_id)
                            sys.stdout.write(f"[評價] ✅ 從訂單留言中自動找到匹配的 comment_id: {comment_id} (commenter_id: {commenter_user_id})\n")
                            sys.stdout.flush()
                        else:
                            sys.stdout.write(f"[評價] ⚠️ 無法從訂單留言中找到匹配的留言記錄 (order_id: {order_id}, target_user_id: {target_user_id})\n")
                            # 列出該訂單的所有留言以便調試
                            all_order_comments = db.query(Comment).filter(Comment.order_id == order_id).all()
                            if all_order_comments:
                                comment_list = [f"id={c.id}, commenter_id={c.commenter_id}, accepted={c.accepted}" for c in all_order_comments]
                                sys.stdout.write(f"[評價] 📋 該訂單的所有留言: {comment_list}\n")
                            sys.stdout.flush()
                    except Exception as lookup_error:
                        sys.stdout.write(f"[評價] ⚠️ 查找匹配留言時發生錯誤: {str(lookup_error)}\n")
                        import traceback
                        sys.stdout.write(f"[評價] 錯誤堆疊:\n{traceback.format_exc()}\n")
                        sys.stdout.flush()
                
                # 如果仍然沒有 comment_id，才拋出錯誤
                if not comment_id:
                    sys.stdout.write(f"[評價] ❌ 缺少 comment_id，無法識別被評價者（留言者）\n")
                    sys.stdout.write(f"[評價] 建議：發起者評價留言者時必須提供有效的 comment_id\n")
                    sys.stdout.flush()
                    raise HTTPException(
                        status_code=400, 
                        detail="無法判定被評價者（留言者），請提供有效的 comment_id。發起者評價留言者時必須提供留言 ID。"
                    )
            
            # 必須能找到對應的留言記錄
            if not comment_to_update:
                sys.stdout.write(f"[評價] ❌ 找不到對應的留言記錄，comment_id={comment_id}\n")
                sys.stdout.flush()
                raise HTTPException(
                    status_code=400, 
                    detail=f"找不到對應的留言記錄（comment_id={comment_id}）。請確認留言 ID 是否正確。"
                )
            
            # 強制將 reviewer_id 設置為訂單發起者（代購者），覆蓋前端可能傳遞的錯誤值
            # 這是關鍵：reviewer_id 必須等於 orders.created_by
            review_dict['reviewer_id'] = order.created_by
            normalized_reviewer_id = _normalize_user_id(order.created_by)
            sys.stdout.write(f"[評價] 👤 強制將評價者設定為訂單發起者（代購者）: {order.created_by}\n")
            sys.stdout.flush()
            
            # 強制從 comment_id 獲取留言者的真實 user_id 作為 target_user_id
            # 這是關鍵：target_user_id 必須等於 comments.commenter_id
            if commenter_user_id:
                # 再次正規化 commenter_user_id
                normalized_commenter_user_id = _normalize_user_id(commenter_user_id)
                
                # 驗證：確保 commenter_id 不等於 order.created_by（不能評價自己）
                if normalized_commenter_user_id == normalized_reviewer_id:
                    sys.stdout.write(
                        f"[評價] ❌ 錯誤：留言者 ID ({normalized_commenter_user_id}) "
                        f"等於訂單發起者 ID ({normalized_reviewer_id})，不能評價自己\n"
                    )
                    sys.stdout.flush()
                    raise HTTPException(
                        status_code=400,
                        detail=f"不能評價自己。留言者 ID（{normalized_commenter_user_id}）與訂單發起者 ID（{normalized_reviewer_id}）相同。"
                    )
                
                review_dict['target_user_id'] = normalized_commenter_user_id
                normalized_target_user_id = normalized_commenter_user_id
                sys.stdout.write(f"[評價] 🎯 從 comments.commenter_id 獲取被評價者（留言者）: {normalized_commenter_user_id}\n")
                sys.stdout.flush()
            else:
                # 如果無法從 comment_id 獲取留言者ID，報錯
                sys.stdout.write(f"[評價] ❌ 無法從留言記錄獲取 commenter_id，comment_id={comment_id}\n")
                sys.stdout.flush()
                raise HTTPException(
                    status_code=400, 
                    detail=f"無法從留言記錄獲取留言者 ID（comment_id={comment_id}）。留言記錄可能缺少 commenter_id 欄位。"
                )
            
            # 最終驗證：確保 target_user_id 不等於 reviewer_id（不能評價自己）
            if normalized_target_user_id == normalized_reviewer_id:
                sys.stdout.write(
                    f"[評價] ❌ 錯誤：target_user_id ({normalized_target_user_id}) "
                    f"等於 reviewer_id ({normalized_reviewer_id})，不能評價自己\n"
                )
                sys.stdout.flush()
                raise HTTPException(
                    status_code=400,
                    detail=f"不能評價自己。被評價者ID和評價者ID不能相同（均為 {normalized_target_user_id}）"
                )
        else:
            # 留言者評價代購者：確保被評價者為訂單發起者
            if not normalized_target_user_id or normalized_target_user_id != order.created_by:
                review_dict['target_user_id'] = order.created_by
                normalized_target_user_id = order.created_by
                sys.stdout.write(f"[評價] 🎯 自動將被評價者設定為代購者: {order.created_by}\n")
                sys.stdout.flush()
            if not normalized_reviewer_id and commenter_user_id:
                review_dict['reviewer_id'] = commenter_user_id
                normalized_reviewer_id = commenter_user_id
                sys.stdout.write(f"[評價] 👤 自動將評價者設定為留言者: {commenter_user_id}\n")
                sys.stdout.flush()

        # 再次正規化
        normalized_target_user_id = _normalize_user_id(review_dict.get('target_user_id'))
        normalized_reviewer_id = _normalize_user_id(review_dict.get('reviewer_id'))

        if not normalized_target_user_id:
            sys.stdout.write(f"[評價] ❌ 無效的被評價者ID: {review_dict.get('target_user_id')}\n")
            sys.stdout.flush()
            raise HTTPException(status_code=400, detail="無法判定被評價者，用戶ID缺失或格式錯誤")

        if not normalized_reviewer_id:
            sys.stdout.write(f"[評價] ❌ 無效的評價者ID: {review_dict.get('reviewer_id')}\n")
            sys.stdout.flush()
            raise HTTPException(status_code=400, detail="無法判定評價者，用戶ID缺失或格式錯誤")

        # 最終驗證：確保 target_user_id 不等於 reviewer_id（不能評價自己）
        if normalized_target_user_id == normalized_reviewer_id:
            sys.stdout.write(
                f"[評價] ❌ 錯誤：target_user_id ({normalized_target_user_id}) "
                f"等於 reviewer_id ({normalized_reviewer_id})，不能評價自己\n"
            )
            sys.stdout.flush()
            raise HTTPException(
                status_code=400,
                detail=f"不能評價自己。被評價者ID和評價者ID不能相同（均為 {normalized_target_user_id}）"
            )

        review_dict['target_user_id'] = normalized_target_user_id
        review_dict['reviewer_id'] = normalized_reviewer_id

        target_user = db.query(User).filter(User.id == normalized_target_user_id).first()
        reviewer = db.query(User).filter(User.id == normalized_reviewer_id).first()
        
        sys.stdout.write(
            "[評價] 查詢結果: "
            f"target_user={target_user is not None}, "
            f"reviewer={reviewer is not None}, "
            f"order={order is not None}\n"
        )
        sys.stdout.flush()
        
        if not target_user:
            sys.stdout.write(f"[評價] ❌ 被評價者不存在: {normalized_target_user_id}\n")
            sys.stdout.flush()
            raise HTTPException(status_code=400, detail=f"被評價者不存在: {normalized_target_user_id}")
        if not reviewer:
            sys.stdout.write(f"[評價] ❌ 評價者不存在: {normalized_reviewer_id}\n")
            sys.stdout.flush()
            raise HTTPException(status_code=400, detail=f"評價者不存在: {normalized_reviewer_id}")

        existing_review = db.query(Review).filter(Review.id == review_dict['id']).first()
        if existing_review:
            sys.stdout.write(f"[評價] ℹ️ 評價已存在，更新現有記錄: {review_dict['id']}\n")
            sys.stdout.flush()
            for key, value in review_dict.items():
                setattr(existing_review, key, value)
            db_review = existing_review
        else:
            db_review = Review(**review_dict)
            db.add(db_review)
        
        if comment_to_update:
            comment_to_update.rating = review_dict.get('rating')
            comment_to_update.rating_comment = review_dict.get('comment')
            comment_to_update.completed = True
            comment_to_update.delivery_status = 'completed'
            if review_dict.get('timestamp'):
                comment_to_update.completed_time = review_dict['timestamp']
        
        db.commit()
        db.refresh(db_review)
        if comment_to_update:
            db.refresh(comment_to_update)
            sys.stdout.write(f"[評價] ✅ 留言已同步更新: comment_id={comment_id}, rating={comment_to_update.rating}\n")
            sys.stdout.flush()
        
        # 自動創建通知給被評價者（target_user_id）
        try:
            # 重新查詢被評價者（確保用戶存在）
            target_user_for_notification = db.query(User).filter(User.id == normalized_target_user_id).first()
            if target_user_for_notification:
                # 準備通知資料
                notification_id = f"notif_{int(datetime.now().timestamp() * 1000)}"
                notification_data = {
                    'id': notification_id,
                    'user_id': normalized_target_user_id,  # 接收者：被評價者
                    'type': 'newRating',
                    'title': '收到新評價',
                    'body': f'{db_review.reviewer_name} 為您的代購「{db_review.order_name or "訂單"}」給出了 {db_review.rating} 星評價',
                    'order_id': order_id,
                    'order_name': db_review.order_name,
                    'commenter_id': normalized_reviewer_id,  # 評價者ID
                    'read': False,
                    'ts': int(datetime.now().timestamp() * 1000),
                }
                
                # 檢查通知是否已存在（避免重複）
                existing_notification = db.query(Notification).filter(
                    Notification.user_id == normalized_target_user_id,
                    Notification.order_id == order_id,
                    Notification.type == 'newRating',
                    Notification.commenter_id == normalized_reviewer_id
                ).first()
                
                if not existing_notification:
                    db_notification = Notification(**notification_data)
                    db.add(db_notification)
                    db.commit()
                    db.refresh(db_notification)
                    sys.stdout.write(f"[評價] ✅ 已自動創建通知到 notifications 表: {db_notification.id}\n")
                    sys.stdout.flush()
                else:
                    sys.stdout.write(f"[評價] ℹ️ 通知已存在，跳過創建: {existing_notification.id}\n")
                    sys.stdout.flush()
            else:
                sys.stdout.write(f"[評價] ⚠️ 被評價者不存在，跳過創建通知: {normalized_target_user_id}\n")
                sys.stdout.flush()
        except Exception as notif_error:
            # 通知創建失敗不影響評價創建
            sys.stdout.write(f"[評價] ⚠️ 創建通知失敗（不影響評價）: {str(notif_error)}\n")
            sys.stdout.flush()
            db.rollback()  # 回滾通知相關的變更，但不影響評價
        
        sys.stdout.write(f"[評價] ✅ 評價已創建: {db_review.id}\n")
        sys.stdout.flush()
        return db_review
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        error_detail = str(e)
        sys.stdout.write(f"[評價] ❌ 創建評價失敗: {error_detail}\n")
        sys.stdout.flush()
        if "foreign key" in error_detail.lower():
            raise HTTPException(status_code=400, detail=f"外鍵約束失敗: {error_detail}")
        else:
            raise HTTPException(status_code=500, detail=f"創建評價失敗: {error_detail}")

@app.get("/reviews/{review_id}")
def get_review(review_id: str, db: Session = Depends(get_db)):
    """獲取評價"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="評價不存在")
    return review

@app.get("/reviews/user/{user_id}")
def get_reviews_by_user(user_id: str, db: Session = Depends(get_db)):
    """獲取用戶收到的評價"""
    reviews = db.query(Review).filter(Review.target_user_id == user_id).all()
    return reviews

@app.get("/reviews/given/{user_id}")
def get_reviews_given_by_user(user_id: str, db: Session = Depends(get_db)):
    """獲取用戶給出的評價"""
    reviews = db.query(Review).filter(Review.reviewer_id == user_id).all()
    return reviews

# ==================== 信譽積分 API ====================

@app.post("/user-tiers")
def create_user_tier(tier_data: UserTierCreate, db: Session = Depends(get_db)):
    """創建用戶信譽等級"""
    if db is None:
        raise HTTPException(status_code=503, detail="資料庫連接不可用")
    
    data_dict = tier_data.model_dump() if hasattr(tier_data, "model_dump") else tier_data.dict()
    user_id = data_dict.get('user_id')

    if not user_id or user_id == 'me' or user_id == 'guest':
        raise HTTPException(status_code=400, detail="無效的 user_id")

    # 驗證用戶是否存在（檢查外鍵約束）
    try:
        user_exists = db.query(User).filter(User.id == user_id).first()
        if not user_exists:
            logger.warning("用戶不存在，無法創建信譽等級 user_id=%s", user_id)
            raise HTTPException(status_code=404, detail=f"用戶不存在: {user_id}")
    except HTTPException:
        raise
    except Exception as user_check_error:
        logger.warning("檢查用戶存在性失敗（繼續創建） user_id=%s error=%s", user_id, user_check_error)

    if data_dict.get('last_updated') is None:
        data_dict['last_updated'] = int(datetime.now().timestamp() * 1000)

    # 確保 tier 值在允許的範圍內
    valid_tiers = ['掰咖', '買咖', '團咖', '咖王', '咖皇']
    tier_value = data_dict.get('tier', '買咖')
    if tier_value not in valid_tiers:
        logger.warning("無效的 tier 值，使用預設值 user_id=%s tier=%s", user_id, tier_value)
        data_dict['tier'] = '買咖'

    existing = db.query(UserTier).filter(UserTier.user_id == user_id).first()
    if existing:
        logger.info("用戶信譽等級已存在，返回既有資料 user_id=%s", user_id)
        return existing

    try:
        db_tier = UserTier(**data_dict)
        db.add(db_tier)
        db.commit()
        db.refresh(db_tier)
        logger.info("成功建立用戶信譽等級 user_id=%s score=%s tier=%s", user_id, data_dict.get('score'), data_dict.get('tier'))
        return db_tier
    except Exception as create_error:
        db.rollback()
        error_detail = str(create_error)
        logger.error("建立用戶信譽等級失敗 user_id=%s error=%s", user_id, error_detail)
        
        # 如果記錄已存在（可能是並發創建），嘗試獲取現有記錄
        if "Duplicate entry" in error_detail or "UNIQUE constraint" in error_detail or "already exists" in error_detail.lower():
            try:
                existing = db.query(UserTier).filter(UserTier.user_id == user_id).first()
                if existing:
                    logger.info("檢測到並發創建，返回既有資料 user_id=%s", user_id)
                    return existing
            except Exception:
                pass
        
        # 檢查是否為外鍵約束錯誤
        if "foreign key" in error_detail.lower() or "FOREIGN KEY constraint" in error_detail:
            raise HTTPException(status_code=404, detail=f"用戶不存在: {user_id}")
        
        raise HTTPException(status_code=500, detail=f"創建用戶信譽等級失敗: {error_detail}")


@app.get("/user-tiers/{user_id}")
def get_user_tier(user_id: str, db: Session = Depends(get_db)):
    """獲取用戶信譽等級"""
    user_tier = db.query(UserTier).filter(UserTier.user_id == user_id).first()
    if not user_tier:
        raise HTTPException(status_code=404, detail="用戶信譽等級不存在")
    return user_tier

@app.put("/user-tiers/{user_id}")
def update_user_tier(user_id: str, tier_data: Dict[str, Any], db: Session = Depends(get_db)):
    """更新用戶信譽等級"""
    user_tier = db.query(UserTier).filter(UserTier.user_id == user_id).first()
    data_dict = dict(tier_data) if isinstance(tier_data, dict) else tier_data

    if not user_tier:
        create_payload = {
            'user_id': user_id,
            'score': data_dict.get('score', 100),
            'tier': data_dict.get('tier', '買咖'),
            'last_updated': data_dict.get('last_updated') or int(datetime.now().timestamp() * 1000)
        }
        db_tier = UserTier(**create_payload)
        db.add(db_tier)
        db.commit()
        db.refresh(db_tier)
        return db_tier
    
    for key, value in data_dict.items():
        if hasattr(user_tier, key):
            setattr(user_tier, key, value)
    
    db.commit()
    db.refresh(user_tier)
    return user_tier


@app.get("/user-tiers/summary")
def get_user_tier_summary(db: Session = Depends(get_db)):
    """取得各等級的用戶數量"""
    summary_rows = (
        db.query(UserTier.tier, func.count(UserTier.user_id))
        .group_by(UserTier.tier)
        .all()
    )
    default_summary = {tier: 0 for tier in ['掰咖', '買咖', '團咖', '咖王', '咖皇']}
    for tier, count in summary_rows:
        if tier in default_summary:
            default_summary[tier] = count
        else:
            default_summary[tier] = count
    return default_summary


@app.post("/score-history")
def create_score_history(entry: ScoreHistoryCreate, db: Session = Depends(get_db)):
    """新增積分異動紀錄"""
    data_dict = entry.model_dump() if hasattr(entry, "model_dump") else entry.dict()
    if not data_dict.get("user_id"):
        raise HTTPException(status_code=400, detail="缺少 user_id")
    if not data_dict.get("action"):
        raise HTTPException(status_code=400, detail="缺少 action")
    if data_dict.get("score_change") is None:
        raise HTTPException(status_code=400, detail="缺少 score_change")
    if data_dict.get("new_score") is None:
        raise HTTPException(status_code=400, detail="缺少 new_score")

    if not data_dict.get("id"):
        data_dict["id"] = f"score_{int(datetime.now().timestamp() * 1000)}"
    if not data_dict.get("timestamp"):
        data_dict["timestamp"] = int(datetime.now().timestamp() * 1000)
    if not data_dict.get("type"):
        data_dict["type"] = "positive" if data_dict["score_change"] >= 0 else "negative"

    try:
        db_entry = ScoreHistory(**data_dict)
        db.add(db_entry)
        db.commit()
        db.refresh(db_entry)
        return db_entry
    except Exception as error:
        db.rollback()
        logger.error("新增積分紀錄失敗 user_id=%s error=%s", data_dict.get("user_id"), error)
        raise HTTPException(status_code=500, detail=f"新增積分記錄失敗: {error}")


@app.get("/score-history")
def list_score_history(
    user_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    order: str = Query("desc", regex="^(asc|desc)$"),
    db: Session = Depends(get_db)
):
    """取得積分異動紀錄"""
    query = db.query(ScoreHistory)
    if user_id:
        query = query.filter(ScoreHistory.user_id == user_id)
    order_clause = ScoreHistory.timestamp.desc() if order.lower() == "desc" else ScoreHistory.timestamp.asc()
    query = query.order_by(order_clause)
    if limit:
        query = query.limit(limit)
    return query.all()


@app.get("/score-history/user/{user_id}")
def get_score_history(user_id: str, db: Session = Depends(get_db)):
    """獲取用戶積分歷史"""
    history = (
        db.query(ScoreHistory)
        .filter(ScoreHistory.user_id == user_id)
        .order_by(ScoreHistory.timestamp.desc())
        .all()
    )
    return history


@app.post("/tier-history")
def create_tier_history(entry: TierHistoryCreate, db: Session = Depends(get_db)):
    """新增等級變動紀錄"""
    data_dict = entry.model_dump() if hasattr(entry, "model_dump") else entry.dict()
    if not data_dict.get("user_id"):
        raise HTTPException(status_code=400, detail="缺少 user_id")
    if not data_dict.get("old_tier"):
        raise HTTPException(status_code=400, detail="缺少 old_tier")
    if not data_dict.get("new_tier"):
        raise HTTPException(status_code=400, detail="缺少 new_tier")

    if not data_dict.get("id"):
        data_dict["id"] = f"tier_{int(datetime.now().timestamp() * 1000)}"
    if not data_dict.get("timestamp"):
        data_dict["timestamp"] = int(datetime.now().timestamp() * 1000)
    if not data_dict.get("type"):
        data_dict["type"] = "upgrade"

    try:
        db_entry = TierHistory(**data_dict)
        db.add(db_entry)
        db.commit()
        db.refresh(db_entry)
        return db_entry
    except Exception as error:
        db.rollback()
        logger.error("新增等級紀錄失敗 user_id=%s error=%s", data_dict.get("user_id"), error)
        raise HTTPException(status_code=500, detail=f"新增等級記錄失敗: {error}")


@app.get("/tier-history")
def list_tier_history(
    user_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    order: str = Query("desc", regex="^(asc|desc)$"),
    db: Session = Depends(get_db)
):
    """取得等級變動紀錄"""
    query = db.query(TierHistory)
    if user_id:
        query = query.filter(TierHistory.user_id == user_id)
    order_clause = TierHistory.timestamp.desc() if order.lower() == "desc" else TierHistory.timestamp.asc()
    query = query.order_by(order_clause)
    if limit:
        query = query.limit(limit)
    return query.all()


@app.get("/tier-history/user/{user_id}")
def get_tier_history_by_user(user_id: str, db: Session = Depends(get_db)):
    """取得指定用戶的等級變動紀錄"""
    history = (
        db.query(TierHistory)
        .filter(TierHistory.user_id == user_id)
        .order_by(TierHistory.timestamp.desc())
        .all()
    )
    return history

# ==================== 訂單參與者 API ====================

@app.post("/order-joiners")
def create_order_joiner(joiner_data: Dict[str, Any], db: Session = Depends(get_db)):
    """創建訂單參與者"""
    db_joiner = OrderJoiner(**joiner_data)
    db.add(db_joiner)
    db.commit()
    db.refresh(db_joiner)
    return db_joiner

@app.get("/order-joiners/order/{order_id}")
def get_order_joiners(order_id: str, db: Session = Depends(get_db)):
    """獲取訂單的參與者"""
    joiners = db.query(OrderJoiner).filter(OrderJoiner.order_id == order_id).all()
    return joiners

# ==================== 點讚 API ====================

@app.post("/likes/toggle")
def toggle_like(data: ToggleLikeRequest, db: Session = Depends(get_db)):
    """切換點讚狀態"""
    order_id = data.order_id
    user_id = data.user_id
    import random
    import string
    
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
            # 從未點讚變為點讚
            order.like_count = (order.like_count or 0) + 1
        else:
            # 從點讚變為未點讚
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

@app.get("/likes/user/{user_id}/order/{order_id}")
def get_user_like_status(user_id: str, order_id: str, db: Session = Depends(get_db)):
    """獲取用戶對訂單的點讚狀態"""
    like_record = db.query(UserLike).filter(
        UserLike.user_id == user_id,
        UserLike.order_id == order_id
    ).first()
    
    if not like_record:
        return {
            "liked": False,
            "like_count": 0
        }
    
    # 獲取訂單的總點讚數
    order = db.query(Order).filter(Order.id == order_id).first()
    like_count = order.like_count if order else 0
    
    return {
        "liked": like_record.liked,
        "like_count": like_count
    }

@app.get("/likes/order/{order_id}/count")
def get_order_like_count(order_id: str, db: Session = Depends(get_db)):
    """獲取訂單的點讚數量"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="訂單不存在")
    
    return {
        "order_id": order_id,
        "like_count": order.like_count or 0
    }

@app.get("/likes/user/{user_id}")
def get_user_likes(user_id: str, db: Session = Depends(get_db)):
    """獲取用戶的所有點讚訂單"""
    likes = db.query(UserLike).filter(
        UserLike.user_id == user_id,
        UserLike.liked == True
    ).all()
    
    return likes

# ==================== 健康檢查 ====================

@app.get("/")
def root():
    """API 根端點"""
    return {
        "message": "BUYCART API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
def health_check():
    """健康檢查"""
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, access_log=False)

