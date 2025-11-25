import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  TextInput,
  Modal,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Share,
} from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { GroupsBenefitsEmptyState } from '@/components/GroupsBenefitsEmptyState';
import { supabase } from '@/services/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { getMyGroups, createGroup, joinGroupByCode } from '@/services/groups';
import {
  getUserFriends,
  getPendingFriendRequests,
  respondToFriendRequest,
  removeFriend,
  type PendingFriendRequest,
} from '@/services/friends';
import { getFollowing, discoverOrganizations, followUser, unfollowUser } from '@/services/following';
import { useGroupDecisionNotification } from '@/utils/GroupDecisionNotificationContext';
import { useFriendNotification } from '@/utils/FriendNotificationContext';
import { Ionicons } from '@expo/vector-icons';
import FriendPicker from '@/components/FriendPicker';
import Avatar from '@/components/Avatar';
import type { UserProfile, Group } from '@/types/models';
import { blockUser } from '@/services/blocking';
import * as Clipboard from 'expo-clipboard';
import { Typography, Spacing, BorderRadius } from '@/theme/designTokens';

type TabType = 'friends' | 'following' | 'groups';
const FRIEND_TABS: TabType[] = ['friends', 'following', 'groups'];
const FRIEND_BADGE_COLOR = '#EF4444';

const parseTabParam = (value: string | string[] | undefined): TabType | null => {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (normalized === 'friends' || normalized === 'following' || normalized === 'groups') {
    return normalized;
  }
  return null;
};

export default function Groups() {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const params = useLocalSearchParams<{ tab?: string }>();
  const { hasNewGroupDecisions } = useGroupDecisionNotification();
  const { hasNewFriends, recordFriendSnapshot, markFriendsViewed } = useFriendNotification();
  
  // Tab state
  // Default to groups tab unless deep link specifies otherwise
  const [activeTab, setActiveTab] = useState<TabType>(() => parseTabParam(params.tab) ?? 'groups');
  
  // Friends state
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [friendRequests, setFriendRequests] = useState<PendingFriendRequest[]>([]);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [friendActionTarget, setFriendActionTarget] = useState<UserProfile | null>(null);
  const [showFriendActions, setShowFriendActions] = useState(false);
  const [showGroupInviteModal, setShowGroupInviteModal] = useState(false);
  
  // Following state
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [organizations, setOrganizations] = useState<UserProfile[]>([]);
  
  // Groups state
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<UserProfile[]>([]);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  
  const createAnim = useRef(new Animated.Value(0)).current;
  const joinAnim = useRef(new Animated.Value(0)).current;

  // Load data functions
  const loadFriends = useCallback(async () => {
    try {
      const [friendsData, requestsData] = await Promise.all([
        getUserFriends(),
        getPendingFriendRequests(),
      ]);
      setFriends(friendsData);
      setFriendRequests(requestsData);
      setFriendsLoaded(true);
      await recordFriendSnapshot(friendsData.length, requestsData.length);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  }, [recordFriendSnapshot]);

  const loadFollowing = useCallback(async () => {
    try {
      const [followingData, orgsData] = await Promise.all([
        getFollowing(),
        discoverOrganizations(10)
      ]);
      setFollowing(followingData);
      setOrganizations(orgsData);
    } catch (error) {
      console.error('Error loading following:', error);
    }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const data = await getMyGroups();
      setGroups(data);
      return data;
    } catch (error) {
      console.error('Error loading groups:', error);
      return [];
    }
  }, []);

  // Keep tab in sync with ?tab= query param
  useEffect(() => {
    const resolved = parseTabParam(params.tab);
    if (resolved && resolved !== activeTab) {
      setActiveTab(resolved);
    }
  }, [params.tab, activeTab]);

  // Load friends once on mount so badge state stays fresh
  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  // Load data based on active tab
  useEffect(() => {
    const checkAuth = async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        router.replace('/onboarding/welcome');
        return;
      }

      switch (activeTab) {
        case 'friends':
          await loadFriends();
          break;
        case 'following':
          await loadFollowing();
          break;
        case 'groups':
          await loadGroups();
          break;
      }
    };

    checkAuth();
  }, [activeTab, loadFriends, loadFollowing, loadGroups]);

  // Clear friend notification when user views the friends tab
  useEffect(() => {
    if (friendsLoaded && activeTab === 'friends') {
      markFriendsViewed(friends.length).catch(() => {});
    }
  }, [friendsLoaded, activeTab, friends.length, markFriendsViewed]);

  // Handle friend request response
  const handleFriendRequest = async (requestId: number, response: 'accepted' | 'declined') => {
    try {
      await respondToFriendRequest(requestId, response);
      await loadFriends(); // Reload friends data
      Alert.alert('Success', `Friend request ${response}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to respond to friend request');
    }
  };

  const openFriendActions = (friend: UserProfile) => {
    setFriendActionTarget(friend);
    setShowFriendActions(true);
  };

  const closeFriendActions = (resetTarget: boolean = false) => {
    setShowFriendActions(false);
    if (resetTarget) {
      setFriendActionTarget(null);
    }
  };

  const ensureGroupsAvailable = useCallback(async (): Promise<Group[]> => {
    if (groups.length > 0) return groups;
    const latest = await loadGroups();
    return latest ?? [];
  }, [groups, loadGroups]);

  const handleStartGroupInviteFlow = useCallback(async () => {
    if (!friendActionTarget) return;
    closeFriendActions();
    const availableGroups = await ensureGroupsAvailable();
    if (!availableGroups || availableGroups.length === 0) {
      Alert.alert(
        'No groups yet',
        'Create a group first, then you can share its invite code with friends.',
      );
      return;
    }
    setShowGroupInviteModal(true);
  }, [friendActionTarget, ensureGroupsAvailable]);

  const handleSelectGroupForFriend = useCallback(
    async (group: Group) => {
      if (!friendActionTarget) return;
      if (!group.invite_code) {
        Alert.alert(
          'Missing invite code',
          'This group does not have an invite code yet. Regenerate one from the group details screen.',
        );
        return;
      }
      const friendName =
        friendActionTarget.display_name || friendActionTarget.username || 'your friend';
      const message = `Hey ${friendName}! Join my "${group.name}" group on Picky with invite code ${group.invite_code}.`;
      try {
        await Share.share({ message });
      } catch (error) {
        try {
          await Clipboard.setStringAsync(message);
          Alert.alert('Invite copied', 'We copied the invite text to your clipboard.');
        } catch {
          Alert.alert('Error', 'Unable to share the invite right now.');
        }
      } finally {
        setShowGroupInviteModal(false);
        setFriendActionTarget(null);
      }
    },
    [friendActionTarget],
  );

  const handleStartNewGroupWithFriend = () => {
    if (!friendActionTarget) return;
    setSelectedFriends([friendActionTarget]);
    setShowCreate(true);
    closeFriendActions(true);
  };

  const confirmRemoveFriend = () => {
    if (!friendActionTarget) return;
    const friendName = friendActionTarget.display_name || friendActionTarget.username || 'friend';
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friendName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFriend(friendActionTarget.id);
              await loadFriends();
              Alert.alert('Removed', `${friendName} has been removed from your friends.`);
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to remove friend.');
            } finally {
              setFriendActionTarget(null);
            }
          },
        },
      ],
      { cancelable: true },
    );
    closeFriendActions();
  };

  const confirmBlockFriend = () => {
    if (!friendActionTarget || !friendActionTarget.username) {
      Alert.alert('Error', 'Unable to block this user right now.');
      return;
    }
    const friendName = friendActionTarget.display_name || friendActionTarget.username;
    Alert.alert(
      'Block User',
      `Blocking ${friendName} will remove your friendship and hide future activity. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(friendActionTarget.username!);
              await loadFriends();
              Alert.alert('Blocked', `${friendName} will no longer be able to interact with you.`);
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to block user.');
            } finally {
              setFriendActionTarget(null);
            }
          },
        },
      ],
      { cancelable: true },
    );
    closeFriendActions();
  };

  // Group creation functions (from original groups.tsx)
  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    setCreating(true);
    try {
      const result = await createGroup(groupName.trim());
      
      // If friends are selected, invite them to the group
      if (selectedFriends.length > 0) {
        // TODO: Implement group member invitation
        // For now, we'll just show a message about the selected friends
        const friendNames = selectedFriends.map(f => f.display_name || f.username).join(', ');
        Alert.alert(
          'Group Created!', 
          `Group created successfully! You can share the invite code with ${friendNames} to add them to the group.`
        );
      } else {
        Alert.alert('Success', 'Group created successfully!');
      }
      
      // Reset form
      setGroupName('');
      setSelectedFriends([]);
      setShowCreate(false);
      await loadGroups();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) return;
    setJoining(true);
    try {
      await joinGroupByCode(inviteCode.trim());
      setInviteCode('');
      setShowJoin(false);
      await loadGroups();
      Alert.alert('Success', 'Joined group successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  const handleFollow = async (userId: string) => {
    try {
      const isFollowing = following.some(f => f.id === userId);
      if (isFollowing) {
        await unfollowUser(userId);
        Alert.alert('Success', 'Unfollowed organization');
      } else {
        await followUser(userId);
        Alert.alert('Success', 'Following organization');
      }
      await loadFollowing();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update follow status');
    }
  };

  // Tab header component
  const TabHeader = () => (
    <View style={{
      flexDirection: 'row',
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 4,
      marginHorizontal: 16,
      marginBottom: 16,
    }}>
      {FRIEND_TABS.map((tab) => {
        const showBadge = tab === 'friends' && hasNewFriends;
        return (
        <Pressable
          key={tab}
          onPress={() => setActiveTab(tab)}
          style={{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 8,
            backgroundColor: activeTab === tab ? c.primary : 'transparent',
            alignItems: 'center',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{
              color: activeTab === tab ? 'white' : c.text,
              fontWeight: activeTab === tab ? '600' : '400',
              fontSize: 16,
              textTransform: 'capitalize',
            }}>
              {tab}
            </Text>
            {showBadge && (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: FRIEND_BADGE_COLOR,
                }}
              />
            )}
          </View>
        </Pressable>
      );
      })}
    </View>
  );

  // Friends section component
  const FriendsSection = () => (
    <View style={{ flex: 1 }}>
      {/* Add Friends Button */}
      <Pressable
        onPress={() => router.push('/search-users')}
        style={{
          backgroundColor: c.primary,
          marginHorizontal: 16,
          marginBottom: 16,
          paddingVertical: 12,
          paddingHorizontal: 20,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Ionicons name="person-add" size={20} color="white" />
        <Text style={{ 
          color: 'white', 
          fontWeight: Typography.fontWeight.semibold,
          fontSize: Typography.scale.bodyLarge.fontSize,
          fontFamily: Typography.fontFamily.bodySemibold,
        }}>
          Add Friends
        </Text>
      </Pressable>

      {/* Friend Requests */}
      {friendRequests.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{
            fontSize: Typography.scale.heading3.fontSize,
            lineHeight: Typography.scale.heading3.lineHeight,
            fontFamily: Typography.fontFamily.bodySemibold,
            fontWeight: Typography.fontWeight.semibold,
            color: c.text,
            marginHorizontal: 16,
            marginBottom: 12,
          }}>
            Friend Requests ({friendRequests.length})
          </Text>
          {friendRequests.map((request) => (
            <View key={request.id} style={{
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
                  uri={request.requester.avatar_url}
                  size={40}
                />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ 
                    color: c.text, 
                    fontWeight: Typography.fontWeight.semibold,
                    fontSize: Typography.scale.bodyLarge.fontSize,
                    fontFamily: Typography.fontFamily.bodySemibold,
                  }}>
                    {request.requester.display_name || request.requester.username}
                  </Text>
                  <Text style={{ 
                    color: c.muted, 
                    fontSize: Typography.scale.body.fontSize,
                    fontFamily: Typography.fontFamily.body,
                  }}>
                    @{request.requester.username}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => handleFriendRequest(request.id, 'accepted')}
                  style={{
                    backgroundColor: c.primary,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '600' }}>Accept</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleFriendRequest(request.id, 'declined')}
                  style={{
                    backgroundColor: c.muted,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '600' }}>Decline</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Friends List */}
      <Text style={{
        fontSize: 18,
        fontWeight: '600',
        color: c.text,
        marginHorizontal: 16,
        marginBottom: 12,
      }}>
        Friends ({friends.length})
      </Text>
      
      {friends.length === 0 ? (
        <View style={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 40,
        }}>
          <Ionicons name="people-outline" size={64} color={c.muted} />
          <Text style={{
            color: c.muted,
            fontSize: 16,
            textAlign: 'center',
            marginTop: 16,
            marginHorizontal: 32,
          }}>
            No friends yet. Add some friends to see their activity on events and restaurants!
          </Text>
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openFriendActions(item)}
              style={{
                backgroundColor: c.card,
                marginHorizontal: 16,
                marginBottom: 8,
                padding: 16,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Avatar
                  uri={item.avatar_url}
                  size={40}
                />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ 
                    color: c.text, 
                    fontWeight: Typography.fontWeight.semibold,
                    fontSize: Typography.scale.bodyLarge.fontSize,
                    fontFamily: Typography.fontFamily.bodySemibold,
                  }}>
                    {item.display_name || item.username}
                  </Text>
                  <Text style={{ 
                    color: c.muted, 
                    fontSize: Typography.scale.body.fontSize,
                    fontFamily: Typography.fontFamily.body,
                  }}>
                    @{item.username}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => openFriendActions(item)}
                hitSlop={10}
                style={{ padding: 4 }}
              >
                <Ionicons name="chevron-forward" size={20} color={c.muted} />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </View>
  );

  // Following section component
  const FollowingSection = () => (
    <View style={{ flex: 1 }}>
      {/* Following List */}
      <Text style={{
        fontSize: 18,
        fontWeight: '600',
        color: c.text,
        marginHorizontal: 16,
        marginBottom: 12,
      }}>
        Following ({following.length})
      </Text>
      
      {following.length === 0 ? (
        <View style={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 40,
        }}>
          <Ionicons name="business-outline" size={64} color={c.muted} />
          <Text style={{
            color: c.muted,
            fontSize: 16,
            textAlign: 'center',
            marginTop: 16,
            marginHorizontal: 32,
          }}>
            Not following any organizations yet. Discover organizations to follow their events!
          </Text>
        </View>
      ) : (
        <FlatList
          data={following}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={{
                backgroundColor: c.card,
                marginHorizontal: 16,
                marginBottom: 8,
                padding: 16,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
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
                    @{item.username} • Organization
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={c.muted} />
            </Pressable>
          )}
        />
      )}

      {/* Discover Organizations */}
      {organizations.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <Text style={{
            fontSize: Typography.scale.heading3.fontSize,
            lineHeight: Typography.scale.heading3.lineHeight,
            fontFamily: Typography.fontFamily.bodySemibold,
            fontWeight: Typography.fontWeight.semibold,
            color: c.text,
            marginHorizontal: 16,
            marginBottom: 12,
          }}>
            Discover Organizations
          </Text>
          <FlatList
            data={organizations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isFollowing = following.some(f => f.id === item.id);
              return (
                <Pressable
                  style={{
                    backgroundColor: c.card,
                    marginHorizontal: 16,
                    marginBottom: 8,
                    padding: 16,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
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
                        @{item.username} • Organization
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => handleFollow(item.id)}
                    style={{
                      backgroundColor: isFollowing ? 'transparent' : c.primary,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                      borderWidth: isFollowing ? 1 : 0,
                      borderColor: c.primary,
                    }}
                  >
                    <Text style={{ 
                      color: isFollowing ? c.primary : 'white', 
                      fontWeight: '600' 
                    }}>
                      {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </Pressable>
                </Pressable>
              );
            }}
          />
        </View>
      )}
    </View>
  );

  // Groups section component (simplified from original)
  const GroupsSection = () => (
    <View style={{ flex: 1 }}>
      {/* Create/Join Group Buttons */}
      <View style={{
        flexDirection: isWide ? 'row' : 'column',
        gap: 12,
        marginHorizontal: 16,
        marginBottom: 16,
      }}>
        <Pressable
          onPress={() => setShowCreate(true)}
          style={{
            backgroundColor: c.primary,
            flex: isWide ? 1 : undefined,
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Ionicons name="add" size={20} color="white" />
          <Text style={{ 
            color: 'white', 
            fontWeight: Typography.fontWeight.semibold,
            fontSize: Typography.scale.bodyLarge.fontSize,
            fontFamily: Typography.fontFamily.bodySemibold,
          }}>
            Create Group
          </Text>
        </Pressable>
        
        <Pressable
          onPress={() => setShowJoin(true)}
          style={{
            backgroundColor: c.card,
            flex: isWide ? 1 : undefined,
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderWidth: 1,
            borderColor: c.muted,
          }}
        >
          <Ionicons name="enter" size={20} color={c.text} />
          <Text style={{ color: c.text, fontWeight: '600', fontSize: 16 }}>
            Join Group
          </Text>
        </Pressable>
      </View>

      {/* Groups List */}
      <Text style={{
        fontSize: 18,
        fontWeight: '600',
        color: c.text,
        marginHorizontal: 16,
        marginBottom: 12,
      }}>
        My Groups ({groups.length})
      </Text>
      
      {groups.length === 0 ? (
        <GroupsBenefitsEmptyState />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/groups/${item.id}`)}
              style={{
                backgroundColor: c.card,
                marginHorizontal: 16,
                marginBottom: 8,
                padding: 16,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Text style={{ color: c.text, fontWeight: '600', fontSize: 16 }}>
                  {item.name}
                </Text>
                <Text style={{ color: c.muted, fontSize: 14 }}>
                  Code: {item.invite_code}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={c.muted} />
            </Pressable>
          )}
        />
      )}

      {/* Create Group Modal */}
      <Modal visible={showCreate} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View style={{
            backgroundColor: c.background,
            margin: 20,
            padding: 20,
            borderRadius: 16,
            width: '90%',
            maxWidth: 400,
          }}>
            <Text style={{
              fontSize: Typography.scale.heading2.fontSize,
              lineHeight: Typography.scale.heading2.lineHeight,
              fontFamily: Typography.fontFamily.bodySemibold,
              fontWeight: Typography.fontWeight.semibold,
              color: c.text,
              marginBottom: 16,
              textAlign: 'center',
            }}>
              Create New Group
            </Text>
            
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Group name"
              placeholderTextColor={c.muted}
              style={{
                backgroundColor: c.card,
                padding: 16,
                borderRadius: 12,
                color: c.text,
                marginBottom: 16,
              }}
            />
            
            {/* Friend Picker Button */}
            <Pressable
              onPress={() => setShowFriendPicker(true)}
              style={{
                backgroundColor: c.card,
                padding: 16,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
                borderWidth: 1,
                borderColor: c.muted,
              }}
            >
              <View>
                <Text style={{ color: c.text, fontWeight: '600', fontSize: 16 }}>
                  Invite Friends
                </Text>
                <Text style={{ color: c.muted, fontSize: 14 }}>
                  {selectedFriends.length === 0 
                    ? 'Select friends to invite' 
                    : `${selectedFriends.length} friend${selectedFriends.length !== 1 ? 's' : ''} selected`
                  }
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={c.muted} />
            </Pressable>
            
            {/* Selected Friends Preview */}
            {selectedFriends.length > 0 && (
              <View style={{
                backgroundColor: `${c.primary}20`,
                padding: 12,
                borderRadius: 8,
                marginBottom: 16,
              }}>
                <Text style={{ 
                  color: c.primary, 
                  fontSize: Typography.scale.bodySmall.fontSize,
                  fontFamily: Typography.fontFamily.bodySemibold,
                  fontWeight: Typography.fontWeight.semibold,
                  marginBottom: 4,
                }}>
                  SELECTED FRIENDS
                </Text>
                {selectedFriends.slice(0, 3).map((friend, index) => (
                  <Text key={friend.id} style={{ color: c.text, fontSize: 14 }}>
                    {friend.display_name || friend.username}
                  </Text>
                ))}
                {selectedFriends.length > 3 && (
                  <Text style={{ color: c.muted, fontSize: 14 }}>
                    +{selectedFriends.length - 3} more
                  </Text>
                )}
              </View>
            )}
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setShowCreate(false)}
                style={{
                  flex: 1,
                  backgroundColor: c.card,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: c.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              
              <Pressable
                onPress={handleCreateGroup}
                disabled={creating || !groupName.trim()}
                style={{
                  flex: 1,
                  backgroundColor: creating || !groupName.trim() ? c.muted : c.primary,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '600' }}>
                  {creating ? 'Creating...' : 'Create'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Join Group Modal */}
      <Modal visible={showJoin} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View style={{
            backgroundColor: c.background,
            margin: 20,
            padding: 20,
            borderRadius: 16,
            width: '90%',
            maxWidth: 400,
          }}>
            <Text style={{
              fontSize: Typography.scale.heading2.fontSize,
              lineHeight: Typography.scale.heading2.lineHeight,
              fontFamily: Typography.fontFamily.bodySemibold,
              fontWeight: Typography.fontWeight.semibold,
              color: c.text,
              marginBottom: 16,
              textAlign: 'center',
            }}>
              Join Group
            </Text>
            
            <TextInput
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholder="Enter invite code"
              placeholderTextColor={c.muted}
              style={{
                backgroundColor: c.card,
                padding: 16,
                borderRadius: 12,
                color: c.text,
                marginBottom: 16,
              }}
            />
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setShowJoin(false)}
                style={{
                  flex: 1,
                  backgroundColor: c.card,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: c.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              
              <Pressable
                onPress={handleJoinGroup}
                disabled={joining || !inviteCode.trim()}
                style={{
                  flex: 1,
                  backgroundColor: joining || !inviteCode.trim() ? c.muted : c.primary,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '600' }}>
                  {joining ? 'Joining...' : 'Join'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'friends':
        return <FriendsSection />;
      case 'following':
        return <FollowingSection />;
      case 'groups':
        return <GroupsSection />;
      default:
        return <FriendsSection />;
    }
  };

  return (
    <GradientBackground>
      <AnimatedPage>
        <View style={{ flex: 1, paddingTop: 16 }}>
          <TabHeader />
          {renderContent()}
        </View>

        {/* Friend actions sheet */}
        {friendActionTarget && (
          <Modal visible={showFriendActions} transparent animationType="fade">
            <View
              style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.5)',
                justifyContent: 'flex-end',
              }}
            >
              <Pressable style={{ flex: 1 }} onPress={() => closeFriendActions()}>
                <View />
              </Pressable>
              <View
                style={{
                  backgroundColor: c.background,
                  padding: 20,
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  gap: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: c.text,
                    marginBottom: 4,
                  }}
                >
                  Manage {friendActionTarget.display_name || friendActionTarget.username}
                </Text>

                <Pressable
                  onPress={handleStartGroupInviteFlow}
                  style={{
                    backgroundColor: c.card,
                    padding: 14,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <Ionicons name="people-outline" size={20} color={c.text} />
                  <Text style={{ 
                    color: c.text, 
                    fontWeight: Typography.fontWeight.semibold,
                    fontSize: Typography.scale.bodyLarge.fontSize,
                    fontFamily: Typography.fontFamily.bodySemibold,
                  }}>
                    Add to existing group
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleStartNewGroupWithFriend}
                  style={{
                    backgroundColor: c.card,
                    padding: 14,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <Ionicons name="add-circle-outline" size={20} color={c.text} />
                  <Text style={{ color: c.text, fontWeight: '600', fontSize: 16 }}>
                    Start a new group together
                  </Text>
                </Pressable>

                <Pressable
                  onPress={confirmRemoveFriend}
                  style={{
                    backgroundColor: c.card,
                    padding: 14,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <Ionicons name="person-remove-outline" size={20} color={c.muted} />
                  <Text style={{ color: c.text, fontWeight: '600', fontSize: 16 }}>
                    Remove friend
                  </Text>
                </Pressable>

                <Pressable
                  onPress={confirmBlockFriend}
                  style={{
                    backgroundColor: FRIEND_BADGE_COLOR,
                    padding: 14,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <Ionicons name="ban-outline" size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                    Block user
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => closeFriendActions(true)}
                  style={{
                    marginTop: 4,
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: c.card,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '600' }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        )}

        {/* Group invite modal */}
        {friendActionTarget && (
          <Modal visible={showGroupInviteModal} transparent animationType="slide">
            <View
              style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.5)',
                justifyContent: 'flex-end',
              }}
            >
              <Pressable
                style={{ flex: 1 }}
                onPress={() => {
                  setShowGroupInviteModal(false);
                  setFriendActionTarget(null);
                }}
              >
                <View />
              </Pressable>
              <View
                style={{
                  backgroundColor: c.background,
                  padding: 20,
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  maxHeight: '70%',
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: c.text,
                    marginBottom: 12,
                  }}
                >
                  Invite {friendActionTarget.display_name || friendActionTarget.username} to a group
                </Text>

                {groups.length === 0 ? (
                  <Text style={{ color: c.muted, marginBottom: 12 }}>
                    You don't have any groups yet. Create one to start inviting friends.
                  </Text>
                ) : (
                  <FlatList
                    data={groups}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                      <Pressable
                        onPress={() => handleSelectGroupForFriend(item)}
                        style={{
                          backgroundColor: c.card,
                          padding: 16,
                          borderRadius: 12,
                          marginBottom: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <View>
                          <Text style={{ color: c.text, fontWeight: '600', fontSize: 16 }}>
                            {item.name}
                          </Text>
                          <Text style={{ color: c.muted, fontSize: 12 }}>
                            Code: {item.invite_code ?? 'Tap to generate'}
                          </Text>
                        </View>
                        <Ionicons name="send-outline" size={18} color={c.primary} />
                      </Pressable>
                    )}
                    contentContainerStyle={{ paddingBottom: 12 }}
                    showsVerticalScrollIndicator={false}
                  />
                )}

                <Pressable
                  onPress={() => {
                    setShowGroupInviteModal(false);
                    setFriendActionTarget(null);
                  }}
                  style={{
                    marginTop: 8,
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: c.card,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '600' }}>Done</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        )}

        {/* Friend Picker Modal */}
        <FriendPicker
          visible={showFriendPicker}
          onClose={() => setShowFriendPicker(false)}
          onSelectFriends={setSelectedFriends}
          selectedFriends={selectedFriends}
          title="Invite Friends to Group"
          multiSelect={true}
        />
      </AnimatedPage>
    </GradientBackground>
  );
}