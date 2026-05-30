"""
BUYCART 資料庫連接配置
提供資料庫連接和會話管理功能
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool
import pymysql

# 資料庫配置
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'buycart'),
    'charset': 'utf8mb4'
}

# 構建資料庫連接字串
DATABASE_URL = f"mysql+pymysql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}?charset={DB_CONFIG['charset']}"

# 創建資料庫引擎
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # 自動重連
    echo=False  # 設置為 True 可以看到 SQL 語句
)

# 創建會話工廠
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 創建 Base 類別（用於定義模型）
Base = declarative_base()


def get_db():
    """
    獲取資料庫會話
    使用範例：
        db = get_db()
        try:
            # 使用 db 進行操作
            pass
        finally:
            db.close()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_connection():
    """
    測試資料庫連接
    """
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            print("資料庫連接成功！")
            return True
    except Exception as e:
        print(f"資料庫連接失敗：{e}")
        return False


def init_database():
    """
    初始化資料庫（創建所有表）
    """
    try:
        Base.metadata.create_all(bind=engine)
        print("資料庫表創建成功！")
        return True
    except Exception as e:
        print(f"資料庫表創建失敗：{e}")
        return False


if __name__ == "__main__":
    # 測試連接
    print("測試資料庫連接...")
    test_connection()
    
    # 可以添加其他測試代碼
    # print("\n初始化資料庫表...")
    # init_database()

