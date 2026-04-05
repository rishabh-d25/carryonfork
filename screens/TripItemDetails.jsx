import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import Slider from "@react-native-community/slider";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Modal,
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
  deleteTripItem,
  formatTime,
  getTripItemById,
  persistTripAttachmentLocally,
  upsertTripItem,
} from "../utils/tripStorage";

const BLUE = "#4967E8";
const BG = "#F7F7F7";
const BORDER = "#DADADA";
const TEXT = "#1F1F1F";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CATEGORIES = [
  { key: "activity", label: "Activity" },
  { key: "transportation", label: "Transportation" },
  { key: "food", label: "Food" },
  { key: "hotel", label: "Hotel" },
];

function buildDateFromItem(item) {
  const monthIndex = Math.max(0, MONTHS.indexOf(item?.month));
  const year = item?.year || new Date().getFullYear();
  const day = item?.day || 1;
  const hour = typeof item?.hour24 === "number" ? item.hour24 : 12;
  const minute = typeof item?.minute === "number" ? item.minute : 0;
  return new Date(year, monthIndex, day, hour, minute, 0);
}

function getAttachmentDisplayUri(attachment) {
  return attachment?.uri || "";
}

function isLocalPersistedAttachment(attachment) {
  return !!attachment?.isLocalPersisted;
}

export default function TripItemDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tripId = params.tripId ? String(params.tripId) : null;
  const itemId = params.itemId ? String(params.itemId) : null;
  const fullScreenScrollRef = useRef(null);

  const [item, setItem] = useState(null);
  const [draft, setDraft] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const loadItem = useCallback(async () => {
    if (!tripId || !itemId) return;

    try {
      const found = await getTripItemById(tripId, itemId);

      if (!found) {
        setItem(null);
        setDraft(null);
        return;
      }

      const safeAttachments = Array.isArray(found.attachments) ? found.attachments : [];

      const safeItem = {
        ...found,
        id: itemId,
        attachments: safeAttachments,
      };

      setItem(safeItem);
      setDraft({
        ...safeItem,
        attachments: safeAttachments,
        dateObject: buildDateFromItem(safeItem),
      });
    } catch (error) {
      console.log("loadItem error:", error);
      Alert.alert("Error", "Could not load item details.");
      setItem(null);
      setDraft(null);
    }
  }, [tripId, itemId]);

  useFocusEffect(
    useCallback(() => {
      loadItem();
    }, [loadItem])
  );

  const imageAttachments = useMemo(() => {
    if (!Array.isArray(draft?.attachments)) return [];
    return draft.attachments.filter(
      (attachment) => attachment?.type === "image" && getAttachmentDisplayUri(attachment)
    );
  }, [draft]);

  const documentAttachments = useMemo(() => {
    if (!Array.isArray(draft?.attachments)) return [];
    return draft.attachments.filter((attachment) => attachment?.type !== "image");
  }, [draft]);

  function openImageViewer(index) {
    setViewerIndex(index);
    setViewerVisible(true);

    setTimeout(() => {
      fullScreenScrollRef.current?.scrollTo({
        x: SCREEN_WIDTH * index,
        animated: false,
      });
    }, 0);
  }

  function closeImageViewer() {
    setViewerVisible(false);
  }

  function onViewerScrollEnd(event) {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / SCREEN_WIDTH);
    setViewerIndex(index);
  }

  function startEdit(field) {
    setEditingField(field);
  }

  function cancelEdit() {
    if (!item) return;

    const safeAttachments = Array.isArray(item.attachments) ? item.attachments : [];

    setDraft({
      ...item,
      attachments: safeAttachments,
      dateObject: buildDateFromItem(item),
    });
    setEditingField(null);
    setShowDatePicker(false);
    setShowTimePicker(false);
  }

async function persistAttachmentsLocally(attachmentsToPersist) {
  const nextAttachments = [];
  const failedAttachments = [];

  for (const attachment of attachmentsToPersist || []) {
    try {
      if (isLocalPersistedAttachment(attachment)) {
        nextAttachments.push({
          ...attachment,
          id: String(attachment.id),
        });
        continue;
      }

      if (!attachment?.uri) {
        failedAttachments.push(attachment);
        continue;
      }

      const savedAttachment = await persistTripAttachmentLocally(tripId, itemId, attachment);

      nextAttachments.push({
        ...savedAttachment,
        id: String(savedAttachment.id || attachment.id),
      });

      if (!savedAttachment?.uri) {
        failedAttachments.push(attachment);
      }
    } catch (error) {
      console.log("persistAttachmentsLocally failed:", error);

      // keep the original attachment so it doesn't vanish
      nextAttachments.push({
        ...attachment,
        id: String(attachment.id),
      });

      failedAttachments.push(attachment);
    }
  }

  return {
    attachments: nextAttachments,
    failedAttachments,
  };
}
async function saveDraft() {
  if (!draft || !tripId || !itemId || saving) return;

  if (!draft.description?.trim()) {
    Alert.alert("Missing description", "Description cannot be empty.");
    return;
  }

  try {
    setSaving(true);

    const safeDate = draft.dateObject || buildDateFromItem(draft);

    let finalAttachments = Array.isArray(draft.attachments) ? [...draft.attachments] : [];

    if (editingField === "attachments") {
      const result = await persistAttachmentsLocally(finalAttachments);
      finalAttachments = result.attachments;
    }

    const updatedItem = {
      ...draft,
      id: itemId,
      month: MONTHS[safeDate.getMonth()],
      year: safeDate.getFullYear(),
      day: safeDate.getDate(),
      hour24: safeDate.getHours(),
      minute: safeDate.getMinutes(),
      dateLabel: `${MONTHS[safeDate.getMonth()]} ${safeDate.getDate()}, ${safeDate.getFullYear()}`,
      timeLabel: formatTime(safeDate),
      description: (draft.description || "").trim(),
      location: (draft.location || "").trim(),
      reservationNumber: (draft.reservationNumber || "").trim(),
      attachments: finalAttachments,
    };

    delete updatedItem.dateObject;

    await upsertTripItem(tripId, updatedItem);

    const freshItem = await getTripItemById(tripId, itemId);
    const safeFreshAttachments = Array.isArray(freshItem?.attachments) ? freshItem.attachments : [];

    if (freshItem) {
      const normalized = {
        ...freshItem,
        id: itemId,
        attachments: safeFreshAttachments,
      };

      setItem(normalized);
      setDraft({
        ...normalized,
        attachments: safeFreshAttachments,
        dateObject: buildDateFromItem(normalized),
      });
    }

    setEditingField(null);
    setShowDatePicker(false);
    setShowTimePicker(false);
  } catch (error) {
    console.log("saveDraft error:", error);
    Alert.alert("Error", error.message || "Could not save changes.");
  } finally {
    setSaving(false);
  }
}

  async function onDelete() {
    if (!tripId || !itemId) return;

    Alert.alert("Delete item", "Are you sure you want to delete this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTripItem(tripId, itemId);
            router.replace({
              pathname: "/tripitinerary",
              params: { tripId },
            });
          } catch (error) {
            console.log("Delete item error:", error);
            Alert.alert("Error", "Could not delete item.");
          }
        },
      },
    ]);
  }

async function addPhotoFromLibrary() {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
      allowsMultipleSelection: true,
    });

    if (result.canceled || !draft) return;

    const newItems = (result.assets || []).map((asset) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: "image",
      uri: asset.uri,
      name: asset.fileName || "Photo",
      mimeType: asset.mimeType || "image/jpeg",
      isLocalPersisted: false,
    }));

    const nextAttachments = [...(draft.attachments || []), ...newItems];

    setDraft((prev) => ({
      ...prev,
      attachments: nextAttachments,
    }));

    await saveAttachmentsImmediately(nextAttachments);
  } catch (error) {
    console.log("addPhotoFromLibrary error:", error);
  }
}

async function takePhoto() {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled || !draft) return;

    const asset = result.assets?.[0];
    if (!asset) return;

    const newItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: "image",
      uri: asset.uri,
      name: asset.fileName || "Camera Photo",
      mimeType: asset.mimeType || "image/jpeg",
      isLocalPersisted: false,
    };

    const nextAttachments = [...(draft.attachments || []), newItem];

    setDraft((prev) => ({
      ...prev,
      attachments: nextAttachments,
    }));

    await saveAttachmentsImmediately(nextAttachments);
  } catch (error) {
    console.log("takePhoto error:", error);
  }
}

async function addDocument() {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !draft) return;

    const file = result.assets?.[0];
    if (!file) return;

    const newDoc = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: "document",
      uri: file.uri,
      name: file.name || "Document",
      mimeType: file.mimeType || "application/octet-stream",
      isLocalPersisted: false,
    };

    const nextAttachments = [...(draft.attachments || []), newDoc];

    setDraft((prev) => ({
      ...prev,
      attachments: nextAttachments,
    }));

    await saveAttachmentsImmediately(nextAttachments);
  } catch (error) {
    console.log("addDocument error:", error);
  }
}

  async function saveAttachmentsImmediately(nextAttachments) {
  if (!tripId || !itemId || !draft) return;

  try {
    const safeDate = draft.dateObject || buildDateFromItem(draft);

    const updatedItem = {
      ...draft,
      id: itemId,
      month: MONTHS[safeDate.getMonth()],
      year: safeDate.getFullYear(),
      day: safeDate.getDate(),
      hour24: safeDate.getHours(),
      minute: safeDate.getMinutes(),
      dateLabel: `${MONTHS[safeDate.getMonth()]} ${safeDate.getDate()}, ${safeDate.getFullYear()}`,
      timeLabel: formatTime(safeDate),
      description: (draft.description || "").trim(),
      location: (draft.location || "").trim(),
      reservationNumber: (draft.reservationNumber || "").trim(),
      attachments: nextAttachments,
    };

    delete updatedItem.dateObject;

    await upsertTripItem(tripId, updatedItem);

    setDraft((prev) => ({
      ...prev,
      attachments: nextAttachments,
    }));

    setItem((prev) => ({
      ...prev,
      attachments: nextAttachments,
    }));
  } catch (error) {
    console.log("saveAttachmentsImmediately error:", error);
  }
}

  function openAttachmentPicker() {
    Alert.alert("Add Attachment", "Choose what you want to add.", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Upload Photo", onPress: addPhotoFromLibrary },
      { text: "Upload Document", onPress: addDocument },
      { text: "Cancel", style: "cancel" },
    ]);
  }

async function removeAttachment(attachmentId) {
  const nextAttachments = (draft.attachments || []).filter(
    (a) => String(a.id) !== String(attachmentId)
  );

  setDraft((prev) => ({
    ...prev,
    attachments: nextAttachments,
  }));

  await saveAttachmentsImmediately(nextAttachments);
}

  if (!draft) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const editingDescription = editingField === "description";
  const editingReservationNumber = editingField === "reservationNumber";
  const editingCategory = editingField === "category";
  const editingPrice = editingField === "price";
  const editingDate = editingField === "date";
  const editingTime = editingField === "time";
  const editingLocation = editingField === "location";
  const editingAttachments = editingField === "attachments";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="chevron-back" size={24} color={TEXT} />
          </Pressable>

          <Text style={styles.headerTitle}>Activity Details</Text>

          <Pressable style={styles.iconButton} onPress={onDelete}>
            <Ionicons name="trash-outline" size={22} color="#D9534F" />
          </Pressable>
        </View>

        {imageAttachments.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.heroScroller}
            contentContainerStyle={styles.heroScrollerContent}
          >
            {imageAttachments.map((attachment, index) => (
              <Pressable
                key={attachment.id}
                onPress={() => openImageViewer(index)}
                style={styles.heroImageWrap}
              >
                <Image
                  source={{ uri: getAttachmentDisplayUri(attachment) }}
                  style={styles.heroImage}
                  resizeMode="contain"
                />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.noPhotoCard}>
            <Ionicons name="image-outline" size={26} color="#9CA3AF" />
            <Text style={styles.noPhotoText}>No photos added</Text>
          </View>
        )}

        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {CATEGORIES.find((c) => c.key === draft.category)?.label || "Item"}
              </Text>
            </View>
            <Text style={styles.priceLarge}>${Number(draft.price ?? 0)}</Text>
          </View>

          <Text style={styles.mainTitle}>{draft.description || "No description"}</Text>

          <View style={styles.summaryRow}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text style={styles.summaryText}>{draft.dateLabel || "—"}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text style={styles.summaryText}>{draft.timeLabel || "—"}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Ionicons name="location-outline" size={16} color="#6B7280" />
            <Text style={styles.summaryText}>{draft.location || "—"}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.infoLabel}>Description</Text>
            {!editingDescription ? (
              <Pressable onPress={() => startEdit("description")} style={styles.editIconButton}>
                <Ionicons name="create-outline" size={18} color={BLUE} />
              </Pressable>
            ) : null}
          </View>

          {!editingDescription ? (
            <Text style={styles.infoValue}>{draft.description || "—"}</Text>
          ) : (
            <>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={draft.description || ""}
                onChangeText={(text) =>
                  setDraft((prev) => ({
                    ...prev,
                    description: text,
                  }))
                }
                placeholder="Enter description"
                placeholderTextColor="#B8B8B8"
                multiline
              />

              <View style={styles.editActionRow}>
                <Pressable style={styles.cancelButton} onPress={cancelEdit}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveButton} onPress={saveDraft} disabled={saving}>
                  <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.infoLabel}>Location</Text>
            {!editingLocation ? (
              <Pressable onPress={() => startEdit("location")} style={styles.editIconButton}>
                <Ionicons name="create-outline" size={18} color={BLUE} />
              </Pressable>
            ) : null}
          </View>

          {!editingLocation ? (
            <Text style={styles.infoValue}>{draft.location || "—"}</Text>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={draft.location || ""}
                onChangeText={(text) =>
                  setDraft((prev) => ({
                    ...prev,
                    location: text,
                  }))
                }
                placeholder="Enter location"
                placeholderTextColor="#B8B8B8"
              />

              <View style={styles.editActionRow}>
                <Pressable style={styles.cancelButton} onPress={cancelEdit}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveButton} onPress={saveDraft} disabled={saving}>
                  <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.infoLabel}>Reservation Number</Text>
            {!editingReservationNumber ? (
              <Pressable onPress={() => startEdit("reservationNumber")} style={styles.editIconButton}>
                <Ionicons name="create-outline" size={18} color={BLUE} />
              </Pressable>
            ) : null}
          </View>

          {!editingReservationNumber ? (
            <Text style={styles.infoValue}>{draft.reservationNumber || "—"}</Text>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={draft.reservationNumber || ""}
                onChangeText={(text) =>
                  setDraft((prev) => ({
                    ...prev,
                    reservationNumber: text,
                  }))
                }
                placeholder="Enter reservation number"
                placeholderTextColor="#B8B8B8"
              />

              <View style={styles.editActionRow}>
                <Pressable style={styles.cancelButton} onPress={cancelEdit}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveButton} onPress={saveDraft} disabled={saving}>
                  <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.infoLabel}>Category</Text>
            {!editingCategory ? (
              <Pressable onPress={() => startEdit("category")} style={styles.editIconButton}>
                <Ionicons name="create-outline" size={18} color={BLUE} />
              </Pressable>
            ) : null}
          </View>

          {!editingCategory ? (
            <Text style={styles.infoValue}>
              {CATEGORIES.find((c) => c.key === draft.category)?.label || "—"}
            </Text>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                {CATEGORIES.map((cat) => {
                  const active = draft.category === cat.key;
                  return (
                    <Pressable
                      key={cat.key}
                      style={[styles.categoryPill, active && styles.categoryPillActive]}
                      onPress={() =>
                        setDraft((prev) => ({
                          ...prev,
                          category: cat.key,
                        }))
                      }
                    >
                      <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.editActionRow}>
                <Pressable style={styles.cancelButton} onPress={cancelEdit}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveButton} onPress={saveDraft} disabled={saving}>
                  <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.infoLabel}>Price</Text>
            {!editingPrice ? (
              <Pressable onPress={() => startEdit("price")} style={styles.editIconButton}>
                <Ionicons name="create-outline" size={18} color={BLUE} />
              </Pressable>
            ) : null}
          </View>

          {!editingPrice ? (
            <Text style={styles.infoValue}>${Number(draft.price ?? 0)}</Text>
          ) : (
            <>
              <Text style={styles.pricePreview}>${Number(draft.price ?? 0)}</Text>
              <Slider
                style={{ width: "100%", height: 40 }}
                minimumValue={0}
                maximumValue={1000}
                step={1}
                value={Number(draft.price ?? 0)}
                minimumTrackTintColor={BLUE}
                maximumTrackTintColor="#D5D5D5"
                thumbTintColor={BLUE}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    price: value,
                  }))
                }
              />

              <View style={styles.editActionRow}>
                <Pressable style={styles.cancelButton} onPress={cancelEdit}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveButton} onPress={saveDraft} disabled={saving}>
                  <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.infoLabel}>Date</Text>
            {!editingDate ? (
              <Pressable onPress={() => startEdit("date")} style={styles.editIconButton}>
                <Ionicons name="create-outline" size={18} color={BLUE} />
              </Pressable>
            ) : null}
          </View>

          {!editingDate ? (
            <Text style={styles.infoValue}>{draft.dateLabel || "—"}</Text>
          ) : (
            <>
              <Pressable style={styles.timeButton} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.timeButtonText}>{draft.dateLabel || "Select a date"}</Text>
                <Ionicons name="calendar-outline" size={20} color={TEXT} />
              </Pressable>

              {showDatePicker && (
                <DateTimePicker
                  value={draft.dateObject}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setDraft((prev) => {
                        const next = new Date(prev.dateObject);
                        next.setFullYear(selectedDate.getFullYear());
                        next.setMonth(selectedDate.getMonth());
                        next.setDate(selectedDate.getDate());
                        return {
                          ...prev,
                          dateObject: next,
                        };
                      });
                    }
                  }}
                />
              )}

              <View style={styles.editActionRow}>
                <Pressable style={styles.cancelButton} onPress={cancelEdit}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveButton} onPress={saveDraft} disabled={saving}>
                  <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.infoLabel}>Time</Text>
            {!editingTime ? (
              <Pressable onPress={() => startEdit("time")} style={styles.editIconButton}>
                <Ionicons name="create-outline" size={18} color={BLUE} />
              </Pressable>
            ) : null}
          </View>

          {!editingTime ? (
            <Text style={styles.infoValue}>{draft.timeLabel || "—"}</Text>
          ) : (
            <>
              <Pressable style={styles.timeButton} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.timeButtonText}>{formatTime(draft.dateObject)}</Text>
                <Ionicons name="time-outline" size={20} color={TEXT} />
              </Pressable>

              {showTimePicker && (
                <DateTimePicker
                  value={draft.dateObject}
                  mode="time"
                  is24Hour={false}
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowTimePicker(false);
                    if (selectedDate) {
                      setDraft((prev) => {
                        const next = new Date(prev.dateObject);
                        next.setHours(selectedDate.getHours());
                        next.setMinutes(selectedDate.getMinutes());
                        return {
                          ...prev,
                          dateObject: next,
                        };
                      });
                    }
                  }}
                />
              )}

              <View style={styles.editActionRow}>
                <Pressable style={styles.cancelButton} onPress={cancelEdit}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveButton} onPress={saveDraft} disabled={saving}>
                  <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.infoLabel}>Attachments</Text>
            {!editingAttachments ? (
              <Pressable onPress={() => startEdit("attachments")} style={styles.editIconButton}>
                <Ionicons name="create-outline" size={18} color={BLUE} />
              </Pressable>
            ) : null}
          </View>

          {imageAttachments.length === 0 && documentAttachments.length === 0 ? (
            <Text style={styles.infoValue}>—</Text>
          ) : (
            <>
              {imageAttachments.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentsRow}>
                  {imageAttachments.map((attachment, index) => (
                    <View key={attachment.id} style={styles.attachmentCard}>
                      <Pressable onPress={() => openImageViewer(index)}>
                        <Image
                          source={{ uri: getAttachmentDisplayUri(attachment) }}
                          style={styles.attachmentImage}
                          resizeMode="contain"
                        />
                      </Pressable>

                      <Text numberOfLines={1} style={styles.attachmentName}>
                        {attachment.name}
                      </Text>

                      {editingAttachments ? (
                        <Pressable
                          style={styles.removeAttachmentButton}
                          onPress={() => removeAttachment(attachment.id)}
                        >
                          <Ionicons name="close-circle" size={20} color="#D9534F" />
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
              ) : null}

              {documentAttachments.map((attachment) => (
                <View key={attachment.id} style={styles.documentRow}>
                  <Ionicons name="document-text-outline" size={18} color={BLUE} />
                  <Text style={styles.documentName}>{attachment.name}</Text>
                  {editingAttachments ? (
                    <Pressable onPress={() => removeAttachment(attachment.id)}>
                      <Ionicons name="close-circle" size={20} color="#D9534F" />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </>
          )}

          {editingAttachments ? (
            <>
              <Pressable style={styles.addAttachmentButton} onPress={openAttachmentPicker}>
                <Ionicons name="add-circle-outline" size={18} color={BLUE} />
                <Text style={styles.addAttachmentButtonText}>Add Attachment</Text>
              </Pressable>

              <View style={styles.editActionRow}>
                <Pressable style={styles.cancelButton} onPress={cancelEdit}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveButton} onPress={saveDraft} disabled={saving}>
                  <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>

        <Pressable style={styles.deleteButton} onPress={onDelete}>
          <Text style={styles.deleteButtonText}>DELETE ACTIVITY</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={closeImageViewer}>
        <View style={styles.viewerOverlay}>
          <Pressable style={styles.viewerCloseButton} onPress={closeImageViewer}>
            <Ionicons name="close" size={30} color="#fff" />
          </Pressable>

          <ScrollView
            ref={fullScreenScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onViewerScrollEnd}
          >
            {imageAttachments.map((attachment) => (
              <View key={attachment.id} style={styles.viewerSlide}>
                <Image
                  source={{ uri: getAttachmentDisplayUri(attachment) }}
                  style={styles.viewerImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>

          {imageAttachments.length > 1 ? (
            <View style={styles.viewerCounter}>
              <Text style={styles.viewerCounterText}>
                {viewerIndex + 1} / {imageAttachments.length}
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30, backgroundColor: BG },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontSize: 16, color: TEXT },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 18 },
  iconButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, color: TEXT, fontFamily: "serif" },

  heroScroller: { marginBottom: 14 },
  heroScrollerContent: { paddingRight: 4 },
  heroImageWrap: {
    width: SCREEN_WIDTH - 40,
    height: 230,
    marginRight: 10,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  heroImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E5E7EB",
  },

  noPhotoCard: {
    height: 140,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    gap: 8,
  },
  noPhotoText: { color: "#6B7280", fontSize: 14, fontWeight: "600" },

  summaryCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 18, padding: 16, marginBottom: 12 },
  summaryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  categoryBadge: { backgroundColor: "#EEF2FF", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  categoryBadgeText: { color: BLUE, fontSize: 12, fontWeight: "700" },
  priceLarge: { fontSize: 20, color: TEXT, fontWeight: "700" },
  mainTitle: { fontSize: 22, color: TEXT, fontWeight: "700", marginBottom: 12 },
  summaryRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  summaryText: { marginLeft: 8, color: "#4B5563", fontSize: 15, flex: 1 },

  infoCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 14, marginBottom: 12 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  infoLabel: { fontSize: 14, fontWeight: "700", color: TEXT, marginBottom: 6 },
  infoValue: { fontSize: 15, color: TEXT, lineHeight: 22 },

  editIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
  },

  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT,
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },

  categoryRow: { paddingVertical: 4 },
  categoryPill: {
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  categoryPillActive: { backgroundColor: BLUE, borderColor: BLUE },
  categoryPillText: { color: TEXT, fontSize: 14, fontWeight: "600" },
  categoryPillTextActive: { color: "#fff" },

  pricePreview: { fontSize: 16, color: TEXT, marginBottom: 4, fontWeight: "600" },

  timeButton: {
    height: 48,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeButtonText: { fontSize: 15, color: TEXT },

  attachmentsRow: { paddingTop: 4, paddingBottom: 6 },
  attachmentCard: {
    width: 120,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 8,
    marginRight: 10,
    position: "relative",
  },
  attachmentImage: {
    width: "100%",
    height: 80,
    borderRadius: 8,
    backgroundColor: "#EEE",
    marginBottom: 6,
  },
  attachmentName: { fontSize: 12, color: TEXT },
  removeAttachmentButton: { position: "absolute", top: -6, right: -6, backgroundColor: "#fff", borderRadius: 999 },

  documentRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  documentName: { flex: 1, marginLeft: 8, color: TEXT, fontSize: 14 },

  addAttachmentButton: {
    marginTop: 10,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BLUE,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addAttachmentButtonText: { color: BLUE, fontWeight: "700" },

  editActionRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10 },
  cancelButton: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  cancelButtonText: { color: TEXT, fontSize: 14, fontWeight: "600" },
  saveButton: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  deleteButton: {
    marginTop: 6,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D9534F",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: { color: "#D9534F", fontSize: 15, fontWeight: "700" },

  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
    justifyContent: "center",
  },
  viewerCloseButton: {
    position: "absolute",
    top: 55,
    right: 20,
    zIndex: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerSlide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  viewerImage: {
    width: "100%",
    height: "75%",
  },
  viewerCounter: {
    position: "absolute",
    bottom: 45,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  viewerCounterText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});