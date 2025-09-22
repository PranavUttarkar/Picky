import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import type { Event } from '@/types/models';

// Event type from shared models

export default function Saved() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const [items, setItems] = useState<Event[]>([]);
  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return router.replace('/onboarding/welcome');
      const { data } = await supabase
        .from('saved_events')
        .select('event:events(id,title,date_time,location)')
        .eq('user_id', user.id);
      const events = (data ?? []).map((r: any) => r.event);
      setItems(events);
    })();
  }, []);
  const Container: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    scheme === 'light' ? (
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
      <FlatList
        data={items}
        keyExtractor={(e) => String(e.id)}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/events/${item.id}`)}
            style={{
              backgroundColor: c.card,
              padding: 12,
              borderRadius: 12,
              marginBottom: 8,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '800' }}>{item.title}</Text>
            <Text style={{ color: c.muted }}>{item.location}</Text>
          </Pressable>
        )}
      />
    </Container>
  );
}
