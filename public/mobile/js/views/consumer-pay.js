/* ═══════════════════════════════════════════════════
   FoodD Mobile — Consumer Payment Page
   ═══════════════════════════════════════════════════ */

async function renderConsumerPayPage(orderId) {
  if (!authManager.isLoggedIn()) {
    localStorage.setItem('redirect_after_login', location.hash);
    router.navigate('/login');
    return;
  }
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
  const orderType = order.order_type || order.orderType || order.source || order.type || 'map_purchase';

  // 若訂單先前已經付款成功，則直接顯示付款成功畫面，避免再次付款顯示「非待付款」
  if (['WAITING_FOR_TRIGGER', 'DISPENSING', 'COMPLETED', 'PAID'].includes(order.status)) {
    hideLoading();
    const pickupCode = escapeHtml(order.pickup_code || order.pickupCode || '');
    const hasDispensed = ['DISPENSING', 'COMPLETED'].includes(order.status);

    let instructionHTML = '';
    if (hasDispensed) {
      instructionHTML = `<p class="success-subtitle" style="font-weight: 700; color: var(--primary-color);">實體機台已成功出餐！祝您用餐愉快！</p>`;
    } else if (orderType === 'machine_gacha') {
      instructionHTML = `<p class="success-subtitle" style="font-weight: 700; color: var(--primary-color);">請至機台轉動實體旋鈕以開始扭蛋抽獎！</p>`;
    } else if (orderType === 'machine_purchase') {
      instructionHTML = `<p class="success-subtitle" style="font-weight: 700; color: var(--primary-color);">請至機台轉動旋鈕以開啟已購買的艙門並取餐！</p>`;
    } else {
      instructionHTML = pickupCode ? `<div class="pickup-code">${pickupCode}</div><p class="success-subtitle">請出示此取貨碼給店家</p>` : '<p class="success-subtitle">請前往店家取貨</p>';
    }

    renderPage(`
      <div class="page-header">
        <h1 class="header-title">付款</h1>
      </div>
      <div class="page-content">
        <div class="success-screen">
          <div class="success-icon" style="font-size: 2.5rem; color: var(--primary-color); font-weight: 700; margin-bottom: 12px;">✓</div>
          <h2 class="success-title">付款成功！</h2>
          ${instructionHTML}
          <div style="display:flex; gap:8px; flex-direction:column;">
            <button class="btn btn-secondary btn-block" onclick="router.navigate('/consumer/orders')">
              查看訂單
            </button>
          </div>
        </div>
      </div>
    `);
    return;
  }

  const isGacha = orderType === 'machine_gacha';
  const isLoggedIn = authManager.isLoggedIn();

  // 付款方式選項 HTML (僅展示與視覺切換)
  const paymentMethodsHTML = `
    <style>
      .pay-method-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        border: 1px solid rgba(28,27,26,0.08);
        border-radius: 8px;
        margin-bottom: 8px;
        cursor: pointer;
        background: transparent;
        transition: all 0.2s ease-in-out;
      }
      .pay-method-option:last-child {
        margin-bottom: 0;
      }
      .pay-method-option:hover {
        border-color: rgba(0, 128, 85, 0.2);
        background: rgba(0, 128, 85, 0.02);
      }
      .pay-method-option.active {
        border-color: var(--primary-color) !important;
        background-color: var(--bg-secondary) !important;
      }
      .pay-method-option .pay-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        border: 1px solid rgba(28,27,26,0.2);
        background: transparent;
        transition: all 0.2s ease-in-out;
      }
      .pay-method-option.active .pay-dot {
        border-color: transparent !important;
        background-color: var(--primary-color) !important;
      }
      .pay-method-option .pay-text {
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--text-secondary);
        transition: all 0.2s ease-in-out;
      }
      .pay-method-option.active .pay-text {
        font-weight: 600 !important;
        color: var(--text-primary) !important;
      }
      .pay-method-option .pay-tag {
        font-size: 0.75rem;
        color: var(--primary-color);
        font-weight: 600;
      }
    </style>

    <div class="payment-methods" style="margin-top: 20px; margin-bottom: 20px; text-align: left;">
      <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); margin-bottom: 12px; letter-spacing: -0.3px;">選擇付款方式 (展示專用)</div>
      
      <div class="pay-method-option active" data-method="LINE Pay" onclick="selectPaymentOption(this)">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="pay-dot"></div>
          <span class="pay-text">LINE Pay</span>
        </div>
        <span class="pay-tag">推薦</span>
      </div>

      <div class="pay-method-option" data-method="Apple Pay" onclick="selectPaymentOption(this)">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="pay-dot"></div>
          <span class="pay-text">Apple Pay</span>
        </div>
      </div>

      <div class="pay-method-option" data-method="信用卡" onclick="selectPaymentOption(this)">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="pay-dot"></div>
          <span class="pay-text">信用卡 / 簽帳卡</span>
        </div>
      </div>

      <div class="pay-method-option" data-method="FoodD 餘額" onclick="selectPaymentOption(this)">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="pay-dot"></div>
          <span class="pay-text">FoodD 餘額支付</span>
        </div>
        <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">$0</span>
      </div>
    </div>
  `;

  const buttonHTML = `
      <button class="btn btn-primary btn-block btn-lg pay-btn" id="pay-btn"
              onclick="handlePayment('${orderId}', '${orderType}')">
        確認付款 (LINE Pay)
      </button>
    `;

  const html = `
    <div class="page-header">
      <h1 class="header-title">付款</h1>
    </div>

    <div class="page-content" id="pay-content">
      <div class="card pay-summary-card">
        <div class="pay-product-name">${escapeHtml(productName)}</div>
        <div class="pay-amount">NT$${amount}</div>
      </div>

      ${paymentMethodsHTML}
      ${buttonHTML}
    </div>
  `;

  renderPage(html);

  /* ── Payment Option Switcher ── */
  window.selectPaymentOption = function (el) {
    // 移除所有選項的 active 狀態
    document.querySelectorAll('.pay-method-option').forEach(option => {
      option.classList.remove('active');
    });

    // 設定當前選中選項為 active
    el.classList.add('active');

    // 動態更新主要付款按鈕上的文字
    const payBtn = document.getElementById('pay-btn');
    if (payBtn) {
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
      const pickupCode = escapeHtml(result.pickupCode || result.pickup_code || order.pickupCode || order.pickup_code || '');

      let instructionHTML = '';

      if (orderType === 'machine_gacha') {
        instructionHTML = `
          <p class="success-subtitle" style="font-weight: 700; color: var(--primary-color);">請至機台轉動實體旋鈕以開始扭蛋抽獎！</p>
        `;
      } else if (orderType === 'machine_purchase') {
        instructionHTML = `
          <p class="success-subtitle" style="font-weight: 700; color: var(--primary-color);">請至機台轉動旋鈕以開啟已購買的艙門並取餐！</p>
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
          <div style="display:flex; gap:8px; flex-direction:column;">
            <button class="btn btn-secondary btn-block" onclick="router.navigate('/consumer/orders')">
              查看訂單
            </button>
          </div>
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
