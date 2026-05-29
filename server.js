/**
 * 本地 Node.js 開發伺服器入口
 * 啟動指令：npm run dev
 */

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import app from './src/app.js';
import { initDB, initSchema, loadSeed, closeDB, query } from './src/db/connection.js';
import { processTimeouts } from './src/services/inventory.js';

const PORT = process.env.PORT || 3000;

// ============================================
// 靜態檔案服務（前端頁面）
// ============================================
app.use('/tablet/*', serveStatic({ root: './public/' }));
app.use('/mobile/*', serveStatic({ root: './public/' }));
app.use('/debug/*', serveStatic({ root: './public/' }));
app.use('/assets/*', serveStatic({ root: './public/' }));

// ============================================
// 啟動流程
// ============================================
async function start() {
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('  惜食整合系統 — 本地開發伺服器');
    console.log('═══════════════════════════════════════');
    console.log('');

    // 1. 初始化資料庫
    await initDB();
    initSchema();

    // 1.5. 重置可能因意外中斷而被鎖定的機台狀態與預留艙位
    // 僅重置處於安全可救援狀態的機平（active_order 為空或已結束）
    try {
        query(`
            UPDATE machines
            SET status = 'IDLE', active_order_id = NULL
            WHERE active_order_id IS NULL
               OR active_order_id IN (
                   SELECT id FROM orders
                   WHERE status IN ('COMPLETED', 'CANCELLED', 'TIMEOUT_REFUNDED')
               )
        `);
        query(`
            UPDATE compartments
            SET status = 'STOCKED'
            WHERE status = 'RESERVED'
              AND (
                  -- 只有對應訂單已結束才釋放
                  compartment_id NOT IN (
                      SELECT compartment_id FROM orders
                      WHERE compartment_id IS NOT NULL
                        AND status NOT IN ('COMPLETED', 'CANCELLED', 'TIMEOUT_REFUNDED')
                  )
                  -- 或根本沒有訂單引用
                  OR NOT EXISTS (
                      SELECT 1 FROM orders WHERE compartment_id = compartments.id
                  )
              )
        `);
        console.log('[DB] 成功重置待救援的機台與艙位');
    } catch (err) {
        console.warn('[DB WARNING] 無法在啟動時自動重置機台狀態:', err.message);
    }

    // 2. 載入測試資料（開發環境）
    if (process.env.NODE_ENV !== 'production') {
        loadSeed();
    }

    // 3. 啟動超時檢查排程（每 30 秒）
    const timeoutTimer = setInterval(() => {
        try {
            processTimeouts();
        } catch (err) {
            console.error('⚠ 超時排程錯誤:', err.message);
        }
    }, 30000);

    // 4. 啟動 HTTP 伺服器
    serve({
        fetch: app.fetch,
        port: PORT,
    }, (info) => {
        console.log('');
        console.log(`[OK] 伺服器啟動成功！`);
        console.log(`[API]    API:     http://localhost:${info.port}/api/health`);
        console.log(`[MOBILE] 手機端:  http://localhost:${info.port}/mobile/`);
        console.log(`[TABLET] 平板端:  http://localhost:${info.port}/tablet/`);
        console.log('');
        console.log('[INFO] 測試帳號:');
        console.log('   消費者: consumer@test.com / test1234');
        console.log('   店家:   store@test.com / test1234');
        console.log('');
    });

    // 5. 優雅關閉
    process.on('SIGINT', () => {
        console.log('\n[INFO] 正在關閉伺服器...');
        clearInterval(timeoutTimer);
        closeDB();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        clearInterval(timeoutTimer);
        closeDB();
        process.exit(0);
    });
}

start().catch((err) => {
    console.error('[ERR] 啟動失敗:', err);
    process.exit(1);
});
