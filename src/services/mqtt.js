/**
 * 機台指令佇列服務 (HTTP Polling 架構)
 * 
 * 取代原本的 MQTT 推送機制，改用伺服器端記憶體佇列 + ESP32 HTTP 輪詢。
 * ESP32 每秒呼叫 GET /api/v1/machines/:machineId/pop-command 來取得待執行指令。
 * 
 * 優勢：
 *   - 零額外 Broker 依賴（不需安裝 Mosquitto / EMQX）
 *   - 完美相容 Cloudflare Workers 部署（純 HTTP）
 *   - 防火牆友善（僅使用標準 HTTP/HTTPS Port）
 *   - ESP32 斷線自癒（重連後自動恢復輪詢，無需管理長連接）
 */

// 機台指令佇列：machineId → command[]
const commandQueues = new Map();

/**
 * 將開門指令推入指定機台的待執行佇列
 * @param {string} machineId - 機台 ID
 * @param {number} doorIndex - 艙位編號 (1~12)
 * @param {string} requestId - 訂單識別碼（用於 ESP32 日誌追蹤）
 * @returns {boolean} 是否成功推入
 */
export async function sendOpenDoor(machineId, doorIndex, requestId) {
    const command = {
        action: 'OPEN',
        door_index: doorIndex,
        request_id: requestId,
        queued_at: new Date().toISOString(),
    };

    if (!commandQueues.has(machineId)) {
        commandQueues.set(machineId, []);
    }

    commandQueues.get(machineId).push(command);

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
    const queue = commandQueues.get(machineId);
    if (!queue || queue.length === 0) {
        return null;
    }
    const command = queue.shift();
    console.log(`[指令佇列] 已彈出指令 → 機台: ${machineId}, 動作: ${command.action}, 艙位: ${command.door_index}`);
    return command;
}

/**
 * 查看指定機台佇列中待執行指令數量（除錯用）
 * @param {string} machineId - 機台 ID
 * @returns {number} 待執行指令數
 */
export function getQueueLength(machineId) {
    const queue = commandQueues.get(machineId);
    return queue ? queue.length : 0;
}

// 保留 publishMQTT 的相容介面（若有其他模組呼叫）
export async function publishMQTT(topic, payload) {
    console.log('[指令佇列] publishMQTT 已棄用，請改用 sendOpenDoor + popCommand');
    console.log('[指令佇列] Topic:', topic, 'Payload:', JSON.stringify(payload));
    return true;
}
