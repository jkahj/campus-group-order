"""
初始化 BUYCART 資料庫
創建所有數據表
"""

import sys
import os

# 添加專案路徑
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from database import init_database, test_connection, engine, Base
    
    print("=" * 60)
    print("BUYCART 資料庫初始化")
    print("=" * 60)
    print()
    
    # 測試連接
    print("1. 測試資料庫連接...")
    if not test_connection():
        print("❌ 資料庫連接失敗，請檢查配置")
        sys.exit(1)
    
    print("✅ 資料庫連接成功")
    print()
    
    # 初始化資料庫
    print("2. 創建所有資料表...")
    if init_database():
        print("✅ 資料表創建成功")
    else:
        print("❌ 資料表創建失敗")
    
    print()
    print("=" * 60)
    print("✅ 資料庫初始化完成！")
    print("=" * 60)
    print()
    print("下一步：啟動 API 服務器")
    print("執行: python backend/app/main.py")

except Exception as e:
    print(f"❌ 初始化失敗: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

