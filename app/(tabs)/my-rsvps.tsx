import { useEffect, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import dayjs from 'dayjs';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import LazyImage from '@/components/LazyImage';
import { supabase } from '@/services/supabase';
import {
  getMyRSVPs,
  getMyRSVPCounts,
  cancelRSVP,
  type AttendeeStatus,
} from '@/services/organizer';
import type { UserRSVP, RSVPCounts } from '@/types/models';

// Status badge colors and labels
const STATUS_CONFIG: Record<AttendeeStatus, { bg: string; text: string; label: string; icon: string }> = {
  accepted: { bg: '#10b98120', text: '#10b981', label: 'Attending', icon: 'checkmark-circle' },
  waitlisted: { bg: '#6366f120', text: '#6366f1', label: 'Waitlisted', icon: 'time' },
  pending: { bg: '#f59e0b20', text: '#f59e0b', label: 'Pending', icon: 'hourglass' },
  declined: { bg: '#ef444420', text: '#ef4444', label: 'Declined', icon: 'close-circle' },
};

// RSVP Card component
interface RSVPCardProps {
  rsvp: UserRSVP;
  onPress: () => void;
  onCancel: () => void;
}

const RSVPCard = memo(function RSVPCard({ rsvp, onPress, onCancel }: RSVPCardProps) {
  const c = useThemeColors();
  const statusConfig = STATUS_CONFIG[rsvp.status as AttendeeStatus];
  const isPast = dayjs(rsvp.event_date_time).isBefore(dayjs());
  const image = rsvp.event_image_urls?.[0] ?? rsvp.event_image_url;

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: c.card,
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        opacity: isPast ? 0.6 : 1,
      }}
    >
      <View style={{ flexDirection: 'row' }}>
        {/* Event image */}
        <View style={{ width: 100, height: 100 }}>
          {image ? (
            <LazyImage uri={image} width={100} height={100} borderRadius={0} />
          ) : (
            <View style={{
              width: 100,
              height: 100,
              backgroundColor: c.muted + '20',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="calendar" size={32} color={c.muted} />
            </View>
          )}
        </View>

        {/* Event details */}
        <View style={{ flex: 1, padding: 12 }}>
          {/* Status badge */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 6,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: statusConfig.bg,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 12,
              gap: 4,
            }}>
              <Ionicons name={statusConfig.icon as any} size={12} color={statusConfig.text} />
              <Text style={{ color: statusConfig.text, fontSize: 11, fontWeight: '600' }}>
                {statusConfig.label}
                {rsvp.status === 'waitlisted' && rsvp.waitlist_position && ` #${rsvp.waitlist_position}`}
              </Text>
            </View>
            {isPast && (
              <Text style={{ color: c.muted, fontSize: 11, marginLeft: 8 }}>Past Event</Text>
            )}
          </View>

          {/* Title */}
          <Text style={{ color: c.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
            {rsvp.event_title}
          </Text>

          {/* Date and location */}
          <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {dayjs(rsvp.event_date_time).format('ddd, MMM D • h:mm A')}
          </Text>
          {rsvp.event_location && (
            <Text style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>
              {rsvp.event_location}
            </Text>
          )}

          {/* Capacity info */}
          {rsvp.event_capacity && (
            <Text style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>
              {rsvp.current_attendee_count}/{rsvp.event_capacity} spots
              {rsvp.waitlist_count > 0 && ` • ${rsvp.waitlist_count} waitlisted`}
            </Text>
          )}
          
          {/* Ticket purchase indicator - would need to be added to UserRSVP type and query */}
          {/* This is a placeholder - in production, you'd query ticket_purchases and show ticket info */}
        </View>
      </View>

      {/* Action buttons */}
      {!isPast && rsvp.status !== 'declined' && (
        <View style={{
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: c.muted + '20',
        }}>
          <Pressable
            onPress={onPress}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              borderRightWidth: 1,
              borderRightColor: c.muted + '20',
            }}
          >
            <Text style={{ color: c.primary, fontWeight: '600', fontSize: 13 }}>View Event</Text>
          </Pressable>
          <Pressable
            onPress={onCancel}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 13 }}>
              {rsvp.status === 'waitlisted' ? 'Leave Waitlist' : 'Cancel RSVP'}
            </Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
});

// Stats summary component
interface StatsSummaryProps {
  counts: RSVPCounts;
}

const StatsSummary = memo(function StatsSummary({ counts }: StatsSummaryProps) {
  const c = useThemeColors();

  const stats = [
    { label: 'Upcoming', value: counts.upcoming_count, color: c.primary },
    { label: 'Attending', value: counts.accepted_count, color: '#10b981' },
    { label: 'Waitlisted', value: counts.waitlisted_count, color: '#6366f1' },
    { label: 'Pending', value: counts.pending_count, color: '#f59e0b' },
  ];

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    }}>
      {stats.map((stat, index) => (
        <View key={stat.label} style={{
          flex: 1,
          alignItems: 'center',
          borderRightWidth: index < stats.length - 1 ? 1 : 0,
          borderRightColor: c.muted + '30',
        }}>
          <Text style={{ color: stat.color, fontSize: 24, fontWeight: '700' }}>
            {stat.value}
          </Text>
          <Text style={{ color: c.muted, fontSize: 11 }}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
});

// Filter tabs
interface FilterTabsProps {
  activeFilter: AttendeeStatus | 'all' | 'upcoming';
  onFilterChange: (filter: AttendeeStatus | 'all' | 'upcoming') => void;
  counts: RSVPCounts;
}

const FilterTabs = memo(function FilterTabs({ activeFilter, onFilterChange, counts }: FilterTabsProps) {
  const c = useThemeColors();

  const tabs: { key: AttendeeStatus | 'all' | 'upcoming'; label: string }[] = [
    { key: 'upcoming', label: `Upcoming (${counts.upcoming_count})` },
    { key: 'all', label: `All (${counts.total_rsvps})` },
    { key: 'accepted', label: `Attending (${counts.accepted_count})` },
    { key: 'waitlisted', label: `Waitlist (${counts.waitlisted_count})` },
  ];

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 4,
      marginBottom: 16,
    }}>
      {tabs.map(tab => {
        const isActive = activeFilter === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onFilterChange(tab.key)}
            style={{
              flex: 1,
              paddingVertical: 8,
              paddingHorizontal: 4,
              borderRadius: 8,
              backgroundColor: isActive ? c.primary : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text style={{
              color: isActive ? '#000' : c.muted,
              fontSize: 11,
              fontWeight: isActive ? '700' : '500',
            }} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

export default function MyRSVPs() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const [rsvps, setRsvps] = useState<UserRSVP[]>([]);
  const [counts, setCounts] = useState<RSVPCounts>({
    total_rsvps: 0,
    accepted_count: 0,
    waitlisted_count: 0,
    pending_count: 0,
    upcoming_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<AttendeeStatus | 'all' | 'upcoming'>('upcoming');

  // Load RSVPs
  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        router.replace('/onboarding/welcome');
        return;
      }

      const [rsvpData, countsData] = await Promise.all([
        filter === 'upcoming' || filter === 'all'
          ? getMyRSVPs(filter === 'upcoming' ? undefined : undefined)
          : getMyRSVPs(filter),
        getMyRSVPCounts(),
      ]);

      // Filter for upcoming if needed
      let filteredRsvps = rsvpData;
      if (filter === 'upcoming') {
        filteredRsvps = rsvpData.filter(r => 
          (r.status === 'accepted' || r.status === 'waitlisted') && 
          dayjs(r.event_date_time).isAfter(dayjs())
        );
      }

      setRsvps(filteredRsvps);
      setCounts(countsData);
    } catch (error) {
      console.error('Error loading RSVPs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  // Handle cancel RSVP
  const handleCancel = useCallback((rsvp: UserRSVP) => {
    const action = rsvp.status === 'waitlisted' ? 'leave the waitlist' : 'cancel your RSVP';
    Alert.alert(
      'Confirm',
      `Are you sure you want to ${action} for "${rsvp.event_title}"?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelRSVP(rsvp.event_id);
              loadData(false);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel RSVP');
            }
          },
        },
      ]
    );
  }, [loadData]);

  // Navigate to event
  const handleViewEvent = useCallback((eventId: number) => {
    router.push(`/events/${eventId}`);
  }, []);

  const renderItem = useCallback(({ item }: { item: UserRSVP }) => (
    <RSVPCard
      rsvp={item}
      onPress={() => handleViewEvent(item.event_id)}
      onCancel={() => handleCancel(item)}
    />
  ), [handleViewEvent, handleCancel]);

  if (loading) {
    return (
      <GradientBackground>
        <AnimatedPage style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={{ color: c.muted, marginTop: 16 }}>Loading your RSVPs...</Text>
        </AnimatedPage>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <AnimatedPage style={{ flex: 1 }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}>
            <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={24} color={c.text} />
            </Pressable>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: '700', marginLeft: 12 }}>
              My RSVPs
            </Text>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            {/* Stats summary */}
            <StatsSummary counts={counts} />

            {/* Filter tabs */}
            <FilterTabs
              activeFilter={filter}
              onFilterChange={setFilter}
              counts={counts}
            />

            {/* RSVP list */}
            <FlatList
              data={rsvps}
              keyExtractor={(item) => String(item.attendee_id)}
              renderItem={renderItem}
              contentContainerStyle={{ 
                paddingBottom: insets.bottom + 16,
                flexGrow: 1,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={c.primary}
                />
              }
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                  <Ionicons name="calendar-outline" size={64} color={c.muted} />
                  <Text style={{ color: c.text, fontSize: 18, fontWeight: '700', marginTop: 16 }}>
                    No RSVPs yet
                  </Text>
                  <Text style={{ color: c.muted, textAlign: 'center', marginTop: 8 }}>
                    {filter === 'upcoming'
                      ? "You don't have any upcoming events. Browse events to find something you'd like to attend!"
                      : "You haven't RSVP'd to any events yet."}
                  </Text>
                  <Pressable
                    onPress={() => router.push('/(tabs)/events')}
                    style={{
                      backgroundColor: c.primary,
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      borderRadius: 12,
                      marginTop: 20,
                    }}
                  >
                    <Text style={{ color: '#000', fontWeight: '700' }}>Browse Events</Text>
                  </Pressable>
                </View>
              }
            />
          </View>
        </SafeAreaView>
      </AnimatedPage>
    </GradientBackground>
  );
}


