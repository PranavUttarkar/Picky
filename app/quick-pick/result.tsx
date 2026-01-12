import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Dimensions, Linking, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GradientBackground from '@/components/GradientBackground';
import LazyImage from '@/components/LazyImage';
import Avatar from '@/components/Avatar';
import { Typography, Spacing, BorderRadius, Gradients } from '@/theme/designTokens';
import { getPoll, suggestLeader, toggleCommitment, type PollOptionView } from '@/services/polls';
import { getSessionParticipants, type SessionParticipant } from '@/services/quickPick';
import { getRestaurantById } from '@/services/food';
import type { Event, Restaurant } from '@/types/models';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Quick Pick Result Screen
 * Reveal the winning option with celebration
 */
export default function QuickPickResult() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const { groupId, pollId, early } = useLocalSearchParams<{ groupId: string; pollId: string; early?: string }>();
  
  const isEarlyView = early === 'true';
  
  const [loading, setLoading] = useState(true);
  const [winner, setWinner] = useState<PollOptionView | null>(null);
  const [winnerDetails, setWinnerDetails] = useState<{ 
    title: string; 
    subtitle: string; 
    image?: string;
    type: 'event' | 'food';
    data?: Event | Restaurant;
  } | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [votedCount, setVotedCount] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [committed, setCommitted] = useState(false);
  const [noWinner, setNoWinner] = useState(false);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    loadResults();
  }, []);
  
  const loadResults = async () => {
    if (!pollId || !groupId) return;
    
    try {
      const pid = parseInt(pollId, 10);
      const gid = parseInt(groupId, 10);
      
      // Load poll data
      const pollData = await getPoll(pid);
      const parts = await getSessionParticipants(gid);
      setParticipants(parts);
      setVotedCount(pollData.respondedCount);
      setTotalMembers(pollData.totalMembers);
      
      // Determine winner
      const winnerOption = suggestLeader(pollData.options);
      
      if (!winnerOption) {
        setNoWinner(true);
        setLoading(false);
        return;
      }
      
      setWinner(winnerOption);
      
      // Get winner details
      if (winnerOption.kind === 'event' && winnerOption.event) {
        setWinnerDetails({
          title: winnerOption.event.title,
          subtitle: winnerOption.event.location || formatDate(winnerOption.event.date_time),
          image: winnerOption.event.image_url || undefined,
          type: 'event',
          data: winnerOption.event as Event,
        });
      } else if (winnerOption.kind === 'text') {
        // Check if it's a food item
        const foodMatch = winnerOption.text.match(/\[FOOD:([^\]]+)\]/);
        if (foodMatch) {
          const placeId = foodMatch[1];
          try {
            const restaurant = await getRestaurantById(placeId);
            if (restaurant) {
              setWinnerDetails({
                title: restaurant.restaurant_name,
                subtitle: restaurant.category || restaurant.address || '',
                image: restaurant.main_image || undefined,
                type: 'food',
                data: restaurant,
              });
            }
          } catch (e) {
            // Fallback to text
            setWinnerDetails({
              title: winnerOption.text.replace(/\[FOOD:[^\]]+\]/, '').trim(),
              subtitle: 'Restaurant',
              type: 'food',
            });
          }
        } else {
          // Regular text option
          setWinnerDetails({
            title: winnerOption.text,
            subtitle: '',
            type: 'event',
          });
        }
      }
      
      // Run celebration animation
      runCelebrationAnimation();
      
    } catch (e: any) {
      console.error('Failed to load results:', e);
    } finally {
      setLoading(false);
    }
  };
  
  const runCelebrationAnimation = () => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    // Confetti burst
    Animated.sequence([
      Animated.delay(200),
      Animated.spring(confettiAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Card reveal
    Animated.sequence([
      Animated.delay(400),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Details fade in
    Animated.sequence([
      Animated.delay(800),
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };
  
  const handleCommit = async () => {
    if (!pollId || !winner) return;
    
    try {
      await toggleCommitment(parseInt(pollId, 10));
      setCommitted(true);
    } catch (e) {
      console.warn('Commit failed:', e);
    }
  };
  
  const handleOpenMap = () => {
    if (!winnerDetails?.data) return;
    
    if (winnerDetails.type === 'food') {
      const r = winnerDetails.data as Restaurant;
      if (r.latitude && r.longitude) {
        const url = Platform.select({
          ios: `maps:?q=${encodeURIComponent(r.restaurant_name)}&ll=${r.latitude},${r.longitude}`,
          android: `geo:${r.latitude},${r.longitude}?q=${encodeURIComponent(r.restaurant_name)}`,
          default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.restaurant_name)}&query_place_id=${r.place_id}`,
        });
        Linking.openURL(url).catch(() => {});
      }
    } else {
      const e = winnerDetails.data as Event;
      if (e.latitude && e.longitude) {
        const url = Platform.select({
          ios: `maps:?q=${encodeURIComponent(e.title)}&ll=${e.latitude},${e.longitude}`,
          android: `geo:${e.latitude},${e.longitude}?q=${encodeURIComponent(e.title)}`,
          default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location || e.title)}`,
        });
        Linking.openURL(url).catch(() => {});
      }
    }
  };
  
  const handleShare = async () => {
    if (!winnerDetails) return;
    
    const message = `🎉 We picked: ${winnerDetails.title}!\n\nDecided with Picky - the easiest way to make group decisions.`;
    
    try {
      await Share.share({ message });
    } catch (e) {
      console.warn('Share failed:', e);
    }
  };
  
  const handleDone = () => {
    router.replace('/(tabs)');
  };
  
  const handleTryAgain = () => {
    router.replace('/pass');
  };
  
  if (loading) {
    return (
      <GradientBackground variant="dim">
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 48, marginBottom: Spacing.lg }}>🎯</Text>
          <Text style={{
            color: c.text,
            fontSize: Typography.scale.bodyLarge.fontSize,
            fontWeight: '600',
          }}>
            Tallying the votes...
          </Text>
        </SafeAreaView>
      </GradientBackground>
    );
  }
  
  if (noWinner) {
    return (
      <GradientBackground variant="dim">
        <SafeAreaView style={{ flex: 1, padding: Spacing.lg }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 48, marginBottom: Spacing.lg }}>🤔</Text>
            <Text style={{
              color: c.text,
              fontSize: Typography.scale.heading3.fontSize,
              fontWeight: '700',
              textAlign: 'center',
              marginBottom: Spacing.md,
            }}>
              It's a tie!
            </Text>
            <Text style={{
              color: c.muted,
              fontSize: Typography.scale.body.fontSize,
              textAlign: 'center',
              maxWidth: 280,
              marginBottom: Spacing.xl,
            }}>
              Everyone had different favorites. Try again with fewer options?
            </Text>
            
            <Pressable
              onPress={handleTryAgain}
              style={{
                paddingHorizontal: Spacing.xl,
                paddingVertical: Spacing.md,
                backgroundColor: c.primary,
                borderRadius: BorderRadius.lg,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                Try Again
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground variant="dim">
      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {/* Early view banner */}
          {isEarlyView && votedCount < totalMembers && (
            <View style={{
              backgroundColor: '#F59E0B',
              paddingVertical: Spacing.sm,
              paddingHorizontal: Spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="time-outline" size={16} color="#fff" />
              <Text style={{
                color: '#fff',
                fontSize: Typography.scale.bodySmall.fontSize,
                fontWeight: '600',
                marginLeft: Spacing.xs,
              }}>
                Voting in progress • {votedCount}/{totalMembers} voted
              </Text>
            </View>
          )}
          
          {/* Confetti / Celebration Header */}
          <Animated.View style={{
            alignItems: 'center',
            marginTop: Spacing.xl,
            opacity: confettiAnim,
            transform: [{
              scale: confettiAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 1],
              }),
            }],
          }}>
            <Text style={{ fontSize: 72 }}>{isEarlyView ? '📊' : '🎉'}</Text>
            <Text style={{
              color: c.text,
              fontSize: Typography.scale.heading2.fontSize,
              fontWeight: '700',
              fontFamily: Typography.fontFamily.displayBold,
              textAlign: 'center',
              marginTop: Spacing.sm,
            }}>
              {isEarlyView ? 'Current Leader' : 'Winner!'}
            </Text>
            <Text style={{
              color: c.muted,
              fontSize: Typography.scale.body.fontSize,
              textAlign: 'center',
              marginTop: Spacing.xs,
            }}>
              {isEarlyView ? 'Results may change as more people vote' : 'The group has spoken'}
            </Text>
          </Animated.View>
          
          {/* Winner Card */}
          <Animated.View style={{
            flex: 1,
            padding: Spacing.lg,
            paddingTop: Spacing.xl,
            transform: [{
              scale: scaleAnim,
            }],
          }}>
            <View style={{
              backgroundColor: scheme === 'dark' ? '#1a1a1a' : '#fff',
              borderRadius: BorderRadius.xl,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.2,
              shadowRadius: 24,
              elevation: 10,
            }}>
              {/* Image */}
              <View style={{ height: 200, backgroundColor: c.muted + '20' }}>
                {winnerDetails?.image ? (
                  <LazyImage
                    uri={winnerDetails.image}
                    width="100%"
                    height="100%"
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{ 
                    flex: 1, 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  }}>
                    <Text style={{ fontSize: 64 }}>
                      {winnerDetails?.type === 'event' ? '🎉' : '🍕'}
                    </Text>
                  </View>
                )}
                
                {/* Crown badge */}
                <View style={{
                  position: 'absolute',
                  top: Spacing.md,
                  right: Spacing.md,
                  backgroundColor: '#F59E0B',
                  paddingHorizontal: Spacing.sm,
                  paddingVertical: Spacing.xs,
                  borderRadius: BorderRadius.full,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 14, marginRight: 4 }}>👑</Text>
                  <Text style={{
                    color: '#fff',
                    fontSize: Typography.scale.bodySmall.fontSize,
                    fontWeight: '700',
                  }}>
                    Top Pick
                  </Text>
                </View>
              </View>
              
              {/* Details */}
              <View style={{ padding: Spacing.lg }}>
                <Text style={{
                  color: c.text,
                  fontSize: Typography.scale.heading2.fontSize,
                  fontWeight: '700',
                  marginBottom: Spacing.xs,
                }}>
                  {winnerDetails?.title}
                </Text>
                
                {winnerDetails?.subtitle && (
                  <Text style={{
                    color: c.muted,
                    fontSize: Typography.scale.body.fontSize,
                    marginBottom: Spacing.md,
                  }}>
                    {winnerDetails.subtitle}
                  </Text>
                )}
                
                {/* Participants who voted */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingTop: Spacing.md,
                  borderTopWidth: 1,
                  borderTopColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                }}>
                  <View style={{ flexDirection: 'row', flex: 1 }}>
                    {participants.slice(0, 4).map((p, i) => (
                      <View key={p.id} style={{ marginLeft: i > 0 ? -8 : 0 }}>
                        <Avatar uri={p.avatar_url} size={32} />
                      </View>
                    ))}
                  </View>
                  <Text style={{
                    color: c.muted,
                    fontSize: Typography.scale.bodySmall.fontSize,
                  }}>
                    {participants.length} voted
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
          
          {/* Action Buttons */}
          <Animated.View style={{
            padding: Spacing.lg,
            opacity: cardAnim,
          }}>
            {/* Primary CTA */}
            <Pressable
              onPress={handleCommit}
              disabled={committed}
              style={({ pressed }) => ({
                opacity: pressed ? 0.9 : 1,
                marginBottom: Spacing.md,
              })}
            >
              <LinearGradient
                colors={committed 
                  ? (['#10B981', '#059669'] as const)
                  : (['#FF6F61', '#F59E0B'] as const)
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: Spacing.md,
                  borderRadius: BorderRadius.lg,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons 
                  name={committed ? "checkmark-circle" : "hand-right"} 
                  size={20} 
                  color="#fff" 
                />
                <Text style={{
                  color: '#fff',
                  fontSize: Typography.scale.bodyLarge.fontSize,
                  fontWeight: '700',
                  marginLeft: Spacing.sm,
                }}>
                  {committed ? "I'm in!" : "Count me in!"}
                </Text>
              </LinearGradient>
            </Pressable>
            
            {/* Secondary actions */}
            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <Pressable
                onPress={handleOpenMap}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: Spacing.md,
                  backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  borderRadius: BorderRadius.lg,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="navigate" size={18} color={c.primary} />
                <Text style={{
                  color: c.primary,
                  fontSize: Typography.scale.body.fontSize,
                  fontWeight: '600',
                  marginLeft: Spacing.xs,
                }}>
                  Directions
                </Text>
              </Pressable>
              
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: Spacing.md,
                  backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  borderRadius: BorderRadius.lg,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="share-outline" size={18} color={c.text} />
                <Text style={{
                  color: c.text,
                  fontSize: Typography.scale.body.fontSize,
                  fontWeight: '600',
                  marginLeft: Spacing.xs,
                }}>
                  Share
                </Text>
              </Pressable>
            </View>
            
            {/* Done button */}
            <Pressable
              onPress={handleDone}
              style={{
                marginTop: Spacing.lg,
                alignItems: 'center',
              }}
            >
              <Text style={{
                color: c.muted,
                fontSize: Typography.scale.body.fontSize,
              }}>
                Done
              </Text>
            </Pressable>
          </Animated.View>
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
