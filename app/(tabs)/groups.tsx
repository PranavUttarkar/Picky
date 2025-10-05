import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  TextInput,
  Modal,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { GroupsBenefitsEmptyState } from '@/components/GroupsBenefitsEmptyState';
import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import { getMyGroups, createGroup, joinGroupByCode } from '@/services/groups';
import { useGroupDecisionNotification } from '@/utils/GroupDecisionNotificationContext';

export default function Groups() {
  const c = useThemeColors();
  const { hasNewGroupDecisions } = useGroupDecisionNotification();
  const [groups, setGroups] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const createAnim = useRef(new Animated.Value(0)).current;
  const joinAnim = useRef(new Animated.Value(0)).current;

  const loadGroups = useCallback(async () => {
    const data = await getMyGroups();
    setGroups(data);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        router.replace('/onboarding/welcome');
        return;
      }
      const data = await getMyGroups();
      if (mounted) setGroups(data);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onNewGroupDecide = () => {
    if (groups.length === 0) {
      Alert.alert('No Groups', 'You need to create or join a group first.');
      return;
    }
    router.push('/(tabs)/group-decide');
  };

  const onCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Group name required', 'Please enter a name for your group.');
      return;
    }
    try {
      setCreating(true);
      const { group_id, invite_code } = await createGroup(groupName.trim());
      setGroupName('');
      setShowCreate(false);
      await loadGroups();
      Alert.alert('Group created', invite_code ? `Invite code: ${invite_code}` : '');
      router.push(`/(tabs)/groups/${group_id}`);
    } catch (e: any) {
      Alert.alert('Create failed', e.message ?? String(e));
    } finally {
      setCreating(false);
    }
  };

  const onJoinGroup = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Invite code required', 'Please enter an invite code.');
      return;
    }
    try {
      setJoining(true);
      const groupId = await joinGroupByCode(inviteCode.trim());
      setInviteCode('');
      setShowJoin(false);
      await loadGroups();
      router.push(`/(tabs)/groups/${groupId}`);
    } catch (e: any) {
      Alert.alert('Join failed', e.message ?? String(e));
    } finally {
      setJoining(false);
    }
  };

  // Animate modals on open
  useEffect(() => {
    if (showCreate) {
      createAnim.setValue(0);
      Animated.timing(createAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [showCreate, createAnim]);

  useEffect(() => {
    if (showJoin) {
      joinAnim.setValue(0);
      Animated.timing(joinAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [showJoin, joinAnim]);

  return (
    <GradientBackground>
      <AnimatedPage variant="fade-up" style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 16 }}>
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            <Pressable
              onPress={() => {
                setShowCreate((s) => !s);
                setShowJoin(false);
              }}
              style={{
                backgroundColor: c.card,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: c.text, fontWeight: '700' }}>Create Group</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setShowJoin((s) => !s);
                setShowCreate(false);
              }}
              style={{
                backgroundColor: c.card,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: c.text, fontWeight: '700' }}>Join Group</Text>
            </Pressable>
            <Pressable
              onPress={onNewGroupDecide}
              style={{
                backgroundColor: c.primary,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: c.text, fontWeight: '700' }}>New Group Decide</Text>
            </Pressable>
          </View>

          {/* Inline forms removed in favor of animated modals below */}

          <FlatList
            data={groups}
            keyExtractor={(g) => String(g.id)}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/(tabs)/groups/${item.id}`)}
                style={{
                  backgroundColor: c.card,
                  padding: 12,
                  borderRadius: 12,
                  marginBottom: 8,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: c.text, fontWeight: '800', flex: 1 }}>{item.name}</Text>
                  {hasNewGroupDecisions && (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#ef4444',
                        marginLeft: 8,
                      }}
                    />
                  )}
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              // Show the benefits empty state component when the user has no groups
              <View style={{ paddingTop: 12 }}>
                <GroupsBenefitsEmptyState />
              </View>
            }
          />
        </View>
      </AnimatedPage>

      {/* Create Group Modal */}
      <Modal
        visible={showCreate}
        transparent
        animationType="fade"
        onRequestClose={() => !creating && setShowCreate(false)}
      >
        <Pressable
          onPress={() => !creating && setShowCreate(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%' }}
          >
            <Animated.View
              onStartShouldSetResponder={() => true}
              style={{
                backgroundColor: c.card,
                borderRadius: 16,
                padding: 16,
                width: '100%',
                maxWidth: 420,
                borderWidth: 1,
                borderColor: '#00000020',
                opacity: createAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                transform: [
                  {
                    scale: createAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }),
                  },
                  {
                    translateY: createAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              }}
            >
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>
                Create a new group
              </Text>
              <TextInput
                placeholder="Group name"
                placeholderTextColor={c.muted}
                value={groupName}
                onChangeText={setGroupName}
                style={{
                  backgroundColor: c.background,
                  color: c.text,
                  paddingHorizontal: 10,
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#00000030',
                  marginTop: 12,
                }}
              />
              <View
                style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}
              >
                <Pressable
                  disabled={creating}
                  onPress={() => !creating && setShowCreate(false)}
                  style={{
                    backgroundColor: '#00000020',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  disabled={creating}
                  onPress={onCreateGroup}
                  style={{
                    backgroundColor: c.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 10,
                    opacity: creating ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: '#000', fontWeight: '800' }}>
                    {creating ? 'Creating…' : 'Create'}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Join Group Modal */}
      <Modal
        visible={showJoin}
        transparent
        animationType="fade"
        onRequestClose={() => !joining && setShowJoin(false)}
      >
        <Pressable
          onPress={() => !joining && setShowJoin(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%' }}
          >
            <Animated.View
              onStartShouldSetResponder={() => true}
              style={{
                backgroundColor: c.card,
                borderRadius: 16,
                padding: 16,
                width: '100%',
                maxWidth: 420,
                borderWidth: 1,
                borderColor: '#00000020',
                opacity: joinAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                transform: [
                  {
                    scale: joinAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }),
                  },
                  {
                    translateY: joinAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
                  },
                ],
              }}
            >
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Join a group</Text>
              <Text style={{ color: c.muted, marginTop: 6 }}>Enter the invite code</Text>
              <TextInput
                placeholder="Invite code"
                placeholderTextColor={c.muted}
                autoCapitalize="none"
                autoCorrect={false}
                value={inviteCode}
                onChangeText={setInviteCode}
                style={{
                  backgroundColor: c.background,
                  color: c.text,
                  paddingHorizontal: 10,
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#00000030',
                  marginTop: 12,
                  letterSpacing: 1,
                }}
              />
              <View
                style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}
              >
                <Pressable
                  disabled={joining}
                  onPress={() => !joining && setShowJoin(false)}
                  style={{
                    backgroundColor: '#00000020',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  disabled={joining}
                  onPress={onJoinGroup}
                  style={{
                    backgroundColor: c.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 10,
                    opacity: joining ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: '#000', fontWeight: '800' }}>
                    {joining ? 'Joining…' : 'Join'}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </GradientBackground>
  );
}
