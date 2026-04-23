import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
  StatusBar,
} from "react-native";
import MapView, { Marker } from "react-native-maps";

import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const API_KEY = "252b650d2acb4397ab93916025da875e";

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
    const res = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
        address
      )}&key=${API_KEY}`
    );
    const data = await res.json();
    const loc = data.results?.[0]?.geometry;
    if (loc) updateMap(loc.lat, loc.lng);
  };

  const reverseGeocode = async (lat, lng) => {
    const res = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${API_KEY}`
    );
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
      Alert.alert("Error saving");
    }
  };

  const deleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to permanently delete your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteDoc(doc(db, "users", userId));
            await auth.currentUser?.delete();
            router.replace("/auth");
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

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

          <Text style={styles.headerTitle}>Settings</Text>

          <View style={styles.iconButton} />
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

        <View style={styles.mapWrap}>
          <MapView style={styles.map} region={region} onPress={onMapPress}>
            <Marker coordinate={marker} />
          </MapView>
        </View>

        <TouchableOpacity style={styles.deleteBtn} onPress={deleteAccount}>
          <Text style={styles.deleteBtnText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#DCE6FF",
  },

  container: {
    flex: 1,
    paddingHorizontal: 18,
  },

  topRow: {
    paddingTop: 6,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },



  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: "#3F63F3",
    marginHorizontal: 8,
  },

  label: {
    fontSize: 14,
    color: "#3F63F3",
    marginBottom: 8,
    fontWeight: "600",
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#B4C6FF",
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 14,
    marginBottom: 14,
  },

  button: {
    backgroundColor: "#5A75F5",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },

  save: {
    backgroundColor: "#4F6BFF",
  },

  btnText: {
    color: "#fff",
    fontWeight: "700",
  },

  mapWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#B4C6FF",
  },

  map: {
    flex: 1,
  },

  deleteBtn: {
    backgroundColor: "#EF4444",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },

  deleteBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
});