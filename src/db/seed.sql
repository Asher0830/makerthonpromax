-- ============================================
-- 測試種子資料
-- ============================================

-- 測試消費者（密碼: test1234，bcrypt hash）
INSERT OR IGNORE INTO users (email, password, role, name, points) VALUES
('consumer@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'consumer', '測試消費者', 50);

-- 測試店家帳號
INSERT OR IGNORE INTO users (email, password, role, name, points) VALUES
('store@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '阿美便當老闆', 0);

-- 高雄店家帳號
INSERT OR IGNORE INTO users (email, password, role, name, points) VALUES
('kaohsiung-bento@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '港灣便當老闆', 0),
('kaohsiung-bakery@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '左營麵包坊老闆', 0),
('kaohsiung-veg@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '苓雅食堂老闆', 0),
('kaohsiung-mix@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '三民食堂老闆', 0);

-- 測試店家
INSERT OR IGNORE INTO stores (user_id, name, description, address, latitude, longitude, phone) VALUES
(2, '阿美便當', '每日新鮮現做便當，用料實在', '台北市大安區忠孝東路四段100號', 25.0418, 121.5437, '02-27001234'),
(2, '幸福麵包坊', '手工麵包，每日新鮮出爐', '台北市大安區復興南路一段200號', 25.0380, 121.5440, '02-27005678');

-- 高雄店家
INSERT OR IGNORE INTO stores (user_id, name, description, address, latitude, longitude, phone) VALUES
(3, '港灣惜食便當', '靠近高雄港的熱騰騰便當與惜食餐盒', '高雄市鹽埕區大勇路11號', 22.6208, 120.2820, '07-5211111'),
(4, '左營晨光麵包坊', '左營在地現烤麵包與早餐點心', '高雄市左營區博愛二路100號', 22.6855, 120.3028, '07-5222222'),
(5, '苓雅綠野食堂', '主打高雄在地蔬食與輕食餐盒', '高雄市苓雅區三多四路21號', 22.6137, 120.3012, '07-5333333'),
(6, '三民好食日常', '三民區日常補給，便當與麵包都有', '高雄市三民區九如一路50號', 22.6478, 120.3120, '07-5444444');

-- 測試機台
INSERT OR IGNORE INTO machines (id, name, location_desc, latitude, longitude, total_compartments, status, secret_key) VALUES
('MAC_01A2B3', '高雄1站', '捷運左營站 2 號出口旁', 22.6855, 120.3028, 12, 'IDLE', 'dev_secret_key_001');

-- 艙位（12 個）
INSERT OR IGNORE INTO compartments (machine_id, index_num, status) VALUES
('MAC_01A2B3', 1, 'EMPTY'),
('MAC_01A2B3', 2, 'EMPTY'),
('MAC_01A2B3', 3, 'EMPTY'),
('MAC_01A2B3', 4, 'EMPTY'),
('MAC_01A2B3', 5, 'EMPTY'),
('MAC_01A2B3', 6, 'EMPTY'),
('MAC_01A2B3', 7, 'EMPTY'),
('MAC_01A2B3', 8, 'EMPTY'),
('MAC_01A2B3', 9, 'EMPTY'),
('MAC_01A2B3', 10, 'EMPTY'),
('MAC_01A2B3', 11, 'EMPTY'),
('MAC_01A2B3', 12, 'EMPTY');

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

-- 高雄地圖商品（source = 'map'）
INSERT OR IGNORE INTO products (store_id, name, category, original_price, selling_price, description, source, status, expires_at) VALUES
(3, '港灣雞腿便當', 'bento', 105, 65, '高雄港邊限定雞腿便當', 'map', 'AVAILABLE', datetime('now', '+4 hours')),
(4, '左營豆漿吐司', 'bread', 45, 28, '每日現烤豆漿吐司', 'map', 'AVAILABLE', datetime('now', '+6 hours')),
(5, '苓雅蔬食拼盤', 'vegetable', 70, 42, '高雄在地新鮮蔬菜拼盤', 'map', 'AVAILABLE', datetime('now', '+4 hours')),
(6, '三民紅豆菠蘿', 'bread', 38, 22, '熱騰騰紅豆菠蘿麵包', 'map', 'AVAILABLE', datetime('now', '+5 hours'));

-- 新增更多機台商品（將 12 艙位完全補滿）
INSERT OR IGNORE INTO products (store_id, name, category, original_price, selling_price, description, source, status, expires_at) VALUES
(1, '經典照燒雞腿便當', 'bento', 120, 60, '超大照燒雞腿+精選配菜', 'machine', 'AVAILABLE', datetime('now', '+3 hours')),
(1, '香烤鯖魚便當', 'bento', 130, 65, '薄鹽鯖魚現烤+養生紫米飯', 'machine', 'AVAILABLE', datetime('now', '+3 hours')),
(2, '法式明太子長棍', 'bread', 80, 40, '明太子醬均勻抹面，烤至酥脆', 'machine', 'AVAILABLE', datetime('now', '+5 hours')),
(2, '黃金菠蘿麵包', 'bread', 45, 20, '傳統黃金菠蘿皮，香甜鬆軟', 'machine', 'AVAILABLE', datetime('now', '+5 hours')),
(2, '香蒜巧巴達', 'bread', 50, 25, '濃厚蒜香與Q彈巧巴達麵包', 'machine', 'AVAILABLE', datetime('now', '+5 hours')),
(1, '小農有機高麗菜', 'vegetable', 65, 35, '高山現採有機高麗菜，清甜可口', 'machine', 'AVAILABLE', datetime('now', '+2 hours')),
(1, '新鮮溫室番茄包', 'vegetable', 70, 40, '溫室番茄整袋裝，多汁營養', 'machine', 'AVAILABLE', datetime('now', '+2 hours')),
(1, '主廚經典沙拉盒', 'vegetable', 80, 45, '新鮮綜合生菜+堅果+特調油醋醬', 'machine', 'AVAILABLE', datetime('now', '+2 hours'));

-- 過敏原標籤
INSERT OR IGNORE INTO product_allergens (product_id, allergen) VALUES
(1, 'chicken'), (1, 'egg'), (1, 'soy'),
(2, 'pork'), (2, 'wheat'), (2, 'soy'),
(3, 'wheat'), (3, 'egg'), (3, 'milk'),
(4, 'wheat'), (4, 'milk'),
(5, 'pork'), (5, 'egg'), (5, 'soy'),
(6, 'seafood'), (6, 'egg'),
(7, 'wheat'), (7, 'milk'),
(8, 'sesame'),
(9, 'chicken'), (9, 'egg'),
(10, 'wheat'), (10, 'milk'),
(11, 'soy'),
(12, 'wheat'), (12, 'egg'),
-- 商品 13~20 的過敏原標籤
(13, 'chicken'), (13, 'soy'),
(14, 'seafood'), (14, 'soy'),
(15, 'wheat'), (15, 'milk'),
(16, 'wheat'), (16, 'egg'), (16, 'milk'),
(17, 'wheat'), (17, 'sesame'),
(18, 'soy'),
(19, 'sesame'),
(20, 'milk'), (20, 'peanut'), (20, 'treenut');

-- 把 12 個機台商品放入艙位（全面補滿補貨！）
UPDATE compartments SET status = 'STOCKED', product_id = 5, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 1;
UPDATE compartments SET status = 'STOCKED', product_id = 6, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 2;
UPDATE compartments SET status = 'STOCKED', product_id = 13, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 3;
UPDATE compartments SET status = 'STOCKED', product_id = 7, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 4;
UPDATE compartments SET status = 'STOCKED', product_id = 8, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 5;
UPDATE compartments SET status = 'STOCKED', product_id = 14, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 6;
UPDATE compartments SET status = 'STOCKED', product_id = 15, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 7;
UPDATE compartments SET status = 'STOCKED', product_id = 16, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 8;
UPDATE compartments SET status = 'STOCKED', product_id = 17, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 9;
UPDATE compartments SET status = 'STOCKED', product_id = 18, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 10;
UPDATE compartments SET status = 'STOCKED', product_id = 19, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 11;
UPDATE compartments SET status = 'STOCKED', product_id = 20, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 12;

