import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const DEFAULT_PLACES = [
  { label: "12/27", top: 38, left: 18 },
  { label: "12/31", top: 18, left: 118 },
  { label: "1/3", top: 48, right: 18 },
  { label: "12/29", top: 76, left: 52 },
  { label: "12/28", top: 112, right: 38 },
  { label: "1/2", top: 148, left: 26 },
  { label: "12/30", top: 166, left: 92 },
  { label: "Hotel", top: 108, left: 112, hotel: true },
];

export default function TripDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrip();
  }, [id]);

  const loadTrip = async () => {
    try {
      setLoading(true);

      const user = auth.currentUser;
      if (!user || !id) {
        setTrip(null);
        setLoading(false);
        return;
      }

      const tripRef = doc(db, "users", user.uid, "trips", String(id));
      const snapshot = await getDoc(tripRef);

      if (snapshot.exists()) {
        setTrip({
          id: snapshot.id,
          ...snapshot.data(),
        });
      } else {
        setTrip(null);
      }
    } catch (error) {
      console.log("Error loading trip details:", error);
      setTrip(null);
    } finally {
      setLoading(false);
    }
  };

  const places =
    Array.isArray(trip?.placesVisited) && trip.placesVisited.length > 0
      ? trip.placesVisited
      : DEFAULT_PLACES;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F7F7" />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>

        <Text style={styles.headerTitle}>
          {trip?.title || "Trip Details"}
        </Text>

        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#3F63F3" />
        </View>
      ) : !trip ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={34} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>Trip not found</Text>
          <Text style={styles.emptyText}>
            We couldn’t load this trip from your account.
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Places Visited:</Text>

          <View style={styles.mapCard}>
            <View style={styles.mapArea}>
              <View style={[styles.parkPatch, { top: 74, right: 8 }]} />
              <View style={[styles.parkPatch, { bottom: 28, right: 28 }]} />

              <View style={styles.gridVertical1} />
              <View style={styles.gridVertical2} />
              <View style={styles.gridVertical3} />
              <View style={styles.gridVertical4} />

              <View style={styles.gridHorizontal1} />
              <View style={styles.gridHorizontal2} />
              <View style={styles.gridHorizontal3} />
              <View style={styles.gridHorizontal4} />

              {places.map((place, index) => (
                <View
                  key={`${place.label}-${index}`}
                  style={[
                    place.hotel ? styles.hotelBubble : styles.dateBubble,
                    {
                      top: place.top,
                      left: place.left,
                      right: place.right,
                    },
                  ]}
                >
                  <Text style={place.hotel ? styles.hotelText : styles.dateText}>
                    {place.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Stats:</Text>

          <View style={styles.statsBlock}>
            <Text style={styles.statLine}>
              Money Spent:{" "}
              {trip.moneySpent !== undefined && trip.moneySpent !== null
                ? `$${Number(trip.moneySpent).toLocaleString()}`
                : "$0"}
            </Text>
            <Text style={styles.statLine}>
              Time Spent: {trip.timeSpent || "0 Days"}
            </Text>
            <Text style={styles.statLine}>
              Museums: {trip.museums ?? 0}
            </Text>
          </View>

          <View style={styles.buttonGroup}>
            <Pressable
              style={styles.actionButton}
              onPress={() =>
                router.push({
                  pathname: "/journal",
                  params: { tripId: trip.id },
                })
              }
            >
              <Text style={styles.actionButtonText}>JOURNAL</Text>
            </Pressable>

            <Pressable
              style={styles.actionButton}
              onPress={() =>
                router.push({
                  pathname: "/tripitinerary",
                  params: { tripId: trip.id },
                })
              }
            >
              <Text style={styles.actionButtonText}>ITINERARY</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },

  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "500",
    color: "#111",
  },

  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 8,
  },

  sectionTitle: {
    fontSize: 21,
    color: "#111",
    marginBottom: 10,
  },

  mapCard: {
    alignSelf: "center",
  },
  mapArea: {
    width: 275,
    height: 185,
    backgroundColor: "#E9EDF2",
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },

  gridVertical1: {
    position: "absolute",
    left: 22,
    top: 0,
    bottom: 0,
    width: 8,
    backgroundColor: "#CDD3DB",
    transform: [{ rotate: "-6deg" }],
  },
  gridVertical2: {
    position: "absolute",
    left: 86,
    top: -8,
    bottom: -8,
    width: 8,
    backgroundColor: "#CDD3DB",
    transform: [{ rotate: "-6deg" }],
  },
  gridVertical3: {
    position: "absolute",
    left: 152,
    top: -6,
    bottom: -6,
    width: 8,
    backgroundColor: "#CDD3DB",
    transform: [{ rotate: "-6deg" }],
  },
  gridVertical4: {
    position: "absolute",
    left: 220,
    top: -10,
    bottom: -10,
    width: 8,
    backgroundColor: "#CDD3DB",
    transform: [{ rotate: "-6deg" }],
  },

  gridHorizontal1: {
    position: "absolute",
    left: -10,
    right: -10,
    top: 26,
    height: 8,
    backgroundColor: "#CDD3DB",
    transform: [{ rotate: "-6deg" }],
  },
  gridHorizontal2: {
    position: "absolute",
    left: -12,
    right: -12,
    top: 72,
    height: 8,
    backgroundColor: "#CDD3DB",
    transform: [{ rotate: "-6deg" }],
  },
  gridHorizontal3: {
    position: "absolute",
    left: -10,
    right: -10,
    top: 118,
    height: 8,
    backgroundColor: "#CDD3DB",
    transform: [{ rotate: "-6deg" }],
  },
  gridHorizontal4: {
    position: "absolute",
    left: -10,
    right: -10,
    top: 160,
    height: 8,
    backgroundColor: "#CDD3DB",
    transform: [{ rotate: "-6deg" }],
  },

  parkPatch: {
    position: "absolute",
    width: 28,
    height: 28,
    backgroundColor: "#D9EFCB",
    borderRadius: 2,
  },

  dateBubble: {
    position: "absolute",
    minWidth: 42,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  dateText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
  },

  hotelBubble: {
    position: "absolute",
    minWidth: 46,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FF4A46",
    alignItems: "center",
    justifyContent: "center",
  },
  hotelText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },

  statsBlock: {
    marginTop: 2,
    gap: 6,
  },
  statLine: {
    fontSize: 16,
    color: "#111",
    letterSpacing: 0.2,
  },

  buttonGroup: {
    marginTop: 68,
    gap: 16,
  },
  actionButton: {
    backgroundColor: "#3F63F3",
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.8,
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
});