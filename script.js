var FALLBACK_IMAGE = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22400%22 viewBox=%220 0 400 400%22%3E%3Crect width=%22400%22 height=%22400%22 fill=%22%23c97a34%22/%3E%3Ctext x=%22200%22 y=%22210%22 font-family=%22Arial%22 font-size=%2248%22 fill=%22%23fff%22 text-anchor=%22middle%22%3EAMK%3C/text%3E%3C/svg%3E";
var API_BASE = 'https://makka-api.alsadiayham.workers.dev';
var CART_KEY = 'makka_cart';
var LEGACY_CART_KEY = 'drenasshop_cart';
var DELIVERY_KEY = 'makka_delivery_method';
var LEGACY_DELIVERY_KEY = 'drenasshop_delivery_method';
var WHOLESALE_KEY = 'makka_wholesale';
var WHOLESALE_SESSION_KEY = 'makka_wholesale_session';
var CATEGORY_META = {
    'فصاليات': { icon: '🪛', subtitle: 'فصاليات ثابتة ومفصلات للأبواب والخزائن.' },
    'لوازم ابواب': { icon: '🚪', subtitle: 'أقفال وماسكات وإكسسوارات أساسية للأبواب.' },
    'ايدين ابواب': { icon: '🖐️', subtitle: 'أيدين أبواب بمقاسات وتشطيبات متعددة.' },
    'براغي': { icon: '🔩', subtitle: 'براغي بأطوال مختلفة لمهام التثبيت اليومية.' },
    'سحابات': { icon: '🧰', subtitle: 'سحابات أدراج ناعمة وتحميلات متنوعة.' },
    'أقمشة': { icon: '🧵', subtitle: 'أقمشة تنجيد للمشاريع المنزلية والتجارية.' }
};
var CATEGORY_ORDER = ['فصاليات', 'لوازم ابواب', 'ايدين ابواب', 'براغي', 'سحابات', 'أقمشة'];
var products = [];
var discounts = [];
var siteSettings = normalizeSettings(DEFAULT_SITE_SETTINGS);
var cart = normalizeCartItems(loadStoredCart(), normalizeProducts(DEFAULT_PRODUCTS));
var storeLoadState = { products: false, discounts: false, settings: false };
var storedWholesalePreference = loadWholesaleMode();
var wholesaleMode = false;
var wholesaleSession = loadWholesaleSession();
var wholesaleOtpResetContext = null;
var wholesaleProfileUser = null;
var wholesaleProfileOrders = [];
var categorySearchValue = '';
var categorySearchTimer = null;
var categoryRenderedCount = 0;
var currentCategoryProducts = [];
var unsubscribers = [];
var revealObserver = null;
var pdpState = { productId: '', sizeIdx: 0, qty: 1 };
var productIndex = {};
var PRODUCT_PAGE_SIZE = 24;

function hashString(str) {
    var encoder = new TextEncoder();
    return crypto.subtle.digest('SHA-256', encoder.encode(str)).then(function (buffer) {
        var bytes = new Uint8Array(buffer);
        var hash = '';
        var idx;
        for (idx = 0; idx < bytes.length; idx += 1) {
            var hex = bytes[idx].toString(16);
            hash += hex.length === 1 ? '0' + hex : hex;
        }
        return hash;
    });
}
function hashStringWholesale(str) { return hashString(str); }
function readStorage(keys, fallback) {
    var idx;
    for (idx = 0; idx < keys.length; idx += 1) {
        var value = localStorage.getItem(keys[idx]);
        if (value !== null && value !== '') return value;
    }
    return fallback;
}
function loadStoredCart() { try { return JSON.parse(readStorage([CART_KEY, LEGACY_CART_KEY], '[]')); } catch (error) { return []; } }
function loadWholesaleMode() { return readStorage([WHOLESALE_KEY], 'false') === 'true'; }
function loadWholesaleSession() {
    try {
        var stored = JSON.parse(readStorage([WHOLESALE_SESSION_KEY], 'null'));
        if (!stored || typeof stored !== 'object') return null;
        return {
            email: normalizeWholesaleEmail(stored.email),
            firstName: String(stored.firstName || '').trim(),
            approved: !!stored.approved,
            docId: String(stored.docId || stored.id || '').trim()
        };
    } catch (error) { return null; }
}
function normalizeWholesaleEmail(email) { return String(email || '').trim().toLowerCase(); }
function saveWholesaleSession(session) {
    wholesaleSession = session ? {
        email: normalizeWholesaleEmail(session.email),
        firstName: String(session.firstName || '').trim(),
        approved: !!session.approved,
        docId: String(session.docId || session.id || '').trim()
    } : null;
    if (wholesaleSession) localStorage.setItem(WHOLESALE_SESSION_KEY, JSON.stringify(wholesaleSession));
    else localStorage.removeItem(WHOLESALE_SESSION_KEY);
}
function clearWholesaleSession() { saveWholesaleSession(null); }
function getWholesaleSessionName() { return wholesaleSession && wholesaleSession.firstName ? wholesaleSession.firstName : 'يا تاجر'; }
function getWholesaleProfileUrl() { return 'wholesale-profile.html'; }
function isWholesaleProfilePage() { return document.body.className.indexOf('wholesale-profile-page') >= 0; }
function getQueryParam(name) {
    var search = window.location.search.replace(/^\?/, '');
    if (!search) return '';
    var parts = search.split('&');
    var idx;
    for (idx = 0; idx < parts.length; idx += 1) {
        var pair = parts[idx].split('=');
        if (decodeURIComponent(pair[0]) === name) return pair.length > 1 ? decodeURIComponent(pair.slice(1).join('=').replace(/\+/g, ' ')) : '';
    }
    return '';
}
function isHomePage() { return document.body.className.indexOf('home-page') >= 0; }
function isCategoryPage() { return document.body.className.indexOf('category-page') >= 0; }
function rebuildProductIndex() {
    var nextIndex = {};
    var idx;
    for (idx = 0; idx < products.length; idx += 1) nextIndex[String(products[idx].id)] = products[idx];
    productIndex = nextIndex;
}
function getProductDomKey(productId) { return encodeURIComponent(String(productId == null ? '' : productId)).replace(/%/g, '_'); }
function getProductElementId(prefix, productId) { return prefix + getProductDomKey(productId); }
function findProductById(productId) { return productIndex[String(productId)] || null; }
function findCartItem(productId, sizeIdx) { var idx; for (idx = 0; idx < cart.length; idx += 1) if (String(cart[idx].id) === String(productId) && parseInt(cart[idx].sizeIdx, 10) === parseInt(sizeIdx, 10)) return cart[idx]; return null; }
function isProductOutOfStock(product) { return !!product && (product.quantity === 0 || product.status === 'soldout'); }
function getTrackedProductQuantity(product) { return typeof product.quantity === 'number' ? product.quantity : null; }
function getAvailableProductQuantity(product) { return typeof product.quantity === 'number' ? product.quantity : 9999; }
function getCartProductTotal(productId) {
    var total = 0;
    cart.forEach(function (item) {
        if (String(item.id) === String(productId)) total += Math.max(1, parseInt(item.qty, 10) || 1);
    });
    return total;
}
function canUseProductQuantity(product, requestedQty, excludeQty) {
    var available = getAvailableProductQuantity(product);
    var totalInCart = getCartProductTotal(product.id) - Math.max(0, parseInt(excludeQty, 10) || 0);
    if (totalInCart + requestedQty > available) {
        alert('الكمية المطلوبة غير متوفرة. المتوفر: ' + available + ' قطعة');
        return false;
    }
    return true;
}
function getCategoryMeta(category) { return CATEGORY_META[category] || { icon: '🪵', subtitle: 'منتجات مختارة لهذا القسم.' }; }
function getCategoryList() {
    var seen = {};
    var list = [];
    var idx;
    for (idx = 0; idx < CATEGORY_ORDER.length; idx += 1) { seen[CATEGORY_ORDER[idx]] = true; list.push(CATEGORY_ORDER[idx]); }
    for (idx = 0; idx < products.length; idx += 1) if (!seen[products[idx].category]) { seen[products[idx].category] = true; list.push(products[idx].category); }
    return list;
}
function syncModeFromUrl() {
    var wholesaleParam = getQueryParam('wholesale');
    if (wholesaleParam === 'false') setWholesaleMode(false, false);
    if (wholesaleParam === 'true' && wholesaleSession && wholesaleSession.approved) setWholesaleMode(true, false);
}
function saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(normalizeCartItems(cart, products.length ? products : normalizeProducts(DEFAULT_PRODUCTS)))); localStorage.removeItem(LEGACY_CART_KEY); }
function setStoreMessage(message) {
    var notice = document.getElementById('storeNotice');
    if (!notice) return;
    if (!message) { notice.style.display = 'none'; notice.textContent = ''; return; }
    notice.style.display = 'block'; notice.textContent = message;
}
function setLoadingState(isLoading) { var loading = document.getElementById('storeLoading'); if (loading) loading.style.display = isLoading ? 'block' : 'none'; }
function markStoreLoaded(key) { storeLoadState[key] = true; if (storeLoadState.products && storeLoadState.discounts && storeLoadState.settings) { setLoadingState(false); renderStorefront(); } }
function cleanupSubscriptions() { while (unsubscribers.length) { var fn = unsubscribers.pop(); if (typeof fn === 'function') fn(); } }
function applyFallbackStoreData(message) { products = normalizeProducts(DEFAULT_PRODUCTS); rebuildProductIndex(); discounts = normalizeDiscounts(DEFAULT_DISCOUNTS); siteSettings = normalizeSettings(DEFAULT_SITE_SETTINGS); storeLoadState.products = true; storeLoadState.discounts = true; storeLoadState.settings = true; syncCartWithProducts(); setLoadingState(false); setStoreMessage(message || ''); renderStorefront(); }
function syncCartWithProducts() { cart = normalizeCartItems(cart, products); saveCart(); }
function loadStore() {
    setLoadingState(true);
    if (!window.db) { applyFallbackStoreData('تعذر الاتصال بفايربيس، تم عرض البيانات الاحتياطية.'); return; }
    cleanupSubscriptions();
    db.collection('products').get().then(function (snapshot) {
        products = snapshot.docs.map(function (docSnap) { var data = docSnap.data() || {}; data.id = docSnap.id; return normalizeProduct(data); }).sort(function (a, b) { if ((a.order || 0) !== (b.order || 0)) return (a.order || 0) - (b.order || 0); return String(a.id).localeCompare(String(b.id)); });
        rebuildProductIndex();
        syncCartWithProducts();
        markStoreLoaded('products');
    }).catch(function () { if (!storeLoadState.products) applyFallbackStoreData('تعذر تحميل المنتجات من فايرستور، تم استخدام البيانات الاحتياطية.'); });
    unsubscribers.push(db.collection('discounts').onSnapshot(function (snapshot) { discounts = snapshot.docs.map(function (docSnap) { var data = docSnap.data() || {}; data.id = docSnap.id; return normalizeDiscount(data); }); markStoreLoaded('discounts'); }, function () { discounts = normalizeDiscounts(DEFAULT_DISCOUNTS); markStoreLoaded('discounts'); }));
    unsubscribers.push(db.collection('settings').doc('config').onSnapshot(function (docSnap) { siteSettings = normalizeSettings(docSnap.exists ? docSnap.data() : DEFAULT_SITE_SETTINGS); markStoreLoaded('settings'); }, function () { siteSettings = normalizeSettings(DEFAULT_SITE_SETTINGS); markStoreLoaded('settings'); }));
}
function applySettings() {
    var heroSub = document.getElementById('heroSubtitle'); if (heroSub) heroSub.textContent = siteSettings.heroSubtitle;
    var aboutText = document.getElementById('aboutText'); if (aboutText) aboutText.innerHTML = escapeHtml(siteSettings.aboutText).replace(/\n/g, '<br>');
    var whatsappLink = document.getElementById('whatsappLink'); if (whatsappLink) whatsappLink.href = buildWhatsAppUrl(siteSettings.whatsappNumber);
    var instagramLink = document.getElementById('instagramLink'); if (instagramLink && siteSettings.instagramLink) instagramLink.href = siteSettings.instagramLink;
}
function checkDiscountBanner() {
    var banner = document.getElementById('discountBanner'); var textNode = document.getElementById('bannerText'); if (!banner || !textNode) return;
    var now = new Date().toISOString().slice(0, 10);
    var active = discounts.filter(function (discount) { return !!discount.description && (!discount.expiresAt || discount.expiresAt >= now); });
    if (!active.length) { banner.style.display = 'none'; textNode.textContent = ''; return; }
    banner.style.display = 'block'; textNode.textContent = active.map(function (discount) { return discount.description; }).join('     |     ');
}
function getPriceHTML(product, sizeIdx) { if (wholesaleMode) return '<span class="wholesale-price">السعر حسب الاتفاق</span>'; var pricing = getFinalPrice(product, sizeIdx, discounts); return (pricing.hasDiscount ? '<span class="original-price">' + formatCurrency(pricing.original) + '</span>' : '') + '<span>' + formatCurrency(pricing.final) + '</span>'; }
function getStatusBadge(status) { if (status === 'bestseller') return '<span class="status-badge bestseller">الأكثر مبيعاً</span>'; if (status === 'special') return '<span class="status-badge special">مميز</span>'; if (status === 'soldout') return '<span class="status-badge soldout">نفدت الكمية</span>'; return ''; }
function renderPreviewProduct(product) { var sizeData = getSizeData(product, 0); return '<div class="preview-card" data-product-id="' + escapeHtml(product.id) + '" onclick="openPDPFromNode(this)"><div class="preview-card-image"><img src="' + escapeHtml(product.image || FALLBACK_IMAGE) + '" alt="' + escapeHtml(product.name) + '" loading="lazy" onerror="this.src=\'' + FALLBACK_IMAGE + '\'"></div><h4>' + escapeHtml(product.name) + '</h4><div class="preview-price">' + getPriceHTML(product, 0) + '</div></div>'; }
function buildCategoryUrl(category) { var url = 'category.html?type=' + encodeURIComponent(category); if (wholesaleMode) url += '&wholesale=true'; return url; }
function renderCategoryShowcase() {
    var container = document.getElementById('categoriesShowcase'); if (!container) return;
    if (!products.length) { container.innerHTML = '<div class="empty-products">لا توجد منتجات متاحة حالياً.</div>'; return; }
    container.innerHTML = getCategoryList().map(function (category) {
        var items = products.filter(function (product) { return product.category === category && product.quantity !== 0; }).slice(0, 4);
        if (!items.length) return '';
        var meta = getCategoryMeta(category);
        return '<article class="category-card reveal"><div class="category-card-head"><div><span class="category-badge">' + meta.icon + '</span></div><div style="flex:1;"><h3 class="product-title">' + escapeHtml(category) + '</h3><p>' + escapeHtml(meta.subtitle) + '</p></div><span class="category-count">' + items.length + ' معاينات</span></div><div class="category-preview-grid">' + items.map(renderPreviewProduct).join('') + '</div><div class="category-link-row"><span class="category-count">استعرض كل المنتجات داخل القسم</span><a href="' + buildCategoryUrl(category) + '" class="btn btn-primary wood-sign-btn">عرض المزيد</a></div></article>';
    }).join('');
    refreshRevealTargets();
}
function updateCategoryHeadings(category) {
    var meta = getCategoryMeta(category || '');
    var title = document.getElementById('categoryTitle'); if (title) title.textContent = category;
    var breadcrumb = document.getElementById('breadcrumbCurrent'); if (breadcrumb) breadcrumb.textContent = category;
    var heading = document.getElementById('categoryProductsHeading'); if (heading) heading.textContent = 'كل منتجات ' + category;
    var text = document.getElementById('categoryProductsText'); if (text) text.textContent = meta.subtitle;
    var subtitle = document.getElementById('categorySubtitle'); if (subtitle) subtitle.textContent = meta.subtitle;
}
function buildProductCardHtml(product) {
    var sizeData = getSizeData(product, 0);
    var discountPercent = getProductDiscountPercent(product, discounts);
    var limitedBadge = typeof product.quantity === 'number' && product.quantity > 0 && product.quantity < 20 ? '<span class="limited-qty-badge"' + (getStatusBadge(product.status) ? ' style="top:46px;"' : '') + '>كمية محدودة</span>' : '';
    var outOfStock = isProductOutOfStock(product);
    var domKey = getProductDomKey(product.id);
    var cardId = getProductElementId('productCard-', product.id);
    var sizeNodeId = getProductElementId('productSize-', product.id);
    var priceNodeId = getProductElementId('productPrice-', product.id);
    var qtyNodeId = getProductElementId('cardQty-', product.id);
    var sizeSelectId = getProductElementId('sizeSelect-', product.id);
    var sizeSelector = product.sizes.length > 1 ? '<div class="card-size-selector"><label for="' + sizeSelectId + '">المقاس</label><select id="' + sizeSelectId + '" class="size-select" data-product-id="' + escapeHtml(product.id) + '" onchange="updateProductSize(this.getAttribute(\'data-product-id\'), this.value)">' + product.sizes.map(function (size, idx) { return '<option value="' + idx + '">' + escapeHtml(getSizeLabel(size)) + '</option>'; }).join('') + '</select></div>' : '<div class="card-size-single">المقاس: <strong id="' + sizeNodeId + '">' + escapeHtml(getSizeLabel(sizeData)) + '</strong></div>';
    return '<article class="product-card reveal" id="' + cardId + '" data-product-dom-key="' + domKey + '">' + (discountPercent > 0 ? '<span class="discount-badge">-' + discountPercent + '%</span>' : '') + getStatusBadge(product.status) + limitedBadge + '<div class="product-image product-open-area" data-product-id="' + escapeHtml(product.id) + '" onclick="openPDPFromNode(this)"><img src="' + escapeHtml(product.image || FALLBACK_IMAGE) + '" alt="' + escapeHtml(product.name) + '" loading="lazy" onerror="this.src=\'' + FALLBACK_IMAGE + '\'"></div><div class="product-body"><div class="product-card-summary product-open-area" data-product-id="' + escapeHtml(product.id) + '" onclick="openPDPFromNode(this)"><span class="product-brand">' + escapeHtml(product.brand) + '</span><h3 class="product-title">' + escapeHtml(product.name) + '</h3><div class="product-description">' + escapeHtml(product.description || getCategoryMeta(product.category).subtitle) + '</div><div class="product-meta">القسم: ' + escapeHtml(product.category) + ' • <span id="' + sizeNodeId + '">' + escapeHtml(getSizeLabel(sizeData)) + '</span></div><div class="product-price" id="' + priceNodeId + '">' + getPriceHTML(product, 0) + '</div></div>' + sizeSelector + '<div class="product-card-actions"><div class="qty-selector"><button type="button" data-product-id="' + escapeHtml(product.id) + '" onclick="changeCardQty(event, this.getAttribute(\'data-product-id\'), -1)">−</button><span id="' + qtyNodeId + '">1</span><button type="button" data-product-id="' + escapeHtml(product.id) + '" onclick="changeCardQty(event, this.getAttribute(\'data-product-id\'), 1)">+</button></div><button type="button" class="btn-add-cart" data-product-id="' + escapeHtml(product.id) + '" onclick="addToCart(event, this.getAttribute(\'data-product-id\'))" ' + (outOfStock ? 'disabled' : '') + '>' + (outOfStock ? 'نفدت الكمية' : 'أضف إلى السلة') + '</button></div></div></article>';
}
function updateProductsRenderStatus(total, shown) {
    var wrap = document.getElementById('productsLoadMoreWrap');
    var button = document.getElementById('productsLoadMoreBtn');
    var status = document.getElementById('productsRenderStatus');
    var remaining = total - shown;
    if (!wrap || !button || !status) return;
    if (!total || shown >= total) {
        wrap.style.display = total > PRODUCT_PAGE_SIZE ? 'flex' : 'none';
        button.style.display = 'none';
    } else {
        wrap.style.display = 'flex';
        button.style.display = 'inline-flex';
    }
    status.textContent = total ? ('عرض ' + shown + ' من أصل ' + total + ' منتج') : '';
    if (remaining > 0) button.textContent = 'عرض ' + Math.min(PRODUCT_PAGE_SIZE, remaining) + ' منتج إضافي';
}
function appendRenderedProducts(reset) {
    var grid = document.getElementById('productsGrid');
    var nextProducts;
    var temp;
    var fragment;
    if (!grid) return;
    if (reset) grid.innerHTML = '';
    if (!currentCategoryProducts.length) {
        grid.innerHTML = '<div class="empty-products">لا توجد منتجات مطابقة حالياً.</div>';
        updateProductsRenderStatus(0, 0);
        return;
    }
    nextProducts = currentCategoryProducts.slice(categoryRenderedCount, categoryRenderedCount + PRODUCT_PAGE_SIZE);
    temp = document.createElement('div');
    temp.innerHTML = nextProducts.map(buildProductCardHtml).join('');
    fragment = document.createDocumentFragment();
    while (temp.firstChild) fragment.appendChild(temp.firstChild);
    grid.appendChild(fragment);
    categoryRenderedCount += nextProducts.length;
    refreshRevealTargets();
    updateProductsRenderStatus(currentCategoryProducts.length, categoryRenderedCount);
}
function renderProducts(productsToShow) {
    currentCategoryProducts = productsToShow.filter(function (product) { return product.quantity !== 0; });
    categoryRenderedCount = 0;
    appendRenderedProducts(true);
}
function ensureProductRendered(productId) {
    var targetIndex = -1;
    var idx;
    for (idx = 0; idx < currentCategoryProducts.length; idx += 1) {
        if (String(currentCategoryProducts[idx].id) === String(productId)) {
            targetIndex = idx;
            break;
        }
    }
    while (targetIndex >= categoryRenderedCount) appendRenderedProducts(false);
}
function loadMoreProducts() { appendRenderedProducts(false); }
function updateProductSize(productId, sizeIdx) { var product = findProductById(productId); if (!product) return; var sizeData = getSizeData(product, sizeIdx); var sizeEl = document.getElementById(getProductElementId('productSize-', productId)); var priceEl = document.getElementById(getProductElementId('productPrice-', productId)); if (sizeEl) sizeEl.textContent = getSizeLabel(sizeData); if (priceEl) priceEl.innerHTML = getPriceHTML(product, sizeIdx); }
function changeCardQty(event, productId, delta) {
    if (event && event.preventDefault) event.preventDefault();
    if (event && event.stopPropagation) event.stopPropagation();
    var counter = document.getElementById(getProductElementId('cardQty-', productId));
    var product = findProductById(productId);
    if (!counter || !product) return;
    var current = (parseInt(counter.textContent, 10) || 1) + delta;
    if (current < 1) current = 1;
    if (current > 99) current = 99;
    if (delta > 0 && !canUseProductQuantity(product, current, 0)) return;
    counter.textContent = current;
}
function addToCart(event, productId) {
    if (event && event.preventDefault) event.preventDefault();
    if (event && event.stopPropagation) event.stopPropagation();
    var product = findProductById(productId); if (!product || isProductOutOfStock(product)) return;
    var imageNode = getProductImageElement(productId, event ? event.target : null);
    var sizeSelect = document.getElementById(getProductElementId('sizeSelect-', productId)); var sizeIdx = sizeSelect ? parseInt(sizeSelect.value, 10) || 0 : 0; var qty = parseInt((document.getElementById(getProductElementId('cardQty-', productId)) || {}).textContent || '1', 10) || 1; var pricing = getFinalPrice(product, sizeIdx, discounts); var existing = findCartItem(productId, sizeIdx);
    if (!canUseProductQuantity(product, qty, 0)) return;
    if (existing) { existing.qty += qty; existing.price = pricing.final; } else { cart.push({ id: String(productId), sizeIdx: sizeIdx, qty: qty, price: pricing.final }); }
    saveCart(); updateCartBadge(); renderCart();
    animateProductToCart(imageNode);
    var counter = document.getElementById(getProductElementId('cardQty-', productId)); if (counter) counter.textContent = '1';
}
function updateCartBadge() { var badge = document.getElementById('cartBadge'); if (!badge) return; var total = 0; cart.forEach(function (item) { total += Math.max(1, parseInt(item.qty, 10) || 1); }); if (total > 0) { badge.style.display = 'flex'; badge.textContent = total; } else { badge.style.display = 'none'; badge.textContent = '0'; } }
function getCartTotal() { var total = 0; cart.forEach(function (item) { var product = findProductById(item.id); if (product) total += getFinalPrice(product, item.sizeIdx, discounts).final * item.qty; }); return total; }
function updateCheckoutLink() { var btn = document.getElementById('checkoutBtn'); if (!btn) return; btn.href = 'checkout.html' + (wholesaleMode ? '?wholesale=true' : ''); btn.classList.toggle('disabled', cart.length === 0); btn.textContent = wholesaleMode ? 'إرسال الطلب' : 'إتمام الطلب'; }
function updateCartTotal() { var totalNode = document.getElementById('cartTotal'); if (totalNode) totalNode.textContent = wholesaleMode ? 'حسب الاتفاق' : formatCurrency(getCartTotal()); updateCheckoutLink(); }
function renderCart() {
    var container = document.getElementById('cartItems'); var footer = document.getElementById('cartFooter'); if (!container || !footer) return;
    if (!cart.length) { container.innerHTML = '<div class="cart-empty"><span>🛒</span><p>السلة فارغة</p></div>'; footer.style.display = 'none'; updateCheckoutLink(); return; }
    footer.style.display = 'block';
    container.innerHTML = cart.map(function (item) { var product = findProductById(item.id); if (!product) return ''; var sizeData = getSizeData(product, item.sizeIdx); var lineTotal = getFinalPrice(product, item.sizeIdx, discounts).final * item.qty; return '<div class="cart-item"><img src="' + escapeHtml(product.image || FALLBACK_IMAGE) + '" alt="' + escapeHtml(product.name) + '" loading="lazy" onerror="this.src=\'' + FALLBACK_IMAGE + '\'"><div class="cart-item-info"><h4>' + escapeHtml(product.name) + '</h4><span class="cart-item-brand">' + escapeHtml(product.category) + ' • ' + escapeHtml(getSizeLabel(sizeData)) + '</span><div class="cart-item-price">' + (wholesaleMode ? 'السعر حسب الاتفاق' : formatCurrency(lineTotal)) + '</div><div class="cart-item-qty"><button type="button" data-product-id="' + escapeHtml(product.id) + '" data-size-idx="' + item.sizeIdx + '" onclick="updateCartQty(this.getAttribute(\'data-product-id\'), this.getAttribute(\'data-size-idx\'), -1)">−</button><span>' + item.qty + '</span><button type="button" data-product-id="' + escapeHtml(product.id) + '" data-size-idx="' + item.sizeIdx + '" onclick="updateCartQty(this.getAttribute(\'data-product-id\'), this.getAttribute(\'data-size-idx\'), 1)">+</button></div></div><button type="button" class="cart-item-remove" data-product-id="' + escapeHtml(product.id) + '" data-size-idx="' + item.sizeIdx + '" onclick="removeFromCart(this.getAttribute(\'data-product-id\'), this.getAttribute(\'data-size-idx\'))">✕</button></div>'; }).join('');
    updateCartTotal();
}
function updateCartQty(productId, sizeIdx, delta) {
    var item = findCartItem(productId, sizeIdx);
    var product = findProductById(productId);
    if (!item || !product) return;
    if (delta > 0 && !canUseProductQuantity(product, item.qty + delta, item.qty)) return;
    item.qty += delta;
    if (item.qty < 1) { removeFromCart(productId, sizeIdx); return; }
    saveCart(); updateCartBadge(); renderCart();
}
function removeFromCart(productId, sizeIdx) { cart = cart.filter(function (item) { return !(String(item.id) === String(productId) && parseInt(item.sizeIdx, 10) === parseInt(sizeIdx, 10)); }); saveCart(); updateCartBadge(); renderCart(); }
function clearCart() { cart = []; saveCart(); updateCartBadge(); renderCart(); }
function findAncestorByClass(node, className) {
    while (node && node !== document.body) {
        if (node.className && (' ' + node.className + ' ').indexOf(' ' + className + ' ') >= 0) return node;
        node = node.parentNode;
    }
    return null;
}
function openPDPFromNode(node) { if (!node) return; openPDP(node.getAttribute('data-product-id') || ''); }
function getProductImageElement(productId, sourceNode) {
    var modal = document.getElementById('pdpModal');
    var pdpImage = document.querySelector('.pdp-image img');
    if (modal && modal.classList.contains('active') && pdpImage) return pdpImage;
    var productCard = sourceNode ? findAncestorByClass(sourceNode, 'product-card') : null;
    if (!productCard && productId) productCard = document.getElementById(getProductElementId('productCard-', productId));
    if (productCard) return productCard.querySelector('.product-image img');
    var previewCard = sourceNode ? findAncestorByClass(sourceNode, 'preview-card') : null;
    if (previewCard) return previewCard.querySelector('img');
    return null;
}
function animateProductToCart(imageNode) {
    var cartIcon = document.getElementById('cartIcon');
    if (!imageNode || !cartIcon || !document.body) return;
    var startRect = imageNode.getBoundingClientRect();
    var endRect = cartIcon.getBoundingClientRect();
    if (!startRect.width || !startRect.height) return;
    var clone = imageNode.cloneNode(true);
    var translateX = (endRect.left + (endRect.width / 2)) - (startRect.left + (startRect.width / 2));
    var translateY = (endRect.top + (endRect.height / 2)) - (startRect.top + (startRect.height / 2));
    clone.className = 'flying-product';
    clone.style.left = startRect.left + 'px';
    clone.style.top = startRect.top + 'px';
    clone.style.width = startRect.width + 'px';
    clone.style.height = startRect.height + 'px';
    clone.style.transform = 'translate3d(0, 0, 0) scale(1)';
    clone.style.opacity = '1';
    document.body.appendChild(clone);
    if (window.requestAnimationFrame) {
        window.requestAnimationFrame(function () {
            clone.style.transform = 'translate3d(' + translateX + 'px, ' + translateY + 'px, 0) scale(0.18)';
            clone.style.opacity = '0.35';
        });
    } else {
        clone.style.transform = 'translate3d(' + translateX + 'px, ' + translateY + 'px, 0) scale(0.18)';
        clone.style.opacity = '0.35';
    }
    cartIcon.classList.add('cart-bump');
    setTimeout(function () { cartIcon.classList.remove('cart-bump'); }, 420);
    setTimeout(function () { if (clone && clone.parentNode) clone.parentNode.removeChild(clone); }, 760);
}
function renderPDPContent(product) {
    var container = document.getElementById('pdpContent');
    if (!container || !product) return;
    var description = product.description || getCategoryMeta(product.category).subtitle;
    var related = products.filter(function (item) { return item.category === product.category && String(item.id) !== String(product.id) && item.quantity !== 0; }).slice(0, 4);
    var sizeButtons = product.sizes.map(function (size, idx) { return '<button class="pdp-size-btn' + (idx === pdpState.sizeIdx ? ' active' : '') + '" type="button" onclick="selectPDPSize(' + idx + ')">' + escapeHtml(getSizeLabel(size)) + '</button>'; }).join('');
    var relatedHtml = related.map(function (item) { return '<div class="pdp-related-item" data-product-id="' + escapeHtml(item.id) + '" onclick="openPDPFromNode(this)"><img src="' + escapeHtml(item.image || FALLBACK_IMAGE) + '" alt="' + escapeHtml(item.name) + '" loading="lazy" onerror="this.src=\'' + FALLBACK_IMAGE + '\'"><p>' + escapeHtml(item.name) + '</p></div>'; }).join('');
    var limitedMessage = typeof product.quantity === 'number' && product.quantity > 0 && product.quantity < 20 ? '<p class="pdp-meta" style="color:#f59e0b;font-weight:700;">كمية محدودة - باقي ' + product.quantity + ' قطعة</p>' : '';
    var outOfStock = isProductOutOfStock(product);
    container.innerHTML = '<div class="pdp-grid"><div class="pdp-image"><img src="' + escapeHtml(product.image || FALLBACK_IMAGE) + '" alt="' + escapeHtml(product.name) + '" onerror="this.src=\'' + FALLBACK_IMAGE + '\'"></div><div class="pdp-info"><span class="pdp-brand">' + escapeHtml(product.brand) + '</span><h2 class="pdp-name">' + escapeHtml(product.name) + '</h2><p class="pdp-description">' + escapeHtml(description) + '</p><p class="pdp-meta">القسم: ' + escapeHtml(product.category) + '</p>' + limitedMessage + '<div class="pdp-price" id="pdpPrice">' + getPriceHTML(product, pdpState.sizeIdx) + '</div><div class="pdp-size-section"><label>المقاس:</label><div class="pdp-size-options">' + sizeButtons + '</div></div><div class="pdp-actions"><div class="pdp-qty"><button type="button" onclick="changePDPQty(-1)">−</button><span id="pdpQty">' + pdpState.qty + '</span><button type="button" onclick="changePDPQty(1)">+</button></div><button class="pdp-add-btn" id="pdpAddBtn" type="button" onclick="addFromPDP()" ' + (outOfStock ? 'disabled' : '') + '>' + (outOfStock ? 'نفدت الكمية' : 'أضف إلى السلة') + '</button></div></div></div><div class="pdp-related"><h3>منتجات مشابهة</h3><div class="pdp-related-grid">' + (relatedHtml || '<div class="profile-empty-state">لا توجد منتجات مشابهة حالياً.</div>') + '</div></div>';
}
function openPDP(productId) {
    var product = findProductById(productId);
    var overlay = document.getElementById('pdpOverlay');
    var modal = document.getElementById('pdpModal');
    if (!product || !overlay || !modal) return;
    pdpState.productId = String(productId);
    pdpState.sizeIdx = 0;
    pdpState.qty = 1;
    renderPDPContent(product);
    overlay.classList.add('active');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closePDP() {
    var overlay = document.getElementById('pdpOverlay');
    var modal = document.getElementById('pdpModal');
    var cartSidebar = document.getElementById('cartSidebar');
    if (overlay) overlay.classList.remove('active');
    if (modal) modal.classList.remove('active');
    if (!cartSidebar || !cartSidebar.classList.contains('active')) document.body.style.overflow = '';
}
function selectPDPSize(sizeIdx) {
    var product = findProductById(pdpState.productId);
    if (!product) return;
    pdpState.sizeIdx = Math.max(0, Math.min(product.sizes.length - 1, parseInt(sizeIdx, 10) || 0));
    renderPDPContent(product);
}
function changePDPQty(delta) {
    var product = findProductById(pdpState.productId);
    pdpState.qty = (parseInt(pdpState.qty, 10) || 1) + delta;
    if (pdpState.qty < 1) pdpState.qty = 1;
    if (pdpState.qty > 99) pdpState.qty = 99;
    if (product && delta > 0 && !canUseProductQuantity(product, pdpState.qty, 0)) {
        pdpState.qty -= delta;
    }
    if (product) renderPDPContent(product);
}
function addFromPDP() {
    var product = findProductById(pdpState.productId);
    if (!product || isProductOutOfStock(product)) return;
    var pricing = getFinalPrice(product, pdpState.sizeIdx, discounts);
    var existing = findCartItem(product.id, pdpState.sizeIdx);
    if (!canUseProductQuantity(product, pdpState.qty, 0)) return;
    if (existing) { existing.qty += pdpState.qty; existing.price = pricing.final; } else { cart.push({ id: String(product.id), sizeIdx: pdpState.sizeIdx, qty: pdpState.qty, price: pricing.final }); }
    saveCart(); updateCartBadge(); renderCart();
    animateProductToCart(getProductImageElement(product.id, document.getElementById('pdpModal')));
    pdpState.qty = 1;
    renderPDPContent(product);
}
function toggleCart() { var sidebar = document.getElementById('cartSidebar'); var overlay = document.getElementById('cartOverlay'); if (!sidebar || !overlay) return; if (sidebar.classList.contains('active')) { sidebar.classList.remove('active'); overlay.classList.remove('active'); document.body.style.overflow = ''; } else { sidebar.classList.add('active'); overlay.classList.add('active'); document.body.style.overflow = 'hidden'; renderCart(); } }
function setWholesaleMode(value, skipRender) {
    wholesaleMode = !!value;
    storedWholesalePreference = wholesaleMode;
    localStorage.setItem(WHOLESALE_KEY, wholesaleMode ? 'true' : 'false');
    if (skipRender) return;
    if (storeLoadState.products && storeLoadState.discounts && storeLoadState.settings) renderStorefront();
    else { renderWholesaleState(); updateCartBadge(); renderCart(); }
}
function setWholesaleAuthMessage(message, type) {
    var messageNode = document.getElementById('wholesaleAuthMessage');
    if (!messageNode) return;
    if (!message) {
        messageNode.style.display = 'none';
        messageNode.className = 'wholesale-auth-message';
        messageNode.textContent = '';
        return;
    }
    messageNode.style.display = 'block';
    messageNode.className = 'wholesale-auth-message ' + (type || 'info');
    messageNode.textContent = message;
}
function updateWholesaleAuthHead(mode) {
    var title = document.getElementById('wholesaleAuthTitle');
    var subtitle = document.getElementById('wholesaleAuthSubtitle');
    if (title) title.textContent = mode === 'reset' ? 'تعيين كلمة مرور جديدة' : 'حساب تجار الجملة';
    if (!subtitle) return;
    if (mode === 'reset') subtitle.textContent = 'تم التحقق من رمز إعادة التعيين. اختر كلمة مرور جديدة حتى تتابع الدخول إلى حسابك.';
    else subtitle.textContent = 'سجّل دخولك أو أنشئ حساباً جديداً حتى تتمكن من تفعيل وضع الجملة بعد موافقة الإدارة. يمكنك أيضاً استخدام رمز إعادة التعيين المؤقت إذا وصلك من الإدارة.';
}
function resetWholesaleOtpResetState() {
    wholesaleOtpResetContext = null;
    updateWholesaleAuthHead('signin');
    var tabs = document.getElementById('wholesaleAuthTabs');
    if (tabs) tabs.style.display = 'flex';
    var emailNode = document.getElementById('wholesaleOtpResetEmail');
    var passwordNode = document.getElementById('wholesaleOtpResetPassword');
    var confirmNode = document.getElementById('wholesaleOtpResetConfirmPassword');
    if (emailNode) emailNode.value = '';
    if (passwordNode) passwordNode.value = '';
    if (confirmNode) confirmNode.value = '';
}
function switchWholesaleAuthTab(tab) {
    var signInForm = document.getElementById('wholesaleSignInForm');
    var signUpForm = document.getElementById('wholesaleSignUpForm');
    var resetForm = document.getElementById('wholesaleOtpResetForm');
    var signInTab = document.getElementById('wholesaleSignInTab');
    var signUpTab = document.getElementById('wholesaleSignUpTab');
    var tabs = document.getElementById('wholesaleAuthTabs');
    if (signInForm) signInForm.classList.toggle('active', tab === 'signin');
    if (signUpForm) signUpForm.classList.toggle('active', tab === 'signup');
    if (resetForm) resetForm.classList.toggle('active', tab === 'reset');
    if (signInTab) signInTab.classList.toggle('active', tab === 'signin');
    if (signUpTab) signUpTab.classList.toggle('active', tab === 'signup');
    if (tabs) tabs.style.display = tab === 'reset' ? 'none' : 'flex';
    updateWholesaleAuthHead(tab);
}
function openWholesaleAuthModal(tab, message, type) {
    var overlay = document.getElementById('wholesaleAuthOverlay');
    var modal = document.getElementById('wholesaleAuthModal');
    if (!overlay || !modal) return;
    if ((tab || 'signin') !== 'reset') resetWholesaleOtpResetState();
    switchWholesaleAuthTab(tab || 'signin');
    setWholesaleAuthMessage(message || '', type || 'info');
    overlay.classList.add('active');
    modal.classList.add('active');
    document.body.classList.add('wholesale-auth-open');
}
function closeWholesaleAuthModal(event) {
    if (event && event.target && event.target.id !== 'wholesaleAuthOverlay') return;
    var overlay = document.getElementById('wholesaleAuthOverlay');
    var modal = document.getElementById('wholesaleAuthModal');
    if (overlay) overlay.classList.remove('active');
    if (modal) modal.classList.remove('active');
    document.body.classList.remove('wholesale-auth-open');
    resetWholesaleOtpResetState();
}
function fillWholesaleAuthEmail(email) {
    var signInEmail = document.getElementById('wholesaleSignInEmail');
    var signUpEmail = document.getElementById('wholesaleSignUpEmail');
    if (signInEmail && !signInEmail.value) signInEmail.value = email;
    if (signUpEmail && !signUpEmail.value) signUpEmail.value = email;
}
function findWholesaleUserByEmail(email) {
    if (!window.db) return Promise.resolve(null);
    return db.collection('wholesale_users').where('email', '==', normalizeWholesaleEmail(email)).limit(1).get().then(function (snapshot) {
        if (snapshot.empty) return null;
        var docSnap = snapshot.docs[0];
        var data = docSnap.data() || {};
        data.id = docSnap.id;
        return data;
    });
}
function restoreWholesaleSession() {
    if (!wholesaleSession || !wholesaleSession.email) { clearWholesaleSession(); setWholesaleMode(false, true); return Promise.resolve(null); }
    if (!window.db) { clearWholesaleSession(); setWholesaleMode(false, true); return Promise.resolve(null); }
    return findWholesaleUserByEmail(wholesaleSession.email).then(function (user) {
        if (!user) {
            clearWholesaleSession();
            setWholesaleMode(false, true);
            if (storeLoadState.products && storeLoadState.discounts && storeLoadState.settings) renderStorefront();
            else renderWholesaleState();
            return null;
        }
        saveWholesaleSession({ email: user.email, firstName: user.firstName, approved: !!user.approved, docId: user.id });
        if (user.approved && storedWholesalePreference) setWholesaleMode(true, true);
        else setWholesaleMode(false, true);
        if (storeLoadState.products && storeLoadState.discounts && storeLoadState.settings) renderStorefront();
        else renderWholesaleState();
        return user;
    }).catch(function () {
        clearWholesaleSession();
        setWholesaleMode(false, true);
        if (storeLoadState.products && storeLoadState.discounts && storeLoadState.settings) renderStorefront();
        else renderWholesaleState();
        return null;
    });
}
function logoutWholesale() {
    clearWholesaleSession();
    setWholesaleMode(false, false);
    setWholesaleAuthMessage('', 'info');
    closeWholesaleAuthModal();
    renderWholesaleProfileLinks();
    if (isWholesaleProfilePage()) window.location.href = 'index.html';
}
function renderWholesaleProfileLinks() {
    var ids = ['navWholesaleProfileLink', 'mobileWholesaleProfileLink'];
    var idx;
    for (idx = 0; idx < ids.length; idx += 1) {
        var link = document.getElementById(ids[idx]);
        if (!link) continue;
        if (wholesaleSession && wholesaleSession.email) {
            link.style.display = ids[idx].indexOf('mobile') === 0 ? 'block' : 'inline-block';
            link.href = getWholesaleProfileUrl();
        } else link.style.display = 'none';
    }
}
function renderWholesaleStatusCards() {
    var ids = ['wholesaleAuthStatus', 'categoryWholesaleAuthStatus'];
    var idx;
    for (idx = 0; idx < ids.length; idx += 1) {
        var node = document.getElementById(ids[idx]);
        if (!node) continue;
        if (!wholesaleSession || !wholesaleSession.email) {
            node.style.display = 'none';
            node.innerHTML = '';
            continue;
        }
        var isApproved = !!wholesaleSession.approved;
        var modeClass = isApproved ? 'approved' : 'pending';
        var title = isApproved ? ('مرحباً ' + escapeHtml(getWholesaleSessionName())) : 'حسابك بانتظار الموافقة';
        var text = isApproved ? (wholesaleMode ? 'حسابك معتمد ووضع الجملة مفعّل حالياً.' : 'حسابك معتمد ويمكنك تفعيل وضع الجملة متى شئت.') : 'سنفعّل وضع الجملة مباشرة بعد اعتماد الحساب من الإدارة.';
        var actionHtml = '<a class="wholesale-inline-link" href="' + getWholesaleProfileUrl() + '">حسابي</a>';
        if (isApproved) actionHtml += '<button type="button" class="wholesale-inline-btn" onclick="toggleWholesaleMode(' + (wholesaleMode ? 'false' : 'true') + ')">' + (wholesaleMode ? 'إلغاء وضع الجملة' : 'تفعيل وضع الجملة') + '</button>';
        node.style.display = 'block';
        node.innerHTML = '<div class="wholesale-auth-status-card ' + modeClass + '"><div><strong>' + title + '</strong><p>' + text + '</p></div><div class="wholesale-auth-status-actions">' + actionHtml + '<button type="button" class="wholesale-logout-btn" onclick="logoutWholesale()">تسجيل خروج</button></div></div>';
    }
}
function renderWholesaleState() {
    document.body.classList.toggle('wholesale-mode', wholesaleMode);
    ['navWholesaleToggle', 'mobileWholesaleToggle', 'wholesaleModeBtn'].forEach(function (id) {
        var button = document.getElementById(id);
        if (!button) return;
        button.classList.toggle('active', wholesaleMode);
        if (wholesaleMode) button.textContent = 'إلغاء وضع الجملة';
        else if (wholesaleSession && !wholesaleSession.approved) button.textContent = 'الحساب بانتظار الموافقة';
        else button.textContent = 'تفعيل وضع الجملة';
    });
    var textNode = document.getElementById('wholesaleModeText');
    if (textNode) {
        if (wholesaleMode) textNode.textContent = 'وضع الجملة مفعّل الآن. الأسعار مخفية وسيتم إرسال الطلب عبر واتساب بدون أي أسعار.';
        else if (wholesaleSession && !wholesaleSession.approved) textNode.textContent = 'تم إنشاء حسابك بنجاح، وحالياً هو بانتظار موافقة الإدارة قبل تفعيل وضع الجملة.';
        else if (wholesaleSession && wholesaleSession.approved) textNode.textContent = 'حسابك معتمد. يمكنك تفعيل وضع الجملة متى أردت لإخفاء الأسعار وإرسال الطلب مباشرة عبر واتساب.';
        else textNode.textContent = 'يمكنك إنشاء حساب أو تسجيل الدخول كتاجر جملة، وبعد موافقة الإدارة ستتمكن من تفعيل وضع الجملة وإرسال الطلب مباشرة عبر واتساب مع أسماء المنتجات والمقاسات والكميات فقط.';
    }
    var badge = document.getElementById('heroWholesaleBadge'); if (badge) badge.textContent = wholesaleMode ? 'وضع الجملة مفعّل الآن' : (wholesaleSession && wholesaleSession.approved ? 'حساب الجملة معتمد' : 'جملة ومفرق بأفضل الأسعار');
    var browseBtn = document.getElementById('wholesaleBrowseBtn'); if (browseBtn) browseBtn.href = buildCategoryUrl('فصاليات');
    renderWholesaleProfileLinks();
    renderWholesaleStatusCards();
    updateCheckoutLink();
}
function toggleWholesaleMode(forceValue) {
    if (wholesaleMode && forceValue !== true) { setWholesaleMode(false, false); return; }
    if (!window.db) { openWholesaleAuthModal('signin', 'تعذر الاتصال بقاعدة البيانات حالياً. حاول مرة أخرى بعد قليل.', 'error'); return; }
    if (!wholesaleSession || !wholesaleSession.email) { openWholesaleAuthModal('signin', 'سجّل دخولك أو أنشئ حساباً جديداً لتفعيل وضع الجملة.', 'info'); return; }
    if (!wholesaleSession.approved) {
        fillWholesaleAuthEmail(wholesaleSession.email);
        openWholesaleAuthModal('signin', 'حسابك بانتظار الموافقة من الإدارة.', 'info');
        setWholesaleMode(false, false);
        return;
    }
    setWholesaleMode(forceValue === false ? false : true, false);
}
function handleWholesaleSignup(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (!window.db) { setWholesaleAuthMessage('تعذر الاتصال بقاعدة البيانات حالياً.', 'error'); return; }
    var email = normalizeWholesaleEmail((document.getElementById('wholesaleSignUpEmail') || {}).value);
    var password = (document.getElementById('wholesaleSignUpPassword') || {}).value || '';
    var firstName = sanitizePlainText((document.getElementById('wholesaleSignUpFirstName') || {}).value || '', 80);
    var lastName = sanitizePlainText((document.getElementById('wholesaleSignUpLastName') || {}).value || '', 80);
    var location = sanitizeMultilineText((document.getElementById('wholesaleSignUpLocation') || {}).value || '', 200);
    var companyName = sanitizePlainText((document.getElementById('wholesaleSignUpCompany') || {}).value || '', 140);
    if (!email || !password || !firstName || !lastName || !location || !companyName) { setWholesaleAuthMessage('أكمل جميع الحقول المطلوبة أولاً.', 'error'); return; }
    if (password.length < 6) { setWholesaleAuthMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل.', 'error'); return; }
    setWholesaleAuthMessage('جاري إنشاء الحساب...', 'info');
    findWholesaleUserByEmail(email).then(function (existingUser) {
        if (existingUser) throw new Error('EXISTS');
        return hashStringWholesale(password);
    }).then(function (passwordHash) {
        return db.collection('wholesale_users').add({
            email: email,
            passwordHash: passwordHash,
            firstName: firstName,
            lastName: lastName,
            location: location,
            companyName: companyName,
            approved: false,
            createdAt: new Date().toISOString()
        });
    }).then(function (docRef) {
        saveWholesaleSession({ email: email, firstName: firstName, approved: false, docId: docRef.id });
        setWholesaleMode(false, true);
        renderWholesaleState();
        fillWholesaleAuthEmail(email);
        setWholesaleAuthMessage('تم التسجيل بنجاح! حسابك بانتظار موافقة الإدارة.', 'success');
    }).catch(function (error) {
        if (error && error.message === 'EXISTS') setWholesaleAuthMessage('يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل. سجّل دخولك مباشرة.', 'error');
        else setWholesaleAuthMessage('تعذر إنشاء الحساب حالياً. حاول مرة أخرى.', 'error');
    });
}
function handleWholesaleSignin(event) {
    if (event && event.preventDefault) event.preventDefault();
    var email = normalizeWholesaleEmail((document.getElementById('wholesaleSignInEmail') || {}).value);
    var password = (document.getElementById('wholesaleSignInPassword') || {}).value || '';
    if (!email || !password) { setWholesaleAuthMessage('أدخل البريد الإلكتروني وكلمة المرور أو رمز التعيين.', 'error'); return; }
    setWholesaleAuthMessage('جاري التحقق من بيانات الدخول...', 'info');
    // Try Worker API first (rate-limited)
    fetch(API_BASE + '/api/wholesale-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
    }).then(function(res) {
        return res.json().then(function(data) { data._status = res.status; return data; });
    }).then(function(data) {
        if (data._status === 429) {
            setWholesaleAuthMessage('تم تجاوز عدد المحاولات. حاول بعد 15 دقيقة.', 'error');
            return;
        }
        if (data.success && data.user) {
            if (data.otpReset) {
                // OTP login — need to reset password
                findWholesaleUserByEmail(email).then(function(user) {
                    if (user) openWholesaleOtpResetFlow(user);
                });
                return;
            }
            completeWholesaleSignin(data.user);
        } else {
            setWholesaleAuthMessage(data.error || 'البريد الإلكتروني أو كلمة المرور/رمز التعيين غير صحيحين.', 'error');
        }
    }).catch(function() {
        // Fallback to direct Firestore
        wholesaleSigninFallback(email, password);
    });
}
function wholesaleSigninFallback(email, password) {
    if (!window.db) { setWholesaleAuthMessage('تعذر الاتصال بقاعدة البيانات حالياً.', 'error'); return; }
    findWholesaleUserByEmail(email).then(function (user) {
        if (!user) throw new Error('NOT_FOUND');
        return hashStringWholesale(password).then(function (passwordHash) {
            if (passwordHash === user.passwordHash) {
                completeWholesaleSignin(user);
                return;
            }
            if (hasActiveWholesaleOtp(user) && passwordHash === user.otpHash) {
                openWholesaleOtpResetFlow(user);
                return;
            }
            throw new Error('INVALID_PASSWORD');
        });
    }).catch(function (error) {
        if (error && (error.message === 'NOT_FOUND' || error.message === 'INVALID_PASSWORD')) setWholesaleAuthMessage('البريد الإلكتروني أو كلمة المرور/رمز التعيين غير صحيحين.', 'error');
        else setWholesaleAuthMessage('تعذر تسجيل الدخول حالياً. حاول مرة أخرى.', 'error');
    });
}
function initWholesaleAuth() {
    var signInForm = document.getElementById('wholesaleSignInForm');
    var signUpForm = document.getElementById('wholesaleSignUpForm');
    var resetForm = document.getElementById('wholesaleOtpResetForm');
    if (signInForm) signInForm.addEventListener('submit', handleWholesaleSignin);
    if (signUpForm) signUpForm.addEventListener('submit', handleWholesaleSignup);
    if (resetForm) resetForm.addEventListener('submit', handleWholesaleOtpPasswordReset);
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeWholesaleAuthModal();
    });
    if (wholesaleSession && wholesaleSession.email) fillWholesaleAuthEmail(wholesaleSession.email);
    renderWholesaleState();
}
function getWholesaleDeleteFieldValue() {
    return window.firebase && firebase.firestore && firebase.firestore.FieldValue ? firebase.firestore.FieldValue.delete() : null;
}
function getWholesaleUserDocument() {
    if (!window.db || !wholesaleSession || !wholesaleSession.email) return Promise.resolve(null);
    if (wholesaleSession.docId) {
        return db.collection('wholesale_users').doc(String(wholesaleSession.docId)).get().then(function (docSnap) {
            if (!docSnap.exists) return findWholesaleUserByEmail(wholesaleSession.email);
            var data = docSnap.data() || {};
            data.id = docSnap.id;
            return data;
        }).catch(function () {
            return findWholesaleUserByEmail(wholesaleSession.email);
        });
    }
    return findWholesaleUserByEmail(wholesaleSession.email);
}
function hasActiveWholesaleOtp(user) {
    if (!user || !user.otpHash || !user.otpExpiry) return false;
    return new Date(user.otpExpiry).getTime() > Date.now();
}
function openWholesaleOtpResetFlow(user) {
    wholesaleOtpResetContext = {
        docId: user.id,
        email: user.email,
        firstName: user.firstName,
        approved: !!user.approved
    };
    switchWholesaleAuthTab('reset');
    setWholesaleAuthMessage('تم التحقق من رمز إعادة التعيين. اختر كلمة مرور جديدة للمتابعة.', 'success');
    var emailNode = document.getElementById('wholesaleOtpResetEmail');
    if (emailNode) emailNode.value = user.email || '';
}
function completeWholesaleSignin(user) {
    saveWholesaleSession({ email: user.email, firstName: user.firstName, approved: !!user.approved, docId: user.id });
    renderWholesaleState();
    if (isWholesaleProfilePage()) loadWholesaleProfilePage();
    if (user.approved) {
        closeWholesaleAuthModal();
        setWholesaleMode(true, false);
        return;
    }
    setWholesaleMode(false, false);
    setWholesaleAuthMessage('حسابك بانتظار الموافقة من الإدارة.', 'info');
}
function handleWholesaleOtpPasswordReset(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (!window.db) { setWholesaleAuthMessage('تعذر الاتصال بقاعدة البيانات حالياً.', 'error'); return; }
    if (!wholesaleOtpResetContext || !wholesaleOtpResetContext.docId) { setWholesaleAuthMessage('انتهت جلسة إعادة التعيين. أعد تسجيل الدخول بالرمز مرة أخرى.', 'error'); return; }
    var newPassword = (document.getElementById('wholesaleOtpResetPassword') || {}).value || '';
    var confirmPassword = (document.getElementById('wholesaleOtpResetConfirmPassword') || {}).value || '';
    if (!newPassword || !confirmPassword) { setWholesaleAuthMessage('أدخل كلمة المرور الجديدة وأكدها.', 'error'); return; }
    if (newPassword.length < 6) { setWholesaleAuthMessage('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.', 'error'); return; }
    if (newPassword !== confirmPassword) { setWholesaleAuthMessage('تأكيد كلمة المرور غير مطابق.', 'error'); return; }
    setWholesaleAuthMessage('جاري تحديث كلمة المرور...', 'info');
    hashStringWholesale(newPassword).then(function (passwordHash) {
        var deleteValue = getWholesaleDeleteFieldValue();
        var payload = { passwordHash: passwordHash };
        if (deleteValue) {
            payload.otpHash = deleteValue;
            payload.otpExpiry = deleteValue;
        } else {
            payload.otpHash = null;
            payload.otpExpiry = null;
        }
        return db.collection('wholesale_users').doc(String(wholesaleOtpResetContext.docId)).set(payload, { merge: true });
    }).then(function () {
        var approved = !!wholesaleOtpResetContext.approved;
        saveWholesaleSession({
            email: wholesaleOtpResetContext.email,
            firstName: wholesaleOtpResetContext.firstName,
            approved: approved,
            docId: wholesaleOtpResetContext.docId
        });
        renderWholesaleState();
        if (approved) {
            closeWholesaleAuthModal();
            setWholesaleMode(true, false);
        } else {
            switchWholesaleAuthTab('signin');
            setWholesaleAuthMessage('تم تحديث كلمة المرور بنجاح. حسابك ما زال بانتظار موافقة الإدارة.', 'success');
        }
        if (isWholesaleProfilePage()) loadWholesaleProfilePage();
    }).catch(function () {
        setWholesaleAuthMessage('تعذر تحديث كلمة المرور حالياً. حاول مرة أخرى.', 'error');
    });
}
function setWholesaleProfileMessage(message, type) {
    var node = document.getElementById('wholesaleProfileMessage');
    if (!node) return;
    if (!message) {
        node.style.display = 'none';
        node.className = 'profile-message';
        node.textContent = '';
        return;
    }
    node.style.display = 'block';
    node.className = 'profile-message ' + (type || 'info');
    node.textContent = message;
}
function toggleWholesaleProfileEdit(forceOpen) {
    var form = document.getElementById('wholesaleProfileEditForm');
    if (!form) return;
    var shouldShow = typeof forceOpen === 'boolean' ? forceOpen : !form.classList.contains('active');
    form.classList.toggle('active', shouldShow);
}
function populateWholesaleProfileEditForm(user) {
    if (!user) return;
    var firstName = document.getElementById('wholesaleProfileFirstName');
    var lastName = document.getElementById('wholesaleProfileLastName');
    var companyName = document.getElementById('wholesaleProfileCompany');
    var location = document.getElementById('wholesaleProfileLocation');
    if (firstName) firstName.value = user.firstName || '';
    if (lastName) lastName.value = user.lastName || '';
    if (companyName) companyName.value = user.companyName || '';
    if (location) location.value = user.location || '';
}
function renderWholesaleProfileSummary(user) {
    var details = document.getElementById('wholesaleProfileDetails');
    var greeting = document.getElementById('wholesaleProfileGreeting');
    var subtitle = document.getElementById('wholesaleProfileSubtitle');
    var pendingBox = document.getElementById('wholesaleProfilePendingUpdateBox');
    var statusNote = document.getElementById('wholesaleProfileStatusNote');
    if (greeting) greeting.textContent = 'مرحباً ' + (user.firstName || 'يا تاجر');
    if (subtitle) subtitle.textContent = user.approved ? 'هذا حسابك الخاص كتاجر جملة. هنا تراجع بياناتك، طلباتك، وتحدث كلمة المرور.' : 'حسابك بانتظار موافقة الإدارة. يمكنك متابعة بياناتك وإرسال طلب تعديل إذا لزم.';
    if (statusNote) statusNote.innerHTML = user.approved ? '<span class="profile-status approved">حسابك معتمد</span>' : '<span class="profile-status pending">حسابك بانتظار الموافقة</span>';
    if (details) details.innerHTML = '<div class="profile-detail-card"><span>الاسم</span><strong>' + escapeHtml([user.firstName || '', user.lastName || ''].join(' ').trim() || '-') + '</strong></div>' +
        '<div class="profile-detail-card"><span>البريد الإلكتروني</span><strong>' + escapeHtml(user.email || '-') + '</strong></div>' +
        '<div class="profile-detail-card"><span>اسم الشركة</span><strong>' + escapeHtml(user.companyName || '-') + '</strong></div>' +
        '<div class="profile-detail-card"><span>الموقع</span><strong>' + escapeHtml(user.location || '-') + '</strong></div>';
    if (pendingBox) {
        if (user.pendingUpdate) {
            pendingBox.style.display = 'block';
            pendingBox.innerHTML = '<strong>طلب تعديل قيد المراجعة</strong><p>الاسم: ' + escapeHtml([user.pendingUpdate.firstName || '', user.pendingUpdate.lastName || ''].join(' ').trim() || '-') + '<br>الشركة: ' + escapeHtml(user.pendingUpdate.companyName || '-') + '<br>الموقع: ' + escapeHtml(user.pendingUpdate.location || '-') + '<br>تاريخ الطلب: ' + escapeHtml(formatDateTime(user.pendingUpdate.requestedAt)) + '</p>';
        } else {
            pendingBox.style.display = 'none';
            pendingBox.innerHTML = '';
        }
    }
    populateWholesaleProfileEditForm(user);
}
function normalizeWholesaleLocationsList(user) {
    var source = user && Array.isArray(user.locations) ? user.locations : [];
    var list = [];
    var hasDefault = false;
    var idx;
    for (idx = 0; idx < source.length; idx += 1) {
        var item = source[idx] || {};
        var name = sanitizePlainText(item.name || '', 120);
        var address = sanitizeMultilineText(item.address || '', 300);
        if (!name || !address) continue;
        var isDefault = !!item.isDefault;
        if (isDefault && !hasDefault) hasDefault = true;
        else isDefault = false;
        list.push({ name: name, address: address, isDefault: isDefault });
    }
    if (!list.length && user && user.location) list.push({ name: 'العنوان الرئيسي', address: String(user.location).trim(), isDefault: true });
    if (list.length && !hasDefault) list[0].isDefault = true;
    return list;
}
function renderWholesaleProfileLocations(user) {
    var container = document.getElementById('wholesaleProfileLocationsList');
    var locations = normalizeWholesaleLocationsList(user);
    var idx;
    if (!container) return;
    wholesaleProfileUser.locations = locations;
    if (!locations.length) {
        container.innerHTML = '<div class="profile-empty-state">لا توجد عناوين محفوظة حتى الآن. أضف أول عنوان لتسهيل إتمام الطلب.</div>';
        return;
    }
    container.innerHTML = locations.map(function (location, index) {
        var contactInfo = '';
        if (location.contactName) contactInfo += '<p>👤 ' + escapeHtml(location.contactName) + '</p>';
        if (location.phone) contactInfo += '<p>📞 ' + escapeHtml(location.phone) + '</p>';
        return '<article class="profile-address-card' + (location.isDefault ? ' default' : '') + '"><div class="profile-address-head"><div><h4>' + escapeHtml(location.name) + '</h4>' + contactInfo + '<p>📍 ' + escapeHtml(location.address) + '</p></div>' + (location.isDefault ? '<span class="profile-address-badge">الافتراضي</span>' : '') + '</div><div class="profile-address-actions">' + (location.isDefault ? '' : '<button type="button" class="profile-address-btn" onclick="setWholesaleDefaultLocation(' + index + ')">تعيين كافتراضي</button>') + '<button type="button" class="profile-address-delete" onclick="deleteWholesaleLocation(' + index + ')">حذف العنوان</button></div></article>';
    }).join('');
    var checkbox = document.getElementById('wholesaleLocationDefault');
    if (checkbox) {
        checkbox.checked = false;
        for (idx = 0; idx < locations.length; idx += 1) if (locations[idx].isDefault) break;
    }
}
function saveWholesaleLocations(locations, successMessage) {
    var normalized = normalizeWholesaleLocationsList({ locations: locations, location: wholesaleProfileUser ? wholesaleProfileUser.location : '' });
    var defaultLocation = normalized.filter(function (item) { return item.isDefault; })[0] || normalized[0] || null;
    if (!window.db || !wholesaleProfileUser || !wholesaleProfileUser.id) { setWholesaleProfileMessage('تعذر حفظ العنوان حالياً.', 'error'); return; }
    db.collection('wholesale_users').doc(String(wholesaleProfileUser.id)).set({
        locations: normalized,
        location: defaultLocation ? defaultLocation.address : ''
    }, { merge: true }).then(function () {
        wholesaleProfileUser.locations = normalized;
        wholesaleProfileUser.location = defaultLocation ? defaultLocation.address : '';
        renderWholesaleProfileSummary(wholesaleProfileUser);
        renderWholesaleProfileLocations(wholesaleProfileUser);
        if (successMessage) setWholesaleProfileMessage(successMessage, 'success');
    }).catch(function () {
        setWholesaleProfileMessage('تعذر حفظ العنوان حالياً. حاول مرة أخرى.', 'error');
    });
}
function handleWholesaleLocationSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (!wholesaleProfileUser) { setWholesaleProfileMessage('تعذر إضافة العنوان حالياً.', 'error'); return; }
    var nameNode = document.getElementById('wholesaleLocationName');
    var addressNode = document.getElementById('wholesaleLocationAddress');
    var contactNameNode = document.getElementById('wholesaleLocationContactName');
    var phoneNode = document.getElementById('wholesaleLocationPhone');
    var defaultNode = document.getElementById('wholesaleLocationDefault');
    var name = sanitizePlainText((nameNode || {}).value || '', 120);
    var address = sanitizeMultilineText((addressNode || {}).value || '', 300);
    var contactName = sanitizePlainText((contactNameNode || {}).value || '', 120);
    var phone = sanitizePlainText((phoneNode || {}).value || '', 20);
    var locations = normalizeWholesaleLocationsList(wholesaleProfileUser);
    var shouldDefault = !!(defaultNode && defaultNode.checked);
    var idx;
    if (!name || !address) { setWholesaleProfileMessage('أدخل اسم العنوان والعنوان الكامل أولاً.', 'error'); return; }
    if (!locations.length) shouldDefault = true;
    if (shouldDefault) for (idx = 0; idx < locations.length; idx += 1) locations[idx].isDefault = false;
    locations.push({ name: name, address: address, contactName: contactName, phone: phone, isDefault: shouldDefault });
    saveWholesaleLocations(locations, 'تمت إضافة العنوان بنجاح.');
    if (nameNode) nameNode.value = '';
    if (addressNode) addressNode.value = '';
    if (contactNameNode) contactNameNode.value = '';
    if (phoneNode) phoneNode.value = '';
    if (defaultNode) defaultNode.checked = false;
}
function setWholesaleDefaultLocation(index) {
    var locations = normalizeWholesaleLocationsList(wholesaleProfileUser);
    var idx;
    if (index < 0 || index >= locations.length) return;
    for (idx = 0; idx < locations.length; idx += 1) locations[idx].isDefault = idx === index;
    saveWholesaleLocations(locations, 'تم تحديث العنوان الافتراضي.');
}
function deleteWholesaleLocation(index) {
    var locations = normalizeWholesaleLocationsList(wholesaleProfileUser);
    if (index < 0 || index >= locations.length) return;
    locations.splice(index, 1);
    if (locations.length && !locations.some(function (item) { return item.isDefault; })) locations[0].isDefault = true;
    saveWholesaleLocations(locations, 'تم حذف العنوان بنجاح.');
}

var currentProfileOrderFilter = 'all';

function switchProfileTab(tab, btn) {
    var accountTab = document.getElementById('profileTabAccount');
    var ordersTab = document.getElementById('profileTabOrders');
    var buttons = document.querySelectorAll('.profile-tabs .profile-tab-btn');
    buttons.forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    if (tab === 'account') {
        if (accountTab) accountTab.style.display = '';
        if (ordersTab) ordersTab.style.display = 'none';
    } else {
        if (accountTab) accountTab.style.display = 'none';
        if (ordersTab) ordersTab.style.display = '';
    }
}

function filterProfileOrders(status, btn) {
    currentProfileOrderFilter = status;
    var buttons = document.querySelectorAll('.profile-orders-filters .filter-toggle-btn');
    buttons.forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    var filtered = wholesaleProfileOrders.filter(function(order) {
        if (status === 'all') return true;
        if (status === 'new') return !order.status || order.status === 'new';
        return order.status === status;
    });
    renderWholesaleProfileOrders(filtered);
}

function renderWholesaleProfileOrders(ordersList) {
    var container = document.getElementById('wholesaleProfileOrdersList');
    if (!container) return;
    if (!ordersList.length) {
        container.innerHTML = '<div class="profile-empty-state">لا توجد طلبات جملة مسجلة على هذا الحساب حتى الآن.</div>';
        return;
    }
    container.innerHTML = ordersList.map(function (order) {
        var itemsHtml = (order.items || []).map(function (item) {
            return '<li><strong>' + escapeHtml(item.name || '-') + '</strong><span>' + escapeHtml(item.sizeLabel || '-') + ' • الكمية ' + escapeHtml(item.qty || 1) + '</span></li>';
        }).join('');
        return '<article class="profile-order-card"><div class="profile-order-head"><div><h4>' + escapeHtml(order.id || '-') + '</h4><p>' + escapeHtml(formatDateTime(order.date)) + '</p></div><span class="profile-order-status">' + escapeHtml(getOrderStatusLabel(order.status)) + '</span></div><ul class="profile-order-items">' + itemsHtml + '</ul></article>';
    }).join('');
}
function loadWholesaleProfileOrders(email) {
    if (!window.db || !email) return Promise.resolve([]);
    return db.collection('orders').where('wholesaleEmail', '==', normalizeWholesaleEmail(email)).get().then(function (snapshot) {
        var results = snapshot.docs.map(function (docSnap) {
            var data = docSnap.data() || {};
            data.id = data.id || docSnap.id;
            return data;
        }).sort(function (a, b) {
            return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
        });
        wholesaleProfileOrders = results;
        renderWholesaleProfileOrders(results);
        return results;
    }).catch(function () {
        renderWholesaleProfileOrders([]);
        setWholesaleProfileMessage('تعذر جلب طلباتك حالياً. حاول مرة أخرى بعد قليل.', 'error');
        return [];
    });
}
function loadWholesaleProfilePage() {
    if (!isWholesaleProfilePage()) return;
    var gate = document.getElementById('wholesaleProfileAuthGate');
    var content = document.getElementById('wholesaleProfileContent');
    if (!gate || !content) return;
    if (!wholesaleSession || !wholesaleSession.email) {
        gate.style.display = 'block';
        content.style.display = 'none';
        setWholesaleProfileMessage('سجّل دخولك أولاً حتى تصل إلى حسابك.', 'info');
        return;
    }
    if (!window.db) {
        gate.style.display = 'none';
        content.style.display = 'block';
        setWholesaleProfileMessage('تعذر الاتصال بقاعدة البيانات حالياً.', 'error');
        return;
    }
    gate.style.display = 'none';
    content.style.display = 'block';
    setWholesaleProfileMessage('جاري تحميل بيانات حسابك...', 'info');
    getWholesaleUserDocument().then(function (user) {
        if (!user) {
            clearWholesaleSession();
            renderWholesaleState();
            gate.style.display = 'block';
            content.style.display = 'none';
            setWholesaleProfileMessage('تعذر العثور على حسابك الحالي. سجّل دخولك من جديد.', 'error');
            return null;
        }
        wholesaleProfileUser = user;
        saveWholesaleSession({ email: user.email, firstName: user.firstName, approved: !!user.approved, docId: user.id });
        renderWholesaleState();
        renderWholesaleProfileSummary(user);
        renderWholesaleProfileLocations(user);
        return loadWholesaleProfileOrders(user.email).then(function () { return user; });
    }).then(function (user) {
        if (!user) return;
        setWholesaleProfileMessage('', 'info');
    }).catch(function () {
        setWholesaleProfileMessage('تعذر تحميل بيانات الحساب حالياً. حاول مرة أخرى بعد قليل.', 'error');
    });
}
function handleWholesaleProfileUpdate(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (!window.db || !wholesaleProfileUser || !wholesaleProfileUser.id) { setWholesaleProfileMessage('تعذر حفظ طلب التعديل حالياً.', 'error'); return; }
    var firstName = sanitizePlainText((document.getElementById('wholesaleProfileFirstName') || {}).value || '', 80);
    var lastName = sanitizePlainText((document.getElementById('wholesaleProfileLastName') || {}).value || '', 80);
    var companyName = sanitizePlainText((document.getElementById('wholesaleProfileCompany') || {}).value || '', 140);
    var location = sanitizeMultilineText((document.getElementById('wholesaleProfileLocation') || {}).value || '', 200);
    if (!firstName || !lastName || !companyName || !location) { setWholesaleProfileMessage('أكمل جميع الحقول قبل إرسال طلب التعديل.', 'error'); return; }
    var pendingUpdate = {
        firstName: firstName,
        lastName: lastName,
        location: location,
        companyName: companyName,
        requestedAt: new Date().toISOString()
    };
    db.collection('wholesale_users').doc(String(wholesaleProfileUser.id)).set({ pendingUpdate: pendingUpdate }, { merge: true }).then(function () {
        wholesaleProfileUser.pendingUpdate = pendingUpdate;
        renderWholesaleProfileSummary(wholesaleProfileUser);
        toggleWholesaleProfileEdit(false);
        setWholesaleProfileMessage('تم إرسال طلب التعديل. التحديث يحتاج موافقة الإدارة', 'success');
    }).catch(function () {
        setWholesaleProfileMessage('تعذر إرسال طلب التعديل حالياً. حاول مرة أخرى.', 'error');
    });
}
function handleWholesaleProfilePasswordChange(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (!window.db || !wholesaleProfileUser || !wholesaleProfileUser.id) { setWholesaleProfileMessage('تعذر تحديث كلمة المرور حالياً.', 'error'); return; }
    var currentPassword = (document.getElementById('wholesaleProfileCurrentPassword') || {}).value || '';
    var newPassword = (document.getElementById('wholesaleProfileNewPassword') || {}).value || '';
    var confirmPassword = (document.getElementById('wholesaleProfileConfirmPassword') || {}).value || '';
    if (!currentPassword || !newPassword || !confirmPassword) { setWholesaleProfileMessage('أدخل جميع حقول كلمة المرور أولاً.', 'error'); return; }
    if (newPassword.length < 6) { setWholesaleProfileMessage('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.', 'error'); return; }
    if (newPassword !== confirmPassword) { setWholesaleProfileMessage('تأكيد كلمة المرور غير مطابق.', 'error'); return; }
    hashStringWholesale(currentPassword).then(function (currentHash) {
        if (currentHash !== wholesaleProfileUser.passwordHash) throw new Error('INVALID_CURRENT');
        return hashStringWholesale(newPassword);
    }).then(function (newHash) {
        return db.collection('wholesale_users').doc(String(wholesaleProfileUser.id)).set({ passwordHash: newHash }, { merge: true }).then(function () {
            wholesaleProfileUser.passwordHash = newHash;
        });
    }).then(function () {
        var form = document.getElementById('wholesaleProfilePasswordForm');
        if (form) form.reset();
        setWholesaleProfileMessage('تم تحديث كلمة المرور بنجاح.', 'success');
    }).catch(function (error) {
        if (error && error.message === 'INVALID_CURRENT') setWholesaleProfileMessage('كلمة المرور الحالية غير صحيحة.', 'error');
        else setWholesaleProfileMessage('تعذر تحديث كلمة المرور حالياً. حاول مرة أخرى.', 'error');
    });
}
function initWholesaleProfilePage() {
    if (!isWholesaleProfilePage()) return;
    var editBtn = document.getElementById('wholesaleProfileEditBtn');
    var editCancelBtn = document.getElementById('wholesaleProfileEditCancelBtn');
    var editForm = document.getElementById('wholesaleProfileEditForm');
    var passwordForm = document.getElementById('wholesaleProfilePasswordForm');
    var addressForm = document.getElementById('wholesaleProfileAddressForm');
    if (editBtn) editBtn.addEventListener('click', function () { toggleWholesaleProfileEdit(); });
    if (editCancelBtn) editCancelBtn.addEventListener('click', function () { toggleWholesaleProfileEdit(false); });
    if (editForm) editForm.addEventListener('submit', handleWholesaleProfileUpdate);
    if (passwordForm) passwordForm.addEventListener('submit', handleWholesaleProfilePasswordChange);
    if (addressForm) addressForm.addEventListener('submit', handleWholesaleLocationSubmit);
    loadWholesaleProfilePage();
}
function normalizeSearchTerm(value) { return sanitizePlainText(value || '', 120).toLowerCase(); }
function renderCategoryPage() {
    var category = getQueryParam('type') || (products[0] ? products[0].category : '');
    updateCategoryHeadings(category);
    var list = products.filter(function (product) { return product.category === category && product.quantity !== 0; });
    if (categorySearchValue) list = list.filter(function (product) { return normalizeSearchTerm(product.name).indexOf(categorySearchValue) >= 0 || normalizeSearchTerm(product.description).indexOf(categorySearchValue) >= 0 || normalizeSearchTerm(product.brand).indexOf(categorySearchValue) >= 0; });
    renderProducts(list);
    focusRequestedProduct();
}
function focusRequestedProduct() { var productId = getQueryParam('product'); if (!productId) return; ensureProductRendered(productId); setTimeout(function () { var target = document.getElementById(getProductElementId('productCard-', productId)); if (!target) return; target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 120); }
function renderStorefront() { applySettings(); checkDiscountBanner(); renderWholesaleState(); updateCartBadge(); renderCart(); if (isHomePage()) renderCategoryShowcase(); if (isCategoryPage()) renderCategoryPage(); }
function setupCategorySearch() { var input = document.getElementById('categorySearchInput'); if (!input) return; input.addEventListener('input', function () { if (categorySearchTimer) clearTimeout(categorySearchTimer); categorySearchTimer = setTimeout(function () { categorySearchValue = normalizeSearchTerm(input.value || ''); renderCategoryPage(); }, 300); }); }
function toggleMobileMenu() { var menu = document.getElementById('mobileMenu'); var button = document.querySelector('.mobile-menu-btn'); if (!menu) return; menu.classList.toggle('active'); if (button) button.setAttribute('aria-expanded', menu.classList.contains('active') ? 'true' : 'false'); }
function bindSmoothAnchors() { var anchors = document.querySelectorAll('a[href^="#"]'); var idx; for (idx = 0; idx < anchors.length; idx += 1) anchors[idx].addEventListener('click', function (event) { var href = this.getAttribute('href'); var target = document.querySelector(href); if (!target) return; event.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); var menu = document.getElementById('mobileMenu'); if (menu) menu.classList.remove('active'); }); }
function initRevealObserver() {
    if (!('IntersectionObserver' in window)) { var fallbackNodes = document.querySelectorAll('.reveal'); var fallbackIdx; for (fallbackIdx = 0; fallbackIdx < fallbackNodes.length; fallbackIdx += 1) fallbackNodes[fallbackIdx].classList.add('visible'); return; }
    revealObserver = new IntersectionObserver(function (entries) { entries.forEach(function (entry) { if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); } }); }, { threshold: 0.16 });
    refreshRevealTargets();
}
function refreshRevealTargets() { if (!revealObserver) return; var nodes = document.querySelectorAll('.reveal'); var idx; for (idx = 0; idx < nodes.length; idx += 1) if (!nodes[idx].classList.contains('visible')) revealObserver.observe(nodes[idx]); }
function initScrollUi() {
    var navbar = document.getElementById('navbar'); var scrollTopButton = document.getElementById('scrollTop');
    function update() { if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 36); if (scrollTopButton) scrollTopButton.classList.toggle('visible', window.scrollY > 460); }
    window.addEventListener('scroll', update, { passive: true }); if (scrollTopButton) scrollTopButton.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); }); update();
}
function closeCartIfOpen() {
    var sidebar = document.getElementById('cartSidebar');
    if (sidebar && sidebar.classList.contains('active')) toggleCart();
}
function bindGlobalKeyboardShortcuts() {
    document.addEventListener('keydown', function (event) {
        if (!event || event.key !== 'Escape') return;
        closeWholesaleAuthModal();
        closePDP();
        closeCartIfOpen();
        var menu = document.getElementById('mobileMenu');
        if (menu && menu.classList.contains('active')) toggleMobileMenu();
    });
}
function getOrderStatusLabel(status) { if (status === 'confirmed') return 'تم التأكيد'; if (status === 'processing') return 'قيد التجهيز'; if (status === 'completed') return 'مكتمل'; if (status === 'cancelled') return 'ملغي'; return 'طلب جديد'; }
function renderTrackedOrder(order) {
    var result = document.getElementById('orderTrackingResult'); if (!result) return;
    var itemsHtml = (order.items || []).map(function (item) { return '<div class="tracking-order-item"><div class="tracking-order-item-head"><h5>' + escapeHtml(item.name || '') + '</h5><span>' + escapeHtml(order.wholesale ? 'السعر حسب الاتفاق' : (item.lineTotal != null ? formatCurrency(item.lineTotal) : (order.totalDisplay || 'السعر حسب الاتفاق'))) + '</span></div><span class="tracking-order-details">' + escapeHtml((item.brand || '') + ' • ' + (item.sizeLabel || '') + ' • الكمية ' + (parseInt(item.qty, 10) || 1)) + '</span></div>'; }).join('');
    result.innerHTML = '<div class="tracking-result-card"><div class="tracking-result-head"><div><h4>الطلب ' + escapeHtml(order.id || '') + '</h4><p>' + formatDateTime(order.date) + '</p></div><span class="tracking-status">' + getOrderStatusLabel(order.status) + '</span></div><div class="tracking-order-items">' + itemsHtml + '</div></div>';
}
function trackOrder() {
    var input = document.getElementById('orderTrackingInput'); var result = document.getElementById('orderTrackingResult'); if (!input || !result) return;
    var orderId = sanitizePlainText(input.value || '', 40); if (!orderId) { result.innerHTML = '<div class="order-tracking-message error">أدخل رقم الطلب أولاً.</div>'; return; }
    if (!/^[A-Za-z0-9-]+$/.test(orderId)) { result.innerHTML = '<div class="order-tracking-message error">رقم الطلب غير صالح.</div>'; return; }
    if (!window.db) { result.innerHTML = '<div class="order-tracking-message error">تعذر الاتصال بقاعدة البيانات حالياً.</div>'; return; }
    result.innerHTML = '<div class="order-tracking-message">جاري البحث عن الطلب...</div>';
    db.collection('orders').doc(orderId).get().then(function (docSnap) { if (!docSnap.exists) { result.innerHTML = '<div class="order-tracking-message error">لم يتم العثور على طلب بهذا الرقم.</div>'; return; } var data = docSnap.data() || {}; data.id = docSnap.id; renderTrackedOrder(data); }).catch(function () { result.innerHTML = '<div class="order-tracking-message error">تعذر جلب بيانات الطلب حالياً.</div>'; });
}
document.addEventListener('DOMContentLoaded', function () {
    initWholesaleAuth();
    bindSmoothAnchors();
    bindGlobalKeyboardShortcuts();
    initRevealObserver();
    initScrollUi();
    setupCategorySearch();
    initWholesaleProfilePage();
    loadStore();
    restoreWholesaleSession().then(function () { syncModeFromUrl(); renderWholesaleState(); if (isWholesaleProfilePage()) loadWholesaleProfilePage(); });
});
window.addEventListener('beforeunload', cleanupSubscriptions);
