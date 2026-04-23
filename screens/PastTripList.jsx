import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

const BLUE = "#4967E8";
const TEXT = "#111827";
const BORDER = "#E5E7EB";
const BG = "#FFFFFF";

function getTimestampMillis(value) {
  if (!value) return 0;

  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }

  if (typeof value?.seconds === "number") {
    return value.seconds * 1000;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function startOfTodayMillis() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function isPastTrip(trip) {
  const endMillis = getTimestampMillis(trip.endDate);
  return endMillis > 0 && endMillis < startOfTodayMillis();
}

function formatDateRange(startDate, endDate) {
  const startMillis = getTimestampMillis(startDate);
  const endMillis = getTimestampMillis(endDate);

  if (!startMillis || !endMillis) return "";

  const start = new Date(startMillis);
  const end = new Date(endMillis);

  const startText = `${String(start.getMonth() + 1).padStart(2, "0")}/${String(
    start.getDate()
  ).padStart(2, "0")}/${String(start.getFullYear()).slice(-2)}`;

  const endText = `${String(end.getMonth() + 1).padStart(2, "0")}/${String(
    end.getDate()
  ).padStart(2, "0")}/${String(end.getFullYear()).slice(-2)}`;

  return `${startText}-${endText}`;
}

function getStringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getTripPreviewImage(trip) {
  if (!trip) return "";

  const directCandidates = [
    trip.imageUrl,
    trip.mainImage,
    trip.mainImageUri,
    trip.mainTripImage,
    trip.mainTripImageUri,
    trip.heroImage,
    trip.heroImageUri,
    trip.selectedImage,
    trip.selectedImageUri,
    trip.coverImage,
    trip.coverImageUri,
  ];

  for (const candidate of directCandidates) {
    const valid = getStringValue(candidate);
    if (valid) return valid;
  }

  const placeholderCandidates = [
    trip.placeholder1,
    trip.placeholder2,
    trip.placeholder3,
    trip.placeholder4,
    trip.placeholderImage1,
    trip.placeholderImage2,
    trip.placeholderImage3,
    trip.placeholderImage4,
    trip.photo1,
    trip.photo2,
    trip.photo3,
    trip.photo4,
  ];

  for (const candidate of placeholderCandidates) {
    const valid = getStringValue(candidate);
    if (valid) return valid;
  }

  if (Array.isArray(trip.placeholders)) {
    for (const item of trip.placeholders) {
      if (!item) continue;

      if (typeof item === "string" && item.trim()) {
        return item.trim();
      }

      if (typeof item === "object") {
        const valid =
          getStringValue(item.uri) ||
          getStringValue(item.imageUrl) ||
          getStringValue(item.downloadURL);
        if (valid) return valid;
      }
    }
  }

  if (Array.isArray(trip.images)) {
    for (const item of trip.images) {
      if (!item) continue;

      if (typeof item === "string" && item.trim()) {
        return item.trim();
      }

      if (typeof item === "object") {
        const valid =
          getStringValue(item.uri) ||
          getStringValue(item.imageUrl) ||
          getStringValue(item.downloadURL);
        if (valid) return valid;
      }
    }
  }

  return "";
}

export default function PastTripList() {
  const router = useRouter();
  const [pastTrips, setPastTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPastTrips = async () => {
    try {
      setLoading(true);

      const user = auth.currentUser;
      if (!user) {
        setPastTrips([]);
        return;
      }

      const tripsRef = collection(db, "users", user.uid, "trips");
      const snapshot = await getDocs(tripsRef);

      const loadedTrips = snapshot.docs
        .map((tripDoc) => {
          const data = tripDoc.data() || {};
          return {
            id: tripDoc.id,
            ...data,
            previewImage: getTripPreviewImage(data),
          };
        })
        .filter((trip) => isPastTrip(trip))
        .sort((a, b) => {
          const aEnd = getTimestampMillis(a.endDate);
          const bEnd = getTimestampMillis(b.endDate);
          return bEnd - aEnd;
        });

      setPastTrips(loadedTrips);
    } catch (error) {
      console.log("Error loading past trips:", error);
      setPastTrips([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPastTrips();
    }, [])
  );

  const tripCards = useMemo(() => {
    return pastTrips.map((trip) => ({
      ...trip,
      dateText: formatDateRange(trip.startDate, trip.endDate),
    }));
  }, [pastTrips]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
<Pressable
  onPress={() => router.dismissTo("/dashboard")}
  style={styles.backBtn}
>
  <Ionicons name="chevron-back" size={24} color={TEXT} />
</Pressable>

        <Text style={styles.headerTitle}>Past Trips</Text>

        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={BLUE} />
        </View>
      ) : tripCards.length === 0 ? (
        <View style={styles.centerWrap}>
          <Text style={styles.emptyText}>No past trips yet.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {tripCards.map((trip) => {
            return (
              <Pressable
                key={trip.id}
                style={styles.card}
                onPress={() =>
            router.push({
              pathname: "/maintrip",
              params: {
                tripId: trip.id,
                title: trip.title || trip.location || "Trip",
              },
            })
                }
              >
                {trip.previewImage ? (
                  <Image source={{ uri: trip.previewImage }} style={styles.cardImage} />
                ) : (
                  <View style={styles.placeholderImage}>
                    <Ionicons name="image-outline" size={26} color="#9CA3AF" />
                  </View>
                )}

                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>
                    {trip.title || trip.location || "Trip"}
                  </Text>

                  {!!trip.dateText && (
                    <Text style={styles.cardDates}>{trip.dateText}</Text>
                  )}
                </View>

                <Ionicons name="chevron-forward" size={18} color="#6B7280" />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#DCE6FF",
  },

  header: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#C9D7FF",
    borderWidth: 1,
    borderColor: "#B4C6FF",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#3F63F3",
  },

  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyText: {
    fontSize: 15,
    color: "#4B5563",
    fontWeight: "500",
  },

  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D4DEFF", // layered blue (NOT white)
    borderWidth: 1,
    borderColor: "#B4C6FF",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },

  cardImage: {
    width: 72,
    height: 72,
    borderRadius: 14,
    resizeMode: "cover",
    marginRight: 12,
    backgroundColor: "#C2D0FF",
  },

  placeholderImage: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: "#C2D0FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  cardBody: {
    flex: 1,
    justifyContent: "center",
    marginRight: 10,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },

  cardDates: {
    marginTop: 4,
    fontSize: 13,
    color: "#3F63F3",
    fontWeight: "600",
  },
});