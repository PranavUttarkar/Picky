import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { router } from "expo-router";
import { useThemeColors } from "@/theme/ThemeProvider";
import { supabase } from "@/services/supabase";

const DEFAULTS = [
  "Music",
  "Sports",
  "Food",
  "Nightlife",
  "Tech",
  "Volunteering",
  "Art",
  "Career",
  "Gaming",
  "Outdoors",
  "Culture",
  "Wellness",
];

export default function Interests() {
  const c = useThemeColors();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggle = (name: string) => {
    setSelected((s) =>
      s.includes(name) ? s.filter((i) => i !== name) : [...s, name]
    );
  };

  const save = async () => {
    if (selected.length < 2) return;
    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;
    if (user) {
      await supabase
        .from("user_interests_temp")
        .upsert({ user_id: user.id, names: selected });
    }
    setSaving(false);
    router.replace("/onboarding/group");
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background, padding: 16 }}>
      <Text
        style={{
          color: c.text,
          fontSize: 24,
          fontWeight: "800",
          marginBottom: 8,
        }}
      >
        Pick your interests
      </Text>
      <Text style={{ color: c.muted, marginBottom: 16 }}>
        Choose at least 2 to personalize your feed.
      </Text>
      <FlatList
        data={DEFAULTS}
        numColumns={3}
        columnWrapperStyle={{ gap: 8 }}
        contentContainerStyle={{ gap: 8 }}
        keyExtractor={(i) => i}
        renderItem={({ item }) => {
          const active = selected.includes(item);
          return (
            <Pressable
              onPress={() => toggle(item)}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: active ? c.primary : c.card,
              }}
            >
              <Text
                style={{ color: active ? "#000" : c.text, fontWeight: "700" }}
              >
                {item}
              </Text>
            </Pressable>
          );
        }}
      />
      <Pressable
        onPress={save}
        disabled={selected.length < 2 || saving}
        style={{
          marginTop: 16,
          backgroundColor: selected.length < 2 ? c.muted : c.primary,
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#000", fontWeight: "700" }}>
          {saving ? "Saving…" : "Continue"}
        </Text>
      </Pressable>
    </View>
  );
}
