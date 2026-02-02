import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCsgMN0SWCC1SvCDIakYBejTWlxwBmiwJk",
    authDomain: "robodone-dashboard.firebaseapp.com",
    projectId: "robodone-dashboard",
    storageBucket: "robodone-dashboard.firebasestorage.app",
    messagingSenderId: "457095919160",
    appId: "1:457095919160:web:1716af87290b63733598cd"
};

let db = null;
let auth = null;
let isFirebaseInitialized = false;

try {
    const app = initializeApp(FIREBASE_CONFIG);
    db = getFirestore(app);
    auth = getAuth(app);
    isFirebaseInitialized = true;
    
    // オフライン永続化
    enableIndexedDbPersistence(db).catch((err) => {
        console.warn("Persistence Error:", err.code);
    });
} catch (e) {
    console.error("Firebase Init Error:", e);
}

export { db, auth, isFirebaseInitialized };