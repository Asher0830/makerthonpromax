// Store Orders View
// Renders the store order management page with tab filtering and verification

async function renderStoreOrdersPage() {
    let allOrders = [];
    let activeTab = 'all';

    try {
        showLoading();
        const result = await api.getStoreOrders();
        allOrders = result.orders || result || [];
        hideLoading();
    } catch (err) {
        hideLoading();
        showToast(err.message || '無法載入訂單', 'error');
    }

    function getFilteredOrders(tab) {
        if (!Array.isArray(allOrders)) return [];
        switch (tab) {
            case 'pending':
                return allOrders.filter(o => o.status === 'PAID' && (o.order_type === 'map_purchase' || o.orderType === 'map_purchase' || o.source === 'map_purchase' || o.type === 'map_purchase'));
            case 'completed':
                return allOrders.filter(o => o.status === 'COMPLETED');
            default:
                return allOrders;
        }
    }

    function renderOrders(tab) {
        activeTab = tab;
        const filtered = getFilteredOrders(tab);

        const statusMap = {
            'PENDING': '待付款',
            'PAID': '已付款',
            'COMPLETED': '已完成',
            'TIMEOUT_REFUNDED': '已退款',
            'CANCELLED': '已取消'
        };

        const statusIcons = {
            'PENDING': '[待付款]',
            'PAID': '[已付款]',
            'COMPLETED': '[已完成]',
            'TIMEOUT_REFUNDED': '[已退款]',
            'CANCELLED': '[已取消]'
        };

        let ordersHtml = '';

        if (filtered.length === 0) {
            ordersHtml = '<div class="empty-state">目前還沒有任何訂單紀錄</div>';
        } else {
            ordersHtml = filtered.map(order => {
                const date = new Date(order.createdAt || order.created_at);
                const dateStr = date.toLocaleDateString('zh-TW');
                const amount = Number(order.totalAmount || order.total_amount || order.amount || 0);
                const status = order.status || 'PAID';
                const statusText = statusMap[status] || status;
                const icon = statusIcons[status] || '[訂單]';
                const productName = order.productName || order.product_name || order.items?.[0]?.name || '商品';
                const consumerName = order.consumerName || order.consumer_name || '顧客';
                const orderId = order.id || order._id || '';
                const orderType = order.order_type || order.orderType || order.source || order.type || '';
                const isMachineDirect = orderType === 'machine_purchase';
                const isMachineGacha = orderType === 'machine_gacha';
                const isMapPaid = (orderType === 'map_purchase') && status === 'PAID';

                let verifySection = '';
                if (isMapPaid) {
                    verifySection = `
                        <div class="verify-section">
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <input type="text" class="form-input verify-input" id="verify-${orderId}" maxlength="4" placeholder="輸入取餐碼" style="flex: 1; margin: 0;">
                                <button class="btn btn-primary btn-sm" onclick="verifyOrder('${orderId}')">確認核銷</button>
                            </div>
                        </div>
                    `;
                }

                return `
                    <div class="card">
                        <div class="order-card">
                            <div class="order-icon">${icon}</div>
                            <div class="order-info">
                                <div class="order-name">${productName}</div>
                                <div class="order-date">${consumerName} · ${dateStr}</div>
                                ${isMachineDirect ? '<div style="font-size: 12px; color: var(--text-secondary, #666); margin-top: 2px;">[機台直購] 機台訂單</div>' : ''}
                                ${isMachineGacha ? '<div style="font-size: 12px; color: var(--text-secondary, #666); margin-top: 2px;">[機台扭蛋] 機台訂單</div>' : ''}
                            </div>
                            <div class="order-right">
                                <div class="order-amount">NT$${amount}</div>
                                <span class="status-badge status-${status}">${statusText}</span>
                            </div>
                        </div>
                        ${verifySection}
                    </div>
                `;
            }).join('');
        }

        const orderList = document.getElementById('order-list');
        if (orderList) {
            orderList.innerHTML = ordersHtml;
        }

        // Update active tab styling
        document.querySelectorAll('.tab-filter').forEach(tab => tab.classList.remove('active'));
        const activeTabEl = document.getElementById('tab-' + activeTab);
        if (activeTabEl) activeTabEl.classList.add('active');
    }

    const html = `
        <div class="page-header">
            <h1>訂單管理</h1>
        </div>
        <div class="page-content">
            <div class="tab-filters">
                <button class="tab-filter active" id="tab-all" onclick="switchOrderTab('all')">全部</button>
                <button class="tab-filter" id="tab-pending" onclick="switchOrderTab('pending')">待核銷</button>
                <button class="tab-filter" id="tab-completed" onclick="switchOrderTab('completed')">已完成</button>
            </div>
            <div id="order-list"></div>
        </div>
    `;

    renderPage(html);
    updateBottomNav('orders');

    // Initial render of orders
    renderOrders('all');

    // Tab switch handler
    window.switchOrderTab = function(tab) {
        renderOrders(tab);
    };

    // Verify order handler
    window.verifyOrder = async function(orderId) {
        const input = document.getElementById('verify-' + orderId);
        if (!input) return;

        const pickupCode = input.value.trim();
        if (!pickupCode || pickupCode.length !== 4) {
            showToast('請輸入 4 位取餐碼', 'error');
            return;
        }

        try {
            showLoading();
            await api.completeOrder(orderId, pickupCode);
            hideLoading();
            showToast('核銷成功！', 'success');
            // Re-render page to refresh data
            renderStoreOrdersPage();
        } catch (err) {
            hideLoading();
            showToast(err.message || '核銷失敗', 'error');
        }
    };
}
