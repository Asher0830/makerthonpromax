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
    const isStockVerified = window._machineStockVerifiedMachineId === machineId;

    const stockGateHtml = `
        <div class="card" style="margin-bottom: 16px; padding: 16px; border: 1px solid rgba(28,27,26,0.08); background: var(--bg-secondary);">
            <div style="font-weight: 700; margin-bottom: 6px; color: var(--text-primary);">機台 QR Code 驗證</div>
            <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">
                ${isStockVerified ? '已完成驗證，可直接從平台商品清單放入機台。' : '請先掃描機台 QR Code，驗證後才能放入平台商品。'}
            </div>
            <button class="btn btn-primary btn-sm" onclick="startMachineStockScan('${machineId}')">
                ${isStockVerified ? '重新掃描機台 QR Code' : '掃描機台 QR Code'}
            </button>
        </div>
    `;

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
                    <div class="compartment-empty">空格</div>
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

            ${stockGateHtml}

            <div class="machine-grid">
                ${compartmentsHtml}
            </div>
        </div>
    `;

    renderPage(html);
    updateBottomNav('machine');

    function parseMachineQr(decodedText) {
        const text = String(decodedText || '').trim();

        try {
            const url = new URL(text);
            const candidate = url.searchParams.get('machineId') || url.searchParams.get('machine_id') || url.searchParams.get('id');
            if (candidate) return candidate;

            const pathMatch = url.pathname.match(/\/store\/machine\/([^/?#]+)/) || url.pathname.match(/\/machine\/([^/?#]+)/);
            if (pathMatch && pathMatch[1]) return pathMatch[1];
        } catch (_) {
            // not a URL
        }

        if (text.includes(machineId)) return machineId;
        return text;
    }

    window.closeMachineStockScanModal = function() {
        const modal = document.getElementById('machine-stock-scan-modal');
        const scanner = window.activeQRScanner;

        if (scanner) {
            window.activeQRScanner = null;
            scanner.stop().catch(() => {
                if (modal) modal.remove();
            }).finally(() => {
                if (modal) modal.remove();
            });
            return;
        }

        if (modal) modal.remove();
    };

    window.showStockProductModal = async function(mId, compartmentNumber) {
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

    window.startMachineStockScan = function(mId, compartmentNumber = null) {
        const existingScanner = window.activeQRScanner;
        if (existingScanner) {
            try {
                existingScanner.stop().catch(() => {});
            } catch (_) {
                // ignore
            }
            window.activeQRScanner = null;
        }

        const html = `
            <div class="modal-overlay" id="machine-stock-scan-modal" onclick="closeMachineStockScanModal()">
                <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 420px;">
                    <div class="modal-handle"></div>
                    <h3 class="modal-title">掃描機台 QR Code</h3>
                    <p style="color: var(--text-secondary, #666); font-size: 14px; margin-bottom: 16px; line-height: 1.5;">請掃描機台上的 QR Code，驗證後才能放入平台商品。</p>
                    <div id="machine-stock-qr-reader" style="width: 100%; min-height: 280px; border-radius: 12px; overflow: hidden; border: 1px solid rgba(28,27,26,0.08);"></div>
                    <button class="btn btn-block" style="margin-top: 16px; background: var(--bg-secondary, #f5f5f5); color: var(--text-secondary, #666);" onclick="closeMachineStockScanModal()">取消</button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);

        setTimeout(() => {
            if (typeof Html5Qrcode === 'undefined') {
                showToast('QR 掃描器載入失敗', 'error');
                closeMachineStockScanModal();
                return;
            }

            const scanner = new Html5Qrcode('machine-stock-qr-reader');
            window.activeQRScanner = scanner;

            scanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 240, height: 240 } },
                (decodedText) => {
                    const scannedMachineId = parseMachineQr(decodedText);
                    if (scannedMachineId !== mId) {
                        showToast('掃描到的不是此機台 QR Code', 'error');
                        return;
                    }

                    scanner.stop().then(() => {
                        window.activeQRScanner = null;
                        window._machineStockVerifiedMachineId = mId;
                        showToast('機台 QR Code 驗證成功', 'success');
                        closeMachineStockScanModal();

                        if (compartmentNumber != null) {
                            window.showStockProductModal(mId, compartmentNumber);
                        } else {
                            renderStoreMachinePage(mId);
                        }
                    }).catch((err) => {
                        console.warn('Failed to stop stock scanner:', err);
                    });
                },
                () => { /* ignore scan noise */ }
            ).catch((err) => {
                console.error('Scanner error:', err);
                showToast('無法啟動相機', 'error');
                closeMachineStockScanModal();
            });
        }, 300);
    };

    // Modal handler for stocking compartments
    window.openStockModal = async function(mId, compartmentNumber) {
        if (window._machineStockVerifiedMachineId !== mId) {
            window.startMachineStockScan(mId, compartmentNumber);
            return;
        }
        window.showStockProductModal(mId, compartmentNumber);
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
