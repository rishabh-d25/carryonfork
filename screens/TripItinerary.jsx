
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getTripItems } from "../utils/tripStorage";

const BG = "#F7F7F7";
const BORDER = "#DADADA";
const TEXT = "#1F1F1F";
const BLUE = "#4967E8";

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

export default function TripItinerary() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams();
  const [items, setItems] = useState([]);

  const loadItems = useCallback(async () => {
    if (!tripId) return;

    try {
      const storedItems = await getTripItems(String(tripId));
      setItems(Array.isArray(storedItems) ? storedItems : []);
    } catch (error) {
      console.log("loadItems error:", error);
      setItems([]);
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const yearDiff = (a.year || 0) - (b.year || 0);
      if (yearDiff !== 0) return yearDiff;

      const monthDiff = (MONTH_ORDER[a.month] ?? 0) - (MONTH_ORDER[b.month] ?? 0);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerIcon}>
            <Ionicons name="chevron-back" size={24} color={TEXT} />
          </Pressable>

          <Text style={styles.headerTitle}>Trip Itinerary</Text>

          <Pressable
            onPress={() =>
              router.push({
                pathname: "/addactivity",
                params: { tripId: String(tripId) },
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

                return (
                  <Pressable
                    key={item.id}
                    style={styles.card}
                    onPress={() => {
                      console.log("Opening item:", item.id, "trip:", tripId);
                      router.push({
                        pathname: "/tripitemdetails",
                        params: {
                          tripId: String(tripId),
                          itemId: String(item.id),
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

                      <Ionicons name="chevron-forward" size={20} color="#8A8A8A" />
                    </View>

                    {!!item.location && (
                      <View style={styles.detailRow}>
                        <Ionicons name="location-outline" size={16} color="#777" />
                        <Text style={styles.detailText}>{item.location}</Text>
                      </View>
                    )}

                    <View style={styles.bottomRow}>
                      <Text style={styles.priceText}>${Number(item.price ?? 0)}</Text>

                      {attachmentCount > 0 ? (
                        <View style={styles.attachmentBadge}>
                          <Ionicons name="camera-outline" size={14} color={BLUE} />
                          <Text style={styles.attachmentBadgeText}>{attachmentCount}</Text>
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
  safeArea: { flex: 1, backgroundColor: BG },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 18,
  },
  headerIcon: {
    width: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    color: TEXT,
    fontFamily: "serif",
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    color: TEXT,
    marginBottom: 10,
    fontFamily: "serif",
  },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
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
    color: TEXT,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 13,
    color: "#777",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  detailText: {
    marginLeft: 6,
    color: "#555",
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
    color: TEXT,
    fontWeight: "600",
  },
  attachmentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#D7DDFE",
    backgroundColor: "#F4F6FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  attachmentBadgeText: {
    color: BLUE,
    fontSize: 12,
    fontWeight: "700",
  },
});