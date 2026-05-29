-- ============================================
-- 測試種子資料
-- ============================================

-- 測試消費者（密碼: test1234，bcrypt hash）
INSERT OR IGNORE INTO users (email, password, role, name, points) VALUES
('consumer@test.com', '$2a$10$8KzQ5x5K5K5K5K5K5K5K5OK5K5K5K5K5K5K5K5K5K5K5K5K5K5K', 'consumer', '測試消費者', 50);

-- 測試店家帳號
INSERT OR IGNORE INTO users (email, password, role, name, points) VALUES
('store@test.com', '$2a$10$8KzQ5x5K5K5K5K5K5K5K5OK5K5K5K5K5K5K5K5K5K5K5K5K5K5K', 'store_owner', '阿美便當老闆', 0);

-- 測試店家
INSERT OR IGNORE INTO stores (user_id, name, description, address, latitude, longitude, phone) VALUES
(2, '阿美便當', '每日新鮮現做便當，用料實在', '台北市大安區忠孝東路四段100號', 25.0418, 121.5437, '02-27001234'),
(2, '幸福麵包坊', '手工麵包，每日新鮮出爐', '台北市大安區復興南路一段200號', 25.0380, 121.5440, '02-27005678');

-- 測試機台
INSERT OR IGNORE INTO machines (id, name, location_desc, latitude, longitude, total_compartments, status, secret_key) VALUES
('MAC_01A2B3', '大安站 1 號機', '捷運大安站 2 號出口旁', 25.0330, 121.5435, 6, 'IDLE', 'dev_secret_key_001');

-- 艙位（6 個）
INSERT OR IGNORE INTO compartments (machine_id, index_num, status) VALUES
('MAC_01A2B3', 1, 'EMPTY'),
('MAC_01A2B3', 2, 'EMPTY'),
('MAC_01A2B3', 3, 'EMPTY'),
('MAC_01A2B3', 4, 'EMPTY'),
('MAC_01A2B3', 5, 'EMPTY'),
('MAC_01A2B3', 6, 'EMPTY');

-- 地圖導購商品（source = 'map'）
INSERT OR IGNORE INTO products (store_id, name, category, original_price, selling_price, description, source, status, expires_at) VALUES
(1, '雞腿便當', 'bento', 100, 60, '主菜雞腿+三配菜+白飯', 'map', 'AVAILABLE', datetime('now', '+4 hours')),
(1, '排骨便當', 'bento', 90, 55, '炸排骨+三配菜+白飯', 'map', 'AVAILABLE', datetime('now', '+4 hours')),
(2, '菠蘿麵包', 'bread', 35, 20, '經典菠蘿麵包，外酥內軟', 'map', 'AVAILABLE', datetime('now', '+6 hours')),
(2, '紅豆吐司', 'bread', 45, 25, '手工紅豆餡吐司', 'map', 'AVAILABLE', datetime('now', '+6 hours'));

-- 機台商品（source = 'machine'）
INSERT OR IGNORE INTO products (store_id, name, category, original_price, selling_price, description, source, status, expires_at) VALUES
(1, '滷肉飯便當', 'bento', 80, 50, '滷肉飯+燙青菜+滷蛋', 'machine', 'AVAILABLE', datetime('now', '+3 hours')),
(1, '鮪魚飯糰', 'bento', 40, 25, '鮪魚美乃滋飯糰', 'machine', 'AVAILABLE', datetime('now', '+3 hours')),
(2, '可頌麵包', 'bread', 50, 30, '法式奶油可頌', 'machine', 'AVAILABLE', datetime('now', '+5 hours')),
(1, '有機蔬菜包', 'vegetable', 60, 35, '當日有機蔬菜組合', 'machine', 'AVAILABLE', datetime('now', '+2 hours'));

-- 過敏原標籤
INSERT OR IGNORE INTO product_allergens (product_id, allergen) VALUES
(1, 'chicken'), (1, 'egg'), (1, 'soy'),
(2, 'pork'), (2, 'wheat'), (2, 'soy'),
(3, 'wheat'), (3, 'egg'), (3, 'milk'),
(4, 'wheat'), (4, 'milk'),
(5, 'pork'), (5, 'egg'), (5, 'soy'),
(6, 'seafood'), (6, 'egg'),
(7, 'wheat'), (7, 'milk'),
(8, 'sesame');

-- 把機台商品放入艙位
UPDATE compartments SET status = 'STOCKED', product_id = 5, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 1;
UPDATE compartments SET status = 'STOCKED', product_id = 6, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 2;
UPDATE compartments SET status = 'STOCKED', product_id = 7, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 4;
UPDATE compartments SET status = 'STOCKED', product_id = 8, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 5;
