import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const BG = "#DCE6FF";
const BORDER = "#B4C6FF";
const TEXT = "#1F2937";
const BLUE = "#3F63F3";

const MONTH_ORDER = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

function getCategoryLabel(value) {
  if (value === "activity") return "Activity";
  if (value === "transportation") return "Transportation";
  if (value === "food") return "Food";
  if (value === "hotel") return "Hotel";
  return value || "";
}

function getAttachmentCount(item) {
  if (!Array.isArray(item?.attachments)) return 0;
  return item.attachments.length;
}

function getFirstImage(item) {
  if (!Array.isArray(item?.attachments)) return null;
  return (
    item.attachments.find(
      (attachment) =>
        attachment?.type === "image" && (attachment?.downloadURL || attachment?.uri)
    ) || null
  );
}

async function loadAttachmentsForItems(ownerId, tripId, baseItems) {
  const itemsWithAttachments = await Promise.all(
    (baseItems || []).map(async (item) => {
      try {
        const picturesRef = collection(
          db,
          "users",
          ownerId,
          "trips",
          tripId,
          "itinerary",
          String(item.id),
          "pictures"
        );

        const picturesSnap = await getDocs(picturesRef);

        const attachments = picturesSnap.docs
          .map((pictureDoc) => ({
            id: pictureDoc.id,
            ...pictureDoc.data(),
          }))
          .sort((a, b) => {
            const aSeconds = a?.createdAt?.seconds || 0;
            const bSeconds = b?.createdAt?.seconds || 0;
            return aSeconds - bSeconds;
          });

        return {
          ...item,
          attachments,
        };
      } catch (error) {
        console.log("loadAttachmentsForItems item error:", error);
        return {
          ...item,
          attachments: [],
        };
      }
    })
  );

  return itemsWithAttachments;
}

export default function TripItinerary() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const tripId = String(params.tripId || "");
  const paramSourceTripId = params.sourceTripId
    ? String(params.sourceTripId)
    : "";
  const paramSourceTripOwnerId = params.sourceTripOwnerId
    ? String(params.sourceTripOwnerId)
    : "";

  const [items, setItems] = useState([]);
  const [sourceTripOwnerId, setSourceTripOwnerId] = useState("");
  const [sourceTripId, setSourceTripId] = useState("");

  const subscribeToItems = useCallback(() => {
    if (!tripId || !auth.currentUser?.uid) return () => {};

    let unsubscribeSnapshot = null;
    let cancelled = false;

    const start = async () => {
      try {
        const currentUid = auth.currentUser.uid;

        // ✅ FIRST trust the params coming back from AddActivity / details screens
        let resolvedOwnerId = paramSourceTripOwnerId || currentUid;
        let resolvedTripId = paramSourceTripId || tripId;

        // ✅ Only fall back to trip-doc lookup if params were not provided
        if (!paramSourceTripOwnerId || !paramSourceTripId) {
          const myTripRef = doc(db, "users", currentUid, "trips", tripId);
          const myTripSnap = await getDoc(myTripRef);

          if (myTripSnap.exists()) {
            const myTripData = myTripSnap.data() || {};

            if (
              myTripData.isSharedTrip &&
              myTripData.sharedTripOwnerId &&
              myTripData.sharedTripId
            ) {
              resolvedOwnerId = String(myTripData.sharedTripOwnerId);
              resolvedTripId = String(myTripData.sharedTripId);
            } else if (
              myTripData.acceptedFromInvite &&
              myTripData.tripOwnerId &&
              myTripData.originalTripId
            ) {
              resolvedOwnerId = String(myTripData.tripOwnerId);
              resolvedTripId = String(myTripData.originalTripId);
            }
          }
        }

        if (!cancelled) {
          setSourceTripOwnerId(resolvedOwnerId);
          setSourceTripId(resolvedTripId);
        }

        const itineraryRef = collection(
          db,
          "users",
          resolvedOwnerId,
          "trips",
          resolvedTripId,
          "itinerary"
        );

        const itineraryQuery = query(itineraryRef, orderBy("createdAt", "asc"));

        unsubscribeSnapshot = onSnapshot(
          itineraryQuery,
          async (snapshot) => {
            if (cancelled) return;

            const baseItems = snapshot.docs.map((itemDoc) => ({
              id: itemDoc.id,
              ...itemDoc.data(),
            }));

            const nextItems = await loadAttachmentsForItems(
              resolvedOwnerId,
              resolvedTripId,
              baseItems
            );

            if (!cancelled) {
              setItems(nextItems);
            }
          },
          (error) => {
            console.log("Trip itinerary snapshot error:", error);
            if (!cancelled) {
              setItems([]);
            }
          }
        );
      } catch (error) {
        console.log("loadItems error:", error);
        if (!cancelled) {
          setItems([]);
          setSourceTripOwnerId(paramSourceTripOwnerId || auth.currentUser?.uid || "");
          setSourceTripId(paramSourceTripId || tripId);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [tripId, paramSourceTripId, paramSourceTripOwnerId]);

  useFocusEffect(
    useCallback(() => {
      const cleanup = subscribeToItems();
      return () => {
        if (cleanup) cleanup();
      };
    }, [subscribeToItems])
  );

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const yearDiff = (a.year || 0) - (b.year || 0);
      if (yearDiff !== 0) return yearDiff;

      const monthDiff =
        (MONTH_ORDER[a.month] ?? 0) - (MONTH_ORDER[b.month] ?? 0);
      if (monthDiff !== 0) return monthDiff;

      const dayDiff = (a.day || 0) - (b.day || 0);
      if (dayDiff !== 0) return dayDiff;

      const aMinutes = (a.hour24 || 0) * 60 + (a.minute || 0);
      const bMinutes = (b.hour24 || 0) * 60 + (b.minute || 0);
      return aMinutes - bMinutes;
    });
  }, [items]);

  const groupedItems = useMemo(() => {
    const groups = {};
    sortedItems.forEach((item) => {
      const key = item.dateLabel || "No Date";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups);
  }, [sortedItems]);

  const resolvedOwnerForNav =
    paramSourceTripOwnerId || sourceTripOwnerId || auth.currentUser?.uid || "";
  const resolvedTripForNav =
    paramSourceTripId || sourceTripId || tripId;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerIcon}>
            <Ionicons name="chevron-back" size={24} color={TEXT} />
          </Pressable>

          <Text style={styles.headerTitle}>Trip Itinerary</Text>

          <Pressable
            onPress={() =>
              router.push({
                pathname: "/addactivity",
                params: {
                  tripId: String(tripId),
                  sourceTripId: String(resolvedTripForNav),
                  sourceTripOwnerId: String(resolvedOwnerForNav),
                },
              })
            }
            style={styles.headerIcon}
          >
            <Ionicons name="add" size={24} color={TEXT} />
          </Pressable>
        </View>

        {groupedItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No items yet</Text>
            <Text style={styles.emptyText}>
              Add activities, transportation, food, or hotel plans for this trip.
            </Text>
          </View>
        ) : (
          groupedItems.map(([dateLabel, dateItems]) => (
            <View key={dateLabel} style={styles.section}>
              <Text style={styles.sectionTitle}>{dateLabel}</Text>

              {dateItems.map((item) => {
                const attachmentCount = getAttachmentCount(item);
                const firstImage = getFirstImage(item);

                return (
                  <Pressable
                    key={item.id}
                    style={styles.card}
                    onPress={() => {
                      router.push({
                        pathname: "/tripitemdetails",
                        params: {
                          tripId: String(tripId),
                          itemId: String(item.id),
                          sourceTripId: String(resolvedTripForNav),
                          sourceTripOwnerId: String(resolvedOwnerForNav),
                        },
                      });
                    }}
                  >
                    <View style={styles.cardTopRow}>
                      <View style={styles.cardTextWrap}>
                        <Text style={styles.cardTitle}>
                          {item.description || "No description"}
                        </Text>
                        <Text style={styles.cardMeta}>
                          {getCategoryLabel(item.category)}
                          {item.timeLabel ? ` • ${item.timeLabel}` : ""}
                        </Text>
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#6B7280"
                      />
                    </View>

                    {firstImage ? (
                      <View style={styles.previewImageWrap}>
                        <Image
                          source={{ uri: firstImage.downloadURL || firstImage.uri }}
                          style={styles.previewImage}
                          resizeMode="cover"
                        />
                      </View>
                    ) : null}

                    {!!item.location && (
                      <View style={styles.detailRow}>
                        <Ionicons
                          name="location-outline"
                          size={16}
                          color="#6B7280"
                        />
                        <Text style={styles.detailText}>{item.location}</Text>
                      </View>
                    )}

                    <View style={styles.bottomRow}>
                      <Text style={styles.priceText}>
                        ${Number(item.price ?? 0)}
                      </Text>

                      {attachmentCount > 0 ? (
                        <View style={styles.attachmentBadge}>
                          <Ionicons
                            name="camera-outline"
                            size={14}
                            color={BLUE}
                          />
                          <Text style={styles.attachmentBadgeText}>
                            {attachmentCount}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#DCE6FF",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 18,
  },

  headerIcon: {
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
    color: "#3F63F3",
    fontWeight: "700",
  },

  emptyCard: {
    backgroundColor: "#D4DEFF",
    borderWidth: 1,
    borderColor: "#B4C6FF",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
  },

  section: {
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 18,
    color: "#1F2937",
    marginBottom: 10,
    fontWeight: "600",
  },

  card: {
    backgroundColor: "#D4DEFF",
    borderWidth: 1,
    borderColor: "#B4C6FF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  cardTextWrap: {
    flex: 1,
    marginRight: 10,
  },

  cardTitle: {
    fontSize: 17,
    color: "#111827",
    fontWeight: "600",
    marginBottom: 4,
  },

  cardMeta: {
    fontSize: 13,
    color: "#4B5563",
  },

  previewImageWrap: {
    width: "100%",
    height: 140,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#C2D0FF",
    marginBottom: 10,
  },

  previewImage: {
    width: "100%",
    height: "100%",
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  detailText: {
    marginLeft: 6,
    color: "#4B5563",
    fontSize: 14,
    flex: 1,
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  priceText: {
    fontSize: 15,
    color: "#1F2937",
    fontWeight: "600",
  },

  attachmentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#9FB2FF",
    backgroundColor: "#EEF2FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  attachmentBadgeText: {
    color: "#3F63F3",
    fontSize: 12,
    fontWeight: "700",
  },
});