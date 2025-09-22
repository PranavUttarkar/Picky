import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/services/supabase';
import { router } from 'expo-router';

export default function Groups() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const [groups, setGroups] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        router.replace('/onboarding/welcome');
        return;
      }
      const { data } = await supabase
        .from('group_members')
        .select('group:groups(id,name)')
        .eq('user_id', user.id);
      setGroups((data ?? []).map((r: any) => r.group));
    })();
  }, []);
  const Container: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    scheme === 'light' ? (
      <LinearGradient
        colors={['#e9fdf5', '#f9fafb']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, padding: 16 }}>{children}</View>
      </LinearGradient>
    ) : (
      <View style={{ flex: 1, backgroundColor: c.background, padding: 16 }}>{children}</View>
    );

  return (
    <Container>
      <FlatList
        data={groups}
        keyExtractor={(g) => String(g.id)}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/groups/${item.id}`)}
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
    </Container>
  );
}
