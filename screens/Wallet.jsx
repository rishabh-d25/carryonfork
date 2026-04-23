import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Animated, Dimensions, KeyboardAvoidingView, Modal,
  Platform, Pressable, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from "react-native";
import { Line, Svg } from "react-native-svg";
import { auth, db } from "../firebaseConfig";

const SCREEN_W = Dimensions.get("window").width;
const CHART_W = SCREEN_W - 64;
const CHART_H = 160;

export default function WalletScreen() {
  const router = useRouter();
const { tripId, title } = useLocalSearchParams();
  const [budget, setBudget] = useState(0);
  const [tripDays, setTripDays] = useState(1);
  const [expenses, setExpenses] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseName, setExpenseName] = useState("");
  const [expenseCost, setExpenseCost] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  let total = 0;
  for (let i = 0; i < expenses.length; i++) {
    total += expenses[i].cost || 0;
  }

  const remaining = Math.max(budget - total, 0);
  const dailyBudget = tripDays > 0 ? Math.round(remaining / tripDays) : 0;
  const pctUsed = budget > 0 ? (total / budget) * 100 : 0;

useEffect(() => {
  const user = auth.currentUser;
  if (!user || !tripId) return;

  (async () => {
    try {
      const snap = await getDoc(doc(db, "users", user.uid, "trips", String(tripId)));
      if (!snap.exists()) return;

      const d = snap.data() || {};
      setBudget(Number(d.budget) || 0);

      if (d.startDate && d.endDate) {
        const start = d.startDate.toDate();
        const end = d.endDate.toDate();
        const days = Math.max(1, Math.ceil((end - start) / 86400000));
        setTripDays(days);
      }

      const country = d.location?.country?.trim();
      if (!country) {
        setSelectedCurrency(null);
        return;
      }

      const countryRes = await fetch(
        `https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fullText=true`
      );
      const countryJson = await countryRes.json();
      const countryInfo = Array.isArray(countryJson) ? countryJson[0] : null;

      const currencies = countryInfo?.currencies || {};
      const currencyCode = Object.keys(currencies)[0];

      if (currencyCode) {
        setSelectedCurrency({
          code: currencyCode.toUpperCase(),
          label: currencies[currencyCode]?.name || currencyCode.toUpperCase(),
        });
      } else {
        setSelectedCurrency(null);
      }
    } catch (error) {
      console.log("LOAD WALLET DATA ERROR:", error);
      setSelectedCurrency(null);
    }
  })();
}, [tripId]);

  useEffect(() => {
    const user = auth.currentUser;
    const q = query(collection(db, "users", user.uid, "trips", String(tripId), "majorExpenses"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [tripId]);

  useEffect(() => {
    if (!selectedCurrency) return;
    const url = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";
    setExchangeRate(null);
    (async () => {
      const data = await fetch(url).then(r => r.json());
      setExchangeRate(data?.usd?.[selectedCurrency.code.toLowerCase()] ?? null);
    })();
  }, [selectedCurrency]);

  async function addExpense() {
    const user = auth.currentUser;
    const cost = parseFloat(expenseCost);
    await addDoc(collection(db, "users", user.uid, "trips", String(tripId), "majorExpenses"), {
      name: expenseName.trim(), cost, createdAt: serverTimestamp(),
    });
    setExpenseName(""); setExpenseCost(""); setShowAddExpense(false);
  }

  function formatRate(rate) {
    if (rate == null) return "—";
    if (rate >= 1000) return rate.toFixed(0);
    if (rate >= 100) return rate.toFixed(1);
    if (rate >= 1) return rate.toFixed(3);
    return rate.toFixed(5);
  }

  const PAD_L = 8, PAD_R = 8;

  function BudgetChart() {
    if (budget <= 0) {
      return (
        <View style={styles.chartWrap}>
          <Text style={styles.chartTitle}>Budget Graph</Text>
          <Text style={{ color: "#aaa" }}>No budget set</Text>
        </View>
      );
    }

    const plotH = CHART_H - 40;
    const magnitude = Math.pow(10, Math.floor(Math.log10(budget)));
    const niceMax = Math.ceil(budget / magnitude) * magnitude;
    const toY = v => 16 + plotH - (v / niceMax) * plotH;
    const baseY = toY(0);
    const barX = PAD_L + 36 + (CHART_W - PAD_L - PAD_R - 36) / 2;
    const barW = 40;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((pct, i) => ({
      val: Math.round(niceMax * pct), y: toY(niceMax * pct), key: `t${i}`,
    }));

    return (
      <View style={styles.chartWrap}>
        <Text style={styles.chartTitle}>Budget Graph</Text>
        <View style={{ width: CHART_W, height: CHART_H }}>
          <Svg width={CHART_W} height={CHART_H} style={{ position: "absolute" }}>
            {ticks.map(t => <Line key={t.key} x1={PAD_L + 36} y1={t.y} x2={CHART_W - PAD_R} y2={t.y} stroke="#f0f0f0" strokeWidth="1" />)}
            <Line x1={barX} y1={toY(budget)} x2={barX} y2={baseY} stroke="#3F63F3" strokeWidth={barW} strokeOpacity="0.18" />
            <Line x1={PAD_L + 36} y1={baseY} x2={CHART_W - PAD_R} y2={baseY} stroke="#ddd" strokeWidth="1.5" />
          </Svg>
          {ticks.map(t => (
            <Text key={t.key} style={[styles.yLabel, { top: t.y - 7 }]}>
              {t.val >= 10000 ? `$${(t.val / 1000).toFixed(0)}k` : `$${t.val.toLocaleString()}`}
            </Text>
          ))}
          <Text style={[styles.xLabel, { left: barX - barW / 2, width: barW, top: baseY + 6 }]}>Budget</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#3F63F3" }} />
          <Text style={{ fontSize: 12, color: "#555" }}>Budget ${budget.toLocaleString()}</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
<TouchableOpacity
  onPress={() =>
    router.replace({
      pathname: "/maintrip",
      params: { tripId, title},
    })
  }
style={styles.backBtn}>
  <Ionicons name="chevron-back" size={24} color="#111827" />
</TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet</Text>
        <View style={{ width: 36 }} />
      </View>

      <Animated.ScrollView style={{ opacity: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <Text style={styles.sectionLabel}>Reminders</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4, paddingRight: 4 }}>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Daily Budget</Text>
            <Text style={styles.cardBig}>
              ${dailyBudget > 0 ? dailyBudget.toLocaleString() : "—"}
              <Text style={styles.cardBigSub}>/day</Text>
            </Text>
            <Text style={styles.cardSub}>${remaining.toLocaleString()} left after major expenses</Text>
            {budget > 0 && <>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pctUsed}%` }]} />
              </View>
              <Text style={styles.cardSub}>{(100 - pctUsed).toFixed(0)}% of ${budget.toLocaleString()} remaining</Text>
            </>}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Exchange Rate</Text>
            <Text style={styles.cardBig} numberOfLines={1}>
              {`1 USD = ${formatRate(exchangeRate)}`}
            </Text>
            <Text style={styles.cardSub} numberOfLines={1}>
              {selectedCurrency ? `USD → ${selectedCurrency.label}` : "Loading..."}
            </Text>
          </View>

        </ScrollView>

        <BudgetChart />

        <View style={styles.majorHeader}>
          <Text style={styles.majorTitle}>Major Expenses</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddExpense(true)}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {expenses.length === 0
          ? <Text style={{ fontSize: 13, color: "#bbb", fontStyle: "italic" }}>No major expenses yet. Tap + to add one.</Text>
          : expenses.map(e => (
            <View key={e.id} style={styles.expenseRow}>
              <Text style={styles.expenseName}>{e.name}</Text>
              <Text style={styles.expenseCost}>${e.cost.toLocaleString()}</Text>
            </View>
          ))
        }

        <View style={{ height: 48 }} />
      </Animated.ScrollView>

      <Modal visible={showAddExpense} transparent animationType="slide" onRequestClose={() => setShowAddExpense(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <Pressable style={styles.overlay} onPress={() => setShowAddExpense(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Add Major Expense</Text>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput style={styles.input} placeholder="e.g. Hotel, Flights, Car Rental..." placeholderTextColor="#aaa" value={expenseName} onChangeText={setExpenseName} />
            <Text style={styles.inputLabel}>Cost (USD $)</Text>
            <TextInput style={styles.input} placeholder="0.00" placeholderTextColor="#aaa" keyboardType="numeric" value={expenseCost} onChangeText={setExpenseCost} />
            <TouchableOpacity style={[styles.saveBtn, { opacity: 0.6 }]} onPress={addExpense}>
              <Text style={styles.saveBtnText}>{"Add Expense"}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    backgroundColor: "#DCE6FF",
  },

  backBtn: {
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
    fontWeight: "700",
    color: "#3F63F3",
  },

  scroll: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 18,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  card: {
    width: 200,
    backgroundColor: "#D4DEFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#B4C6FF",
    shadowColor: "#3F63F3",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  cardTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  cardBig: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 4,
  },

  cardBigSub: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },

  cardSub: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },

  progressTrack: {
    height: 5,
    backgroundColor: "#C9D7FF",
    borderRadius: 3,
    marginTop: 8,
    overflow: "hidden",
  },

  progressFill: {
    height: 5,
    backgroundColor: "#3F63F3",
    borderRadius: 3,
  },

  chartWrap: {
    backgroundColor: "#D4DEFF",
    borderRadius: 16,
    padding: 16,
    paddingLeft: 40,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#B4C6FF",
    shadowColor: "#3F63F3",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },

  yLabel: {
    position: "absolute",
    left: 4,
    fontSize: 10,
    color: "#6B7280",
  },

  xLabel: {
    position: "absolute",
    fontSize: 10,
    color: "#6B7280",
    textAlign: "center",
    fontWeight: "600",
  },

  majorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 12,
  },

  majorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1F2937",
  },

  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#3F63F3",
    alignItems: "center",
    justifyContent: "center",
  },

  expenseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#C9D7FF",
  },

  expenseName: {
    fontSize: 15,
    color: "#1F2937",
    fontWeight: "500",
    flex: 1,
  },

  expenseCost: {
    fontSize: 15,
    color: "#3F63F3",
    fontWeight: "700",
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },

  sheet: {
    backgroundColor: "#DCE6FF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: "#B4C6FF",
  },

  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 16,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 6,
  },

  input: {
    borderWidth: 1,
    borderColor: "#B4C6FF",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#1F2937",
    backgroundColor: "#EEF2FF",
    marginBottom: 14,
  },

  saveBtn: {
    backgroundColor: "#3F63F3",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },

  saveBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
});