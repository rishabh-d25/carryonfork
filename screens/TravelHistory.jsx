import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { geoMercator, geoPath } from "d3-geo";
import Svg, { Circle, Path } from "react-native-svg";
import { feature } from "topojson-client";
import worldData from "world-atlas/countries-110m.json";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const GREY = "#FFFFFF"; // unvisited countries now white
const GREEN = "#22C55E";
const BLUE = "#3F63F3";
const DARK = "#1F2937";

const BG = "#DCE6FF";
const CARD = "#D4DEFF";
const CARD_ALT = "#C9D7FF";
const BORDER = "#B4C6FF";
const MUTED = "#4B5563";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const WONDERS = [
  "Great Wall of China",
  "Petra",
  "Christ the Redeemer",
  "Machu Picchu",
  "Chichen Itza",
  "Colosseum",
  "Taj Mahal",
];

const CONTINENT_GROUPS = {
  NorthAmerica: [
    "Antigua and Barbuda",
    "Bahamas",
    "Barbados",
    "Belize",
    "Canada",
    "Costa Rica",
    "Cuba",
    "Dominica",
    "Dominican Republic",
    "El Salvador",
    "Grenada",
    "Guatemala",
    "Haiti",
    "Honduras",
    "Jamaica",
    "Mexico",
    "Nicaragua",
    "Panama",
    "Saint Kitts and Nevis",
    "Saint Lucia",
    "Saint Vincent and the Grenadines",
    "Trinidad and Tobago",
    "United States of America",
    "United States",
  ],
  SouthAmerica: [
    "Argentina",
    "Bolivia",
    "Brazil",
    "Chile",
    "Colombia",
    "Ecuador",
    "Guyana",
    "Paraguay",
    "Peru",
    "Suriname",
    "Uruguay",
    "Venezuela",
  ],
  Europe: [
    "Albania",
    "Andorra",
    "Austria",
    "Belarus",
    "Belgium",
    "Bosnia and Herzegovina",
    "Bulgaria",
    "Croatia",
    "Czech Republic",
    "Czechia",
    "Denmark",
    "Estonia",
    "Finland",
    "France",
    "Germany",
    "Greece",
    "Hungary",
    "Iceland",
    "Ireland",
    "Italy",
    "Latvia",
    "Liechtenstein",
    "Lithuania",
    "Luxembourg",
    "Malta",
    "Moldova",
    "Monaco",
    "Montenegro",
    "Netherlands",
    "North Macedonia",
    "Norway",
    "Poland",
    "Portugal",
    "Romania",
    "San Marino",
    "Serbia",
    "Slovakia",
    "Slovenia",
    "Spain",
    "Sweden",
    "Switzerland",
    "Ukraine",
    "United Kingdom",
    "Vatican City",
  ],
  Africa: [
    "Algeria",
    "Angola",
    "Benin",
    "Botswana",
    "Burkina Faso",
    "Burundi",
    "Cameroon",
    "Cape Verde",
    "Central African Republic",
    "Chad",
    "Comoros",
    "Democratic Republic of the Congo",
    "Republic of the Congo",
    "Djibouti",
    "Egypt",
    "Equatorial Guinea",
    "Eritrea",
    "Eswatini",
    "Swaziland",
    "Ethiopia",
    "Gabon",
    "Gambia",
    "Ghana",
    "Guinea",
    "Guinea-Bissau",
    "Ivory Coast",
    "Côte d’Ivoire",
    "Kenya",
    "Lesotho",
    "Liberia",
    "Libya",
    "Madagascar",
    "Malawi",
    "Mali",
    "Mauritania",
    "Mauritius",
    "Morocco",
    "Mozambique",
    "Namibia",
    "Niger",
    "Nigeria",
    "Rwanda",
    "Sao Tome and Principe",
    "Senegal",
    "Seychelles",
    "Sierra Leone",
    "Somalia",
    "South Africa",
    "South Sudan",
    "Sudan",
    "Tanzania",
    "Togo",
    "Tunisia",
    "Uganda",
    "Zambia",
    "Zimbabwe",
  ],
  Asia: [
    "Afghanistan",
    "Armenia",
    "Azerbaijan",
    "Bahrain",
    "Bangladesh",
    "Bhutan",
    "Brunei",
    "Cambodia",
    "China",
    "Cyprus",
    "Georgia",
    "India",
    "Indonesia",
    "Iran",
    "Iraq",
    "Israel",
    "Japan",
    "Jordan",
    "Kazakhstan",
    "Kuwait",
    "Kyrgyzstan",
    "Laos",
    "Lebanon",
    "Malaysia",
    "Maldives",
    "Mongolia",
    "Myanmar",
    "Burma",
    "Nepal",
    "North Korea",
    "Oman",
    "Pakistan",
    "Palestine",
    "Philippines",
    "Qatar",
    "Saudi Arabia",
    "Singapore",
    "South Korea",
    "Sri Lanka",
    "Syria",
    "Taiwan",
    "Tajikistan",
    "Thailand",
    "Timor-Leste",
    "Turkey",
    "Turkiye",
    "Turkmenistan",
    "United Arab Emirates",
    "Uzbekistan",
    "Vietnam",
    "Yemen",
  ],
  Oceania: [
    "Australia",
    "Fiji",
    "Kiribati",
    "Marshall Islands",
    "Micronesia",
    "Nauru",
    "New Zealand",
    "Palau",
    "Papua New Guinea",
    "Samoa",
    "Solomon Islands",
    "Tonga",
    "Tuvalu",
    "Vanuatu",
  ],
};

function normalizeCountryName(name) {
  return String(name || "").trim().toLowerCase();
}

function ProgressRing({
  value,
  total,
  color,
  size = 76,
  label,
  number,
  hint,
  onPress,
}) {
  const progress = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  const animated = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animated, {
      toValue: progress,
      duration: 650,
      useNativeDriver: false,
    }).start();
  }, [animated, progress]);

  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const dashOffset = animated.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const CardWrap = onPress ? TouchableOpacity : View;

  return (
    <CardWrap
      style={styles.ringCard}
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress}
    >
      <View style={styles.ringWrap}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#FFFFFF" // was gray → now white
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray="5 7"
          strokeLinecap="round"
        />

          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </Svg>

        <View style={styles.ringCenter}>
          <Text style={styles.ringNumber}>{number}</Text>
        </View>
      </View>

      <Text style={styles.ringLabel}>{label}</Text>
      <Text style={styles.ringHint}>{hint}</Text>
      {onPress ? (
        <Text style={styles.tapHint}>Tap to edit</Text>
      ) : null}
    </CardWrap>
  );
}

export default function TravelHistory() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const mapWidth = Math.min(width * 0.8, 420);
  const mapHeight = Math.round(mapWidth * 0.52);

  const [modalOpen, setModalOpen] = useState(false);
  const [wondersModalOpen, setWondersModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [visited, setVisited] = useState(() => new Set());
  const [seenWonders, setSeenWonders] = useState(() => new Set());
  const [loadingSavedCountries, setLoadingSavedCountries] = useState(true);
  const [saving, setSaving] = useState(false);

  const countries = useMemo(() => {
    const fc = feature(worldData, worldData.objects.countries);
    return fc.features;
  }, []);

  const countriesWithLabels = useMemo(() => {
    const list = countries.map((f) => {
      const label = f?.properties?.name
        ? String(f.properties.name)
        : `Country ${f.id}`;
      return { feature: f, label };
    });

    list.sort((a, b) => a.label.localeCompare(b.label));
    return list;
  }, [countries]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countriesWithLabels;

    return countriesWithLabels.filter((c) =>
      c.label.toLowerCase().includes(q)
    );
  }, [query, countriesWithLabels]);

  const { pathsByLabel } = useMemo(() => {
    const projection = geoMercator()
      .scale(mapWidth / 6.2)
      .translate([mapWidth / 2, mapHeight / 1.6]);

    const pathGen = geoPath(projection);

    const map = new Map();
    for (const item of countriesWithLabels) {
      const d = pathGen(item.feature);
      if (d) map.set(item.label, d);
    }

    return { pathsByLabel: map };
  }, [countriesWithLabels, mapWidth, mapHeight]);

  const visitedArray = useMemo(() => {
    return Array.from(visited).sort((a, b) => a.localeCompare(b));
  }, [visited]);

  const seenWondersArray = useMemo(() => {
    return Array.from(seenWonders).sort((a, b) => a.localeCompare(b));
  }, [seenWonders]);

  const loadSavedData = useCallback(async () => {
    try {
      setLoadingSavedCountries(true);

      const user = auth.currentUser;
      if (!user) {
        setVisited(new Set());
        setSeenWonders(new Set());
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const snapshot = await getDoc(userRef);

      if (snapshot.exists()) {
        const data = snapshot.data();

        const savedCountries = Array.isArray(data.travelHistoryCountries)
          ? data.travelHistoryCountries
          : [];
        const savedWonders = Array.isArray(data.travelHistoryWonders)
          ? data.travelHistoryWonders
          : [];

        setVisited(new Set(savedCountries));
        setSeenWonders(new Set(savedWonders));
      } else {
        setVisited(new Set());
        setSeenWonders(new Set());
      }
    } catch (error) {
      console.log("Error loading travel history:", error);
      setVisited(new Set());
      setSeenWonders(new Set());
    } finally {
      setLoadingSavedCountries(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSavedData();
    }, [loadSavedData])
  );

  const saveCountries = async (nextSet) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      setSaving(true);

      const userRef = doc(db, "users", user.uid);
      const visitedCountriesArray = Array.from(nextSet).sort((a, b) =>
        a.localeCompare(b)
      );

      await setDoc(
        userRef,
        {
          travelHistoryCountries: visitedCountriesArray,
          travelHistoryUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.log("Error saving travel countries:", error);
    } finally {
      setSaving(false);
    }
  };

  const saveWonders = async (nextSet) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      setSaving(true);

      const userRef = doc(db, "users", user.uid);
      const wondersArray = Array.from(nextSet).sort((a, b) =>
        a.localeCompare(b)
      );

      await setDoc(
        userRef,
        {
          travelHistoryWonders: wondersArray,
          travelHistoryUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.log("Error saving wonders:", error);
    } finally {
      setSaving(false);
    }
  };

  const toggleCountry = async (label) => {
    Keyboard.dismiss();

    const next = new Set(visited);

    if (next.has(label)) next.delete(label);
    else next.add(label);

    setVisited(next);
    await saveCountries(next);
  };

  const toggleWonder = async (name) => {
    const next = new Set(seenWonders);

    if (next.has(name)) next.delete(name);
    else next.add(name);

    setSeenWonders(next);
    await saveWonders(next);
  };

  const clearAllCountries = async () => {
    const next = new Set();
    setVisited(next);
    await saveCountries(next);
  };

  const stats = useMemo(() => {
    const visitedCount = visited.size;
    const totalCountries = countriesWithLabels.length;
    const worldProgress = totalCountries
      ? Math.round((visitedCount / totalCountries) * 100)
      : 0;
    const remaining = totalCountries - visitedCount;

    const normalizedVisited = new Set(
      Array.from(visited).map((c) => normalizeCountryName(c))
    );

    const continentNames = Object.keys(CONTINENT_GROUPS);
    let continentsVisited = 0;

    for (const continent of continentNames) {
      const hasCountryInContinent = CONTINENT_GROUPS[continent].some((country) =>
        normalizedVisited.has(normalizeCountryName(country))
      );

      if (hasCountryInContinent) {
        continentsVisited += 1;
      }
    }

    return {
      visitedCount,
      totalCountries,
      worldProgress,
      remaining,
      wondersVisited: seenWonders.size,
      totalWonders: WONDERS.length,
      continentsVisited,
      totalContinents: 6,
    };
  }, [visited, countriesWithLabels, seenWonders]);

  const renderCountryRow = ({ item }) => {
    const checked = visited.has(item.label);

    return (
      <TouchableOpacity
        onPress={() => toggleCountry(item.label)}
        style={[styles.countryRow, checked && styles.countryRowChecked]}
        activeOpacity={0.85}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked ? <Text style={styles.checkboxTick}>✓</Text> : null}
        </View>

        <Text style={styles.countryText}>{item.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.topRow}>
<TouchableOpacity
  onPress={() =>
    router.dismissTo({
      pathname: "/dashboard",

    })
  }
style={styles.iconButton}
>
  <Ionicons name="chevron-back" size={24} color="#111827" />
</TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Travel History</Text>
          <Text style={styles.subtitle}>
            Tap the map to check off countries you’ve visited.
          </Text>
        </View>

        {loadingSavedCountries ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={BLUE} />
            <Text style={styles.loadingText}>Loading your travel history...</Text>
          </View>
        ) : (
          <>
            <Pressable onPress={() => setModalOpen(true)} style={styles.mapWrap}>
              <View style={styles.mapCard}>
                <View style={styles.mapTopRow}>
                  <Text style={styles.mapTitle}>Tap to edit visited countries</Text>
                  {saving ? <Text style={styles.savingText}>Saving...</Text> : null}
                </View>

                <Svg width={mapWidth} height={mapHeight}>
                  {countriesWithLabels.map((c) => {
                    const d = pathsByLabel.get(c.label);
                    if (!d) return null;

                    const isVisited = visited.has(c.label);

                    return (
                      <Path
                        key={c.label}
                        d={d}
                        fill={isVisited ? GREEN : GREY}
                        stroke="#FFFFFF"
                        strokeWidth={0.5}
                      />
                    );
                  })}
                </Svg>
              </View>
            </Pressable>

            <View style={styles.ringsGrid}>
              <ProgressRing
                label="Countries"
                value={stats.visitedCount}
                total={stats.totalCountries}
                number={stats.visitedCount}
                hint={`${stats.totalCountries} total`}
                color={BLUE}
              />

              <ProgressRing
                label="World"
                value={stats.worldProgress}
                total={100}
                number={`${stats.worldProgress}%`}
                hint="Progress completed"
                color="#16A34A"
              />

              <ProgressRing
                label="Continents"
                value={stats.continentsVisited}
                total={stats.totalContinents}
                number={stats.continentsVisited}
                hint={`${stats.totalContinents} possible`}
                color="#F59E0B"
              />

              <ProgressRing
                label="Wonders"
                value={stats.wondersVisited}
                total={stats.totalWonders}
                number={stats.wondersVisited}
                hint="Tap to pick wonders"
                color="#8B5CF6"
                onPress={() => setWondersModalOpen(true)}
              />


            </View>
          </>
        )}

        <Modal visible={modalOpen} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Visited countries</Text>
                <TouchableOpacity onPress={() => setModalOpen(false)}>
                  <Text style={styles.modalClose}>Done</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                placeholder="Search a country…"
                value={query}
                onChangeText={setQuery}
                style={styles.search}
                placeholderTextColor="rgba(15,23,42,0.4)"
              />

              <View style={styles.modalMetaRow}>
                <Text style={styles.modalMeta}>
                  Checked:{" "}
                  <Text style={styles.modalMetaStrong}>{visited.size}</Text>
                </Text>

                <TouchableOpacity
                  onPress={clearAllCountries}
                  disabled={visited.size === 0}
                >
                  <Text
                    style={[
                      styles.clearBtn,
                      visited.size === 0 && { opacity: 0.4 },
                    ]}
                  >
                    Clear
                  </Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={filteredList}
                extraData={visitedArray}
                keyExtractor={(item) => item.label}
                renderItem={renderCountryRow}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
              />
            </View>
          </View>
        </Modal>

        <Modal visible={wondersModalOpen} animationType="fade" transparent>
          <View style={styles.promptBackdrop}>
            <View style={styles.promptCard}>
              <View style={styles.promptHeader}>
                <Text style={styles.promptTitle}>Wonders of the World</Text>
                <TouchableOpacity onPress={() => setWondersModalOpen(false)}>
                  <Text style={styles.modalClose}>Done</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.promptSubtitle}>
                Check the wonders you’ve actually seen.
              </Text>

              <View style={styles.wonderList}>
                {WONDERS.map((wonder) => {
                  const checked = seenWonders.has(wonder);

                  return (
                    <TouchableOpacity
                      key={wonder}
                      onPress={() => toggleWonder(wonder)}
                      style={[
                        styles.wonderRow,
                        checked && styles.wonderRowChecked,
                      ]}
                      activeOpacity={0.85}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          checked && styles.checkboxChecked,
                        ]}
                      >
                        {checked ? (
                          <Text style={styles.checkboxTick}>✓</Text>
                        ) : null}
                      </View>

                      <Text style={styles.wonderText}>{wonder}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.promptMeta}>
                Selected: <Text style={styles.promptMetaStrong}>{seenWonders.size}</Text> / {WONDERS.length}
              </Text>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 18,
  },

  topRow: {
    paddingTop: 6,
    paddingBottom: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD_ALT,
    borderWidth: 1,
    borderColor: BORDER,
  },

  header: {
    paddingTop: 4,
    paddingBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: BLUE,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: MUTED,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: MUTED,
  },

  mapWrap: {
    marginBottom: 16,
  },
  mapCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  mapTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  mapTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: BLUE,
  },
  savingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },

  ringsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginBottom: 14,
  },
  ringCard: {
    width: "48%",
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  ringWrap: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  ringNumber: {
    fontSize: 18,
    fontWeight: "900",
    color: DARK,
  },
  ringLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: DARK,
  },
  ringHint: {
    marginTop: 4,
    fontSize: 11,
    color: MUTED,
    textAlign: "center",
  },
  tapHint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    color: "#8B5CF6",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    height: "82%",
    backgroundColor: BG,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: BLUE,
  },
  modalClose: {
    fontSize: 15,
    fontWeight: "800",
    color: BLUE,
  },

  search: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    color: DARK,
  },
  modalMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  modalMeta: {
    fontSize: 13,
    color: MUTED,
  },
  modalMetaStrong: {
    fontWeight: "900",
    color: DARK,
  },
  clearBtn: {
    fontSize: 13,
    fontWeight: "800",
    color: "#EF4444",
  },

  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 8,
  },
  countryRowChecked: {
    borderColor: "rgba(34,197,94,0.45)",
    backgroundColor: CARD_ALT,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  checkboxChecked: {
    borderColor: "#22C55E",
    backgroundColor: "rgba(34,197,94,0.15)",
  },
  checkboxTick: {
    fontWeight: "900",
    color: "#16A34A",
    marginTop: -1,
  },
  countryText: {
    fontSize: 14,
    fontWeight: "700",
    color: DARK,
  },

  promptBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  promptCard: {
    width: "100%",
    backgroundColor: BG,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  promptHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  promptTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: BLUE,
  },
  promptSubtitle: {
    marginTop: 8,
    marginBottom: 14,
    fontSize: 13,
    color: MUTED,
  },
  wonderList: {
    gap: 8,
  },
  wonderRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
  },
  wonderRowChecked: {
    borderColor: "rgba(139,92,246,0.35)",
    backgroundColor: "rgba(139,92,246,0.12)",
  },
  wonderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: DARK,
  },
  promptMeta: {
    marginTop: 14,
    fontSize: 13,
    color: MUTED,
  },
  promptMetaStrong: {
    fontWeight: "900",
    color: DARK,
  },
});