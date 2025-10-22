import { View, Text, Pressable, FlatList, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import GradientHeader from '@/components/GradientHeader';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/services/supabase';
import { computeWindow, getGroupAvailabilitySummary } from '@/services/availability';
import { useLocalSearchParams, router } from 'expo-router';
import { regenerateInviteCode } from '@/services/groups';
import { shareGroup } from '@/utils/share';
import EventRowCard from '@/components/EventRowCard';
import type { Event } from '@/types/models';

export default function GroupFeed() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Number(id);
  const [group, setGroup] = useState<any>(null);
  const [polls, setPolls] = useState<any[]>([]);
  const [winnersById, setWinnersById] = useState<Record<number, Event>>({});
  const [infoOpen, setInfoOpen] = useState<null | 'groupDecide' | 'newPoll' | 'findTimes'>(null);
  const [summary, setSummary] = useState<{
    top?: { iso: string; count: number } | null;
    memberCount: number;
    pendingCount: number;
  }>({ top: null, memberCount: 0, pendingCount: 0 });
  const [regenCooldown, setRegenCooldown] = useState<number>(0);
  const regenTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        router.replace('/onboarding/welcome');
        return;
      }
      const { data: g } = await supabase.from('groups').select('*').eq('id', groupId).single();
      const { data: p } = await supabase
        .from('polls')
        .select('id,created_at,is_active,title,deadline_at,final_event_id')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });
      if (!mounted) return;
      setGroup(g);
      setPolls(p ?? []);
      const channel = supabase
        .channel(`group-${groupId}-polls`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'polls', filter: `group_id=eq.${groupId}` },
          async () => {
            const { data: p2 } = await supabase
              .from('polls')
              .select('id,created_at,is_active,title,deadline_at,final_event_id')
              .eq('group_id', groupId)
              .order('created_at', { ascending: false });
            if (mounted) setPolls(p2 ?? []);
          },
        )
        .subscribe();
      const channelGroup = supabase
        .channel(`group-${groupId}-row`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` },
          async () => {
            const { data: g2 } = await supabase
              .from('groups')
              .select('*')
              .eq('id', groupId)
              .single();
            if (mounted) setGroup(g2);
          },
        )
        .subscribe();
      // Subscribe to availability changes for live summary updates
      const window = computeWindow(new Date(), 30, 7);
      const availChannel = supabase
        .channel(`group-${groupId}-availability`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'group_availability',
            filter: `group_id=eq.${groupId}`,
          },
          async () => {
            try {
              const s = await getGroupAvailabilitySummary(groupId, window, 1);
              setSummary({
                top: s.topSlots[0]
                  ? { iso: s.topSlots[0].slotIso, count: s.topSlots[0].count }
                  : null,
                memberCount: s.memberCount,
                pendingCount: s.pendingCount,
              });
            } catch {}
          },
        )
        .subscribe();

      // Initial summary fetch
      (async () => {
        try {
          const s = await getGroupAvailabilitySummary(groupId, window, 1);
          setSummary({
            top: s.topSlots[0] ? { iso: s.topSlots[0].slotIso, count: s.topSlots[0].count } : null,
            memberCount: s.memberCount,
            pendingCount: s.pendingCount,
          });
        } catch {}
      })();

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(channelGroup);
        supabase.removeChannel(availChannel);
      };
    })();
    return () => {
      mounted = false;
    };
  }, [groupId]);

  // Fetch winner events for any polls that have final_event_id
  useEffect(() => {
    (async () => {
      const ids = Array.from(new Set(polls.map((p) => p.final_event_id).filter(Boolean)));
      const missing = ids.filter((id) => !winnersById[id!]);
      if (!missing.length) return;
      const { data } = await supabase
        .from('events')
        .select('id,title,description,location,date_time,image_url,image_urls,tags,rsvp_url')
        .in('id', missing as number[]);
      if (data && data.length) {
        setWinnersById((prev) => {
          const next = { ...prev };
          for (const ev of data as Event[]) next[ev.id] = ev;
          return next;
        });
      }
    })();
  }, [polls]);

  const onRegenerate = async () => {
    try {
      if (regenCooldown > 0) {
        Alert.alert('Please wait', `You can regenerate again in ${regenCooldown}s`);
        return;
      }
      const code = await regenerateInviteCode(groupId);
      // Update local immediately, then refetch to confirm
      setGroup((prev: any) => ({ ...prev, invite_code: code }));
      const { data: g } = await supabase
        .from('groups')
        .select('invite_code')
        .eq('id', groupId)
        .single();
      if (g?.invite_code && g.invite_code !== code) {
        // If server differed, prefer server
        setGroup((prev: any) => ({ ...prev, invite_code: g.invite_code }));
      }
      Alert.alert('Invite code regenerated', g?.invite_code ?? code);
      // Start cooldown ~30s
      setRegenCooldown(30);
      try {
        if (regenTimerRef.current) clearInterval(regenTimerRef.current);
      } catch {}
      regenTimerRef.current = setInterval(() => {
        setRegenCooldown((s) => {
          if (s <= 1) {
            if (regenTimerRef.current) clearInterval(regenTimerRef.current);
            regenTimerRef.current = null;
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch (e: any) {
      Alert.alert('Not allowed', e.message ?? String(e));
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      try {
        if (regenTimerRef.current) clearInterval(regenTimerRef.current);
      } catch {}
    };
  }, []);

  const onCopy = async () => {
    try {
      if (!group?.invite_code) return;
      const code = group.invite_code as string;
      const nav: any = (globalThis as any).navigator;
      if (Platform.OS === 'web' && nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(code);
      } else {
        await Clipboard.setStringAsync(code);
      }
      Alert.alert('Copied', 'Invite code copied to clipboard');
    } catch (e: any) {
      // Fallback for older browsers: execCommand
      try {
        if (Platform.OS === 'web') {
          const doc: any = (globalThis as any).document;
          const el = doc.createElement('textarea');
          el.value = group?.invite_code ?? '';
          el.setAttribute('readonly', '');
          el.style.position = 'absolute';
          el.style.left = '-9999px';
          doc.body.appendChild(el);
          el.select();
          doc.execCommand('copy');
          doc.body.removeChild(el);
          Alert.alert('Copied', 'Invite code copied to clipboard');
          return;
        }
      } catch {}
      Alert.alert('Copy failed', e?.message ?? String(e));
    }
  };

  const onShare = async () => {
    try {
      if (!group?.invite_code) {
        // Attempt to generate an invite code if missing
        try {
          const code = await regenerateInviteCode(groupId);
          setGroup((prev: any) => ({ ...prev, invite_code: code }));
        } catch (e: any) {
          Alert.alert('Cannot share', e?.message ?? 'Invite link is not available for this group');
          return;
        }
      }
      await shareGroup({ name: group?.name, invite_code: group.invite_code });
    } catch (e: any) {
      Alert.alert('Share failed', e?.message ?? String(e));
    }
  };

  return (
    <GradientBackground variant="dim">
      <View style={{ flex: 1, padding: 16 }}>
        <GradientHeader
          title={group?.name ?? 'Group'}
          onBack={() => router.push('/(tabs)/groups')}
          backLabel="Back to groups"
        />
        {group?.invite_code ? (
          <View
            style={{
              marginTop: 8,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Text style={{ color: c.muted }}>Invite code:</Text>
            <Text style={{ color: c.text, letterSpacing: 2 }}>{group.invite_code}</Text>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={onCopy}
              accessibilityRole="button"
              accessibilityLabel="Copy invite code"
              hitSlop={8}
              style={{ padding: 4 }}
            >
              <Ionicons name="copy-outline" size={18} color={c.text} />
            </Pressable>
            <Pressable
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel="Share invite link"
              hitSlop={8}
              style={{ padding: 4 }}
            >
              <Ionicons name="paper-plane" size={18} color={c.text} />
            </Pressable>
            <Pressable
              onPress={regenCooldown > 0 ? undefined : onRegenerate}
              disabled={regenCooldown > 0}
              style={{ opacity: regenCooldown > 0 ? 0.6 : 1 }}
            >
              <Text style={{ color: c.primary, fontWeight: '700' }}>
                {regenCooldown > 0 ? `Regenerate (${regenCooldown}s)` : 'Regenerate'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={{
              marginTop: 8,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Text style={{ color: c.muted }}>Invite link:</Text>
            <Text style={{ color: c.muted }}>Not enabled</Text>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel="Share invite link"
              hitSlop={8}
              style={{ padding: 4 }}
            >
              <Ionicons name="share-outline" size={18} color={c.text} />
            </Pressable>
            <Pressable onPress={onRegenerate}>
              <Text style={{ color: c.primary, fontWeight: '700' }}>Enable</Text>
            </Pressable>
          </View>
        )}

        {/* Common times summary card */}
        <View
          style={{
            backgroundColor: c.card,
            padding: 12,
            borderRadius: 12,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: '#00000020',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Ionicons name="time-outline" size={18} color={c.text} />
            <Text style={{ color: c.text, fontWeight: '800', marginLeft: 8 }}>
              Common times (next 7 days)
            </Text>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => router.push(`/(tabs)/groups/${groupId}/availability`)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                backgroundColor: c.background,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: c.text, fontWeight: '700' }}>Open</Text>
            </Pressable>
          </View>
          {summary.top ? (
            <Text style={{ color: c.text }}>
              Top: {new Date(summary.top.iso).toLocaleString()} – {summary.top.count}/
              {summary.memberCount} available
            </Text>
          ) : (
            <Text style={{ color: c.muted }}>No availability yet.</Text>
          )}
          {summary.pendingCount > 0 ? (
            <Text style={{ color: c.muted, marginTop: 4 }}>{summary.pendingCount} pending</Text>
          ) : summary.memberCount > 0 &&
            summary.top &&
            summary.top.count === summary.memberCount ? (
            <Text style={{ color: c.text, marginTop: 4, fontWeight: '700' }}>Winner found 🎉</Text>
          ) : null}
        </View>

        {/* Actions: Group Decide and New Poll with info icons */}
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* Group Decide button with inline info icon (overlay inside button) */}
          <Pressable style={{ position: 'relative' }} onHoverOut={() => setInfoOpen(null)}>
            <Pressable
              onPress={() => router.push(`/(tabs)/group-decide?groupId=${groupId}`)}
              style={{
                backgroundColor: c.card,
                paddingVertical: 10,
                paddingHorizontal: 18,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingRight: 34,
                position: 'relative',
              }}
              accessibilityRole="button"
              accessibilityLabel="Start Group Decide"
            >
              <Ionicons name="flash-outline" size={18} color={c.text} />
              <Text style={{ color: c.text, fontWeight: '700' }}>Group Decide</Text>
              <Pressable
                onPress={() => setInfoOpen((v) => (v === 'groupDecide' ? null : 'groupDecide'))}
                onHoverIn={() => setInfoOpen('groupDecide')}
                accessibilityRole="button"
                accessibilityLabel="What is Group Decide?"
                hitSlop={8}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: 6,
                  padding: 4,
                  borderRadius: 999,
                  zIndex: 2,
                }}
              >
                <Ionicons name="information-circle-outline" size={18} color={c.muted} />
              </Pressable>
            </Pressable>

            {infoOpen === 'groupDecide' && (
              <View style={{ position: 'absolute', right: 0, bottom: '100%', marginBottom: 8 }}>
                {/* Tooltip card */}
                <View
                  style={{
                    backgroundColor: c.card,
                    borderRadius: 10,
                    padding: 10,
                    maxWidth: 420,
                    borderWidth: 1,
                    borderColor: '#00000020',
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '800', marginBottom: 4 }}>
                    Group Decide
                  </Text>
                  <Text style={{ color: c.muted, lineHeight: 18 }}>
                    Everyone swipes/rates and the best option wins fast.
                  </Text>
                </View>
                {/* Tooltip arrow (triangle pointing down at the right edge) */}
                <View
                  style={{
                    alignSelf: 'flex-end',
                    marginTop: -1,
                    width: 0,
                    height: 0,
                    borderLeftWidth: 8,
                    borderRightWidth: 8,
                    borderBottomWidth: 10,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderBottomColor: c.card,
                  }}
                />
              </View>
            )}
          </Pressable>

          {/* New Poll button with inline info icon (overlay inside button) */}
          <Pressable style={{ position: 'relative' }} onHoverOut={() => setInfoOpen(null)}>
            <Pressable
              onPress={() => router.push(`/(tabs)/polls/new?groupId=${groupId}`)}
              style={{
                backgroundColor: c.card,
                paddingVertical: 10,
                paddingHorizontal: 18,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingRight: 34,
                position: 'relative',
              }}
              accessibilityRole="button"
              accessibilityLabel="Create a new poll"
            >
              <Ionicons name="create-outline" size={18} color={c.text} />
              <Text style={{ color: c.text, fontWeight: '700' }}>New Poll</Text>
              <Pressable
                onPress={() => setInfoOpen((v) => (v === 'newPoll' ? null : 'newPoll'))}
                onHoverIn={() => setInfoOpen('newPoll')}
                accessibilityRole="button"
                accessibilityLabel="What is a New Poll?"
                hitSlop={8}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: 6,
                  padding: 4,
                  borderRadius: 999,
                  zIndex: 2,
                }}
              >
                <Ionicons name="information-circle-outline" size={18} color={c.muted} />
              </Pressable>
            </Pressable>

            {infoOpen === 'newPoll' && (
              <View style={{ position: 'absolute', right: 0, bottom: '100%', marginBottom: 8 }}>
                <View
                  style={{
                    backgroundColor: c.card,
                    borderRadius: 10,
                    padding: 10,
                    maxWidth: 420,
                    borderWidth: 1,
                    borderColor: '#00000020',
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '800', marginBottom: 4 }}>
                    New Poll
                  </Text>
                  <Text style={{ color: c.muted, lineHeight: 18 }}>
                    choose options & let members vote. You can commit the winner later.
                  </Text>
                </View>
                <View
                  style={{
                    alignSelf: 'flex-end',
                    marginTop: -1,
                    width: 0,
                    height: 0,
                    borderLeftWidth: 8,
                    borderRightWidth: 8,
                    borderBottomWidth: 10,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderBottomColor: c.card,
                  }}
                />
              </View>
            )}
          </Pressable>

          {/* Find common times button with inline info icon (overlay inside button) */}
          <Pressable style={{ position: 'relative' }} onHoverOut={() => setInfoOpen(null)}>
            <Pressable
              onPress={() => router.push(`/(tabs)/groups/${groupId}/availability`)}
              style={{
                backgroundColor: c.card,
                paddingVertical: 10,
                paddingHorizontal: 18,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingRight: 34,
                position: 'relative',
              }}
              accessibilityRole="button"
              accessibilityLabel="Find common times"
            >
              <Ionicons name="time-outline" size={18} color={c.text} />
              <Text style={{ color: c.text, fontWeight: '700' }}>Find common times</Text>
              <Pressable
                onPress={() => setInfoOpen((v) => (v === 'findTimes' ? null : 'findTimes'))}
                onHoverIn={() => setInfoOpen('findTimes')}
                accessibilityRole="button"
                accessibilityLabel="What is Find common times?"
                hitSlop={8}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: 6,
                  padding: 4,
                  borderRadius: 999,
                  zIndex: 2,
                }}
              >
                <Ionicons name="information-circle-outline" size={18} color={c.muted} />
              </Pressable>
            </Pressable>

            {infoOpen === 'findTimes' && (
              <View style={{ position: 'absolute', right: 0, bottom: '100%', marginBottom: 8 }}>
                <View
                  style={{
                    backgroundColor: c.card,
                    borderRadius: 10,
                    padding: 10,
                    maxWidth: 420,
                    borderWidth: 1,
                    borderColor: '#00000020',
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '800', marginBottom: 4 }}>
                    Find Common Times
                  </Text>
                  <Text style={{ color: c.muted, lineHeight: 18 }}>
                    Everyone marks availability. We surface top overlaps and show pending until all
                    respond; when everyone has responded, the winner time is highlighted.
                  </Text>
                </View>
                <View
                  style={{
                    alignSelf: 'flex-end',
                    marginTop: -1,
                    width: 0,
                    height: 0,
                    borderLeftWidth: 8,
                    borderRightWidth: 8,
                    borderBottomWidth: 10,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderBottomColor: c.card,
                  }}
                />
              </View>
            )}
          </Pressable>
        </View>

        <FlatList
          data={polls}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(tabs)/polls/${item.id}`)}
              style={{ backgroundColor: c.card, padding: 12, borderRadius: 12, marginBottom: 8 }}
            >
              <Text style={{ color: c.text, fontWeight: '800' }}>
                {item.title || `Poll #${item.id}`} {item.is_active ? '' : '(Closed)'}
              </Text>
              <Text style={{ color: c.muted, marginTop: 4 }}>
                {item.deadline_at
                  ? `Due ${new Date(item.deadline_at).toLocaleString()}`
                  : `Created ${new Date(item.created_at).toLocaleString()}`}
              </Text>
              {item.final_event_id ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ color: c.text, fontWeight: '700', marginBottom: 6 }}>Winner</Text>
                  {/* Winner event card with crown overlay */}
                  <View style={{ position: 'relative' }}>
                    {winnersById[item.final_event_id] ? (
                      <EventRowCard
                        event={winnersById[item.final_event_id]}
                        isSaved={false}
                        onToggleSave={() => {}}
                        onOpenDetails={() => router.push(`/events/${item.final_event_id}`)}
                      />
                    ) : (
                      <View style={{ backgroundColor: c.card, padding: 12, borderRadius: 12 }}>
                        <Text style={{ color: c.muted }}>Loading event…</Text>
                      </View>
                    )}
                    <View
                      style={{
                        position: 'absolute',
                        top: -30,
                        right: -26,
                        transform: [{ rotate: '45deg' }],
                        backgroundColor: 'transparent',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 999,
                      }}
                      pointerEvents="none"
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      <Text style={{ fontSize: 34 }}>👑</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <Pressable
                      onPress={() => router.push(`/(tabs)/polls/${item.id}`)}
                      style={{
                        backgroundColor: c.primary,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: c.text, fontWeight: '700' }}>View</Text>
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        try {
                          // Fetch event to build calendar URL
                          const { data: ev } = await supabase
                            .from('events')
                            .select('id,title,description,location,date_time')
                            .eq('id', item.final_event_id)
                            .single();
                          if (!ev?.date_time) return;
                          const startIso = new Date(ev.date_time).toISOString();
                          const endIso = new Date(
                            new Date(ev.date_time).getTime() + 2 * 60 * 60 * 1000,
                          ).toISOString();
                          const fmt = (iso: string) =>
                            iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
                          const params = new URLSearchParams({
                            action: 'TEMPLATE',
                            text: ev.title ?? 'Event',
                            details: ev.description ?? '',
                            location: ev.location ?? '',
                          });
                          const url = `https://calendar.google.com/calendar/render?${params.toString()}&dates=${fmt(
                            startIso,
                          )}/${fmt(endIso)}`;
                          Linking.openURL(url);
                        } catch {}
                      }}
                      style={{
                        backgroundColor: c.background,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: c.text, fontWeight: '700' }}>Add to Calendar</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </Pressable>
          )}
          ListEmptyComponent={<Text style={{ color: c.muted }}>No polls yet.</Text>}
        />
      </View>
    </GradientBackground>
  );
}
