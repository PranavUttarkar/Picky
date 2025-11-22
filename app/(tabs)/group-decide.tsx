import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { useThemeColors } from '@/theme/ThemeProvider';
import { router, useRootNavigationState } from 'expo-router';
import { supabase } from '@/services/supabase';
import { getMyGroups } from '@/services/groups';
import { getTopGroupMatches } from '@/services/events';
import { getTopGroupRestaurantMatches } from '@/services/food';
import { createPollWithOptions, createTextPoll } from '@/services/polls';
import MediaCard from '@/components/MediaCard';

export default function GroupDecideStart() {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const isWide = width >= 668;
  const containerMaxWidth = isWide ? 900 : 640;
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
    if (!navReady) {
      Alert.alert('Not ready', 'Navigation is initializing. Please try again in a moment.');
      return;
    }
    try {
      setCreating(groupId);
      let pollId: number | null = null;
      if (decisionType === 'events') {
        // Fetch top 7 event recommendations and create rating poll
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
        pollId = await createPollWithOptions(groupId, eventIds, {
          title: 'Decide: Events',
          deadlineAt: null,
          mode: 'rating',
        });
      } else if (decisionType === 'food') {
        // Fetch top 7 restaurant recommendations and create a text poll.
        // Encode place_id in the text so the poll details screen can render rich restaurant cards and enable swipe.
        const recs = await getTopGroupRestaurantMatches(groupId, 7);
        const texts = recs.map((r) => `FOOD|${r.id}`);
        if (texts.length < 1) {
          Alert.alert(
            'No suggestions',
            'We could not find recommended restaurants for this group yet. Try browsing and saving some places first.',
          );
          setCreating(null);
          return;
        }
        pollId = await createTextPoll(groupId, texts, {
          title: 'Decide: Food',
          deadlineAt: null,
        });
      } else {
        Alert.alert('Coming soon', 'Activities group decide is not available yet.');
        setCreating(null);
        return;
      }
      
      if (mountedRef.current) {
        if (navReady) {
          router.replace(`/polls/${pollId}`);
          // Reset creating state after a short delay to ensure UI doesn't flash before nav
          // But if nav happens, component unmounts anyway.
          // If we are still here after a timeout, something went wrong with nav.
          setTimeout(() => {
            if (mountedRef.current) setCreating(null);
          }, 2000);
        } else {
          setCreating(null);
          Alert.alert('Error', 'Navigation lost. Please try again.');
        }
      }
    } catch (e: any) {
      Alert.alert('Failed to start', e.message ?? String(e));
      if (mountedRef.current) setCreating(null);
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
            <View
              style={{
                gap: 12,
                marginTop: 12,
                maxWidth: containerMaxWidth,
                alignSelf: 'center',
                width: width <= 680 || width > 1100 ? '90%' : '50%',
                flexDirection: width >= 1100 ? 'row' : 'column',
              }}
            >
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
                  disabled: false,
                  caption: undefined as string | undefined,
                },
                {
                  key: 'activities' as const,
                  label: 'Activities',
                  image: require('../../assets/DecideActivities.png'),
                  disabled: true,
                  caption: 'Coming Soon',
                },
              ].map((opt) => (
                <View key={opt.key} style={isWide ? { flex: 1 } : undefined}>
                  <MediaCard
                    image={opt.image}
                    label={opt.disabled ? opt.caption : undefined}
                    selected={decisionType === (opt.key as any)}
                    onPress={
                      opt.disabled
                        ? undefined
                        : () => {
                            setDecisionType(opt.key as any);
                            setStep(1);
                          }
                    }
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

        {step === 1 &&
          (loading ? (
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
              contentContainerStyle={{
                padding: 16,
                gap: 10,
                maxWidth: containerMaxWidth,
                alignSelf: 'center',
              }}
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
