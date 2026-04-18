// screens/Auth.jsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
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

import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const BLUE = "#3F63F3";

export default function Auth() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const onSignUpPress = async () => {
    try {
      const userinfo = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = userinfo.user.uid;

      await setDoc(doc(db, "users", uid), {
        username: username.trim(),
        email: email.trim(),
      });

      Alert.alert("Success! Welcome to CarryOn!");
      router.push("/dashboard");
    } catch (e) {
      Alert.alert("Sign up error", e.message);
    }
  };

  const onBack = () => router.back();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <Pressable onPress={onBack} style={styles.iconButton} hitSlop={8}>
        <Ionicons name="chevron-back" size={24} color="#111827" />
      </Pressable>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <View style={styles.brandWrap}>
            <Text style={styles.brand}>CARRY ON</Text>
            <Text style={styles.tagline}>PLAN. PACK. GO.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.h1}>Create an account</Text>
            <Text style={styles.sub}>Enter your details to sign up for this app</Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="email@domain.com"
              placeholderTextColor="rgba(17,24,39,0.35)"
              style={styles.input}
            />

            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor="rgba(17,24,39,0.35)"
              style={styles.input}
            />

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="rgba(17,24,39,0.35)"
              secureTextEntry
              style={styles.input}
            />

            <View style={styles.btnRow}>
              <TouchableOpacity onPress={onSignUpPress} style={styles.btn} activeOpacity={0.9}>
                <Text style={styles.btnText}>SIGN UP</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#DCE6FF", // 👈 match app background
  },

  flex: {
    flex: 1,
  },

  container: {
    flex: 1,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#C9D7FF", // 👈 match other screens
    borderWidth: 1,
    borderColor: "#B4C6FF",
  },

  brandWrap: {
    alignItems: "center",
    marginBottom: 18,
  },

  brand: {
    fontSize: 40,
    letterSpacing: 2,
    color: "#3F63F3",
    fontWeight: "700",
  },

  tagline: {
    marginTop: 6,
    fontSize: 12,
    letterSpacing: 2,
    color: "#3F63F3",
    fontWeight: "500",
  },

  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#D4DEFF", // 👈 key change
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "#B4C6FF",

    // 👇 subtle depth (optional but makes it look MUCH better)
    shadowColor: "#3F63F3",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  h1: {
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: "#1F2937",
  },

  sub: {
    marginTop: 6,
    marginBottom: 14,
    textAlign: "center",
    fontSize: 13,
    color: "#4B5563",
  },

  input: {
    width: "100%",
    height: 46,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#9FB2FF",
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#1F2937",
    backgroundColor: "#EEF2FF", // 👈 soft fill
    marginBottom: 10,
  },

  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    justifyContent: "center",
  },

  btn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#5A75F5", // 👈 consistent button color
    alignItems: "center",
    justifyContent: "center",
  },

  btnText: {
    color: "#ffffff",
    fontWeight: "700",
    letterSpacing: 0.8,
    fontSize: 13,
  },

  legal: {
    marginTop: 14,
    textAlign: "center",
    fontSize: 10,
    lineHeight: 14,
    color: "#6B7280",
  },

  link: {
    color: "#3F63F3",
    fontWeight: "700",
  },
});