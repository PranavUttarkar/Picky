import { View, Text, Pressable, FlatList, Alert } from 'react-native';
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
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        router.replace('/onboarding/welcome');
        return;
      }
      const { data: g } = await supabase.from('groups').select('*').eq('id', groupId).single();
      setGroup(g);
      const { data: p } = await supabase
        .from('polls')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });
      setPolls(p ?? []);
    })();
  }, [groupId]);

  const onRegenerate = async () => {
    try {
      const code = await regenerateInviteCode(groupId);
      setGroup((prev: any) => ({ ...prev, invite_code: code }));
      Alert.alert('Invite code regenerated', code);
    } catch (e: any) {
      Alert.alert('Not allowed', e.message ?? String(e));
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
          <Pressable onPress={onRegenerate} style={{ marginLeft: 'auto' }}>
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
            <Text style={{ color: c.text, fontWeight: '700' }}>
              Poll #{item.id} {item.is_active ? '' : '(Closed)'}
            </Text>
            <Text style={{ color: c.muted, marginTop: 4 }}>
              Created {new Date(item.created_at).toLocaleString()}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ color: c.muted }}>No polls yet.</Text>}
      />
    </View>
  );
}
