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

        <!-- 檔案上傳解碼備用方案 -->
        <div style="margin-top: 16px;">
          <label for="qr-file-input" class="btn btn-secondary btn-block" style="font-size: 13px; font-weight: 700; padding: 8px 16px; border-radius: 6px; border: 1px dashed var(--primary-color); color: var(--primary-color); background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
            <span>[FILE]</span> 上傳 QR Code 照片解碼
          </label>
          <input type="file" id="qr-file-input" accept="image/*" style="display: none;" />
        </div>
      </div>
    </div>
  `;

  renderPage(html);

  /* Helper to process QR code payload */
  function handleDecodedQR(decodedText) {
    try {
      if (decodedText.includes('/consumer/pay/')) {
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
  }

  /* Initialize camera scanner after DOM is ready */
  setTimeout(() => {
    if (typeof Html5Qrcode === 'undefined') {
      console.warn('Html5Qrcode library not loaded');
      showToast('QR 掃描器載入失敗', 'error');
      return;
    }

    const scanner = new Html5Qrcode('consumer-qr-reader');
    window.activeQRScanner = scanner;

    const startScanner = (facing) => {
      return scanner.start(
        { facingMode: facing },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          scanner.stop().then(() => {
            window.activeQRScanner = null;
            showToast('掃描成功！', 'success');
            handleDecodedQR(decodedText);
          });
        },
        (errorMessage) => { /* ignore continuous scan errors */ }
      );
    };

    // Try back camera first, fallback to front camera if fails (e.g. laptop testing)
    startScanner('environment').catch(err => {
      console.warn('Back camera failed, trying front camera...', err);
      startScanner('user').catch(e => {
        console.error('Scanner error:', e);
        showToast('相機啟動受限 (可能非 HTTPS 環境)。請使用下方照片上傳解碼！', 'info', 5000);
      });
    });

    // File Input Decoder Fallback
    const fileInput = document.getElementById('qr-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showLoading();
        try {
          const html5QrCode = new Html5Qrcode('consumer-qr-reader');
          const decodedText = await html5QrCode.scanFile(file, true);
          hideLoading();
          showToast('照片解碼成功！', 'success');
          handleDecodedQR(decodedText);
        } catch (err) {
          hideLoading();
          console.error(err);
          showToast('無法識別照片中的 QR Code，請重試', 'error');
        }
      });
    }
  }, 300);
}
