/* ═══════════════════════════════════════════════════
   FoodD Mobile — Consumer Map Page (Hero)
   ═══════════════════════════════════════════════════ */

/* Category helpers (getCategoryColor, getCategoryEmoji) are defined in app.js */

async function renderConsumerMapPage() {
  updateBottomNav('map');

  const html = `
    <div id="map-container" style="position:relative; width:100%; height:100vh;">
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

      <!-- Floating Scan QR Button -->
      <button class="map-scan-btn" onclick="router.navigate('/consumer/scan')" style="position: absolute; bottom: 90px; right: 16px; z-index: 1000; border: none; border-radius: 20px; font-family: 'Outfit', sans-serif; font-size: 0.85rem; font-weight: 700; color: #fff; background: var(--primary-color); padding: 10px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.12); cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s ease-in-out;">
        <span>[SCAN]</span> 掃碼起用/付款
      </button>

      <div class="map-float-card" id="map-float-card">
        <span class="map-float-label" style="font-weight:700; color:var(--primary-color); margin-right:6px;">[惜食]</span>
        <span class="map-float-text">附近有 <strong id="product-count">0</strong> 個惜食商品</span>
      </div>
    </div>
  `;

  renderPage(html);

  /* ── Default center: Taipei ── */
  const defaultCenter = [25.033, 121.565];
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

    /* Position zoom control to bottom-right */
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    window._mapInstance = map;
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
          <div class="popup-title">${product.name || '惜食商品'}</div>
          <div class="popup-store">${storeName}</div>
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

    /* Update floating count */
    const countEl = document.getElementById('product-count');
    if (countEl) {
      countEl.textContent = markerCount;
    }
  } catch (err) {
    console.error('Failed to load map products:', err);
    showToast('無法載入商品資料', 'error');
  }

  /* ── Ensure map renders correctly ── */
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 300);
}
