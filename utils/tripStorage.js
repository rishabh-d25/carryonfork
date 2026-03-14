import AsyncStorage from "@react-native-async-storage/async-storage";

const TRIPS_KEY = "trips";
const TRIP_ITEMS_KEY = "tripItems";

export async function getTrips() {
  try {
    const raw = await AsyncStorage.getItem(TRIPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.log("getTrips error:", error);
    return [];
  }
}

export async function saveTrips(trips) {
  try {
    await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
  } catch (error) {
    console.log("saveTrips error:", error);
    throw error;
  }
}

export async function getTripItemById(tripId) {
  const trips = await getTrips();
  return trips.find((trip) => String(trip.id) === String(tripId)) || null;
}

export async function deleteTrip(tripId) {
  try {
    const trips = await getTrips();

    const updatedTrips = trips.filter(
      (trip) => String(trip.id) !== String(tripId)
    );

    await saveTrips(updatedTrips);

    const rawItems = await AsyncStorage.getItem(TRIP_ITEMS_KEY);
    const tripItems = rawItems ? JSON.parse(rawItems) : {};

    if (tripItems[String(tripId)]) {
      delete tripItems[String(tripId)];
      await AsyncStorage.setItem(TRIP_ITEMS_KEY, JSON.stringify(tripItems));
    }

    return true;
  } catch (error) {
    console.log("deleteTrip error:", error);
    throw error;
  }
}

export async function getTripItems(tripId) {
  try {
    const raw = await AsyncStorage.getItem(TRIP_ITEMS_KEY);
    const allItems = raw ? JSON.parse(raw) : {};
    return allItems[String(tripId)] || [];
  } catch (error) {
    console.log("getTripItems error:", error);
    return [];
  }
}

export async function saveTripItems(tripId, items) {
  try {
    const raw = await AsyncStorage.getItem(TRIP_ITEMS_KEY);
    const allItems = raw ? JSON.parse(raw) : {};
    allItems[String(tripId)] = items;
    await AsyncStorage.setItem(TRIP_ITEMS_KEY, JSON.stringify(allItems));
  } catch (error) {
    console.log("saveTripItems error:", error);
    throw error;
  }
}

export async function upsertTripItem(tripId, item) {
  try {
    const items = await getTripItems(tripId);
    const existingIndex = items.findIndex(
      (x) => String(x.id) === String(item.id)
    );

    let updated;
    if (existingIndex >= 0) {
      updated = [...items];
      updated[existingIndex] = item;
    } else {
      updated = [...items, item];
    }

    await saveTripItems(tripId, updated);
    return item;
  } catch (error) {
    console.log("upsertTripItem error:", error);
    throw error;
  }
}