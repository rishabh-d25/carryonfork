import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Platform, SafeAreaView, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

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
const wmo = (code) => {
  const k = Object.keys(WMO).map(Number).sort((a, b) => b - a).find(k => code >= k) ?? 0;
  return WMO[k] ?? ["Unknown", "help-outline"];
};

const item = (label, id) => ({ id, label, checked: false });

const makeDocItems = (country) => [
  item(`Check visa requirements for ${country || "destination"}`, "doc_1"),
  item("Ensure passport is valid 6+ months beyond return date", "doc_2"),
  item("Apply for visa / eVisa if required", "doc_3"),
  item("Make 2 copies of passport, visa, and bookings", "doc_4"),
  item("Save embassy phone number in contacts", "doc_5"),
];

const DEFAULT_LISTS = {
  documents: makeDocItems(""),
  essentials: [
    item("Pack power adapter / voltage converter", "ess_1"),
    item("Download offline maps (Google Maps / Maps.me)", "ess_2"),
    item("Set up international roaming or buy local SIM", "ess_3"),
    item("Notify your bank of travel dates", "ess_4"),
    item("Pack travel-size toiletries", "ess_5"),
    item("Bring sufficient local currency / card", "ess_6"),
    item("Pack medication + doctor's letter if needed", "ess_7"),
    item("Emergency contacts written down offline", "ess_8"),
  ],
  reservations: [
    item("Flights booked & confirmation saved", "res_1"),
    item("Accommodation booked for all nights", "res_2"),
    item("Airport transfers arranged", "res_3"),
    item("Travel insurance purchased", "res_4"),
    item("Tours / activities pre-booked", "res_5"),
    item("Check-in online (24h before flight)", "res_6"),
  ],
  health: [
    item("Check CDC destination health notices", "hea_1"),
    item("Visit travel clinic for vaccinations", "hea_2"),
    item("Purchase travel health insurance", "hea_3"),
    item("Research nearest hospitals at destination", "hea_4"),
    item("Pack first aid kit", "hea_5"),
    item("Know local emergency number", "hea_6"),
  ],
};

const SECTIONS = {
  documents:    { title: "DOCUMENTS & VISA", icon: "document-text-outline" },
  essentials:   { title: "ESSENTIALS",        icon: "bag-outline" },
  reservations: { title: "RESERVATIONS",      icon: "calendar-outline" },
  health:       { title: "HEALTH & SAFETY",   icon: "medical-outline" },
  weather:      { title: "WEATHER FORECAST",  icon: "partly-sunny-outline", noChecklist: true },
};

export default function BeforeYouTravel() {
  const router = useRouter();
const { tripId, title } = useLocalSearchParams();

  const [destination, setDestination] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [countryData, setCountryData] = useState(null);
  const [localTime, setLocalTime] = useState(null);
  const [weather, setWeather] = useState(null);
  const [lists, setLists] = useState(DEFAULT_LISTS);
  const [openKey, setOpenKey] = useState("documents");
  const [preparationLoaded, setPreparationLoaded] = useState(false);


  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !tripId) return;

    (async () => {
      const snap = await getDoc(doc(db, "users", user.uid, "trips", String(tripId)));
      if (!snap.exists()) { setPreparationLoaded(true); return; }
      const d = snap.data();
      const tripStart = d.startDate ? d.startDate.toDate() : null;
      const tripEnd   = d.endDate   ? d.endDate.toDate()   : null;
      if (tripStart) setStartDate(tripStart);
      if (tripEnd)   setEndDate(tripEnd);

      const city    = typeof d.location?.city    === "string" ? d.location.city.trim()    : "";
      const country = typeof d.location?.country === "string" ? d.location.country.trim() : "";

      
      let lat, lon, countryCode, cData = null;
      if (city && country) {
        const geoData = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${city}, ${country}`)}&format=json&limit=1&addressdetails=1`,
          { headers: { "User-Agent": "CarryOnTravelApp/1.0" } }
        ).then(r => r.json()).catch(() => []);

        if (geoData.length) {
          lat = parseFloat(geoData[0].lat);
          lon = parseFloat(geoData[0].lon);
          countryCode = geoData[0].address?.country_code?.toUpperCase() || "";

          
          try {
            const c = await fetch(`https://restcountries.com/v3.1/alpha/${countryCode}`).then(r => r.json()).then(j => j[0]);
            cData = {
              name: c.name?.common || country,
              languages: Object.values(c.languages || {}).slice(0, 3).join(", ") || "—",
              callingCode: c.idd?.root ? `${c.idd.root}${(c.idd.suffixes || [])[0] || ""}` : "—",
            };
          } catch (_) {}

          // Local time
          try {
            const tz = await fetch(`https://timeapi.io/api/time/current/coordinate?latitude=${lat}&longitude=${lon}`).then(r => r.json());
            if (tz.dateTime) setLocalTime({
              time: new Date(tz.dateTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
              date: new Date(tz.dateTime).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
              timezone: tz.timeZone || "—",
              offset: tz.utcOffset || "—",
            });
          } catch (_) {}

          // Weather
          try {
            const now = new Date(); now.setHours(0, 0, 0, 0);
            const s = tripStart ? new Date(new Date(tripStart).setHours(0, 0, 0, 0)) : null;
            const e = tripEnd   ? new Date(new Date(tripEnd).setHours(0, 0, 0, 0))   : null;
            const daysToStart = s ? Math.floor((s - now) / 86400000) : null;
            const daysToEnd   = e ? Math.floor((e - now) / 86400000) : null;
            if (daysToStart !== null && daysToStart <= 16 && (daysToEnd === null || daysToEnd >= 0)) {
              const tripLen = e && s ? Math.ceil((e - s) / 86400000) + 1 : 7;
              const days = Math.min(Math.max(daysToStart, 0) + tripLen, 16);
              const w = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum&temperature_unit=fahrenheit&timezone=auto&forecast_days=${days}`
              ).then(r => r.json());
              if (w.daily) {
                const idxs = w.daily.time.map((d, i) => {
                  const date = new Date(d + "T12:00:00"); date.setHours(0, 0, 0, 0);
                  return (!s || date >= s) && (!e || date <= e) ? i : null;
                }).filter(i => i !== null);
                if (idxs.length) setWeather({
                  time:               idxs.map(i => w.daily.time[i]),
                  temperature_2m_max: idxs.map(i => w.daily.temperature_2m_max[i]),
                  temperature_2m_min: idxs.map(i => w.daily.temperature_2m_min[i]),
                  weathercode:        idxs.map(i => w.daily.weathercode[i]),
                  precipitation_sum:  idxs.map(i => w.daily.precipitation_sum[i]),
                });
              }
            }
          } catch (_) {}

          setCountryData(cData);
          setDestination({ city, country: cData?.name || country });
        }
      }

      // final document items,
      // saved checklist state on top
      const finalDocItems = makeDocItems(cData?.name || country || "");
      const checkSnap = await getDoc(doc(db, "users", user.uid, "trips", String(tripId), "preparation", "checklist")).catch(() => null);
      const saved = checkSnap?.exists() ? checkSnap.data() : {};

      setLists(prev => {
        const base = { ...prev, documents: finalDocItems };
        const updated = {};
        Object.keys(base).forEach(k => {
          updated[k] = base[k].map(i => ({ ...i, checked: saved[i.id] === true }));
        });
        return updated;
      });

      setPreparationLoaded(true);
    })();
  }, [tripId]);

  // Save checklist to Firebase every change
  useEffect(() => {
    if (!preparationLoaded) return;
    const user = auth.currentUser;
    if (!user || !tripId) return;
    const checkedMap = {};
    let totalDone = 0, totalItems = 0;
    Object.values(lists).forEach(section => section.forEach(i => {
      checkedMap[i.id] = i.checked;
      totalItems++;
      if (i.checked) totalDone++;
    }));
    setDoc(
      doc(db, "users", user.uid, "trips", String(tripId), "preparation", "checklist"),
      { ...checkedMap, _totalDone: totalDone, _totalItems: totalItems },
      { merge: true }
    );
  }, [lists, preparationLoaded]);

  const daysUntil = useMemo(() => {
    if (!startDate) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const s = new Date(startDate); s.setHours(0, 0, 0, 0);
    return Math.max(Math.floor((s - now) / 86400000), 0);
  }, [startDate]);

  const { tasksDone, tasksTotal } = useMemo(() => {
    let done = 0, total = 0;
    Object.keys(lists).forEach(k => { total += lists[k].length; done += lists[k].filter(i => i.checked).length; });
    return { tasksDone: done, tasksTotal: total };
  }, [lists]);

  const toggleItem = (key, id) => {
    if (!preparationLoaded) setPreparationLoaded(true);
    setLists(prev => ({
      ...prev,
      [key]: prev[key].map(i => i.id === id ? { ...i, checked: !i.checked } : i),
    }));
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

        <View style={st.topRow}>
<TouchableOpacity
  onPress={() =>
    router.replace({
      pathname: "/maintrip",
      params: { tripId, title},
    })
  }
  style={st.backBtn}
>
  <Ionicons name="chevron-back" size={24} color="#111827" />
</TouchableOpacity>
          <Text style={st.topTitle}>Before You Travel</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Country info card */}
        {(countryData || localTime) && (
          <View style={st.localInfoCard}>
            <Text style={st.localInfoTitle}>{destination?.country || "Local Info"}</Text>
            {countryData?.languages   && <InfoRow label="Language(s)"  val={countryData.languages} />}
            {countryData?.callingCode && <InfoRow label="Calling Code" val={countryData.callingCode} />}
            {localTime && <>
              <InfoRow label="Local Time" val={localTime.time} bold />
              <InfoRow label="Local Date" val={localTime.date} />
              <InfoRow label="Timezone"   val={localTime.timezone} />
              <InfoRow label="UTC Offset" val={localTime.offset} />
            </>}
          </View>
        )}

        {/* Accordion sections */}
        <View style={st.stack}>
          {Object.entries(SECTIONS).map(([key, meta]) => {
            const isOpen = openKey === key;
            const isChecklist = !meta.noChecklist;
            const complete = isChecklist && lists[key]?.every(i => i.checked) && lists[key]?.length > 0;

            return (
              <View key={key} style={[st.card, isOpen && st.cardOpen]}>
                <TouchableOpacity onPress={() => setOpenKey(isOpen ? "" : key)} style={st.cardHeader} activeOpacity={0.8}>
                  <View style={st.cardHeaderLeft}>
                    {isChecklist ? (
                      <View style={[st.secCb, complete && st.secCbDone]}>
                        {complete && <Ionicons name="checkmark" size={10} color="#fff" />}
                      </View>
                    ) : (
                      <Ionicons name={meta.icon} size={16} color="#2E5BFF" />
                    )}
                    <Text style={st.cardTitle}>{meta.title}</Text>
                  </View>
                  <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color="rgba(17,24,39,0.4)" />
                </TouchableOpacity>

                {isOpen && (
                  <View style={st.cardBody}>
                    {isChecklist && key === "documents" && <>
                      {!destination && <Hint text="Loading destination from your trip..." />}
                      <Text style={st.subheading}>📋 Document Checklist</Text>
                      <Checklist sectionKey="documents" />
                    </>}

                    {isChecklist && key !== "documents" && <Checklist sectionKey={key} />}

                    {key === "weather" && <>
                      {!destination && <Hint text="Loading weather from your trip destination..." />}
                      {destination && !weather && (
                        <Hint icon="time-outline" color="#888" text={
                          daysUntil !== null && daysUntil > 16
                            ? `Your trip is ${daysUntil} days away. Forecasts are only available within 16 days.`
                            : "Weather data unavailable for this location."
                        } />
                      )}
                      {weather && <>
                        <Text style={st.weatherSubtitle}>
                          {startDate && endDate
                            ? `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${destination.city} · °F`
                            : `${destination.city} · °F`}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.weatherScroll}>
                          {weather.time.map((date, i) => {
                            const [desc, icon] = wmo(weather.weathercode[i]);
                            return (
                              <View key={date} style={st.weatherCard}>
                                <Text style={st.weatherDate}>
                                  {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                </Text>
                                <Ionicons name={icon} size={26} color="#2E5BFF" style={{ marginVertical: 6 }} />
                                <Text style={st.weatherDesc}>{desc}</Text>
                                <Text style={st.weatherTemp}>
                                  {Math.round(weather.temperature_2m_max[i])}° / {Math.round(weather.temperature_2m_min[i])}°
                                </Text>
                                {weather.precipitation_sum[i] > 0 && (
                                  <Text style={st.weatherRain}>💧 {weather.precipitation_sum[i].toFixed(1)}mm</Text>
                                )}
                              </View>
                            );
                          })}
                        </ScrollView>
                      </>}
                    </>}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Countdown + progress */}
        <View style={st.bottomArea}>
          <View style={st.statRow}>
            <View style={st.leftStat}>
              <Ionicons name="time-outline" size={28} color="#2E5BFF" />
              <View>
                <Text style={st.bigNumber}>{daysUntil ?? "—"}</Text>
                <Text style={st.smallLabel}>
                  {daysUntil === 0 ? "trip started!" : daysUntil === 1 ? "day until trip" : "days until trip"}
                </Text>
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
  safe: {
    flex: 1,
    backgroundColor: "#DCE6FF",
  },

  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 14,
  },

  topRow: {
    paddingTop: Platform.OS === "android" ? 10 : 4,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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

  topTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3F63F3",
  },

  localInfoCard: {
    backgroundColor: "#D4DEFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#B4C6FF",
    gap: 8,
  },

  localInfoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3F63F3",
    marginBottom: 4,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  infoLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "700",
    flex: 1,
  },

  infoVal: {
    fontSize: 12,
    color: "#1F2937",
    fontWeight: "500",
    flex: 2,
    textAlign: "right",
  },

  stack: {
    gap: 10,
  },

  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#B4C6FF",
    backgroundColor: "#D4DEFF",
    overflow: "hidden",
  },

  cardOpen: {
    borderColor: "#3F63F3",
    borderWidth: 1.5,
  },

  cardHeader: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  cardTitle: {
    fontSize: 11,
    letterSpacing: 1.1,
    color: "#4B5563",
    fontWeight: "700",
  },

  secCb: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#B4C6FF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
  },

  secCbDone: {
    backgroundColor: "#3F63F3",
    borderColor: "#3F63F3",
  },

  cardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
  },

  clWrap: {
    gap: 10,
  },

  clRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  cb: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#B4C6FF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
    flexShrink: 0,
  },

  cbDone: {
    backgroundColor: "#3F63F3",
    borderColor: "#3F63F3",
  },

  clLabel: {
    fontSize: 13,
    color: "#1F2937",
    flex: 1,
    lineHeight: 18,
  },

  clLabelDone: {
    color: "#6B7280",
    textDecorationLine: "line-through",
  },

  hintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#B4C6FF",
  },

  hintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },

  subheading: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5563",
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  weatherSubtitle: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 10,
  },

  weatherScroll: {
    marginHorizontal: -14,
  },

  weatherCard: {
    width: 110,
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 10,
    marginLeft: 14,
    marginRight: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#B4C6FF",
  },

  weatherDate: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
    textAlign: "center",
  },

  weatherDesc: {
    fontSize: 10,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 3,
  },

  weatherTemp: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1F2937",
  },

  weatherRain: {
    fontSize: 10,
    color: "#4B5563",
    marginTop: 2,
  },

  bottomArea: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#B4C6FF",
    paddingTop: 18,
  },

  statRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 18,
  },

  leftStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  rightStat: {
    flex: 1,
    alignItems: "center",
  },

  progressTrack: {
    width: "90%",
    height: 8,
    borderRadius: 8,
    backgroundColor: "#C9D7FF",
    overflow: "hidden",
    marginBottom: 10,
  },

  progressFill: {
    height: "100%",
    borderRadius: 8,
    backgroundColor: "#3F63F3",
  },

  tasksRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    marginBottom: 2,
  },

  bigNumber: {
    fontSize: 38,
    fontWeight: "500",
    color: "#1F2937",
    lineHeight: 40,
  },

  slash: {
    fontSize: 28,
    color: "#6B7280",
    paddingBottom: 4,
  },

  smallLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "#4B5563",
  },

  smallLabelCenter: {
    marginTop: 2,
    fontSize: 12,
    color: "#4B5563",
    textAlign: "center",
  },
});