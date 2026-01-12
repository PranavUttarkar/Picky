import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GradientBackground from '@/components/GradientBackground';
import { Typography, Spacing, BorderRadius, Gradients } from '@/theme/designTokens';
import { getTimeWindowRange, getTimeWindowLabel, formatTimeRange, type TimeWindow } from '@/services/quickPick';

interface TimeOption {
  id: TimeWindow | 'custom';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  emoji: string;
}

const TIME_OPTIONS: TimeOption[] = [
  {
    id: 'custom',
    label: 'Custom Time',
    icon: 'time-outline',
    description: 'Pick exact times that work',
    emoji: '🕒',
  },
  {
    id: 'tonight',
    label: 'Tonight',
    icon: 'moon-outline',
    description: 'This evening (5pm - midnight)',
    emoji: '🌙',
  },
  {
    id: 'tomorrow',
    label: 'Tomorrow',
    icon: 'sunny-outline',
    description: 'All day tomorrow',
    emoji: '☀️',
  },
  {
    id: 'this-weekend',
    label: 'This Weekend',
    icon: 'calendar-outline',
    description: 'Saturday & Sunday',
    emoji: '🎉',
  },
  {
    id: 'this-week',
    label: 'This Week',
    icon: 'time-outline',
    description: 'Next 7 days - more options',
    emoji: '📅',
  },
];

/**
 * Quick Pick Time Window Selector
 * Let users quickly pick when they want to hang out
 */
export default function QuickPickWhen() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const { groupId, groupName } = useLocalSearchParams<{ groupId: string; groupName?: string }>();
  
  const [selected, setSelected] = useState<TimeWindow | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Animation
  const fadeAnim = useState(() => new Animated.Value(0))[0];
  const slideAnims = TIME_OPTIONS.map(() => useState(() => new Animated.Value(30))[0]);
  
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    // Stagger the option animations
    slideAnims.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
      }).start();
    });
  }, []);
  
  const handleSelect = (id: TimeWindow) => {
    setSelected(id);
    setShowPreview(true);
  };
  
  const handleContinue = () => {
    if (!selected || !groupId) return;
    
    const { start, end } = getTimeWindowRange(selected);
    
    router.push(
      `/quick-pick/what?groupId=${groupId}&groupName=${encodeURIComponent(groupName || '')}&timeWindow=${selected}&windowStart=${start.toISOString()}&windowEnd=${end.toISOString()}`
    );
  };

  const handleCustomTime = () => {
    if (!groupId) return;
    router.push(`/quick-pick/custom-time?groupId=${groupId}&groupName=${encodeURIComponent(groupName || '')}`);
  };
  
  const getPreviewText = () => {
    if (!selected) return '';
    const { start, end } = getTimeWindowRange(selected);
    return formatTimeRange(start, end);
  };

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
                Step 1 of 2
              </Text>
              <Text style={{
                color: c.text,
                fontSize: Typography.scale.heading3.fontSize,
                fontWeight: '700',
                fontFamily: Typography.fontFamily.displayBold,
              }}>
                When are you free?
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
              backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              borderRadius: 2,
            }} />
          </View>
          
          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0 }}
          >
            {/* Subtitle */}
            <Text style={{
              color: c.muted,
              fontSize: Typography.scale.body.fontSize,
              marginBottom: Spacing.xl,
              lineHeight: 22,
            }}>
              Pick a time window so we can find the best options for your group
            </Text>
            
            {/* Time Options */}
            <View style={{ gap: Spacing.md }}>
              {TIME_OPTIONS.map((option, index) => {
                const isSelected = selected === option.id;
                return (
                  <Animated.View
                    key={option.id}
                    style={{
                      transform: [{ translateY: slideAnims[index] }],
                      opacity: fadeAnim,
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        if (option.id === 'custom') {
                          handleCustomTime();
                        } else {
                          handleSelect(option.id as TimeWindow);
                        }
                      }}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: Spacing.lg,
                        backgroundColor: isSelected
                          ? (c.primary + '15')
                          : (scheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff'),
                        borderRadius: BorderRadius.lg,
                        borderWidth: isSelected ? 2 : 0,
                        borderColor: isSelected ? c.primary : 'transparent',
                        opacity: pressed ? 0.8 : 1,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      })}
                    >
                      <View style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: isSelected 
                          ? c.primary + '20'
                          : (scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: Spacing.md,
                      }}>
                        <Text style={{ fontSize: 28 }}>{option.emoji}</Text>
                      </View>
                      
                      <View style={{ flex: 1 }}>
                        <Text style={{
                          color: c.text,
                          fontSize: Typography.scale.bodyLarge.fontSize,
                          fontWeight: '600',
                          marginBottom: 2,
                        }}>
                          {option.label}
                        </Text>
                        <Text style={{
                          color: c.muted,
                          fontSize: Typography.scale.bodySmall.fontSize,
                        }}>
                          {option.description}
                        </Text>
                      </View>
                      
                      <View style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: isSelected ? c.primary : c.muted,
                        backgroundColor: isSelected ? c.primary : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {isSelected && (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
            
            {/* Preview */}
            {showPreview && selected && (
              <Animated.View
                style={{
                  marginTop: Spacing.xl,
                  padding: Spacing.md,
                  backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderRadius: BorderRadius.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="calendar" size={20} color={c.primary} />
                <Text style={{
                  color: c.text,
                  fontSize: Typography.scale.body.fontSize,
                  marginLeft: Spacing.sm,
                  fontWeight: '500',
                }}>
                  {getPreviewText()}
                </Text>
              </Animated.View>
            )}
          </ScrollView>
          
          {/* Bottom CTA */}
          <View style={{ padding: Spacing.lg, paddingTop: Spacing.sm }}>
            <Pressable
              onPress={handleContinue}
              disabled={!selected}
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
                <Text style={{
                  color: '#fff',
                  fontSize: Typography.scale.bodyLarge.fontSize,
                  fontWeight: '700',
                  marginRight: Spacing.sm,
                }}>
                  Next: What to Decide
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
    </GradientBackground>
  );
}
