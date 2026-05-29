/* ═══════════════════════════════════════════════════
   FoodD Mobile — Consumer Scan QR Page
   ═══════════════════════════════════════════════════ */

async function renderConsumerScanPage() {
  updateBottomNav('map');

  const html = `
    <div class="page-header">
      <button class="back-btn" onclick="router.navigate('/consumer/map')" style="background:transparent; border:none; font-size:1.2rem; cursor:pointer;">←</button>
      <h1 class="header-title" style="margin-left: 8px;">掃描機台</h1>
    </div>

    <div class="page-content" style="padding: 16px;">
      <div class="card" style="text-align: center; padding: 24px; border: 1px solid rgba(28,27,26,0.08);">
        <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color); margin-bottom: 16px;">[SCAN]</div>
        <p style="font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">請對準機台螢幕上的 QR Code</p>
        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 24px;">掃描後可立即登入會員並完成付款取餐</p>
        
        <div id="consumer-qr-reader" style="width: 100%; max-width: 320px; margin: 0 auto; border-radius: 12px; overflow: hidden; border: 1px solid rgba(28,27,26,0.08);"></div>

        <!-- 模擬測試手動輸入區塊 -->
        <div style="margin-top: 24px; border-top: 1px dashed rgba(28,27,26,0.1); padding-top: 20px;">
          <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 12px;">[模擬測試] 手動輸入付款網址或訂單 ID</p>
          <div style="display: flex; gap: 8px; justify-content: center;">
            <input type="text" id="manual-order-id" placeholder="例如：1" style="width: 140px; padding: 8px 12px; border: 1px solid rgba(28,27,26,0.15); border-radius: 6px; font-size: 14px; text-align: center; background: #fff;" />
            <button class="btn btn-primary" onclick="handleManualOrder()" style="padding: 8px 16px; font-size: 13px; font-weight: 700; width: auto; min-height: unset; border-radius: 6px;">確認進入</button>
          </div>
        </div>
      </div>
    </div>
  `;

  renderPage(html);

  /* Initialize camera scanner after DOM is ready */
  setTimeout(() => {
    if (typeof Html5Qrcode === 'undefined') {
      console.warn('Html5Qrcode library not loaded');
      showToast('QR 掃描器載入失敗', 'error');
      return;
    }

    const scanner = new Html5Qrcode('consumer-qr-reader');
    window.activeQRScanner = scanner;

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (decodedText) => {
        scanner.stop().then(() => {
          window.activeQRScanner = null;
          showToast('掃描成功！', 'success');

          // Parse the scanned content
          try {
            if (decodedText.includes('/consumer/pay/')) {
              // Extract order ID
              const parts = decodedText.split('/consumer/pay/');
              const orderId = parts[1].split('?')[0];
              
              if (orderId) {
                router.navigate('/consumer/pay/' + orderId);
              } else {
                showToast('無效的付款 QR Code', 'error');
                router.navigate('/consumer/map');
              }
            } else {
              showToast('非付款或機台 QR Code', 'error');
              router.navigate('/consumer/map');
            }
          } catch (e) {
            console.error('Scan parse error', e);
            router.navigate('/consumer/map');
          }
        });
      },
      (errorMessage) => { /* ignore continuous scan errors */ }
    ).catch(err => {
      console.error('Scanner error:', err);
      showToast('無法啟動相機，請確認已授予權限', 'error');
    });
  }, 300);

  /* ── 手動模擬輸入訂單 ID ── */
  window.handleManualOrder = function () {
    const inputVal = document.getElementById('manual-order-id').value.trim();
    if (!inputVal) {
      showToast('請輸入訂單 ID 或完整網址', 'error');
      return;
    }

    let orderId = inputVal;
    if (inputVal.includes('/consumer/pay/')) {
      const parts = inputVal.split('/consumer/pay/');
      orderId = parts[1].split('?')[0];
    }

    if (orderId && !isNaN(orderId)) {
      router.navigate('/consumer/pay/' + orderId);
    } else {
      showToast('無效的訂單 ID 格式', 'error');
    }
  };
}
