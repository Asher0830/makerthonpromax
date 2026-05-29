const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = path.join(__dirname, 'game.db');
const dbDir = path.dirname(dbPath);

// 確保 database 目錄存在
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// 建立或連線 SQLite 資料庫
const db = new DatabaseSync(dbPath);

// 初始化資料庫 Schema 與 Seed
function initDb() {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const seedPath = path.join(__dirname, 'seed.sql');

        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            db.exec(schemaSql);
        }

        if (fs.existsSync(seedPath)) {
            const seedSql = fs.readFileSync(seedPath, 'utf8');
            db.exec(seedSql);
        }

        console.log('SQLite 資料庫成功初始化，已載入 Schema 與 靜態商店種子資料。');
    } catch (error) {
        console.error('資料庫初始化失敗:', error);
        throw error;
    }
}

module.exports = {
    db,
    initDb
};
