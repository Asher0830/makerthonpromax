/**
 * 資料庫連線抽象層
 * 使用 better-sqlite3 (原生 C binding SQLite)
 * 直接讀寫磁碟，無需手動 save，原子性寫入，安全可靠
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db = null;
let dbPath = null;

/**
 * 初始化資料庫（必須在啟動時呼叫一次）
 */
export async function initDB() {
    if (db) return db;

    dbPath = process.env.DB_PATH || join(__dirname, '../../data/foodd.db');

    // 確保 data 目錄存在
    const dataDir = dirname(dbPath);
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
    }

    const isNew = !existsSync(dbPath);

    // better-sqlite3 自動建立或載入既有資料庫
    db = new Database(dbPath);

    if (isNew) {
        console.log('[DB] 建立新資料庫:', dbPath);
    } else {
        console.log('[DB] 載入既有資料庫:', dbPath);
    }

    // 啟用效能最佳化 PRAGMA
    db.pragma('journal_mode = WAL');          // WAL 模式：並發讀寫效能提升 5-10 倍
    db.pragma('synchronous = NORMAL');        // 在 WAL 模式下 NORMAL 已足夠安全
    db.pragma('foreign_keys = ON');           // 啟用外鍵約束
    db.pragma('cache_size = -8000');          // 8MB 快取 (負數 = KB)
    db.pragma('busy_timeout = 5000');         // 鎖定等待 5 秒

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
 * 儲存資料庫到磁碟（相容性保留，better-sqlite3 自動寫入不需手動 save）
 */
export function saveDB() {
    // better-sqlite3 直接寫入磁碟，不需要手動存檔
    // 此函式保留以維持 API 相容性
}

/**
 * 強制立即儲存（相容性保留）
 */
export function saveDBSync() {
    // better-sqlite3 直接寫入磁碟，不需要手動存檔
}

/**
 * 初始化資料表
 */
export function initSchema() {
    const database = getDB();
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    database.exec(schema);
    console.log('[DB] 資料表初始化完成');
}

/**
 * 載入測試種子資料
 */
export function loadSeed() {
    const database = getDB();
    const seed = readFileSync(join(__dirname, 'seed.sql'), 'utf-8');

    // better-sqlite3 的 exec() 支援一次執行多條 SQL（以分號分隔）
    // 但為了相容 INSERT OR IGNORE 的錯誤容忍，仍逐條執行
    const statements = seed.split(';').filter(s => s.trim());
    for (const stmt of statements) {
        try {
            database.exec(stmt + ';');
        } catch (err) {
            // INSERT OR IGNORE 失敗時忽略（重複資料）
            if (!err.message.includes('UNIQUE constraint')) {
                console.warn('[DB WARNING] Seed warning:', err.message);
            }
        }
    }
    console.log('[DB] 測試資料載入完成');
}

/**
 * 查詢多筆資料（D1 相容介面）
 */
export function query(sql, params = []) {
    const database = getDB();

    if (sql.trimStart().toUpperCase().startsWith('SELECT')) {
        const stmt = database.prepare(sql);
        const results = stmt.all(...params);
        return { results };
    } else {
        const stmt = database.prepare(sql);
        const info = stmt.run(...params);

        return {
            results: [],
            meta: {
                changes: info.changes,
                last_row_id: info.lastInsertRowid
            }
        };
    }
}

/**
 * 取得單筆資料
 */
export function queryFirst(sql, params = []) {
    const database = getDB();
    const stmt = database.prepare(sql);
    const row = stmt.get(...params);
    return row || null;
}

/**
 * 執行事務（transaction）
 */
export function transaction(fn) {
    const database = getDB();
    const runInTransaction = database.transaction(fn);
    return runInTransaction();
}

/**
 * 關閉資料庫連線
 */
export function closeDB() {
    if (db) {
        // WAL checkpoint: 確保所有 WAL 日誌寫回主資料庫檔案
        try {
            db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (e) {
            // 忽略 checkpoint 錯誤
        }
        db.close();
        db = null;
    }
}
