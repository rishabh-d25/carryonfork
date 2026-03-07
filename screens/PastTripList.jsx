import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
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
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

export default function PastTripList() {
  const router = useRouter();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTrips = async () => {
    try {
      setLoading(true);

      const user = auth.currentUser;
      if (!user) {
        setTrips([]);
        setLoading(false);
        return;
      }

      const tripsRef = collection(db, "users", user.uid, "trips");
      let snapshot;

      try {
        snapshot = await getDocs(query(tripsRef, orderBy("startDate", "desc")));
      } catch {
        snapshot = await getDocs(tripsRef);
      }

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setTrips(data);
    } catch (error) {
      console.log("Error loading past trips:", error);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [])
  );

  const openTrip = (trip) => {
    router.push({ pathname: "/trip/[id]", params: { id: trip.id } });
  };

  const renderTripImage = (trip) => {
    if (trip.imageUrl) {
      return <Image source={{ uri: trip.imageUrl }} style={styles.thumb} />;
    }

    return (
      <View style={[styles.thumb, styles.placeholderThumb]}>
        <Ionicons name="airplane" size={26} color="#9CA3AF" />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.topRow}>
        <Pressable
          onPress={() => router.replace("/travelhistory")}
          style={styles.iconButton}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>

        <Text style={styles.title}>Past Trips</Text>

        <View style={styles.iconButton} />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#3F63F3" />
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="map-outline" size={34} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No past trips yet</Text>
          <Text style={styles.emptyText}>
            Trips you save under your account will show up here.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {trips.map((t) => (
            <Pressable key={t.id} onPress={() => openTrip(t)} style={styles.row}>
              {renderTripImage(t)}

              <View style={styles.textCol}>
                <Text style={styles.tripTitle}>
                  {t.title || "Untitled Trip"}
                </Text>
                <Text style={styles.tripDates}>
                  {t.dates || "No dates added"}
                </Text>
              </View>
            </Pressable>
          ))}

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },

  topRow: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  scroll: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 22,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  thumb: {
    width: 92,
    height: 92,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  placeholderThumb: {
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  tripTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  tripDates: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(17,24,39,0.75)",
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