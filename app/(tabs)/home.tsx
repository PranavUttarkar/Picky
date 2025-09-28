import { View, Text, StyleSheet } from 'react-native';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { useThemeColors } from '@/theme/ThemeProvider';
import { router } from 'expo-router';
import MediaCard from '@/components/MediaCard';

export default function HomeTab() {
  const c = useThemeColors();
  return (
    <GradientBackground variant="dim">
      <AnimatedPage variant="pop" style={{ flex: 1 }}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: c.text, fontSize: 24, fontWeight: '900' }}>Dashboard</Text>
        </View>

        {/* Top Card: Group Decide (replaces + flow) */}
        <View style={styles.cardsContainer}>
          <MediaCard
            image={require('../../assets/GroupDecide.png')}
            onPress={() => router.push('/decisions/new')}
            accessibilityLabel="Start a new decision"
          />

          {/* Bottom Card: Discover Events */}
          <MediaCard
            image={require('../../assets/DiscoverEvents.png')}
            onPress={() => router.push('/events')}
            accessibilityLabel="Discover events"
          />
        </View>
      </AnimatedPage>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  cardsContainer: {
    paddingHorizontal: 16,
    gap: 12,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },
  // Card visuals moved to MediaCard component
});
