import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import { getMyGroups } from '@/services/groups';

export default function Groups() {
  const c = useThemeColors();
  const [groups, setGroups] = useState<any[]>([]);

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

  return (
    <GradientBackground>
      <AnimatedPage variant="fade-up" style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 16 }}>
          <Pressable
            onPress={onNewGroupDecide}
            style={{
              backgroundColor: c.primary,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '700' }}>New Group Decide</Text>
          </Pressable>

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
        </View>
      </AnimatedPage>
    </GradientBackground>
  );
}
