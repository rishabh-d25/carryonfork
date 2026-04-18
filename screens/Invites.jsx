import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
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

    return onSnapshot(invitesRef, async (snapshot) => {
      const rawInvites = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      const invitesWithTripData = await Promise.all(
        rawInvites.map(async (invite) => {
          const tripOwnerId = getInviteOwnerId(invite);
          const tripId = getInviteTripId(invite);

          if (!tripOwnerId || !tripId) {
            return {
              ...invite,
              tripOwnerId,
              tripId,
              tripData: null,
            };
          }

          try {
            const tripRef = doc(db, "users", tripOwnerId, "trips", tripId);
            const tripDocSnap = await getDoc(tripRef);

            return {
              ...invite,
              tripOwnerId,
              tripId,
              tripData: tripDocSnap.exists() ? tripDocSnap.data() : null,
            };
          } catch (error) {
            console.log("Error loading invite trip:", error);
            return {
              ...invite,
              tripOwnerId,
              tripId,
              tripData: null,
            };
          }
        })
      );

      setInvites(invitesWithTripData);
      setLoading(false);
    });
  }, [currentUser]);

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
      const ownerTripSnap = await getDoc(ownerTripRef);

      if (!ownerTripSnap.exists()) {
        throw new Error("Trip no longer exists.");
      }

      const ownerTripData = ownerTripSnap.data() || {};

      const mergedAllowedUsers = Array.from(
        new Set([
          ...(Array.isArray(ownerTripData.allowedUsers)
            ? ownerTripData.allowedUsers
            : []),
          currentUser.uid,
        ])
      );

      const mergedMemberIds = Array.from(
        new Set([
          ...(Array.isArray(ownerTripData.memberIds)
            ? ownerTripData.memberIds
            : []),
          currentUser.uid,
        ])
      );

      const mergedSharedWith = Array.from(
        new Set([
          ...(Array.isArray(ownerTripData.sharedWith)
            ? ownerTripData.sharedWith
            : []),
          currentUser.uid,
        ])
      );

      // 1) Update the OWNER'S real trip so this user is a member of the shared source trip
      await updateDoc(ownerTripRef, {
        allowedUsers: arrayUnion(currentUser.uid),
        memberIds: arrayUnion(currentUser.uid),
        sharedWith: arrayUnion(currentUser.uid),
        withGroup: true,
        updatedAt: serverTimestamp(),
      });

      // 2) Create a POINTER trip doc in the invited user's account
      //    IMPORTANT: use the SAME tripId so navigation stays consistent
      const invitedUserTripRef = doc(db, "users", currentUser.uid, "trips", tripId);

      await setDoc(
        invitedUserTripRef,
        {
          ...ownerTripData,
          id: tripId,

          // shared trip markers
          isSharedTrip: true,
          acceptedFromInvite: true,
          withGroup: true,

          // source of truth
          tripOwnerId,
          ownerId: tripOwnerId,
          originalTripId: tripId,
          sharedTripId: tripId,
          sharedTripOwnerId: tripOwnerId,
          sourceTripId: tripId,
          sourceTripOwnerId: tripOwnerId,

          // keep member lists in sync locally too
          allowedUsers: mergedAllowedUsers,
          memberIds: mergedMemberIds,
          sharedWith: mergedSharedWith,

          // timestamps
          updatedAt: serverTimestamp(),
          acceptedAt: serverTimestamp(),
          createdAt: ownerTripData.createdAt || serverTimestamp(),
        },
        { merge: true }
      );

      if (invite.chatId) {
        await updateDoc(doc(db, "groupchats", invite.chatId), {
          members: arrayUnion(currentUser.uid),
        });
      }

      await deleteDoc(doc(db, "users", currentUser.uid, "invites", invite.id));

      router.push({
        pathname: "/tripitinerary",
        params: {
          tripId: String(tripId),
          sourceTripId: String(tripId),
          sourceTripOwnerId: String(tripOwnerId),
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
    if (!timestamp?.toDate) return "";
    return timestamp.toDate().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getFallbackLocation(invite) {
    return (
      invite.tripData?.location ||
      invite.location ||
      invite.tripLocation ||
      invite.tripName ||
      invite.tripTitle ||
      "Trip"
    );
  }

  function getFallbackDescription(invite) {
    return (
      invite.tripData?.description ||
      invite.description ||
      invite.tripDescription ||
      ""
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.iconButton} hitSlop={8}>
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
                      Invited by{" "}
                      <Text style={s.senderName}>
                        {invite.fromUsername || "Someone"}
                      </Text>
                    </Text>
                    <Text style={s.inviteDate}>{formatDate(invite.createdAt)}</Text>
                  </View>
                </View>

                <View style={s.tripCard}>
                  <Text style={s.tripLocation}>{getFallbackLocation(invite)}</Text>

                  {invite.tripData ? (
                    <>
                      {[
                        {
                          icon: "calendar-outline",
                          text: `${formatDate(invite.tripData.startDate)} → ${formatDate(invite.tripData.endDate)}`,
                        },
                        invite.tripData.budget && {
                          icon: "cash-outline",
                          text: `$${invite.tripData.budget}`,
                        },
                        invite.tripData.description && {
                          icon: "document-text-outline",
                          text: invite.tripData.description,
                        },
                        {
                          icon: "people-outline",
                          text: invite.tripData.withGroup ? "Group trip" : "Solo trip",
                        },
                      ]
                        .filter(Boolean)
                        .map(({ icon, text }) => (
                          <View key={`${icon}-${text}`} style={s.detailRow}>
                            <Ionicons name={icon} size={14} color={MUTED} />
                            <Text style={s.detailText}>{text}</Text>
                          </View>
                        ))}
                    </>
                  ) : (
                    <>
                      {!!getFallbackDescription(invite) && (
                        <View style={s.detailRow}>
                          <Ionicons
                            name="document-text-outline"
                            size={14}
                            color={MUTED}
                          />
                          <Text style={s.detailText}>{getFallbackDescription(invite)}</Text>
                        </View>
                      )}
                      <Text style={s.noTripText}>Trip details unavailable</Text>
                    </>
                  )}
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

  noTripText: {
    fontSize: 13,
    color: MUTED,
    marginTop: 2,
    fontStyle: "italic",
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