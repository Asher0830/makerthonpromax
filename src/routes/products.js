/**
 * 商品管理路由
 */

import { Hono } from 'hono';
import { query, queryFirst, transaction } from '../db/connection.js';
import { success, error } from '../utils/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { verifyToken } from '../utils/jwt.js';

const products = new Hono();

const VALID_CATEGORIES = ['bento', 'bread', 'vegetable', 'other'];
const VALID_SOURCES = ['map', 'machine'];
const ALLERGEN_ALIASES = {
    pork: 'pork', '豬肉': 'pork',
    beef: 'beef', '牛肉': 'beef',
    chicken: 'chicken', '雞肉': 'chicken',
    duck: 'duck', '鴨肉': 'duck',
    lamb: 'lamb', '羊肉': 'lamb',
    seafood: 'seafood', '海鮮': 'seafood', '魚': 'seafood', '蝦': 'seafood', '蟹': 'seafood', '貝類': 'seafood',
    egg: 'egg', '蛋': 'egg',
    milk: 'milk', '牛奶': 'milk',
    peanut: 'peanut', '花生': 'peanut',
    treenut: 'treenut', '堅果': 'treenut',
    wheat: 'wheat', '麩質': 'wheat',
    soy: 'soy', '大豆': 'soy',
    sesame: 'sesame', '芝麻': 'sesame',
};

function normalizeAllergen(value) {
    if (!value) return null;
    const key = String(value).trim();
    return ALLERGEN_ALIASES[key] || ALLERGEN_ALIASES[key.toLowerCase()] || null;
}

function normalizeAllergens(allergens = []) {
    if (!Array.isArray(allergens)) return [];
    return allergens.map(normalizeAllergen).filter(Boolean);
}

function shapeProductRow(row) {
    if (!row) return row;

    const storeId = row.store_id ?? row.storeId ?? null;
    const storeName = row.store_name ?? row.storeName ?? null;
    const storeLatitude = row.store_latitude ?? row.storeLatitude ?? null;
    const storeLongitude = row.store_longitude ?? row.storeLongitude ?? null;
    const storeAddress = row.store_address ?? row.storeAddress ?? null;

    const originalPrice = row.original_price ?? row.originalPrice ?? row.price ?? 0;
    const sellingPrice = row.selling_price ?? row.sellingPrice ?? row.price ?? 0;

    return {
        ...row,
        storeId,
        storeName,
        storeLatitude,
        storeLongitude,
        storeAddress,
        originalPrice,
        sellingPrice,
        price: sellingPrice,
        lat: row.lat ?? storeLatitude,
        lng: row.lng ?? storeLongitude,
        store: storeId ? {
            id: storeId,
            name: storeName,
            lat: storeLatitude,
            lng: storeLongitude,
            address: storeAddress,
        } : row.store || null,
        expiresAt: row.expires_at ? (row.expires_at.includes('Z') ? row.expires_at : row.expires_at.replace(' ', 'T') + 'Z') : (row.expiresAt ?? null),
        createdAt: row.created_at ?? row.createdAt ?? null,
        updatedAt: row.updated_at ?? row.updatedAt ?? null,
    };
}

function getOptionalUser(c) {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return verifyToken(authHeader.slice(7));
}

/**
 * 取得商品的過敏原列表
 */
function getAllergens(productId) {
    const { results } = query(
        'SELECT allergen FROM product_allergens WHERE product_id = ?',
        [productId]
    );
    return results.map(r => r.allergen);
}

/**
 * POST / — 新增商品（store_owner）
 */
products.post('/', requireAuth(), requireRole('store_owner'), async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const name = body.name?.trim();
    const category = body.category;
    const original_price = body.original_price ?? body.originalPrice;
    const selling_price = body.selling_price ?? body.sellingPrice;
    const source = body.source;
    const description = body.description;
    const allergens = normalizeAllergens(body.allergens);
    // [M15 FIX] 正規化日期格式為 SQLite 可比較的格式
    let expires_at = body.expires_at ?? body.expiresAt;
    if (expires_at) {
        try {
            expires_at = new Date(expires_at).toISOString().replace('T', ' ').replace('Z', '');
        } catch (e) {
            // 格式無法解析時保持原值
        }
    }

    // 驗證必填欄位
    if (!name || !category || original_price == null || selling_price == null || !source) {
        return error(c, 'MISSING_FIELDS', '請填寫 name、category、original_price、selling_price、source');
    }

    // 驗證 category
    if (!VALID_CATEGORIES.includes(category)) {
        return error(c, 'INVALID_CATEGORY', `category 必須是 ${VALID_CATEGORIES.join(', ')} 之一`);
    }

    // 驗證 source
    if (!VALID_SOURCES.includes(source)) {
        return error(c, 'INVALID_SOURCE', `source 必須是 ${VALID_SOURCES.join(', ')} 之一`);
    }

    // 查找使用者的店家
    const store = queryFirst('SELECT id FROM stores WHERE user_id = ?', [user.id]);
    if (!store) {
        return error(c, 'STORE_NOT_FOUND', '請先建立店家資料', 404);
    }

    // 使用 transaction 同時寫入商品和過敏原
    const productId = transaction(() => {
        const result = query(
            `INSERT INTO products (store_id, name, category, original_price, selling_price, description, source, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [store.id, name, category, original_price, selling_price, description || null, source, expires_at || null]
        );

        const newId = Number(result.meta.last_row_id);

        // 寫入過敏原
        if (allergens && Array.isArray(allergens) && allergens.length > 0) {
            for (const allergen of allergens) {
                query(
                    'INSERT INTO product_allergens (product_id, allergen) VALUES (?, ?)',
                    [newId, allergen]
                );
            }
        }

        return newId;
    });

    const product = queryFirst('SELECT * FROM products WHERE id = ?', [productId]);
    product.allergens = getAllergens(productId);

    return success(c, { product: shapeProductRow(product) }, 201);
});

/**
 * GET / — 列出商品
 * Query: source (map/machine), lat, lng, radius, category, status
 */
products.get('/', async (c) => {
    const source = c.req.query('source');
    const lat = parseFloat(c.req.query('lat'));
    const lng = parseFloat(c.req.query('lng'));
    const radius = parseFloat(c.req.query('radius')) || 3;
    const category = c.req.query('category');
    const status = c.req.query('status') || 'AVAILABLE';
    const store_id = c.req.query('store_id');
    const user = getOptionalUser(c);
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const hideExpired = source === 'map' || (store_id && (!user || user.role !== 'store_owner'));

    const conditions = ['p.status = ?'];
    const params = [status];

    if (source) {
        conditions.push('p.source = ?');
        params.push(source);
    }

    if (category) {
        conditions.push('p.category = ?');
        params.push(category);
    }

    if (store_id) {
        conditions.push('p.store_id = ?');
        params.push(parseInt(store_id, 10));
    }

    const whereClause = conditions.join(' AND ');
    const expirationClause = hideExpired ? ' AND (p.expires_at IS NULL OR p.expires_at > ?)' : '';

    let productsResult;

    if (source === 'map' && !isNaN(lat) && !isNaN(lng)) {
        // [M8 FIX] 加入 cos(lat) 修正經度距離
        const cosLat = Math.cos(lat * Math.PI / 180);
        const distanceExpr = `(sqrt((s.latitude - ${lat}) * (s.latitude - ${lat}) + (s.longitude - ${lng}) * (s.longitude - ${lng}) * ${cosLat} * ${cosLat}) * 111)`;
        const queryParams = [...params];

        if (hideExpired) {
            queryParams.push(now);
        }

        const { results } = query(
            `SELECT p.*,
                s.id AS store_id,
                s.name AS store_name, s.latitude AS store_latitude, s.longitude AS store_longitude, s.address AS store_address,
                ${distanceExpr} AS distance
             FROM products p
             JOIN stores s ON p.store_id = s.id
             WHERE ${whereClause}
               ${expirationClause}
               AND s.is_active = 1
               AND ${distanceExpr} <= ?
             ORDER BY distance ASC`,
            [...queryParams, radius]
        );
        productsResult = results;
    } else {
        // 一般模式或 machine
        const queryParams = [...params];

        if (hideExpired) {
            queryParams.push(now);
        }

        const { results } = query(
            `SELECT p.*,
                s.id AS store_id,
                s.name AS store_name, s.latitude AS store_latitude, s.longitude AS store_longitude, s.address AS store_address
             FROM products p
             JOIN stores s ON p.store_id = s.id
             WHERE ${whereClause}
               ${expirationClause}
               AND s.is_active = 1
             ORDER BY p.created_at DESC`,
            queryParams
        );
        productsResult = results;
    }

    // 附加過敏原資訊
    for (const product of productsResult) {
        product.allergens = getAllergens(product.id);
    }

    productsResult = productsResult.map(shapeProductRow);

    return success(c, { products: productsResult });
});

/**
 * GET /:id — 商品詳情
 */
products.get('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const user = getOptionalUser(c);

    const product = queryFirst(
        `SELECT p.*,
            s.id AS store_id,
            s.name AS store_name, s.latitude AS store_latitude, s.longitude AS store_longitude,
            s.address AS store_address, s.phone AS store_phone, s.user_id AS store_user_id
         FROM products p
         JOIN stores s ON p.store_id = s.id
         WHERE p.id = ?`,
        [id]
    );

    if (!product) {
        return error(c, 'PRODUCT_NOT_FOUND', '找不到此商品', 404);
    }

    const expiresAt = product.expires_at ? new Date(product.expires_at).getTime() : null;
    const isExpired = Number.isFinite(expiresAt) && expiresAt <= Date.now();
    const isStoreOwner = user && user.role === 'store_owner' && user.id === product.store_user_id;

    if (isExpired && !isStoreOwner) {
        return error(c, 'PRODUCT_NOT_FOUND', '找不到此商品', 404);
    }

    product.allergens = getAllergens(id);

    return success(c, { product: shapeProductRow(product) });
});

/**
 * PUT /:id — 更新商品（限擁有者）
 */
products.put('/:id', requireAuth(), requireRole('store_owner'), async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'), 10);

    // 確認是商品擁有者
    const product = queryFirst(
        `SELECT p.* FROM products p
         JOIN stores s ON p.store_id = s.id
         WHERE p.id = ? AND s.user_id = ?`,
        [id, user.id]
    );

    if (!product) {
        return error(c, 'PRODUCT_NOT_FOUND', '找不到此商品或您無權修改', 404);
    }

    const body = await c.req.json();
    const normalizedBody = {
        ...body,
        original_price: body.original_price ?? body.originalPrice,
        selling_price: body.selling_price ?? body.sellingPrice,
        expires_at: body.expires_at ?? body.expiresAt,
    };
    const allowedFields = ['name', 'category', 'original_price', 'selling_price', 'description', 'status', 'expires_at'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
        if (normalizedBody[field] !== undefined) {
            updates.push(`${field} = ?`);
            values.push(normalizedBody[field]);
        }
    }

    // 驗證 category（如有提供）
    if (normalizedBody.category && !VALID_CATEGORIES.includes(normalizedBody.category)) {
        return error(c, 'INVALID_CATEGORY', `category 必須是 ${VALID_CATEGORIES.join(', ')} 之一`);
    }

    transaction(() => {
        if (updates.length > 0) {
            updates.push("updated_at = datetime('now')");
            values.push(id);
            query(
                `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }

        // 更新過敏原（如有提供）
        if (body.allergens && Array.isArray(body.allergens)) {
            const normalizedAllergens = normalizeAllergens(body.allergens);
            query('DELETE FROM product_allergens WHERE product_id = ?', [id]);
            for (const allergen of normalizedAllergens) {
                query(
                    'INSERT INTO product_allergens (product_id, allergen) VALUES (?, ?)',
                    [id, allergen]
                );
            }
        }
    });

    const updated = queryFirst('SELECT * FROM products WHERE id = ?', [id]);
    updated.allergens = getAllergens(id);

    return success(c, { product: updated });
});

/**
 * DELETE /:id — 刪除商品（限擁有者）
 */
products.delete('/:id', requireAuth(), requireRole('store_owner'), async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'), 10);

    // 確認是商品擁有者
    const product = queryFirst(
        `SELECT p.id FROM products p
         JOIN stores s ON p.store_id = s.id
         WHERE p.id = ? AND s.user_id = ?`,
        [id, user.id]
    );

    if (!product) {
        return error(c, 'PRODUCT_NOT_FOUND', '找不到此商品或您無權刪除', 404);
    }

    // 確認沒有正在進行中的訂單引用此商品
    const activeOrder = queryFirst(
        `SELECT id FROM orders WHERE product_id = ?
         AND status NOT IN ('COMPLETED', 'TIMEOUT_REFUNDED', 'CANCELLED') LIMIT 1`,
        [id]
    );
    if (activeOrder) {
        return error(c, 'PRODUCT_HAS_ACTIVE_ORDER', '此商品有尚未完成的訂單，無法刪除', 400);
    }

    transaction(() => {
        query('DELETE FROM product_allergens WHERE product_id = ?', [id]);
        query('DELETE FROM products WHERE id = ?', [id]);
    });

    return success(c, { message: '商品已刪除' });
});

export default products;
