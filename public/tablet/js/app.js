/* ═══════════════════════════════════════════════════
   FoodD Tablet — Main Application (State Machine)
   ═══════════════════════════════════════════════════ */

class TabletApp {
  constructor() {
    this.el = document.getElementById('app');
    this.machineId = 'MAC_01A2B3';

    /* ── State ── */
    this.state = 'IDLE';
    this.prevState = null;

    /* ── Data stores ── */
    this.machineStatus = {
      machineName: '惜食扭蛋機 #1',
      temperature: null,
      compartments: [],
      totalStocked: 0,
      averagePrice: 0,
    };

    this.excludedAllergens = new Set();
    this.currentOrder = null;   // { orderId, amount, expiresAt }
    this.currentResult = null;  // { compartment, productName, category }
    this.pairToken = null;
    this.errorMessage = '';

    /* ── Timers ── */
    this._countdownTimer = null;
    this._resultTimer = null;
    this._pairTimer = null;

    /* ── Allergen list ── */
    this.allergens = [
      { key: 'pork',    emoji: '🐷', label: '豬肉' },
      { key: 'beef',    emoji: '🐄', label: '牛肉' },
      { key: 'chicken', emoji: '🐔', label: '雞肉' },
      { key: 'duck',    emoji: '🦆', label: '鴨肉' },
      { key: 'lamb',    emoji: '🐑', label: '羊肉' },
      { key: 'seafood', emoji: '🦐', label: '海鮮' },
      { key: 'egg',     emoji: '🥚', label: '蛋' },
      { key: 'milk',    emoji: '🥛', label: '乳製品' },
      { key: 'peanut',  emoji: '🥜', label: '花生' },
      { key: 'treenut', emoji: '🌰', label: '堅果' },
      { key: 'wheat',   emoji: '🌾', label: '小麥' },
      { key: 'soy',     emoji: '🫘', label: '大豆' },
      { key: 'sesame',  emoji: '⚪', label: '芝麻' },
    ];

    /* ── Polling ── */
    this.polling = new PollingService(this.machineId, window.tabletAPI);
    this.polling.onStatusChange((s) => this._handleStatusUpdate(s));
    this.polling.onLatestResult((r) => this._handleLatestResult(r));

    /* ── Kick off ── */
    this._injectParticles();
    this.polling.start();
    this.render();
  }

  /* ═══════════════════════════════════════════════════
     STATE MACHINE
     ═══════════════════════════════════════════════════ */

  setState(newState, data = {}) {
    this.prevState = this.state;
    this.state = newState;

    /* Clean up old timers */
    clearInterval(this._countdownTimer);
    clearInterval(this._resultTimer);
    clearInterval(this._pairTimer);

    /* Merge any extra data */
    Object.assign(this, data);

    /* Update polling interval */
    this.polling.setAppState(newState);

    this.render();
  }

  /* ═══════════════════════════════════════════════════
     RENDERING
     ═══════════════════════════════════════════════════ */

  render() {
    const renderers = {
      IDLE: () => this._renderIdle(),
      ALLERGEN_SELECT: () => this._renderAllergenSelect(),
      WAITING_PAYMENT: () => this._renderWaitingPayment(),
      WAITING_TRIGGER: () => this._renderWaitingTrigger(),
      GACHA_ANIMATION: () => this._renderGachaAnimation(),
      RESULT: () => this._renderResult(),
      PAIR_MODE: () => this._renderPairMode(),
      ERROR: () => this._renderError(),
    };

    const html = (renderers[this.state] || renderers.ERROR)();
    this.el.innerHTML = html;

    /* Post-render hooks */
    requestAnimationFrame(() => this._postRender());
  }

  /* ── Status Bar (shared) ── */
  _statusBar() {
    const temp = this.machineStatus.temperature != null
      ? `${this.machineStatus.temperature}°C`
      : '--°C';
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return `
      <div class="status-bar">
        <div class="status-bar__left">
          <div class="status-bar__dot"></div>
          <span class="status-bar__machine-name">${this.machineStatus.machineName}</span>
        </div>
        <div class="status-bar__right">
          <span class="status-bar__temp">🌡️ <span>${temp}</span></span>
          <span class="status-bar__time">${time}</span>
        </div>
      </div>`;
  }

  /* ── Compartment Grid ── */
  _compartmentGrid(winnerIndex = -1) {
    const slots = this.machineStatus.compartments;
    // Default 6 empty if none loaded
    const grid = slots.length ? slots : Array.from({ length: 6 }, (_, i) => ({
      number: i + 1, status: 'empty', productName: '',
    }));

    const cells = grid.map((c) => {
      const isWinner = c.number === winnerIndex;
      let cls = 'compartment-slot';
      if (isWinner) cls += ' compartment-slot--winner';
      else if (c.status === 'stocked') cls += ' compartment-slot--stocked';
      else if (c.status === 'dispensed') cls += ' compartment-slot--dispensed';
      else cls += ' compartment-slot--empty';

      const statusLabel = { stocked: '已補貨', empty: '空', dispensed: '已出餐' }[c.status] || c.status;
      const clickHandler = c.status === 'stocked' && winnerIndex === -1 && this.state === 'IDLE'
        ? `onclick="app.onDirectPurchase(${c.number})"`
        : '';
      const style = c.status === 'stocked' && winnerIndex === -1 && this.state === 'IDLE'
        ? 'cursor: pointer;'
        : '';

      return `
        <div class="${cls}" ${clickHandler} style="${style}">
          <span class="compartment-slot__number">${c.number}</span>
          <span class="compartment-slot__status">${statusLabel}</span>
          ${c.productName ? `<span class="compartment-slot__product">${c.productName}</span>` : ''}
        </div>`;
    }).join('');

    return `<div class="compartment-grid">${cells}</div>`;
  }

  /* ═══════════════════════════════════════════════════
     INDIVIDUAL STATE RENDERERS
     ═══════════════════════════════════════════════════ */

  _renderIdle() {
    const { totalStocked, averagePrice } = this.machineStatus;
    return `
      ${this._statusBar()}
      <div class="screen flex-col gap-24">
        <div class="welcome-logo">🎰</div>
        <h1 class="title title--gradient">惜食扭蛋機</h1>
        <p class="welcome-tagline">用驚喜拯救美味 ── 每一轉都是善舉</p>

        ${this._compartmentGrid()}

        <div class="stats-row">
          <div class="stat-item">
            <div class="stat-item__value">${totalStocked || 0}</div>
            <div class="stat-item__label">可抽取品項</div>
          </div>
          <div class="stat-item">
            <div class="stat-item__value">$${averagePrice || 0}</div>
            <div class="stat-item__label">平均價格</div>
          </div>
        </div>

        <button class="btn btn--primary btn--large" onclick="app.onStartGacha()">
          🎲 開始扭蛋
        </button>

        <button class="pair-link" onclick="app.onEnterPairMode()">
          🔗 店家配對
        </button>
      </div>`;
  }

  _renderAllergenSelect() {
    const pills = this.allergens.map((a) => {
      const active = this.excludedAllergens.has(a.key);
      return `
        <button class="allergen-pill ${active ? 'allergen-pill--active' : ''}"
                onclick="app.onToggleAllergen('${a.key}')">
          <span class="allergen-pill__check">${active ? '✕' : ''}</span>
          <span>${a.emoji} ${a.label}</span>
        </button>`;
    }).join('');

    const poolInfo = this._getFilteredPool();
    const isEmpty = poolInfo.count === 0;

    return `
      ${this._statusBar()}
      <div class="screen screen--top flex-col gap-16">
        <h2 class="allergen-header">🚫 排除過敏原</h2>
        <p class="allergen-subtitle">點選要排除的食材，扭蛋池將即時更新</p>

        <div class="allergen-scroll-area">
          <div class="allergen-grid">
            ${pills}
          </div>

          <div class="pool-info mt-16">
            <div class="pool-info__count">${poolInfo.count} 項可抽</div>
            <div class="pool-info__price">平均 $${poolInfo.avgPrice}</div>
            ${isEmpty ? '<div class="pool-warning">⚠️ 沒有符合條件的品項，請減少排除項目</div>' : ''}
          </div>
        </div>

        <div style="display:flex; gap:12px; width:100%; max-width:420px;">
          <button class="btn btn--secondary" style="flex:1" onclick="app.setState('IDLE')">
            ← 返回
          </button>
          <button class="btn btn--primary" style="flex:2" ${isEmpty ? 'disabled' : ''}
                  onclick="app.onConfirmAllergens()">
            ✅ 確認
          </button>
        </div>
      </div>`;
  }

  _renderWaitingPayment() {
    const amount = this.currentOrder?.amount || 0;
    return `
      ${this._statusBar()}
      <div class="screen flex-col gap-24">
        <h2 class="title title--gradient">📱 掃碼付款</h2>
        <p class="body-text">請用手機掃描 QR Code 完成付款</p>

        <div class="qr-container" id="qr-target"></div>

        <div class="flex-col gap-8">
          <div class="subtitle">應付金額</div>
          <div class="big-number">$${amount}</div>
        </div>

        <div class="flex-col gap-4" style="gap:4px">
          <div class="countdown" id="payment-countdown">--:--</div>
          <div class="countdown-bar"><div class="countdown-bar__fill" id="countdown-fill" style="width:100%"></div></div>
        </div>

        <button class="btn btn--danger" onclick="app.onCancelPayment()">
          ✕ 取消
        </button>
      </div>`;
  }

  _renderWaitingTrigger() {
    return `
      ${this._statusBar()}
      <div class="screen flex-col gap-32">
        <h2 class="title title--gold" style="animation: pulse 1.5s ease-in-out infinite;">
          請轉動旋鈕！
        </h2>

        <div class="knob-container">
          <div class="knob">🎰</div>
        </div>

        <p class="body-text" style="animation: pulse 2s ease-in-out infinite;">
          握住旋鈕，順時針轉一圈…
        </p>
      </div>`;
  }

  _renderGachaAnimation() {
    // Build a grid with all compartments for the animation
    return `
      ${this._statusBar()}
      <div class="screen flex-col gap-24">
        <h2 class="title title--gradient" style="animation: pulse 0.6s ease-in-out infinite;">
          🎰 扭蛋中…
        </h2>
        <div class="gacha-stage" id="gacha-stage">
          <div class="gacha-reel" id="gacha-reel">
            ${this._gachaCells()}
          </div>
        </div>
      </div>`;
  }

  _gachaCells() {
    const emojis = ['🍱', '🍛', '🥪', '🍕', '🥗', '🍜'];
    const slots = this.machineStatus.compartments.length
      ? this.machineStatus.compartments
      : Array.from({ length: 6 }, (_, i) => ({
          number: i + 1, status: 'stocked', productName: `品項 ${i + 1}`,
        }));

    return slots.map((c, i) => `
      <div class="gacha-cell" id="gacha-cell-${c.number}" data-num="${c.number}">
        <span class="gacha-cell__emoji">${emojis[i % emojis.length]}</span>
        <span class="gacha-cell__name">${c.productName || `#${c.number}`}</span>
      </div>
    `).join('');
  }

  _renderResult() {
    const r = this.currentResult || {};
    return `
      ${this._statusBar()}
      <div class="screen flex-col gap-24">
        <h2 class="title title--gold">🎊 恭喜中獎！</h2>

        <div class="result-card">
          <div class="result-card__label">中獎格號</div>
          <div class="result-card__compartment"># ${r.compartment || '?'}</div>
          <div class="result-card__product">${r.productName || '神秘美食'}</div>
          ${r.category ? `<span class="result-card__category">${r.category}</span>` : ''}
          <div class="result-card__message">
            🚪 第 ${r.compartment || '?'} 號門已開啟，請取餐！
          </div>
        </div>

        <div class="flex-col gap-4" style="gap:4px">
          <div class="countdown" id="result-countdown">15</div>
          <p class="body-text" style="font-size:0.9rem; color: var(--text-muted);">秒後自動返回</p>
        </div>
      </div>`;
  }

  _renderPairMode() {
    return `
      ${this._statusBar()}
      <div class="screen flex-col gap-24">
        <h2 class="title title--gradient">🔗 店家配對</h2>
        <p class="body-text">請用 FoodD 店家 App 掃描下方 QR Code<br>完成機台配對</p>

        <div class="qr-container" id="pair-qr-target"></div>

        <div class="pair-timer" id="pair-timer">10:00</div>

        <button class="btn btn--secondary" onclick="app.setState('IDLE')">
          ← 返回
        </button>
      </div>`;
  }

  _renderError() {
    return `
      ${this._statusBar()}
      <div class="screen flex-col gap-24">
        <div class="error-emoji">😵</div>
        <div class="error-message">${this.errorMessage || '發生未知錯誤'}</div>
        <button class="btn btn--primary" onclick="app.setState('IDLE')">
          🏠 返回首頁
        </button>
      </div>`;
  }

  /* ═══════════════════════════════════════════════════
     POST-RENDER HOOKS
     ═══════════════════════════════════════════════════ */

  _postRender() {
    switch (this.state) {
      case 'WAITING_PAYMENT':
        this._generatePaymentQR();
        this._startPaymentCountdown();
        break;
      case 'GACHA_ANIMATION':
        this._runGachaAnimation();
        break;
      case 'RESULT':
        this._startResultCountdown();
        this._fireConfetti();
        break;
      case 'PAIR_MODE':
        this._generatePairQR();
        this._startPairCountdown();
        break;
    }
  }

  /* ═══════════════════════════════════════════════════
     EVENT HANDLERS
     ═══════════════════════════════════════════════════ */

  onStartGacha() {
    this.excludedAllergens.clear();
    this.setState('ALLERGEN_SELECT');
  }

  onToggleAllergen(key) {
    if (this.excludedAllergens.has(key)) {
      this.excludedAllergens.delete(key);
    } else {
      this.excludedAllergens.add(key);
    }
    this.render();
  }

  async onConfirmAllergens() {
    try {
      const result = await window.tabletAPI.startGacha(
        this.machineId,
        Array.from(this.excludedAllergens)
      );
      this.setState('WAITING_PAYMENT', {
        currentOrder: {
          orderId: result.orderId,
          amount: result.amount,
          expiresAt: result.expiresAt || (Date.now() + 5 * 60 * 1000),
        },
      });
    } catch (err) {
      this.setState('ERROR', { errorMessage: err.message });
    }
  }

  async onDirectPurchase(compartmentIndex) {
    try {
      const result = await window.tabletAPI.startDirectPurchase(this.machineId, compartmentIndex);
      this.setState('WAITING_PAYMENT', {
        currentOrder: {
          orderId: result.orderId,
          amount: result.amount,
          expiresAt: Date.now() + 5 * 60 * 1000,
        },
      });
    } catch (err) {
      this.setState('ERROR', { errorMessage: err.message });
    }
  }

  async onCancelPayment() {
    if (this.currentOrder && this.currentOrder.orderId) {
      try {
        await window.tabletAPI.cancelGachaOrder(this.machineId, this.currentOrder.orderId);
      } catch (err) {
        console.warn('Failed to cancel order on server:', err);
      }
    }
    this.currentOrder = null;
    this.setState('IDLE');
  }

  async onEnterPairMode() {
    try {
      const res = await window.tabletAPI.generatePairToken(this.machineId);
      this.setState('PAIR_MODE', {
        pairToken: res.token || res.pairToken || 'demo-token',
      });
    } catch (err) {
      // If API not ready, use demo token
      this.setState('PAIR_MODE', { pairToken: 'demo-token-' + Date.now() });
    }
  }

  /* ═══════════════════════════════════════════════════
     QR CODE GENERATION
     ═══════════════════════════════════════════════════ */

  _generatePaymentQR() {
    const target = document.getElementById('qr-target');
    if (!target || !this.currentOrder) return;
    const url = `http://localhost:3000/mobile/#/consumer/pay/${this.currentOrder.orderId}`;
    QRCode.toCanvas(url, { width: 220, margin: 2, color: { dark: '#0a0a1a', light: '#ffffff' } })
      .then((canvas) => {
        target.innerHTML = '';
        target.appendChild(canvas);
      })
      .catch((e) => console.error('QR error', e));
  }

  _generatePairQR() {
    const target = document.getElementById('pair-qr-target');
    if (!target) return;
    const url = `http://localhost:3000/mobile/#/store/pair?token=${this.pairToken}`;
    QRCode.toCanvas(url, { width: 220, margin: 2, color: { dark: '#0a0a1a', light: '#ffffff' } })
      .then((canvas) => {
        target.innerHTML = '';
        target.appendChild(canvas);
      })
      .catch((e) => console.error('QR error', e));
  }

  /* ═══════════════════════════════════════════════════
     COUNTDOWNS
     ═══════════════════════════════════════════════════ */

  _startPaymentCountdown() {
    if (!this.currentOrder) return;
    const expiresAt = typeof this.currentOrder.expiresAt === 'number'
      ? this.currentOrder.expiresAt
      : new Date(this.currentOrder.expiresAt).getTime();
    const totalDuration = expiresAt - Date.now();

    const tick = () => {
      const remaining = Math.max(0, expiresAt - Date.now());
      const el = document.getElementById('payment-countdown');
      const fill = document.getElementById('countdown-fill');
      if (!el) return;

      const min = Math.floor(remaining / 60000);
      const sec = Math.floor((remaining % 60000) / 1000);
      el.textContent = `${min}:${String(sec).padStart(2, '0')}`;

      if (remaining < 30000) {
        el.classList.add('countdown--warning');
      }

      if (fill) {
        fill.style.width = `${(remaining / totalDuration) * 100}%`;
      }

      if (remaining <= 0) {
        clearInterval(this._countdownTimer);
        this.setState('ERROR', { errorMessage: '⏰ 付款逾時，訂單已取消' });
      }
    };

    tick();
    this._countdownTimer = setInterval(tick, 1000);
  }

  _startResultCountdown() {
    let remaining = 15;
    const tick = () => {
      const el = document.getElementById('result-countdown');
      if (!el) return;
      el.textContent = remaining;
      if (remaining <= 5) el.classList.add('countdown--warning');
      if (remaining <= 0) {
        clearInterval(this._resultTimer);
        this.setState('IDLE');
      }
      remaining--;
    };
    tick();
    this._resultTimer = setInterval(tick, 1000);
  }

  _startPairCountdown() {
    let remaining = 10 * 60; // 10 minutes
    const tick = () => {
      const el = document.getElementById('pair-timer');
      if (!el) return;
      const min = Math.floor(remaining / 60);
      const sec = remaining % 60;
      el.textContent = `${min}:${String(sec).padStart(2, '0')}`;
      if (remaining <= 0) {
        clearInterval(this._pairTimer);
        this.setState('IDLE');
      }
      remaining--;
    };
    tick();
    this._pairTimer = setInterval(tick, 1000);
  }

  /* ═══════════════════════════════════════════════════
     GACHA ANIMATION
     ═══════════════════════════════════════════════════ */

  _runGachaAnimation() {
    const result = this.currentResult;
    if (!result) {
      // Demo fallback
      this.currentResult = { compartment: 3, productName: '日式炸雞便當', category: '便當' };
    }

    const winnerNum = this.currentResult.compartment;
    const cells = document.querySelectorAll('.gacha-cell');
    if (!cells.length) return;

    const emojis = ['🍱', '🍛', '🥪', '🍕', '🥗', '🍜', '🍙', '🥟', '🍣', '🌮'];

    // Phase 1: rapid shuffle (2.5 seconds)
    let shuffleCount = 0;
    const shuffleInterval = setInterval(() => {
      cells.forEach((cell) => {
        const emojiEl = cell.querySelector('.gacha-cell__emoji');
        if (emojiEl) {
          emojiEl.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        }
        // Random highlight
        cell.classList.toggle('gacha-cell--highlight', Math.random() > 0.7);
      });
      shuffleCount++;
    }, 80);

    // Phase 2: slow down and settle (at 2.5s)
    setTimeout(() => {
      clearInterval(shuffleInterval);

      // Remove all highlights
      cells.forEach((c) => c.classList.remove('gacha-cell--highlight'));

      // Sequential reveal — highlight each cell briefly, then land on winner
      let idx = 0;
      const scanInterval = setInterval(() => {
        cells.forEach((c) => c.classList.remove('gacha-cell--highlight'));
        if (idx < cells.length) {
          cells[idx].classList.add('gacha-cell--highlight');

          // Use GSAP for bounce
          if (typeof gsap !== 'undefined') {
            gsap.fromTo(cells[idx], { scale: 1.05 }, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
          }
        }
        idx++;
        if (idx > cells.length) {
          clearInterval(scanInterval);

          // Final: highlight winner
          const winnerEl = document.getElementById(`gacha-cell-${winnerNum}`) || cells[0];
          winnerEl.classList.add('gacha-cell--highlight');

          if (typeof gsap !== 'undefined') {
            gsap.fromTo(winnerEl, { scale: 0.8 }, {
              scale: 1.12, duration: 0.5, ease: 'elastic.out(1, 0.4)',
              onComplete: () => {
                gsap.to(winnerEl, { scale: 1.05, duration: 0.3 });
              },
            });
          }

          // Fire confetti, then transition to RESULT
          this._fireConfetti();
          setTimeout(() => {
            this.setState('RESULT');
          }, 1200);
        }
      }, 200);
    }, 2500);
  }

  /* ═══════════════════════════════════════════════════
     CONFETTI
     ═══════════════════════════════════════════════════ */

  _fireConfetti() {
    if (typeof confetti !== 'function') return;

    // Burst from center
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#00e676', '#00bfa5', '#ffd54f', '#ffab00', '#00bcd4'],
    });

    // Side bursts
    setTimeout(() => {
      confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, colors: ['#ffd54f', '#ffab00'] });
      confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors: ['#00e676', '#00bcd4'] });
    }, 300);
  }

  /* ═══════════════════════════════════════════════════
     POLLING CALLBACKS
     ═══════════════════════════════════════════════════ */

  _handleStatusUpdate(status) {
    if (!status) return;
    this.machineStatus = {
      machineName: status.machineName || this.machineStatus.machineName,
      temperature: status.temperature ?? this.machineStatus.temperature,
      compartments: status.compartments || this.machineStatus.compartments,
      totalStocked: status.totalStocked ?? (status.compartments || []).filter((c) => c.status === 'stocked').length,
      averagePrice: status.averagePrice ?? this.machineStatus.averagePrice,
    };

    // Re-render if on IDLE to keep data fresh
    if (this.state === 'IDLE') {
      this.render();
    }

    // If server says payment received while we're waiting
    if (this.state === 'WAITING_PAYMENT' && status.orderStatus === 'paid') {
      this.setState('WAITING_TRIGGER');
    }
  }

  _handleLatestResult(result) {
    if (!result || !result.compartment) return;
    // Only act if we're waiting for trigger
    if (this.state === 'WAITING_TRIGGER') {
      this.currentResult = result;
      this.setState('GACHA_ANIMATION');
    }
  }

  /* ═══════════════════════════════════════════════════
     FILTERED POOL CALCULATION
     ═══════════════════════════════════════════════════ */

  _getFilteredPool() {
    const comps = this.machineStatus.compartments.filter((c) => c.status === 'stocked');
    if (!comps.length) {
      return { count: this.machineStatus.totalStocked || 0, avgPrice: this.machineStatus.averagePrice || 0 };
    }
    const filtered = comps.filter((c) => {
      const allergens = c.allergens || [];
      return !allergens.some((a) => this.excludedAllergens.has(a));
    });
    const avgPrice = filtered.length
      ? Math.round(filtered.reduce((sum, c) => sum + (c.price || 0), 0) / filtered.length)
      : 0;
    return { count: filtered.length, avgPrice };
  }

  /* ═══════════════════════════════════════════════════
     AMBIENT PARTICLES
     ═══════════════════════════════════════════════════ */

  _injectParticles() {
    const layer = document.createElement('div');
    layer.className = 'particle-layer';
    for (let i = 0; i < 8; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
  }
}

/* ── Bootstrap ── */
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new TabletApp();
});
