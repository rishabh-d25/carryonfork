import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import Slider from "@react-native-community/slider";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { auth, db } from "../firebaseConfig";
import {
  formatTime,
  getTripItemById,
  upsertTripItem,
} from "../utils/tripStorage";

const BLUE = "#3F63F3";
const BG = "#DCE6FF";
const BORDER = "#B4C6FF";
const TEXT = "#1F2937";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const YEARS = [2025, 2026, 2027, 2028];

const CATEGORIES = [
  { key: "activity", label: "Activity" },
  { key: "transportation", label: "Transportation" },
  { key: "food", label: "Food" },
  { key: "hotel", label: "Hotel" },
];

const LOCATION_API_KEY = "252b650d2acb4397ab93916025da875e";

function createEmptyForm() {
  return {
    description: "",
    locationStreet: "",
    locationCity: "",
    locationState: "",
    locationZip: "",
    locationLatitude: 37.7749,
    locationLongitude: -122.4194,
    reservationNumber: "",
    price: 50,
    monthIndex: 0,
    yearIndex: 1,
    selectedDay: 9,
    timeValue: new Date(2026, 0, 9, 12, 0),
    attachments: [],
  };
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function datesEqual(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildDateFromParts(year, monthIndex, day, baseTime = null) {
  const hours = baseTime ? baseTime.getHours() : 12;
  const minutes = baseTime ? baseTime.getMinutes() : 0;
  return new Date(year, monthIndex, day, hours, minutes, 0);
}

function toMonthKey(year, monthIndex) {
  return year * 100 + monthIndex;
}

function getValidDayRangeForMonth(year, monthIndex, tripStartDate, tripEndDate) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  let minDay = 1;
  let maxDay = daysInMonth;

  if (
    tripStartDate &&
    tripStartDate.getFullYear() === year &&
    tripStartDate.getMonth() === monthIndex
  ) {
    minDay = tripStartDate.getDate();
  }

  if (
    tripEndDate &&
    tripEndDate.getFullYear() === year &&
    tripEndDate.getMonth() === monthIndex
  ) {
    maxDay = tripEndDate.getDate();
  }

  return { minDay, maxDay };
}

export default function AddActivity() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const tripId = params.tripId ? String(params.tripId) : null;
  const sourceTripId = params.sourceTripId
    ? String(params.sourceTripId)
    : tripId;
  const sourceTripOwnerId = params.sourceTripOwnerId
    ? String(params.sourceTripOwnerId)
    : auth.currentUser?.uid || "";
  const editingId = params.editId ? String(params.editId) : null;
  const presetCategory = params.presetCategory ? String(params.presetCategory) : null;

  const [category, setCategory] = useState("activity");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [tripStartDate, setTripStartDate] = useState(null);
  const [tripEndDate, setTripEndDate] = useState(null);

  const [tabForms, setTabForms] = useState({
    activity: createEmptyForm(),
    transportation: createEmptyForm(),
    food: createEmptyForm(),
    hotel: createEmptyForm(),
  });

  // map region state — shared for the currently visible map
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    if (presetCategory && !editingId) {
      setCategory(presetCategory);
    }
  }, [presetCategory, editingId]);

  useEffect(() => {
    async function loadTripRange() {
      if (!sourceTripId || !sourceTripOwnerId) return;

      try {
        const tripRef = doc(db, "users", sourceTripOwnerId, "trips", sourceTripId);
        const tripSnap = await getDoc(tripRef);

        if (!tripSnap.exists()) return;

        const tripData = tripSnap.data() || {};

        const rawStart = tripData.startDate?.toDate
          ? tripData.startDate.toDate()
          : tripData.startDate
          ? new Date(tripData.startDate)
          : null;

        const rawEnd = tripData.endDate?.toDate
          ? tripData.endDate.toDate()
          : tripData.endDate
          ? new Date(tripData.endDate)
          : null;

        if (rawStart && !Number.isNaN(rawStart.getTime())) {
          setTripStartDate(stripTime(rawStart));
        }

        if (rawEnd && !Number.isNaN(rawEnd.getTime())) {
          setTripEndDate(stripTime(rawEnd));
        }
      } catch (error) {
        console.log("Load trip range error:", error);
      }
    }

    loadTripRange();
  }, [sourceTripId, sourceTripOwnerId]);

  useEffect(() => {
    async function loadEditItem() {
      if (!editingId || !sourceTripId) return;

      try {
        setLoadingEditData(true);
        const item = await getTripItemById(
          sourceTripId,
          editingId,
          sourceTripOwnerId
        );

        if (item) {
          const mIndex = MONTHS.indexOf(item.month);
          const yIndex = YEARS.indexOf(item.year);

          // support both old string location and new object location
          const loc = item.location && typeof item.location === "object" ? item.location : {};

          const loadedForm = {
            description: item.description || "",
            locationStreet: loc.street || "",
            locationCity: loc.city || "",
            locationState: loc.state || "",
            locationZip: loc.zip || "",
            locationLatitude: loc.latitude || 37.7749,
            locationLongitude: loc.longitude || -122.4194,
            reservationNumber: item.reservationNumber || "",
            price: item.price ?? 50,
            monthIndex: mIndex >= 0 ? mIndex : 0,
            yearIndex: yIndex >= 0 ? yIndex : 1,
            selectedDay: item.day || 9,
            timeValue: (() => {
              const d = new Date(2026, 0, 9, 12, 0);
              d.setHours(item.hour24 ?? 12);
              d.setMinutes(item.minute ?? 0);
              d.setSeconds(0);
              return d;
            })(),
            attachments: Array.isArray(item.attachments) ? item.attachments : [],
          };

          setCategory(item.category || "activity");
          setTabForms({
            activity: createEmptyForm(),
            transportation: createEmptyForm(),
            food: createEmptyForm(),
            hotel: createEmptyForm(),
            [item.category || "activity"]: loadedForm,
          });

          if (loc.latitude && loc.longitude) {
            setMapRegion(prev => ({ ...prev, latitude: loc.latitude, longitude: loc.longitude }));
          }
        }
      } catch (error) {
        console.log("Load edit item error:", error);
        Alert.alert("Error", error.message || "Could not load item.");
      } finally {
        setLoadingEditData(false);
      }
    }

    loadEditItem();
  }, [editingId, sourceTripId, sourceTripOwnerId]);

  const currentForm = tabForms[category];
  const currentMonth = MONTHS[currentForm.monthIndex];
  const currentYear = YEARS[currentForm.yearIndex];

  const allowedMonthKeys = useMemo(() => {
    if (!tripStartDate || !tripEndDate) return null;

    const keys = [];
    let year = tripStartDate.getFullYear();
    let month = tripStartDate.getMonth();

    while (
      year < tripEndDate.getFullYear() ||
      (year === tripEndDate.getFullYear() && month <= tripEndDate.getMonth())
    ) {
      keys.push(toMonthKey(year, month));

      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }

    return keys;
  }, [tripStartDate, tripEndDate]);

  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentForm.monthIndex + 1, 0).getDate();
  }, [currentYear, currentForm.monthIndex]);

  const firstDayOfMonth = useMemo(() => {
    return new Date(currentYear, currentForm.monthIndex, 1).getDay();
  }, [currentYear, currentForm.monthIndex]);

  const validDayRange = useMemo(() => {
    return getValidDayRangeForMonth(
      currentYear,
      currentForm.monthIndex,
      tripStartDate,
      tripEndDate
    );
  }, [currentYear, currentForm.monthIndex, tripStartDate, tripEndDate]);

  const calendarCells = useMemo(() => {
    const cells = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push({ type: "empty", key: `empty-${i}` });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = stripTime(new Date(currentYear, currentForm.monthIndex, day));
      const isInTripRange =
        (!tripStartDate || cellDate >= tripStartDate) &&
        (!tripEndDate || cellDate <= tripEndDate);

      cells.push({
        type: "day",
        key: `day-${day}`,
        value: day,
        disabled: !isInTripRange,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ type: "empty-end", key: `empty-end-${cells.length}` });
    }

    return cells;
  }, [
    firstDayOfMonth,
    daysInMonth,
    currentYear,
    currentForm.monthIndex,
    tripStartDate,
    tripEndDate,
  ]);

  const canGoPrevMonth = useMemo(() => {
    if (!allowedMonthKeys) {
      if (currentForm.monthIndex === 0) {
        return currentForm.yearIndex > 0;
      }
      return true;
    }

    const prevMonthIndex = currentForm.monthIndex === 0 ? 11 : currentForm.monthIndex - 1;
    const prevYearIndex = currentForm.monthIndex === 0
      ? currentForm.yearIndex - 1
      : currentForm.yearIndex;

    if (prevYearIndex < 0) return false;

    const prevYear = YEARS[prevYearIndex];
    return allowedMonthKeys.includes(toMonthKey(prevYear, prevMonthIndex));
  }, [allowedMonthKeys, currentForm.monthIndex, currentForm.yearIndex]);

  const canGoNextMonth = useMemo(() => {
    if (!allowedMonthKeys) {
      if (currentForm.monthIndex === 11) {
        return currentForm.yearIndex < YEARS.length - 1;
      }
      return true;
    }

    const nextMonthIndex = currentForm.monthIndex === 11 ? 0 : currentForm.monthIndex + 1;
    const nextYearIndex = currentForm.monthIndex === 11
      ? currentForm.yearIndex + 1
      : currentForm.yearIndex;

    if (nextYearIndex > YEARS.length - 1) return false;

    const nextYear = YEARS[nextYearIndex];
    return allowedMonthKeys.includes(toMonthKey(nextYear, nextMonthIndex));
  }, [allowedMonthKeys, currentForm.monthIndex, currentForm.yearIndex]);

  useEffect(() => {
    if (!tripStartDate || !tripEndDate) return;
    if (!YEARS.includes(tripStartDate.getFullYear()) || !YEARS.includes(tripEndDate.getFullYear())) return;

    setTabForms((prev) => {
      const next = { ...prev };

      for (const key of Object.keys(next)) {
        const form = next[key];
        const formDate = stripTime(
          buildDateFromParts(
            YEARS[form.yearIndex],
            form.monthIndex,
            form.selectedDay,
            form.timeValue
          )
        );

        if (formDate < tripStartDate || formDate > tripEndDate) {
          const replacementDate = tripStartDate;

          const newTime = new Date(form.timeValue);
          newTime.setFullYear(replacementDate.getFullYear());
          newTime.setMonth(replacementDate.getMonth());
          newTime.setDate(replacementDate.getDate());

          next[key] = {
            ...form,
            yearIndex: YEARS.indexOf(replacementDate.getFullYear()),
            monthIndex: replacementDate.getMonth(),
            selectedDay: replacementDate.getDate(),
            timeValue: newTime,
          };
        } else {
          const { minDay, maxDay } = getValidDayRangeForMonth(
            YEARS[form.yearIndex],
            form.monthIndex,
            tripStartDate,
            tripEndDate
          );

          let adjustedDay = form.selectedDay;
          if (adjustedDay < minDay) adjustedDay = minDay;
          if (adjustedDay > maxDay) adjustedDay = maxDay;

          if (adjustedDay !== form.selectedDay) {
            const newTime = new Date(form.timeValue);
            newTime.setDate(adjustedDay);

            next[key] = {
              ...form,
              selectedDay: adjustedDay,
              timeValue: newTime,
            };
          }
        }
      }

      return next;
    });
  }, [tripStartDate, tripEndDate]);

  function updateCurrentForm(updates) {
    setTabForms((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        ...updates,
      },
    }));
  }

  function resetAllForms() {
    const base = createEmptyForm();

    if (tripStartDate && YEARS.includes(tripStartDate.getFullYear())) {
      base.yearIndex = YEARS.indexOf(tripStartDate.getFullYear());
      base.monthIndex = tripStartDate.getMonth();
      base.selectedDay = tripStartDate.getDate();
      base.timeValue = new Date(
        tripStartDate.getFullYear(),
        tripStartDate.getMonth(),
        tripStartDate.getDate(),
        12,
        0,
        0
      );
    }

    setTabForms({
      activity: { ...base },
      transportation: { ...base },
      food: { ...base },
      hotel: { ...base },
    });
    setCategory("activity");
  }

  function goPrevMonth() {
    if (!canGoPrevMonth) return;

    if (currentForm.monthIndex === 0) {
      if (currentForm.yearIndex > 0) {
        const newYearIndex = currentForm.yearIndex - 1;
        const newMonthIndex = 11;
        const newYear = YEARS[newYearIndex];
        const { minDay, maxDay } = getValidDayRangeForMonth(
          newYear,
          newMonthIndex,
          tripStartDate,
          tripEndDate
        );

        const nextSelectedDay = Math.min(Math.max(currentForm.selectedDay, minDay), maxDay);
        const nextTime = new Date(currentForm.timeValue);
        nextTime.setFullYear(newYear);
        nextTime.setMonth(newMonthIndex);
        nextTime.setDate(nextSelectedDay);

        updateCurrentForm({
          monthIndex: newMonthIndex,
          yearIndex: newYearIndex,
          selectedDay: nextSelectedDay,
          timeValue: nextTime,
        });
      }
    } else {
      const newMonthIndex = currentForm.monthIndex - 1;
      const { minDay, maxDay } = getValidDayRangeForMonth(
        currentYear,
        newMonthIndex,
        tripStartDate,
        tripEndDate
      );

      const nextSelectedDay = Math.min(Math.max(currentForm.selectedDay, minDay), maxDay);
      const nextTime = new Date(currentForm.timeValue);
      nextTime.setMonth(newMonthIndex);
      nextTime.setDate(nextSelectedDay);

      updateCurrentForm({
        monthIndex: newMonthIndex,
        selectedDay: nextSelectedDay,
        timeValue: nextTime,
      });
    }
  }

  function goNextMonth() {
    if (!canGoNextMonth) return;

    if (currentForm.monthIndex === 11) {
      if (currentForm.yearIndex < YEARS.length - 1) {
        const newYearIndex = currentForm.yearIndex + 1;
        const newMonthIndex = 0;
        const newYear = YEARS[newYearIndex];
        const { minDay, maxDay } = getValidDayRangeForMonth(
          newYear,
          newMonthIndex,
          tripStartDate,
          tripEndDate
        );

        const nextSelectedDay = Math.min(Math.max(currentForm.selectedDay, minDay), maxDay);
        const nextTime = new Date(currentForm.timeValue);
        nextTime.setFullYear(newYear);
        nextTime.setMonth(newMonthIndex);
        nextTime.setDate(nextSelectedDay);

        updateCurrentForm({
          monthIndex: newMonthIndex,
          yearIndex: newYearIndex,
          selectedDay: nextSelectedDay,
          timeValue: nextTime,
        });
      }
    } else {
      const newMonthIndex = currentForm.monthIndex + 1;
      const { minDay, maxDay } = getValidDayRangeForMonth(
        currentYear,
        newMonthIndex,
        tripStartDate,
        tripEndDate
      );

      const nextSelectedDay = Math.min(Math.max(currentForm.selectedDay, minDay), maxDay);
      const nextTime = new Date(currentForm.timeValue);
      nextTime.setMonth(newMonthIndex);
      nextTime.setDate(nextSelectedDay);

      updateCurrentForm({
        monthIndex: newMonthIndex,
        selectedDay: nextSelectedDay,
        timeValue: nextTime,
      });
    }
  }

  async function pickFromLibrary() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Please allow photo library access.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
        allowsMultipleSelection: true,
      });

      if (result.canceled) return;

      const newItems = result.assets.map((asset) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: "image",
        uri: asset.uri,
        name: asset.fileName || "Photo",
        mimeType: asset.mimeType || "image/jpeg",
      }));

      updateCurrentForm({
        attachments: [...currentForm.attachments, ...newItems],
      });
    } catch (error) {
      console.log("pickFromLibrary error:", error);
      Alert.alert("Error", "Could not add photo.");
    }
  }

  async function takePhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Please allow camera access.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });

      if (result.canceled) return;

      const newItems = result.assets.map((asset) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: "image",
        uri: asset.uri,
        name: asset.fileName || "Camera Photo",
        mimeType: asset.mimeType || "image/jpeg",
      }));

      updateCurrentForm({
        attachments: [...currentForm.attachments, ...newItems],
      });
    } catch (error) {
      console.log("takePhoto error:", error);
      Alert.alert("Error", "Could not take photo.");
    }
  }

  async function pickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const file = result.assets[0];

      const newDoc = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: "document",
        uri: file.uri,
        name: file.name || "Document",
        mimeType: file.mimeType || "",
      };

      updateCurrentForm({
        attachments: [...currentForm.attachments, newDoc],
      });
    } catch (error) {
      console.log("pickDocument error:", error);
      Alert.alert("Error", "Could not add document.");
    }
  }

  function onCameraPress() {
    Alert.alert("Add Attachment", "Choose what you want to add.", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Upload Photo", onPress: pickFromLibrary },
      { text: "Upload Document", onPress: pickDocument },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function removeAttachment(id) {
    updateCurrentForm({
      attachments: currentForm.attachments.filter((item) => item.id !== id),
    });
  }

  function isFilled(form) {
    return (
      form.description.trim() ||
      form.locationStreet.trim() ||
      form.locationCity.trim() ||
      form.reservationNumber.trim() ||
      form.attachments.length > 0
    );
  }

  function buildItemFromForm(categoryKey, form, existingId = null) {
    const month = MONTHS[form.monthIndex];
    const year = YEARS[form.yearIndex];

    return {
      ...(existingId ? { id: existingId } : {}),
      category: categoryKey,
      description: form.description.trim(),
      location: {
        street: form.locationStreet,
        city: form.locationCity,
        state: form.locationState,
        zip: form.locationZip,
        latitude: form.locationLatitude,
        longitude: form.locationLongitude,
      },
      reservationNumber: form.reservationNumber.trim(),
      price: form.price,
      month,
      year,
      day: form.selectedDay,
      dateLabel: `${month} ${form.selectedDay}, ${year}`,
      hour24: form.timeValue.getHours(),
      minute: form.timeValue.getMinutes(),
      timeLabel: formatTime(form.timeValue),
      attachments: form.attachments,
    };
  }

  async function onAddAllItems() {
    if (!tripId || !sourceTripId || !sourceTripOwnerId) {
      Alert.alert("Error", "Missing trip information.");
      return;
    }

    if (editingId) {
      if (!currentForm.description.trim()) {
        Alert.alert("Missing description", "Please enter a description.");
        return;
      }

      const item = buildItemFromForm(category, currentForm, editingId);

      try {
        await upsertTripItem(sourceTripId, item, sourceTripOwnerId);

        router.replace({
          pathname: "/tripitinerary",
          params: {
            tripId,
            sourceTripId,
            sourceTripOwnerId,
          },
        });
      } catch (error) {
        console.log("Update item error:", error);
        Alert.alert("Error", error.message || "Could not update item.");
      }
      return;
    }

    const filledEntries = Object.entries(tabForms).filter(([, form]) => isFilled(form));

    if (filledEntries.length === 0) {
      Alert.alert("Nothing to save", "Fill in at least one tab first.");
      return;
    }

    const invalidEntry = filledEntries.find(([, form]) => !form.description.trim());
    if (invalidEntry) {
      Alert.alert("Missing description", "Any tab you use needs a description before saving.");
      return;
    }

    try {
      for (const [categoryKey, form] of filledEntries) {
        const item = buildItemFromForm(categoryKey, form);
        await upsertTripItem(sourceTripId, item, sourceTripOwnerId);
      }

      resetAllForms();

      router.replace({
        pathname: "/tripitinerary",
        params: {
          tripId,
          sourceTripId,
          sourceTripOwnerId,
        },
      });
    } catch (error) {
      console.log("Add all items error:", error);
      Alert.alert("Error", error.message || "Could not save trip items.");
    }
  }

  // location helpers for the map in add activity
  function updateLocationOnMap(lat, lng) {
    updateCurrentForm({ locationLatitude: lat, locationLongitude: lng });
    setMapRegion(prev => ({ ...prev, latitude: lat, longitude: lng }));
  }

  async function geocodeCurrentAddress() {
    const address = `${currentForm.locationStreet} ${currentForm.locationCity} ${currentForm.locationState} ${currentForm.locationZip}`.trim();
    if (!address) return;
    const res = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(address)}&key=${LOCATION_API_KEY}`);
    const data = await res.json();
    const loc = data.results?.[0]?.geometry;
    if (loc) updateLocationOnMap(loc.lat, loc.lng);
  }

  async function reverseGeocodeMapPress(lat, lng) {
    const res = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${LOCATION_API_KEY}`);
    const data = await res.json();
    const components = data.results?.[0]?.components;
    if (!components) return;
    updateCurrentForm({
      locationStreet: components.road || "",
      locationCity: components.city || components.town || components.village || "",
      locationState: components.state || "",
      locationZip: components.postcode || "",
    });
    updateLocationOnMap(lat, lng);
  }

  if (loadingEditData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filledTabCount = Object.values(tabForms).filter(isFilled).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="chevron-back" size={24} color={TEXT} />
          </Pressable>

          <Text style={styles.headerTitle}>
            {editingId ? "Edit Item" : "Add Items"}
          </Text>

          <Pressable
            onPress={() =>
              router.push({
                pathname: "/tripitinerary",
                params: {
                  tripId,
                  sourceTripId,
                  sourceTripOwnerId,
                },
              })
            }
            style={styles.iconButton}
          >
            <Ionicons name="grid-outline" size={22} color={TEXT} />
          </Pressable>
        </View>

        {!editingId && (
          <View style={styles.draftBanner}>
            <Text style={styles.draftBannerText}>
              {filledTabCount} tab{filledTabCount === 1 ? "" : "s"} ready to save
            </Text>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {CATEGORIES.map((item) => {
            const active = item.key === category;
            return (
              <Pressable
                key={item.key}
                style={[styles.categoryPill, active && styles.categoryPillActive]}
                onPress={() => setCategory(item.key)}
              >
                <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.label}>
          {category === "hotel" ? "Hotel / Reservation" : "Description"}
        </Text>

        <TextInput
          style={styles.input}
          placeholder={
            category === "transportation"
              ? "Flight, train, Uber, etc."
              : category === "food"
              ? "Restaurant, snack stop, etc."
              : category === "hotel"
              ? "Hotel name or reservation"
              : "Write a description here"
          }
          placeholderTextColor="#B8B8B8"
          value={currentForm.description}
          onChangeText={(text) => updateCurrentForm({ description: text })}
        />

        <Text style={styles.label}>
          {category === "hotel" ? "Location / Address" : "Location"}
        </Text>

        {/* address fields */}
        {[
          { label: "Street", key: "locationStreet" },
          { label: "City", key: "locationCity" },
          { label: "State", key: "locationState" },
          { label: "ZIP", key: "locationZip" },
        ].map((field) => (
          <TextInput
            key={field.key}
            style={styles.input}
            placeholder={field.label}
            placeholderTextColor="#B8B8B8"
            value={currentForm[field.key]}
            onChangeText={(text) => updateCurrentForm({ [field.key]: text })}
            keyboardType={field.key === "locationZip" ? "numeric" : "default"}
          />
        ))}

        <Pressable style={styles.showOnMapBtn} onPress={geocodeCurrentAddress}>
          <Ionicons name="map-outline" size={18} color="#fff" />
          <Text style={styles.showOnMapBtnText}>Show on Map</Text>
        </Pressable>

        {/* map */}
        <View style={styles.mapWrap}>
          <MapView
            style={styles.map}
            region={{ ...mapRegion, latitude: currentForm.locationLatitude, longitude: currentForm.locationLongitude }}
            onPress={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              reverseGeocodeMapPress(latitude, longitude);
            }}
          >
            <Marker coordinate={{ latitude: currentForm.locationLatitude, longitude: currentForm.locationLongitude }} />
          </MapView>
        </View>

        <Text style={styles.label}>Reservation Number</Text>
        <TextInput
          style={styles.input}
          placeholder="Optional"
          placeholderTextColor="#B8B8B8"
          value={currentForm.reservationNumber}
          onChangeText={(text) => updateCurrentForm({ reservationNumber: text })}
        />

        <Text style={styles.label}>Time</Text>
        <Pressable style={styles.timeButton} onPress={() => setShowTimePicker(true)}>
          <Text style={styles.timeButtonText}>{formatTime(currentForm.timeValue)}</Text>
          <Ionicons name="time-outline" size={20} color={TEXT} />
        </Pressable>

        {showTimePicker && (
          <DateTimePicker
            value={currentForm.timeValue}
            mode="time"
            is24Hour={false}
            display="default"
            onChange={(event, selectedDate) => {
              setShowTimePicker(false);
              if (selectedDate) {
                const next = new Date(currentForm.timeValue);
                next.setHours(selectedDate.getHours());
                next.setMinutes(selectedDate.getMinutes());
                updateCurrentForm({ timeValue: next });
              }
            }}
          />
        )}

        <View style={styles.priceHeader}>
          <Text style={styles.priceLabel}>Price</Text>
          <Text style={styles.priceValue}>${currentForm.price}</Text>
        </View>

        <View style={styles.priceRow}>
          <View style={styles.sliderWrap}>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={0}
              maximumValue={1000}
              step={1}
              value={currentForm.price}
              minimumTrackTintColor={BLUE}
              maximumTrackTintColor="#D5D5D5"
              thumbTintColor={BLUE}
              onValueChange={(value) => updateCurrentForm({ price: value })}
            />
          </View>

          <Pressable style={styles.cameraButton} onPress={onCameraPress}>
            <Ionicons name="camera-outline" size={28} color={BLUE} />
          </Pressable>
        </View>

        {currentForm.attachments.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentsRow}>
            {currentForm.attachments.map((item) => (
              <View key={item.id} style={styles.attachmentCard}>
                {item.type === "image" ? (
                  <Image source={{ uri: item.uri }} style={styles.attachmentImage} />
                ) : (
                  <View style={styles.docPreview}>
                    <Ionicons name="document-text-outline" size={28} color={BLUE} />
                  </View>
                )}

                <Text numberOfLines={1} style={styles.attachmentName}>
                  {typeof item.name === "string" ? item.name : "Attachment"}
                </Text>

                <Pressable
                  style={styles.removeAttachmentButton}
                  onPress={() => removeAttachment(item.id)}
                >
                  <Ionicons name="close-circle" size={20} color="#D9534F" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.calendarCard}>
          <View style={styles.calendarTopRow}>
            <Pressable
              onPress={goPrevMonth}
              style={[styles.arrowButton, !canGoPrevMonth && styles.arrowButtonDisabled]}
              disabled={!canGoPrevMonth}
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={canGoPrevMonth ? TEXT : "#9CA3AF"}
              />
            </Pressable>

            <View style={styles.dropdownRow}>
              <View style={styles.fakeDropdownMonth}>
                <Text style={styles.dropdownText}>{currentMonth}</Text>
              </View>

              <View style={styles.fakeDropdownYear}>
                <Text style={styles.dropdownText}>{currentYear}</Text>
              </View>
            </View>

            <Pressable
              onPress={goNextMonth}
              style={[styles.arrowButton, !canGoNextMonth && styles.arrowButtonDisabled]}
              disabled={!canGoNextMonth}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={canGoNextMonth ? TEXT : "#9CA3AF"}
              />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <Text key={day} style={styles.weekText}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {calendarCells.map((cell) => {
              if (cell.type !== "day") {
                return <View key={cell.key} style={styles.dayCell} />;
              }

              const selected = cell.value === currentForm.selectedDay;
              const disabled = cell.disabled;

              return (
                <Pressable
                  key={cell.key}
                  style={[
                    styles.dayCell,
                    selected && styles.selectedDayCell,
                    disabled && styles.disabledDayCell,
                  ]}
                  disabled={disabled}
                  onPress={() => {
                    const nextTime = new Date(currentForm.timeValue);
                    nextTime.setFullYear(currentYear);
                    nextTime.setMonth(currentForm.monthIndex);
                    nextTime.setDate(cell.value);

                    updateCurrentForm({
                      selectedDay: cell.value,
                      timeValue: nextTime,
                    });
                  }}
                >
                  <Text
                    style={[
                      styles.dayText,
                      selected && styles.selectedDayText,
                      disabled && styles.disabledDayText,
                    ]}
                  >
                    {cell.value}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {tripStartDate && tripEndDate ? (
            <Text style={styles.tripRangeText}>
              Select a date between{" "}
              {MONTHS[tripStartDate.getMonth()]} {tripStartDate.getDate()} and{" "}
              {MONTHS[tripEndDate.getMonth()]} {tripEndDate.getDate()}, {tripEndDate.getFullYear()}
            </Text>
          ) : null}
        </View>

        <Pressable style={styles.createButton} onPress={onAddAllItems}>
          <Text style={styles.createButtonText}>
            {editingId ? "UPDATE!" : "ADD ALL ITEMS"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#DCE6FF"
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },

  loadingText: {
    fontSize: 16,
    color: "#1F2937"
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 18
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

  headerTitle: {
    fontSize: 18,
    color: "#3F63F3",
    fontWeight: "700"
  },

  draftBanner: {
    backgroundColor: "#C9D7FF",
    borderColor: "#B4C6FF",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12
  },

  draftBannerText: {
    color: "#3F63F3",
    fontSize: 14,
    fontWeight: "600"
  },

  categoryRow: {
    paddingBottom: 12,
    gap: 8
  },

  categoryPill: {
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 20,
    backgroundColor: "#D4DEFF",
    borderWidth: 1,
    borderColor: "#B4C6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8
  },

  categoryPillActive: {
    backgroundColor: "#5A75F5",
    borderColor: "#5A75F5"
  },

  categoryPillText: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "600"
  },

  categoryPillTextActive: {
    color: "#fff"
  },

  label: {
    fontSize: 15,
    color: "#111827",
    marginBottom: 10,
    fontWeight: "600"
  },

  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: "#9FB2FF",
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#1F2937",
    marginBottom: 14
  },

  showOnMapBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },

  showOnMapBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  mapWrap: {
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },

  map: { flex: 1 },

  locationWrap: {
    height: 52,
    borderWidth: 1.5,
    borderColor: "#9FB2FF",
    borderRadius: 26,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14
  },

  locationInput: {
    flex: 1,
    fontSize: 15,
    color: "#1F2937",
    marginRight: 8
  },

  timeButton: {
    height: 52,
    borderWidth: 1.5,
    borderColor: "#9FB2FF",
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },

  timeButtonText: {
    fontSize: 15,
    color: "#1F2937"
  },

  priceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    paddingHorizontal: 8
  },

  priceLabel: {
    fontSize: 15,
    color: "#1F2937",
    fontWeight: "600"
  },

  priceValue: {
    fontSize: 14,
    color: "#4B5563"
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14
  },

  sliderWrap: {
    flex: 1,
    marginRight: 14
  },

  cameraButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#5A75F5",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF"
  },

  attachmentsRow: {
    paddingBottom: 14,
    gap: 10
  },

  attachmentCard: {
    width: 110,
    backgroundColor: "#D4DEFF",
    borderWidth: 1,
    borderColor: "#B4C6FF",
    borderRadius: 12,
    padding: 8,
    marginRight: 10,
    position: "relative"
  },

  attachmentImage: {
    width: "100%",
    height: 68,
    borderRadius: 8,
    backgroundColor: "#C2D0FF",
    marginBottom: 6
  },

  docPreview: {
    width: "100%",
    height: 68,
    borderRadius: 8,
    backgroundColor: "#C2D0FF",
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "center"
  },

  attachmentName: {
    fontSize: 12,
    color: "#1F2937"
  },

  removeAttachmentButton: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#DCE6FF",
    borderRadius: 999
  },

  calendarCard: {
    backgroundColor: "#D4DEFF",
    borderWidth: 1,
    borderColor: "#B4C6FF",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16
  },

  calendarTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14
  },

  arrowButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#C9D7FF",
  },

  arrowButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },

  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },

  fakeDropdownMonth: {
    minWidth: 70,
    height: 34,
    borderWidth: 1,
    borderColor: "#B4C6FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#C9D7FF"
  },

  fakeDropdownYear: {
    minWidth: 86,
    height: 34,
    borderWidth: 1,
    borderColor: "#B4C6FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#C9D7FF"
  },

  dropdownText: {
    fontSize: 14,
    color: "#1F2937"
  },

  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 4
  },

  weekText: {
    width: "14.28%",
    textAlign: "center",
    color: "#6B7280",
    fontSize: 12
  },

  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },

  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    marginBottom: 4
  },

  selectedDayCell: {
    backgroundColor: "#5A75F5"
  },

  disabledDayCell: {
    backgroundColor: "#E5E7EB",
    opacity: 0.65,
  },

  dayText: {
    fontSize: 16,
    color: "#2B2B2B"
  },

  selectedDayText: {
    color: "#fff",
    fontWeight: "600"
  },

  disabledDayText: {
    color: "#9CA3AF",
  },

  tripRangeText: {
    marginTop: 10,
    textAlign: "center",
    color: "#4B5563",
    fontSize: 12,
    lineHeight: 18,
  },

  createButton: {
    marginTop: 16,
    backgroundColor: "#5A75F5",
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },

  createButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
});