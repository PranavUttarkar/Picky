import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import { updateUserProfile, checkUsernameAvailability } from '@/services/friends';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, Typography, Colors } from '@/theme/designTokens';

export default function ProfileSetup() {
  const c = useThemeColors();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accountType, setAccountType] = useState<'personal' | 'organization'>('personal');
  const [loading, setLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Check username availability with debounce
  useEffect(() => {
    if (!username.trim() || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const available = await checkUsernameAvailability(username.trim().toLowerCase());
        setUsernameAvailable(available);
      } catch (error) {
        console.error('Error checking username:', error);
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleContinue = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    if (username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }

    if (usernameAvailable === false) {
      Alert.alert('Error', 'Username is already taken');
      return;
    }

    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter a display name');
      return;
    }

    setLoading(true);
    try {
      await updateUserProfile({
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
        account_type: accountType,
      });

      // Continue to interests page
      router.replace('/onboarding/interests');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const getUsernameStatus = () => {
    if (!username.trim() || username.length < 3) return null;
    if (checkingUsername) return 'checking';
    if (usernameAvailable === true) return 'available';
    if (usernameAvailable === false) return 'taken';
    return null;
  };

  const usernameStatus = getUsernameStatus();

  return (
    <GradientBackground>
      <AnimatedPage>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ 
            flex: 1, 
            padding: Spacing.lg - 4, 
            justifyContent: 'center',
            maxWidth: 400,
            alignSelf: 'center',
            width: '100%',
          }}>
            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: Spacing.xl + 8 }}>
              <View style={{
                backgroundColor: c.primary,
                borderRadius: BorderRadius.full,
                padding: Spacing.lg - 4,
                marginBottom: Spacing.lg - 4,
              }}>
                <Ionicons name="person-add" size={32} color="white" />
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
                Set Up Your Profile
              </Text>
              <Text style={{
                fontSize: Typography.scale.bodyLarge.fontSize,
                lineHeight: Typography.scale.bodyLarge.lineHeight,
                fontFamily: Typography.fontFamily.body,
                color: c.muted,
                textAlign: 'center',
              }}>
                Choose a username and tell us about yourself so friends can find you
              </Text>
            </View>

            {/* Username Input */}
            <View style={{ marginBottom: Spacing.lg - 4 }}>
              <Text style={{
                fontSize: Typography.scale.bodyLarge.fontSize,
                lineHeight: Typography.scale.bodyLarge.lineHeight,
                fontFamily: Typography.fontFamily.body,
                fontWeight: Typography.fontWeight.semibold,
                color: c.text,
                marginBottom: Spacing.sm,
              }}>
                Username *
              </Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter a unique username"
                  placeholderTextColor={c.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    backgroundColor: c.card,
                    padding: Spacing.md,
                    borderRadius: BorderRadius.md,
                    color: c.text,
                    fontSize: Typography.scale.bodyLarge.fontSize,
                    fontFamily: Typography.fontFamily.body,
                    paddingRight: 50,
                    borderWidth: 2,
                    borderColor: usernameStatus === 'available' ? Colors.light.secondary[500] : 
                                usernameStatus === 'taken' ? Colors.light.accent.warning : c.card,
                  }}
                />
                <View style={{
                  position: 'absolute',
                  right: Spacing.md,
                  top: Spacing.md,
                  bottom: Spacing.md,
                  justifyContent: 'center',
                }}>
                  {checkingUsername ? (
                    <Ionicons name="ellipsis-horizontal" size={20} color={c.muted} />
                  ) : usernameStatus === 'available' ? (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.light.secondary[500]} />
                  ) : usernameStatus === 'taken' ? (
                    <Ionicons name="close-circle" size={20} color={Colors.light.accent.warning} />
                  ) : null}
                </View>
              </View>
              {usernameStatus === 'taken' && (
                <Text style={{ color: Colors.light.accent.warning, fontSize: Typography.scale.body.fontSize, lineHeight: Typography.scale.body.lineHeight, fontFamily: Typography.fontFamily.body, marginTop: Spacing.xs }}>
                  Username is already taken
                </Text>
              )}
              {usernameStatus === 'available' && (
                <Text style={{ color: Colors.light.secondary[500], fontSize: Typography.scale.body.fontSize, lineHeight: Typography.scale.body.lineHeight, fontFamily: Typography.fontFamily.body, marginTop: Spacing.xs }}>
                  Username is available!
                </Text>
              )}
            </View>

            {/* Display Name Input */}
            <View style={{ marginBottom: Spacing.lg - 4 }}>
              <Text style={{
                fontSize: Typography.scale.bodyLarge.fontSize,
                lineHeight: Typography.scale.bodyLarge.lineHeight,
                fontFamily: Typography.fontFamily.body,
                fontWeight: Typography.fontWeight.semibold,
                color: c.text,
                marginBottom: Spacing.sm,
              }}>
                Display Name *
              </Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your full name or display name"
                placeholderTextColor={c.muted}
                style={{
                  backgroundColor: c.card,
                  padding: Spacing.md,
                  borderRadius: BorderRadius.md,
                  color: c.text,
                  fontSize: Typography.scale.bodyLarge.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  borderWidth: 1,
                  borderColor: c.card,
                }}
              />
            </View>

            {/* Account Type Selection */}
            <View style={{ marginBottom: Spacing.xl - 2 }}>
              <Text style={{
                fontSize: Typography.scale.bodyLarge.fontSize,
                lineHeight: Typography.scale.bodyLarge.lineHeight,
                fontFamily: Typography.fontFamily.body,
                fontWeight: Typography.fontWeight.semibold,
                color: c.text,
                marginBottom: Spacing.md - 4,
              }}>
                Account Type
              </Text>
              
              <Pressable
                onPress={() => setAccountType('personal')}
                style={{
                  backgroundColor: accountType === 'personal' ? `${c.primary}20` : c.card,
                  padding: Spacing.md,
                  borderRadius: BorderRadius.md,
                  marginBottom: Spacing.md - 4,
                  borderWidth: 2,
                  borderColor: accountType === 'personal' ? c.primary : c.card,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: accountType === 'personal' ? c.primary : c.muted,
                  backgroundColor: accountType === 'personal' ? c.primary : 'transparent',
                  marginRight: Spacing.md - 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {accountType === 'personal' && (
                    <View style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: 'white',
                    }} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: Typography.scale.bodyLarge.fontSize,
                    lineHeight: Typography.scale.bodyLarge.lineHeight,
                    fontFamily: Typography.fontFamily.body,
                    fontWeight: Typography.fontWeight.semibold,
                    color: c.text,
                    marginBottom: 2,
                  }}>
                    Personal Account
                  </Text>
                  <Text style={{
                    fontSize: Typography.scale.body.fontSize,
                    lineHeight: Typography.scale.body.lineHeight,
                    fontFamily: Typography.fontFamily.body,
                    color: c.muted,
                  }}>
                    For individual users who want to connect with friends
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => setAccountType('organization')}
                style={{
                  backgroundColor: accountType === 'organization' ? `${c.primary}20` : c.card,
                  padding: Spacing.md,
                  borderRadius: BorderRadius.md,
                  borderWidth: 2,
                  borderColor: accountType === 'organization' ? c.primary : c.card,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: accountType === 'organization' ? c.primary : c.muted,
                  backgroundColor: accountType === 'organization' ? c.primary : 'transparent',
                  marginRight: Spacing.md - 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {accountType === 'organization' && (
                    <View style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: 'white',
                    }} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: Typography.scale.bodyLarge.fontSize,
                    lineHeight: Typography.scale.bodyLarge.lineHeight,
                    fontFamily: Typography.fontFamily.body,
                    fontWeight: Typography.fontWeight.semibold,
                    color: c.text,
                    marginBottom: 2,
                  }}>
                    Organization Account
                  </Text>
                  <Text style={{
                    fontSize: Typography.scale.body.fontSize,
                    lineHeight: Typography.scale.body.lineHeight,
                    fontFamily: Typography.fontFamily.body,
                    color: c.muted,
                  }}>
                    For clubs, businesses, or groups that host events
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Continue Button */}
            <Pressable
              onPress={handleContinue}
              disabled={loading || !username.trim() || !displayName.trim() || usernameAvailable === false}
              style={{
                backgroundColor: (loading || !username.trim() || !displayName.trim() || usernameAvailable === false) 
                  ? c.muted : c.primary,
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
                {loading ? 'Setting up...' : 'Continue'}
              </Text>
            </Pressable>

            {/* Skip Button */}
            <Pressable
              onPress={() => router.replace('/onboarding/interests')}
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
