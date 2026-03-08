import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getTripItems } from "../utils/tripStorage";

const BLUE = "#4967E8";
const BG = "#F7F7F7";
const BORDER = "#DADADA";
const TEXT = "#1F1F1F";

export default function TripItinerary() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tripId = params.tripId ? String(params.tripId) : null;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    if (!tripId) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getTripItems(tripId);
      setItems(data);
    } catch (error) {
      console.log("Load trip items error:", error);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const groupedItems = useMemo(() => {
    const grouped = {};

    for (const item of items) {
      const key = item.dateLabel || "No Date";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }

    return Object.entries(grouped);
  }, [items]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={24} color={TEXT} />
        </Pressable>

        <Text style={styles.headerTitle}>Trip Itinerary</Text>

        <Pressable
          onPress={() =>
            router.push({
              pathname: "/addactivity",
              params: { tripId },
            })
          }
          style={styles.iconButton}
        >
          <Ionicons name="add" size={24} color={TEXT} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={BLUE} />
        </View>
      ) : !tripId ? (
        <View style={styles.centerWrap}>
          <Text style={styles.emptyText}>No trip selected.</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerWrap}>
          <Text style={styles.emptyText}>No items yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {groupedItems.map(([date, group]) => (
            <View key={date} style={styles.section}>
              <Text style={styles.sectionTitle}>{date}</Text>

              {group.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.card}
                  onPress={() =>
                    router.push({
                      pathname: "/activitydetails",
                      params: { tripId, editId: item.id },
                    })
                  }
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.cardCategory}>
                      {item.category?.charAt(0).toUpperCase() + item.category?.slice(1)}
                    </Text>
                    <Text style={styles.cardTime}>{item.timeLabel}</Text>
                  </View>

                  <Text style={styles.cardTitle}>{item.description}</Text>

                  {!!item.location && (
                    <Text style={styles.cardSubtext}>{item.location}</Text>
                  )}

                  {!!item.reservationNumber && (
                    <Text style={styles.cardSubtext}>
                      Reservation: {item.reservationNumber}
                    </Text>
                  )}

                  <Text style={styles.cardPrice}>${item.price}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },

  iconButton: {
    width: 34,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 18,
    color: TEXT,
    fontFamily: "serif",
  },

  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyText: {
    fontSize: 16,
    color: TEXT,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  section: {
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 18,
    color: TEXT,
    fontFamily: "serif",
    marginBottom: 10,
  },

  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  cardCategory: {
    fontSize: 13,
    color: BLUE,
    fontWeight: "700",
  },

  cardTime: {
    fontSize: 13,
    color: "#666",
  },

  cardTitle: {
    fontSize: 16,
    color: TEXT,
    fontWeight: "600",
    marginBottom: 6,
  },

  cardSubtext: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },

  cardPrice: {
    fontSize: 14,
    color: TEXT,
    marginTop: 4,
  },
});