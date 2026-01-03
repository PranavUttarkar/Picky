import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  View, 
  Text, 
  Pressable, 
  Alert, 
  ActivityIndicator, 
  ScrollView,
  Animated,
  Easing 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import AvailabilityGrid from '@/components/AvailabilityGrid';
import AvailabilityGridMobile from '@/components/AvailabilityGridMobile';
import { useThemeColors } from '@/theme/ThemeProvider';
import {
  computeWindow,
  getGroupAvailability,
  replaceMyAvailability,
  getGroupAvailabilitySummary,
} from '@/services/availability';
import { useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import dayjs from 'dayjs';

export default function GroupAvailabilityScreen() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Number(id);
  const [now, setNow] = useState<Date>(() => new Date());
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [memberCount, setMemberCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [summary, setSummary] = useState<{
    top?: { iso: string; count: number } | null;
    pending: number;
    total: number;
  }>({ top: null, pending: 0, total: 0 });
  const { width } = useWindowDimensions();
  const isMobileLayout = Platform.OS !== 'web' || width < 720;
  const insets = useSafeAreaInsets();
  
  // Animation for saved banner
  const savedBannerOpacity = useState(new Animated.Value(0))[0];

  const window = useMemo(() => computeWindow(now, 30, 7), [now]);
  const windowStartDate = useMemo(() => new Date(window.startIso), [window.startIso]);

  const refresh = async () => {
    try {
      setLoading(true);
      const { counts, mySlots, memberCount } = await getGroupAvailability(groupId, window);
      setCounts(counts);
      setSelected(new Set(mySlots));
      setMemberCount(memberCount);
      try {
        const s = await getGroupAvailabilitySummary(groupId, window, 1);
        setSummary({
          top: s.topSlots[0] ? { iso: s.topSlots[0].slotIso, count: s.topSlots[0].count } : null,
          pending: s.pendingCount,
          total: s.memberCount,
        });
      } catch {}
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [groupId, window.startIso, window.endIso]);

  // Animate saved banner
  useEffect(() => {
    if (savedBanner) {
      Animated.sequence([
        Animated.timing(savedBannerOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(2000),
        Animated.timing(savedBannerOpacity, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => setSavedBanner(false));
    }
  }, [savedBanner]);

  const onToggle = useCallback((iso: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }, []);

  const onSave = async () => {
    try {
      setSaving(true);
      await replaceMyAvailability(groupId, window, Array.from(selected.values()));
      await refresh();
      setSavedBanner(true);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  // Quick selection helpers
  const selectTimeRange = (startHour: number, endHour: number, dayFilter: 'weekdays' | 'weekends' | 'all') => {
    const newSelected = new Set(selected);
    const windowStart = new Date(window.startIso);
    const windowEnd = new Date(window.endIso);
    
    // Iterate through all 7 days in the window
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const day = new Date(windowStart);
      day.setDate(windowStart.getDate() + dayOffset);
      day.setHours(0, 0, 0, 0);
      
      // Get day of week (0 = Sunday, 6 = Saturday)
      const dayOfWeek = day.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      // Filter based on dayFilter
      if (dayFilter === 'weekdays' && isWeekend) continue;
      if (dayFilter === 'weekends' && !isWeekend) continue;
      
      for (let hour = startHour; hour < endHour; hour++) {
        [0, 30].forEach(minutes => {
          const slotTime = new Date(day);
          slotTime.setHours(hour, minutes, 0, 0);
          // Only add if within the window
          if (slotTime >= windowStart && slotTime < windowEnd) {
            const iso = slotTime.toISOString();
            newSelected.add(iso);
          }
        });
      }
    }
    setSelected(newSelected);
  };

  const clearAll = () => {
    setSelected(new Set());
  };

  const selectedCount = selected.size;

  return (
    <GradientBackground variant="dim">
      <AnimatedPage>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: insets.top + 20,
            paddingBottom: Math.max(insets.bottom, 40),
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ marginBottom: 24 }}>
            <Pressable
              onPress={() => router.push(`/(tabs)/groups/${groupId}`)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 16,
                alignSelf: 'flex-start',
              }}
            >
              <Ionicons name="arrow-back" size={24} color={c.text} />
              <Text style={{ 
                color: c.text, 
                fontSize: 16, 
                marginLeft: 8,
                fontWeight: '600',
              }}>
                Back to Group
              </Text>
            </Pressable>
            
            <Text style={{
              fontSize: 32,
              fontWeight: '700',
              color: c.text,
              marginBottom: 8,
            }}>
              Find Common Times
            </Text>
            
            <Text style={{
              fontSize: 16,
              color: c.muted,
              lineHeight: 24,
            }}>
              Select your available times. We'll show where everyone overlaps so you can find the best meeting time.
            </Text>
          </View>

          {/* Enhanced Summary Card */}
          {summary.top && (
            <View style={{
              backgroundColor: c.card,
              borderRadius: 16,
              padding: 20,
              marginBottom: 24,
              borderWidth: 2,
              borderColor: summary.top.count === summary.total 
                ? '#10b981' 
                : summary.top.count >= summary.total * 0.8
                ? '#3b82f6'
                : c.primary,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 4,
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 12,
              }}>
                <View style={{
                  backgroundColor: summary.top.count === summary.total 
                    ? '#10b981' 
                    : '#3b82f6',
                  borderRadius: 10,
                  padding: 8,
                  marginRight: 12,
                }}>
                  <Ionicons 
                    name={summary.top.count === summary.total ? "checkmark-circle" : "time"} 
                    size={24} 
                    color="white" 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: c.text,
                    marginBottom: 4,
                  }}>
                    {summary.top.count === summary.total 
                      ? 'Perfect Match! 🎉' 
                      : `Best Time: ${summary.top.count}/${summary.total} available`}
                  </Text>
                  <Text style={{
                    fontSize: 14,
                    color: c.muted,
                  }}>
                    {dayjs(summary.top.iso).format('dddd, MMM D [at] h:mm A')}
                  </Text>
                </View>
              </View>
              
              {summary.pending > 0 && (
                <View style={{
                  backgroundColor: summary.top.count === summary.total 
                    ? 'rgba(16, 185, 129, 0.1)' 
                    : 'rgba(59, 130, 246, 0.1)',
                  borderRadius: 8,
                  padding: 12,
                  marginTop: 12,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons 
                      name="information-circle" 
                      size={16} 
                      color={summary.top.count === summary.total ? '#10b981' : '#3b82f6'} 
                    />
                    <Text style={{
                      color: c.text,
                      fontSize: 13,
                      marginLeft: 8,
                      flex: 1,
                    }}>
                      {summary.pending} {summary.pending === 1 ? 'member' : 'members'} still need to respond
                    </Text>
                  </View>
                </View>
              )}
              
              {summary.total > 0 && summary.top.count === summary.total && (
                <View style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: 8,
                  padding: 12,
                  marginTop: 12,
                }}>
                  <Text style={{
                    color: '#10b981',
                    fontSize: 14,
                    fontWeight: '600',
                  }}>
                    ✨ Everyone is available at this time!
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Quick Actions */}
          <View style={{
            backgroundColor: c.card,
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
          }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '700',
              color: c.text,
              marginBottom: 12,
            }}>
              Quick Actions
            </Text>
            
            <View style={{
              flexDirection: isMobileLayout ? 'column' : 'row',
              gap: 8,
              marginBottom: 12,
            }}>
              <Pressable
                onPress={() => selectTimeRange(9, 17, 'weekdays')}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: pressed ? `${c.primary}30` : `${c.primary}15`,
                  borderRadius: 12,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <Ionicons name="sunny" size={18} color={c.primary} />
                <Text style={{ color: c.primary, fontWeight: '600', fontSize: 14 }}>
                  Weekdays 9AM-5PM
                </Text>
              </Pressable>
              
              <Pressable
                onPress={() => selectTimeRange(10, 22, 'weekends')}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: pressed ? `${c.primary}30` : `${c.primary}15`,
                  borderRadius: 12,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <Ionicons name="calendar" size={18} color={c.primary} />
                <Text style={{ color: c.primary, fontWeight: '600', fontSize: 14 }}>
                  Weekends 10AM-10PM
                </Text>
              </Pressable>
            </View>
            
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => selectTimeRange(18, 23, 'all')}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: pressed ? `${c.primary}30` : `${c.primary}15`,
                  borderRadius: 12,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <Ionicons name="moon" size={18} color={c.primary} />
                <Text style={{ color: c.primary, fontWeight: '600', fontSize: 14 }}>
                  Evenings 6PM-11PM
                </Text>
              </Pressable>
              
              <Pressable
                onPress={clearAll}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: pressed ? `${c.muted}35` : `${c.muted}20`,
                  borderRadius: 12,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <Ionicons name="close-circle" size={18} color={c.text} />
                <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>
                  Clear All
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Week Navigation & Save */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <Pressable
              onPress={() => setNow(new Date())}
              style={({ pressed }) => ({
                backgroundColor: pressed ? `${c.primary}20` : c.card,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
              accessibilityRole="button"
              accessibilityLabel="Jump to now"
            >
              <Ionicons name="time" size={18} color={c.primary} />
              <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>
                Now
              </Text>
            </Pressable>
            
            <Pressable
              onPress={() => setNow(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))}
              style={({ pressed }) => ({
                backgroundColor: pressed ? `${c.primary}20` : c.card,
                padding: 12,
                borderRadius: 12,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              })}
              accessibilityRole="button"
              accessibilityLabel="Previous week"
            >
              <Ionicons name="chevron-back" size={18} color={c.text} />
            </Pressable>
            
            <Pressable
              onPress={() => setNow(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000))}
              style={({ pressed }) => ({
                backgroundColor: pressed ? `${c.primary}20` : c.card,
                padding: 12,
                borderRadius: 12,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              })}
              accessibilityRole="button"
              accessibilityLabel="Next week"
            >
              <Ionicons name="chevron-forward" size={18} color={c.text} />
            </Pressable>
            
            <View style={{ flex: 1 }} />
            
            <View style={{
              backgroundColor: c.card,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 12,
              marginRight: 8,
            }}>
              <Text style={{ color: c.muted, fontSize: 12 }}>
                {selectedCount} {selectedCount === 1 ? 'slot' : 'slots'} selected
              </Text>
            </View>
            
            <Pressable
              onPress={saving ? undefined : onSave}
              disabled={saving}
              style={({ pressed }) => ({
                backgroundColor: pressed && !saving ? `${c.primary}dd` : c.primary,
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 12,
                opacity: saving ? 0.7 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                shadowColor: c.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
                transform: [{ scale: pressed && !saving ? 0.97 : 1 }],
              })}
              accessibilityRole="button"
              accessibilityLabel="Save availability"
            >
              {saving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="checkmark-circle" size={20} color="white" />
              )}
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>

          {/* Saved Banner */}
          {savedBanner && (
            <Animated.View
              style={{
                opacity: savedBannerOpacity,
                backgroundColor: '#10b981',
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="checkmark-circle" size={24} color="white" />
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 16, flex: 1 }}>
                Availability saved successfully!
              </Text>
            </Animated.View>
          )}

          {/* Grid */}
          {loading ? (
            <View style={{ 
              alignItems: 'center', 
              justifyContent: 'center',
              minHeight: 400,
            }}>
              <ActivityIndicator size="large" color={c.primary} />
              <Text style={{ 
                color: c.muted, 
                marginTop: 16,
                fontSize: 16,
              }}>
                Loading availability...
              </Text>
            </View>
          ) : (
            <View>
              {isMobileLayout ? (
                <AvailabilityGridMobile
                  start={windowStartDate}
                  days={7}
                  slotMinutes={30}
                  selected={selected}
                  onToggle={onToggle}
                  counts={counts}
                  memberCount={memberCount}
                  initialHour={8}
                />
              ) : (
                <AvailabilityGrid
                  start={windowStartDate}
                  days={7}
                  slotMinutes={30}
                  selected={selected}
                  onToggle={onToggle}
                  counts={counts}
                  memberCount={memberCount}
                  initialHour={8}
                />
              )}
            </View>
          )}
        </ScrollView>
      </AnimatedPage>
    </GradientBackground>
  );
}