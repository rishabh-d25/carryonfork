import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

export default function Dashboard() {
  const router = useRouter();
  const [pastTrips, setPastTrips] = useState([]);
  const [loadingPastTrips, setLoadingPastTrips] = useState(true);

  const MAIN_TRIP_IMAGE = require("../assets/images/main-trip.jpg");

  const loadPastTrips = async () => {
    try {
      setLoadingPastTrips(true);

      const user = auth.currentUser;
      if (!user) {
        setPastTrips([]);
        setLoadingPastTrips(false);
        return;
      }

      const tripsRef = collection(db, "users", user.uid, "trips");
      const q = query(tripsRef, where("status", "==", "completed"));
      const snapshot = await getDocs(q);

      const trips = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setPastTrips(trips);
    } catch (error) {
      console.log("Error loading past trips:", error);
      setPastTrips([]);
    } finally {
      setLoadingPastTrips(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPastTrips();
    }, [])
  );

  const onTokyoLabelPress = () => router.push("/maintrip");
  const onPastTripsArrowPress = () => router.push("/pasttriplist");
  const onPastTripPress = (trip) =>
    router.push({ pathname: "/trip/[id]", params: { id: trip.id } });

  const onCreateTripPress = () => console.log("Create trip pressed");
  const onMainTripPress = () => router.push("/maintrip");
  const onCameraPress = () => router.push("/camera");
  const onPreparationPress = () => router.push("/preparation");
  const onJournal = () => router.push("/journal");
  const onChatPress = () => router.push("/chat");
  const onSignInPress = () => router.push("/signin");
  const onBackPress = () => router.back();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={onBackPress}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={styles.titleWrap}>
          <Text style={styles.title}>CARRY ON</Text>
          <Text style={styles.subtitle}>PLAN. PACK. GO.</Text>
        </View>

        <TouchableOpacity
          onPress={onMainTripPress}
          style={styles.heroButton}
          activeOpacity={0.9}
        >
          <ImageBackground
            source={MAIN_TRIP_IMAGE}
            style={styles.heroImage}
            imageStyle={styles.heroImageRadius}
          >
            <TouchableOpacity
              onPress={onTokyoLabelPress}
              activeOpacity={0.85}
              style={styles.heroLabelButton}
            >
              <Text style={styles.heroLabelText}>Tokyo, Japan</Text>
            </TouchableOpacity>
          </ImageBackground>
        </TouchableOpacity>

        <View style={styles.pastHeader}>
          <Text style={styles.sectionTitle}>Past Trips</Text>

          <TouchableOpacity
            onPress={onPastTripsArrowPress}
            style={styles.pastArrowBtn}
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-forward" size={18} color="#111827" />
          </TouchableOpacity>
        </View>

        {loadingPastTrips ? (
          <View style={styles.pastTripsState}>
            <ActivityIndicator size="small" color="#3F63F3" />
          </View>
        ) : pastTrips.length === 0 ? (
          <View style={styles.pastTripsState}>
            <Text style={styles.emptyPastTripsText}>No past trips yet</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.circlesRow}
          >
            {pastTrips.slice(0, 7).map((t) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => onPastTripPress(t)}
                style={styles.tripCircleBtn}
                activeOpacity={0.85}
              >
                <View style={styles.circleShadowWrap}>
                  {t.imageUrl ? (
                    <Image source={{ uri: t.imageUrl }} style={styles.tripCircleImg} />
                  ) : (
                    <View style={styles.tripCirclePlaceholder}>
                      <Ionicons name="airplane" size={22} color="#9CA3AF" />
                    </View>
                  )}
                </View>

                <Text style={styles.tripCircleLabel} numberOfLines={1}>
                  {t.title || "Trip"}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <TouchableOpacity
          onPress={onCreateTripPress}
          style={styles.createBtn}
          activeOpacity={0.9}
        >
          <Text style={styles.createBtnText}>CREATE TRIP! (doesn't work rn)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onCameraPress}
          style={styles.createBtn}
          activeOpacity={0.9}
        >
          <Text style={styles.createBtnText}>camera</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onPreparationPress}
          style={styles.createBtn}
          activeOpacity={0.9}
        >
          <Text style={styles.createBtnText}>preparation</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onChatPress}
          style={styles.createBtn}
          activeOpacity={0.9}
        >
          <Text style={styles.createBtnText}>chat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onSignInPress}
          style={styles.createBtn}
          activeOpacity={0.9}
        >
          <Text style={styles.createBtnText}>sign in screen</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const BLUE = "#3F63F3";

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 10,
  },

  topRow: {
    paddingTop: Platform.OS === "android" ? 10 : 4,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  titleWrap: {
    alignItems: "center",
    marginTop: 6,
    marginBottom: 16,
  },
  title: {
    fontSize: 40,
    letterSpacing: 2,
    color: BLUE,
    fontWeight: "600",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    letterSpacing: 2,
    color: BLUE,
    fontWeight: "500",
  },

  heroButton: {
    width: "100%",
  },
  heroImage: {
    height: 185,
    width: "100%",
    justifyContent: "flex-end",
  },
  heroImageRadius: {
    borderRadius: 14,
  },

  heroLabelButton: {
    position: "absolute",
    left: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.12)",
  },
  heroLabelText: {
    fontSize: 16,
    fontWeight: "800",
    color: "rgba(17,24,39,0.85)",
  },

  pastHeader: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  pastArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.15)",
    backgroundColor: "#fff",
  },

  circlesRow: {
    paddingTop: 14,
    paddingBottom: 8,
    gap: 14,
  },
  tripCircleBtn: {
    width: 78,
    alignItems: "center",
  },
  circleShadowWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tripCircleImg: {
    width: 62,
    height: 62,
    borderRadius: 31,
    resizeMode: "cover",
  },
  tripCirclePlaceholder: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  tripCircleLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },

  pastTripsState: {
    paddingTop: 18,
    paddingBottom: 10,
    minHeight: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyPastTripsText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },

  createBtn: {
    marginTop: 18,
    width: "100%",
    height: 50,
    borderRadius: 8,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  createBtnText: {
    color: "#ffffff",
    fontWeight: "800",
    letterSpacing: 1.2,
  },
});