import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, collection, query, where, onSnapshot, addDoc, updateDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyACbl1m5AvjaK6-lzOHQaPNhi1B2K3dYsE',
  authDomain: 'gen-lang-client-0972957793.firebaseapp.com',
  projectId: 'gen-lang-client-0972957793',
  storageBucket: 'gen-lang-client-0972957793.firebasestorage.app',
  messagingSenderId: '432237418767',
  appId: '1:432237418767:web:914ba09a83145fc389467a',
  measurementId: '',
};

const databaseId = '(default)';
console.log("[Firebase] Switching to (default) Database ID for testing rules.");

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, databaseId);
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
  }, (error) => {
    console.error("Firestore Snapshot Error at trips/" + TRIP_ID + "/events:", error);
  });
};

export const clearAllEvents = async () => {
  const path = `trips/${TRIP_ID}/events`;
  try {
    const snapshot = await getDocs(collection(db, path));
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    console.log("[Firebase] All events cleared.");
    return true;
  } catch (error) {
    console.error("[Firebase] Error clearing events:", error);
    return false;
  }
};

export const seedEventsIfEmpty = async () => {
  // User requested clean start, so we no longer seed example data.
  return false;
};
