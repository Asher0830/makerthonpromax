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
          <div class="empty-state-text">無法載入訂單</div>
        </div>
      </div>
    `);
    return;
  }

  hideLoading();

  const productName = order.productName || order.product_name || '惜食商品';
  const amount = order.amount || order.price || 0;
  const orderSource = order.order_type || order.source || order.type || 'map_purchase';

  const isGacha = orderSource === 'machine_gacha';
  const isLoggedIn = authManager.isLoggedIn();

  // 付款方式選項 HTML (僅展示與視覺切換)
  const paymentMethodsHTML = `
    <div class="payment-methods" style="margin-top: 20px; margin-bottom: 20px; text-align: left;">
      <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); margin-bottom: 10px; letter-spacing: -0.3px;">選擇付款方式 (展示專用)</div>
      
      <div class="pay-method-option active" data-method="LINE Pay" onclick="selectPaymentOption(this)" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid var(--primary-color); border-radius: 8px; background: var(--bg-secondary); margin-bottom: 8px; cursor: pointer; transition: all 0.2s ease;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="pay-dot" style="width: 8px; height: 8px; border-radius: 50%; background: var(--primary-color); transition: all 0.2s ease;"></div>
          <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary); transition: all 0.2s ease;">LINE Pay</span>
        </div>
        <span style="font-size: 0.75rem; color: var(--primary-color); font-weight: 600;">推薦</span>
      </div>

      <div class="pay-method-option" data-method="Apple Pay" onclick="selectPaymentOption(this)" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid rgba(28,27,26,0.08); border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s ease;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="pay-dot" style="width: 8px; height: 8px; border-radius: 50%; border: 1px solid rgba(28,27,26,0.2); transition: all 0.2s ease;"></div>
          <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-primary); transition: all 0.2s ease;">Apple Pay</span>
        </div>
      </div>

      <div class="pay-method-option" data-method="信用卡" onclick="selectPaymentOption(this)" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid rgba(28,27,26,0.08); border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s ease;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="pay-dot" style="width: 8px; height: 8px; border-radius: 50%; border: 1px solid rgba(28,27,26,0.2); transition: all 0.2s ease;"></div>
          <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-primary); transition: all 0.2s ease;">信用卡 / 簽帳卡</span>
        </div>
      </div>

      <div class="pay-method-option" data-method="FoodD 餘額" onclick="selectPaymentOption(this)" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid rgba(28,27,26,0.08); border-radius: 8px; cursor: pointer; transition: all 0.2s ease;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="pay-dot" style="width: 8px; height: 8px; border-radius: 50%; border: 1px solid rgba(28,27,26,0.2); transition: all 0.2s ease;"></div>
          <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-primary); transition: all 0.2s ease;">FoodD 餘額支付</span>
        </div>
        <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">$0</span>
      </div>
    </div>
  `;

  const buttonHTML = isGacha && !isLoggedIn
    ? `
      <button class="btn btn-primary btn-block btn-lg pay-btn" id="pay-btn"
              onclick="redirectToLoginForGacha('${orderId}')">
        登入會員以進行抽獎
      </button>
    `
    : `
      <button class="btn btn-primary btn-block btn-lg pay-btn" id="pay-btn"
              onclick="handlePayment('${orderId}', '${orderSource}')">
        確認付款 (LINE Pay)
      </button>
    `;

  const html = `
    <div class="page-header">
      <h1 class="header-title">付款</h1>
    </div>

    <div class="page-content" id="pay-content">
      <div class="card pay-summary-card">
        <div class="pay-product-name">${productName}</div>
        <div class="pay-amount">NT$${amount}</div>
      </div>

      ${paymentMethodsHTML}
      ${buttonHTML}
    </div>
  `;

  renderPage(html);

  /* ── Payment Option Switcher ── */
  window.selectPaymentOption = function (el) {
    // Reset all options
    document.querySelectorAll('.pay-method-option').forEach(option => {
      option.classList.remove('active');
      option.style.borderColor = 'rgba(28,27,26,0.08)';
      option.style.background = 'transparent';
      option.querySelector('span').style.fontWeight = '500';
      const dot = option.querySelector('.pay-dot');
      dot.style.background = 'transparent';
      dot.style.border = '1px solid rgba(28,27,26,0.2)';
    });

    // Set selected active
    el.classList.add('active');
    el.style.borderColor = 'var(--primary-color)';
    el.style.background = 'var(--bg-secondary)';
    el.querySelector('span').style.fontWeight = '600';
    const activeDot = el.querySelector('.pay-dot');
    activeDot.style.background = 'var(--primary-color)';
    activeDot.style.border = 'none';

    // Update main pay button text dynamically
    const payBtn = document.getElementById('pay-btn');
    if (payBtn && payBtn.textContent.trim() !== '登入會員以進行抽獎') {
      const methodName = el.getAttribute('data-method');
      payBtn.textContent = `確認付款 (${methodName})`;
    }
  };

  /* ── Redirect handler ── */
  window.redirectToLoginForGacha = function (oid) {
    localStorage.setItem('redirect_after_login', `#/consumer/pay/${oid}`);
    router.navigate('/login');
  };

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

      if (source === 'machine_purchase' || source === 'machine_gacha') {
        instructionHTML = `
          <p class="success-subtitle" style="font-weight: 700; color: var(--primary-color);">請至機台轉動實體旋鈕以啟動抽獎或取餐！</p>
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
          <div class="success-icon" style="font-size: 2.5rem; color: var(--primary-color); font-weight: 700; margin-bottom: 12px;">✓</div>
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
