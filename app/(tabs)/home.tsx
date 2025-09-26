import { View, Text, Pressable, StyleSheet } from 'react-native';
import GradientBackground from '@/components/GradientBackground';
import { useThemeColors } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function HomeTab() {
  const c = useThemeColors();
  return (
    <GradientBackground variant="dim">
      <View style={{ flex: 1 }}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: c.text, fontSize: 24, fontWeight: '900' }}>Dashboard</Text>
          <Text style={{ color: c.muted, marginTop: 6 }}>
            Kick off a decision and invite your crew.
          </Text>
        </View>

        {/* Floating Action Button */}
        <Pressable
          onPress={() => router.push('/decisions/new')}
          style={[styles.fab, { backgroundColor: c.primary, shadowColor: c.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Create a new decision"
        >
          <Ionicons name="add" size={28} color="#000" />
        </Pressable>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
