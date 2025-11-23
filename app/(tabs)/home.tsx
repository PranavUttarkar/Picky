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
import { LinearGradient } from 'expo-linear-gradient';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { getTopUserMatches, getUpcomingEvents } from '@/services/events';
import { getTopUserRestaurantMatches, listRestaurants } from '@/services/food';
import { getMyGroups } from '@/services/groups';
import type { Event, Restaurant } from '@/types/models';
import LazyImage from '@/components/LazyImage';
import dayjs from 'dayjs';
import { Spacing, BorderRadius, Typography, Colors, IconSizes } from '@/theme/designTokens';

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
          <View style={styles.matchBadgeContainer}>
            <LinearGradient
              colors={['#34D399', '#3B82F6', '#818CF8', '#F59E0B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.matchBadgeGradient}
            >
              <View style={styles.matchBadge}>
                <Text style={styles.matchBadgeText}>{(event as any).match_percent}%</Text>
              </View>
            </LinearGradient>
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
          <View style={styles.matchBadgeContainer}>
            <LinearGradient
              colors={['#34D399', '#3B82F6', '#818CF8', '#F59E0B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.matchBadgeGradient}
            >
              <View style={styles.matchBadge}>
                <Text style={styles.matchBadgeText}>{restaurant.match_percent}%</Text>
              </View>
            </LinearGradient>
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
  // Responsive card count: 5 for desktop (>= 1024px), 3 for mobile/tablet
  const isDesktop = width >= 1024;
  const cardCount = isDesktop ? 5 : 3;
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
          // Get personalized events (up to cardCount)
          let personalizedEvents = await getTopUserMatches(cardCount);
          personalizedEvents = personalizedEvents || [];
          
          // Always ensure we have at least cardCount events
          const targetCount = cardCount;
          const neededCount = Math.max(0, targetCount - personalizedEvents.length);
          
          let finalEvents: (Event & { match_percent?: number })[] = [...personalizedEvents];
          
          // If we need more events, get recent upcoming events to fill the gap
          if (neededCount > 0) {
            try {
              const upcomingEvents = await getUpcomingEvents(targetCount + neededCount); // Get extra to avoid duplicates
              
              // Get IDs of personalized events to avoid duplicates
              const personalizedIds = new Set(personalizedEvents.map(e => e.id));
              
              // Add upcoming events that aren't already in personalized events
              const additionalEvents = upcomingEvents
                .filter(e => !personalizedIds.has(e.id))
                .slice(0, neededCount)
                .map(e => ({ ...e, match_percent: undefined })); // No match percent for non-personalized
              
              finalEvents = [...personalizedEvents, ...additionalEvents].slice(0, targetCount);
            } catch (upcomingError) {
              console.error('Failed to load additional events:', upcomingError);
              // If we can't get additional events, just use what we have
            }
          } else {
            // We have enough or more personalized events, just take the first targetCount
            finalEvents = personalizedEvents.slice(0, targetCount);
          }
          
          if (finalEvents.length > 0) {
            setTopEvents(finalEvents);
            console.log('Loaded events:', finalEvents.length, finalEvents.map(e => ({ id: e.id, match: e.match_percent })));
          } else {
            console.log('No events found');
          }
        } catch (e) {
          console.error('Failed to load events:', e);
          // Try fallback on error too
          try {
            const fallbackEvents = await getUpcomingEvents(cardCount);
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
          // Get personalized restaurants (up to cardCount)
          let personalizedRestaurants = await getTopUserRestaurantMatches(cardCount);
          personalizedRestaurants = personalizedRestaurants || [];
          
          // Always ensure we have at least cardCount restaurants
          const targetCount = cardCount;
          const neededCount = Math.max(0, targetCount - personalizedRestaurants.length);
          
          let finalRestaurants: (Restaurant & { match_percent?: number })[] = [...personalizedRestaurants];
          
          // If we need more restaurants, get popular restaurants to fill the gap
          if (neededCount > 0) {
            try {
              const popularRestaurants = await listRestaurants(0, targetCount + neededCount); // Get extra to avoid duplicates
              
              // Get IDs of personalized restaurants to avoid duplicates
              const personalizedIds = new Set(personalizedRestaurants.map(r => r.id));
              
              // Add popular restaurants that aren't already in personalized restaurants
              const additionalRestaurants = popularRestaurants
                .filter(r => !personalizedIds.has(r.id))
                .slice(0, neededCount)
                .map(r => ({ ...r, match_percent: undefined })); // No match percent for non-personalized
              
              finalRestaurants = [...personalizedRestaurants, ...additionalRestaurants].slice(0, targetCount);
            } catch (popularError) {
              console.error('Failed to load additional restaurants:', popularError);
              // If we can't get additional restaurants, just use what we have
            }
          } else {
            // We have enough or more personalized restaurants, just take the first targetCount
            finalRestaurants = personalizedRestaurants.slice(0, targetCount);
          }
          
          if (finalRestaurants.length > 0) {
            setTopRestaurants(finalRestaurants);
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
          const events = await getUpcomingEvents(cardCount);
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
  }, [signedIn, cardCount]);

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
              paddingTop: insets.top + Spacing.md,
              marginTop: 0,
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
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: Typography.scale.display.fontSize,
    lineHeight: Typography.scale.display.lineHeight,
    fontWeight: Typography.fontWeight.regular,
    letterSpacing: 0,
    // @ts-ignore - font loaded globally
    fontFamily: Typography.fontFamily.brand,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
  },
  headerIconButton: {
    padding: Spacing.xs,
  },
  // Section styles
  section: {
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md - 4, // 12px
  },
  sectionTitle: {
    fontSize: Typography.scale.heading2.fontSize,
    lineHeight: Typography.scale.heading2.lineHeight,
    fontFamily: Typography.fontFamily.body,
    fontWeight: Typography.fontWeight.bold,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  viewAllText: {
    fontSize: Typography.scale.body.fontSize,
    lineHeight: Typography.scale.body.lineHeight,
    fontFamily: Typography.fontFamily.body,
    fontWeight: Typography.fontWeight.semibold,
  },
  // Compact grid styles
  compactGrid: {
    flexDirection: 'row',
    gap: Spacing.md - 4, // 12px
    marginTop: Spacing.sm,
    justifyContent: 'flex-start',
    flexWrap: 'nowrap', // Ensure all cards show in a row
  },
  compactCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.neutral[300] + '20',
    minWidth: 100,
    maxWidth: '100%', // Ensure cards don't exceed container
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
  matchBadgeContainer: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 10,
    elevation: 5, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  matchBadgeGradient: {
    padding: 2.5,
    borderRadius: BorderRadius.full,
  },
  matchBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  matchBadgeText: {
    color: '#fff',
    fontSize: Typography.scale.caption.fontSize,
    lineHeight: Typography.scale.caption.lineHeight,
    fontFamily: Typography.fontFamily.body,
    fontWeight: Typography.fontWeight.bold,
  },
  compactTitle: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: Typography.fontFamily.body,
    fontWeight: Typography.fontWeight.semibold,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  compactMeta: {
    fontSize: Typography.scale.bodySmall.fontSize,
    lineHeight: Typography.scale.bodySmall.lineHeight,
    fontFamily: Typography.fontFamily.body,
    fontWeight: Typography.fontWeight.regular,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    marginTop: 2,
  },
  // Group Decide styles
  groupDecideGrid: {
    flexDirection: 'row',
    gap: Spacing.md - 4, // 12px
    marginTop: Spacing.sm,
  },
  groupDecideCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.light.neutral[300] + '20',
  },
  groupDecideText: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: Typography.fontFamily.body,
    fontWeight: Typography.fontWeight.semibold,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  // Loading and empty states
  loadingContainer: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: Typography.scale.body.fontSize,
    lineHeight: Typography.scale.body.lineHeight,
    fontFamily: Typography.fontFamily.body,
    fontWeight: Typography.fontWeight.regular,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.lg - 4, // 20px
    paddingBottom: Spacing.xl + 8, // 40px
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg - 4, // 20px
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.neutral[300] + '20',
  },
  modalTitle: {
    fontSize: Typography.scale.heading2.fontSize,
    lineHeight: Typography.scale.heading2.lineHeight,
    fontFamily: Typography.fontFamily.body,
    fontWeight: Typography.fontWeight.bold,
  },
  modalEmpty: {
    padding: Spacing.lg - 4, // 20px
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: Typography.scale.body.fontSize,
    lineHeight: Typography.scale.body.lineHeight,
    fontFamily: Typography.fontFamily.body,
    fontWeight: Typography.fontWeight.regular,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  modalButton: {
    paddingHorizontal: Spacing.lg - 4, // 20px
    paddingVertical: Spacing.md - 4, // 12px
    borderRadius: BorderRadius.sm + 2, // 10px
  },
  modalButtonText: {
    fontSize: Typography.scale.bodyLarge.fontSize,
    lineHeight: Typography.scale.bodyLarge.lineHeight,
    fontFamily: Typography.fontFamily.body,
    fontWeight: Typography.fontWeight.bold,
  },
  groupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg - 4, // 20px
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.neutral[300] + '20',
  },
  groupItemText: {
    fontSize: Typography.scale.bodyLarge.fontSize,
    lineHeight: Typography.scale.bodyLarge.lineHeight,
    fontFamily: Typography.fontFamily.body,
    fontWeight: Typography.fontWeight.semibold,
  },
});
