import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import type { Event } from '@/types/models';

// Event type from shared models

export default function Saved() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const [items, setItems] = useState<Event[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const EXPANDED_KEY = 'saved_last_expanded_v1';
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return router.replace('/onboarding/welcome');
      const { data } = await supabase
        .from('saved_events')
        .select('event:events(id,title,date_time,location,description,tags)')
        .eq('user_id', user.id);
      const events = (data ?? []).map((r: any) => r.event);
      setItems(events);
      try {
        const last = await AsyncStorage.getItem(EXPANDED_KEY);
        if (last) {
          const num = Number(last);
          if (events.find((e: any) => e.id === num)) setExpandedId(num);
        }
      } catch {}
    })();
  }, []);
  const Container: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <GradientBackground contentContainerStyle={{ flex: 1, padding: 16 }}>
      {children}
    </GradientBackground>
  );

  return (
    <Container>
      <FlatList
        data={items}
        keyExtractor={(e) => String(e.id)}
        renderItem={({ item }) => {
          const open = expandedId === item.id;
          return (
            <Pressable
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setExpandedId((prev) => {
                  const next = prev === item.id ? null : item.id;
                  (async () => {
                    try {
                      if (next) await AsyncStorage.setItem(EXPANDED_KEY, String(next));
                      else await AsyncStorage.removeItem(EXPANDED_KEY);
                      await Haptics.selectionAsync();
                    } catch {}
                  })();
                  return next;
                });
              }}
              style={{
                backgroundColor: c.card,
                padding: 12,
                borderRadius: 12,
                marginBottom: 8,
              }}
            >
              <Text style={{ color: c.text, fontWeight: '800' }}>{item.title}</Text>
              <Text style={{ color: c.muted }}>{item.location}</Text>
              {open ? (
                <View style={{ marginTop: 8, gap: 8 }}>
                  {item.description ? (
                    <Text style={{ color: c.muted }}>{item.description}</Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <Pressable
                      onPress={() => router.push(`/events/${item.id}`)}
                      style={{
                        backgroundColor: '#00000030',
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: c.text, fontWeight: '700' }}>Open details</Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        router.push({ pathname: '/polls/new', params: { fromEvent: item.id } })
                      }
                      style={{
                        backgroundColor: c.primary,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: '#000', fontWeight: '700' }}>Start poll</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </Container>
  );
}
