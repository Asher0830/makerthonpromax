/**
 * 資料庫連線抽象層
 * 本地開發：sql.js（純 JS SQLite，不需要 C++ 編譯）
 * 未來部署：替換為 Cloudflare D1 binding
 */

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db = null;
let dbPath = null;
let saveTimer = null;

/**
 * 初始化資料庫（必須在啟動時呼叫一次）
 */
export async function initDB() {
    if (db) return db;

    const SQL = await initSqlJs();
    dbPath = process.env.DB_PATH || join(__dirname, '../../data/foodd.db');

    // 確保 data 目錄存在
    const dataDir = dirname(dbPath);
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
    }

    // 載入既有資料庫或建立新的
    if (existsSync(dbPath)) {
        const buffer = readFileSync(dbPath);
        db = new SQL.Database(buffer);
        console.log('📂 載入既有資料庫:', dbPath);
    } else {
        db = new SQL.Database();
        console.log('🆕 建立新資料庫:', dbPath);
    }

    // 啟用外鍵約束
    db.run('PRAGMA foreign_keys = ON;');

    return db;
}

/**
 * 取得資料庫實例
 */
export function getDB() {
    if (!db) {
        throw new Error('資料庫尚未初始化，請先呼叫 initDB()');
    }
    return db;
}

/**
 * 儲存資料庫到磁碟（自動防抖，避免頻繁寫入）
 */
export function saveDB() {
    if (!db || !dbPath) return;

    // 防抖：500ms 內多次呼叫只執行一次
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        const data = db.export();
        writeFileSync(dbPath, Buffer.from(data));
    }, 500);
}

/**
 * 強制立即儲存（用於關閉時）
 */
export function saveDBSync() {
    if (!db || !dbPath) return;
    if (saveTimer) clearTimeout(saveTimer);
    const data = db.export();
    writeFileSync(dbPath, Buffer.from(data));
}

/**
 * 初始化資料表
 */
export function initSchema() {
    const database = getDB();
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    database.run(schema);
    saveDB();
    console.log('✅ 資料表初始化完成');
}

/**
 * 載入測試種子資料
 */
export function loadSeed() {
    const database = getDB();
    const seed = readFileSync(join(__dirname, 'seed.sql'), 'utf-8');
    // sql.js 不支援一次執行多條 SQL，需要逐條執行
    const statements = seed.split(';').filter(s => s.trim());
    for (const stmt of statements) {
        try {
            database.run(stmt + ';');
        } catch (err) {
            // INSERT OR IGNORE 失敗時忽略（重複資料）
            if (!err.message.includes('UNIQUE constraint')) {
                console.warn('⚠ Seed warning:', err.message);
            }
        }
    }
    saveDB();
    console.log('✅ 測試資料載入完成');
}

/**
 * 查詢多筆資料（D1 相容介面）
 */
export function query(sql, params = []) {
    const database = getDB();

    if (sql.trimStart().toUpperCase().startsWith('SELECT')) {
        const stmt = database.prepare(sql);
        stmt.bind(params);

        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return { results };
    } else {
        database.run(sql, params);
        const changes = database.getRowsModified();
        // 取得 last insert rowid
        const lastIdResult = database.exec('SELECT last_insert_rowid() as id');
        const lastId = lastIdResult.length > 0 ? lastIdResult[0].values[0][0] : 0;

        saveDB();
        return {
            results: [],
            meta: {
                changes,
                last_row_id: lastId
            }
        };
    }
}

/**
 * 取得單筆資料
 */
export function queryFirst(sql, params = []) {
    const { results } = query(sql, params);
    return results.length > 0 ? results[0] : null;
}

/**
 * 執行事務（transaction）
 */
export function transaction(fn) {
    const database = getDB();
    database.run('BEGIN TRANSACTION;');
    try {
        const result = fn();
        database.run('COMMIT;');
        saveDB();
        return result;
    } catch (err) {
        database.run('ROLLBACK;');
        throw err;
    }
}

/**
 * 關閉資料庫連線
 */
export function closeDB() {
    if (db) {
        saveDBSync();
        db.close();
        db = null;
    }
}
