// screens/Auth.jsx
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebaseConfig";



export default function Auth() {
  const router = useRouter();

  const [email, setEmail] = useState("");
   
  const [password, setPassword] = useState("");


const onLogIn = async () => {
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password);
    console.log("Logged in!");
  } catch (e) {
    console.log("Log in error:", e.message);
  }

  router.push("/dashboard")
};

const onSignUp = async () => {
  router.push("/signup")
};


  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          {/* Logo / Title */}
          <View style={styles.brandWrap}>
            <Text style={styles.brand}>CARRY ON</Text>
            <Text style={styles.tagline}>PLAN. PACK. GO.</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.h1}>Welcome!</Text>
            <Text style={styles.sub}>We can't wait to help plan your travels!</Text>

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
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="rgba(17,24,39,0.35)"
              secureTextEntry
              style={styles.input}
            />

            <View style={styles.btnRow}>

              <TouchableOpacity onPress={onLogIn} style={styles.btn} activeOpacity={0.9}>
                <Text style={styles.btnText}>Log In</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={onSignUp} style={styles.btn} activeOpacity={0.9}>
                <Text style={styles.btnText}>Sign up!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const BLUE = "#3F63F3";

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
    backgroundColor: "#D4DEFF", // 👈 same card color as other screens
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "#B4C6FF",
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
    backgroundColor: "#EEF2FF", // 👈 soft input fill
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
