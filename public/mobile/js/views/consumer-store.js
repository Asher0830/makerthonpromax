/* ═══════════════════════════════════════════════════
   FoodD Mobile — Consumer Store Page
   ═══════════════════════════════════════════════════ */

async function renderConsumerStorePage(storeId) {
  updateBottomNav('map');
  showLoading();

  let storeResponse = null;
  let products = [];

  try {
    storeResponse = await api.getStore(storeId);
  } catch (err) {
    hideLoading();
    showToast('無法載入店家資料', 'error');
    renderPage(`
      <div class="page-header">
        <button class="header-back" onclick="router.navigate('/consumer/map')">←</button>
        <h1 class="header-title">店家資訊</h1>
      </div>
      <div class="page-content">
        <div class="empty-state">
          <div class="empty-state-text">無法載入店家資料</div>
        </div>
      </div>
    `);
    return;
  }

  try {
    const data = await api.getStoreProducts(storeId);
    products = data.products || data || [];
  } catch (err) {
    console.error('Failed to load store products:', err);
  }

  hideLoading();

  const isExpiredProduct = (product) => {
    if (!product) return false;
    if (String(product.status || '').toUpperCase() === 'EXPIRED') return true;
    if (!product.expiresAt) return false;
    const expiresAt = new Date(product.expiresAt).getTime();
    return Number.isFinite(expiresAt) && expiresAt <= Date.now();
  };

  products = products.filter((product) => !isExpiredProduct(product));

  const storeObj = storeResponse?.store || storeResponse || {};
  const storeName = storeObj.name || '店家';
  const storeAddress = storeObj.address || '';
  const storePhone = storeObj.phone || '';

  /* ── Build product cards ── */
  let productListHTML = '';

  if (products.length === 0) {
    productListHTML = `
      <div class="empty-state">
        <div class="empty-state-text">目前沒有商品</div>
      </div>
    `;
  } else {
    productListHTML = products.map((product) => {
      const category = product.category || 'other';
      const originalPrice = product.originalPrice || product.price || 0;
      const sellingPrice = product.sellingPrice || product.price || 0;
      const allergens = product.allergens || [];

      /* Expiry countdown */
      let expiryHTML = '';
      if (product.expiresAt) {
        const expiresAt = new Date(product.expiresAt).getTime();
        const now = Date.now();
        const hoursRemaining = Math.max(0, (expiresAt - now) / (1000 * 60 * 60));
        const isUrgent = hoursRemaining < 2;

        if (hoursRemaining <= 0) {
          expiryHTML = `<span class="expiry-tag expiry-urgent">已過期</span>`;
        } else if (hoursRemaining < 1) {
          const mins = Math.ceil(hoursRemaining * 60);
          expiryHTML = `<span class="expiry-tag ${isUrgent ? 'expiry-urgent' : 'expiry-normal'}">剩餘 ${mins} 分鐘</span>`;
        } else {
          const hrs = Math.floor(hoursRemaining);
          const mins = Math.ceil((hoursRemaining - hrs) * 60);
          expiryHTML = `<span class="expiry-tag ${isUrgent ? 'expiry-urgent' : 'expiry-normal'}">剩餘 ${hrs} 小時 ${mins} 分鐘</span>`;
        }
      }

      /* Allergen pills */
      const allergenHTML = allergens.length
        ? `<div class="allergen-list">${allergens.map((a) => `<span class="allergen-tag">${a}</span>`).join('')}</div>`
        : '';

      /* Category badge label */
      const categoryLabels = {
        bento: '便當',
        bread: '麵包',
        vegetable: '蔬菜',
        other: '其他',
      };

      return `
        <div class="card product-card">
          <div class="product-card-body">
            <div class="product-card-top">
              <span class="product-name">${product.name || '商品'}</span>
              <span class="badge badge-${category}">${categoryLabels[category] || category}</span>
            </div>

            <div class="product-price">
              <span class="price-original">NT$${originalPrice}</span>
              <span class="price-selling">NT$${sellingPrice}</span>
            </div>

            ${allergenHTML}
            ${expiryHTML}
          </div>

          <button class="btn btn-primary btn-sm product-buy-btn"
                  onclick="handleBuyProduct('${product.id}')">
            購買
          </button>
        </div>
      `;
    }).join('');
  }

  const html = `
    <div class="page-header" style="display: flex; align-items: center; padding: 12px 16px; width: 100%;">
      <button class="back-btn" onclick="router.navigate('/consumer/map')" style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: var(--accent-light, rgba(0, 128, 85, 0.06)); border: 1px solid var(--border); color: var(--text); font-size: 1.15rem; cursor: pointer; transition: all 0.2s ease; box-shadow: var(--shadow-sm); flex-shrink: 0; padding: 0; margin-right: 8px;" title="返回地圖">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
      </button>
      <h1 class="header-title" style="font-size: 1.3rem; font-weight: 800; color: var(--text); margin: 0; letter-spacing: -0.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(storeName)}</h1>
    </div>

    <div class="page-content" style="padding: 16px;">
      ${(storeAddress || storePhone) ? `
        <div class="card store-info-card" style="margin-bottom: 20px; padding: 16px; border: 1px solid var(--border); background: var(--surface);">
          ${storeAddress ? `<div class="store-info-row" style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 8px; display: flex; align-items: center; gap: 8px; text-align: left;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> 地址: ${escapeHtml(storeAddress)}</div>` : ''}
          ${storePhone ? `<div class="store-info-row" style="font-size: 0.9rem; color: var(--text-secondary); display: flex; align-items: center; gap: 8px; text-align: left;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> 電話: ${escapeHtml(storePhone)}</div>` : ''}
        </div>
      ` : ''}

      <div class="product-list" style="padding-bottom: 96px;">
        ${productListHTML}
      </div>
    </div>
  `;

  renderPage(html);

  /* ── Buy handler with double-click prevention ── */
  window._buyingProduct = false;
  window.handleBuyProduct = async function (productId) {
    if (window._buyingProduct) return;
    window._buyingProduct = true;

    // 立即將所有購買按鈕設為停用狀態，防止重複連點發送多筆請求
    const buyButtons = document.querySelectorAll('.product-buy-btn');
    buyButtons.forEach(btn => btn.disabled = true);

    try {
      showLoading();
      const order = await api.createOrder({ productId, source: 'map_purchase' });
      hideLoading();
      router.navigate('/consumer/pay/' + order.id);
    } catch (err) {
      hideLoading();
      showToast(err.message || '購買失敗，請稍後再試', 'error');
    } finally {
      window._buyingProduct = false;
      buyButtons.forEach(btn => btn.disabled = false);
    }
  };
}
