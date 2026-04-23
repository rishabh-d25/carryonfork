import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import {
  addDoc,
  collection,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

export default function CreateTrip() {
  const router = useRouter();

  const [withGroup, setWithGroup] = useState(true);
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationCountry, setLocationCountry] = useState("");

  const [startMonth, setStartMonth] = useState("");
  const [startDay, setStartDay] = useState("");
  const [startYear, setStartYear] = useState("");

  const [endMonth, setEndMonth] = useState("");
  const [endDay, setEndDay] = useState("");
  const [endYear, setEndYear] = useState("");

function onBack() {
  router.dismissTo("/dashboard");
}

  function buildDate(year, month, day) {
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  function isValidDateParts(year, month, day) {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);

    if (!y || !m || !d) return false;
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    if (String(year).trim().length !== 4) return false;

    const date = new Date(y, m - 1, d);

    return (
      date.getFullYear() === y &&
      date.getMonth() === m - 1 &&
      date.getDate() === d
    );
  }

  function getMillisFromFirestoreDate(value) {
    if (!value) return null;

    if (typeof value?.toDate === "function") {
      return value.toDate().getTime();
    }

    if (typeof value?.seconds === "number") {
      return value.seconds * 1000;
    }

    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  function rangesOverlap(existingStart, existingEnd, newStart, newEnd) {
    return newStart < existingEnd && newEnd > existingStart;
  }

  async function hasTripOverlap(userId, newStartDateObj, newEndDateObj) {
    const tripsRef = collection(db, "users", userId, "trips");
    const snapshot = await getDocs(tripsRef);

    const newStartMillis = newStartDateObj.getTime();
    const newEndMillis = newEndDateObj.getTime();

    for (const docSnap of snapshot.docs) {
      const trip = docSnap.data();

      const existingStartMillis = getMillisFromFirestoreDate(trip.startDate);
      const existingEndMillis = getMillisFromFirestoreDate(trip.endDate);

      if (existingStartMillis == null || existingEndMillis == null) {
        continue;
      }

      if (
        rangesOverlap(
          existingStartMillis,
          existingEndMillis,
          newStartMillis,
          newEndMillis
        )
      ) {
        return true;
      }
    }

    return false;
  }

  async function handleCreate() {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Error", "No user is logged in.");
      return;
    }

    if (
      !budget.trim() ||
      !locationCity.trim() ||
      !locationCountry.trim() ||
      !startMonth.trim() ||
      !startDay.trim() ||
      !startYear.trim() ||
      !endMonth.trim() ||
      !endDay.trim() ||
      !endYear.trim()
    ) {
      Alert.alert("Missing fields", "Please fill out all fields except description.");
      return;
    }

    if (Number.isNaN(parseFloat(budget))) {
      Alert.alert("Invalid budget", "Please enter a valid budget.");
      return;
    }

    if (!isValidDateParts(startYear, startMonth, startDay)) {
      Alert.alert(
        "Invalid start date",
        "Please enter a real start date in MM/DD/YYYY format."
      );
      return;
    }

    if (!isValidDateParts(endYear, endMonth, endDay)) {
      Alert.alert(
        "Invalid end date",
        "Please enter a real end date in MM/DD/YYYY format."
      );
      return;
    }

    const startDateObj = buildDate(startYear, startMonth, startDay);
    const endDateObj = buildDate(endYear, endMonth, endDay);

    if (startDateObj.getTime() > endDateObj.getTime()) {
      Alert.alert("Invalid dates", "Start date must come before end date.");
      return;
    }

    try {
      const overlapExists = await hasTripOverlap(
        user.uid,
        startDateObj,
        endDateObj
      );

      if (overlapExists) {
        Alert.alert(
          "Trip dates overlap",
          "These trip dates overlap with another existing trip. Starting a new trip on the exact same day another trip ends is okay, but overlapping days are not allowed."
        );
        return;
      }

      const tripTitle = `${locationCity.trim()}, ${locationCountry.trim()}`;

      const tripData = {
        title: tripTitle,
        location: {
          city: locationCity.trim(),
          country: locationCountry.trim(),
        },
        description: description.trim(),
        budget: parseFloat(budget),
        withGroup,
        startDate: Timestamp.fromDate(startDateObj),
        endDate: Timestamp.fromDate(endDateObj),
        status: "active",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const tripRef = collection(db, "users", user.uid, "trips");
      const tripDocRef = await addDoc(tripRef, tripData);

      const journalDocRef = await addDoc(
        collection(db, "users", user.uid, "journals"),
        {
          tripId: tripDocRef.id,
          createdAt: Timestamp.now(),
        }
      );

      if (withGroup) {
        await addDoc(collection(db, "groupchats"), {
          tripId: tripDocRef.id,
          members: [user.uid],
          createdAt: Timestamp.now(),
        });
      }

      router.replace({
        pathname: "/maintrip",
        params: {
          tripId: tripDocRef.id,
          journalId: journalDocRef.id,
          title: tripTitle,
        },
      });
    } catch (error) {
      console.log("Create trip error:", error);
      Alert.alert("Error", error.message);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable onPress={onBack} style={styles.iconButton} hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </Pressable>

            <Text style={styles.title}>Create A Trip</Text>

            <View style={styles.groupToggle}>
              <Text style={styles.groupLabel}>With a group?</Text>
              <Switch
                value={withGroup}
                onValueChange={setWithGroup}
                trackColor={{ false: "#ccc", true: "#4F6BFF" }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <Text style={styles.requiredNote}>
            <Text style={styles.requiredAsterisk}>*</Text> = Required
          </Text>

          <View style={styles.section}>
            <Text style={styles.label}>
              Budget <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="$$$"
              placeholderTextColor="#aaa"
              keyboardType="numeric"
              value={budget}
              onChangeText={setBudget}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Write a description here"
              placeholderTextColor="#aaa"
              multiline
              numberOfLines={3}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>
              Location <Text style={styles.requiredAsterisk}>*</Text>
            </Text>

            <TextInput
              style={styles.input}
              placeholder="City"
              placeholderTextColor="#aaa"
              value={locationCity}
              onChangeText={setLocationCity}
            />

            <TextInput
              style={[styles.input, { marginTop: 10 }]}
              placeholder="Country"
              placeholderTextColor="#aaa"
              value={locationCountry}
              onChangeText={setLocationCountry}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>
              Start Date <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View style={styles.dateRow}>
              <TextInput
                style={[styles.input, styles.dateInput]}
                placeholder="MM"
                placeholderTextColor="#aaa"
                keyboardType="numeric"
                maxLength={2}
                value={startMonth}
                onChangeText={setStartMonth}
              />
              <Text style={styles.dateSep}>/</Text>
              <TextInput
                style={[styles.input, styles.dateInput]}
                placeholder="DD"
                placeholderTextColor="#aaa"
                keyboardType="numeric"
                maxLength={2}
                value={startDay}
                onChangeText={setStartDay}
              />
              <Text style={styles.dateSep}>/</Text>
              <TextInput
                style={[styles.input, styles.yearInput]}
                placeholder="YYYY"
                placeholderTextColor="#aaa"
                keyboardType="numeric"
                maxLength={4}
                value={startYear}
                onChangeText={setStartYear}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>
              End Date <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View style={styles.dateRow}>
              <TextInput
                style={[styles.input, styles.dateInput]}
                placeholder="MM"
                placeholderTextColor="#aaa"
                keyboardType="numeric"
                maxLength={2}
                value={endMonth}
                onChangeText={setEndMonth}
              />
              <Text style={styles.dateSep}>/</Text>
              <TextInput
                style={[styles.input, styles.dateInput]}
                placeholder="DD"
                placeholderTextColor="#aaa"
                keyboardType="numeric"
                maxLength={2}
                value={endDay}
                onChangeText={setEndDay}
              />
              <Text style={styles.dateSep}>/</Text>
              <TextInput
                style={[styles.input, styles.yearInput]}
                placeholder="YYYY"
                placeholderTextColor="#aaa"
                keyboardType="numeric"
                maxLength={4}
                value={endYear}
                onChangeText={setEndYear}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.createBtn}
            onPress={handleCreate}
            activeOpacity={0.85}
          >
            <Text style={styles.createBtnText}>CREATE!</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#DCE6FF",
  },
  container: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    backgroundColor: "#DCE6FF",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#C9D7FF",
    borderWidth: 1,
    borderColor: "#B4C6FF",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#3F63F3",
    textAlign: "center",
    marginRight: 8,
  },
  groupToggle: {
    alignItems: "center",
  },
  groupLabel: {
    fontSize: 11,
    color: "#4B5563",
    marginBottom: 2,
  },

  requiredNote: {
    fontSize: 13,
    color: "#4B5563",
    marginBottom: 14,
    fontWeight: "500",
  },
  requiredAsterisk: {
    color: "#DC2626",
    fontWeight: "700",
  },

  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: "#B4C6FF",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1F2937",
    backgroundColor: "#D4DEFF",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: 10,
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateInput: {
    flex: 1,
    textAlign: "center",
  },
  yearInput: {
    flex: 1.6,
    textAlign: "center",
  },
  dateSep: {
    fontSize: 18,
    color: "#6B7280",
    paddingHorizontal: 2,
  },

  createBtn: {
    backgroundColor: "#5A75F5",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#3F63F3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  createBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
});