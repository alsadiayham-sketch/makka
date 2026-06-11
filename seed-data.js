// Seed data for Makka Carpentry Supplies
// Run window.seedFirestoreData(true) from browser console to populate Firestore

var SEED_PRODUCTS = [
    {
        name: 'فصالية ايطالي 4 انش',
        brand: 'فصاليات',
        category: 'فصاليات',
        price: 8,
        image: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400&h=400&fit=crop',
        description: 'فصالية ايطالي 4 انش - نحاسي',
        sizes: ['4 انش', '3 انش'],
        status: 'available'
    },
    {
        name: 'فصالية ستانلس ستيل 3 انش',
        brand: 'فصاليات',
        category: 'فصاليات',
        price: 12,
        image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=400&fit=crop',
        description: 'فصالية ستانلس ستيل مقاومة للصدأ',
        sizes: ['3 انش', '3.5 انش', '4 انش'],
        status: 'available'
    },
    {
        name: 'فصالية كروم 5 انش',
        brand: 'فصاليات',
        category: 'فصاليات',
        price: 15,
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&fit=crop',
        description: 'فصالية كروم ثقيلة للأبواب الكبيرة',
        sizes: ['5 انش'],
        status: 'bestseller'
    },
    {
        name: 'ايد باب المنيوم فضي',
        brand: 'لوازم أبواب',
        category: 'ايدين ابواب',
        price: 25,
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&fit=crop',
        description: 'ايد باب المنيوم فضي - 20 سم',
        sizes: ['15 سم', '20 سم', '25 سم'],
        status: 'available'
    },
    {
        name: 'ايد باب ستانلس ذهبي',
        brand: 'لوازم أبواب',
        category: 'ايدين ابواب',
        price: 35,
        image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&h=400&fit=crop',
        description: 'ايد باب ستانلس لون ذهبي فاخر',
        sizes: ['20 سم', '25 سم', '30 سم'],
        status: 'bestseller'
    },
    {
        name: 'ايد باب خشب بلوط',
        brand: 'لوازم أبواب',
        category: 'ايدين ابواب',
        price: 45,
        image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=400&h=400&fit=crop',
        description: 'ايد باب خشب بلوط طبيعي',
        sizes: ['20 سم', '25 سم'],
        status: 'available'
    },
    {
        name: 'برغي خشب 3 سم',
        brand: 'براغي',
        category: 'براغي',
        price: 5,
        image: 'https://images.unsplash.com/photo-1513467535987-fd81bc7d62f8?w=400&h=400&fit=crop',
        description: 'برغي خشب 3 سم - علبة 100 حبة',
        sizes: ['2 سم', '3 سم', '4 سم', '5 سم'],
        status: 'available'
    },
    {
        name: 'برغي فولاذ مقاوم 5 سم',
        brand: 'براغي',
        category: 'براغي',
        price: 8,
        image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=400&fit=crop',
        description: 'برغي فولاذ مقاوم للصدأ - علبة 50 حبة',
        sizes: ['3 سم', '4 سم', '5 سم', '6 سم'],
        status: 'available'
    },
    {
        name: 'برغي جبس بورد',
        brand: 'براغي',
        category: 'براغي',
        price: 3,
        image: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400&h=400&fit=crop',
        description: 'برغي جبس بورد اسود - علبة 200 حبة',
        sizes: ['2.5 سم', '3.5 سم', '4.5 سم'],
        status: 'available'
    },
    {
        name: 'سحاب درج 40 سم',
        brand: 'سحابات',
        category: 'سحابات',
        price: 18,
        image: 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=400&h=400&fit=crop',
        description: 'سحاب درج كامل الفتح 40 سم',
        sizes: ['30 سم', '40 سم', '50 سم', '60 سم'],
        status: 'bestseller'
    },
    {
        name: 'سحاب سوفت كلوز 50 سم',
        brand: 'سحابات',
        category: 'سحابات',
        price: 30,
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&fit=crop',
        description: 'سحاب درج سوفت كلوز - اغلاق هادئ',
        sizes: ['40 سم', '50 سم', '60 سم'],
        status: 'available'
    },
    {
        name: 'قماش تنجيد بني',
        brand: 'أقمشة',
        category: 'أقمشة',
        price: 40,
        image: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=400&h=400&fit=crop',
        description: 'قماش تنجيد بني فاخر - للمتر',
        sizes: ['متر', '2 متر', '5 متر'],
        status: 'available'
    },
    {
        name: 'قماش مخمل اسود',
        brand: 'أقمشة',
        category: 'أقمشة',
        price: 55,
        image: 'https://images.unsplash.com/photo-1553530979-212c46e8a0fa?w=400&h=400&fit=crop',
        description: 'قماش مخمل اسود عالي الجودة - للمتر',
        sizes: ['متر', '3 متر', '5 متر'],
        status: 'bestseller'
    },
    {
        name: 'قماش جلد صناعي بيج',
        brand: 'أقمشة',
        category: 'أقمشة',
        price: 65,
        image: 'https://images.unsplash.com/photo-1518893494013-481c1d8ed3fd?w=400&h=400&fit=crop',
        description: 'قماش جلد صناعي بيج - مقاوم للماء',
        sizes: ['متر', '2 متر', '5 متر'],
        status: 'available'
    },
    {
        name: 'قفل باب سمارت',
        brand: 'لوازم أبواب',
        category: 'لوازم ابواب',
        price: 120,
        image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=400&h=400&fit=crop',
        description: 'قفل باب ذكي مع بصمة ورقم سري',
        sizes: [],
        status: 'special'
    },
    {
        name: 'قفل باب كلاسيك نحاسي',
        brand: 'لوازم أبواب',
        category: 'لوازم ابواب',
        price: 45,
        image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&h=400&fit=crop',
        description: 'قفل باب كلاسيك نحاسي - 3 مفاتيح',
        sizes: [],
        status: 'available'
    },
    {
        name: 'مسمار تثبيت 6 سم',
        brand: 'براغي',
        category: 'براغي',
        price: 4,
        image: 'https://images.unsplash.com/photo-1513467535987-fd81bc7d62f8?w=400&h=400&fit=crop',
        description: 'مسمار تثبيت 6 سم - علبة 100 حبة',
        sizes: ['4 سم', '5 سم', '6 سم', '8 سم'],
        status: 'available'
    },
    {
        name: 'سحاب مطبخ 70 سم',
        brand: 'سحابات',
        category: 'سحابات',
        price: 35,
        image: 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=400&h=400&fit=crop',
        description: 'سحاب مطبخ 70 سم - تحميل ثقيل',
        sizes: ['60 سم', '70 سم', '80 سم'],
        status: 'available'
    },
    {
        name: 'فصالية هيدروليك للزجاج',
        brand: 'فصاليات',
        category: 'فصاليات',
        price: 85,
        image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=400&fit=crop',
        description: 'فصالية هيدروليك للأبواب الزجاجية',
        sizes: [],
        status: 'special'
    },
    {
        name: 'اكسسوار خزانة مطبخ',
        brand: 'لوازم أبواب',
        category: 'لوازم ابواب',
        price: 22,
        image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop',
        description: 'اكسسوار خزانة مطبخ - مجموعة كاملة',
        sizes: [],
        status: 'available'
    },
    {
        name: 'قماش كتان طبيعي',
        brand: 'أقمشة',
        category: 'أقمشة',
        price: 48,
        image: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=400&h=400&fit=crop',
        description: 'قماش كتان طبيعي 100% - الوان متعددة',
        sizes: ['متر', '2 متر', '5 متر', '10 متر'],
        status: 'available'
    },
    {
        name: 'ماسك باب مغناطيسي',
        brand: 'لوازم أبواب',
        category: 'لوازم ابواب',
        price: 10,
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&fit=crop',
        description: 'ماسك باب مغناطيسي - ستانلس ستيل',
        sizes: [],
        status: 'available'
    }
];

// Seed function
function seedFirestoreData(forceOverwrite) {
    if (!window.rawDb) {
        console.error('Firestore not initialized. Open index.html first.');
        return;
    }
    var projectId = 'makka';
    var batch = rawDb.batch();
    var productsRef = rawDb.collection('projects').doc(projectId).collection('products');
    
    SEED_PRODUCTS.forEach(function(product, index) {
        var docRef = productsRef.doc('product_' + (index + 1));
        var data = {
            name: product.name,
            brand: product.brand,
            category: product.category,
            price: product.price,
            image: product.image,
            description: product.description,
            sizes: product.sizes || [],
            status: product.status || 'available',
            createdAt: new Date().toISOString(),
            order: index + 1
        };
        if (forceOverwrite) {
            batch.set(docRef, data);
        } else {
            batch.set(docRef, data, { merge: true });
        }
    });
    
    batch.commit().then(function() {
        console.log('Successfully seeded ' + SEED_PRODUCTS.length + ' products!');
        window.alert('تم اضافة ' + SEED_PRODUCTS.length + ' منتج بنجاح!');
    }).catch(function(error) {
        console.error('Error seeding data:', error);
    });
}

window.seedFirestoreData = seedFirestoreData;
