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

      <div class="card pet-banner" onclick="router.navigate('/consumer/pet')" style="cursor: pointer; display: flex; align-items: center; gap: 16px; background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid rgba(212,163,89,0.3); color: #fff; padding: 16px; border-radius: 12px; margin-bottom: 20px;">
        <div class="pet-icon" style="font-size: 32px; background: rgba(212, 163, 89, 0.1); border-radius: 50%; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; border: 1px solid #d4a359;">🐰</div>
        <div class="pet-text" style="flex: 1;">
          <div class="pet-title" style="font-size: 16px; font-weight: 600; color: #f59e0b; margin-bottom: 4px;">🐾 惜食寵物養成系統</div>
          <div class="pet-subtitle" style="font-size: 12px; color: #94a3b8;">使用點數餵養與裝扮您的專屬寵物！</div>
        </div>
        <div class="arrow" style="font-size: 18px; color: #d4a359;">&rarr;</div>
      </div>

      <div class="section-title">點數紀錄</div>
      <div class="point-history-list">
        ${historyHTML}
      </div>
    </div>
  `;

  renderPage(html);
}
