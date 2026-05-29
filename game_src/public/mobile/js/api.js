/**
 * ==========================================================================
 * 惜食小幫手 — 虛擬寵物養成系統 API 與 UI 串接模組
 * ==========================================================================
 */

class PetApi {
    constructor() {
        this.baseUrl = 'http://localhost:3000/api/v1';
        this.token = null;
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('token');
    }

    // 基礎 Request 封裝
    async request(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(`${this.baseUrl}${url}`, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                // 若 JWT token 過期或無效，自動登出
                if (response.status === 401) {
                    showToast('認證逾期，請重新登入');
                    this.clearToken();
                    showScreen('screen-auth');
                }
                throw new Error(data.error?.message || '發生錯誤，請稍後再試');
            }

            return data;
        } catch (error) {
            console.error(`API 錯誤 [${url}]:`, error);
            throw error;
        }
    }

    // ============================================
    // 後端 API 端點串接
    // ============================================

    // 註冊 / 登入整合
    async loginOrRegister(username) {
        try {
            // 嘗試以登入處理
            const res = await this.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username })
            });
            this.setToken(res.data.token);
            return res.data.user;
        } catch (err) {
            // 若使用者不存在，則嘗試自動註冊
            if (err.message === '使用者不存在') {
                const res = await this.request('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ username })
                });
                this.setToken(res.data.token);
                showToast(`註冊成功！贈送 100 惜食點數！✨`);
                return res.data.user;
            }
            throw err;
        }
    }

    // 獲取目前使用者資訊
    async getMe() {
        return this.request('/auth/me');
    }

    // 建立寵物
    async createPet(name, species = 'rice_bunny') {
        return this.request('/pet/create', {
            method: 'POST',
            body: JSON.stringify({ name, species })
        });
    }

    // 獲取寵物與 HUD 狀態
    async getPetStatus() {
        return this.request('/pet/status');
    }

    // 餵食寵物
    async feedPet(feedType) {
        return this.request('/pet/feed', {
            method: 'POST',
            body: JSON.stringify({ feed_type: feedType })
        });
    }

    // 互動玩耍 (play, bath, pet)
    async playPet(playType) {
        return this.request('/pet/play', {
            method: 'POST',
            body: JSON.stringify({ play_type: playType })
        });
    }

    // 獲取商店資訊
    async getShop() {
        return this.request('/pet/shop');
    }

    // 購買道具
    async buyItem(itemId) {
        return this.request('/pet/buy-item', {
            method: 'POST',
            body: JSON.stringify({ item_id: itemId })
        });
    }

    // 裝備道具
    async equipItem(itemId, equip) {
        return this.request('/pet/equip', {
            method: 'POST',
            body: JSON.stringify({ item_id: itemId, equip })
        });
    }
}

// ==========================================================================
// 全局 UI 互動輔助函數
// ==========================================================================

// 畫面切換器
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(scr => {
        scr.classList.remove('active');
    });
    const activeScreen = document.getElementById(screenId);
    activeScreen.classList.add('active');

    // 重新載入寵物狀態與初始化 PixiJS 畫布
    if (screenId === 'screen-game') {
        initGame();
    }
}

// 顯示 Toast 訊息
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    // 清除先前的 Timer 避免重複觸發
    if (window.toastTimer) clearTimeout(window.toastTimer);
    
    window.toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// 屬性進度條更新動畫 (使用 GSAP 平滑變動)
function updateHUD(pet, userPoints, cooldowns) {
    // 1. 使用者名稱與點數
    document.getElementById('display-username').textContent = pet.name;
    document.getElementById('display-points').textContent = userPoints;

    // 2. 飽食度 HUD
    document.getElementById('val-fullness').textContent = `${pet.fullness}/100`;
    gsap.to('#bar-fullness', { width: `${pet.fullness}%`, duration: 0.8, ease: 'back.out(1.2)' });

    // 3. 心情 HUD
    document.getElementById('val-happiness').textContent = `${pet.happiness}/100`;
    gsap.to('#bar-happiness', { width: `${pet.happiness}%`, duration: 0.8, ease: 'back.out(1.2)' });

    // 4. 等級與 EXP HUD
    document.getElementById('val-level').textContent = pet.level;
    document.getElementById('val-exp').textContent = `${pet.exp}/${pet.exp_to_next} EXP`;
    const expPercentage = Math.min(100, (pet.exp / pet.exp_to_next) * 100);
    gsap.to('#bar-exp', { width: `${expPercentage}%`, duration: 0.8, ease: 'power2.out' });

    // 5. 更新互動冷卻時間狀態
    updateCooldownsUI(cooldowns);
}

// 冷卻時間 UI 按鈕狀態渲染
function updateCooldownsUI(cooldowns) {
    const now = new Date();

    const checkCooldown = (cdString, btnId, originalText) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;

        if (cdString) {
            const cdTime = new Date(cdString);
            if (cdTime > now) {
                btn.disabled = true;
                btn.classList.add('disabled');
                
                // 動態倒數定時器
                const updateCountdown = () => {
                    const diffMs = cdTime - new Date();
                    if (diffMs <= 0) {
                        btn.disabled = false;
                        btn.classList.remove('disabled');
                        const buyBtn = btn.querySelector('.btn-action-buy') || btn.querySelector('.dock-text') || btn;
                        buyBtn.textContent = originalText;
                        clearInterval(btn.cdInterval);
                    } else {
                        const sec = Math.ceil(diffMs / 1000);
                        const min = Math.floor(sec / 60);
                        const remSec = sec % 60;
                        const buyBtn = btn.querySelector('.btn-action-buy') || btn.querySelector('.dock-text') || btn;
                        buyBtn.textContent = `${min}:${remSec.toString().padStart(2, '0')}`;
                    }
                };
                clearInterval(btn.cdInterval);
                updateCountdown();
                btn.cdInterval = setInterval(updateCountdown, 1000);
                return;
            }
        }
        btn.disabled = false;
        btn.classList.remove('disabled');
        const buyBtn = btn.querySelector('.btn-action-buy') || btn.querySelector('.dock-text') || btn;
        buyBtn.textContent = originalText;
        clearInterval(btn.cdInterval);
    };

    // 餵食冷卻時間 (normal 與 premium 共用)
    checkCooldown(cooldowns.feed, 'modal-feed', '餵食'); // 在 Modal 內會另外依卡片判定
    // 玩耍選項
    checkCooldown(cooldowns.play, 'dock-play', '玩耍');
}

// ==========================================================================
// 4. 事件監聽與交互控制 (UI Wiring)
// ==========================================================================

// 登入事件
document.getElementById('btn-login').addEventListener('click', async () => {
    const usernameInput = document.getElementById('auth-username');
    const username = usernameInput.value.trim();

    if (!username) {
        showToast('請輸入使用者名稱！');
        return;
    }

    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.textContent = '進入遊戲中...';

    try {
        await window.petApi.loginOrRegister(username);
        showScreen('screen-game');
    } catch (err) {
        showToast(err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '進入遊戲';
    }
});

// 登出事件
document.getElementById('dock-logout').addEventListener('click', () => {
    window.petApi.clearToken();
    if (window.petGameInstance) {
        window.petGameInstance.destroy();
        window.petGameInstance = null;
    }
    showScreen('screen-auth');
    showToast('已安全登出遊戲。👋');
});

// 彈窗通用開關邏輯
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');
    
    // 如果是商店，點開時自動獲取商品資訊並渲染
    if (modalId === 'modal-shop') {
        renderShop('hat'); // 預設顯示帽子頁籤
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// 註冊所有彈窗的關閉按鈕
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    // 點擊關閉按鈕
    overlay.querySelectorAll('.btn-close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            overlay.classList.remove('active');
        });
    });
    // 點擊背景遮罩關閉 (僅限抽屜選單，不限於 Creator)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay && !overlay.classList.contains('creator-overlay')) {
            overlay.classList.remove('active');
        }
    });
});

// 綁定 Dock 按鈕點擊
document.getElementById('dock-feed').addEventListener('click', () => openModal('modal-feed'));
document.getElementById('dock-play').addEventListener('click', () => openModal('modal-play'));
document.getElementById('dock-shop').addEventListener('click', () => openModal('modal-shop'));

// 綁定餵食動作
document.querySelectorAll('#modal-feed .option-card').forEach(card => {
    const feedType = card.dataset.feedType;
    card.querySelector('.btn-action-buy').addEventListener('click', async () => {
        try {
            const res = await window.petApi.feedPet(feedType);
            showToast(`餵食成功！消耗 💎 ${res.data.points_spent} 點數`);
            closeModal('modal-feed');
            
            // 更新狀態與播放吃東西動畫
            if (window.petGameInstance) {
                await window.petGameInstance.playFeedAnimation(feedType);
                await window.petGameInstance.syncStatus();
            }
        } catch (err) {
            showToast(err.message);
        }
    });
});

// 綁定玩耍動作
document.querySelectorAll('#modal-play .option-card').forEach(card => {
    const playType = card.dataset.playType;
    card.querySelector('.btn-action-buy').addEventListener('click', async () => {
        try {
            const res = await window.petApi.playPet(playType);
            showToast(`玩耍成功！心情大好！🎉`);
            closeModal('modal-play');
            
            // 更新狀態與播放玩耍動畫
            if (window.petGameInstance) {
                await window.petGameInstance.playPlayAnimation(playType);
                await window.petGameInstance.syncStatus();
            }
        } catch (err) {
            showToast(err.message);
        }
    });
});

// 商店頁籤切換
document.querySelectorAll('.shop-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.shop-tabs .tab-btn').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        renderShop(btn.dataset.tab);
    });
});

// 渲染裝飾商店道具
async function renderShop(activeTab) {
    const container = document.getElementById('shop-items-container');
    container.innerHTML = '<div class="spinner-container"><div class="spinner"></div><p>正在開起商店...</p></div>';

    try {
        const shopData = await window.petApi.getShop();
        const items = shopData.data.items.filter(item => item.category === activeTab);
        
        container.innerHTML = '';

        if (items.length === 0) {
            container.innerHTML = '<div class="empty-shop">目前本分頁沒有道具。</div>';
            return;
        }

        const categoryEmoji = {
            hat: '🎩',
            accessory: '🎀',
            background: '🖼️',
            effect: '✨'
        };

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = `shop-item-card ${!item.level_met ? 'locked' : ''}`;
            
            let actionBtnHtml = '';
            if (!item.level_met) {
                actionBtnHtml = `<button class="btn-shop-action buy disabled" disabled>Lv.${item.min_level} 解鎖</button>`;
            } else if (!item.owned) {
                actionBtnHtml = `<button class="btn-shop-action buy ${!item.can_afford ? 'disabled' : ''}" ${!item.can_afford ? 'disabled' : ''} data-buy-id="${item.id}">購買 (💎 ${item.cost})</button>`;
            } else {
                // 已擁有，顯示裝備按鈕
                // 檢查 Hono 後端回傳的 equipped_items 狀態，或者從後續裝備狀態比對
                // 為了方便，我們從 status 載入時儲存的已裝備狀態來比對
                const isEquipped = window.petGameInstance?.equippedItemIds?.has(item.id);
                actionBtnHtml = isEquipped 
                    ? `<button class="btn-shop-action unequip" data-equip-id="${item.id}" data-action="unequip">卸下</button>`
                    : `<button class="btn-shop-action equip" data-equip-id="${item.id}" data-action="equip">裝備</button>`;
            }

            card.innerHTML = `
                ${!item.level_met ? `<div class="lock-overlay">🔒 等級 ${item.min_level}</div>` : ''}
                <div class="shop-item-sprite-preview">${categoryEmoji[item.category] || '🎁'}</div>
                <h3>${item.name}</h3>
                <p>${item.description || '無描述'}</p>
                <div class="shop-item-cost ${item.owned ? 'owned' : ''}">${item.owned ? '✅ 已擁有' : `💎 ${item.cost} 點`}</div>
                ${actionBtnHtml}
            `;
            container.appendChild(card);
        });

        // 綁定購買事件
        container.querySelectorAll('[data-buy-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const itemId = parseInt(btn.dataset.buy-id);
                try {
                    btn.disabled = true;
                    btn.textContent = '交易中...';
                    await window.petApi.buyItem(itemId);
                    showToast('道具購買成功！已放入背包！🛍️');
                    
                    // 重新整理商店與同步屬性
                    renderShop(activeTab);
                    if (window.petGameInstance) {
                        await window.petGameInstance.syncStatus();
                    }
                } catch (err) {
                    showToast(err.message);
                    btn.disabled = false;
                    btn.textContent = '購買';
                }
            });
        });

        // 綁定裝備/卸下事件
        container.querySelectorAll('[data-equip-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const itemId = parseInt(btn.dataset.equip-id);
                const isEquip = btn.dataset.action === 'equip';
                try {
                    btn.disabled = true;
                    btn.textContent = isEquip ? '裝備中...' : '卸下中...';
                    await window.petApi.equipItem(itemId, isEquip);
                    showToast(isEquip ? '裝備成功！' : '已卸下裝飾！');
                    
                    // 重新整理商店、更新 PixiJS 動態裝備渲染與同步
                    if (window.petGameInstance) {
                        await window.petGameInstance.syncStatus();
                    }
                    renderShop(activeTab);
                } catch (err) {
                    showToast(err.message);
                    btn.disabled = false;
                }
            });
        });

    } catch (err) {
        container.innerHTML = `<div class="empty-shop">商店資料載入失敗: ${err.message}</div>`;
    }
}

// 建立寵物送出按鈕
document.getElementById('btn-create-pet').addEventListener('click', async () => {
    const petNameInput = document.getElementById('new-pet-name');
    const petName = petNameInput.value.trim();
    const petSpeciesSelect = document.getElementById('new-pet-species');
    const species = petSpeciesSelect ? petSpeciesSelect.value : 'rice_bunny';

    if (!petName) {
        showToast('請為您的寵物取名！');
        return;
    }

    const btn = document.getElementById('btn-create-pet');
    btn.disabled = true;
    btn.textContent = '正在孵化中...';

    try {
        await window.petApi.createPet(petName, species);
        showToast(`🎉 恭喜！可愛的 [${petName}] 孵化成功了！`);
        document.getElementById('pet-creator').classList.remove('active');
        
        // 初始化遊戲與畫面
        if (window.petGameInstance) {
            await window.petGameInstance.syncStatus();
        }
    } catch (err) {
        showToast(err.message);
        btn.disabled = false;
        btn.textContent = '孵化寵物';
    }
});

// ==========================================================================
// 5. PixiJS 遊戲核心橋接
// ==========================================================================
async function initGame() {
    // 若已存在實例，直接同步狀態
    if (window.petGameInstance) {
        await window.petGameInstance.syncStatus();
        return;
    }

    // 確保 canvas 元素存在 (登出時 destroy 可能會將其從 DOM 移除)
    let canvas = document.getElementById('pet-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'pet-canvas';
        const container = document.querySelector('.canvas-container');
        if (container) {
            container.insertBefore(canvas, container.firstChild);
        }
    }

    // 啟動 PixiJS 實例
    const { PetGame } = await import('./game/PetGame.js?v=6');
    const game = new PetGame('pet-canvas');
    window.petGameInstance = game;
    
    try {
        await game.init();
        document.getElementById('game-loader').classList.add('hide');
    } catch (err) {
        console.error('PixiJS 啟動失敗:', err);
        showToast('遊戲渲染啟動失敗，請檢查網頁相容性。');
    }
}
