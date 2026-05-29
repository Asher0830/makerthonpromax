/**
 * 機台指令佇列服務 (HTTP Polling 架構)
 * 
 * [H4 FIX] 指令佇列持久化至 SQLite，防止伺服器重啟（含 --watch 自動重啟）丟失開門指令。
 * ESP32 每秒呼叫 GET /api/v1/machines/:machineId/pop-command 來取得待執行指令。
 * 
 * 優勢：
 *   - 零額外 Broker 依賴（不需安裝 Mosquitto / EMQX）
 *   - 完美相容 Cloudflare Workers 部署（純 HTTP）
 *   - 防火牆友善（僅使用標準 HTTP/HTTPS Port）
 *   - ESP32 斷線自癒（重連後自動恢復輪詢，無需管理長連接）
 *   - 指令持久化至 DB，伺服器重啟後不丟失
 */

import { query, queryFirst, transaction } from '../db/connection.js';

// 確保 pending_commands 表存在（首次 import 時建立）
try {
    query(`CREATE TABLE IF NOT EXISTS pending_commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id TEXT NOT NULL,
        action TEXT NOT NULL DEFAULT 'OPEN',
        door_index INTEGER NOT NULL,
        request_id TEXT,
        queued_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
} catch (err) {
    console.warn('[指令佇列] 建立 pending_commands 表時發生錯誤（可能已存在）:', err.message);
}

/**
 * 將開門指令推入指定機台的待執行佇列（持久化至 SQLite）
 * @param {string} machineId - 機台 ID
 * @param {number} doorIndex - 艙位編號 (1~12)
 * @param {string} requestId - 訂單識別碼（用於 ESP32 日誌追蹤）
 * @returns {boolean} 是否成功推入
 */
export async function sendOpenDoor(machineId, doorIndex, requestId) {
    query(
        `INSERT INTO pending_commands (machine_id, action, door_index, request_id, queued_at) VALUES (?, 'OPEN', ?, ?, datetime('now'))`,
        [machineId, doorIndex, requestId]
    );

    console.log(`[指令佇列] 已推入開門指令 → 機台: ${machineId}, 艙位: ${doorIndex}, 訂單: ${requestId}`);
    return true;
}

/**
 * 從指定機台的佇列中取出（彈出）最早的一筆待執行指令
 * ESP32 輪詢時呼叫此函式，取出後該指令即從佇列移除（防止重複開門）
 * @param {string} machineId - 機台 ID
 * @returns {object|null} 指令物件，或 null（無待執行指令）
 */
export function popCommand(machineId) {
    // 使用 transaction 確保 SELECT + DELETE 原子性
    const command = transaction(() => {
        const cmd = queryFirst(
            `SELECT id, action, door_index, request_id, queued_at FROM pending_commands WHERE machine_id = ? ORDER BY id ASC LIMIT 1`,
            [machineId]
        );
        if (!cmd) return null;

        query(`DELETE FROM pending_commands WHERE id = ?`, [cmd.id]);

        // 根據 request_id (如 order_123) 動態查詢訂單類型 (GACHA vs PURCHASE)
        let cmdType = 'OTHER';
        if (cmd.request_id && cmd.request_id.startsWith('order_')) {
            const orderIdStr = cmd.request_id.replace('order_', '');
            const orderId = parseInt(orderIdStr, 10);
            if (!isNaN(orderId)) {
                try {
                    const order = queryFirst('SELECT order_type FROM orders WHERE id = ?', [orderId]);
                    if (order) {
                        if (order.order_type === 'machine_gacha') {
                            cmdType = 'GACHA';
                        } else {
                            cmdType = 'PURCHASE';
                        }
                    }
                } catch (e) {
                    console.error('[指令佇列] 查詢訂單類型時發生錯誤:', e.message);
                }
            }
        }
        cmd.cmd_type = cmdType;
        return cmd;
    });

    if (command) {
        console.log(`[指令佇列] 已彈出指令 → 機台: ${machineId}, 動作: ${command.action}, 艙位: ${command.door_index}, 類型: ${command.cmd_type}`);
    }
    return command;
}

/**
 * 查看指定機台佇列中待執行指令數量（除錯用）
 * @param {string} machineId - 機台 ID
 * @returns {number} 待執行指令數
 */
export function getQueueLength(machineId) {
    const row = queryFirst(
        `SELECT COUNT(*) as cnt FROM pending_commands WHERE machine_id = ?`,
        [machineId]
    );
    return row ? row.cnt : 0;
}

// 保留 publishMQTT 的相容介面（若有其他模組呼叫）
export async function publishMQTT(topic, payload) {
    console.log('[指令佇列] publishMQTT 已棄用，請改用 sendOpenDoor + popCommand');
    console.log('[指令佇列] Topic:', topic, 'Payload:', JSON.stringify(payload));
    return true;
}
