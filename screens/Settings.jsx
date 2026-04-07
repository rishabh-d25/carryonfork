import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

const API_KEY = "252b650d2acb4397ab93916025da875e";

export default function SettingsScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  const [region, setRegion] = useState({
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const [marker, setMarker] = useState(region);

  const address = `${street} ${city} ${state} ${zip}`.trim();

  const updateMap = (lat, lng) => {
    setRegion({ ...region, latitude: lat, longitude: lng });
    setMarker({ latitude: lat, longitude: lng });
  };

  useEffect(() => {
    if (!userId) return;

    (async () => {
      const userdoc = await getDoc(doc(db, "users", userId));
        const loc = userdoc.data()?.location;

        if (loc) {
          setStreet(loc.street);
          setCity(loc.city);
          setState(loc.state);
          setZip(loc.zip);

          if (loc.latitude && loc.longitude) {
            updateMap(loc.latitude, loc.longitude);
          }
        }
    })();
  }, [userId]);


  const geocode = async () => {
    if (!address) return;

    const res = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(address)}&key=${API_KEY}`);
      const data = await res.json();

      const loc = data.results?.[0]?.geometry;
      if (loc) updateMap(loc.lat, loc.lng);
  };

  const reverseGeocode = async (lat, lng) => {
    const res = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${API_KEY}`);
      const data = await res.json();

      const mapaddress = data.results?.[0]?.components;
      if (!mapaddress) return;

      setStreet(mapaddress.road );
      setCity(mapaddress.city || mapaddress.town || mapaddress.village);
      setState(mapaddress.state);
      setZip(mapaddress.postcode);
  };

  
  const onMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    updateMap(latitude, longitude);
    reverseGeocode(latitude, longitude);
  };

  
  const saveLocation = async () => {
    if (!userId) return;

    try {
      await updateDoc(doc(db, "users", userId), {
        location: {
          street,
          city,
          state,
          zip,
          latitude: marker.latitude,
          longitude: marker.longitude,
        },
      });

      alert("Saved!");
    } catch (e) {
      console.log(e);
      alert("Error saving");
    }
  };


  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Notifications</Text>
        <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
      </View>

      {[{ label: "Street", val: street, set: setStreet },
        { label: "City", val: city, set: setCity },
        { label: "State", val: state, set: setState },
        { label: "ZIP", val: zip, set: setZip }].map((f, i) => (
        <View key={i}>
          <Text style={styles.label}>{f.label}</Text>
          <TextInput style={styles.input} value={f.val} onChangeText={f.set} keyboardType={f.label === "ZIP" ? "numeric" : "default"} />
        </View>
      ))}

      <TouchableOpacity style={styles.button} onPress={geocode}>
        <Text style={styles.btnText}>Show on Map</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.save]} onPress={saveLocation}>
        <Text style={styles.btnText}>Save Location</Text>
      </TouchableOpacity>

      <View style={styles.mapWrap}>
        <MapView style={styles.map} region={region} onPress={onMapPress}>
          <Marker coordinate={marker} />
        </MapView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    paddingTop: 50,
  },
  center: { justifyContent: "center", alignItems: "center" },

  topRow: { paddingTop: 50, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 16, fontWeight: "700" },

  row: { paddingTop: 20, flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  label: { color: "#007BFF", marginBottom: 5 },

  input: {
    borderWidth: 1,
    borderColor: "#007BFF",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },

  button: {
    backgroundColor: "#007BFF",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  save: { backgroundColor: "#0056D2" },
  btnText: { color: "#fff", fontWeight: "bold" },

  mapWrap: { flex: 1, borderRadius: 12, overflow: "hidden" },
  map: { flex: 1 },
});