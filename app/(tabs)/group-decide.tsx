import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, Alert, ActivityIndicator } from 'react-native';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { useThemeColors } from '@/theme/ThemeProvider';
import { router, useRootNavigationState } from 'expo-router';
import { supabase } from '@/services/supabase';
import { getMyGroups } from '@/services/groups';
import { getTopGroupMatches } from '@/services/events';
import { createPollWithOptions } from '@/services/polls';
import MediaCard from '@/components/MediaCard';

export default function GroupDecideStart() {
  const c = useThemeColors();
  const mountedRef = useRef(true);
  const rootState = useRootNavigationState();
  const navReady = !!rootState?.key;
  const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<number | null>(null);
  const [step, setStep] = useState<0 | 1>(0);
  const [decisionType, setDecisionType] = useState<'events' | 'food' | 'activities'>('events');

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        if (mountedRef.current && navReady) {
          router.replace('/onboarding/welcome');
        }
        return;
      }
      try {
        const gs = await getMyGroups();
        if (!mountedRef.current) return;
        setGroups(gs as any);
      } catch (e: any) {
        Alert.alert('Error', e.message ?? String(e));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [navReady]);

  const onPickGroup = async (groupId: number) => {
    if (creating != null) return;
    try {
      setCreating(groupId);
      // Fetch top 7 recommendations for the group
      const recs = await getTopGroupMatches(groupId, 7);
      const eventIds = recs.map((e) => e.id);
      if (eventIds.length < 1) {
        Alert.alert(
          'No suggestions',
          'We could not find recommended events for this group yet. Try browsing and saving some events first.',
        );
        setCreating(null);
        return;
      }
      // Create a new poll in rating mode (swipe UX uses ratings under the hood)
      const pollId = await createPollWithOptions(groupId, eventIds, {
        title: 'Group Decide',
        deadlineAt: null,
        mode: 'rating',
      });
      if (mountedRef.current && navReady) {
        router.replace(`/polls/${pollId}`);
      }
    } catch (e: any) {
      Alert.alert('Failed to start', e.message ?? String(e));
      setCreating(null);
    }
  };

  return (
    <GradientBackground variant="dim">
      <AnimatedPage variant="pop" style={{ flex: 1 }}>
        {step === 0 ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: c.text, fontSize: 24, fontWeight: '900' }}>
              What are you deciding on?
            </Text>
            <View style={{ gap: 12, marginTop: 12 }}>
              {[
                {
                  key: 'events' as const,
                  label: 'Events',
                  image: require('../../assets/DecideEvents.png'),
                  disabled: false,
                  caption: undefined as string | undefined,
                },
                {
                  key: 'food' as const,
                  label: 'Food',
                  image: require('../../assets/DecideFood.png'),
                  disabled: true,
                  caption: 'Coming Soon',
                },
                {
                  key: 'activities' as const,
                  label: 'Activities',
                  image: require('../../assets/DecideActivities.png'),
                  disabled: true,
                  caption: 'Coming Soon',
                },
              ].map((opt) => (
                <View key={opt.key}>
                  <MediaCard
                    image={opt.image}
                    label={opt.disabled ? opt.caption : undefined}
                    selected={decisionType === (opt.key as any)}
                    onPress={opt.disabled ? undefined : () => {
                      setDecisionType(opt.key as any);
                      setStep(1);
                    }}
                    style={opt.disabled ? { opacity: 0.6 } : undefined}
                    accessibilityLabel={
                      opt.disabled ? `${opt.label} (Coming Soon)` : `Choose ${opt.label}`
                    }
                  />
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {step === 1 ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: c.text, fontSize: 24, fontWeight: '900' }}>Choose a group</Text>
            <Text style={{ color: c.muted, marginTop: 6 }}>
              We’ll spin up a quick swipe vote with your top recommendations.
            </Text>
          </View>
        ) : null}
        {step === 1 && (loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={c.text} />
          </View>
        ) : groups.length === 0 ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: c.muted }}>
              You’re not in any groups yet. Create or join one from the Groups tab.
            </Text>
            <Pressable
              onPress={() => router.replace('/(tabs)/groups')}
              style={{
                alignSelf: 'flex-start',
                backgroundColor: c.primary,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 10,
                marginTop: 12,
              }}
            >
              <Text style={{ color: '#000', fontWeight: '800' }}>Go to Groups</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={{ padding: 16, gap: 10 }}
            data={groups}
            keyExtractor={(g) => String(g.id)}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPickGroup(item.id)}
                disabled={creating != null}
                style={{
                  backgroundColor: c.card,
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: creating === item.id ? c.primary : '#00000030',
                  opacity: creating && creating !== item.id ? 0.6 : 1,
                }}
              >
                <Text style={{ color: c.text, fontWeight: '800' }}>{item.name}</Text>
                <Text style={{ color: c.muted, marginTop: 4 }}>
                  {creating === item.id ? 'Creating swipe vote…' : 'Tap to start Group Decide'}
                </Text>
              </Pressable>
            )}
          />
        ))}
      </AnimatedPage>
    </GradientBackground>
  );
}
