import { View, Text } from "react-native";
import { useThemeColors } from "@/theme/ThemeProvider";

export default function PollDetails() {
  const c = useThemeColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.background, padding: 16 }}>
      <Text style={{ color: c.text }}>Poll details coming soon.</Text>
    </View>
  );
}
