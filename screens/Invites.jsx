import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

import {
    addDoc,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    serverTimestamp,
    updateDoc
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const BLUE = "#4967E8";
const TEXT = "#1F1F1F";
const BORDER = "#DADADA";
const BG = "#F7F7F7";

export default function InvitesScreen() {
  const router = useRouter();
  const currentUser = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState([]);
  const [processing, setProcessing] = useState(null);

  // Real-time invites listener
  useEffect(() => {
    if (!currentUser) return;

    const invitesRef = collection(db, "users", currentUser.uid, "invites");
    const unsubscribe = onSnapshot(invitesRef, async (snapshot) => {
      const raw = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // For each invite, fetch the trip details from the sender's trips
      const enriched = await Promise.all(
        raw.map(async (invite) => {
          try {
            const tripDoc = await getDoc(
              doc(db, "users", invite.tripOwnerId, "trips", invite.tripId)
            );
            const tripData = tripDoc.exists() ? tripDoc.data() : null;
            return { ...invite, tripData };
          } catch (_) {
            return { ...invite, tripData: null };
          }
        })
      );

      setInvites(enriched);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAccept = async (invite) => {
    setProcessing(invite.id);
    try {
      // 1. Copy the trip to the current user's trips collection
      if (invite.tripData) {
        await addDoc(collection(db, "users", currentUser.uid, "trips"), {
          ...invite.tripData,
          createdAt: serverTimestamp(),
        });
      }

      // 2. Add current user's UID to the groupchat members array
      await updateDoc(doc(db, "groupchats", invite.chatId), {
        members: arrayUnion(currentUser.uid),
      });

      // 3. Delete the invite
      await deleteDoc(doc(db, "users", currentUser.uid, "invites", invite.id));

      // 4. Navigate to the groupchat
      router.push({ pathname: "/chat", params: { chatId: invite.chatId } });
    } catch (e) {
      console.error("Error accepting invite:", e);
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (invite) => {
    setProcessing(invite.id);
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "invites", invite.id));
    } catch (e) {
      console.error("Error declining invite:", e);
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return "";
    if (typeof ts === "object" && ts.toDate) {
      return ts.toDate().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    return "";
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={TEXT} />
        </Pressable>
        <Text style={styles.title}>Invites</Text>
        <View style={styles.iconButton} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color={BLUE} />
      ) : invites.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="mail-open-outline" size={52} color="#ccc" />
          <Text style={styles.emptyText}>No pending invites</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {invites.map((invite) => (
            <View key={invite.id} style={styles.card}>
              {/* From */}
              <View style={styles.cardHeader}>
                <View style={styles.fromAvatar}>
                  <Text style={styles.fromAvatarText}>
                    {invite.fromUsername?.charAt(0).toUpperCase() || "?"}
                  </Text>
                </View>
                <View>
                  <Text style={styles.fromLabel}>
                    Invited by{" "}
                    <Text style={styles.fromUsername}>{invite.fromUsername}</Text>
                  </Text>
                  <Text style={styles.inviteDate}>{formatDate(invite.createdAt)}</Text>
                </View>
              </View>

              {/* Trip details */}
              {invite.tripData ? (
                <View style={styles.tripDetails}>
                  <Text style={styles.tripLocation}>{invite.tripData.location}</Text>

                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={14} color="#888" />
                    <Text style={styles.detailText}>
                      {formatDate(invite.tripData.startDate)} →{" "}
                      {formatDate(invite.tripData.endDate)}
                    </Text>
                  </View>

                  {invite.tripData.budget ? (
                    <View style={styles.detailRow}>
                      <Ionicons name="cash-outline" size={14} color="#888" />
                      <Text style={styles.detailText}>${invite.tripData.budget}</Text>
                    </View>
                  ) : null}

                  {invite.tripData.description ? (
                    <View style={styles.detailRow}>
                      <Ionicons name="document-text-outline" size={14} color="#888" />
                      <Text style={styles.detailText}>{invite.tripData.description}</Text>
                    </View>
                  ) : null}

                  <View style={styles.detailRow}>
                    <Ionicons name="people-outline" size={14} color="#888" />
                    <Text style={styles.detailText}>
                      {invite.tripData.withGroup ? "Group trip" : "Solo trip"}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.noTripText}>Trip details unavailable</Text>
              )}

              {/* Accept / Decline */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={() => handleDecline(invite)}
                  disabled={processing === invite.id}
                >
                  {processing === invite.id ? (
                    <ActivityIndicator size="small" color="#888" />
                  ) : (
                    <Text style={styles.declineBtnText}>Decline</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => handleAccept(invite)}
                  disabled={processing === invite.id}
                >
                  {processing === invite.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: BG,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT,
  },

  // Empty
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: "#aaa",
  },

  // List
  list: {
    padding: 16,
    gap: 14,
  },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  fromAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E0E5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  fromAvatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: BLUE,
  },
  fromLabel: {
    fontSize: 14,
    color: "#555",
  },
  fromUsername: {
    fontWeight: "700",
    color: TEXT,
  },
  inviteDate: {
    fontSize: 12,
    color: "#aaa",
    marginTop: 2,
  },

  // Trip details
  tripDetails: {
    backgroundColor: BG,
    borderRadius: 10,
    padding: 12,
    gap: 6,
    marginBottom: 14,
  },
  tripLocation: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: "#555",
    flex: 1,
  },
  noTripText: {
    fontSize: 13,
    color: "#aaa",
    marginBottom: 14,
  },

  // Buttons
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  declineBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#888",
  },
  acceptBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});