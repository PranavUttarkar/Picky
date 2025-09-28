import { View, Text, Pressable, StyleSheet, Image, Platform } from 'react-native';
import GradientBackground from '@/components/GradientBackground';
import { useThemeColors } from '@/theme/ThemeProvider';
import { router } from 'expo-router';

export default function HomeTab() {
  const c = useThemeColors();
  return (
    <GradientBackground variant="dim">
      <View style={{ flex: 1 }}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: c.text, fontSize: 24, fontWeight: '900' }}>Dashboard</Text>
        </View>

        {/* Top Card: Group Decide (replaces + flow) */}
        <View style={styles.cardsContainer}>
          <Pressable
            onPress={() => router.push('/decisions/new')}
            accessibilityRole="button"
            accessibilityLabel="Start a new decision"
            style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1 }]}
          >
            <View style={styles.media}>
              <Image
                source={require('../../assets/GroupDecide.png')}
                style={styles.mediaImage}
                resizeMode={Platform.OS === 'web' ? 'cover' : 'contain'}
              />
            </View>
          </Pressable>

          {/* Bottom Card: Discover Events */}
          <Pressable
            onPress={() => router.push('/events')}
            accessibilityRole="button"
            accessibilityLabel="Discover events"
            style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1 }]}
          >
            <View style={styles.media}>
              <Image
                source={require('../../assets/DiscoverEvents.png')}
                style={styles.mediaImage}
                resizeMode={Platform.OS === 'web' ? 'cover' : 'contain'}
              />
            </View>
          </Pressable>
        </View>
      </View>
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
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#00000020',
    width: '100%',
  },
  media: {
    width: '100%',
    aspectRatio: 20 / 9,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
});
