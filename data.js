var DEFAULT_PRODUCTS = [];
var DEFAULT_DISCOUNTS = [];
var DEFAULT_SITE_SETTINGS = {
    whatsappNumber: '972569236758',
    heroSubtitle: 'كل ما يحتاجه النجار في مكان واحد',
    aboutText: 'شركة مكة لبيع إكسسوارات ولوازم النجارين\nنوفر لكم فصاليات وسحابات ولوازم أبواب وايدين أبواب وأقمشة وبراغي بأعلى جودة مع خدمة مميزة للجملة والمفرق.',
    instagramLink: 'https://www.facebook.com/people/%D8%B4%D8%B1%D9%83%D8%A9-%D9%85%D9%83%D8%A9-%D9%84%D8%A8%D9%8A%D8%B9-%D8%A5%D9%83%D8%B3%D8%B3%D9%88%D8%A7%D8%B1%D8%A7%D8%AA-%D9%88%D9%84%D9%88%D8%A7%D8%B2%D9%85-%D8%A7%D9%84%D9%86%D8%AC%D8%A7%D8%B1%D9%8A%D9%86/61576542398498/',
    tiktokLink: '',
    wholesalePrices: {}
};

function normalizeWholesalePrices(map) {
    var source = map || {};
    var normalized = {};
    var key;
    for (key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            normalized[key] = Number(source[key]) || 0;
        }
    }
    return normalized;
}

function normalizeLegacySizeText(entry) {
    var text = String(entry || '').trim();
    var units = ['انش', 'سم', 'متر', 'مم', 'حبة', 'علبة', 'inch', 'cm', 'm', 'mm', 'piece', 'box'];
    var idx;
    for (idx = 0; idx < units.length; idx += 1) {
        if (text.indexOf(units[idx]) >= 0) {
            return {
                size: text.replace(units[idx], '').trim() || (units[idx] === 'متر' ? '1' : '-'),
                unit: units[idx],
                price: 0
            };
        }
    }
    return { size: text || '-', unit: '', price: 0 };
}

function normalizeSizeEntry(entry, fallbackPrice, index) {
    if (!entry) return { size: '-', unit: '', price: Math.max(0, Number(fallbackPrice) || 0) };
    if (typeof entry === 'string') {
        var parsed = normalizeLegacySizeText(entry);
        parsed.price = Math.max(0, Number(fallbackPrice) || 0) + ((index || 0) * Math.max(1, Math.round((Number(fallbackPrice) || 10) * 0.15)));
        return parsed;
    }
    return {
        size: sanitizePlainText(entry.size == null ? '-' : entry.size, 80) || '-',
        unit: String(entry.unit || '').trim(),
        price: Math.max(0, Number(entry.price != null ? entry.price : fallbackPrice) || 0)
    };
}

function sanitizePlainText(value, maxLength) {
    var text = String(value == null ? '' : value)
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/[<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (maxLength && text.length > maxLength) return text.slice(0, maxLength);
    return text;
}

function sanitizeMultilineText(value, maxLength) {
    var text = String(value == null ? '' : value)
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
        .replace(/[<>]/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (maxLength && text.length > maxLength) return text.slice(0, maxLength);
    return text;
}

function sanitizeUrl(value) {
    var url = String(value == null ? '' : value).trim();
    if (!url) return '';
    if (/^data:image\//i.test(url)) return url;
    if (!/^https?:\/\//i.test(url)) return '';
    if (/^javascript:/i.test(url)) return '';
    return url;
}

function sanitizePhoneNumber(value) {
    return String(value == null ? '' : value).replace(/[^\d+]/g, '').trim();
}

function normalizeProduct(product) {
    var source = product || {};
    var sizes = [];
    var idx;
    var quantity = null;
    if (Array.isArray(source.sizes) && source.sizes.length) {
        for (idx = 0; idx < source.sizes.length; idx += 1) sizes.push(normalizeSizeEntry(source.sizes[idx], source.price || 0, idx));
    } else {
        sizes.push(normalizeSizeEntry({ size: source.size || '-', unit: source.unit || '', price: source.price || 0 }, source.price || 0, 0));
    }
    if (source.quantity !== undefined && source.quantity !== null && String(source.quantity).trim() !== '') {
        quantity = Math.max(0, parseInt(source.quantity, 10) || 0);
    }
    return {
        id: String(source.id || ''),
        name: sanitizePlainText(source.name || '', 160),
        brand: sanitizePlainText(source.brand || '', 120),
        category: sanitizePlainText(source.category || '', 120),
        sizes: sizes,
        discount: Number(source.discount) || 0,
        image: sanitizeUrl(source.image || ''),
        status: String(source.status || 'normal'),
        description: sanitizeMultilineText(source.description || '', 800),
        createdAt: source.createdAt || '',
        order: Number(source.order) || 0,
        quantity: quantity
    };
}

function normalizeProducts(list) {
    var normalized = Array.isArray(list) ? list.map(normalizeProduct) : [];
    normalized.sort(function (a, b) {
        if ((a.order || 0) !== (b.order || 0)) return (a.order || 0) - (b.order || 0);
        return String(a.id || '').localeCompare(String(b.id || ''));
    });
    return normalized;
}

function normalizeDiscount(discount) {
    var values = [];
    if (discount && Array.isArray(discount.values)) values = discount.values;
    else if (discount && discount.value) values = String(discount.value).split(',').map(function (value) { return value.trim(); }).filter(function (value) { return !!value; });
    return {
        id: String(discount && discount.id ? discount.id : Date.now()),
        type: ['brand', 'category', 'manual', 'all'].indexOf(discount && discount.type) >= 0 ? discount.type : 'manual',
        value: values.join(', '),
        values: values,
        percentage: Number(discount && discount.percentage) || 0,
        description: String(discount && discount.description ? discount.description : '').trim(),
        expiresAt: discount && discount.expiresAt ? discount.expiresAt : ''
    };
}

function normalizeDiscounts(list) {
    return (Array.isArray(list) ? list : []).map(normalizeDiscount);
}

function extractWhatsappNumber(input) {
    var raw = String(input || '').trim();
    if (!raw) return DEFAULT_SITE_SETTINGS.whatsappNumber;
    if (raw.indexOf('wa.me/') >= 0) raw = raw.split('wa.me/')[1];
    return raw.replace(/[^\d]/g, '');
}

function buildWhatsAppUrl(number, message) {
    var safeNumber = extractWhatsappNumber(number);
    var text = message ? '?text=' + encodeURIComponent(message) : '';
    return 'https://wa.me/' + safeNumber + text;
}

function normalizeSettings(settings) {
    var source = settings || {};
    return {
        whatsappNumber: extractWhatsappNumber(source.whatsappNumber || source.whatsappLink || DEFAULT_SITE_SETTINGS.whatsappNumber),
        heroSubtitle: sanitizePlainText(source.heroSubtitle || DEFAULT_SITE_SETTINGS.heroSubtitle, 240),
        aboutText: sanitizeMultilineText(source.aboutText || DEFAULT_SITE_SETTINGS.aboutText, 1500),
        instagramLink: sanitizeUrl(source.instagramLink || DEFAULT_SITE_SETTINGS.instagramLink),
        tiktokLink: sanitizeUrl(source.tiktokLink || DEFAULT_SITE_SETTINGS.tiktokLink),
        wholesalePrices: normalizeWholesalePrices(source.wholesalePrices || DEFAULT_SITE_SETTINGS.wholesalePrices)
    };
}

function getSizeData(product, sizeIdx) {
    var sizes = product && Array.isArray(product.sizes) ? product.sizes : [];
    if (!sizes.length) return { size: '-', unit: '', price: Number(product && product.price) || 0 };
    var safeIndex = Math.max(0, Math.min(Number(sizeIdx) || 0, sizes.length - 1));
    return sizes[safeIndex];
}

function getUnitLabel(unit) {
    if (unit === 'انش' || unit === 'inch') return 'انش';
    if (unit === 'سم' || unit === 'cm') return 'سم';
    if (unit === 'متر' || unit === 'm') return 'متر';
    if (unit === 'مم' || unit === 'mm') return 'مم';
    if (unit === 'حبة' || unit === 'piece' || unit === 'قطعة') return 'حبة';
    if (unit === 'علبة' || unit === 'box') return 'علبة';
    return '';
}

function getSizeLabel(sizeData) {
    var entry = sizeData || { size: '-', unit: '' };
    var sizeValue = String(entry.size == null ? '-' : entry.size).trim();
    var label = getUnitLabel(entry.unit);
    if (!label) return sizeValue === '-' ? 'سعر ثابت' : sizeValue;
    if (label === 'حبة' && (sizeValue === '1' || sizeValue === '-' || sizeValue === 'واحد')) return 'قطعة';
    if (sizeValue === '-' || sizeValue === '') return label;
    return sizeValue + ' ' + label;
}

function getProductDiscountPercent(product, discounts) {
    var discountPercent = Number(product && product.discount) || 0;
    var now = new Date().toISOString().slice(0, 10);
    normalizeDiscounts(discounts).forEach(function (discount) {
        if (discount.expiresAt && discount.expiresAt < now) return;
        if (discount.type === 'all') discountPercent = Math.max(discountPercent, discount.percentage);
        if (discount.type === 'brand' && discount.values.indexOf(product.brand) >= 0) discountPercent = Math.max(discountPercent, discount.percentage);
        if (discount.type === 'category' && discount.values.indexOf(product.category) >= 0) discountPercent = Math.max(discountPercent, discount.percentage);
    });
    return discountPercent;
}

function getFinalPrice(product, sizeIdx, discounts) {
    var sizeData = getSizeData(product, sizeIdx);
    var original = Math.max(0, Number(sizeData.price) || 0);
    var discountPercent = getProductDiscountPercent(product, discounts || []);
    if (discountPercent > 0) {
        return { original: original, final: Math.round(original * (1 - discountPercent / 100)), hasDiscount: true, discountPercent: discountPercent };
    }
    return { original: original, final: original, hasDiscount: false, discountPercent: 0 };
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function reportClientError(error) {
    if (typeof window !== 'undefined' && window.DEBUG_MODE && window.console && typeof window.console.error === 'function') {
        window.console.error(error);
    }
}

function normalizeCartItems(items, products) {
    var list = Array.isArray(items) ? items : [];
    var catalog = Array.isArray(products) ? products : [];
    var normalized = [];
    var i;
    var j;
    for (i = 0; i < list.length; i += 1) {
        var item = list[i] || {};
        var product = null;
        for (j = 0; j < catalog.length; j += 1) {
            if (String(catalog[j].id) === String(item.id)) {
                product = catalog[j];
                break;
            }
        }
        var sizesLength = product && Array.isArray(product.sizes) && product.sizes.length ? product.sizes.length : 1;
        normalized.push({
            id: String(item.id || ''),
            sizeIdx: Math.max(0, Math.min(sizesLength - 1, parseInt(item.sizeIdx, 10) || 0)),
            qty: Math.max(1, parseInt(item.qty, 10) || 1),
            price: Math.max(0, Number(item.price) || 0)
        });
    }
    return normalized.filter(function (item) { return !!item.id; });
}

function formatCurrency(value) {
    return '\u20AA' + (Number(value) || 0);
}

function formatDateTime(dateValue) {
    var date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('ar-PS', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function makeOrderId() {
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code = '';
    var idx;
    for (idx = 0; idx < 5; idx += 1) code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    return 'ORD-' + code;
}
