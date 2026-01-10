import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import GradientBackground from '@/components/GradientBackground';
import { Typography, Spacing, BorderRadius } from '@/theme/designTokens';

/**
 * Pass/Group Decide placeholder page
 * This will be replaced with a fun UX workflow for groups to decide together
 */
export default function PassPage() {
  const c = useThemeColors();
  const { scheme } = useTheme();

  return (
    <GradientBackground variant="dim">
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: Spacing.md }}>
          {/* Header with back button */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            marginBottom: Spacing.xl 
          }}>
            <Pressable
              onPress={() => router.back()}
              style={{
                padding: Spacing.sm,
                marginRight: Spacing.sm,
                backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderRadius: BorderRadius.md,
              }}
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={24} color={c.text} />
            </Pressable>
            <Text style={{
              color: c.text,
              fontSize: Typography.scale.heading1.fontSize,
              fontWeight: '700',
              fontFamily: Typography.fontFamily.displayBold,
            }}>
              Group Pick
            </Text>
          </View>

          {/* Placeholder content */}
          <View style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: Spacing.xl,
          }}>
            <View style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: scheme === 'dark' ? 'rgba(255,196,148,0.15)' : 'rgba(255,111,97,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: Spacing.xl,
            }}>
              <Text style={{ fontSize: 56 }}>🤝</Text>
            </View>
            
            <Text style={{
              color: c.text,
              fontSize: Typography.scale.heading2.fontSize,
              fontWeight: '700',
              fontFamily: Typography.fontFamily.displayBold,
              textAlign: 'center',
              marginBottom: Spacing.md,
            }}>
              Coming Soon!
            </Text>
            
            <Text style={{
              color: c.muted,
              fontSize: Typography.scale.body.fontSize,
              fontFamily: Typography.fontFamily.body,
              textAlign: 'center',
              lineHeight: 22,
              maxWidth: 300,
            }}>
              A fun and interactive way for groups to make decisions together.
              Swipe, vote, and find the perfect choice for everyone!
            </Text>

            <View style={{
              marginTop: Spacing['2xl'],
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: Spacing.sm,
            }}>
              {['🍕 Food', '🎉 Events', '🎬 Movies', '🎮 Activities'].map((item) => (
                <View
                  key={item}
                  style={{
                    paddingHorizontal: Spacing.md,
                    paddingVertical: Spacing.sm,
                    backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    borderRadius: BorderRadius.full,
                  }}
                >
                  <Text style={{
                    color: c.text,
                    fontSize: Typography.scale.bodySmall.fontSize,
                    fontWeight: '600',
                  }}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Bottom action button */}
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              backgroundColor: c.primary,
              paddingVertical: Spacing.md,
              borderRadius: BorderRadius.lg,
              alignItems: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{
              color: scheme === 'dark' ? '#000' : '#fff',
              fontSize: Typography.scale.bodyLarge.fontSize,
              fontWeight: '700',
              fontFamily: Typography.fontFamily.bodyBold,
            }}>
              Got it!
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

