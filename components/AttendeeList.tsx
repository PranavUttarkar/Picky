import { memo, useCallback } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/theme/ThemeProvider';
import Avatar from '@/components/Avatar';
import type { EventAttendee, AttendeeStatus } from '@/services/organizer';

// Status badge colors
const STATUS_COLORS: Record<AttendeeStatus, { bg: string; text: string }> = {
  accepted: { bg: '#10b98120', text: '#10b981' },
  pending: { bg: '#f59e0b20', text: '#f59e0b' },
  waitlisted: { bg: '#6366f120', text: '#6366f1' },
  declined: { bg: '#ef444420', text: '#ef4444' },
};

// Status badge component
const StatusBadge = memo(function StatusBadge({ status }: { status: AttendeeStatus }) {
  const colors = STATUS_COLORS[status];
  return (
    <View style={{
      backgroundColor: colors.bg,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    }}>
      <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' }}>
        {status === 'waitlisted' ? `Waitlist` : status}
      </Text>
    </View>
  );
});

// Single attendee row
interface AttendeeRowProps {
  attendee: EventAttendee;
  isOrganizer: boolean;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  onRemove?: (id: number) => void;
}

const AttendeeRow = memo(function AttendeeRow({
  attendee,
  isOrganizer,
  onApprove,
  onReject,
  onRemove,
}: AttendeeRowProps) {
  const c = useThemeColors();
  const user = attendee.user;
  const displayName = user?.display_name || user?.username || 'Unknown User';

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: c.card,
      borderRadius: 12,
      marginBottom: 8,
    }}>
      <Avatar uri={user?.avatar_url} size={44} />
      
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>
          {displayName}
        </Text>
        {user?.username && (
          <Text style={{ color: c.muted, fontSize: 13 }}>@{user.username}</Text>
        )}
        {attendee.status === 'waitlisted' && attendee.waitlist_position && (
          <Text style={{ color: c.muted, fontSize: 12 }}>
            Position #{attendee.waitlist_position}
          </Text>
        )}
      </View>
      
      <StatusBadge status={attendee.status} />
      
      {/* Organizer actions */}
      {isOrganizer && (
        <View style={{ flexDirection: 'row', marginLeft: 8, gap: 4 }}>
          {attendee.status === 'pending' && (
            <>
              <Pressable
                onPress={() => onApprove?.(attendee.id)}
                style={{
                  backgroundColor: '#10b98120',
                  padding: 8,
                  borderRadius: 8,
                }}
              >
                <Ionicons name="checkmark" size={18} color="#10b981" />
              </Pressable>
              <Pressable
                onPress={() => onReject?.(attendee.id)}
                style={{
                  backgroundColor: '#ef444420',
                  padding: 8,
                  borderRadius: 8,
                }}
              >
                <Ionicons name="close" size={18} color="#ef4444" />
              </Pressable>
            </>
          )}
          {(attendee.status === 'accepted' || attendee.status === 'waitlisted') && (
            <Pressable
              onPress={() => onRemove?.(attendee.id)}
              style={{
                backgroundColor: '#ef444420',
                padding: 8,
                borderRadius: 8,
              }}
            >
              <Ionicons name="person-remove" size={16} color="#ef4444" />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
});

// Main AttendeeList component
interface AttendeeListProps {
  attendees: EventAttendee[];
  isOrganizer: boolean;
  loading?: boolean;
  emptyMessage?: string;
  filterStatus?: AttendeeStatus | 'all';
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  onRemove?: (id: number) => void;
}

export default function AttendeeList({
  attendees,
  isOrganizer,
  loading = false,
  emptyMessage = 'No attendees yet',
  filterStatus = 'all',
  onApprove,
  onReject,
  onRemove,
}: AttendeeListProps) {
  const c = useThemeColors();

  // Filter attendees by status if needed
  const filteredAttendees = filterStatus === 'all' 
    ? attendees 
    : attendees.filter(a => a.status === filterStatus);

  const renderItem = useCallback(({ item }: { item: EventAttendee }) => (
    <AttendeeRow
      attendee={item}
      isOrganizer={isOrganizer}
      onApprove={onApprove}
      onReject={onReject}
      onRemove={onRemove}
    />
  ), [isOrganizer, onApprove, onReject, onRemove]);

  if (loading) {
    return (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={c.primary} />
        <Text style={{ color: c.muted, marginTop: 8 }}>Loading attendees...</Text>
      </View>
    );
  }

  if (filteredAttendees.length === 0) {
    return (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <Ionicons name="people-outline" size={32} color={c.muted} />
        <Text style={{ color: c.muted, marginTop: 8, textAlign: 'center' }}>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={filteredAttendees}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      contentContainerStyle={{ paddingHorizontal: 0 }}
      showsVerticalScrollIndicator={false}
    />
  );
}

// Stats summary component for organizer dashboard
interface AttendeeStatsProps {
  accepted: number;
  pending: number;
  waitlisted: number;
  capacity: number | null;
}

export const AttendeeStats = memo(function AttendeeStats({
  accepted,
  pending,
  waitlisted,
  capacity,
}: AttendeeStatsProps) {
  const c = useThemeColors();

  const stats = [
    { label: 'Attending', value: accepted, color: '#10b981' },
    { label: 'Pending', value: pending, color: '#f59e0b' },
    { label: 'Waitlist', value: waitlisted, color: '#6366f1' },
  ];

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 12,
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
          <Text style={{ color: c.muted, fontSize: 12 }}>{stat.label}</Text>
        </View>
      ))}
      {capacity !== null && (
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: c.text, fontSize: 24, fontWeight: '700' }}>
            {capacity}
          </Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>Capacity</Text>
        </View>
      )}
    </View>
  );
});

// Tab filter for attendee list
interface AttendeeTabsProps {
  activeTab: AttendeeStatus | 'all';
  onTabChange: (tab: AttendeeStatus | 'all') => void;
  counts: { all: number; accepted: number; pending: number; waitlisted: number };
}

export const AttendeeTabs = memo(function AttendeeTabs({
  activeTab,
  onTabChange,
  counts,
}: AttendeeTabsProps) {
  const c = useThemeColors();

  const tabs: { key: AttendeeStatus | 'all'; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'accepted', label: `Attending (${counts.accepted})` },
    { key: 'pending', label: `Pending (${counts.pending})` },
    { key: 'waitlisted', label: `Waitlist (${counts.waitlisted})` },
  ];

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 4,
      marginBottom: 12,
    }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
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
              fontSize: 12,
              fontWeight: isActive ? '700' : '500',
            }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});


