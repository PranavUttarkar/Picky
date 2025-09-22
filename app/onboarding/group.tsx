import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { router } from "expo-router";
import { useThemeColors } from "@/theme/ThemeProvider";
import { supabase } from "@/services/supabase";
import { ensureProfile } from "@/services/profile";

export default function OnboardingGroup() {
  const c = useThemeColors();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createGroup = async () => {
    try {
      setError(null);
      if (!name.trim()) return;
      setLoading(true);
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      // Ensure a users row exists to satisfy groups.created_by FK
      await ensureProfile();
      const invite_code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const { data: grp, error: e1 } = await supabase
        .from("groups")
        .insert({ name, created_by: user.id, invite_code })
        .select("id")
        .single();
      if (e1 || !grp) throw new Error(e1?.message ?? "Failed");
      await supabase
        .from("group_members")
        .insert({ group_id: grp.id, user_id: user.id });
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async () => {
    try {
      setError(null);
      if (!code.trim()) return;
      setLoading(true);
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      let groupId: number | null = null;
      const numeric = parseInt(code, 10);
      if (!isNaN(numeric)) {
        groupId = numeric;
      } else {
        const { data } = await supabase
          .from("groups")
          .select("id")
          .eq("invite_code", code.toUpperCase())
          .maybeSingle();
        groupId = data?.id ?? null;
      }
      if (!groupId) throw new Error("Invalid code");
      await supabase
        .from("group_members")
        .upsert({ group_id: groupId, user_id: user.id });
      router.replace("/(tabs)/groups");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background, padding: 16 }}>
      <Text
        style={{
          color: c.text,
          fontSize: 24,
          fontWeight: "800",
          marginBottom: 12,
        }}
      >
        Create or Join Group
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        <Pressable
          onPress={() => setMode("create")}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            backgroundColor: mode === "create" ? c.primary : c.card,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: mode === "create" ? "#000" : c.text,
              fontWeight: "700",
            }}
          >
            Create
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("join")}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            backgroundColor: mode === "join" ? c.primary : c.card,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: mode === "join" ? "#000" : c.text,
              fontWeight: "700",
            }}
          >
            Join
          </Text>
        </Pressable>
      </View>
      {mode === "create" ? (
        <View>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Group name"
            placeholderTextColor={c.muted}
            style={{
              backgroundColor: c.card,
              color: c.text,
              padding: 12,
              borderRadius: 12,
            }}
          />
          {error && (
            <Text style={{ color: c.accent, marginTop: 8 }}>{error}</Text>
          )}
          <Pressable
            onPress={createGroup}
            disabled={loading || !name.trim()}
            style={{
              marginTop: 16,
              backgroundColor: c.primary,
              padding: 14,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#000", fontWeight: "700" }}>
              {loading ? "Creating…" : "Create group"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/(tabs)/home")}
            disabled={loading}
            style={{
              marginTop: 12,
              backgroundColor: "#00000030",
              padding: 14,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: c.text, fontWeight: "700" }}>
              Skip for now
            </Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <TextInput
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            placeholder="Invite code or ID"
            placeholderTextColor={c.muted}
            style={{
              backgroundColor: c.card,
              color: c.text,
              padding: 12,
              borderRadius: 12,
            }}
          />
          {error && (
            <Text style={{ color: c.accent, marginTop: 8 }}>{error}</Text>
          )}
          <Pressable
            onPress={joinGroup}
            disabled={loading || !code.trim()}
            style={{
              marginTop: 16,
              backgroundColor: c.primary,
              padding: 14,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#000", fontWeight: "700" }}>
              {loading ? "Joining…" : "Join group"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/(tabs)/home")}
            disabled={loading}
            style={{
              marginTop: 12,
              backgroundColor: "#00000030",
              padding: 14,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: c.text, fontWeight: "700" }}>
              Skip for now
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
