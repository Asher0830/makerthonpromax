// Store Add Item View
// Renders the product creation form for store owners

function renderStoreAddItemPage() {
    let selectedSource = 'map';

    const html = `
        <div class="page-header">
            <h1>上架商品</h1>
        </div>
        <div class="page-content">
            <form id="add-product-form" onsubmit="return false;">
                <div class="form-group">
                    <label class="form-label" for="product-name">商品名稱</label>
                    <input class="form-input" type="text" id="product-name" placeholder="請輸入商品名稱" required>
                </div>

                <div class="form-group">
                    <label class="form-label" for="product-category">商品分類</label>
                    <select class="form-input form-select" id="product-category" required>
                        <option value="" disabled selected>請選擇分類</option>
                        <option value="bento">便當</option>
                        <option value="bread">麵包</option>
                        <option value="vegetable">蔬菜</option>
                        <option value="other">其他</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label" for="original-price">原價</label>
                    <input class="form-input" type="number" id="original-price" placeholder="NT$" min="1" required>
                </div>

                <div class="form-group">
                    <label class="form-label" for="selling-price">售價</label>
                    <input class="form-input" type="number" id="selling-price" placeholder="NT$" min="1" required>
                </div>

                <div class="form-group">
                    <label class="form-label">銷售來源</label>
                    <div class="source-toggle">
                        <div class="source-card selected" id="source-map" onclick="selectSource('map')">
                            <span>🗺️</span>
                            <span>放到地圖平台</span>
                        </div>
                        <div class="source-card" id="source-machine" onclick="selectSource('machine')">
                            <span>🏪</span>
                            <span>放入機台</span>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">過敏原標示</label>
                    <div class="allergen-grid">
                        <label class="allergen-check">
                            <input type="checkbox" name="allergen" value="蝦"> 蝦
                        </label>
                        <label class="allergen-check">
                            <input type="checkbox" name="allergen" value="蟹"> 蟹
                        </label>
                        <label class="allergen-check">
                            <input type="checkbox" name="allergen" value="芒果"> 芒果
                        </label>
                        <label class="allergen-check">
                            <input type="checkbox" name="allergen" value="花生"> 花生
                        </label>
                        <label class="allergen-check">
                            <input type="checkbox" name="allergen" value="牛奶"> 牛奶
                        </label>
                        <label class="allergen-check">
                            <input type="checkbox" name="allergen" value="蛋"> 蛋
                        </label>
                        <label class="allergen-check">
                            <input type="checkbox" name="allergen" value="堅果"> 堅果
                        </label>
                        <label class="allergen-check">
                            <input type="checkbox" name="allergen" value="芝麻"> 芝麻
                        </label>
                        <label class="allergen-check">
                            <input type="checkbox" name="allergen" value="麩質"> 麩質
                        </label>
                        <label class="allergen-check">
                            <input type="checkbox" name="allergen" value="大豆"> 大豆
                        </label>
                        <label class="allergen-check">
                            <input type="checkbox" name="allergen" value="魚"> 魚
                        </label>
                        <label class="allergen-check">
                            <input type="checkbox" name="allergen" value="貝類"> 貝類
                        </label>
                        <label class="allergen-check">
                            <input type="checkbox" name="allergen" value="亞硫酸鹽"> 亞硫酸鹽
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="expires-at">到期時間</label>
                    <input class="form-input" type="datetime-local" id="expires-at" required>
                </div>

                <button type="submit" class="btn btn-primary btn-block btn-lg" id="submit-product-btn">確認上架</button>
            </form>
        </div>
    `;

    renderPage(html);
    updateBottomNav('add');

    // Source selection handler (attach to window for onclick access)
    window.selectSource = function(source) {
        selectedSource = source;
        const mapCard = document.getElementById('source-map');
        const machineCard = document.getElementById('source-machine');
        if (mapCard && machineCard) {
            mapCard.classList.toggle('selected', source === 'map');
            machineCard.classList.toggle('selected', source === 'machine');
        }
    };

    // Form submission
    const form = document.getElementById('add-product-form');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            const name = document.getElementById('product-name').value.trim();
            const category = document.getElementById('product-category').value;
            const originalPrice = Number(document.getElementById('original-price').value);
            const sellingPrice = Number(document.getElementById('selling-price').value);
            const expiresAt = document.getElementById('expires-at').value;

            // Validation
            if (!name) {
                showToast('請輸入商品名稱', 'error');
                return;
            }
            if (!category) {
                showToast('請選擇商品分類', 'error');
                return;
            }
            if (!originalPrice || originalPrice <= 0) {
                showToast('請輸入有效的原價', 'error');
                return;
            }
            if (!sellingPrice || sellingPrice <= 0) {
                showToast('請輸入有效的售價', 'error');
                return;
            }
            if (sellingPrice >= originalPrice) {
                showToast('售價必須低於原價', 'error');
                return;
            }
            if (!selectedSource) {
                showToast('請選擇銷售來源', 'error');
                return;
            }
            if (!expiresAt) {
                showToast('請選擇到期時間', 'error');
                return;
            }

            // Collect allergens
            const allergenCheckboxes = document.querySelectorAll('input[name="allergen"]:checked');
            const allergens = Array.from(allergenCheckboxes).map(cb => cb.value);

            try {
                showLoading();
                await api.createProduct({
                    name: name,
                    category: category,
                    originalPrice: originalPrice,
                    sellingPrice: sellingPrice,
                    source: selectedSource,
                    allergens: allergens,
                    expiresAt: expiresAt
                });
                hideLoading();
                showToast('商品上架成功！', 'success');
                router.navigate('/store/dashboard');
            } catch (err) {
                hideLoading();
                showToast(err.message || '上架失敗，請稍後再試', 'error');
            }
        });
    }
}
