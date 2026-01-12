import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Animated, Share, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GradientBackground from '@/components/GradientBackground';
import Avatar from '@/components/Avatar';
import { Typography, Spacing, BorderRadius, Gradients } from '@/theme/designTokens';
import { getUserFriends } from '@/services/friends';
import { createQuickSession, generateShareMessage } from '@/services/quickPick';
import { buildGroupShareLinks } from '@/utils/share';
import type { UserProfile } from '@/types/models';
import * as Clipboard from 'expo-clipboard';

/**
 * Quick Pick Setup Screen
 * Create a new session, name it, and invite friends
 */
export default function QuickPickSetup() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  
  const [sessionName, setSessionName] = useState('');
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createdSession, setCreatedSession] = useState<{ groupId: number; inviteCode: string } | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Animation
  const fadeAnim = useState(() => new Animated.Value(0))[0];
  
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    loadFriends();
  }, []);
  
  const loadFriends = async () => {
    try {
      const data = await getUserFriends();
      setFriends(data);
    } catch (e) {
      console.warn('Failed to load friends:', e);
    } finally {
      setLoading(false);
    }
  };
  
  const toggleFriend = (id: string) => {
    setSelectedFriends(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const handleCreate = async () => {
    setCreating(true);
    try {
      // Create session with placeholder time/category - will be set in next step
      const session = await createQuickSession(
        sessionName || 'Quick Pick',
        'this-week',
        'both'
      );
      
      setCreatedSession({
        groupId: session.groupId,
        inviteCode: session.inviteCode,
      });
    } catch (e: any) {
      console.error('Failed to create session:', e);
      Alert.alert('Error', e.message || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };
  
  const handleShare = async () => {
    if (!createdSession) return;
    
    const { webUrl } = buildGroupShareLinks(createdSession.inviteCode);
    const message = generateShareMessage(
      { name: sessionName || 'Quick Pick', inviteCode: createdSession.inviteCode }
    );
    
    try {
      await Share.share({
        message: `${message}\n${webUrl}`,
        url: webUrl,
      });
    } catch (e) {
      console.warn('Share failed:', e);
    }
  };
  
  const handleCopyCode = async () => {
    if (!createdSession) return;
    await Clipboard.setStringAsync(createdSession.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleContinue = () => {
    if (!createdSession) return;
    router.push(`/quick-pick/when?groupId=${createdSession.groupId}&groupName=${encodeURIComponent(sessionName || 'Quick Pick')}`);
  };
  
  // Show share screen after creation
  if (createdSession) {
    return (
      <GradientBackground variant="dim">
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flex: 1, padding: Spacing.lg }}>
            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: Spacing['2xl'], marginTop: Spacing.xl }}>
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#10B981' + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: Spacing.lg,
              }}>
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
              </View>
              
              <Text style={{
                color: c.text,
                fontSize: Typography.scale.heading2.fontSize,
                fontWeight: '700',
                fontFamily: Typography.fontFamily.displayBold,
                textAlign: 'center',
                marginBottom: Spacing.sm,
              }}>
                Session Created!
              </Text>
              
              <Text style={{
                color: c.muted,
                fontSize: Typography.scale.body.fontSize,
                textAlign: 'center',
                maxWidth: 280,
              }}>
                Share the code or link with friends to invite them
              </Text>
            </View>
            
            {/* Invite Code Display */}
            <Pressable
              onPress={handleCopyCode}
              style={{
                backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff',
                borderRadius: BorderRadius.lg,
                padding: Spacing.xl,
                alignItems: 'center',
                marginBottom: Spacing.lg,
              }}
            >
              <Text style={{
                color: c.muted,
                fontSize: Typography.scale.bodySmall.fontSize,
                fontWeight: '600',
                marginBottom: Spacing.sm,
                textTransform: 'uppercase',
              }}>
                Invite Code
              </Text>
              
              <Text style={{
                color: c.text,
                fontSize: 36,
                fontWeight: '700',
                fontFamily: Typography.fontFamily.displayBold,
                letterSpacing: 6,
                marginBottom: Spacing.sm,
              }}>
                {createdSession.inviteCode}
              </Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons 
                  name={copied ? "checkmark" : "copy-outline"} 
                  size={16} 
                  color={copied ? "#10B981" : c.muted} 
                />
                <Text style={{
                  color: copied ? "#10B981" : c.muted,
                  fontSize: Typography.scale.bodySmall.fontSize,
                  marginLeft: 4,
                }}>
                  {copied ? 'Copied!' : 'Tap to copy'}
                </Text>
              </View>
            </Pressable>
            
            {/* Share Button */}
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                padding: Spacing.md,
                borderRadius: BorderRadius.lg,
                marginBottom: Spacing.xl,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="share-outline" size={20} color={c.primary} />
              <Text style={{
                color: c.primary,
                fontSize: Typography.scale.body.fontSize,
                fontWeight: '600',
                marginLeft: Spacing.sm,
              }}>
                Share Invite Link
              </Text>
            </Pressable>
            
            {/* Friends who were selected */}
            {selectedFriends.size > 0 && (
              <View style={{ marginBottom: Spacing.xl }}>
                <Text style={{
                  color: c.muted,
                  fontSize: Typography.scale.bodySmall.fontSize,
                  fontWeight: '600',
                  marginBottom: Spacing.sm,
                }}>
                  Invited ({selectedFriends.size})
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                  {friends
                    .filter(f => selectedFriends.has(f.id))
                    .map(friend => (
                      <View
                        key={friend.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                          paddingHorizontal: Spacing.sm,
                          paddingVertical: Spacing.xs,
                          borderRadius: BorderRadius.full,
                        }}
                      >
                        <Avatar
                          uri={friend.avatar_url}
                          size={24}
                        />
                        <Text style={{
                          color: c.text,
                          fontSize: Typography.scale.bodySmall.fontSize,
                          marginLeft: Spacing.xs,
                        }}>
                          {friend.display_name || friend.username}
                        </Text>
                      </View>
                    ))}
                </View>
              </View>
            )}
            
            <View style={{ flex: 1 }} />
            
            {/* Continue Button */}
            <Pressable
              onPress={handleContinue}
              style={({ pressed }) => ({
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <LinearGradient
                colors={Gradients.primary as readonly [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: Spacing.md,
                  borderRadius: BorderRadius.lg,
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  color: '#fff',
                  fontSize: Typography.scale.bodyLarge.fontSize,
                  fontWeight: '700',
                }}>
                  Continue to Pick Time
                </Text>
              </LinearGradient>
            </Pressable>
            
            <Text style={{
              color: c.muted,
              fontSize: Typography.scale.bodySmall.fontSize,
              textAlign: 'center',
              marginTop: Spacing.md,
            }}>
              Friends can join anytime before voting ends
            </Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground variant="dim">
      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {/* Header */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            padding: Spacing.lg,
            paddingBottom: Spacing.md,
          }}>
            <Pressable
              onPress={() => router.back()}
              style={{
                padding: Spacing.sm,
                marginRight: Spacing.sm,
                backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderRadius: BorderRadius.md,
              }}
            >
              <Ionicons name="arrow-back" size={24} color={c.text} />
            </Pressable>
            <Text style={{
              color: c.text,
              fontSize: Typography.scale.heading3.fontSize,
              fontWeight: '700',
              fontFamily: Typography.fontFamily.displayBold,
            }}>
              New Session
            </Text>
          </View>
          
          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0 }}
          >
            {/* Session Name */}
            <View style={{ marginBottom: Spacing.xl }}>
              <Text style={{
                color: c.muted,
                fontSize: Typography.scale.bodySmall.fontSize,
                fontWeight: '600',
                marginBottom: Spacing.sm,
                textTransform: 'uppercase',
              }}>
                Session Name (optional)
              </Text>
              
              <TextInput
                value={sessionName}
                onChangeText={setSessionName}
                placeholder="Friday hangout, dinner plans..."
                placeholderTextColor={c.muted}
                style={{
                  backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff',
                  borderRadius: BorderRadius.md,
                  padding: Spacing.md,
                  color: c.text,
                  fontSize: Typography.scale.body.fontSize,
                }}
              />
            </View>
            
            {/* Friends Selection */}
            <View>
              <Text style={{
                color: c.muted,
                fontSize: Typography.scale.bodySmall.fontSize,
                fontWeight: '600',
                marginBottom: Spacing.sm,
                textTransform: 'uppercase',
              }}>
                Pre-select Friends (optional)
              </Text>
              
              <Text style={{
                color: c.muted,
                fontSize: Typography.scale.bodySmall.fontSize,
                marginBottom: Spacing.md,
              }}>
                Or share the invite code after creating
              </Text>
              
              {loading ? (
                <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                  <Text style={{ color: c.muted }}>Loading friends...</Text>
                </View>
              ) : friends.length === 0 ? (
                <View style={{
                  padding: Spacing.xl,
                  alignItems: 'center',
                  backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderRadius: BorderRadius.lg,
                }}>
                  <Ionicons name="people-outline" size={32} color={c.muted} />
                  <Text style={{
                    color: c.muted,
                    fontSize: Typography.scale.body.fontSize,
                    marginTop: Spacing.sm,
                    textAlign: 'center',
                  }}>
                    No friends yet.{'\n'}Share the invite code instead!
                  </Text>
                </View>
              ) : (
                <View style={{ gap: Spacing.sm }}>
                  {friends.map((friend) => {
                    const isSelected = selectedFriends.has(friend.id);
                    return (
                      <Pressable
                        key={friend.id}
                        onPress={() => toggleFriend(friend.id)}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: Spacing.md,
                          backgroundColor: isSelected
                            ? (c.primary + '15')
                            : (scheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff'),
                          borderRadius: BorderRadius.md,
                          borderWidth: isSelected ? 1.5 : 0,
                          borderColor: isSelected ? c.primary : 'transparent',
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Avatar
                          uri={friend.avatar_url}
                          size={44}
                        />
                        <View style={{ flex: 1, marginLeft: Spacing.md }}>
                          <Text style={{
                            color: c.text,
                            fontSize: Typography.scale.body.fontSize,
                            fontWeight: '500',
                          }}>
                            {friend.display_name || friend.username || 'Friend'}
                          </Text>
                          {friend.username && friend.display_name && (
                            <Text style={{
                              color: c.muted,
                              fontSize: Typography.scale.bodySmall.fontSize,
                            }}>
                              @{friend.username}
                            </Text>
                          )}
                        </View>
                        <View style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: isSelected ? c.primary : c.muted,
                          backgroundColor: isSelected ? c.primary : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          {isSelected && (
                            <Ionicons name="checkmark" size={16} color="#fff" />
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
          
          {/* Bottom CTA */}
          <View style={{ padding: Spacing.lg, paddingTop: Spacing.sm }}>
            <Pressable
              onPress={handleCreate}
              disabled={creating}
              style={({ pressed }) => ({
                opacity: pressed ? 0.9 : (creating ? 0.7 : 1),
              })}
            >
              <LinearGradient
                colors={Gradients.primary as readonly [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: Spacing.md,
                  borderRadius: BorderRadius.lg,
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  color: '#fff',
                  fontSize: Typography.scale.bodyLarge.fontSize,
                  fontWeight: '700',
                }}>
                  {creating ? 'Creating...' : 'Create Session'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
    </GradientBackground>
  );
}
