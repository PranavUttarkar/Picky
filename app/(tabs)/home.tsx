import { View, Text, StyleSheet, Platform } from 'react-native';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { useThemeColors } from '@/theme/ThemeProvider';
import { router } from 'expo-router';
import MediaCard from '@/components/MediaCard';
import BlurbBubble from '@/components/BlurbBubble';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeTab() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const containerMaxWidth = Platform.OS === 'web' ? 640 : 900;
  return (
    <GradientBackground variant="dim">
      <AnimatedPage variant="pop" style={{ flex: 1 }}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: c.text, fontSize: 24, fontWeight: '900' }}>Dashboard</Text>
        </View>

        {/* Top Card: Discover Events */}
        <View style={[styles.cardsContainer, { maxWidth: containerMaxWidth }]}>
          <MediaCard
            image={require('../../assets/DiscoverEvents.png')}
            onPress={() => router.push('/events')}
            accessibilityLabel="Discover events"
          />

          {/* Second Card: Group Decide */}
          <MediaCard
            image={require('../../assets/GroupDecide.png')}
            onPress={() => router.push('/(tabs)/group-decide')}
            accessibilityLabel="Start a new decision"
          />
        </View>

        {/* Cartoon-style persuasive blurb */}
        <View
          style={{
            paddingHorizontal: 16,
            marginTop: 16,
            alignSelf: 'center',
            width: '100%',
            maxWidth: containerMaxWidth,
          }}
        >
          <BlurbBubble
            title="What's Picky?"
            footerTag="Coming soon: Food 😋, Activities 🏈  mooore!!"
            illustration={require('../../assets/PickyMascot.png')}
          >
            <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>
              Explore everything happening around campus with a personalized feed.
            </Text>
            <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>
              Make decisions with friends in seconds not hours. Picky blends everyone’s interests to
              find the best options!
            </Text>
          </BlurbBubble>
        </View>

        {/* Bottom spacer so content isn't cut off by tab bar */}
        <View style={{ flex: 1 }} />
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
