// Store Dashboard View
// Renders the store owner's main dashboard page

async function renderStoreDashboardPage() {
    const user = authManager.getUser();
    const userName = (user && user.name) ? user.name : '店家';

    // Fetch data with error handling
    let products = [];
    let orders = [];
    try {
        const productResult = await api.getProducts();
        products = productResult.products || productResult || [];
    } catch (e) {
        console.error('Failed to fetch products:', e);
    }
    try {
        const orderResult = await api.getStoreOrders();
        orders = orderResult.orders || orderResult || [];
    } catch (e) {
        console.error('Failed to fetch orders:', e);
    }

    // Calculate today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayProducts = Array.isArray(products)
        ? products.filter(p => {
            const created = new Date(p.createdAt || p.created_at);
            return created >= today;
        }).length
        : 0;

    const todayOrders = Array.isArray(orders)
        ? orders.filter(o => {
            const created = new Date(o.createdAt || o.created_at);
            return created >= today && (o.status === 'COMPLETED');
        })
        : [];

    const soldCount = todayOrders.length;
    const revenue = todayOrders.reduce((sum, o) => sum + (Number(o.totalAmount || o.total_amount || o.amount || 0)), 0);

    // Recent orders (last 5, sorted by date descending)
    const recentOrders = Array.isArray(orders)
        ? [...orders]
            .sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at))
            .slice(0, 5)
        : [];

    const statusMap = {
        'PAID': '已付款',
        'COMPLETED': '已完成',
        'TIMEOUT_REFUNDED': '已退款',
        'CANCELLED': '已取消'
    };

    const recentOrdersHtml = recentOrders.length > 0
        ? recentOrders.map(order => {
            const date = new Date(order.createdAt || order.created_at);
            const dateStr = date.toLocaleDateString('zh-TW');
            const amount = Number(order.totalAmount || order.total_amount || order.amount || 0);
            const status = order.status || 'PAID';
            const statusText = statusMap[status] || status;
            const productName = order.productName || order.product_name || order.items?.[0]?.name || '商品';
            const consumerName = order.consumerName || order.consumer_name || '顧客';

            return `
                <div class="card">
                    <div class="order-card">
                        <div class="order-info">
                            <div class="order-name">${productName}</div>
                            <div class="order-date">${consumerName} · ${dateStr}</div>
                        </div>
                        <div class="order-right">
                            <div class="order-amount">NT$${amount}</div>
                            <span class="status-badge status-${status}">${statusText}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('')
        : '<div class="empty-state">還沒有訂單</div>';

    window.openStoreDashboardScanner = function() {
        if (typeof window.openStoreScanner === 'function') {
            window.openStoreScanner(() => {
                renderStoreDashboardPage();
            });
        }
    };

    const html = `
        <div class="page-header">
            <h1>店家主頁</h1>
        </div>
        <div class="page-content">
            <div class="card greeting-card">
                <h2 class="greeting-text">你好, ${userName}!</h2>
                <button class="btn-logout" onclick="authManager.logout()">
                    登出
                </button>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${todayProducts}</div>
                    <div class="stat-label">今日上架</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${soldCount}</div>
                    <div class="stat-label">已售出</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">NT$${revenue}</div>
                    <div class="stat-label">營收</div>
                </div>
            </div>

            <div class="quick-actions" style="grid-template-columns: 1fr; gap: 12px; margin-bottom: 12px;">
                <button class="quick-action-btn action-primary" onclick="openStoreDashboardScanner()" style="padding: 16px 20px; font-size: 1.05rem; flex-direction: row; justify-content: center; align-items: center; gap: 10px; border-radius: 12px; background: linear-gradient(135deg, var(--primary) 0%, #15803d 100%); border: none; box-shadow: var(--shadow-md); color: #fff; width: 100%;">
                    <span style="font-size: 1.35rem;">📷</span> 掃碼核銷 (Scan QR Code)
                </button>
            </div>
            <div class="quick-actions" style="grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
                <button class="quick-action-btn action-secondary" onclick="router.navigate('/store/add-item')" style="padding: 14px; font-size: 0.95rem; border-radius: 12px; border: 1px solid rgba(0, 128, 85, 0.2); background: rgba(0, 128, 85, 0.04); color: var(--primary);">
                    上架商品
                </button>
                <button class="quick-action-btn action-secondary" onclick="router.navigate('/store/pair')" style="padding: 14px; font-size: 0.95rem; border-radius: 12px; border: 1px solid rgba(0, 128, 85, 0.2); background: rgba(0, 128, 85, 0.04); color: var(--primary);">
                    配對機台
                </button>
            </div>

            <div class="section">
                <h3 style="font-weight: 600; margin-bottom: 12px;">最近訂單</h3>
                ${recentOrdersHtml}
            </div>
        </div>
    `;

    renderPage(html);
    updateBottomNav('dashboard');
}
