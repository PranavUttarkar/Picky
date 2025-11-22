import {
  View,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Pressable,
  ScrollView,
  Linking,
  Modal,
  FlatList,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { getTopUserMatches, getUpcomingEvents } from '@/services/events';
import { getTopUserRestaurantMatches } from '@/services/food';
import { getMyGroups } from '@/services/groups';
import type { Event, Restaurant } from '@/types/models';
import LazyImage from '@/components/LazyImage';
import dayjs from 'dayjs';

// Compact square card for events
function CompactEventCard({ event, onPress }: { event: Event & { match_percent?: number }; onPress: () => void }) {
  const c = useThemeColors();
  const imgs: string[] = (event as any).image_urls?.length
    ? (event as any).image_urls
    : event.image_url
    ? [event.image_url]
    : [];
  const cover = imgs[0];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactCard,
        {
          backgroundColor: c.card,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.compactImageContainer}>
        {cover ? (
          <LazyImage
            uri={cover}
            width="100%"
            height="100%"
            borderRadius={0}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.compactImage, { backgroundColor: c.muted + '20', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="calendar-outline" size={24} color={c.muted} />
          </View>
        )}
        {(event as any).match_percent && (
          <View style={styles.matchBadge}>
            <Text style={styles.matchBadgeText}>{(event as any).match_percent}%</Text>
          </View>
        )}
      </View>
      <Text style={[styles.compactTitle, { color: c.text }]} numberOfLines={2}>
        {event.title}
      </Text>
      <Text style={[styles.compactMeta, { color: c.muted }]} numberOfLines={1}>
        {dayjs(event.date_time).format('MMM D')}
      </Text>
    </Pressable>
  );
}

// Compact square card for restaurants
function CompactFoodCard({ restaurant, onPress }: { restaurant: Restaurant & { match_percent?: number }; onPress: () => void }) {
  const c = useThemeColors();
  const images = [restaurant.main_image, restaurant.image_1, restaurant.image_2, restaurant.image_3].filter(Boolean) as string[];
  const cover = images[0];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactCard,
        {
          backgroundColor: c.card,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.compactImageContainer}>
        {cover ? (
          <LazyImage
            uri={cover}
            width="100%"
            height="100%"
            borderRadius={0}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.compactImage, { backgroundColor: c.muted + '20', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="restaurant-outline" size={24} color={c.muted} />
          </View>
        )}
        {restaurant.match_percent && (
          <View style={styles.matchBadge}>
            <Text style={styles.matchBadgeText}>{restaurant.match_percent}%</Text>
          </View>
        )}
      </View>
      <Text style={[styles.compactTitle, { color: c.text }]} numberOfLines={2}>
        {restaurant.restaurant_name}
      </Text>
      <Text style={[styles.compactMeta, { color: c.muted }]} numberOfLines={1}>
        {restaurant.category || restaurant.price_range || ''}
      </Text>
    </Pressable>
  );
}

export default function HomeTab() {
  const c = useThemeColors();
  const { scheme, toggleScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [signedIn, setSignedIn] = useState(false);
  const { width } = useWindowDimensions();
  const [topEvents, setTopEvents] = useState<(Event & { match_percent?: number })[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<(Restaurant & { match_percent?: number })[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingFood, setLoadingFood] = useState(true);
  const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [selectedDecisionType, setSelectedDecisionType] = useState<'events' | 'food' | 'time' | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setSignedIn(Boolean(data.user));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSignedIn(Boolean(session));
    });

    return () => {
      mounted = false;
      try {
        sub.subscription.unsubscribe();
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (signedIn) {
      (async () => {
        try {
          let events = await getTopUserMatches(3);
          // Fallback to upcoming events if no personalized matches found
          if (!events || events.length === 0) {
            events = await getUpcomingEvents(3) as any;
          }
          if (events && events.length > 0) {
            setTopEvents(events);
          }
        } catch (e) {
          console.error('Failed to load events:', e);
          // Try fallback on error too
          try {
            const fallbackEvents = await getUpcomingEvents(3);
            if (fallbackEvents && fallbackEvents.length > 0) {
              setTopEvents(fallbackEvents as any);
            }
          } catch (fallbackError) {
            console.error('Fallback events also failed:', fallbackError);
          }
        } finally {
          setLoadingEvents(false);
        }
      })();

      (async () => {
        try {
          const restaurants = await getTopUserRestaurantMatches(3);
          if (restaurants && restaurants.length > 0) {
            setTopRestaurants(restaurants);
          }
        } catch (e) {
          console.error('Failed to load restaurants:', e);
        } finally {
          setLoadingFood(false);
        }
      })();
    } else {
      // For non-signed-in users, show upcoming events
      (async () => {
        try {
          const events = await getUpcomingEvents(3);
          if (events && events.length > 0) {
            setTopEvents(events as any);
          }
        } catch (e) {
          console.error('Failed to load events:', e);
        } finally {
          setLoadingEvents(false);
        }
      })();
      setLoadingFood(false);
    }
  }, [signedIn]);

  const handleGroupDecide = (type: 'events' | 'food' | 'time') => {
    if (!signedIn) {
      router.push('/onboarding/welcome?mode=signUp');
      return;
    }
    setSelectedDecisionType(type);
    setGroupModalVisible(true);
    (async () => {
      try {
        const gs = await getMyGroups();
        setGroups(gs as any);
      } catch (e) {
        console.error('Failed to load groups:', e);
      }
    })();
  };

  const handleSelectGroup = async (groupId: number) => {
    if (!selectedDecisionType) return;
    
    setGroupModalVisible(false);
    
    if (selectedDecisionType === 'time') {
      router.push(`/(tabs)/groups/${groupId}/availability`);
      setSelectedDecisionType(null);
      return;
    }

    // For events and food, we need to create a poll
    try {
      const { createPollWithOptions, createTextPoll } = await import('@/services/polls');
      const { getTopGroupMatches } = await import('@/services/events');
      const { getTopGroupRestaurantMatches } = await import('@/services/food');
      
      let pollId: number | null = null;
      
      if (selectedDecisionType === 'events') {
        const recs = await getTopGroupMatches(groupId, 7);
        const eventIds = recs.map((e) => e.id);
        if (eventIds.length < 1) {
          Alert.alert('No suggestions', 'We could not find recommended events for this group yet. Try browsing and saving some events first.');
          setSelectedDecisionType(null);
          return;
        }
        pollId = await createPollWithOptions(groupId, eventIds, {
          title: 'Decide: Events',
          deadlineAt: null,
          mode: 'rating',
        });
      } else if (selectedDecisionType === 'food') {
        const recs = await getTopGroupRestaurantMatches(groupId, 7);
        const texts = recs.map((r) => `FOOD|${r.id}`);
        if (texts.length < 1) {
          Alert.alert('No suggestions', 'We could not find recommended restaurants for this group yet. Try browsing and saving some places first.');
          setSelectedDecisionType(null);
          return;
        }
        pollId = await createTextPoll(groupId, texts, {
          title: 'Decide: Food',
          deadlineAt: null,
        });
      }
      
      if (pollId) {
        router.push(`/polls/${pollId}`);
      }
    } catch (e: any) {
      Alert.alert('Failed to start', e?.message ?? String(e));
    }
    
    setSelectedDecisionType(null);
  };

  return (
    <GradientBackground variant="dim">
      <AnimatedPage variant="pop" style={{ flex: 1 }}>
        {/* Instagram-like Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 16,
              backgroundColor: c.background,
              borderBottomColor: c.muted + '30',
            },
          ]}
        >
          <Text style={[styles.headerTitle, { color: c.text }]}>Picky</Text>
          <View style={styles.headerIcons}>
            <Pressable
              onPress={() => router.push('/search-users')}
              style={styles.headerIconButton}
            >
              <Ionicons name="person-add-outline" size={24} color={c.text} />
            </Pressable>
            <Pressable
              onPress={toggleScheme}
              style={styles.headerIconButton}
            >
              <Ionicons
                name={scheme === 'dark' ? 'sunny-outline' : 'moon-outline'}
                size={24}
                color={c.text}
              />
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
          style={{ flex: 1 }}
        >
          {/* Row 1: Discover Events */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Discover Events</Text>
              <Pressable
                onPress={() => router.push('/events')}
                style={styles.viewAllButton}
              >
                <Text style={[styles.viewAllText, { color: c.primary }]}>View All</Text>
                <Ionicons name="chevron-forward" size={16} color={c.primary} />
              </Pressable>
            </View>
            {loadingEvents ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={c.primary} />
              </View>
            ) : topEvents.length > 0 ? (
              <View style={styles.compactGrid}>
                {topEvents.map((event) => (
                  <CompactEventCard
                    key={event.id}
                    event={event}
                    onPress={() => router.push(`/events/${event.id}`)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyStateText, { color: c.muted }]}>
                  {signedIn ? 'No events found. Check back later!' : 'Sign in to see personalized events'}
                </Text>
              </View>
            )}
          </View>

          {/* Row 2: Food */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Food</Text>
              <Pressable
                onPress={() => router.push('/food')}
                style={styles.viewAllButton}
              >
                <Text style={[styles.viewAllText, { color: c.primary }]}>View All</Text>
                <Ionicons name="chevron-forward" size={16} color={c.primary} />
              </Pressable>
            </View>
            {loadingFood ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={c.primary} />
              </View>
            ) : topRestaurants.length > 0 ? (
              <View style={styles.compactGrid}>
                {topRestaurants.map((restaurant) => (
                  <CompactFoodCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    onPress={() => router.push(`/foods/${encodeURIComponent(restaurant.id)}`)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyStateText, { color: c.muted }]}>
                  {signedIn ? 'No restaurants found. Check back later!' : 'Sign in to see personalized restaurants'}
                </Text>
              </View>
            )}
          </View>

          {/* Row 3: Group Decide */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.text, marginBottom: 12 }]}>Group Decide</Text>
            <View style={styles.groupDecideGrid}>
              <Pressable
                onPress={() => handleGroupDecide('events')}
                style={[styles.groupDecideCard, { backgroundColor: c.card }]}
              >
                <Ionicons name="calendar-outline" size={32} color={c.primary} />
                <Text style={[styles.groupDecideText, { color: c.text }]}>Decide Events</Text>
              </Pressable>
              <Pressable
                onPress={() => handleGroupDecide('food')}
                style={[styles.groupDecideCard, { backgroundColor: c.card }]}
              >
                <Ionicons name="restaurant-outline" size={32} color={c.primary} />
                <Text style={[styles.groupDecideText, { color: c.text }]}>Decide Food</Text>
              </Pressable>
              <Pressable
                onPress={() => handleGroupDecide('time')}
                style={[styles.groupDecideCard, { backgroundColor: c.card }]}
              >
                <Ionicons name="time-outline" size={32} color={c.primary} />
                <Text style={[styles.groupDecideText, { color: c.text }]}>Pick a Common Time</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {/* Group Selection Modal */}
        <Modal
          visible={groupModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setGroupModalVisible(false);
            setSelectedDecisionType(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: c.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: c.text }]}>Choose a Group</Text>
                <Pressable
                  onPress={() => {
                    setGroupModalVisible(false);
                    setSelectedDecisionType(null);
                  }}
                >
                  <Ionicons name="close" size={24} color={c.text} />
                </Pressable>
              </View>
              {groups.length === 0 ? (
                <View style={styles.modalEmpty}>
                  <Text style={[styles.modalEmptyText, { color: c.muted }]}>
                    You're not in any groups yet. Create or join one from the Groups tab.
                  </Text>
                  <Pressable
                    onPress={() => {
                      setGroupModalVisible(false);
                      setSelectedDecisionType(null);
                      router.push('/(tabs)/groups');
                    }}
                    style={[styles.modalButton, { backgroundColor: c.primary }]}
                  >
                    <Text style={[styles.modalButtonText, { color: '#000' }]}>Go to Groups</Text>
                  </Pressable>
                </View>
              ) : (
                <FlatList
                  data={groups}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => handleSelectGroup(item.id)}
                      style={[styles.groupItem, { backgroundColor: c.background }]}
                    >
                      <Text style={[styles.groupItemText, { color: c.text }]}>{item.name}</Text>
                      <Ionicons name="chevron-forward" size={20} color={c.muted} />
                    </Pressable>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>
      </AnimatedPage>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '400',
    letterSpacing: 0,
    // @ts-ignore - font loaded globally
    fontFamily: 'Pacifico_400Regular',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  headerIconButton: {
    padding: 4,
  },
  // Section styles
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Compact grid styles
  compactGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    justifyContent: 'flex-start',
  },
  compactCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#00000010',
    minWidth: 100,
  },
  compactImageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  compactImage: {
    width: '100%',
    height: '100%',
  },
  matchBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  matchBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  compactTitle: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingTop: 8,
    lineHeight: 16,
  },
  compactMeta: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingBottom: 8,
    marginTop: 2,
  },
  // Group Decide styles
  groupDecideGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  groupDecideCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#00000010',
  },
  groupDecideText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  // Loading and empty states
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#00000010',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  groupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#00000010',
  },
  groupItemText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
