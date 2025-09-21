import { View, Text, Pressable } from "react-native";
import { useThemeColors } from "@/theme/ThemeProvider";
import { supabase } from "@/services/supabase";

export default function Profile() {
  const c = useThemeColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.background, padding: 16 }}>
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
    </View>
  );
}
