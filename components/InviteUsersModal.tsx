import { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/theme/ThemeProvider';
import Avatar from '@/components/Avatar';
import type { UserProfile } from '@/types/models';
import type { EventInvite } from '@/services/organizer';
import { searchUsersToInvite, inviteUsersToEvent, getEventInvites } from '@/services/organizer';

// User row for search results
interface UserRowProps {
  user: UserProfile;
  isSelected: boolean;
  isAlreadyInvited: boolean;
  onToggle: (userId: string) => void;
}

const UserRow = memo(function UserRow({
  user,
  isSelected,
  isAlreadyInvited,
  onToggle,
}: UserRowProps) {
  const c = useThemeColors();
  const displayName = user.display_name || user.username || 'Unknown';

  return (
    <Pressable
      onPress={() => !isAlreadyInvited && onToggle(user.id)}
      disabled={isAlreadyInvited}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: isSelected ? `${c.primary}15` : c.card,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: isSelected ? 2 : 0,
        borderColor: isSelected ? c.primary : 'transparent',
        opacity: isAlreadyInvited ? 0.5 : 1,
      }}
    >
      <Avatar uri={user.avatar_url} size={44} />
      
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>
          {displayName}
        </Text>
        {user.username && (
          <Text style={{ color: c.muted, fontSize: 13 }}>@{user.username}</Text>
        )}
      </View>

      {isAlreadyInvited ? (
        <View style={{
          backgroundColor: c.muted + '30',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
        }}>
          <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>
            Invited
          </Text>
        </View>
      ) : (
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
          {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      )}
    </Pressable>
  );
});

// Invited user row showing invite status
interface InvitedUserRowProps {
  invite: EventInvite;
  onRevoke?: (id: number) => void;
}

const InvitedUserRow = memo(function InvitedUserRow({
  invite,
  onRevoke,
}: InvitedUserRowProps) {
  const c = useThemeColors();
  const user = invite.invited_user;
  const displayName = user?.display_name || user?.username || 'Unknown';

  const statusColors = {
    pending: { bg: '#f59e0b20', text: '#f59e0b' },
    accepted: { bg: '#10b98120', text: '#10b981' },
    declined: { bg: '#ef444420', text: '#ef4444' },
  };

  const colors = statusColors[invite.status];

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: c.card,
      borderRadius: 12,
      marginBottom: 8,
    }}>
      <Avatar uri={user?.avatar_url} size={40} />
      
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>
          {displayName}
        </Text>
        {user?.username && (
          <Text style={{ color: c.muted, fontSize: 12 }}>@{user.username}</Text>
        )}
      </View>

      <View style={{
        backgroundColor: colors.bg,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
      }}>
        <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' }}>
          {invite.status}
        </Text>
      </View>

      {invite.status === 'pending' && onRevoke && (
        <Pressable
          onPress={() => onRevoke(invite.id)}
          style={{
            marginLeft: 8,
            padding: 6,
            backgroundColor: '#ef444420',
            borderRadius: 6,
          }}
        >
          <Ionicons name="close" size={14} color="#ef4444" />
        </Pressable>
      )}
    </View>
  );
});

// Main modal component
interface InviteUsersModalProps {
  visible: boolean;
  onClose: () => void;
  eventId: number;
  onInvitesSent?: () => void;
}

export default function InviteUsersModal({
  visible,
  onClose,
  eventId,
  onInvitesSent,
}: InviteUsersModalProps) {
  const c = useThemeColors();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [existingInvites, setExistingInvites] = useState<EventInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'invited'>('search');

  // Load existing invites when modal opens
  useEffect(() => {
    if (visible) {
      loadExistingInvites();
    } else {
      // Reset state when closing
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUsers([]);
    }
  }, [visible, eventId]);

  const loadExistingInvites = async () => {
    setLoading(true);
    try {
      const invites = await getEventInvites(eventId);
      setExistingInvites(invites);
    } catch (error) {
      console.error('Error loading invites:', error);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchUsersToInvite(eventId, searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, eventId]);

  const toggleUser = useCallback((userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  }, []);

  const handleSendInvites = async () => {
    if (selectedUsers.length === 0) return;

    setSending(true);
    try {
      await inviteUsersToEvent(eventId, selectedUsers);
      setSelectedUsers([]);
      setSearchQuery('');
      setSearchResults([]);
      await loadExistingInvites();
      onInvitesSent?.();
      setActiveTab('invited');
    } catch (error) {
      console.error('Error sending invites:', error);
    } finally {
      setSending(false);
    }
  };

  const invitedUserIds = existingInvites.map(i => i.invited_user_id);

  const renderSearchItem = useCallback(({ item }: { item: UserProfile }) => (
    <UserRow
      user={item}
      isSelected={selectedUsers.includes(item.id)}
      isAlreadyInvited={invitedUserIds.includes(item.id)}
      onToggle={toggleUser}
    />
  ), [selectedUsers, invitedUserIds, toggleUser]);

  const renderInviteItem = useCallback(({ item }: { item: EventInvite }) => (
    <InvitedUserRow invite={item} />
  ), []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: c.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '85%',
            minHeight: '60%',
          }}>
            {/* Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: c.muted + '30',
            }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>
                Invite Users
              </Text>
              <Pressable onPress={onClose} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>

            {/* Tabs */}
            <View style={{
              flexDirection: 'row',
              paddingHorizontal: 16,
              paddingTop: 12,
              gap: 8,
            }}>
              {[
                { key: 'search' as const, label: 'Search Users', icon: 'search' },
                { key: 'invited' as const, label: `Invited (${existingInvites.length})`, icon: 'mail' },
              ].map(tab => (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 10,
                    backgroundColor: activeTab === tab.key ? c.primary : c.card,
                    borderRadius: 10,
                    gap: 6,
                  }}
                >
                  <Ionicons 
                    name={tab.icon as any} 
                    size={16} 
                    color={activeTab === tab.key ? '#000' : c.muted} 
                  />
                  <Text style={{
                    color: activeTab === tab.key ? '#000' : c.muted,
                    fontWeight: '600',
                    fontSize: 13,
                  }}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Content */}
            <View style={{ flex: 1, padding: 16 }}>
              {activeTab === 'search' ? (
                <>
                  {/* Search input */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: c.card,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    marginBottom: 12,
                  }}>
                    <Ionicons name="search" size={18} color={c.muted} />
                    <TextInput
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Search by username or name..."
                      placeholderTextColor={c.muted}
                      style={{
                        flex: 1,
                        padding: 12,
                        color: c.text,
                        fontSize: 15,
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {searching && <ActivityIndicator size="small" color={c.primary} />}
                  </View>

                  {/* Selected count */}
                  {selectedUsers.length > 0 && (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: 12,
                      gap: 8,
                    }}>
                      <Text style={{ color: c.primary, fontWeight: '600' }}>
                        {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected
                      </Text>
                      <Pressable onPress={() => setSelectedUsers([])}>
                        <Text style={{ color: c.muted, fontSize: 13 }}>Clear</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Search results */}
                  {searchQuery.length < 2 ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="search" size={48} color={c.muted} />
                      <Text style={{ color: c.muted, marginTop: 12, textAlign: 'center' }}>
                        Search for users to invite{'\n'}by username or display name
                      </Text>
                    </View>
                  ) : searchResults.length === 0 && !searching ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="person-outline" size={48} color={c.muted} />
                      <Text style={{ color: c.muted, marginTop: 12 }}>
                        No users found
                      </Text>
                    </View>
                  ) : (
                    <FlatList
                      data={searchResults}
                      keyExtractor={(item) => item.id}
                      renderItem={renderSearchItem}
                      showsVerticalScrollIndicator={false}
                    />
                  )}
                </>
              ) : (
                // Invited users list
                loading ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={c.primary} />
                  </View>
                ) : existingInvites.length === 0 ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="mail-outline" size={48} color={c.muted} />
                    <Text style={{ color: c.muted, marginTop: 12 }}>
                      No invites sent yet
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={existingInvites}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderInviteItem}
                    showsVerticalScrollIndicator={false}
                  />
                )
              )}
            </View>

            {/* Send button */}
            {activeTab === 'search' && selectedUsers.length > 0 && (
              <View style={{
                padding: 16,
                borderTopWidth: 1,
                borderTopColor: c.muted + '30',
              }}>
                <Pressable
                  onPress={handleSendInvites}
                  disabled={sending}
                  style={{
                    backgroundColor: c.primary,
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: 'center',
                    opacity: sending ? 0.7 : 1,
                  }}
                >
                  {sending ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>
                      Send {selectedUsers.length} Invite{selectedUsers.length > 1 ? 's' : ''}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


