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
import { Ionicons } from '@expo/vector-icons';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { useThemeColors } from '@/theme/ThemeProvider';
import { router } from 'expo-router';
import MediaCard from '@/components/MediaCard';
import BlurbBubble from '@/components/BlurbBubble';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';

export default function HomeTab() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const [signedIn, setSignedIn] = useState(false);
  const { width } = useWindowDimensions();
  // Consider "larger width" as tablet/desktop breakpoints
  const isWide = width >= 768;
  // Grid sizing for top cards: keep fixed column width so last single card doesn't scale
  const GAP = 12;
  const COL_WIDTH = 420;
  const MAX_GRID_WIDTH = isWide ? COL_WIDTH * 2 + GAP : undefined;

  useEffect(() => {
    let mounted = true;
    // Check current user
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setSignedIn(Boolean(data.user));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSignedIn(Boolean(session));
    });

    return () => {
      mounted = false;
      try {
        sub.subscription.unsubscribe();
      } catch {}
    };
  }, []);
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
          </View>

          {/* Top Cards: Discover Events + Discover Food (side-by-side on wide, stacked on small) */}
          <View
            style={[
              styles.cardsContainer,
              {
                maxWidth: MAX_GRID_WIDTH ?? containerMaxWidth,
                flexDirection: isWide ? 'row' : 'column',
                alignSelf: 'center',
              },
            ]}
          >
            <View style={isWide ? { width: COL_WIDTH } : undefined}>
              <MediaCard
                image={require('../../assets/DiscoverEvents.png')}
                onPress={() => router.push('/events')}
                accessibilityLabel="Discover events"
              />
            </View>
            <View style={[isWide ? { width: COL_WIDTH } : undefined]}>
              <MediaCard
                image={require('../../assets/DiscoverFood.png')}
                onPress={() => router.push('/food')}
                accessibilityLabel="Discover food"
              />
            </View>
          </View>

          {/* Second Row: Group Decide + Add Friends */}
          <View
            style={[
              styles.cardsContainer,
              {
                maxWidth: MAX_GRID_WIDTH ?? containerMaxWidth,
                flexDirection: isWide ? 'row' : 'column',
                alignSelf: 'center',
                // Extra vertical spacing between rows; larger on small screens for smoother look
                marginTop: isWide ? 10 : 14,
                marginLeft: isWide ? 26 : 0,
                justifyContent: isWide ? 'center' : undefined,
              },
            ]}
          >
            <View style={isWide ? { width: COL_WIDTH } : undefined}>
              <MediaCard
                image={require('../../assets/GroupDecide.png')}
                onPress={() => router.push('/(tabs)/group-decide')}
                accessibilityLabel="Start a new decision"
              />
            </View>
            {signedIn && (
              <View style={isWide ? { width: COL_WIDTH } : undefined}>
                <Pressable
                  onPress={() => router.push('/search-users')}
                  style={{
                    backgroundColor: c.primary,
                    marginHorizontal: 16,
                    marginVertical: isWide ? 0 : 12,
                    padding: 20,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 120,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <View style={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    borderRadius: 50,
                    padding: 16,
                    marginBottom: 12,
                  }}>
                    <Text style={{ fontSize: 32 }}>👥</Text>
                  </View>
                  <Text style={{
                    color: 'white',
                    fontSize: 18,
                    fontWeight: '700',
                    textAlign: 'center',
                  }}>
                    Add Friends
                  </Text>
                  <Text style={{
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: 14,
                    textAlign: 'center',
                    marginTop: 4,
                  }}>
                    See what your friends are up to
                  </Text>
                </Pressable>
              </View>
            )}
            {/* Spacer to preserve 2-col grid on wide when not signed in */}
            {isWide && !signedIn ? <View style={{ width: COL_WIDTH }} /> : null}
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
              title="Find it All, Decide Quick!"
              footerTag="Food 😋, Activities 🏈 & more soon!!"
              illustration={require('../../assets/PickyMascot.png')}
            >
              <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>
                Welcome to Picky! Explore everything happening around campus with a personalized
                feed!
              </Text>
              <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>
                Make decisions with friends in seconds not hours with Group Decide.
              </Text>
              {!signedIn && (
                <Pressable
                  onPress={() => router.push('/onboarding/welcome?mode=signUp')}
                  accessibilityRole="button"
                  accessibilityLabel="Create an account"
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
              )}
            </BlurbBubble>

            {/* Additional padding */}
            <View style={{ padding: 21 }} />

            {/* Feedback link */}
            <View style={{ marginTop: 12 }}>
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
