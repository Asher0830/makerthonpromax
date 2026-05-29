# ESP32 開發手冊 — 惜食機台硬體端

> **文件版本**：v1.0  
> **最後更新**：2026-05-29  
> **對象**：負責 ESP32 韌體開發的工程師  
> **配合文件**：[惜食整合系統_完整技術規格書.md](./惜食整合系統_完整技術規格書.md)

---

## 目錄

1. [系統總覽](#1-系統總覽)
2. [硬體清單與接線](#2-硬體清單與接線)
3. [網路通訊架構](#3-網路通訊架構)
4. [HTTP API 介面](#4-http-api-介面)
5. [MQTT 介面](#5-mqtt-介面)
6. [韌體狀態機](#6-韌體狀態機)
7. [安全與防呆規範](#7-安全與防呆規範)
8. [程式碼架構建議](#8-程式碼架構建議)
9. [本地測試方法](#9-本地測試方法)
10. [附錄](#附錄)

---

## 1. 系統總覽

### 1.1 ESP32 在系統中的角色

```
                        ┌─────────────────────┐
                        │    雲端後端 (API)     │
                        │  http://伺服器:3000   │
                        └──┬──────────────┬────┘
                           │              │
              HTTPS POST   │              │  HTTP POST
             （觸發抽獎）  │              │ （發布 MQTT）
                           │              │
                    ┌──────┴──┐     ┌─────┴──────┐
                    │  ESP32  │◄────│ EMQX Cloud │
                    │  機台   │MQTT │ (Broker)   │
                    └─────────┘    └────────────┘
```

**ESP32 的三大職責：**

| 職責 | 觸發方式 | 通訊協定 |
|------|----------|----------|
| ① 偵測旋鈕轉動 → 通知伺服器觸發抽獎 | 旋鈕中斷 | HTTPS POST → API |
| ② 接收開門指令 → 驅動 SG90 伺服馬達 | MQTT 訂閱 | MQTT（from EMQX） |
| ③ 監控溫濕度 → 控制冷藏/加熱繼電器 | 定時讀取 | MQTT 發布（遙測上報） |

### 1.2 你不需要處理的事

- ❌ 抽獎邏輯（由伺服器處理）
- ❌ 付款驗證（由伺服器處理）
- ❌ 使用者介面（平板端處理）
- ❌ 會員 / 點數系統（伺服器處理）

**你只需要：接收物理訊號 → 發 HTTP → 接 MQTT → 控制馬達和繼電器。**

---

## 2. 硬體清單與接線

### 2.1 零件清單 (BOM)

| 元件 | 型號 | 數量 | 用途 |
|------|------|------|------|
| 主控板 | ESP32 DevKit V1 (或 ESP32-S3) | 1 | 主控制器 |
| 伺服馬達 | SG90 (9g 微型) | 6 | 每個艙位的門鎖 |
| 溫濕度感測器 | DHT11 (或 DHT22) | 1 | 環境監控 |
| 繼電器模組 | 5V 2路繼電器 | 1 | 冷藏 / 加熱控制 |
| 旋轉編碼器 | KY-040 | 1 | 扭蛋旋鈕 |
| 電源供應 | 5V 3A 以上 | 1 | 供電馬達 + ESP32 |
| PCA9685 (選配) | 16路 PWM 驅動板 | 1 | 如果 GPIO 不夠用 |

### 2.2 建議接線 (GPIO Mapping)

```
ESP32 GPIO 配置：
══════════════════════════════════════════════

旋鈕 (KY-040):
  CLK  ──► GPIO 34 (INPUT, 需外部上拉或啟用內部上拉)
  DT   ──► GPIO 35 (INPUT)
  SW   ──► GPIO 32 (按鈕，選配)

DHT11 溫濕度:
  DATA ──► GPIO 4 (需 4.7kΩ 上拉電阻)

繼電器模組:
  冷藏 (IN1) ──► GPIO 25 (OUTPUT)
  加熱 (IN2) ──► GPIO 26 (OUTPUT)

SG90 伺服馬達 (PWM):
  門 1 ──► GPIO 13
  門 2 ──► GPIO 14
  門 3 ──► GPIO 15
  門 4 ──► GPIO 16
  門 5 ──► GPIO 17
  門 6 ──► GPIO 18

※ 如使用 PCA9685 I2C PWM 擴展板：
  SDA ──► GPIO 21
  SCL ──► GPIO 22
  所有 SG90 接在 PCA9685 的 CH0~CH5
```

### 2.3 電源注意事項

> ⚠️ **重要**：6 顆 SG90 同時運作時，瞬間電流可能超過 2A。  
> **絕對不要從 ESP32 的 5V pin 直接供電給馬達！**  
> 必須使用獨立 5V 電源供應器，ESP32 和馬達共地 (GND)。

```
[5V 電源] ──┬── ESP32 (VIN)
            ├── SG90 ×6 (VCC)
            ├── 繼電器模組 (VCC)
            └── 共同 GND
```

---

## 3. 網路通訊架構

### 3.1 WiFi 連線

ESP32 需連接有網路的 WiFi，用於：
- HTTPS 請求到後端 API
- MQTTS 連線到 EMQX Cloud

建議在韌體中硬編碼 WiFi SSID/密碼，或使用 WiFiManager 動態配置。

### 3.2 通訊流程圖

```
[旋鈕轉動]
    │
    ▼
ESP32 偵測到轉動（中斷 + Debounce 500ms）
    │
    ▼
ESP32 ──HTTPS POST──► 後端 API /api/v1/machines/trigger
    │                         │
    │                         ▼
    │                   伺服器抽獎計算
    │                         │
    │                         ▼
    │                   伺服器 ──HTTP POST──► EMQX REST API
    │                                              │
    │                                              ▼
    │◄──────────── MQTT 開門指令 ◄──────────── EMQX Broker
    │
    ▼
ESP32 驅動 SG90 開門（指定艙位）
    │
    ▼
延遲 3 秒後自動復位（關門）
```

---

## 4. HTTP API 介面

### 4.1 觸發抽獎（ESP32 → 伺服器）

當旋鈕轉動時，ESP32 發送此請求。

**設定：**

| 項目 | 值 |
|------|-----|
| Method | `POST` |
| URL（本地測試） | `http://192.168.x.x:3000/api/v1/machines/trigger` |
| URL（部署後） | `https://api.yourdomain.com/api/v1/machines/trigger` |
| Content-Type | `application/json` |
| 超時 | 10 秒 |

**Request Body：**

```json
{
    "machine_id": "MAC_01A2B3",
    "action": "KNOB_TURNED",
    "secret_key": "dev_secret_key_001"
}
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `machine_id` | string | 本機台的唯一 ID，燒錄在韌體中 |
| `action` | string | 固定值 `"KNOB_TURNED"` |
| `secret_key` | string | 認證金鑰，與伺服器資料庫中的值匹配 |

**Response — 成功 (200)：**

```json
{
    "success": true,
    "data": {
        "order_id": 42,
        "won_compartment": 4,
        "won_product": {
            "name": "鮪魚飯糰",
            "category": "bento"
        },
        "points_earned": 10,
        "door_command_sent": true
    }
}
```

> 📌 收到 200 回應後，**不需要** ESP32 自行開門！MQTT 指令會在幾毫秒後到達。  
> 但如果你想做**雙重保險**，可以在收到 200 且 `door_command_sent: true` 後，  
> 等 2 秒看 MQTT 有沒有來，沒來再自己開（fallback）。

**Response — 無等待中的訂單 (403)：**

```json
{
    "success": false,
    "error": {
        "code": "NO_WAITING_ORDER",
        "message": "目前沒有等待觸發的訂單"
    }
}
```

**Response — 認證失敗 (401)：**

```json
{
    "success": false,
    "error": {
        "code": "INVALID_SECRET",
        "message": "認證失敗"
    }
}
```

### 4.2 錯誤處理建議

| HTTP 狀態 | ESP32 應對方式 |
|-----------|---------------|
| 200 | 成功，等待 MQTT 開門指令 |
| 403 | 正常情況（沒人付款就轉了旋鈕），忽略即可 |
| 401 | secret_key 錯誤，檢查韌體設定 |
| 429 | 被限流，等待 5 秒後重試（最多 1 次） |
| 5xx | 伺服器錯誤，LED 閃紅燈提示 |
| 超時 | 網路問題，LED 閃黃燈提示 |

---

## 5. MQTT 介面

### 5.1 連線設定

| 項目 | 本地測試 | 部署（EMQX Cloud） |
|------|----------|---------------------|
| Broker | 可跳過（mock 模式） | `your-deploy.emqxsl.com` |
| Port | — | `8883` (MQTT over TLS) |
| 使用者名稱 | — | 在 EMQX Console 建立 |
| 密碼 | — | 在 EMQX Console 建立 |
| Client ID | — | `esp32_MAC_01A2B3` |
| Clean Session | — | `true` |
| Keep Alive | — | `60` 秒 |
| TLS | — | ✅ 必須啟用 |

**Arduino 推薦函式庫：** `PubSubClient` 或 `AsyncMqttClient`

### 5.2 訂閱主題 — 控制指令（伺服器 → ESP32）

**Topic：** `v1/machines/{machine_id}/control`

例如：`v1/machines/MAC_01A2B3/control`

**Payload 範例 — 開門：**

```json
{
    "action": "OPEN",
    "door_index": 4,
    "pwm_ms": 1500,
    "auto_close_sec": 3,
    "request_id": "ord_42_1716990300"
}
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `action` | string | 動作類型：`"OPEN"` = 開門 |
| `door_index` | int | 艙位編號（1~6） |
| `pwm_ms` | int | SG90 PWM 脈寬（微秒）。1500 = 90°（開門位置） |
| `auto_close_sec` | int | 幾秒後自動關門（復位到 0°） |
| `request_id` | string | 請求 ID，用於日誌追蹤 |

**ESP32 處理流程：**

```
收到 MQTT 訊息
    │
    ├── 解析 JSON
    ├── 驗證 door_index 範圍 (1~6)
    │
    ├── 輸出 PWM 到對應 GPIO
    │   └── SG90: 0° = 500μs (鎖), 90° = 1500μs (開)
    │
    ├── delay(auto_close_sec * 1000)
    │
    └── 復位 PWM 到 500μs (關門)
```

### 5.3 發布主題 — 環境遙測（ESP32 → 伺服器）

**Topic：** `v1/machines/{machine_id}/telemetry`

**頻率：** 每 **60 秒** 發布一次

**Payload：**

```json
{
    "temperature": 15.2,
    "humidity": 60.5,
    "hardware_status": {
        "cooling_relay": true,
        "heating_relay": false
    },
    "timestamp": "2026-05-29T16:20:00Z"
}
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `temperature` | float | DHT11 讀取的溫度（°C） |
| `humidity` | float | DHT11 讀取的濕度（%） |
| `hardware_status.cooling_relay` | bool | 冷藏繼電器是否通電 |
| `hardware_status.heating_relay` | bool | 加熱繼電器是否通電 |
| `timestamp` | string | ISO 8601 時間戳 |

### 5.4 發布主題 — 心跳（ESP32 → 伺服器）

**Topic：** `v1/machines/{machine_id}/heartbeat`

**頻率：** 每 **30 秒** 發布一次

**Payload：**

```json
{
    "uptime_sec": 3600,
    "free_heap": 120000,
    "wifi_rssi": -45
}
```

---

## 6. 韌體狀態機

ESP32 韌體本身很簡單，不需要追蹤訂單狀態。只需要處理三件事：

```
┌─────────────────────────────────────────────────┐
│                  主迴圈 (loop)                    │
│                                                   │
│  [每 16ms] 檢查旋鈕中斷旗標                      │
│     └── 有旗標 → 發 HTTP POST → 清除旗標         │
│                                                   │
│  [每 60s] 讀取 DHT11 → 控制繼電器 → 發 MQTT 遙測  │
│                                                   │
│  [每 30s] 發 MQTT 心跳                            │
│                                                   │
│  [隨時] MQTT callback 收到開門指令 → 驅動 SG90    │
│                                                   │
└─────────────────────────────────────────────────┘
```

### 6.1 旋鈕偵測流程

```
旋鈕 CLK 下降沿中斷
    │
    ├── 記錄 millis() 時間戳
    ├── 設定 knob_triggered = true
    │
    ▼
loop() 偵測到 knob_triggered == true
    │
    ├── 檢查距離上次觸發 > 500ms？（Debounce）
    │   ├── 否 → 忽略，清除旗標
    │   └── 是 ↓
    │
    ├── 檢查距離上次 HTTP 請求 > 2000ms？（防連發）
    │   ├── 否 → 忽略
    │   └── 是 ↓
    │
    ├── 發送 HTTP POST /api/v1/machines/trigger
    ├── 處理回應（見 Section 4.2）
    └── 清除旗標，更新時間戳
```

---

## 7. 安全與防呆規範

### 7.1 旋鈕防彈跳（Debounce）— ⚠️ 必做

```cpp
// 硬體防彈跳：CLK 和 DT 腳位各加 100nF 電容到 GND（建議）

// 軟體防彈跳：最少 500ms
volatile bool knobTriggered = false;
unsigned long lastTriggerTime = 0;
const unsigned long DEBOUNCE_MS = 500;

void IRAM_ATTR onKnobTurn() {
    knobTriggered = true;
}

void loop() {
    if (knobTriggered) {
        knobTriggered = false;
        unsigned long now = millis();
        if (now - lastTriggerTime >= DEBOUNCE_MS) {
            lastTriggerTime = now;
            triggerGacha();  // 發 HTTP POST
        }
    }
}
```

### 7.2 溫控互斥防護 — ⚠️ 必做

**冷藏和加熱繼電器絕對不能同時通電！**  
安全邏輯必須鎖在韌體最底層，不依賴雲端指令。

```cpp
#define PIN_COOLING 25
#define PIN_HEATING 26

// 溫度閾值
#define TEMP_COOL_ON  18.0   // 高於此溫度開冷藏
#define TEMP_COOL_OFF 12.0   // 低於此溫度關冷藏
#define TEMP_HEAT_ON   3.0   // 低於此溫度開加熱
#define TEMP_HEAT_OFF  8.0   // 高於此溫度關加熱

void updateTempControl(float temp) {
    // ⚠️ 互斥鎖：硬編碼在最底層
    if (temp > TEMP_COOL_ON) {
        digitalWrite(PIN_HEATING, LOW);   // 先關加熱！
        delay(100);                        // 等繼電器釋放
        digitalWrite(PIN_COOLING, HIGH);  // 再開冷藏
    } else if (temp < TEMP_HEAT_ON) {
        digitalWrite(PIN_COOLING, LOW);   // 先關冷藏！
        delay(100);
        digitalWrite(PIN_HEATING, HIGH);  // 再開加熱
    } else if (temp < TEMP_COOL_OFF && temp > TEMP_HEAT_OFF) {
        // 舒適區，全關
        digitalWrite(PIN_COOLING, LOW);
        digitalWrite(PIN_HEATING, LOW);
    }

    // 最終防線：絕不允許同時 HIGH
    if (digitalRead(PIN_COOLING) == HIGH && digitalRead(PIN_HEATING) == HIGH) {
        digitalWrite(PIN_COOLING, LOW);
        digitalWrite(PIN_HEATING, LOW);
        Serial.println("🚨 互斥違規！已強制關閉所有繼電器");
    }
}
```

### 7.3 HTTP 請求防連發

即使 Debounce 通過，也不要在短時間內連發多個 HTTP 請求。

```cpp
unsigned long lastHttpRequest = 0;
const unsigned long HTTP_COOLDOWN_MS = 2000;  // 2 秒冷卻

void triggerGacha() {
    unsigned long now = millis();
    if (now - lastHttpRequest < HTTP_COOLDOWN_MS) {
        Serial.println("⏳ HTTP 冷卻中，跳過");
        return;
    }
    lastHttpRequest = now;
    // ... 發 HTTP POST
}
```

### 7.4 SG90 保護

```cpp
// SG90 持續通電會發熱！開門後務必在關門後 detach
void openDoor(int doorIndex, int pwmMs, int autoCloseSec) {
    Servo servo;
    int pin = doorPins[doorIndex - 1];  // 轉換為 GPIO

    servo.attach(pin);
    servo.writeMicroseconds(pwmMs);     // 開門（例：1500μs = 90°）
    delay(autoCloseSec * 1000);
    servo.writeMicroseconds(500);       // 關門（0°）
    delay(300);
    servo.detach();                     // ⚠️ 重要：斷開 PWM 避免過熱
}
```

---

## 8. 程式碼架構建議

```
esp32-firmware/
├── src/
│   ├── main.cpp              # 主程式 setup() + loop()
│   ├── config.h              # WiFi / MQTT / API 設定常數
│   ├── knob.h / knob.cpp     # 旋鈕偵測（中斷 + debounce）
│   ├── doors.h / doors.cpp   # SG90 控制（開門 / 關門）
│   ├── climate.h / climate.cpp  # DHT11 + 繼電器控制
│   ├── api_client.h / api_client.cpp  # HTTP POST 封裝
│   └── mqtt_client.h / mqtt_client.cpp # MQTT 連線 + 訊息處理
├── platformio.ini            # PlatformIO 設定
└── README.md
```

### 8.1 建議使用的 Arduino 函式庫

| 函式庫 | 用途 | PlatformIO lib |
|--------|------|----------------|
| `WiFi.h` | WiFi 連線 | 內建 |
| `HTTPClient.h` | HTTPS POST | 內建 |
| `PubSubClient` | MQTT Client | `knolleary/PubSubClient` |
| `ArduinoJson` | JSON 解析/產生 | `bblanchon/ArduinoJson@^7` |
| `ESP32Servo` | PWM 伺服馬達控制 | `madhephaestus/ESP32Servo` |
| `DHT` | 溫濕度讀取 | `adafruit/DHT sensor library` |

### 8.2 config.h 範例

```cpp
#ifndef CONFIG_H
#define CONFIG_H

// === 機台識別 ===
#define MACHINE_ID     "MAC_01A2B3"
#define SECRET_KEY     "dev_secret_key_001"

// === WiFi ===
#define WIFI_SSID      "your-wifi-ssid"
#define WIFI_PASSWORD  "your-wifi-password"

// === 後端 API ===
#define API_BASE_URL   "http://192.168.1.100:3000"  // 本地測試
// #define API_BASE_URL "https://api.yourdomain.com" // 部署後
#define API_TRIGGER    "/api/v1/machines/trigger"
#define API_TIMEOUT_MS 10000

// === MQTT (EMQX) ===
#define MQTT_ENABLED   false  // 本地測試時設 false
#define MQTT_BROKER    "your-deploy.emqxsl.com"
#define MQTT_PORT      8883
#define MQTT_USER      "esp32_user"
#define MQTT_PASS      "esp32_password"
#define MQTT_CLIENT_ID "esp32_" MACHINE_ID

// === 硬體腳位 ===
#define PIN_KNOB_CLK   34
#define PIN_KNOB_DT    35
#define PIN_DHT        4
#define PIN_COOL_RELAY 25
#define PIN_HEAT_RELAY 26

// SG90 門腳位
const int DOOR_PINS[] = {13, 14, 15, 16, 17, 18};
#define NUM_DOORS      6

// === 時間常數 ===
#define DEBOUNCE_MS        500
#define HTTP_COOLDOWN_MS   2000
#define TELEMETRY_INTERVAL 60000  // 60 秒
#define HEARTBEAT_INTERVAL 30000  // 30 秒

#endif
```

---

## 9. 本地測試方法

### 9.1 不需要 EMQX 也能測試

本地開發時，後端的 MQTT 是 **mock 模式**（只 console.log，不真的發 MQTT）。  
所以 ESP32 在本地測試時：

1. **HTTP 觸發**可以正常測（直接打後端 API）
2. **MQTT 開門**收不到（因為沒有真的 Broker）

**解法：** 在 HTTP 回應中拿到 `won_compartment`，直接自己開門（fallback 模式）。

```cpp
void triggerGacha() {
    // ... 發 HTTP POST ...

    if (httpCode == 200) {
        // 解析回應
        int doorIndex = doc["data"]["won_compartment"];

        #if !MQTT_ENABLED
        // 本地測試：直接開門（不等 MQTT）
        Serial.printf("🎰 本地模式：直接開門 %d\n", doorIndex);
        openDoor(doorIndex, 1500, 3);
        #else
        // 部署模式：等 MQTT 指令
        Serial.println("⏳ 等待 MQTT 開門指令...");
        #endif
    }
}
```

### 9.2 用 curl 模擬 ESP32 觸發

在終端機直接測試 API：

```bash
# 觸發抽獎（模擬旋鈕轉動）
curl -X POST http://localhost:3000/api/v1/machines/trigger \
  -H "Content-Type: application/json" \
  -d '{"machine_id":"MAC_01A2B3","action":"KNOB_TURNED","secret_key":"dev_secret_key_001"}'
```

### 9.3 用 Serial Monitor 除錯

建議在韌體中加入詳細的 Serial 輸出：

```
🍱 惜食機台 ESP32 啟動
📡 WiFi 連線中... 已連線！IP: 192.168.1.50
🔗 MQTT: 跳過（本地測試模式）
✅ 系統就緒，等待旋鈕操作

🎰 旋鈕轉動偵測！
📤 HTTP POST → http://192.168.1.100:3000/api/v1/machines/trigger
📥 回應 200: {"success":true,"data":{"won_compartment":4,...}}
🚪 開門 #4 (PWM: 1500μs, 自動關門: 3s)
🚪 門 #4 已關閉

🌡️ 溫度: 15.2°C, 濕度: 60.5%
❄️ 冷藏繼電器: ON
📤 遙測上報完成
```

---

## 附錄

### A. 與後端工程師的介面約定

| 項目 | 約定值 | 誰定義的 |
|------|--------|----------|
| `machine_id` | `"MAC_01A2B3"` | 資料庫 + 韌體都要一致 |
| `secret_key` | `"dev_secret_key_001"` | 資料庫 seed.sql 中定義 |
| API URL（本地） | `http://{電腦IP}:3000` | 後端 server.js |
| MQTT Topic 前綴 | `v1/machines/` | 規格書定義 |
| 艙位編號 | 1~6（不是 0~5） | 規格書定義 |
| PWM 值 | 500μs (關) / 1500μs (開) | 規格書定義 |

### B. 常見問題

**Q: 伺服器回 403 NO_WAITING_ORDER 怎麼辦？**  
A: 正常情況。代表沒有消費者付款就有人轉了旋鈕。ESP32 不需要做任何事，忽略即可。

**Q: WiFi 斷線怎麼辦？**  
A: 加入自動重連邏輯。溫控必須獨立運作，不依賴網路。

**Q: MQTT 連線斷了怎麼辦？**  
A: PubSubClient 的 `loop()` 會自動嘗試重連。設定 `setKeepAlive(60)` 和 reconnect 邏輯。

**Q: 如何更新韌體？**  
A: MVP 階段用 USB 燒錄。未來可加入 ESP32 OTA（Over-The-Air）更新。

### C. 開發里程碑建議

| 階段 | 目標 | 預估時間 |
|------|------|----------|
| 1 | WiFi 連線 + Serial 輸出 | 0.5 天 |
| 2 | 旋鈕偵測 + Debounce | 0.5 天 |
| 3 | HTTP POST 觸發 API | 1 天 |
| 4 | SG90 開門 / 關門 | 0.5 天 |
| 5 | DHT11 + 繼電器互斥控制 | 0.5 天 |
| 6 | MQTT 連線 + 開門指令 | 1 天 |
| 7 | 整合測試 | 1 天 |
| **合計** | | **~5 天** |
