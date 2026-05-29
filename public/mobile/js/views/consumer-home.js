/* ═══════════════════════════════════════════════════
   FoodD Mobile — Consumer Home Page
   ═══════════════════════════════════════════════════ */

async function renderConsumerHomePage() {
  updateBottomNav('home');
  showLoading();

  let user = authManager.getUser();
  let userName = user ? (user.name || '消費者') : '訪客';
  let isLoggedIn = authManager.isLoggedIn();

  // 獲取機台 MAC_01A2B3 的狀態以取得即時溫度與濕度
  let machineStatus = null;
  try {
    machineStatus = await api.getMachine('MAC_01A2B3');
  } catch (err) {
    console.warn('[Home] Failed to load machine status', err);
  }

  // 獲取點數
  let pointsInfo = { points: 0 };
  if (isLoggedIn) {
    try {
      pointsInfo = await api.getPoints();
    } catch (err) {
      console.warn('[Home] Failed to load points', err);
    }
  }

  hideLoading();

  const tempVal = machineStatus?.last_telemetry?.temperature != null 
    ? `${machineStatus.last_telemetry.temperature}°C` 
    : '24.5°C';
  const humiVal = machineStatus?.last_telemetry?.humidity != null 
    ? `${machineStatus.last_telemetry.humidity}%` 
    : '60.0%';
  const statusDesc = machineStatus?.machine?.status || 'IDLE';
  const statusMap = {
    IDLE: '運行中',
    WAITING_FOR_PAYMENT: '待付款',
    WAITING_FOR_TRIGGER: '請轉動旋鈕！',
    DISPENSING: '出餐中',
  };
  const statusLabel = statusMap[statusDesc] || statusDesc;

  const activeSlots = machineStatus?.pool_summary?.stocked ?? 0;

  const html = `
    <div class="page-header">
      <h1 class="header-title">SFood 惜食救援</h1>
      ${isLoggedIn ? `<span style="font-size: 0.85rem; font-weight: 700; color: var(--primary); background: var(--accent-light); padding: 4px 10px; border-radius: 99px;">${pointsInfo.points} P</span>` : ''}
    </div>

    <div class="page-content" style="padding: 24px 16px;">
      <!-- Greeting Section -->
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 1.6rem; font-weight: 800; color: var(--text); line-height: 1.2; letter-spacing: -0.5px;">哈囉，${userName}</h2>
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 4px;">用驚喜與美味，拯救每一份即期惜食。</p>
      </div>

      <!-- Telemetry Live Status Card -->
      <div class="card" style="margin-bottom: 24px; padding: 20px; border: 1px solid var(--border); box-shadow: var(--shadow-md);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 0.75rem; font-weight: 700; background: var(--primary); color: #fff; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.5px;">LIVE</span>
            <span style="font-size: 0.9rem; font-weight: 700; color: var(--text);">智慧惜食機 MAC_01A2B3</span>
          </div>
          <span style="font-size: 0.8rem; font-weight: 700; color: var(--primary);">${statusLabel}</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div style="background: rgba(28,27,26,0.02); padding: 12px; border-radius: 8px; border: 1px solid rgba(28,27,26,0.04);">
            <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500;">即時櫃溫 (ESP32)</div>
            <div id="home-temp" style="font-size: 1.4rem; font-weight: 800; color: var(--text); margin-top: 4px; font-family: 'Outfit', sans-serif;">${tempVal}</div>
          </div>
          <div style="background: rgba(28,27,26,0.02); padding: 12px; border-radius: 8px; border: 1px solid rgba(28,27,26,0.04);">
            <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500;">即時濕度 (ESP32)</div>
            <div id="home-humidity" style="font-size: 1.4rem; font-weight: 800; color: var(--text); margin-top: 4px; font-family: 'Outfit', sans-serif;">${humiVal}</div>
          </div>
        </div>

        <div style="margin-top: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--text-secondary); border-top: 1px solid var(--border); padding-top: 12px;">
          <span>目前在線狀況：<span style="color: var(--primary); font-weight: 600;">運行良好</span></span>
          <span style="font-weight: 700; color: var(--text);">已上架 ${activeSlots} 個商品</span>
        </div>
      </div>

      <!-- Quick Actions Grid -->
      <div style="margin-bottom: 28px;">
        <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 12px; letter-spacing: -0.3px;">快速選單</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="card" onclick="router.navigate('/consumer/map')" style="cursor: pointer; padding: 20px 16px; margin: 0; text-align: center;">
            <div style="font-size: 1.5rem; color: var(--primary); font-weight: 800; margin-bottom: 8px;">⌕</div>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text);">地圖搜尋</div>
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">尋找附近惜食店家</p>
          </div>

          <div class="card" onclick="router.navigate('/consumer/scan')" style="cursor: pointer; padding: 20px 16px; margin: 0; text-align: center;">
            <div style="font-size: 1.5rem; color: var(--primary); font-weight: 800; margin-bottom: 8px;">[SCAN]</div>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text);">掃碼付款</div>
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">直接啟用與出餐</p>
          </div>

          <div class="card" onclick="router.navigate('/consumer/orders')" style="cursor: pointer; padding: 20px 16px; margin: 0; text-align: center;">
            <div style="font-size: 1.5rem; color: var(--primary); font-weight: 800; margin-bottom: 8px;">[LIST]</div>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text);">惜食訂單</div>
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">查看您的消費歷程</p>
          </div>

          <div class="card" onclick="router.navigate('/consumer/points')" style="cursor: pointer; padding: 20px 16px; margin: 0; text-align: center;">
            <div style="font-size: 1.5rem; color: var(--primary); font-weight: 800; margin-bottom: 8px;">✦</div>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text);">環保點數</div>
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">累計善舉與點數</p>
          </div>
        </div>
      </div>

      <!-- Sustainability Banner -->
      <div class="card" style="margin: 0; padding: 18px; border: 1px solid rgba(0, 128, 85, 0.15); background: var(--accent-light);">
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">惜食綠色行動</div>
        <p style="font-size: 0.95rem; font-weight: 700; color: var(--text); line-height: 1.4;">每拯救一份剩食，平均可以為地球減少 1.2 kg 的碳排放量。</p>
      </div>
    </div>
  `;

  renderPage(html);

  // 定期輪詢以時時接收並刷新 ESP32 的溫度數值
  const homeTimer = setInterval(async () => {
    if (location.hash !== '#/consumer/home') {
      clearInterval(homeTimer);
      return;
    }
    try {
      const updatedStatus = await api.getMachine('MAC_01A2B3');
      if (updatedStatus && updatedStatus.last_telemetry) {
        const tEl = document.getElementById('home-temp');
        const hEl = document.getElementById('home-humidity');
        if (tEl) tEl.textContent = updatedStatus.last_telemetry.temperature != null ? `${updatedStatus.last_telemetry.temperature}°C` : '24.5°C';
        if (hEl) hEl.textContent = updatedStatus.last_telemetry.humidity != null ? `${updatedStatus.last_telemetry.humidity}%` : '60.0%';
      }
    } catch (_) { /* ignore */ }
  }, 3000);
}
