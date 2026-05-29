/* ═══════════════════════════════════════════════════
   FoodD Mobile — Consumer Store Page
   ═══════════════════════════════════════════════════ */

async function renderConsumerStorePage(storeId) {
  updateBottomNav('map');
  showLoading();

  let store = null;
  let products = [];

  try {
    store = await api.getStore(storeId);
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

  const storeName = store.name || '店家';
  const storeAddress = store.address || '';
  const storePhone = store.phone || '';

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
    <div class="page-header">
      <button class="header-back" onclick="router.navigate('/consumer/map')">←</button>
      <h1 class="header-title">${storeName}</h1>
    </div>

    <div class="page-content">
      <div class="card store-info-card">
        ${storeAddress ? `<div class="store-info-row" style="font-size: var(--fs-body); color: var(--text-secondary); margin-bottom: 8px;">地址: ${storeAddress}</div>` : ''}
        ${storePhone ? `<div class="store-info-row" style="font-size: var(--fs-body); color: var(--text-secondary);">電話: ${storePhone}</div>` : ''}
      </div>

      <div class="product-list">
        ${productListHTML}
      </div>
    </div>
  `;

  renderPage(html);

  /* ── Buy handler ── */
  window.handleBuyProduct = async function (productId) {
    try {
      showLoading();
      const order = await api.createOrder({ productId, source: 'map_purchase' });
      hideLoading();
      router.navigate('/consumer/pay/' + order.id);
    } catch (err) {
      hideLoading();
      showToast(err.message || '購買失敗，請稍後再試', 'error');
    }
  };
}
