import {
  View,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Pressable,
  ScrollView,
  Linking,
} from 'react-native';
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
  const { width } = useWindowDimensions();
  // Consider "larger width" as tablet/desktop breakpoints
  const isWide = width >= 768;
  // On web, allow wider container when there is room
  const containerMaxWidth = Platform.OS === 'web' ? (isWide ? 900 : 640) : 900;
  return (
    <GradientBackground variant="dim">
      <AnimatedPage variant="pop" style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
          style={{ flex: 1 }}
        >
          <View style={{ padding: 16 }}>
            <Text style={{ color: c.text, fontSize: 24, fontWeight: '900' }}>Dashboard</Text>
          </View>

          {/* Top Card: Discover Events */}
          <View
            style={[
              styles.cardsContainer,
              { maxWidth: containerMaxWidth, flexDirection: isWide ? 'row' : 'column' },
            ]}
          >
            <View style={isWide ? { flex: 1 } : undefined}>
              <MediaCard
                image={require('../../assets/DiscoverEvents.png')}
                onPress={() => router.push('/events')}
                accessibilityLabel="Discover events"
              />
            </View>

            {/* Second Card: Group Decide */}
            <View style={isWide ? { flex: 1 } : undefined}>
              <MediaCard
                image={require('../../assets/GroupDecide.png')}
                onPress={() => router.push('/(tabs)/group-decide')}
                accessibilityLabel="Start a new decision"
              />
            </View>
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
              title="Welcome to Picky!"
              footerTag="Food 😋, Activities 🏈 & more soon!!"
              illustration={require('../../assets/PickyMascot.png')}
            >
              <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>
                Explore everything happening around campus with a personalized feed!
              </Text>
              <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>
                Make decisions with friends in seconds not hours.
              </Text>
              <Pressable
                onPress={() => router.push('/onboarding/welcome?mode=signIn')}
                accessibilityRole="button"
                accessibilityLabel="Log in to Picky"
                style={{
                  borderWidth: 2,
                  borderColor: '#40ade8ff',
                  paddingVertical: 6,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  alignSelf: 'flex-start',
                  marginTop: 8,
                }}
              >
                <Text style={{ color: '#40ade8ff', fontWeight: '700' }}>Create Account</Text>
              </Pressable>
            </BlurbBubble>
          </View>
          {/* Additional padding */}
          <View style={{ padding: 21 }} />
          {/* Feedback link */}
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <Text style={{ color: c.muted, fontSize: 12 }}>Have suggestions? found bugs?</Text>
            <Pressable
              onPress={() => Linking.openURL('https://forms.gle/sQDyLdm5yP4rQG3d8')}
              accessibilityRole="link"
              accessibilityLabel="Open feedback form"
              style={{ marginTop: 4 }}
            >
              <Text style={{ color: c.primary, textDecorationLine: 'underline' }}>Click me!</Text>
            </Pressable>
          </View>

          {/* Bottom spacer so content isn't cut off by tab bar */}
          <View style={{ height: 12 }} />
        </ScrollView>
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
