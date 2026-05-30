#!/bin/bash

# BUYCART 資料庫安裝腳本
# 此腳本會自動安裝並配置 MySQL 資料庫

echo "======================================"
echo "BUYCART 資料庫安裝程序"
echo "======================================"
echo ""

# 檢查 MySQL 是否已安裝
if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL 未安裝"
    echo "請先安裝 MySQL 或 MariaDB"
    echo ""
    echo "Ubuntu/Debian:"
    echo "  sudo apt-get update"
    echo "  sudo apt-get install mysql-server"
    echo ""
    echo "macOS:"
    echo "  brew install mysql"
    echo ""
    echo "Windows:"
    echo "  請從 https://dev.mysql.com/downloads/mysql/ 下載安裝"
    exit 1
fi

echo "✅ MySQL 已安裝"
echo ""

# 提示輸入 MySQL root 密碼
read -sp "請輸入 MySQL root 密碼: " mysql_password
echo ""

# 提示輸入資料庫名稱（默認 buycart）
read -p "請輸入資料庫名稱 (默認: buycart): " db_name
db_name=${db_name:-buycart}

# 提示輸入資料庫用戶名
read -p "請輸入資料庫用戶名 (默認: buycart_user): " db_user
db_user=${db_user:-buycart_user}

# 提示輸入資料庫密碼
read -sp "請輸入資料庫密碼: " db_password
echo ""

echo ""
echo "開始創建資料庫..."

# 創建 SQL 腳本
SQL_FILE="temp_setup.sql"
cat > $SQL_FILE << EOF
-- 創建資料庫
CREATE DATABASE IF NOT EXISTS ${db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 創建用戶
CREATE USER IF NOT EXISTS '${db_user}'@'localhost' IDENTIFIED BY '${db_password}';

-- 授予權限
GRANT ALL PRIVILEGES ON ${db_name}.* TO '${db_user}'@'localhost';
FLUSH PRIVILEGES;

-- 使用資料庫
USE ${db_name};
EOF

# 執行 SQL 腳本
mysql -u root -p${mysql_password} < $SQL_FILE

if [ $? -eq 0 ]; then
    echo "✅ 資料庫和用戶創建成功"
    rm $SQL_FILE
else
    echo "❌ 資料庫創建失敗"
    rm $SQL_FILE
    exit 1
fi

# 執行 schema 文件
echo ""
echo "開始導入資料表結構..."
mysql -u root -p${mysql_password} ${db_name} < buycart_schema.sql

if [ $? -eq 0 ]; then
    echo "✅ 資料表創建成功"
else
    echo "❌ 資料表創建失敗"
    exit 1
fi

# 創建 .env 文件
echo ""
echo "創建環境變數配置文件..."
ENV_FILE="../../.env"
cat > $ENV_FILE << EOF
# BUYCART 資料庫配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=${db_user}
DB_PASSWORD=${db_password}
DB_NAME=${db_name}
EOF

echo "✅ 環境變數文件已創建: ${ENV_FILE}"
echo ""
echo "======================================"
echo "安裝完成！"
echo "======================================"
echo ""
echo "資料庫配置資訊："
echo "  資料庫名稱: ${db_name}"
echo "  用戶名: ${db_user}"
echo "  主機: localhost"
echo "  端口: 3306"
echo ""
echo "環境變數文件: ${ENV_FILE}"
echo ""
echo "下一步："
echo "1. 檢查 .env 文件中的配置"
echo "2. 運行後端服務測試連接"
echo ""

