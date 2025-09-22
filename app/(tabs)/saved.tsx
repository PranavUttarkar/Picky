import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import type { Event } from '@/types/models';

// Event type from shared models

export default function Saved() {
  const c = useThemeColors();
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
  return (
    <View style={{ flex: 1, backgroundColor: c.background, padding: 16 }}>
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
    </View>
  );
}
