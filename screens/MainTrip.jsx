import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
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
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const BLUE = "#3F63F3";

function emptyPhotoSlot() {
  return {
    uri: "",
    fileName: "",
    updatedAt: "",
    sourceSlot: "",
  };
}

export default function MainTrip() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const tripId = params.tripId ? String(params.tripId) : null;
  const journalId = params.journalId ? String(params.journalId) : null;
  const tripTitle = params.title ? String(params.title) : "Trip";

  const placeholderTiles = useMemo(
    () => [
      { id: "slot1", title: "Photo 1" },
      { id: "slot2", title: "Photo 2" },
      { id: "slot3", title: "Photo 3" },
      { id: "slot4", title: "Photo 4" },
    ],
    []
  );

  const [activeId, setActiveId] = useState(null);
  const [tripPhotos, setTripPhotos] = useState({
    slot1: emptyPhotoSlot(),
    slot2: emptyPhotoSlot(),
    slot3: emptyPhotoSlot(),
    slot4: emptyPhotoSlot(),
  });
  const [heroPhoto, setHeroPhoto] = useState(emptyPhotoSlot());

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !tripId) return;

    const tripRef = doc(db, "users", user.uid, "trips", tripId);

    const unsub = onSnapshot(
      tripRef,
      (snapshot) => {
        if (!snapshot.exists()) return;

        const data = snapshot.data() || {};
        const savedPhotos = data.tripPhotos || {};

        setTripPhotos({
          slot1: savedPhotos.slot1 || emptyPhotoSlot(),
          slot2: savedPhotos.slot2 || emptyPhotoSlot(),
          slot3: savedPhotos.slot3 || emptyPhotoSlot(),
          slot4: savedPhotos.slot4 || emptyPhotoSlot(),
        });

        setHeroPhoto(data.heroPhoto || emptyPhotoSlot());
      },
      (error) => {
        console.log("TRIP SNAPSHOT ERROR:", error);
      }
    );

    return () => unsub();
  }, [tripId]);

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

  const onWallet = () =>
    router.push({
      pathname: "/wallet",
      params: { tripId },
    });

  const onJournal = () =>
    router.push({
      pathname: "/journal",
      params: {journalId },
    });

  const onItinerary = () =>
    router.push({
      pathname: "/tripitinerary",
      params: { tripId },
    });

  const getBigPhotoUri = () => {
    if (heroPhoto?.uri) return heroPhoto.uri;
    if (tripPhotos?.slot1?.uri) return tripPhotos.slot1.uri;
    if (tripPhotos?.slot2?.uri) return tripPhotos.slot2.uri;
    if (tripPhotos?.slot3?.uri) return tripPhotos.slot3.uri;
    if (tripPhotos?.slot4?.uri) return tripPhotos.slot4.uri;
    return "";
  };

  const savePlaceholderPhotoInfo = async (slotId, asset) => {
    const user = auth.currentUser;
    if (!user || !tripId || !asset?.uri) return;

    try {
      const tripRef = doc(db, "users", user.uid, "trips", tripId);

      await updateDoc(tripRef, {
        [`tripPhotos.${slotId}`]: {
          uri: asset.uri,
          fileName: asset.fileName || `${slotId}.jpg`,
          updatedAt: new Date().toISOString(),
          sourceSlot: slotId,
        },
      });
    } catch (error) {
      console.log("SAVE PLACEHOLDER PHOTO ERROR:", error);
      Alert.alert("Error", "Could not save photo.");
    }
  };

const saveHeroPhotoInfo = async (asset, sourceSlot = "") => {
  const user = auth.currentUser;
  if (!user || !tripId || !asset?.uri) return;

  try {
    const tripRef = doc(db, "users", user.uid, "trips", tripId);

    await updateDoc(tripRef, {
      heroPhoto: {
        uri: asset.uri,
        fileName: asset.fileName || "hero-photo.jpg",
        updatedAt: new Date().toISOString(),
        sourceSlot,
      },
      imageUrl: asset.uri,
    });
  } catch (error) {
    console.log("SAVE HERO PHOTO ERROR:", error);
    Alert.alert("Error", "Could not save main photo.");
  }
};
const removePhotoFromTrip = async (slotId) => {
  const user = auth.currentUser;
  if (!user || !tripId) return;

  try {
    const tripRef = doc(db, "users", user.uid, "trips", tripId);

    const wasHeroSource = heroPhoto?.sourceSlot === slotId;
    const nextPhotos = {
      ...tripPhotos,
      [slotId]: emptyPhotoSlot(),
    };

    const fallbackUri =
      nextPhotos?.slot1?.uri ||
      nextPhotos?.slot2?.uri ||
      nextPhotos?.slot3?.uri ||
      nextPhotos?.slot4?.uri ||
      "";

    if (wasHeroSource) {
      await updateDoc(tripRef, {
        [`tripPhotos.${slotId}`]: emptyPhotoSlot(),
        heroPhoto: emptyPhotoSlot(),
        imageUrl: fallbackUri,
      });
    } else {
      await updateDoc(tripRef, {
        [`tripPhotos.${slotId}`]: emptyPhotoSlot(),
      });
    }
  } catch (error) {
    console.log("REMOVE PHOTO ERROR:", error);
    Alert.alert("Error", "Could not remove photo.");
  }
};

const removeHeroPhoto = async () => {
  const user = auth.currentUser;
  if (!user || !tripId) return;

  try {
    const tripRef = doc(db, "users", user.uid, "trips", tripId);

    const fallbackUri =
      tripPhotos?.slot1?.uri ||
      tripPhotos?.slot2?.uri ||
      tripPhotos?.slot3?.uri ||
      tripPhotos?.slot4?.uri ||
      "";

    await updateDoc(tripRef, {
      heroPhoto: emptyPhotoSlot(),
      imageUrl: fallbackUri,
    });
  } catch (error) {
    console.log("REMOVE HERO PHOTO ERROR:", error);
    Alert.alert("Error", "Could not remove main photo.");
  }
};

  const pickFromLibrary = async (slotId) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      await savePlaceholderPhotoInfo(slotId, result.assets[0]);
    } catch (error) {
      console.log("LIBRARY PICK ERROR:", error);
      Alert.alert("Error", "Could not choose a photo.");
    }
  };

  const takePhoto = async (slotId) => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Camera permission needed", "Please allow camera access.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      await savePlaceholderPhotoInfo(slotId, result.assets[0]);
    } catch (error) {
      console.log("CAMERA ERROR:", error);
      Alert.alert("Error", "Could not take a photo.");
    }
  };

  const pickHeroFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      await saveHeroPhotoInfo(result.assets[0], "");
    } catch (error) {
      console.log("HERO LIBRARY PICK ERROR:", error);
      Alert.alert("Error", "Could not choose main photo.");
    }
  };

  const takeHeroPhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Camera permission needed", "Please allow camera access.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      await saveHeroPhotoInfo(result.assets[0], "");
    } catch (error) {
      console.log("HERO CAMERA ERROR:", error);
      Alert.alert("Error", "Could not take main photo.");
    }
  };

  const usePlaceholderAsHero = async (slotId) => {
    const selected = tripPhotos?.[slotId];

    if (!selected?.uri) {
      Alert.alert("No photo", "That placeholder does not have a photo yet.");
      return;
    }

    await saveHeroPhotoInfo(
      {
        uri: selected.uri,
        fileName: selected.fileName || `${slotId}.jpg`,
      },
      slotId
    );
  };

  const onPhotoTilePress = (slotId) => {
    const hasPhoto = !!tripPhotos[slotId]?.uri;

    Alert.alert("Trip Photo", "Choose an option", [
      { text: "Take Photo", onPress: () => takePhoto(slotId) },
      { text: "Choose from Library", onPress: () => pickFromLibrary(slotId) },
      ...(hasPhoto
        ? [
            {
              text: "Use as Main Photo",
              onPress: () => usePlaceholderAsHero(slotId),
            },
            {
              text: "Remove Photo",
              style: "destructive",
              onPress: () => removePhotoFromTrip(slotId),
            },
          ]
        : []),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const onHeroPress = () => {
    Alert.alert("Main Trip Photo", "Choose an option", [
      { text: "Take Photo", onPress: takeHeroPhoto },
      { text: "Choose from Library", onPress: pickHeroFromLibrary },
      { text: "Use Placeholder 1", onPress: () => usePlaceholderAsHero("slot1") },
      { text: "Use Placeholder 2", onPress: () => usePlaceholderAsHero("slot2") },
      { text: "Use Placeholder 3", onPress: () => usePlaceholderAsHero("slot3") },
      { text: "Use Placeholder 4", onPress: () => usePlaceholderAsHero("slot4") },
      { text: "Remove Main Photo", style: "destructive", onPress: removeHeroPhoto },
      { text: "Cancel", style: "cancel" },
    ]);
  };

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
        { text: "No", style: "cancel" },
        { text: "Yes", style: "destructive", onPress: actuallyDeleteTrip },
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

  const bigPhotoUri = getBigPhotoUri();

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

        <Pressable onPress={onHeroPress} style={styles.heroWrap}>
          {bigPhotoUri ? (
            <ImageBackground
              source={{ uri: bigPhotoUri }}
              style={styles.heroImage}
              imageStyle={styles.heroImageRadius}
            >
              <View style={styles.heroLabelPill}>
                <Text style={styles.heroLabelText}>
                  {heroPhoto?.uri ? "Main Photo" : "From Placeholder"}
                </Text>
              </View>
            </ImageBackground>
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="image-outline" size={34} color="#9CA3AF" />
              <Text style={styles.heroPlaceholderText}>Tap to add main photo</Text>
            </View>
          )}
        </Pressable>

        <Text style={styles.subhead}>Trip Photos</Text>

        <View style={styles.grid}>
          {placeholderTiles.map((t) => {
            const isActive = activeId === t.id;
            const photoUri = tripPhotos[t.id]?.uri;
            const isHeroSource = heroPhoto?.sourceSlot === t.id;

            return (
              <Pressable
                key={t.id}
                style={styles.tile}
                onPress={() => onPhotoTilePress(t.id)}
                onHoverIn={
                  Platform.OS === "web" ? () => showLabel(t.id) : undefined
                }
                onHoverOut={Platform.OS === "web" ? hideLabel : undefined}
                onPressIn={
                  Platform.OS !== "web" ? () => showLabel(t.id) : undefined
                }
                onPressOut={Platform.OS !== "web" ? hideLabel : undefined}
              >
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.tileImg} />
                ) : (
                  <View style={styles.placeholderBox}>
                    <Ionicons name="image-outline" size={26} color="#9CA3AF" />
                    <Text style={styles.placeholderText}>Tap to add photo</Text>
                  </View>
                )}

                {isActive && (
                  <View style={styles.labelPill}>
                    <Text style={styles.labelText}>
                      {t.title} • {photoUri ? "Saved" : "Empty"}
                    </Text>
                  </View>
                )}

                {isHeroSource && photoUri ? (
                  <View style={styles.mainBadge}>
                    <Text style={styles.mainBadgeText}>MAIN</Text>
                  </View>
                ) : null}
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

        <Pressable onPress={onWallet} style={styles.btn}>
          <Text style={styles.btnText}>Wallet</Text>
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

  heroWrap: {
    marginTop: 8,
    marginBottom: 14,
  },

  heroImage: {
    width: "100%",
    height: 185,
    justifyContent: "flex-end",
  },

  heroImageRadius: {
    borderRadius: 14,
  },

  heroPlaceholder: {
    width: "100%",
    height: 185,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  heroPlaceholderText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
  },

  heroLabelPill: {
    position: "absolute",
    left: 10,
    bottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.12)",
  },

  heroLabelText: {
    fontSize: 13,
    fontWeight: "800",
    color: "rgba(17,24,39,0.85)",
  },

  subhead: {
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
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  tileImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  placeholderBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F9FAFB",
  },

  placeholderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
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

  mainBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: BLUE,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },

  mainBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
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