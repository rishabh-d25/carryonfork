// app/maintrip.jsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
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

const BLUE = "#3F63F3";

export default function MainTrip() {
  const router = useRouter();

  // ✅ local images (NO links)
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

  // Buttons (wire these up later)
  const onTodo = () => console.log("My Tokyo To-Do");
  const onAdd = () => console.log("Add Activity");
  const onExpenses = () => console.log("Expenses");
  const onNotes = () => console.log("Notes");

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Top row */}
        <View style={styles.topRow}>
          <Pressable onPress={onBack} style={styles.iconButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </Pressable>

          <Text style={styles.headerTitle}>Tokyo, Japan</Text>

          <Pressable
            onPress={() => console.log("message")}
            style={[styles.iconButton, { justifyContent: "center" }]}
            hitSlop={8}
          >
            <Ionicons name="chatbubble-outline" size={20} color={BLUE} />
          </Pressable>
        </View>

        <Text style={styles.subhead}>Your trips so far...</Text>

        {/* Grid */}
        <View style={styles.grid}>
          {tiles.map((t) => {
            const isActive = activeId === t.id;

            return (
              <Pressable
                key={t.id}
                style={styles.tile}
                onPress={() => console.log("Open tile:", t.title)}
                // ✅ "hover" on web
                onHoverIn={Platform.OS === "web" ? () => showLabel(t.id) : undefined}
                onHoverOut={Platform.OS === "web" ? hideLabel : undefined}
                // ✅ "press/hold" on mobile
                onPressIn={Platform.OS !== "web" ? () => showLabel(t.id) : undefined}
                onPressOut={Platform.OS !== "web" ? hideLabel : undefined}
              >
                <Image source={t.img} style={styles.tileImg} />

                {/* name/date overlay */}
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

        {/* Buttons */}
        <Pressable onPress={onTodo} style={styles.btn}>
          <Text style={styles.btnText}>My Tokyo To-Do</Text>
        </Pressable>

        <Pressable onPress={onAdd} style={styles.btn}>
          <Text style={styles.btnText}>Add Activity</Text>
        </Pressable>

        <Pressable onPress={onExpenses} style={styles.btn}>
          <Text style={styles.btnText}>Expenses</Text>
        </Pressable>

        <Pressable onPress={onNotes} style={styles.btn}>
          <Text style={styles.btnText}>Notes</Text>
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 18, paddingBottom: 10 },

  topRow: {
    paddingTop: Platform.OS === "android" ? 10 : 4,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
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