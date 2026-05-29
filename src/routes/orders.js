/**
 * 訂單路由
 * Order routes
 */

import { Hono } from 'hono';
import { query, queryFirst, transaction } from '../db/connection.js';
import { success, error } from '../utils/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { calculatePoints, awardPoints, generatePickupCode } from '../services/inventory.js';

const orders = new Hono();

// ============================================
// 1. POST /map — 地圖導購下單（路徑一）
// ============================================
orders.post('/map', requireAuth(), async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const { product_id } = body;

    if (!product_id) {
        return error(c, 'MISSING_FIELDS', '請提供 product_id');
    }

    // 驗證商品存在、可購買、且來源為 map
    const product = queryFirst(
        `SELECT p.*, s.id as store_id, s.name as store_name
         FROM products p
         JOIN stores s ON p.store_id = s.id
         WHERE p.id = ? AND p.status = 'AVAILABLE' AND p.source = 'map'`,
        [product_id]
    );

    if (!product) {
        return error(c, 'PRODUCT_NOT_AVAILABLE', '商品不存在、已售出、或非地圖導購商品', 400);
    }

    const pickupCode = generatePickupCode();
    const points = calculatePoints(product.selling_price);

    const result = transaction(() => {
        // 建立訂單（Mock 付款，直接 PAID）
        const orderResult = query(
            `INSERT INTO orders (user_id, order_type, store_id, product_id, amount, status, pickup_code, points_earned, paid_at)
             VALUES (?, 'map_purchase', ?, ?, ?, 'PAID', ?, ?, datetime('now'))`,
            [user.id, product.store_id, product_id, product.selling_price, pickupCode, points]
        );

        const orderId = Number(orderResult.meta.last_row_id);

        // 標記商品為 RESERVED
        query(
            `UPDATE products SET status = 'RESERVED', updated_at = datetime('now') WHERE id = ?`,
            [product_id]
        );

        // 發放點數
        awardPoints(user.id, points);

        return orderId;
    });

    return success(c, {
        order: {
            id: result,
            order_type: 'map_purchase',
            status: 'PAID',
            product_id: product.id,
            product_name: product.name,
            store_name: product.store_name,
            amount: product.selling_price,
            pickup_code: pickupCode,
            points_earned: points,
        },
    }, 201);
});

// ============================================
// 2. GET /me — 我的訂單列表
// ============================================
orders.get('/me', requireAuth(), async (c) => {
    const user = c.get('user');

    const { results } = query(
        `SELECT o.id, o.order_type, o.status, o.amount, o.pickup_code,
                o.points_earned, o.paid_at, o.completed_at, o.created_at,
                p.name as product_name, p.category,
                s.name as store_name
         FROM orders o
         LEFT JOIN products p ON o.product_id = p.id
         LEFT JOIN stores s ON o.store_id = s.id
         WHERE o.user_id = ?
         ORDER BY o.created_at DESC`,
        [user.id]
    );

    return success(c, { orders: results });
});

// ============================================
// 2.8. GET /store — 店家的訂單列表
// ============================================
orders.get('/store', requireAuth(), requireRole('store_owner'), async (c) => {
    const user = c.get('user');

    // 找到店家的 store_id
    const store = queryFirst('SELECT id FROM stores WHERE user_id = ?', [user.id]);
    if (!store) {
        return error(c, 'STORE_NOT_FOUND', '找不到您的店家資料', 404);
    }

    const { results } = query(
        `SELECT o.id, o.order_type, o.status, o.amount, o.pickup_code,
                o.points_earned, o.paid_at, o.completed_at, o.created_at,
                p.name as product_name, p.category,
                u.name as user_name
         FROM orders o
         LEFT JOIN products p ON o.product_id = p.id
         LEFT JOIN users u ON o.user_id = u.id
         WHERE o.store_id = ?
         ORDER BY o.created_at DESC`,
        [store.id]
    );

    return success(c, { orders: results });
});

// ============================================
// 2.5. GET /:id — 取得單筆訂單詳情
// ============================================
orders.get('/:id', async (c) => {
    // 嘗試解析可選的 JWT token，若為訪客購買則無需登入驗證
    let userId = null;
    let userRole = null;
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.slice(7);
            const { verifyToken } = await import('../utils/jwt.js');
            const payload = verifyToken(token);
            if (payload) {
                userId = payload.id;
                userRole = payload.role;
            }
        } catch (err) {
            // 忽略 Token 解析錯誤以維持訪客查看流程
        }
    }

    const { id } = c.req.param();

    const order = queryFirst(
        `SELECT o.id, o.order_type, o.status, o.amount, o.pickup_code,
                o.points_earned, o.paid_at, o.completed_at, o.created_at,
                p.name as product_name, p.category,
                s.id as store_id, s.name as store_name, o.user_id
         FROM orders o
         LEFT JOIN products p ON o.product_id = p.id
         LEFT JOIN stores s ON o.store_id = s.id
         WHERE o.id = ?`,
        [parseInt(id)]
    );

    if (!order) {
        return error(c, 'ORDER_NOT_FOUND', '找不到此訂單', 404);
    }

    // 檢查權限：如果訂單有綁定使用者 (user_id IS NOT NULL)，則必須登入且為訂單擁有者，或者是店面老闆；如果是訪客訂單 (user_id IS NULL)，則允許直接查看
    if (order.user_id !== null) {
        if (!userId) {
            return error(c, 'UNAUTHORIZED', '請先登入', 401);
        }
        const isOwner = order.user_id === userId;
        let isStoreOwnerOfOrder = false;
        if (userRole === 'store_owner') {
            const ownStore = queryFirst('SELECT id FROM stores WHERE user_id = ?', [userId]);
            if (ownStore && ownStore.id === order.store_id) {
                isStoreOwnerOfOrder = true;
            }
        }

        if (!isOwner && !isStoreOwnerOfOrder) {
            return error(c, 'UNAUTHORIZED', '無權查看此訂單', 403);
        }
    }

    return success(c, order);
});

// ============================================
// 3. POST /:id/complete — 完成訂單 / 取餐驗證（店家）
// ============================================
orders.post('/:id/complete', requireAuth(), requireRole('store_owner'), async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json();
    const { pickup_code } = body;

    if (!pickup_code) {
        return error(c, 'MISSING_FIELDS', '請提供取餐碼 pickup_code');
    }

    // 找到訂單
    const order = queryFirst(
        `SELECT o.*, p.name as product_name
         FROM orders o
         LEFT JOIN products p ON o.product_id = p.id
         WHERE o.id = ?`,
        [parseInt(id)]
    );

    if (!order) {
        return error(c, 'ORDER_NOT_FOUND', '找不到此訂單', 404);
    }

    if (order.status !== 'PAID') {
        return error(c, 'INVALID_STATUS', `訂單狀態為 ${order.status}，無法完成取餐`, 400);
    }

    // 驗證取餐碼
    if (order.pickup_code !== pickup_code) {
        return error(c, 'INVALID_PICKUP_CODE', '取餐碼不正確', 400);
    }

    transaction(() => {
        // 更新訂單為 COMPLETED
        query(
            `UPDATE orders SET status = 'COMPLETED', completed_at = datetime('now'),
             updated_at = datetime('now'), version = version + 1
             WHERE id = ?`,
            [order.id]
        );

        // 更新商品為 SOLD
        if (order.product_id) {
            query(
                `UPDATE products SET status = 'SOLD', updated_at = datetime('now') WHERE id = ?`,
                [order.product_id]
            );
        }
    });

    return success(c, {
        order_id: order.id,
        status: 'COMPLETED',
        product_name: order.product_name,
        message: '取餐完成',
    });
});

export default orders;
