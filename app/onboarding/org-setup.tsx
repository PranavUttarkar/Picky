import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, Typography, Colors } from '@/theme/designTokens';
import { 
  upsertOrganizationProfile, 
  ORGANIZATION_CATEGORIES, 
  ORGANIZATION_SIZES,
  type OrganizationCategory,
  type OrganizationSize,
} from '@/services/organizations';

export default function OrgSetup() {
  const c = useThemeColors();
  const [category, setCategory] = useState<OrganizationCategory>('Student Club');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [memberCount, setMemberCount] = useState<OrganizationSize | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if user is authenticated and is an organization
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/onboarding/welcome');
        return;
      }

      // Verify account type
      const { data: userData } = await supabase
        .from('users')
        .select('account_type')
        .eq('id', user.id)
        .single();

      if (userData?.account_type !== 'organization') {
        // If not an organization, redirect to interests
        router.replace('/onboarding/interests');
      }
    };
    checkAuth();
  }, []);

  const handleContinue = async () => {
    if (!category) {
      Alert.alert('Error', 'Please select a category for your organization');
      return;
    }

    setLoading(true);
    try {
      await upsertOrganizationProfile({
        category,
        description: description.trim() || null,
        website: website.trim() || null,
        contact_email: contactEmail.trim() || null,
        member_count: memberCount,
      });

      // Organizations can skip interests or go to a simplified version
      // For now, redirect to home
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save organization profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientBackground>
      <AnimatedPage variant="slide-left">
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ 
            flexGrow: 1,
            padding: Spacing.lg - 4,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ 
            flex: 1, 
            maxWidth: 500,
            alignSelf: 'center',
            width: '100%',
          }}>
            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: Spacing.xl }}>
              <View style={{
                backgroundColor: c.primary,
                borderRadius: BorderRadius.full,
                padding: Spacing.lg - 4,
                marginBottom: Spacing.lg - 4,
              }}>
                <Ionicons name="business" size={32} color="white" />
              </View>
              <Text style={{
                fontSize: Typography.scale.display.fontSize,
                lineHeight: Typography.scale.display.lineHeight,
                fontWeight: Typography.fontWeight.bold,
                fontFamily: Typography.fontFamily.body,
                color: c.text,
                textAlign: 'center',
                marginBottom: Spacing.sm,
              }}>
                Set Up Your Organization
              </Text>
              <Text style={{
                fontSize: Typography.scale.bodyLarge.fontSize,
                lineHeight: Typography.scale.bodyLarge.lineHeight,
                fontFamily: Typography.fontFamily.body,
                color: c.muted,
                textAlign: 'center',
              }}>
                Tell us about your organization so users can discover you
              </Text>
            </View>

            {/* Category Selection */}
            <View style={{ marginBottom: Spacing.lg }}>
              <Text style={{
                fontSize: Typography.scale.bodyLarge.fontSize,
                lineHeight: Typography.scale.bodyLarge.lineHeight,
                fontFamily: Typography.fontFamily.body,
                fontWeight: Typography.fontWeight.semibold,
                color: c.text,
                marginBottom: Spacing.sm,
              }}>
                Category *
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                {ORGANIZATION_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={{
                      paddingVertical: Spacing.sm,
                      paddingHorizontal: Spacing.md,
                      borderRadius: BorderRadius.full,
                      backgroundColor: category === cat ? c.primary : c.card,
                      borderWidth: 1,
                      borderColor: category === cat ? c.primary : Colors.light.neutral[300] + '40',
                    }}
                  >
                    <Text style={{
                      color: category === cat ? '#FFFFFF' : c.text,
                      fontSize: Typography.scale.body.fontSize,
                      fontFamily: Typography.fontFamily.body,
                      fontWeight: category === cat ? Typography.fontWeight.semibold : Typography.fontWeight.regular,
                    }}>
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Description */}
            <View style={{ marginBottom: Spacing.lg }}>
              <Text style={{
                fontSize: Typography.scale.bodyLarge.fontSize,
                lineHeight: Typography.scale.bodyLarge.lineHeight,
                fontFamily: Typography.fontFamily.body,
                fontWeight: Typography.fontWeight.semibold,
                color: c.text,
                marginBottom: Spacing.sm,
              }}>
                Description
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Tell users about your organization..."
                placeholderTextColor={c.muted}
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: c.card,
                  padding: Spacing.md,
                  borderRadius: BorderRadius.md,
                  color: c.text,
                  fontSize: Typography.scale.body.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  minHeight: 100,
                  textAlignVertical: 'top',
                  borderWidth: 1,
                  borderColor: c.card,
                }}
              />
            </View>

            {/* Organization Size */}
            <View style={{ marginBottom: Spacing.lg }}>
              <Text style={{
                fontSize: Typography.scale.bodyLarge.fontSize,
                lineHeight: Typography.scale.bodyLarge.lineHeight,
                fontFamily: Typography.fontFamily.body,
                fontWeight: Typography.fontWeight.semibold,
                color: c.text,
                marginBottom: Spacing.sm,
              }}>
                Organization Size
              </Text>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                {ORGANIZATION_SIZES.map((size) => (
                  <Pressable
                    key={size}
                    onPress={() => setMemberCount(memberCount === size ? null : size)}
                    style={{
                      flex: 1,
                      paddingVertical: Spacing.md,
                      paddingHorizontal: Spacing.sm,
                      borderRadius: BorderRadius.md,
                      backgroundColor: memberCount === size ? c.primary : c.card,
                      borderWidth: 1,
                      borderColor: memberCount === size ? c.primary : Colors.light.neutral[300] + '40',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{
                      color: memberCount === size ? '#FFFFFF' : c.text,
                      fontSize: Typography.scale.body.fontSize,
                      fontFamily: Typography.fontFamily.body,
                      fontWeight: memberCount === size ? Typography.fontWeight.semibold : Typography.fontWeight.regular,
                    }}>
                      {size}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Website */}
            <View style={{ marginBottom: Spacing.lg }}>
              <Text style={{
                fontSize: Typography.scale.bodyLarge.fontSize,
                lineHeight: Typography.scale.bodyLarge.lineHeight,
                fontFamily: Typography.fontFamily.body,
                fontWeight: Typography.fontWeight.semibold,
                color: c.text,
                marginBottom: Spacing.sm,
              }}>
                Website (optional)
              </Text>
              <TextInput
                value={website}
                onChangeText={setWebsite}
                placeholder="https://yourorganization.com"
                placeholderTextColor={c.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={{
                  backgroundColor: c.card,
                  padding: Spacing.md,
                  borderRadius: BorderRadius.md,
                  color: c.text,
                  fontSize: Typography.scale.body.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  borderWidth: 1,
                  borderColor: c.card,
                }}
              />
            </View>

            {/* Contact Email */}
            <View style={{ marginBottom: Spacing.xl }}>
              <Text style={{
                fontSize: Typography.scale.bodyLarge.fontSize,
                lineHeight: Typography.scale.bodyLarge.lineHeight,
                fontFamily: Typography.fontFamily.body,
                fontWeight: Typography.fontWeight.semibold,
                color: c.text,
                marginBottom: Spacing.sm,
              }}>
                Contact Email (optional)
              </Text>
              <TextInput
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder="contact@yourorganization.com"
                placeholderTextColor={c.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={{
                  backgroundColor: c.card,
                  padding: Spacing.md,
                  borderRadius: BorderRadius.md,
                  color: c.text,
                  fontSize: Typography.scale.body.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  borderWidth: 1,
                  borderColor: c.card,
                }}
              />
            </View>

            {/* Continue Button */}
            <Pressable
              onPress={handleContinue}
              disabled={loading || !category}
              style={{
                backgroundColor: (loading || !category) ? c.muted : c.primary,
                paddingVertical: Spacing.md,
                borderRadius: BorderRadius.md,
                alignItems: 'center',
                marginBottom: Spacing.md,
              }}
            >
              <Text style={{
                color: '#FFFFFF',
                fontSize: Typography.scale.bodyLarge.fontSize,
                lineHeight: Typography.scale.bodyLarge.lineHeight,
                fontFamily: Typography.fontFamily.body,
                fontWeight: Typography.fontWeight.semibold,
              }}>
                {loading ? 'Setting up...' : 'Complete Setup'}
              </Text>
            </Pressable>

            {/* Skip for now */}
            <Pressable
              onPress={() => router.replace('/(tabs)/home')}
              style={{
                paddingVertical: Spacing.md - 4,
                alignItems: 'center',
              }}
            >
              <Text style={{
                color: c.muted,
                fontSize: Typography.scale.body.fontSize,
                lineHeight: Typography.scale.body.lineHeight,
                fontFamily: Typography.fontFamily.body,
              }}>
                Skip for now
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </AnimatedPage>
    </GradientBackground>
  );
}

