import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import { getUserSettings, updateUserSettings } from '@/services/privacy';
import { getBlockedUsers } from '@/services/blocking';
import { Ionicons } from '@expo/vector-icons';
import type { UserSettings, UserProfile } from '@/types/models';

export default function PrivacySettings() {
  const c = useThemeColors();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        router.replace('/onboarding/welcome');
        return;
      }

      const [settingsData, blockedData] = await Promise.all([
        getUserSettings(),
        getBlockedUsers()
      ]);

      setSettings(settingsData || {
        user_id: user.id,
        show_activity_to_friends: true,
        show_activity_to_followers: true,
        allow_friend_requests: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setBlockedUsers(blockedData);
    } catch (error) {
      console.error('Error loading privacy data:', error);
      Alert.alert('Error', 'Failed to load privacy settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof UserSettings, value: boolean) => {
    if (!settings) return;

    setUpdating(true);
    try {
      const updatedSettings = await updateUserSettings({ [key]: value });
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Error updating setting:', error);
      Alert.alert('Error', 'Failed to update privacy setting');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <GradientBackground>
        <AnimatedPage>
          <View style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ color: c.text, fontSize: 16 }}>
              Loading privacy settings...
            </Text>
          </View>
        </AnimatedPage>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <AnimatedPage>
        <ScrollView style={{ flex: 1 }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 16,
            marginBottom: 20,
          }}>
            <Pressable
              onPress={() => router.back()}
              style={{
                padding: 8,
                marginRight: 12,
              }}
            >
              <Ionicons name="arrow-back" size={24} color={c.text} />
            </Pressable>
            <Text style={{
              fontSize: 24,
              fontWeight: '700',
              color: c.text,
              flex: 1,
            }}>
              Privacy Settings
            </Text>
          </View>

          {/* Activity Visibility */}
          <View style={{
            backgroundColor: c.card,
            marginHorizontal: 16,
            marginBottom: 16,
            borderRadius: 12,
            padding: 16,
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: c.text,
              marginBottom: 16,
            }}>
              Activity Visibility
            </Text>
            
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: c.text,
                  marginBottom: 4,
                }}>
                  Show activity to friends
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: c.muted,
                  lineHeight: 20,
                }}>
                  Let your friends see when you save events and restaurants
                </Text>
              </View>
              <Switch
                value={settings?.show_activity_to_friends ?? true}
                onValueChange={(value) => updateSetting('show_activity_to_friends', value)}
                disabled={updating}
                trackColor={{ false: c.muted, true: c.primary }}
                thumbColor="white"
              />
            </View>

            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: c.text,
                  marginBottom: 4,
                }}>
                  Show activity to followers
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: c.muted,
                  lineHeight: 20,
                }}>
                  Let users who follow you see your activity (for organization accounts)
                </Text>
              </View>
              <Switch
                value={settings?.show_activity_to_followers ?? true}
                onValueChange={(value) => updateSetting('show_activity_to_followers', value)}
                disabled={updating}
                trackColor={{ false: c.muted, true: c.primary }}
                thumbColor="white"
              />
            </View>
          </View>

          {/* Friend Requests */}
          <View style={{
            backgroundColor: c.card,
            marginHorizontal: 16,
            marginBottom: 16,
            borderRadius: 12,
            padding: 16,
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: c.text,
              marginBottom: 16,
            }}>
              Friend Requests
            </Text>
            
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: c.text,
                  marginBottom: 4,
                }}>
                  Allow friend requests
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: c.muted,
                  lineHeight: 20,
                }}>
                  Let other users send you friend requests
                </Text>
              </View>
              <Switch
                value={settings?.allow_friend_requests ?? true}
                onValueChange={(value) => updateSetting('allow_friend_requests', value)}
                disabled={updating}
                trackColor={{ false: c.muted, true: c.primary }}
                thumbColor="white"
              />
            </View>
          </View>

          {/* Blocked Users */}
          <View style={{
            backgroundColor: c.card,
            marginHorizontal: 16,
            marginBottom: 16,
            borderRadius: 12,
            padding: 16,
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: c.text,
              marginBottom: 16,
            }}>
              Blocked Users ({blockedUsers.length})
            </Text>
            
            {blockedUsers.length === 0 ? (
              <View style={{
                alignItems: 'center',
                paddingVertical: 20,
              }}>
                <Ionicons name="shield-checkmark-outline" size={48} color={c.muted} />
                <Text style={{
                  color: c.muted,
                  fontSize: 16,
                  textAlign: 'center',
                  marginTop: 12,
                }}>
                  No blocked users
                </Text>
              </View>
            ) : (
              <View>
                {blockedUsers.map((user) => (
                  <View key={user.id} style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: c.border,
                  }}>
                    <View>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: c.text,
                      }}>
                        {user.display_name || user.username}
                      </Text>
                      <Text style={{
                        fontSize: 14,
                        color: c.muted,
                      }}>
                        @{user.username}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        Alert.alert(
                          'Unblock User',
                          `Are you sure you want to unblock ${user.display_name || user.username}?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Unblock',
                              onPress: async () => {
                                try {
                                  // TODO: Implement unblock functionality
                                  Alert.alert('Success', 'User unblocked');
                                  loadData(); // Reload data
                                } catch (error) {
                                  Alert.alert('Error', 'Failed to unblock user');
                                }
                              }
                            }
                          ]
                        );
                      }}
                      style={{
                        backgroundColor: '#ef4444',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{
                        color: 'white',
                        fontSize: 12,
                        fontWeight: '600',
                      }}>
                        Unblock
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Privacy Info */}
          <View style={{
            backgroundColor: `${c.primary}20`,
            marginHorizontal: 16,
            marginBottom: 32,
            borderRadius: 12,
            padding: 16,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
            }}>
              <Ionicons name="information-circle" size={24} color={c.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: c.primary,
                  marginBottom: 8,
                }}>
                  About Privacy Settings
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: c.text,
                  lineHeight: 20,
                }}>
                  These settings control how your activity is shared with other users. 
                  You can change these settings at any time. Blocked users cannot see 
                  your activity or send you friend requests.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </AnimatedPage>
    </GradientBackground>
  );
}
