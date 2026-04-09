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
} from "react-native";

import { addDoc, collection, Timestamp } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

export default function CreateTrip() {
  const router = useRouter();

  const [withGroup, setWithGroup] = useState(true);
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  const [startMonth, setStartMonth] = useState("");
  const [startDay, setStartDay] = useState("");
  const [startYear, setStartYear] = useState("");

  const [endMonth, setEndMonth] = useState("");
  const [endDay, setEndDay] = useState("");
  const [endYear, setEndYear] = useState("");

  function onBack() {
    router.back();
  }

  function buildDate(year, month, day) {
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  async function handleCreate() {
    const user = auth.currentUser;

    const startDateObj = buildDate(startYear, startMonth, startDay);
    const endDateObj = buildDate(endYear, endMonth, endDay);


    try {

      const tripTitle = location.trim();

      const tripData = {
        title: tripTitle,
        location: location.trim(),
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
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
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

        <View style={styles.section}>
          <Text style={styles.label}>Budget</Text>
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
          <Text style={styles.label}>Location</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Search for location"
              placeholderTextColor="#aaa"
              value={location}
              onChangeText={setLocation}
            />
            <Text style={styles.searchIcon}>🔍</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Start Date</Text>
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
          <Text style={styles.label}>End Date</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
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
    color: "#111",
    textAlign: "center",
    marginRight: 8,
  },
  groupToggle: {
    alignItems: "center",
  },
  groupLabel: {
    fontSize: 11,
    color: "#555",
    marginBottom: 2,
  },

  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#222",
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111",
    backgroundColor: "#fafafa",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: 10,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchIcon: {
    fontSize: 18,
    marginLeft: 4,
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
    color: "#888",
    paddingHorizontal: 2,
  },

  createBtn: {
    backgroundColor: "#4F6BFF",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#4F6BFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
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