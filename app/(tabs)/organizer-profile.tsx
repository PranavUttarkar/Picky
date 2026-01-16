import { useEffect, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import GradientHeader from '@/components/GradientHeader';
import Avatar from '@/components/Avatar';
import FloatingAddButton from '@/components/FloatingAddButton';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Colors } from '@/theme/designTokens';
import { supabase } from '@/services/supabase';
import { 
  getMyOrganizationProfile, 
  upsertOrganizationProfile,
  getOrganizationFollowers,
  getAllOrganizationEvents,
  ORGANIZATION_CATEGORIES,
  ORGANIZATION_SIZES,
  type OrganizationProfile,
  type OrganizationCategory,
  type OrganizationSize,
} from '@/services/organizations';
import { getFollowersCount } from '@/services/following';
import type { UserProfile, Event } from '@/types/models';
import * as ImagePicker from 'expo-image-picker';
import { updateUserProfile } from '@/services/friends';
import CreateEventModal from '@/components/CreateEventModal';

// Organization tags
const ORGANIZATION_TAGS = [
  'Campus Events', 'Networking', 'Social', 'Professional Development',
  'Community Service', 'Workshops', 'Conferences', 'Sports',
  'Arts & Culture', 'Tech', 'Science', 'Health & Wellness',
  'Environment', 'Diversity & Inclusion', 'Career Fair', 'Music',
];

// Section Card Component
const SectionCard = memo(function SectionCard({ 
  children, 
  title, 
  subtitle,
  icon,
  onEdit,
}: { 
  children: React.ReactNode; 
  title: string;
  subtitle?: string;
  icon?: string;
  onEdit?: () => void;
}) {
  const c = useThemeColors();
  
  return (
    <View style={{
      backgroundColor: c.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    }}>
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        marginBottom: subtitle ? 8 : Spacing.md,
      }}>
        {icon && (
          <View style={{
            backgroundColor: `${c.primary}15`,
            borderRadius: 10,
            padding: 8,
            marginRight: 12,
          }}>
            <Ionicons name={icon as any} size={20} color={c.primary} />
          </View>
        )}
        <Text style={{ 
          color: c.text, 
          fontSize: Typography.scale.heading3.fontSize, 
          fontWeight: Typography.fontWeight.semibold,
          flex: 1,
        }}>
          {title}
        </Text>
        {onEdit && (
          <Pressable onPress={onEdit} hitSlop={8}>
            <Ionicons name="pencil-outline" size={18} color={c.primary} />
          </Pressable>
        )}
      </View>
      {subtitle && (
        <Text style={{ 
          color: c.muted, 
          fontSize: Typography.scale.body.fontSize, 
          marginBottom: Spacing.md,
          lineHeight: 20,
        }}>
          {subtitle}
        </Text>
      )}
      {children}
    </View>
  );
});

// Stat Item Component
const StatItem = memo(function StatItem({ 
  icon, 
  value, 
  label 
}: { 
  icon: string; 
  value: string | number; 
  label: string;
}) {
  const c = useThemeColors();
  return (
    <View style={{
      flex: 1,
      alignItems: 'center',
      paddingVertical: Spacing.md,
    }}>
      <View style={{
        backgroundColor: `${c.primary}15`,
        borderRadius: BorderRadius.full,
        padding: 10,
        marginBottom: 8,
      }}>
        <Ionicons name={icon as any} size={22} color={c.primary} />
      </View>
      <Text style={{
        fontSize: Typography.scale.heading2.fontSize,
        fontFamily: Typography.fontFamily.body,
        fontWeight: Typography.fontWeight.bold,
        color: c.text,
      }}>
        {value}
      </Text>
      <Text style={{
        fontSize: Typography.scale.bodySmall.fontSize,
        fontFamily: Typography.fontFamily.body,
        color: c.muted,
        marginTop: 2,
      }}>
        {label}
      </Text>
    </View>
  );
});

// Tag Chip Component
const TagChip = memo(function TagChip({ 
  label, 
  selected, 
  onPress, 
  disabled 
}: { 
  label: string; 
  selected?: boolean; 
  onPress?: () => void;
  disabled?: boolean;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: BorderRadius.full,
        backgroundColor: selected ? `${c.primary}20` : c.card,
        borderWidth: 1,
        borderColor: selected ? `${c.primary}40` : Colors.light.neutral[300] + '40',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{
        fontSize: Typography.scale.bodySmall.fontSize,
        fontFamily: Typography.fontFamily.body,
        fontWeight: selected ? Typography.fontWeight.semibold : Typography.fontWeight.regular,
        color: selected ? c.primary : c.text,
      }}>
        {label}
      </Text>
    </Pressable>
  );
});

// Edit Modal Component
const EditModal = memo(function EditModal({
  visible,
  onClose,
  title,
  children,
  onSave,
  saving,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
}) {
  const c = useThemeColors();
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}
      >
        <View style={{
          backgroundColor: c.background,
          borderTopLeftRadius: BorderRadius.xl,
          borderTopRightRadius: BorderRadius.xl,
          padding: Spacing.lg,
          maxHeight: '80%',
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: Spacing.lg,
          }}>
            <Text style={{
              fontSize: Typography.scale.heading2.fontSize,
              fontWeight: Typography.fontWeight.bold,
              color: c.text,
              flex: 1,
            }}>
              {title}
            </Text>
            <Pressable onPress={onClose} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color={c.text} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: Spacing.lg }}>
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                backgroundColor: c.card,
                paddingVertical: Spacing.md,
                borderRadius: BorderRadius.md,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: c.text, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            
            <Pressable
              onPress={onSave}
              disabled={saving}
              style={{
                flex: 1,
                backgroundColor: c.primary,
                paddingVertical: Spacing.md,
                borderRadius: BorderRadius.md,
                alignItems: 'center',
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

export default function OrganizerProfile() {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  // State
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [orgProfile, setOrgProfile] = useState<OrganizationProfile | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [orgTags, setOrgTags] = useState<string[]>([]);

  // Edit modals state
  const [editAboutVisible, setEditAboutVisible] = useState(false);
  const [editCategoryVisible, setEditCategoryVisible] = useState(false);
  const [editContactVisible, setEditContactVisible] = useState(false);
  const [editTagsVisible, setEditTagsVisible] = useState(false);
  const [createEventModalVisible, setCreateEventModalVisible] = useState(false);

  // Edit form state
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<OrganizationCategory>('Student Club');
  const [editMemberCount, setEditMemberCount] = useState<OrganizationSize | null>(null);
  const [editWebsite, setEditWebsite] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editFoundedYear, setEditFoundedYear] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/auth/login');
        return;
      }

      // Load user profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      setUserProfile(profile);

      // Redirect if not an organization
      if (profile?.account_type !== 'organization') {
        Alert.alert('Not Available', 'This page is only for organization accounts.');
        router.back();
        return;
      }

      // Load org profile
      const orgData = await getMyOrganizationProfile();
      setOrgProfile(orgData);

      // Load follower count
      const followers = await getFollowersCount(user.id);
      setFollowerCount(followers);

      // Load event count
      const events = await getAllOrganizationEvents(user.id, 100);
      setEventCount(events.length);

      // Load org tags
      const { data: tagsData } = await supabase
        .from('organization_tags')
        .select('tags')
        .eq('user_id', user.id)
        .maybeSingle();
      setOrgTags(tagsData?.tags || []);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Initialize edit form values
  useEffect(() => {
    if (orgProfile) {
      setEditDescription(orgProfile.description || '');
      setEditCategory(orgProfile.category);
      setEditMemberCount(orgProfile.member_count || null);
      setEditWebsite(orgProfile.website || '');
      setEditEmail(orgProfile.contact_email || '');
      setEditFoundedYear(orgProfile.founded_year?.toString() || '');
    }
    setEditTags(orgTags);
  }, [orgProfile, orgTags]);

  const saveAbout = async () => {
    setSaving(true);
    try {
      await upsertOrganizationProfile({
        category: orgProfile?.category || 'Other',
        description: editDescription.trim() || null,
        website: orgProfile?.website,
        contact_email: orgProfile?.contact_email,
        member_count: orgProfile?.member_count,
        founded_year: orgProfile?.founded_year,
      });
      setOrgProfile(prev => prev ? { ...prev, description: editDescription.trim() || null } : null);
      setEditAboutVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update description');
    } finally {
      setSaving(false);
    }
  };

  const saveCategory = async () => {
    setSaving(true);
    try {
      await upsertOrganizationProfile({
        category: editCategory,
        description: orgProfile?.description,
        website: orgProfile?.website,
        contact_email: orgProfile?.contact_email,
        member_count: editMemberCount,
        founded_year: orgProfile?.founded_year,
      });
      setOrgProfile(prev => prev ? { 
        ...prev, 
        category: editCategory, 
        member_count: editMemberCount 
      } : null);
      setEditCategoryVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update category');
    } finally {
      setSaving(false);
    }
  };

  const saveContact = async () => {
    setSaving(true);
    try {
      await upsertOrganizationProfile({
        category: orgProfile?.category || 'Other',
        description: orgProfile?.description,
        website: editWebsite.trim() || null,
        contact_email: editEmail.trim() || null,
        member_count: orgProfile?.member_count,
        founded_year: editFoundedYear ? parseInt(editFoundedYear) : null,
      });
      setOrgProfile(prev => prev ? { 
        ...prev, 
        website: editWebsite.trim() || null,
        contact_email: editEmail.trim() || null,
        founded_year: editFoundedYear ? parseInt(editFoundedYear) : null,
      } : null);
      setEditContactVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update contact info');
    } finally {
      setSaving(false);
    }
  };

  const saveTags = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase
        .from('organization_tags')
        .upsert({
          user_id: user.id,
          tags: editTags,
        }, { onConflict: 'user_id' });
      
      setOrgTags(editTags);
      setEditTagsVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update tags');
    } finally {
      setSaving(false);
    }
  };

  const toggleEditTag = (tag: string) => {
    if (editTags.includes(tag)) {
      setEditTags(editTags.filter(t => t !== tag));
    } else if (editTags.length < 10) {
      setEditTags([...editTags, tag]);
    }
  };

  const addCustomTag = () => {
    const tag = customTagInput.trim();
    if (tag && !editTags.includes(tag) && editTags.length < 10) {
      setEditTags([...editTags, tag]);
      setCustomTagInput('');
    }
  };

  if (loading) {
    return (
      <GradientBackground>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      </GradientBackground>
    );
  }

  const displayName = userProfile?.display_name || userProfile?.username || 'Organization';

  return (
    <GradientBackground>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
      >
        <View style={{ 
          padding: Spacing.lg, 
          maxWidth: isWide ? 700 : undefined, 
          alignSelf: 'center', 
          width: '100%' 
        }}>
          <GradientHeader
            title="My Profile"
            onBack={() => router.back()}
            backLabel="Back"
          />

          {/* Profile Header */}
          <View style={{
            alignItems: 'center',
            marginTop: Spacing.md,
            marginBottom: Spacing.lg,
          }}>
            <View style={{ position: 'relative' }}>
              <Avatar
                uri={userProfile?.avatar_url}
                size={100}
              />
              <Pressable
                onPress={() => router.push('/(tabs)/profile')}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  backgroundColor: c.primary,
                  borderRadius: BorderRadius.full,
                  padding: 8,
                  borderWidth: 3,
                  borderColor: c.background,
                }}
              >
                <Ionicons name="camera" size={16} color="#fff" />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md }}>
              <Text style={{
                fontSize: Typography.scale.heading1.fontSize,
                fontFamily: Typography.fontFamily.body,
                fontWeight: Typography.fontWeight.bold,
                color: c.text,
              }}>
                {displayName}
              </Text>
              {orgProfile?.verified && (
                <View style={{
                  backgroundColor: c.primary,
                  borderRadius: BorderRadius.full,
                  padding: 4,
                  marginLeft: 8,
                }}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
              )}
            </View>

            {userProfile?.username && (
              <Text style={{
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                color: c.muted,
                marginTop: 4,
              }}>
                @{userProfile.username}
              </Text>
            )}

            {/* View Public Profile Button */}
            <Pressable
              onPress={() => router.push(`/(tabs)/organizations/${userProfile?.id}`)}
              style={{
                backgroundColor: c.card,
                paddingVertical: Spacing.sm,
                paddingHorizontal: Spacing.lg,
                borderRadius: BorderRadius.full,
                marginTop: Spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                borderWidth: 1,
                borderColor: `${c.text}20`,
              }}
            >
              <Ionicons name="eye-outline" size={18} color={c.text} />
              <Text style={{
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                fontWeight: Typography.fontWeight.medium,
                color: c.text,
              }}>
                View Public Profile
              </Text>
            </Pressable>
          </View>

          {/* Stats Row */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: c.card,
            borderRadius: BorderRadius.lg,
            marginBottom: Spacing.lg,
          }}>
            <StatItem icon="people" value={followerCount} label="Followers" />
            <View style={{ width: 1, backgroundColor: `${c.text}10` }} />
            <StatItem icon="calendar" value={eventCount} label="Events" />
          </View>

          {/* Category & Size Section */}
          <SectionCard 
            title="Category" 
            icon="business-outline"
            onEdit={() => setEditCategoryVisible(true)}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <View style={{
                backgroundColor: `${c.primary}20`,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: BorderRadius.full,
              }}>
                <Text style={{ color: c.primary, fontWeight: '600' }}>
                  {orgProfile?.category || 'Not set'}
                </Text>
              </View>
              {orgProfile?.member_count && (
                <View style={{
                  backgroundColor: `${c.text}10`,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: BorderRadius.full,
                }}>
                  <Text style={{ color: c.text }}>
                    {orgProfile.member_count} members
                  </Text>
                </View>
              )}
            </View>
          </SectionCard>

          {/* About Section */}
          <SectionCard 
            title="About" 
            icon="document-text-outline"
            onEdit={() => setEditAboutVisible(true)}
          >
            {orgProfile?.description ? (
              <Text style={{
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                color: c.text,
                lineHeight: 22,
              }}>
                {orgProfile.description}
              </Text>
            ) : (
              <Pressable 
                onPress={() => setEditAboutVisible(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: Spacing.sm,
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color={c.primary} />
                <Text style={{
                  fontSize: Typography.scale.body.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  color: c.primary,
                  marginLeft: 8,
                }}>
                  Add a description
                </Text>
              </Pressable>
            )}
          </SectionCard>

          {/* Tags Section */}
          <SectionCard 
            title="Tags" 
            subtitle="Help users discover you"
            icon="pricetags-outline"
            onEdit={() => setEditTagsVisible(true)}
          >
            {orgTags.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {orgTags.map((tag) => (
                  <View key={tag} style={{
                    backgroundColor: `${c.primary}15`,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: BorderRadius.full,
                  }}>
                    <Text style={{ 
                      color: c.primary, 
                      fontSize: Typography.scale.bodySmall.fontSize,
                      fontWeight: Typography.fontWeight.medium,
                    }}>
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Pressable 
                onPress={() => setEditTagsVisible(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: Spacing.sm,
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color={c.primary} />
                <Text style={{
                  fontSize: Typography.scale.body.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  color: c.primary,
                  marginLeft: 8,
                }}>
                  Add tags to your profile
                </Text>
              </Pressable>
            )}
          </SectionCard>

          {/* Contact Section */}
          <SectionCard 
            title="Contact Information" 
            icon="call-outline"
            onEdit={() => setEditContactVisible(true)}
          >
            {(orgProfile?.website || orgProfile?.contact_email || orgProfile?.founded_year) ? (
              <View style={{ gap: Spacing.sm }}>
                {orgProfile?.website && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="globe-outline" size={18} color={c.muted} />
                    <Text style={{
                      fontSize: Typography.scale.body.fontSize,
                      fontFamily: Typography.fontFamily.body,
                      color: c.text,
                      marginLeft: Spacing.sm,
                    }}>
                      {orgProfile.website}
                    </Text>
                  </View>
                )}
                {orgProfile?.contact_email && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="mail-outline" size={18} color={c.muted} />
                    <Text style={{
                      fontSize: Typography.scale.body.fontSize,
                      fontFamily: Typography.fontFamily.body,
                      color: c.text,
                      marginLeft: Spacing.sm,
                    }}>
                      {orgProfile.contact_email}
                    </Text>
                  </View>
                )}
                {orgProfile?.founded_year && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="calendar-outline" size={18} color={c.muted} />
                    <Text style={{
                      fontSize: Typography.scale.body.fontSize,
                      fontFamily: Typography.fontFamily.body,
                      color: c.text,
                      marginLeft: Spacing.sm,
                    }}>
                      Founded {orgProfile.founded_year}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <Pressable 
                onPress={() => setEditContactVisible(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: Spacing.sm,
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color={c.primary} />
                <Text style={{
                  fontSize: Typography.scale.body.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  color: c.primary,
                  marginLeft: 8,
                }}>
                  Add contact information
                </Text>
              </Pressable>
            )}
          </SectionCard>

          {/* Quick Actions */}
          <View style={{ marginTop: Spacing.md }}>
            <Pressable
              onPress={() => setCreateEventModalVisible(true)}
              style={{
                backgroundColor: c.primary,
                borderRadius: BorderRadius.md,
                padding: Spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: Spacing.sm,
                shadowColor: '#000',
                shadowOpacity: 0.2,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
              }}
            >
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.3)',
                borderRadius: 10,
                padding: 8,
                marginRight: 12,
              }}>
                <Ionicons name="add-circle" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  color: '#fff', 
                  fontSize: Typography.scale.body.fontSize,
                  fontWeight: Typography.fontWeight.bold,
                }}>
                  Create Event
                </Text>
                <Text style={{ 
                  color: 'rgba(255,255,255,0.9)', 
                  fontSize: Typography.scale.bodySmall.fontSize,
                }}>
                  Host a new event for your organization
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </Pressable>

            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              style={{
                backgroundColor: c.card,
                borderRadius: BorderRadius.md,
                padding: Spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: Spacing.sm,
              }}
            >
              <View style={{
                backgroundColor: `${c.primary}20`,
                borderRadius: 10,
                padding: 8,
                marginRight: 12,
              }}>
                <Ionicons name="settings-outline" size={20} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  color: c.text, 
                  fontSize: Typography.scale.body.fontSize,
                  fontWeight: Typography.fontWeight.semibold,
                }}>
                  Account Settings
                </Text>
                <Text style={{ 
                  color: c.muted, 
                  fontSize: Typography.scale.bodySmall.fontSize,
                }}>
                  Username, avatar, theme
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={c.muted} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/(tabs)/my-events')}
              style={{
                backgroundColor: c.card,
                borderRadius: BorderRadius.md,
                padding: Spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View style={{
                backgroundColor: `${c.primary}20`,
                borderRadius: 10,
                padding: 8,
                marginRight: 12,
              }}>
                <Ionicons name="calendar-outline" size={20} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  color: c.text, 
                  fontSize: Typography.scale.body.fontSize,
                  fontWeight: Typography.fontWeight.semibold,
                }}>
                  My Events
                </Text>
                <Text style={{ 
                  color: c.muted, 
                  fontSize: Typography.scale.bodySmall.fontSize,
                }}>
                  Manage your events
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={c.muted} />
            </Pressable>
          </View>
          {/* Spacer */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Floating Add Event Button */}
      <FloatingAddButton
        onPress={() => setCreateEventModalVisible(true)}
        accessibilityLabel="Create Event"
        size={isWide ? 80 : 56}
        right={isWide ? 40 : 20}
        bottom={90}
      />

      {/* Create Event Modal */}
      <CreateEventModal
        visible={createEventModalVisible}
        onClose={() => setCreateEventModalVisible(false)}
        onSaved={async () => {
          // Refresh event count after creating event
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const events = await getAllOrganizationEvents(user.id, 100);
            setEventCount(events.length);
          }
        }}
      />

      {/* Edit About Modal */}
      <EditModal
        visible={editAboutVisible}
        onClose={() => setEditAboutVisible(false)}
        title="Edit About"
        onSave={saveAbout}
        saving={saving}
      >
        <Text style={{
          fontSize: Typography.scale.body.fontSize,
          fontFamily: Typography.fontFamily.body,
          fontWeight: Typography.fontWeight.semibold,
          color: c.text,
          marginBottom: Spacing.sm,
        }}>
          Description
        </Text>
        <TextInput
          value={editDescription}
          onChangeText={setEditDescription}
          placeholder="Tell users about your organization..."
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
          }}
        />
        <Text style={{
          fontSize: Typography.scale.bodySmall.fontSize,
          color: c.muted,
          marginTop: Spacing.xs,
          textAlign: 'right',
        }}>
          {editDescription.length}/500
        </Text>
      </EditModal>

      {/* Edit Category Modal */}
      <EditModal
        visible={editCategoryVisible}
        onClose={() => setEditCategoryVisible(false)}
        title="Edit Category"
        onSave={saveCategory}
        saving={saving}
      >
        <Text style={{
          fontSize: Typography.scale.body.fontSize,
          fontFamily: Typography.fontFamily.body,
          fontWeight: Typography.fontWeight.semibold,
          color: c.text,
          marginBottom: Spacing.sm,
        }}>
          Category
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg }}>
          {ORGANIZATION_CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setEditCategory(cat)}
              style={{
                paddingVertical: Spacing.sm,
                paddingHorizontal: Spacing.md,
                borderRadius: BorderRadius.full,
                backgroundColor: editCategory === cat ? c.primary : c.card,
                borderWidth: 1,
                borderColor: editCategory === cat ? c.primary : Colors.light.neutral[300] + '40',
              }}
            >
              <Text style={{
                color: editCategory === cat ? '#FFFFFF' : c.text,
                fontSize: Typography.scale.body.fontSize,
                fontWeight: editCategory === cat ? '600' : '400',
              }}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={{
          fontSize: Typography.scale.body.fontSize,
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
              onPress={() => setEditMemberCount(editMemberCount === size ? null : size)}
              style={{
                flex: 1,
                paddingVertical: Spacing.md,
                borderRadius: BorderRadius.md,
                backgroundColor: editMemberCount === size ? c.primary : c.card,
                borderWidth: 1,
                borderColor: editMemberCount === size ? c.primary : Colors.light.neutral[300] + '40',
                alignItems: 'center',
              }}
            >
              <Text style={{
                color: editMemberCount === size ? '#FFFFFF' : c.text,
                fontSize: Typography.scale.body.fontSize,
                fontWeight: editMemberCount === size ? '600' : '400',
              }}>
                {size}
              </Text>
            </Pressable>
          ))}
        </View>
      </EditModal>

      {/* Edit Contact Modal */}
      <EditModal
        visible={editContactVisible}
        onClose={() => setEditContactVisible(false)}
        title="Edit Contact"
        onSave={saveContact}
        saving={saving}
      >
        <View style={{ marginBottom: Spacing.lg }}>
          <Text style={{
            fontSize: Typography.scale.body.fontSize,
            fontFamily: Typography.fontFamily.body,
            fontWeight: Typography.fontWeight.semibold,
            color: c.text,
            marginBottom: Spacing.sm,
          }}>
            Website
          </Text>
          <TextInput
            value={editWebsite}
            onChangeText={setEditWebsite}
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
            }}
          />
        </View>

        <View style={{ marginBottom: Spacing.lg }}>
          <Text style={{
            fontSize: Typography.scale.body.fontSize,
            fontFamily: Typography.fontFamily.body,
            fontWeight: Typography.fontWeight.semibold,
            color: c.text,
            marginBottom: Spacing.sm,
          }}>
            Contact Email
          </Text>
          <TextInput
            value={editEmail}
            onChangeText={setEditEmail}
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
            }}
          />
        </View>

        <View>
          <Text style={{
            fontSize: Typography.scale.body.fontSize,
            fontFamily: Typography.fontFamily.body,
            fontWeight: Typography.fontWeight.semibold,
            color: c.text,
            marginBottom: Spacing.sm,
          }}>
            Founded Year
          </Text>
          <TextInput
            value={editFoundedYear}
            onChangeText={(text) => setEditFoundedYear(text.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="2024"
            placeholderTextColor={c.muted}
            keyboardType="number-pad"
            maxLength={4}
            style={{
              backgroundColor: c.card,
              padding: Spacing.md,
              borderRadius: BorderRadius.md,
              color: c.text,
              fontSize: Typography.scale.body.fontSize,
            }}
          />
        </View>
      </EditModal>

      {/* Edit Tags Modal */}
      <EditModal
        visible={editTagsVisible}
        onClose={() => setEditTagsVisible(false)}
        title="Edit Tags"
        onSave={saveTags}
        saving={saving}
      >
        <Text style={{
          fontSize: Typography.scale.body.fontSize,
          fontFamily: Typography.fontFamily.body,
          color: c.muted,
          marginBottom: Spacing.md,
        }}>
          Select up to 10 tags to help users find you
        </Text>

        {/* Selected Tags */}
        {editTags.length > 0 && (
          <View style={{ 
            flexDirection: 'row', 
            flexWrap: 'wrap', 
            gap: 8, 
            marginBottom: Spacing.md,
            paddingBottom: Spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: `${c.text}10`,
          }}>
            {editTags.map((tag) => (
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
                <Pressable onPress={() => toggleEditTag(tag)} hitSlop={8}>
                  <Ionicons name="close" size={14} color={c.primary} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Available Tags */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md }}>
          {ORGANIZATION_TAGS.filter(t => !editTags.includes(t)).map((tag) => (
            <TagChip
              key={tag}
              label={tag}
              onPress={() => toggleEditTag(tag)}
              disabled={editTags.length >= 10}
            />
          ))}
        </View>

        {/* Custom Tag Input */}
        <View style={{ 
          flexDirection: 'row', 
          gap: Spacing.sm,
          paddingTop: Spacing.md,
          borderTopWidth: 1,
          borderTopColor: `${c.text}10`,
        }}>
          <TextInput
            value={customTagInput}
            onChangeText={setCustomTagInput}
            placeholder="Add custom tag..."
            placeholderTextColor={c.muted}
            onSubmitEditing={addCustomTag}
            style={{
              flex: 1,
              backgroundColor: c.background,
              padding: Spacing.md,
              borderRadius: BorderRadius.md,
              color: c.text,
              fontSize: Typography.scale.body.fontSize,
              fontFamily: Typography.fontFamily.body,
              borderWidth: 1,
              borderColor: `${c.text}20`,
            }}
          />
          <Pressable
            onPress={addCustomTag}
            disabled={!customTagInput.trim() || editTags.length >= 10}
            style={{
              backgroundColor: customTagInput.trim() && editTags.length < 10 ? c.primary : c.muted,
              paddingHorizontal: Spacing.md,
              borderRadius: BorderRadius.md,
              justifyContent: 'center',
              minWidth: 60,
              alignItems: 'center',
            }}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </Pressable>
        </View>
      </EditModal>
    </GradientBackground>
  );
}
