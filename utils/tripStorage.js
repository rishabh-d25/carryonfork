import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";

function createItemId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createPictureId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getCurrentUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error("No authenticated user found.");
  }
  return uid;
}

function getActivitiesCollectionRef(tripId) {
  const uid = getCurrentUid();
  return collection(db, "users", uid, "trips", String(tripId), "activities");
}

function getActivityDocRef(tripId, itemId) {
  const uid = getCurrentUid();
  return doc(db, "users", uid, "trips", String(tripId), "activities", String(itemId));
}

function getPicturesCollectionRef(tripId, itemId) {
  const uid = getCurrentUid();
  return collection(
    db,
    "users",
    uid,
    "trips",
    String(tripId),
    "activities",
    String(itemId),
    "pictures"
  );
}

function getPictureDocRef(tripId, itemId, pictureId) {
  const uid = getCurrentUid();
  return doc(
    db,
    "users",
    uid,
    "trips",
    String(tripId),
    "activities",
    String(itemId),
    "pictures",
    String(pictureId)
  );
}

function getStoragePath(tripId, itemId, pictureId, filename = "photo.jpg") {
  const uid = getCurrentUid();
  const safeName = String(filename).replace(/[^\w.\-]/g, "_");
  return `users/${uid}/trips/${tripId}/activities/${itemId}/pictures/${pictureId}/${safeName}`;
}

function isRemoteUri(uri) {
  return typeof uri === "string" && /^https?:\/\//i.test(uri);
}

async function uriToBlob(uri) {
  const response = await fetch(uri);
  return await response.blob();
}

export function formatTime(date) {
  if (!date) return "";

  const hours = date.getHours();
  const minutes = date.getMinutes();

  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinute = String(minutes).padStart(2, "0");

  return `${displayHour}:${displayMinute} ${suffix}`;
}

export async function getTripItems(tripId) {
  try {
    const snapshot = await getDocs(getActivitiesCollectionRef(tripId));

    const items = [];

    for (const activityDoc of snapshot.docs) {
      const activityData = activityDoc.data() || {};
      const picturesSnapshot = await getDocs(
        getPicturesCollectionRef(tripId, activityDoc.id)
      );

      const attachments = picturesSnapshot.docs.map((pictureDoc) => {
        const pictureData = pictureDoc.data() || {};
        return {
          id: pictureDoc.id,
          ...pictureData,
        };
      });

      items.push({
        id: activityDoc.id,
        ...activityData,
        attachments,
      });
    }

    return items;
  } catch (error) {
    console.log("getTripItems error:", error);
    return [];
  }
}

export async function getTripItemById(tripId, itemId) {
  try {
    const activityRef = getActivityDocRef(tripId, itemId);
    const activitySnap = await getDoc(activityRef);

    if (!activitySnap.exists()) {
      return null;
    }

    const activityData = activitySnap.data() || {};
    const picturesSnapshot = await getDocs(getPicturesCollectionRef(tripId, itemId));

    const attachments = picturesSnapshot.docs.map((pictureDoc) => {
      const pictureData = pictureDoc.data() || {};
      return {
        id: pictureDoc.id,
        ...pictureData,
      };
    });

    return {
      id: activitySnap.id,
      ...activityData,
      attachments,
    };
  } catch (error) {
    console.log("getTripItemById error:", error);
    return null;
  }
}

export async function saveTripItems(tripId, items) {
  try {
    const savedItems = [];

    for (const item of items || []) {
      const saved = await upsertTripItem(tripId, item);
      savedItems.push(saved);
    }

    return savedItems;
  } catch (error) {
    console.log("saveTripItems error:", error);
    throw error;
  }
}

export async function upsertTripItem(tripId, item) {
  try {
    const itemId = item?.id ? String(item.id) : createItemId();
    const activityRef = getActivityDocRef(tripId, itemId);

    const {
      attachments = [],
      dateObject,
      ...activityFields
    } = item || {};

    const safeItem = {
      ...activityFields,
      id: itemId,
      updatedAt: serverTimestamp(),
    };

    const existingSnap = await getDoc(activityRef);

    if (!existingSnap.exists()) {
      safeItem.createdAt = serverTimestamp();
    }

    await setDoc(activityRef, safeItem, { merge: true });

    const picturesRef = getPicturesCollectionRef(tripId, itemId);
    const currentPicturesSnap = await getDocs(picturesRef);

    const existingPictureIds = currentPicturesSnap.docs.map((docSnap) => docSnap.id);
    const nextPictureIds = (attachments || []).map((attachment) => String(attachment.id));

    const pictureIdsToDelete = existingPictureIds.filter(
      (existingId) => !nextPictureIds.includes(existingId)
    );

    for (const pictureId of pictureIdsToDelete) {
      const pictureRef = getPictureDocRef(tripId, itemId, pictureId);
      const pictureSnap = await getDoc(pictureRef);

      if (pictureSnap.exists()) {
        const pictureData = pictureSnap.data() || {};
        if (pictureData.storagePath) {
          try {
            const storageRef = ref(storage, pictureData.storagePath);
            await deleteObject(storageRef);
          } catch (storageError) {
            console.log("delete storage object error:", storageError);
          }
        }
      }

      await deleteDoc(pictureRef);
    }

    for (const attachment of attachments || []) {
      if (!attachment?.id) continue;

      const pictureRef = getPictureDocRef(tripId, itemId, attachment.id);

      await setDoc(
        pictureRef,
        {
          id: String(attachment.id),
          name: attachment.name || "Photo",
          type: attachment.type || "image",
          uri: attachment.uri || "",
          downloadURL: attachment.downloadURL || attachment.uri || "",
          mimeType: attachment.mimeType || "",
          storagePath: attachment.storagePath || "",
          updatedAt: serverTimestamp(),
          createdAt: attachment.createdAt || serverTimestamp(),
        },
        { merge: true }
      );
    }

    return await getTripItemById(tripId, itemId);
  } catch (error) {
    console.log("upsertTripItem error:", error);
    throw error;
  }
}

export async function deleteTripItem(tripId, itemId) {
  try {
    const picturesSnapshot = await getDocs(getPicturesCollectionRef(tripId, itemId));

    for (const pictureDoc of picturesSnapshot.docs) {
      const pictureData = pictureDoc.data() || {};

      if (pictureData.storagePath) {
        try {
          const storageRef = ref(storage, pictureData.storagePath);
          await deleteObject(storageRef);
        } catch (storageError) {
          console.log("delete picture from storage error:", storageError);
        }
      }

      await deleteDoc(pictureDoc.ref);
    }

    await deleteDoc(getActivityDocRef(tripId, itemId));
  } catch (error) {
    console.log("deleteTripItem error:", error);
    throw error;
  }
}

export async function uploadTripAttachment(tripId, itemId, attachment) {
  try {
    const activityId = itemId ? String(itemId) : createItemId();
    const pictureId = attachment?.id ? String(attachment.id) : createPictureId();

    if (isRemoteUri(attachment?.downloadURL || attachment?.uri)) {
      const existingRemote = attachment.downloadURL || attachment.uri;

      const pictureDoc = {
        id: pictureId,
        name: attachment?.name || "Photo",
        type: attachment?.type || "image",
        uri: existingRemote,
        downloadURL: existingRemote,
        mimeType: attachment?.mimeType || "",
        storagePath: attachment?.storagePath || "",
      };

      await setDoc(
        getPictureDocRef(tripId, activityId, pictureId),
        {
          ...pictureDoc,
          updatedAt: serverTimestamp(),
          createdAt: attachment?.createdAt || serverTimestamp(),
        },
        { merge: true }
      );

      return pictureDoc;
    }

    const blob = await uriToBlob(attachment.uri);
    const storagePath = getStoragePath(
      tripId,
      activityId,
      pictureId,
      attachment?.name || "photo.jpg"
    );

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob);

    const downloadURL = await getDownloadURL(storageRef);

    const pictureDoc = {
      id: pictureId,
      name: attachment?.name || "Photo",
      type: attachment?.type || "image",
      uri: attachment?.uri || "",
      downloadURL,
      mimeType: attachment?.mimeType || "",
      storagePath,
    };

    await setDoc(
      getPictureDocRef(tripId, activityId, pictureId),
      {
        ...pictureDoc,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return pictureDoc;
  } catch (error) {
    console.log("uploadTripAttachment error:", error);
    throw error;
  }
}