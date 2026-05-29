/**
 * Hono 主程式
 * 跨平台共用：本地 Node.js + 未來 Cloudflare Workers
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Routes
import authRoutes from './routes/auth.js';
import storeRoutes from './routes/stores.js';
import productRoutes from './routes/products.js';
import machineRoutes from './routes/machines.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes from './routes/payment.js';
import debugRoutes from './routes/debug.js';

const app = new Hono();

// ============================================
// 全域中間件
// ============================================
app.use('*', logger());
app.use('/api/*', cors());

// ============================================
// API 路由
// ============================================
app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/stores', storeRoutes);
app.route('/api/v1/products', productRoutes);
app.route('/api/v1/machines', machineRoutes);
app.route('/api/v1/orders', orderRoutes);
app.route('/api/v1/payment', paymentRoutes);
// [C5 FIX] Debug 路由僅在非生產環境掛載
if (process.env.NODE_ENV !== 'production') {
    app.route('/api/v1/debug', debugRoutes);
}

// ============================================
// 健康檢查
// ============================================
app.get('/api/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '0.1.0'
    });
});

// ============================================
// 404 處理
// ============================================
app.notFound((c) => {
    return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: '找不到此路由' }
    }, 404);
});

// ============================================
// 全域錯誤處理
// ============================================
app.onError((err, c) => {
    console.error('[ERR] 未處理的錯誤:', err);
    return c.json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'production'
                ? '伺服器內部錯誤'
                : err.message
        }
    }, 500);
});

export default app;
