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
  TextInput,
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
import { getOnboarding, saveOnboarding } from '@/services/profile';
import type { Event, Restaurant } from '@/types/models';
import LazyImage from '@/components/LazyImage';
import EventImagePlaceholder from '@/components/EventImagePlaceholder';

// Popular interests for quick selection
const POPULAR_INTERESTS = [
  'Live Music',
  'Sports',
  'Food',
  'Tech',
  'Hackathons',
  'Arts & Theatre',
  'Careers',
  'Outdoors',
  'Culture',
  'Fitness',
  'Business',
  'Entrepreneurship',
  'Networking',
  'Gaming',
];

// Extended interest categories for recommendations
const ALL_INTEREST_TAGS: Record<string, string[]> = {
  'Entertainment': ['Live Music', 'Gaming', 'Movies', 'Comedy', 'Concerts', 'Festivals', 'Theater', 'Dance'],
  'Sports & Fitness': ['Sports', 'Fitness', 'Yoga', 'Running', 'Basketball', 'Soccer', 'Volleyball', 'Hiking'],
  'Food & Dining': ['Food', 'Cooking', 'Coffee', 'Brunch', 'Fine Dining', 'Street Food', 'Baking', 'Wine'],
  'Professional': ['Careers', 'Networking', 'Business', 'Entrepreneurship', 'Leadership', 'Public Speaking'],
  'Tech & Innovation': ['Tech', 'Hackathons', 'AI', 'Startups', 'Coding', 'Data Science', 'Robotics'],
  'Arts & Culture': ['Arts & Theatre', 'Culture', 'Photography', 'Design', 'Museums', 'Literature', 'Poetry'],
  'Outdoors & Travel': ['Outdoors', 'Travel', 'Camping', 'Beach', 'Road Trips', 'Nature', 'Adventure'],
  'Social & Community': ['Volunteering', 'Community Service', 'Meetups', 'Social', 'Clubs', 'Charity'],
  'Education & Learning': ['Workshops', 'Seminars', 'Languages', 'Science', 'History', 'Philosophy'],
  'Wellness': ['Mental Health', 'Meditation', 'Self-Care', 'Wellness', 'Mindfulness', 'Spa'],
};

// Get all unique tags flattened
const ALL_TAGS = Array.from(new Set(Object.values(ALL_INTEREST_TAGS).flat()));

// Function to get suggested tags that user hasn't selected yet
function getSuggestedInterests(selectedInterests: string[], limit: number = 6): string[] {
  const selectedLower = new Set(selectedInterests.map(i => i.toLowerCase()));
  
  // First, prioritize popular interests that aren't selected
  const unselectedPopular = POPULAR_INTERESTS.filter(
    i => !selectedLower.has(i.toLowerCase())
  );
  
  // Then add other tags from categories (that aren't already in popular and aren't selected)
  const otherTags = ALL_TAGS.filter(
    tag => !selectedLower.has(tag.toLowerCase()) && !POPULAR_INTERESTS.includes(tag)
  );
  
  // Combine popular first, then other tags
  return [...unselectedPopular, ...otherTags].slice(0, limit);
}
import dayjs from 'dayjs';
import { Spacing, BorderRadius, Typography, Colors, IconSizes, Shadows } from '@/theme/designTokens';

// Skeleton card for loading state
function SkeletonCard() {
  const c = useThemeColors();
  return (
    <View style={[styles.compactCard, { backgroundColor: c.card, borderColor: Colors.light.neutral[300] + '20' }]}>
      <View style={[styles.compactImageContainer, { backgroundColor: c.muted + '10' }]} />
      <View style={{ padding: Spacing.sm, gap: 4 }}>
        <View style={{ height: 16, width: '85%', backgroundColor: c.muted + '10', borderRadius: 4 }} />
        <View style={{ height: 12, width: '50%', backgroundColor: c.muted + '10', borderRadius: 4 }} />
      </View>
    </View>
  );
}

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
            resizeMode="contain"
            fallback={<EventImagePlaceholder />}
          />
        ) : (
          <EventImagePlaceholder />
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

// View All card component
function ViewAllCard({ onPress, label = 'View All' }: { onPress: () => void; label?: string }) {
  const c = useThemeColors();
  
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactCard,
        styles.viewAllCard,
        {
          backgroundColor: c.card,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={[styles.compactImageContainer, { backgroundColor: c.muted + '20', justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="arrow-forward" size={32} color={c.primary} />
      </View>
      <Text style={[styles.compactTitle, { color: c.primary, fontWeight: Typography.fontWeight.bold }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

// Compact square card for restaurants
function CompactFoodCard({ restaurant, onPress }: { restaurant: Restaurant & { match_percent?: number }; onPress: () => void }) {
  const c = useThemeColors();
  const [imageFailed, setImageFailed] = useState(false);
  const images = [restaurant.main_image, restaurant.image_1, restaurant.image_2, restaurant.image_3].filter(Boolean) as string[];
  const cover = images[0];

  // Reset imageFailed when cover changes
  useEffect(() => {
    setImageFailed(false);
  }, [cover]);

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
        {cover && !imageFailed ? (
          <LazyImage
            uri={cover}
            width="100%"
            height="100%"
            borderRadius={0}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Image
            source={require('../../assets/NoImageRestaurant.jpg')}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
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
  // Dynamic card count: Start with 5 for desktop (>= 1024px), 3 for mobile/tablet
  // Then add more cards as screen width increases
  const isDesktop = width >= 900;
  const baseCardCount = isDesktop ? 5 : 3;
  
  // Calculate how many cards can fit based on screen width
  // Account for padding (16px each side = 32px total) and gaps (12px between cards)
  const containerPadding = 32; // 16px * 2
  const cardGap = 12;
  const minCardWidth = 230; // Minimum reasonable card width
  const availableWidth = width - containerPadding;
  const showViewAllButton = width > 1440;
  
  // Calculate total cards that can fit (including View All button if applicable)
  const calculatedTotalCards = Math.max(
    baseCardCount,
    Math.floor((availableWidth + cardGap) / (minCardWidth + cardGap))
  );
  
  // If showing View All button, reserve space for it (subtract 1 from content cards)
  // Ensure we still show at least (baseCardCount - 1) content cards when showing View All
  const cardCount = showViewAllButton 
    ? Math.max(baseCardCount - 1, calculatedTotalCards - 1)
    : calculatedTotalCards;
  const [topEvents, setTopEvents] = useState<(Event & { match_percent?: number })[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<(Restaurant & { match_percent?: number })[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingFood, setLoadingFood] = useState(true);
  const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [selectedDecisionType, setSelectedDecisionType] = useState<'events' | 'food' | 'time' | null>(null);
  
  // Interests state
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [customInterests, setCustomInterests] = useState<string[]>([]);
  const [customInterestInput, setCustomInterestInput] = useState('');
  const [savingInterests, setSavingInterests] = useState(false);
  const [interestsExpanded, setInterestsExpanded] = useState(false);
  const [suggestedInterests, setSuggestedInterests] = useState<string[]>(() => getSuggestedInterests([], 6));

  // Refresh suggested interests when user interests change
  useEffect(() => {
    const allSelected = [...userInterests, ...customInterests];
    setSuggestedInterests(getSuggestedInterests(allSelected, 6));
  }, [userInterests, customInterests]);

  useEffect(() => {
    let mounted = true;
    
    const checkUserAndRedirect = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setSignedIn(Boolean(data.user));
      
      // If user is signed in, check if they are an organizer
      if (data.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('account_type')
          .eq('id', data.user.id)
          .single();
        
        if (!mounted) return;
        
        // Redirect organizers to organizer-profile
        if (profile?.account_type === 'organization') {
          router.replace('/(tabs)/organizer-profile');
          return;
        }
      }
    };
    
    checkUserAndRedirect();

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

  // Load user interests
  useEffect(() => {
    if (!signedIn) return;
    (async () => {
      try {
        const data = await getOnboarding();
        if (data) {
          setUserInterests(Array.isArray(data.interests) ? data.interests : []);
          setCustomInterests(Array.isArray(data.custom_interests) ? data.custom_interests : []);
        }
      } catch (e) {
        console.error('Failed to load interests:', e);
      }
    })();
  }, [signedIn]);

  // Toggle interest selection
  const toggleInterest = async (interest: string) => {
    if (savingInterests) return;
    
    const isSelected = userInterests.includes(interest);
    const previousInterests = [...userInterests];
    const previousCustom = [...customInterests];
    
    const newInterests = isSelected
      ? userInterests.filter((i) => i !== interest)
      : [...userInterests, interest];
    
    // If adding an interest that's not in POPULAR_INTERESTS, also add it to customInterests
    let newCustom = [...customInterests];
    if (!isSelected && !POPULAR_INTERESTS.includes(interest) && !customInterests.includes(interest)) {
      newCustom = [...customInterests, interest];
      setCustomInterests(newCustom);
    }
    
    setUserInterests(newInterests);
    setSavingInterests(true);
    
    try {
      // Fetch existing onboarding data to preserve other fields
      const existingData = await getOnboarding();
      
      await saveOnboarding({
        interests: newInterests,
        majors: existingData?.majors ?? [],
        custom_interests: newCustom,
        food_restrictions: existingData?.food_restrictions ?? [],
        preferences: existingData?.preferences ?? {},
      });
    } catch (e) {
      console.error('Failed to save interests:', e);
      // Revert on error using the captured previous state
      setUserInterests(previousInterests);
      setCustomInterests(previousCustom);
    } finally {
      setSavingInterests(false);
    }
  };

  // Add custom interest
  const addCustomInterest = async () => {
    const value = customInterestInput.trim();
    if (!value || savingInterests) return;
    if (userInterests.includes(value) || customInterests.includes(value)) {
      setCustomInterestInput('');
      return;
    }
    
    const previousInterests = [...userInterests];
    const previousCustom = [...customInterests];
    
    const newInterests = [...userInterests, value];
    const newCustom = [...customInterests, value];
    
    setUserInterests(newInterests);
    setCustomInterests(newCustom);
    setCustomInterestInput('');
    setSavingInterests(true);
    
    try {
      // Fetch existing onboarding data to preserve other fields
      const existingData = await getOnboarding();
      
      await saveOnboarding({
        interests: newInterests,
        majors: existingData?.majors ?? [],
        custom_interests: newCustom,
        food_restrictions: existingData?.food_restrictions ?? [],
        preferences: existingData?.preferences ?? {},
      });
    } catch (e) {
      console.error('Failed to save custom interest:', e);
      // Revert on error using the captured previous state
      setUserInterests(previousInterests);
      setCustomInterests(previousCustom);
    } finally {
      setSavingInterests(false);
    }
  };

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
            // events loaded
          } else {
            // no events found
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
          } else {
            // If no restaurants found, try loading popular restaurants as fallback
            try {
              const fallbackRestaurants = await listRestaurants(0, cardCount);
              if (fallbackRestaurants && fallbackRestaurants.length > 0) {
                setTopRestaurants(fallbackRestaurants as any);
              }
            } catch (fallbackError) {
              console.error('Fallback restaurants also failed:', fallbackError);
            }
          }
        } catch (e) {
          console.error('Failed to load restaurants:', e);
          // Try fallback on error too
          try {
            const fallbackRestaurants = await listRestaurants(0, cardCount);
            if (fallbackRestaurants && fallbackRestaurants.length > 0) {
              setTopRestaurants(fallbackRestaurants as any);
            }
          } catch (fallbackError) {
            console.error('Fallback restaurants also failed:', fallbackError);
          }
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

      // For non-signed-in users, also show popular restaurants
      (async () => {
        try {
          const restaurants = await listRestaurants(0, cardCount);
          if (restaurants && restaurants.length > 0) {
            setTopRestaurants(restaurants as any);
          }
        } catch (e) {
          console.error('Failed to load restaurants:', e);
        } finally {
          setLoadingFood(false);
        }
      })();
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
                    backgroundColor: c.background,
                    borderBottomColor: c.muted + '30',
                  },
          ]}
        >
          <Text style={[styles.headerTitle, { color: c.text, marginTop: 10 }]}>Picky!</Text>
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
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 96 }}
          style={{ flex: 1 }}
        >
          {/* Row 1: Discover Events */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Discover Events</Text>
              <Pressable
                onPress={() => router.push('/(tabs)/discover?mode=events')}
                style={styles.viewAllButton}
              >
                <Text style={[styles.viewAllText, { color: c.primary }]}>View All</Text>
                <Ionicons name="chevron-forward" size={16} color={c.primary} />
              </Pressable>
            </View>
            {loadingEvents ? (
              <View style={styles.compactGrid}>
                {Array.from({ length: cardCount }).map((_, i) => (
                  <SkeletonCard key={`skeleton-event-${i}`} />
                ))}
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
                {showViewAllButton && (
                  <ViewAllCard
                    onPress={() => router.push('/(tabs)/discover?mode=events')}
                    label="View All"
                  />
                )}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyStateText, { color: c.muted }]}>
                  No events found. Check back later!
                </Text>
              </View>
            )}
          </View>

          {/* Row 2: Food */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Find Food</Text>
              <Pressable
                onPress={() => router.push('/(tabs)/discover?mode=food')}
                style={styles.viewAllButton}
              >
                <Text style={[styles.viewAllText, { color: c.primary }]}>View All</Text>
                <Ionicons name="chevron-forward" size={16} color={c.primary} />
              </Pressable>
            </View>
            {loadingFood ? (
              <View style={styles.compactGrid}>
                {Array.from({ length: cardCount }).map((_, i) => (
                  <SkeletonCard key={`skeleton-food-${i}`} />
                ))}
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
                {showViewAllButton && (
                  <ViewAllCard
                    onPress={() => router.push('/(tabs)/discover?mode=food')}
                    label="View All"
                  />
                )}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyStateText, { color: c.muted }]}>
                  No restaurants found. Check back later!
                </Text>
              </View>
            )}
          </View>

          {/* Row 3: Quick Actions */}
          <View style={styles.section}>
            <View style={styles.groupDecideGrid}>
              <Pressable
                onPress={() => router.push('/QuickPick')}
                style={[styles.groupDecideCard, { backgroundColor: c.card }]}
              >
                <Ionicons name="people-outline" size={32} color={c.primary} />
                <Text style={[styles.groupDecideText, { color: c.text }]}>Decide with a group</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/groups?tab=organizations')}
                style={[styles.groupDecideCard, { backgroundColor: c.card }]}
              >
                <Ionicons name="business-outline" size={32} color={c.primary} />
                <Text style={[styles.groupDecideText, { color: c.text }]}>View organizations</Text>
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL('https://forms.gle/xyymx87MoF6WXnBW8')}
                style={[styles.groupDecideCard, { backgroundColor: c.card }]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={32} color={c.primary} />
                <Text style={[styles.groupDecideText, { color: c.text }]}>Feedback</Text>
              </Pressable>
            </View>
          </View>

          {/* Row 4: Interests & Tags Section */}
          {signedIn && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="heart-outline" size={20} color={c.primary} />
                  <Text style={[styles.sectionTitle, { color: c.text }]}>Your Interests</Text>
                </View>
                <Pressable
                  onPress={() => setInterestsExpanded(!interestsExpanded)}
                  style={styles.viewAllButton}
                >
                  <Text style={[styles.viewAllText, { color: c.primary }]}>
                    {interestsExpanded ? 'Show Less' : 'Edit'}
                  </Text>
                  <Ionicons 
                    name={interestsExpanded ? 'chevron-up' : 'chevron-down'} 
                    size={16} 
                    color={c.primary} 
                  />
                </Pressable>
              </View>

              {/* Selected interests summary */}
              {userInterests.length > 0 && !interestsExpanded && (
                <View style={styles.interestsChipContainer}>
                  {userInterests.slice(0, 5).map((interest) => (
                    <Pressable
                      key={interest}
                      onPress={() => toggleInterest(interest)}
                      style={[styles.interestChip, styles.interestChipSelected, { backgroundColor: `${c.primary}20`, borderColor: c.primary }]}
                    >
                      <Text style={[styles.interestChipText, { color: c.primary }]}>{interest}</Text>
                      <Ionicons name="close" size={14} color={c.primary} style={{ marginLeft: 4 }} />
                    </Pressable>
                  ))}
                  {userInterests.length > 5 && (
                    <Pressable
                      onPress={() => setInterestsExpanded(true)}
                      style={[styles.interestChip, { backgroundColor: c.card, borderColor: c.muted + '40' }]}
                    >
                      <Text style={[styles.interestChipText, { color: c.muted }]}>+{userInterests.length - 5} more</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Suggested interests - always visible when collapsed and has selected interests */}
              {!interestsExpanded && suggestedInterests.length > 0 && (
                <View style={{ marginTop: userInterests.length > 0 ? Spacing.md : 0 }}>
                  <Text style={[styles.suggestedLabel, { color: c.muted }]}>
                    <Ionicons name="sparkles" size={12} color={c.muted} /> Suggested for you
                  </Text>
                  <View style={styles.interestsChipContainer}>
                    {suggestedInterests.slice(0, 4).map((interest) => (
                      <Pressable
                        key={interest}
                        onPress={() => toggleInterest(interest)}
                        style={[styles.interestChip, styles.suggestedChip, { backgroundColor: c.card, borderColor: c.primary + '40' }]}
                      >
                        <Ionicons name="add" size={14} color={c.primary} style={{ marginRight: 4 }} />
                        <Text style={[styles.interestChipText, { color: c.text }]}>{interest}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {/* Empty state */}
              {userInterests.length === 0 && !interestsExpanded && suggestedInterests.length === 0 && (
                <Pressable
                  onPress={() => setInterestsExpanded(true)}
                  style={[styles.emptyInterestsCard, { backgroundColor: c.card, borderColor: c.muted + '30' }]}
                >
                  <Ionicons name="add-circle-outline" size={24} color={c.primary} />
                  <Text style={[styles.emptyInterestsText, { color: c.text }]}>
                    Add your interests to get better recommendations
                  </Text>
                </Pressable>
              )}

              {/* Expanded view with all interests */}
              {interestsExpanded && (
                <View style={{ marginTop: Spacing.sm }}>
                  {/* Suggested interests at the top */}
                  {suggestedInterests.length > 0 && (
                    <>
                      <View style={styles.suggestedHeaderRow}>
                        <Ionicons name="sparkles" size={16} color={c.primary} />
                        <Text style={[styles.interestsCategoryLabel, { color: c.primary, marginBottom: 0, marginLeft: 6 }]}>
                          Suggested for you
                        </Text>
                      </View>
                      <View style={[styles.interestsChipContainer, { marginBottom: Spacing.lg }]}>
                        {suggestedInterests.map((interest) => (
                          <Pressable
                            key={interest}
                            onPress={() => toggleInterest(interest)}
                            style={[styles.interestChip, styles.suggestedChip, { backgroundColor: `${c.primary}10`, borderColor: c.primary + '60' }]}
                          >
                            <Ionicons name="add" size={14} color={c.primary} style={{ marginRight: 4 }} />
                            <Text style={[styles.interestChipText, { color: c.primary }]}>{interest}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Your selected interests */}
                  {userInterests.length > 0 && (
                    <>
                      <Text style={[styles.interestsCategoryLabel, { color: c.muted }]}>Your Interests</Text>
                      <View style={[styles.interestsChipContainer, { marginBottom: Spacing.lg }]}>
                        {userInterests.map((interest) => (
                          <Pressable
                            key={interest}
                            onPress={() => toggleInterest(interest)}
                            style={[
                              styles.interestChip,
                              styles.interestChipSelected,
                              { backgroundColor: `${c.primary}20`, borderColor: c.primary },
                            ]}
                          >
                            <Ionicons name="checkmark" size={14} color={c.primary} style={{ marginRight: 4 }} />
                            <Text style={[styles.interestChipText, { color: c.primary }]}>{interest}</Text>
                            <Ionicons name="close" size={14} color={c.primary} style={{ marginLeft: 4 }} />
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Browse all interests by category */}
                  <Text style={[styles.interestsCategoryLabel, { color: c.muted }]}>Browse All</Text>
                  {Object.entries(ALL_INTEREST_TAGS).map(([category, tags]) => (
                    <View key={category} style={{ marginBottom: Spacing.md }}>
                      <Text style={[styles.categorySubLabel, { color: c.text }]}>{category}</Text>
                      <View style={styles.interestsChipContainer}>
                        {tags.map((interest) => {
                          const isSelected = userInterests.includes(interest);
                          return (
                            <Pressable
                              key={interest}
                              onPress={() => toggleInterest(interest)}
                              style={[
                                styles.interestChip,
                                isSelected && styles.interestChipSelected,
                                {
                                  backgroundColor: isSelected ? `${c.primary}20` : c.card,
                                  borderColor: isSelected ? c.primary : c.muted + '40',
                                },
                              ]}
                            >
                              {isSelected ? (
                                <Ionicons name="checkmark" size={14} color={c.primary} style={{ marginRight: 4 }} />
                              ) : (
                                <Ionicons name="add" size={14} color={c.muted} style={{ marginRight: 4 }} />
                              )}
                              <Text
                                style={[
                                  styles.interestChipText,
                                  { color: isSelected ? c.primary : c.text },
                                ]}
                              >
                                {interest}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))}

                  {/* Add custom interest input */}
                  <View style={[styles.customInterestInputContainer, { backgroundColor: c.card, borderColor: c.muted + '40' }]}>
                    <TextInput
                      value={customInterestInput}
                      onChangeText={setCustomInterestInput}
                      placeholder="Add a custom interest..."
                      placeholderTextColor={c.muted}
                      style={[styles.customInterestInput, { color: c.text }]}
                      onSubmitEditing={addCustomInterest}
                      returnKeyType="done"
                    />
                    <Pressable
                      onPress={addCustomInterest}
                      disabled={!customInterestInput.trim() || savingInterests}
                      style={[
                        styles.addInterestButton,
                        {
                          backgroundColor: customInterestInput.trim() ? c.primary : c.muted + '40',
                          opacity: savingInterests ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="add" size={20} color={customInterestInput.trim() ? '#fff' : c.muted} />
                    </Pressable>
                  </View>

                  {savingInterests && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm }}>
                      <ActivityIndicator size="small" color={c.primary} />
                      <Text style={{ marginLeft: 8, color: c.muted, fontSize: Typography.scale.bodySmall.fontSize }}>
                        Saving...
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          <View style={{ paddingHorizontal: Spacing.md, marginTop: Spacing.xl }}>
            
              <Text
                style={{
                  fontStyle: 'italic',
                  color: c.text,
                  fontSize: Typography.scale.body.fontSize,
                  lineHeight: Typography.scale.bodyLarge.lineHeight,
                  fontFamily: Typography.fontFamily.body,
                  fontWeight: Typography.fontWeight.semibold,
                  textAlign: 'center',
                }}
              >
                Smart Picks. Faster Plans. Greatest Hangouts!
              </Text>
          </View>

          {/* Footer with Privacy Policy link */}
          <View style={{ paddingHorizontal: Spacing.md, marginTop: Spacing.xl, marginBottom: Spacing.lg, alignItems: 'center' }}>
            <Pressable
              onPress={() => Linking.openURL('https://usepicky.app/privacy')}
              style={({ pressed }) => ({
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={{
                  color: c.muted,
                  fontSize: Typography.scale.bodySmall.fontSize,
                  lineHeight: Typography.scale.bodySmall.lineHeight,
                  fontFamily: Typography.fontFamily.body,
                  fontWeight: Typography.fontWeight.regular,
                  textAlign: 'center',
                  textDecorationLine: 'underline',
                }}
              >
                Privacy Policy
              </Text>
            </Pressable>
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
    fontSize: Typography.scale.display.fontSize - 2,
    lineHeight: Typography.scale.display.lineHeight - 2,
    fontWeight: Typography.fontWeight.regular,
    letterSpacing: 0,
    fontFamily: Platform.OS === 'ios' ? 'Pacifico_400Regular' : Typography.fontFamily.brand,
    // no extra margin; rely on header padding
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
    ...Shadows.light.sm, // Slight drop shadow
  },
  viewAllCard: {
    borderStyle: 'dashed',
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
    // no shadow: keep chips flat on home cards
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
    ...Shadows.light.sm, // Slight drop shadow
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
  // Interests section styles
  interestsChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  interestChipSelected: {
    // Styles applied dynamically via inline styles
  },
  interestChipText: {
    fontSize: Typography.scale.body.fontSize,
    lineHeight: Typography.scale.body.lineHeight,
    fontFamily: Typography.fontFamily.body,
    fontWeight: Typography.fontWeight.medium,
  },
  interestsCategoryLabel: {
    fontSize: Typography.scale.bodySmall.fontSize,
    lineHeight: Typography.scale.bodySmall.lineHeight,
    fontFamily: Typography.fontFamily.body,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestedLabel: {
    fontSize: Typography.scale.bodySmall.fontSize,
    lineHeight: Typography.scale.bodySmall.lineHeight,
    fontFamily: Typography.fontFamily.body,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  suggestedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  suggestedChip: {
    // Additional styles for suggested chips
  },
  categorySubLabel: {
    fontSize: Typography.scale.body.fontSize,
    lineHeight: Typography.scale.body.lineHeight,
    fontFamily: Typography.fontFamily.body,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  emptyInterestsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: Spacing.sm,
  },
  emptyInterestsText: {
    flex: 1,
    fontSize: Typography.scale.body.fontSize,
    lineHeight: Typography.scale.body.lineHeight,
    fontFamily: Typography.fontFamily.body,
    fontWeight: Typography.fontWeight.regular,
  },
  customInterestInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
    paddingLeft: Spacing.md,
    overflow: 'hidden',
  },
  customInterestInput: {
    flex: 1,
    fontSize: Typography.scale.body.fontSize,
    fontFamily: Typography.fontFamily.body,
    paddingVertical: Spacing.sm + 2,
  },
  addInterestButton: {
    padding: Spacing.sm + 2,
    marginLeft: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginRight: 4,
  },
});
