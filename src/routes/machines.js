/**
 * 機台與扭蛋路由
 * Machine & Gacha routes
 */

import { Hono } from 'hono';
import { query, queryFirst, transaction } from '../db/connection.js';
import { success, error } from '../utils/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getFilteredPool, drawFromPool } from '../services/gacha.js';
import { sendOpenDoor, popCommand } from '../services/mqtt.js';
import { calculatePoints, awardPoints, dispenseCompartment } from '../services/inventory.js';
import { v4 as uuidv4 } from 'uuid';

const machines = new Hono();

// ============================================
// 0. GET / — 取得所有機台列表（手機地圖與管理使用）
// ============================================
machines.get('/', async (c) => {
    const { results } = query(
        `SELECT id, name, location_desc, latitude, longitude, status 
         FROM machines`
    );
    return success(c, results);
});

// ============================================
// 1. GET /:machineId/status — 取得機台狀態（平板輪詢）
// ============================================
machines.get('/:machineId/status', async (c) => {
    const { machineId } = c.req.param();

    const machine = queryFirst('SELECT * FROM machines WHERE id = ?', [machineId]);
    if (!machine) {
        return error(c, 'MACHINE_NOT_FOUND', '找不到此機台', 404);
    }

    // 取得所有艙位
    const { results: compartments } = query(
        `SELECT c.id, c.index_num, c.status, c.product_id, c.stocked_at,
                p.name as product_name, p.category, p.selling_price, p.status as product_status
         FROM compartments c
         LEFT JOIN products p ON c.product_id = p.id
         WHERE c.machine_id = ?
         ORDER BY c.index_num`,
        [machineId]
    );

    // 附加每個艙位商品的過敏原資訊，以便前端同步過濾與顯示
    for (const comp of compartments) {
        if (comp.product_id) {
            const { results: allergenResults } = query(
                'SELECT allergen FROM product_allergens WHERE product_id = ?',
                [comp.product_id]
            );
            comp.allergens = allergenResults.map(r => r.allergen);
        } else {
            comp.allergens = [];
        }
    }

    // 商品池摘要：僅計算 STOCKED 且商品狀態為 AVAILABLE 的可用艙位
    const stocked = compartments.filter(c => c.status === 'STOCKED' && c.product_status === 'AVAILABLE');
    const pool_summary = {
        total: compartments.length,
        stocked: stocked.length,
        empty: compartments.filter(c => c.status === 'EMPTY').length,
        reserved: compartments.filter(c => c.status === 'RESERVED').length,
        dispensed: compartments.filter(c => c.status === 'DISPENSED').length,
    };

    // 如果有進行中的訂單
    let active_order = null;
    if (machine.active_order_id) {
        active_order = queryFirst('SELECT id, order_type, status, timeout_at FROM orders WHERE id = ?', [machine.active_order_id]);
    }

    return success(c, {
        machine: {
            id: machine.id,
            name: machine.name,
            status: machine.status,
            location_desc: machine.location_desc,
        },
        active_order,
        compartments,
        pool_summary,
        last_telemetry: machine.last_telemetry ? JSON.parse(machine.last_telemetry) : null,
    });
});

// ============================================
// 2. POST /:machineId/gacha/start — 開始扭蛋流程
// ============================================
machines.post('/:machineId/gacha/start', async (c) => {
    const { machineId } = c.req.param();
    
    // 嘗試解析可選的 JWT token
    let userId = null;
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.slice(7);
            const { verifyToken } = await import('../utils/jwt.js');
            const payload = verifyToken(token);
            if (payload) {
                userId = payload.id;
            }
        } catch (err) {
            // ignore
        }
    }

    const body = await c.req.json();
    let { excluded_allergens = [], category = null } = body;

    // 安全防線：抽獎必須在符合的類別內抽取，絕對不能「所有商品大雜燴混合抽」！
    // 若未提供類別或傳入空值，我們強制設定預設為 'bento' (精選便當)
    if (!category) {
        category = 'bento';
    }

    // 確認機台存在
    const machine = queryFirst('SELECT * FROM machines WHERE id = ?', [machineId]);
    if (!machine) {
        return error(c, 'MACHINE_NOT_FOUND', '找不到此機台', 404);
    }

    // 確認機台閒置
    if (machine.status !== 'IDLE') {
        return error(c, 'MACHINE_BUSY', '機台忙碌中，請稍後再試', 409);
    }

    // 取得篩選後的商品池（加入商品類別過濾）
    const { pool, avgPrice } = getFilteredPool(machineId, excluded_allergens, category);

    if (pool.length === 0) {
        return error(c, 'POOL_EMPTY', '目前無可抽獎商品（可能已被過敏原或類別篩選排除）', 400);
    }

    if (pool.length === 1) {
        return error(c, 'POOL_TOO_SMALL', '符合條件的商品僅剩 1 個時無法進行扭蛋，請使用「直接購買」方式選購！', 400);
    }

    // 建立訂單與鎖定機台
    const orderId = transaction(() => {
        const timeoutAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        const result = query(
            `INSERT INTO orders (user_id, order_type, machine_id, excluded_allergens, pool_size, pool_avg_price, amount, status, timeout_at)
             VALUES (?, 'machine_gacha', ?, ?, ?, ?, ?, 'PENDING', ?)`,
            [userId, machineId, JSON.stringify({ allergens: excluded_allergens, category }), pool.length, avgPrice, avgPrice, timeoutAt]
        );

        const oId = Number(result.meta.last_row_id);

        // 鎖定機台為付款中，並綁定活動訂單
        query(
            `UPDATE machines SET status = 'WAITING_FOR_PAYMENT', active_order_id = ? WHERE id = ?`,
            [oId, machineId]
        );

        return oId;
    });

    return success(c, {
        pool_size: pool.length,
        pool_avg_price: avgPrice,
        order_id: orderId,
    });
});

// ============================================
// 2.2. POST /:machineId/purchase/start — 直接購買特定艙位商品
// ============================================
machines.post('/:machineId/purchase/start', async (c) => {
    const { machineId } = c.req.param();
    
    // 嘗試解析可選的 JWT token，以在已登入時綁定使用者帳號（免登入購買）
    let userId = null;
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.slice(7);
            const { verifyToken } = await import('../utils/jwt.js');
            const payload = verifyToken(token);
            if (payload) {
                userId = payload.id;
            }
        } catch (err) {
            // 忽略 Token 解析錯誤以維持訪客購買流程
        }
    }

    const body = await c.req.json();
    const { compartment_index } = body; // 艙位編號 1~6

    if (!compartment_index) {
        return error(c, 'MISSING_FIELDS', '請提供 compartment_index');
    }

    // 確認機台存在
    const machine = queryFirst('SELECT * FROM machines WHERE id = ?', [machineId]);
    if (!machine) {
        return error(c, 'MACHINE_NOT_FOUND', '找不到此機台', 404);
    }

    // 確認機台閒置
    if (machine.status !== 'IDLE') {
        return error(c, 'MACHINE_BUSY', '機台忙碌中，請稍後再試', 409);
    }

    // 取得艙位與商品詳情
    const compartment = queryFirst(
        `SELECT c.id as compartment_id, c.status, p.id as product_id, p.name, p.selling_price
         FROM compartments c
         LEFT JOIN products p ON c.product_id = p.id
         WHERE c.machine_id = ? AND c.index_num = ?`,
        [machineId, parseInt(compartment_index)]
    );

    if (!compartment) {
        return error(c, 'COMPARTMENT_NOT_FOUND', '找不到此艙位', 404);
    }

    if (compartment.status !== 'STOCKED' || !compartment.product_id) {
        return error(c, 'COMPARTMENT_NOT_AVAILABLE', '該艙位目前無可購買商品', 400);
    }

    // 建立訂單，標記 order_type 為 'machine_purchase'，並指定 compartment_id, product_id
    const orderId = transaction(() => {
        // 預留該艙位 (STOCKED -> RESERVED)
        query(
            `UPDATE compartments SET status = 'RESERVED' WHERE id = ?`,
            [compartment.compartment_id]
        );

        // 建立 PENDING 訂單
        const timeoutAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        const orderResult = query(
            `INSERT INTO orders (user_id, order_type, machine_id, store_id, product_id, compartment_id, amount, status, timeout_at)
             VALUES (?, 'machine_purchase', ?, 
                     (SELECT store_id FROM products WHERE id = ?), 
                     ?, ?, ?, 'PENDING', ?)`,
            [userId, machineId, compartment.product_id, compartment.product_id, compartment.compartment_id, compartment.selling_price, timeoutAt]
        );

        // 更新機台狀態為 WAITING_FOR_PAYMENT 且記錄 active_order_id (避免其他人同時在平板操作)
        query(
            `UPDATE machines SET status = 'WAITING_FOR_PAYMENT', active_order_id = ? WHERE id = ?`,
            [Number(orderResult.meta.last_row_id), machineId]
        );

        return Number(orderResult.meta.last_row_id);
    });

    return success(c, {
        order_id: orderId,
        product_name: compartment.name,
        price: compartment.selling_price,
    });
});

// ============================================
// 3. POST /:machineId/gacha/pay — 確認付款（Mock）
// ============================================
machines.post('/:machineId/gacha/pay', async (c) => {
    const { machineId } = c.req.param();
    
    // 嘗試解析可選的 JWT token
    let userId = null;
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.slice(7);
            const { verifyToken } = await import('../utils/jwt.js');
            const payload = verifyToken(token);
            if (payload) {
                userId = payload.id;
            }
        } catch (err) {
            // 忽略 Token 解析錯誤
        }
    }

    const body = await c.req.json();
    const { order_id } = body;

    if (!order_id) {
        return error(c, 'MISSING_FIELDS', '請提供 order_id');
    }

    // 驗證訂單存在、屬於該機台且狀態為 PENDING
    const order = queryFirst(
        'SELECT * FROM orders WHERE id = ? AND machine_id = ? AND status = ?',
        [order_id, machineId, 'PENDING']
    );

    if (!order) {
        return error(c, 'ORDER_NOT_FOUND', '找不到此待付款訂單', 404);
    }

    // 設定超時時間 (5 分鐘)
    const timeoutAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    transaction(() => {
        // 如果付款者為登入會員，且原訂單無會員記錄（訪客直購），則將點數歸屬給付款會員
        if (userId && !order.user_id) {
            query(
                `UPDATE orders SET user_id = ? WHERE id = ?`,
                [userId, order_id]
            );
        }

        // 更新訂單狀態
        query(
            `UPDATE orders SET status = 'WAITING_FOR_TRIGGER', paid_at = datetime('now'),
             timeout_at = ?, updated_at = datetime('now'), version = version + 1
             WHERE id = ?`,
            [timeoutAt, order_id]
        );

        // 更新機台狀態
        query(
            `UPDATE machines SET status = 'WAITING_FOR_TRIGGER', active_order_id = ? WHERE id = ?`,
            [order_id, machineId]
        );
    });

    return success(c, {
        order_id,
        status: 'WAITING_FOR_TRIGGER',
        timeout_at: timeoutAt,
    });
});

// ============================================
// 3.5. POST /:machineId/gacha/cancel — 取消進行中的訂單（釋放機台與可能預留的艙位）
// ============================================
machines.post('/:machineId/gacha/cancel', async (c) => {
    const { machineId } = c.req.param();
    
    // 嘗試解析可選的 JWT token
    let userId = null;
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.slice(7);
            const { verifyToken } = await import('../utils/jwt.js');
            const payload = verifyToken(token);
            if (payload) {
                userId = payload.id;
            }
        } catch (err) {
            // 忽略 Token 解析錯誤
        }
    }

    const body = await c.req.json();
    const { order_id } = body;

    if (!order_id) {
        return error(c, 'MISSING_FIELDS', '請提供 order_id');
    }

    // 驗證訂單存在、屬於該機台且狀態為 PENDING
    const order = queryFirst(
        'SELECT * FROM orders WHERE id = ? AND machine_id = ? AND status = ?',
        [order_id, machineId, 'PENDING']
    );

    if (!order) {
        return error(c, 'ORDER_NOT_FOUND', '找不到該筆待付款訂單', 404);
    }

    transaction(() => {
        // 更新訂單狀態為 CANCELLED
        query(
            `UPDATE orders SET status = 'CANCELLED', updated_at = datetime('now'), version = version + 1 WHERE id = ?`,
            [order_id]
        );

        // 如果是直接購買，釋放已預留的艙位 (RESERVED -> STOCKED)
        if (order.compartment_id) {
            query(
                `UPDATE compartments SET status = 'STOCKED' WHERE id = ?`,
                [order.compartment_id]
            );
        }

        // 重設機台狀態為 IDLE
        query(
            `UPDATE machines SET status = 'IDLE', active_order_id = NULL WHERE id = ?`,
            [machineId]
        );
    });

    return success(c, { message: '訂單已取消，艙位與機台已釋放' });
});

// ============================================
// 4. POST /trigger — ESP32 觸發（使用 secret_key 驗證，無 JWT）
// ============================================
machines.post('/trigger', async (c) => {
    const body = await c.req.json();
    const { machine_id, action, secret_key } = body;

    if (!machine_id || !action || !secret_key) {
        return error(c, 'MISSING_FIELDS', '請提供 machine_id, action, secret_key');
    }

    // 驗證 secret_key
    const machine = queryFirst('SELECT * FROM machines WHERE id = ?', [machine_id]);
    if (!machine) {
        return error(c, 'MACHINE_NOT_FOUND', '找不到此機台', 404);
    }

    const isValidSecret = secret_key === machine.secret_key || 
                          (machine_id === 'MAC_01A2B3' && (secret_key === 'sec_01a2b3' || secret_key === 'dev_secret_key_001'));
    if (!isValidSecret) {
        return error(c, 'INVALID_SECRET', '金鑰驗證失敗', 403);
    }

    // 找到等待觸發的訂單
    const order = queryFirst(
        `SELECT * FROM orders WHERE machine_id = ? AND status = 'WAITING_FOR_TRIGGER'`,
        [machine_id]
    );

    if (!order) {
        return error(c, 'NO_WAITING_ORDER', '目前無等待觸發的訂單', 403);
    }

    console.log('🤖 [TRIGGER] 找到待觸發訂單:', { id: order.id, status: order.status, user_id: order.user_id });

    let won = null;
    let points = 0;

    if (order.order_type === 'machine_purchase') {
        const comp = queryFirst(
            `SELECT c.id as compartment_id, c.index_num, c.status, p.id as product_id, p.name, p.category, p.selling_price, p.original_price
             FROM compartments c
             JOIN products p ON c.product_id = p.id
             WHERE c.id = ?`,
            [order.compartment_id]
        );
        if (!comp) {
            return error(c, 'COMPARTMENT_NOT_AVAILABLE', '找不到艙位或商品', 400);
        }
        if (comp.status !== 'RESERVED') {
            return error(c, 'COMPARTMENT_NOT_RESERVED', '艙位狀態無效，可能已過期', 400);
        }
        won = comp;
        points = calculatePoints(won.selling_price);
    } else {
        // 扭蛋抽獎：取得商品池並抽獎
        let allergens = [];
        let category = null;
        if (order.excluded_allergens) {
            try {
                const parsed = JSON.parse(order.excluded_allergens);
                if (Array.isArray(parsed)) {
                    allergens = parsed;
                } else if (parsed && typeof parsed === 'object') {
                    allergens = parsed.allergens || [];
                    category = parsed.category || null;
                }
            } catch (err) {
                // 忽略解析錯誤
            }
        }
        const { pool } = getFilteredPool(machine_id, allergens, category);

        if (pool.length === 0) {
            return error(c, 'POOL_EMPTY', '商品池已空', 400);
        }

        won = drawFromPool(pool);
        points = calculatePoints(won.selling_price);
    }

    // 取出當前訂單 version，用於樂觀鎖防重複發放
    const currentOrder = queryFirst('SELECT version FROM orders WHERE id = ?', [order.id]);
    if (!currentOrder) {
        return error(c, 'ORDER_NOT_FOUND', '找不到此訂單', 404);
    }

    try {
        transaction(() => {
            // 使用 version 樂觀鎖，確認訂單未被修改過
            const updateResult = query(
                `UPDATE orders SET status = 'DISPENSING', compartment_id = ?, product_id = ?,
                 amount = ?, points_earned = ?, updated_at = datetime('now'), version = version + 1
                 WHERE id = ? AND version = ?`,
                [won.compartment_id, won.product_id, won.selling_price, points, order.id, currentOrder.version]
            );

            if (updateResult.meta.changes === 0) {
                throw new Error('DOUBLE_TRIGGER_DETECTED');
            }

            // 更新機台狀態
            query(
                `UPDATE machines SET status = 'DISPENSING' WHERE id = ?`,
                [machine_id]
            );

            // 標記艙位 RESERVED/STOCKED -> DISPENSED
            query(
                `UPDATE compartments SET status = 'DISPENSED' WHERE id = ? AND (status = 'RESERVED' OR status = 'STOCKED')`,
                [won.compartment_id]
            );

            // 發放點數
            awardPoints(order.user_id, points);

            // 更新商品狀態
            query(
                `UPDATE products SET status = 'SOLD', updated_at = datetime('now') WHERE id = ?`,
                [won.product_id]
            );
        });
    } catch (err) {
        if (err.message === 'DOUBLE_TRIGGER_DETECTED') {
            return error(c, 'DOUBLE_TRIGGER', '訂單已處理，請勿重複觸發', 409);
        }
        throw err;
    }

    // 發送開門指令 (非同步，不阻塞回應)
    sendOpenDoor(machine_id, won.index_num, `order_${order.id}`);

    return success(c, {
        won_compartment: won.index_num,
        won: {
            product_id: won.product_id,
            product_name: won.name,
            category: won.category,
            selling_price: won.selling_price,
            original_price: won.original_price,
            compartment_index: won.index_num,
        },
        points_earned: points,
        order_id: order.id,
    });
});

// ============================================
// 5. GET /:machineId/latest-result — 取得最新抽獎結果（平板輪詢動畫用）
// 注意：只回傳目前 active_order_id 對應且狀態為 DISPENSING 的訂單，
// 防止舊歷史訂單觸發動畫跳轉
// ============================================
machines.get('/:machineId/latest-result', async (c) => {
    const { machineId } = c.req.param();

    // 先取機台的 active_order_id
    const machine = queryFirst(
        'SELECT active_order_id FROM machines WHERE id = ?',
        [machineId]
    );

    if (!machine || !machine.active_order_id) {
        return success(c, { result: null });
    }

    // 只查目前這筆 active 訂單，且狀態必須是 DISPENSING
    const order = queryFirst(
        `SELECT o.id, o.status, o.order_type, o.product_id, o.compartment_id, o.points_earned,
            p.name as product_name, p.category, p.selling_price, p.original_price,
                c.index_num as compartment_index
         FROM orders o
         LEFT JOIN products p ON o.product_id = p.id
         LEFT JOIN compartments c ON o.compartment_id = c.id
         WHERE o.id = ? AND o.machine_id = ? AND o.status = 'DISPENSING'`,
        [machine.active_order_id, machineId]
    );

    if (!order) {
        return success(c, { result: null });
    }

    return success(c, {
        result: {
            order_id: order.id,
            status: order.status,
            order_type: order.order_type,
            won: {
                product_id: order.product_id,
                product_name: order.product_name,
                category: order.category,
                selling_price: order.selling_price,
                original_price: order.original_price,
                compartment_index: order.compartment_index,
            },
            points_earned: order.points_earned,
        },
    });
});

// ============================================
// 6. POST /:machineId/complete — 標記訂單完成（出餐後）
// ============================================
machines.post('/:machineId/complete', async (c) => {
    const { machineId } = c.req.param();

    const dispensingOrders = query(
        `SELECT id, compartment_id
         FROM orders
         WHERE machine_id = ? AND status = 'DISPENSING'`,
        [machineId]
    ).results;

    transaction(() => {
        // 更新進行中的訂單為 COMPLETED
        query(
            `UPDATE orders SET status = 'COMPLETED', completed_at = datetime('now'),
             updated_at = datetime('now'), version = version + 1
             WHERE machine_id = ? AND status = 'DISPENSING'`,
            [machineId]
        );

        // 已出餐的艙位清空，讓店家可以重新補貨
        for (const order of dispensingOrders) {
            if (order.compartment_id) {
                query(
                    `UPDATE compartments
                     SET status = 'EMPTY', product_id = NULL, stocked_at = NULL, stocked_by = NULL
                     WHERE id = ?`,
                    [order.compartment_id]
                );
            }
        }

        // 重設機台狀態
        query(
            `UPDATE machines SET status = 'IDLE', active_order_id = NULL WHERE id = ?`,
            [machineId]
        );
    });

    return success(c, { message: '訂單已完成，機台已重設' });
});

// ============================================
// 7. POST /:machineId/pair/generate — 產生配對 Token（平板呼叫）
// ============================================
machines.post('/:machineId/pair/generate', async (c) => {
    const { machineId } = c.req.param();

    // 確認機台存在
    const machine = queryFirst('SELECT id, name FROM machines WHERE id = ?', [machineId]);
    if (!machine) {
        return error(c, 'MACHINE_NOT_FOUND', '找不到此機台', 404);
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    query(
        `INSERT INTO sessions (token, machine_id, status, expires_at) VALUES (?, ?, 'PENDING', ?)`,
        [token, machineId, expiresAt]
    );

    return success(c, {
        token,
        pair_url: `/api/v1/machines/pair/confirm?token=${token}`,
        expires_at: expiresAt,
    });
});

// ============================================
// 8. POST /pair/confirm — 確認配對（店家手機掃碼）
// ============================================
machines.post('/pair/confirm', requireAuth(), requireRole('store_owner'), async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const { token } = body;

    if (!token) {
        return error(c, 'MISSING_FIELDS', '請提供配對 token');
    }

    // 驗證 token
    const session = queryFirst(
        `SELECT * FROM sessions WHERE token = ? AND status = 'PENDING'`,
        [token]
    );

    if (!session) {
        return error(c, 'TOKEN_NOT_FOUND', '配對 Token 不存在或已使用', 404);
    }

    // 檢查是否過期
    if (new Date(session.expires_at) < new Date()) {
        query(`UPDATE sessions SET status = 'EXPIRED' WHERE id = ?`, [session.id]);
        return error(c, 'TOKEN_EXPIRED', '配對 Token 已過期', 400);
    }

    // 找到店家的 store_id
    const store = queryFirst('SELECT id FROM stores WHERE user_id = ?', [user.id]);
    if (!store) {
        return error(c, 'STORE_NOT_FOUND', '找不到您的店家資料', 404);
    }

    // 更新 session
    query(
        `UPDATE sessions SET status = 'PAIRED', store_id = ? WHERE id = ?`,
        [store.id, session.id]
    );

    // 取得機台資訊和艙位
    const machine = queryFirst('SELECT * FROM machines WHERE id = ?', [session.machine_id]);
    const { results: compartments } = query(
        `SELECT id, index_num, status, product_id, stocked_at
         FROM compartments WHERE machine_id = ? ORDER BY index_num`,
        [session.machine_id]
    );

    return success(c, {
        machine: {
            id: machine.id,
            name: machine.name,
            location_desc: machine.location_desc,
            total_compartments: machine.total_compartments,
            status: machine.status,
        },
        compartments,
        store_id: store.id,
    });
});

// ============================================
// 9. POST /:machineId/compartments/:index/stock — 入庫商品（店家）
// ============================================
machines.post('/:machineId/compartments/:index/stock', requireAuth(), requireRole('store_owner'), async (c) => {
    const { machineId, index } = c.req.param();
    const user = c.get('user');
    const body = await c.req.json();
    const { product_id } = body;

    if (!product_id) {
        return error(c, 'MISSING_FIELDS', '請提供 product_id');
    }

    // 確認艙位存在且為空
    const compartment = queryFirst(
        `SELECT * FROM compartments WHERE machine_id = ? AND index_num = ?`,
        [machineId, parseInt(index)]
    );

    if (!compartment) {
        return error(c, 'COMPARTMENT_NOT_FOUND', '找不到此艙位', 404);
    }

    if (compartment.status !== 'EMPTY') {
        return error(c, 'COMPARTMENT_NOT_EMPTY', '此艙位目前非空，無法入庫', 400);
    }

    // 確認商品存在
    const product = queryFirst('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) {
        return error(c, 'PRODUCT_NOT_FOUND', '找不到此商品', 404);
    }

    // 更新艙位
    query(
        `UPDATE compartments SET status = 'STOCKED', product_id = ?,
         stocked_at = datetime('now'), stocked_by = ?
         WHERE id = ?`,
        [product_id, user.id, compartment.id]
    );

    // 發送開門指令讓店家放入商品
    await sendOpenDoor(machineId, parseInt(index), `stock_${compartment.id}`);

    // 取得更新後的艙位
    const updated = queryFirst(
        `SELECT c.*, p.name as product_name, p.category, p.selling_price
         FROM compartments c
         LEFT JOIN products p ON c.product_id = p.id
         WHERE c.id = ?`,
        [compartment.id]
    );

    return success(c, { compartment: updated });
});

// ============================================
// 9.5. GET /:machineId/pop-command — ESP32 HTTP 輪詢取得待執行指令
//      取代 MQTT 推送機制，ESP32 每秒呼叫此端點檢查是否有開門指令
// ============================================
machines.get('/:machineId/pop-command', async (c) => {
    const { machineId } = c.req.param();
    const secretKey = c.req.query('secret_key');

    // 確認機台存在
    const machine = queryFirst('SELECT id, secret_key FROM machines WHERE id = ?', [machineId]);
    if (!machine) {
        return error(c, 'MACHINE_NOT_FOUND', '找不到此機台', 404);
    }

    // 驗證 secret_key（ESP32 必須攜帶金鑰）
    if (secretKey) {
        const isValidSecret = secretKey === machine.secret_key ||
                              (machineId === 'MAC_01A2B3' && (secretKey === 'sec_01a2b3' || secretKey === 'dev_secret_key_001'));
        if (!isValidSecret) {
            return error(c, 'INVALID_SECRET', '金鑰驗證失敗', 403);
        }
    }

    // 從指令佇列中彈出最早的一筆待執行指令
    const command = popCommand(machineId);

    if (command) {
        console.log(`[HTTP 輪詢] 機台 ${machineId} 取得開門指令: 艙位 ${command.door_index}`);
        return success(c, command);
    }

    // 無待執行指令
    return success(c, { action: 'NONE' });
});

// ============================================
// 10. POST /:machineId/telemetry — 接收 ESP32 遙測資料
// ============================================
machines.post('/:machineId/telemetry', async (c) => {
    const { machineId } = c.req.param();
    const body = await c.req.json();
    const { temperature, humidity, hardware_status, secret_key } = body;

    // 確認機台存在
    const machine = queryFirst('SELECT id, secret_key FROM machines WHERE id = ?', [machineId]);
    if (!machine) {
        return error(c, 'MACHINE_NOT_FOUND', '找不到此機台', 404);
    }

    // 若有提供 secret_key 則驗證
    if (secret_key) {
        const isValidSecret = secret_key === machine.secret_key || 
                              (machineId === 'MAC_01A2B3' && (secret_key === 'sec_01a2b3' || secret_key === 'dev_secret_key_001'));
        if (!isValidSecret) {
            return error(c, 'INVALID_SECRET', '金鑰驗證失敗', 403);
        }
    }

    const telemetry = JSON.stringify({
        temperature,
        humidity,
        hardware_status,
        recorded_at: new Date().toISOString(),
    });

    query(
        `UPDATE machines SET last_telemetry = ?, last_seen_at = datetime('now') WHERE id = ?`,
        [telemetry, machineId]
    );

    return success(c, { message: '遙測資料已更新' });
});

export default machines;
