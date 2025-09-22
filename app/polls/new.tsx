import { View, Text } from "react-native";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useEffect } from "react";
import { supabase } from "@/services/supabase";
import { router } from "expo-router";

export default function NewPoll() {
  const c = useThemeColors();
  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) router.replace("/onboarding/welcome");
    })();
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: c.background, padding: 16 }}>
      <Text style={{ color: c.text }}>Poll creation coming soon.</Text>
    </View>
  );
}
