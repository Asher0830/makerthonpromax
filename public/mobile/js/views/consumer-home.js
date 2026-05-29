/* ═══════════════════════════════════════════════════
   FoodD Mobile — Consumer Home Page
   ═══════════════════════════════════════════════════ */

const DEFAULT_MACHINE_ID = 'MAC_01A2B3';

async function renderConsumerHomePage() {
  updateBottomNav('home');
  showLoading();

  let user = authManager.getUser();
  let userName = user ? (user.name || '消費者') : '訪客';
  if (window.i18n.currentLang === 'en' && userName === '消費者') {
    userName = 'Consumer';
  } else if (window.i18n.currentLang === 'en' && userName === '訪客') {
    userName = 'Guest';
  }
  let isLoggedIn = authManager.isLoggedIn();

  // 獲取機台 MAC_01A2B3 的狀態以取得即時溫度與濕度
  let machineStatus = null;
  try {
    machineStatus = await api.getMachine(DEFAULT_MACHINE_ID);
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
    zh: {
      IDLE: '運行中',
      WAITING_FOR_PAYMENT: '待付款',
      WAITING_FOR_TRIGGER: '請轉動旋鈕！',
      DISPENSING: '出餐中',
    },
    en: {
      IDLE: 'Active',
      WAITING_FOR_PAYMENT: 'Unpaid',
      WAITING_FOR_TRIGGER: 'Turn Knob!',
      DISPENSING: 'Dispensing',
    }
  };
  const activeLang = window.i18n.currentLang;
  const statusLabel = statusMap[activeLang]?.[statusDesc] || statusDesc;

  const activeSlots = machineStatus?.pool_summary?.stocked ?? 0;

  // SDGs 永續目標多句循環播放邏輯 (每 5.5 秒切換，帶漸隱漸顯動畫，去除所有 emoji)
  const sdgMessages = {
    zh: [
      "每拯救一份剩食，平均可以為地球減少 1.2 kg 的碳排放量。",
      "SDG 2 消除飢餓：透過剩食分流共享與精準媒合，消弭極端飢餓，讓愛物惜食成為溫飽力量。",
      "SDG 12 責任消費與生產：全球有 1/3 的食物被白白浪費，支持剩食拯救，共創永續循環經濟！",
      "SDG 13 氣候行動：減少剩食腐爛釋放的強烈溫室氣體，從日常生活減碳，減緩氣候變遷！",
      "永續惜食統計：多一盒即期餐點被選購，就少一分地球資源的耗費，每一次消費都是綠色決策！"
    ],
    en: [
      "Saving a surplus meal reduces carbon emissions by an average of 1.2 kg.",
      "SDG 2 Zero Hunger: Match surplus food to eliminate hunger and share love through food saving.",
      "SDG 12 Responsible Consumption: 1/3 of global food is wasted. Save surplus to support circular economy!",
      "SDG 13 Climate Action: Reduce strong greenhouse gases from food waste and slow down climate change!",
      "Green Acts: Choosing surplus meals prevents resource depletion. Every green act matters!"
    ]
  };

  const initialSdg = sdgMessages[activeLang][0];

  const html = `
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
      <h1 class="header-title">${window.t('appTitle')}</h1>
      <div class="header-controls" style="display: flex; align-items: center; gap: 8px;">
        <button id="theme-toggle-btn" class="header-icon-btn" onclick="window.toggleTheme()" style="background: none; border: none; font-size: 1.15rem; color: var(--text); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; line-height: 1;" title="切換主題 / Toggle Theme">🌓</button>
        <button id="lang-toggle-btn" class="header-icon-btn" onclick="window.toggleLanguage()" style="background: none; border: none; font-size: 0.8rem; font-weight: 700; color: var(--primary); background: var(--accent-light); padding: 4px 8px; border-radius: 6px; cursor: pointer; border: 1px solid var(--border);" title="切換語言 / Switch Language">${activeLang === 'zh' ? 'EN' : '繁中'}</button>
        ${isLoggedIn ? `<span style="font-size: 0.85rem; font-weight: 700; color: var(--primary); background: var(--accent-light); padding: 4px 10px; border-radius: 99px;">${pointsInfo.points} P</span>` : ''}
      </div>
    </div>
 
    <div class="page-content" style="padding: 24px 16px;">
      <!-- Greeting Section -->
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 1.6rem; font-weight: 800; color: var(--text); line-height: 1.2; letter-spacing: -0.5px;">${window.t('hello')}${escapeHtml(userName)}</h2>
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 4px;">${window.t('slogan')}</p>
      </div>
 
      <!-- Quick Actions Grid -->
      <div style="margin-bottom: 28px;">
        <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 12px; letter-spacing: -0.3px;">${window.t('quickMenu')}</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <!-- Map Search -->
          <div class="card" onclick="router.navigate('/consumer/map')" style="cursor: pointer; padding: 20px 16px; margin: 0; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 8px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text);">${window.t('mapSearch')}</div>
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${window.t('findStore')}</p>
          </div>
 
          <!-- Scan Pay -->
          <div class="card" onclick="router.navigate('/consumer/scan')" style="cursor: pointer; padding: 20px 16px; margin: 0; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 8px;"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><line x1="7" y1="12" x2="17" y2="12"></line></svg>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text);">${window.t('scanPay')}</div>
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${window.t('directTrigger')}</p>
          </div>
 
          <!-- Orders List -->
          <div class="card" onclick="router.navigate('/consumer/orders')" style="cursor: pointer; padding: 20px 16px; margin: 0; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 8px;"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text);">${window.t('orders')}</div>
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${window.t('checkHistory')}</p>
          </div>
 
          <!-- Eco Points -->
          <div class="card" onclick="router.navigate('/consumer/points')" style="cursor: pointer; padding: 20px 16px; margin: 0; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 8px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text);">${window.t('pointsLabel')}</div>
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${window.t('pointsSub')}</p>
          </div>
        </div>
      </div>
 
      <!-- 附近惜食推薦 -->
      <div style="margin-bottom: 28px;">
        <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 12px; letter-spacing: -0.3px;">附近惜食推薦</h3>
        <div id="nearby-products-container" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; padding: 20px; background: rgba(28,27,26,0.02); border-radius: 12px;">
            正在搜尋附近惜食...
          </div>
        </div>
      </div>
 
      <!-- Sustainability Banner -->
      <div class="card" style="margin: 0; padding: 18px; border: 1px solid rgba(0, 128, 85, 0.15); background: var(--accent-light); height: 108px; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">${window.t('sdgAction')}</div>
        <p id="sdg-slogan" style="font-size: 0.92rem; font-weight: 700; color: var(--text); line-height: 1.45; margin: 0; transition: opacity 0.3s ease-in-out; opacity: 1;">${initialSdg}</p>
      </div>
    </div>
  `;
 
  renderPage(html);
 
  // 15. 載入附近惜食推薦 (非同步拉取資料庫未到期商品，並將智慧惜食機 MAC_01A2B3 完美融合成特選推薦項目)
  (async () => {
    try {
      const container = document.getElementById('nearby-products-container');
      if (!container) return;
 
      const data = await api.getProducts({ source: 'map' });
      const products = data.products || data || [];
 
      const isExpiredProduct = (product) => {
        if (!product) return false;
        if (String(product.status || '').toUpperCase() === 'EXPIRED') return true;
        if (!product.expiresAt) return false;
        const expiresAt = new Date(product.expiresAt).getTime();
        return Number.isFinite(expiresAt) && expiresAt <= Date.now();
      };
 
      // 過濾出未過期的即期惜食商品
      const activeProducts = products.filter(p => !isExpiredProduct(p));
 
      // 建立智慧惜食機特選推薦卡片 HTML
      const machineCardHTML = `
          <!-- Combined Vending Machine Featured Card -->
          <div class="card" onclick="router.navigate('/consumer/scan')" style="cursor: pointer; padding: 18px 20px; margin: 0; border: 1.5px solid rgba(0, 128, 85, 0.25); background: linear-gradient(135deg, var(--surface) 0%, rgba(0, 128, 85, 0.03) 100%); box-shadow: var(--shadow-md); transition: transform 0.2s ease, border-color 0.2s ease; position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 12px;">
            <!-- Glow background effect -->
            <div style="position: absolute; top: -50px; right: -50px; width: 120px; height: 120px; background: radial-gradient(circle, rgba(0,128,85,0.08) 0%, transparent 70%); pointer-events: none;"></div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.7rem; font-weight: 800; background: var(--primary); color: #fff; padding: 2px 8px; border-radius: 99px; letter-spacing: 0.5px; box-shadow: var(--shadow-sm); text-transform: uppercase; animation: pulse-border 1.5s infinite;">LIVE</span>
                <span style="font-size: 0.95rem; font-weight: 800; color: var(--text);">🤖 ${window.t('liveStatus')}</span>
              </div>
              <span style="font-size: 0.78rem; font-weight: 800; color: var(--primary); background: rgba(0, 128, 85, 0.1); padding: 2px 8px; border-radius: 6px;">${statusLabel}</span>
            </div>
            
            <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px dashed var(--border); padding-top: 12px; margin-top: 2px;">
              <div style="text-align: left;">
                <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary);">${window.t('stockedCount', { count: activeSlots })}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 1px;">即期驚喜扭蛋 & 直購</div>
              </div>
              <div style="display: flex; align-items: center; gap: 4px; font-size: 0.8rem; font-weight: 700; color: var(--primary);">
                <span>去購買</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </div>
            </div>
          </div>
      `;
 
      let storeProductsHTML = '';
      if (activeProducts.length === 0) {
        storeProductsHTML = `
          <div style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; padding: 20px; background: rgba(28,27,26,0.02); border-radius: 12px; border: 1px dashed var(--border); margin-top: 12px;">
            📍 附近暫時沒有其他惜食商品喔！
          </div>
        `;
      } else {
        // 展示前兩個最接近的實體店家商品
        const nearbyList = activeProducts.slice(0, 2);
        
        const getCategoryEmoji = (cat) => {
          if (cat === 'bento') return '🍱';
          if (cat === 'bread') return '🍞';
          if (cat === 'vegetable') return '🥗';
          return '🍎';
        };
 
        storeProductsHTML = nearbyList.map(p => {
          const storeName = p.storeName || (p.store && p.store.name) || '未知店家';
          const storeId = p.storeId || (p.store && p.store.id) || '';
          const originalPrice = p.originalPrice || p.price || 0;
          const sellingPrice = p.sellingPrice || p.price || 0;
          const category = p.category || 'other';
 
          return `
            <div class="card" onclick="router.navigate('/consumer/store/${storeId}')" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; margin: 0; border: 1px solid var(--border); box-shadow: var(--shadow-sm); transition: transform 0.2s ease; background: var(--surface);">
              <div style="display: flex; align-items: center; gap: 12px; overflow: hidden; flex: 1;">
                <div style="font-size: 1.8rem; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: rgba(0, 128, 85, 0.06); border-radius: 10px;">
                  ${getCategoryEmoji(category)}
                </div>
                <div style="overflow: hidden; flex: 1; text-align: left;">
                  <div style="font-size: 0.92rem; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.name)}</div>
                  <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📍 ${escapeHtml(storeName)}</div>
                </div>
              </div>
              
              <div style="text-align: right; margin-left: 12px; min-width: 80px;">
                <div style="font-size: 0.92rem; font-weight: 800; color: var(--primary);">NT$${sellingPrice}</div>
                <div style="font-size: 0.72rem; color: var(--text-secondary); text-decoration: line-through; margin-top: 1px;">NT$${originalPrice}</div>
              </div>
            </div>
          `;
        }).join('');
      }
 
      container.innerHTML = machineCardHTML + storeProductsHTML;
 
    } catch (err) {
      console.error('載入附近惜食推薦失敗:', err);
      const container = document.getElementById('nearby-products-container');
      if (container) {
        container.innerHTML = `
          <div style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; padding: 24px;">
            ⚠️ 無法載入推薦惜食商品
          </div>
        `;
      }
    }
  })();

  // SDGs 永續目標多句循環播放邏輯 (每 5.5 秒切換，帶漸隱漸顯動畫)
  let sdgIndex = 0;
  
  const sdgTimer = setInterval(() => {
    if (location.hash !== '#/consumer/home') {
      clearInterval(sdgTimer);
      return;
    }
    const sdgEl = document.getElementById('sdg-slogan');
    if (sdgEl) {
      // 1. 漸隱
      sdgEl.style.opacity = 0;
      // 2. 更換文字並漸顯
      setTimeout(() => {
        sdgIndex = (sdgIndex + 1) % sdgMessages[window.i18n.currentLang].length;
        sdgEl.textContent = sdgMessages[window.i18n.currentLang][sdgIndex];
        sdgEl.style.opacity = 1;
      }, 350);
    }
  }, 5500);
}
