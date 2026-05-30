CREATE DATABASE IF NOT EXISTS buycart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE buycart;

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password VARCHAR(255),
    photo VARCHAR(500),
    google_id VARCHAR(255) UNIQUE,
    login_method ENUM('email', 'google', 'google_demo') DEFAULT 'email',
    is_demo BOOLEAN DEFAULT FALSE,
    device_token VARCHAR(500),
    rating DECIMAL(3,2) DEFAULT 0.00,
    review_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_google_id (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(20),
    line VARCHAR(100),
    method VARCHAR(100),
    note TEXT,
    joined INT DEFAULT 0,
    status ENUM('preparing', 'delivering', 'completed', 'cancelled', 'expired') DEFAULT 'preparing',
    color VARCHAR(20) DEFAULT 'green',
    comments INT DEFAULT 0,
    liked BOOLEAN DEFAULT FALSE,
    like_count INT DEFAULT 0,
    created_by VARCHAR(50) NOT NULL,
    created_at BIGINT NOT NULL,
    expires_at BIGINT,
    completed_at BIGINT,
    cancelled_at BIGINT,
    cancellation_reason TEXT,
    INDEX idx_created_by (created_by),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comments (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    commenter_id VARCHAR(50) NOT NULL,
    commenter_name VARCHAR(100) NOT NULL,
    commenter_phone VARCHAR(20),
    commenter_line VARCHAR(100),
    text TEXT NOT NULL,
    is_order_request BOOLEAN DEFAULT TRUE,
    is_reply BOOLEAN DEFAULT FALSE,
    parent_id VARCHAR(50),
    delivery_status ENUM('pending', 'accepted', 'delivering', 'completed', 'rejected') DEFAULT 'pending',
    accepted BOOLEAN DEFAULT FALSE,
    accepted_at BIGINT,
    completed BOOLEAN DEFAULT FALSE,
    completed_time BIGINT,
    rating INT,
    rating_comment TEXT,
    status ENUM('active', 'ignored', 'deleted') DEFAULT 'active',
    ignored_reason TEXT,
    ignored_by VARCHAR(50),
    ignored_at BIGINT,
    show_new_badge BOOLEAN DEFAULT TRUE,
    new_badge_expire_time BIGINT,
    timestamp BIGINT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order_id (order_id),
    INDEX idx_commenter_id (commenter_id),
    INDEX idx_parent_id (parent_id),
    INDEX idx_delivery_status (delivery_status),
    INDEX idx_status (status),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (commenter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE SET NULL,
    FOREIGN KEY (ignored_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comment_replies (
    id VARCHAR(50) PRIMARY KEY,
    comment_id VARCHAR(50) NOT NULL,
    user VARCHAR(100) NOT NULL,
    text TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    show_new_badge BOOLEAN DEFAULT TRUE,
    new_badge_expire_time BIGINT,
    INDEX idx_comment_id (comment_id),
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_joiners (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    line VARCHAR(100),
    join_time BIGINT NOT NULL,
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    comment_id VARCHAR(50),
    accepted_at BIGINT,
    INDEX idx_order_id (order_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    order_id VARCHAR(50),
    commenter_id VARCHAR(50),
    order_name VARCHAR(200),
    `read` BOOLEAN DEFAULT FALSE,
    ts BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_read (`read`),
    INDEX idx_ts (ts),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (commenter_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_tiers (
    user_id VARCHAR(50) PRIMARY KEY,
    score INT DEFAULT 100,
    tier ENUM('掰咖', '買咖', '團咖', '咖王', '咖皇') DEFAULT '買咖',
    last_updated BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
    id VARCHAR(50) PRIMARY KEY,
    target_user_id VARCHAR(50) NOT NULL,
    reviewer_id VARCHAR(50) NOT NULL,
    reviewer_name VARCHAR(100) NOT NULL,
    rating INT NOT NULL,
    comment TEXT,
    order_id VARCHAR(50) NOT NULL,
    order_name VARCHAR(200),
    order_location TEXT,
    order_contact VARCHAR(100),
    is_from_purchaser BOOLEAN DEFAULT FALSE,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_target_user_id (target_user_id),
    INDEX idx_reviewer_id (reviewer_id),
    INDEX idx_order_id (order_id),
    INDEX idx_rating (rating),
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS score_history (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    order_id VARCHAR(50),
    action VARCHAR(200) NOT NULL,
    score_change INT NOT NULL,
    new_score INT NOT NULL,
    type ENUM('positive', 'negative') NOT NULL,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_order_id (order_id),
    INDEX idx_timestamp (timestamp),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tier_history (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    old_tier VARCHAR(20) NOT NULL,
    new_tier VARCHAR(20) NOT NULL,
    type VARCHAR(20) DEFAULT 'upgrade',
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_timestamp (timestamp),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_likes (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    order_id VARCHAR(50) NOT NULL,
    liked BOOLEAN DEFAULT TRUE,
    timestamp BIGINT NOT NULL,
    UNIQUE KEY unique_user_order (user_id, order_id),
    INDEX idx_user_id (user_id),
    INDEX idx_order_id (order_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_history (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order_id (order_id),
    INDEX idx_user_id (user_id),
    INDEX idx_timestamp (timestamp),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verification_codes (
    id VARCHAR(50) PRIMARY KEY,
    account VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at BIGINT NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_account (account),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO users (id, name, email, phone, password, rating, review_count) VALUES
('me', '當前用戶', 'me@buycart.com', '0912345678', '123456', 0.00, 0),
('user001', '張三', 'zhang@example.com', '0911111111', '123456', 4.50, 10),
('user002', '李四', 'li@example.com', '0922222222', '123456', 4.80, 25),
('user003', '王五', 'wang@example.com', '0933333333', '123456', 4.20, 8);

INSERT INTO user_tiers (user_id, score, tier, last_updated) VALUES
('me', 100, '買咖', UNIX_TIMESTAMP()),
('user001', 150, '買咖', UNIX_TIMESTAMP()),
('user002', 250, '團咖', UNIX_TIMESTAMP()),
('user003', 120, '買咖', UNIX_TIMESTAMP());

