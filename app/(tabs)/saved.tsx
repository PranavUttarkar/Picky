import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import type { Event } from '@/types/models';
import EventGridCard from '@/components/EventGridCard';
import EventRowCard from '@/components/EventRowCard';

// Event type from shared models

export default function Saved() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const [items, setItems] = useState<Event[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const columns = width >= 1280 ? 3 : isWide ? 2 : 1;
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return router.replace('/onboarding/welcome');
      setUserId(user.id);
      const { data } = await supabase
        .from('saved_events')
        .select(
          'event:events(id,title,date_time,location,description,tags,image_url,image_urls,rsvp_url)',
        )
        .eq('user_id', user.id);
      const events = (data ?? []).map((r: any) => r.event as Event);
      setItems(events);
    })();
  }, []);
  const Container: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <GradientBackground contentContainerStyle={{ flex: 1, padding: 12 }}>
      <AnimatedPage variant="fade-up" style={{ flex: 1 }}>
        {children}
      </AnimatedPage>
    </GradientBackground>
  );

  const onToggleSave = async (eventId: number) => {
    try {
      if (!userId) return;
      await supabase.from('saved_events').delete().match({ user_id: userId, event_id: eventId });
      setItems((prev) => prev.filter((e) => e.id !== eventId));
      await Haptics.selectionAsync();
    } catch (e) {
      // noop
    }
  };

  return (
    <Container>
      <FlatList
        data={items}
        key={`layout-${columns}`}
        keyExtractor={(e) => String(e.id)}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
        contentContainerStyle={{ gap: 12, paddingBottom: 32, flexGrow: 1 }}
        renderItem={({ item }) => {
          const cardProps = {
            event: item,
            isSaved: true,
            onToggleSave,
            onOpenDetails: () => router.push(`/events/${item.id}`),
            onPoll: () => router.push({ pathname: '/polls/new', params: { fromEvent: item.id } }),
          } as const;
          if (columns > 1) {
            return (
              <View style={{ flex: 1 }}>
                <EventGridCard {...cardProps} />
              </View>
            );
          }
          return <EventRowCard {...cardProps} />;
        }}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <Text style={{ color: c.muted, fontSize: 16, marginBottom: 8 }}>
              Nothing saved yet!
            </Text>
            <Text style={{ color: c.muted, marginBottom: 12 }}>Explore events:</Text>
            <Pressable
              onPress={() => router.replace('/(tabs)/events')}
              style={{
                backgroundColor: c.primary,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: '#000', fontWeight: '800' }}>Go to Events</Text>
            </Pressable>
          </View>
        }
      />
    </Container>
  );
}
