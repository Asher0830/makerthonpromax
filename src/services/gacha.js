/**
 * 盲盒抽獎演算法
 */

import { query, queryFirst } from '../db/connection.js';

/**
 * 取得機台可抽獎的商品池（已排除過敏原、商品類別）
 * @param {string} machineId - 機台 ID
 * @param {string[]} excludedAllergens - 排除的過敏原
 * @param {string|null} category - 商品類別篩選 ('bento', 'bread', etc.)
 * @returns {{ pool: Array, avgPrice: number }}
 */
export function getFilteredPool(machineId, excludedAllergens = [], category = null) {
    // 取得所有已入庫的艙位商品
    const { results: stocked } = query(`
        SELECT
            c.id as compartment_id,
            c.index_num,
            p.id as product_id,
            p.name,
            p.category,
            p.selling_price,
            p.original_price
        FROM compartments c
        JOIN products p ON c.product_id = p.id
        WHERE c.machine_id = ?
          AND c.status = 'STOCKED'
          AND p.status = 'AVAILABLE'
    `, [machineId]);

    if (stocked.length === 0) {
        return { pool: [], avgPrice: 0 };
    }

    let currentPool = stocked;

    // 取得有過敏原標籤的商品 ID
    if (excludedAllergens.length > 0) {
        const placeholders = excludedAllergens.map(() => '?').join(',');
        const { results: allergenic } = query(`
            SELECT DISTINCT product_id
            FROM product_allergens
            WHERE allergen IN (${placeholders})
        `, excludedAllergens);

        const allergenicIds = new Set(allergenic.map(r => r.product_id));
        currentPool = currentPool.filter(item => !allergenicIds.has(item.product_id));
    }

    // 篩選商品類別（便當與麵包分開抽獎）
    if (category) {
        currentPool = currentPool.filter(item => item.category === category);
    }

    if (currentPool.length === 0) {
        return { pool: [], avgPrice: 0 };
    }

    const avgPrice = currentPool.reduce((sum, item) => sum + item.selling_price, 0) / currentPool.length;

    return {
        pool: currentPool,
        avgPrice: Math.round(avgPrice * 100) / 100
    };
}

/**
 * 從池中隨機抽獎
 * @param {Array} pool - 可抽獎商品池
 * @returns {object} 抽中的商品
 */
export function drawFromPool(pool) {
    if (pool.length === 0) {
        throw new Error('池中無商品可抽');
    }
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
}
