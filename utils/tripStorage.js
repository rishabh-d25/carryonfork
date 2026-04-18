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

function getResolvedUid(ownerUid) {
  return ownerUid || getCurrentUid();
}

function getItineraryCollectionRef(tripId, ownerUid) {
  const uid = getResolvedUid(ownerUid);
  return collection(db, "users", uid, "trips", String(tripId), "itinerary");
}

function getItineraryItemDocRef(tripId, itemId, ownerUid) {
  const uid = getResolvedUid(ownerUid);
  return doc(db, "users", uid, "trips", String(tripId), "itinerary", String(itemId));
}

function getPicturesCollectionRef(tripId, itemId, ownerUid) {
  const uid = getResolvedUid(ownerUid);
  return collection(
    db,
    "users",
    uid,
    "trips",
    String(tripId),
    "itinerary",
    String(itemId),
    "pictures"
  );
}

function getPictureDocRef(tripId, itemId, pictureId, ownerUid) {
  const uid = getResolvedUid(ownerUid);
  return doc(
    db,
    "users",
    uid,
    "trips",
    String(tripId),
    "itinerary",
    String(itemId),
    "pictures",
    String(pictureId)
  );
}

function getStoragePath(tripId, itemId, pictureId, filename = "photo.jpg", ownerUid) {
  const uid = getResolvedUid(ownerUid);
  const safeName = String(filename).replace(/[^\w.\-]/g, "_");
  return `users/${uid}/trips/${tripId}/itinerary/${itemId}/pictures/${pictureId}/${safeName}`;
}

function isRemoteUri(uri) {
  return typeof uri === "string" && /^https?:\/\//i.test(uri);
}

async function uriToBlob(uri) {
  const response = await fetch(uri);
  return await response.blob();
}

function serializePictureDoc(pictureDoc) {
  const pictureData = pictureDoc.data() || {};
  return {
    id: pictureDoc.id,
    ...pictureData,
  };
}

function sortPicturesByCreatedAt(pictures) {
  return [...pictures].sort((a, b) => {
    const aSeconds = a?.createdAt?.seconds || 0;
    const bSeconds = b?.createdAt?.seconds || 0;
    return aSeconds - bSeconds;
  });
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

export async function getTripItems(tripId, ownerUid) {
  try {
    const snapshot = await getDocs(getItineraryCollectionRef(tripId, ownerUid));

    const items = [];

    for (const itineraryDoc of snapshot.docs) {
      const itineraryData = itineraryDoc.data() || {};
      const picturesSnapshot = await getDocs(
        getPicturesCollectionRef(tripId, itineraryDoc.id, ownerUid)
      );

      const attachments = sortPicturesByCreatedAt(
        picturesSnapshot.docs.map(serializePictureDoc)
      );

      items.push({
        id: itineraryDoc.id,
        ...itineraryData,
        attachments,
      });
    }

    return items;
  } catch (error) {
    console.log("getTripItems error:", error);
    return [];
  }
}

export async function getTripItemById(tripId, itemId, ownerUid) {
  try {
    const itemRef = getItineraryItemDocRef(tripId, itemId, ownerUid);
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      return null;
    }

    const itemData = itemSnap.data() || {};
    const picturesSnapshot = await getDocs(
      getPicturesCollectionRef(tripId, itemId, ownerUid)
    );

    const attachments = sortPicturesByCreatedAt(
      picturesSnapshot.docs.map(serializePictureDoc)
    );

    return {
      id: itemSnap.id,
      ...itemData,
      attachments,
    };
  } catch (error) {
    console.log("getTripItemById error:", error);
    return null;
  }
}

export async function saveTripItems(tripId, items, ownerUid) {
  try {
    const savedItems = [];

    for (const item of items || []) {
      const saved = await upsertTripItem(tripId, item, ownerUid);
      savedItems.push(saved);
    }

    return savedItems;
  } catch (error) {
    console.log("saveTripItems error:", error);
    throw error;
  }
}

export async function upsertTripItem(tripId, item, ownerUid) {
  try {
    const itemId = item?.id ? String(item.id) : createItemId();
    const itemRef = getItineraryItemDocRef(tripId, itemId, ownerUid);

    const {
      attachments = [],
      dateObject,
      ...itemFields
    } = item || {};

    const safeItem = {
      ...itemFields,
      id: itemId,
      updatedAt: serverTimestamp(),
    };

    const existingSnap = await getDoc(itemRef);
    if (!existingSnap.exists()) {
      safeItem.createdAt = serverTimestamp();
    }

    await setDoc(itemRef, safeItem, { merge: true });

    const currentPicturesSnap = await getDocs(
      getPicturesCollectionRef(tripId, itemId, ownerUid)
    );
    const existingPictureIds = currentPicturesSnap.docs.map((docSnap) => docSnap.id);
    const nextPictureIds = (attachments || []).map((attachment) => String(attachment.id));

    const pictureIdsToDelete = existingPictureIds.filter(
      (existingId) => !nextPictureIds.includes(existingId)
    );

    for (const pictureId of pictureIdsToDelete) {
      const pictureRef = getPictureDocRef(tripId, itemId, pictureId, ownerUid);
      const pictureSnap = await getDoc(pictureRef);

      if (pictureSnap.exists()) {
        const pictureData = pictureSnap.data() || {};
        if (pictureData.storagePath) {
          try {
            await deleteObject(ref(storage, pictureData.storagePath));
          } catch (storageError) {
            console.log("delete storage object error:", storageError);
          }
        }
      }

      await deleteDoc(pictureRef);
    }

    for (const attachment of attachments || []) {
      if (!attachment?.id) continue;

      const pictureRef = getPictureDocRef(tripId, itemId, attachment.id, ownerUid);

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

    return await getTripItemById(tripId, itemId, ownerUid);
  } catch (error) {
    console.log("upsertTripItem error:", error);
    throw error;
  }
}

export async function deleteTripItem(tripId, itemId, ownerUid) {
  try {
    const picturesSnapshot = await getDocs(
      getPicturesCollectionRef(tripId, itemId, ownerUid)
    );

    for (const pictureDoc of picturesSnapshot.docs) {
      const pictureData = pictureDoc.data() || {};

      if (pictureData.storagePath) {
        try {
          await deleteObject(ref(storage, pictureData.storagePath));
        } catch (storageError) {
          console.log("delete picture from storage error:", storageError);
        }
      }

      await deleteDoc(pictureDoc.ref);
    }

    await deleteDoc(getItineraryItemDocRef(tripId, itemId, ownerUid));
  } catch (error) {
    console.log("deleteTripItem error:", error);
    throw error;
  }
}

export async function uploadTripAttachment(tripId, itemId, attachment, ownerUid) {
  try {
    const safeItemId = itemId ? String(itemId) : createItemId();
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
        getPictureDocRef(tripId, safeItemId, pictureId, ownerUid),
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
      safeItemId,
      pictureId,
      attachment?.name || "photo.jpg",
      ownerUid
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
      getPictureDocRef(tripId, safeItemId, pictureId, ownerUid),
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