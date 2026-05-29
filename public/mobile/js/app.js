/* ============================================
   惜食救援 — Main Application & Router
   ============================================ */

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// --- Bilingual Translation System (i18n) ---
const i18n = {
    currentLang: localStorage.getItem('app_lang') || 'zh',
    
    zh: {
        // Shared & Nav
        appTitle: "SFood 惜食救援",
        logout: "登出",
        login: "登入",
        register: "註冊",
        home: "主頁",
        map: "地圖",
        orders: "訂單",
        points: "點數",
        dashboard: "主頁",
        add: "上架",
        machine: "機台",
        back: "←",
        
        // Home View
        hello: "哈囉，",
        slogan: "用驚喜與美味，拯救每一份即期惜食。",
        liveStatus: "智慧惜食機",
        running: "運行中",
        waitingPayment: "待付款",
        waitingKnob: "請轉動旋鈕！",
        dispensing: "出餐中",
        temp: "即時櫃溫 (ESP32)",
        humidity: "即時濕度 (ESP32)",
        onlineGood: "運行良好",
        onlineStatus: "目前在線狀況：",
        stockedCount: "已上架 {count} 個商品",
        quickMenu: "快速選單",
        mapSearch: "地圖搜尋",
        findStore: "尋找附近惜食店家",
        scanPay: "掃碼付款",
        directTrigger: "直接啟用與出餐",
        petSystem: "惜食寵物",
        pointsLabel: "環保點數",
        checkHistory: "查看您的消費歷程",
        pointsSub: "累計買剩食的愛心點數",
        sdgAction: "SDGs 永續惜食行動"
    },
    en: {
        // Shared & Nav
        appTitle: "SFood Rescue",
        logout: "Logout",
        login: "Login",
        register: "Register",
        home: "Home",
        map: "Map",
        orders: "Orders",
        points: "Points",
        dashboard: "Dashboard",
        add: "Sell",
        machine: "Machine",
        back: "←",
        
        // Home View
        hello: "Hello, ",
        slogan: "Save every surplus meal with surprise & taste.",
        liveStatus: "Smart Vending Machine",
        running: "Active",
        waitingPayment: "Unpaid",
        waitingKnob: "Turn Knob!",
        dispensing: "Dispensing",
        temp: "Cabinet Temp (ESP32)",
        humidity: "Cabinet Humidity (ESP32)",
        onlineGood: "Healthy",
        onlineStatus: "Connection status: ",
        stockedCount: "{count} items stocked",
        quickMenu: "Quick Actions",
        mapSearch: "Map Search",
        findStore: "Find surplus shops nearby",
        scanPay: "Scan to Pay",
        directTrigger: "Instantly unlock & dispense",
        petSystem: "Eco Pet",
        pointsLabel: "Eco Points",
        checkHistory: "View your purchase history",
        pointsSub: "Accumulate points by saving surplus",
        sdgAction: "SDGs Sustainable Action"
    }
};

window.i18n = i18n;

window.t = function(key, replacements = {}) {
    const lang = i18n.currentLang;
    let text = i18n[lang][key] || i18n['zh'][key] || key;
    for (const [k, v] of Object.entries(replacements)) {
        text = text.replace(`{${k}}`, v);
    }
    return text;
};

window.toggleLanguage = function() {
    i18n.currentLang = i18n.currentLang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('app_lang', i18n.currentLang);
    router.resolve();
};

// --- Theme Management (Dark & Light Mode) ---
window.toggleTheme = function() {
    const isDark = document.body.classList.toggle('dark-theme');
    document.documentElement.classList.toggle('dark-theme', isDark);
    localStorage.setItem('app_theme', isDark ? 'dark' : 'light');
};

// Auto-initialize theme on boot
(function() {
    const savedTheme = localStorage.getItem('app_theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        document.documentElement.classList.add('dark-theme');
    }
})();

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
        // --- 關閉相機鏡頭 ---
        if (window.activeQRScanner) {
            try {
                const scannerToStop = window.activeQRScanner;
                window.activeQRScanner = null; // 立即清空，避免重複觸發
                scannerToStop.stop().then(() => {
                    console.log('[鏡頭] 鏡頭已成功關閉 (切換路由)');
                }).catch(err => {
                    console.warn('[警告] 關閉鏡頭失敗:', err);
                });
            } catch (err) {
                console.warn('[警告] 關閉鏡頭異常:', err);
            }
        }

        // --- 銷毀 PixiJS 畫布以防記憶體洩漏 ---
        if (window.petGameInstance) {
            try {
                window.petGameInstance.destroy();
                window.petGameInstance = null;
                console.log('[寵物遊戲] PixiJS 畫布與遊戲實例已銷毀');
            } catch (err) {
                console.warn('[警告] 銷毀寵物遊戲實例異常:', err);
            }
        }

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
    if (page) {
        page.classList.add('page-enter');
        if (page.classList.contains('pet-page') || page.id === 'pet-page-container') {
            document.body.classList.add('pet-mode');
            app.classList.add('pet-mode');
        } else {
            document.body.classList.remove('pet-mode');
            app.classList.remove('pet-mode');
        }
    } else {
        document.body.classList.remove('pet-mode');
        app.classList.remove('pet-mode');
    }
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
            <div class="nav-item ${activeTab === 'home' ? 'active' : ''}" onclick="router.navigate('/consumer/home')">
                <span class="nav-label">${window.t('home')}</span>
            </div>
            <div class="nav-item ${activeTab === 'map' ? 'active' : ''}" onclick="router.navigate('/consumer/map')">
                <span class="nav-label">${window.t('map')}</span>
            </div>
            <div class="nav-item ${activeTab === 'orders' ? 'active' : ''}" onclick="router.navigate('/consumer/orders')">
                <span class="nav-label">${window.t('orders')}</span>
            </div>
            <div class="nav-item ${activeTab === 'points' ? 'active' : ''}" onclick="router.navigate('/consumer/points')">
                <span class="nav-label">${window.t('points')}</span>
            </div>
            <div class="nav-item ${activeTab === 'profile' ? 'active' : ''}" onclick="authManager.logout()">
                <span class="nav-label">${window.t('logout')}</span>
            </div>
        `;
    } else if (authManager.isStoreOwner()) {
        nav.innerHTML = `
            <div class="nav-item ${activeTab === 'dashboard' ? 'active' : ''}" onclick="router.navigate('/store/dashboard')">
                <span class="nav-label">${window.t('dashboard')}</span>
            </div>
            <div class="nav-item ${activeTab === 'add' ? 'active' : ''}" onclick="router.navigate('/store/add-item')">
                <span class="nav-label">${window.t('add')}</span>
            </div>
            <div class="nav-item ${activeTab === 'machine' ? 'active' : ''}" onclick="router.navigate('/store/pair')">
                <span class="nav-label">${window.t('machine')}</span>
            </div>
            <div class="nav-item ${activeTab === 'orders' ? 'active' : ''}" onclick="router.navigate('/store/orders')">
                <span class="nav-label">${window.t('orders')}</span>
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
    const chars = { bento: '便', bread: '麵', vegetable: '蔬', other: '他' };
    return chars[category] || chars.other;
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
        router.navigate('/consumer/home');
    } else {
        router.navigate('/store/dashboard');
    }
});

router.add('/login', renderLoginPage);
router.add('/register', renderRegisterPage);
router.add('/consumer/home', renderConsumerHomePage);
router.add('/consumer/map', renderConsumerMapPage);
router.add('/consumer/store/:id', renderConsumerStorePage);
router.add('/consumer/pay/:orderId', renderConsumerPayPage);
router.add('/consumer/orders', renderConsumerOrdersPage);
router.add('/consumer/points', renderConsumerPointsPage);
router.add('/consumer/pet', renderConsumerPetPage);
router.add('/consumer/scan', renderConsumerScanPage);
router.add('/store/dashboard', renderStoreDashboardPage);
router.add('/store/add-item', renderStoreAddItemPage);
router.add('/store/pair', renderStorePairPage);
router.add('/store/machine/:id', renderStoreMachinePage);
router.add('/store/orders', renderStoreOrdersPage);

// Start the router
router.start();
