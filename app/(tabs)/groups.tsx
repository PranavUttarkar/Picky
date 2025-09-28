import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, Modal, Alert } from 'react-native';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import { createGroup, joinGroupByCode, getMyGroups } from '@/services/groups';

export default function Groups() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const [groups, setGroups] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

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

  const refresh = async () => {
    const data = await getMyGroups();
    setGroups(data);
  };

  const onCreate = async () => {
    try {
      if (!name.trim()) return;
      const result = await createGroup(name.trim());
      setShowCreate(false);
      setName('');
      await refresh();
      router.push(`/(tabs)/groups/${result.group_id}`);
    } catch (e: any) {
      Alert.alert('Create group failed', e.message ?? String(e));
    }
  };

  const onJoin = async () => {
    try {
      if (!code.trim()) return;
      const gid = await joinGroupByCode(code.trim());
      setShowJoin(false);
      setCode('');
      await refresh();
      Alert.alert('Joined', 'You successfully joined the group.');
      router.push(`/(tabs)/groups/${gid}`);
    } catch (e: any) {
      Alert.alert('Join group failed', e.message ?? String(e));
    }
  };

  return (
    <GradientBackground>
      <AnimatedPage variant="fade-up" style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <Pressable
              onPress={() => setShowCreate(true)}
              style={{
                backgroundColor: c.primary,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: c.text, fontWeight: '700' }}>Create Group</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowJoin(true)}
              style={{
                backgroundColor: c.card,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: c.text, fontWeight: '700' }}>Join Group</Text>
            </Pressable>
          </View>

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
                <Text style={{ color: c.text, fontWeight: '800' }}>{item.name}</Text>
              </Pressable>
            )}
          />

          <Modal
            visible={showCreate}
            transparent
            animationType="slide"
            onRequestClose={() => setShowCreate(false)}
          >
            <View
              style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 20 }}
            >
              <View style={{ backgroundColor: c.card, borderRadius: 12, padding: 16 }}>
                <Text style={{ color: c.text, marginBottom: 8, fontWeight: '700' }}>
                  Create a group
                </Text>
                <TextInput
                  placeholder="Group name"
                  placeholderTextColor={c.muted}
                  value={name}
                  onChangeText={setName}
                  style={{
                    color: c.text,
                    backgroundColor: c.background,
                    padding: 10,
                    borderRadius: 8,
                    marginBottom: 12,
                  }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                  <Pressable onPress={() => setShowCreate(false)}>
                    <Text style={{ color: c.muted }}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={onCreate}>
                    <Text style={{ color: c.text, fontWeight: '700' }}>Create</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          <Modal
            visible={showJoin}
            transparent
            animationType="slide"
            onRequestClose={() => setShowJoin(false)}
          >
            <View
              style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 20 }}
            >
              <View style={{ backgroundColor: c.card, borderRadius: 12, padding: 16 }}>
                <Text style={{ color: c.text, marginBottom: 8, fontWeight: '700' }}>
                  Join a group
                </Text>
                <TextInput
                  placeholder="Invite code"
                  placeholderTextColor={c.muted}
                  autoCapitalize="characters"
                  value={code}
                  onChangeText={setCode}
                  style={{
                    color: c.text,
                    backgroundColor: c.background,
                    padding: 10,
                    borderRadius: 8,
                    marginBottom: 12,
                    letterSpacing: 2,
                  }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                  <Pressable onPress={() => setShowJoin(false)}>
                    <Text style={{ color: c.muted }}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={onJoin}>
                    <Text style={{ color: c.primary, fontWeight: '700' }}>Join</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </AnimatedPage>
    </GradientBackground>
  );
}
