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
        setLoading(false);
        return;
      }

      const tripsRef = collection(db, "users", user.uid, "trips");
      const snapshot = await getDocs(tripsRef);

      const loadedTrips = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
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

  const onOpenTrip = (trip) => {
    router.push({
      pathname: "/maintrip",
      params: {
        tripId: trip.id,
        title: trip.title || trip.location || "Trip",
      },
    });
  };

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
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Past Trips</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#3F63F3" />
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
          {tripCards.map((trip) => (
            <Pressable
              key={trip.id}
              style={styles.card}
              onPress={() => onOpenTrip(trip)}
            >
              {trip.imageUrl ? (
                <Image source={{ uri: trip.imageUrl }} style={styles.cardImage} />
              ) : (
                <View style={styles.placeholderImage}>
                  <Ionicons name="airplane" size={26} color="#9CA3AF" />
                </View>
              )}

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>
                  {trip.title || trip.location || "Trip"}
                </Text>

                {!!trip.dateText && (
                  <Text style={styles.cardDates}>{trip.dateText}</Text>
                )}

                {!!trip.description && (
                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {trip.description}
                  </Text>
                )}
              </View>

              <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
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
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },

  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyText: {
    fontSize: 15,
    color: "#6B7280",
  },

  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
  },

  placeholderImage: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  cardBody: {
    flex: 1,
    marginRight: 10,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  cardDates: {
    marginTop: 4,
    fontSize: 13,
    color: "#4967E8",
    fontWeight: "600",
  },

  cardDescription: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },
});