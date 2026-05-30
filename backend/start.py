#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
啟動 BUYCART API 服務器
"""
import sys
import os

# 確保在正確的目錄
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# 添加當前目錄到路徑
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 60)
print("BUYCART API 服務器")
print("=" * 60)
print()

if __name__ == "__main__":
    try:
        import uvicorn
        print("✅ uvicorn 已安裝")
        
        print("正在啟動 API 服務器...")
        print("API 文檔: http://localhost:8001/docs")
        print("API 根目錄: http://localhost:8001")
        print()
        print("按 Ctrl+C 停止服務器")
        print("=" * 60)
        print()
        
        # 啟動服務器（不使用 reload，避免多進程問題）
        uvicorn.run(
            "app.api:app",
            host="0.0.0.0",
            port=8001,
            reload=False,
            log_level="info",
            access_log=False  # 關閉每次請求的存取日誌輸出
        )
    except ModuleNotFoundError as e:
        print(f"❌ 缺少模組: {e}")
        print("請先安裝依賴: pip install -r requirements.txt")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 啟動失敗: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

