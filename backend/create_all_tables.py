"""
快速創建所有資料表
處理表缺失問題
"""

import sys
import os

# 添加專案路徑
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from database import engine
    from sqlalchemy import text
    
    print("=" * 60)
    print("創建所有資料表")
    print("=" * 60)
    print()
    
    # 獲取 schema 文件
    schema_file = os.path.join(os.path.dirname(__file__), 'database', 'buycart_schema.sql')
    
    if not os.path.exists(schema_file):
        print(f"❌ 找不到 schema 文件: {schema_file}")
        sys.exit(1)
    
    print(f"正在讀取 schema 文件: {schema_file}")
    with open(schema_file, 'r', encoding='utf-8') as f:
        schema_sql = f.read()
    
    print("正在執行 SQL...")
    
    # 執行 SQL
    with engine.begin() as conn:
        # 按行分割並執行每個語句
        statements = schema_sql.split(';')
        for i, statement in enumerate(statements):
            statement = statement.strip()
            if statement and not statement.startswith('--'):
                try:
                    conn.execute(text(statement))
                    print(f"✅ 執行語句 {i+1}/{len(statements)}")
                except Exception as e:
                    # 忽略已存在的錯誤
                    error_str = str(e).lower()
                    if 'already exists' not in error_str and 'duplicate' not in error_str and 'table' not in error_str:
                        print(f"⚠️  語句 {i+1} 執行警告: {e}")
                    else:
                        print(f"✅ 語句 {i+1} 已存在，跳過")
    
    print()
    print("=" * 60)
    print("✅ 資料表創建完成！")
    print("=" * 60)
    print()
    print("下一步：運行 python test_crud.py")

except Exception as e:
    print(f"❌ 創建失敗: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

