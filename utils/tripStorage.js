import * as FileSystem from "expo-file-system";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

function requireUser() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be logged in.");
  }
  return user;
}

function itemDocRef(uid, tripId, itemId) {
  return doc(db, "users", uid, "trips", tripId, "itinerary", itemId);
}

function itineraryCollectionRef(uid, tripId) {
  return collection(db, "users", uid, "trips", tripId, "itinerary");
}

function sanitizeName(name) {
  return String(name || "file").replace(/[^\w.\-]+/g, "_");
}

async function ensureDirExists(dir) {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

export function formatTime(dateOrHour, maybeMinute) {
  let hour;
  let minute;

  if (dateOrHour instanceof Date) {
    hour = dateOrHour.getHours();
    minute = dateOrHour.getMinutes();
  } else {
    hour = Number(dateOrHour ?? 0);
    minute = Number(maybeMinute ?? 0);
  }

  const normalizedHour = hour % 12 || 12;
  const ampm = hour >= 12 ? "PM" : "AM";
  const paddedMinute = String(minute).padStart(2, "0");

  return `${normalizedHour}:${paddedMinute} ${ampm}`;
}

export async function getTripItems(tripId) {
  const user = requireUser();
  const snapshot = await getDocs(itineraryCollectionRef(user.uid, tripId));

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function getTripItemById(tripId, itemId) {
  const user = requireUser();
  const snap = await getDoc(itemDocRef(user.uid, tripId, itemId));

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data(),
  };
}

export async function upsertTripItem(tripId, item) {
  const user = requireUser();

  const itemId =
    item?.id?.toString?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const refToUse = itemDocRef(user.uid, tripId, itemId);

  const safeAttachments = Array.isArray(item?.attachments)
    ? item.attachments.map((attachment) => ({
        ...attachment,
        id: String(attachment.id),
      }))
    : [];

  const existingSnap = await getDoc(refToUse);
  const existingData = existingSnap.exists() ? existingSnap.data() : null;

  const payload = {
    ...item,
    id: itemId,
    attachments: safeAttachments,
    updatedAt: serverTimestamp(),
    createdAt: existingData?.createdAt || item?.createdAt || serverTimestamp(),
  };

  await setDoc(refToUse, payload, { merge: true });

  return itemId;
}

export async function deleteTripItem(tripId, itemId) {
  const user = requireUser();
  await deleteDoc(itemDocRef(user.uid, tripId, itemId));
}

export async function persistTripAttachmentLocally(tripId, itemId, attachment) {
  if (!attachment?.uri) {
    throw new Error("Attachment is missing a local URI.");
  }

  const user = requireUser();

  const baseDir =
    (FileSystem.documentDirectory || FileSystem.cacheDirectory) +
    `tripAttachments/${user.uid}/${tripId}/${itemId}/`;

  await ensureDirExists(baseDir);

  const safeName = sanitizeName(
    attachment.name || `${attachment.type || "file"}-${Date.now()}`
  );

  const destinationUri = `${baseDir}${Date.now()}-${safeName}`;

  const alreadyThere = attachment.uri === destinationUri;

  if (!alreadyThere) {
    await FileSystem.copyAsync({
      from: attachment.uri,
      to: destinationUri,
    });
  }

  return {
    id: String(attachment.id),
    type: attachment.type || "document",
    name: attachment.name || safeName,
    mimeType: attachment.mimeType || "application/octet-stream",
    uri: destinationUri,
    localUri: destinationUri,
    isLocalPersisted: true,
  };
}