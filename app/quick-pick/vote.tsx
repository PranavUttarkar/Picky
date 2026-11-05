import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Animated, Dimensions, ActivityIndicator, Image, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GradientBackground from '@/components/GradientBackground';
import SwipeDeck from '@/components/SwipeDeck';
import LazyImage from '@/components/LazyImage';
import EventImagePlaceholder from '@/components/EventImagePlaceholder';
import Avatar from '@/components/Avatar';
import { Typography, Spacing, BorderRadius, Gradients } from '@/theme/designTokens';
import { 
  getSessionRecommendations, 
  createSessionPoll,
  getSessionParticipants,
  calculateSessionProgress,
  type DecisionCategory,
  type SessionParticipant,
} from '@/services/quickPick';
import { castRating, onPollRealtime, getPoll, suggestLeader, getLatestGroupPoll, closePoll, castTextVote } from '@/services/polls';
import { triggerGroupDecisionNotification } from '@/utils/notifications';
import { getRestaurantById, restaurantImages } from '@/services/food';
import type { Event, Restaurant, ScoredRestaurant } from '@/types/models';
import type { ScoredEvent } from '@/services/events';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type VoteItem = {
  id: string;
  type: 'event' | 'food';
  title: string;
  subtitle: string;
  image?: string;
  matchPercent?: number;
  data: ScoredEvent | ScoredRestaurant;
};

/**
 * Quick Pick Vote Screen
 * Swipe through options and rate them
 */
export default function QuickPickVote() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const { groupId, groupName, category, windowStart, windowEnd } = useLocalSearchParams<{
    groupId: string;
    groupName?: string;
    category: string;
    windowStart: string;
    windowEnd: string;
  }>();
  
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<VoteItem[]>([]);
  const [pollId, setPollId] = useState<number | null>(null);
  const [pollMode, setPollMode] = useState<'default' | 'rating'>('default');
  const [pollOptions, setPollOptions] = useState<any[]>([]); // Store poll options with proper IDs
  
  // For "both" category: track separate polls and phases
  const [isMegaPoll, setIsMegaPoll] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'events' | 'food'>('events');
  const [eventsPollId, setEventsPollId] = useState<number | null>(null);
  const [foodPollId, setFoodPollId] = useState<number | null>(null);
  const [eventsComplete, setEventsComplete] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [eventItems, setEventItems] = useState<VoteItem[]>([]);
  const [foodItems, setFoodItems] = useState<VoteItem[]>([]);
  
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [votedCount, setVotedCount] = useState(0);
  const [myVotes, setMyVotes] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [waitingForOthers, setWaitingForOthers] = useState(false);
  const [totalMembers, setTotalMembers] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showEndPollWarning, setShowEndPollWarning] = useState(false);
  const [endingPoll, setEndingPoll] = useState(false);
  
  // Animation
  const fadeAnim = useState(() => new Animated.Value(0))[0];
  const progressAnim = useState(() => new Animated.Value(0))[0];
  
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    
    loadRecommendations();
  }, []);
  
  // Update progress bar animation
  useEffect(() => {
    const progress = items.length > 0 ? currentIndex / items.length : 0;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [currentIndex, items.length]);
  
  const loadRecommendations = async () => {
    if (!groupId) return;
    
    try {
      const gid = parseInt(groupId, 10);
      
      // Load participants
      const parts = await getSessionParticipants(gid);
      setParticipants(parts);
      
      // Check if this is a late joiner (no time window params) - look for existing poll
      const isLateJoiner = !windowStart || !windowEnd || !category;
      
      if (isLateJoiner) {
        // Try to find existing poll for this group
        const existingPoll = await getLatestGroupPoll(gid);
        
        if (existingPoll) {
          // Load the existing poll's options
          const pollData = await getPoll(existingPoll.pollId);
          setPollId(existingPoll.pollId);
          setPollMode(pollData.poll?.mode || 'default');
          setPollOptions(pollData.options || []);
          setVotedCount(pollData.respondedCount);
          setTotalMembers(pollData.totalMembers);
          
          // Convert poll options to VoteItems
          const voteItems: VoteItem[] = pollData.options.map((opt): VoteItem => {
            if (opt.kind === 'event' && opt.event) {
              return {
                id: `event-${opt.id}`,
                type: 'event',
                title: opt.event.title,
                subtitle: opt.event.location || formatDate(opt.event.date_time),
                image: opt.event.image_url || undefined,
                matchPercent: opt.match_percent,
                data: opt.event as any,
              };
            } else if (opt.kind === 'text') {
              // Parse food options
              const foodMatch = opt.text.match(/\[FOOD:([^\]]+)\](.+)/);
              const eventMatch = opt.text.match(/\[EVENT:(\d+)\](.+)/);
              if (foodMatch) {
                return {
                  id: `food-${opt.id}`,
                  type: 'food',
                  title: foodMatch[2].trim(),
                  subtitle: 'Restaurant',
                  matchPercent: undefined,
                  data: { id: foodMatch[1], restaurant_name: foodMatch[2].trim() } as any,
                };
              } else if (eventMatch) {
                return {
                  id: `event-${opt.id}`,
                  type: 'event',
                  title: eventMatch[2].trim(),
                  subtitle: 'Event',
                  matchPercent: undefined,
                  data: { id: parseInt(eventMatch[1]), title: eventMatch[2].trim() } as any,
                };
              }
              return {
                id: `text-${opt.id}`,
                type: 'event',
                title: opt.text,
                subtitle: '',
                data: { id: opt.id, title: opt.text } as any,
              };
            }
            return {
              id: `unknown-${opt.id}`,
              type: 'event',
              title: 'Unknown',
              subtitle: '',
              data: {} as any,
            };
          });
          
          setItems(voteItems);
          setLoading(false);
          return;
        } else {
          // No existing poll and no params - can't proceed
          setError('This session hasn\'t started yet. Ask the host to begin!');
          setLoading(false);
          return;
        }
      }
      
      // Normal flow - creator with time/category params
      const start = new Date(windowStart);
      const end = new Date(windowEnd);
      const cat = category as DecisionCategory;
      
      // Get recommendations
      const { events, restaurants } = await getSessionRecommendations(gid, cat, start, end);
      
      // Check if this is a "both" mega poll
      if (cat === 'both' && events.length > 0 && restaurants.length > 0) {
        setIsMegaPoll(true);
        setCurrentPhase('events');
        
        // Create separate polls for events and food
        const eventPollId = await createSessionPoll(
          gid,
          'events',
          events,
          [],
          `${groupName || 'Quick Pick'} - Events`
        );
        setEventsPollId(eventPollId);
        
        const foodPollId = await createSessionPoll(
          gid,
          'food',
          [],
          restaurants,
          `${groupName || 'Quick Pick'} - Food`
        );
        setFoodPollId(foodPollId);
        
        // Set current poll to events poll
        setPollId(eventPollId);
        const eventPollData = await getPoll(eventPollId);
        setPollMode(eventPollData.poll?.mode || 'default');
        setPollOptions(eventPollData.options || []);
        
        // Prepare event items
        const eventVoteItems: VoteItem[] = events.map((e): VoteItem => ({
          id: `event-${e.id}`,
          type: 'event',
          title: e.title,
          subtitle: e.location || formatDate(e.date_time),
          image: e.image_url || undefined,
          matchPercent: e.match_percent,
          data: e,
        }));
        
        // Prepare food items (for later)
        const foodVoteItems: VoteItem[] = restaurants.map((r): VoteItem => ({
          id: `food-${r.id}`,
          type: 'food',
          title: r.restaurant_name,
          subtitle: r.category || r.address || '',
          image: r.main_image || undefined,
          matchPercent: r.match_percent,
          data: r,
        }));
        
        shuffleArray(eventVoteItems);
        shuffleArray(foodVoteItems);
        
        setEventItems(eventVoteItems);
        setFoodItems(foodVoteItems);
        setItems(eventVoteItems); // Start with events
      } else {
        // Single category poll (events, food, or both with only one type)
        setIsMegaPoll(false);
        
        // Convert to VoteItems
        const voteItems: VoteItem[] = [
          ...events.map((e): VoteItem => ({
            id: `event-${e.id}`,
            type: 'event',
            title: e.title,
            subtitle: e.location || formatDate(e.date_time),
            image: e.image_url || undefined,
            matchPercent: e.match_percent,
            data: e,
          })),
          ...restaurants.map((r): VoteItem => ({
            id: `food-${r.id}`,
            type: 'food',
            title: r.restaurant_name,
            subtitle: r.category || r.address || '',
            image: r.main_image || undefined,
            matchPercent: r.match_percent,
            data: r,
          })),
        ];
        
        // Shuffle for variety
        shuffleArray(voteItems);
        
        setItems(voteItems);
        
        // Create poll
        const newPollId = await createSessionPoll(
          gid,
          cat,
          events,
          restaurants,
          groupName || 'Quick Pick'
        );
        setPollId(newPollId);
        
        // Load the created poll to get mode and option IDs
        const pollData = await getPoll(newPollId);
        setPollMode(pollData.poll?.mode || 'default');
        setPollOptions(pollData.options || []);
      }
      
    } catch (e: any) {
      console.error('Failed to load recommendations:', e);
      setError(e.message || 'Failed to load options');
    } finally {
      setLoading(false);
    }
  };
  
  // Subscribe to poll updates
  useEffect(() => {
    if (!pollId) return;
    
    const unsubscribe = onPollRealtime(pollId, async () => {
      try {
        const pollData = await getPoll(pollId);
        setVotedCount(pollData.respondedCount);
        setTotalMembers(pollData.totalMembers);
        
        // Check if everyone has voted - auto-navigate to group chat
        if (pollData.respondedCount >= pollData.totalMembers && pollData.totalMembers > 0 && waitingForOthers) {
          setIsComplete(true);
          setTimeout(() => {
            router.replace(`/(tabs)/groups/${groupId}`);
          }, 1000);
        }
      } catch (e) {
        console.warn('Poll refresh failed:', e);
      }
    });
    
    return () => unsubscribe?.();
  }, [pollId, waitingForOthers, groupId]);
  
  const handleSwipeRight = async (item: VoteItem, index: number) => {
    // Love it! (+1)
    await submitRating(item, 1);
    setCurrentIndex(index + 1);
  };
  
  const handleSwipeLeft = async (item: VoteItem, index: number) => {
    // Not for me (-1)
    await submitRating(item, -1);
    setCurrentIndex(index + 1);
  };
  
  const handleSwipeUp = async (item: VoteItem, index: number) => {
    // Fine (0) / neutral
    await submitRating(item, 0);
    setCurrentIndex(index + 1);
  };
  
  const submitRating = async (item: VoteItem, rating: number) => {
    if (!pollId) return;
    
    try {
      // Track locally
      setMyVotes(prev => ({ ...prev, [item.id]: rating }));
      
      // For rating mode polls, cast rating for the event
      if (pollMode === 'rating' && item.type === 'event') {
        const eventId = (item.data as ScoredEvent).id;
        await castRating(pollId, eventId, rating as -1 | 0 | 1);
      }
      // For text-based polls or mixed polls with food, find the matching option
      else if (pollOptions.length > 0) {
        // Find the poll option that matches this item
        const matchingOption = pollOptions.find(opt => {
          if (opt.kind === 'event' && item.type === 'event') {
            return opt.id === (item.data as ScoredEvent).id;
          } else if (opt.kind === 'text') {
            // Match by checking if the option text contains the item title
            const optText = opt.text || '';
            return optText.includes(item.title) || optText.includes(String((item.data as any).id || ''));
          }
          return false;
        });
        
        if (matchingOption) {
          // For rating mode with events, use castRating
          if (pollMode === 'rating' && matchingOption.kind === 'event') {
            await castRating(pollId, matchingOption.id, rating as -1 | 0 | 1);
          }
          // For text options, use castTextVote only if rating is positive (1)
          // Note: text polls don't have rating system, only single vote
          else if (matchingOption.kind === 'text' && rating === 1) {
            await castTextVote(pollId, matchingOption.id);
          }
        }
      }
    } catch (e) {
      console.warn('Rating failed:', e);
    }
  };
  
  const handleComplete = async () => {
    // User finished voting - check if we need to transition to food phase or go to group chat
    if (!pollId || !groupId) return;
    
    try {
      // For mega polls, handle phase transition
      if (isMegaPoll && currentPhase === 'events' && !eventsComplete) {
        // User finished events, show transition screen
        setEventsComplete(true);
        setShowTransition(true);
        return;
      }
      
      const pollData = await getPoll(pollId);
      setVotedCount(pollData.respondedCount);
      setTotalMembers(pollData.totalMembers);
      
      // If everyone has voted, show celebration then go to group
      if (pollData.respondedCount >= pollData.totalMembers && pollData.totalMembers > 0) {
        setIsComplete(true);
        setTimeout(() => {
          // Go back to group chat - the poll(s) will be displayed there
          router.replace(`/(tabs)/groups/${groupId}`);
        }, 1500);
      } else {
        // Show waiting screen, but allow user to go back to group
        setWaitingForOthers(true);
      }
    } catch (e) {
      // Fallback: go back to group
      router.replace(`/(tabs)/groups/${groupId}`);
    }
  };
  
  const handleSeeResultsEarly = () => {
    // Go back to group chat to see current results
    router.replace(`/(tabs)/groups/${groupId}`);
  };
  
  const handleEndPoll = async () => {
    if (!pollId || endingPoll) return;
    
    setEndingPoll(true);
    try {
      await closePoll(pollId);
      await triggerGroupDecisionNotification();
      setShowEndPollWarning(false);
      // Navigate to group chat to see final results
      router.replace(`/(tabs)/groups/${groupId}`);
    } catch (e) {
      console.error('Failed to end poll:', e);
      Alert.alert('Error', 'Failed to end poll. Please try again.');
    } finally {
      setEndingPoll(false);
    }
  };
  
  const { percent, label } = calculateSessionProgress(participants.length, votedCount);
  
  const renderCard = useCallback((item: VoteItem) => (
    <View style={{
      width: SCREEN_WIDTH - Spacing.lg * 2,
      height: SCREEN_HEIGHT * 0.55,
      backgroundColor: scheme === 'dark' ? '#1a1a1a' : '#fff',
      borderRadius: BorderRadius.xl,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 8,
    }}>
      {/* Image */}
      <View style={{ flex: 1, backgroundColor: c.muted + '20' }}>
        {item.image ? (
          <LazyImage
            uri={item.image}
            width="100%"
            height="100%"
            resizeMode={item.type === 'event' ? 'contain' : 'cover'}
            fallback={item.type === 'event' ? <EventImagePlaceholder /> : undefined}
          />
        ) : (
          item.type === 'event' ? <EventImagePlaceholder /> : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
              <Text style={{ fontSize: 64 }}>🍕</Text>
            </View>
          )
        )}
        
        {/* Match badge */}
        {item.matchPercent && item.matchPercent > 60 && (
          <View style={{
            position: 'absolute',
            top: Spacing.md,
            right: Spacing.md,
            backgroundColor: '#10B981',
            paddingHorizontal: Spacing.sm,
            paddingVertical: Spacing.xs,
            borderRadius: BorderRadius.full,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <Ionicons name="sparkles" size={14} color="#fff" />
            <Text style={{
              color: '#fff',
              fontSize: Typography.scale.bodySmall.fontSize,
              fontWeight: '700',
              marginLeft: 4,
            }}>
              {item.matchPercent}% match
            </Text>
          </View>
        )}
        
        {/* Type badge */}
        <View style={{
          position: 'absolute',
          top: Spacing.md,
          left: Spacing.md,
          backgroundColor: 'rgba(0,0,0,0.6)',
          paddingHorizontal: Spacing.sm,
          paddingVertical: Spacing.xs,
          borderRadius: BorderRadius.full,
        }}>
          <Text style={{
            color: '#fff',
            fontSize: Typography.scale.bodySmall.fontSize,
            fontWeight: '600',
          }}>
            {item.type === 'event' ? '🎉 Event' : '🍕 Food'}
          </Text>
        </View>
      </View>
      
      {/* Info */}
      <View style={{ 
        padding: Spacing.lg,
        backgroundColor: scheme === 'dark' ? '#1a1a1a' : '#fff',
      }}>
        <Text style={{
          color: c.text,
          fontSize: Typography.scale.heading3.fontSize,
          fontWeight: '700',
          marginBottom: Spacing.xs,
        }} numberOfLines={2}>
          {item.title}
        </Text>
        
        <Text style={{
          color: c.muted,
          fontSize: Typography.scale.body.fontSize,
        }} numberOfLines={1}>
          {item.subtitle}
        </Text>
      </View>
    </View>
  ), [scheme, c]);
  
  if (loading) {
    return (
      <GradientBackground variant="dim">
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: c.primary + '20',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: Spacing.lg,
          }}>
            <ActivityIndicator size="large" color={c.primary} />
          </View>
          <Text style={{
            color: c.text,
            fontSize: Typography.scale.bodyLarge.fontSize,
            fontWeight: '600',
          }}>
            Finding the best options...
          </Text>
          <Text style={{
            color: c.muted,
            fontSize: Typography.scale.body.fontSize,
            marginTop: Spacing.sm,
          }}>
            Matching with your group's preferences
          </Text>
        </SafeAreaView>
      </GradientBackground>
    );
  }
  
  const isLateJoinerError = error?.includes('hasn\'t started yet');
  
  if (error || items.length === 0) {
    return (
      <GradientBackground variant="dim">
        <SafeAreaView style={{ flex: 1, padding: Spacing.lg }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 48, marginBottom: Spacing.lg }}>
              {isLateJoinerError ? '⏳' : '😕'}
            </Text>
            <Text style={{
              color: c.text,
              fontSize: Typography.scale.heading3.fontSize,
              fontWeight: '700',
              textAlign: 'center',
              marginBottom: Spacing.md,
            }}>
              {error || 'No options found'}
            </Text>
            <Text style={{
              color: c.muted,
              fontSize: Typography.scale.body.fontSize,
              textAlign: 'center',
              maxWidth: 280,
            }}>
              {isLateJoinerError 
                ? 'The host needs to pick a time and category first. Check back soon!'
                : 'Try a different time window or category'}
            </Text>
            
            <Pressable
              onPress={() => router.back()}
              style={{
                marginTop: Spacing.xl,
                paddingHorizontal: Spacing.xl,
                paddingVertical: Spacing.md,
                backgroundColor: c.primary,
                borderRadius: BorderRadius.lg,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                Go Back
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }
  
  if (isComplete) {
    return (
      <GradientBackground variant="dim">
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{
            alignItems: 'center',
            opacity: fadeAnim,
          }}>
            <Text style={{ fontSize: 72, marginBottom: Spacing.lg }}>🎉</Text>
            <Text style={{
              color: c.text,
              fontSize: Typography.scale.heading2.fontSize,
              fontWeight: '700',
              textAlign: 'center',
              marginBottom: Spacing.sm,
            }}>
              {isMegaPoll && currentPhase === 'food' ? 'All Done!' : 'Everyone voted!'}
            </Text>
            <Text style={{
              color: c.muted,
              fontSize: Typography.scale.body.fontSize,
              textAlign: 'center',
            }}>
              Heading back to the group...
            </Text>
          </Animated.View>
        </SafeAreaView>
      </GradientBackground>
    );
  }
  
  // Transition screen between events and food for mega polls
  if (isMegaPoll && showTransition) {
    return (
      <GradientBackground variant="dim">
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl }}>
          <Animated.View style={{
            alignItems: 'center',
            opacity: fadeAnim,
          }}>
            <Text style={{ fontSize: 72, marginBottom: Spacing.lg }}>🍕</Text>
            <Text style={{
              color: c.text,
              fontSize: Typography.scale.heading2.fontSize,
              fontWeight: '700',
              textAlign: 'center',
              marginBottom: Spacing.sm,
            }}>
              Events Done!
            </Text>
            <Text style={{
              color: c.muted,
              fontSize: Typography.scale.body.fontSize,
              textAlign: 'center',
              marginBottom: Spacing['2xl'],
              maxWidth: 280,
            }}>
              Now let's pick where to eat
            </Text>
            
            <Pressable
              onPress={async () => {
                // Transition to food phase
                setShowTransition(false);
                setCurrentPhase('food');
                setCurrentIndex(0);
                setMyVotes({}); // Reset votes for food phase
                
                // Switch to food poll
                if (foodPollId) {
                  setPollId(foodPollId);
                  const foodPollData = await getPoll(foodPollId);
                  setPollMode(foodPollData.poll?.mode || 'default');
                  setPollOptions(foodPollData.options || []);
                  setItems(foodItems);
                }
              }}
              style={({ pressed }) => ({
                backgroundColor: c.primary,
                paddingHorizontal: Spacing.xl,
                paddingVertical: Spacing.md,
                borderRadius: BorderRadius.lg,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{
                color: '#fff',
                fontSize: Typography.scale.bodyLarge.fontSize,
                fontWeight: '700',
              }}>
                Start Rating Food
              </Text>
            </Pressable>
          </Animated.View>
        </SafeAreaView>
      </GradientBackground>
    );
  }
  
  // Waiting for others screen
  if (waitingForOthers) {
    const remaining = Math.max(0, totalMembers - votedCount);
    return (
      <GradientBackground variant="dim">
        <SafeAreaView style={{ flex: 1, padding: Spacing.lg }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 64, marginBottom: Spacing.lg }}>⏳</Text>
            <Text style={{
              color: c.text,
              fontSize: Typography.scale.heading2.fontSize,
              fontWeight: '700',
              textAlign: 'center',
              marginBottom: Spacing.sm,
            }}>
              You're all set!
            </Text>
            <Text style={{
              color: c.muted,
              fontSize: Typography.scale.body.fontSize,
              textAlign: 'center',
              marginBottom: Spacing.lg,
              maxWidth: 280,
              lineHeight: 22,
            }}>
              Waiting for {remaining} more {remaining === 1 ? 'person' : 'people'} to vote...
            </Text>
            
            {/* Progress indicator */}
            <View style={{
              width: 200,
              height: 8,
              backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              borderRadius: 4,
              overflow: 'hidden',
              marginBottom: Spacing.xl,
            }}>
              <View style={{
                width: `${totalMembers > 0 ? (votedCount / totalMembers) * 100 : 0}%`,
                height: '100%',
                backgroundColor: c.primary,
                borderRadius: 4,
              }} />
            </View>
            
            <Text style={{
              color: c.muted,
              fontSize: Typography.scale.bodySmall.fontSize,
              marginBottom: Spacing.xl,
            }}>
              {votedCount} of {totalMembers} voted
            </Text>
            
            {/* Participants */}
            <View style={{ flexDirection: 'row', marginBottom: Spacing['2xl'] }}>
              {participants.slice(0, 5).map((p, i) => (
                <View key={p.id} style={{ marginLeft: i > 0 ? -8 : 0 }}>
                  <Avatar uri={p.avatar_url} size={40} />
                </View>
              ))}
            </View>
            
            {/* See results early button */}
            <Pressable
              onPress={handleSeeResultsEarly}
              style={({ pressed }) => ({
                paddingHorizontal: Spacing.xl,
                paddingVertical: Spacing.md,
                backgroundColor: c.primary,
                borderRadius: BorderRadius.lg,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{
                color: '#fff',
                fontSize: Typography.scale.body.fontSize,
                fontWeight: '600',
              }}>
                Back to Chat
              </Text>
            </Pressable>
            
            <Text style={{
              color: c.muted,
              fontSize: Typography.scale.bodySmall.fontSize,
              textAlign: 'center',
              marginTop: Spacing.md,
              maxWidth: 240,
            }}>
              See live results and votes in the group chat
            </Text>
            
            {/* End Poll section */}
            <View style={{
              marginTop: Spacing['2xl'],
              paddingTop: Spacing.xl,
              borderTopWidth: 1,
              borderTopColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              alignItems: 'center',
              width: '100%',
              maxWidth: 300,
            }}>
              <Text style={{
                color: c.muted,
                fontSize: Typography.scale.bodySmall.fontSize,
                textAlign: 'center',
                marginBottom: Spacing.md,
              }}>
                Can't wait? End the poll now to see final results
              </Text>
              
              <Pressable
                onPress={() => setShowEndPollWarning(true)}
                style={({ pressed }) => ({
                  paddingHorizontal: Spacing.xl,
                  paddingVertical: Spacing.sm,
                  borderRadius: BorderRadius.md,
                  borderWidth: 1,
                  borderColor: '#EF4444',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{
                  color: '#EF4444',
                  fontSize: Typography.scale.body.fontSize,
                  fontWeight: '600',
                }}>
                  End Poll Early
                </Text>
              </Pressable>
            </View>
          </View>
          
          {/* End Poll Warning Modal */}
          <Modal
            visible={showEndPollWarning}
            transparent
            animationType="fade"
            onRequestClose={() => setShowEndPollWarning(false)}
          >
            <View style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.6)',
              alignItems: 'center',
              justifyContent: 'center',
              padding: Spacing.lg,
            }}>
              <View style={{
                backgroundColor: c.card,
                borderRadius: BorderRadius.xl,
                padding: Spacing.xl,
                width: '100%',
                maxWidth: 340,
              }}>
                <View style={{
                  alignItems: 'center',
                  marginBottom: Spacing.lg,
                }}>
                  <View style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: '#EF4444' + '20',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: Spacing.md,
                  }}>
                    <Ionicons name="warning" size={28} color="#EF4444" />
                  </View>
                  <Text style={{
                    color: c.text,
                    fontSize: Typography.scale.heading3.fontSize,
                    fontWeight: '700',
                    textAlign: 'center',
                    marginBottom: Spacing.sm,
                  }}>
                    End Poll Early?
                  </Text>
                  <Text style={{
                    color: c.muted,
                    fontSize: Typography.scale.body.fontSize,
                    textAlign: 'center',
                    lineHeight: 22,
                  }}>
                    {totalMembers - votedCount} {totalMembers - votedCount === 1 ? 'person hasn\'t' : 'people haven\'t'} voted yet. 
                    Ending now means their votes won't be counted.
                  </Text>
                </View>
                
                <Pressable
                  onPress={handleEndPoll}
                  disabled={endingPoll}
                  style={({ pressed }) => ({
                    backgroundColor: '#EF4444',
                    paddingVertical: Spacing.md,
                    borderRadius: BorderRadius.lg,
                    alignItems: 'center',
                    opacity: pressed || endingPoll ? 0.7 : 1,
                    marginBottom: Spacing.sm,
                  })}
                >
                  {endingPoll ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{
                      color: '#fff',
                      fontSize: Typography.scale.body.fontSize,
                      fontWeight: '700',
                    }}>
                      Yes, End Poll
                    </Text>
                  )}
                </Pressable>
                
                <Pressable
                  onPress={() => setShowEndPollWarning(false)}
                  disabled={endingPoll}
                  style={({ pressed }) => ({
                    paddingVertical: Spacing.md,
                    borderRadius: BorderRadius.lg,
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{
                    color: c.muted,
                    fontSize: Typography.scale.body.fontSize,
                    fontWeight: '600',
                  }}>
                    Keep Waiting
                  </Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground variant="dim">
      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {/* Header */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            padding: Spacing.lg,
            paddingBottom: Spacing.sm,
          }}>
            <Pressable
              onPress={() => router.back()}
              style={{
                padding: Spacing.sm,
                marginRight: Spacing.sm,
                backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderRadius: BorderRadius.md,
              }}
            >
              <Ionicons name="close" size={24} color={c.text} />
            </Pressable>
            
            <View style={{ flex: 1 }}>
              <Text style={{
                color: c.muted,
                fontSize: Typography.scale.bodySmall.fontSize,
              }}>
                {currentIndex + 1} of {items.length}
              </Text>
              <Text style={{
                color: c.text,
                fontSize: Typography.scale.bodyLarge.fontSize,
                fontWeight: '700',
              }}>
                {isMegaPoll ? (currentPhase === 'events' ? '🎉 Rate Events' : '🍕 Rate Food') : 'Rate each option'}
              </Text>
              {isMegaPoll && eventsComplete && currentPhase === 'food' && (
                <Text style={{
                  color: c.primary,
                  fontSize: Typography.scale.bodySmall.fontSize,
                  fontWeight: '600',
                  marginTop: 2,
                }}>
                  Phase 2 of 2
                </Text>
              )}
            </View>
            
            {/* Participants */}
            <View style={{ flexDirection: 'row' }}>
              {participants.slice(0, 3).map((p, i) => (
                <View key={p.id} style={{ marginLeft: i > 0 ? -8 : 0 }}>
                  <Avatar uri={p.avatar_url} size={32} />
                </View>
              ))}
              {participants.length > 3 && (
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: c.muted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: -8,
                }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                    +{participants.length - 3}
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          {/* Progress Bar */}
          <View style={{
            marginHorizontal: Spacing.lg,
            height: 6,
            backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            borderRadius: 3,
            marginBottom: Spacing.md,
            overflow: 'hidden',
          }}>
            <Animated.View style={{
              height: '100%',
              backgroundColor: c.primary,
              borderRadius: 3,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            }} />
          </View>
          
          {/* Voting status */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: Spacing.md,
          }}>
            <Ionicons name="people" size={16} color={c.muted} />
            <Text style={{
              color: c.muted,
              fontSize: Typography.scale.bodySmall.fontSize,
              marginLeft: Spacing.xs,
            }}>
              {label}
            </Text>
          </View>
          
          {/* Swipe Deck */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <SwipeDeck
              data={items}
              keyExtractor={(item) => item.id}
              renderCard={renderCard}
              onSwipeRight={handleSwipeRight}
              onSwipeLeft={handleSwipeLeft}
              onSwipeUp={handleSwipeUp}
              onComplete={handleComplete}
              overlayLabels={{
                like: { text: 'LOVE IT', color: '#10B981' },
                nope: { text: 'NOPE', color: '#EF4444' },
                super: { text: 'MAYBE', color: '#F59E0B' },
              }}
              stackDepth={2}
            />
          </View>
          
          {/* Swipe hints */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            paddingHorizontal: Spacing.xl,
            paddingVertical: Spacing.lg,
          }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#EF4444' + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: Spacing.xs,
              }}>
                <Ionicons name="close" size={24} color="#EF4444" />
              </View>
              <Text style={{ color: c.muted, fontSize: Typography.scale.bodySmall.fontSize }}>
                Nope
              </Text>
            </View>
            
            <View style={{ alignItems: 'center' }}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#F59E0B' + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: Spacing.xs,
              }}>
                <Ionicons name="arrow-up" size={24} color="#F59E0B" />
              </View>
              <Text style={{ color: c.muted, fontSize: Typography.scale.bodySmall.fontSize }}>
                Maybe
              </Text>
            </View>
            
            <View style={{ alignItems: 'center' }}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#10B981' + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: Spacing.xs,
              }}>
                <Ionicons name="heart" size={24} color="#10B981" />
              </View>
              <Text style={{ color: c.muted, fontSize: Typography.scale.bodySmall.fontSize }}>
                Love it
              </Text>
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>
    </GradientBackground>
  );
}

// Helpers
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
