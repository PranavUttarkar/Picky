import { View, Text, Pressable, FlatList, Alert, Image, Linking } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/services/supabase';
import { useLocalSearchParams, router } from 'expo-router';
import { castVote, closePoll, getPoll, onPollRealtime, clearMyVote, suggestLeader, castRating } from '@/services/polls';

export default function PollDetails() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pollId = Number(id);
  const [poll, setPoll] = useState<any>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [myVote, setMyVote] = useState<number | null | undefined>(undefined);
  const [totalMembers, setTotalMembers] = useState(0);
  const [responded, setResponded] = useState(0);
  const [myRatings, setMyRatings] = useState<Record<number, number> | undefined>(undefined);
  const [waiting, setWaiting] = useState<Array<{ id: string; name?: string | null }> | undefined>(undefined);

  const load = async () => {
    const { poll, options, myVote, myRatings, totalMembers, respondedCount, waiting } = await getPoll(pollId);
    setPoll(poll);
    setOptions(options);
    setMyVote(myVote);
    setMyRatings(myRatings);
    setTotalMembers(totalMembers);
    setResponded(respondedCount);
    setWaiting(waiting);
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
  const leader = useMemo(() => suggestLeader(options), [options]);
  const progressPct = useMemo(() => (totalMembers ? Math.round((responded * 100) / totalMembers) : 0), [responded, totalMembers]);

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
      <Text style={{ color: c.text, fontWeight: '800', fontSize: 18 }}>{poll?.title || `Poll #${pollId}`}</Text>
      <Text style={{ color: c.muted, marginTop: 6 }}>{poll?.is_active ? 'Open' : 'Closed'}{poll?.deadline_at ? ` • closes ${new Date(poll.deadline_at).toLocaleString()}` : ''}</Text>

      {/* Response progress */}
      {totalMembers > 0 ? (
        <View style={{ backgroundColor: c.card, padding: 10, borderRadius: 12, marginTop: 10 }}>
          <Text style={{ color: c.text, fontWeight: '700' }}>{responded}/{totalMembers} responded ({progressPct}%)</Text>
          <View style={{ height: 6, backgroundColor: c.background, borderRadius: 6, marginTop: 6, overflow: 'hidden' }}>
            <View style={{ width: `${progressPct}%`, backgroundColor: c.primary, flex: 1 }} />
          </View>
          {waiting && waiting.length > 0 ? (
            <Text style={{ color: c.muted, marginTop: 6 }}>Waiting on {waiting.slice(0, 3).map(w => w.name || 'Someone').join(', ')}{waiting.length > 3 ? ` +${waiting.length - 3}` : ''}</Text>
          ) : null}
        </View>
      ) : null}

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

      {options.length === 1 && poll?.mode !== 'rating' ? (
        <View style={{ marginTop: 20 }}>
          <Pressable
            onPress={() => router.push(`/events/${options[0].event_id}`)}
            style={{ backgroundColor: c.card, padding: 12, borderRadius: 12 }}
          >
            {options[0].event?.image_url ? (
              <Image source={{ uri: options[0].event.image_url }} style={{ width: '100%', height: 160, borderRadius: 10, marginBottom: 8 }} />
            ) : null}
            <Text style={{ color: c.text, fontWeight: '700' }}>{options[0].event?.title ?? `Event #${options[0].event_id}`}</Text>
            <Text style={{ color: c.muted, marginTop: 4 }}>
              {options[0].event?.date_time ? new Date(options[0].event.date_time).toLocaleString() : ''}{options[0].event?.location ? ` • ${options[0].event.location}` : ''}
            </Text>
            {options[0].match_percent != null ? (
              <Text style={{ color: c.muted, marginTop: 4 }}>{options[0].match_percent}% group match</Text>
            ) : null}
            {options[0].event?.rsvp_url ? (
              <Pressable onPress={() => { if (options[0].event?.rsvp_url) Linking.openURL(options[0].event.rsvp_url); }} style={{ alignSelf: 'flex-start', backgroundColor: c.background, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginTop: 8 }}>
                <Text style={{ color: c.text }}>Open RSVP</Text>
              </Pressable>
            ) : null}
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
                onPress={() => { if (poll?.mode !== 'rating') onVote(item.event_id); }}
                disabled={poll?.mode !== 'rating' ? !poll?.is_active : true}
                style={{ backgroundColor: c.card, borderRadius: 12, padding: 12, marginBottom: 10 }}
              >
                {item.event?.image_url ? (
                  <Image source={{ uri: item.event.image_url }} style={{ width: '100%', height: 140, borderRadius: 10, marginBottom: 8 }} />
                ) : null}
                <Text style={{ color: c.text, fontWeight: '700' }}>{item.event?.title ?? `Event #${item.event_id}`}</Text>
                <Text style={{ color: c.muted, marginTop: 4 }}>
                  {item.event?.date_time ? new Date(item.event.date_time).toLocaleString() : ''}{item.event?.location ? ` • ${item.event.location}` : ''}
                </Text>
                {item.match_percent != null ? (
                  <Text style={{ color: c.muted, marginTop: 4 }}>{item.match_percent}% group match</Text>
                ) : null}
                {poll?.mode === 'rating' ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <Pressable onPress={async () => { try { await castRating(pollId, item.event_id, 1); await load(); } catch(e:any){ Alert.alert('Rate failed', e.message ?? String(e)); } }} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: (myRatings?.[item.event_id] ?? 0) === 1 ? c.primary : c.background }}>
                      <Text style={{ color: c.text }}>Love it ({item.love_it ?? 0})</Text>
                    </Pressable>
                    <Pressable onPress={async () => { try { await castRating(pollId, item.event_id, 0); await load(); } catch(e:any){ Alert.alert('Rate failed', e.message ?? String(e)); } }} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: (myRatings?.[item.event_id] ?? -99) === 0 ? c.primary : c.background }}>
                      <Text style={{ color: c.text }}>It's fine ({item.fine ?? 0})</Text>
                    </Pressable>
                    <Pressable onPress={async () => { try { await castRating(pollId, item.event_id, -1); await load(); } catch(e:any){ Alert.alert('Rate failed', e.message ?? String(e)); } }} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: (myRatings?.[item.event_id] ?? 0) === -1 ? c.primary : c.background }}>
                      <Text style={{ color: c.text }}>Not for me ({item.not_for_me ?? 0})</Text>
                    </Pressable>
                  </View>
                ) : (
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
                )}
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}
                >
                  {poll?.mode === 'rating' ? (
                    <>
                      <Text style={{ color: c.muted }}>Love {item.love_it ?? 0} • Fine {item.fine ?? 0} • Not {item.not_for_me ?? 0}</Text>
                      {item.event?.rsvp_url ? (
                        <Pressable onPress={() => { if (item.event?.rsvp_url) Linking.openURL(item.event.rsvp_url); }} style={{ paddingVertical: 4, paddingHorizontal: 8, backgroundColor: c.background, borderRadius: 8 }}>
                          <Text style={{ color: c.text }}>RSVP</Text>
                        </Pressable>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Text style={{ color: c.muted }}>{count} votes</Text>
                      <Text style={{ color: c.muted }}>{pct}%</Text>
                    </>
                  )}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={{ color: c.muted, marginTop: 20 }}>No options.</Text>}
          ListHeaderComponent={leader ? (
            <View style={{ backgroundColor: c.card, padding: 12, borderRadius: 12, marginBottom: 10 }}>
              <Text style={{ color: c.text, fontWeight: '800' }}>Suggested choice</Text>
              <Text style={{ color: c.muted, marginTop: 4 }}>
                Based on votes and group match, {leader.event?.title ?? `Event #${leader.event_id}`} is leading.
              </Text>
              {poll?.is_active ? (
                <Pressable
                  onPress={onClose}
                  style={{ alignSelf: 'flex-start', marginTop: 8, backgroundColor: c.background, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 }}
                >
                  <Text style={{ color: c.text, fontWeight: '700' }}>Close and commit</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        />
      )}
    </View>
  );
}
