import { Tabs } from "expo-router";
import { useThemeColors } from "@/theme/ThemeProvider";
import { View, Text } from "react-native";

export default function TabsLayout() {
  const c = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.background },
        headerTitleStyle: { color: c.text },
        tabBarStyle: { backgroundColor: c.card, borderTopColor: "transparent" },
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="groups" options={{ title: "Groups" }} />
      <Tabs.Screen name="saved" options={{ title: "Saved" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
