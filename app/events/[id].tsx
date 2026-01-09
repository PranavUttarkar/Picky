import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, Linking, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import HeaderSpacer from '@/components/HeaderSpacer';
import EventImages from '@/components/EventImages';
import { useLocalSearchParams } from 'expo-router';
import dayjs from 'dayjs';
import * as Calendar from 'expo-calendar';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientHeader from '@/components/GradientHeader';
import Chip from '@/components/Chip';
import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import { shareEvent } from '@/utils/share';
import { Ionicons } from '@expo/vector-icons';
import type { Event } from '@/types/models';
import {
  getUserEventStatus,
  rsvpToEvent,
  cancelRSVP,
  requestToJoinEvent,
  respondToInvite,
  getEventStats,
  type EventAttendee,
  type EventInvite,
  type EventStats,
} from '@/services/organizer';

export default function EventDetails() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = parseInt(String(id), 10);
  
  const [event, setEvent] = useState<Event | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [attendeeStatus, setAttendeeStatus] = useState<EventAttendee | null>(null);
  const [inviteStatus, setInviteStatus] = useState<EventInvite | null>(null);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Load event and user status
  const loadData = useCallback(async () => {
    if (!eventId) return;

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace('/onboarding/welcome');
        return;
      }
      setUserId(auth.user.id);

      // Load event
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      
      if (!eventData) {
        Alert.alert('Not Found', 'This event does not exist or you do not have access.');
        router.back();
        return;
      }
      setEvent(eventData as Event);

      // Load user's status and event stats
      const [statusData, statsData] = await Promise.all([
        getUserEventStatus(eventId),
        getEventStats(eventId),
      ]);

      setAttendeeStatus(statusData.attendee);
      setInviteStatus(statusData.invite);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading event:', error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle RSVP for public events
  const handleRSVP = async () => {
    setActionLoading(true);
    try {
      const result = await rsvpToEvent(eventId, 'accepted');
      if (result.status === 'waitlisted') {
        Alert.alert('Waitlisted', `Event is full. You're #${result.waitlist_position} on the waitlist.`);
      } else {
        Alert.alert('Success', 'You\'re now attending this event!');
      }
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to RSVP');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle cancel RSVP
  const handleCancelRSVP = async () => {
    Alert.alert('Cancel RSVP', 'Are you sure you want to cancel your RSVP?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await cancelRSVP(eventId);
            loadData();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to cancel RSVP');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  // Handle request to join (for private events)
  const handleRequestJoin = async () => {
    setActionLoading(true);
    try {
      await requestToJoinEvent(eventId);
      Alert.alert('Request Sent', 'The organizer will review your request.');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send request');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle invite response
  const handleInviteResponse = async (response: 'accepted' | 'declined') => {
    if (!inviteStatus) return;
    
    setActionLoading(true);
    try {
      await respondToInvite(inviteStatus.id, response);
      if (response === 'accepted') {
        Alert.alert('Success', 'You\'re now attending this event!');
      }
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to respond to invite');
    } finally {
      setActionLoading(false);
    }
  };

  // Add to calendar
  const addToCalendar = async () => {
    if (!event) return;
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return;
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const calendarId = calendars?.[0]?.id;
    if (!calendarId) return;
    await Calendar.createEventAsync(calendarId, {
      title: event.title,
      startDate: new Date(event.date_time),
      endDate: new Date(dayjs(event.date_time).add(2, 'hour').toISOString()),
      location: event.location ?? undefined,
      notes: event.description ?? undefined,
    });
    Alert.alert('Added', 'Event added to your calendar!');
  };

  // Check if current user is the organizer
  const isOrganizer = event?.created_by === userId;

  // Render RSVP status section
  const renderRSVPSection = () => {
    if (!event) return null;

    // Show capacity info
    const spotsInfo = stats?.capacity 
      ? `${stats.accepted_count}/${stats.capacity} spots filled`
      : stats?.accepted_count 
        ? `${stats.accepted_count} attending`
        : null;

    return (
      <View style={{
        backgroundColor: c.card,
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
      }}>
        {/* Event visibility and RSVP badges */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 12,
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
              {event.visibility ?? 'Public'} Event
            </Text>
          </View>
          
          {/* RSVP Required badge */}
          {event.rsvp_required && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#f59e0b20',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 16,
              gap: 6,
            }}>
              <Ionicons name="ticket" size={14} color="#f59e0b" />
              <Text style={{ color: '#f59e0b', fontWeight: '600', fontSize: 13 }}>
                RSVP Required
              </Text>
            </View>
          )}
          
          {spotsInfo && (
            <Text style={{ color: c.muted, fontSize: 13 }}>{spotsInfo}</Text>
          )}
        </View>
        
        {/* Waitlist info */}
        {stats && stats.waitlisted_count > 0 && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#6366f110',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            marginBottom: 12,
            gap: 8,
          }}>
            <Ionicons name="people" size={16} color="#6366f1" />
            <Text style={{ color: '#6366f1', fontSize: 13 }}>
              {stats.waitlisted_count} {stats.waitlisted_count === 1 ? 'person' : 'people'} on waitlist
            </Text>
          </View>
        )}

        {/* Organizer view */}
        {isOrganizer ? (
          <Pressable
            onPress={() => router.push(`/events/${eventId}/manage`)}
            style={{
              backgroundColor: c.primary,
              paddingVertical: 14,
              borderRadius: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="settings" size={18} color="#000" />
            <Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>
              Manage Event
            </Text>
          </Pressable>
        ) : (
          <>
            {/* Pending invite - show accept/decline */}
            {inviteStatus?.status === 'pending' && (
              <View>
                <Text style={{ color: c.text, fontWeight: '600', marginBottom: 8 }}>
                  You've been invited to this event!
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => handleInviteResponse('accepted')}
                    disabled={actionLoading}
                    style={{
                      flex: 1,
                      backgroundColor: '#10b981',
                      paddingVertical: 12,
                      borderRadius: 10,
                      alignItems: 'center',
                      opacity: actionLoading ? 0.7 : 1,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Accept</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleInviteResponse('declined')}
                    disabled={actionLoading}
                    style={{
                      flex: 1,
                      backgroundColor: '#ef4444',
                      paddingVertical: 12,
                      borderRadius: 10,
                      alignItems: 'center',
                      opacity: actionLoading ? 0.7 : 1,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Decline</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Already attending */}
            {attendeeStatus?.status === 'accepted' && (
              <View>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#10b98120',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  marginBottom: 8,
                  gap: 8,
                }}>
                  <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  <Text style={{ color: '#10b981', fontWeight: '700', flex: 1 }}>
                    You're attending this event
                  </Text>
                </View>
                <Pressable
                  onPress={handleCancelRSVP}
                  disabled={actionLoading}
                  style={{
                    backgroundColor: '#ef444420',
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: 'center',
                    opacity: actionLoading ? 0.7 : 1,
                  }}
                >
                  <Text style={{ color: '#ef4444', fontWeight: '600' }}>Cancel RSVP</Text>
                </Pressable>
              </View>
            )}

            {/* On waitlist */}
            {attendeeStatus?.status === 'waitlisted' && (
              <View>
                <View style={{
                  backgroundColor: '#6366f115',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 8,
                }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 8,
                    gap: 8,
                  }}>
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: '#6366f1',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                        #{attendeeStatus.waitlist_position}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 15 }}>
                        You're on the Waitlist
                      </Text>
                      <Text style={{ color: c.muted, fontSize: 12 }}>
                        We'll notify you when a spot opens up
                      </Text>
                    </View>
                  </View>
                  {stats && stats.waitlisted_count > 1 && (
                    <Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>
                      {stats.waitlisted_count - 1} {stats.waitlisted_count - 1 === 1 ? 'person' : 'people'} behind you
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={handleCancelRSVP}
                  disabled={actionLoading}
                  style={{
                    backgroundColor: '#ef444420',
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: 'center',
                    opacity: actionLoading ? 0.7 : 1,
                  }}
                >
                  <Text style={{ color: '#ef4444', fontWeight: '600' }}>Leave Waitlist</Text>
                </Pressable>
              </View>
            )}

            {/* Pending request */}
            {attendeeStatus?.status === 'pending' && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#f59e0b20',
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 10,
                gap: 8,
              }}>
                <Ionicons name="hourglass" size={20} color="#f59e0b" />
                <Text style={{ color: '#f59e0b', fontWeight: '700', flex: 1 }}>
                  Your request is pending approval
                </Text>
              </View>
            )}

            {/* No status yet - show RSVP or request button */}
            {!attendeeStatus && !inviteStatus && (
              <>
                {event.visibility === 'private' ? (
                  // Private event - request to join
                  event.allow_join_requests ? (
                    <Pressable
                      onPress={handleRequestJoin}
                      disabled={actionLoading}
                      style={{
                        backgroundColor: c.primary,
                        paddingVertical: 14,
                        borderRadius: 10,
                        alignItems: 'center',
                        opacity: actionLoading ? 0.7 : 1,
                      }}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#000" />
                      ) : (
                        <Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>
                          Request to Join
                        </Text>
                      )}
                    </Pressable>
                  ) : (
                    <View style={{
                      backgroundColor: c.muted + '20',
                      paddingVertical: 14,
                      borderRadius: 10,
                      alignItems: 'center',
                    }}>
                      <Text style={{ color: c.muted, fontWeight: '600' }}>
                        Invite Only Event
                      </Text>
                    </View>
                  )
                ) : (
                  // Public event - RSVP
                  <Pressable
                    onPress={handleRSVP}
                    disabled={actionLoading}
                    style={{
                      backgroundColor: c.primary,
                      paddingVertical: 14,
                      borderRadius: 10,
                      alignItems: 'center',
                      opacity: actionLoading ? 0.7 : 1,
                    }}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>
                        {stats?.capacity && stats.spots_remaining === 0 ? 'Join Waitlist' : 'RSVP - I\'m Going!'}
                      </Text>
                    )}
                  </Pressable>
                )}
              </>
            )}
          </>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.background }}>
        <HeaderSpacer />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!event) return null;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.background }}>
      <HeaderSpacer />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        {(() => {
          const imgs: string[] = (event as any).image_urls?.length
            ? (event as any).image_urls
            : event.image_url
            ? [event.image_url]
            : [];
          if (!imgs.length) return null;
          return <EventImages images={imgs} variant="detail" />;
        })()}
        <View style={{ padding: 16 }}>
          <GradientHeader
            title={event.title}
            onBack={() => router.replace('/(tabs)/home')}
            backLabel="Back to home"
            shareUrl={'https://usepicky.app'}
          />
          <Text style={{ color: c.muted, marginTop: 4 }}>
            {dayjs(event.date_time).format('ddd, MMM D • h:mm A')} • {event.location}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {(event.tags ?? []).map((t: string) => (
              <Chip key={t} label={t} />
            ))}
          </View>
          <Text style={{ color: c.text, marginTop: 12 }}>{event.description}</Text>

          {/* RSVP Section */}
          {renderRSVPSection()}

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <Pressable
              onPress={addToCalendar}
              style={{
                backgroundColor: c.primary,
                padding: 12,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="calendar" size={16} color="#000" />
              <Text style={{ color: '#000', fontWeight: '700' }}>Add to calendar</Text>
            </Pressable>
            <Pressable
              onPress={() => event && shareEvent({ id: event.id, title: event.title })}
              style={{ 
                backgroundColor: '#00000030', 
                padding: 12, 
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="share-outline" size={16} color={c.text} />
              <Text style={{ color: c.text, fontWeight: '700' }}>Share</Text>
            </Pressable>
            {event.rsvp_url ? (
              <Pressable
                onPress={() => Linking.openURL(event.rsvp_url as string)}
                style={{
                  backgroundColor: '#00000030',
                  padding: 12,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: c.text, fontWeight: '700' }}>Open RSVP link</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.push(`/(tabs)/polls/new?eventId=${event.id}`)}
              style={{ 
                backgroundColor: '#00000030', 
                padding: 12, 
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="bar-chart" size={16} color={c.text} />
              <Text style={{ color: c.text, fontWeight: '700' }}>Start a poll</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
