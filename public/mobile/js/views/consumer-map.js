/* ═══════════════════════════════════════════════════
   FoodD Mobile — Consumer Map Page (Hero)
   ═══════════════════════════════════════════════════ */

/* Category helpers (getCategoryColor, getCategoryEmoji) are defined in app.js */

async function renderConsumerMapPage() {
  // 安全清理所有舊地圖實例與全域變數，防止 Leaflet 容器綁定衝突或生命週期銷毀報錯
  if (window._leafletMap) {
    try {
      window._leafletMap.remove();
    } catch (e) {
      console.warn('[Leaflet] 銷毀舊 _leafletMap 實例時發生錯誤:', e);
    }
    window._leafletMap = null;
  }
  if (window._mapInstance) {
    try {
      window._mapInstance.remove();
    } catch (e) {
      console.warn('[Leaflet] 銷毀舊 _mapInstance 實例時發生錯誤:', e);
    }
    window._mapInstance = null;
  }

  updateBottomNav('map');

  // 初始化坐標收集陣列，用於自動適配地圖視野
  window._latLngsForFitting = [];

  // 全域定位我的位置輔助函式
  window.locateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          if (window._mapInstance) {
            window._mapInstance.setView([latitude, longitude], 15);
            // 用戶目前位置標記
            L.circleMarker([latitude, longitude], {
              radius: 8,
              fillColor: '#4285F4',
              fillOpacity: 1,
              color: '#fff',
              weight: 3,
            }).addTo(window._mapInstance).bindPopup('目前位置');
            showToast('已定位至目前位置', 'success');
          }
        },
        () => {
          showToast('無法取得目前定位', 'warning');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      showToast('瀏覽器不支援定位功能', 'warning');
    }
  };

  // 全域適配所有商店與機台視野輔助函式
  window.fitAllStores = () => {
    if (window._latLngsForFitting && window._latLngsForFitting.length > 0 && window._mapInstance) {
      const bounds = L.latLngBounds(window._latLngsForFitting);
      window._mapInstance.fitBounds(bounds, { padding: [50, 50] });
      showToast('已調整視野以顯示所有店家與機台', 'info');
    } else {
      showToast('無可用店家或機台資料', 'warning');
    }
  };

  const html = `
    <div id="map-container" style="position:relative; width:100%; height:calc(100dvh - var(--nav-height)); overflow:hidden;">
      <div class="map-search-bar">
        <span class="map-search-icon">⌕</span>
        <input
          type="text"
          class="map-search-input"
          placeholder="搜尋附近惜食商品"
          readonly
        />
      </div>

      <div id="map" style="width:100%; height:100%;"></div>

      <!-- Floating Controls Group (Locate & Fit All) -->
      <div class="map-controls" style="position: absolute; bottom: 84px; left: 16px; z-index: 1000; display: flex; flex-direction: column; gap: 10px;">
        <!-- Locate Button -->
        <button onclick="window.locateUser()" style="width: 44px; height: 44px; border: 1px solid var(--border); border-radius: 50%; background: var(--surface); color: var(--text); box-shadow: 0 4px 12px rgba(0,0,0,0.12); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" title="我的位置">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="3"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
          </svg>
        </button>
        <!-- Fit Bounds Button -->
        <button onclick="window.fitAllStores()" style="width: 44px; height: 44px; border: 1px solid var(--border); border-radius: 50%; background: var(--surface); color: var(--text); box-shadow: 0 4px 12px rgba(0,0,0,0.12); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" title="顯示所有店面">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
      </div>

      <!-- Floating Scan QR Button with SVG upgraded -->
      <button class="map-scan-btn" onclick="router.navigate('/consumer/scan')" style="position: absolute; bottom: 84px; right: 16px; z-index: 1000; border: none; border-radius: 20px; font-family: 'Outfit', sans-serif; font-size: 0.85rem; font-weight: 700; color: #fff; background: var(--primary-color); padding: 10px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.12); cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s ease-in-out;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
          <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
          <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
          <path d="M3 17v2a2 2 0 0 0 2 2h2"></path>
          <line x1="5" y1="12" x2="19" y2="12" stroke="red"></line>
        </svg>
        <span>掃碼起用/付款</span>
      </button>

      <div class="map-float-card" id="map-float-card">
        <span class="map-float-label" style="font-weight:700; color:var(--primary-color); margin-right:6px;">[惜食]</span>
        <span class="map-float-text">附近有 <strong id="product-count">0</strong> 個惜食商品</span>
      </div>
    </div>
  `;

  renderPage(html);

  /* ── Default center: Zuoying Station ── */
  const defaultCenter = [22.6855, 120.3028];
  const defaultZoom = 14;

  /* ── Initialize or reuse map ── */
  let map = window._mapInstance;

  if (map) {
    /* Map already exists — move to existing container */
    const mapDiv = document.getElementById('map');
    if (mapDiv) {
      try {
        map.invalidateSize();
      } catch (_) { /* ignore */ }
    }
  } else {
    /* Create new map */
    map = L.map('map', {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    /* Position zoom control to top-right to prevent collision with SCAN button */
    L.control.zoom({ position: 'topright' }).addTo(map);

    window._mapInstance = map;
    window._leafletMap = map;
  }

  /* ── Geolocate user ── */
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 15);

        /* User location marker */
        L.circleMarker([latitude, longitude], {
          radius: 8,
          fillColor: '#4285F4',
          fillOpacity: 1,
          color: '#fff',
          weight: 3,
        }).addTo(map).bindPopup('目前位置');
      },
      () => {
        /* Geolocation denied — stay at default */
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }

  /* ── Clear old markers ── */
  if (window._mapMarkers) {
    window._mapMarkers.forEach((m) => map.removeLayer(m));
  }
  window._mapMarkers = [];

  /* ── Fetch products and populate markers ── */
  try {
    const data = await api.getProducts({ source: 'map' });
    const products = data.products || data || [];
    let markerCount = 0;

    const isExpiredProduct = (product) => {
      if (!product) return false;
      if (String(product.status || '').toUpperCase() === 'EXPIRED') return true;
      if (!product.expiresAt) return false;
      const expiresAt = new Date(product.expiresAt).getTime();
      return Number.isFinite(expiresAt) && expiresAt <= Date.now();
    };

    products.forEach((product) => {
      if (isExpiredProduct(product)) return;

      const lat = product.lat || (product.store && product.store.lat);
      const lng = product.lng || (product.store && product.store.lng);

      if (!lat || !lng) return; /* Skip products without coordinates */

      window._latLngsForFitting.push([lat, lng]);

      const category = product.category || 'other';
      const storeName = (product.store && product.store.name) || product.storeName || '未知店家';
      const storeId = product.storeId || (product.store && product.store.id) || '';

      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="marker-icon" style="border-color: ${getCategoryColor(category)}">${getCategoryEmoji(category)}</div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(map);

      const originalPrice = product.originalPrice || product.price || 0;
      const sellingPrice = product.sellingPrice || product.price || 0;

      marker.bindPopup(`
        <div class="map-popup">
          <div class="popup-title">${escapeHtml(product.name) || '惜食商品'}</div>
          <div class="popup-store">${escapeHtml(storeName)}</div>
          <div class="popup-price">
            <span class="price-original">NT$${originalPrice}</span>
            <span class="price-selling">NT$${sellingPrice}</span>
          </div>
          <button class="btn btn-primary btn-sm popup-btn"
                  onclick="router.navigate('/consumer/store/${storeId}')">
            查看店家
          </button>
        </div>
      `, { className: 'custom-popup' });

      window._mapMarkers.push(marker);
      markerCount++;
    });

    // ── Fetch and display vending machines ──
    try {
      const machines = await api.getMachines();
      const machineList = machines || [];

      machineList.forEach((mac) => {
        const lat = mac.latitude;
        const lng = mac.longitude;

        if (!lat || !lng) return;

        window._latLngsForFitting.push([lat, lng]);

        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div class="marker-icon marker-icon-machine">🎰</div>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });

        const marker = L.marker([lat, lng], { icon }).addTo(map);

        const statusMap = {
          IDLE: '正常運行中',
          WAITING_FOR_PAYMENT: '待付款中',
          WAITING_FOR_TRIGGER: '請轉動旋鈕！',
          DISPENSING: '出餐中',
          ERROR: '維護中',
        };
        const statusLabel = statusMap[mac.status] || mac.status || '正常運行中';

        marker.bindPopup(`
          <div class="map-popup">
            <div class="popup-title">[機台] ${escapeHtml(mac.name) || '智慧惜食機'}</div>
            <div class="popup-store">${escapeHtml(mac.location_desc) || '裝設位置'}</div>
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--primary-color); margin: 6px 0 10px 0;">狀態：${escapeHtml(statusLabel)}</div>
            <button class="btn btn-primary btn-sm popup-btn"
                    onclick="router.navigate('/consumer/scan')">
              前往機台/掃碼付款
            </button>
          </div>
        `, { className: 'custom-popup' });

        window._mapMarkers.push(marker);
        markerCount++;
      });
    } catch (macErr) {
      console.warn('Failed to load map machines:', macErr);
    }

    /* Update floating count */
    const countEl = document.getElementById('product-count');
    if (countEl) {
      countEl.textContent = markerCount;
    }

    /* 自動適配所有標記，將地圖視野縮放至包含全部 Taipei 與 Kaohsiung 店家 */
    if (window._latLngsForFitting && window._latLngsForFitting.length > 0) {
      setTimeout(() => {
        if (map) {
          const bounds = L.latLngBounds(window._latLngsForFitting);
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      }, 100);
    }
  } catch (err) {
    console.error('Failed to load map products/machines:', err);
    showToast('無法載入地圖資料', 'error');
  }

  /* ── Ensure map renders correctly ── */
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 300);
}
