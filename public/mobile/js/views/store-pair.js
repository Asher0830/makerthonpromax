// Store Pair Machine View
// Renders the machine pairing page with QR scanner

async function renderStorePairPage() {
    if (!authManager.isLoggedIn() || !authManager.isStoreOwner()) {
        showToast('請以店家身份登入後再進行機台配對！', 'warning');
        router.navigate('/login');
        return;
    }

    // Check for token in URL hash
    const hashParts = location.hash.split('?');
    const params = new URLSearchParams(hashParts[1] || '');
    const token = params.get('token');

    if (token) {
        // Token found — attempt pairing directly
        const html = `
            <div class="page-header">
                <h1>配對機台</h1>
            </div>
            <div class="page-content">
                <div class="card" style="text-align: center; padding: 40px 20px;">
                    <div class="loading-spinner" style="margin: 0 auto 16px;"></div>
                    <p>正在配對中...</p>
                </div>
            </div>
        `;
        renderPage(html);
        updateBottomNav('machine');

        try {
            showLoading();
            const result = await api.pairMachine(token);
            hideLoading();

            const machineName = result.machine?.name || result.machine?.id || '機台';
            const machineId = result.machine?.id || '';

            const successHtml = `
                <div class="page-header">
                    <h1>配對機台</h1>
                </div>
                <div class="page-content">
                    <div class="success-screen">
                        <div class="success-icon" style="font-size: 2.5rem; color: var(--primary-color); font-weight: 700; margin-bottom: 12px;">✓</div>
                        <h2 class="success-title">配對成功！</h2>
                        <p style="color: var(--text-secondary, #666); margin-bottom: 24px;">${machineName}</p>
                        <button class="btn btn-primary btn-block" onclick="router.navigate('/store/machine/${machineId}')">管理機台</button>
                    </div>
                </div>
            `;
            renderPage(successHtml);
        } catch (err) {
            hideLoading();
            showToast(err.message || '配對失敗', 'error');

            const errorHtml = `
                <div class="page-header">
                    <h1>配對機台</h1>
                </div>
                <div class="page-content">
                    <div class="card" style="text-align: center; padding: 40px 20px;">
                        <div style="font-size: 2.5rem; color: #d32f2f; font-weight: 700; margin-bottom: 16px;">✕</div>
                        <h3 style="margin-bottom: 8px;">配對失敗</h3>
                        <p style="color: var(--text-secondary, #666); margin-bottom: 24px;">${err.message || '請稍後再試'}</p>
                        <button class="btn btn-primary btn-block" onclick="router.navigate('/store/pair')">重新嘗試</button>
                    </div>
                </div>
            `;
            renderPage(errorHtml);
        }
    } else {
        // No token — show QR scanner
        const html = `
            <div class="page-header">
                <h1>配對機台</h1>
            </div>
            <div class="page-content">
                <div class="card" style="text-align: center; padding: 24px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color); margin-bottom: 16px;">[SCAN]</div>
                    <p style="font-weight: 600; margin-bottom: 8px;">掃描 QR Code</p>
                    <p style="color: var(--text-secondary, #666); font-size: 14px; margin-bottom: 24px;">請掃描機台上的 QR Code 進行配對</p>
                    <div id="qr-reader" style="width: 100%; max-width: 350px; margin: 0 auto; border-radius: 12px; overflow: hidden;"></div>
                </div>
            </div>
        `;

        renderPage(html);
        updateBottomNav('machine');

        // Initialize QR scanner after DOM is ready
        setTimeout(() => {
            if (typeof Html5Qrcode === 'undefined') {
                console.warn('Html5Qrcode library not loaded');
                showToast('QR 掃描器載入失敗', 'error');
                return;
            }

            const scanner = new Html5Qrcode('qr-reader');
            window.activeQRScanner = scanner;

            scanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    scanner.stop().then(() => {
                        window.activeQRScanner = null;
                        // Parse QR code - it might be a full URL with token param
                        try {
                            const url = new URL(decodedText);
                            const scannedToken = url.searchParams.get('token') || url.hash.split('token=')[1];
                            if (scannedToken) {
                                showLoading();
                                api.pairMachine(scannedToken).then(result => {
                                    hideLoading();
                                    showToast('配對成功！', 'success');
                                    router.navigate('/store/machine/' + result.machine.id);
                                }).catch(err => {
                                    hideLoading();
                                    showToast(err.message || '配對失敗', 'error');
                                });
                            }
                        } catch(e) {
                            // If not a URL, try using the text directly as token
                            showLoading();
                            api.pairMachine(decodedText).then(result => {
                                hideLoading();
                                showToast('配對成功！', 'success');
                                router.navigate('/store/machine/' + result.machine.id);
                            }).catch(err => {
                                hideLoading();
                                showToast(err.message || '配對失敗', 'error');
                            });
                        }
                    });
                },
                (errorMessage) => { /* ignore continuous scan errors */ }
            ).catch(err => {
                console.error('Scanner error:', err);
                showToast('無法啟動相機', 'error');
            });
        }, 500);
    }
}
