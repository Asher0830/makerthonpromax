// Store Machine Management View
// Renders the machine compartment management page

async function renderStoreMachinePage(machineId) {
    // Clear any previous refresh interval
    if (window._machineRefreshInterval) {
        clearInterval(window._machineRefreshInterval);
        window._machineRefreshInterval = null;
    }

    let machine = null;
    try {
        showLoading();
        machine = await api.getMachine(machineId);
        hideLoading();
    } catch (err) {
        hideLoading();
        showToast(err.message || '無法載入機台資訊', 'error');
        const errorHtml = `
            <div class="page-header">
                <button class="back-btn" onclick="router.navigate('/store/dashboard')">←</button>
                <h1>機台管理</h1>
            </div>
            <div class="page-content">
                <div class="empty-state">無法載入機台資訊</div>
            </div>
        `;
        renderPage(errorHtml);
        updateBottomNav('machine');
        return;
    }

    const machineName = machine.name || machine.id || '機台';
    const compartments = machine.compartments || [];

    // Ensure we have 6 compartments
    const displayCompartments = [];
    for (let i = 0; i < 6; i++) {
        displayCompartments.push(compartments[i] || { number: i + 1, product: null });
    }

    const compartmentsHtml = displayCompartments.map((comp, index) => {
        const num = comp.number || (index + 1);
        const product = comp.product || comp.productName || null;
        const isOccupied = !!product;

        if (isOccupied) {
            const productName = typeof product === 'object' ? (product.name || '商品') : product;
            const category = (typeof product === 'object' && product.category) ? product.category : '';
            const categoryLabels = { bento: '便當', bread: '麵包', vegetable: '蔬菜', other: '其他' };
            const categoryText = categoryLabels[category] || category || '';

            return `
                <div class="compartment-card occupied">
                    <div class="compartment-number">格 ${num}</div>
                    <div class="compartment-product">${productName}</div>
                    ${categoryText ? `<span class="category-badge">${categoryText}</span>` : ''}
                </div>
            `;
        } else {
            return `
                <div class="compartment-card empty">
                    <div class="compartment-number">格 ${num}</div>
                    <div class="compartment-empty">🍽️ 空格</div>
                    <button class="btn btn-primary btn-sm" onclick="openStockModal('${machineId}', ${num})">放入商品</button>
                </div>
            `;
        }
    }).join('');

    const html = `
        <div class="page-header">
            <button class="back-btn" onclick="router.navigate('/store/dashboard')">←</button>
            <h1>機台管理</h1>
        </div>
        <div class="page-content">
            <div class="card" style="margin-bottom: 16px; text-align: center;">
                <h3 style="margin: 0;">${machineName}</h3>
                <p style="color: var(--text-secondary, #666); font-size: 13px; margin-top: 4px;">ID: ${machineId}</p>
            </div>

            <div class="machine-grid">
                ${compartmentsHtml}
            </div>
        </div>
    `;

    renderPage(html);
    updateBottomNav('machine');

    // Modal handler for stocking compartments
    window.openStockModal = async function(mId, compartmentNumber) {
        let products = [];
        try {
            const result = await api.getProducts({ source: 'machine' });
            products = result.products || result || [];
        } catch (err) {
            showToast('無法載入商品列表', 'error');
            return;
        }

        const productListHtml = Array.isArray(products) && products.length > 0
            ? products.map(p => `
                <div class="card product-select-card" style="cursor: pointer; margin-bottom: 8px;" onclick="selectProductForCompartment('${mId}', ${compartmentNumber}, '${p.id}')">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600;">${p.name}</div>
                            <div style="font-size: 13px; color: var(--text-secondary, #666);">NT$${p.sellingPrice || p.selling_price || p.price || 0}</div>
                        </div>
                        <div style="color: var(--primary-color, #22c55e); font-size: 20px;">›</div>
                    </div>
                </div>
            `).join('')
            : '<div class="empty-state">目前沒有可放入的商品</div>';

        const modalHtml = `
            <div class="modal-overlay" id="stock-modal" onclick="closeStockModal(event)">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-handle"></div>
                    <h3 class="modal-title">選擇商品</h3>
                    <p style="color: var(--text-secondary, #666); font-size: 14px; margin-bottom: 16px;">放入格 ${compartmentNumber}</p>
                    <div class="product-list">
                        ${productListHtml}
                    </div>
                    <button class="btn btn-block" style="margin-top: 16px; background: var(--bg-secondary, #f5f5f5); color: var(--text-secondary, #666);" onclick="closeStockModal()">取消</button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    window.selectProductForCompartment = async function(mId, compartmentNumber, productId) {
        try {
            showLoading();
            await api.stockCompartment(mId, compartmentNumber, productId);
            hideLoading();
            closeStockModal();
            showToast('已放入商品', 'success');
            // Re-render the machine page
            renderStoreMachinePage(mId);
        } catch (err) {
            hideLoading();
            showToast(err.message || '放入失敗', 'error');
        }
    };

    window.closeStockModal = function(event) {
        const modal = document.getElementById('stock-modal');
        if (modal) {
            modal.remove();
        }
    };

    // Auto-refresh every 10 seconds
    window._machineRefreshInterval = setInterval(() => {
        // Only refresh if we're still on this page
        if (location.hash.includes('/store/machine/' + machineId)) {
            renderStoreMachinePage(machineId);
        } else {
            clearInterval(window._machineRefreshInterval);
            window._machineRefreshInterval = null;
        }
    }, 10000);
}
