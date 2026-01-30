import { useEffect, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  FlatList,
  RefreshControl,
  Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import Avatar from '@/components/Avatar';
import EventRowCard from '@/components/EventRowCard';
import LazyImage from '@/components/LazyImage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Typography, Spacing, BorderRadius, Colors } from '@/theme/designTokens';
import { supabase } from '@/services/supabase';
import { 
  getOrganizationWithProfile, 
  getOrganizationEvents, 
  getAllOrganizationEvents,
  getOrganizationFollowers,
  type OrganizationWithProfile,
  ORGANIZATION_CATEGORIES,
} from '@/services/organizations';
import { followUser, unfollowUser, isFollowing } from '@/services/following';
import type { Event, UserProfile } from '@/types/models';
import dayjs from 'dayjs';

// Tab types for the organization profile
type OrgTab = 'about' | 'upcoming' | 'past' | 'members';

// Tag Chip Component
const TagChip = memo(function TagChip({ label, variant = 'default' }: { label: string; variant?: 'default' | 'primary' }) {
  const c = useThemeColors();
  return (
    <View style={{
      backgroundColor: variant === 'primary' ? `${c.primary}20` : `${c.text}10`,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: variant === 'primary' ? `${c.primary}40` : 'transparent',
    }}>
      <Text style={{
        fontSize: Typography.scale.bodySmall.fontSize,
        fontFamily: Typography.fontFamily.body,
        fontWeight: Typography.fontWeight.medium,
        color: variant === 'primary' ? c.primary : c.text,
      }}>
        {label}
      </Text>
    </View>
  );
});

// Compact Event Card Component (same as home.tsx)
const CompactEventCard = memo(function CompactEventCard({ event, onPress }: { event: Event; onPress: () => void }) {
  const c = useThemeColors();
  const imgs: string[] = (event as any).image_urls?.length
    ? (event as any).image_urls
    : event.image_url
    ? [event.image_url]
    : [];
  const cover = imgs[0];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.light.neutral[300] + '20',
        minWidth: 140,
        maxWidth: 180,
        backgroundColor: c.card,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ width: '100%', aspectRatio: 1, position: 'relative' }}>
        {cover ? (
          <LazyImage
            uri={cover}
            width="100%"
            height="100%"
            borderRadius={0}
            resizeMode="cover"
          />
        ) : (
          <View style={{ width: '100%', height: '100%', backgroundColor: c.muted + '20', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="calendar-outline" size={24} color={c.muted} />
          </View>
        )}
      </View>
      <Text style={{
        fontSize: 13,
        lineHeight: 16,
        fontFamily: Typography.fontFamily.body,
        fontWeight: Typography.fontWeight.semibold,
        paddingHorizontal: Spacing.sm,
        paddingTop: Spacing.sm,
        color: c.text,
      }} numberOfLines={2}>
        {event.title}
      </Text>
      <Text style={{
        fontSize: Typography.scale.bodySmall.fontSize,
        lineHeight: Typography.scale.bodySmall.lineHeight,
        fontFamily: Typography.fontFamily.body,
        fontWeight: Typography.fontWeight.regular,
        paddingHorizontal: Spacing.sm,
        paddingBottom: Spacing.sm,
        marginTop: 2,
        color: c.muted,
      }} numberOfLines={1}>
        {dayjs(event.date_time).format('MMM D')}
      </Text>
    </Pressable>
  );
});

// Stat Card Component
const StatCard = memo(function StatCard({ 
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
      backgroundColor: c.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      alignItems: 'center',
      minWidth: 100,
    }}>
      <View style={{
        backgroundColor: `${c.primary}15`,
        borderRadius: BorderRadius.full,
        padding: 8,
        marginBottom: 8,
      }}>
        <Ionicons name={icon as any} size={20} color={c.primary} />
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

// Member Card Component
const MemberCard = memo(function MemberCard({ member }: { member: UserProfile }) {
  const c = useThemeColors();
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    }}>
      <Avatar 
        uri={member.avatar_url} 
        size={44} 
      />
      <View style={{ marginLeft: Spacing.md, flex: 1 }}>
        <Text style={{
          fontSize: Typography.scale.body.fontSize,
          fontFamily: Typography.fontFamily.body,
          fontWeight: Typography.fontWeight.semibold,
          color: c.text,
        }}>
          {member.display_name || member.username || 'Anonymous'}
        </Text>
        {member.username && (
          <Text style={{
            fontSize: Typography.scale.bodySmall.fontSize,
            fontFamily: Typography.fontFamily.body,
            color: c.muted,
          }}>
            @{member.username}
          </Text>
        )}
      </View>
    </View>
  );
});

// Section Header Component
const SectionHeader = memo(function SectionHeader({ title, count }: { title: string; count?: number }) {
  const c = useThemeColors();
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
      marginTop: Spacing.lg,
    }}>
      <Text style={{
        fontSize: Typography.scale.heading3.fontSize,
        fontFamily: Typography.fontFamily.body,
        fontWeight: Typography.fontWeight.semibold,
        color: c.text,
      }}>
        {title}
      </Text>
      {count !== undefined && (
        <View style={{
          backgroundColor: `${c.primary}20`,
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: BorderRadius.full,
          marginLeft: 8,
        }}>
          <Text style={{
            fontSize: Typography.scale.bodySmall.fontSize,
            fontFamily: Typography.fontFamily.body,
            fontWeight: Typography.fontWeight.semibold,
            color: c.primary,
          }}>
            {count}
          </Text>
        </View>
      )}
    </View>
  );
});

// Empty State Component
const EmptyState = memo(function EmptyState({ 
  icon, 
  title, 
  subtitle 
}: { 
  icon: string; 
  title: string; 
  subtitle: string;
}) {
  const c = useThemeColors();
  return (
    <View style={{
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.lg,
    }}>
      <View style={{
        backgroundColor: `${c.muted}20`,
        borderRadius: BorderRadius.full,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
      }}>
        <Ionicons name={icon as any} size={32} color={c.muted} />
      </View>
      <Text style={{
        fontSize: Typography.scale.bodyLarge.fontSize,
        fontFamily: Typography.fontFamily.body,
        fontWeight: Typography.fontWeight.semibold,
        color: c.text,
        textAlign: 'center',
        marginBottom: 4,
      }}>
        {title}
      </Text>
      <Text style={{
        fontSize: Typography.scale.body.fontSize,
        fontFamily: Typography.fontFamily.body,
        color: c.muted,
        textAlign: 'center',
      }}>
        {subtitle}
      </Text>
    </View>
  );
});

export default function OrganizationProfile() {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isWide = width >= 768;

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [org, setOrg] = useState<OrganizationWithProfile | null>(null);
  const [userInfo, setUserInfo] = useState<UserProfile | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [recentEvents, setRecentEvents] = useState<Event[]>([]);
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [isFollowingOrg, setIsFollowingOrg] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<OrgTab>('about');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Load organization data
  const loadOrgData = useCallback(async () => {
    if (!id) return;

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Load organization profile
      const orgData = await getOrganizationWithProfile(id);
      setOrg(orgData);

      // Load user info
      const { data: userData } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url, account_type, email')
        .eq('id', id)
        .single();
      setUserInfo(userData);

      // Load events
      const allEvents = await getAllOrganizationEvents(id, 50);
      const now = new Date();
      const upcoming = allEvents.filter(e => new Date(e.date_time) >= now);
      const past = allEvents.filter(e => new Date(e.date_time) < now);
      setUpcomingEvents(upcoming);
      setPastEvents(past);
      
      // Set 3 most recent events (upcoming first, then past if needed)
      const recent = [...upcoming.slice(0, 3)];
      if (recent.length < 3) {
        recent.push(...past.slice(0, 3 - recent.length));
      }
      setRecentEvents(recent);

      // Load followers
      const followersData = await getOrganizationFollowers(id);
      setFollowers(followersData);

      // Check if current user is following
      if (user) {
        const following = await isFollowing(id);
        setIsFollowingOrg(following);
      }
    } catch (error) {
      console.error('Error loading organization:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrgData();
  }, [loadOrgData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrgData();
  }, [loadOrgData]);

  const handleFollow = async () => {
    if (!id || followLoading) return;
    
    setFollowLoading(true);
    try {
      if (isFollowingOrg) {
        await unfollowUser(id);
        setIsFollowingOrg(false);
        setOrg(prev => prev ? { ...prev, follower_count: Math.max(0, prev.follower_count - 1) } : null);
      } else {
        await followUser(id);
        setIsFollowingOrg(true);
        setOrg(prev => prev ? { ...prev, follower_count: prev.follower_count + 1 } : null);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const tabs: { key: OrgTab; label: string; icon: string }[] = [
    { key: 'about', label: 'About', icon: 'information-circle-outline' },
    { key: 'upcoming', label: 'Upcoming', icon: 'calendar-outline' },
    { key: 'past', label: 'Past', icon: 'time-outline' },
    { key: 'members', label: 'Followers', icon: 'people-outline' },
  ];

  const isOwnProfile = currentUserId === id;

  if (loading) {
    return (
      <GradientBackground>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      </GradientBackground>
    );
  }

  if (!org && !userInfo) {
    return (
      <GradientBackground>
        <View style={{ flex: 1, padding: Spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
            <Pressable onPress={() => router.push('/(tabs)/organizer-profile')} style={{ padding: 8 }}>
              <Ionicons name="chevron-back" size={20} color={c.text} />
            </Pressable>
            <Text style={{
              color: c.text,
              fontSize: Typography.scale.heading3.fontSize,
              fontFamily: Typography.fontFamily.body,
              fontWeight: Typography.fontWeight.semibold,
              marginLeft: 8,
            }}>
              Organization
            </Text>
          </View>
          <EmptyState
            icon="business-outline"
            title="Organization not found"
            subtitle="This organization may no longer exist."
          />
        </View>
      </GradientBackground>
    );
  }

  const displayName = userInfo?.display_name || userInfo?.username || 'Organization';

  return (
    <GradientBackground>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={{ padding: Spacing.lg, maxWidth: isWide ? 800 : undefined, alignSelf: 'center', width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
            <Pressable onPress={() => router.push('/(tabs)/organizer-profile')} style={{ padding: 8 }}>
              <Ionicons name="chevron-back" size={20} color={c.text} />
            </Pressable>
          </View>

          {/* Profile Header */}
          <View style={{
            alignItems: 'center',
            marginTop: Spacing.md,
            marginBottom: Spacing.lg,
          }}>
            <Avatar
              uri={userInfo?.avatar_url}
              size={100}
            />
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md }}>
              <Text style={{
                fontSize: Typography.scale.heading1.fontSize,
                fontFamily: Typography.fontFamily.body,
                fontWeight: Typography.fontWeight.bold,
                color: c.text,
                textAlign: 'center',
              }}>
                {displayName}
              </Text>
              {org?.verified && (
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

            {userInfo?.username && (
              <Text style={{
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                color: c.muted,
                marginTop: 4,
              }}>
                @{userInfo.username}
              </Text>
            )}

            {/* Category & Tags */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.md, justifyContent: 'center' }}>
              {org?.category && (
                <TagChip label={org.category} variant="primary" />
              )}
              {org?.member_count && (
                <TagChip label={`${org.member_count} members`} />
              )}
            </View>

            {/* Follow Button */}
            {!isOwnProfile && (
              <Pressable
                onPress={handleFollow}
                disabled={followLoading}
                style={{
                  backgroundColor: isFollowingOrg ? 'transparent' : c.primary,
                  borderWidth: isFollowingOrg ? 2 : 0,
                  borderColor: c.primary,
                  paddingVertical: Spacing.sm + 2,
                  paddingHorizontal: Spacing.xl,
                  borderRadius: BorderRadius.full,
                  marginTop: Spacing.lg,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color={isFollowingOrg ? c.primary : '#fff'} />
                ) : (
                  <>
                    <Ionicons 
                      name={isFollowingOrg ? 'checkmark' : 'add'} 
                      size={18} 
                      color={isFollowingOrg ? c.primary : '#fff'} 
                    />
                    <Text style={{
                      fontSize: Typography.scale.body.fontSize,
                      fontFamily: Typography.fontFamily.body,
                      fontWeight: Typography.fontWeight.semibold,
                      color: isFollowingOrg ? c.primary : '#fff',
                    }}>
                      {isFollowingOrg ? 'Following' : 'Follow'}
                    </Text>
                  </>
                )}
              </Pressable>
            )}

            {/* Edit Profile Button for own profile */}
            {isOwnProfile && (
              <Pressable
                onPress={() => router.push('/(tabs)/profile')}
                style={{
                  backgroundColor: c.card,
                  paddingVertical: Spacing.sm + 2,
                  paddingHorizontal: Spacing.xl,
                  borderRadius: BorderRadius.full,
                  marginTop: Spacing.lg,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: `${c.text}20`,
                }}
              >
                <Ionicons name="pencil-outline" size={18} color={c.text} />
                <Text style={{
                  fontSize: Typography.scale.body.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  fontWeight: Typography.fontWeight.semibold,
                  color: c.text,
                }}>
                  Edit Profile
                </Text>
              </Pressable>
            )}
          </View>

          {/* Stats Row */}
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg }}>
            <StatCard icon="people" value={org?.follower_count || 0} label="Followers" />
            <StatCard icon="calendar" value={upcomingEvents.length} label="Upcoming" />
            <StatCard icon="checkmark-circle" value={pastEvents.length} label="Past Events" />
          </View>

          {/* Tab Navigation */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: c.card,
            borderRadius: BorderRadius.lg,
            padding: 4,
            marginBottom: Spacing.lg,
          }}>
            {tabs.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: Spacing.sm + 2,
                  borderRadius: BorderRadius.md,
                  backgroundColor: activeTab === tab.key ? c.primary : 'transparent',
                  gap: 6,
                }}
              >
                <Ionicons 
                  name={tab.icon as any} 
                  size={16} 
                  color={activeTab === tab.key ? '#fff' : c.muted} 
                />
                <Text style={{
                  fontSize: Typography.scale.bodySmall.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  fontWeight: activeTab === tab.key ? Typography.fontWeight.semibold : Typography.fontWeight.regular,
                  color: activeTab === tab.key ? '#fff' : c.muted,
                }}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Tab Content */}
          {activeTab === 'about' && (
            <View>
              {/* Recent Events Slider */}
              {recentEvents.length > 0 && (
                <View style={{ marginBottom: Spacing.lg }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: Spacing.md,
                  }}>
                    <Text style={{
                      fontSize: Typography.scale.heading3.fontSize,
                      fontFamily: Typography.fontFamily.body,
                      fontWeight: Typography.fontWeight.semibold,
                      color: c.text,
                    }}>
                      Recent Events
                    </Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: Spacing.md }}
                  >
                    {recentEvents.map((event) => (
                      <CompactEventCard
                        key={event.id}
                        event={event}
                        onPress={() => router.push(`/events/${event.id}`)}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Description */}
              {org?.description && (
                <View style={{
                  backgroundColor: c.card,
                  borderRadius: BorderRadius.md,
                  padding: Spacing.lg,
                  marginBottom: Spacing.md,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
                    <Ionicons name="document-text-outline" size={18} color={c.primary} />
                    <Text style={{
                      fontSize: Typography.scale.body.fontSize,
                      fontFamily: Typography.fontFamily.body,
                      fontWeight: Typography.fontWeight.semibold,
                      color: c.text,
                      marginLeft: 8,
                    }}>
                      About
                    </Text>
                  </View>
                  <Text style={{
                    fontSize: Typography.scale.body.fontSize,
                    fontFamily: Typography.fontFamily.body,
                    color: c.text,
                    lineHeight: 22,
                  }}>
                    {org.description}
                  </Text>
                </View>
              )}

              {/* Contact Info */}
              <View style={{
                backgroundColor: c.card,
                borderRadius: BorderRadius.md,
                padding: Spacing.lg,
                marginBottom: Spacing.md,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
                  <Ionicons name="call-outline" size={18} color={c.primary} />
                  <Text style={{
                    fontSize: Typography.scale.body.fontSize,
                    fontFamily: Typography.fontFamily.body,
                    fontWeight: Typography.fontWeight.semibold,
                    color: c.text,
                    marginLeft: 8,
                  }}>
                    Contact
                  </Text>
                </View>

                {org?.website && (
                  <Pressable
                    onPress={() => Linking.openURL(org.website!)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: Spacing.sm,
                    }}
                  >
                    <Ionicons name="globe-outline" size={18} color={c.muted} />
                    <Text style={{
                      fontSize: Typography.scale.body.fontSize,
                      fontFamily: Typography.fontFamily.body,
                      color: c.primary,
                      marginLeft: Spacing.sm,
                    }}>
                      {org.website}
                    </Text>
                  </Pressable>
                )}

                {org?.contact_email && (
                  <Pressable
                    onPress={() => Linking.openURL(`mailto:${org.contact_email}`)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: Spacing.sm,
                    }}
                  >
                    <Ionicons name="mail-outline" size={18} color={c.muted} />
                    <Text style={{
                      fontSize: Typography.scale.body.fontSize,
                      fontFamily: Typography.fontFamily.body,
                      color: c.primary,
                      marginLeft: Spacing.sm,
                    }}>
                      {org.contact_email}
                    </Text>
                  </Pressable>
                )}

                {org?.founded_year && (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: Spacing.sm,
                  }}>
                    <Ionicons name="calendar-outline" size={18} color={c.muted} />
                    <Text style={{
                      fontSize: Typography.scale.body.fontSize,
                      fontFamily: Typography.fontFamily.body,
                      color: c.text,
                      marginLeft: Spacing.sm,
                    }}>
                      Founded {org.founded_year}
                    </Text>
                  </View>
                )}

                {!org?.website && !org?.contact_email && !org?.founded_year && (
                  <Text style={{
                    fontSize: Typography.scale.body.fontSize,
                    fontFamily: Typography.fontFamily.body,
                    color: c.muted,
                    fontStyle: 'italic',
                  }}>
                    No contact information provided
                  </Text>
                )}
              </View>
            </View>
          )}

          {activeTab === 'upcoming' && (
            <View>
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event) => (
                  <View key={event.id} style={{ marginBottom: Spacing.sm }}>
                    <EventRowCard 
                      event={event} 
                      isSaved={false}
                      onToggleSave={() => {}}
                      onOpenDetails={() => router.push(`/events/${event.id}`)}
                    />
                  </View>
                ))
              ) : (
                <EmptyState
                  icon="calendar-outline"
                  title="No upcoming events"
                  subtitle="This organization hasn't posted any upcoming events yet."
                />
              )}
            </View>
          )}

          {activeTab === 'past' && (
            <View>
              {pastEvents.length > 0 ? (
                pastEvents.map((event) => (
                  <View key={event.id} style={{ marginBottom: Spacing.sm }}>
                    <EventRowCard 
                      event={event} 
                      isSaved={false}
                      onToggleSave={() => {}}
                      onOpenDetails={() => router.push(`/events/${event.id}`)}
                    />
                  </View>
                ))
              ) : (
                <EmptyState
                  icon="time-outline"
                  title="No past events"
                  subtitle="This organization hasn't hosted any events yet."
                />
              )}
            </View>
          )}

          {activeTab === 'members' && (
            <View>
              <SectionHeader title="Followers" count={followers.length} />
              {followers.length > 0 ? (
                followers.map((member) => (
                  <MemberCard key={member.id} member={member} />
                ))
              ) : (
                <EmptyState
                  icon="people-outline"
                  title="No followers yet"
                  subtitle="Be the first to follow this organization!"
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </GradientBackground>
  );
}
