var FALLBACK_IMAGE = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27400%27 height=%27400%27 viewBox=%270 0 400 400%27%3E%3Crect width=%27400%27 height=%27400%27 fill=%27%23f97316%27/%3E%3Ctext x=%27200%27 y=%27200%27 font-family=%27Arial%27 font-size=%2748%27 fill=%27%23fff%27 text-anchor=%27middle%27 dy=%27.3em%27%3EAMK%3C/text%3E%3C/svg%3E";
var CATEGORY_META = {
    'فصاليات': { icon: '🪛', subtitle: 'فصاليات ثابتة ومفصلات للأبواب والخزائن.' },
    'لوازم ابواب': { icon: '🚪', subtitle: 'أقفال وماسكات وإكسسوارات أساسية للأبواب.' },
    'ايدين ابواب': { icon: '🖐️', subtitle: 'أيدين أبواب بمقاسات وتشطيبات متعددة.' },
    'براغي': { icon: '🔩', subtitle: 'براغي بأطوال مختلفة لمهام التثبيت اليومية.' },
    'سحابات': { icon: '🧰', subtitle: 'سحابات أدراج ناعمة وتحميلات متنوعة.' },
    'أقمشة': { icon: '🧵', subtitle: 'أقمشة تنجيد للمشاريع المنزلية والتجارية.' }
};
var CATEGORY_ORDER = ['فصاليات', 'لوازم ابواب', 'ايدين ابواب', 'براغي', 'سحابات', 'أقمشة'];

var API_BASE = 'https://makka-api.alsadiayham.workers.dev';

function hashString(str) {
    var encoder = new TextEncoder();
    return crypto.subtle.digest('SHA-256', encoder.encode(str)).then(function (buffer) {
        return Array.from(new Uint8Array(buffer)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
}

var products = [];
var discounts = [];
var orders = [];
var wholesaleUsers = [];
var siteSettings = normalizeSettings(DEFAULT_SITE_SETTINGS);
var unsubscribers = [];
var charts = {};
var isInitializing = false;
var currentProductCategory = '';
var currentOrderTypeFilter = 'all';
var currentOrderModalOrderId = '';
var currentOrderPricingState = null;

var adminReady = {
    products: false,
    discounts: false,
    orders: false,
    settings: false,
    wholesaleUsers: false
};

var ADMIN_SESSION_STATE_KEY = 'makka_admin_state';
var ADMIN_SESSION_MAX_AGE = 4 * 60 * 60 * 1000;
var adminSessionValidationTimer = null;
var fallbackAdminAuthenticated = false;

function showAdminLogin(message) {
    var loginScreen = document.getElementById('loginScreen');
    var adminPanel = document.getElementById('adminPanel');
    var loginError = document.getElementById('loginError');
    if (adminSessionValidationTimer) clearInterval(adminSessionValidationTimer);
    fallbackAdminAuthenticated = false;
    unsubscribers.forEach(function (unsubscribe) { if (typeof unsubscribe === 'function') unsubscribe(); });
    unsubscribers = [];
    if (loginScreen) loginScreen.style.display = 'flex';
    if (adminPanel) adminPanel.style.display = 'none';
    if (loginError) loginError.textContent = message || '';
}

function showAdminPanel() {
    var loginScreen = document.getElementById('loginScreen');
    var adminPanel = document.getElementById('adminPanel');
    if (loginScreen) loginScreen.style.display = 'none';
    if (adminPanel) adminPanel.style.display = 'block';
}

function clearAdminSessionState() {
    sessionStorage.removeItem('makka_admin');
    sessionStorage.removeItem('makka_admin_version');
    sessionStorage.removeItem(ADMIN_SESSION_STATE_KEY);
}

function saveAdminSessionState(token, version, username) {
    var state = {
        token: String(token || ''),
        version: String(version || '1'),
        username: sanitizePlainText(username || '', 120),
        issuedAt: Date.now()
    };
    sessionStorage.setItem('makka_admin', state.token);
    sessionStorage.setItem('makka_admin_version', state.version);
    sessionStorage.setItem(ADMIN_SESSION_STATE_KEY, JSON.stringify(state));
}

function readAdminSessionState() {
    try {
        var parsed = JSON.parse(sessionStorage.getItem(ADMIN_SESSION_STATE_KEY) || 'null');
        if (parsed && parsed.token && parsed.version) return parsed;
    } catch (error) {}
    var token = sessionStorage.getItem('makka_admin');
    var version = sessionStorage.getItem('makka_admin_version');
    if (!token || !version) return null;
    return { token: token, version: String(version), username: '', issuedAt: Date.now() };
}

function isAdminSessionExpired(state) {
    return !state || !state.token || !state.version || !state.issuedAt || ((Date.now() - Number(state.issuedAt || 0)) > ADMIN_SESSION_MAX_AGE);
}

function validateAdminSession() {
    var state = readAdminSessionState();
    var adminPanel = document.getElementById('adminPanel');
    if (isAdminSessionExpired(state)) {
        clearAdminSessionState();
        showAdminLogin('انتهت الجلسة. سجّل الدخول من جديد.');
        return;
    }
    if (!window.adminRef) {
        clearAdminSessionState();
        showAdminLogin('تعذر التحقق من صلاحية الجلسة.');
        return;
    }
    adminRef.get().then(function (docSnap) {
        if (!docSnap.exists) {
            clearAdminSessionState();
            showAdminLogin('تعذر العثور على بيانات دخول الإدارة.');
            return;
        }
        var creds = docSnap.data() || {};
        var dbVersion = String(creds.sessionVersion || '1');
        if (state.version !== dbVersion) {
            clearAdminSessionState();
            showAdminLogin('تم إنهاء الجلسة الحالية. سجّل الدخول مرة أخرى.');
            return;
        }
        if (state.username && creds.username && state.username !== creds.username) {
            clearAdminSessionState();
            showAdminLogin('الجلسة الحالية لم تعد صالحة.');
            return;
        }
        showAdminPanel();
        if (!adminPanel || adminPanel.style.display !== 'block' || !unsubscribers.length) initializeAdmin();
        startAdminSessionValidation();
    }).catch(function () {
        clearAdminSessionState();
        showAdminLogin('تعذر التحقق من الجلسة الحالية. أعد تسجيل الدخول.');
    });
}

function startAdminSessionValidation() {
    if (adminSessionValidationTimer) clearInterval(adminSessionValidationTimer);
    adminSessionValidationTimer = setInterval(function () {
        if (readAdminSessionState()) validateAdminSession();
    }, 5 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', function () {
    if (readAdminSessionState()) validateAdminSession();
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && readAdminSessionState()) validateAdminSession();
    });
});

function setAdminLoading(loading) {
    var loader = document.getElementById('adminLoading');
    if (loader) loader.style.display = loading ? 'block' : 'none';
}

var _statusTimeout = null;
function setAdminStatus(message, type) {
    var status = document.getElementById('adminStatus');
    if (!status) return;
    if (_statusTimeout) clearTimeout(_statusTimeout);
    status.classList.remove('hidden');
    status.textContent = message;
    status.className = 'admin-status' + (type ? ' ' + type : '');
    if (type === 'success') {
        _statusTimeout = setTimeout(function () {
            status.style.opacity = '0';
            setTimeout(function () {
                status.textContent = '';
                status.className = 'admin-status hidden';
                status.style.opacity = '';
            }, 500);
        }, 5000);
    }
}
function getAdminDeleteFieldValue() {
    return window.firebase && firebase.firestore && firebase.firestore.FieldValue ? firebase.firestore.FieldValue.delete() : null;
}

function handleLogin(event) {
    event.preventDefault();
    var user = sanitizePlainText(document.getElementById('loginUser').value, 120);
    var pass = document.getElementById('loginPass').value;
    var errorEl = document.getElementById('loginError');
    errorEl.textContent = '';

    // Try Worker API first (secure, rate-limited)
    fetch(API_BASE + '/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
    }).then(function (res) {
        return res.json().then(function (data) { data._status = res.status; return data; });
    }).then(function (data) {
        if (data._status === 429) {
            errorEl.textContent = 'تم تجاوز عدد المحاولات. حاول بعد 15 دقيقة.';
            return;
        }
        if (data.success && data.token) {
            var dbVersion = String(data.sessionVersion || '1');
            saveAdminSessionState(data.token, dbVersion, user);
            showAdminPanel();
            initializeAdmin();
            startAdminSessionValidation();
        } else {
            errorEl.textContent = data.error || 'اسم المستخدم أو كلمة المرور غير صحيحة';
        }
    }).catch(function () {
        // Fallback to direct Firestore if Worker is unreachable
        if (!window.adminRef) {
            errorEl.textContent = 'تعذر الاتصال بالخادم';
            return;
        }
        adminRef.get().then(function (docSnap) {
            if (!docSnap.exists) {
                errorEl.textContent = 'لم يتم تهيئة بيانات الدخول';
                return;
            }
            var creds = docSnap.data();
            hashString(pass).then(function (passHash) {
                if (user === creds.username && passHash === creds.passwordHash) {
                    fallbackAdminAuthenticated = true;
                    clearAdminSessionState();
                    showAdminPanel();
                    initializeAdmin();
                    setAdminStatus('تم تسجيل الدخول عبر الوضع الاحتياطي. ستنتهي الجلسة عند تحديث الصفحة.', 'warning');
                } else {
                    errorEl.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة';
                }
            });
        }).catch(function () {
            errorEl.textContent = 'حدث خطأ أثناء التحقق من البيانات';
        });
    });
}

function logout() {
    clearAdminSessionState();
    if (adminSessionValidationTimer) clearInterval(adminSessionValidationTimer);
    unsubscribers.forEach(function (unsubscribe) { if (typeof unsubscribe === 'function') unsubscribe(); });
    location.reload();
}

function killAllSessions() {
    if (!confirm('سيتم تسجيل خروج جميع المستخدمين بما فيهم أنت. متأكد؟')) return;
    adminRef.get().then(function (docSnap) {
        var creds = docSnap.exists ? docSnap.data() : {};
        var currentVersion = Number(creds.sessionVersion || 1);
        return adminRef.update({ sessionVersion: currentVersion + 1 });
    }).then(function () {
        setAdminStatus('تم إنهاء جميع الجلسات', 'success');
        setTimeout(function () { logout(); }, 1500);
    }).catch(function () {
        setAdminStatus('لإنهاء الجلسات، غيّر قيمة sessionVersion من Firebase Console', 'error');
    });
}

function switchTab(tab, button) {
    document.querySelectorAll('.tab-content').forEach(function (content) { content.classList.remove('active'); });
    document.querySelectorAll('.tab-btn').forEach(function (tabButton) { tabButton.classList.remove('active'); });
    document.getElementById('tab-' + tab).classList.add('active');
    if (button) button.classList.add('active');
    if (tab === 'dashboard') renderDashboard();
    if (tab === 'products') renderProductsView();
    if (tab === 'orders') renderOrdersTable();
    if (tab === 'wholesale-users') renderWholesaleUsersTable();
    if (tab === 'wholesale') renderWholesalePricesForm();
}

async function initializeAdmin() {
    if (isInitializing) return;
    isInitializing = true;
    setAdminLoading(true);
    setAdminStatus('جاري مزامنة فايرستور...', '');

    if (!window.db) {
        setAdminLoading(false);
        setAdminStatus('تعذر تهيئة فايربيس. تأكدي من الاتصال بالإنترنت.', 'error');
        isInitializing = false;
        return;
    }

    try {
        await ensureSeedIfEmpty();
        subscribeToCollections();
    } catch (error) {
        reportClientError(error);
        setAdminStatus('حدث خطأ أثناء تحميل البيانات.', 'error');
        setAdminLoading(false);
    }

    isInitializing = false;
}

async function ensureSeedIfEmpty() {
    var snapshot = await db.collection('products').limit(1).get();
    if (snapshot.empty) {
        setAdminStatus('المتجر فارغ، جاري تنفيذ Seed Data تلقائياً...', 'warning');
        await seedFirestoreData(false);
    }
}

function subscribeToCollections() {
    unsubscribers.forEach(function (unsubscribe) { if (typeof unsubscribe === 'function') unsubscribe(); });
    unsubscribers = [];

    unsubscribers.push(db.collection('products').onSnapshot(function (snapshot) {
        products = snapshot.docs.map(function (docSnap) { var d = docSnap.data(); d.id = docSnap.id; return normalizeProduct(d); });
        adminReady.products = true;
        updateLowStockBadge();
        renderProductsView();
        renderDiscountValueOptions();
        checkAdminReady();
    }, function (error) {
        reportClientError(error);
        setAdminStatus('تعذر تحميل المنتجات.', 'error');
        setAdminLoading(false);
    }));

    unsubscribers.push(db.collection('discounts').onSnapshot(function (snapshot) {
        discounts = snapshot.docs.map(function (docSnap) { return normalizeDiscount(docSnap.data()); });
        adminReady.discounts = true;
        renderDiscountsTable();
        checkAdminReady();
    }, function (error) {
        reportClientError(error);
        setAdminStatus('تعذر تحميل الخصومات.', 'error');
        setAdminLoading(false);
    }));

    unsubscribers.push(db.collection('orders').orderBy('date', 'desc').onSnapshot(function (snapshot) {
        orders = snapshot.docs.map(function (docSnap) {
            var data = docSnap.data();
            data._docId = docSnap.id;
            return data;
        });
        adminReady.orders = true;
        renderOrdersTable();
        renderDashboard();
        updateNewOrdersBadge();
        checkAdminReady();
    }, function (error) {
        reportClientError(error);
        setAdminStatus('تعذر تحميل الطلبات.', 'error');
        setAdminLoading(false);
    }));

    unsubscribers.push(db.collection('settings').doc('config').onSnapshot(function (docSnap) {
        siteSettings = normalizeSettings(docSnap.exists ? docSnap.data() : DEFAULT_SITE_SETTINGS);
        adminReady.settings = true;
        loadSettingsForm();
        checkAdminReady();
    }, function (error) {
        reportClientError(error);
        setAdminStatus('تعذر تحميل الإعدادات.', 'error');
        setAdminLoading(false);
    }));

    unsubscribers.push(db.collection('wholesale_users').onSnapshot(function (snapshot) {
        wholesaleUsers = snapshot.docs.map(function (docSnap) {
            var data = docSnap.data() || {};
            data.id = docSnap.id;
            return data;
        }).sort(function (a, b) {
            if (!!a.approved !== !!b.approved) return a.approved ? 1 : -1;
            return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        });
        adminReady.wholesaleUsers = true;
        renderWholesaleUsersTable();
        updateWholesaleRequestsBadge();
        checkAdminReady();
    }, function (error) {
        reportClientError(error);
        setAdminStatus('تعذر تحميل حسابات الجملة.', 'error');
        setAdminLoading(false);
    }));
}

function checkAdminReady() {
    if (adminReady.products && adminReady.discounts && adminReady.orders && adminReady.settings && adminReady.wholesaleUsers) {
        setAdminLoading(false);
        setAdminStatus('تمت مزامنة البيانات بنجاح.', 'success');
    }
}

function getAdminCategories() {
    var seen = {};
    var categories = [];
    var idx;
    for (idx = 0; idx < CATEGORY_ORDER.length; idx += 1) {
        seen[CATEGORY_ORDER[idx]] = true;
        categories.push(CATEGORY_ORDER[idx]);
    }
    products.forEach(function (product) {
        var category = String(product.category || '').trim();
        if (category && !seen[category]) {
            seen[category] = true;
            categories.push(category);
        }
    });
    return categories;
}

function getCategoryMeta(category) {
    return CATEGORY_META[category] || { icon: '📦', subtitle: 'عرض جميع منتجات هذا القسم وإدارتها بسهولة.' };
}

function getCategoryProducts(category) {
    return products.filter(function (product) {
        return String(product.category || '') === String(category || '');
    }).sort(function (a, b) {
        if ((a.order || 0) !== (b.order || 0)) return (a.order || 0) - (b.order || 0);
        return String(a.id || '').localeCompare(String(b.id || ''));
    });
}

function showProductsCategory(category) {
    currentProductCategory = category || '';
    renderProductsView();
}

function showProductsCategoryGrid() {
    currentProductCategory = '';
    var input = document.getElementById('productsExcelInput');
    if (input) input.value = '';
    renderProductsView();
}

function renderCategoryCards() {
    var container = document.getElementById('productsCategoryGrid');
    if (!container) return;
    var categories = getAdminCategories();
    if (!categories.length) {
        container.innerHTML = '<div class="empty-state">لا توجد أقسام متاحة حالياً.</div>';
        return;
    }
    container.innerHTML = categories.map(function (category) {
        var categoryProducts = getCategoryProducts(category);
        var meta = getCategoryMeta(category);
        return '<button type="button" class="admin-category-card" data-category="' + escapeHtml(category) + '" onclick="showProductsCategory(this.getAttribute(\'data-category\'))"><div class="admin-category-card-body"><div class="admin-category-card-top"><div><h4>' + escapeHtml(category) + '</h4><p>' + escapeHtml(meta.subtitle) + '</p></div><span class="admin-category-icon">' + meta.icon + '</span></div><span class="admin-category-count">' + categoryProducts.length + ' منتج</span></div></button>';
    }).join('');
}

function renderProductsView() {
    var grid = document.getElementById('productsCategoryGrid');
    var tableView = document.getElementById('productsCategoryTableView');
    var backBtn = document.getElementById('productsBackBtn');
    var downloadBtn = document.getElementById('downloadExcelBtn');
    var uploadBtn = document.getElementById('uploadExcelBtn');
    var templateBtn = document.getElementById('downloadTemplateBtn');
    var bulkBar = document.getElementById('bulkActionsBar');
    var title = document.getElementById('productsCategoryTitle');
    var count = document.getElementById('productsCategoryCount');
    if (!grid || !tableView) return;

    if (!currentProductCategory) {
        grid.style.display = 'grid';
        tableView.style.display = 'none';
        if (bulkBar) bulkBar.style.display = 'none';
        if (backBtn) backBtn.style.display = 'none';
        if (downloadBtn) downloadBtn.style.display = 'none';
        if (uploadBtn) uploadBtn.style.display = 'none';
        if (templateBtn) templateBtn.style.display = 'none';
        renderCategoryCards();
        return;
    }

    grid.style.display = 'none';
    tableView.style.display = 'block';
    if (backBtn) backBtn.style.display = 'inline-flex';
    if (downloadBtn) downloadBtn.style.display = 'inline-flex';
    if (uploadBtn) uploadBtn.style.display = 'inline-flex';
    if (templateBtn) templateBtn.style.display = 'inline-flex';
    if (title) title.textContent = currentProductCategory;
    if (count) count.textContent = getCategoryProducts(currentProductCategory).length + ' منتج';
    renderProductsTable();
}

function renderProductsTable() {
    var tbody = document.getElementById('productsTableBody');
    var statusLabels = { normal: 'عادي', bestseller: 'الأكثر مبيعاً', special: 'مميز', soldout: 'نفذت الكمية' };
    var filteredProducts = currentProductCategory ? getCategoryProducts(currentProductCategory) : products.slice();
    var selectAll = document.getElementById('selectAllProducts');
    if (selectAll) selectAll.checked = false;
    if (!filteredProducts.length) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty-state">لا توجد منتجات حالياً.</td></tr>';
        updateBulkBar();
        return;
    }

    tbody.innerHTML = filteredProducts.map(function (product) {
        return '<tr><td><input type="checkbox" class="product-select" value="' + escapeHtml(product.id) + '" onchange="updateBulkBar()"></td><td><img src="' + escapeHtml(product.image || FALLBACK_IMAGE) + '" alt="' + escapeHtml(product.name) + '" loading="lazy" onerror="this.src=\'' + FALLBACK_IMAGE + '\'"></td><td>' + escapeHtml(product.name) + '</td><td>' + escapeHtml(product.brand) + '</td><td>' + escapeHtml(product.category) + '</td><td>' + formatSizes(product) + '</td><td>' + formatPrices(product) + '</td><td>' + (product.discount ? product.discount + '%' : '-') + '</td><td>' + formatProductQuantity(product) + '</td><td><span class="status-tag ' + (product.status || 'normal') + '">' + statusLabels[product.status || 'normal'] + '</span></td><td class="actions"><button class="btn-edit" data-id="' + escapeHtml(product.id) + '" onclick="editProduct(this.getAttribute(\'data-id\'))">تعديل</button><button class="btn-delete" data-id="' + escapeHtml(product.id) + '" onclick="deleteProduct(this.getAttribute(\'data-id\'))">حذف</button></td></tr>';
    }).join('');
    updateBulkBar();
}

function formatProductQuantity(product) {
    if (product.quantity === 0) return '<span style="color:#dc2626;font-weight:700;">نفذت</span>';
    if (typeof product.quantity === 'number' && product.quantity > 0 && product.quantity < 20) return '<span style="color:#dc2626;font-weight:700;">' + product.quantity + '</span>';
    if (typeof product.quantity === 'number') return String(product.quantity);
    return 'غير محدودة';
}

function updateLowStockBadge() {
    var badge = document.getElementById('lowStockBadge');
    var count = products.filter(function (product) {
        return typeof product.quantity === 'number' && product.quantity > 0 && product.quantity < 20;
    }).length;
    if (!badge) return;
    if (count > 0) {
        badge.style.display = 'inline-flex';
        badge.textContent = String(count);
    } else {
        badge.style.display = 'none';
        badge.textContent = '0';
    }
}

function getSelectedProductIds() {
    var checkboxes = document.querySelectorAll('.product-select:checked');
    var ids = [];
    for (var i = 0; i < checkboxes.length; i++) {
        ids.push(checkboxes[i].value);
    }
    return ids;
}

function toggleSelectAll(masterCheckbox) {
    var checkboxes = document.querySelectorAll('.product-select');
    for (var i = 0; i < checkboxes.length; i++) {
        checkboxes[i].checked = masterCheckbox.checked;
    }
    updateBulkBar();
}

function updateBulkBar() {
    var selected = getSelectedProductIds();
    var bar = document.getElementById('bulkActionsBar');
    var count = document.getElementById('bulkSelectedCount');
    if (!currentProductCategory) {
        bar.style.display = 'none';
        return;
    }
    if (selected.length > 0) {
        bar.style.display = 'flex';
        count.textContent = selected.length;
    } else {
        bar.style.display = 'none';
    }
}

async function bulkChangeStatus() {
    var ids = getSelectedProductIds();
    var status = document.getElementById('bulkStatusSelect').value;
    if (!ids.length || !status) return;
    var batch = db.batch();
    ids.forEach(function (id) {
        batch.update(db.collection('products').doc(String(id)), { status: status });
    });
    await batch.commit();
    document.getElementById('bulkStatusSelect').value = '';
}

async function bulkApplyDiscount() {
    var ids = getSelectedProductIds();
    var discount = parseInt(document.getElementById('bulkDiscountInput').value, 10);
    if (!ids.length || isNaN(discount) || discount < 0 || discount > 99) return;
    var batch = db.batch();
    ids.forEach(function (id) {
        batch.update(db.collection('products').doc(String(id)), { discount: discount });
    });
    await batch.commit();
    document.getElementById('bulkDiscountInput').value = '';
}

async function bulkDeleteProducts() {
    var ids = getSelectedProductIds();
    if (!ids.length) return;
    if (!confirm('هل تريد حذف ' + ids.length + ' منتج؟')) return;
    var batch = db.batch();
    ids.forEach(function (id) {
        batch.delete(db.collection('products').doc(String(id)));
    });
    await batch.commit();
    var selectAll = document.getElementById('selectAllProducts');
    if (selectAll) selectAll.checked = false;
}

function formatSizes(product) {
    return product.sizes.map(function (size) { return getSizeLabel(size); }).join(' / ');
}

function formatPrices(product) {
    var prices = product.sizes.map(function (size) { return size.price; });
    if (!prices.length) return '-';
    if (prices.length === 1) return formatCurrency(prices[0]);
    return formatCurrency(Math.min.apply(null, prices)) + ' - ' + formatCurrency(Math.max.apply(null, prices));
}

function createEmptySize() { return { size: '1', unit: 'حبة', price: '' }; }

function addSizeRow(sizeData) {
    var safeSize = sizeData || createEmptySize();
    var container = document.getElementById('sizesContainer');
    var row = document.createElement('div');
    row.className = 'size-row';
    row.innerHTML = '<input type="text" class="size-value" placeholder="الحجم أو النوع" value="' + escapeHtml(sanitizePlainText(safeSize.size, 80)) + '"><select class="size-unit"><option value="انش" ' + (safeSize.unit === 'انش' ? 'selected' : '') + '>انش</option><option value="سم" ' + (safeSize.unit === 'سم' ? 'selected' : '') + '>سم</option><option value="متر" ' + (safeSize.unit === 'متر' ? 'selected' : '') + '>متر</option><option value="مم" ' + (safeSize.unit === 'مم' ? 'selected' : '') + '>مم</option><option value="حبة" ' + (safeSize.unit === 'حبة' ? 'selected' : '') + '>حبة</option><option value="علبة" ' + (safeSize.unit === 'علبة' ? 'selected' : '') + '>علبة</option></select><input type="number" class="size-price" min="0" placeholder="السعر ₪" value="' + escapeHtml(String(Number(safeSize.price) || 0)) + '"><button type="button" class="btn-remove-size" onclick="removeSizeRow(this)">حذف</button>';
    container.appendChild(row);
}

function removeSizeRow(button) {
    var container = document.getElementById('sizesContainer');
    if (container.children.length === 1) return;
    button.closest('.size-row').remove();
}

function renderSizeRows(sizes) {
    var container = document.getElementById('sizesContainer');
    container.innerHTML = '';
    (sizes && sizes.length ? sizes : [createEmptySize()]).forEach(function (size) { addSizeRow(size); });
}

function openProductModal(product) {
    document.getElementById('productModalTitle').textContent = product ? 'تعديل المنتج' : 'إضافة منتج جديد';
    document.getElementById('productId').value = product ? product.id : '';
    document.getElementById('productName').value = product ? product.name : '';
    document.getElementById('productBrand').value = product ? product.brand : '';
    document.getElementById('productCategory').value = product ? product.category : (currentProductCategory || '');
    document.getElementById('productDiscount').value = product ? product.discount : 0;
    document.getElementById('productQuantity').value = product ? (product.quantity || 0) : 0;
    document.getElementById('productImage').value = product ? product.image : '';
    document.getElementById('productImageFile').value = '';
    document.getElementById('imagePreview').innerHTML = product && product.image ? '<img src="' + escapeHtml(product.image) + '" loading="lazy" onerror="this.style.display=\'none\'">' : '';
    document.getElementById('productDescription').value = product ? product.description : '';
    document.getElementById('productStatus').value = product ? product.status : 'normal';
    renderSizeRows(product ? product.sizes : [createEmptySize()]);
    document.getElementById('brandsList').innerHTML = Array.from(new Set(products.map(function (entry) { return entry.brand; }))).map(function (brand) { return '<option value="' + escapeHtml(brand) + '">'; }).join('');
    document.getElementById('categoriesList').innerHTML = getAdminCategories().map(function (category) { return '<option value="' + escapeHtml(category) + '">'; }).join('');
    document.getElementById('productModal').style.display = 'flex';
}

function editProduct(id) {
    var product = products.find(function (entry) { return entry.id === id; });
    if (product) openProductModal(product);
}

function collectSizes() {
    return Array.from(document.querySelectorAll('#sizesContainer .size-row')).map(function (row) {
        return {
            size: sanitizePlainText(row.querySelector('.size-value').value, 80),
            unit: row.querySelector('.size-unit').value,
            price: parseFloat(row.querySelector('.size-price').value || '0')
        };
    }).filter(function (size) { return size.size && size.price > 0; });
}

async function saveProduct(event) {
    event.preventDefault();
    var id = document.getElementById('productId').value;
    var sizes = collectSizes();
    var existingProduct = products.find(function (entry) { return entry.id === id; });
    if (!sizes.length) return alert('أضيفي حجماً واحداً على الأقل مع السعر.');

    var nextId = id ? id : 'product_' + Date.now();

    // Handle image upload
    var imageUrl = sanitizeUrl(document.getElementById('productImage').value);
    var fileInput = document.getElementById('productImageFile');
    if (fileInput.files && fileInput.files[0]) {
        setAdminLoading(true);
        setAdminStatus('جاري رفع الصورة...', 'info');
        imageUrl = await uploadProductImage(fileInput.files[0], nextId);
    }

    var productData = normalizeProduct({
        id: nextId,
        name: sanitizePlainText(document.getElementById('productName').value, 160),
        brand: sanitizePlainText(document.getElementById('productBrand').value, 120),
        category: sanitizePlainText(document.getElementById('productCategory').value, 120),
        description: sanitizeMultilineText(document.getElementById('productDescription').value, 800),
        sizes: sizes,
        discount: parseInt(document.getElementById('productDiscount').value || '0', 10) || 0,
        quantity: parseInt(document.getElementById('productQuantity').value || '0', 10) || 0,
        image: imageUrl,
        status: document.getElementById('productStatus').value,
        createdAt: existingProduct && existingProduct.createdAt ? existingProduct.createdAt : new Date().toISOString(),
        order: existingProduct ? Number(existingProduct.order) || 0 : products.length + 1
    });

    setAdminLoading(true);
    await db.collection('products').doc(String(productData.id)).set(productData, { merge: false });
    setAdminLoading(false);
    closeModal('productModal');
    setAdminStatus('تم حفظ المنتج بنجاح.', 'success');
}

async function deleteProduct(id) {
    if (!confirm('هل أنتِ متأكدة من حذف هذا المنتج؟')) return;
    setAdminLoading(true);
    await db.collection('products').doc(String(id)).delete();
    setAdminLoading(false);
    setAdminStatus('تم حذف المنتج.', 'success');
}

function getExcelStatusValue(status) {
    return status === 'normal' ? 'available' : (status || 'available');
}

function normalizeImportedStatus(status) {
    var value = String(status || '').trim().toLowerCase();
    if (!value || value === 'available' || value === 'normal' || value === 'عادي') return 'normal';
    if (value === 'bestseller' || value === 'الأكثر مبيعاً') return 'bestseller';
    if (value === 'special' || value === 'مميز') return 'special';
    if (value === 'soldout' || value === 'نفذت الكمية') return 'soldout';
    return 'normal';
}

function parseImportedSizesCell(value) {
    if (Array.isArray(value)) {
        return value.map(function (entry, index) {
            return normalizeSizeEntry(entry, entry && entry.price, index);
        });
    }
    var text = String(value == null ? '' : value).trim();
    if (!text) return [];
    try {
        var parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            return parsed.map(function (entry, index) {
                return normalizeSizeEntry(entry, entry && entry.price, index);
            });
        }
        if (parsed && typeof parsed === 'object') {
            return [normalizeSizeEntry(parsed, parsed.price, 0)];
        }
    } catch (error) {}
    return [{
        size: text,
        unit: '',
        price: 0
    }];
}

function buildProductsWorksheetRows(items) {
    return items.map(function (product) {
        return {
            'الاسم': product.name || '',
            'العلامة': product.brand || '',
            'القسم': product.category || '',
            'الوصف': product.description || '',
            'رابط الصورة': product.image || '',
            'الحالة': getExcelStatusValue(product.status),
            'المقاسات': JSON.stringify(product.sizes || []),
            'الكمية': product.quantity || 0
        };
    });
}

function downloadCategoryExcel() {
    if (!currentProductCategory) return;
    if (!window.XLSX) {
        alert('تعذر تحميل مكتبة Excel.');
        return;
    }
    var workbook = XLSX.utils.book_new();
    var categoryProducts = getCategoryProducts(currentProductCategory);
    var worksheet = XLSX.utils.json_to_sheet(buildProductsWorksheetRows(categoryProducts), {
        header: ['الاسم', 'العلامة', 'القسم', 'الوصف', 'رابط الصورة', 'الحالة', 'المقاسات', 'الكمية']
    });
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    XLSX.writeFile(workbook, 'منتجات_' + currentProductCategory + '.xlsx');
}

function downloadEmptyProductsTemplate() {
    if (!window.XLSX) {
        alert('تعذر تحميل مكتبة Excel.');
        return;
    }
    var workbook = XLSX.utils.book_new();
    var worksheet = XLSX.utils.json_to_sheet([], {
        header: ['الاسم', 'العلامة', 'القسم', 'الوصف', 'رابط الصورة', 'الحالة', 'المقاسات', 'الكمية']
    });
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, 'نموذج_منتجات_' + (currentProductCategory || 'فارغ') + '.xlsx');
}

function normalizeImportedProductName(name) {
    return String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

async function importProductsRows(rows) {
    var batch = db.batch();
    var batchCount = 0;
    var created = 0;
    var updated = 0;
    var maxOrder = products.reduce(function (maxValue, product) {
        return Math.max(maxValue, Number(product.order) || 0);
    }, 0);
    var existingByName = {};
    products.forEach(function (product) {
        var normalizedName = normalizeImportedProductName(product.name);
        if (normalizedName && !existingByName[normalizedName]) existingByName[normalizedName] = product;
    });
    var index;
    for (index = 0; index < rows.length; index += 1) {
        var row = rows[index];
        var productName = String(row['الاسم'] || '').trim();
        var normalizedProductName = normalizeImportedProductName(productName);
        var existingProduct = normalizedProductName ? existingByName[normalizedProductName] : null;
        var parsedSizes = parseImportedSizesCell(row['المقاسات']);
        var productData = normalizeProduct({
            id: existingProduct ? existingProduct.id : db.collection('products').doc().id,
            name: productName,
            brand: String(row['العلامة'] || '').trim(),
            category: String(row['القسم'] || currentProductCategory || '').trim(),
            description: String(row['الوصف'] || '').trim(),
            image: String(row['رابط الصورة'] || '').trim(),
            status: normalizeImportedStatus(row['الحالة']),
            sizes: parsedSizes,
            quantity: parseInt(row['الكمية'] || '0', 10) || 0,
            createdAt: existingProduct && existingProduct.createdAt ? existingProduct.createdAt : new Date().toISOString(),
            order: existingProduct ? Number(existingProduct.order) || 0 : maxOrder + created + 1
        });
        if (!productName) continue;
        if (existingProduct) {
            delete productData.id;
            delete productData.createdAt;
            delete productData.order;
            batch.set(db.collection('products').doc(String(existingProduct.id)), productData, { merge: true });
            existingByName[normalizedProductName] = normalizeProduct({
                id: existingProduct.id,
                name: productData.name,
                brand: productData.brand,
                category: productData.category,
                description: productData.description,
                sizes: productData.sizes,
                discount: productData.discount,
                quantity: productData.quantity,
                image: productData.image,
                status: productData.status,
                createdAt: existingProduct.createdAt,
                order: existingProduct.order
            });
            updated += 1;
        } else {
            batch.set(db.collection('products').doc(String(productData.id)), productData, { merge: false });
            existingByName[normalizedProductName] = productData;
            created += 1;
        }
        batchCount += 1;
        if (batchCount === 400) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }
    if (batchCount > 0) await batch.commit();
    return { created: created, updated: updated };
}

async function handleProductsExcelUpload(input) {
    if (!currentProductCategory) {
        input.value = '';
        return;
    }
    if (!window.XLSX || !input.files || !input.files[0]) return;
    var file = input.files[0];
    var reader = new FileReader();
    reader.onload = async function (event) {
        try {
            var workbook = XLSX.read(event.target.result, { type: 'array' });
            var sheetName = workbook.SheetNames[0];
            var rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
            rows = rows.filter(function (row) {
                return String(row['الاسم'] || '').trim();
            });
            if (!rows.length) {
                alert('الملف لا يحتوي على منتجات لإضافتها.');
                input.value = '';
                return;
            }
            if (!confirm('سيتم فحص ' + rows.length + ' صفاً لإضافة المنتجات الجديدة أو تحديث المنتجات الموجودة. متأكد؟')) {
                input.value = '';
                return;
            }
            setAdminLoading(true);
            setAdminStatus('جاري استيراد ' + rows.length + ' منتج...', '');
            var importResult = await importProductsRows(rows);
            setAdminLoading(false);
            setAdminStatus('تم تحديث ' + importResult.updated + ' منتج وإضافة ' + importResult.created + ' منتج جديد.', 'success');
            input.value = '';
        } catch (error) {
            reportClientError(error);
            setAdminLoading(false);
            setAdminStatus('تعذر قراءة ملف Excel أو رفع البيانات.', 'error');
            input.value = '';
        }
    };
    reader.onerror = function () {
        setAdminStatus('تعذر قراءة ملف Excel.', 'error');
        input.value = '';
    };
    reader.readAsArrayBuffer(file);
}

function renderDiscountValueOptions() {
    var type = document.getElementById('discountType');
    var container = document.getElementById('discountValueCheckboxes');
    if (!type || !container) return;
    var mode = type.value;
    var values = [];
    if (mode === 'brand') {
        values = Array.from(new Set(products.map(function (product) { return product.brand; })));
    } else if (mode === 'category') {
        values = Array.from(new Set(products.map(function (product) { return product.category; })));
    }
    container.innerHTML = values.map(function (value) {
        return '<label class="checkbox-item"><input type="checkbox" value="' + escapeHtml(value) + '"><span>' + escapeHtml(value) + '</span></label>';
    }).join('');
}

function toggleDiscountValueField() {
    var type = document.getElementById('discountType').value;
    document.getElementById('discountValueGroup').style.display = (type === 'brand' || type === 'category') ? 'block' : 'none';
    document.getElementById('discountManualGroup').style.display = type === 'manual' ? 'block' : 'none';
    if (type === 'brand' || type === 'category') renderDiscountValueOptions();
}

function renderDiscountsTable() {
    var tbody = document.getElementById('discountsTableBody');
    if (!discounts.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد خصومات مضافة.</td></tr>';
        return;
    }
    var typeLabels = { brand: 'ماركة', category: 'فئة', manual: 'يدوي', all: 'جميع المنتجات' };
    var now = new Date().toISOString().slice(0, 10);
    tbody.innerHTML = discounts.map(function (discount) {
        var expired = discount.expiresAt && discount.expiresAt < now;
        var expiryText = discount.expiresAt ? discount.expiresAt : 'بدون تاريخ';
        var rowClass = expired ? ' style="opacity:0.5;"' : '';
        return '<tr' + rowClass + '><td>' + typeLabels[discount.type] + '</td><td>' + escapeHtml(discount.type === 'all' ? 'الكل' : discount.value) + '</td><td>' + discount.percentage + '%</td><td>' + escapeHtml(expiryText + (expired ? ' (منتهي)' : '')) + '</td><td>' + escapeHtml(discount.description) + '</td><td class="actions"><button class="btn-edit" data-id="' + escapeHtml(discount.id) + '" onclick="editDiscount(this.getAttribute(\'data-id\'))">تعديل</button><button class="btn-delete" data-id="' + escapeHtml(discount.id) + '" onclick="deleteDiscount(this.getAttribute(\'data-id\'))">حذف</button></td></tr>';
    }).join('');
}

function openDiscountModal(discount) {
    document.getElementById('discountModalTitle').textContent = discount ? 'تعديل خصم' : 'إضافة خصم';
    document.getElementById('discountId').value = discount ? discount.id : '';
    document.getElementById('discountType').value = discount ? discount.type : 'all';
    toggleDiscountValueField();
    if (discount && (discount.type === 'brand' || discount.type === 'category')) {
        var container = document.getElementById('discountValueCheckboxes');
        var vals = discount.values || [];
        var checkboxes = container.querySelectorAll('input[type="checkbox"]');
        for (var i = 0; i < checkboxes.length; i++) {
            checkboxes[i].checked = vals.indexOf(checkboxes[i].value) >= 0;
        }
    }
    document.getElementById('discountManualValue').value = discount && discount.type === 'manual' ? discount.value : '';
    document.getElementById('discountPercentage').value = discount ? discount.percentage : '';
    document.getElementById('discountExpiry').value = discount ? (discount.expiresAt || '') : '';
    document.getElementById('discountDescription').value = discount ? discount.description : '';
    document.getElementById('discountModal').style.display = 'flex';
}

function editDiscount(id) {
    var discount = discounts.find(function (entry) { return entry.id === id; });
    if (discount) openDiscountModal(discount);
}

async function saveDiscount(event) {
    event.preventDefault();
    var existingId = document.getElementById('discountId').value;
    var type = document.getElementById('discountType').value;
    var values = [];
    if (type === 'brand' || type === 'category') {
        var container = document.getElementById('discountValueCheckboxes');
        var checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
        for (var i = 0; i < checkboxes.length; i++) {
            values.push(checkboxes[i].value);
        }
    } else if (type === 'manual') {
        var manualVal = document.getElementById('discountManualValue').value.trim();
        if (manualVal) values = [manualVal];
    }
    // For "all" type, values stays empty (applies to everything)
    var discountData = normalizeDiscount({
        id: existingId || String(Date.now()),
        type: type,
        values: values,
        value: values.join(', '),
        percentage: parseInt(document.getElementById('discountPercentage').value || '0', 10),
        description: document.getElementById('discountDescription').value.trim(),
        expiresAt: document.getElementById('discountExpiry').value || ''
    });

    setAdminLoading(true);
    await db.collection('discounts').doc(String(discountData.id)).set(discountData, { merge: false });
    setAdminLoading(false);
    closeModal('discountModal');
    setAdminStatus('تم حفظ الخصم.', 'success');
}

async function deleteDiscount(id) {
    if (!confirm('حذف هذا الخصم؟')) return;
    setAdminLoading(true);
    await db.collection('discounts').doc(String(id)).delete();
    setAdminLoading(false);
    setAdminStatus('تم حذف الخصم.', 'success');
}

function loadSettingsForm() {
    document.getElementById('settingWhatsappNumber').value = siteSettings.whatsappNumber || '';
    document.getElementById('settingHero').value = siteSettings.heroSubtitle || '';
    document.getElementById('settingAbout').value = siteSettings.aboutText || '';
    document.getElementById('settingInstagram').value = siteSettings.instagramLink || '';
    document.getElementById('settingTiktok').value = siteSettings.tiktokLink || '';
    renderWholesalePricesForm();
}

async function saveSettingsForm(event) {
    event.preventDefault();
    siteSettings = normalizeSettings({
        whatsappNumber: document.getElementById('settingWhatsappNumber').value,
        heroSubtitle: document.getElementById('settingHero').value,
        aboutText: document.getElementById('settingAbout').value,
        instagramLink: document.getElementById('settingInstagram').value,
        tiktokLink: document.getElementById('settingTiktok').value
    });
    setAdminLoading(true);
    await db.collection('settings').doc('config').set(siteSettings, { merge: true });
    setAdminLoading(false);
    setAdminStatus('تم حفظ الإعدادات بنجاح.', 'success');
}

function findWholesaleUserById(id) {
    var index;
    for (index = 0; index < wholesaleUsers.length; index += 1) {
        if (String(wholesaleUsers[index].id) === String(id)) return wholesaleUsers[index];
    }
    return null;
}

function openWholesaleUserModal(title, contentHtml) {
    var overlay = document.getElementById('wholesaleUserModal');
    var titleNode = document.getElementById('wholesaleUserModalTitle');
    var contentNode = document.getElementById('wholesaleUserModalContent');
    if (!overlay || !titleNode || !contentNode) return;
    titleNode.textContent = title || 'تفاصيل تاجر الجملة';
    contentNode.innerHTML = contentHtml || '';
    overlay.style.display = 'flex';
}

function closeWholesaleUserModal() {
    var overlay = document.getElementById('wholesaleUserModal');
    var contentNode = document.getElementById('wholesaleUserModalContent');
    if (overlay) overlay.style.display = 'none';
    if (contentNode) contentNode.innerHTML = '';
}

function buildWholesalePendingUpdateHtml(user) {
    var pending = user && user.pendingUpdate ? user.pendingUpdate : null;
    var rows;
    if (!pending) return '<p class="wholesale-modal-text">لا يوجد طلب تعديل مفتوح لهذا الحساب.</p>';
    rows = [
        { label: 'الاسم الأول', current: user.firstName || '-', next: pending.firstName || '-' },
        { label: 'اسم العائلة', current: user.lastName || '-', next: pending.lastName || '-' },
        { label: 'اسم الشركة', current: user.companyName || '-', next: pending.companyName || '-' },
        { label: 'الموقع', current: user.location || '-', next: pending.location || '-' }
    ];
    return '<div class="wholesale-update-panel"><p class="wholesale-modal-text">تاريخ الطلب: <strong>' + escapeHtml(formatDateTime(pending.requestedAt)) + '</strong></p><div class="wholesale-update-grid">' + rows.map(function (row) {
        return '<div class="wholesale-update-row"><span>' + escapeHtml(row.label) + '</span><div><small>الحالي</small><strong>' + escapeHtml(row.current) + '</strong></div><div><small>المطلوب</small><strong>' + escapeHtml(row.next) + '</strong></div></div>';
    }).join('') + '</div><div class="wholesale-modal-actions"><button type="button" class="btn-save" data-id="' + escapeHtml(user.id) + '" onclick="approveWholesalePendingUpdate(this.getAttribute(\'data-id\'))">اعتماد التعديل</button><button type="button" class="btn-secondary" data-id="' + escapeHtml(user.id) + '" onclick="rejectWholesalePendingUpdate(this.getAttribute(\'data-id\'))">رفض التعديل</button></div></div>';
}

var currentWholesaleFilter = 'all';

function setWholesaleFilter(filter, btn) {
    currentWholesaleFilter = filter;
    var buttons = document.querySelectorAll('.wholesale-filters .filter-toggle-btn');
    buttons.forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    renderWholesaleUsersTable();
}

function renderWholesaleUsersTable() {
    var tbody = document.getElementById('wholesaleUsersTableBody');
    var pendingCount = document.getElementById('wholesalePendingCount');
    var approvedCount = document.getElementById('wholesaleApprovedCount');
    var updateCount = document.getElementById('wholesaleUpdateCount');
    if (pendingCount) pendingCount.textContent = wholesaleUsers.filter(function (user) { return !user.approved; }).length;
    if (approvedCount) approvedCount.textContent = wholesaleUsers.filter(function (user) { return !!user.approved; }).length;
    if (updateCount) updateCount.textContent = wholesaleUsers.filter(function (user) { return !!user.pendingUpdate; }).length;
    if (!tbody) return;
    if (!wholesaleUsers.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا توجد حسابات جملة مسجلة حتى الآن.</td></tr>';
        return;
    }
    var filtered = wholesaleUsers.filter(function(user) {
        if (currentWholesaleFilter === 'all') return true;
        if (currentWholesaleFilter === 'action') return !user.approved || !!user.pendingUpdate;
        if (currentWholesaleFilter === 'location') return !!(user.location);
        if (currentWholesaleFilter === 'edit') return !!user.pendingUpdate;
        if (currentWholesaleFilter === 'add') return !user.approved;
        return true;
    });
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا توجد نتائج لهذا الفلتر.</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map(function (user) {
        var fullName = [user.firstName || '', user.lastName || ''].join(' ').trim() || '-';
        var statusHtml = (user.approved ? '<span class="status-tag approved">معتمد</span>' : '<span class="status-tag pending">بانتظار الموافقة</span>') + (user.pendingUpdate ? '<span class="status-tag update-request">طلب تعديل</span>' : '') + (user.otpHash && user.otpExpiry && new Date(user.otpExpiry).getTime() > Date.now() ? '<span class="status-tag otp-active">OTP فعال</span>' : '');
        var approveButton = user.approved ? '' : '<button class="btn-approve" data-id="' + escapeHtml(user.id) + '" onclick="approveWholesaleUser(this.getAttribute(\'data-id\'))">اعتماد</button>';
        var pendingButton = user.pendingUpdate ? '<button class="btn-edit" data-id="' + escapeHtml(user.id) + '" onclick="viewWholesalePendingUpdate(this.getAttribute(\'data-id\'))">عرض طلب التعديل</button>' : '';
        var resetButton = '<button class="btn-secondary wholesale-action-btn" data-id="' + escapeHtml(user.id) + '" onclick="resetWholesaleUserPassword(this.getAttribute(\'data-id\'))">إعادة تعيين كلمة المرور</button>';
        var deleteLabel = user.approved ? 'حذف' : 'رفض';
        return '<tr><td>' + escapeHtml(fullName) + '</td><td>' + escapeHtml(user.email || '-') + '</td><td>' + escapeHtml(user.companyName || '-') + '</td><td>' + escapeHtml(user.location || '-') + '</td><td>' + escapeHtml(formatDateTime(user.createdAt)) + '</td><td><div class="wholesale-status-stack">' + statusHtml + '</div></td><td class="actions">' + approveButton + pendingButton + resetButton + '<button class="btn-delete" data-id="' + escapeHtml(user.id) + '" onclick="deleteWholesaleUser(this.getAttribute(\'data-id\'))">' + deleteLabel + '</button></td></tr>';
    }).join('');
}

function viewWholesalePendingUpdate(id) {
    var user = findWholesaleUserById(id);
    if (!user) return;
    openWholesaleUserModal('طلب تعديل بيانات تاجر الجملة', buildWholesalePendingUpdateHtml(user));
}

async function approveWholesaleUser(id) {
    setAdminLoading(true);
    await db.collection('wholesale_users').doc(String(id)).set({ approved: true }, { merge: true });
    setAdminLoading(false);
    setAdminStatus('تم اعتماد حساب تاجر الجملة.', 'success');
}

async function resetWholesaleUserPassword(id) {
    var user = findWholesaleUserById(id);
    var otp;
    var otpHash;
    var otpExpiry;
    if (!user) return;
    otp = String(Math.floor(100000 + Math.random() * 900000));
    setAdminLoading(true);
    try {
        otpHash = await hashString(otp);
        otpExpiry = new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString();
        await db.collection('wholesale_users').doc(String(id)).set({ otpHash: otpHash, otpExpiry: otpExpiry }, { merge: true });
        openWholesaleUserModal('رمز إعادة تعيين كلمة المرور', '<div class="otp-display-card"><p class="wholesale-modal-text">أعطِ هذا الرمز للتاجر عبر واتساب أو اتصال هاتفي. الرمز صالح لمدة 24 ساعة فقط.</p><div class="otp-code">' + otp + '</div><p class="wholesale-modal-text">ينتهي الرمز بتاريخ: <strong>' + escapeHtml(formatDateTime(otpExpiry)) + '</strong></p><div class="wholesale-modal-actions"><button type="button" class="btn-save" onclick="closeWholesaleUserModal()">تم الاطلاع على الرمز</button></div></div>');
        setAdminStatus('تم إنشاء رمز إعادة التعيين بنجاح.', 'success');
    } catch (error) {
        setAdminStatus('تعذر إنشاء رمز إعادة التعيين حالياً.', 'error');
    }
    setAdminLoading(false);
}

async function approveWholesalePendingUpdate(id) {
    var user = findWholesaleUserById(id);
    var deleteValue = getAdminDeleteFieldValue();
    var payload;
    if (!user || !user.pendingUpdate) return;
    payload = {
        firstName: user.pendingUpdate.firstName || user.firstName || '',
        lastName: user.pendingUpdate.lastName || user.lastName || '',
        companyName: user.pendingUpdate.companyName || user.companyName || '',
        location: user.pendingUpdate.location || user.location || ''
    };
    if (deleteValue) payload.pendingUpdate = deleteValue;
    else payload.pendingUpdate = null;
    setAdminLoading(true);
    await db.collection('wholesale_users').doc(String(id)).set(payload, { merge: true });
    setAdminLoading(false);
    closeWholesaleUserModal();
    setAdminStatus('تم اعتماد طلب التعديل وتحديث بيانات الحساب.', 'success');
}

async function rejectWholesalePendingUpdate(id) {
    var deleteValue = getAdminDeleteFieldValue();
    var payload = {};
    if (!confirm('هل تريد رفض طلب التعديل لهذا الحساب؟')) return;
    if (deleteValue) payload.pendingUpdate = deleteValue;
    else payload.pendingUpdate = null;
    setAdminLoading(true);
    await db.collection('wholesale_users').doc(String(id)).set(payload, { merge: true });
    setAdminLoading(false);
    closeWholesaleUserModal();
    setAdminStatus('تم رفض طلب التعديل وحذفه من الحساب.', 'success');
}

async function deleteWholesaleUser(id) {
    if (!confirm('هل تريد حذف هذا الحساب؟')) return;
    setAdminLoading(true);
    await db.collection('wholesale_users').doc(String(id)).delete();
    setAdminLoading(false);
    setAdminStatus('تم حذف حساب تاجر الجملة.', 'success');
}

function getWholesaleCategories() {
    var baseCategories = ['فصاليات', 'لوازم ابواب', 'ايدين ابواب', 'براغي', 'سحابات', 'أقمشة'];
    var seen = {};
    var categories = [];
    baseCategories.forEach(function (category) {
        seen[category] = true;
        categories.push(category);
    });
    products.forEach(function (product) {
        if (!seen[product.category]) {
            seen[product.category] = true;
            categories.push(product.category);
        }
    });
    return categories;
}

function renderWholesalePricesForm() {
    var container = document.getElementById('wholesalePricesContainer');
    if (!container) return;
    var priceMap = normalizeWholesalePrices(siteSettings.wholesalePrices || {});
    container.innerHTML = getWholesaleCategories().map(function (category) {
        return '<label class="wholesale-price-row"><span>' + category + '</span><input type="number" min="0" step="1" data-category="' + category + '" value="' + (priceMap[category] || '') + '" placeholder="سعر مرجعي ₪"></label>';
    }).join('');
}

async function saveWholesalePrices() {
    var container = document.getElementById('wholesalePricesContainer');
    if (!container) return;
    var inputs = container.querySelectorAll('input[data-category]');
    var priceMap = {};
    var idx;
    for (idx = 0; idx < inputs.length; idx += 1) {
        var input = inputs[idx];
        var value = Number(input.value || 0);
        if (value > 0) priceMap[input.getAttribute('data-category')] = value;
    }
    siteSettings.wholesalePrices = priceMap;
    setAdminLoading(true);
    await db.collection('settings').doc('config').set({ wholesalePrices: priceMap }, { merge: true });
    setAdminLoading(false);
    setAdminStatus('تم حفظ أسعار الجملة بنجاح.', 'success');
}

function renderOrdersTable() {
    var tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    var search = (document.getElementById('orderSearchInput') ? document.getElementById('orderSearchInput').value : '').trim().toLowerCase();
    var statusFilter = document.getElementById('orderStatusFilter') ? document.getElementById('orderStatusFilter').value : 'all';

    var filteredOrders = orders.filter(function (order) {
        var matchesStatus = statusFilter === 'all' || order.status === statusFilter;
        var matchesType = currentOrderTypeFilter === 'all' || (currentOrderTypeFilter === 'wholesale' ? order.wholesale === true : order.wholesale !== true);
        var haystack = (String(order.customerName || '') + ' ' + String(order.customerPhone || '')).toLowerCase();
        return matchesStatus && matchesType && (!search || haystack.indexOf(search) >= 0);
    }).sort(function (a, b) {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    if (!filteredOrders.length) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-state">لا توجد طلبات مطابقة.</td></tr>';
        return;
    }

    tbody.innerHTML = filteredOrders.map(function (order) {
        var itemsCount = (order.items || []).reduce(function (sum, item) { return sum + (Number(item.qty) || 0); }, 0);
        var deliveryText = order.delivery === 'pickup' ? 'استلام' : (order.region ? DELIVERY_REGION_LABEL(order.region) : 'توصيل');
        return '<tr class="order-main-row" onclick="toggleOrderDetails(\'' + escapeJsString(getOrderDocId(order)) + '\')"><td>' + escapeHtml(order.id || getOrderDocId(order) || '-') + '</td><td class="order-type-cell">' + getOrderTypeBadges(order) + '</td><td>' + formatDateTime(order.date) + '</td><td>' + escapeHtml(order.customerName || '-') + '</td><td>' + escapeHtml(order.customerPhone || '-') + '</td><td>' + itemsCount + '</td><td>' + escapeHtml(getOrderTotalDisplay(order)) + '</td><td>' + escapeHtml(deliveryText) + '</td><td><select class="order-status-select" onclick="event.stopPropagation()" onchange="updateOrderStatus(\'' + escapeJsString(getOrderDocId(order)) + '\', this.value)">' + ['new', 'processing', 'completed', 'cancelled'].map(function (status) { return '<option value="' + status + '" ' + (order.status === status ? 'selected' : '') + '>' + ORDER_STATUS_LABEL(status) + '</option>'; }).join('') + '</select></td><td><button type="button" class="order-details-btn" onclick="event.stopPropagation(); openOrderDetailsModal(\'' + escapeJsString(getOrderDocId(order)) + '\')">تفاصيل</button></td></tr>';
    }).join('');

    if (currentOrderModalOrderId) {
        var activeOrder = getOrderById(currentOrderModalOrderId);
        if (activeOrder && document.getElementById('orderDetailsModal') && document.getElementById('orderDetailsModal').style.display !== 'none') {
            renderOrderDetailsModal(activeOrder);
        }
    }
}

function getOrderDocId(order) {
    return String(order && (order._docId || order.id) || '');
}

function getOrderById(orderId) {
    var idx;
    for (idx = 0; idx < orders.length; idx += 1) {
        if (getOrderDocId(orders[idx]) === String(orderId)) return orders[idx];
    }
    return null;
}

function setOrderTypeFilter(filter, button) {
    var buttons = document.querySelectorAll('.filter-toggle-btn');
    var idx;
    currentOrderTypeFilter = filter || 'all';
    for (idx = 0; idx < buttons.length; idx += 1) buttons[idx].classList.remove('active');
    if (button) button.classList.add('active');
    renderOrdersTable();
}

function getOrderTotalValue(order) {
    var totalPrice = Number(order && order.totalPrice);
    if (!isNaN(totalPrice) && totalPrice > 0) return totalPrice;
    var total = Number(order && order.total);
    return isNaN(total) ? 0 : total;
}

function getOrderTotalDisplay(order) {
    if (order && order.wholesale === true && order.priced !== true && !order.totalDisplay) return 'السعر حسب الاتفاق';
    if (order && order.totalDisplay) return order.totalDisplay;
    return formatCurrency(getOrderTotalValue(order));
}

function getOrderTypeBadges(order) {
    var badges = [];
    badges.push('<span class="order-badge ' + (order.wholesale === true ? 'wholesale' : 'retail') + '">' + (order.wholesale === true ? 'جملة' : 'مفرق') + '</span>');
    if (order.wholesale === true) {
        badges.push('<span class="order-pricing-badge ' + (order.priced === true ? 'priced' : 'pending') + '">' + (order.priced === true ? 'مسعّر' : 'بانتظار التسعير') + '</span>');
    }
    return '<div class="order-type-stack">' + badges.join('') + '</div>';
}

function getOrderPricingMode(order) {
    if (order && order.pricingMode === 'total') return 'total';
    return 'itemized';
}

function getOrderItemUnitPrice(item) {
    var direct = Number(item && item.unitPrice);
    if (!isNaN(direct) && direct >= 0) return direct;
    var itemPrice = Number(item && item.price);
    if (!isNaN(itemPrice) && itemPrice >= 0) return itemPrice;
    var lineTotal = Number(item && item.lineTotal);
    var qty = Number(item && item.qty);
    if (!isNaN(lineTotal) && !isNaN(qty) && qty > 0) return lineTotal / qty;
    return 0;
}

function escapeJsString(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildOrderInfoCard(label, value) {
    return '<div class="order-info-card"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value || '-') + '</strong></div>';
}

function clonePlainObject(source) {
    var target = {};
    var key;
    source = source || {};
    for (key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
    }
    return target;
}

function openOrderDetailsModal(orderId) {
    var order = getOrderById(orderId);
    if (!order) {
        setAdminStatus('تعذر العثور على الطلب المطلوب.', 'error');
        return;
    }
    currentOrderModalOrderId = getOrderDocId(order);
    renderOrderDetailsModal(order);
    document.getElementById('orderDetailsModal').style.display = 'flex';
}

function renderOrderDetailsModal(order) {
    var summaryNode = document.getElementById('orderDetailsSummary');
    var infoGridNode = document.getElementById('orderDetailsInfoGrid');
    var notesNode = document.getElementById('orderDetailsNotes');
    var itemsBodyNode = document.getElementById('orderDetailsItemsBody');
    var pricingSection = document.getElementById('orderPricingSection');
    var saveButton = document.getElementById('orderSavePricingBtn');
    var statusSelect = document.getElementById('orderDetailsStatusSelect');
    var readonlyLabel = document.getElementById('orderPricingReadOnlyLabel');
    if (!summaryNode || !infoGridNode || !itemsBodyNode) return;

    currentOrderPricingState = {
        orderId: getOrderDocId(order),
        isWholesale: order.wholesale === true,
        mode: getOrderPricingMode(order),
        overrideTotal: getOrderPricingMode(order) === 'total' ? getOrderTotalValue(order) : '',
        items: (order.items || []).map(function (item) {
            var qty = Number(item.qty) || 0;
            var unitPrice = getOrderItemUnitPrice(item);
            return {
                qty: qty,
                unitPrice: unitPrice,
                lineTotal: (Number(item.lineTotal) || 0),
                source: item
            };
        })
    };

    document.getElementById('orderDetailsTitle').textContent = 'تفاصيل الطلب: ' + (order.id || getOrderDocId(order));
    document.getElementById('orderDetailsSubtitle').textContent = (order.wholesale === true ? 'طلب جملة' : 'طلب مفرق') + ' • ' + formatDateTime(order.date);
    if (statusSelect) statusSelect.value = order.status || 'new';

    summaryNode.innerHTML = [
        '<div class="order-summary-card"><span>رقم الطلب</span><strong>' + escapeHtml(order.id || getOrderDocId(order)) + '</strong></div>',
        '<div class="order-summary-card"><span>التاريخ</span><strong>' + escapeHtml(formatDateTime(order.date)) + '</strong></div>',
        '<div class="order-summary-card"><span>الإجمالي الحالي</span><strong>' + escapeHtml(getOrderTotalDisplay(order)) + '</strong></div>'
    ].join('');

    infoGridNode.innerHTML = [
        buildOrderInfoCard('اسم العميل', order.customerName || '-'),
        buildOrderInfoCard('رقم الهاتف', order.customerPhone || '-'),
        buildOrderInfoCard('العنوان', order.address || (order.delivery === 'pickup' ? 'استلام ذاتي' : '-')),
        buildOrderInfoCard('التوصيل', order.delivery === 'pickup' ? 'استلام ذاتي' : DELIVERY_REGION_LABEL(order.region)),
        buildOrderInfoCard('اسم الشركة', order.wholesale === true ? (order.companyName || '-') : '-'),
        buildOrderInfoCard('إيميل الجملة', order.wholesale === true ? (order.wholesaleEmail || order.email || '-') : '-')
    ].join('');

    if (order.notes) {
        notesNode.style.display = 'block';
        notesNode.innerHTML = '<strong>ملاحظات الطلب:</strong><div>' + escapeHtml(order.notes) + '</div>';
    } else {
        notesNode.style.display = 'none';
        notesNode.innerHTML = '';
    }

    if (pricingSection) pricingSection.style.display = order.wholesale === true ? 'block' : 'none';
    if (saveButton) saveButton.style.display = order.wholesale === true ? 'inline-flex' : 'none';
    if (readonlyLabel) readonlyLabel.textContent = order.wholesale === true ? 'يمكن تعديل الأسعار ثم حفظها مباشرة.' : 'الأسعار للعرض فقط في طلبات المفرق.';

    renderOrderPricingModeControls();
    renderOrderItemsTable();
    updateOrderPricingTotals();
}

function renderOrderPricingModeControls() {
    var itemizedRadio = document.querySelector('input[name="orderPricingMode"][value="itemized"]');
    var totalRadio = document.querySelector('input[name="orderPricingMode"][value="total"]');
    var overrideWrap = document.getElementById('orderTotalOverrideWrap');
    var overrideInput = document.getElementById('orderTotalOverrideInput');
    if (!currentOrderPricingState) return;

    if (itemizedRadio) itemizedRadio.checked = currentOrderPricingState.mode === 'itemized';
    if (totalRadio) totalRadio.checked = currentOrderPricingState.mode === 'total';
    if (overrideWrap) overrideWrap.style.display = currentOrderPricingState.mode === 'total' ? 'block' : 'none';
    if (overrideInput) overrideInput.value = currentOrderPricingState.overrideTotal !== '' ? currentOrderPricingState.overrideTotal : '';
}

function renderOrderItemsTable() {
    var order = getOrderById(currentOrderModalOrderId);
    var itemsBodyNode = document.getElementById('orderDetailsItemsBody');
    if (!order || !itemsBodyNode || !currentOrderPricingState) return;

    itemsBodyNode.innerHTML = (order.items || []).map(function (item, index) {
        var pricingItem = currentOrderPricingState.items[index];
        var qty = Number(item.qty) || 0;
        var priceInput;
        if (order.wholesale === true) {
            priceInput = '<input type="number" min="0" step="0.01" value="' + (pricingItem.unitPrice || pricingItem.unitPrice === 0 ? pricingItem.unitPrice : '') + '" data-item-index="' + index + '" oninput="updateOrderItemPrice(' + index + ', this.value)">';
        } else {
            priceInput = '<span>' + escapeHtml(formatCurrency(getOrderItemUnitPrice(item))) + '</span>';
        }
        return '<tr><td><strong>' + escapeHtml(item.name || '-') + '</strong><div>' + escapeHtml((item.brand || '-') + (item.brand && item.sizeLabel ? ' • ' : '') + (item.sizeLabel || '')) + '</div></td><td>' + escapeHtml(item.sizeLabel || '-') + '</td><td>' + qty + '</td><td>' + priceInput + '</td><td><span class="order-line-total" id="orderLineTotal-' + index + '">' + escapeHtml(formatCurrency(pricingItem.lineTotal || 0)) + '</span></td></tr>';
    }).join('');
}

function updateOrderItemPrice(index, value) {
    if (!currentOrderPricingState || !currentOrderPricingState.items[index]) return;
    var numericValue = Number(value);
    currentOrderPricingState.items[index].unitPrice = isNaN(numericValue) || numericValue < 0 ? 0 : numericValue;
    updateOrderPricingTotals();
}

function setOrderPricingMode(mode) {
    if (!currentOrderPricingState) return;
    currentOrderPricingState.mode = mode === 'total' ? 'total' : 'itemized';
    renderOrderPricingModeControls();
    updateOrderPricingTotals();
}

function updateOrderPricingTotals() {
    var totalNode = document.getElementById('orderDetailsGrandTotal');
    var overrideInput = document.getElementById('orderTotalOverrideInput');
    var itemsSubtotal = 0;
    var grandTotal = 0;
    var idx;
    if (!currentOrderPricingState) return;

    if (overrideInput) {
        currentOrderPricingState.overrideTotal = overrideInput.value === '' ? '' : Number(overrideInput.value || 0);
        if (isNaN(currentOrderPricingState.overrideTotal) || currentOrderPricingState.overrideTotal < 0) currentOrderPricingState.overrideTotal = 0;
    }

    for (idx = 0; idx < currentOrderPricingState.items.length; idx += 1) {
        var pricingItem = currentOrderPricingState.items[idx];
        var lineTotal = (Number(pricingItem.unitPrice) || 0) * (Number(pricingItem.qty) || 0);
        pricingItem.lineTotal = Math.round(lineTotal * 100) / 100;
        itemsSubtotal += pricingItem.lineTotal;
        var lineNode = document.getElementById('orderLineTotal-' + idx);
        if (lineNode) lineNode.textContent = formatCurrency(pricingItem.lineTotal);
    }

    if (currentOrderPricingState.mode === 'total' && currentOrderPricingState.overrideTotal !== '') grandTotal = Number(currentOrderPricingState.overrideTotal) || 0;
    else grandTotal = Math.round(itemsSubtotal * 100) / 100;

    currentOrderPricingState.itemsSubtotal = Math.round(itemsSubtotal * 100) / 100;
    currentOrderPricingState.grandTotal = Math.round(grandTotal * 100) / 100;

    if (totalNode) totalNode.textContent = formatCurrency(currentOrderPricingState.grandTotal);
}

function updateCurrentOrderStatus(status) {
    if (!currentOrderModalOrderId) return;
    updateOrderStatus(currentOrderModalOrderId, status);
}

function toggleOrderDetails(orderId) {
    openOrderDetailsModal(orderId);
}

async function saveOrderPricing() {
    var order = getOrderById(currentOrderModalOrderId);
    var updatedItems = [];
    var idx;
    if (!order || !currentOrderPricingState || order.wholesale !== true) return;

    updateOrderPricingTotals();
    if (currentOrderPricingState.mode === 'total' && !(currentOrderPricingState.grandTotal > 0)) {
        setAdminStatus('أدخل سعراً إجمالياً صالحاً قبل الحفظ.', 'error');
        return;
    }
    if (currentOrderPricingState.mode === 'itemized' && !(currentOrderPricingState.grandTotal > 0)) {
        setAdminStatus('أدخل أسعار الأصناف أولاً قبل الحفظ.', 'error');
        return;
    }

    for (idx = 0; idx < currentOrderPricingState.items.length; idx += 1) {
        var sourceItem = currentOrderPricingState.items[idx].source || {};
        var nextItem = clonePlainObject(sourceItem);
        nextItem.unitPrice = currentOrderPricingState.items[idx].unitPrice;
        nextItem.price = currentOrderPricingState.items[idx].unitPrice;
        nextItem.lineTotal = currentOrderPricingState.items[idx].lineTotal;
        updatedItems.push(nextItem);
    }

    setAdminLoading(true);
    try {
        await db.collection('orders').doc(String(currentOrderModalOrderId)).update({
            items: updatedItems,
            subtotal: currentOrderPricingState.itemsSubtotal,
            total: currentOrderPricingState.grandTotal,
            totalPrice: currentOrderPricingState.grandTotal,
            totalDisplay: formatCurrency(currentOrderPricingState.grandTotal),
            priced: true,
            pricingPending: false,
            pricingMode: currentOrderPricingState.mode,
            pricingOverride: currentOrderPricingState.mode === 'total' ? currentOrderPricingState.grandTotal : null
        });
        setAdminStatus('تم حفظ أسعار الطلب بنجاح.', 'success');
    } catch (error) {
        reportClientError(error);
        setAdminStatus('تعذر حفظ أسعار الطلب حالياً.', 'error');
    }
    setAdminLoading(false);
}

async function updateOrderStatus(orderId, status) {
    setAdminLoading(true);
    try {
        await db.collection('orders').doc(String(orderId)).update({ status: status });
        setAdminStatus('تم تحديث حالة الطلب.', 'success');
    } catch (error) {
        reportClientError(error);
        setAdminStatus('تعذر تحديث حالة الطلب حالياً.', 'error');
    }
    setAdminLoading(false);
}

function ORDER_STATUS_LABEL(status) {
    return { new: 'جديد', processing: 'قيد المعالجة', completed: 'مكتمل', cancelled: 'ملغي' }[status] || status;
}

function DELIVERY_REGION_LABEL(region) {
    return { pickup: 'استلام', westbank: 'الضفة', jerusalem: 'القدس', inside: 'الداخل' }[region] || '-';
}

function updateNotificationBadges() {
    updateNewOrdersBadge();
    updateWholesaleRequestsBadge();
}

function updateNewOrdersBadge() {
    var badge = document.getElementById('newOrdersBadge');
    if (!badge) return;
    var newOrders = orders.filter(function(order) { return !order.status || order.status === 'new'; });
    if (newOrders.length > 0) {
        badge.style.display = 'inline-flex';
        badge.textContent = newOrders.length;
    } else {
        badge.style.display = 'none';
    }
}

function updateWholesaleRequestsBadge() {
    var badge = document.getElementById('wholesaleRequestsBadge');
    if (!badge) return;
    var count = wholesaleUsers.filter(function(user) { return !user.approved || !!user.pendingUpdate; }).length;
    if (count > 0) {
        badge.style.display = 'inline-flex';
        badge.textContent = count;
    } else {
        badge.style.display = 'none';
    }
}

function renderDashboard() {
    var completedOrders = orders.filter(function (order) { return order.status === 'completed'; });
    var totalRevenue = completedOrders.reduce(function (sum, order) { return sum + (Number(order.total) || 0); }, 0);
    var totalOrders = orders.length;
    var pendingOrders = orders.filter(function (order) { return order.status === 'new' || order.status === 'processing'; }).length;
    var completedCount = completedOrders.length;
    var weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    var monthStart = new Date();
    monthStart.setMonth(monthStart.getMonth() - 1);
    var ordersWeek = orders.filter(function (order) { return new Date(order.date) >= weekStart; }).length;
    var ordersMonth = orders.filter(function (order) { return new Date(order.date) >= monthStart; }).length;

    document.getElementById('statsGrid').innerHTML = [
        statCard('إجمالي الإيراد', formatCurrency(totalRevenue), 'من الطلبات المكتملة'),
        statCard('إجمالي الطلبات', totalOrders, 'كل الحالات'),
        statCard('الطلبات المعلقة', pendingOrders, 'جديد + قيد المعالجة'),
        statCard('الطلبات المكتملة', completedCount, 'مكتملة فقط'),
        statCard('طلبات هذا الأسبوع', ordersWeek, 'آخر 7 أيام'),
        statCard('طلبات هذا الشهر', ordersMonth, 'آخر 30 يوم'),
        statCard('عدد المنتجات', products.length, 'في المتجر'),
        statCard('عدد الخصومات', discounts.length, 'الخصومات النشطة')
    ].join('');

    renderRevenueChart();
    renderStatusChart();
    renderRegionChart();
    renderTopProductsChart();
}

function statCard(title, value, subtitle) {
    return '<div class="stat-card"><h4>' + title + '</h4><strong>' + value + '</strong><span>' + subtitle + '</span></div>';
}

function destroyChart(key) {
    if (charts[key]) {
        charts[key].destroy();
        charts[key] = null;
    }
}

function renderRevenueChart() {
    var labels = [];
    var values = [];
    for (var index = 29; index >= 0; index -= 1) {
        var day = new Date();
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() - index);
        var nextDay = new Date(day);
        nextDay.setDate(day.getDate() + 1);
        labels.push(day.toLocaleDateString('ar-PS', { month: 'short', day: 'numeric' }));
        values.push(orders.filter(function (order) {
            var orderDate = new Date(order.date);
            return order.status === 'completed' && orderDate >= day && orderDate < nextDay;
        }).reduce(function (sum, order) { return sum + (Number(order.total) || 0); }, 0));
    }

    destroyChart('revenue');
    charts.revenue = new Chart(document.getElementById('revenueChart'), {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'الإيراد', data: values, borderColor: '#d4af37', backgroundColor: 'rgba(212,175,55,0.18)', fill: true, tension: 0.35 }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderStatusChart() {
    var statuses = ['new', 'processing', 'completed', 'cancelled'];
    destroyChart('status');
    charts.status = new Chart(document.getElementById('statusChart'), {
        type: 'doughnut',
        data: {
            labels: statuses.map(ORDER_STATUS_LABEL),
            datasets: [{ data: statuses.map(function (status) { return orders.filter(function (order) { return order.status === status; }).length; }), backgroundColor: ['#60a5fa', '#fbbf24', '#34d399', '#f87171'] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderRegionChart() {
    var regions = ['pickup', 'westbank', 'jerusalem', 'inside'];
    destroyChart('region');
    charts.region = new Chart(document.getElementById('regionChart'), {
        type: 'pie',
        data: {
            labels: regions.map(DELIVERY_REGION_LABEL),
            datasets: [{ data: regions.map(function (region) { return orders.filter(function (order) { return (order.region || 'pickup') === region; }).length; }), backgroundColor: ['#d4af37', '#b8860b', '#c9a96e', '#1a1a1a'] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderTopProductsChart() {
    var totals = {};
    orders.forEach(function (order) {
        (order.items || []).forEach(function (item) {
            totals[item.name] = (totals[item.name] || 0) + (Number(item.qty) || 0);
        });
    });
    var topProducts = Object.keys(totals).map(function (name) {
        return { name: name, qty: totals[name] };
    }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 5);

    destroyChart('topProducts');
    charts.topProducts = new Chart(document.getElementById('topProductsChart'), {
        type: 'bar',
        data: {
            labels: topProducts.map(function (item) { return item.name; }),
            datasets: [{ label: 'الكمية', data: topProducts.map(function (item) { return item.qty; }), backgroundColor: '#d4af37' }]
        },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' }
    });
}

async function seedData(force) {
    var shouldForce = force || confirm('سيتم تعبئة فايرستور بالمنتجات الافتراضية إذا كان فارغاً. للكتابة فوق البيانات الحالية اختاري موافق.');
    setAdminLoading(true);
    var result = await seedFirestoreData(shouldForce);
    setAdminLoading(false);
    if (result.seeded) setAdminStatus('تم تنفيذ Seed Data بنجاح.', 'success');
    else setAdminStatus('تم تجاهل Seed Data لأن المنتجات موجودة بالفعل.', 'warning');
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
    if (id === 'orderDetailsModal') {
        currentOrderModalOrderId = '';
        currentOrderPricingState = null;
    }
}

// Image upload functions
function previewImage(input) {
    var preview = document.getElementById('imagePreview');
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function (e) {
            preview.innerHTML = '<img src="' + e.target.result + '">';
        };
        reader.readAsDataURL(input.files[0]);
        // Clear URL input when file is selected
        document.getElementById('productImage').value = '';
    } else {
        preview.innerHTML = '';
    }
}

async function uploadProductImage(file, productId) {
    // Upload to ImgBB
    return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function (e) {
            var img = new Image();
            img.onload = function () {
                var canvas = document.createElement('canvas');
                var maxSize = 600;
                var w = img.width;
                var h = img.height;
                if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize; } }
                else { if (h > maxSize) { w = w * maxSize / h; h = maxSize; } }
                canvas.width = w;
                canvas.height = h;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                var base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                // Use Worker proxy (hides API key), fallback to direct ImgBB
                fetch(API_BASE + '/api/upload-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64, name: productId || 'product' })
                }).then(function (res) { return res.json(); })
                .then(function (data) {
                    if (data && data.url) {
                        resolve(data.url);
                    } else {
                        throw new Error('proxy failed');
                    }
                }).catch(function () {
                    // Fallback: direct ImgBB
                    var formData = new FormData();
                    formData.append('key', 'de10f7f874d9dbf904fe0cd0ad00332d');
                    formData.append('image', base64);
                    formData.append('name', productId || 'product');
                    fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData })
                        .then(function (res) { return res.json(); })
                        .then(function (data) {
                            if (data && data.data && data.data.url) {
                                resolve(data.data.url);
                            } else {
                                reject(new Error('ImgBB upload failed'));
                            }
                        })
                        .catch(function (err) { reject(err); });
                });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}