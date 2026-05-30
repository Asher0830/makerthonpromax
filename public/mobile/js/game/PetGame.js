/**
 * ==========================================================================
 * 惜食小幫手 — 虛擬寵物養成系統 PixiJS 遊戲引擎主程式
 * ==========================================================================
 */

export class PetGame {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.app = null;
        
        // 遊戲精靈物件
        this.background = null;
        this.roomGraphics = null;
        this.pet = null;
        this.hat = null;
        this.hatEmoji = null;
        this.accEmoji = null;
        this.ambientTimer = 0;
        
        // 狀態快取
        this.petData = null;
        this.equippedItemIds = new Set(); // 儲存已裝備的道具 ID
    }

    // 初始化 PixiJS 畫布與載入素材
    async init() {
        // 建立 PixiJS 實例 (使用 v8 API 並啟用自動適應尺寸，完全解決拉伸變形問題！)
        this.app = new PIXI.Application();
        await this.app.init({
            canvas: document.getElementById(this.canvasId),
            resizeTo: document.querySelector('.canvas-container'),
            backgroundAlpha: 0, // 透明背景，由 CSS 控制底色
            antialias: true
        });

        // 載入遊戲靜態素材 (加上版本號以清除瀏覽器快取)
        await PIXI.Assets.load([
            { alias: 'bg_kitchen', src: '/mobile/js/game/assets/bg_kitchen.png?v=4' },
            { alias: 'bunny_idle', src: '/mobile/js/game/assets/pets/bunny_idle.png?v=4' },
            { alias: 'bunny_eating', src: '/mobile/js/game/assets/pets/bunny_eating.png?v=4' },
            { alias: 'bunny_happy', src: '/mobile/js/game/assets/pets/bunny_happy.png?v=4' },
            { alias: 'bunny_hungry', src: '/mobile/js/game/assets/pets/bunny_hungry.png?v=4' },
            { alias: 'dog_idle', src: '/mobile/js/game/assets/pets/dog_idle.png?v=4' },
            { alias: 'dog_eating', src: '/mobile/js/game/assets/pets/dog_eating.png?v=4' },
            { alias: 'dog_happy', src: '/mobile/js/game/assets/pets/dog_happy.png?v=4' },
            { alias: 'dog_hungry', src: '/mobile/js/game/assets/pets/dog_hungry.png?v=4' },
            { alias: 'cat_idle', src: '/mobile/js/game/assets/pets/cat_idle.png?v=4' },
            { alias: 'cat_eating', src: '/mobile/js/game/assets/pets/cat_eating.png?v=4' },
            { alias: 'cat_happy', src: '/mobile/js/game/assets/pets/cat_happy.png?v=4' },
            { alias: 'cat_hungry', src: '/mobile/js/game/assets/pets/cat_hungry.png?v=4' },
            { alias: 'food_normal', src: '/mobile/js/game/assets/items/food_normal.png?v=4' },
            { alias: 'food_premium', src: '/mobile/js/game/assets/items/food_premium.png?v=4' },
            { alias: 'hat_chef', src: '/mobile/js/game/assets/items/hat_chef.png?v=4' }
        ]);

        const screenWidth = this.app.screen.width;
        const screenHeight = this.app.screen.height;

        // 1. 建立背景 Container 與 Graphics
        this.background = new PIXI.Container();
        this.roomGraphics = new PIXI.Graphics();
        this.background.addChild(this.roomGraphics);
        this.app.stage.addChild(this.background);

        // 繪製初始背景
        this.drawBackground();

        // 2. 建立寵物精靈 (0.38 比例，往上移至地毯中央，完美站立於溫馨房間)
        this.pet = new PIXI.Sprite();
        this.pet.anchor.set(0.5);
        this.pet.x = screenWidth / 2;
        this.pet.y = screenHeight - 150;
        this.pet.scale.set(0.38); 
        this.pet.visible = false; // 等待資料載入後顯示
        this.app.stage.addChild(this.pet);

        // 3. 建立帽子裝飾品精靈 (預設先隱藏)
        this.hat = new PIXI.Sprite(PIXI.Texture.from('/mobile/js/game/assets/items/hat_chef.png?v=4'));
        this.hat.anchor.set(0.5);
        this.hat.scale.set(0.15);
        this.hat.visible = false;
        this.app.stage.addChild(this.hat);

        // 建立帽子 Emoji 文字型裝飾
        this.hatEmoji = new PIXI.Text({ text: '', style: { fontSize: 48 } });
        this.hatEmoji.anchor.set(0.5);
        this.hatEmoji.visible = false;
        this.app.stage.addChild(this.hatEmoji);

        // 建立配件 Emoji 文字型裝飾
        this.accEmoji = new PIXI.Text({ text: '', style: { fontSize: 36 } });
        this.accEmoji.anchor.set(0.5);
        this.accEmoji.visible = false;
        this.app.stage.addChild(this.accEmoji);

        // 4. 啟用呼吸動畫主循環 (動態計算 Y 軸，移動到 Y - 150)
        this.app.ticker.add((ticker) => {
            const time = Date.now();
            const dynamicBaseY = this.app.screen.height - 150;
            
            // 呼吸時 Y 軸平滑正弦跳動 (浮動幅度約 3 像素)
            this.pet.y = dynamicBaseY + Math.sin(time / 450) * 3;
            
            // 固定縮放比例 0.38，完全取消拉伸變形
            this.pet.scale.set(0.38);

            // 帽子的位置與縮放比例緊緊跟隨寵物移動
            if (this.hat.visible) {
                this.hat.x = this.pet.x;
                const species = this.petData ? this.petData.species : 'bunny';
                let hatScale = 0.15;
                let hatOffsetY = -155; // 預設值
 
                if (species === 'bunny') {
                    hatScale = 0.14;
                    hatOffsetY = -148;
                } else if (species === 'dog') {
                    hatScale = 0.15;
                    hatOffsetY = -168;
                } else if (species === 'cat') {
                    hatScale = 0.145;
                    hatOffsetY = -153;
                }
 
                this.hat.y = this.pet.y + hatOffsetY; 
                this.hat.scale.set(hatScale);
            }

            // 帽子 Emoji 的位置與縮放
            if (this.hatEmoji.visible) {
                this.hatEmoji.x = this.pet.x;
                const species = this.petData ? this.petData.species : 'bunny';
                let hatOffsetY = -150;
                let emojiScale = 1.0;

                if (species === 'bunny') {
                    hatOffsetY = -140;
                    emojiScale = 0.95;
                } else if (species === 'dog') {
                    hatOffsetY = -160;
                    emojiScale = 1.05;
                } else if (species === 'cat') {
                    hatOffsetY = -148;
                    emojiScale = 1.0;
                }

                this.hatEmoji.y = this.pet.y + hatOffsetY;
                this.hatEmoji.scale.set(emojiScale);
            }

            // 配件 Emoji 的位置與縮放
            if (this.accEmoji.visible) {
                this.accEmoji.x = this.pet.x;
                const species = this.petData ? this.petData.species : 'bunny';
                const isGlasses = this.equippedItemIds.has(9);
                let accOffsetY = -50;

                if (isGlasses) {
                    if (species === 'bunny') accOffsetY = -95;
                    else if (species === 'dog') accOffsetY = -105;
                    else if (species === 'cat') accOffsetY = -92;
                } else {
                    if (species === 'bunny') accOffsetY = -45;
                    else if (species === 'dog') accOffsetY = -55;
                    else if (species === 'cat') accOffsetY = -48;
                }

                this.accEmoji.y = this.pet.y + accOffsetY;
            }

            // 特效粒子生成 (每 45 幀產生一次)
            this.ambientTimer = (this.ambientTimer || 0) + 1;
            if (this.ambientTimer >= 45) {
                this.ambientTimer = 0;
                if (this.equippedItemIds.has(10)) {
                    this.spawnAmbientParticle('💖');
                } else if (this.equippedItemIds.has(11)) {
                    this.spawnAmbientParticle('✨');
                }
            }
        });

        // 5. 首次同步寵物與 HUD 狀態
        await this.syncStatus();
    }

    // 與後端 API 同步寵物狀態與 HUD 數值
    async syncStatus() {
        try {
            const res = await window.petApi.getPetStatus();
            
            const { pet, user_points, cooldowns } = res.data;
            this.petData = pet;

            // 儲存已裝備的道具列表
            this.equippedItemIds.clear();
            pet.equipped_items.forEach(item => {
                this.equippedItemIds.add(item.id);
            });

            // 更新網頁 HTML 進度條與冷卻 UI
            if (typeof window.updateHUD === 'function') {
                window.updateHUD(pet, user_points, cooldowns);
            } else {
                console.warn('window.updateHUD is not defined yet');
            }

            // 更新 PixiJS 寵物外觀與裝飾
            this.updatePetAppearance();
        } catch (err) {
            // 若後端返回尚未建立寵物，開啟命名孵化視窗
            if (err.message === '尚未建立寵物') {
                document.getElementById('pet-creator').classList.add('active');
            } else {
                if (typeof window.showToast === 'function') {
                    window.showToast(`狀態同步失敗: ${err.message}`);
                } else {
                    console.error(`狀態同步失敗: ${err.message}`);
                }
            }
        }
    }

    // 依據飽食度/心情/裝備動態變更精靈紋理與背景特效
    updatePetAppearance() {
        if (!this.petData) return;

        this.pet.visible = true;
        const speciesPrefix = this.petData.species === 'dog' ? 'dog' : (this.petData.species === 'cat' ? 'cat' : 'bunny');

        // 1. 裝飾背景重繪
        this.drawBackground();

        // 2. 裝飾帽子/頭部裝飾渲染
        this.hat.visible = false;
        if (this.hatEmoji) this.hatEmoji.visible = false;

        if (this.equippedItemIds.has(2)) {
            // 廚師帽
            this.hat.visible = true;
        } else if (this.equippedItemIds.has(1)) {
            // 貝雷帽
            if (this.hatEmoji) {
                this.hatEmoji.text = '🎓';
                this.hatEmoji.visible = true;
            }
        } else if (this.equippedItemIds.has(3)) {
            // 皇家皇冠
            if (this.hatEmoji) {
                this.hatEmoji.text = '👑';
                this.hatEmoji.visible = true;
            }
        }

        // 3. 配件渲染
        if (this.accEmoji) {
            this.accEmoji.visible = false;
            if (this.equippedItemIds.has(7)) {
                // 可愛蝴蝶結
                this.accEmoji.text = '🎀';
                this.accEmoji.visible = true;
            } else if (this.equippedItemIds.has(8)) {
                // 環保圍裙
                this.accEmoji.text = '🎽';
                this.accEmoji.visible = true;
            } else if (this.equippedItemIds.has(9)) {
                // 酷炫墨鏡
                this.accEmoji.text = '🕶️';
                this.accEmoji.visible = true;
            }
        }

        // 4. 寵物表情變化 (飽食度或心情太低時顯示飢餓/難過表情)
        if (this.petData.fullness < 20 || this.petData.happiness < 20) {
            this.pet.texture = PIXI.Texture.from(`${speciesPrefix}_hungry`);
        } else {
            this.pet.texture = PIXI.Texture.from(`${speciesPrefix}_idle`);
        }
    }

    // 動態繪製多樣化背景
    drawBackground() {
        if (!this.roomGraphics || !this.app) return;
        const screenWidth = this.app.screen.width;
        const screenHeight = this.app.screen.height;
        
        this.roomGraphics.clear();
        
        let wallColor = '#FFF3E0';
        let floorColor = '#8D6E63';
        let boardColor = '#5D4037';
        let lineColor = '#6D4C41';
        let rugColor = '#FFB74D';
        let rugStroke = '#FFA726';
        let isSpace = false;
        
        if (this.equippedItemIds.has(5)) {
            // 綠意公園 (ID 5)
            wallColor = '#E3F2FD'; // 天空藍
            floorColor = '#81C784'; // 草地綠
            boardColor = '#4CAF50';
            lineColor = '#66BB6A';
            rugColor = '#C8E6C9';
            rugStroke = '#A5D6A7';
        } else if (this.equippedItemIds.has(6)) {
            // 璀璨星空 (ID 6)
            wallColor = '#0A0E1A'; // 深邃夜空
            floorColor = '#1A237E'; // 藍色銀河地板
            boardColor = '#0D47A1';
            lineColor = '#1565C0';
            rugColor = '#3F51B5';
            rugStroke = '#5C6BC0';
            isSpace = true;
        }
        
        // 繪製牆壁
        this.roomGraphics.rect(0, 0, screenWidth, screenHeight).fill({ color: wallColor });
        
        // 如果是太空，繪製璀璨星辰
        if (isSpace) {
            for (let i = 0; i < 15; i++) {
                const x = (i * 97 + 37) % screenWidth;
                const y = (i * 123 + 29) % (screenHeight - 150);
                const size = (i % 3) + 1.5;
                this.roomGraphics.circle(x, y, size).fill({ color: '#FFFDE7', alpha: 0.7 });
            }
        }
        
        // 繪製地板
        const floorY = screenHeight - 140;
        this.roomGraphics.rect(0, floorY, screenWidth, 140).fill({ color: floorColor });
        
        // 踢腳板與木板線
        this.roomGraphics.rect(0, floorY, screenWidth, 4).fill({ color: boardColor });
        for (let i = 1; i <= 5; i++) {
            const lineY = floorY + i * 26;
            this.roomGraphics.rect(0, lineY, screenWidth, 1).fill({ color: lineColor });
        }
        
        // 地毯
        const rugX = screenWidth / 2;
        const rugY = screenHeight - 45;
        this.roomGraphics.ellipse(rugX, rugY, 85, 22).fill({ color: rugColor });
        this.roomGraphics.ellipse(rugX, rugY, 85, 22).stroke({ color: rugStroke, width: 3 });
    }

    // 生成環境特效粒子
    spawnAmbientParticle(char) {
        if (!this.pet || !this.pet.visible || !this.app) return;
        const particle = new PIXI.Text({ text: char, style: { fontSize: 18 } });
        particle.anchor.set(0.5);
        const side = Math.random() > 0.5 ? 1 : -1;
        particle.x = this.pet.x + side * (40 + Math.random() * 40);
        particle.y = this.pet.y - 20;
        particle.alpha = 0.8;
        this.app.stage.addChild(particle);
        
        gsap.to(particle, {
            y: particle.y - 80 - Math.random() * 40,
            x: particle.x + (Math.random() - 0.5) * 30,
            alpha: 0,
            duration: 1.5 + Math.random() * 0.8,
            ease: 'sine.out',
            onComplete: () => {
                if (this.app && this.app.stage) {
                    this.app.stage.removeChild(particle);
                }
            }
        });
    }

    // 播放餵食動畫效果
    async playFeedAnimation(feedType) {
        // 先更換為嚼食紋理
        const speciesPrefix = this.petData.species === 'dog' ? 'dog' : (this.petData.species === 'cat' ? 'cat' : 'bunny');
        this.pet.texture = PIXI.Texture.from(`${speciesPrefix}_eating`);

        const foodPath = feedType === 'normal'
            ? '/mobile/js/game/assets/items/food_normal.png?v=4'
            : '/mobile/js/game/assets/items/food_premium.png?v=4';
        
        // 建立飛入食物精靈
        const food = new PIXI.Sprite(PIXI.Texture.from(foodPath));
        food.anchor.set(0.5);
        food.x = 375 / 2;
        food.y = -50;
        food.scale.set(0.12);
        this.app.stage.addChild(food);

        // 使用 GSAP 進行抛物線飛入動畫
        await gsap.to(food, {
            y: this.pet.y - 10,
            rotation: 6.28, // 旋轉一圈
            duration: 0.6,
            ease: 'bounce.out'
        });

        // 食物嚼食完畢消失
        this.app.stage.removeChild(food);

        // 播放愛心滿滿粒子噴發特效
        this.spawnHeartParticles();

        // 持續嚼食 1.2 秒後切換回待機狀態
        await new Promise(resolve => setTimeout(resolve, 1200));
        this.updatePetAppearance();
    }

    // 播放互動玩耍動畫效果
    async playPlayAnimation(playType) {
        // 切換為開心大笑紋理
        const speciesPrefix = this.petData.species === 'dog' ? 'dog' : (this.petData.species === 'cat' ? 'cat' : 'bunny');
        this.pet.texture = PIXI.Texture.from(`${speciesPrefix}_happy`);

        if (playType === 'play' || playType === 'pet') {
            // 跳躍動畫 (相對於當前 Y 座標)
            const originalY = this.pet.y;
            await gsap.to(this.pet, {
                y: originalY - 50,
                duration: 0.25,
                yoyo: true,
                repeat: 3, // 連續跳躍三次
                ease: 'power1.out'
            });
        } else if (playType === 'bath') {
            // 左右搖擺翻滾動畫 (泡澡舒服感)
            await gsap.to(this.pet, {
                rotation: 0.3,
                duration: 0.3,
                yoyo: true,
                repeat: 4,
                ease: 'power1.inOut'
            });
            // 恢復原角度
            gsap.to(this.pet, { rotation: 0, duration: 0.2 });
        }

        // 噴發小星星粒子特效
        this.spawnStarParticles();

        // 恢復原待機狀態
        await new Promise(resolve => setTimeout(resolve, 500));
        this.updatePetAppearance();
    }

    // 愛心噴發粒子特效
    spawnHeartParticles() {
        for (let i = 0; i < 6; i++) {
            const heart = new PIXI.Text({ text: '❤️', style: { fontSize: 24 } });
            heart.anchor.set(0.5);
            heart.x = this.pet.x + (Math.random() - 0.5) * 50;
            heart.y = this.pet.y - 20;
            this.app.stage.addChild(heart);

            gsap.to(heart, {
                x: heart.x + (Math.random() - 0.5) * 100,
                y: heart.y - 120 - Math.random() * 50,
                alpha: 0,
                duration: 1.2,
                ease: 'power1.out',
                onComplete: () => {
                    this.app.stage.removeChild(heart);
                }
            });
        }
    }

    // 星星噴發粒子特效
    spawnStarParticles() {
        for (let i = 0; i < 8; i++) {
            const star = new PIXI.Text({ text: '⭐', style: { fontSize: 20 } });
            star.anchor.set(0.5);
            star.x = this.pet.x + (Math.random() - 0.5) * 60;
            star.y = this.pet.y - 30;
            this.app.stage.addChild(star);

            gsap.to(star, {
                x: star.x + (Math.random() - 0.5) * 120,
                y: star.y - 100 - Math.random() * 60,
                alpha: 0,
                duration: 1.0,
                ease: 'back.out(1.5)',
                onComplete: () => {
                    this.app.stage.removeChild(star);
                }
            });
        }
    }

    // 銷毀畫布以防記憶體洩漏
    destroy() {
        if (this.app) {
            this.app.destroy(true, { children: true, texture: true });
            this.app = null;
        }
    }
}
