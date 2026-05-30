/* ═══════════════════════════════════════════════════
   FoodD Mobile — Consumer Pet View
   ═══════════════════════════════════════════════════ */

async function renderConsumerPetPage() {
  // 1. 隱藏底部導覽以釋放滿版空間 (漆黑沉浸式體驗)
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.classList.add('hidden');

  // 2. 認證防護：必須登入
  if (!authManager.isLoggedIn()) {
    localStorage.setItem('redirect_after_login', location.hash);
    router.navigate('/login');
    return;
  }

  // 3. 渲染主頁面 HTML（包含 PixiJS 畫布與 HUD，以及下層選單 Drawer）
  const html = `
    <div class="page pet-page" id="pet-page-container" style="position: relative; overflow: hidden;">
      <!-- 轉場大幕 (Beige-to-Dark Elegant Portal Curtain) -->
      <div id="pet-transition-curtain" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle at 50% 50%, #FFF8E1 0%, #FFF3E0 100%); z-index: 9999; display: flex; flex-direction: column; justify-content: center; align-items: center; pointer-events: auto;">
        <div class="transition-egg" style="font-size: 80px; margin-bottom: 24px;">🥚</div>
        <div style="font-family: 'Albert Sans', 'Noto Sans TC', sans-serif; font-size: 15px; color: #8D6E63; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase;">
          正在進入寵物客廳...
        </div>
      </div>

      <div class="page-content" style="padding: 0; display: flex; flex-direction: column; height: 100%; background: #020304; overflow: hidden; position: relative;">
        
        <!-- 頂部狀態列與返回按鈕 (整合為沉浸式深色 Bar) -->
        <div class="game-header-bar" style="display: flex; align-items: center; justify-content: space-between; padding: 0 16px; background: var(--lacquer-deep); border-bottom: 1px solid var(--gold-hairline); height: 54px; min-height: 54px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <button class="back-btn" onclick="router.navigate('/consumer/points')" style="margin: 0; padding: 4px; border: none; background: none; font-size: 22px; color: var(--champagne); cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">←</button>
            <div class="user-info">
              <span class="user-icon">🐾</span>
              <span id="display-username" class="username">載入中...</span>
            </div>
          </div>
          <div class="points-badge">
            <span class="gem-icon">💎</span>
            <span id="display-points">0</span> 點
          </div>
        </div>

        <!-- 遊戲畫布容器 (PixiJS Canvas) -->
        <div class="canvas-container" style="flex: 1; position: relative; min-height: 260px;">
          <canvas id="pet-canvas"></canvas>
          <!-- 載入遮罩 -->
          <div id="game-loader" class="game-loader">
            <div class="spinner"></div>
            <p>正在喚醒寵物...</p>
          </div>
          
          <!-- 孵化新寵物對話框 -->
          <div id="pet-creator" class="modal-overlay creator-overlay">
            <div class="modal-card creator-card">
              <h2>🥚 孵化首隻惜食寵物</h2>
              <p>為牠取個可愛的名字吧！</p>
              <div class="creator-preview">🍙</div>
              <div class="input-group">
                <select id="new-pet-species">
                  <option value="rice_bunny">🍙 飯糰兔</option>
                  <option value="dog">🐶 柴柴狗</option>
                  <option value="cat">🐱 布偶貓</option>
                </select>
                <input type="text" id="new-pet-name" placeholder="例如：海苔飯糰" maxlength="10">
              </div>
              <button id="btn-create-pet" class="btn btn-primary">孵化寵物</button>
            </div>
          </div>
        </div>

        <!-- 寵物數值 HUD -->
        <div class="status-hud">
          <!-- 飽食度 -->
          <div class="status-bar-group">
            <div class="bar-label">
              <span>🍔 飽食度</span>
              <span id="val-fullness">100/100</span>
            </div>
            <div class="bar-track">
              <div id="bar-fullness" class="bar-fill fullness" style="width: 100%"></div>
            </div>
          </div>
          <!-- 心情 -->
          <div class="status-bar-group">
            <div class="bar-label">
              <span>😊 心情</span>
              <span id="val-happiness">100/100</span>
            </div>
            <div class="bar-track">
              <div id="bar-happiness" class="bar-fill happiness" style="width: 100%"></div>
            </div>
          </div>
          <!-- 等級與 EXP -->
          <div class="status-bar-group">
            <div class="bar-label">
              <span>⭐ 等級 <strong id="val-level">1</strong></span>
              <span id="val-exp">0/50 EXP</span>
            </div>
            <div class="bar-track">
              <div id="bar-exp" class="bar-fill exp" style="width: 0%"></div>
            </div>
          </div>
        </div>

        <!-- 底部互動按鈕區 -->
        <div class="action-dock">
          <button id="dock-feed" class="dock-btn">
            <span class="dock-icon">🍽️</span>
            <span class="dock-text">餵食</span>
          </button>
          <button id="dock-play" class="dock-btn">
            <span class="dock-icon">🎾</span>
            <span class="dock-text">玩耍</span>
          </button>
          <button id="dock-shop" class="dock-btn">
            <span class="dock-icon">🛍️</span>
            <span class="dock-text">商店</span>
          </button>
        </div>

      </div>
    </div>

    <!-- 餵食選單 Drawer -->
    <div id="modal-feed" class="modal-overlay">
      <div class="modal-card bottom-drawer">
        <div class="drawer-handle"></div>
        <div class="modal-header">
          <h2>🍽️ 選擇美味惜食</h2>
          <button class="btn-close">&times;</button>
        </div>
        <div class="options-grid">
          <div class="option-card" data-feed-type="normal">
            <div class="option-icon">🍙</div>
            <h3>普通食物</h3>
            <p class="option-desc">飽食 +20 | 經驗 +10</p>
            <div class="option-cost">💎 5 點</div>
            <button class="btn btn-action-buy">餵食</button>
          </div>
          <div class="option-card" data-feed-type="premium">
            <div class="option-icon">🍱</div>
            <h3>高級惜食便當</h3>
            <p class="option-desc">飽食 +50 | 經驗 +30</p>
            <div class="option-cost">💎 15 點</div>
            <button class="btn btn-action-buy">餵食</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 玩耍選單 Drawer -->
    <div id="modal-play" class="modal-overlay">
      <div class="modal-card bottom-drawer">
        <div class="drawer-handle"></div>
        <div class="modal-header">
          <h2>🎾 寵物互動行為</h2>
          <button class="btn-close">&times;</button>
        </div>
        <div class="options-grid">
          <div class="option-card" data-play-type="play" id="cd-btn-play">
            <div class="option-icon">🎾</div>
            <h3>丟球玩耍</h3>
            <p class="option-desc">心情 +15 | 經驗 +5</p>
            <div class="option-cost">💎 3 點</div>
            <button class="btn btn-action-buy">玩耍</button>
          </div>
          <div class="option-card" data-play-type="bath" id="cd-btn-bath">
            <div class="option-icon">🛁</div>
            <h3>泡熱水澡</h3>
            <p class="option-desc">心情 +30 | 經驗 +10</p>
            <div class="option-cost">💎 5 點</div>
            <button class="btn btn-action-buy">洗澡</button>
          </div>
          <div class="option-card" data-play-type="pet" id="cd-btn-pet">
            <div class="option-icon">🤚</div>
            <h3>摸摸頭部</h3>
            <p class="option-desc">心情 +3 | 經驗 +0</p>
            <div class="option-cost free">免費</div>
            <button class="btn btn-action-buy">摸摸</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 商店選單 Drawer -->
    <div id="modal-shop" class="modal-overlay">
      <div class="modal-card bottom-drawer shop-drawer">
        <div class="drawer-handle"></div>
        <div class="modal-header">
          <h2>🛍️ 裝飾配件商店</h2>
          <button class="btn-close">&times;</button>
        </div>
        <div class="shop-tabs">
          <button class="tab-btn active" data-tab="hat">🎩 帽子</button>
          <button class="tab-btn" data-tab="accessory">🎀 配件</button>
          <button class="tab-btn" data-tab="background">🖼️ 背景</button>
          <button class="tab-btn" data-tab="effect">✨ 特效</button>
        </div>
        <div class="shop-content-wrapper">
          <div id="shop-items-container" class="shop-grid">
            <!-- 動態渲染商店道具 -->
          </div>
        </div>
      </div>
    </div>
  `;

  renderPage(html);

  // 4. 註冊 window.petApi 相容適配層（橋接 PetGame.js 動畫與我們的 ApiClient 實例）
  window.petApi = {
    getPetStatus: async () => {
      const res = await api.request('GET', '/api/v1/pet/status');
      return { data: res };
    },
    createPet: async (name, species) => {
      const res = await api.request('POST', '/api/v1/pet/create', { name, species });
      return { data: res };
    },
    feedPet: async (feedType) => {
      const res = await api.request('POST', '/api/v1/pet/feed', { feed_type: feedType });
      return { data: res };
    },
    playPet: async (playType) => {
      const res = await api.request('POST', '/api/v1/pet/play', { play_type: playType });
      return { data: res };
    },
    getShop: async () => {
      const res = await api.request('GET', '/api/v1/pet/shop');
      return { data: res };
    },
    buyItem: async (itemId) => {
      const res = await api.request('POST', '/api/v1/pet/buy-item', { item_id: itemId });
      return { data: res };
    },
    equipItem: async (itemId, equip) => {
      const res = await api.request('POST', '/api/v1/pet/equip', { item_id: itemId, equip });
      return { data: res };
    }
  };

  // 5. 綁定全域 UI 橋接函式 (PetGame.js 內部呼叫)
  window.showToast = (message) => {
    showToast(message, 'info');
  };

  window.updateHUD = (pet, userPoints, cooldowns) => {
    document.getElementById('display-username').textContent = pet.name;
    document.getElementById('display-points').textContent = userPoints;

    // 飽食度 HUD
    document.getElementById('val-fullness').textContent = `${pet.fullness}/100`;
    gsap.to('#bar-fullness', { width: `${pet.fullness}%`, duration: 0.8, ease: 'back.out(1.2)' });

    // 心情 HUD
    document.getElementById('val-happiness').textContent = `${pet.happiness}/100`;
    gsap.to('#bar-happiness', { width: `${pet.happiness}%`, duration: 0.8, ease: 'back.out(1.2)' });

    // 等級與 EXP HUD
    document.getElementById('val-level').textContent = pet.level;
    document.getElementById('val-exp').textContent = `${pet.exp}/${pet.exp_to_next} EXP`;
    const expPercentage = Math.min(100, (pet.exp / pet.exp_to_next) * 100);
    gsap.to('#bar-exp', { width: `${expPercentage}%`, duration: 0.8, ease: 'power2.out' });

    // 更新倒數冷卻 UI
    updateCooldownsUI(cooldowns);
  };

  // 6. 冷卻定時倒數渲染
  function updateCooldownsUI(cooldowns) {
    const now = new Date();

    const checkCooldown = (cdString, cardId, originalText) => {
      const card = document.getElementById(cardId);
      if (!card) return;
      const btn = card.querySelector('.btn-action-buy');
      if (!btn) return;

      if (cdString) {
        const cdTime = new Date(cdString);
        if (cdTime > now) {
          btn.disabled = true;
          btn.classList.add('disabled');
          
          const updateCountdown = () => {
            const diffMs = cdTime - new Date();
            if (diffMs <= 0) {
              btn.disabled = false;
              btn.classList.remove('disabled');
              btn.textContent = originalText;
              clearInterval(btn.cdInterval);
            } else {
              const sec = Math.ceil(diffMs / 1000);
              const min = Math.floor(sec / 60);
              const remSec = sec % 60;
              btn.textContent = `${min}:${remSec.toString().padStart(2, '0')}`;
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
      btn.textContent = originalText;
      clearInterval(btn.cdInterval);
    };

    // 玩耍選項
    checkCooldown(cooldowns.play, 'cd-btn-play', '玩耍');
    checkCooldown(cooldowns.bath, 'cd-btn-bath', '洗澡');
    checkCooldown(cooldowns.pet, 'cd-btn-pet', '摸摸');
  }

  // 7. 綁定視窗互動事件
  const openModal = (modalId) => {
    document.getElementById(modalId).classList.add('active');
    if (modalId === 'modal-shop') {
      renderShop('hat'); // 預設顯示帽子標籤
    }
  };

  const closeModal = (modalId) => {
    document.getElementById(modalId).classList.remove('active');
  };

  // 綁定 Dock 按鈕
  document.getElementById('dock-feed').addEventListener('click', () => openModal('modal-feed'));
  document.getElementById('dock-play').addEventListener('click', () => openModal('modal-play'));
  document.getElementById('dock-shop').addEventListener('click', () => openModal('modal-shop'));

  // 註冊關閉按鈕與背景點擊關閉
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.querySelectorAll('.btn-close').forEach(closeBtn => {
      closeBtn.addEventListener('click', () => {
        overlay.classList.remove('active');
      });
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && !overlay.classList.contains('creator-overlay')) {
        overlay.classList.remove('active');
      }
    });
  });

  // 8. 綁定餵食動作
  document.querySelectorAll('#modal-feed .option-card').forEach(card => {
    const feedType = card.dataset.feedType;
    const btn = card.querySelector('.btn-action-buy');
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      try {
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = '餵食中...';
        
        const res = await window.petApi.feedPet(feedType);
        showToast(`餵食成功！消耗 💎 ${res.data.points_spent} 點數`, 'success');
        closeModal('modal-feed');
        
        btn.disabled = false;
        btn.textContent = originalText;
        
        if (window.petGameInstance) {
          await window.petGameInstance.syncStatus();
          await window.petGameInstance.playFeedAnimation(feedType);
        }
      } catch (err) {
        btn.disabled = false;
        btn.textContent = '餵食';
        showToast(err.message, 'error');
      }
    });
  });

  // 9. 綁定玩耍動作
  document.querySelectorAll('#modal-play .option-card').forEach(card => {
    const playType = card.dataset.playType;
    const btn = card.querySelector('.btn-action-buy');
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      try {
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = '進行中...';
        
        const res = await window.petApi.playPet(playType);
        showToast(`玩耍成功！心情大好！🎉`, 'success');
        closeModal('modal-play');
        
        btn.disabled = false;
        btn.textContent = originalText;
        
        if (window.petGameInstance) {
          await window.petGameInstance.syncStatus();
          await window.petGameInstance.playPlayAnimation(playType);
        }
      } catch (err) {
        btn.disabled = false;
        let defaultText = '玩耍';
        if (playType === 'bath') defaultText = '洗澡';
        if (playType === 'pet') defaultText = '摸摸';
        btn.textContent = defaultText;
        showToast(err.message, 'error');
      }
    });
  });

  // 10. 商店頁籤切換
  document.querySelectorAll('.shop-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.shop-tabs .tab-btn').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      renderShop(btn.dataset.tab);
    });
  });

  // 11. 渲染商店物品
  async function renderShop(activeTab, skipSpinner = false) {
    const container = document.getElementById('shop-items-container');
    if (!skipSpinner) {
      container.innerHTML = '<div style="grid-column: span 2; display: flex; flex-direction: column; align-items: center; padding: 24px; color: var(--text-muted);"><div class="spinner"></div><p style="margin-top: 10px;">商店開啟中...</p></div>';
    }

    try {
      const shopData = await window.petApi.getShop();
      const items = shopData.data.items.filter(item => item.category === activeTab);
      
      container.innerHTML = '';

      if (items.length === 0) {
        container.innerHTML = '<div style="grid-column: span 2; text-align: center; padding: 24px; color: var(--text-muted);">目前分頁尚無裝飾。</div>';
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
          const isEquipped = window.petGameInstance?.equippedItemIds?.has(item.id);
          actionBtnHtml = isEquipped 
              ? `<button class="btn-shop-action unequip" data-equip-id="${item.id}" data-action="unequip">卸下</button>`
              : `<button class="btn-shop-action equip" data-equip-id="${item.id}" data-action="equip">裝備</button>`;
        }

        card.innerHTML = `
          ${!item.level_met ? `<div class="lock-overlay">🔒 等級 ${item.min_level}</div>` : ''}
          <div class="shop-item-sprite-preview" style="font-size: 32px; margin-bottom: 6px;">${categoryEmoji[item.category] || '🎁'}</div>
          <h3 style="font-size: 13px; color: var(--champagne); margin-bottom: 4px;">${item.name}</h3>
          <p style="font-size: 10px; color: var(--text-muted); margin-bottom: 8px;">${item.description || '無描述'}</p>
          <div class="shop-item-cost" style="font-size: 11px; color: var(--kinpaku-gold); margin-bottom: 8px;">${item.owned ? '✅ 已擁有' : `💎 ${item.cost} 點`}</div>
          ${actionBtnHtml}
        `;
        container.appendChild(card);
      });

      // 綁定道具購買
      container.querySelectorAll('[data-buy-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const itemId = parseInt(btn.dataset.buyId, 10);
          try {
            btn.disabled = true;
            btn.textContent = '交易中...';
            await window.petApi.buyItem(itemId);
            showToast('道具購買成功！已放入背包！🛍️', 'success');
            
            if (window.petGameInstance) {
              await window.petGameInstance.syncStatus();
            }
            await renderShop(activeTab, true); // skip spinner for instant feedback!
          } catch (err) {
            showToast(err.message, 'error');
            btn.disabled = false;
            btn.textContent = `購買`;
          }
        });
      });

      // 綁定裝備/卸下
      container.querySelectorAll('[data-equip-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const itemId = parseInt(btn.dataset.equipId, 10);
          const isEquip = btn.dataset.action === 'equip';
          try {
            btn.disabled = true;
            btn.textContent = isEquip ? '裝備中...' : '卸下中...';
            await window.petApi.equipItem(itemId, isEquip);
            showToast(isEquip ? '裝備成功！' : '已卸下裝飾！', 'success');
            
            if (window.petGameInstance) {
              await window.petGameInstance.syncStatus();
            }
            await renderShop(activeTab, true); // skip spinner for instant feedback!
          } catch (err) {
            showToast(err.message, 'error');
            btn.disabled = false;
          }
        });
      });

    } catch (err) {
      container.innerHTML = `<div style="grid-column: span 2; text-align: center; padding: 24px; color: var(--text-muted);">載入失敗: ${err.message}</div>`;
    }
  }

  // 12. 孵化寵物送出
  document.getElementById('btn-create-pet').addEventListener('click', async () => {
    const petNameInput = document.getElementById('new-pet-name');
    const petName = petNameInput.value.trim();
    const species = document.getElementById('new-pet-species').value;

    if (!petName) {
      showToast('請為您的寵物取個名字！', 'error');
      return;
    }

    const btn = document.getElementById('btn-create-pet');
    btn.disabled = true;
    btn.textContent = '正在孵化中...';

    try {
      await window.petApi.createPet(petName, species);
      showToast(`🎉 恭喜！可愛的 [${petName}] 孵化成功了！`, 'success');
      document.getElementById('pet-creator').classList.remove('active');
      
      if (window.petGameInstance) {
        await window.petGameInstance.syncStatus();
      }
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = '孵化寵物';
    }
  });

  // 13. 播放進入轉場動畫
  function playCurtainTransition() {
    const curtain = document.getElementById('pet-transition-curtain');
    if (!curtain) return;
    
    // 加上 gsap 的安全性防禦，如果 gsap 未載入完成，直接用原生 CSS 漸變淡出
    if (typeof gsap === 'undefined') {
      console.warn('[警告] gsap 尚未載入，使用原生 CSS 漸變');
      curtain.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
      curtain.style.opacity = '0';
      curtain.style.transform = 'scale(1.2)';
      setTimeout(() => {
        curtain.remove();
      }, 500);
      return;
    }
    
    try {
      // 使用 GSAP 進行彈性旋轉縮小，緊接著大幕淡出放大，製造突破次元壁的沉浸感
      const tl = gsap.timeline();
      tl.to('#pet-transition-curtain .transition-egg', {
        scale: 1.6,
        rotation: 360,
        opacity: 0,
        duration: 0.6,
        ease: 'back.in(1.6)'
      });
      tl.to(curtain, {
        opacity: 0,
        scale: 1.3,
        duration: 0.5,
        ease: 'power2.inOut',
        onComplete: () => {
          curtain.remove();
        }
      }, '-=0.3');
    } catch (e) {
      console.error('[錯誤] GSAP 執行失敗，直接移除遮罩:', e);
      curtain.remove();
    }
  }

  // 14. 初始化 PixiJS 遊戲核心
  async function initGame() {
    try {
      if (window.petGameInstance) {
        await window.petGameInstance.syncStatus();
        playCurtainTransition();
        return;
      }

      let canvas = document.getElementById('pet-canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'pet-canvas';
        const container = document.querySelector('.canvas-container');
        if (container) {
          container.insertBefore(canvas, container.firstChild);
        }
      }

      // 動態載入 PetGame.js
      const { PetGame } = await import('/mobile/js/game/PetGame.js?v=7');
      const game = new PetGame('pet-canvas');
      window.petGameInstance = game;
      
      await game.init();
      const loader = document.getElementById('game-loader');
      if (loader) loader.classList.add('hide');
      setTimeout(playCurtainTransition, 200); // 延遲一下讓 PixiJS 繪圖緩衝區完全就緒
    } catch (err) {
      console.error('PixiJS 啟動失敗:', err);
      showToast(`遊戲啟動失敗: ${err.message}`, 'error');
      playCurtainTransition(); // 即使失敗也關閉轉場，以免畫面被卡死
    }
  }

  // 開始初始化
  setTimeout(initGame, 100);
}
