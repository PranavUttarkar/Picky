import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView, Platform } from 'react-native';
import MediaCard from '@/components/MediaCard';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { useThemeColors } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import { getMyGroups, createGroup, regenerateInviteCode } from '@/services/groups';
import PollDeadlinePicker from '@/components/PollDeadlinePicker';
import { createPollWithOptions } from '@/services/polls';

export default function NewDecision() {
  const c = useThemeColors();
  const [step, setStep] = useState(0); // 0 type, 1 topic, 2 participants, 3 deadline
  const [decisionType, setDecisionType] = useState<
    'events' | 'food' | 'activities' | 'combo' | null
  >(null);
  const [topic, setTopic] = useState('');
  const [groups, setGroups] = useState<any[]>([]);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        router.replace('/onboarding/welcome');
        return;
      }
      const gs = await getMyGroups();
      setGroups(gs);
      if (gs.length) setGroupId(gs[0].id);
    })();
  }, []);

  const canNext = useMemo(() => {
    if (step === 0) return !!decisionType;
    if (step === 1) return topic.trim().length > 0;
    if (step === 2) return !!groupId || !!inviteCode;
    return true;
  }, [step, decisionType, topic, groupId, inviteCode]);

  const onCreateGroup = async () => {
    try {
      setCreatingGroup(true);
      const name = topic.trim() || 'Decision Group';
      const { group_id, invite_code } = await createGroup(name);
      setGroupId(group_id);
      setInviteCode(invite_code);
      Alert.alert('Invite ready', 'Share the code with friends to join this decision');
    } catch (e: any) {
      Alert.alert('Create group failed', e.message ?? String(e));
    } finally {
      setCreatingGroup(false);
    }
  };

  const onRegenerate = async () => {
    if (!groupId) return;
    try {
      const code = await regenerateInviteCode(groupId);
      setInviteCode(code);
      Alert.alert('New code', 'Invite code updated');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? String(e));
    }
  };

  const onFinish = async () => {
    try {
      if (!groupId) {
        Alert.alert('Select group', 'Please select or create a group to continue.');
        return;
      }
      let pollId: number | null = null;
      try {
        // Attempt via RPC (may reject empty options)
        pollId = await createPollWithOptions(groupId, [], {
          title: topic.trim() || 'New Decision',
          deadlineAt,
          mode: 'rating',
        });
      } catch (e) {
        // Fallback: direct insert to polls
        const { data, error } = await supabase
          .from('polls')
          .insert({
            group_id: groupId,
            title: topic.trim() || 'New Decision',
            deadline_at: deadlineAt,
            mode: 'rating',
            is_active: true,
          })
          .select('id')
          .single();
        if (error) throw error;
        pollId = (data as any)?.id ?? null;
      }
      if (!pollId) throw new Error('Could not create decision room');
      // Navigate to decision room for preference collection (under tabs)
      router.replace(`/(tabs)/decisions/${pollId}`);
    } catch (e: any) {
      Alert.alert('Could not create decision', e.message ?? String(e));
    }
  };

  return (
    <GradientBackground variant="dim">
      <AnimatedPage variant="slide-right" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {/* progress dots */}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i <= step ? c.primary : c.card,
                }}
              />
            ))}
          </View>

          {step === 0 ? (
            <View style={{ backgroundColor: c.card, padding: 16, borderRadius: 14, marginTop: 16 }}>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>
                What are you deciding on?
              </Text>
              <View style={{ gap: 12, marginTop: 12 }}>
                {[
                  {
                    key: 'events',
                    label: 'Events',
                    image: require('../../../assets/DiscoverEvents.png'),
                  },
                  { key: 'food', label: 'Food', image: require('../../../assets/GroupDecide.png') },
                  {
                    key: 'activities',
                    label: 'Activities',
                    image: require('../../../assets/GroupDecide.png'),
                  },
                  {
                    key: 'combo',
                    label: 'Combination',
                    image: require('../../../assets/GroupDecide.png'),
                  },
                ].map((opt) => (
                  <MediaCard
                    key={opt.key}
                    image={opt.image}
                    selected={decisionType === (opt.key as any)}
                    onPress={() => setDecisionType(opt.key as any)}
                    accessibilityLabel={`Choose ${opt.label}`}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                <Pressable
                  onPress={() => setStep(1)}
                  disabled={!decisionType}
                  style={{
                    backgroundColor: decisionType ? c.primary : c.background,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '800' }}>Next</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {step === 1 ? (
            <View style={{ backgroundColor: c.card, padding: 16, borderRadius: 14, marginTop: 16 }}>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>
                {decisionType === 'food'
                  ? 'What food are you deciding on?'
                  : decisionType === 'activities'
                  ? 'What activities are you deciding on?'
                  : decisionType === 'combo'
                  ? 'What mix are you deciding on?'
                  : 'What do you want to decide?'}
              </Text>
              <TextInput
                placeholder={
                  decisionType === 'food'
                    ? 'e.g., Sushi vs. Pizza night'
                    : decisionType === 'activities'
                    ? 'e.g., Hike or movie?'
                    : decisionType === 'combo'
                    ? 'e.g., Dinner + concert plan'
                    : 'e.g., Saturday night plans'
                }
                placeholderTextColor={c.muted}
                value={topic}
                onChangeText={setTopic}
                style={{
                  marginTop: 12,
                  backgroundColor: '#00000020',
                  color: c.text,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: Platform.OS === 'web' ? 10 : 8,
                }}
              />
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}
              >
                <Pressable
                  onPress={() => setStep(0)}
                  style={{
                    backgroundColor: c.background,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '700' }}>Back</Text>
                </Pressable>
                <Pressable
                  onPress={() => setStep(2)}
                  disabled={topic.trim().length === 0}
                  style={{
                    backgroundColor: topic.trim().length > 0 ? c.primary : c.background,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '800' }}>Next</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={{ backgroundColor: c.card, padding: 16, borderRadius: 14, marginTop: 16 }}>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>
                Who’s involved?
              </Text>
              {/* Quick group selection */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {groups.map((g) => (
                  <Pressable
                    key={g.id}
                    onPress={() => setGroupId(g.id)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      backgroundColor: groupId === g.id ? c.primary : c.background,
                    }}
                  >
                    <Text style={{ color: c.text }}>{g.name}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Pressable
                  onPress={onCreateGroup}
                  disabled={creatingGroup}
                  style={{
                    backgroundColor: c.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '800' }}>
                    {creatingGroup ? 'Creating…' : 'Create new group'}
                  </Text>
                </Pressable>
                {groupId ? (
                  <Pressable
                    onPress={onRegenerate}
                    style={{
                      backgroundColor: c.background,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: c.text, fontWeight: '700' }}>New invite code</Text>
                  </Pressable>
                ) : null}
              </View>
              {inviteCode ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ color: c.muted }}>Invite code: {inviteCode}</Text>
                  <Text style={{ color: c.muted, marginTop: 4 }}>
                    Share a link or this code to invite friends. They’ll join this decision room.
                  </Text>
                </View>
              ) : null}
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}
              >
                <Pressable
                  onPress={() => setStep(1)}
                  style={{
                    backgroundColor: c.background,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '700' }}>Back</Text>
                </Pressable>
                <Pressable
                  onPress={() => setStep(3)}
                  disabled={!groupId && !inviteCode}
                  style={{
                    backgroundColor: groupId || inviteCode ? c.primary : c.background,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '800' }}>Next</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {step === 3 ? (
            <View style={{ backgroundColor: c.card, padding: 16, borderRadius: 14, marginTop: 16 }}>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>
                Deadline to decide?
              </Text>
              <View style={{ marginTop: 10 }}>
                <PollDeadlinePicker value={deadlineAt} onChange={setDeadlineAt} colorPalette={c} />
              </View>
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}
              >
                <Pressable
                  onPress={() => setStep(2)}
                  style={{
                    backgroundColor: c.background,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '700' }}>Back</Text>
                </Pressable>
                <Pressable
                  onPress={onFinish}
                  style={{
                    backgroundColor: c.primary,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: '#000', fontWeight: '900' }}>Create Decision</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </AnimatedPage>
    </GradientBackground>
  );
}
