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
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  /* Status mapping */
  const statusTextMap = {
    PAID: '已付款',
    COMPLETED: '已完成',
    TIMEOUT_REFUNDED: '已退款',
    CANCELLED: '已取消',
  };

  let orderListHTML = '';

  if (orders.length === 0) {
    orderListHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">還沒有訂單</div>
        <button class="btn btn-primary" onclick="router.navigate('/consumer/map')">
          去逛逛
        </button>
      </div>
    `;
  } else {
    orderListHTML = orders.map((order) => {
      const source = order.source || order.type || 'map_purchase';
      const typeEmoji = source === 'machine_purchase' ? '🎰' : '🗺️';
      const productName = order.productName || order.product?.name || '惜食商品';
      const amount = order.amount || order.price || 0;
      const status = order.status || 'PAID';
      const statusText = statusTextMap[status] || status;
      const pickupCode = order.pickupCode || '';

      /* Format date */
      const createdDate = order.createdAt
        ? new Date(order.createdAt).toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';

      return `
        <div class="card order-card" onclick="toggleOrderDetail('${order.id}')">
          <div class="order-card-main">
            <div class="order-icon">${typeEmoji}</div>
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
            <div class="order-detail" id="order-detail-${order.id}" style="display:none;">
              <div class="order-detail-label">取貨碼</div>
              <div class="order-detail-code">${pickupCode}</div>
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
    detailEl.style.display = isHidden ? 'block' : 'none';
  };
}
