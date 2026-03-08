// utils/tripStorage.js
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

function requireUser() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User is not logged in.");
  }
  return user;
}

function requireTripId(tripId) {
  if (!tripId) {
    throw new Error("Missing tripId.");
  }
  return String(tripId);
}

function tripsCollection() {
  const user = requireUser();
  return collection(db, "users", user.uid, "trips");
}

function tripDoc(tripId) {
  const user = requireUser();
  return doc(db, "users", user.uid, "trips", requireTripId(tripId));
}

function itemsCollection(tripId) {
  const user = requireUser();
  return collection(
    db,
    "users",
    user.uid,
    "trips",
    requireTripId(tripId),
    "items"
  );
}

function itemDoc(tripId, itemId) {
  const user = requireUser();
  return doc(
    db,
    "users",
    user.uid,
    "trips",
    requireTripId(tripId),
    "items",
    String(itemId)
  );
}

export function formatTime(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const minuteText = String(minutes).padStart(2, "0");
  return `${hour12}:${minuteText} ${suffix}`;
}

export async function createTrip(trip) {
  const ref = tripsCollection();

  const payload = {
    title: trip.title || "Untitled Trip",
    city: trip.city || "",
    country: trip.country || "",
    imageKey: trip.imageKey || "",
    startDate: trip.startDate || "",
    endDate: trip.endDate || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const newRef = await addDoc(ref, payload);

  await setDoc(
    newRef,
    {
      id: newRef.id,
    },
    { merge: true }
  );

  return newRef.id;
}

export async function getTrips() {
  const snap = await getDocs(query(tripsCollection()));
  const trips = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  return trips.sort((a, b) => {
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
}

export async function getTripById(tripId) {
  const snap = await getDoc(tripDoc(tripId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

function normalizeItem(item, docId) {
  return {
    id: item.id || docId,
    category: item.category || "activity",
    description: item.description || "",
    location: item.location || "",
    reservationNumber: item.reservationNumber || "",
    price: item.price ?? 50,
    month: item.month || "Jan",
    year: item.year || 2026,
    day: item.day || 1,
    dateLabel: item.dateLabel || "",
    hour24: item.hour24 ?? 12,
    minute: item.minute ?? 0,
    timeLabel: item.timeLabel || "",
    attachments: Array.isArray(item.attachments) ? item.attachments : [],
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function sortItems(items) {
  const monthOrder = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };

  return [...items].sort((a, b) => {
    const yearDiff = (a.year || 0) - (b.year || 0);
    if (yearDiff !== 0) return yearDiff;

    const monthDiff = (monthOrder[a.month] ?? 0) - (monthOrder[b.month] ?? 0);
    if (monthDiff !== 0) return monthDiff;

    const dayDiff = (a.day || 0) - (b.day || 0);
    if (dayDiff !== 0) return dayDiff;

    const hourDiff = (a.hour24 ?? 0) - (b.hour24 ?? 0);
    if (hourDiff !== 0) return hourDiff;

    return (a.minute ?? 0) - (b.minute ?? 0);
  });
}

export async function getTripItems(tripId) {
  const snap = await getDocs(query(itemsCollection(tripId)));
  const items = snap.docs.map((d) => normalizeItem(d.data(), d.id));
  return sortItems(items);
}

export async function getTripItemById(tripId, itemId) {
  const snap = await getDoc(itemDoc(tripId, itemId));
  if (!snap.exists()) return null;
  return normalizeItem(snap.data(), snap.id);
}

export async function upsertTripItem(tripId, item) {
  if (item.id) {
    await setDoc(
      itemDoc(tripId, item.id),
      {
        ...normalizeItem(item, item.id),
        id: String(item.id),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return String(item.id);
  }

  const newRef = await addDoc(itemsCollection(tripId), {
    ...normalizeItem(item, ""),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(newRef, { id: newRef.id }, { merge: true });
  return newRef.id;
}

export async function saveTripItems(tripId, items) {
  for (const item of items) {
    await upsertTripItem(tripId, item);
  }
}

export async function deleteTripItem(tripId, itemId) {
  await deleteDoc(itemDoc(tripId, itemId));
}