@echo off
chcp 65001 >nul
REM BUYCART 資料庫 XAMPP 安裝腳本
REM 專門針對 XAMPP 環境設計

echo ======================================
echo BUYCART 資料庫 XAMPP 安裝程序
echo ======================================
echo.

REM 檢查 XAMPP MySQL 是否存在
if not exist "C:\xampp\mysql\bin\mysql.exe" (
    echo [錯誤] 找不到 XAMPP MySQL
    echo 請確認 XAMPP 已安裝在 C:\xampp\
    echo.
    pause
    exit /b 1
)

echo [成功] 找到 XAMPP MySQL
echo.

REM 檢查 MySQL 服務是否運行
echo 檢查 MySQL 服務狀態...
tasklist /FI "IMAGENAME eq mysqld.exe" 2>NUL | find /I /N "mysqld.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [成功] MySQL 服務正在運行
) else (
    echo [警告] MySQL 服務未運行
    echo 請先啟動 XAMPP MySQL 服務
    echo.
    echo 是否現在啟動 MySQL？
    choice /C YN /M "按 Y 啟動，按 N 退出"
    if errorlevel 2 exit /b 1
    if errorlevel 1 (
        start "" "C:\xampp\xampp-control.exe"
        echo 請在 XAMPP Control Panel 中啟動 MySQL 服務，然後重新運行此腳本
        pause
        exit /b 1
    )
)

echo.
echo 請選擇安裝方式：
echo [1] 使用預設 root 帳號（無密碼）安裝
echo [2] 使用自訂密碼安裝
echo.
choice /C 12 /M "請選擇"

if errorlevel 2 goto custom_password
if errorlevel 1 goto default_install

:default_install
set mysql_user=root
set mysql_password=
goto continue_install

:custom_password
set /p mysql_user="請輸入 MySQL 用戶名（預設: root）: "
if "%mysql_user%"=="" set mysql_user=root
set /p mysql_password="請輸入 MySQL 密碼: "
goto continue_install

:continue_install
echo.
echo 資料庫配置資訊：
echo   用戶名: %mysql_user%
echo   密碼: %mysql_password%
echo   資料庫名: buycart
echo.

REM 獲取當前腳本目錄
set "script_dir=%~dp0"
set "schema_file=%script_dir%buycart_schema.sql"

REM 顯示路徑資訊（用於除錯）
echo 腳本目錄: %script_dir%
echo Schema 文件: %schema_file%
echo.

echo 正在創建資料庫和資料表...
echo.

REM 執行安裝
cd C:\xampp\mysql\bin

REM 創建資料庫
echo 步驟 1/2: 創建資料庫...
if "%mysql_password%"=="" (
    mysql -u %mysql_user% -e "CREATE DATABASE IF NOT EXISTS buycart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
) else (
    mysql -u %mysql_user% -p%mysql_password% -e "CREATE DATABASE IF NOT EXISTS buycart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
)

if %ERRORLEVEL% NEQ 0 (
    echo [錯誤] 資料庫創建失敗
    echo 請檢查 MySQL 用戶名和密碼是否正確
    pause
    exit /b 1
)

echo [成功] 資料庫創建成功
echo.

REM 導入資料表結構
echo 步驟 2/2: 導入資料表結構...
if "%mysql_password%"=="" (
    mysql -u %mysql_user% buycart < "%schema_file%"
) else (
    mysql -u %mysql_user% -p%mysql_password% buycart < "%schema_file%"
)

if %ERRORLEVEL% NEQ 0 (
    echo [錯誤] 資料表創建失敗
    echo 請檢查 schema 文件路徑是否正確
    echo 文件路徑: %schema_file%
    pause
    exit /b 1
)

echo [成功] 資料表創建成功
echo.

REM 驗證安裝
echo 驗證安裝...
if "%mysql_password%"=="" (
    mysql -u %mysql_user% buycart -e "SHOW TABLES;" > temp_tables.txt
) else (
    mysql -u %mysql_user% -p%mysql_password% buycart -e "SHOW TABLES;" > temp_tables.txt
)

set table_count=0
for /f %%i in (temp_tables.txt) do set /a table_count+=1
del temp_tables.txt

echo [成功] 共創建 %table_count% 個資料表
echo.

REM 創建 .env 文件
echo 創建環境變數配置文件...
cd /d "%script_dir%.."
cd /d ".."

if not exist ".env" (
    (
        echo # BUYCART 資料庫配置 (XAMPP)
        echo DB_HOST=localhost
        echo DB_PORT=3306
        echo DB_USER=%mysql_user%
        echo DB_PASSWORD=%mysql_password%
        echo DB_NAME=buycart
    ) > .env
    echo [成功] 環境變數文件已創建: .env
) else (
    echo [提示] .env 文件已存在，未覆蓋
)

echo.
echo ======================================
echo 安裝完成！
echo ======================================
echo.
echo 資料庫配置資訊：
echo   主機: localhost
echo   端口: 3306
echo   用戶名: %mysql_user%
echo   密碼: %mysql_password%
echo   資料庫名: buycart
echo.
echo 您可以使用以下工具管理資料庫：
echo   1. phpMyAdmin: http://localhost/phpmyadmin
echo   2. MySQL Workbench: 下載並安裝 MySQL Workbench
echo.
echo 下一步：
echo   1. 檢查 .env 文件中的配置
echo   2. 測試資料庫連接: python test_db.py
echo   3. 啟動後端服務
echo.
pause

