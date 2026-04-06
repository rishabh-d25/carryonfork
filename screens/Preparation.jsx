import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Keyboard, Linking, Platform,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

// weather code → [description, icon]
const WMO = {
  0:["Clear sky","sunny-outline"], 1:["Mainly clear","partly-sunny-outline"],
  2:["Partly cloudy","partly-sunny-outline"], 3:["Overcast","cloud-outline"],
  45:["Foggy","cloud-outline"], 48:["Icy fog","cloud-outline"],
  51:["Light drizzle","rainy-outline"], 61:["Light rain","rainy-outline"],
  63:["Moderate rain","rainy-outline"], 65:["Heavy rain","rainy-outline"],
  71:["Light snow","snow-outline"], 73:["Moderate snow","snow-outline"],
  75:["Heavy snow","snow-outline"], 80:["Rain showers","rainy-outline"],
  85:["Snow showers","snow-outline"], 95:["Thunderstorm","thunderstorm-outline"],
  99:["Severe storm","thunderstorm-outline"],
};
const wmo = (code) => { const k = Object.keys(WMO).map(Number).sort((a,b)=>b-a).find(k=>code>=k)??0; return WMO[k]??["Unknown","help-outline"]; };

let _id = 0;
const item = (label) => ({ id: String(++_id), label, checked: false });
const makeDocItems = (country) => [
  item(`Check visa requirements for ${country||"destination"}`),
  item("Ensure passport is valid 6+ months beyond return date"),
  item("Apply for visa / eVisa if required"),
  item("Make 2 copies of passport, visa, and bookings"),
  item("Save embassy phone number in contacts"),
];

const SECTIONS = {
  documents:    { title: "DOCUMENTS & VISA",  icon: "document-text-outline", checklist: true },
  essentials:   { title: "ESSENTIALS",         icon: "bag-outline",           checklist: true },
  reservations: { title: "RESERVATIONS",       icon: "calendar-outline",      checklist: true },
  health:       { title: "HEALTH & SAFETY",    icon: "medical-outline",       checklist: true },
  weather:      { title: "WEATHER FORECAST",   icon: "partly-sunny-outline",  checklist: false },
  flights:      { title: "FIND FLIGHTS",       icon: "airplane-outline",      checklist: false },
};

const DEFAULT_LISTS = {
  documents: makeDocItems(""),
  essentials: [
    item("Pack power adapter / voltage converter"),
    item("Download offline maps (Google Maps / Maps.me)"),
    item("Set up international roaming or buy local SIM"),
    item("Notify your bank of travel dates"),
    item("Pack travel-size toiletries"),
    item("Bring sufficient local currency / card"),
    item("Pack medication + doctor's letter if needed"),
    item("Emergency contacts written down offline"),
  ],
  reservations: [
    item("Flights booked & confirmation saved"),
    item("Accommodation booked for all nights"),
    item("Airport transfers arranged"),
    item("Travel insurance purchased"),
    item("Tours / activities pre-booked"),
    item("Check-in online (24h before flight)"),
  ],
  health: [
    item("Check CDC destination health notices"),
    item("Visit travel clinic for vaccinations"),
    item("Purchase travel health insurance"),
    item("Research nearest hospitals at destination"),
    item("Pack first aid kit"),
    item("Know local emergency number"),
  ],
};

export default function BeforeYouTravel() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams();

  const [cityInput, setCityInput] = useState("");
  const [countryInput, setCountryInput] = useState("");
  const [destination, setDestination] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [countryData, setCountryData] = useState(null);
  const [localTime, setLocalTime] = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [openKey, setOpenKey] = useState("documents");
  const [lists, setLists] = useState(DEFAULT_LISTS);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    const user = auth.currentUser;
    if (!user || !tripId) return;
    getDoc(doc(db, "users", user.uid, "trips", String(tripId))).then((snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (d.startDate) setStartDate(d.startDate.toDate());
      if (d.endDate) setEndDate(d.endDate.toDate());
    });
  }, [tripId]);

  // derived values
  const daysUntil = useMemo(() => {
    if (!startDate) return null;
    const now = new Date(); now.setHours(0,0,0,0);
    const s = new Date(startDate); s.setHours(0,0,0,0);
    return Math.max(Math.floor((s - now) / 86400000), 0);
  }, [startDate]);

  const { tasksDone, tasksTotal } = useMemo(() => {
    let done = 0, total = 0;
    Object.keys(lists).forEach(k => { total += lists[k].length; done += lists[k].filter(i => i.checked).length; });
    return { tasksDone: done, tasksTotal: total };
  }, [lists]);

  async function handleSearch() {
    const city = cityInput.trim(), country = countryInput.trim();
    if (!city || !country) { setSearchError("Please enter both a city and a country."); return; }
    setSearchError(""); setSearching(true); Keyboard.dismiss();

    try {
      // geocode
      const geoData = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${city}, ${country}`)}&format=json&limit=1&addressdetails=1`,
        { headers: { "User-Agent": "CarryOnTravelApp/1.0" } }
      ).then(r => r.json());
      if (!geoData.length) { setSearchError("City not found. Try a different spelling."); return; }
      const { lat: rawLat, lon: rawLon, address } = geoData[0];
      const lat = parseFloat(rawLat), lon = parseFloat(rawLon);
      const countryCode = address?.country_code?.toUpperCase() || "";

      // country info
      let cData = null;
      try {
        const c = await fetch(`https://restcountries.com/v3.1/alpha/${countryCode}`).then(r => r.json()).then(j => j[0]);
        cData = {
          name: c.name?.common || country,
          languages: Object.values(c.languages || {}).slice(0, 3).join(", ") || "—",
          callingCode: c.idd?.root ? `${c.idd.root}${(c.idd.suffixes||[])[0]||""}` : "—",
        };
      } catch (_) {}

      // local time
      try {
        const tz = await fetch(`https://timeapi.io/api/time/current/coordinate?latitude=${lat}&longitude=${lon}`).then(r => r.json());
        if (tz.dateTime) setLocalTime({
          time: new Date(tz.dateTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
          date: new Date(tz.dateTime).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
          timezone: tz.timeZone || "—",
          offset: tz.utcOffset || "—",
        });
      } catch (_) { setLocalTime(null); }

      // weather — only if trip is within 16 days
      setWeatherLoading(true); setWeather(null);
      try {
        const now = new Date(); now.setHours(0,0,0,0);
        const s = startDate ? new Date(new Date(startDate).setHours(0,0,0,0)) : null;
        const e = endDate ? new Date(new Date(endDate).setHours(0,0,0,0)) : null;
        const daysToStart = s ? Math.floor((s - now) / 86400000) : null;
        const daysToEnd = e ? Math.floor((e - now) / 86400000) : null;
        if (daysToStart !== null && daysToStart <= 16 && (daysToEnd === null || daysToEnd >= 0)) {
          const tripLen = e && s ? Math.ceil((e - s) / 86400000) + 1 : 7;
          const days = Math.min(Math.max(daysToStart, 0) + tripLen, 16);
          const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum&temperature_unit=fahrenheit&timezone=auto&forecast_days=${days}`).then(r => r.json());
          if (w.daily) {
            const idxs = w.daily.time.map((d, i) => {
              const date = new Date(d + "T12:00:00"); date.setHours(0,0,0,0);
              return (!s || date >= s) && (!e || date <= e) ? i : null;
            }).filter(i => i !== null);
            if (idxs.length) setWeather({ time: idxs.map(i=>w.daily.time[i]), temperature_2m_max: idxs.map(i=>w.daily.temperature_2m_max[i]), temperature_2m_min: idxs.map(i=>w.daily.temperature_2m_min[i]), weathercode: idxs.map(i=>w.daily.weathercode[i]), precipitation_sum: idxs.map(i=>w.daily.precipitation_sum[i]) });
          }
        }
      } catch (_) {}
      setWeatherLoading(false);

      setCountryData(cData);
      setDestination({ city, country: cData?.name || country, lat, lon });
      setLists(prev => ({ ...prev, documents: makeDocItems(cData?.name || country) }));
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.3, duration: 100, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } catch (_) {
      setSearchError("Search failed. Check your connection and try again.");
    } finally {
      setSearching(false);
    }
  }

  const toggleItem = (key, id) => setLists(prev => ({
    ...prev, [key]: prev[key].map(i => i.id === id ? { ...i, checked: !i.checked } : i),
  }));

  const openFlights = () => {
    const dest = destination?.city || countryInput || "";
    const from = startDate?.toISOString().slice(0, 10) || "";
    const to = endDate?.toISOString().slice(0, 10) || "";
    let url = `https://www.google.com/travel/flights?q=Flights+to+${encodeURIComponent(dest)}`;
    if (from) url += `&hl=en#flt=.${encodeURIComponent(dest)}.${from}*${encodeURIComponent(dest)}.${to}`;
    Linking.openURL(url);
  };

  const InfoRow = ({ label, val, bold }) => (
    <View style={st.infoRow}>
      <Text style={st.infoLabel}>{label}</Text>
      <Text style={[st.infoVal, bold && { fontWeight: "700" }]}>{val}</Text>
    </View>
  );

  const Hint = ({ icon = "information-circle-outline", text, color = "#2E5BFF" }) => (
    <View style={st.hintBox}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[st.hintText, { color }]}>{text}</Text>
    </View>
  );

  const Checklist = ({ sectionKey }) => (
    <View style={st.clWrap}>
      {lists[sectionKey].map(i => (
        <TouchableOpacity key={i.id} style={st.clRow} onPress={() => toggleItem(sectionKey, i.id)} activeOpacity={0.7}>
          <View style={[st.cb, i.checked && st.cbDone]}>
            {i.checked && <Ionicons name="checkmark" size={11} color="#fff" />}
          </View>
          <Text style={[st.clLabel, i.checked && st.clLabelDone]}>{i.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={st.safe}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* header */}
        <View style={st.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={st.topTitle}>Before You Travel</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* search */}
        <View style={st.searchCard}>
          <Text style={st.searchCardTitle}>Where are you going?</Text>
          <View style={st.searchRow}>
            {[
              { placeholder: "City", val: cityInput, set: setCityInput, flex: 1.2, icon: "business-outline", key: "next" },
              { placeholder: "Country", val: countryInput, set: setCountryInput, flex: 1.4, icon: "globe-outline", key: "search" },
            ].map(({ placeholder, val, set, flex, icon, key }) => (
              <View key={placeholder} style={[st.searchInput, { flex }]}>
                <Ionicons name={icon} size={14} color="#aaa" style={{ marginRight: 6 }} />
                <TextInput style={{ flex: 1, fontSize: 14, color: "#111" }} placeholder={placeholder} placeholderTextColor="#aaa"
                  value={val} onChangeText={set} onSubmitEditing={handleSearch} returnKeyType={key} />
              </View>
            ))}
          </View>
          {searchError ? <Text style={st.searchError}>{searchError}</Text> : null}
          <TouchableOpacity style={[st.searchBtn, searching && { opacity: 0.6 }]} onPress={handleSearch} disabled={searching}>
            {searching ? <ActivityIndicator size="small" color="#fff" /> : <>
              <Ionicons name="search" size={15} color="#fff" />
              <Text style={st.searchBtnText}>Load Destination Info</Text>
            </>}
          </TouchableOpacity>
          {destination && (
            <View style={st.destTag}>
              <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
              <Text style={st.destTagText}>Loaded: {destination.city}, {destination.country}</Text>
            </View>
          )}
        </View>

        {/* local info card */}
        {(countryData || localTime) && (
          <View style={st.localInfoCard}>
            <Text style={st.localInfoTitle}>{destination?.country || "Local Info"}</Text>
            {countryData?.languages && <InfoRow label="Language(s)" val={countryData.languages} />}
            {countryData?.callingCode && <InfoRow label="Calling Code" val={countryData.callingCode} />}
            {localTime && <>
              <InfoRow label="Local Time" val={localTime.time} bold />
              <InfoRow label="Local Date" val={localTime.date} />
              <InfoRow label="Timezone" val={localTime.timezone} />
              <InfoRow label="UTC Offset" val={localTime.offset} />
            </>}
          </View>
        )}

        {/* accordion */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={st.stack}>
            {Object.entries(SECTIONS).map(([key, meta]) => {
              const isOpen = openKey === key;
              const complete = meta.checklist && lists[key]?.every(i => i.checked) && lists[key]?.length > 0;
              return (
                <View key={key} style={[st.card, isOpen && st.cardOpen]}>
                  <TouchableOpacity onPress={() => setOpenKey(isOpen ? "" : key)} style={st.cardHeader} activeOpacity={0.8}>
                    <View style={st.cardHeaderLeft}>
                      {meta.checklist ? (
                        <View style={[st.secCb, complete && st.secCbDone]}>
                          {complete && <Ionicons name="checkmark" size={10} color="#fff" />}
                        </View>
                      ) : <Ionicons name={meta.icon} size={16} color="#2E5BFF" />}
                      <Text style={st.cardTitle}>{meta.title}</Text>
                    </View>
                    <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color="rgba(17,24,39,0.4)" />
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={st.cardBody}>
                      {/* documents */}
                      {key === "documents" && <>
                        {!destination && <Hint text="Search a destination above to load country info." />}
                        <Text style={st.subheading}>📋 Document Checklist</Text>
                        <Checklist sectionKey="documents" />
                      </>}

                      {/* checklist sections */}
                      {meta.checklist && key !== "documents" && <Checklist sectionKey={key} />}

                      {/* weather */}
                      {key === "weather" && <>
                        {!destination && <Hint text="Search a destination above to load weather." />}
                        {destination && weatherLoading && <ActivityIndicator size="small" color="#2E5BFF" style={{ marginVertical: 12 }} />}
                        {destination && !weatherLoading && !weather && (
                          <Hint icon="time-outline" color="#888" text={
                            daysUntil !== null && daysUntil > 16
                              ? `Your trip is ${daysUntil} days away. Forecasts are only available within 16 days.`
                              : "Weather data unavailable for this location."
                          } />
                        )}
                        {weather && <>
                          <Text style={st.weatherSubtitle}>
                            {startDate && endDate
                              ? `${startDate.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${endDate.toLocaleDateString("en-US",{month:"short",day:"numeric"})} · ${destination.city} · °F`
                              : `${destination.city} · °F`}
                          </Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.weatherScroll}>
                            {weather.time.map((date, i) => {
                              const [desc, icon] = wmo(weather.weathercode[i]);
                              return (
                                <View key={date} style={st.weatherCard}>
                                  <Text style={st.weatherDate}>{new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</Text>
                                  <Ionicons name={icon} size={26} color="#2E5BFF" style={{ marginVertical: 6 }} />
                                  <Text style={st.weatherDesc}>{desc}</Text>
                                  <Text style={st.weatherTemp}>{Math.round(weather.temperature_2m_max[i])}° / {Math.round(weather.temperature_2m_min[i])}°</Text>
                                  {weather.precipitation_sum[i] > 0 && <Text style={st.weatherRain}>💧 {weather.precipitation_sum[i].toFixed(1)}mm</Text>}
                                </View>
                              );
                            })}
                          </ScrollView>
                        </>}
                      </>}

                      {/* flights */}
                      {key === "flights" && <>
                        <Hint text="Flight booking APIs require commercial partnerships. We'll open Google Flights with your trip details pre-filled." />
                        {destination ? (
                          <View style={st.flightCard}>
                            {[
                              { icon: "airplane-outline", label: "Destination", val: destination.city },
                              ...(startDate && endDate ? [
                                { icon: "calendar-outline", label: "Depart", val: startDate.toLocaleDateString() },
                                { icon: "calendar-outline", label: "Return", val: endDate.toLocaleDateString() },
                              ] : []),
                            ].map(({ icon, label, val }) => (
                              <View key={label} style={st.flightRow}>
                                <Ionicons name={icon} size={16} color="#2E5BFF" />
                                <Text style={st.flightLabel}>{label}</Text>
                                <Text style={st.flightVal}>{val}</Text>
                              </View>
                            ))}
                          </View>
                        ) : <Text style={st.emptyText}>Search a destination above to pre-fill flight search.</Text>}
                        <TouchableOpacity style={st.flightBtn} onPress={openFlights}>
                          <Ionicons name="airplane" size={18} color="#fff" />
                          <Text style={st.flightBtnText}>Search on Google Flights</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[st.flightBtn, { backgroundColor: "#00897B", marginTop: 10 }]}
                          onPress={() => Linking.openURL(`https://www.kayak.com/flights/${destination?.city?.toUpperCase() || ""}`)}>
                          <Ionicons name="airplane-outline" size={18} color="#fff" />
                          <Text style={st.flightBtnText}>Search on Kayak</Text>
                        </TouchableOpacity>
                      </>}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* bottom stats */}
        <View style={st.bottomArea}>
          <View style={st.statRow}>
            <View style={st.leftStat}>
              <View style={st.clockWrap}>
                <Ionicons name="time-outline" size={28} color="#2E5BFF" />
              </View>
              <View>
                <Text style={st.bigNumber}>{daysUntil ?? "—"}</Text>
                <Text style={st.smallLabel}>{daysUntil === 0 ? "trip started!" : daysUntil === 1 ? "day until trip" : "days until trip"}</Text>
              </View>
            </View>
            <View style={st.rightStat}>
              <View style={st.progressTrack}>
                <View style={[st.progressFill, { width: `${Math.round((tasksDone / Math.max(tasksTotal, 1)) * 100)}%` }]} />
              </View>
              <View style={st.tasksRow}>
                <Text style={st.bigNumber}>{tasksDone}</Text>
                <Text style={st.slash}>/</Text>
                <Text style={st.bigNumber}>{tasksTotal}</Text>
              </View>
              <Text style={st.smallLabelCenter}>Tasks completed</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 18, paddingBottom: 14 },
  topRow: { paddingTop: Platform.OS === "android" ? 10 : 4, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  searchCard: { backgroundColor: "#f5f7ff", borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "rgba(46,91,255,0.15)" },
  searchCardTitle: { fontSize: 13, fontWeight: "700", color: "#2E5BFF", marginBottom: 10 },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  searchInput: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: "rgba(17,24,39,0.12)" },
  searchError: { fontSize: 12, color: "#dc2626", marginBottom: 6 },
  searchBtn: { backgroundColor: "#2E5BFF", borderRadius: 9, paddingVertical: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  searchBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  destTag: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  destTagText: { fontSize: 12, color: "#22c55e", fontWeight: "600" },
  localInfoCard: { backgroundColor: "#f5f7ff", borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "rgba(46,91,255,0.15)", gap: 8 },
  localInfoTitle: { fontSize: 13, fontWeight: "700", color: "#2E5BFF", marginBottom: 4 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  infoLabel: { fontSize: 11, color: "rgba(17,24,39,0.45)", fontWeight: "700", flex: 1 },
  infoVal: { fontSize: 12, color: "#222", fontWeight: "500", flex: 2, textAlign: "right" },
  stack: { gap: 10 },
  card: { borderRadius: 10, borderWidth: 1, borderColor: "rgba(17,24,39,0.12)", backgroundColor: "#fff", overflow: "hidden" },
  cardOpen: { borderColor: "#2E5BFF", borderWidth: 1.5 },
  cardHeader: { paddingHorizontal: 14, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { fontSize: 11, letterSpacing: 1.1, color: "rgba(17,24,39,0.55)", fontWeight: "700" },
  secCb: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: "rgba(17,24,39,0.25)", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  secCbDone: { backgroundColor: "#2E5BFF", borderColor: "#2E5BFF" },
  cardBody: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  clWrap: { gap: 10 },
  clRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cb: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: "rgba(17,24,39,0.22)", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", flexShrink: 0 },
  cbDone: { backgroundColor: "#2E5BFF", borderColor: "#2E5BFF" },
  clLabel: { fontSize: 13, color: "rgba(17,24,39,0.8)", flex: 1, lineHeight: 18 },
  clLabelDone: { color: "rgba(17,24,39,0.3)", textDecorationLine: "line-through" },
  hintBox: { flexDirection: "row", alignItems: "flex-start", gap: 7, backgroundColor: "#f0f4ff", borderRadius: 8, padding: 10, marginBottom: 10 },
  hintText: { flex: 1, fontSize: 12, lineHeight: 17 },
  subheading: { fontSize: 12, fontWeight: "700", color: "rgba(17,24,39,0.55)", letterSpacing: 0.8, marginBottom: 8 },
  emptyText: { fontSize: 12, color: "#aaa", fontStyle: "italic", marginBottom: 8, lineHeight: 17 },
  weatherSubtitle: { fontSize: 11, color: "rgba(17,24,39,0.45)", marginBottom: 10 },
  weatherScroll: { marginHorizontal: -14 },
  weatherCard: { width: 110, backgroundColor: "#f5f7ff", borderRadius: 12, padding: 10, marginLeft: 14, marginRight: 4, alignItems: "center", borderWidth: 1, borderColor: "rgba(46,91,255,0.1)" },
  weatherDate: { fontSize: 10, fontWeight: "700", color: "rgba(17,24,39,0.45)", textAlign: "center" },
  weatherDesc: { fontSize: 10, color: "#555", textAlign: "center", marginBottom: 3 },
  weatherTemp: { fontSize: 13, fontWeight: "800", color: "#111" },
  weatherRain: { fontSize: 10, color: "#555", marginTop: 2 },
  flightCard: { backgroundColor: "#f8f9ff", borderRadius: 10, padding: 12, marginBottom: 12, gap: 8, borderWidth: 1, borderColor: "rgba(46,91,255,0.12)" },
  flightRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  flightLabel: { fontSize: 12, color: "rgba(17,24,39,0.5)", fontWeight: "600", width: 70 },
  flightVal: { fontSize: 13, color: "#111", fontWeight: "600", flex: 1 },
  flightBtn: { backgroundColor: "#2E5BFF", borderRadius: 10, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  flightBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  bottomArea: { marginTop: 24, borderTopWidth: 1, borderTopColor: "rgba(17,24,39,0.08)", paddingTop: 18 },
  statRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 18 },
  leftStat: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  clockWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  rightStat: { flex: 1, alignItems: "center" },
  progressTrack: { width: "90%", height: 8, borderRadius: 8, backgroundColor: "rgba(17,24,39,0.15)", overflow: "hidden", marginBottom: 10 },
  progressFill: { height: "100%", borderRadius: 8, backgroundColor: "#2E5BFF" },
  tasksRow: { flexDirection: "row", alignItems: "flex-end", gap: 2, marginBottom: 2 },
  bigNumber: { fontSize: 38, fontWeight: "500", color: "#111827", lineHeight: 40 },
  slash: { fontSize: 28, color: "rgba(17,24,39,0.45)", paddingBottom: 4 },
  smallLabel: { marginTop: 4, fontSize: 12, color: "rgba(17,24,39,0.6)" },
  smallLabelCenter: { marginTop: 2, fontSize: 12, color: "rgba(17,24,39,0.6)", textAlign: "center" },
});