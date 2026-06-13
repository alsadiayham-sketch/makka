(function (global) {
    if (typeof firebase === 'undefined') {
        global.firebaseInitFailed = true;
        return;
    }

    var firebaseConfig = {
        apiKey: 'AIzaSyAIsq4QV6wxwMb8phPa3tU14p2NRSXvTdY',
        authDomain: 'dimaboutique-b4f16.firebaseapp.com',
        projectId: 'dimaboutique-b4f16',
        storageBucket: 'dimaboutique-b4f16.firebasestorage.app',
        messagingSenderId: '438611658146',
        appId: '1:438611658146:web:83b1a97cfc42bd12aadefb',
        measurementId: 'G-TWLMJT4Y8R'
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    var rawDb = firebase.firestore();
    var PROJECT_ID = 'makka';
    var projectRef = rawDb.collection('projects').doc(PROJECT_ID);

    var db = {
        collection: function (name) {
            return projectRef.collection(name);
        },
        batch: function () {
            return rawDb.batch();
        },
        runTransaction: function (fn) {
            return rawDb.runTransaction(fn);
        }
    };

    // Separate reference for admin auth (outside project scope for security)
    var adminRef = rawDb.collection('projects').doc(PROJECT_ID).collection('admin_auth').doc('credentials');

    global.firebaseConfig = firebaseConfig;
    global.db = db;
    global.rawDb = rawDb;
    global.projectRef = projectRef;
    global.PROJECT_ID = PROJECT_ID;
    // adminRef only accessible on admin page
    if (document.getElementById('loginScreen')) {
        global.adminRef = adminRef;
    }
    global.dimaFirebase = {
        app: firebase.app(),
        db: db,
        rawDb: rawDb,
        FieldValue: firebase.firestore.FieldValue,
        Timestamp: firebase.firestore.Timestamp,
        collection: function (name) {
            return projectRef.collection(name);
        }
    };
})(window);
