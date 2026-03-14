import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Platform,
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
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const BLUE = "#3F63F3";

export default function MainTrip() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const tripId = params.tripId ? String(params.tripId) : null;
  const tripTitle = params.title ? String(params.title) : "Trip";

  const tiles = useMemo(
    () => [
      {
        id: "asakusa",
        title: "Asakusa",
        date: "03/2026",
        img: require("../assets/images/tokyo-1.jpg"),
      },
      {
        id: "sensoji",
        title: "Senso-ji",
        date: "03/2026",
        img: require("../assets/images/tokyo-2.jpg"),
      },
      {
        id: "shibuya",
        title: "Shibuya",
        date: "03/2026",
        img: require("../assets/images/tokyo-3.jpg"),
      },
      {
        id: "night",
        title: "Tokyo Nights",
        date: "03/2026",
        img: require("../assets/images/tokyo-4.jpg"),
      },
    ],
    []
  );

  const [activeId, setActiveId] = useState(null);

  const showLabel = (id) => setActiveId(id);
  const hideLabel = () => setActiveId(null);

  const onBack = () => router.back();

  const onTodo = () =>
    router.push({
      pathname: "/preparation",
      params: { tripId },
    });

  const onAdd = () => {
    router.push({
      pathname: "/addactivity",
      params: { tripId },
    });
  };

  const onExpenses = () => console.log("Expenses");

  const onJournal = () =>
    router.push({
      pathname: "/journal",
      params: { tripId },
    });

  const onItinerary = () =>
    router.push({
      pathname: "/tripitinerary",
      params: { tripId },
    });

  const actuallyDeleteTrip = async () => {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Error", "No user is logged in.");
      return;
    }

    if (!tripId) {
      Alert.alert("Error", "No trip was found to delete.");
      return;
    }

    try {
      const tripRef = doc(db, "users", user.uid, "trips", tripId);
      await deleteDoc(tripRef);
      router.replace("/dashboard");
    } catch (error) {
      console.log("DELETE TRIP ERROR:", error);
      Alert.alert("Error", "Trip could not be deleted.");
    }
  };

  const onDeleteTrip = () => {
    Alert.alert(
      "Delete Trip",
      `Are you sure you want to delete your ${tripTitle} trip?`,
      [
        {
          text: "No",
          style: "cancel",
        },
        {
          text: "Yes",
          style: "destructive",
          onPress: actuallyDeleteTrip,
        },
      ]
    );
  };

  if (!tripId) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No trip selected.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Pressable onPress={onBack} style={styles.iconButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </Pressable>

          <Text style={styles.headerTitle} numberOfLines={1}>
            {tripTitle}
          </Text>

          <View style={styles.rightIcons}>
            <Pressable
              onPress={async () => {
                try {
                  const q = query(
                    collection(db, "groupchats"),
                    where("tripId", "==", tripId)
                  );
                  const snapshot = await getDocs(q);

                  if (!snapshot.empty) {
                    const chatId = snapshot.docs[0].id;
                    router.push({ pathname: "/chat", params: { chatId } });
                  }
                } catch (error) {
                  console.log("CHAT LOAD ERROR:", error);
                }
              }}
              style={[styles.iconButton, { justifyContent: "center" }]}
              hitSlop={8}
            >
              <Ionicons name="chatbubble-outline" size={20} color={BLUE} />
            </Pressable>

            <Pressable
              onPress={onDeleteTrip}
              style={[styles.iconButton, { justifyContent: "center" }]}
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
            </Pressable>
          </View>
        </View>

        <Text style={styles.subhead}>Placeholder</Text>

        <View style={styles.grid}>
          {tiles.map((t) => {
            const isActive = activeId === t.id;

            return (
              <Pressable
                key={t.id}
                style={styles.tile}
                onPress={() => console.log("Open tile:", t.title)}
                onHoverIn={
                  Platform.OS === "web" ? () => showLabel(t.id) : undefined
                }
                onHoverOut={Platform.OS === "web" ? hideLabel : undefined}
                onPressIn={
                  Platform.OS !== "web" ? () => showLabel(t.id) : undefined
                }
                onPressOut={Platform.OS !== "web" ? hideLabel : undefined}
              >
                <Image source={t.img} style={styles.tileImg} />

                {isActive && (
                  <View style={styles.labelPill}>
                    <Text style={styles.labelText}>
                      {t.title} • {t.date}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={onTodo} style={styles.btn}>
          <Text style={styles.btnText}>My To-Do</Text>
        </Pressable>

        <Pressable onPress={onAdd} style={styles.btn}>
          <Text style={styles.btnText}>Add Activity</Text>
        </Pressable>

        <Pressable onPress={onItinerary} style={styles.btn}>
          <Text style={styles.btnText}>Trip Itinerary</Text>
        </Pressable>

        <Pressable onPress={onExpenses} style={styles.btn}>
          <Text style={styles.btnText}>Expenses</Text>
        </Pressable>

        <Pressable onPress={onJournal} style={styles.btn}>
          <Text style={styles.btnText}>Journal</Text>
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 18, paddingBottom: 10 },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyText: {
    fontSize: 16,
    color: "#111827",
  },

  topRow: {
    paddingTop: Platform.OS === "android" ? 10 : 4,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  rightIcons: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginHorizontal: 8,
  },

  subhead: {
    marginTop: 8,
    marginBottom: 12,
    fontSize: 14,
    color: "rgba(17,24,39,0.75)",
    fontWeight: "600",
    textAlign: "center",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginBottom: 18,
  },

  tile: {
    width: "48.5%",
    height: 110,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    position: "relative",
  },

  tileImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  labelPill: {
    position: "absolute",
    left: 10,
    top: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.12)",
  },

  labelText: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(17,24,39,0.85)",
  },

  btn: {
    marginTop: 12,
    width: "100%",
    height: 50,
    borderRadius: 8,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },

  btnText: {
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 1,
  },
});