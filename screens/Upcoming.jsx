import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";

import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const BLUE = "#4967E8";
const BG = "#F7F7F7";
const BORDER = "#DADADA";
const TEXT = "#1F1F1F";

const TRIP_COLORS = [
  "#4967E8", "#E8624A", "#3BAA6E", "#C94EC9",
  "#E8A83A", "#3ABDC9", "#E8536A", "#7A5CE8",
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseDate(ts) {
  if (!ts) return null;
  if (typeof ts === "object" && ts.toDate) {
    const d = ts.toDate();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return null;
}

function isBetween(date, start, end) {
  if (!start || !end) return false;
  return date >= start && date <= end;
}

export default function UpcomingScreen() {
  const router = useRouter();

  const today = new Date();
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const user = auth.currentUser;
        const snapshot = await getDocs(collection(db, "users", user.uid, "trips"));
const fetched = snapshot.docs.map((doc, i) => ({
  id: doc.id,
  color: TRIP_COLORS[i % TRIP_COLORS.length],
  ...doc.data(),
}));

// 🔥 sort by END DATE (soonest ending first)
fetched.sort((a, b) => {
  const aEnd = parseDate(a.endDate)?.getTime() || 0;
  const bEnd = parseDate(b.endDate)?.getTime() || 0;
  return aEnd - bEnd;
});

setTrips(fetched);
        setTrips(fetched);
      } catch (e) {
        console.error("Error fetching trips:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchTrips();
  }, []);

  const daysInMonth = useMemo(() => {
    return new Date(year, monthIndex + 1, 0).getDate();
  }, [year, monthIndex]);

  const firstDayOfMonth = useMemo(() => {
    return new Date(year, monthIndex, 1).getDay();
  }, [year, monthIndex]);

  const calendarCells = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push({ type: "empty", key: `e-${i}` });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ type: "day", key: `d-${day}`, value: day });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ type: "empty-end", key: `ee-${cells.length}` });
    }
    return cells;
  }, [firstDayOfMonth, daysInMonth]);

function getTripsForDay(day) {
  const date = new Date(year, monthIndex, day);
  date.setHours(0, 0, 0, 0);

  const tripsForDay = trips.filter((trip) => {
    const start = parseDate(trip.startDate);
    const end = parseDate(trip.endDate);
    return isBetween(date, start, end);
  });

  function getDayRank(trip) {
    const start = parseDate(trip.startDate);
    const end = parseDate(trip.endDate);

    const startsToday = start && start.getTime() === date.getTime();
    const endsToday = end && end.getTime() === date.getTime();

    // ends today but started earlier
    if (endsToday && !startsToday) return 0;

    // starts and ends today
    if (startsToday && endsToday) return 1;

    // starts today and continues later
    if (startsToday && !endsToday) return 2;

    // trips already in progress, neither starting nor ending today
    return 3;
  }

  return tripsForDay.sort((a, b) => {
    const rankDiff = getDayRank(a) - getDayRank(b);
    if (rankDiff !== 0) return rankDiff;

    const aEnd = parseDate(a.endDate)?.getTime() || 0;
    const bEnd = parseDate(b.endDate)?.getTime() || 0;
    if (aEnd !== bEnd) return aEnd - bEnd;

    const aStart = parseDate(a.startDate)?.getTime() || 0;
    const bStart = parseDate(b.startDate)?.getTime() || 0;
    return aStart - bStart;
  });
}

  function goPrevMonth() {
    if (monthIndex === 0) {
      setMonthIndex(11);
      setYear((y) => y - 1);
    } else {
      setMonthIndex((m) => m - 1);
    }
    setSelectedDay(null);
  }

  function goNextMonth() {
    if (monthIndex === 11) {
      setMonthIndex(0);
      setYear((y) => y + 1);
    } else {
      setMonthIndex((m) => m + 1);
    }
    setSelectedDay(null);
  }

  const selectedTrips = useMemo(() => {
    if (!selectedDay) return [];
    return getTripsForDay(selectedDay);
  }, [selectedDay, trips, monthIndex, year]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.dismissTo({ pathname: "/dashboard" })}
          style={styles.iconButton}
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>

        <Text style={styles.title}>Upcoming</Text>

        <View style={styles.iconButton} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={BLUE} />
        </View>
      ) : (
        <>
          <View style={styles.calendarCard}>
            <View style={styles.calendarTopRow}>
              <Pressable onPress={goPrevMonth} style={styles.arrowButton}>
                <Ionicons name="chevron-back" size={18} color={TEXT} />
              </Pressable>

              <Text style={styles.monthYearText}>
                {MONTHS[monthIndex]} {year}
              </Text>

              <Pressable onPress={goNextMonth} style={styles.arrowButton}>
                <Ionicons name="chevron-forward" size={18} color={TEXT} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <Text key={d} style={styles.weekText}>
                  {d}
                </Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {calendarCells.map((cell) => {
                if (cell.type !== "day") {
                  return <View key={cell.key} style={styles.dayCell} />;
                }

                const tripsOnDay = getTripsForDay(cell.value);
                const isSelected = cell.value === selectedDay;
                const hasTrip = tripsOnDay.length > 0;
                const tripColor = hasTrip ? tripsOnDay[0].color : null;

                return (
                  <Pressable
                    key={cell.key}
                    style={[
                      styles.dayCell,
                      hasTrip && { backgroundColor: tripColor + "30" },
                      isSelected && {
                        backgroundColor: tripColor || BLUE,
                        borderRadius: 10,
                      },
                    ]}
                    onPress={() => setSelectedDay(cell.value)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        hasTrip && { color: tripColor, fontWeight: "600" },
                        isSelected && { color: "#fff", fontWeight: "700" },
                      ]}
                    >
                      {cell.value}
                    </Text>

                    {tripsOnDay.length > 1 && (
                      <View style={styles.dotsRow}>
                        {tripsOnDay.slice(0, 3).map((t) => (
                          <View
                            key={t.id}
                            style={[styles.dot, { backgroundColor: t.color }]}
                          />
                        ))}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <ScrollView
            style={styles.detailsArea}
            contentContainerStyle={styles.detailsContent}
          >
            {!selectedDay && (
              <Text style={styles.placeholderText}>
                Tap a day to see trip details
              </Text>
            )}

            {selectedDay && selectedTrips.length === 0 && (
              <Text style={styles.placeholderText}>No trips on this day</Text>
            )}

            {selectedTrips.map((trip) => (
              <View
                key={trip.id}
                style={[styles.tripCard, { borderLeftColor: trip.color }]}
              >
                <View style={styles.tripTitleRow}>
                  <View
                    style={[styles.colorDot, { backgroundColor: trip.color }]}
                  />
<Text style={styles.tripLocation}>
  {typeof trip.location === "string"
    ? trip.location
    : [trip.location?.city, trip.location?.country].filter(Boolean).join(", ") || "Trip"}
</Text>
                </View>

                <View style={styles.tripDetailsGrid}>
                  <View style={styles.tripDetailItem}>
                    <Text style={styles.tripDetailLabel}>Dates</Text>
                    <Text style={styles.tripDetailValue}>
                      {parseDate(trip.startDate)?.toLocaleDateString()} →{" "}
                      {parseDate(trip.endDate)?.toLocaleDateString()}
                    </Text>
                  </View>

                  {trip.budget ? (
                    <View style={styles.tripDetailItem}>
                      <Text style={styles.tripDetailLabel}>Budget</Text>
                      <Text style={styles.tripDetailValue}>${trip.budget}</Text>
                    </View>
                  ) : null}

                  {trip.description ? (
                    <View style={styles.tripDetailItem}>
                      <Text style={styles.tripDetailLabel}>Description</Text>
                      <Text style={styles.tripDetailValue}>
                        {trip.description}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.tripDetailItem}>
                    <Text style={styles.tripDetailLabel}>Group Trip</Text>
                    <Text style={styles.tripDetailValue}>
                      {trip.withGroup ? "Yes" : "No"}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },



  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#3F63F3",
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  calendarCard: {
    backgroundColor: "#D4DEFF",
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#B4C6FF",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
    marginBottom: 12,
  },

  calendarTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  arrowButton: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  monthYearText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },

  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 2,
  },

  weekText: {
    width: "14.28%",
    textAlign: "center",
    color: "#6B7280",
    fontSize: 12,
  },

  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    marginBottom: 2,
  },

  dayText: {
    fontSize: 15,
    color: "#1F2937",
  },

  dotsRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 1,
  },

  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  detailsArea: {
    flex: 1,
    marginHorizontal: 16,
  },

  detailsContent: {
    paddingBottom: 30,
    gap: 12,
  },

  placeholderText: {
    textAlign: "center",
    color: "#6B7280",
    fontSize: 14,
    marginTop: 24,
  },

  tripCard: {
    backgroundColor: "#D4DEFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#B4C6FF",
    borderLeftWidth: 4,
    padding: 14,
  },

  tripTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },

  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  tripLocation: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1F2937",
  },

  tripDetailsGrid: {
    gap: 6,
    marginBottom: 12,
  },

  tripDetailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  tripDetailLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
    width: 90,
  },

  tripDetailValue: {
    fontSize: 13,
    color: "#1F2937",
    flex: 1,
    textAlign: "right",
  },

  tripActions: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#B4C6FF",
    paddingTop: 10,
  },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#C9D7FF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#B4C6FF",
  },

  actionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3F63F3",
  },
});