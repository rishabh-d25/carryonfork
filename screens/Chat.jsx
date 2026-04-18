import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const BLUE = "#3F63F3";
const BG = "#DCE6FF";
const CARD = "#D4DEFF";
const CARD_ALT = "#C9D7FF";
const BORDER = "#B4C6FF";
const TEXT = "#1F2937";
const MUTED = "#6B7280";

function uniqueUids(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

export default function GroupChatScreen() {
  const router = useRouter();
  const { chatId } = useLocalSearchParams();
  const currentUser = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [tripLocation, setTripLocation] = useState("");
  const [tripData, setTripData] = useState(null);
  const [tripOwnerId, setTripOwnerId] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(null);

  const flatListRef = useRef(null);

  useEffect(() => {
    const loadChatData = async () => {
      try {
        const chatSnap = await getDoc(doc(db, "groupchats", chatId));
        if (!chatSnap.exists()) {
          setLoading(false);
          return;
        }

        const chatData = chatSnap.data();
        const fetchedTripId = chatData.tripId;
        const chatMemberUids = Array.isArray(chatData.members) ? chatData.members : [];
        setTripId(fetchedTripId);

        let sourceTripData = null;
        let sourceTripOwnerId = null;
        let sourceTripId = fetchedTripId;

        // 1) First try current user's trip copy
        if (currentUser?.uid && fetchedTripId) {
          try {
            const myTripSnap = await getDoc(
              doc(db, "users", currentUser.uid, "trips", fetchedTripId)
            );

            if (myTripSnap.exists()) {
              const myTrip = myTripSnap.data();

              if (myTrip.isSharedTrip && myTrip.sharedTripOwnerId && myTrip.sharedTripId) {
                sourceTripOwnerId = myTrip.sharedTripOwnerId;
                sourceTripId = myTrip.sharedTripId;

                const ownerTripSnap = await getDoc(
                  doc(db, "users", sourceTripOwnerId, "trips", sourceTripId)
                );

                if (ownerTripSnap.exists()) {
                  sourceTripData = ownerTripSnap.data();
                } else {
                  sourceTripData = myTrip;
                  sourceTripOwnerId = myTrip.tripOwnerId || currentUser.uid;
                }
              } else {
                sourceTripData = myTrip;
                sourceTripOwnerId = currentUser.uid;
              }
            }
          } catch (e) {
            console.log("Error loading current user's trip copy:", e);
          }
        }

        // 2) Fallback: search chat members' trip docs
        if (!sourceTripData) {
          for (const uid of chatMemberUids) {
            try {
              const tripSnap = await getDoc(doc(db, "users", uid, "trips", fetchedTripId));
              if (tripSnap.exists()) {
                const foundTrip = tripSnap.data();
                sourceTripData = foundTrip;
                sourceTripOwnerId =
                  foundTrip.sharedTripOwnerId ||
                  foundTrip.tripOwnerId ||
                  uid;
                sourceTripId =
                  foundTrip.sharedTripId ||
                  foundTrip.originalTripId ||
                  fetchedTripId;
                break;
              }
            } catch (_) {}
          }
        }

        setTripData(sourceTripData);
        setTripOwnerId(sourceTripOwnerId);
        setTripLocation(sourceTripData?.location || "Group Trip");

        const participantUids = uniqueUids([
          ...chatMemberUids,
          ...(Array.isArray(sourceTripData?.memberIds) ? sourceTripData.memberIds : []),
          ...(Array.isArray(sourceTripData?.allowedUsers) ? sourceTripData.allowedUsers : []),
          ...(Array.isArray(sourceTripData?.sharedWith) ? sourceTripData.sharedWith : []),
          sourceTripOwnerId,
        ]);

        const memberData = await Promise.all(
          participantUids.map(async (uid) => {
            try {
              const userDoc = await getDoc(doc(db, "users", uid));
              return {
                uid,
                username: userDoc.exists()
                  ? userDoc.data().username || "Unknown"
                  : "Unknown",
              };
            } catch (_) {
              return { uid, username: "Unknown" };
            }
          })
        );

        setMembers(memberData);

        // Optional sync so chat doc also keeps all trip participants
        const missingFromChat = participantUids.filter((uid) => !chatMemberUids.includes(uid));
        if (missingFromChat.length > 0) {
          try {
            await updateDoc(doc(db, "groupchats", chatId), {
              members: participantUids,
            });
          } catch (e) {
            console.log("Could not sync chat members:", e);
          }
        }
      } catch (e) {
        console.error("Error loading chat data:", e);
      } finally {
        setLoading(false);
      }
    };

    if (chatId) loadChatData();
  }, [chatId, currentUser?.uid]);

  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "groupchats", chatId, "messages"),
      orderBy("sentAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(fetched);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => unsubscribe();
  }, [chatId]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !currentUser) return;
    setInputText("");
    try {
      await addDoc(collection(db, "groupchats", chatId, "messages"), {
        text,
        senderId: currentUser.uid,
        sentAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Error sending message:", e);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const q = query(
        collection(db, "users"),
        where("username", "==", searchQuery.trim())
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .filter((u) => u.uid !== currentUser?.uid)
        .filter((u) => !members.find((m) => m.uid === u.uid));
      setSearchResults(results);
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setSearching(false);
    }
  };

  const handleSendInvite = async (targetUser) => {
    if (!tripData || !tripId || !currentUser) return;
    setSendingInvite(targetUser.uid);
    try {
      const currentUserDoc = await getDoc(doc(db, "users", currentUser.uid));
      const currentUsername = currentUserDoc.data()?.username || "Someone";

      await addDoc(collection(db, "users", targetUser.uid, "invites"), {
        tripId,
        chatId,
        fromUid: currentUser.uid,
        fromUsername: currentUsername,
        tripOwnerId: tripOwnerId,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setSearchResults((prev) => prev.filter((u) => u.uid !== targetUser.uid));
      setSearchQuery("");
    } catch (e) {
      console.error("Error sending invite:", e);
    } finally {
      setSendingInvite(null);
    }
  };

  const getUsernameById = (uid) => {
    const member = members.find((m) => m.uid === uid);
    return member ? member.username : "Unknown";
  };

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return "";
    const d = timestamp.toDate();
    return (
      d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      ", " +
      d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    );
  };

  const renderMessage = ({ item, index }) => {
    const isMe = item.senderId === currentUser?.uid;
    const showSender =
      !isMe &&
      (index === 0 || messages[index - 1]?.senderId !== item.senderId);
    const showTimestamp =
      index === 0 ||
      (item.sentAt &&
        messages[index - 1]?.sentAt &&
        item.sentAt.toDate() - messages[index - 1].sentAt.toDate() > 5 * 60 * 1000);

    return (
      <View>
        {showTimestamp && item.sentAt && (
          <Text style={styles.timestamp}>{formatTime(item.sentAt)}</Text>
        )}
        <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
          {!isMe && (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getUsernameById(item.senderId).charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.bubbleWrap}>
            {showSender && (
              <Text style={styles.senderName}>{getUsernameById(item.senderId)}</Text>
            )}
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
              <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
                {item.text}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color={BLUE} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={TEXT} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{tripLocation}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {members.map((m) => m.username).join(", ")}
            </Text>
          </View>

          <Pressable
            onPress={() => setShowSearch(true)}
            style={styles.iconButton}
            hitSlop={8}
          >
            <Ionicons name="person-add-outline" size={22} color={BLUE} />
          </Pressable>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor="#94A3B8"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showSearch} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Member</Text>
              <Pressable
                onPress={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                <Ionicons name="close" size={24} color={TEXT} />
              </Pressable>
            </View>

            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by username"
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
                {searching ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="search" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            {searchResults.length === 0 && !searching && searchQuery.trim() !== "" && (
              <Text style={styles.noResults}>No users found</Text>
            )}

            {searchResults.map((user) => (
              <View key={user.uid} style={styles.resultRow}>
                <View style={styles.resultAvatar}>
                  <Text style={styles.resultAvatarText}>
                    {user.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.resultUsername}>{user.username}</Text>
                <TouchableOpacity
                  style={styles.inviteBtn}
                  onPress={() => handleSendInvite(user)}
                  disabled={sendingInvite === user.uid}
                >
                  {sendingInvite === user.uid ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.inviteBtnText}>Invite</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: BG,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: CARD_ALT,
    borderWidth: 1,
    borderColor: BORDER,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT,
  },
  headerSubtitle: {
    fontSize: 12,
    color: MUTED,
    marginTop: 1,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 4,
  },
  timestamp: {
    textAlign: "center",
    fontSize: 12,
    color: MUTED,
    marginVertical: 10,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 4,
    gap: 8,
  },
  messageRowMe: {
    flexDirection: "row-reverse",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CARD_ALT,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: BLUE,
  },
  bubbleWrap: {
    maxWidth: "72%",
  },
  senderName: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 3,
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  bubbleMe: {
    backgroundColor: BLUE,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    color: TEXT,
    lineHeight: 21,
  },
  bubbleTextMe: {
    color: "#fff",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    gap: 10,
    backgroundColor: BG,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: TEXT,
    maxHeight: 100,
    backgroundColor: CARD,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#A5B4FC",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 300,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: BORDER,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: TEXT,
    backgroundColor: CARD,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  noResults: {
    textAlign: "center",
    color: MUTED,
    fontSize: 14,
    marginTop: 12,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 12,
  },
  resultAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CARD_ALT,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  resultAvatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: BLUE,
  },
  resultUsername: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: TEXT,
  },
  inviteBtn: {
    backgroundColor: BLUE,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: "center",
  },
  inviteBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});