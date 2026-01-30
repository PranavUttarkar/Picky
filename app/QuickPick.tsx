import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GradientBackground from '@/components/GradientBackground';
import { Typography, Spacing, BorderRadius, Gradients } from '@/theme/designTokens';
import { getMyGroups } from '@/services/groups';
import { joinQuickSession } from '@/services/quickPick';
import type { Group } from '@/types/models';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Quick Pick Entry Screen
 * Fast, friendly entry point for group decisions
 */
export default function QuickPickEntry() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const params = useLocalSearchParams<{ groupId?: string; groupName?: string }>();
  
  // If coming from a group, pre-select that group
  const preSelectedGroupId = params.groupId ? Number(params.groupId) : null;
  const preSelectedGroupName = params.groupName ? decodeURIComponent(params.groupName) : null;
  
  const [mode, setMode] = useState<'choose' | 'join'>('choose');
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  
  // Animation values
  const fadeAnim = useState(() => new Animated.Value(0))[0];
  const scaleAnim = useState(() => new Animated.Value(0.9))[0];
  
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Load user's groups
    loadGroups();
    
    // If coming from a group chat, auto-navigate to the when screen
    if (preSelectedGroupId && preSelectedGroupName) {
      router.push(`/quick-pick/when?groupId=${preSelectedGroupId}&groupName=${encodeURIComponent(preSelectedGroupName)}`);
    }
  }, [preSelectedGroupId, preSelectedGroupName]);
  
  const loadGroups = async () => {
    try {
      const groups = await getMyGroups();
      setMyGroups(groups);
    } catch (e) {
      console.warn('Failed to load groups:', e);
    } finally {
      setLoadingGroups(false);
    }
  };
  
  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) {
      setError('Enter an invite code');
      return;
    }
    
    setJoining(true);
    setError(null);
    
    try {
      const { groupId } = await joinQuickSession(inviteCode.trim());
      // Navigate to the voting screen for this group
      router.push(`/quick-pick/vote?groupId=${groupId}`);
    } catch (e: any) {
      setError(e.message || 'Failed to join. Check the code and try again.');
    } finally {
      setJoining(false);
    }
  };
  
  const handleStartNew = () => {
    router.push('/quick-pick/setup');
  };
  
  const handleSelectGroup = (group: Group) => {
    router.push(`/quick-pick/when?groupId=${group.id}&groupName=${encodeURIComponent(group.name)}`);
  };

  return (
    <GradientBackground variant="dim">
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <Animated.View 
          style={{ 
            flex: 1, 
            padding: Spacing.lg,
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }}
        >
          {/* Header */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            marginBottom: Spacing.xl,
          }}>
            <Pressable
              onPress={() => {
                if (preSelectedGroupId) {
                  router.push(`/(tabs)/groups/${preSelectedGroupId}`);
                } else {
                  router.back();
                }
              }}
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
            {preSelectedGroupName && (
              <Text style={{ color: c.muted, fontSize: Typography.scale.body.fontSize }}>
                {preSelectedGroupName}
              </Text>
            )}
          </View>

          {/* Hero Section */}
          <View style={{ alignItems: 'center', marginBottom: Spacing['2xl'] }}>
            <View style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: scheme === 'dark' ? 'rgba(255,196,148,0.15)' : 'rgba(255,111,97,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: Spacing.lg,
            }}>
              <Text style={{ fontSize: 48 }}>🤝</Text>
            </View>
            
            <Text style={{
              color: c.text,
              fontSize: Typography.scale.heading1.fontSize,
              fontWeight: '700',
              fontFamily: Typography.fontFamily.displayBold,
              textAlign: 'center',
              marginBottom: Spacing.sm,
            }}>
              Quick Pick
            </Text>
            
            <Text style={{
              color: c.muted,
              fontSize: Typography.scale.body.fontSize,
              fontFamily: Typography.fontFamily.body,
              textAlign: 'center',
              lineHeight: 22,
              maxWidth: 280,
            }}>
              Find the perfect plan with friends under 60 seconds
            </Text>
          </View>

          {/* Mode Toggle */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderRadius: BorderRadius.lg,
            padding: 4,
            marginBottom: Spacing.xl,
          }}>
            {(['choose', 'join'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={{
                  flex: 1,
                  paddingVertical: Spacing.sm,
                  borderRadius: BorderRadius.md,
                  backgroundColor: mode === m 
                    ? (scheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#fff') 
                    : 'transparent',
                }}
              >
                <Text style={{
                  color: mode === m ? c.text : c.muted,
                  fontSize: Typography.scale.body.fontSize,
                  fontWeight: mode === m ? '600' : '400',
                  textAlign: 'center',
                }}>
                  {m === 'choose' ? 'Start New' : 'Join Session'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Content based on mode */}
          {mode === 'choose' ? (
            <View style={{ flex: 1 }}>
              {/* New Session CTA */}
              <Pressable
                onPress={handleStartNew}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.9 : 1,
                  marginBottom: Spacing.lg,
                })}
              >
                <LinearGradient
                  colors={['#FF6F61', '#F59E0B'] as const}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    padding: Spacing.lg,
                    borderRadius: BorderRadius.lg,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: Spacing.md,
                  }}>
                    <Ionicons name="add" size={28} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      color: '#fff',
                      fontSize: Typography.scale.bodyLarge.fontSize,
                      fontWeight: '700',
                      marginBottom: 2,
                    }}>
                      New Plan
                    </Text>
                    <Text style={{
                      color: 'rgba(255,255,255,0.8)',
                      fontSize: Typography.scale.bodySmall.fontSize,
                    }}>
                      Invite friends & decide together
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="#fff" />
                </LinearGradient>
              </Pressable>

              {/* Existing Groups */}
              {myGroups.length > 0 && (
                <View>
                  <Text style={{
                    color: c.muted,
                    fontSize: Typography.scale.bodySmall.fontSize,
                    fontWeight: '600',
                    marginBottom: Spacing.sm,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>
                    Or decide with existing group
                  </Text>
                  
                  {myGroups.slice(0, 4).map((group) => (
                    <Pressable
                      key={group.id}
                      onPress={() => handleSelectGroup(group)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: Spacing.md,
                        backgroundColor: scheme === 'dark' 
                          ? 'rgba(255,255,255,0.05)' 
                          : 'rgba(0,0,0,0.03)',
                        borderRadius: BorderRadius.md,
                        marginBottom: Spacing.sm,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: c.primary + '20',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: Spacing.md,
                      }}>
                        <Ionicons name="people" size={20} color={c.primary} />
                      </View>
                      <Text style={{
                        flex: 1,
                        color: c.text,
                        fontSize: Typography.scale.body.fontSize,
                        fontWeight: '500',
                      }}>
                        {group.name}
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color={c.muted} />
                    </Pressable>
                  ))}
                </View>
              )}
              
              {loadingGroups && (
                <View style={{ padding: Spacing.lg, alignItems: 'center' }}>
                  <Text style={{ color: c.muted }}>Loading your groups...</Text>
                </View>
              )}
            </View>
          ) : (
            /* Join Mode */
            <View style={{ flex: 1 }}>
              <View style={{
                backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff',
                borderRadius: BorderRadius.lg,
                padding: Spacing.lg,
                marginBottom: Spacing.md,
              }}>
                <Text style={{
                  color: c.muted,
                  fontSize: Typography.scale.bodySmall.fontSize,
                  fontWeight: '600',
                  marginBottom: Spacing.sm,
                  textTransform: 'uppercase',
                }}>
                  Enter Invite Code
                </Text>
                
                <TextInput
                  value={inviteCode}
                  onChangeText={(text) => {
                    setInviteCode(text.toUpperCase());
                    setError(null);
                  }}
                  placeholder="ABC123"
                  placeholderTextColor={c.muted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={{
                    color: c.text,
                    fontSize: Typography.scale.heading2.fontSize,
                    fontWeight: '700',
                    fontFamily: Typography.fontFamily.displayBold,
                    letterSpacing: 4,
                    textAlign: 'center',
                    paddingVertical: Spacing.md,
                  }}
                />
                
                {error && (
                  <Text style={{
                    color: '#EF4444',
                    fontSize: Typography.scale.bodySmall.fontSize,
                    textAlign: 'center',
                    marginTop: Spacing.sm,
                  }}>
                    {error}
                  </Text>
                )}
              </View>
              
              <Pressable
                onPress={handleJoinByCode}
                disabled={joining || !inviteCode.trim()}
                style={({ pressed }) => ({
                  backgroundColor: inviteCode.trim() ? c.primary : c.muted,
                  paddingVertical: Spacing.md,
                  borderRadius: BorderRadius.lg,
                  alignItems: 'center',
                  opacity: pressed ? 0.8 : (inviteCode.trim() ? 1 : 0.5),
                })}
              >
                <Text style={{
                  color: '#fff',
                  fontSize: Typography.scale.bodyLarge.fontSize,
                  fontWeight: '700',
                }}>
                  {joining ? 'Joining...' : 'Join Session'}
                </Text>
              </Pressable>
              
              <Text style={{
                color: c.muted,
                fontSize: Typography.scale.bodySmall.fontSize,
                textAlign: 'center',
                marginTop: Spacing.lg,
                lineHeight: 20,
              }}>
                Ask your friend for the invite code, or tap the link they shared with you
              </Text>
            </View>
          )}
        </Animated.View>
      </SafeAreaView>
    </GradientBackground>
  );
}

