import {
  CinzelDecorative_700Bold,
  useFonts,
} from "@expo-google-fonts/cinzel-decorative";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

const user = getAuth().currentUser;

const BLUE = "#3F63F3";
const BG = "#F5F7FF";
const TEXT = "#1F2937";
const MUTED = "#6B7280";
const ICON = "#94A3B8";

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

function isCurrentTrip(trip) {
  const today = startOfTodayMillis();
  const startMillis = getTimestampMillis(trip.startDate);
  const endMillis = getTimestampMillis(trip.endDate);

  if (!startMillis || !endMillis) return false;
  return startMillis <= today && endMillis >= today;
}

function isUpcomingTrip(trip) {
  const today = startOfTodayMillis();
  const startMillis = getTimestampMillis(trip.startDate);
  return startMillis > today;
}

function formatTripDate(value) {
  const millis = getTimestampMillis(value);
  if (!millis) return "";

  const date = new Date(millis);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
}

function getTripDateRange(trip) {
  const start = formatTripDate(trip.startDate);
  const end = formatTripDate(trip.endDate);

  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  if (end) return end;
  return "";
}

function getPlaceholderPhotoUri(trip) {
  const tripPhotos = trip?.tripPhotos || {};

  const slots = [
    tripPhotos?.slot1?.uri,
    tripPhotos?.slot2?.uri,
    tripPhotos?.slot3?.uri,
    tripPhotos?.slot4?.uri,
  ];

  for (let i = 0; i < slots.length; i++) {
    if (slots[i]) return slots[i];
  }

  return "";
}

function getTripDisplayPhotoUri(trip) {
  const heroUri = trip?.heroPhoto?.uri;
  if (heroUri) return heroUri;
  return getPlaceholderPhotoUri(trip);
}

export default function Dashboard() {
  const router = useRouter();
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);

  const [fontsLoaded] = useFonts({
    CinzelDecorative_700Bold,
  });

  const MAIN_TRIP_IMAGE = require("../assets/images/main-trip.jpg");

  const loadTrips = async () => {
    try {
      setLoadingTrips(true);

      const currentUser = auth.currentUser;
      if (!currentUser) {
        setTrips([]);
        return;
      }

      const tripsRef = collection(db, "users", currentUser.uid, "trips");
      const snapshot = await getDocs(tripsRef);

      const loadedTrips = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setTrips(loadedTrips);
    } catch (error) {
      console.log("Error loading trips:", error);
      setTrips([]);
    } finally {
      setLoadingTrips(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [])
  );

  const activeTrips = useMemo(() => {
    return trips
      .filter((trip) => !isPastTrip(trip))
      .sort((a, b) => {
        const aIsCurrent = isCurrentTrip(a);
        const bIsCurrent = isCurrentTrip(b);

        if (aIsCurrent && !bIsCurrent) return -1;
        if (!aIsCurrent && bIsCurrent) return 1;

        const aStart = getTimestampMillis(a.startDate);
        const bStart = getTimestampMillis(b.startDate);

        if (aStart !== bStart) {
          return aStart - bStart;
        }

        const aEnd = getTimestampMillis(a.endDate);
        const bEnd = getTimestampMillis(b.endDate);
        return aEnd - bEnd;
      });
  }, [trips]);

  const pastTrips = useMemo(() => {
    return trips
      .filter((trip) => isPastTrip(trip))
      .sort((a, b) => {
        const aEnd = getTimestampMillis(a.endDate);
        const bEnd = getTimestampMillis(b.endDate);
        return bEnd - aEnd;
      });
  }, [trips]);

  const mainTrip = useMemo(() => {
    if (activeTrips.length === 0) return null;

    const currentTrips = activeTrips.filter((trip) => isCurrentTrip(trip));
    if (currentTrips.length > 0) {
      return currentTrips.sort((a, b) => {
        const aStart = getTimestampMillis(a.startDate);
        const bStart = getTimestampMillis(b.startDate);
        return aStart - bStart;
      })[0];
    }

    const upcomingTrips = activeTrips.filter((trip) => isUpcomingTrip(trip));
    if (upcomingTrips.length > 0) {
      return upcomingTrips.sort((a, b) => {
        const aStart = getTimestampMillis(a.startDate);
        const bStart = getTimestampMillis(b.startDate);
        return aStart - bStart;
      })[0];
    }

    return activeTrips[0];
  }, [activeTrips]);

  const listTrips = useMemo(() => {
    if (!mainTrip) return activeTrips;
    return activeTrips.filter((trip) => trip.id !== mainTrip.id);
  }, [activeTrips, mainTrip]);

  const onOpenTrip = (trip) => {
    router.push({
      pathname: "/maintrip",
      params: {
        tripId: trip.id,
        title: trip.title || trip.location?.city || trip.location?.country || "Trip",
      },
    });
  };

  const onPastTripsPress = () => router.push("/pasttriplist");
  const onTravelStatsPress = () => router.push("/travelhistory");
  const onCreateTripPress = () => router.push("/createtrip");
  const onUpcomingPress = () => router.push("/upcoming");
  const onInvitesPress = () => router.push("/invites");

  const onSettingsPress = () => {
    console.log("setting");
    router.push({
      pathname: "/settings",
      params: { userId: user?.uid },
    });
  };

  const onBackPress = () => router.back();

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

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
            <Ionicons name="chevron-back" size={24} color={TEXT} />
          </TouchableOpacity>
        </View>

        <View style={styles.titleWrap}>
          <Text style={styles.title}>CarryOn</Text>
          <Text style={styles.subtitle}>PLAN. PACK. GO.</Text>
        </View>

        {loadingTrips ? (
          <View style={styles.heroLoadingWrap}>
            <ActivityIndicator size="large" color={BLUE} />
          </View>
        ) : mainTrip ? (
          <TouchableOpacity
            onPress={() => onOpenTrip(mainTrip)}
            style={styles.heroButton}
            activeOpacity={0.9}
          >
            {getTripDisplayPhotoUri(mainTrip) ? (
              <ImageBackground
                source={{ uri: getTripDisplayPhotoUri(mainTrip) }}
                style={styles.heroImage}
                imageStyle={styles.heroImageRadius}
              >
                <View style={styles.heroLabelButton}>
                  <Text style={styles.heroLabelText}>
                    {mainTrip.title || mainTrip.location?.city || mainTrip.location?.country || "Trip"}
                  </Text>
                  {!!getTripDateRange(mainTrip) && (
                    <Text style={styles.heroDateText}>
                      {getTripDateRange(mainTrip)}
                    </Text>
                  )}
                </View>
              </ImageBackground>
            ) : (
              <ImageBackground
                source={MAIN_TRIP_IMAGE}
                style={styles.heroImage}
                imageStyle={styles.heroImageRadius}
              >
                <View style={styles.heroLabelButton}>
                  <Text style={styles.heroLabelText}>
                    {mainTrip.title || mainTrip.location?.city || mainTrip.location?.country || "Trip"}
                  </Text>
                  {!!getTripDateRange(mainTrip) && (
                    <Text style={styles.heroDateText}>
                      {getTripDateRange(mainTrip)}
                    </Text>
                  )}
                </View>
              </ImageBackground>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.noMainTripCard}>
            <Text style={styles.noMainTripText}>No current trips</Text>
            <Text style={styles.noMainTripSubtext}>
              Create a current or upcoming trip to make it show up here.
            </Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Current / Upcoming Trips</Text>
        </View>

        {loadingTrips ? (
          <View style={styles.tripsState}>
            <ActivityIndicator size="small" color={BLUE} />
          </View>
        ) : listTrips.length === 0 ? (
          <View style={styles.tripsState}>
            <Text style={styles.emptyTripsText}>No other current trips yet</Text>
          </View>
        ) : (
          <View style={styles.tripList}>
            {listTrips.map((trip) => {
              const tripPhotoUri = getTripDisplayPhotoUri(trip);

              return (
                <TouchableOpacity
                  key={trip.id}
                  style={styles.tripCard}
                  activeOpacity={0.85}
                  onPress={() => onOpenTrip(trip)}
                >
                  <View style={styles.tripCardLeft}>
                    {tripPhotoUri ? (
                      <Image
                        source={{ uri: tripPhotoUri }}
                        style={styles.tripThumb}
                      />
                    ) : trip.imageUrl ? (
                      <Image
                        source={{ uri: trip.imageUrl }}
                        style={styles.tripThumb}
                      />
                    ) : (
                      <View style={styles.tripThumbPlaceholder}>
                        <Ionicons name="airplane" size={22} color={ICON} />
                      </View>
                    )}
                  </View>

                  <View style={styles.tripCardBody}>
                    <Text style={styles.tripCardTitle} numberOfLines={1}>
                      {trip.title || trip.location?.city || trip.location?.country || "Trip"}
                    </Text>

                    {!!getTripDateRange(trip) && (
                      <Text style={styles.tripCardDate} numberOfLines={1}>
                        {getTripDateRange(trip)}
                      </Text>
                    )}

                    {!!trip.description && (
                      <Text style={styles.tripCardSubtext} numberOfLines={2}>
                        {trip.description}
                      </Text>
                    )}

                    {!!trip.location?.city && trip.title !== trip.location.city && (
                      <Text style={styles.tripCardMeta} numberOfLines={1}>
                        {trip.location.city}, {trip.location.country}
                      </Text>
                    )}
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={MUTED} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.pastHeader}>
          <Text style={styles.sectionTitle}>Past Trips</Text>

          <TouchableOpacity
            onPress={onPastTripsPress}
            style={styles.viewPastTripsBtn}
            activeOpacity={0.75}
          >
            <Text style={styles.viewPastTripsText}>View All</Text>
            <Ionicons name="chevron-forward" size={16} color={TEXT} />
          </TouchableOpacity>
        </View>

        {loadingTrips ? (
          <View style={styles.pastTripsState}>
            <ActivityIndicator size="small" color={BLUE} />
          </View>
        ) : pastTrips.length === 0 ? (
          <View style={styles.pastTripsState}>
            <Text style={styles.emptyPastTripsText}>No past trips yet</Text>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.circlesRow}
            >
              {pastTrips.slice(0, 7).map((t) => {
                const tripPhotoUri = getTripDisplayPhotoUri(t);

                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => onOpenTrip(t)}
                    style={styles.tripCircleBtn}
                    activeOpacity={0.85}
                  >
                    <View style={styles.circleShadowWrap}>
                      {tripPhotoUri ? (
                        <Image
                          source={{ uri: tripPhotoUri }}
                          style={styles.tripCircleImg}
                        />
                      ) : t.imageUrl ? (
                        <Image
                          source={{ uri: t.imageUrl }}
                          style={styles.tripCircleImg}
                        />
                      ) : (
                        <View style={styles.tripCirclePlaceholder}>
                          <Ionicons name="airplane" size={22} color={ICON} />
                        </View>
                      )}
                    </View>

                    <Text style={styles.tripCircleLabel} numberOfLines={1}>
                      {t.title || t.location || "Trip"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={onTravelStatsPress}
              style={styles.travelStatsBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="stats-chart-outline" size={16} color={BLUE} />
              <Text style={styles.travelStatsBtnText}>View Travel Stats</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          onPress={onCreateTripPress}
          style={styles.createBtn}
          activeOpacity={0.9}
        >
          <Text style={styles.createBtnText}>Create Trip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onUpcomingPress}
          style={styles.createBtn}
          activeOpacity={0.9}
        >
          <Text style={styles.createBtnText}>Upcoming</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onInvitesPress}
          style={styles.createBtn}
          activeOpacity={0.9}
        >
          <Text style={styles.createBtnText}>Invites</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onSettingsPress}
          style={styles.createBtn}
          activeOpacity={0.9}
        >
          <Text style={styles.createBtnText}>Settings</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#DCE6FF",
  },
  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 10,
  },

  topRow: {
    paddingTop: 0,
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
    backgroundColor: "#C9D7FF",
    borderWidth: 1,
    borderColor: "#B4C6FF",
  },

  titleWrap: {
    alignItems: "center",
    marginTop: 6,
    marginBottom: 16,
  },
  title: {
    fontSize: 38,
    letterSpacing: 3,
    color: "#3F63F3",
    textAlign: "center",
    fontFamily: "CinzelDecorative_700Bold",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    letterSpacing: 1.2,
    color: "#6B7AF7",
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "#B4C6FF",
  },
  heroLabelText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3F63F3",
  },
  heroDateText: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
  },

  heroLoadingWrap: {
    height: 185,
    borderRadius: 14,
    backgroundColor: "#C9D7FF",
    borderWidth: 1,
    borderColor: "#B4C6FF",
    alignItems: "center",
    justifyContent: "center",
  },

  noMainTripCard: {
    height: 185,
    borderRadius: 14,
    backgroundColor: "#C9D7FF",
    borderWidth: 1,
    borderColor: "#B4C6FF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  noMainTripText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  noMainTripSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
  },

  sectionHeader: {
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },

  tripsState: {
    paddingTop: 18,
    paddingBottom: 10,
    minHeight: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTripsText: {
    fontSize: 13,
    color: "#4B5563",
    fontWeight: "500",
  },

  tripList: {
    gap: 12,
  },
  tripCard: {
    backgroundColor: "#D4DEFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#B4C6FF",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  tripCardLeft: {
    marginRight: 12,
  },
  tripThumb: {
    width: 58,
    height: 58,
    borderRadius: 12,
    resizeMode: "cover",
  },
  tripThumbPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: "#C2D0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  tripCardBody: {
    flex: 1,
    marginRight: 10,
  },
  tripCardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  tripCardDate: {
    marginTop: 4,
    fontSize: 12,
    color: "#3F63F3",
    fontWeight: "600",
  },
  tripCardSubtext: {
    marginTop: 4,
    fontSize: 13,
    color: "#4B5563",
  },
  tripCardMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
  },

  pastHeader: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewPastTripsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#B4C6FF",
    backgroundColor: "#C9D7FF",
  },
  viewPastTripsText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3F63F3",
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
    backgroundColor: "#D4DEFF",
    borderWidth: 1,
    borderColor: "#B4C6FF",
    shadowColor: "#000",
    shadowOpacity: 0.08,
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
    backgroundColor: "#C2D0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  tripCircleLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "500",
    color: "#111827",
  },

  travelStatsBtn: {
    marginTop: 6,
    marginBottom: 4,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  travelStatsBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3F63F3",
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
    color: "#4B5563",
    fontWeight: "500",
  },

  createBtn: {
    marginTop: 18,
    width: "100%",
    height: 52,
    borderRadius: 12,
    backgroundColor: "#5A75F5",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3F63F3",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  createBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.8,
  },
});