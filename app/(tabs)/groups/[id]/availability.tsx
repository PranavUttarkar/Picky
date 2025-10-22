import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import GradientBackground from '@/components/GradientBackground';
import GradientHeader from '@/components/GradientHeader';
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

  const window = useMemo(() => computeWindow(now, 30, 7), [now]);

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

  const onToggle = (iso: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  };

  const onSave = async () => {
    try {
      setSaving(true);
      await replaceMyAvailability(groupId, window, Array.from(selected.values()));
      await refresh();
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 1500);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <GradientBackground variant="dim">
      <View style={{ flex: 1, padding: 16, paddingBottom: 16 + Math.max(0, insets.bottom) + 24 }}>
        <GradientHeader
          title="Find common times"
          onBack={() => router.push(`/(tabs)/groups/${groupId}`)}
          backLabel="Back to group"
        />
        <Text style={{ color: c.muted, marginBottom: 8 }}>
          Drag or tap to mark your availability over the next 7 days starting now. We'll show how
          many group members can make each slot.
        </Text>
        {summary.top ? (
          <View
            style={{
              backgroundColor: c.card,
              padding: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#00000020',
              marginBottom: 8,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '700' }}>
              Best overlap: {new Date(summary.top.iso).toLocaleString()} – {summary.top.count}/
              {summary.total}
            </Text>
            {summary.pending > 0 ? (
              <Text style={{ color: c.muted, marginTop: 4 }}>{summary.pending} pending</Text>
            ) : summary.total > 0 && summary.top.count === summary.total ? (
              <Text style={{ color: c.text, marginTop: 4, fontWeight: '700' }}>
                Winner found 🎉
              </Text>
            ) : null}
          </View>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            marginBottom: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <Pressable
            onPress={() => setNow(new Date())}
            style={{
              backgroundColor: c.card,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
            }}
            accessibilityRole="button"
            accessibilityLabel="Jump to now"
          >
            <Text style={{ color: c.text, fontWeight: '700' }}>Now</Text>
          </Pressable>
          <Pressable
            onPress={() => setNow(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))}
            style={{
              backgroundColor: c.card,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
            }}
            accessibilityRole="button"
            accessibilityLabel="Previous week"
          >
            <Ionicons name="chevron-back" size={18} color={c.text} />
          </Pressable>
          <Pressable
            onPress={() => setNow(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000))}
            style={{
              backgroundColor: c.card,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
            }}
            accessibilityRole="button"
            accessibilityLabel="Next week"
          >
            <Ionicons name="chevron-forward" size={18} color={c.text} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={saving ? undefined : onSave}
            disabled={saving}
            style={{
              backgroundColor: c.primary,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              opacity: saving ? 0.7 : 1,
            }}
            accessibilityRole="button"
            accessibilityLabel="Save availability"
          >
            <Text style={{ color: c.text, fontWeight: '800' }}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>

        {savedBanner ? (
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: c.text, fontWeight: '700' }}>Availability saved ✓</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : isMobileLayout ? (
          <AvailabilityGridMobile
            start={new Date(window.startIso)}
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
            start={new Date(window.startIso)}
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
    </GradientBackground>
  );
}
