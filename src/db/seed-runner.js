/**
 * 種子資料載入腳本
 * 用法：npm run db:seed
 */

import { initDB, initSchema, loadSeed, closeDB } from './connection.js';

async function main() {
    await initDB();
    initSchema();
    loadSeed();
    console.log('✅ 測試資料載入完成');
    closeDB();
}

main().catch(console.error);
