-- ============================================
-- 裝飾品種子資料 (Seed Data)
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
