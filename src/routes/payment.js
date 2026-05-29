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

export default payment;
