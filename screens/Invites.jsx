import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, Pressable, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

const BLUE = "#4967E8";

export default function InvitesScreen() {
  const router = useRouter();
  const currentUser = auth.currentUser;

  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  // listen for invites and fetch trip details for each one
  useEffect(() => {
    const invitesRef = collection(db, "users", currentUser.uid, "invites");
    return onSnapshot(invitesRef, async (snapshot) => {
      const rawInvites = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      const invitesWithTripData = await Promise.all(rawInvites.map(async (invite) => {
        try {
          const tripDoc = await getDoc(doc(db, "users", invite.tripOwnerId, "trips", invite.tripId));
          return { ...invite, tripData: tripDoc.exists() ? tripDoc.data() : null };
        } catch (_) {
          return { ...invite, tripData: null };
        }
      }));

      setInvites(invitesWithTripData);
      setLoading(false);
    });
  }, []);

  async function acceptInvite(invite) {
    setProcessingId(invite.id);
    try {
      // copy the trip to the current user's trips collection
      if (invite.tripData) {
        await addDoc(collection(db, "users", currentUser.uid, "trips"), {
          ...invite.tripData,
          createdAt: serverTimestamp(),
        });
      }
      // add user to the group chat members list
      await updateDoc(doc(db, "groupchats", invite.chatId), { members: arrayUnion(currentUser.uid) });
      // delete the invite now that it's been handled
      await deleteDoc(doc(db, "users", currentUser.uid, "invites", invite.id));
      router.push({ pathname: "/chat", params: { chatId: invite.chatId } });
    } catch (err) {
      console.error("Error accepting invite:", err);
    } finally {
      setProcessingId(null);
    }
  }

  async function declineInvite(invite) {
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
    return timestamp.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // UI
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      {/* header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.iconButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#1F1F1F" />
        </Pressable>
        <Text style={s.title}>Invites</Text>
        <View style={s.iconButton} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color={BLUE} />
      ) : invites.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="mail-open-outline" size={52} color="#ccc" />
          <Text style={s.emptyText}>No pending invites</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {invites.map((invite) => {
            const isProcessing = processingId === invite.id;
            return (
              <View key={invite.id} style={s.card}>

                {/* who sent the invite */}
                <View style={s.senderRow}>
                  <View style={s.avatar}>
                    <Text style={s.avatarLetter}>{invite.fromUsername?.charAt(0).toUpperCase() || "?"}</Text>
                  </View>
                  <View>
                    <Text style={s.senderLabel}>
                      Invited by <Text style={s.senderName}>{invite.fromUsername}</Text>
                    </Text>
                    <Text style={s.inviteDate}>{formatDate(invite.createdAt)}</Text>
                  </View>
                </View>

                {/* trip details */}
                {invite.tripData ? (
                  <View style={s.tripCard}>
                    <Text style={s.tripLocation}>{invite.tripData.location}</Text>
                    {[
                      { icon: "calendar-outline", text: `${formatDate(invite.tripData.startDate)} → ${formatDate(invite.tripData.endDate)}` },
                      invite.tripData.budget && { icon: "cash-outline", text: `$${invite.tripData.budget}` },
                      invite.tripData.description && { icon: "document-text-outline", text: invite.tripData.description },
                      { icon: "people-outline", text: invite.tripData.withGroup ? "Group trip" : "Solo trip" },
                    ].filter(Boolean).map(({ icon, text }) => (
                      <View key={icon} style={s.detailRow}>
                        <Ionicons name={icon} size={14} color="#888" />
                        <Text style={s.detailText}>{text}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={s.noTripText}>Trip details unavailable</Text>
                )}

                {/* accept / decline buttons */}
                <View style={s.buttonRow}>
                  <TouchableOpacity style={s.declineButton} onPress={() => declineInvite(invite)} disabled={isProcessing}>
                    {isProcessing ? <ActivityIndicator size="small" color="#888" /> : <Text style={s.declineText}>Decline</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.acceptButton} onPress={() => acceptInvite(invite)} disabled={isProcessing}>
                    {isProcessing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.acceptText}>Accept</Text>}
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
  safe: { flex: 1, backgroundColor: "#F7F7F7" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: "#F7F7F7" },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#1F1F1F" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 16, color: "#aaa" },
  list: { padding: 16, gap: 14 },
  card: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#DADADA", padding: 16 },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E0E5FF", alignItems: "center", justifyContent: "center" },
  avatarLetter: { fontSize: 16, fontWeight: "700", color: BLUE },
  senderLabel: { fontSize: 14, color: "#555" },
  senderName: { fontWeight: "700", color: "#1F1F1F" },
  inviteDate: { fontSize: 12, color: "#aaa", marginTop: 2 },
  tripCard: { backgroundColor: "#F7F7F7", borderRadius: 10, padding: 12, gap: 6, marginBottom: 14 },
  tripLocation: { fontSize: 17, fontWeight: "700", color: "#1F1F1F", marginBottom: 6 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 13, color: "#555", flex: 1 },
  noTripText: { fontSize: 13, color: "#aaa", marginBottom: 14 },
  buttonRow: { flexDirection: "row", gap: 10 },
  declineButton: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: "#DADADA", alignItems: "center", justifyContent: "center" },
  declineText: { fontSize: 15, fontWeight: "600", color: "#888" },
  acceptButton: { flex: 1, height: 44, borderRadius: 10, backgroundColor: BLUE, alignItems: "center", justifyContent: "center" },
  acceptText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});