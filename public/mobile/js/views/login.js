/* ═══════════════════════════════════════════════════
   FoodD Mobile — Login Page
   ═══════════════════════════════════════════════════ */

async function renderLoginPage() {
  /* Auto-redirect if already logged in */
  if (authManager.isLoggedIn()) {
    if (authManager.isStoreOwner()) {
      router.navigate('/store/dashboard');
    } else {
      router.navigate('/consumer/map');
    }
    return;
  }

  /* Hide bottom nav */
  updateBottomNav();

  const html = `
    <div class="login-page">
      <div class="login-logo">
        <div class="logo-icon" style="font-family:'Outfit',sans-serif; font-weight:800; font-size:2rem; letter-spacing:-1px; color:var(--primary-color);">FD</div>
        <h1 class="logo-title">惜食救援</h1>
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
        router.navigate('/consumer/map');
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
