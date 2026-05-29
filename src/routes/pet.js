/**
 * 虛擬寵物養成系統 API 路由
 */

import { Hono } from 'hono';
import { query, queryFirst, transaction } from '../db/connection.js';
import { success, error } from '../utils/errors.js';
import { requireAuth } from '../middleware/auth.js';

const pet = new Hono();

// 經驗值曲線公式
function expToNextLevel(level) {
    return Math.floor(50 * Math.pow(level, 1.5));
}

// 屬性自然衰減邏輯
function applyDecay(petRow) {
    if (!petRow) return petRow;
    const now = new Date();
    const lastDecay = new Date(petRow.last_decay_at || petRow.lastDecay || now);
    const msDiff = now - lastDecay;
    const hoursElapsed = msDiff / (1000 * 60 * 60);

    if (hoursElapsed >= 1) {
        const decayFullness = Math.floor(hoursElapsed * 2);
        const decayHappiness = Math.floor(hoursElapsed * 1);

        const newFullness = Math.max(0, petRow.fullness - decayFullness);
        const newHappiness = Math.max(0, petRow.happiness - decayHappiness);
        const newLastDecay = now.toISOString();

        query(`
            UPDATE pets 
            SET fullness = ?, happiness = ?, last_decay_at = ?, updated_at = datetime('now')
            WHERE id = ?
        `, [newFullness, newHappiness, newLastDecay, petRow.id]);

        return {
            ...petRow,
            fullness: newFullness,
            happiness: newHappiness,
            last_decay_at: newLastDecay
        };
    }
    return petRow;
}

// 經驗值增加與升級/進化判定
function addExp(petRow, amount) {
    let exp = petRow.exp + amount;
    let level = petRow.level;
    let evolutionStage = petRow.evolution_stage;
    let leveledUp = false;
    let evolved = false;

    while (true) {
        const reqExp = expToNextLevel(level);
        if (exp >= reqExp) {
            exp -= reqExp;
            level += 1;
            leveledUp = true;

            // 進化判定
            let newStage = 1;
            if (level >= 20) {
                newStage = 3;
            } else if (level >= 10) {
                newStage = 2;
            }

            if (newStage > evolutionStage) {
                evolutionStage = newStage;
                evolved = true;
            }
        } else {
            break;
        }
    }

    return { exp, level, evolutionStage, leveledUp, evolved };
}

// ============================================
// 1. POST /create — 首次建立寵物
// ============================================
pet.post('/create', requireAuth(), async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const { name, species } = body;

    if (!name || !species) {
        return error(c, 'MISSING_FIELDS', '請填寫寵物名稱與種類');
    }

    const validSpecies = ['rice_bunny', 'bread_bear', 'veggie_dragon', 'dog', 'cat'];
    if (!validSpecies.includes(species)) {
        return error(c, 'INVALID_SPECIES', '無效的寵物種類');
    }

    // 檢查是否已有寵物
    const existing = queryFirst('SELECT id FROM pets WHERE user_id = ?', [user.id]);
    if (existing) {
        return error(c, 'PET_EXISTS', '您已經擁有寵物了', 409);
    }

    const nowIso = new Date().toISOString();
    const result = query(`
        INSERT INTO pets (user_id, name, species, fullness, happiness, level, exp, evolution_stage, last_decay_at, created_at, updated_at)
        VALUES (?, ?, ?, 100, 100, 1, 0, 1, ?, ?, ?)
    `, [user.id, name, species, nowIso, nowIso, nowIso]);

    const petId = Number(result.meta.last_row_id);
    const newPet = queryFirst('SELECT * FROM pets WHERE id = ?', [petId]);

    return success(c, {
        pet: {
            ...newPet,
            equipped_items: []
        }
    }, 201);
});

// ============================================
// 2. GET /status — 取得寵物狀態
// ============================================
pet.get('/status', requireAuth(), async (c) => {
    const userPayload = c.get('user');
    let petRow = queryFirst('SELECT * FROM pets WHERE user_id = ?', [userPayload.id]);

    if (!petRow) {
        return error(c, 'NO_PET', '尚未建立寵物', 404);
    }

    // 計算自然衰減
    petRow = applyDecay(petRow);

    // 獲取已裝備道具
    const { results: equippedItems } = query(`
        SELECT i.id, i.name, i.category, i.sprite_key 
        FROM pet_owned_items o
        JOIN pet_shop_items i ON o.item_id = i.id
        WHERE o.user_id = ? AND o.is_equipped = 1
    `, [userPayload.id]);

    // 獲取使用者當前點數
    const user = queryFirst('SELECT points FROM users WHERE id = ?', [userPayload.id]);

    // 獲取各項動作的冷卻時間
    const getCooldown = (action, durationMinutes) => {
        const log = queryFirst(`
            SELECT created_at FROM pet_action_logs 
            WHERE user_id = ? AND action = ? 
            ORDER BY created_at DESC LIMIT 1
        `, [userPayload.id, action]);

        if (!log) return null;

        const nextAllowedTime = new Date(new Date(log.created_at).getTime() + durationMinutes * 60 * 1000);
        return nextAllowedTime > new Date() ? nextAllowedTime.toISOString() : null;
    };

    // 餵食冷卻時間 (normal/premium 共用)
    const feedLog = queryFirst(`
        SELECT created_at FROM pet_action_logs 
        WHERE user_id = ? AND action IN ('feed', 'feed_premium') 
        ORDER BY created_at DESC LIMIT 1
    `, [userPayload.id]);
    
    let feedCooldown = null;
    if (feedLog) {
        const nextAllowedFeed = new Date(new Date(feedLog.created_at).getTime() + 30 * 60 * 1000);
        feedCooldown = nextAllowedFeed > new Date() ? nextAllowedFeed.toISOString() : null;
    }

    return success(c, {
        pet: {
            id: petRow.id,
            species: petRow.species,
            name: petRow.name,
            level: petRow.level,
            exp: petRow.exp,
            exp_to_next: expToNextLevel(petRow.level),
            fullness: petRow.fullness,
            happiness: petRow.happiness,
            evolution_stage: petRow.evolution_stage,
            equipped_items: equippedItems
        },
        user_points: user.points,
        cooldowns: {
            feed: feedCooldown,
            play: getCooldown('play', 15),
            bath: getCooldown('bath', 120),
            pet: getCooldown('pet', 5)
        }
    });
});

// ============================================
// 3. POST /feed — 餵食
// ============================================
pet.post('/feed', requireAuth(), async (c) => {
    const userPayload = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const { feed_type } = body;

    if (!['normal', 'premium'].includes(feed_type)) {
        return error(c, 'INVALID_FEED_TYPE', '無效的餵食種類');
    }

    let petRow = queryFirst('SELECT * FROM pets WHERE user_id = ?', [userPayload.id]);
    if (!petRow) {
        return error(c, 'NO_PET', '尚未建立寵物', 404);
    }

    // 點數設定與效果設定
    const cost = feed_type === 'normal' ? 5 : 15;
    const addFull = feed_type === 'normal' ? 20 : 50;
    const addExpVal = feed_type === 'normal' ? 10 : 30;

    // 驗證點數
    const user = queryFirst('SELECT points FROM users WHERE id = ?', [userPayload.id]);
    if (user.points < cost) {
        return error(c, 'INSUFFICIENT_POINTS', `點數不足（需要 ${cost} 點，剩餘 ${user.points} 點）`);
    }

    // 更新狀態與經驗值
    petRow = applyDecay(petRow);
    const newFullness = Math.min(100, petRow.fullness + addFull);
    const { exp: newExp, level: newLevel, evolutionStage: newStage, leveledUp, evolved } = addExp(petRow, addExpVal);

    // 資料庫交易 (Transaction)
    transaction(() => {
        // 扣除點數
        query('UPDATE users SET points = points - ? WHERE id = ?', [cost, userPayload.id]);
        
        // 更新寵物狀態
        query(`
            UPDATE pets 
            SET fullness = ?, exp = ?, level = ?, evolution_stage = ?, updated_at = datetime('now')
            WHERE id = ?
        `, [newFullness, newExp, newLevel, newStage, petRow.id]);
        
        // 寫入行動日誌
        query(`
            INSERT INTO pet_action_logs (user_id, action, points_spent)
            VALUES (?, ?, ?)
        `, [userPayload.id, feed_type === 'normal' ? 'feed' : 'feed_premium', cost]);
    });

    const remainingPoints = queryFirst('SELECT points FROM users WHERE id = ?', [userPayload.id]).points;

    return success(c, {
        action: feed_type === 'normal' ? 'feed' : 'feed_premium',
        points_spent: cost,
        points_remaining: remainingPoints,
        pet_update: {
            fullness: newFullness,
            exp: newExp,
            level: newLevel,
            leveled_up: leveledUp,
            evolved: evolved
        },
        next_feed_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    });
});

// ============================================
// 4. POST /play — 玩耍 (play, bath, pet)
// ============================================
pet.post('/play', requireAuth(), async (c) => {
    const userPayload = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const { play_type } = body;

    if (!['play', 'bath', 'pet'].includes(play_type)) {
        return error(c, 'INVALID_PLAY_TYPE', '無效的玩耍種類');
    }

    let petRow = queryFirst('SELECT * FROM pets WHERE user_id = ?', [userPayload.id]);
    if (!petRow) {
        return error(c, 'NO_PET', '尚未建立寵物', 404);
    }

    // 點數與冷卻設定
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

    // 驗證點數
    const user = queryFirst('SELECT points FROM users WHERE id = ?', [userPayload.id]);
    if (user.points < cost) {
        return error(c, 'INSUFFICIENT_POINTS', `點數不足（需要 ${cost} 點，剩餘 ${user.points} 點）`);
    }

    // 更新狀態與經驗值
    petRow = applyDecay(petRow);
    const newHappiness = Math.min(100, petRow.happiness + addHappy);
    const { exp: newExp, level: newLevel, evolutionStage: newStage, leveledUp, evolved } = addExp(petRow, addExpVal);

    // 資料庫交易 (Transaction)
    transaction(() => {
        // 扣除點數
        query('UPDATE users SET points = points - ? WHERE id = ?', [cost, userPayload.id]);
        
        // 更新寵物狀態
        query(`
            UPDATE pets 
            SET happiness = ?, exp = ?, level = ?, evolution_stage = ?, updated_at = datetime('now')
            WHERE id = ?
        `, [newHappiness, newExp, newLevel, newStage, petRow.id]);
        
        // 寫入行動日誌
        query(`
            INSERT INTO pet_action_logs (user_id, action, points_spent)
            VALUES (?, ?, ?)
        `, [userPayload.id, play_type, cost]);
    });

    const remainingPoints = queryFirst('SELECT points FROM users WHERE id = ?', [userPayload.id]).points;

    return success(c, {
        action: play_type,
        points_spent: cost,
        points_remaining: remainingPoints,
        pet_update: {
            happiness: newHappiness,
            exp: newExp,
            level: newLevel,
            leveled_up: leveledUp,
            evolved: evolved
        },
        next_action_at: new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString()
    });
});

// ============================================
// 5. GET /shop — 裝飾商店列表
// ============================================
pet.get('/shop', requireAuth(), async (c) => {
    const userPayload = c.get('user');

    const { results: items } = query('SELECT * FROM pet_shop_items');
    const user = queryFirst('SELECT points FROM users WHERE id = ?', [userPayload.id]);
    const petRow = queryFirst('SELECT level FROM pets WHERE user_id = ?', [userPayload.id]);
    const { results: ownedItems } = query('SELECT item_id FROM pet_owned_items WHERE user_id = ?', [userPayload.id]);
    const ownedIds = new Set(ownedItems.map(o => o.item_id));

    const petLevel = petRow ? petRow.level : 1;

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

    return success(c, {
        items: result,
        user_points: user.points,
        pet_level: petLevel
    });
});

// ============================================
// 6. POST /buy-item — 購買裝飾品
// ============================================
pet.post('/buy-item', requireAuth(), async (c) => {
    const userPayload = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const { item_id } = body;

    const item = queryFirst('SELECT * FROM pet_shop_items WHERE id = ?', [item_id]);
    if (!item) {
        return error(c, 'ITEM_NOT_FOUND', '商品不存在', 404);
    }

    // 檢查是否已擁有
    const owned = queryFirst('SELECT id FROM pet_owned_items WHERE user_id = ? AND item_id = ?', [userPayload.id, item_id]);
    if (owned) {
        return error(c, 'ALREADY_OWNED', '您已經擁有此裝飾品', 400);
    }

    // 檢查等級限制
    const petRow = queryFirst('SELECT level FROM pets WHERE user_id = ?', [userPayload.id]);
    const petLevel = petRow ? petRow.level : 1;
    if (petLevel < item.min_level) {
        return error(c, 'LEVEL_TOO_LOW', `您的寵物等級不足（需要等級 ${item.min_level}）`, 400);
    }

    // 檢查點數
    const user = queryFirst('SELECT points FROM users WHERE id = ?', [userPayload.id]);
    if (user.points < item.cost) {
        return error(c, 'INSUFFICIENT_POINTS', `點數不足（需要 ${item.cost} 點，剩餘 ${user.points} 點）`, 400);
    }

    // 交易扣除
    transaction(() => {
        // 扣點
        query('UPDATE users SET points = points - ? WHERE id = ?', [item.cost, userPayload.id]);
        
        // 寫入已擁有
        query(`
            INSERT INTO pet_owned_items (user_id, item_id, is_equipped)
            VALUES (?, ?, 0)
        `, [userPayload.id, item_id]);
    });

    const remainingPoints = queryFirst('SELECT points FROM users WHERE id = ?', [userPayload.id]).points;

    return success(c, {
        item: { id: item.id, name: item.name, category: item.category },
        points_spent: item.cost,
        points_remaining: remainingPoints
    });
});

// ============================================
// 7. POST /equip — 裝備/卸下裝飾品
// ============================================
pet.post('/equip', requireAuth(), async (c) => {
    const userPayload = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const { item_id, equip } = body;

    // 驗證是否擁有此道具
    const owned = queryFirst(`
        SELECT o.*, i.category 
        FROM pet_owned_items o
        JOIN pet_shop_items i ON o.item_id = i.id
        WHERE o.user_id = ? AND o.item_id = ?
    `, [userPayload.id, item_id]);

    if (!owned) {
        return error(c, 'NOT_OWNED', '您尚未擁有此裝飾品', 400);
    }

    transaction(() => {
        if (equip) {
            // 裝備：同類別 (category) 其他道具設為 0
            query(`
                UPDATE pet_owned_items 
                SET is_equipped = 0 
                WHERE user_id = ? AND item_id IN (
                    SELECT id FROM pet_shop_items WHERE category = ?
                )
            `, [userPayload.id, owned.category]);

            // 裝備當前
            query('UPDATE pet_owned_items SET is_equipped = 1 WHERE user_id = ? AND item_id = ?', [userPayload.id, item_id]);
        } else {
            // 卸下
            query('UPDATE pet_owned_items SET is_equipped = 0 WHERE user_id = ? AND item_id = ?', [userPayload.id, item_id]);
        }
    });

    return success(c, {
        item_id,
        is_equipped: equip ? 1 : 0
    });
});

export default pet;
