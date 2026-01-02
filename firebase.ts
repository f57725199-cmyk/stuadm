import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore, doc, setDoc, getDoc, collection, updateDoc, deleteDoc, onSnapshot, getDocs, query, where, getCountFromServer } from "firebase/firestore";
import { getDatabase, ref, set, get, onValue, update, remove } from "firebase/database";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// --- FIREBASE CONFIGURATION (PROVIDED BY USER) ---
const defaultFirebaseConfig = {
  apiKey: "AIzaSyB8HAnSpjO7ljNPzYNamfopTPLblr0ErSU",
  authDomain: "nsta-b09a4.firebaseapp.com",
  projectId: "nsta-b09a4",
  storageBucket: "nsta-b09a4.firebasestorage.app",
  messagingSenderId: "874802599278",
  appId: "1:874802599278:web:79406811f06f0352f31d7f",
  databaseURL: "https://nsta-b09a4-default-rtdb.firebaseio.com"
};

// --- DYNAMIC CONFIG LOADER (Allows Admin to Switch Backend) ---
const getActiveConfig = () => {
  try {
    const stored = localStorage.getItem('nst_firebase_config');
    if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.apiKey) return parsed; // Basic validation
    }
  } catch (e) {
    console.error("Invalid Custom Config", e);
  }
  return defaultFirebaseConfig;
};

const firebaseConfig = getActiveConfig();

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics;
isSupported().then(yes => yes ? analytics = getAnalytics(app) : null);

const db = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);

// --- EXPORTED HELPERS ---

export const checkFirebaseConnection = () => {
  return true; 
};

export const subscribeToAuth = (callback: (user: any) => void) => {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
};

// --- DUAL WRITE / SMART READ LOGIC ---
// V3 UPGRADE: New Root Nodes (users_v3, system_settings_v3, content_data_v3)

// 1. User Data Sync
export const saveUserToLive = async (user: any) => {
  try {
    if (!user || !user.id) return;
    
    // 1. RTDB
    const userRef = ref(rtdb, `users_v3/${user.id}`);
    await set(userRef, user);
    
    // 2. Firestore (Dual Write)
    await setDoc(doc(db, "users_v3", user.id), user);
  } catch (error) {
    console.error("Error saving user:", error);
  }
};

export const subscribeToUsers = (callback: (users: any[]) => void) => {
  console.log("Subscribing to Users via Realtime Database (Primary)...");
  
  const usersRef = ref(rtdb, 'users_v3');
  const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      const userList = data ? Object.values(data) : [];
      callback(userList);
  }, (error) => {
      console.error("RTDB Subscription Error:", error);
  });

  return () => unsubscribe();
};

export const getUserData = async (userId: string) => {
    try {
        // Try RTDB
        const snap = await get(ref(rtdb, `users_v3/${userId}`));
        if (snap.exists()) return snap.val();
        
        // Try Firestore
        const docSnap = await getDoc(doc(db, "users_v3", userId));
        if (docSnap.exists()) return docSnap.data();

        return null;
    } catch (e) { console.error(e); return null; }
};

export const getUserByEmail = async (email: string) => {
    try {
        const q = query(collection(db, "users_v3"), where("email", "==", email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].data();
        }
        return null; 
    } catch (e) { console.error(e); return null; }
};

// NEW: Helper to check if DB is empty (for First User Admin Logic)
export const isUserDatabaseEmpty = async () => {
    try {
        // We use Firestore Count for reliability or check if any user exists in RTDB
        // Checking RTDB is faster and cheaper
        const snapshot = await get(ref(rtdb, 'users_v3'));
        // If snapshot is null or empty object, it's empty
        return !snapshot.exists() || Object.keys(snapshot.val() || {}).length === 0;
    } catch (e) {
        console.error("Error checking DB empty:", e);
        // Fallback to Firestore
        try {
            const coll = collection(db, "users_v3");
            const snapshot = await getCountFromServer(coll);
            return snapshot.data().count === 0;
        } catch (e2) {
            console.error("Error checking Firestore DB empty:", e2);
            return false; // Fail safe
        }
    }
};

// 2. System Settings Sync
export const saveSystemSettings = async (settings: any) => {
  try {
    await set(ref(rtdb, 'system_settings_v3'), settings);
    await setDoc(doc(db, "config", "system_settings_v3"), settings);
  } catch (error) {
    console.error("Error saving settings:", error);
  }
};

export const subscribeToSettings = (callback: (settings: any) => void) => {
  // Listen to Firestore
  return onSnapshot(doc(db, "config", "system_settings_v3"), (docSnap) => {
      if (docSnap.exists()) {
          callback(docSnap.data());
      } else {
          // Fallback RTDB
           onValue(ref(rtdb, 'system_settings_v3'), (snap) => {
               const data = snap.val();
               if (data) callback(data);
           }, { onlyOnce: true });
      }
  });
};

// 3. Content Links Sync (Bulk Uploads)
export const bulkSaveLinks = async (updates: Record<string, any>) => {
  try {
    // RTDB
    await update(ref(rtdb, 'content_links_v3'), updates);
    
    // Firestore
    const batchPromises = Object.entries(updates).map(async ([key, data]) => {
         await setDoc(doc(db, "content_data_v3", key), data);
    });
    await Promise.all(batchPromises);

  } catch (error) {
    console.error("Error bulk saving links:", error);
  }
};

// 4. Chapter Data Sync (Individual)
export const saveChapterData = async (key: string, data: any) => {
  try {
    await set(ref(rtdb, `content_data_v3/${key}`), data);
    await setDoc(doc(db, "content_data_v3", key), data);
  } catch (error) {
    console.error("Error saving chapter data:", error);
  }
};

export const getChapterData = async (key: string) => {
    try {
        // 1. Try RTDB (Faster)
        const snapshot = await get(ref(rtdb, `content_data_v3/${key}`));
        if (snapshot.exists()) {
            return snapshot.val();
        }
        
        // 2. Fallback to Firestore
        const docSnap = await getDoc(doc(db, "content_data_v3", key));
        if (docSnap.exists()) {
            return docSnap.data();
        }
        
        return null;
    } catch (error) {
        console.error("Error getting chapter data:", error);
        return null;
    }
};

// Used by client to listen for realtime changes to a specific chapter
export const subscribeToChapterData = (key: string, callback: (data: any) => void) => {
    const rtdbRef = ref(rtdb, `content_data_v3/${key}`);
    return onValue(rtdbRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            getDoc(doc(db, "content_data_v3", key)).then(docSnap => {
                if (docSnap.exists()) callback(docSnap.data());
            });
        }
    });
};


export const saveTestResult = async (userId: string, attempt: any) => {
    try {
        const docId = `${attempt.testId}_${Date.now()}`;
        await setDoc(doc(db, "users_v3", userId, "test_results", docId), attempt);
    } catch(e) { console.error(e); }
};

export const updateUserStatus = async (userId: string, time: number) => {
     try {
        const userRef = ref(rtdb, `users_v3/${userId}`);
        await update(userRef, { lastActiveTime: new Date().toISOString() });
    } catch (error) {
    }
};

export { app, db, rtdb, auth };
