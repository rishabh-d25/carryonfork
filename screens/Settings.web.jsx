import "leaflet/dist/leaflet.css";

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const API_KEY = "252b650d2acb4397ab93916025da875e";

const BLUE = "#3F63F3";
const BG = "#DCE6FF";
const BORDER = "#B4C6FF";
const TEXT = "#1F2937";

// Helper component to handle map click events (react-leaflet requires this pattern)
function MapClickHandler({ onPress }) {
  useMapEvents({
    click(e) {
      onPress({ nativeEvent: { coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng } } });
    },
  });
  return null;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();

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
    setStreet(mapaddress.road);
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
      Alert.alert("Saved!", "Your location has been saved.");
    } catch (e) {
      console.log(e);
      Alert.alert("Error saving");
    }
  };

  const deleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to permanently delete your account? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "users", userId));
              await auth.currentUser?.delete();
              router.replace("/");
            } catch (e) {
              console.log(e);
              Alert.alert("Error", "Could not delete account. You may need to re-login first.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={24} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      {[
        { label: "Street", val: street, set: setStreet },
        { label: "City", val: city, set: setCity },
        { label: "State", val: state, set: setState },
        { label: "ZIP", val: zip, set: setZip },
      ].map((f) => (
        <View key={f.label}>
          <Text style={styles.label}>{f.label}</Text>
          <TextInput
            style={styles.input}
            value={f.val}
            onChangeText={f.set}
            keyboardType={f.label === "ZIP" ? "numeric" : "default"}
            placeholderTextColor="#B8B8B8"
            placeholder={f.label}
          />
        </View>
      ))}

      <TouchableOpacity style={styles.button} onPress={geocode}>
        <Text style={styles.btnText}>Show on Map</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.save]} onPress={saveLocation}>
        <Text style={styles.btnText}>Save Location</Text>
      </TouchableOpacity>

      {/* Swapped MapView for react-leaflet MapContainer — all logic above is identical */}
      <View style={styles.mapWrap}>
        <MapContainer
          center={[region.latitude, region.longitude]}
          zoom={13}
          style={{ flex: 1, height: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[marker.latitude, marker.longitude]} />
          <MapClickHandler onPress={onMapPress} />
        </MapContainer>
      </View>

      <TouchableOpacity style={styles.deleteBtn} onPress={deleteAccount}>
        <Text style={styles.deleteBtnText}>Delete Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    padding: 16,
    paddingTop: 50,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#C9D7FF",
    borderWidth: 1,
    borderColor: BORDER,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: BLUE,
  },
  label: {
    fontSize: 15,
    color: TEXT,
    marginBottom: 10,
    fontWeight: "600",
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: "#9FB2FF",
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 14,
    fontSize: 15,
    color: TEXT,
    marginBottom: 14,
  },
  button: {
    backgroundColor: BLUE,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  save: {
    backgroundColor: "#5A75F5",
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  mapWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  deleteBtn: {
    backgroundColor: "#DC2626",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  deleteBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});