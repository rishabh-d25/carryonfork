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
  where
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const BLUE = "#4967E8";
const TEXT = "#1F1F1F";
const BORDER = "#DADADA";

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

  // Search modal state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(null);

  const flatListRef = useRef(null);

  // Load chat metadata
  useEffect(() => {
    const loadChatData = async () => {
      try {
        const chatDoc = await getDoc(doc(db, "groupchats", chatId));
        if (!chatDoc.exists()) return;

        const chatData = chatDoc.data();
        const fetchedTripId = chatData.tripId;
        const memberUids = chatData.members || [];
        setTripId(fetchedTripId);

        // Find the trip doc by checking each member
        let foundLocation = "Group Trip";
        let foundTripData = null;
        let foundOwnerId = null;
        for (const uid of memberUids) {
          try {
            const tripDoc = await getDoc(doc(db, "users", uid, "trips", fetchedTripId));
            if (tripDoc.exists()) {
              foundLocation = tripDoc.data().location || "Group Trip";
              foundTripData = tripDoc.data();
              foundOwnerId = uid;
              break;
            }
          } catch (_) {}
        }
        setTripLocation(foundLocation);
        setTripData(foundTripData);
        setTripOwnerId(foundOwnerId);

        // Get member usernames
        const memberData = await Promise.all(
          memberUids.map(async (uid) => {
            try {
              const userDoc = await getDoc(doc(db, "users", uid));
              return {
                uid,
                username: userDoc.exists() ? userDoc.data().username || "Unknown" : "Unknown",
              };
            } catch (_) {
              return { uid, username: "Unknown" };
            }
          })
        );
        setMembers(memberData);
      } catch (e) {
        console.error("Error loading chat data:", e);
      } finally {
        setLoading(false);
      }
    };

    if (chatId) loadChatData();
  }, [chatId]);

  // Real-time messages listener
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

  // Search users by username
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
        .filter((u) => u.uid !== currentUser.uid) // exclude self
        .filter((u) => !members.find((m) => m.uid === u.uid)); // exclude existing members
      setSearchResults(results);
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setSearching(false);
    }
  };

  // Send invite to a user
  const handleSendInvite = async (targetUser) => {
    if (!tripData || !tripId) return;
    setSendingInvite(targetUser.uid);
    try {
      // Get current user's username
      const currentUserDoc = await getDoc(doc(db, "users", currentUser.uid));
      const currentUsername = currentUserDoc.data()?.username || "Someone";

      // Write invite to target user's invites subcollection
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
      d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      ", " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
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
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Header */}
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
          {/* Add member button */}
          <Pressable
            onPress={() => setShowSearch(true)}
            style={styles.iconButton}
            hitSlop={8}
          >
            <Ionicons name="person-add-outline" size={22} color={BLUE} />
          </Pressable>
        </View>

        {/* Messages */}
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

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor="#aaa"
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

      {/* Add Member Modal */}
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

            {/* Search bar */}
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by username"
                placeholderTextColor="#aaa"
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

            {/* Results */}
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
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
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
    color: "#888",
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
    color: "#aaa",
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
    backgroundColor: "#E0E5FF",
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
    color: "#888",
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
    backgroundColor: "#F0F0F0",
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
    backgroundColor: "#fff",
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
    backgroundColor: "#fafafa",
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
    backgroundColor: "#c0c0c0",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 300,
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
    backgroundColor: "#fafafa",
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
    color: "#aaa",
    fontSize: 14,
    marginTop: 12,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 12,
  },
  resultAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E0E5FF",
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