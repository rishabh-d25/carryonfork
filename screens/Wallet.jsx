import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
    Alert, Animated, Dimensions, KeyboardAvoidingView, Modal,
    Platform, Pressable, SafeAreaView, ScrollView, StatusBar,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { Circle, Line, Svg } from "react-native-svg";
import { auth, db } from "../firebaseConfig";

const SCREEN_W = Dimensions.get("window").width;
const CHART_W = SCREEN_W - 64;
const CHART_H = 160;

export default function WalletScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams();

  // state
  const [budget, setBudget] = useState(0);
  const [tripDays, setTripDays] = useState(1);
  const [expenses, setExpenses] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState({ code: "JPY", label: "Japanese Yen" });
  const [exchangeRate, setExchangeRate] = useState(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [currenciesLoading, setCurrenciesLoading] = useState(true);
  const [currencySearch, setCurrencySearch] = useState("");
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseName, setExpenseName] = useState("");
  const [expenseCost, setExpenseCost] = useState("");
  const [saving, setSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // derived values
  const totalSpent = expenses.reduce((sum, e) => sum + (e.cost || 0), 0);
  const remaining = Math.max(budget - totalSpent, 0);
  const dailyBudget = remaining > 0 && tripDays > 0 ? Math.round(remaining / tripDays) : 0;
  const pctUsed = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;
  const filteredCurrencies = currencies.filter(c =>
    c.label.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(currencySearch.toLowerCase())
  );

  // load trip budget + dates
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !tripId) return;
    getDoc(doc(db, "users", user.uid, "trips", String(tripId))).then(snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setBudget(d.budget || 0);
      if (d.startDate && d.endDate) {
        const days = Math.max(1, Math.round((d.endDate.toDate() - d.startDate.toDate()) / 86400000));
        setTripDays(days);
      }
    });
  }, [tripId]);

  // live-sync major expenses from firestore
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !tripId) return;
    const q = query(collection(db, "users", user.uid, "trips", String(tripId), "majorExpenses"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [tripId]);

  // load currency list on mount
  useEffect(() => {
    const urls = [
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.json",
      "https://latest.currency-api.pages.dev/v1/currencies.json",
    ];
    const parse = data => Object.entries(data)
      .filter(([code, label]) => /^[a-z]{3}$/.test(code) && typeof label === "string" && label.length > 2 && code !== "usd")
      .map(([code, label]) => ({ code: code.toUpperCase(), label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    (async () => {
      for (const url of urls) {
        try { setCurrencies(parse(await fetch(url).then(r => r.json()))); break; } catch (_) {}
      }
      setCurrenciesLoading(false);
    })();

    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  // fetch exchange rate, with fallback mirror
  useEffect(() => {
    const urls = [
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json`,
      `https://latest.currency-api.pages.dev/v1/currencies/usd.json`,
    ];
    setRateLoading(true);
    setExchangeRate(null);
    (async () => {
      for (const url of urls) {
        try {
          const data = await fetch(url).then(r => r.json());
          setExchangeRate(data?.usd?.[selectedCurrency.code.toLowerCase()] ?? null);
          break;
        } catch (_) {}
      }
      setRateLoading(false);
    })();
  }, [selectedCurrency]);

  async function addExpense() {
    const user = auth.currentUser;
    if (!user || !tripId) return;
    if (!expenseName.trim()) { Alert.alert("Name required"); return; }
    const cost = parseFloat(expenseCost);
    if (isNaN(cost) || cost <= 0) { Alert.alert("Enter a valid cost"); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, "users", user.uid, "trips", String(tripId), "majorExpenses"), {
        name: expenseName.trim(), cost, createdAt: serverTimestamp(),
      });
      setExpenseName(""); setExpenseCost(""); setShowAddExpense(false);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  }

  function formatRate(rate) {
    if (rate == null) return "—";
    if (rate >= 1000) return rate.toFixed(0);
    if (rate >= 100) return rate.toFixed(1);
    if (rate >= 1) return rate.toFixed(3);
    return rate.toFixed(5);
  }

  // simple single-bar budget chart
  function BudgetChart() {
    if (budget === 0) return (
      <View style={styles.chartWrap}>
        <Text style={styles.chartTitle}>Budget Overview</Text>
        <Text style={{ fontSize: 12, color: "#bbb", fontStyle: "italic" }}>Set a budget to see your overview</Text>
      </View>
    );

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
            <Circle cx={barX} cy={toY(budget)} r="6" fill="#3F63F3" />
            <Circle cx={barX} cy={toY(budget)} r="3" fill="#fff" />
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

  const PAD_L = 8, PAD_R = 8;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#111" />
        </Pressable>
        <Text style={styles.headerTitle}>Wallet</Text>
        <View style={{ width: 36 }} />
      </View>

      <Animated.ScrollView style={{ opacity: fadeAnim }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* reminder cards */}
        <Text style={styles.sectionLabel}>Reminders</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4, paddingRight: 4 }}>

          {/* daily budget card */}
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

          {/* exchange rate card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Exchange Rate</Text>
            <Text style={styles.cardBig} numberOfLines={1}>
              {rateLoading ? "Loading..." : exchangeRate != null ? `1 USD = ${formatRate(exchangeRate)}` : "Unavailable"}
            </Text>
            <Text style={styles.cardSub} numberOfLines={1}>USD → {selectedCurrency.label}</Text>
            <TouchableOpacity style={{ marginTop: 10 }} onPress={() => { setCurrencySearch(""); setShowCurrencyPicker(true); }}>
              <Text style={{ fontSize: 12, color: "#3F63F3", fontWeight: "700" }}>Change currency ›</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>

        {/* budget chart */}
        <BudgetChart />

        {/* major expenses */}
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

      {/* currency picker modal */}
      <Modal visible={showCurrencyPicker} transparent animationType="slide" onRequestClose={() => setShowCurrencyPicker(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowCurrencyPicker(false)} />
        <View style={[styles.sheet, { maxHeight: "75%" }]}>
          <Text style={styles.sheetTitle}>Select Currency</Text>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color="#aaa" />
            <TextInput style={{ flex: 1, fontSize: 14, color: "#111" }} placeholder="Search currency or code..." placeholderTextColor="#aaa" value={currencySearch} onChangeText={setCurrencySearch} autoCorrect={false} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {currenciesLoading
              ? <Text style={{ textAlign: "center", color: "#aaa", padding: 24 }}>Loading currencies...</Text>
              : filteredCurrencies.length === 0
                ? <Text style={{ textAlign: "center", color: "#aaa", padding: 24 }}>No results found</Text>
                : filteredCurrencies.map(c => (
                  <TouchableOpacity key={c.code} style={[styles.currencyRow, selectedCurrency.code === c.code && styles.currencyRowActive]} onPress={() => { setSelectedCurrency(c); setShowCurrencyPicker(false); }}>
                    <View>
                      <Text style={[styles.currencyName, selectedCurrency.code === c.code && { color: "#3F63F3", fontWeight: "700" }]}>{c.label}</Text>
                      <Text style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{c.code}</Text>
                    </View>
                    {selectedCurrency.code === c.code && <Ionicons name="checkmark" size={18} color="#3F63F3" />}
                  </TouchableOpacity>
                ))
            }
          </ScrollView>
        </View>
      </Modal>

      {/* add expense modal */}
      <Modal visible={showAddExpense} transparent animationType="slide" onRequestClose={() => setShowAddExpense(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <Pressable style={styles.overlay} onPress={() => setShowAddExpense(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Add Major Expense</Text>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput style={styles.input} placeholder="e.g. Hotel, Flights, Car Rental..." placeholderTextColor="#aaa" value={expenseName} onChangeText={setExpenseName} />
            <Text style={styles.inputLabel}>Cost (USD $)</Text>
            <TextInput style={styles.input} placeholder="0.00" placeholderTextColor="#aaa" keyboardType="numeric" value={expenseCost} onChangeText={setExpenseCost} />
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={addExpense} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Add Expense"}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8f9ff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, backgroundColor: "#f8f9ff" },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111" },
  scroll: { paddingHorizontal: 20, paddingTop: 4 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#888", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.6 },
  card: { width: 200, backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  cardTitle: { fontSize: 12, fontWeight: "700", color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  cardBig: { fontSize: 20, fontWeight: "800", color: "#111", marginBottom: 4 },
  cardBigSub: { fontSize: 14, fontWeight: "500", color: "#aaa" },
  cardSub: { fontSize: 12, color: "#aaa", marginTop: 4 },
  progressTrack: { height: 5, backgroundColor: "#eee", borderRadius: 3, marginTop: 8, overflow: "hidden" },
  progressFill: { height: 5, backgroundColor: "#3F63F3", borderRadius: 3 },
  chartWrap: { backgroundColor: "#fff", borderRadius: 16, padding: 16, paddingLeft: 40, marginTop: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  chartTitle: { fontSize: 16, fontWeight: "700", color: "#111", marginBottom: 8 },
  yLabel: { position: "absolute", left: 4, fontSize: 10, color: "#bbb" },
  xLabel: { position: "absolute", fontSize: 10, color: "#888", textAlign: "center", fontWeight: "600" },
  majorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 12 },
  majorTitle: { fontSize: 20, fontWeight: "800", color: "#111" },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#3F63F3", alignItems: "center", justifyContent: "center" },
  expenseRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  expenseName: { fontSize: 15, color: "#222", fontWeight: "500", flex: 1 },
  expenseCost: { fontSize: 15, color: "#3F63F3", fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: "#111", marginBottom: 16 },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#f5f5f5", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, gap: 8 },
  currencyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  currencyRowActive: { backgroundColor: "#f0f4ff", borderRadius: 8, paddingHorizontal: 8 },
  currencyName: { fontSize: 15, color: "#222", fontWeight: "500" },
  inputLabel: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: "#111", backgroundColor: "#fafafa", marginBottom: 14 },
  saveBtn: { backgroundColor: "#3F63F3", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});