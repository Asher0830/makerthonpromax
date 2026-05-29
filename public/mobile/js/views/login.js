/* ═══════════════════════════════════════════════════
   FoodD Mobile — Login Page
   ═══════════════════════════════════════════════════ */

async function renderLoginPage() {
  /* Auto-redirect if already logged in */
  if (authManager.isLoggedIn()) {
    if (authManager.isStoreOwner()) {
      router.navigate('/store/dashboard');
    } else {
      router.navigate('/consumer/home');
    }
    return;
  }

  /* Hide bottom nav */
  updateBottomNav();

  const html = `
    <div class="login-page">
      <div class="login-logo">
        <div class="logo-icon" style="font-family:'Outfit',sans-serif; font-weight:800; font-size:2rem; letter-spacing:-1.5px; color:var(--primary-color);">SFood</div>
        <h1 class="logo-title">refuse to waste</h1>
        <p class="logo-subtitle">讓美食不被浪費</p>
      </div>

      <form class="login-form" id="login-form" onsubmit="return false;">
        <div class="error-message" id="login-error"></div>

        <div class="form-group">
          <label class="form-label" for="login-email">電子信箱</label>
          <input
            class="form-input"
            id="login-email"
            type="email"
            placeholder="請輸入電子信箱"
            autocomplete="email"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="login-password">密碼</label>
          <input
            class="form-input"
            id="login-password"
            type="password"
            placeholder="請輸入密碼"
            autocomplete="current-password"
            required
          />
        </div>

        <button type="submit" class="btn btn-primary btn-block btn-lg" id="login-submit-btn">
          登入
        </button>
      </form>

      <div class="login-link">
        還沒有消費者帳號？<a href="#/register">註冊</a>
      </div>

      <div style="margin-top: 24px; text-align: center; border-top: 1px dashed rgba(28,27,26,0.1); padding-top: 20px;">
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; font-weight: 500;">想要訪客直接付款或取餐？</p>
        <button class="btn btn-secondary btn-block" onclick="router.navigate('/consumer/scan')" style="border: 1px solid var(--primary-color); color: var(--primary-color); background: transparent; font-weight: 700; border-radius: 8px;">
          訪客直接掃碼
        </button>
      </div>
    </div>
  `;

  renderPage(html);

  /* ── Bind form submit ── */
  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit-btn');

    if (!email || !password) {
      errorEl.textContent = '請填寫所有欄位';
      errorEl.classList.add('show');
      return;
    }

    try {
      errorEl.classList.remove('show');
      submitBtn.disabled = true;
      submitBtn.textContent = '登入中…';
      showLoading();

      await authManager.login(email, password);

      hideLoading();

      /* Redirect based on role */
      const redirectHash = localStorage.getItem('redirect_after_login');
      if (redirectHash) {
        localStorage.removeItem('redirect_after_login');
        location.hash = redirectHash;
      } else if (authManager.isStoreOwner()) {
        router.navigate('/store/dashboard');
      } else {
        router.navigate('/consumer/home');
      }
    } catch (err) {
      hideLoading();
      submitBtn.disabled = false;
      submitBtn.textContent = '登入';
      errorEl.textContent = err.message || '登入失敗，請稍後再試';
      errorEl.classList.add('show');
    }
  });
}
