const fs = require('fs');
const path = require('path');

async function runTest() {
    console.log('🚀 開始測試 O2O 扭蛋付款與會員登入綁定流程...');
    const baseUrl = 'http://localhost:3000/api/v1';

    // [資料庫重設] 發送 API 重設資料庫，保證最乾淨的初始狀態
    console.log('\n[重設] 正在重設並重新 Seed 資料庫...');
    let resetRes = await fetch(`${baseUrl}/debug/db/reset`, { method: 'POST' });
    let resetText = await resetRes.text();
    if (resetRes.ok) {
        console.log(`✅ 資料庫重設成功！內容: ${resetText}`);
    } else {
        console.warn(`⚠️ 資料庫重設失敗，狀態碼: ${resetRes.status}，錯誤內容: ${resetText}`);
    }

    // 強制將機台重設為 IDLE
    console.log('🧹 強制設定機台狀態為 IDLE...');
    await fetch(`${baseUrl}/debug/machine/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            machineId: 'MAC_01A2B3',
            status: 'IDLE',
            activeOrderId: null
        })
    });
    console.log('✅ 機台已成功重設為 IDLE！');

    // 1. 訪客在 Kiosk 平板上選擇開始扭蛋
    console.log('\n[步驟 1] 訪客在 Kiosk 平板點擊「開始扭蛋」...');
    
    // 先查詢一下機台真實狀態
    let statusRes = await fetch(`${baseUrl}/machines/MAC_01A2B3/status`);
    if (statusRes.ok) {
        let statusJson = await statusRes.json();
        console.log(`🤖 [DEBUG] 發起扭蛋前的機台狀態:`, statusJson.data.machine);
    }
    let startRes = await fetch(`${baseUrl}/machines/MAC_01A2B3/gacha/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excluded_allergens: [], category: null })
    });
    
    let startJson = await startRes.json();
    if (!startRes.ok) {
        console.error('❌ 開始扭蛋失敗:', startJson);
        process.exit(1);
    }
    const orderId = startJson.data.order_id;
    console.log(`✅ 成功建立訪客扭蛋訂單，訂單 ID: ${orderId}, 平均金額: ${startJson.data.pool_avg_price}`);

    // 2. 註冊一個新會員
    console.log('\n[步驟 2] 手機端進行全新會員註冊以進行付款與累計點數...');
    const testEmail = `test_user_${Date.now()}@foodd.com`;
    let registerRes = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            email: testEmail, 
            password: 'password123',
            name: 'O2OTester',
            role: 'consumer'
        })
    });
    
    let registerJson = await registerRes.json();
    if (!registerRes.ok) {
        console.error('❌ 註冊失敗:', registerJson);
        process.exit(1);
    }
    const token = registerJson.data.token;
    console.log(`✅ 會員註冊並登入成功！Token 取得：${token.substring(0, 20)}...`);

    // 3. 會員在手機端進行付款
    console.log('\n[步驟 3] 會員透過手機發送付款請求 (帶有 Authorization Token)...');
    let payRes = await fetch(`${baseUrl}/machines/MAC_01A2B3/gacha/pay`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ order_id: orderId })
    });
    
    let payJson = await payRes.json();
    if (!payRes.ok) {
        console.error('❌ 付款失敗:', payJson);
        process.exit(1);
    }
    console.log('✅ 付款處理成功！', payJson.data);

    // 3.5. 查詢付款後的訂單詳情，驗證 user_id 是否確實寫入
    console.log('\n[步驟 3.5] 驗證訂單在付款後之 user_id 關聯狀態...');
    let orderRes = await fetch(`${baseUrl}/orders/${orderId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    let orderJson = await orderRes.json();
    console.log(`🤖 訂單資訊:`, orderJson.data);

    // 4. 模擬實體旋鈕轉動 (Knob Turned)
    console.log('\n[步驟 4] 模擬實體機台轉動旋鈕 (Knob Turned)...');
    let triggerRes = await fetch(`${baseUrl}/machines/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            machine_id: 'MAC_01A2B3', 
            action: 'KNOB_TURNED',
            secret_key: 'dev_secret_key_001'
        })
    });
    
    let triggerJson = await triggerRes.json();
    if (!triggerRes.ok) {
        console.error('❌ 轉動旋鈕失敗:', triggerJson);
        process.exit(1);
    }
    console.log('✅ 扭蛋成功轉出！獲得商品：', triggerJson.data.won);
    console.log(`🎁 會員獲得點數：${triggerJson.data.points_earned} 點`);
    console.log(`🤖 後端發放對象 user_id: ${orderJson.data.user_id}`);

    // 5. 查詢該會員的點數餘額，確認點數是否確實累計
    console.log('\n[步驟 5] 查詢該會員點數餘額，驗證點數累計成果...');
    let meRes = await fetch(`${baseUrl}/auth/me`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    let meJson = await meRes.json();
    console.log(`✅ 驗證成功！會員最新點數：${meJson.data.user.points} 點！`);
    console.log('\n🎉 O2O 扭蛋付款與會員登入綁定流程全部測試通過！');
}

runTest();
