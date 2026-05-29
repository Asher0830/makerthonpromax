-- ============================================
-- 惜食整合系統 Database Schema
-- SQLite (local) / Cloudflare D1
-- ============================================

-- 使用者帳號
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL CHECK(role IN ('consumer', 'store_owner', 'admin')),
    name        TEXT NOT NULL,
    points      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 店家資料
CREATE TABLE IF NOT EXISTS stores (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    name        TEXT NOT NULL,
    description TEXT,
    address     TEXT NOT NULL,
    latitude    REAL NOT NULL,
    longitude   REAL NOT NULL,
    phone       TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 機台
CREATE TABLE IF NOT EXISTS machines (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    location_desc       TEXT,
    latitude            REAL,
    longitude           REAL,
    total_compartments  INTEGER NOT NULL DEFAULT 6,
    status              TEXT NOT NULL DEFAULT 'IDLE'
                        CHECK(status IN ('IDLE', 'WAITING_FOR_PAYMENT', 'WAITING_FOR_TRIGGER', 'DISPENSING', 'ERROR', 'MAINTENANCE')),
    active_order_id     INTEGER,
    secret_key          TEXT NOT NULL,
    last_telemetry      TEXT,
    last_seen_at        TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 機台艙位
CREATE TABLE IF NOT EXISTS compartments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id  TEXT NOT NULL REFERENCES machines(id),
    index_num   INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'EMPTY'
                CHECK(status IN ('EMPTY', 'STOCKED', 'RESERVED', 'DISPENSED')),
    product_id  INTEGER,
    stocked_at  TEXT,
    stocked_by  INTEGER,
    UNIQUE(machine_id, index_num)
);

-- 商品
CREATE TABLE IF NOT EXISTS products (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id        INTEGER NOT NULL REFERENCES stores(id),
    name            TEXT NOT NULL,
    category        TEXT NOT NULL CHECK(category IN ('bento', 'bread', 'vegetable', 'other')),
    original_price  REAL NOT NULL,
    selling_price   REAL NOT NULL,
    description     TEXT,
    source          TEXT NOT NULL CHECK(source IN ('map', 'machine')),
    status          TEXT NOT NULL DEFAULT 'AVAILABLE'
                    CHECK(status IN ('AVAILABLE', 'RESERVED', 'SOLD', 'EXPIRED')),
    expires_at      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 商品過敏原標籤
CREATE TABLE IF NOT EXISTS product_allergens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id),
    allergen    TEXT NOT NULL,
    UNIQUE(product_id, allergen)
);

-- 訂單
CREATE TABLE IF NOT EXISTS orders (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER REFERENCES users(id),
    order_type          TEXT NOT NULL CHECK(order_type IN ('map_purchase', 'machine_gacha', 'machine_purchase')),

    -- 路徑一（地圖導購）
    store_id            INTEGER,
    product_id          INTEGER,

    -- 路徑二（機台扭蛋）
    machine_id          TEXT,
    compartment_id      INTEGER,
    excluded_allergens  TEXT,
    pool_size           INTEGER,
    pool_avg_price      REAL,

    -- 共用
    amount              REAL NOT NULL,
    status              TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK(status IN (
                            'PENDING',
                            'PAID',
                            'WAITING_FOR_TRIGGER',
                            'DISPENSING',
                            'COMPLETED',
                            'TIMEOUT_REFUNDED',
                            'CANCELLED'
                        )),
    pickup_code         TEXT,
    points_earned       INTEGER NOT NULL DEFAULT 0,
    version             INTEGER NOT NULL DEFAULT 1,
    paid_at             TEXT,
    completed_at        TEXT,
    timeout_at          TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 平板配對 Session
CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    token       TEXT NOT NULL UNIQUE,
    machine_id  TEXT NOT NULL REFERENCES machines(id),
    store_id    INTEGER,
    status      TEXT NOT NULL DEFAULT 'PENDING'
                CHECK(status IN ('PENDING', 'PAIRED', 'EXPIRED')),
    expires_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- 索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_source ON products(source);
CREATE INDEX IF NOT EXISTS idx_compartments_machine ON compartments(machine_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_machine ON orders(machine_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- 機台指令佇列表 (用於 HTTP Polling)
CREATE TABLE IF NOT EXISTS pending_commands (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id  TEXT NOT NULL,
    action      TEXT NOT NULL DEFAULT 'OPEN',
    door_index  INTEGER NOT NULL,
    request_id  TEXT,
    queued_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- 虛擬寵物養成系統
-- ============================================

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

-- 玩家已擁有裝飾品
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
