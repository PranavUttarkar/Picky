import { View, Text, Pressable, FlatList, Alert, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useThemeColors } from '@/theme/ThemeProvider';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { useLocalSearchParams, router } from 'expo-router';
import { regenerateInviteCode } from '@/services/groups';

export default function GroupFeed() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Number(id);
  const [group, setGroup] = useState<any>(null);
  const [polls, setPolls] = useState<any[]>([]);
  const [feedbackMap, setFeedbackMap] = useState<Record<number, number>>({}); // poll_id -> my rating

  const load = useCallback(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      router.replace('/onboarding/welcome');
      return;
    }
    const { data: g } = await supabase.from('groups').select('*').eq('id', groupId).single();
    setGroup(g);
    const { data: p } = await supabase
      .from('polls')
      .select('id,group_id,is_active,created_at,final_event_id,final:events!polls_final_event_id_fkey(id,title,date_time,location,description)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    setPolls(p ?? []);
    // Fetch existing feedback for user across these polls
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (user && (p?.length ?? 0) > 0) {
        const ids = (p ?? []).map((row: any) => row.id);
        const { data: fb } = await supabase
          .from('post_event_feedback')
          .select('poll_id,rating')
          .in('poll_id', ids)
          .eq('user_id', user.id);
        const map: Record<number, number> = {};
        for (const r of (fb as any[]) ?? []) map[Number(r.poll_id)] = Number(r.rating);
        setFeedbackMap(map);
      } else {
        setFeedbackMap({});
      }
    } catch {}
  }, [groupId]);

  useEffect(() => {
    load();
    // Realtime channel for polls in this group
    const channel = supabase
      .channel(`group-polls-${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polls', filter: `group_id=eq.${groupId}` },
        () => {
          load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, load]);

  // Handle refresh=1 param forcing reload (e.g., after poll deletion nav)
  useEffect(() => {
    const params: any = useLocalSearchParams();
    if (params?.refresh) {
      load();
    }
  }, [load]);

  const onRegenerate = async () => {
    try {
      const code = await regenerateInviteCode(groupId);
      setGroup((prev: any) => ({ ...prev, invite_code: code }));
      const { data: g } = await supabase
        .from('groups')
        .select('invite_code')
        .eq('id', groupId)
        .single();
      if (g?.invite_code && g.invite_code !== code) {
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
    <View style={{ flex: 1, backgroundColor: c.background, padding: 16 }}>
      <Text style={{ color: c.text, fontWeight: '800', fontSize: 18 }}>
        {group?.name ?? 'Group'}
      </Text>
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
        renderItem={({ item }) => {
          const pastCommitted = !item.is_active && item.final_event_id && item.final?.date_time && new Date(item.final.date_time) < new Date();
          const myRating = feedbackMap[item.id];
          return (
            <View style={{ marginBottom: 8 }}>
              <Pressable
                onPress={() => router.push(`/(tabs)/polls/${item.id}`)}
                style={{ backgroundColor: c.card, padding: 12, borderRadius: 12 }}
              >
                <Text style={{ color: c.text, fontWeight: '700' }}>
                  Poll #{item.id} {item.is_active ? '' : '(Closed)'}
                </Text>
                {item.final ? (
                  <Text style={{ color: c.muted, marginTop: 4 }}>
                    Final: {item.final.title} •{' '}
                    {item.final.date_time ? new Date(item.final.date_time).toLocaleDateString() : ''}
                  </Text>
                ) : null}
                <Text style={{ color: c.muted, marginTop: 4 }}>
                  Created {new Date(item.created_at).toLocaleString()}
                </Text>
              </Pressable>
              {pastCommitted ? (
                <View
                  style={{
                    backgroundColor: c.card,
                    padding: 10,
                    borderRadius: 12,
                    marginTop: 4,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '700' }}>
                    How was it? {myRating ? `You rated ${myRating}★` : ''}
                  </Text>
                  {!myRating ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      {[1, 2, 3, 4, 5].map((r) => (
                        <Pressable
                          key={r}
                          onPress={async () => {
                            try {
                              const user = (await supabase.auth.getUser()).data.user;
                              if (!user) {
                                router.push('/onboarding/welcome');
                                return;
                              }
                              const { error } = await supabase
                                .from('post_event_feedback')
                                .upsert(
                                  { poll_id: item.id, user_id: user.id, rating: r },
                                  { onConflict: 'poll_id,user_id' },
                                );
                              if (error) throw error;
                              setFeedbackMap((prev) => ({ ...prev, [item.id]: r }));
                              Alert.alert('Thanks!', 'Feedback saved');
                            } catch (e: any) {
                              Alert.alert('Error', e.message ?? String(e));
                            }
                          }}
                          style={{
                            backgroundColor: c.background,
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 8,
                          }}
                        >
                          <Text style={{ color: c.text }}>{r}★</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={{ color: c.muted }}>No polls yet.</Text>}
      />
    </View>
  );
}
