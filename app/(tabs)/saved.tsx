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
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import type { Event, Restaurant } from '@/types/models';
import EventGridCard from '@/components/EventGridCard';
import EventRowCard from '@/components/EventRowCard';
import FoodGridCard from '@/components/FoodGridCard';
import FoodRowCard from '@/components/FoodRowCard';

// Event type from shared models

export default function Saved() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const [events, setEvents] = useState<Event[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [activeTab, setActiveTab] = useState<'events' | 'food'>('events');
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
      // Saved events
      const se = await supabase
        .from('saved_events')
        .select(
          'event:events(id,title,date_time,location,description,tags,image_url,image_urls,rsvp_url)'
        )
        .eq('user_id', user.id);
      setEvents(((se.data ?? []) as any[]).map((r: any) => r.event as Event));
      // Saved restaurants
      const sr = await supabase
        .from('saved_restaurants')
        .select(
          'restaurant:restaurants(place_id, restaurant_name, description, address, city, state, zipcode, latitude, longitude, phone, website, category, price_range, review_points, reviews, main_image, image_1, image_2, image_3, page_url, plus_code, plus_code_url)'
        )
        .eq('user_id', user.id);
      const norm = ((sr.data ?? []) as any[]).map((r: any) => {
        const row = r.restaurant || {};
        const id = String(row.place_id ?? '');
        return {
          id,
          google_id: null,
          restaurant_name: row.restaurant_name,
          description: row.description ?? null,
          address: row.address ?? null,
          city: row.city ?? null,
          state: row.state ?? null,
          zipcode: row.zipcode ?? null,
          latitude: row.latitude != null ? String(row.latitude) : null,
          longitude: row.longitude != null ? String(row.longitude) : null,
          phone: row.phone ?? null,
          website: row.website ?? null,
          category: row.category ?? null,
          price_range: row.price_range ?? null,
          review_points: row.review_points != null ? String(row.review_points) : null,
          reviews: row.reviews != null ? String(row.reviews) : null,
          main_image: row.main_image ?? null,
          image_1: row.image_1 ?? null,
          image_2: row.image_2 ?? null,
          image_3: row.image_3 ?? null,
          page_url: row.page_url ?? null,
          place_id: row.place_id ?? null,
          plus_code: row.plus_code ?? null,
          plus_code_url: row.plus_code_url ?? null,
          delivery: null,
          popular_times_monday: null,
          popular_times_tuesday: null,
          popular_times_wednesday: null,
          popular_times_thursday: null,
          popular_times_friday: null,
          popular_times_saturday: null,
          popular_times_sunday: null,
          open_time_monday: null,
          open_time_tuesday: null,
          open_time_wednesday: null,
          open_time_thursday: null,
          open_time_friday: null,
          open_time_saturday: null,
          open_time_sunday: null,
        } as Restaurant;
      });
      setRestaurants(norm);
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
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      await Haptics.selectionAsync();
    } catch (e) {
      // noop
    }
  };

  const onToggleSaveRestaurant = async (restaurantId: string) => {
    try {
      if (!userId) return;
      await supabase
        .from('saved_restaurants')
        .delete()
        .match({ user_id: userId, restaurant_id: restaurantId });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setRestaurants((prev) => prev.filter((r) => r.id !== restaurantId));
      await Haptics.selectionAsync();
    } catch {}
  };

  return (
    <Container>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Toggle buttons */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <Pressable
            onPress={() => setActiveTab('events')}
            accessibilityLabel="Show saved events"
            style={{
              backgroundColor: activeTab === 'events' ? c.primary : c.background,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#00000020',
            }}
          >
            <Text style={{ color: activeTab === 'events' ? '#000' : c.text, fontWeight: '800' }}>
              Events
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('food')}
            accessibilityLabel="Show saved restaurants"
            style={{
              backgroundColor: activeTab === 'food' ? c.primary : c.background,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#00000020',
            }}
          >
            <Text style={{ color: activeTab === 'food' ? '#000' : c.text, fontWeight: '800' }}>
              Food
            </Text>
          </Pressable>
        </View>

        {activeTab === 'events' ? (
          <>
            {events.length ? (
              <FlatList
                data={events}
                key={`events-${columns}`}
                keyExtractor={(e) => String(e.id)}
                numColumns={columns}
                columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
                contentContainerStyle={{ gap: 12 }}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const cardProps = {
                    event: item,
                    isSaved: true,
                    onToggleSave,
                    onOpenDetails: () => router.push(`/events/${item.id}`),
                    onPoll: () =>
                      router.push({ pathname: '/polls/new', params: { fromEvent: item.id } }),
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
              />
            ) : (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
                <Text style={{ color: c.muted, marginBottom: 8 }}>No saved events.</Text>
                <Pressable
                  onPress={() => router.replace('/(tabs)/events')}
                  style={{ backgroundColor: c.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
                >
                  <Text style={{ color: '#000', fontWeight: '800' }}>Browse Events</Text>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          <>
            {restaurants.length ? (
              columns > 1 ? (
                <FlatList
                  data={restaurants}
                  key={`restaurants-grid-${columns}`}
                  keyExtractor={(r) => r.id}
                  numColumns={columns}
                  columnWrapperStyle={{ gap: 12 }}
                  contentContainerStyle={{ gap: 12 }}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <View style={{ flex: 1 }}>
                      <FoodGridCard
                        item={item}
                        isSaved
                        onToggleSave={onToggleSaveRestaurant}
                        onOpenDetails={() => router.push(`/foods/${encodeURIComponent(item.id)}`)}
                      />
                    </View>
                  )}
                />
              ) : (
                <FlatList
                  data={restaurants}
                  key={`restaurants-row`}
                  keyExtractor={(r) => r.id}
                  contentContainerStyle={{ gap: 12 }}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <FoodRowCard
                      item={item}
                      isSaved
                      onToggleSave={onToggleSaveRestaurant}
                      onOpenDetails={() =>
                        router.push(`/foods/${encodeURIComponent(item.id)}`)
                      }
                    />
                  )}
                />
              )
            ) : (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
                <Text style={{ color: c.muted, marginBottom: 8 }}>No saved restaurants.</Text>
                <Pressable
                  onPress={() => router.replace('/(tabs)/food')}
                  style={{ backgroundColor: c.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
                >
                  <Text style={{ color: '#000', fontWeight: '800' }}>Browse Food</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Container>
  );
}
