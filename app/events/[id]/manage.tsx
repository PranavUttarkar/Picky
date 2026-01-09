import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import AttendeeList, { AttendeeStats, AttendeeTabs } from '@/components/AttendeeList';
import InviteUsersModal from '@/components/InviteUsersModal';
import { supabase } from '@/services/supabase';
import { updateEvent } from '@/services/events';
import {
  getEventAttendees,
  getEventStats,
  approveJoinRequest,
  rejectJoinRequest,
  removeAttendee,
  type EventAttendee,
  type AttendeeStatus,
  type EventStats,
} from '@/services/organizer';
import type { Event } from '@/types/models';

export default function ManageEvent() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = parseInt(String(id), 10);

  // State
  const [event, setEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<AttendeeStatus | 'all'>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Event settings state
  const [capacity, setCapacity] = useState<string>('');
  const [allowJoinRequests, setAllowJoinRequests] = useState(true);

  // Load event data
  const loadData = useCallback(async () => {
    if (!eventId) return;

    try {
      // Load event details
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;

      // Verify ownership
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || eventData.created_by !== auth.user.id) {
        Alert.alert('Access Denied', 'You are not the organizer of this event');
        router.back();
        return;
      }

      setEvent(eventData as Event);
      setCapacity(eventData.capacity?.toString() ?? '');
      setAllowJoinRequests(eventData.allow_join_requests ?? true);

      // Load attendees and stats
      const [attendeesData, statsData] = await Promise.all([
        getEventAttendees(eventId),
        getEventStats(eventId),
      ]);

      setAttendees(attendeesData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading event:', error);
      Alert.alert('Error', 'Failed to load event data');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle approve request
  const handleApprove = useCallback(async (attendeeId: number) => {
    try {
      const wasAccepted = await approveJoinRequest(attendeeId);
      if (wasAccepted) {
        Alert.alert('Approved', 'User has been added to the event');
      } else {
        Alert.alert('Waitlisted', 'Event is full. User has been added to the waitlist');
      }
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to approve request');
    }
  }, [loadData]);

  // Handle reject request
  const handleReject = useCallback(async (attendeeId: number) => {
    Alert.alert('Reject Request', 'Are you sure you want to reject this request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            await rejectJoinRequest(attendeeId);
            loadData();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to reject request');
          }
        },
      },
    ]);
  }, [loadData]);

  // Handle remove attendee
  const handleRemove = useCallback(async (attendeeId: number) => {
    Alert.alert('Remove Attendee', 'Are you sure you want to remove this attendee?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeAttendee(attendeeId);
            loadData();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to remove attendee');
          }
        },
      },
    ]);
  }, [loadData]);

  // Save event settings
  const handleSaveSettings = useCallback(async () => {
    if (!event) return;

    setSaving(true);
    try {
      const newCapacity = capacity.trim() ? parseInt(capacity, 10) : null;
      await updateEvent(eventId, {
        capacity: newCapacity,
        allow_join_requests: allowJoinRequests,
      });
      Alert.alert('Saved', 'Event settings have been updated');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [event, eventId, capacity, allowJoinRequests, loadData]);

  // Calculate tab counts
  const tabCounts = {
    all: attendees.length,
    accepted: attendees.filter(a => a.status === 'accepted').length,
    pending: attendees.filter(a => a.status === 'pending').length,
    waitlisted: attendees.filter(a => a.status === 'waitlisted').length,
  };

  if (loading) {
    return (
      <GradientBackground>
        <AnimatedPage style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={{ color: c.muted, marginTop: 16 }}>Loading event...</Text>
        </AnimatedPage>
      </GradientBackground>
    );
  }

  if (!event) {
    return (
      <GradientBackground>
        <AnimatedPage style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="alert-circle" size={48} color={c.muted} />
          <Text style={{ color: c.muted, marginTop: 16 }}>Event not found</Text>
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
            borderBottomWidth: 1,
            borderBottomColor: c.muted + '20',
          }}>
            <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={24} color={c.text} />
            </Pressable>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }} numberOfLines={1}>
                Manage Event
              </Text>
              <Text style={{ color: c.muted, fontSize: 13 }} numberOfLines={1}>
                {event.title}
              </Text>
            </View>
            <Pressable
              onPress={() => setShowInviteModal(true)}
              style={{
                backgroundColor: c.primary,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="person-add" size={16} color="#000" />
              <Text style={{ color: '#000', fontWeight: '600' }}>Invite</Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Event visibility badge */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 16,
              gap: 8,
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: event.visibility === 'private' ? '#6366f120' : '#10b98120',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 16,
                gap: 6,
              }}>
                <Ionicons
                  name={event.visibility === 'private' ? 'lock-closed' : 'globe'}
                  size={14}
                  color={event.visibility === 'private' ? '#6366f1' : '#10b981'}
                />
                <Text style={{
                  color: event.visibility === 'private' ? '#6366f1' : '#10b981',
                  fontWeight: '600',
                  fontSize: 13,
                  textTransform: 'capitalize',
                }}>
                  {event.visibility} Event
                </Text>
              </View>
            </View>

            {/* Stats */}
            {stats && (
              <AttendeeStats
                accepted={stats.accepted_count}
                pending={stats.pending_count}
                waitlisted={stats.waitlisted_count}
                capacity={stats.capacity}
              />
            )}

            {/* Event Settings Section */}
            <View style={{
              backgroundColor: c.card,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
            }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 16 }}>
                Event Settings
              </Text>

              {/* Capacity */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: c.muted, fontSize: 13, marginBottom: 6 }}>
                  Capacity (leave empty for unlimited)
                </Text>
                <TextInput
                  value={capacity}
                  onChangeText={setCapacity}
                  placeholder="Unlimited"
                  placeholderTextColor={c.muted}
                  keyboardType="number-pad"
                  style={{
                    backgroundColor: c.background,
                    padding: 12,
                    borderRadius: 10,
                    color: c.text,
                    fontSize: 15,
                  }}
                />
              </View>

              {/* Allow join requests (for private events) */}
              {event.visibility === 'private' && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>
                      Allow Join Requests
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 12 }}>
                      Users can request to join this event
                    </Text>
                  </View>
                  <Switch
                    value={allowJoinRequests}
                    onValueChange={setAllowJoinRequests}
                    trackColor={{ false: c.muted, true: c.primary }}
                  />
                </View>
              )}

              {/* Save button */}
              <Pressable
                onPress={handleSaveSettings}
                disabled={saving}
                style={{
                  backgroundColor: c.primary,
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={{ color: '#000', fontWeight: '700' }}>Save Settings</Text>
                )}
              </Pressable>
            </View>

            {/* Attendees Section */}
            <View style={{
              backgroundColor: c.card,
              borderRadius: 16,
              padding: 16,
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>
                  Attendees
                </Text>
                {tabCounts.pending > 0 && (
                  <View style={{
                    backgroundColor: '#f59e0b',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 10,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                      {tabCounts.pending} pending
                    </Text>
                  </View>
                )}
              </View>

              <AttendeeTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                counts={tabCounts}
              />

              <AttendeeList
                attendees={attendees}
                isOrganizer={true}
                filterStatus={activeTab}
                onApprove={handleApprove}
                onReject={handleReject}
                onRemove={handleRemove}
                emptyMessage={
                  activeTab === 'pending'
                    ? 'No pending requests'
                    : activeTab === 'waitlisted'
                    ? 'No one on the waitlist'
                    : 'No attendees yet'
                }
              />
            </View>
          </ScrollView>
        </SafeAreaView>

        {/* Invite Modal */}
        <InviteUsersModal
          visible={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          eventId={eventId}
          onInvitesSent={loadData}
        />
      </AnimatedPage>
    </GradientBackground>
  );
}


