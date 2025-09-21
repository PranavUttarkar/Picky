import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/services/supabase";
import { useThemeColors } from "@/theme/ThemeProvider";

export default function Welcome() {
  const c = useThemeColors();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setError(null);
    if (!email.endsWith("@tamu.edu")) {
      setError("Please use your TAMU email (@tamu.edu)");
      return;
    }
    setLoading(true);
    const password = "picky-tamu"; // dev password to avoid email confirmation
    // 1) Try sign-in
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });
    if (!signInError && signInData.session) {
      setLoading(false);
      router.replace("/onboarding/interests");
      return;
    }
    // 2) If sign-in failed, try to sign up (no email confirm if disabled in project settings)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      { email, password }
    );
    if (!signUpError && signUpData?.session) {
      setLoading(false);
      router.replace("/onboarding/interests");
      return;
    }
    // 3) If user exists or confirmation required, try sign-in again; otherwise show helpful message
    const { data: si2, error: si2Err } = await supabase.auth.signInWithPassword(
      { email, password }
    );
    setLoading(false);
    if (!si2Err && si2.session) {
      router.replace("/onboarding/interests");
    } else {
      setError(
        signUpError?.message ||
          signInError?.message ||
          "Sign-in failed. If email confirmation is enabled in Supabase Auth settings, please disable confirmations for dev, or use an existing account."
      );
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.background,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Text
        style={{
          color: c.text,
          fontSize: 36,
          fontWeight: "800",
          marginBottom: 12,
        }}
      >
        Picky
      </Text>
      <Text style={{ color: c.muted, fontSize: 16, marginBottom: 24 }}>
        Discover events. Decide together.
      </Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        placeholder="yourname@tamu.edu"
        placeholderTextColor={c.muted}
        keyboardType="email-address"
        style={{
          width: "100%",
          padding: 14,
          backgroundColor: c.card,
          color: c.text,
          borderRadius: 12,
          marginBottom: 12,
        }}
      />
      {error && (
        <Text style={{ color: c.accent, marginBottom: 8 }}>{error}</Text>
      )}
      <Pressable
        onPress={signIn}
        disabled={loading}
        style={{
          width: "100%",
          backgroundColor: c.primary,
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#000", fontWeight: "700" }}>
          {loading ? "Signing in…" : "Continue with TAMU email"}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => router.replace("/onboarding/interests")}
        style={{ marginTop: 16 }}
      >
        <Text style={{ color: c.muted }}>Skip for now</Text>
      </Pressable>
    </View>
  );
}
