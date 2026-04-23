import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActionSheetIOS, Alert, FlatList, Image, Platform, Pressable,
  SafeAreaView, ScrollView, StatusBar, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

async function compressToBase64(uri) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return result.base64;
}

function timeAgo(timestamp) {
  if (!timestamp?.toDate) return "Just now";
  const ms = Date.now() - timestamp.toDate().getTime();
  const min = Math.floor(ms / 60000);
  const hr = Math.floor(ms / 3600000);
  const day = Math.floor(ms / 86400000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  if (hr < 24) return `${hr} hours ago`;
  if (day === 1) return "1 day ago";
  return `${day} days ago`;
}

export default function JournalScreen() {
  const router = useRouter();
const { journalId, tripId, title } = useLocalSearchParams();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [pendingImages, setPendingImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !journalId) return;
    const q = query(
      collection(db, "users", user.uid, "journals", journalId, "messages"),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [journalId]);

  async function pickImages(fromCamera) {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== "granted") {
      Alert.alert("Permission denied", "Allow access in Settings.");
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: true,
          selectionLimit: 4,
          quality: 1,
        });

    if (result.canceled) return;

    const availableSlots = 4 - pendingImages.length;
    if (availableSlots <= 0) {
      Alert.alert("Limit reached", "You can attach up to 4 images.");
      return;
    }

    const prepared = await Promise.all(
      result.assets.slice(0, availableSlots).map(async asset => ({
        uri: asset.uri,
        base64: await compressToBase64(asset.uri),
      }))
    );
    setPendingImages(prev => [...prev, ...prepared]);
  }

  function showImagePicker() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Take Photo", "Choose from Library"], cancelButtonIndex: 0 },
        i => { if (i === 1) pickImages(true); if (i === 2) pickImages(false); }
      );
    } else {
      Alert.alert("Add Image", "", [
        { text: "Take Photo", onPress: () => pickImages(true) },
        { text: "Choose from Library", onPress: () => pickImages(false) },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  async function submitEntry() {
    const user = auth.currentUser;
    if (!user || !journalId) return;
    if (!text.trim() && pendingImages.length === 0) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "users", user.uid, "journals", journalId, "messages"), {
        text: text.trim(),
        images: pendingImages.map(img => img.base64),
        createdAt: serverTimestamp(),
      });
      setText("");
      setPendingImages([]);
    } catch (err) {
      Alert.alert("Error", err?.message || "Could not save entry.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !submitting && (text.trim().length > 0 || pendingImages.length > 0);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      
      <View style={s.header}>
      <Pressable
        onPress={() =>     router.replace({
      pathname: "/maintrip",
      params: { tripId, title},
    })
  }
        
        style={s.iconBtn}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={24} color="#111827" />
      </Pressable>
        <Text style={s.title}>Journal</Text>
        <View style={s.iconBtn} />
      </View>

      {/* message list */}
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={null}
        renderItem={({ item }) => (
          <View style={s.entryBlock}>
            <Text style={s.timestamp}>{timeAgo(item.createdAt)}</Text>
            {Array.isArray(item.images) && item.images.length > 0 && (
              <View style={s.imageGrid}>
                {item.images.map((b64, i) => (
                  <Image
                    key={i}
                    source={{ uri: `data:image/jpeg;base64,${b64.replace(/^data:image\/[a-z]+;base64,/, "")}` }}
                    style={item.images.length === 1 ? s.imageFull : s.imageThumb}
                    resizeMode="cover"
                  />
                ))}
              </View>
            )}
            {!!item.text && <Text style={s.entryText}>{item.text}</Text>}
          </View>
        )}
      />

      
      <View style={s.composer}>
        <Text style={s.composerLabel}>Add Journal Entry</Text>

        {pendingImages.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 10 }}
            contentContainerStyle={{ gap: 8, paddingRight: 8 }}
          >
            {pendingImages.map((img, i) => (
              <View key={i} style={{ position: "relative" }}>
                <Image source={{ uri: img.uri }} style={s.previewThumb} resizeMode="cover" />
                <TouchableOpacity
                  style={s.removeBtn}
                  onPress={() => setPendingImages(prev => prev.filter((_, j) => j !== i))}
                  hitSlop={4}
                >
                  <Ionicons name="close-circle" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {pendingImages.length < 4 && (
              <TouchableOpacity style={s.addMoreTile} onPress={showImagePicker}>
                <Ionicons name="add" size={28} color="#4F6BFF" />
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        <View style={s.inputRow}>
          <TouchableOpacity
            style={s.cameraBtn}
            onPress={showImagePicker}
            disabled={pendingImages.length >= 4}
          >
            <Ionicons name="camera" size={22} color={pendingImages.length >= 4 ? "#ccc" : "#4F6BFF"} />
          </TouchableOpacity>
          <TextInput
            style={s.textInput}
            placeholder="Write the entry here"
            placeholderTextColor="#aaa"
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
            onPress={submitEntry}
            disabled={!canSubmit}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
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



  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#3F63F3",
    textAlign: "center",
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
    flexGrow: 1,
  },

  entryBlock: {
    marginBottom: 18,
    backgroundColor: "#D4DEFF",
    borderWidth: 1,
    borderColor: "#B4C6FF",
    borderRadius: 16,
    padding: 14,
  },

  timestamp: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  entryText: {
    fontSize: 14,
    color: "#1F2937",
    lineHeight: 21,
    marginTop: 8,
  },

  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  imageThumb: {
    width: 150,
    height: 150,
    borderRadius: 10,
    backgroundColor: "#C2D0FF",
  },

  imageFull: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    backgroundColor: "#C2D0FF",
  },

  composer: {
    borderTopWidth: 1,
    borderTopColor: "#B4C6FF",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: "#DCE6FF",
  },

  composerLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3F63F3",
    marginBottom: 8,
  },

  previewThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#C2D0FF",
    borderWidth: 1,
    borderColor: "#B4C6FF",
  },

  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 10,
  },

  addMoreTile: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#4F6BFF",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },

  cameraBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#B4C6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },

  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#B4C6FF",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    color: "#111",
    backgroundColor: "#EEF2FF",
    maxHeight: 100,
  },

  submitBtn: {
    backgroundColor: "#4F6BFF",
    borderRadius: 20,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },

  submitBtnDisabled: {
    opacity: 0.4,
  },
});