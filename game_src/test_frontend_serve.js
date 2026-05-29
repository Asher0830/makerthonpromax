async function testFrontendServe() {
    console.log('開始驗證前端靜態資源與路徑服務...');
    const baseUrl = 'http://localhost:3000';

    const assets = [
        '/',
        '/mobile/css/style.css',
        '/mobile/js/api.js',
        '/mobile/js/game/PetGame.js',
        '/mobile/js/game/assets/bg_kitchen.png',
        '/mobile/js/game/assets/pets/bunny_idle.png',
        '/mobile/js/game/assets/pets/bunny_happy.png',
        '/mobile/js/game/assets/pets/bunny_eating.png',
        '/mobile/js/game/assets/pets/bunny_hungry.png',
        '/mobile/js/game/assets/items/food_normal.png',
        '/mobile/js/game/assets/items/food_premium.png',
        '/mobile/js/game/assets/items/hat_chef.png'
    ];

    let allOk = true;

    for (const asset of assets) {
        try {
            const url = `${baseUrl}${asset}`;
            const res = await fetch(url, { method: 'HEAD' });
            if (res.status === 200) {
                console.log(`✅ [200 OK] 資源載入成功: ${asset}`);
            } else {
                console.error(`❌ [${res.status}] 資源載入失敗: ${asset}`);
                allOk = false;
            }
        } catch (err) {
            console.error(`❌ [錯誤] 無法連接至資源: ${asset}`, err.message);
            allOk = false;
        }
    }

    if (allOk) {
        console.log('\n🌟 恭喜！前端所有 HTML/CSS/JS 以及美術素材均成功部署且順利提供服務！ 🌟');
        process.exit(0);
    } else {
        console.error('\n❌ 部分前端資源部署失敗，請檢查檔案路徑。');
        process.exit(1);
    }
}

testFrontendServe();
