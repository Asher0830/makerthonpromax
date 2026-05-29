/* ============================================
   惜食救援 — Main Application & Router
   ============================================ */

// --- Hash Router ---
class Router {
    constructor() {
        this.routes = {};
        this.currentView = null;
    }

    add(path, handler) {
        this.routes[path] = handler;
    }

    navigate(path) {
        location.hash = '#' + path;
    }

    start() {
        window.addEventListener('hashchange', () => this.resolve());
        this.resolve();
    }

    resolve() {
        let hash = location.hash.slice(1) || '/';

        // Strip query string for matching but keep it accessible
        const qIndex = hash.indexOf('?');
        const cleanHash = qIndex >= 0 ? hash.substring(0, qIndex) : hash;

        // Try exact match first
        if (this.routes[cleanHash]) {
            this.routes[cleanHash]();
            return;
        }

        // Try parameterized routes like /consumer/store/:id
        for (const [pattern, handler] of Object.entries(this.routes)) {
            const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '([^/]+)') + '$');
            const match = cleanHash.match(regex);
            if (match) {
                handler(...match.slice(1));
                return;
            }
        }

        // Default: redirect to login
        this.navigate('/login');
    }
}

// --- Toast Notification System ---
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// --- Loading Overlay ---
function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('active');
}

// --- Render Page Content with Transition ---
function renderPage(html) {
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = html;
    const page = app.querySelector('.page');
    if (page) page.classList.add('page-enter');
}

// --- Update Bottom Navigation ---
function updateBottomNav(activeTab) {
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;

    const user = authManager.getUser();

    if (!user || location.hash.includes('/login') || location.hash.includes('/register')) {
        nav.classList.add('hidden');
        return;
    }

    nav.classList.remove('hidden');

    if (authManager.isConsumer()) {
        nav.innerHTML = `
            <div class="nav-item ${activeTab === 'map' ? 'active' : ''}" onclick="router.navigate('/consumer/map')">
                <span class="nav-icon">🗺️</span>
                <span class="nav-label">地圖</span>
            </div>
            <div class="nav-item ${activeTab === 'orders' ? 'active' : ''}" onclick="router.navigate('/consumer/orders')">
                <span class="nav-icon">📋</span>
                <span class="nav-label">訂單</span>
            </div>
            <div class="nav-item ${activeTab === 'points' ? 'active' : ''}" onclick="router.navigate('/consumer/points')">
                <span class="nav-icon">💎</span>
                <span class="nav-label">點數</span>
            </div>
            <div class="nav-item ${activeTab === 'profile' ? 'active' : ''}" onclick="authManager.logout()">
                <span class="nav-icon">👤</span>
                <span class="nav-label">登出</span>
            </div>
        `;
    } else if (authManager.isStoreOwner()) {
        nav.innerHTML = `
            <div class="nav-item ${activeTab === 'dashboard' ? 'active' : ''}" onclick="router.navigate('/store/dashboard')">
                <span class="nav-icon">🏠</span>
                <span class="nav-label">主頁</span>
            </div>
            <div class="nav-item ${activeTab === 'add' ? 'active' : ''}" onclick="router.navigate('/store/add-item')">
                <span class="nav-icon">➕</span>
                <span class="nav-label">上架</span>
            </div>
            <div class="nav-item ${activeTab === 'machine' ? 'active' : ''}" onclick="router.navigate('/store/pair')">
                <span class="nav-icon">🏪</span>
                <span class="nav-label">機台</span>
            </div>
            <div class="nav-item ${activeTab === 'orders' ? 'active' : ''}" onclick="router.navigate('/store/orders')">
                <span class="nav-icon">📋</span>
                <span class="nav-label">訂單</span>
            </div>
        `;
    }
}

// --- Utility: Format Date ---
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// --- Utility: Time Ago ---
function timeAgo(dateStr) {
    if (!dateStr) return '';
    const now = Date.now();
    const d = new Date(dateStr).getTime();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '剛剛';
    if (mins < 60) return `${mins} 分鐘前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小時前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
}

// --- Utility: Status Text ---
function getStatusText(status) {
    const map = {
        PENDING: '待付款',
        PAID: '已付款',
        COMPLETED: '已完成',
        TIMEOUT_REFUNDED: '已退款',
        CANCELLED: '已取消'
    };
    return map[status] || status;
}

// --- Utility: Category Helpers ---
function getCategoryColor(category) {
    const colors = { bento: '#E65100', bread: '#F57F17', vegetable: '#2E7D32', other: '#546E7A' };
    return colors[category] || colors.other;
}

function getCategoryEmoji(category) {
    const emojis = { bento: '🍱', bread: '🍞', vegetable: '🥬', other: '🍽️' };
    return emojis[category] || emojis.other;
}

function getCategoryName(category) {
    const names = { bento: '便當', bread: '麵包', vegetable: '蔬菜', other: '其他' };
    return names[category] || names.other;
}

function getCategoryBadgeClass(category) {
    const classes = { bento: 'badge-bento', bread: 'badge-bread', vegetable: 'badge-vegetable', other: 'badge-other' };
    return classes[category] || classes.other;
}

// --- Initialize App ---
const authManager = new AuthManager();
const api = new ApiClient();
const router = new Router();

// Register all routes
router.add('/', () => {
    if (!authManager.isLoggedIn()) {
        router.navigate('/login');
    } else if (authManager.isConsumer()) {
        router.navigate('/consumer/map');
    } else {
        router.navigate('/store/dashboard');
    }
});

router.add('/login', renderLoginPage);
router.add('/register', renderRegisterPage);
router.add('/consumer/map', renderConsumerMapPage);
router.add('/consumer/store/:id', renderConsumerStorePage);
router.add('/consumer/pay/:orderId', renderConsumerPayPage);
router.add('/consumer/orders', renderConsumerOrdersPage);
router.add('/consumer/points', renderConsumerPointsPage);
router.add('/store/dashboard', renderStoreDashboardPage);
router.add('/store/add-item', renderStoreAddItemPage);
router.add('/store/pair', renderStorePairPage);
router.add('/store/machine/:id', renderStoreMachinePage);
router.add('/store/orders', renderStoreOrdersPage);

// Start the router
router.start();
