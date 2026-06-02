#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
啟動 BUYCART API 服務器
本地開發：python start.py            (預設 port 8001)
雲端部署：自動讀取 $PORT 環境變數      (Render / Railway 等)
"""
import os
import sys

# 確保在正確的目錄，並把專案目錄加入 import 路徑
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)
sys.path.insert(0, BASE_DIR)

# Windows 主控台預設可能不是 UTF-8，重新設定 stdout/stderr 以避免中文/符號編碼錯誤
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8")
    except Exception:
        pass

if __name__ == "__main__":
    try:
        import uvicorn
    except ModuleNotFoundError as e:
        print(f"[ERROR] 缺少模組: {e}")
        print("請先安裝依賴: pip install -r requirements.txt")
        sys.exit(1)

    port = int(os.getenv("PORT", "8001"))
    print("=" * 60)
    print(f"BUYCART API 服務器啟動中  (port {port})")
    print(f"API 文檔: http://localhost:{port}/docs")
    print("按 Ctrl+C 停止服務器")
    print("=" * 60)

    try:
        uvicorn.run(
            "app.api:app",
            host="0.0.0.0",
            port=port,
            reload=False,
            log_level="info",
            access_log=False,
        )
    except Exception as e:
        print(f"[ERROR] 啟動失敗: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
