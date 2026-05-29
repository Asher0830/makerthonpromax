/* ═══════════════════════════════════════════════════
   FoodD Mobile — Consumer Payment Page
   ═══════════════════════════════════════════════════ */

async function renderConsumerPayPage(orderId) {
  updateBottomNav('orders');
  showLoading();

  let order = null;

  try {
    order = await api.getOrder(orderId);
  } catch (err) {
    hideLoading();
    showToast('無法載入訂單資料', 'error');
    renderPage(`
      <div class="page-header">
        <h1 class="header-title">付款</h1>
      </div>
      <div class="page-content">
        <div class="empty-state">
          <div class="empty-state-icon">😵</div>
          <div class="empty-state-text">無法載入訂單</div>
        </div>
      </div>
    `);
    return;
  }

  hideLoading();

  const productName = order.productName || order.product?.name || '惜食商品';
  const amount = order.amount || order.price || 0;
  const orderSource = order.source || order.type || 'map_purchase';

  const html = `
    <div class="page-header">
      <h1 class="header-title">付款</h1>
    </div>

    <div class="page-content" id="pay-content">
      <div class="card pay-summary-card">
        <div class="pay-product-name">${productName}</div>
        <div class="pay-amount">NT$${amount}</div>
      </div>

      <button class="btn btn-primary btn-block btn-lg pay-btn" id="pay-btn"
              onclick="handlePayment('${orderId}', '${orderSource}')">
        💳 模擬付款
      </button>
    </div>
  `;

  renderPage(html);

  /* ── Payment handler ── */
  window.handlePayment = async function (oid, source) {
    const payBtn = document.getElementById('pay-btn');
    if (payBtn) payBtn.disabled = true;

    try {
      showLoading();
      const result = await api.processPayment(oid);
      hideLoading();

      /* Build success screen */
      const pickupCode = result.pickupCode || order.pickupCode || '';

      let instructionHTML = '';

      if (source === 'machine_purchase') {
        instructionHTML = `
          <p class="success-subtitle">請至機台轉動旋鈕取貨</p>
        `;
      } else {
        /* map_purchase or default */
        instructionHTML = pickupCode
          ? `
            <div class="pickup-code">${pickupCode}</div>
            <p class="success-subtitle">請出示此取貨碼給店家</p>
          `
          : `<p class="success-subtitle">請前往店家取貨</p>`;
      }

      const successHTML = `
        <div class="success-screen">
          <div class="success-icon">✅</div>
          <h2 class="success-title">付款成功！</h2>
          ${instructionHTML}
          <button class="btn btn-secondary btn-block" onclick="router.navigate('/consumer/orders')">
            查看訂單
          </button>
        </div>
      `;

      const contentEl = document.getElementById('pay-content');
      if (contentEl) {
        contentEl.innerHTML = successHTML;
      }
    } catch (err) {
      hideLoading();
      if (payBtn) payBtn.disabled = false;
      showToast(err.message || '付款失敗，請稍後再試', 'error');
    }
  };
}
