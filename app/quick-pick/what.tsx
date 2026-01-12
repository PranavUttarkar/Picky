import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import GradientBackground from '@/components/GradientBackground';
import { Typography, Spacing, BorderRadius, Gradients } from '@/theme/designTokens';
import type { DecisionCategory } from '@/services/quickPick';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CategoryOption {
  id: DecisionCategory;
  label: string;
  description: string;
  emoji: string;
  gradient: readonly [string, string, ...string[]];
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    id: 'events',
    label: 'Events',
    description: 'Concerts, parties, sports & more',
    emoji: '🎉',
    gradient: ['#8B5CF6', '#6366F1'] as readonly [string, string],
  },
  {
    id: 'food',
    label: 'Food',
    description: 'Restaurants, cafes & eateries',
    emoji: '🍕',
    gradient: ['#F59E0B', '#EF4444'] as readonly [string, string],
  },
  {
    id: 'both',
    label: 'Both',
    description: 'Mix of events & food spots',
    emoji: '✨',
    gradient: ['#10B981', '#06B6D4'] as readonly [string, string],
  },
];

/**
 * Quick Pick Category Selector
 * Choose what type of thing to decide on
 */
export default function QuickPickWhat() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const { groupId, groupName, timeWindow, windowStart, windowEnd } = useLocalSearchParams<{
    groupId: string;
    groupName?: string;
    timeWindow: string;
    windowStart: string;
    windowEnd: string;
  }>();
  
  const [selected, setSelected] = useState<DecisionCategory | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Animation
  const fadeAnim = useState(() => new Animated.Value(0))[0];
  const scaleAnims = CATEGORY_OPTIONS.map(() => useState(() => new Animated.Value(0.8))[0]);
  
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    // Stagger the card animations
    scaleAnims.forEach((anim, index) => {
      Animated.spring(anim, {
        toValue: 1,
        friction: 8,
        delay: index * 100,
        useNativeDriver: true,
      }).start();
    });
  }, []);
  
  const handleSelect = (id: DecisionCategory) => {
    setSelected(id);
  };
  
  const handleContinue = () => {
    if (!selected || !groupId) return;
    
    setLoading(true);
    
    // Navigate to voting screen with all params
    router.push(
      `/quick-pick/vote?groupId=${groupId}&groupName=${encodeURIComponent(groupName || '')}&category=${selected}&windowStart=${windowStart}&windowEnd=${windowEnd}`
    );
  };

  // Ensure loading resets when returning to this screen
  useFocusEffect(
    useCallback(() => {
      setLoading(false);
    }, [])
  );

  const cardWidth = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) / 2;

  return (
    <GradientBackground variant="dim">
      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {/* Header */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            padding: Spacing.lg,
            paddingBottom: Spacing.md,
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
              <Ionicons name="arrow-back" size={24} color={c.text} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{
                color: c.muted,
                fontSize: Typography.scale.bodySmall.fontSize,
              }}>
                Step 2 of 2
              </Text>
              <Text style={{
                color: c.text,
                fontSize: Typography.scale.heading3.fontSize,
                fontWeight: '700',
                fontFamily: Typography.fontFamily.displayBold,
              }}>
                What are you deciding?
              </Text>
            </View>
          </View>
          
          {/* Progress indicator */}
          <View style={{ 
            flexDirection: 'row', 
            paddingHorizontal: Spacing.lg,
            marginBottom: Spacing.lg,
            gap: Spacing.xs,
          }}>
            <View style={{
              flex: 1,
              height: 4,
              backgroundColor: c.primary,
              borderRadius: 2,
            }} />
            <View style={{
              flex: 1,
              height: 4,
              backgroundColor: c.primary,
              borderRadius: 2,
            }} />
          </View>
          
          <View style={{ flex: 1, padding: Spacing.lg, paddingTop: 0 }}>
            {/* Subtitle */}
            <Text style={{
              color: c.muted,
              fontSize: Typography.scale.body.fontSize,
              marginBottom: Spacing.xl,
              lineHeight: 22,
            }}>
              We'll find the best options based on everyone's preferences
            </Text>
            
            {/* Category Cards */}
            <View style={{ 
              flexDirection: 'row', 
              flexWrap: 'wrap', 
              gap: Spacing.md,
              justifyContent: 'center',
            }}>
              {CATEGORY_OPTIONS.map((option, index) => {
                const isSelected = selected === option.id;
                const isBoth = option.id === 'both';
                
                return (
                  <Animated.View
                    key={option.id}
                    style={{
                      width: isBoth ? '100%' : cardWidth,
                      transform: [{ scale: scaleAnims[index] }],
                    }}
                  >
                    <Pressable
                      onPress={() => handleSelect(option.id)}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.9 : 1,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      })}
                    >
                      <LinearGradient
                        colors={isSelected ? option.gradient : ['transparent', 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          padding: isSelected ? 2 : 0,
                          borderRadius: BorderRadius.xl,
                        }}
                      >
                        <View style={{
                          backgroundColor: scheme === 'dark' 
                            ? (isSelected ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.05)')
                            : (isSelected ? '#fff' : '#fff'),
                          borderRadius: BorderRadius.xl - 2,
                          padding: Spacing.lg,
                          minHeight: isBoth ? 100 : 140,
                          justifyContent: 'center',
                          alignItems: isBoth ? 'center' : 'flex-start',
                          borderWidth: isSelected ? 0 : 1,
                          borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                        }}>
                          <Text style={{ 
                            fontSize: isBoth ? 40 : 36, 
                            marginBottom: Spacing.sm,
                          }}>
                            {option.emoji}
                          </Text>
                          
                          <Text style={{
                            color: c.text,
                            fontSize: Typography.scale.bodyLarge.fontSize,
                            fontWeight: '700',
                            marginBottom: 4,
                            textAlign: isBoth ? 'center' : 'left',
                          }}>
                            {option.label}
                          </Text>
                          
                          <Text style={{
                            color: c.muted,
                            fontSize: Typography.scale.bodySmall.fontSize,
                            textAlign: isBoth ? 'center' : 'left',
                          }}>
                            {option.description}
                          </Text>
                          
                          {/* Selection indicator */}
                          {isSelected && (
                            <View style={{
                              position: 'absolute',
                              top: Spacing.sm,
                              right: Spacing.sm,
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              backgroundColor: option.gradient[0],
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <Ionicons name="checkmark" size={16} color="#fff" />
                            </View>
                          )}
                        </View>
                      </LinearGradient>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
            
            {/* Pro tip */}
            <View style={{
              marginTop: Spacing.xl,
              padding: Spacing.md,
              backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              borderRadius: BorderRadius.md,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 16, marginRight: Spacing.sm }}>💡</Text>
              <Text style={{
                color: c.muted,
                fontSize: Typography.scale.bodySmall.fontSize,
                flex: 1,
                lineHeight: 18,
              }}>
                <Text style={{ fontWeight: '600' }}>Pro tip:</Text> "Both" gives a nice mix when you're not sure what you're in the mood for
              </Text>
            </View>
          </View>
          
          {/* Bottom CTA */}
          <View style={{ padding: Spacing.lg, paddingTop: Spacing.sm }}>
            <Pressable
              onPress={handleContinue}
              disabled={!selected || loading}
              style={({ pressed }) => ({
                opacity: pressed ? 0.9 : (selected ? 1 : 0.5),
              })}
            >
              <LinearGradient
                colors={selected 
                  ? (['#FF6F61', '#F59E0B'] as const)
                  : (['#9CA3AF', '#6B7280'] as const)
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: Spacing.md,
                  borderRadius: BorderRadius.lg,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                }}
              >
                {loading ? (
                  <Text style={{
                    color: '#fff',
                    fontSize: Typography.scale.bodyLarge.fontSize,
                    fontWeight: '700',
                  }}>
                    Finding options...
                  </Text>
                ) : (
                  <>
                    <Text style={{
                      color: '#fff',
                      fontSize: Typography.scale.bodyLarge.fontSize,
                      fontWeight: '700',
                      marginRight: Spacing.sm,
                    }}>
                      Find Matches
                    </Text>
                    <Ionicons name="sparkles" size={20} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
    </GradientBackground>
  );
}
