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
  View
} from "react-native";
import { auth, db } from "../firebaseConfig";

const user = getAuth().currentUser;

const BLUE = "#3F63F3";

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

      loadedTrips.sort((a, b) => {
        const aCreated = getTimestampMillis(a.createdAt);
        const bCreated = getTimestampMillis(b.createdAt);
        return bCreated - aCreated;
      });

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
    return trips.filter((trip) => !isPastTrip(trip));
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
    return activeTrips[0];
  }, [activeTrips]);

  const onOpenTrip = (trip) => {
    router.push({
      pathname: "/maintrip",
      params: {
        tripId: trip.id,
        title: trip.title || trip.location || "Trip",
      },
    });
  };

  const onPastTripsPress = () => router.push("/pasttriplist");
  const onTravelStatsPress = () => router.push("/travelhistory");
  const onCreateTripPress = () => router.push("/createtrip");
  const onUpcomingPress = () => router.push("/upcoming");
  const onInvitesPress = () => router.push("/invites");
  
  const onSettingsPress = () => 
    router.push({
      pathname: "/settings",
      params: { userId: user.uid },
    });
    }
  }
    

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
                    {mainTrip.title || mainTrip.location || "Trip"}
                  </Text>
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
                    {mainTrip.title || mainTrip.location || "Trip"}
                  </Text>
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
        ) : activeTrips.length === 0 ? (
          <View style={styles.tripsState}>
            <Text style={styles.emptyTripsText}>No current trips yet</Text>
          </View>
        ) : (
          <View style={styles.tripList}>
            {activeTrips.map((trip) => {
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
                        <Ionicons name="airplane" size={22} color="#9CA3AF" />
                      </View>
                    )}
                  </View>

                  <View style={styles.tripCardBody}>
                    <Text style={styles.tripCardTitle} numberOfLines={1}>
                      {trip.title || trip.location || "Trip"}
                    </Text>

                    {!!trip.description && (
                      <Text style={styles.tripCardSubtext} numberOfLines={2}>
                        {trip.description}
                      </Text>
                    )}

                    {!!trip.location && trip.title !== trip.location && (
                      <Text style={styles.tripCardMeta} numberOfLines={1}>
                        {trip.location}
                      </Text>
                    )}
                  </View>

                  <Ionicons name="chevron-forward" size={18} color="#6B7280" />
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
            <Ionicons name="chevron-forward" size={16} color="#111827" />
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
                          <Ionicons name="airplane" size={22} color="#9CA3AF" />
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
          <Text style={styles.createBtnText}>CREATE TRIP!</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onUpcomingPress}
          style={styles.createBtn}
          activeOpacity={0.9}
        >
          <Text style={styles.createBtnText}>upcoming</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onInvitesPress}
          style={styles.createBtn}
          activeOpacity={0.9}
        >
          <Text style={styles.createBtnText}>invites</Text>
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
    backgroundColor: "#ffffff",
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

  heroLoadingWrap: {
    height: 185,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  noMainTripCard: {
    height: 185,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  noMainTripText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  noMainTripSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },

  sectionHeader: {
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
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
    color: "#6B7280",
    fontWeight: "500",
  },

  tripList: {
    gap: 12,
  },
  tripCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  tripCardBody: {
    flex: 1,
    marginRight: 10,
  },
  tripCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  tripCardSubtext: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },
  tripCardMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#9CA3AF",
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
    borderColor: "rgba(17,24,39,0.15)",
    backgroundColor: "#fff",
  },
  viewPastTripsText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
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
    fontWeight: "700",
    color: BLUE,
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