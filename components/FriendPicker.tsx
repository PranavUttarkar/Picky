import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import { BorderRadius, Shadows } from '@/theme/designTokens';
import { Ionicons } from '@expo/vector-icons';
import { getUserFriends } from '@/services/friends';
import Avatar from '@/components/Avatar';
import type { UserProfile } from '@/types/models';

interface FriendPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectFriends: (friends: UserProfile[]) => void;
  selectedFriends?: UserProfile[];
  title?: string;
  multiSelect?: boolean;
}

export default function FriendPicker({
  visible,
  onClose,
  onSelectFriends,
  selectedFriends = [],
  title = 'Select Friends',
  multiSelect = true,
}: FriendPickerProps) {
  const c = useThemeColors();
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<UserProfile[]>(selectedFriends);

  // Load friends when modal opens
  useEffect(() => {
    if (visible) {
      loadFriends();
      setSelected(selectedFriends);
      setSearchQuery('');
    }
  }, [visible, selectedFriends]);

  // Filter friends based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFriends(friends);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredFriends(
        friends.filter(
          friend =>
            friend.display_name?.toLowerCase().includes(query) ||
            friend.username?.toLowerCase().includes(query)
        )
      );
    }
  }, [friends, searchQuery]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const friendsData = await getUserFriends();
      setFriends(friendsData);
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFriend = (friend: UserProfile) => {
    if (multiSelect) {
      const isSelected = selected.some(f => f.id === friend.id);
      if (isSelected) {
        setSelected(selected.filter(f => f.id !== friend.id));
      } else {
        setSelected([...selected, friend]);
      }
    } else {
      setSelected([friend]);
      // For single select, immediately call onSelectFriends and close
      onSelectFriends([friend]);
      onClose();
    }
  };

  const handleDone = () => {
    onSelectFriends(selected);
    onClose();
  };

  const renderFriendItem = ({ item }: { item: UserProfile }) => {
    const isSelected = selected.some(f => f.id === item.id);
    
    return (
      <Pressable
        onPress={() => toggleFriend(item)}
        style={{
          backgroundColor: isSelected ? `${c.primary}20` : c.card,
          marginHorizontal: 16,
          marginBottom: 8,
          padding: 16,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: isSelected ? 2 : 0,
          borderColor: isSelected ? c.primary : 'transparent',
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
              fontWeight: '600', 
              fontSize: 16 
            }}>
              {item.display_name || item.username}
            </Text>
            <Text style={{ 
              color: c.muted, 
              fontSize: 14 
            }}>
              @{item.username}
            </Text>
          </View>
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
            <Ionicons name="checkmark" size={16} color="white" />
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
      }}>
        <View style={{
          backgroundColor: c.background,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: '80%',
          paddingTop: 20,
        }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            marginBottom: 16,
          }}>
            <Text style={{
              fontSize: 20,
              fontWeight: '700',
              color: c.text,
            }}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              style={{
                padding: 8,
              }}
            >
              <Ionicons name="close" size={24} color={c.text} />
            </Pressable>
          </View>

          {/* Search */}
          <View style={{
            backgroundColor: c.card,
            marginHorizontal: 16,
            marginBottom: 16,
            borderRadius: BorderRadius.full,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            ...Shadows.light.md,
          }}>
            <Ionicons name="search" size={20} color={c.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search friends..."
              placeholderTextColor={c.muted}
              style={{
                flex: 1,
                padding: 16,
                color: c.text,
                fontSize: 16,
              }}
            />
          </View>

          {/* Selected count */}
          {multiSelect && selected.length > 0 && (
            <View style={{
              marginHorizontal: 16,
              marginBottom: 12,
            }}>
              <Text style={{
                color: c.primary,
                fontSize: 14,
                fontWeight: '600',
              }}>
                {selected.length} friend{selected.length !== 1 ? 's' : ''} selected
              </Text>
            </View>
          )}

          {/* Friends List */}
          {loading ? (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 40,
            }}>
              <ActivityIndicator size="large" color={c.primary} />
              <Text style={{
                color: c.muted,
                fontSize: 16,
                marginTop: 16,
              }}>
                Loading friends...
              </Text>
            </View>
          ) : filteredFriends.length === 0 ? (
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
                {friends.length === 0 
                  ? "No friends yet. Add some friends first!"
                  : "No friends match your search."
                }
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredFriends}
              keyExtractor={(item) => item.id}
              renderItem={renderFriendItem}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
            />
          )}

          {/* Done Button */}
          {multiSelect && (
            <View style={{
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: c.border,
            }}>
              <Pressable
                onPress={handleDone}
                style={{
                  backgroundColor: c.primary,
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  color: 'white',
                  fontSize: 16,
                  fontWeight: '600',
                }}>
                  Done ({selected.length})
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
