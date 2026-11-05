/**
 * PickyRecommendationCard Component
 * 
 * Displays AI-powered recommendations from the Picky bot in group chat.
 * Features a distinctive design with animated gradient borders and
 * clickable recommendation cards.
 */

import { memo, useEffect, useRef } from 'react';
import { View, Text, Pressable, Image, Animated, Easing, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '@/theme/ThemeProvider';
import { router } from 'expo-router';
import type { PickyRecommendationResult, PickyRecommendation } from '@/services/pickyRecommendations';
import LazyImage from '@/components/LazyImage';
import EventImagePlaceholder from '@/components/EventImagePlaceholder';

// Picky bot branding
const PICKY_AVATAR = require('@/assets/branding/P.png');
const PICKY_NAME = 'Picky';

interface PickyRecommendationCardProps {
  result: PickyRecommendationResult;
  timestamp: string;
}

/**
 * Main component for displaying Picky's recommendations
 */
const PickyRecommendationCard = memo(function PickyRecommendationCard({
  result,
  timestamp,
}: PickyRecommendationCardProps) {
  const c = useThemeColors();
  
  // Animated glow effect
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [glowAnim]);
  
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });
  
  // Format timestamp
  const formatTime = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };
  
  const isEvents = result.type === 'events';
  const gradientColors: [string, string, string] = isEvents 
    ? ['#6366F1', '#8B5CF6', '#A855F7'] // Purple gradient for events
    : ['#F97316', '#FB923C', '#FBBF24']; // Orange-gold gradient for food
  
  const headerEmoji = isEvents ? '🎉' : '🍽️';
  const headerTitle = isEvents ? 'Top Events for You' : 'Top Places to Eat';
  
  return (
    <View style={{
      flexDirection: 'row',
      marginBottom: 16,
      paddingHorizontal: 12,
      alignItems: 'flex-start',
    }}>
      {/* Picky Avatar with animated glow */}
      <View style={{ position: 'relative' }}>
        <Animated.View
          style={{
            position: 'absolute',
            top: -4,
            left: -4,
            right: -4,
            bottom: -4,
            borderRadius: 24,
            backgroundColor: gradientColors[1],
            opacity: glowOpacity,
          }}
        />
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: '#1a1a2e',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: gradientColors[1],
          overflow: 'hidden',
        }}>
          <Image
            source={PICKY_AVATAR}
            style={{ width: 32, height: 32 }}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Message Card */}
      <View style={{
        flex: 1,
        marginLeft: 10,
        borderRadius: 16,
        borderTopLeftRadius: 4,
        overflow: 'hidden',
        shadowColor: gradientColors[0],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
      }}>
        {/* Gradient Header */}
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 14 }}>{headerEmoji}</Text>
              </View>
              <View>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                  {PICKY_NAME}
                </Text>
                
              </View>
            </View>
            
            {/* Sparkle icon */}
            <View style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="sparkles" size={14} color="#fff" />
            </View>
          </View>
          
          {/* Title */}
          <Text style={{
            color: '#fff',
            fontWeight: '700',
            fontSize: 16,
            marginTop: 10,
          }}>
            {headerTitle}
          </Text>
          
          <Text style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: 12,
            marginTop: 4,
          }}>
            {result.actualCount === 0 
              ? 'No matches found - try discovering more!'
              : `Found ${result.actualCount} perfect ${result.actualCount === 1 ? 'match' : 'matches'} for your group`
            }
          </Text>
        </LinearGradient>
        
        {/* Content area */}
        <View style={{ backgroundColor: c.card, padding: 12 }}>
          {result.recommendations.length === 0 ? (
            <View style={{
              backgroundColor: c.background,
              borderRadius: 12,
              padding: 20,
              alignItems: 'center',
            }}>
              <Ionicons 
                name={isEvents ? 'calendar-outline' : 'restaurant-outline'} 
                size={32} 
                color={c.muted} 
              />
              <Text style={{ 
                color: c.muted, 
                fontSize: 13, 
                marginTop: 8,
                textAlign: 'center',
              }}>
                {isEvents 
                  ? "No matching events found. Check out the Discover tab!"
                  : "No matching restaurants found. Explore the Food tab!"
                }
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {result.recommendations.map((rec, index) => (
                <RecommendationItem
                  key={rec.type === 'event' ? `event-${rec.data.id}` : `food-${rec.data.id}`}
                  recommendation={rec}
                  rank={index + 1}
                  gradientColors={gradientColors}
                />
              ))}
            </View>
          )}
          
          {/* Timestamp */}
          <Text style={{
            color: c.muted,
            fontSize: 10,
            marginTop: 12,
            textAlign: 'right',
          }}>
            {formatTime(timestamp)}
          </Text>
        </View>
      </View>
    </View>
  );
});

/**
 * Individual recommendation item card
 */
interface RecommendationItemProps {
  recommendation: PickyRecommendation;
  rank: number;
  gradientColors: [string, string, string];
}

const RecommendationItem = memo(function RecommendationItem({
  recommendation,
  rank,
  gradientColors,
}: RecommendationItemProps) {
  const c = useThemeColors();
  const isEvent = recommendation.type === 'event';
  const data = recommendation.data;
  
  const handlePress = () => {
    if (isEvent) {
      router.push(`/events/${(data as any).id}`);
    } else {
      router.push(`/foods/${(data as any).id}`);
    }
  };
  
  // Get display info based on type
  const title = isEvent ? (data as any).title : (data as any).name;
  const imageUrl = (data as any).image_url;
  const matchPercent = (data as any).match_percent;
  
  // Format subtitle
  let subtitle = '';
  if (isEvent) {
    const eventData = data as any;
    if (eventData.date_time) {
      const date = new Date(eventData.date_time);
      subtitle = date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (eventData.location) {
      subtitle += subtitle ? ` • ${eventData.location}` : eventData.location;
    }
  } else {
    const foodData = data as any;
    if (foodData.category) {
      subtitle = foodData.category;
    }
    if (foodData.price_range) {
      subtitle += subtitle ? ` • ${foodData.price_range}` : foodData.price_range;
    }
    if (foodData.rating) {
      subtitle += subtitle ? ` • ⭐ ${foodData.rating}` : `⭐ ${foodData.rating}`;
    }
  }
  
  // Rank medals
  const getMedalEmoji = (r: number) => {
    switch (r) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${r}`;
    }
  };
  
  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        backgroundColor: pressed ? c.muted + '20' : c.background,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: rank === 1 ? 2 : 1,
        borderColor: rank === 1 ? gradientColors[1] : c.muted + '20',
      })}
    >
      {/* Image */}
      <View style={{
        width: 72,
        height: 72,
        backgroundColor: c.muted + '30',
      }}>
        {imageUrl ? (
          isEvent ? (
            <LazyImage
              uri={imageUrl}
              width={72}
              height={72}
              resizeMode="contain"
              fallback={<EventImagePlaceholder />}
            />
          ) : (
            <Image source={{ uri: imageUrl }} style={{ width: 72, height: 72 }} resizeMode="cover" />
          )
        ) : isEvent ? (
          <EventImagePlaceholder />
        ) : (
          <View style={{ 
            width: 72, 
            height: 72, 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: gradientColors[0] + '20',
          }}>
            <Ionicons 
              name={isEvent ? 'calendar' : 'restaurant'} 
              size={28} 
              color={gradientColors[0]} 
            />
          </View>
        )}
        
        {/* Rank badge */}
        <View style={{
          position: 'absolute',
          top: 4,
          left: 4,
          backgroundColor: rank === 1 ? gradientColors[0] : c.card,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.2,
          shadowRadius: 2,
          elevation: 2,
        }}>
          <Text style={{ 
            fontSize: 12, 
            fontWeight: '700',
            color: rank === 1 ? '#fff' : c.text,
          }}>
            {getMedalEmoji(rank)}
          </Text>
        </View>
      </View>
      
      {/* Content */}
      <View style={{ 
        flex: 1, 
        padding: 10,
        justifyContent: 'center',
      }}>
        <Text 
          style={{ 
            color: c.text, 
            fontWeight: '700', 
            fontSize: 14,
            marginBottom: 2,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
        
        {subtitle && (
          <Text 
            style={{ 
              color: c.muted, 
              fontSize: 11,
              marginBottom: 4,
            }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
        
        {/* Match percentage */}
        {matchPercent != null && matchPercent > 0 && (
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            gap: 4,
          }}>
            <View style={{
              height: 4,
              flex: 1,
              maxWidth: 80,
              backgroundColor: c.muted + '30',
              borderRadius: 2,
              overflow: 'hidden',
            }}>
              <LinearGradient
                colors={[gradientColors[0], gradientColors[1]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  width: `${Math.min(matchPercent, 100)}%`,
                  height: '100%',
                }}
              />
            </View>
            <Text style={{ 
              color: gradientColors[0], 
              fontSize: 10, 
              fontWeight: '700',
            }}>
              {matchPercent}% match
            </Text>
          </View>
        )}
      </View>
      
      {/* Arrow */}
      <View style={{
        justifyContent: 'center',
        paddingRight: 10,
      }}>
        <Ionicons name="chevron-forward" size={18} color={c.muted} />
      </View>
    </Pressable>
  );
});

export default PickyRecommendationCard;

/**
 * Loading state component for when Picky is searching
 */
export const PickyLoadingCard = memo(function PickyLoadingCard({
  type,
}: {
  type: 'events' | 'food';
}) {
  const c = useThemeColors();
  
  // Animated dots
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  
  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };
    
    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);
    
    a1.start();
    a2.start();
    a3.start();
    
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);
  
  const gradientColors: [string, string, string] = type === 'events'
    ? ['#6366F1', '#8B5CF6', '#A855F7']
    : ['#F97316', '#FB923C', '#FBBF24'];
  
  return (
    <View style={{
      flexDirection: 'row',
      marginBottom: 16,
      paddingHorizontal: 12,
      alignItems: 'flex-start',
    }}>
      {/* Picky Avatar */}
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1a1a2e',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: gradientColors[1],
        overflow: 'hidden',
      }}>
        <Image
          source={PICKY_AVATAR}
          style={{ width: 32, height: 32 }}
          resizeMode="contain"
        />
      </View>
      
      {/* Loading bubble */}
      <View style={{
        marginLeft: 10,
        backgroundColor: c.card,
        borderRadius: 16,
        borderTopLeftRadius: 4,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}>
        <Text style={{ color: c.muted, fontSize: 13, marginRight: 8 }}>
          {type === 'events' ? '🎉' : '🍽️'} Finding matches
        </Text>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: gradientColors[1],
              opacity: dot,
            }}
          />
        ))}
      </View>
    </View>
  );
});
