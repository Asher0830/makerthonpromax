/**
 * 資料庫初始化腳本
 * 用法：npm run db:init
 */

import { initDB, initSchema, closeDB } from './connection.js';

async function main() {
    await initDB();
    initSchema();
    console.log('✅ 資料庫初始化完成');
    closeDB();
}

main().catch(console.error);
