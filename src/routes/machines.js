/**
 * 機台與扭蛋路由
 * Machine & Gacha routes
 */

import { Hono } from 'hono';
import { query, queryFirst, transaction } from '../db/connection.js';
import { success, error } from '../utils/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getFilteredPool, drawFromPool } from '../services/gacha.js';
import { sendOpenDoor } from '../services/mqtt.js';
import { calculatePoints, awardPoints, dispenseCompartment } from '../services/inventory.js';
import { v4 as uuidv4 } from 'uuid';

const machines = new Hono();

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
                p.name as product_name, p.category, p.selling_price
         FROM compartments c
         LEFT JOIN products p ON c.product_id = p.id
         WHERE c.machine_id = ?
         ORDER BY c.index_num`,
        [machineId]
    );

    // 商品池摘要
    const stocked = compartments.filter(c => c.status === 'STOCKED');
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
        active_order = queryFirst('SELECT id, status, timeout_at FROM orders WHERE id = ?', [machine.active_order_id]);
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
machines.post('/:machineId/gacha/start', requireAuth(), async (c) => {
    const { machineId } = c.req.param();
    const user = c.get('user');
    const body = await c.req.json();
    const { excluded_allergens = [] } = body;

    // 確認機台存在
    const machine = queryFirst('SELECT * FROM machines WHERE id = ?', [machineId]);
    if (!machine) {
        return error(c, 'MACHINE_NOT_FOUND', '找不到此機台', 404);
    }

    // 確認機台閒置
    if (machine.status !== 'IDLE') {
        return error(c, 'MACHINE_BUSY', '機台忙碌中，請稍後再試', 409);
    }

    // 取得篩選後的商品池
    const { pool, avgPrice } = getFilteredPool(machineId, excluded_allergens);

    if (pool.length === 0) {
        return error(c, 'POOL_EMPTY', '目前無可抽獎商品（可能已被過敏原篩選排除）', 400);
    }

    // 建立訂單
    const result = query(
        `INSERT INTO orders (user_id, order_type, machine_id, excluded_allergens, pool_size, pool_avg_price, amount, status)
         VALUES (?, 'machine_gacha', ?, ?, ?, ?, ?, 'PENDING')`,
        [user.id, machineId, JSON.stringify(excluded_allergens), pool.length, avgPrice, avgPrice]
    );

    const orderId = Number(result.meta.last_row_id);

    return success(c, {
        pool_size: pool.length,
        pool_avg_price: avgPrice,
        order_id: orderId,
    });
});

// ============================================
// 3. POST /:machineId/gacha/pay — 確認付款（Mock）
// ============================================
machines.post('/:machineId/gacha/pay', requireAuth(), async (c) => {
    const { machineId } = c.req.param();
    const user = c.get('user');
    const body = await c.req.json();
    const { order_id } = body;

    if (!order_id) {
        return error(c, 'MISSING_FIELDS', '請提供 order_id');
    }

    // 驗證訂單屬於該使用者且狀態為 PENDING
    const order = queryFirst(
        'SELECT * FROM orders WHERE id = ? AND user_id = ? AND status = ?',
        [order_id, user.id, 'PENDING']
    );

    if (!order) {
        return error(c, 'ORDER_NOT_FOUND', '找不到此待付款訂單', 404);
    }

    // 設定超時時間 (5 分鐘)
    const timeoutAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    transaction(() => {
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

    if (machine.secret_key !== secret_key) {
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

    // 取得商品池並抽獎
    const excludedAllergens = order.excluded_allergens ? JSON.parse(order.excluded_allergens) : [];
    const { pool } = getFilteredPool(machine_id, excludedAllergens);

    if (pool.length === 0) {
        return error(c, 'POOL_EMPTY', '商品池已空', 400);
    }

    const won = drawFromPool(pool);

    // 計算點數
    const points = calculatePoints(won.selling_price);

    transaction(() => {
        // 更新訂單
        query(
            `UPDATE orders SET status = 'DISPENSING', compartment_id = ?, product_id = ?,
             amount = ?, points_earned = ?, updated_at = datetime('now'), version = version + 1
             WHERE id = ?`,
            [won.compartment_id, won.product_id, won.selling_price, points, order.id]
        );

        // 更新機台狀態
        query(
            `UPDATE machines SET status = 'DISPENSING' WHERE id = ?`,
            [machine_id]
        );

        // 標記艙位 RESERVED -> DISPENSED
        query(
            `UPDATE compartments SET status = 'RESERVED' WHERE id = ?`,
            [won.compartment_id]
        );
        dispenseCompartment(won.compartment_id);

        // 發放點數
        awardPoints(order.user_id, points);

        // 更新商品狀態
        query(
            `UPDATE products SET status = 'SOLD', updated_at = datetime('now') WHERE id = ?`,
            [won.product_id]
        );
    });

    // 發送開門指令 (非同步，不阻塞回應)
    sendOpenDoor(machine_id, won.index_num, `order_${order.id}`);

    return success(c, {
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
// ============================================
machines.get('/:machineId/latest-result', async (c) => {
    const { machineId } = c.req.param();

    const order = queryFirst(
        `SELECT o.id, o.status, o.product_id, o.compartment_id, o.points_earned,
                p.name as product_name, p.category, p.selling_price, p.original_price
         FROM orders o
         LEFT JOIN products p ON o.product_id = p.id
         WHERE o.machine_id = ? AND o.status IN ('DISPENSING', 'COMPLETED')
         ORDER BY o.updated_at DESC
         LIMIT 1`,
        [machineId]
    );

    if (!order) {
        return success(c, { result: null });
    }

    return success(c, {
        result: {
            order_id: order.id,
            status: order.status,
            won: {
                product_id: order.product_id,
                product_name: order.product_name,
                category: order.category,
                selling_price: order.selling_price,
                original_price: order.original_price,
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

    transaction(() => {
        // 更新進行中的訂單為 COMPLETED
        query(
            `UPDATE orders SET status = 'COMPLETED', completed_at = datetime('now'),
             updated_at = datetime('now'), version = version + 1
             WHERE machine_id = ? AND status = 'DISPENSING'`,
            [machineId]
        );

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
    if (secret_key && machine.secret_key !== secret_key) {
        return error(c, 'INVALID_SECRET', '金鑰驗證失敗', 403);
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
