@echo off
REM BUYCART 資料庫安裝腳本 (Windows)
REM 此腳本會自動安裝並配置 MySQL 資料庫

echo ======================================
echo BUYCART 資料庫安裝程序
echo ======================================
echo.

REM 檢查 MySQL 是否已安裝
where mysql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [錯誤] MySQL 未安裝
    echo 請先安裝 MySQL 或 MariaDB
    echo.
    echo 請從 https://dev.mysql.com/downloads/mysql/ 下載安裝
    pause
    exit / partially removed
)

echo [成功] MySQL 已安裝
echo.

REM 提示輸入 MySQL root 密碼
set /p mysql_password="請輸入 MySQL root 密碼: "

REM 提示輸入資料庫名稱（默認 buycart）
set /p db_name="請輸入資料庫名稱 (默認: buycart): "
if "%db_name%"=="" set db_name=buycart

REM 提示輸入資料庫用戶名
set /p db_user="請輸入資料庫用戶名 (默認: buycart_user): "
if "%db_user%"=="" set db_user=buycart_user

REM 提示輸入資料庫密碼
set /p db_password="請輸入資料庫密碼: "

echo.
echo 開始創建資料庫...

REM 創建 SQL 腳本
echo -- 創建資料庫 > temp_setup.sql
echo CREATE DATABASE IF NOT EXISTS %db_name% CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; >> temp_setup.sql
echo. >> temp_setup.sql
echo -- 創建用戶 >> temp_setup.sql
echo CREATE USER IF NOT EXISTS '%db_user%'@'localhost' IDENTIFIED BY '%db_password%'; >> temp_setup.sql
echo. >> temp_setup.sql
echo -- 授予權限 >> temp_setup.sql
echo GRANT ALL PRIVILEGES ON %db_name%.* TO '%db_user%'@'localhost'; >> temp_setup.sql
echo FLUSH PRIVILEGES; >> temp_setup.sql
echo. >> temp_setup.sql
echo -- 使用資料庫 >> temp_setup.sql
echo USE %db_name%; >> temp_setup.sql

REM 執行 SQL 腳本
mysql -u root -p%mysql_password% < temp_setup.sql

if %ERRORLEVEL% EQU 0 (
    echo [成功] 資料庫和用戶創建成功
    del temp_setup.sql
) else (
    echo [錯誤] 資料庫創建失敗
    del temp_setup.sql
    pause
    exit / partially removed
)

REM 執行 schema 文件
echo.
echo 開始導入資料表結構...
mysql -u root -p%mysql_password% %db_name% < buycart_schema.sql

if %ERRORLEVEL% EQU 0 (
    echo [成功] 資料表創建成功
) else (
    echo [錯誤] 資料表創建失敗
    pause
    exit / partially removed
)

REM 創建 .env 文件
echo.
echo 創建環境變數配置文件...
cd ..
cd ..
echo # BUYCART 資料庫配置 > .env
echo DB_HOST=localhost >> .env
echo DB_PORT=3306 >> .env
echo DB_USER=%db_user% >> .env
echo DB_PASSWORD=%db_password% >> .env
echo DB_NAME=%db_name% >> .env

echo [成功] 環境變數文件已創建: .env
echo.
echo ======================================
echo 安裝完成！
echo ======================================
echo.
echo 資料庫配置資訊：
echo   資料庫名稱: %db_name%
echo   用戶名: %db_user%
echo   主機: localhost
echo   端口: 3306
echo.
echo 環境變數文件: .env
echo.
echo 下一步：
echo 1. 檢查 .env 文件中的配置
echo 2. 運行後端服務測試連接
echo.
pause

