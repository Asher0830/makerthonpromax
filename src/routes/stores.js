/**
 * 店家管理路由
 */

import { Hono } from 'hono';
import { query, queryFirst } from '../db/connection.js';
import { success, error } from '../utils/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const stores = new Hono();

/**
 * POST / — 建立店家資料（每位店主只能一間）
 */
stores.post('/', requireAuth(), requireRole('store_owner'), async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const { name, address, latitude, longitude, phone, description } = body;

    // 驗證必填欄位
    if (!name || !address || latitude == null || longitude == null) {
        return error(c, 'MISSING_FIELDS', '請填寫 name、address、latitude、longitude');
    }

    // 驗證座標合理性
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return error(c, 'INVALID_COORDINATES', '座標必須是數字');
    }

    // 檢查是否已有店家
    const existing = queryFirst('SELECT id FROM stores WHERE user_id = ?', [user.id]);
    if (existing) {
        return error(c, 'STORE_EXISTS', '您已經建立過店家，每位店主只能有一間店', 409);
    }

    const result = query(
        `INSERT INTO stores (user_id, name, description, address, latitude, longitude, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [user.id, name, description || null, address, latitude, longitude, phone || null]
    );

    const storeId = Number(result.meta.last_row_id);
    const store = queryFirst('SELECT * FROM stores WHERE id = ?', [storeId]);

    return success(c, { store }, 201);
});

/**
 * GET /me — 取得自己的店家資訊
 */
stores.get('/me', requireAuth(), requireRole('store_owner'), async (c) => {
    const user = c.get('user');

    const store = queryFirst('SELECT * FROM stores WHERE user_id = ?', [user.id]);
    if (!store) {
        return error(c, 'STORE_NOT_FOUND', '您尚未建立店家', 404);
    }

    return success(c, { store });
});

/**
 * PUT /me — 更新自己的店家資訊
 */
stores.put('/me', requireAuth(), requireRole('store_owner'), async (c) => {
    const user = c.get('user');

    const store = queryFirst('SELECT * FROM stores WHERE user_id = ?', [user.id]);
    if (!store) {
        return error(c, 'STORE_NOT_FOUND', '您尚未建立店家', 404);
    }

    const body = await c.req.json();
    const allowedFields = ['name', 'description', 'address', 'latitude', 'longitude', 'phone', 'is_active'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
        if (body[field] !== undefined) {
            updates.push(`${field} = ?`);
            values.push(body[field]);
        }
    }

    if (updates.length === 0) {
        return error(c, 'NO_UPDATES', '沒有提供要更新的欄位');
    }

    updates.push("updated_at = datetime('now')");
    values.push(store.id);

    query(
        `UPDATE stores SET ${updates.join(', ')} WHERE id = ?`,
        values
    );

    const updated = queryFirst('SELECT * FROM stores WHERE id = ?', [store.id]);
    return success(c, { store: updated });
});

/**
 * GET /:id — 取得特定店家資訊（消費者用，不需登入）
 */
stores.get('/:id', async (c) => {
    const { id } = c.req.param();

    const store = queryFirst('SELECT * FROM stores WHERE id = ?', [parseInt(id)]);
    if (!store) {
        return error(c, 'STORE_NOT_FOUND', '找不到該店家', 404);
    }

    return success(c, { store });
});

/**
 * GET /nearby — 取得附近的店家（消費者用，不需登入）
 * Query: lat, lng, radius (km, 預設 3)
 */
stores.get('/nearby', async (c) => {
    const lat = parseFloat(c.req.query('lat'));
    const lng = parseFloat(c.req.query('lng'));
    const radius = parseFloat(c.req.query('radius')) || 3;

    if (isNaN(lat) || isNaN(lng)) {
        return error(c, 'MISSING_COORDINATES', '請提供 lat 和 lng 查詢參數');
    }

    // 使用簡易距離公式：sqrt((lat1-lat2)^2 + (lng1-lng2)^2) * 111
    // 先取出所有活躍店家，在 SQL 層計算距離
    const { results: storesResult } = query(
        `SELECT s.*,
            (sqrt((s.latitude - ?) * (s.latitude - ?) + (s.longitude - ?) * (s.longitude - ?)) * 111) AS distance,
            (SELECT COUNT(*) FROM products p WHERE p.store_id = s.id AND p.status = 'AVAILABLE') AS product_count
         FROM stores s
         WHERE s.is_active = 1
           AND (sqrt((s.latitude - ?) * (s.latitude - ?) + (s.longitude - ?) * (s.longitude - ?)) * 111) <= ?
         ORDER BY distance ASC`,
        [lat, lat, lng, lng, lat, lat, lng, lng, radius]
    );

    return success(c, { stores: storesResult });
});

export default stores;
