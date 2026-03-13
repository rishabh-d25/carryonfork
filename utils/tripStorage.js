import { auth, db, storage } from "../firebaseConfig";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

function requireUser() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User is not signed in.");
  }
  return user;
}

function isRemoteUri(uri) {
  return typeof uri === "string" && /^https?:\/\//i.test(uri);
}

function sanitizeFileName(name = "file") {
  return String(name).replace(/[^\w.\-]/g, "_");
}

function getExtensionFromUri(uri = "") {
  const clean = String(uri).split("?")[0];
  const parts = clean.split(".");
  return parts.length > 1 ? parts.pop() : "";
}

function uriToBlob(uri) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.onload = function () {
      resolve(xhr.response);
    };

    xhr.onerror = function () {
      reject(new TypeError("Failed to convert file URI to blob."));
    };

    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
}

function normalizeAttachment(attachment) {
  if (!attachment) return null;

  const downloadURL = attachment.downloadURL || attachment.uri || "";

  return {
    id: attachment.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: attachment.type || "document",
    name: attachment.name || "Attachment",
    uri: downloadURL,
    downloadURL,
    mimeType: attachment.mimeType || "",
    storagePath: attachment.storagePath || "",
  };
}

function normalizeItem(item) {
  const attachments = Array.isArray(item?.attachments)
    ? item.attachments.map(normalizeAttachment).filter(Boolean)
    : [];

  return {
    ...item,
    attachments,
  };
}

export function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? "PM" : "AM";

  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;

  return `${hours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export async function uploadTripAttachment(tripId, itemId, attachment) {
  const user = requireUser();

  if (!tripId || !itemId || !attachment) {
    throw new Error("Missing tripId, itemId, or attachment.");
  }

  if (attachment.downloadURL || isRemoteUri(attachment.uri)) {
    return normalizeAttachment({
      ...attachment,
      downloadURL: attachment.downloadURL || attachment.uri,
      uri: attachment.downloadURL || attachment.uri,
    });
  }

  const originalUri = attachment.uri;
  if (!originalUri) {
    throw new Error("Attachment is missing a local URI.");
  }

  const blob = await uriToBlob(originalUri);

  const extFromName = attachment.name?.includes(".")
    ? attachment.name.split(".").pop()
    : "";
  const extFromUri = getExtensionFromUri(originalUri);
  const ext = extFromName || extFromUri || (attachment.type === "image" ? "jpg" : "dat");

  const baseName = sanitizeFileName(
    attachment.name || `${attachment.type || "file"}.${ext}`
  );

  const storagePath = `users/${user.uid}/trips/${tripId}/items/${itemId}/${Date.now()}-${baseName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, blob, {
    contentType:
      attachment.mimeType ||
      (attachment.type === "image" ? `image/${ext}` : "application/octet-stream"),
  });

  if (blob && typeof blob.close === "function") {
    blob.close();
  }

  const downloadURL = await getDownloadURL(storageRef);

  return normalizeAttachment({
    ...attachment,
    uri: downloadURL,
    downloadURL,
    storagePath,
  });
}

export async function getTripItems(tripId) {
  const user = requireUser();

  if (!tripId) return [];

  const itemsRef = collection(
    db,
    "users",
    user.uid,
    "trips",
    String(tripId),
    "items"
  );

  const snapshot = await getDocs(itemsRef);

  return snapshot.docs.map((docSnap) =>
    normalizeItem({
      id: docSnap.id,
      ...docSnap.data(),
    })
  );
}

export async function getTripItemById(tripId, itemId) {
  const user = requireUser();

  if (!tripId || !itemId) return null;

  const itemRef = doc(
    db,
    "users",
    user.uid,
    "trips",
    String(tripId),
    "items",
    String(itemId)
  );

  const snapshot = await getDoc(itemRef);

  if (!snapshot.exists()) return null;

  return normalizeItem({
    id: snapshot.id,
    ...snapshot.data(),
  });
}

export async function upsertTripItem(tripId, item) {
  const user = requireUser();

  if (!tripId || !item) {
    throw new Error("Missing tripId or item.");
  }

  const itemsCollectionRef = collection(
    db,
    "users",
    user.uid,
    "trips",
    String(tripId),
    "items"
  );

  const itemId = item.id || doc(itemsCollectionRef).id;

  const payload = normalizeItem({
    ...item,
    id: itemId,
    updatedAt: Date.now(),
    createdAt: item.createdAt || Date.now(),
  });

  await setDoc(
    doc(
      db,
      "users",
      user.uid,
      "trips",
      String(tripId),
      "items",
      String(itemId)
    ),
    payload,
    { merge: true }
  );

  return payload;
}

export async function deleteTripItem(tripId, itemId) {
  const user = requireUser();

  if (!tripId || !itemId) {
    throw new Error("Missing tripId or itemId.");
  }

  await deleteDoc(
    doc(
      db,
      "users",
      user.uid,
      "trips",
      String(tripId),
      "items",
      String(itemId)
    )
  );
}