import { View, Text, Pressable, FlatList, Alert } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/services/supabase';
import { useLocalSearchParams, router } from 'expo-router';
import { castVote, closePoll, getPoll, onPollRealtime, clearMyVote } from '@/services/polls';

export default function PollDetails() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pollId = Number(id);
  const [poll, setPoll] = useState<any>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [myVote, setMyVote] = useState<number | null | undefined>(undefined);

  const load = async () => {
    const { poll, options, myVote } = await getPoll(pollId);
    setPoll(poll);
    setOptions(options);
    setMyVote(myVote);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        router.replace('/onboarding/welcome');
        return;
      }
      await load();
      const unsub = onPollRealtime(pollId, () => {
        if (mounted) load();
      });
      return () => unsub();
    })();
    return () => {
      mounted = false;
    };
  }, [pollId]);

  const totalVotes = useMemo(() => options.reduce((sum, o) => sum + (o.votes ?? 0), 0), [options]);

  const onVote = async (eventId: number) => {
    try {
      if (!poll?.is_active) return;
      await castVote(pollId, eventId);
      await load();
    } catch (e: any) {
      Alert.alert('Vote failed', e.message ?? String(e));
    }
  };

  const onClose = async () => {
    try {
      await closePoll(pollId);
      await load();
    } catch (e: any) {
      Alert.alert('Close failed', e.message ?? String(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background, padding: 16 }}>
      <Text style={{ color: c.text, fontWeight: '800', fontSize: 18 }}>Poll #{pollId}</Text>
      <Text style={{ color: c.muted, marginTop: 6 }}>{poll?.is_active ? 'Open' : 'Closed'}</Text>

      {poll?.is_active ? (
        <Pressable
          onPress={onClose}
          style={{
            alignSelf: 'flex-start',
            backgroundColor: c.card,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            marginTop: 12,
          }}
        >
          <Text style={{ color: c.text, fontWeight: '700' }}>Close Poll</Text>
        </Pressable>
      ) : null}

      {options.length === 1 ? (
        <View style={{ marginTop: 20 }}>
          <Pressable
            onPress={() => router.push(`/events/${options[0].event_id}`)}
            style={{ backgroundColor: c.card, padding: 12, borderRadius: 12 }}
          >
            <Text style={{ color: c.text, fontWeight: '700' }}>Event #{options[0].event_id}</Text>
          </Pressable>
          <Text style={{ color: c.text, fontWeight: '700', marginBottom: 12, marginTop: 12 }}>
            Do you want to attend?
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={() => onVote(options[0].event_id)}
              disabled={!poll?.is_active}
              style={{
                flex: 1,
                backgroundColor: myVote === options[0].event_id ? c.primary : c.card,
                padding: 14,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: c.text, fontWeight: '700' }}>Yes</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                try {
                  await clearMyVote(pollId);
                  await load();
                } catch (e: any) {
                  Alert.alert('Update failed', e.message ?? String(e));
                }
              }}
              disabled={!poll?.is_active || myVote == null}
              style={{
                flex: 1,
                backgroundColor: myVote == null ? c.card : c.accent,
                padding: 14,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: c.text, fontWeight: '700' }}>No</Text>
            </Pressable>
          </View>
          <View style={{ backgroundColor: c.card, padding: 12, borderRadius: 12, marginTop: 12 }}>
            <Text style={{ color: c.muted }}>Yes votes: {totalVotes}</Text>
          </View>
        </View>
      ) : (
        <FlatList
          style={{ marginTop: 16 }}
          data={options}
          keyExtractor={(o) => String(o.event_id)}
          renderItem={({ item }) => {
            const count = item.votes ?? 0;
            const pct = totalVotes === 0 ? 0 : Math.round((count * 100) / totalVotes);
            const isMine = myVote === item.event_id;
            return (
              <Pressable
                onPress={() => onVote(item.event_id)}
                disabled={!poll?.is_active}
                style={{ backgroundColor: c.card, borderRadius: 12, padding: 12, marginBottom: 10 }}
              >
                <Text style={{ color: c.text, fontWeight: '700' }}>Event #{item.event_id}</Text>
                <View
                  style={{
                    height: 8,
                    backgroundColor: c.background,
                    borderRadius: 6,
                    marginTop: 8,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isMine ? c.primary : c.accent,
                      flex: 1,
                    }}
                  />
                </View>
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}
                >
                  <Text style={{ color: c.muted }}>{count} votes</Text>
                  <Text style={{ color: c.muted }}>{pct}%</Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={{ color: c.muted, marginTop: 20 }}>No options.</Text>}
        />
      )}
    </View>
  );
}
