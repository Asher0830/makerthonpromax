-- ============================================
-- 惜食整合系統 — 虛擬寵物養成系統 資料庫 Schema
-- ============================================

-- 使用者表 (模擬主系統已有的表)
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT NOT NULL UNIQUE,
    points          INTEGER NOT NULL DEFAULT 100,     -- 惜食點數，初始贈送 100 點
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 寵物表
CREATE TABLE IF NOT EXISTS pets (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id),  -- 一人一寵物
    species         TEXT NOT NULL DEFAULT 'rice_bunny'
                    CHECK(species IN ('rice_bunny', 'bread_bear', 'veggie_dragon', 'dog', 'cat')),
    name            TEXT NOT NULL DEFAULT '小糰子',
    level           INTEGER NOT NULL DEFAULT 1,
    exp             INTEGER NOT NULL DEFAULT 0,
    fullness        INTEGER NOT NULL DEFAULT 100,     -- 0~100
    happiness       INTEGER NOT NULL DEFAULT 100,     -- 0~100
    evolution_stage INTEGER NOT NULL DEFAULT 1,       -- 1=幼年, 2=成年, 3=最終
    last_decay_at   TEXT NOT NULL DEFAULT (datetime('now')),  -- 上次衰減計算時間
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 裝飾品定義 (商店道具靜態表)
CREATE TABLE IF NOT EXISTS pet_shop_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL CHECK(category IN ('hat', 'background', 'accessory', 'effect')),
    cost        INTEGER NOT NULL,            -- 點數價格
    sprite_key  TEXT NOT NULL,               -- 精靈圖 key
    min_level   INTEGER NOT NULL DEFAULT 1,  -- 最低等級限制
    description TEXT
);

-- 玩家已擁有的裝飾品
CREATE TABLE IF NOT EXISTS pet_owned_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    item_id     INTEGER NOT NULL REFERENCES pet_shop_items(id),
    is_equipped INTEGER NOT NULL DEFAULT 0,  -- 是否裝備中 (0=否, 1=是)
    purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, item_id)                 -- 同一件不重複購買
);

-- 互動日誌 (冷卻檢查 + 分析)
CREATE TABLE IF NOT EXISTS pet_action_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    action      TEXT NOT NULL CHECK(action IN ('feed', 'feed_premium', 'play', 'bath', 'pet')),
    points_spent INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 索引建立
CREATE INDEX IF NOT EXISTS idx_pets_user ON pets(user_id);
CREATE INDEX IF NOT EXISTS idx_pet_items_user ON pet_owned_items(user_id);
CREATE INDEX IF NOT EXISTS idx_pet_logs_user ON pet_action_logs(user_id, action);
