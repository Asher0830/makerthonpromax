/**
 * 庫存管理服務
 * 處理庫存預留、釋放、超時退款
 */

import { query, queryFirst, transaction } from '../db/connection.js';

const GACHA_TIMEOUT_MINUTES = parseInt(process.env.GACHA_TIMEOUT_MINUTES || '5');
const POINTS_PER_DOLLAR = parseInt(process.env.POINTS_PER_DOLLAR || '1');

/**
 * 預留艙位（付款成功時呼叫）
 */
export function reserveCompartment(compartmentId) {
    const result = query(
        `UPDATE compartments SET status = 'RESERVED' WHERE id = ? AND status = 'STOCKED'`,
        [compartmentId]
    );
    return result.meta.changes > 0;
}

/**
 * 標記艙位已出餐
 */
export function dispenseCompartment(compartmentId) {
    query(
        `UPDATE compartments SET status = 'DISPENSED' WHERE id = ? AND status = 'RESERVED'`,
        [compartmentId]
    );
}

/**
 * 釋放艙位（超時退款時呼叫）
 */
export function releaseCompartment(compartmentId) {
    query(
        `UPDATE compartments SET status = 'STOCKED' WHERE id = ? AND status = 'RESERVED'`,
        [compartmentId]
    );
}

/**
 * 計算點數
 */
export function calculatePoints(amount) {
    return Math.floor(amount * POINTS_PER_DOLLAR);
}

/**
 * 發放點數給使用者
 */
export function awardPoints(userId, points) {
    query(
        `UPDATE users SET points = points + ?, updated_at = datetime('now') WHERE id = ?`,
        [points, userId]
    );
}

/**
 * 處理超時訂單（定期排程呼叫）
 */
export function processTimeouts() {
    const now = new Date().toISOString();

    // 找出所有超時的 WAITING_FOR_TRIGGER 或 PENDING 訂單
    const { results: timedOut } = query(`
                SELECT id, machine_id, compartment_id, product_id, order_type, amount, user_id, status
        FROM orders
        WHERE (status = 'WAITING_FOR_TRIGGER' OR status = 'PENDING')
          AND timeout_at < ?
    `, [now]);

    for (const order of timedOut) {
        // [H10 FIX] 每筆訂單處理包在 transaction 中，防止部分更新
        transaction(() => {
            const originalStatus = order.status;
            const newStatus = originalStatus === 'PENDING' ? 'CANCELLED' : 'TIMEOUT_REFUNDED';
            query(
                `UPDATE orders SET status = ?, updated_at = datetime('now'), version = version + 1 WHERE id = ?`,
                [newStatus, order.id]
            );

            // 重設機台狀態
            query(
                `UPDATE machines SET status = 'IDLE', active_order_id = NULL WHERE id = ? AND active_order_id = ?`,
                [order.machine_id, order.id]
            );

            // 釋放艙位（如果有預留的話）
            if (order.compartment_id) {
                releaseCompartment(order.compartment_id);
            }

            // 地圖導購的商品會在下單時先標記 RESERVED，超時未付款時改回 AVAILABLE
            if (order.order_type === 'map_purchase' && order.product_id) {
                query(
                    `UPDATE products SET status = 'AVAILABLE', updated_at = datetime('now') WHERE id = ?`,
                    [order.product_id]
                );
            }

            const logMsg = originalStatus === 'PENDING' ? '未付款取消' : '超時退款';
            console.log(`[TIMEOUT] 訂單 #${order.id} ${logMsg}（機台 ${order.machine_id}）`);
        });
    }

    if (timedOut.length > 0) {
        console.log(`[TIMEOUT] 共處理 ${timedOut.length} 筆超時/未付款釋放`);
    }

    // 自動過期商品處理 (expires_at 小於當前時間且狀態為 AVAILABLE)
    const nowLocal = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const { results: expiredProducts } = query(`
        SELECT id, name, expires_at 
        FROM products 
        WHERE status = 'AVAILABLE' 
          AND expires_at IS NOT NULL 
          AND expires_at < ?
    `, [nowLocal]);

    for (const prod of expiredProducts) {
        transaction(() => {
            query(
                `UPDATE products SET status = 'EXPIRED', updated_at = datetime('now') WHERE id = ?`,
                [prod.id]
            );
            console.log(`[EXPIRATION] 商品 #${prod.id} (${prod.name}) 已到期自動報銷 (過期時間: ${prod.expires_at})`);
        });
    }

    return timedOut.length + expiredProducts.length;
}

/**
 * 產生取餐碼（6碼英數）[M7 FIX] 加長至 6 碼降低碰撞機率
 */
export function generatePickupCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字元
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
