import { View, Text, Pressable } from "react-native";
import { useTheme, useThemeColors } from "@/theme/ThemeProvider";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "@/services/supabase";
import { useEffect } from "react";
import { router } from "expo-router";

export default function Profile() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) router.replace("/onboarding/welcome");
    })();
  }, []);
  const Container: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    scheme === "light" ? (
      <LinearGradient
        colors={["#e9fdf5", "#f9fafb"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, padding: 16 }}>{children}</View>
      </LinearGradient>
    ) : (
      <View style={{ flex: 1, backgroundColor: c.background, padding: 16 }}>{children}</View>
    );

  return (
    <Container>
      <Text
        style={{
          color: c.text,
          fontWeight: "800",
          fontSize: 22,
          marginBottom: 12,
        }}
      >
        Your Profile
      </Text>
      <Pressable
        onPress={() => supabase.auth.signOut()}
        style={{
          backgroundColor: c.primary,
          padding: 12,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#000", fontWeight: "700" }}>Sign out</Text>
      </Pressable>
    </Container>
  );
}
