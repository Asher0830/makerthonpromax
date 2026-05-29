/* ═══════════════════════════════════════════════════
   FoodD Mobile — Consumer Orders Page
   ═══════════════════════════════════════════════════ */

async function renderConsumerOrdersPage() {
  updateBottomNav('orders');
  showLoading();

  let orders = [];

  try {
    const data = await api.getOrders();
    orders = data.orders || data || [];
  } catch (err) {
    hideLoading();
    console.error('Failed to load orders:', err);
    showToast('無法載入訂單', 'error');
  }

  hideLoading();

  /* Sort by date, newest first */
  orders.sort((a, b) => {
    const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
    const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
    return dateB - dateA;
  });

  /* Status mapping */
  const statusTextMap = {
    PENDING: '待付款',
    PAID: '已付款',
    COMPLETED: '已完成',
    TIMEOUT_REFUNDED: '已退款',
    CANCELLED: '已取消',
  };

  let orderListHTML = '';

  if (orders.length === 0) {
    orderListHTML = `
      <div class="empty-state">
        <div class="empty-state-text" style="font-size: var(--fs-body); color: var(--text-muted); margin-bottom: 16px;">目前還沒有任何訂單紀錄</div>
        <button class="btn btn-primary" onclick="router.navigate('/consumer/map')">
          去逛逛
        </button>
      </div>
    `;
  } else {
    orderListHTML = orders.map((order) => {
      const orderType = order.order_type || order.orderType || order.source || order.type || 'map_purchase';
      const typeLabel = orderType === 'machine_gacha'
        ? '[扭蛋]'
        : orderType === 'machine_purchase'
          ? '[直購]'
          : '[自取]';
      const productName = order.productName || order.product?.name || '惜食商品';
      const amount = order.amount || order.price || 0;
      const status = order.status || 'PAID';
      const statusText = statusTextMap[status] || status;
      const pickupCode = order.pickupCode || order.pickup_code || '';

      /* Format date */
      const createdAt = order.createdAt || order.created_at;
      const createdDate = createdAt
        ? new Date(createdAt).toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';

      return `
        <div class="card" style="cursor: pointer; display: flex; flex-direction: column; gap: 0;" onclick="toggleOrderDetail('${order.id}')">
          <div class="order-card" style="width: 100%; border: none; background: none; padding: 0;">
            <div class="order-icon" style="font-size: 0.9rem; font-weight: 700; color: var(--primary-color);">${typeLabel}</div>
            <div class="order-info">
              <div class="order-name">${productName}</div>
              <div class="order-date">${createdDate}</div>
            </div>
            <div class="order-right">
              <div class="order-amount">NT$${amount}</div>
              <span class="status-badge status-${status}">${statusText}</span>
            </div>
          </div>
          ${pickupCode ? `
            <div class="order-detail" id="order-detail-${order.id}" style="display: flex; margin-top: 12px; border-top: 1px dashed var(--border); padding-top: 12px; text-align: left; justify-content: space-between; align-items: center; width: 100%;">
              <div>
                <div class="order-detail-label" style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">取貨碼 (Pickup Code)</div>
                <div class="order-detail-code" style="font-size: 1.25rem; font-weight: 800; color: var(--primary-color); font-family: 'Outfit', sans-serif; letter-spacing: 1.5px; margin-top: 2px;">${pickupCode}</div>
              </div>
              <div class="qr-thumbnail" onclick="event.stopPropagation(); showRedeemQR('${order.id}', '${pickupCode}')" style="cursor: pointer; background: #fff; padding: 4px; border: 1px solid var(--border); border-radius: 6px; display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; box-shadow: var(--shadow-sm);" title="出示核銷 QR Code">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent('sfood-redeem:' + order.id + ':' + pickupCode)}" style="width: 32px; height: 32px; display: block;" />
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  const html = `
    <div class="page-header">
      <h1 class="header-title">我的訂單</h1>
    </div>

    <div class="page-content">
      ${orderListHTML}
    </div>
  `;

  renderPage(html);

  /* ── Toggle order detail ── */
  window.toggleOrderDetail = function (orderId) {
    const detailEl = document.getElementById('order-detail-' + orderId);
    if (!detailEl) return;
    const isHidden = detailEl.style.display === 'none';
    detailEl.style.display = isHidden ? 'flex' : 'none';
  };

  /* ── Pop modal with large QR Code for scanning ── */
  window.showRedeemQR = function(orderId, pickupCode) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('sfood-redeem:' + orderId + ':' + pickupCode)}`;
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.style.zIndex = '10000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.innerHTML = `
      <div class="modal-card" style="text-align: center; max-width: 320px; padding: 24px; border-radius: 16px; background: var(--surface); box-shadow: var(--shadow-lg); margin: 20px;">
        <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text); margin-bottom: 6px;">出示核銷碼</h2>
        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 20px;">請出示給店家進行掃碼核銷</p>
        
        <div style="display: inline-block; background: #fff; padding: 12px; border: 1px solid var(--border); border-radius: 12px; margin-bottom: 20px; box-shadow: var(--shadow-sm);">
          <img src="${qrUrl}" style="display: block; width: 180px; height: 180px;" />
        </div>
        
        <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary-color); letter-spacing: 2px; margin-bottom: 24px; font-family: 'Outfit', sans-serif;">${pickupCode}</div>
        
        <button class="btn btn-secondary btn-block" onclick="this.closest('.modal-overlay').remove()">關閉</button>
      </div>
    `;
    document.body.appendChild(overlay);
  };
}
