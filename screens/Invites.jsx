import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

const BLUE = "#3F63F3";
const BG = "#DCE6FF";
const CARD = "#D4DEFF";
const CARD_ALT = "#C9D7FF";
const BORDER = "#B4C6FF";
const TEXT = "#1F2937";
const MUTED = "#6B7280";

function getInviteOwnerId(invite) {
  return (
    invite.tripOwnerId ||
    invite.ownerId ||
    invite.fromUid ||
    invite.fromUserId ||
    ""
  );
}

function getInviteTripId(invite) {
  return (
    invite.tripId ||
    invite.originalTripId ||
    invite.sharedTripId ||
    invite.tripDocId ||
    ""
  );
}

function formatLocation(value) {
  if (!value) return "Trip";
  if (typeof value === "string") return value;

  if (typeof value === "object") {
    return [value.city, value.state, value.country, value.name]
      .filter(Boolean)
      .join(", ");
  }

  return "Trip";
}

function getInviteTitle(invite) {
  return (
    invite.tripData?.title ||
    invite.tripData?.tripTitle ||
    invite.tripData?.tripName ||
    invite.tripData?.name ||
    invite.tripTitle ||
    invite.tripName ||
    invite.title ||
    invite.name ||
    formatLocation(invite.tripData?.location) ||
    formatLocation(invite.location) ||
    formatLocation(invite.tripLocation) ||
    "Trip"
  );
}

function getInviteDescription(invite) {
  const value =
    invite.tripData?.description ||
    invite.description ||
    invite.tripDescription ||
    invite.tripData?.notes ||
    invite.notes ||
    "";

  return typeof value === "string" ? value : "";
}

function getInviteStartDate(invite) {
  return invite.tripData?.startDate || invite.startDate || invite.tripStartDate || null;
}

function getInviteEndDate(invite) {
  return invite.tripData?.endDate || invite.endDate || invite.tripEndDate || null;
}

function getInviteBudget(invite) {
  return invite.tripData?.budget || invite.budget || invite.tripBudget || null;
}

function getInviteWithGroup(invite) {
  if (typeof invite.tripData?.withGroup === "boolean") return invite.tripData.withGroup;
  if (typeof invite.withGroup === "boolean") return invite.withGroup;
  if (typeof invite.isGroupTrip === "boolean") return invite.isGroupTrip;
  return false;
}

function getPreviewTripData(invite) {
  return {
    title: getInviteTitle(invite),
    tripTitle: getInviteTitle(invite),
    tripName: getInviteTitle(invite),
    name: getInviteTitle(invite),
    location: invite.tripData?.location || invite.location || invite.tripLocation || "",
    description: getInviteDescription(invite),
    startDate: getInviteStartDate(invite),
    endDate: getInviteEndDate(invite),
    budget: getInviteBudget(invite),
    withGroup: getInviteWithGroup(invite),
    allowedUsers: Array.isArray(invite.allowedUsers) ? invite.allowedUsers : [],
    memberIds: Array.isArray(invite.memberIds) ? invite.memberIds : [],
    sharedWith: Array.isArray(invite.sharedWith) ? invite.sharedWith : [],
  };
}

export default function InvitesScreen() {
  const router = useRouter();
  const currentUser = auth.currentUser;

  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      setInvites([]);
      setLoading(false);
      return;
    }

    const invitesRef = collection(db, "users", currentUser.uid, "invites");

    return onSnapshot(
      invitesRef,
      async (snapshot) => {
        const rawInvites = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        const invitesWithTripData = await Promise.all(
          rawInvites.map(async (invite) => {
            const tripOwnerId = getInviteOwnerId(invite);
            const tripId = getInviteTripId(invite);
            const previewTripData = getPreviewTripData(invite);

            if (!tripOwnerId || !tripId) {
              return { ...invite, tripOwnerId, tripId, tripData: previewTripData };
            }

            try {
              const tripRef = doc(db, "users", tripOwnerId, "trips", tripId);
              const tripDocSnap = await getDoc(tripRef);

              if (tripDocSnap.exists()) {
                return {
                  ...invite,
                  tripOwnerId,
                  tripId,
                  tripData: {
                    ...previewTripData,
                    ...tripDocSnap.data(),
                  },
                };
              }

              return { ...invite, tripOwnerId, tripId, tripData: previewTripData };
            } catch (error) {
              console.log("Trip preview read blocked or failed, using invite data:", error);
              return { ...invite, tripOwnerId, tripId, tripData: previewTripData };
            }
          })
        );

        setInvites(invitesWithTripData);
        setLoading(false);
      },
      (error) => {
        console.log("Error loading invites:", error);
        setInvites([]);
        setLoading(false);
      }
    );
  }, [currentUser]);

  async function copyItineraryToAcceptedUser(tripOwnerId, tripId, invitedUid) {
    const ownerItemsRef = collection(db, "users", tripOwnerId, "trips", tripId, "itinerary");
    const invitedItemsRef = collection(db, "users", invitedUid, "trips", tripId, "itinerary");

    const ownerItemsSnap = await getDocs(ownerItemsRef);

    const writes = ownerItemsSnap.docs.map((itemDoc) => {
      const newItemRef = doc(invitedItemsRef, itemDoc.id);
      return setDoc(newItemRef, {
        ...itemDoc.data(),
        copiedFromOwnerUid: tripOwnerId,
        copiedAt: serverTimestamp(),
      }, { merge: true });
    });

    await Promise.all(writes);
  }

  async function acceptInvite(invite) {
    if (!currentUser) return;

    const tripOwnerId = getInviteOwnerId(invite);
    const tripId = getInviteTripId(invite);

    if (!tripOwnerId || !tripId) {
      console.log("Missing tripOwnerId or tripId on invite:", invite);
      return;
    }

    setProcessingId(invite.id);

    try {
      const ownerTripRef = doc(db, "users", tripOwnerId, "trips", tripId);

      let ownerTripData = {};
      try {
        const ownerTripSnap = await getDoc(ownerTripRef);
        if (ownerTripSnap.exists()) {
          ownerTripData = ownerTripSnap.data() || {};
        }
      } catch (readError) {
        console.log("Owner trip read blocked before membership update:", readError);
      }

      const previewTripData = getPreviewTripData(invite);
      const baseTripData = {
        ...previewTripData,
        ...ownerTripData,
      };

      await updateDoc(ownerTripRef, {
        allowedUsers: arrayUnion(currentUser.uid),
        memberIds: arrayUnion(currentUser.uid),
        sharedWith: arrayUnion(currentUser.uid),
        withGroup: true,
        updatedAt: serverTimestamp(),
      });

      const mergedAllowedUsers = Array.from(
        new Set([
          ...(Array.isArray(baseTripData.allowedUsers) ? baseTripData.allowedUsers : []),
          currentUser.uid,
        ])
      );

      const mergedMemberIds = Array.from(
        new Set([
          ...(Array.isArray(baseTripData.memberIds) ? baseTripData.memberIds : []),
          currentUser.uid,
        ])
      );

      const mergedSharedWith = Array.from(
        new Set([
          ...(Array.isArray(baseTripData.sharedWith) ? baseTripData.sharedWith : []),
          currentUser.uid,
        ])
      );

      const invitedUserTripRef = doc(db, "users", currentUser.uid, "trips", tripId);

      await setDoc(
        invitedUserTripRef,
        {
          ...baseTripData,
          id: tripId,
          isSharedTrip: true,
          acceptedFromInvite: true,
          withGroup: true,
          tripOwnerId,
          ownerId: tripOwnerId,
          originalTripId: tripId,
          sharedTripId: tripId,
          sharedTripOwnerId: tripOwnerId,
          sourceTripId: tripId,
          sourceTripOwnerId: tripOwnerId,
          allowedUsers: mergedAllowedUsers,
          memberIds: mergedMemberIds,
          sharedWith: mergedSharedWith,
          updatedAt: serverTimestamp(),
          acceptedAt: serverTimestamp(),
          createdAt: baseTripData.createdAt || serverTimestamp(),
        },
        { merge: true }
      );

      await copyItineraryToAcceptedUser(tripOwnerId, tripId, currentUser.uid);

      if (invite.chatId) {
        try {
          await updateDoc(doc(db, "groupchats", invite.chatId), {
            members: arrayUnion(currentUser.uid),
          });
        } catch (chatError) {
          console.log("Group chat update failed:", chatError);
        }
      }

      await deleteDoc(doc(db, "users", currentUser.uid, "invites", invite.id));

      router.replace({
        pathname: "/tripitinerary",
        params: {
          tripId: String(tripId),
          sourceTripId: String(tripId),
          sourceTripOwnerId: String(tripOwnerId),
          title: String(getInviteTitle({ ...invite, tripData: baseTripData })),
        },
      });
    } catch (err) {
      console.error("Error accepting invite:", err);
    } finally {
      setProcessingId(null);
    }
  }

  async function declineInvite(invite) {
    if (!currentUser) return;

    setProcessingId(invite.id);
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "invites", invite.id));
    } catch (err) {
      console.error("Error declining invite:", err);
    } finally {
      setProcessingId(null);
    }
  }

  function formatDate(timestamp) {
    if (!timestamp) return "";

    if (typeof timestamp?.toDate === "function") {
      return timestamp.toDate().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    return "";
  }

  function getFallbackLocation(invite) {
    return (
      formatLocation(invite.tripData?.location) ||
      formatLocation(invite.location) ||
      formatLocation(invite.tripLocation) ||
      invite.tripName ||
      invite.tripTitle ||
      "Trip"
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <View style={s.header}>
        <Pressable
          onPress={() => router.dismissTo("/dashboard")}
          style={s.iconButton}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={TEXT} />
        </Pressable>
        <Text style={s.title}>Invites</Text>
        <View style={s.iconButton} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color={BLUE} />
      ) : invites.length === 0 ? (
        <View style={s.emptyState}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="mail-open-outline" size={42} color={BLUE} />
          </View>
          <Text style={s.emptyText}>No pending invites</Text>
          <Text style={s.emptySubtext}>
            When someone invites you to a trip, it will show up here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {invites.map((invite) => {
            const isProcessing = processingId === invite.id;
            const start = formatDate(getInviteStartDate(invite));
            const end = formatDate(getInviteEndDate(invite));
            const budget = getInviteBudget(invite);
            const description = getInviteDescription(invite);
            const isGroup = getInviteWithGroup(invite);

            return (
              <View key={invite.id} style={s.card}>
                <View style={s.senderRow}>
                  <View style={s.avatar}>
                    <Text style={s.avatarLetter}>
                      {invite.fromUsername?.charAt(0).toUpperCase() || "?"}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={s.senderLabel}>
                      Invited by <Text style={s.senderName}>{invite.fromUsername || "Someone"}</Text>
                    </Text>
                    <Text style={s.inviteDate}>{formatDate(invite.createdAt)}</Text>
                  </View>
                </View>

                <View style={s.tripCard}>
                  <Text style={s.tripLocation}>{getFallbackLocation(invite)}</Text>

                  {!!(start || end) && (
                    <View style={s.detailRow}>
                      <Ionicons name="calendar-outline" size={14} color={MUTED} />
                      <Text style={s.detailText}>
                        {start || "Unknown"} {end ? `→ ${end}` : ""}
                      </Text>
                    </View>
                  )}

                  {!!budget && (
                    <View style={s.detailRow}>
                      <Ionicons name="cash-outline" size={14} color={MUTED} />
                      <Text style={s.detailText}>${budget}</Text>
                    </View>
                  )}

                  {!!description && (
                    <View style={s.detailRow}>
                      <Ionicons name="document-text-outline" size={14} color={MUTED} />
                      <Text style={s.detailText}>{description}</Text>
                    </View>
                  )}

                  <View style={s.detailRow}>
                    <Ionicons name="people-outline" size={14} color={MUTED} />
                    <Text style={s.detailText}>{isGroup ? "Group trip" : "Solo trip"}</Text>
                  </View>
                </View>

                <View style={s.buttonRow}>
                  <TouchableOpacity
                    style={s.declineButton}
                    onPress={() => declineInvite(invite)}
                    disabled={isProcessing}
                    activeOpacity={0.85}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color={MUTED} />
                    ) : (
                      <Text style={s.declineText}>Decline</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.acceptButton}
                    onPress={() => acceptInvite(invite)}
                    disabled={isProcessing}
                    activeOpacity={0.85}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={s.acceptText}>Accept</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: BG,
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
    fontSize: 22,
    fontWeight: "700",
    color: BLUE,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  emptyIconWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: CARD_ALT,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT,
  },
  emptySubtext: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
  },
  list: {
    padding: 16,
    gap: 14,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CARD_ALT,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 17,
    fontWeight: "700",
    color: BLUE,
  },
  senderLabel: {
    fontSize: 14,
    color: MUTED,
  },
  senderName: {
    fontWeight: "700",
    color: TEXT,
  },
  inviteDate: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  tripCard: {
    backgroundColor: CARD_ALT,
    borderRadius: 14,
    padding: 12,
    gap: 7,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tripLocation: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: MUTED,
    flex: 1,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  declineButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_ALT,
    alignItems: "center",
    justifyContent: "center",
  },
  declineText: {
    fontSize: 15,
    fontWeight: "700",
    color: MUTED,
  },
  acceptButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#5A75F5",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3F63F3",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  acceptText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});