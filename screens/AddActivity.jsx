import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import Slider from "@react-native-community/slider";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import {
  formatTime,
  getTripItemById,
  upsertTripItem,
} from "../utils/tripStorage";
import { auth } from "../firebaseConfig";

const BLUE = "#4967E8";
const BG = "#F7F7F7";
const BORDER = "#DADADA";
const TEXT = "#1F1F1F";

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

function createEmptyForm() {
  return {
    description: "",
    location: "",
    reservationNumber: "",
    price: 50,
    monthIndex: 0,
    yearIndex: 1,
    selectedDay: 9,
    timeValue: new Date(2026, 0, 9, 12, 0),
    attachments: [],
  };
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

  const [tabForms, setTabForms] = useState({
    activity: createEmptyForm(),
    transportation: createEmptyForm(),
    food: createEmptyForm(),
    hotel: createEmptyForm(),
  });

  useEffect(() => {
    if (presetCategory && !editingId) {
      setCategory(presetCategory);
    }
  }, [presetCategory, editingId]);

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

          const loadedForm = {
            description: item.description || "",
            location: item.location || "",
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

  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentForm.monthIndex + 1, 0).getDate();
  }, [currentYear, currentForm.monthIndex]);

  const firstDayOfMonth = useMemo(() => {
    return new Date(currentYear, currentForm.monthIndex, 1).getDay();
  }, [currentYear, currentForm.monthIndex]);

  const calendarCells = useMemo(() => {
    const cells = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push({ type: "empty", key: `empty-${i}` });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ type: "day", key: `day-${day}`, value: day });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ type: "empty-end", key: `empty-end-${cells.length}` });
    }

    return cells;
  }, [firstDayOfMonth, daysInMonth]);

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
    setTabForms({
      activity: createEmptyForm(),
      transportation: createEmptyForm(),
      food: createEmptyForm(),
      hotel: createEmptyForm(),
    });
    setCategory("activity");
  }

  function goPrevMonth() {
    if (currentForm.monthIndex === 0) {
      if (currentForm.yearIndex > 0) {
        updateCurrentForm({
          monthIndex: 11,
          yearIndex: currentForm.yearIndex - 1,
        });
      }
    } else {
      updateCurrentForm({ monthIndex: currentForm.monthIndex - 1 });
    }
  }

  function goNextMonth() {
    if (currentForm.monthIndex === 11) {
      if (currentForm.yearIndex < YEARS.length - 1) {
        updateCurrentForm({
          monthIndex: 0,
          yearIndex: currentForm.yearIndex + 1,
        });
      }
    } else {
      updateCurrentForm({ monthIndex: currentForm.monthIndex + 1 });
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
      form.location.trim() ||
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
      location: form.location.trim(),
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

        <View style={styles.locationWrap}>
          <TextInput
            style={styles.locationInput}
            placeholder={category === "hotel" ? "Enter hotel address or city" : "Enter name of location"}
            placeholderTextColor="#B8B8B8"
            value={currentForm.location}
            onChangeText={(text) => updateCurrentForm({ location: text })}
          />
          <Ionicons name="search-outline" size={20} color={TEXT} />
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
                updateCurrentForm({ timeValue: selectedDate });
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
                  {item.name}
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
            <Pressable onPress={goPrevMonth} style={styles.arrowButton}>
              <Ionicons name="chevron-back" size={18} color={TEXT} />
            </Pressable>

            <View style={styles.dropdownRow}>
              <View style={styles.fakeDropdownMonth}>
                <Text style={styles.dropdownText}>{currentMonth}</Text>
              </View>

              <View style={styles.fakeDropdownYear}>
                <Text style={styles.dropdownText}>{currentYear}</Text>
              </View>
            </View>

            <Pressable onPress={goNextMonth} style={styles.arrowButton}>
              <Ionicons name="chevron-forward" size={18} color={TEXT} />
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

              return (
                <Pressable
                  key={cell.key}
                  style={[styles.dayCell, selected && styles.selectedDayCell]}
                  onPress={() => updateCurrentForm({ selectedDay: cell.value })}
                >
                  <Text style={[styles.dayText, selected && styles.selectedDayText]}>
                    {cell.value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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

  dayText: {
    fontSize: 16,
    color: "#2B2B2B"
  },

  selectedDayText: {
    color: "#fff",
    fontWeight: "600"
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