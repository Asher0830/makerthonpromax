/**
 * MQTT 發布服務
 * 本地開發：Mock 模式（console.log）
 * 部署後：HTTP POST → EMQX REST API
 */

const MQTT_MODE = process.env.MQTT_MODE || 'mock';
const EMQX_API_URL = process.env.EMQX_API_URL || '';
const EMQX_API_KEY = process.env.EMQX_API_KEY || '';
const EMQX_API_SECRET = process.env.EMQX_API_SECRET || '';

/**
 * 發布 MQTT 訊息
 * @param {string} topic - MQTT Topic
 * @param {object} payload - 訊息內容
 * @returns {Promise<boolean>} 是否成功
 */
export async function publishMQTT(topic, payload) {
    if (MQTT_MODE === 'mock') {
        console.log('📡 [MQTT Mock] Topic:', topic);
        console.log('📡 [MQTT Mock] Payload:', JSON.stringify(payload, null, 2));
        return true;
    }

    // 真實模式：呼叫 EMQX HTTP API
    try {
        const response = await fetch(`${EMQX_API_URL}/publish`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + btoa(`${EMQX_API_KEY}:${EMQX_API_SECRET}`),
            },
            body: JSON.stringify({
                topic,
                payload: JSON.stringify(payload),
                qos: 1,
                retain: false,
            }),
        });

        if (!response.ok) {
            console.error('❌ EMQX API 錯誤:', response.status, await response.text());
            return false;
        }

        console.log('✅ MQTT 訊息已發布:', topic);
        return true;
    } catch (err) {
        console.error('❌ EMQX 連線失敗:', err.message);
        return false;
    }
}

/**
 * 發送開門指令
 */
export async function sendOpenDoor(machineId, doorIndex, requestId) {
    return publishMQTT(`v1/machines/${machineId}/control`, {
        action: 'OPEN',
        door_index: doorIndex,
        pwm_ms: 1500,
        auto_close_sec: 3,
        request_id: requestId,
    });
}
