import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GradientBackground from '@/components/GradientBackground';
import AvailabilityGrid, { SlotKey } from '@/components/AvailabilityGrid';
import { Typography, Spacing, BorderRadius } from '@/theme/designTokens';
import {
  computeWindow,
  getGroupAvailability,
  replaceMyAvailability,
  type AvailabilityWindow,
} from '@/services/availability';

/**
 * Quick Pick Custom Time Selector (when2meet-style)
 * Lets users select availability slots, then continues the flow
 */
export default function QuickPickCustomTime() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const { groupId, groupName } = useLocalSearchParams<{ groupId: string; groupName?: string }>();

  const [loading, setLoading] = useState(true);
  const [window, setWindow] = useState<AvailabilityWindow | null>(null);
  const [counts, setCounts] = useState<Record<SlotKey, number>>({});
  const [memberCount, setMemberCount] = useState(0);
  const [selected, setSelected] = useState<Set<SlotKey>>(new Set());
  const [saving, setSaving] = useState(false);

  // Compute default window: next 7 days rounded to 30-min slot
  useEffect(() => {
    const w = computeWindow(new Date(), 30, 7);
    setWindow(w);
  }, []);

  // Load availability
  useEffect(() => {
    const load = async () => {
      if (!groupId || !window) return;
      try {
        setLoading(true);
        const gid = parseInt(groupId, 10);
        const { counts, mySlots, memberCount } = await getGroupAvailability(gid, window);
        setCounts(counts);
        setMemberCount(memberCount);
        setSelected(new Set(mySlots));
      } catch (e) {
        console.warn('Failed to load availability:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [groupId, window?.startIso, window?.endIso]);

  const startDate = useMemo(() => (window ? new Date(window.startIso) : new Date()), [window?.startIso]);

  const toggleSlot = (iso: SlotKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso); else next.add(iso);
      return next;
    });
  };

  const handleSaveAndContinue = async () => {
    if (!groupId || !window) return;
    if (selected.size === 0) return;

    const gid = parseInt(groupId, 10);
    setSaving(true);
    try {
      // Persist my availability in the window
      await replaceMyAvailability(gid, window, Array.from(selected));

      // Derive a custom time range from selected slots (min..max)
      const slotArray = Array.from(selected).sort();
      const startIso = slotArray[0];
      const endIso = new Date(new Date(slotArray[slotArray.length - 1]).getTime() + 30 * 60 * 1000).toISOString();

      router.push(
        `/quick-pick/what?groupId=${gid}&groupName=${encodeURIComponent(groupName || '')}&timeWindow=custom&windowStart=${startIso}&windowEnd=${endIso}`
      );
    } catch (e) {
      console.warn('Save availability failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => router.back();

  return (
    <GradientBackground variant="dim">
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, paddingBottom: Spacing.sm }}>
          <Pressable
            onPress={handleBack}
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
              color: c.text,
              fontSize: Typography.scale.heading3.fontSize,
              fontWeight: '700',
              fontFamily: Typography.fontFamily.displayBold,
            }}>
              Custom Time
            </Text>
            <Text style={{ color: c.muted, fontSize: Typography.scale.bodySmall.fontSize }}>
              Select your availability (30-min slots)
            </Text>
          </View>
        </View>

        {/* Body */}
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0 }}>
          {loading || !window ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: Spacing.xl }}>
              <ActivityIndicator size="large" color={c.primary} />
              <Text style={{ color: c.muted, marginTop: Spacing.md }}>Loading availability…</Text>
            </View>
          ) : (
            <AvailabilityGrid
              start={startDate}
              days={7}
              slotMinutes={30}
              selected={selected}
              onToggle={toggleSlot}
              counts={counts}
              memberCount={memberCount}
              initialHour={8}
            />
          )}
        </ScrollView>

        {/* Bottom CTA */}
        <View style={{ padding: Spacing.lg }}>
          <Pressable
            onPress={handleSaveAndContinue}
            disabled={saving || selected.size === 0}
            style={({ pressed }) => ({ opacity: pressed ? 0.9 : (selected.size ? 1 : 0.5) })}
          >
            <LinearGradient
              colors={['#FF6F61', '#F59E0B'] as const}
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
              <Text style={{ color: '#fff', fontSize: Typography.scale.bodyLarge.fontSize, fontWeight: '700', marginRight: Spacing.sm }}>
                {saving ? 'Saving…' : 'Save & Continue'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}
