import { View, Text, Pressable, FlatList, Alert, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import GradientHeader from '@/components/GradientHeader';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/services/supabase';
import { useLocalSearchParams, router } from 'expo-router';
import { regenerateInviteCode } from '@/services/groups';
import EventRowCard from '@/components/EventRowCard';
import type { Event } from '@/types/models';

export default function GroupFeed() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Number(id);
  const [group, setGroup] = useState<any>(null);
  const [polls, setPolls] = useState<any[]>([]);
  const [winnersById, setWinnersById] = useState<Record<number, Event>>({});

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
      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(channelGroup);
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
    } catch (e: any) {
      Alert.alert('Not allowed', e.message ?? String(e));
    }
  };

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

  return (
    <GradientBackground variant="dim">
      <View style={{ flex: 1, padding: 16 }}>
        <GradientHeader title={group?.name ?? 'Group'} />
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
            <Pressable onPress={onCopy}>
              <Text style={{ color: c.text, fontWeight: '700' }}>Copy</Text>
            </Pressable>
            <Pressable onPress={onRegenerate}>
              <Text style={{ color: c.primary, fontWeight: '700' }}>Regenerate</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push(`/(tabs)/polls/new?groupId=${groupId}`)}
          style={{ backgroundColor: c.card, padding: 12, borderRadius: 12, marginBottom: 12 }}
        >
          <Text style={{ color: c.text, fontWeight: '700' }}>New Poll</Text>
        </Pressable>

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
