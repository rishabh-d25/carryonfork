// screens/ActivityDetails.jsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  deleteActivity,
  updateActivity,
} from "../utils/itineraryService";

const BLUE = "#3F63F3";
const TEXT = "#1F2937";

export default function ActivityDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const tripId = params.tripId || "tokyo-2026";
  const activityId = params.activityId || "";

  const [title, setTitle] = useState(params.title || "");
  const [location, setLocation] = useState(params.location || "");
  const [date, setDate] = useState(params.date || "");
  const [time, setTime] = useState(params.time || "");
  const [notes, setNotes] = useState(params.notes || "");
  const [type, setType] = useState(params.type || "");
  const [saving, setSaving] = useState(false);

  async function onSave() {
    if (!activityId) {
      Alert.alert("Error", "Missing activity ID.");
      return;
    }

    try {
      setSaving(true);

      await updateActivity(tripId, activityId, {
        title: title.trim(),
        location: location.trim(),
        date: date.trim(),
        time: time.trim(),
        notes: notes.trim(),
        type: type.trim(),
      });

      Alert.alert("Saved", "Activity updated.");
      router.back();
    } catch (error) {
      Alert.alert("Error", error.message || "Could not update activity.");
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    Alert.alert(
      "Delete Activity",
      "Are you sure you want to delete this activity?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteActivity(tripId, activityId);
              router.replace({
                pathname: "/tripitinerary",
                params: { tripId },
              });
            } catch (error) {
              Alert.alert("Error", error.message || "Could not delete activity.");
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Title</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} />

        <Text style={styles.label}>Type</Text>
        <TextInput value={type} onChangeText={setType} style={styles.input} />

        <Text style={styles.label}>Location</Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          style={styles.input}
        />

        <Text style={styles.label}>Date</Text>
        <TextInput value={date} onChangeText={setDate} style={styles.input} />

        <Text style={styles.label}>Time</Text>
        <TextInput value={time} onChangeText={setTime} style={styles.input} />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={[styles.input, styles.notesInput]}
          multiline
        />

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={onSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving..." : "Save Changes"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Text style={styles.deleteBtnText}>Delete Activity</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT,
  },
  content: {
    padding: 16,
    paddingBottom: 30,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT,
    backgroundColor: "#FAFAFA",
    marginBottom: 12,
  },
  notesInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  saveBtn: {
    backgroundColor: BLUE,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  deleteBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  deleteBtnText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 16,
  },
});