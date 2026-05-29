/**
 * 商品管理路由
 */

import { Hono } from 'hono';
import { query, queryFirst, transaction } from '../db/connection.js';
import { success, error } from '../utils/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const products = new Hono();

const VALID_CATEGORIES = ['bento', 'bread', 'vegetable', 'other'];
const VALID_SOURCES = ['map', 'machine'];

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
    const { name, category, original_price, selling_price, source, description, allergens, expires_at } = body;

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

    return success(c, { product }, 201);
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

    const whereClause = conditions.join(' AND ');

    let productsResult;

    if (source === 'map' && !isNaN(lat) && !isNaN(lng)) {
        // 地圖模式：join stores，計算距離，依距離排序
        const distanceExpr = `(sqrt((s.latitude - ${lat}) * (s.latitude - ${lat}) + (s.longitude - ${lng}) * (s.longitude - ${lng})) * 111)`;

        const { results } = query(
            `SELECT p.*,
                s.name AS store_name, s.latitude AS store_latitude, s.longitude AS store_longitude, s.address AS store_address,
                ${distanceExpr} AS distance
             FROM products p
             JOIN stores s ON p.store_id = s.id
             WHERE ${whereClause}
               AND s.is_active = 1
               AND ${distanceExpr} <= ?
             ORDER BY distance ASC`,
            [...params, radius]
        );
        productsResult = results;
    } else {
        // 一般模式或 machine
        const { results } = query(
            `SELECT p.*,
                s.name AS store_name, s.latitude AS store_latitude, s.longitude AS store_longitude, s.address AS store_address
             FROM products p
             JOIN stores s ON p.store_id = s.id
             WHERE ${whereClause}
               AND s.is_active = 1
             ORDER BY p.created_at DESC`,
            params
        );
        productsResult = results;
    }

    // 附加過敏原資訊
    for (const product of productsResult) {
        product.allergens = getAllergens(product.id);
    }

    return success(c, { products: productsResult });
});

/**
 * GET /:id — 商品詳情
 */
products.get('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);

    const product = queryFirst(
        `SELECT p.*,
            s.name AS store_name, s.latitude AS store_latitude, s.longitude AS store_longitude,
            s.address AS store_address, s.phone AS store_phone
         FROM products p
         JOIN stores s ON p.store_id = s.id
         WHERE p.id = ?`,
        [id]
    );

    if (!product) {
        return error(c, 'PRODUCT_NOT_FOUND', '找不到此商品', 404);
    }

    product.allergens = getAllergens(id);

    return success(c, { product });
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
    const allowedFields = ['name', 'category', 'original_price', 'selling_price', 'description', 'status', 'expires_at'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
        if (body[field] !== undefined) {
            updates.push(`${field} = ?`);
            values.push(body[field]);
        }
    }

    // 驗證 category（如有提供）
    if (body.category && !VALID_CATEGORIES.includes(body.category)) {
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
            query('DELETE FROM product_allergens WHERE product_id = ?', [id]);
            for (const allergen of body.allergens) {
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

    transaction(() => {
        query('DELETE FROM product_allergens WHERE product_id = ?', [id]);
        query('DELETE FROM products WHERE id = ?', [id]);
    });

    return success(c, { message: '商品已刪除' });
});

export default products;
