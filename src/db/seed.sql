-- ============================================
-- 測試種子資料
-- ============================================

-- 測試消費者（密碼: test1234，bcrypt hash）
INSERT OR IGNORE INTO users (email, password, role, name, points) VALUES
('consumer@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'consumer', '測試消費者', 50);

-- 測試店家帳號
INSERT OR IGNORE INTO users (email, password, role, name, points) VALUES
('store@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '阿美便當老闆', 0);

-- 高雄與額外測試店家帳號
INSERT OR IGNORE INTO users (email, password, role, name, points) VALUES
('kaohsiung-bento@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '港灣便當老闆', 0),
('kaohsiung-bakery@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '左營麵包坊老闆', 0),
('kaohsiung-veg@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '苓雅食堂老闆', 0),
('kaohsiung-mix@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '三民食堂老闆', 0),
('kaohsiung-tea@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '鼓山茶飲老闆', 0),
('kaohsiung-veg2@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '左營慢活老闆', 0),
('kaohsiung-pizza@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '楠梓披薩老闆', 0),
('kaohsiung-baker2@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '博愛烘焙老闆', 0),
('taipei-luwei@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '忠孝老牌滷味老闆', 0),
('taipei-dessert@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '信義極緻甜點老闆', 0),
('taipei-salad@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '大安活力沙拉老闆', 0),
('kaohsiung-sushi@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '博愛精緻壽司老闆', 0),
('kaohsiung-light@test.com', '$2b$10$QiqCY26bosloW8kbfQbdzOFM3AlQksdxZJw.JDDcT/3OjDDPPI.iq', 'store_owner', '自由綠意輕食老闆', 0);

-- 測試店家 [L5 NOTE] user_id=2 同一店主擁有兩間店（僅為測試用，正式環境應禁止）
INSERT OR IGNORE INTO stores (user_id, name, description, address, latitude, longitude, phone) VALUES
(2, '綠色惜食便當店 [A店]', '每日新鮮現做便當，用料實在 [系統演示]', '台北市大安區演示路一段100號', 25.0418, 121.5437, '02-00000001'),
(2, '環保概念烘焙坊 [B店]', '手工麵包，每日新鮮出爐 [系統演示]', '台北市大安區模擬路二段200號', 25.0380, 121.5440, '02-00000002');

-- 高雄與台北新店家
INSERT OR IGNORE INTO stores (user_id, name, description, address, latitude, longitude, phone) VALUES
(3, '綠能惜食食堂 [C店]', '熱騰騰惜食餐盒與環保配菜 [系統演示]', '高雄市鹽埕區減碳路三段300號', 22.6208, 120.2820, '07-00000003'),
(4, '晨光烘焙概念店 [D店]', '在地現烤惜食麵包與手作點心 [系統演示]', '高雄市左營區綠活路四段400號', 22.6855, 120.3028, '07-00000004'),
(5, '綠野低碳蔬食坊 [E店]', '主打在地蔬食與環保輕食餐盒 [系統演示]', '高雄市苓雅區永續街五段500號', 22.6137, 120.3012, '07-00000005'),
(6, '好食減碳日常館 [F店]', '日常惜食補給，便當與輕食點心 [系統演示]', '高雄市三民區再生路六段600號', 22.6478, 120.3120, '07-00000006'),
(7, '森林綠意手作茶飲 [G店]', '手工慢煮茶與當日新鮮果汁組合 [系統演示]', '高雄市鼓山區綠蔭街七段700號', 22.6710, 120.2920, '07-00000007'),
(8, '慢活健康蔬食工坊 [H店]', '熟成沙拉與全麥輕食惜食三明治 [系統演示]', '高雄市左營區樂活路八段800號', 22.6800, 120.3120, '07-00000008'),
(9, '日落手工環保披薩 [I店]', '手工窯烤即期披薩與牽絲美味 [系統演示]', '高雄市楠梓區夕陽路九段900號', 22.7150, 120.3000, '07-00000009'),
(10, '小農無毒高纖麵包 [J店]', '使用在地農產製作的高纖惜食麵包 [系統演示]', '高雄市左營區田野路十段1000號', 22.6620, 120.3025, '07-00000010'),
(11, '老牌健康低鈉滷味 [K店]', '健康滷汁與當日惜食時段特惠 [系統演示]', '台北市大安區健康路十一段1100號', 25.0435, 121.5410, '02-00000011'),
(12, '法式精緻概念甜點 [L店]', '手工製作當日即期精緻法式甜點 [系統演示]', '台北市信義區香頌路十二段1200號', 25.0400, 121.5490, '02-00000012'),
(13, '活力低碳綠色沙拉 [M店]', '契作無毒蔬菜與健康美味低卡沙拉 [系統演示]', '台北市大安區青春街十三段1300號', 25.0350, 121.5380, '02-00000013'),
(14, '和風精緻惜食壽司 [N店]', '每日清晨新鮮漁獲與當日即期壽司拼盤 [系統演示]', '高雄市左營區海洋街十四段1400號', 22.6820, 120.3050, '07-00000014'),
(15, '綠意概念手作輕食 [O店]', '手工貝果、輕卡惜食餐盒與冷泡茶 [系統演示]', '高雄市左營區微風路十五段1500號', 22.6750, 120.3010, '07-00000015');

-- 測試機台
INSERT OR IGNORE INTO machines (id, name, location_desc, latitude, longitude, total_compartments, status, secret_key) VALUES
('MAC_01A2B3', '高雄1站', '捷運左營站 2 號出口旁', 22.6855, 120.3028, 12, 'IDLE', 'dev_secret_key_001'),
('MAC_02C4D6', '高雄2站', '捷運美麗島站 B1 穹頂大廳旁', 22.6314, 120.3019, 12, 'IDLE', 'dev_secret_key_002'),
('MAC_03E5F7', '台北1站', '捷運大安站 4 號出口通道內', 25.0330, 121.5435, 12, 'IDLE', 'dev_secret_key_003');

-- 艙位（每個機台 12 個）
INSERT OR IGNORE INTO compartments (machine_id, index_num, status) VALUES
('MAC_01A2B3', 1, 'EMPTY'), ('MAC_01A2B3', 2, 'EMPTY'), ('MAC_01A2B3', 3, 'EMPTY'), ('MAC_01A2B3', 4, 'EMPTY'), ('MAC_01A2B3', 5, 'EMPTY'), ('MAC_01A2B3', 6, 'EMPTY'), ('MAC_01A2B3', 7, 'EMPTY'), ('MAC_01A2B3', 8, 'EMPTY'), ('MAC_01A2B3', 9, 'EMPTY'), ('MAC_01A2B3', 10, 'EMPTY'), ('MAC_01A2B3', 11, 'EMPTY'), ('MAC_01A2B3', 12, 'EMPTY'),
('MAC_02C4D6', 1, 'EMPTY'), ('MAC_02C4D6', 2, 'EMPTY'), ('MAC_02C4D6', 3, 'EMPTY'), ('MAC_02C4D6', 4, 'EMPTY'), ('MAC_02C4D6', 5, 'EMPTY'), ('MAC_02C4D6', 6, 'EMPTY'), ('MAC_02C4D6', 7, 'EMPTY'), ('MAC_02C4D6', 8, 'EMPTY'), ('MAC_02C4D6', 9, 'EMPTY'), ('MAC_02C4D6', 10, 'EMPTY'), ('MAC_02C4D6', 11, 'EMPTY'), ('MAC_02C4D6', 12, 'EMPTY'),
('MAC_03E5F7', 1, 'EMPTY'), ('MAC_03E5F7', 2, 'EMPTY'), ('MAC_03E5F7', 3, 'EMPTY'), ('MAC_03E5F7', 4, 'EMPTY'), ('MAC_03E5F7', 5, 'EMPTY'), ('MAC_03E5F7', 6, 'EMPTY'), ('MAC_03E5F7', 7, 'EMPTY'), ('MAC_03E5F7', 8, 'EMPTY'), ('MAC_03E5F7', 9, 'EMPTY'), ('MAC_03E5F7', 10, 'EMPTY'), ('MAC_03E5F7', 11, 'EMPTY'), ('MAC_03E5F7', 12, 'EMPTY');

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
(6, '三民紅豆菠蘿', 'bread', 38, 22, '熱騰騰紅豆菠蘿麵包', 'map', 'AVAILABLE', datetime('now', '+5 hours')),
(7, '四季春奶蓋茶組', 'bread', 85, 45, '厚奶蓋四季春茶+手打紅豆銅鑼燒', 'map', 'AVAILABLE', datetime('now', '+3 hours')),
(7, '埔里百香雙Q果茶', 'bread', 75, 40, '新鮮百香果雙Q大杯裝', 'map', 'AVAILABLE', datetime('now', '+3 hours')),
(8, '慢活招牌沙拉盒', 'vegetable', 120, 69, '綜合有機生菜+蜜地瓜+腰果胡麻醬', 'map', 'AVAILABLE', datetime('now', '+4 hours')),
(8, '手撕蕈菇全麥三明治', 'bento', 95, 55, '全麥吐司+炒鮮蕈菇+莫札瑞拉起司', 'map', 'AVAILABLE', datetime('now', '+4 hours')),
(9, '日落雙拼煙燻雞披薩', 'bento', 220, 129, '雙拼美式燻雞與鮮蔬手工披薩(9吋)', 'map', 'AVAILABLE', datetime('now', '+5 hours')),
(9, '香蒜羅勒瑪格麗特披薩', 'bento', 180, 99, '經典羅勒與番茄莫札瑞拉起司披薩', 'map', 'AVAILABLE', datetime('now', '+5 hours')),
(10, '小農蜂蜜伯爵歐包', 'bread', 68, 38, '選用大崗山天然蜂蜜與伯爵茶葉', 'map', 'AVAILABLE', datetime('now', '+6 hours')),
(10, '高纖核桃蔓越莓歐包', 'bread', 75, 42, '無糖低油核桃蔓越莓高纖歐包', 'map', 'AVAILABLE', datetime('now', '+6 hours')),
(11, '經典招牌中藥滷味綜合包', 'vegetable', 100, 50, '豆干+海帶+凍豆腐+特製低卡高麗菜', 'map', 'AVAILABLE', datetime('now', '+3 hours')),
(11, '老牌醬香鴨翅雙隻裝', 'bento', 80, 40, '祖傳配方滷製，肉質Q彈入味', 'map', 'AVAILABLE', datetime('now', '+3 hours')),
(12, '法式檸檬塔', 'bread', 140, 75, '黃檸檬奶油餡搭配酥脆塔皮，酸甜適中', 'map', 'AVAILABLE', datetime('now', '+4 hours')),
(12, '經典香草千層蛋糕', 'bread', 160, 85, '層次分明，香草香氣十足', 'map', 'AVAILABLE', datetime('now', '+4 hours')),
(13, '煙燻鮭魚凱薩沙拉盒', 'vegetable', 150, 85, '煙燻鮭魚+羅馬生菜+小番茄+特調凱薩醬', 'map', 'AVAILABLE', datetime('now', '+3 hours')),
(13, '活力低脂烤雞胸餐盒', 'bento', 130, 75, '厚切雞胸肉+水煮蛋+雙配菜+五穀飯', 'map', 'AVAILABLE', datetime('now', '+3 hours')),
(14, '彩虹和風花壽司盒', 'bento', 180, 99, '花壽司8貫裝，附醬油與哇沙比', 'map', 'AVAILABLE', datetime('now', '+4 hours')),
(14, '炙燒焦糖鮭魚握壽司組', 'bento', 200, 119, '炙燒焦糖鮭魚握壽司5貫，入口即化', 'map', 'AVAILABLE', datetime('now', '+4 hours')),
(15, '藍莓起司手工貝果', 'bread', 60, 35, '手作藍莓果粒麵團+濃厚起司餡', 'map', 'AVAILABLE', datetime('now', '+5 hours')),
(15, '泰式酸辣雞肉輕食餐盒', 'bento', 120, 70, '低卡酸辣嫩雞胸+烤南瓜+鮮時蔬', 'map', 'AVAILABLE', datetime('now', '+5 hours'));

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

-- 高雄2站 機台商品 (C店與D店) [去識別化]
INSERT OR IGNORE INTO products (id, store_id, name, category, original_price, selling_price, description, source, status, expires_at) VALUES
(101, 3, '綠能素食餐盒', 'bento', 90, 50, '有機野米+烤豆腐+水煮西蘭花 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+3 hours')),
(102, 3, '低碳滑蛋飯盒', 'bento', 95, 55, '無油滑蛋+嫩雞胸肉+五穀飯 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+3 hours')),
(103, 4, '晨光法式黑巧可頌', 'bread', 55, 32, '濃厚明亮黑巧克力夾心 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+5 hours')),
(104, 4, '有機核桃蔓越莓軟歐', 'bread', 70, 40, '天然酵母發酵核桃蔓越莓歐包 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+5 hours')),
(105, 3, '小農契作有機青花椰', 'vegetable', 60, 32, '無毒溫室直配有機青花椰 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+2 hours')),
(106, 3, '小農彩椒鮮脆包', 'vegetable', 65, 35, '三色脆椒拼盤，高維生素C [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+2 hours'));

-- 台北1站 機台商品 (K店與L店) [去識別化]
INSERT OR IGNORE INTO products (id, store_id, name, category, original_price, selling_price, description, source, status, expires_at) VALUES
(201, 11, '環保低脂滷味餐盒', 'bento', 110, 60, '健康低鈉中藥滷汁蔬菜餐盒 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+3 hours')),
(202, 11, '招牌五香醬滷鴨翅', 'bento', 85, 45, '祖傳香料慢火滷製醬香鴨翅 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+3 hours')),
(203, 12, '法式奶油千層酥', 'bread', 60, 35, '經典香草法式千層酥點心 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+5 hours')),
(204, 12, '手作黃金檸檬小塔', 'bread', 80, 45, '清爽酸甜新鮮檸檬小甜塔 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+5 hours')),
(205, 11, '小農鮮採四季豆包', 'vegetable', 55, 30, '清脆鮮甜有機四季豆整袋裝 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+2 hours')),
(206, 11, '嚴選溫室彩色青椒', 'vegetable', 60, 32, '當日摘採鮮脆溫室彩色青椒 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+2 hours'));

-- 高雄1站 完整 12 項機台商品 [去識別化]
INSERT OR IGNORE INTO products (id, store_id, name, category, original_price, selling_price, description, source, status, expires_at) VALUES
(301, 1, '健康炭烤鯖魚便當', 'bento', 130, 65, '薄鹽鯖魚炭火慢烤+養生紫米飯+三配菜 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+3 hours')),
(302, 2, '法式檸檬磅蛋糕', 'bread', 70, 38, '清爽奶油磅蛋糕淋上新鮮檸檬糖霜 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+5 hours')),
(303, 1, '精選有機鮮洋蔥包', 'vegetable', 50, 25, '當日小農契作有機新鮮洋蔥整袋裝 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+2 hours')),
(304, 1, '日式手作漢堡排餐盒', 'bento', 140, 70, '厚實牛肉漢堡排搭配特調多明哥醬汁 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+3 hours')),
(305, 1, '古早味排骨酥便當', 'bento', 110, 55, '酥脆古早味排骨酥+燙青菜+滷蛋+白飯 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+3 hours')),
(306, 2, '伯爵紅茶戚風蛋糕', 'bread', 85, 45, '輕盈濕潤伯爵紅茶戚風搭配鮮奶油 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+5 hours')),
(307, 1, '泰式打拋豬肉餐盒', 'bento', 100, 55, '道地泰式打拋豬肉+荷包蛋+泰國香米 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+3 hours')),
(308, 2, '抹茶紅豆銅鑼燒', 'bread', 55, 30, '日式手作抹茶麵皮+綿密萬丹紅豆餡 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+5 hours')),
(309, 1, '小農有機綜合鮮蔬包', 'vegetable', 75, 40, '高雄在地有機蕃茄+小黃瓜+甜椒綜合包 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+2 hours')),
(310, 1, '韓式辣醬雞腿便當', 'bento', 120, 60, '韓式甜辣醬燒雞腿+醃蘿蔔+韓式拌菜 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+3 hours')),
(311, 2, '黑糖珍珠厚鮮奶吐司', 'bread', 65, 35, '手作黑糖珍珠夾心+北海道鮮奶吐司 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+5 hours')),
(312, 1, '小農契作鮮甜玉米包', 'vegetable', 45, 22, '當日現採水果玉米兩入裝，清甜無農藥 [機台專屬]', 'machine', 'AVAILABLE', datetime('now', '+2 hours'));

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
(20, 'milk'), (20, 'peanut'), (20, 'treenut'),
-- 高雄2站 新增機台商品過敏原 (101-106)
(101, 'soy'), (101, 'sesame'),
(102, 'chicken'), (102, 'egg'), (102, 'soy'),
(103, 'wheat'), (103, 'milk'),
(104, 'wheat'), (104, 'treenut'),
-- 台北1站 新增機台商品過敏原 (201-206)
(201, 'soy'),
(202, 'soy'),
(203, 'wheat'), (203, 'milk'), (203, 'egg'),
(204, 'wheat'), (204, 'milk'), (204, 'egg'),
-- 高雄1站 完整 12 項機台商品過敏原 (301-312)
(301, 'seafood'), (301, 'soy'),
(302, 'wheat'), (302, 'milk'), (302, 'egg'),
(303, 'sulfite'),
(304, 'beef'), (304, 'pork'), (304, 'soy'), (304, 'wheat'), (304, 'egg'),
(305, 'pork'), (305, 'wheat'), (305, 'egg'), (305, 'soy'),
(306, 'wheat'), (306, 'milk'), (306, 'egg'),
(307, 'pork'), (307, 'egg'), (307, 'soy'), (307, 'fish_sauce'),
(308, 'wheat'), (308, 'egg'), (308, 'milk'),
(309, 'sesame'),
(310, 'chicken'), (310, 'soy'), (310, 'wheat'), (310, 'sesame'),
(311, 'wheat'), (311, 'milk'),
(312, 'corn');

-- 把 12 個機台商品放入艙位（全面補滿補貨！）
UPDATE compartments SET status = 'STOCKED', product_id = 301, stocked_at = datetime('now'), stocked_by = 1 WHERE machine_id = 'MAC_01A2B3' AND index_num = 1;
UPDATE compartments SET status = 'STOCKED', product_id = 302, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 2;
UPDATE compartments SET status = 'STOCKED', product_id = 303, stocked_at = datetime('now'), stocked_by = 1 WHERE machine_id = 'MAC_01A2B3' AND index_num = 3;
UPDATE compartments SET status = 'STOCKED', product_id = 304, stocked_at = datetime('now'), stocked_by = 1 WHERE machine_id = 'MAC_01A2B3' AND index_num = 4;
UPDATE compartments SET status = 'STOCKED', product_id = 305, stocked_at = datetime('now'), stocked_by = 1 WHERE machine_id = 'MAC_01A2B3' AND index_num = 5;
UPDATE compartments SET status = 'STOCKED', product_id = 306, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 6;
UPDATE compartments SET status = 'STOCKED', product_id = 307, stocked_at = datetime('now'), stocked_by = 1 WHERE machine_id = 'MAC_01A2B3' AND index_num = 7;
UPDATE compartments SET status = 'STOCKED', product_id = 308, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 8;
UPDATE compartments SET status = 'STOCKED', product_id = 309, stocked_at = datetime('now'), stocked_by = 1 WHERE machine_id = 'MAC_01A2B3' AND index_num = 9;
UPDATE compartments SET status = 'STOCKED', product_id = 310, stocked_at = datetime('now'), stocked_by = 1 WHERE machine_id = 'MAC_01A2B3' AND index_num = 10;
UPDATE compartments SET status = 'STOCKED', product_id = 311, stocked_at = datetime('now'), stocked_by = 2 WHERE machine_id = 'MAC_01A2B3' AND index_num = 11;
UPDATE compartments SET status = 'STOCKED', product_id = 312, stocked_at = datetime('now'), stocked_by = 1 WHERE machine_id = 'MAC_01A2B3' AND index_num = 12;

-- 為高雄2站 (MAC_02C4D6) 和台北1站 (MAC_03E5F7) 上架機台商品
UPDATE compartments SET status = 'STOCKED', product_id = 101, stocked_at = datetime('now'), stocked_by = 3 WHERE machine_id = 'MAC_02C4D6' AND index_num = 1;
UPDATE compartments SET status = 'STOCKED', product_id = 102, stocked_at = datetime('now'), stocked_by = 3 WHERE machine_id = 'MAC_02C4D6' AND index_num = 2;
UPDATE compartments SET status = 'STOCKED', product_id = 103, stocked_at = datetime('now'), stocked_by = 4 WHERE machine_id = 'MAC_02C4D6' AND index_num = 3;
UPDATE compartments SET status = 'STOCKED', product_id = 104, stocked_at = datetime('now'), stocked_by = 4 WHERE machine_id = 'MAC_02C4D6' AND index_num = 4;
UPDATE compartments SET status = 'STOCKED', product_id = 105, stocked_at = datetime('now'), stocked_by = 3 WHERE machine_id = 'MAC_02C4D6' AND index_num = 5;
UPDATE compartments SET status = 'STOCKED', product_id = 106, stocked_at = datetime('now'), stocked_by = 3 WHERE machine_id = 'MAC_02C4D6' AND index_num = 6;

UPDATE compartments SET status = 'STOCKED', product_id = 201, stocked_at = datetime('now'), stocked_by = 11 WHERE machine_id = 'MAC_03E5F7' AND index_num = 1;
UPDATE compartments SET status = 'STOCKED', product_id = 202, stocked_at = datetime('now'), stocked_by = 11 WHERE machine_id = 'MAC_03E5F7' AND index_num = 2;
UPDATE compartments SET status = 'STOCKED', product_id = 203, stocked_at = datetime('now'), stocked_by = 12 WHERE machine_id = 'MAC_03E5F7' AND index_num = 3;
UPDATE compartments SET status = 'STOCKED', product_id = 204, stocked_at = datetime('now'), stocked_by = 12 WHERE machine_id = 'MAC_03E5F7' AND index_num = 4;
UPDATE compartments SET status = 'STOCKED', product_id = 205, stocked_at = datetime('now'), stocked_by = 11 WHERE machine_id = 'MAC_03E5F7' AND index_num = 5;
UPDATE compartments SET status = 'STOCKED', product_id = 206, stocked_at = datetime('now'), stocked_by = 11 WHERE machine_id = 'MAC_03E5F7' AND index_num = 6;

-- ============================================
-- 虛擬寵物養成系統裝飾品種子資料
-- ============================================

INSERT OR IGNORE INTO pet_shop_items (id, name, category, cost, sprite_key, min_level, description) VALUES
-- 帽子類 (hat)
(1, '貝雷帽', 'hat', 20, 'hat_beret', 1, '一頂優雅的藝術家貝雷帽。'),
(2, '廚師帽', 'hat', 30, 'hat_chef', 1, '專業惜食主廚的專屬廚師帽。'),
(3, '皇家皇冠', 'hat', 100, 'hat_crown', 10, '閃閃發光的黃金皇冠，象徵至高無上的榮耀！'),

-- 背景類 (background)
(4, '溫馨廚房', 'background', 30, 'bg_kitchen', 1, '散發著食物香氣的溫馨小廚房。'),
(5, '綠意公園', 'background', 50, 'bg_park', 5, '綠草如茵、微風徐徐的公園綠地。'),
(6, '璀璨星空', 'background', 150, 'bg_space', 15, '浩瀚神秘、繁星點點的宇宙星空。'),

-- 配件類 (accessory)
(7, '可愛蝴蝶結', 'accessory', 10, 'acc_bow', 1, '繫在頸部的大紅色蝴蝶結，非常討喜。'),
(8, '環保圍裙', 'accessory', 15, 'acc_apron', 1, '印有惜食標章的綠色圍裙。'),
(9, '酷炫墨鏡', 'accessory', 40, 'acc_glasses', 8, '戴上後霸氣外漏的黑色防曬墨鏡。'),

-- 特效類 (effect)
(10, '愛心泡泡', 'effect', 50, 'eff_hearts', 5, '周圍飄散著溫暖的粉紅色愛心泡泡。'),
(11, '璀璨星星', 'effect', 120, 'eff_stars', 12, '閃耀著金色光芒的璀璨星光環繞效果。');

-- 確保每次重啟載入 seed 時，開發環境中的所有機台商品都被重設為 AVAILABLE 且重新延期，防範測試期間已售出或過期的商品導致艙位與商品池不一致
UPDATE products SET status = 'AVAILABLE', expires_at = datetime('now', '+3 hours') WHERE id >= 301 AND id <= 312;
UPDATE products SET status = 'AVAILABLE', expires_at = datetime('now', '+3 hours') WHERE id >= 101 AND id <= 106;
UPDATE products SET status = 'AVAILABLE', expires_at = datetime('now', '+3 hours') WHERE id >= 201 AND id <= 206;
UPDATE products SET status = 'AVAILABLE', expires_at = datetime('now', '+2 hours') WHERE id >= 1 AND id <= 20;


