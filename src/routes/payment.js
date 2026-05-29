/**
 * 付款路由（Mock）
 * Mock Payment routes — placeholder for future real payment integration
 */

import { Hono } from 'hono';
import { queryFirst } from '../db/connection.js';
import { success, error } from '../utils/errors.js';

const payment = new Hono();

// ============================================
// 1. POST /mock/verify — Mock 付款驗證
// ============================================
payment.post('/mock/verify', async (c) => {
    const body = await c.req.json();
    const { order_id } = body;

    if (!order_id) {
        return error(c, 'MISSING_FIELDS', '請提供 order_id');
    }

    // 確認訂單存在
    const order = queryFirst('SELECT id, status, amount FROM orders WHERE id = ?', [order_id]);
    if (!order) {
        return error(c, 'ORDER_NOT_FOUND', '找不到此訂單', 404);
    }

    // Mock：永遠回傳成功
    return success(c, {
        order_id: order.id,
        amount: order.amount,
        payment_status: 'SUCCESS',
        message: 'Mock 付款驗證成功（未來將串接真實金流）',
    });
});

// ============================================
// 1.5. POST /mock/pay — 通用 Mock 付款（支援所有訂單類型）
// ============================================
payment.post('/mock/pay', async (c) => {
    const body = await c.req.json();
    const { order_id } = body;

    if (!order_id) {
        return error(c, 'MISSING_FIELDS', '請提供 order_id');
    }

    const order = queryFirst('SELECT * FROM orders WHERE id = ?', [order_id]);
    if (!order) {
        return error(c, 'ORDER_NOT_FOUND', '找不到此訂單', 404);
    }

    if (order.status !== 'PENDING') {
        if (['WAITING_FOR_TRIGGER', 'DISPENSING', 'COMPLETED', 'PAID'].includes(order.status)) {
            return success(c, {
                order_id: order.id,
                status: order.status,
                amount: order.amount,
                pickupCode: order.pickup_code,
                payment_status: 'SUCCESS',
                message: '訂單先前已付款成功',
            });
        }
        return error(c, 'INVALID_STATUS', '訂單狀態非待付款', 400);
    }

    const timeoutAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    if (order.order_type === 'map_purchase') {
        // 地圖導購：付款成功後才產生取餐碼與點數
        const { query: dbQuery, transaction } = await import('../db/connection.js');
        const { generatePickupCode, calculatePoints, awardPoints } = await import('../services/inventory.js');
        const pickupCode = generatePickupCode();
        const points = calculatePoints(order.amount);

        transaction(() => {
            dbQuery(
                `UPDATE orders SET status = 'PAID', pickup_code = ?, paid_at = datetime('now'), updated_at = datetime('now'), version = version + 1 WHERE id = ?`,
                [pickupCode, order_id]
            );
            dbQuery(
                `UPDATE products SET status = 'RESERVED', updated_at = datetime('now') WHERE id = ?`,
                [order.product_id]
            );
            if (order.user_id) {
                awardPoints(order.user_id, points);
            }
        });
    } else if (order.order_type === 'machine_purchase') {
        // 機台直購訂單：付款後不需要轉動旋鈕，直接出餐並發送開門通知！
        const { query: dbQuery, transaction } = await import('../db/connection.js');
        const { sendOpenDoor } = await import('../services/mqtt.js');
        const { awardPoints, dispenseCompartment } = await import('../services/inventory.js');

        // 取得艙位與商品詳情
        const comp = queryFirst(
            `SELECT c.id as compartment_id, c.index_num, p.id as product_id, p.name, p.category, p.selling_price, p.original_price
             FROM compartments c
             JOIN products p ON c.product_id = p.id
             WHERE c.id = ?`,
            [order.compartment_id]
        );

        if (!comp) {
            return error(c, 'COMPARTMENT_NOT_AVAILABLE', '商品已被他人抽走或艙位狀態不正確', 400);
        }

        const points = Math.floor(comp.selling_price * (parseInt(process.env.POINTS_PER_DOLLAR || '1')));

        transaction(() => {
            dbQuery(
                `UPDATE orders SET status = 'DISPENSING', points_earned = ?, paid_at = datetime('now'), updated_at = datetime('now'), version = version + 1 WHERE id = ?`,
                [points, order_id]
            );
            dbQuery(
                `UPDATE machines SET status = 'DISPENSING', active_order_id = ? WHERE id = ?`,
                [order_id, order.machine_id]
            );
            // [M6 FIX] 艙位已在 purchase/start 時 RESERVED，直接 dispense
            dispenseCompartment(comp.compartment_id);
            if (order.user_id) {
                awardPoints(order.user_id, points);
            }
            dbQuery(
                `UPDATE products SET status = 'SOLD', updated_at = datetime('now') WHERE id = ?`,
                [comp.product_id]
            );
        });

        // 發送開門指令到 ESP32
        await sendOpenDoor(order.machine_id, comp.index_num, `order_${order_id}`);
    } else {
        // 機台扭蛋訂單 (machine_gacha)：標記 WAITING_FOR_TRIGGER + 更新機台狀態
        const { query: dbQuery, transaction } = await import('../db/connection.js');
        transaction(() => {
            dbQuery(
                `UPDATE orders SET status = 'WAITING_FOR_TRIGGER', paid_at = datetime('now'), timeout_at = ?, updated_at = datetime('now'), version = version + 1 WHERE id = ? AND status = 'PENDING'`,
                [timeoutAt, order_id]
            );
            dbQuery(
                `UPDATE machines SET status = 'WAITING_FOR_TRIGGER', active_order_id = ? WHERE id = ?`,
                [order_id, order.machine_id]
            );
        });
    }

    const updated = queryFirst('SELECT id, status, pickup_code, amount, order_type FROM orders WHERE id = ?', [order_id]);

    return success(c, {
        order_id: updated.id,
        status: updated.status,
        amount: updated.amount,
        pickupCode: updated.pickup_code,
        payment_status: 'SUCCESS',
        message: 'Mock 付款驗證成功',
    });
});

// ============================================
// 2. GET /mock/status/:orderId — 查詢付款狀態
// ============================================
payment.get('/mock/status/:orderId', async (c) => {
    const { orderId } = c.req.param();

    const order = queryFirst(
        'SELECT id, status, amount, paid_at FROM orders WHERE id = ?',
        [parseInt(orderId)]
    );

    if (!order) {
        return error(c, 'ORDER_NOT_FOUND', '找不到此訂單', 404);
    }

    // 根據訂單狀態判斷付款狀態
    let paymentStatus = 'UNPAID';
    if (['PAID', 'WAITING_FOR_TRIGGER', 'DISPENSING', 'COMPLETED'].includes(order.status)) {
        paymentStatus = 'PAID';
    } else if (order.status === 'TIMEOUT_REFUNDED') {
        paymentStatus = 'REFUNDED';
    } else if (order.status === 'CANCELLED') {
        paymentStatus = 'CANCELLED';
    }

    return success(c, {
        order_id: order.id,
        order_status: order.status,
        payment_status: paymentStatus,
        amount: order.amount,
        paid_at: order.paid_at,
    });
});

// ============================================
// 1.6. POST /mock/pay-and-dispense — 測試用：付款並直接觸發出餐（僅開發環境使用）
// ============================================
payment.post('/mock/pay-and-dispense', async (c) => {
    const body = await c.req.json();
    const { order_id } = body;

    if (!order_id) {
        return error(c, 'MISSING_FIELDS', '請提供 order_id');
    }

    // 取得訂單
    const order = queryFirst('SELECT * FROM orders WHERE id = ?', [order_id]);
    if (!order) {
        return error(c, 'ORDER_NOT_FOUND', '找不到此訂單', 404);
    }

    if (order.status !== 'PENDING') {
        return error(c, 'INVALID_STATUS', '訂單狀態非待付款，無法直接出餐', 400);
    }

    // 僅允許非正式環境使用（避免生產誤觸）
    if (process.env.NODE_ENV === 'production') {
        return error(c, 'FORBIDDEN', '生產環境禁止使用測試用出餐 API', 403);
    }

    // deferred imports to avoid circulars
    const { query: dbQuery, transaction } = await import('../db/connection.js');
    const { getFilteredPool, drawFromPool } = await import('../services/gacha.js');
    const { sendOpenDoor } = await import('../services/mqtt.js');
    const { awardPoints, dispenseCompartment } = await import('../services/inventory.js');

    let won = null;
    let points = 0;

    transaction(() => {
        // 標記為已付款並直接進入出餐流程
        dbQuery(`UPDATE orders SET status = 'WAITING_FOR_TRIGGER', paid_at = datetime('now'), updated_at = datetime('now'), version = version + 1 WHERE id = ?`, [order_id]);
        dbQuery(`UPDATE machines SET status = 'WAITING_FOR_TRIGGER', active_order_id = ? WHERE id = ?`, [order_id, order.machine_id]);
    });

    // 使用與 /trigger 相同的抽獎/出餐邏輯
    const freshOrder = queryFirst('SELECT * FROM orders WHERE id = ?', [order_id]);

    if (freshOrder.order_type === 'machine_purchase') {
        const comp = queryFirst(
            `SELECT c.id as compartment_id, c.index_num, p.id as product_id, p.name, p.category, p.selling_price, p.original_price
             FROM compartments c
             JOIN products p ON c.product_id = p.id
             WHERE c.id = ?`,
            [freshOrder.compartment_id]
        );
        if (!comp) {
            return error(c, 'COMPARTMENT_NOT_AVAILABLE', '商品已被他人抽走或艙位狀態不正確', 400);
        }
        won = comp;
        points = Math.floor(won.selling_price * (parseInt(process.env.POINTS_PER_DOLLAR || '1')));
    } else {
        let allergens = [];
        let category = null;
        if (freshOrder.excluded_allergens) {
            try {
                const parsed = JSON.parse(freshOrder.excluded_allergens);
                if (Array.isArray(parsed)) allergens = parsed;
                else if (parsed && typeof parsed === 'object') {
                    allergens = parsed.allergens || [];
                    category = parsed.category || null;
                }
            } catch (err) {
                // ignore
            }
        }
        const { pool } = getFilteredPool(freshOrder.machine_id, allergens, category);
        if (pool.length === 0) {
            return error(c, 'POOL_EMPTY', '商品池已空', 400);
        }
        won = drawFromPool(pool);
        points = Math.floor(won.selling_price * (parseInt(process.env.POINTS_PER_DOLLAR || '1')));
    }

    transaction(() => {
        dbQuery(
            `UPDATE orders SET status = 'DISPENSING', compartment_id = ?, product_id = ?, amount = ?, points_earned = ?, updated_at = datetime('now'), version = version + 1 WHERE id = ?`,
            [won.compartment_id, won.product_id, won.selling_price, points, order_id]
        );

        dbQuery(`UPDATE machines SET status = 'DISPENSING' WHERE id = ?`, [freshOrder.machine_id]);

        dbQuery(`UPDATE compartments SET status = 'RESERVED' WHERE id = ?`, [won.compartment_id]);
        dispenseCompartment(won.compartment_id);

        // [M16 FIX] null userId 防護
        if (freshOrder.user_id) {
            awardPoints(freshOrder.user_id, points);
        }

        dbQuery(`UPDATE products SET status = 'SOLD', updated_at = datetime('now') WHERE id = ?`, [won.product_id]);
    });

    // 發送開門指令
    sendOpenDoor(freshOrder.machine_id, won.index_num, `order_${order_id}`);

    return success(c, {
        order_id: Number(order_id),
        status: 'DISPENSING',
        won: {
            product_id: won.product_id,
            product_name: won.name,
            category: won.category,
            selling_price: won.selling_price,
            compartment_index: won.index_num,
        },
        points_earned: points,
        message: '模擬付款並直接出餐（僅開發環境）',
    });
});

export default payment;
