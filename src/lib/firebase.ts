import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseAppletConfig from '../../firebase-applet-config.json';

const getConfigValue = (envVal: string | undefined, configVal: string | undefined) => {
  const val = (envVal || configVal || '').trim();
  // Filter out the variable name itself if it leaked into the bundle
  if (!val || val === 'undefined' || val === 'null' || val.includes('VITE_FIREBASE_')) {
    return (configVal || '').trim();
  }
  return val;
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: getConfigValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, firebaseAppletConfig.authDomain),
  projectId: getConfigValue(import.meta.env.VITE_FIREBASE_PROJECT_ID, firebaseAppletConfig.projectId),
  storageBucket: getConfigValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, firebaseAppletConfig.storageBucket),
  messagingSenderId: getConfigValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, firebaseAppletConfig.messagingSenderId),
  appId: getConfigValue(import.meta.env.VITE_FIREBASE_APP_ID, firebaseAppletConfig.appId),
  measurementId: getConfigValue(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, firebaseAppletConfig.measurementId),
  databaseId: getConfigValue(import.meta.env.VITE_FIREBASE_DATABASE_ID, firebaseAppletConfig.firestoreDatabaseId || '(default)'),
};

const apiKeyVal = String(firebaseConfig.apiKey || '');
console.log(`Firebase Config Info:`);
console.log(`- API Key length: ${apiKeyVal.length}`);
console.log(`- API Key prefix: ${apiKeyVal.substring(0, 4)}`);
console.log(`- Project ID: ${firebaseConfig.projectId}`);

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.databaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

const TRIP_ID = "europe-2026-trip";

export const addEvent = async (eventData: any) => {
  const collectionRef = collection(db, 'trips', TRIP_ID, 'events');
  return await addDoc(collectionRef, {
    ...eventData,
    dayIndex: Math.floor(Number(eventData.dayIndex)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const updateEvent = async (eventId: string, eventData: any) => {
  const eventRef = doc(db, 'trips', TRIP_ID, 'events', eventId);
  await updateDoc(eventRef, {
    ...eventData,
    updatedAt: serverTimestamp(),
  });
};

export const subscribeToEvents = (dayIndex: number, callback: (events: any[]) => void) => {
  const q = query(
    collection(db, 'trips', TRIP_ID, 'events'),
    where('dayIndex', '==', Math.floor(Number(dayIndex)))
  );

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    items.sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));
    callback(items);
  });
};

export const seedEventsIfEmpty = async () => {
  const path = `trips/${TRIP_ID}/events`;
  try {
    const snapshot = await getDocs(collection(db, path));
    if (snapshot.empty) {
      const initialEvents = [
        { time: '09:30', title: 'AMS Schiphol Arrival', cat: 'Transport', icon: 'Plane', location: 'Schiphol Airport, Amsterdam', desc: 'Terminal arrival and luggage collection. Transfer to city center via NS Train.', color: 'bg-orange-100 text-orange-600', dayIndex: 0 },
        { time: '12:00', title: 'Hotel Pulitzer Check-in', cat: 'Stay', icon: 'Hotel', location: 'Prinsengracht 323, Amsterdam', desc: 'Check into the historic canal house hotel. Quick refresh before city exploration.', color: 'bg-sky-100 text-sky-600', dayIndex: 0 },
        { time: '14:30', title: 'Anne Frank House', cat: 'Sights', icon: 'MapPin', location: 'Westermarkt 20, Amsterdam', desc: 'Self-guided tour with an audio guide through the Secret Annex.', color: 'bg-emerald-100 text-emerald-600', dayIndex: 0 },
        { time: '18:30', title: 'Canal Cruise Dinner', cat: 'Food', icon: 'Utensils', location: 'Central Station Pier', desc: 'Scenic twilight cruise through the historic canals with a 3-course Dutch meal.', color: 'bg-amber-100 text-amber-600', dayIndex: 0 }
      ];

      for (const ev of initialEvents) {
        await addDoc(collection(db, path), {
          ...ev,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      return true;
    }
  } catch (error) {
    console.warn("Seeding skipped or failed:", error);
  }
  return false;
};

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful");
  } catch (error) {
    console.error("Firestore connectivity test failed:", error);
  }
}
testConnection();
