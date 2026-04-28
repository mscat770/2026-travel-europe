import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, collection, query, where, onSnapshot, addDoc, updateDoc, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

const TRIP_ID = "europe-2026-trip";

export const uploadFile = async (file: File): Promise<string> => {
  const fileRef = ref(storage, `travel_files/${Date.now()}_${file.name}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
};

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

export const deleteEvent = async (eventId: string) => {
  const eventRef = doc(db, 'trips', TRIP_ID, 'events', eventId);
  await deleteDoc(eventRef);
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
    items.sort((a: any, b: any) => {
      // Priority 1: No time items go to the bottom
      if (a.noTime && !b.noTime) return 1;
      if (!a.noTime && b.noTime) return -1;
      
      // Priority 2: If both have time, compare time
      if (!a.noTime && !b.noTime) {
        const timeCompare = (a.time || '').localeCompare(b.time || '');
        if (timeCompare !== 0) return timeCompare;
      }
      
      // Priority 3: Fallback to order
      return (a.order || 0) - (b.order || 0);
    });
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
