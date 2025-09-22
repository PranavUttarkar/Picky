import { useEffect, useState } from "react";
import { View, Text, FlatList, Image, Pressable } from "react-native";
import dayjs from "dayjs";
import { useThemeColors } from "@/theme/ThemeProvider";
import { supabase } from "@/services/supabase";
import { router } from "expo-router";

type Event = {
  id: number;
  title: string;
  description?: string;
  image_url?: string;
  date_time: string;
  location?: string;
  tags?: string[];
};

export default function Home() {
  const c = useThemeColors();
  const [events, setEvents] = useState<Event[]>([]);
  const [myTags, setMyTags] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [saved, setSaved] = useState<number[]>([]);

  useEffect(() => {
    supabase
      .from("events")
      .select("*")
      .gte("date_time", new Date().toISOString())
      .order("date_time", { ascending: true })
      .then(({ data }) => setEvents(data ?? []));
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      const { data } = await supabase
        .from("user_interests_temp")
        .select("names")
        .eq("user_id", user.id)
        .maybeSingle();
      setMyTags(data?.names ?? []);
      const se = await supabase
        .from("saved_events")
        .select("event_id")
        .eq("user_id", user.id);
      setSaved((se.data ?? []).map((r: any) => r.event_id));

      // Fetch personal scoring from Supabase RPC (secure function)
      const { data: rpcScores } = await supabase.rpc("get_user_event_scores");
      if (rpcScores) {
        const map: Record<number, number> = {};
        for (const row of rpcScores as any[]) {
          map[Number(row.event_id)] = Number(row.match_percent);
        }
        setScores(map);
      }
    })();
  }, []);
  const toggleSave = async (id: number) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    if (saved.includes(id)) {
      await supabase
        .from("saved_events")
        .delete()
        .eq("user_id", user.id)
        .eq("event_id", id);
      setSaved((s) => s.filter((x) => x !== id));
    } else {
      await supabase
        .from("saved_events")
        .insert({ user_id: user.id, event_id: id });
      setSaved((s) => [...s, id]);
    }
  };

  const match = (eventId: number, tags?: string[]) => {
    // Prefer server-computed score when available
    const fromServer = scores[eventId];
    if (typeof fromServer === "number") return fromServer;
    // Fallback local estimate if RPC not available yet
    if (!tags || tags.length === 0 || myTags.length === 0) return 0;
    const overlap = tags.filter((t) => myTags.includes(t)).length;
    return Math.round((overlap / Math.max(tags.length, myTags.length)) * 100);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background, padding: 12 }}>
      <FlatList
        data={events}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ gap: 12, paddingBottom: 32 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/events/${item.id}`)}
            style={{
              backgroundColor: c.card,
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={{ width: "100%", height: 160 }}
              />
            ) : null}
            <View style={{ padding: 12 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: "800" }}>
                {item.title}
              </Text>
              <Text style={{ color: c.muted, marginTop: 4 }}>
                {dayjs(item.date_time).format("ddd, MMM D • h:mm A")} •{" "}
                {item.location}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 8,
                }}
              >
                {(item.tags ?? []).map((t) => (
                  <View
                    key={t}
                    style={{
                      backgroundColor: "#00000020",
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ color: c.text, fontSize: 12 }}>{t}</Text>
                  </View>
                ))}
              </View>
              <View
                style={{
                  marginTop: 8,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: c.text, fontWeight: "700" }}>
                  Match {match(item.id, item.tags)}%
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => toggleSave(item.id)}
                    style={{
                      backgroundColor: c.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: "#000", fontWeight: "700" }}>
                      {saved.includes(item.id) ? "Saved" : "Save"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/polls/new",
                        params: { fromEvent: item.id },
                      })
                    }
                    style={{
                      backgroundColor: "#00000030",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: c.text, fontWeight: "700" }}>
                      Poll
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
