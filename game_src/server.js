const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const { cors } = require('hono/cors');
const { jwt, sign } = require('hono/jwt');
const { serveStatic } = require('@hono/node-server/serve-static');
const path = require('node:path');
const { db, initDb } = require('./database/db');

const app = new Hono();

// 啟用 CORS
app.use('/api/*', cors());

// JWT 密鑰
const JWT_SECRET = 'secret-key-for-pet-game-12345';

// JWT 認證中間件
const authMiddleware = jwt({
    secret: JWT_SECRET,
    alg: 'HS256'
});

// 初始化資料庫
initDb();

// 經驗值曲線公式
function expToNextLevel(level) {
    return Math.floor(50 * Math.pow(level, 1.5));
}

// 屬性自然衰減邏輯
function applyDecay(pet) {
    const now = new Date();
    const lastDecay = new Date(pet.last_decay_at);
    const msDiff = now - lastDecay;
    const hoursElapsed = msDiff / (1000 * 60 * 60);

    if (hoursElapsed >= 1) {
        const decayFullness = Math.floor(hoursElapsed * 2);
        const decayHappiness = Math.floor(hoursElapsed * 1);

        pet.fullness = Math.max(0, pet.fullness - decayFullness);
        pet.happiness = Math.max(0, pet.happiness - decayHappiness);
        pet.last_decay_at = now.toISOString();

        // 寫入資料庫
        const stmt = db.prepare(`
            UPDATE pets 
            SET fullness = ?, happiness = ?, last_decay_at = ?, updated_at = datetime('now')
            WHERE id = ?
        `);
        stmt.run(pet.fullness, pet.happiness, pet.last_decay_at, pet.id);
    }
    return pet;
}

// 經驗值增加與升級/進化判定
function addExp(pet, amount) {
    pet.exp += amount;
    let leveledUp = false;
    let evolved = false;

    while (true) {
        const reqExp = expToNextLevel(pet.level);
        if (pet.exp >= reqExp) {
            pet.exp -= reqExp;
            pet.level += 1;
            leveledUp = true;

            // 進化判定
            let newStage = 1;
            if (pet.level >= 20) {
                newStage = 3;
            } else if (pet.level >= 10) {
                newStage = 2;
            }

            if (newStage > pet.evolution_stage) {
                pet.evolution_stage = newStage;
                evolved = true;
            }
        } else {
            break;
        }
    }
    return { leveledUp, evolved };
}

// ============================================
// 1. 模擬使用者認證 API
// ============================================

// 註冊
app.post('/api/v1/auth/register', async (c) => {
    try {
        const body = await c.req.json();
        const { username } = body;

        if (!username) {
            return c.json({ success: false, error: { message: '請提供使用者名稱' } }, 400);
        }

        // 檢查是否已存在
        const checkUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (checkUser) {
            return c.json({ success: false, error: { message: '使用者名稱已存在' } }, 409);
        }

        // 新增使用者
        const insert = db.prepare('INSERT INTO users (username, points) VALUES (?, 100)').run(username);
        const userId = insert.lastInsertRowid;

        // 產生 JWT Token
        const token = await sign({ userId, username, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) }, JWT_SECRET);

        return c.json({
            success: true,
            data: {
                token,
                user: { id: userId, username, points: 100 }
            }
        }, 201);
    } catch (err) {
        return c.json({ success: false, error: { message: err.message } }, 500);
    }
});

// 登入
app.post('/api/v1/auth/login', async (c) => {
    try {
        const body = await c.req.json();
        const { username } = body;

        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user) {
            return c.json({ success: false, error: { message: '使用者不存在' } }, 404);
        }

        const token = await sign({ userId: user.id, username: user.username, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) }, JWT_SECRET);

        return c.json({
            success: true,
            data: {
                token,
                user: { id: user.id, username: user.username, points: user.points }
            }
        });
    } catch (err) {
        return c.json({ success: false, error: { message: err.message } }, 500);
    }
});

// 獲取目前使用者資訊與點數
app.get('/api/v1/auth/me', authMiddleware, async (c) => {
    const payload = c.get('jwtPayload');
    const user = db.prepare('SELECT id, username, points FROM users WHERE id = ?').get(payload.userId);
    if (!user) {
        return c.json({ success: false, error: { message: '找不到使用者' } }, 404);
    }
    return c.json({
        success: true,
        data: { user }
    });
});

// ============================================
// 2. 寵物養成 API
// ============================================

// 首次建立寵物
app.post('/api/v1/pet/create', authMiddleware, async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;

    try {
        const body = await c.req.json();
        const { name, species } = body;

        if (!name || !species) {
            return c.json({ success: false, error: { message: '請填寫寵物名稱與種類' } }, 400);
        }

        if (!['rice_bunny', 'bread_bear', 'veggie_dragon', 'dog', 'cat'].includes(species)) {
            return c.json({ success: false, error: { message: '無效的寵物種類' } }, 400);
        }

        // 檢查是否已有寵物
        const existingPet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(userId);
        if (existingPet) {
            return c.json({
                success: false,
                error: { code: 'PET_EXISTS', message: '您已經擁有寵物了' }
            }, 409);
        }

        // 寫入寵物
        const nowIso = new Date().toISOString();
        db.prepare(`
            INSERT INTO pets (user_id, name, species, fullness, happiness, level, exp, evolution_stage, last_decay_at, created_at, updated_at)
            VALUES (?, ?, ?, 100, 100, 1, 0, 1, ?, ?, ?)
        `).run(userId, name, species, nowIso, nowIso, nowIso);

        const pet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(userId);

        return c.json({
            success: true,
            data: {
                pet: {
                    ...pet,
                    equipped_items: []
                }
            }
        }, 201);
    } catch (err) {
        return c.json({ success: false, error: { message: err.message } }, 500);
    }
});

// 獲取寵物狀態
app.get('/api/v1/pet/status', authMiddleware, async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;

    try {
        let pet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(userId);
        if (!pet) {
            return c.json({
                success: false,
                error: { code: 'NO_PET', message: '尚未建立寵物' }
            }, 404);
        }

        // 計算自然衰減
        pet = applyDecay(pet);

        // 獲取已裝備道具
        const equippedItems = db.prepare(`
            SELECT i.id, i.name, i.category, i.sprite_key 
            FROM pet_owned_items o
            JOIN pet_shop_items i ON o.item_id = i.id
            WHERE o.user_id = ? AND o.is_equipped = 1
        `).all(userId);

        // 獲取使用者當前點數
        const user = db.prepare('SELECT points FROM users WHERE id = ?').get(userId);

        // 獲取各項動作的冷卻時間
        const getCooldown = (action, durationMinutes) => {
            const log = db.prepare(`
                SELECT created_at FROM pet_action_logs 
                WHERE user_id = ? AND action = ? 
                ORDER BY created_at DESC LIMIT 1
            `).get(userId, action);

            if (!log) return null;

            const nextAllowedTime = new Date(new Date(log.created_at).getTime() + durationMinutes * 60 * 1000);
            return nextAllowedTime > new Date() ? nextAllowedTime.toISOString() : null;
        };

        // 餵食冷卻時間 (normal/premium 共用)
        const feedLog = db.prepare(`
            SELECT created_at FROM pet_action_logs 
            WHERE user_id = ? AND action IN ('feed', 'feed_premium') 
            ORDER BY created_at DESC LIMIT 1
        `).get(userId);
        
        let feedCooldown = null;
        if (feedLog) {
            const nextAllowedFeed = new Date(new Date(feedLog.created_at).getTime() + 30 * 60 * 1000);
            feedCooldown = nextAllowedFeed > new Date() ? nextAllowedFeed.toISOString() : null;
        }

        return c.json({
            success: true,
            data: {
                pet: {
                    id: pet.id,
                    species: pet.species,
                    name: pet.name,
                    level: pet.level,
                    exp: pet.exp,
                    exp_to_next: expToNextLevel(pet.level),
                    fullness: pet.fullness,
                    happiness: pet.happiness,
                    evolution_stage: pet.evolution_stage,
                    equipped_items: equippedItems
                },
                user_points: user.points,
                cooldowns: {
                    feed: null,
                    play: null,
                    bath: null,
                    pet: null
                }
            }
        });
    } catch (err) {
        return c.json({ success: false, error: { message: err.message } }, 500);
    }
});

// 餵食 API
app.post('/api/v1/pet/feed', authMiddleware, async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;

    try {
        const body = await c.req.json();
        const { feed_type } = body;

        if (!['normal', 'premium'].includes(feed_type)) {
            return c.json({ success: false, error: { message: '無效的餵食種類' } }, 400);
        }

        let pet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(userId);
        if (!pet) {
            return c.json({ success: false, error: { message: '尚未建立寵物' } }, 404);
        }

        // 檢查餵食冷卻 (30 分鐘) - 測試期間已移除

        // 點數設定與效果設定
        const cost = feed_type === 'normal' ? 5 : 15;
        const addFull = feed_type === 'normal' ? 20 : 50;
        const addExpVal = feed_type === 'normal' ? 10 : 30;

        // 驗證點數
        const user = db.prepare('SELECT points FROM users WHERE id = ?').get(userId);
        if (user.points < cost) {
            return c.json({
                success: false,
                error: { code: 'INSUFFICIENT_POINTS', message: `點數不足（需要 ${cost} 點，剩餘 ${user.points} 點）` }
            }, 400);
        }

        // 更新狀態與經驗值
        pet = applyDecay(pet);
        pet.fullness = Math.min(100, pet.fullness + addFull);
        const { leveledUp, evolved } = addExp(pet, addExpVal);

        // 資料庫原子操作 (Transaction)
        db.exec('BEGIN TRANSACTION');
        try {
            // 扣除點數
            db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(cost, userId);
            
            // 更新寵物狀態
            db.prepare(`
                UPDATE pets 
                SET fullness = ?, exp = ?, level = ?, evolution_stage = ?, updated_at = datetime('now')
                WHERE id = ?
            `).run(pet.fullness, pet.exp, pet.level, pet.evolution_stage, pet.id);
            
            // 寫入行動日誌
            db.prepare(`
                INSERT INTO pet_action_logs (user_id, action, points_spent, created_at)
                VALUES (?, ?, ?, ?)
            `).run(userId, feed_type === 'normal' ? 'feed' : 'feed_premium', cost, new Date().toISOString());
            
            db.exec('COMMIT');
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }

        const remainingPoints = db.prepare('SELECT points FROM users WHERE id = ?').get(userId).points;

        return c.json({
            success: true,
            data: {
                action: feed_type === 'normal' ? 'feed' : 'feed_premium',
                points_spent: cost,
                points_remaining: remainingPoints,
                pet_update: {
                    fullness: pet.fullness,
                    exp: pet.exp,
                    level: pet.level,
                    leveled_up: leveledUp,
                    evolved: evolved
                },
                next_feed_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            }
        });

    } catch (err) {
        return c.json({ success: false, error: { message: err.message } }, 500);
    }
});

// 玩耍 API (玩耍、洗澡、摸頭)
app.post('/api/v1/pet/play', authMiddleware, async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;

    try {
        const body = await c.req.json();
        const { play_type } = body;

        if (!['play', 'bath', 'pet'].includes(play_type)) {
            return c.json({ success: false, error: { message: '無效的玩耍種類' } }, 400);
        }

        let pet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(userId);
        if (!pet) {
            return c.json({ success: false, error: { message: '尚未建立寵物' } }, 404);
        }

        // 冷卻時間與點數消耗設定
        let cost = 0;
        let addHappy = 0;
        let addExpVal = 0;
        let cooldownMinutes = 0;

        if (play_type === 'play') {
            cost = 3; addHappy = 15; addExpVal = 5; cooldownMinutes = 15;
        } else if (play_type === 'bath') {
            cost = 5; addHappy = 30; addExpVal = 10; cooldownMinutes = 120;
        } else if (play_type === 'pet') {
            cost = 0; addHappy = 3; addExpVal = 0; cooldownMinutes = 5;
        }

        // 檢查冷卻時間 - 測試期間已移除

        // 驗證點數
        const user = db.prepare('SELECT points FROM users WHERE id = ?').get(userId);
        if (user.points < cost) {
            return c.json({
                success: false,
                error: { code: 'INSUFFICIENT_POINTS', message: `點數不足（需要 ${cost} 點，剩餘 ${user.points} 點）` }
            }, 400);
        }

        // 更新狀態與經驗值
        pet = applyDecay(pet);
        pet.happiness = Math.min(100, pet.happiness + addHappy);
        const { leveledUp, evolved } = addExp(pet, addExpVal);

        // 資料庫原子操作 (Transaction)
        db.exec('BEGIN TRANSACTION');
        try {
            // 扣除點數
            db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(cost, userId);
            
            // 更新寵物狀態
            db.prepare(`
                UPDATE pets 
                SET happiness = ?, exp = ?, level = ?, evolution_stage = ?, updated_at = datetime('now')
                WHERE id = ?
            `).run(pet.happiness, pet.exp, pet.level, pet.evolution_stage, pet.id);
            
            // 寫入行動日誌
            db.prepare(`
                INSERT INTO pet_action_logs (user_id, action, points_spent, created_at)
                VALUES (?, ?, ?, ?)
            `).run(userId, play_type, cost, new Date().toISOString());
            
            db.exec('COMMIT');
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }

        const remainingPoints = db.prepare('SELECT points FROM users WHERE id = ?').get(userId).points;

        return c.json({
            success: true,
            data: {
                action: play_type,
                points_spent: cost,
                points_remaining: remainingPoints,
                pet_update: {
                    happiness: pet.happiness,
                    exp: pet.exp,
                    level: pet.level,
                    leveled_up: leveledUp,
                    evolved: evolved
                },
                next_action_at: new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString()
            }
        });

    } catch (err) {
        return c.json({ success: false, error: { message: err.message } }, 500);
    }
});

// 裝飾商店列表
app.get('/api/v1/pet/shop', authMiddleware, async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;

    try {
        const items = db.prepare('SELECT * FROM pet_shop_items').all();
        const user = db.prepare('SELECT points FROM users WHERE id = ?').get(userId);
        const pet = db.prepare('SELECT level FROM pets WHERE user_id = ?').get(userId);
        const ownedItems = db.prepare('SELECT item_id FROM pet_owned_items WHERE user_id = ?').all(userId);
        const ownedIds = new Set(ownedItems.map(o => o.item_id));

        const petLevel = pet ? pet.level : 1;

        const result = items.map(item => {
            const owned = ownedIds.has(item.id);
            return {
                id: item.id,
                name: item.name,
                category: item.category,
                cost: item.cost,
                min_level: item.min_level,
                sprite_key: item.sprite_key,
                description: item.description,
                owned,
                can_afford: user.points >= item.cost,
                level_met: petLevel >= item.min_level
            };
        });

        return c.json({
            success: true,
            data: {
                items: result,
                user_points: user.points,
                pet_level: petLevel
            }
        });
    } catch (err) {
        return c.json({ success: false, error: { message: err.message } }, 500);
    }
});

// 購買裝飾品
app.post('/api/v1/pet/buy-item', authMiddleware, async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;

    try {
        const body = await c.req.json();
        const { item_id } = body;

        const item = db.prepare('SELECT * FROM pet_shop_items WHERE id = ?').get(item_id);
        if (!item) {
            return c.json({ success: false, error: { message: '商品不存在' } }, 404);
        }

        // 檢查是否已擁有
        const owned = db.prepare('SELECT * FROM pet_owned_items WHERE user_id = ? AND item_id = ?').get(userId, item_id);
        if (owned) {
            return c.json({
                success: false,
                error: { code: 'ALREADY_OWNED', message: '您已經擁有此裝飾品' }
            }, 400);
        }

        // 檢查等級限制
        const pet = db.prepare('SELECT level FROM pets WHERE user_id = ?').get(userId);
        const petLevel = pet ? pet.level : 1;
        if (petLevel < item.min_level) {
            return c.json({
                success: false,
                error: { code: 'LEVEL_TOO_LOW', message: `您的寵物等級不足（需要等級 ${item.min_level}）` }
            }, 400);
        }

        // 檢查點數
        const user = db.prepare('SELECT points FROM users WHERE id = ?').get(userId);
        if (user.points < item.cost) {
            return c.json({
                success: false,
                error: { code: 'INSUFFICIENT_POINTS', message: `點數不足（需要 ${item.cost} 點，剩餘 ${user.points} 點）` }
            }, 400);
        }

        // 資料庫原子操作 (Transaction)
        db.exec('BEGIN TRANSACTION');
        try {
            // 扣點
            db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(item.cost, userId);
            
            // 寫入已擁有道具
            db.prepare(`
                INSERT INTO pet_owned_items (user_id, item_id, is_equipped, purchased_at)
                VALUES (?, ?, 0, ?)
            `).run(userId, item_id, new Date().toISOString());
            
            db.exec('COMMIT');
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }

        const remainingPoints = db.prepare('SELECT points FROM users WHERE id = ?').get(userId).points;

        return c.json({
            success: true,
            data: {
                item: { id: item.id, name: item.name, category: item.category },
                points_spent: item.cost,
                points_remaining: remainingPoints
            }
        });

    } catch (err) {
        return c.json({ success: false, error: { message: err.message } }, 500);
    }
});

// 裝備/卸下裝飾品
app.post('/api/v1/pet/equip', authMiddleware, async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;

    try {
        const body = await c.req.json();
        const { item_id, equip } = body;

        // 驗證是否擁有此道具
        const owned = db.prepare(`
            SELECT o.*, i.category 
            FROM pet_owned_items o
            JOIN pet_shop_items i ON o.item_id = i.id
            WHERE o.user_id = ? AND o.item_id = ?
        `).get(userId, item_id);

        if (!owned) {
            return c.json({ success: false, error: { message: '您尚未擁有此裝飾品' } }, 400);
        }

        db.exec('BEGIN TRANSACTION');
        try {
            if (equip) {
                // 如果是裝備，同種類 (category) 的其他道具必須先卸下 (is_equipped = 0)
                db.prepare(`
                    UPDATE pet_owned_items 
                    SET is_equipped = 0 
                    WHERE user_id = ? AND item_id IN (
                        SELECT id FROM pet_shop_items WHERE category = ?
                    )
                `).run(userId, owned.category);

                // 裝備當前道具
                db.prepare('UPDATE pet_owned_items SET is_equipped = 1 WHERE user_id = ? AND item_id = ?').run(userId, item_id);
            } else {
                // 卸下道具
                db.prepare('UPDATE pet_owned_items SET is_equipped = 0 WHERE user_id = ? AND item_id = ?').run(userId, item_id);
            }
            db.exec('COMMIT');
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }

        return c.json({
            success: true,
            data: {
                item_id,
                is_equipped: equip ? 1 : 0
            }
        });

    } catch (err) {
        return c.json({ success: false, error: { message: err.message } }, 500);
    }
});

// ============================================
// 3. 靜態網頁服務 (用於未來的 Mobile PWA 前端)
// ============================================
app.use('/*', serveStatic({ root: path.relative(process.cwd(), path.join(__dirname, 'public')) }));

// 啟動伺服器
const port = 3000;
console.log(`虛擬寵物後端伺服器正啟動於 http://localhost:${port}`);
serve({
    fetch: app.fetch,
    port
});
