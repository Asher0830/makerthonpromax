/* ═══════════════════════════════════════════════════
   FoodD Mobile — Register Page
   ═══════════════════════════════════════════════════ */

async function renderRegisterPage() {
  /* Hide bottom nav */
  updateBottomNav();

  const html = `
    <div class="login-page">
      <div class="register-header" style="display: flex; align-items: center; gap: 16px; margin-bottom: 28px; width: 100%; max-width: 400px; justify-content: flex-start; text-align: left;">
        <a href="#/login" class="back-arrow" style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: var(--accent-light, rgba(0, 128, 85, 0.06)); border: 1px solid var(--border); color: var(--text); font-size: 1.25rem; font-weight: 700; text-decoration: none; transition: all 0.2s ease; box-shadow: var(--shadow-sm); cursor: pointer; flex-shrink: 0;" title="返回登入">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </a>
        <h2 class="register-title" style="font-size: 1.5rem; font-weight: 800; color: var(--text); margin: 0; letter-spacing: -0.5px;">建立消費者帳號</h2>
      </div>

      <form class="login-form" id="register-form" onsubmit="return false;">
        <div class="error-message" id="register-error"></div>

        <div class="form-group">
          <label class="form-label" for="register-name">姓名</label>
          <input
            class="form-input"
            id="register-name"
            type="text"
            placeholder="請輸入姓名"
            autocomplete="name"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="register-email">電子信箱</label>
          <input
            class="form-input"
            id="register-email"
            type="email"
            placeholder="請輸入電子信箱"
            autocomplete="email"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="register-password">密碼</label>
          <input
            class="form-input"
            id="register-password"
            type="password"
            placeholder="請輸入密碼（至少 6 碼）"
            autocomplete="new-password"
            minlength="6"
            required
          />
        </div>

        <div class="form-group" style="margin-top: 4px;">
          <div style="padding: 12px 14px; border: 1px solid rgba(28,27,26,0.08); border-radius: 12px; background: var(--bg-secondary); color: var(--text-secondary); font-size: 13px; line-height: 1.5;">
            目前僅開放消費者註冊。店家請使用系統既有帳號登入後管理機台與商品。
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-block btn-lg" id="register-submit-btn">
          註冊
        </button>
      </form>
    </div>
  `;

  renderPage(html);

  /* ── Bind form submit ── */
  const form = document.getElementById('register-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const errorEl = document.getElementById('register-error');
    const submitBtn = document.getElementById('register-submit-btn');

    if (!name || !email || !password) {
      errorEl.textContent = '請填寫所有欄位';
      errorEl.classList.add('show');
      return;
    }

    if (password.length < 6) {
      errorEl.textContent = '密碼至少需要 6 個字元';
      errorEl.classList.add('show');
      return;
    }

    try {
      errorEl.classList.remove('show');
      submitBtn.disabled = true;
      submitBtn.textContent = '註冊中…';
      showLoading();

      await authManager.register(name, email, password, 'consumer');

      hideLoading();

      router.navigate('/consumer/home');
    } catch (err) {
      hideLoading();
      submitBtn.disabled = false;
      submitBtn.textContent = '註冊';
      errorEl.textContent = err.message || '註冊失敗，請稍後再試';
      errorEl.classList.add('show');
    }
  });
}
