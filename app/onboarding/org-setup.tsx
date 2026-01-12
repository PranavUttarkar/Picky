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

// Organization tags for better discoverability
const ORGANIZATION_TAGS = [
  'Campus Events',
  'Networking',
  'Social',
  'Professional Development',
  'Community Service',
  'Workshops',
  'Conferences',
  'Sports',
  'Arts & Culture',
  'Tech',
  'Science',
  'Health & Wellness',
  'Environment',
  'Diversity & Inclusion',
  'Career Fair',
  'Music',
  'Dance',
  'Theater',
  'Gaming',
  'Volunteer',
];

// Maximum number of tags an org can select
const MAX_TAGS = 10;

export default function OrgSetup() {
  const c = useThemeColors();
  const [category, setCategory] = useState<OrganizationCategory>('Student Club');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [memberCount, setMemberCount] = useState<OrganizationSize | null>(null);
  const [foundedYear, setFoundedYear] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
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

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else if (selectedTags.length < MAX_TAGS) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const addCustomTag = () => {
    const tag = customTagInput.trim();
    if (tag && !selectedTags.includes(tag) && selectedTags.length < MAX_TAGS) {
      setSelectedTags([...selectedTags, tag]);
      setCustomTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  const handleContinue = async () => {
    // Validate required fields
    if (!category) {
      Alert.alert('Required', 'Please select a category for your organization');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please add a description for your organization');
      return;
    }

    // Save everything
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Save organization profile
      await upsertOrganizationProfile({
        category,
        description: description.trim() || null,
        website: website.trim() || null,
        contact_email: contactEmail.trim() || null,
        member_count: memberCount,
        founded_year: foundedYear ? parseInt(foundedYear) : null,
      });

      // Save organization tags
      if (selectedTags.length > 0) {
        await supabase
          .from('organization_tags')
          .upsert({
            user_id: user.id,
            tags: selectedTags,
          }, { onConflict: 'user_id' });
      }

      // Complete onboarding
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save organization profile');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const renderForm = () => (
    <View style={{ flex: 1 }}>
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
          Tell us about your org
        </Text>
        <Text style={{
          fontSize: Typography.scale.bodyLarge.fontSize,
          lineHeight: Typography.scale.bodyLarge.lineHeight,
          fontFamily: Typography.fontFamily.body,
          color: c.muted,
          textAlign: 'center',
        }}>
          Help users discover you by providing details
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
                paddingVertical: Spacing.sm + 2,
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
          Organization Size (optional)
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
          About Your Organization *
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Tell users about your organization's mission, activities, and what makes you unique..."
          placeholderTextColor={c.muted}
          multiline
          numberOfLines={5}
          style={{
            backgroundColor: c.card,
            padding: Spacing.md,
            borderRadius: BorderRadius.md,
            color: c.text,
            fontSize: Typography.scale.body.fontSize,
            fontFamily: Typography.fontFamily.body,
            minHeight: 140,
            textAlignVertical: 'top',
            borderWidth: 1,
            borderColor: c.card,
          }}
        />
        <Text style={{
          fontSize: Typography.scale.bodySmall.fontSize,
          fontFamily: Typography.fontFamily.body,
          color: c.muted,
          marginTop: Spacing.xs,
          textAlign: 'right',
        }}>
          {description.length}/500
        </Text>
      </View>

      {/* Tags Selection */}
      <View style={{ marginBottom: Spacing.lg }}>
        <Text style={{
          fontSize: Typography.scale.bodyLarge.fontSize,
          lineHeight: Typography.scale.bodyLarge.lineHeight,
          fontFamily: Typography.fontFamily.body,
          fontWeight: Typography.fontWeight.semibold,
          color: c.text,
          marginBottom: Spacing.xs,
        }}>
          {`Tags (up to ${MAX_TAGS})`}
        </Text>
        <Text style={{
          fontSize: Typography.scale.body.fontSize,
          fontFamily: Typography.fontFamily.body,
          color: c.muted,
          marginBottom: Spacing.sm,
        }}>
          Select tags to help users find your events
        </Text>

        {/* Selected Tags */}
        {selectedTags.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.sm }}>
            {selectedTags.map((tag) => (
              <View key={tag} style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: `${c.primary}20`,
                borderWidth: 1,
                borderColor: `${c.primary}40`,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                gap: 6,
              }}>
                <Text style={{ color: c.primary, fontSize: 13, fontWeight: '600' }}>
                  {tag}
                </Text>
                <Pressable onPress={() => removeTag(tag)} hitSlop={8}>
                  <Ionicons name="close" size={14} color={c.primary} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Tag Options */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
          {ORGANIZATION_TAGS.filter(t => !selectedTags.includes(t)).map((tag) => (
            <Pressable
              key={tag}
              onPress={() => toggleTag(tag)}
              disabled={selectedTags.length >= MAX_TAGS}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: BorderRadius.full,
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: Colors.light.neutral[300] + '40',
                opacity: selectedTags.length >= MAX_TAGS ? 0.5 : 1,
              }}
            >
              <Text style={{
                color: c.text,
                fontSize: Typography.scale.bodySmall.fontSize,
                fontFamily: Typography.fontFamily.body,
              }}>
                {tag}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Custom Tag Input */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md }}>
          <TextInput
            value={customTagInput}
            onChangeText={setCustomTagInput}
            placeholder="Add custom tag..."
            placeholderTextColor={c.muted}
            onSubmitEditing={addCustomTag}
            style={{
              flex: 1,
              backgroundColor: c.card,
              padding: Spacing.md,
              borderRadius: BorderRadius.md,
              color: c.text,
              fontSize: Typography.scale.body.fontSize,
              fontFamily: Typography.fontFamily.body,
            }}
          />
          <Pressable
            onPress={addCustomTag}
            disabled={!customTagInput.trim() || selectedTags.length >= MAX_TAGS}
            style={{
              backgroundColor: customTagInput.trim() && selectedTags.length < MAX_TAGS ? c.primary : c.muted,
              paddingHorizontal: Spacing.md,
              borderRadius: BorderRadius.md,
              justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </Pressable>
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
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: c.card,
          borderRadius: BorderRadius.md,
          borderWidth: 1,
          borderColor: c.card,
        }}>
          <View style={{ paddingLeft: Spacing.md }}>
            <Ionicons name="globe-outline" size={20} color={c.muted} />
          </View>
          <TextInput
            value={website}
            onChangeText={setWebsite}
            placeholder="https://yourorganization.com"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={{
              flex: 1,
              padding: Spacing.md,
              color: c.text,
              fontSize: Typography.scale.body.fontSize,
              fontFamily: Typography.fontFamily.body,
            }}
          />
        </View>
      </View>

      {/* Contact Email */}
      <View style={{ marginBottom: Spacing.lg }}>
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
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: c.card,
          borderRadius: BorderRadius.md,
          borderWidth: 1,
          borderColor: c.card,
        }}>
          <View style={{ paddingLeft: Spacing.md }}>
            <Ionicons name="mail-outline" size={20} color={c.muted} />
          </View>
          <TextInput
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder="contact@yourorganization.com"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={{
              flex: 1,
              padding: Spacing.md,
              color: c.text,
              fontSize: Typography.scale.body.fontSize,
              fontFamily: Typography.fontFamily.body,
            }}
          />
        </View>
      </View>

      {/* Founded Year */}
      <View style={{ marginBottom: Spacing.lg }}>
        <Text style={{
          fontSize: Typography.scale.bodyLarge.fontSize,
          lineHeight: Typography.scale.bodyLarge.lineHeight,
          fontFamily: Typography.fontFamily.body,
          fontWeight: Typography.fontWeight.semibold,
          color: c.text,
          marginBottom: Spacing.sm,
        }}>
          Founded Year (optional)
        </Text>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: c.card,
          borderRadius: BorderRadius.md,
          borderWidth: 1,
          borderColor: c.card,
        }}>
          <View style={{ paddingLeft: Spacing.md }}>
            <Ionicons name="calendar-outline" size={20} color={c.muted} />
          </View>
          <TextInput
            value={foundedYear}
            onChangeText={(text) => setFoundedYear(text.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="2024"
            placeholderTextColor={c.muted}
            keyboardType="number-pad"
            maxLength={4}
            style={{
              flex: 1,
              padding: Spacing.md,
              color: c.text,
              fontSize: Typography.scale.body.fontSize,
              fontFamily: Typography.fontFamily.body,
            }}
          />
        </View>
      </View>
    </View>
  );

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
            {/* Back Button */}
            <Pressable
              onPress={handleBack}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: Spacing.md,
              }}
            >
              <Ionicons name="chevron-back" size={24} color={c.text} />
              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                marginLeft: 4,
              }}>
                Cancel
              </Text>
            </Pressable>

            {/* Form Content */}
            {renderStep1()}

            {/* Continue Button */}
            <Pressable
              onPress={handleContinue}
              disabled={loading || !category || !description.trim()}
              style={{
                backgroundColor: (loading || !category || !description.trim()) 
                  ? c.muted 
                  : c.primary,
                paddingVertical: Spacing.md,
                borderRadius: BorderRadius.md,
                alignItems: 'center',
                marginTop: Spacing.lg,
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
