import { Hono } from 'hono';
import { query, queryFirst, transaction, initSchema, loadSeed } from '../db/connection.js';

const debug = new Hono();

// 1. GET /status — 取得系統完整調試狀態
debug.get('/status', async (c) => {
    const machines = query('SELECT * FROM machines').results;
    const compartments = query('SELECT c.*, p.name as product_name, p.selling_price as product_price FROM compartments c LEFT JOIN products p ON c.product_id = p.id').results;
    const products = query('SELECT * FROM products ORDER BY id DESC').results;
    const orders = query('SELECT o.*, p.name as product_name FROM orders o LEFT JOIN products p ON o.product_id = p.id ORDER BY o.id DESC').results;
    const sessions = query('SELECT * FROM sessions ORDER BY id DESC').results;

    return c.json({
        success: true,
        data: { machines, compartments, products, orders, sessions }
    });
});

// 2. POST /machine/state — 強制修改機台狀態
debug.post('/machine/state', async (c) => {
    const body = await c.req.json();
    const { machineId, status, activeOrderId } = body;

    query(
        'UPDATE machines SET status = ?, active_order_id = ? WHERE id = ?',
        [status, activeOrderId || null, machineId]
    );

    return c.json({ success: true, message: `機台 ${machineId} 狀態已變更為 ${status}` });
});

// 3. POST /machine/telemetry — 模擬上報溫濕度
debug.post('/machine/telemetry', async (c) => {
    const body = await c.req.json();
    const { machineId, temperature, humidity } = body;

    const telemetry = JSON.stringify({ temperature, humidity, timestamp: new Date().toISOString() });
    query(
        "UPDATE machines SET last_telemetry = ?, last_seen_at = datetime('now') WHERE id = ?",
        [telemetry, machineId]
    );

    return c.json({ success: true, message: `機台 ${machineId} 溫濕度已上報` });
});

// 4. POST /machine/compartment/stock — 艙位直接補貨/清空
debug.post('/machine/compartment/stock', async (c) => {
    const body = await c.req.json();
    const { machineId, indexNum, productId } = body; // productId為null代表清空

    if (productId) {
        query(
            "UPDATE compartments SET status = 'STOCKED', product_id = ?, stocked_at = datetime('now') WHERE machine_id = ? AND index_num = ?",
            [productId, machineId, indexNum]
        );
    } else {
        query(
            "UPDATE compartments SET status = 'EMPTY', product_id = NULL, stocked_at = NULL WHERE machine_id = ? AND index_num = ?",
            [machineId, indexNum]
        );
    }

    return c.json({ success: true, message: `艙位 ${indexNum} 已變更` });
});

// 5. POST /machine/trigger-knob — 模擬轉動旋鈕 (ESP32 trigger)
debug.post('/machine/trigger-knob', async (c) => {
    const body = await c.req.json();
    const { machineId } = body;

    const machine = queryFirst('SELECT * FROM machines WHERE id = ?', [machineId]);
    if (!machine) {
        return c.json({ success: false, error: '機台不存在' }, 404);
    }

    try {
        const response = await fetch(`http://localhost:${process.env.PORT || 3000}/api/v1/machines/trigger`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                machine_id: machineId,
                action: 'KNOB_TURNED',
                secret_key: machine.secret_key
            })
        });
        const resData = await response.json();
        return c.json({ success: true, response: resData });
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

// 6. POST /db/reset — 重設並重新 Seed 資料庫
debug.post('/db/reset', async (c) => {
    try {
        transaction(() => {
            // 清空所有既有資料表以確保徹底重置，避免 INSERT OR IGNORE 被忽略
            try {
                query('DELETE FROM orders');
                query('DELETE FROM product_allergens');
                query('DELETE FROM compartments');
                query('DELETE FROM products');
                query('DELETE FROM stores');
                query('DELETE FROM sessions');
                query('DELETE FROM users');
                query('DELETE FROM sqlite_sequence'); // 重設自增 ID 數值
            } catch (e) {
                // 如果表尚未建立，忽略錯誤
            }
            initSchema();
            loadSeed();
        });
        return c.json({ success: true, message: '資料庫已成功重置與初始化種子資料' });
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

// 7. POST /products/create — 快速產生 5 筆調試商品
debug.post('/products/create', async (c) => {
    const mockProducts = [
        { name: '經典照燒雞腿便當', category: 'bento', original_price: 120, selling_price: 60, source: 'machine' },
        { name: '香烤鯖魚便當', category: 'bento', original_price: 130, selling_price: 65, source: 'machine' },
        { name: '法式明太子長棍', category: 'bread', original_price: 80, selling_price: 40, source: 'machine' },
        { name: '黃金波蘿麵包', category: 'bread', original_price: 45, selling_price: 20, source: 'machine' },
        { name: '溫室有機高麗菜', category: 'vegetable', original_price: 70, selling_price: 35, source: 'map' }
    ];

    transaction(() => {
        for (const p of mockProducts) {
            query(
                `INSERT INTO products (store_id, name, category, original_price, selling_price, source, status)
                 VALUES (1, ?, ?, ?, ?, ?, 'AVAILABLE')`,
                [p.name, p.category, p.original_price, p.selling_price, p.source]
            );
        }
    });

    return c.json({ success: true, message: '已成功產生 5 筆測試商品' });
});

// 8. POST /orders/complete — 直接完成/核銷訂單
debug.post('/orders/complete', async (c) => {
    const body = await c.req.json();
    const { orderId } = body;

    query(
        "UPDATE orders SET status = 'COMPLETED', completed_at = datetime('now') WHERE id = ?",
        [orderId]
    );

    return c.json({ success: true, message: `訂單 ${orderId} 已變更為已完成` });
});

export default debug;
