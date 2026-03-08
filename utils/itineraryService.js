// utils/itineraryService.js
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

function requireUser() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User is not logged in.");
  }
  return user;
}

function itineraryCollectionRef(tripId) {
  const user = requireUser();

  return collection(
    db,
    "users",
    user.uid,
    "trips",
    tripId,
    "itineraryItems"
  );
}

export async function saveActivity(tripId, activity) {
  const ref = itineraryCollectionRef(tripId);

  const docRef = await addDoc(ref, {
    ...activity,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function saveActivities(tripId, activities) {
  const ids = [];

  for (const activity of activities) {
    const id = await saveActivity(tripId, activity);
    ids.push(id);
  }

  return ids;
}

export async function getActivities(tripId) {
  const ref = itineraryCollectionRef(tripId);
  const q = query(ref, orderBy("date", "asc"), orderBy("time", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function updateActivity(tripId, activityId, updates) {
  const user = requireUser();

  const ref = doc(
    db,
    "users",
    user.uid,
    "trips",
    tripId,
    "itineraryItems",
    activityId
  );

  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteActivity(tripId, activityId) {
  const user = requireUser();

  const ref = doc(
    db,
    "users",
    user.uid,
    "trips",
    tripId,
    "itineraryItems",
    activityId
  );

  await deleteDoc(ref);
}