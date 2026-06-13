// Seed data for Makka Carpentry Supplies
// Run window.seedFirestoreData(true) from browser console to populate Firestore

function createSizedOptions(values, unit, startPrice, step) {
    return values.map(function (value, index) {
        return { size: String(value), unit: unit, price: startPrice + (index * step) };
    });
}

var SEED_PRODUCTS = [
    { name: 'فصالية ستانلس للأبواب الداخلية', brand: 'فصاليات', category: 'فصاليات', image: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400&h=400&fit=crop', description: 'فصالية ستانلس متينة للأبواب الخشبية مع أربع قياسات عملية.', sizes: createSizedOptions([3, 3.5, 4, 5], 'انش', 8, 2), status: 'bestseller' },
    { name: 'فصالية نحاس كلاسيكية', brand: 'فصاليات', category: 'فصاليات', image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=400&fit=crop', description: 'تشطيب نحاسي أنيق مناسب للأبواب الكلاسيكية والديكورات التراثية.', sizes: createSizedOptions([3, 3.5, 4, 5], 'انش', 10, 3), status: 'normal' },
    { name: 'فصالية هيدروليك ثقيلة', brand: 'فصاليات', category: 'فصاليات', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&fit=crop', description: 'تحمل عال للأبواب الكبيرة مع حركة فتح ثابتة وسلسة.', sizes: createSizedOptions([3, 3.5, 4, 5], 'انش', 14, 4), status: 'special' },
    { name: 'قفل باب أسطواني', brand: 'لوازم أبواب', category: 'لوازم ابواب', image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=400&h=400&fit=crop', description: 'قفل أسطواني عملي مع ثلاثة مفاتيح وتشطيب مقاوم للاستعمال اليومي.', sizes: [{ size: '1', unit: 'حبة', price: 45 }], status: 'normal' },
    { name: 'قفل باب أمان مزدوج', brand: 'لوازم أبواب', category: 'لوازم ابواب', image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&h=400&fit=crop', description: 'مناسب للأبواب الخارجية مع جسم متين وتشغيل سهل.', sizes: [{ size: '1', unit: 'حبة', price: 72 }], status: 'bestseller' },
    { name: 'ماسك باب مغناطيسي', brand: 'لوازم أبواب', category: 'لوازم ابواب', image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop', description: 'ماسك باب مغناطيسي لتثبيت الباب وحمايته من الارتطام.', sizes: [{ size: '1', unit: 'حبة', price: 16 }], status: 'normal' },
    { name: 'ايد باب ستانلس مستقيم', brand: 'ايدين ابواب', category: 'ايدين ابواب', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&fit=crop', description: 'ايد باب ستانلس بتصميم مستقيم ومريح للمكاتب والمحال.', sizes: createSizedOptions([15, 20, 25, 30], 'سم', 25, 6), status: 'bestseller' },
    { name: 'ايد باب أسود مطفي', brand: 'ايدين ابواب', category: 'ايدين ابواب', image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=400&h=400&fit=crop', description: 'تشطيب عصري مطفي مناسب للأبواب الحديثة.', sizes: createSizedOptions([15, 20, 25, 30], 'سم', 28, 7), status: 'normal' },
    { name: 'ايد باب ذهبي فاخر', brand: 'ايدين ابواب', category: 'ايدين ابواب', image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&h=400&fit=crop', description: 'ايد باب ذهبي بلمعة هادئة ومظهر فاخر.', sizes: createSizedOptions([15, 20, 25, 30], 'سم', 32, 8), status: 'special' },
    { name: 'براغي خشب مجلفنة', brand: 'براغي', category: 'براغي', image: 'https://images.unsplash.com/photo-1513467535987-fd81bc7d62f8?w=400&h=400&fit=crop', description: 'براغي خشب مجلفنة تباع بالعلبة ومناسبة لأعمال التجميع اليومية.', sizes: createSizedOptions([2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 8], 'سم', 12, 2), status: 'bestseller' },
    { name: 'براغي ستانلس مقاومة للصدأ', brand: 'براغي', category: 'براغي', image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=400&fit=crop', description: 'علب براغي ستانلس للأعمال الخارجية والرطبة.', sizes: createSizedOptions([2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 8], 'سم', 16, 3), status: 'normal' },
    { name: 'براغي جبس بورد', brand: 'براغي', category: 'براغي', image: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400&h=400&fit=crop', description: 'علب براغي سوداء عملية لألواح الجبس بورد وتثبيت الإكسسوارات.', sizes: createSizedOptions([2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 8], 'سم', 10, 2), status: 'normal' },
    { name: 'سحاب درج كامل الفتح', brand: 'سحابات', category: 'سحابات', image: 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=400&h=400&fit=crop', description: 'سحابات درج كاملة الفتح بحركة ناعمة وتحمل ممتاز.', sizes: createSizedOptions([30, 40, 50, 60, 70, 80], 'سم', 22, 5), status: 'bestseller' },
    { name: 'سحاب سوفت كلوز', brand: 'سحابات', category: 'سحابات', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&fit=crop', description: 'إغلاق هادئ للمطابخ والخزائن مع جودة تشغيل عالية.', sizes: createSizedOptions([30, 40, 50, 60, 70, 80], 'سم', 28, 6), status: 'special' },
    { name: 'سحاب تحميل ثقيل', brand: 'سحابات', category: 'سحابات', image: 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=400&h=400&fit=crop', description: 'مناسب للأدراج الكبيرة والخزائن الثقيلة.', sizes: createSizedOptions([30, 40, 50, 60, 70, 80], 'سم', 30, 7), status: 'normal' },
    { name: 'قماش تنجيد كتان', brand: 'أقمشة', category: 'أقمشة', image: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=400&h=400&fit=crop', description: 'قماش كتان طبيعي مناسب للتنجيد والمجالس.', sizes: createSizedOptions([1, 2, 3, 5, 10], 'متر', 30, 18), status: 'bestseller' },
    { name: 'قماش مخمل ناعم', brand: 'أقمشة', category: 'أقمشة', image: 'https://images.unsplash.com/photo-1553530979-212c46e8a0fa?w=400&h=400&fit=crop', description: 'ملمس ناعم ولمعة خفيفة لتنجيد الكنب والكراسي.', sizes: createSizedOptions([1, 2, 3, 5, 10], 'متر', 36, 22), status: 'special' },
    { name: 'قماش جلد صناعي', brand: 'أقمشة', category: 'أقمشة', image: 'https://images.unsplash.com/photo-1518893494013-481c1d8ed3fd?w=400&h=400&fit=crop', description: 'مقاوم للماء وسهل التنظيف للمشاريع العملية.', sizes: createSizedOptions([1, 2, 3, 5, 10], 'متر', 42, 24), status: 'normal' }
];

function seedFirestoreData(forceOverwrite) {
    if (!window.rawDb) {
        console.error('Firestore not initialized. Open index.html first.');
        return Promise.reject(new Error('Firestore not initialized'));
    }
    var projectId = 'makka';
    var batch = rawDb.batch();
    var productsRef = rawDb.collection('projects').doc(projectId).collection('products');
    SEED_PRODUCTS.forEach(function (product, index) {
        var docRef = productsRef.doc('product_' + (index + 1));
        var data = {
            name: product.name,
            brand: product.brand,
            category: product.category,
            image: product.image,
            description: product.description,
            sizes: product.sizes || [],
            status: product.status || 'normal',
            createdAt: new Date().toISOString(),
            order: index + 1
        };
        if (forceOverwrite) batch.set(docRef, data);
        else batch.set(docRef, data, { merge: true });
    });
    return batch.commit().then(function () {
        console.log('Successfully seeded ' + SEED_PRODUCTS.length + ' products!');
        window.alert('تمت إضافة ' + SEED_PRODUCTS.length + ' منتج بنجاح.');
    }).catch(function (error) {
        console.error('Error seeding data:', error);
        throw error;
    });
}

window.seedFirestoreData = seedFirestoreData;
