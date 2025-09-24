import { View, Text, Pressable, FlatList, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useThemeColors } from '@/theme/ThemeProvider';
import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { useLocalSearchParams, router } from 'expo-router';
import { regenerateInviteCode } from '@/services/groups';

export default function GroupFeed() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Number(id);
  const [group, setGroup] = useState<any>(null);
  const [polls, setPolls] = useState<any[]>([]);

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
      await Clipboard.setStringAsync(group.invite_code);
      Alert.alert('Copied', 'Invite code copied to clipboard');
    } catch (e: any) {
      Alert.alert('Copy failed', e.message ?? String(e));
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
              <Text style={{ color: c.muted, marginTop: 4 }}>
                Committed: Event #{item.final_event_id}
              </Text>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ color: c.muted }}>No polls yet.</Text>}
      />
    </View>
  );
}
