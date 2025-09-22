import { Tabs, usePathname } from "expo-router";
import { useTheme, useThemeColors } from "@/theme/ThemeProvider";
import { View, Text, Pressable, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as Clipboard from "expo-clipboard";
import { Share } from "react-native";

export default function TabsLayout() {
  const c = useThemeColors();
  const { toggleScheme, scheme } = useTheme();
  const pathname = usePathname();

  const HeaderTitle = () => (
    <Text
      style={{
        color: c.text,
        fontSize: 24,
        fontWeight: "900",
        // Use custom font if loaded globally
        // @ts-ignore - font may be loaded under this name
        fontFamily: "Pacifico_400Regular",
      }}
    >
      Picky!
    </Text>
  );

  const onShare = async () => {
    try {
      const url = Linking.createURL(pathname || "/");
      // Try clipboard first
      try {
        await Clipboard.setStringAsync(url);
        Alert.alert("Link copied", "Share this Picky link with friends.");
        return;
      } catch {}
      // Fallback: open native share sheet
      await Share.share({ message: url, url });
    } catch (e) {
      Alert.alert("Could not copy link");
    }
  };

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.background },
        headerTitle: () => <HeaderTitle />,
        headerTitleAlign: "left",
        headerRight: () => (
          <View style={{ flexDirection: "row", gap: 12, marginRight: 8 }}>
            <Pressable onPress={toggleScheme} hitSlop={8}>
              <Ionicons
                name={scheme === "dark" ? "moon" : "sunny"}
                size={22}
                color={c.text}
              />
            </Pressable>
            <Pressable onPress={onShare} hitSlop={8}>
              <Ionicons name="share-social-outline" size={22} color={c.text} />
            </Pressable>
          </View>
        ),
        tabBarStyle: { backgroundColor: c.card, borderTopColor: "transparent" },
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: "",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bookmark" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
