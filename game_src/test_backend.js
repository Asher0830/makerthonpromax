const path = require('node:path');
const fs = require('node:fs');

// 動態產生唯一的測試使用者名稱，確保測試具備可重複執行性
const testUsername = '兔兔守護者_' + Date.now();

// 啟動 Hono 實例 (但不開啟 TCP 連線，直接記憶體測試)
const { db } = require('./database/db');

// 修改 process.env 以便在伺服器端不跑 listen，或是我們直接引入邏輯
// 我們在 server.js 中啟動了 serve。但為了測試，我們可以建立一個單獨的測試檔案載入邏輯。
// 為了可以直接測試 server.js 中的路由，我們可以建立一個獨立測試指令碼，直接透過 fetch 或以模擬請求測試已執行的伺服器。
// 或者，我們可以直接啟動 server.js 作為背景工作，然後發送 HTTP 請求！
// 這樣做更接近實際運行狀況。

// 讓我們撰寫一個發送實際 HTTP 請求的測試腳本。
async function runTests() {
    console.log('開始進行後端 API 整合測試...');
    const baseUrl = 'http://localhost:3000';

    const request = async (url, options = {}) => {
        const response = await fetch(`${baseUrl}${url}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        const status = response.status;
        const text = await response.text();
        let data = null;
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = text;
        }
        return { status, data };
    };

    let token = '';
    let petId = null;

    // 1. 測試註冊
    console.log(`\n[測試 1] 使用者註冊 (帳號: ${testUsername})...`);
    const regRes = await request('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: testUsername })
    });
    console.log('結果:', regRes);
    if (regRes.status !== 201 || !regRes.data.success) {
        throw new Error('註冊失敗');
    }
    token = regRes.data.data.token;

    // 2. 測試獲取目前使用者資訊
    console.log('\n[測試 2] 獲取使用者資訊...');
    const meRes = await request('/api/v1/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('結果:', meRes);
    if (meRes.status !== 200 || meRes.data.data.user.points !== 100) {
        throw new Error('獲取使用者資訊失敗或點數不正確');
    }

    // 3. 測試在尚未建立寵物時獲取狀態
    console.log('\n[測試 3] 未建立寵物時獲取寵物狀態...');
    const statusFailRes = await request('/api/v1/pet/status', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('結果:', statusFailRes);
    if (statusFailRes.status !== 404 || statusFailRes.data.error.code !== 'NO_PET') {
        throw new Error('未建寵物時的錯誤回應不正確');
    }

    // 4. 建立寵物
    console.log('\n[測試 4] 建立新寵物 (飯糰兔)...');
    const createRes = await request('/api/v1/pet/create', {
        method: 'POST',
        body: JSON.stringify({ name: '海苔飯糰', species: 'rice_bunny' }),
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('結果:', createRes);
    if (createRes.status !== 201 || createRes.data.data.pet.name !== '海苔飯糰') {
        throw new Error('建立寵物失敗');
    }
    petId = createRes.data.data.pet.id;

    // 5. 獲取寵物狀態
    console.log('\n[測試 5] 獲取寵物狀態...');
    const statusRes = await request('/api/v1/pet/status', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('結果:', statusRes);
    if (statusRes.status !== 200 || statusRes.data.data.pet.fullness !== 100) {
        throw new Error('獲取寵物狀態失敗');
    }

    // 6. 測試餵食 (普通餵食 - 消耗 5 點，增加飽食 20)
    console.log('\n[測試 6] 餵食寵物 (普通食物)...');
    const feedRes = await request('/api/v1/pet/feed', {
        method: 'POST',
        body: JSON.stringify({ feed_type: 'normal' }),
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('結果:', feedRes);
    if (feedRes.status !== 200 || feedRes.data.data.points_spent !== 5) {
        throw new Error('餵食失敗');
    }

    // 7. 測試餵食冷卻限制
    console.log('\n[測試 7] 立即再次餵食 (應觸發冷卻)...');
    const feedCdRes = await request('/api/v1/pet/feed', {
        method: 'POST',
        body: JSON.stringify({ feed_type: 'normal' }),
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('結果:', feedCdRes);
    if (feedCdRes.status !== 400 || feedCdRes.data.error.code !== 'COOLDOWN') {
        throw new Error('冷卻機制未正常作用');
    }

    // 8. 獲取裝飾商店列表
    console.log('\n[測試 8] 獲取商店裝飾品列表...');
    const shopRes = await request('/api/v1/pet/shop', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('結果:', shopRes);
    if (shopRes.status !== 200 || shopRes.data.data.items.length === 0) {
        throw new Error('商店獲取失敗');
    }

    // 9. 購買裝飾品 (購買廚師帽 - 價格 30)
    console.log('\n[測試 9] 購買裝飾品 (廚師帽)...');
    const buyRes = await request('/api/v1/pet/buy-item', {
        method: 'POST',
        body: JSON.stringify({ item_id: 2 }), // 廚師帽的 ID 是 2
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('結果:', buyRes);
    if (buyRes.status !== 200 || buyRes.data.data.points_spent !== 30) {
        throw new Error('購買裝飾品失敗');
    }

    // 10. 裝備道具 (裝備廚師帽)
    console.log('\n[測試 10] 裝備裝飾品 (廚師帽)...');
    const equipRes = await request('/api/v1/pet/equip', {
        method: 'POST',
        body: JSON.stringify({ item_id: 2, equip: true }),
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('結果:', equipRes);
    if (equipRes.status !== 200 || equipRes.data.data.is_equipped !== 1) {
        throw new Error('裝備失敗');
    }

    // 11. 再次檢查狀態以驗證配戴裝飾與餘額
    console.log('\n[測試 11] 重新獲取寵物狀態確認裝飾...');
    const finalStatus = await request('/api/v1/pet/status', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('最終狀態:', finalStatus);
    if (finalStatus.data.data.pet.equipped_items.length !== 1 || finalStatus.data.data.pet.equipped_items[0].id !== 2) {
        throw new Error('寵物未成功配戴廚師帽');
    }

    console.log('\n🌟 恭喜！所有後端 API 整合測試全部通過！ 🌟');
    process.exit(0);
}

runTests().catch(err => {
    console.error('\n❌ 測試失敗:', err);
    process.exit(1);
});
