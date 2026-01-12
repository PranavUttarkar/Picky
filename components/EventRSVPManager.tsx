import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { BorderRadius, Spacing } from '@/theme/designTokens';
import { supabase } from '@/services/supabase';
import Avatar from './Avatar';
import HeaderSpacer from './HeaderSpacer';

type RSVPStatus = 'accepted' | 'pending' | 'declined' | 'waitlisted';

interface RSVPAttendee {
  id: number;
  user_id: string;
  event_id: number;
  status: RSVPStatus;
  waitlist_position: number | null;
  created_at: string;
  responded_at: string | null;
  user_profile: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface EventRSVPManagerProps {
  visible: boolean;
  eventId: number;
  eventTitle: string;
  capacity: number | null;
  onClose: () => void;
}

export default function EventRSVPManager({
  visible,
  eventId,
  eventTitle,
  capacity,
  onClose,
}: EventRSVPManagerProps) {
  const c = useThemeColors();
  const { scheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rsvps, setRsvps] = useState<RSVPAttendee[]>([]);
  const [activeTab, setActiveTab] = useState<'accepted' | 'waitlisted' | 'pending'>('accepted');

  const loadRSVPs = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select(`
          *,
          user_profile:user_profiles!event_rsvps_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setRsvps((data as any) || []);
    } catch (err: any) {
      console.error('Failed to load RSVPs:', err);
      Alert.alert('Error', 'Failed to load RSVPs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadRSVPs();
    }
  }, [visible, eventId]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadRSVPs(false);
  };

  const updateRSVPStatus = async (rsvpId: number, newStatus: RSVPStatus) => {
    try {
      const { error } = await supabase
        .from('event_rsvps')
        .update({ 
          status: newStatus,
          responded_at: new Date().toISOString(),
        })
        .eq('id', rsvpId);

      if (error) throw error;

      // Reload RSVPs to reflect changes
      await loadRSVPs(false);
      Alert.alert('Success', `RSVP status updated to ${newStatus}`);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to update RSVP status');
    }
  };

  const acceptedRsvps = rsvps.filter((r) => r.status === 'accepted');
  const waitlistedRsvps = rsvps.filter((r) => r.status === 'waitlisted').sort(
    (a, b) => (a.waitlist_position || 0) - (b.waitlist_position || 0)
  );
  const pendingRsvps = rsvps.filter((r) => r.status === 'pending');

  const currentList =
    activeTab === 'accepted'
      ? acceptedRsvps
      : activeTab === 'waitlisted'
      ? waitlistedRsvps
      : pendingRsvps;

  const renderAttendee = (attendee: RSVPAttendee) => (
    <View
      key={attendee.id}
      style={{
        backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        borderRadius: BorderRadius.md,
        padding: Spacing.sm,
        marginBottom: Spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar
          uri={attendee.user_profile?.avatar_url}
          name={attendee.user_profile?.display_name || attendee.user_profile?.username || 'User'}
          size={44}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>
            {attendee.user_profile?.display_name || attendee.user_profile?.username || 'Anonymous'}
          </Text>
          {attendee.user_profile?.username && (
            <Text style={{ color: c.muted, fontSize: 12 }}>@{attendee.user_profile.username}</Text>
          )}
          {attendee.waitlist_position && (
            <Text style={{ color: c.muted, fontSize: 11, marginTop: 2 }}>
              Waitlist Position: #{attendee.waitlist_position}
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        {attendee.status === 'pending' && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable
              onPress={() => updateRSVPStatus(attendee.id, 'accepted')}
              style={{
                backgroundColor: c.primary,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: BorderRadius.sm,
              }}
            >
              <Ionicons name="checkmark" size={18} color="#000" />
            </Pressable>
            <Pressable
              onPress={() => updateRSVPStatus(attendee.id, 'waitlisted')}
              style={{
                backgroundColor: '#00000020',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: BorderRadius.sm,
              }}
            >
              <Ionicons name="time" size={18} color={c.text} />
            </Pressable>
            <Pressable
              onPress={() => updateRSVPStatus(attendee.id, 'declined')}
              style={{
                backgroundColor: '#ff444420',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: BorderRadius.sm,
              }}
            >
              <Ionicons name="close" size={18} color="#ff4444" />
            </Pressable>
          </View>
        )}

        {attendee.status === 'waitlisted' && (
          <Pressable
            onPress={() => updateRSVPStatus(attendee.id, 'accepted')}
            style={{
              backgroundColor: c.primary,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: BorderRadius.sm,
            }}
          >
            <Text style={{ color: '#000', fontSize: 12, fontWeight: '600' }}>Accept</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.background }}>
        <HeaderSpacer />
        <BlurView intensity={30} tint={scheme === 'dark' ? 'dark' : 'light'} style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>RSVPs</Text>
              <Text style={{ color: c.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                {eventTitle}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={{ backgroundColor: '#00000020', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
            >
              <Ionicons name="close" size={24} color={c.text} />
            </Pressable>
          </View>
        </BlurView>

        {/* Stats Bar */}
        <View
          style={{
            flexDirection: 'row',
            padding: Spacing.md,
            gap: Spacing.sm,
            backgroundColor: c.card,
            borderBottomWidth: 1,
            borderBottomColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          }}
        >
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: c.primary, fontSize: 24, fontWeight: '800' }}>{acceptedRsvps.length}</Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>Accepted</Text>
          </View>
          {capacity && (
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 24, fontWeight: '800' }}>{capacity}</Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>Capacity</Text>
            </View>
          )}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#f59e0b', fontSize: 24, fontWeight: '800' }}>{waitlistedRsvps.length}</Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>Waitlist</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#6b7280', fontSize: 24, fontWeight: '800' }}>{pendingRsvps.length}</Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>Pending</Text>
          </View>
        </View>

        {/* Tabs */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            padding: 4,
            marginHorizontal: Spacing.md,
            marginTop: Spacing.sm,
            borderRadius: BorderRadius.md,
          }}
        >
          {(['accepted', 'waitlisted', 'pending'] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                flex: 1,
                paddingVertical: Spacing.sm,
                borderRadius: BorderRadius.sm,
                backgroundColor: activeTab === tab ? c.primary : 'transparent',
              }}
            >
              <Text
                style={{
                  color: activeTab === tab ? '#000' : c.text,
                  fontWeight: '700',
                  fontSize: 13,
                  textAlign: 'center',
                  textTransform: 'capitalize',
                }}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* List */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.primary} />}
        >
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={c.primary} />
            </View>
          ) : currentList.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Ionicons name="people-outline" size={48} color={c.muted} />
              <Text style={{ color: c.muted, fontSize: 14, marginTop: 12 }}>
                No {activeTab} RSVPs yet
              </Text>
            </View>
          ) : (
            currentList.map(renderAttendee)
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
