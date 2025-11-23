import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  Share,
  useWindowDimensions,
} from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import { 
  searchUsersByUsername, 
  sendFriendRequest, 
  generateFriendInviteLink,
  checkUsernameAvailability 
} from '@/services/friends';
import { blockUser, getBlockStatus } from '@/services/blocking';
import { followUser, unfollowUser, isFollowing } from '@/services/following';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '@/components/Avatar';
import type { FriendSearchResult } from '@/types/models';

export default function SearchUsers() {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [inviteLink, setInviteLink] = useState<string>('');

  // Load current user info
  useEffect(() => {
    const loadUser = async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        router.replace('/onboarding/welcome');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      setCurrentUser(userData);

      // Generate invite link if user has username
      if (userData?.username) {
        try {
          const link = await generateFriendInviteLink();
          setInviteLink(link);
        } catch (error) {
          console.error('Error generating invite link:', error);
        }
      }
    };

    loadUser();
  }, []);

  // Debounced search function
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const results = await searchUsersByUsername(query.trim(), 20);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Failed to search users');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  const handleSendFriendRequest = async (username: string) => {
    try {
      await sendFriendRequest(username);
      Alert.alert('Success', 'Friend request sent!');
      // Refresh search results
      await searchUsers(searchQuery);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send friend request');
    }
  };

  const handleFollow = async (userId: string) => {
    try {
      const isCurrentlyFollowing = await isFollowing(userId);
      if (isCurrentlyFollowing) {
        await unfollowUser(userId);
        Alert.alert('Success', 'Unfollowed user');
      } else {
        await followUser(userId);
        Alert.alert('Success', 'Following user');
      }
      // Refresh search results
      await searchUsers(searchQuery);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update follow status');
    }
  };

  const handleBlock = async (username: string) => {
    Alert.alert(
      'Block User',
      'Are you sure you want to block this user? This will remove any existing friendship.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(username);
              Alert.alert('Success', 'User blocked');
              // Refresh search results
              await searchUsers(searchQuery);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to block user');
            }
          }
        }
      ]
    );
  };

  const handleShareInviteLink = async () => {
    if (!inviteLink) return;
    
    try {
      await Share.share({
        message: `Join me on Picky! ${inviteLink}`,
        url: inviteLink,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const goToFriendsTab = () => {
    router.push({
      pathname: '/(tabs)/groups',
      params: { tab: 'friends' },
    });
  };

  const renderUserItem = ({ item }: { item: FriendSearchResult }) => {
    const isOrganization = item.account_type === 'organization';
    const status = item.friendship_status;
    const isFriend = item.is_friend || status === 'accepted';
    const isPendingOutgoing = status === 'pending_outgoing';
    const isPendingIncoming = status === 'pending_incoming';
    
    return (
      <View style={{
        backgroundColor: c.card,
        marginHorizontal: 16,
        marginBottom: 8,
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Avatar
            uri={item.avatar_url}
            size={40}
          />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '600', fontSize: 16 }}>
              {item.display_name || item.username}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14 }}>
              @{item.username}
              {isOrganization && ' • Organization'}
            </Text>
          </View>
        </View>
        
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {item.is_blocked ? (
            <Pressable
              onPress={() => handleBlock(item.username)}
              style={{
                backgroundColor: '#ef4444',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 12 }}>
                Unblock
              </Text>
            </Pressable>
          ) : (
            <>
              {isOrganization ? (
                <Pressable
                  onPress={() => handleFollow(item.id)}
                  style={{
                    backgroundColor: c.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 12 }}>
                    Follow
                  </Text>
                </Pressable>
              ) : isFriend ? (
                <Text style={{ color: c.muted, fontSize: 12 }}>Friends</Text>
              ) : isPendingIncoming ? (
                <Pressable
                  onPress={goToFriendsTab}
                  style={{
                    backgroundColor: c.card,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: c.primary,
                  }}
                >
                  <Text style={{ color: c.primary, fontWeight: '600', fontSize: 12 }}>
                    Respond
                  </Text>
                </Pressable>
              ) : isPendingOutgoing ? (
                <View
                  style={{
                    backgroundColor: c.card,
                    borderWidth: 1,
                    borderColor: c.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: c.primary, fontWeight: '600', fontSize: 12 }}>
                    Sent
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => handleSendFriendRequest(item.username)}
                  style={{
                    backgroundColor: c.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 12 }}>
                    Add Friend
                  </Text>
                </Pressable>
              )}
              
              <Pressable
                onPress={() => handleBlock(item.username)}
                style={{
                  backgroundColor: c.muted,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  borderRadius: 8,
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={12} color={c.text} />
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <GradientBackground>
      <AnimatedPage>
        <View style={{ flex: 1, paddingTop: 16 }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
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
              Find Friends
            </Text>
          </View>

          {/* Search Input */}
          <View style={{
            backgroundColor: c.card,
            marginHorizontal: 16,
            marginBottom: 16,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
          }}>
            <Ionicons name="search" size={20} color={c.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by username..."
              placeholderTextColor={c.muted}
              style={{
                flex: 1,
                padding: 16,
                color: c.text,
                fontSize: 16,
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {loading && <ActivityIndicator size="small" color={c.primary} />}
          </View>

          {/* Invite Friends Section */}
          {inviteLink && (
            <View style={{
              backgroundColor: c.card,
              marginHorizontal: 16,
              marginBottom: 16,
              padding: 16,
              borderRadius: 12,
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: c.text,
                marginBottom: 8,
              }}>
                Invite Friends
              </Text>
              <Text style={{
                fontSize: 14,
                color: c.muted,
                marginBottom: 12,
              }}>
                Share your friend link to let others add you easily
              </Text>
              <Pressable
                onPress={handleShareInviteLink}
                style={{
                  backgroundColor: c.primary,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="share" size={16} color="white" />
                <Text style={{ color: 'white', fontWeight: '600' }}>
                  Share Invite Link
                </Text>
              </Pressable>
            </View>
          )}

          {/* Search Results */}
          {searchQuery.trim() && (
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: c.text,
                marginHorizontal: 16,
                marginBottom: 12,
              }}>
                Search Results ({searchResults.length})
              </Text>
              
              {searchResults.length === 0 && !loading ? (
                <View style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 40,
                }}>
                  <Ionicons name="search-outline" size={64} color={c.muted} />
                  <Text style={{
                    color: c.muted,
                    fontSize: 16,
                    textAlign: 'center',
                    marginTop: 16,
                    marginHorizontal: 32,
                  }}>
                    No users found with that username. Try a different search term.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  renderItem={renderUserItem}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          )}

          {/* Empty State */}
          {!searchQuery.trim() && (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 40,
              flex: 1,
            }}>
              <Ionicons name="people-outline" size={64} color={c.muted} />
              <Text style={{
                color: c.muted,
                fontSize: 16,
                textAlign: 'center',
                marginTop: 16,
                marginHorizontal: 32,
              }}>
                Search for friends by their username or share your invite link to let others find you!
              </Text>
            </View>
          )}
        </View>
      </AnimatedPage>
    </GradientBackground>
  );
}
