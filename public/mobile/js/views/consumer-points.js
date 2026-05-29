/* ═══════════════════════════════════════════════════
   FoodD Mobile — Consumer Points Page
   ═══════════════════════════════════════════════════ */

async function renderConsumerPointsPage() {
  updateBottomNav('points');
  showLoading();

  let pointsValue = 0;
  let history = [];

  try {
    const data = await api.getPoints();
    pointsValue = data.points ?? data.balance ?? 0;
    history = data.history || [];
  } catch (err) {
    console.error('Failed to load points:', err);
    /* Show 0 on error */
  }

  hideLoading();

  /* ── Build history list ── */
  let historyHTML = '';

  if (history.length === 0) {
    historyHTML = `
      <div class="empty-state">
        <div class="empty-state-text">開始購買惜食商品來獲得點數吧！</div>
      </div>
    `;
  } else {
    historyHTML = history.map((entry) => {
      const date = entry.date || entry.createdAt
        ? new Date(entry.date || entry.createdAt).toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '';
      const description = entry.description || entry.reason || '獲得點數';
      const amount = entry.amount || entry.points || 0;

      return `
        <div class="point-history-item">
          <div class="point-history-left">
            <div class="point-history-desc">${description}</div>
            <div class="point-history-date">${date}</div>
          </div>
          <div class="point-history-amount">+${amount}</div>
        </div>
      `;
    }).join('');
  }

  const html = `
    <div class="page-header">
      <h1 class="header-title">我的點數</h1>
    </div>

    <div class="page-content">
      <div class="points-display">
        <div class="points-icon">PTS</div>
        <div class="points-value">${pointsValue}</div>
        <div class="points-label">我的惜食點數</div>
      </div>

      <div class="card pet-banner">
        <div class="pet-icon">PETS</div>
        <div class="pet-text">
          <div class="pet-title">寵物系統即將推出！</div>
          <div class="pet-subtitle">集點兌換可愛的虛擬寵物</div>
        </div>
      </div>

      <div class="section-title">點數紀錄</div>
      <div class="point-history-list">
        ${historyHTML}
      </div>
    </div>
  `;

  renderPage(html);
}
