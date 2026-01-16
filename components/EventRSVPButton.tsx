import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { BorderRadius, Spacing } from '@/theme/designTokens';
import { supabase } from '@/services/supabase';
import type { Event } from '@/types/models';

interface EventRSVPButtonProps {
  event: Event;
  onRSVPChange?: () => void;
}

export default function EventRSVPButton({ event, onRSVPChange }: EventRSVPButtonProps) {
  const c = useThemeColors();
  const { scheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [rsvpStatus, setRsvpStatus] = useState<'accepted' | 'waitlisted' | 'pending' | null>(null);
  const [rsvpCounts, setRsvpCounts] = useState({ accepted: 0, waitlisted: 0 });
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadRSVPStatus();
  }, [event.id]);

  const loadRSVPStatus = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      // Check user's RSVP status
      const { data: rsvpData } = await supabase
        .from('event_rsvps')
        .select('status')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .maybeSingle();

      setRsvpStatus(rsvpData?.status || null);

      // Get counts
      const { data: acceptedCount } = await supabase
        .from('event_rsvps')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('status', 'accepted');

      const { data: waitlistedCount } = await supabase
        .from('event_rsvps')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('status', 'waitlisted');

      setRsvpCounts({
        accepted: (acceptedCount as any)?.count || 0,
        waitlisted: (waitlistedCount as any)?.count || 0,
      });
    } catch (err) {
      console.error('Failed to load RSVP status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = async () => {
    if (!userId) {
      Alert.alert('Sign in required', 'Please sign in to RSVP for this event');
      return;
    }

    try {
      const isFull = event.capacity && rsvpCounts.accepted >= event.capacity;
      const newStatus = isFull && event.allow_join_requests ? 'waitlisted' : 'accepted';

      // Calculate waitlist position if needed
      let waitlistPosition = null;
      if (newStatus === 'waitlisted') {
        const { count } = await supabase
          .from('event_rsvps')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', event.id)
          .eq('status', 'waitlisted');
        waitlistPosition = ((count as any) || 0) + 1;
      }

      const { error } = await supabase.from('event_rsvps').insert({
        event_id: event.id,
        user_id: userId,
        status: newStatus,
        waitlist_position: waitlistPosition,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      setRsvpStatus(newStatus);
      await loadRSVPStatus();
      
      if (newStatus === 'waitlisted') {
        Alert.alert(
          'Added to Waitlist',
          `You've been added to the waitlist at position #${waitlistPosition}. You'll be notified if a spot opens up.`
        );
      } else {
        Alert.alert('RSVP Confirmed', 'You have successfully RSVPed to this event!');
      }

      onRSVPChange?.();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to RSVP');
    }
  };

  const handleCancelRSVP = async () => {
    Alert.alert('Cancel RSVP', 'Are you sure you want to cancel your RSVP?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('event_rsvps')
              .delete()
              .eq('event_id', event.id)
              .eq('user_id', userId!);

            if (error) throw error;

            setRsvpStatus(null);
            await loadRSVPStatus();
            Alert.alert('Cancelled', 'Your RSVP has been cancelled');
            onRSVPChange?.();
          } catch (err: any) {
            Alert.alert('Error', 'Failed to cancel RSVP');
          }
        },
      },
    ]);
  };

  // Don't show RSVP button for ticketed events (they use ticket purchase instead)
  if (event.is_ticketed) {
    return null;
  }

  if (!event.capacity && !event.rsvp_required) {
    return null; // No RSVP system enabled
  }

  const isFull = event.capacity && rsvpCounts.accepted >= event.capacity;
  const spotsLeft = event.capacity ? event.capacity - rsvpCounts.accepted : null;

  return (
    <View style={{ gap: Spacing.sm }}>
      {/* Capacity Info */}
      {event.capacity && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            padding: Spacing.sm,
            borderRadius: BorderRadius.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="people" size={18} color={c.muted} />
            <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>
              {rsvpCounts.accepted} / {event.capacity} attending
            </Text>
          </View>
          {spotsLeft !== null && spotsLeft > 0 && (
            <Text style={{ color: isFull ? '#ff4444' : c.primary, fontSize: 12, fontWeight: '600' }}>
              {spotsLeft} spots left
            </Text>
          )}
          {isFull && (
            <Text style={{ color: '#ff4444', fontSize: 12, fontWeight: '600' }}>FULL</Text>
          )}
        </View>
      )}

      {/* Waitlist Info */}
      {rsvpCounts.waitlisted > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#f59e0b20',
            padding: Spacing.sm,
            borderRadius: BorderRadius.md,
          }}
        >
          <Ionicons name="time" size={18} color="#f59e0b" />
          <Text style={{ color: c.text, fontSize: 13 }}>
            {rsvpCounts.waitlisted} on waitlist
          </Text>
        </View>
      )}

      {/* RSVP Button */}
      {loading ? (
        <ActivityIndicator size="small" color={c.primary} />
      ) : rsvpStatus ? (
        <View style={{ gap: Spacing.xs }}>
          <View
            style={{
              backgroundColor:
                rsvpStatus === 'accepted'
                  ? c.primary + '20'
                  : rsvpStatus === 'waitlisted'
                  ? '#f59e0b20'
                  : '#6b728020',
              padding: Spacing.sm,
              borderRadius: BorderRadius.md,
              borderLeftWidth: 3,
              borderLeftColor:
                rsvpStatus === 'accepted' ? c.primary : rsvpStatus === 'waitlisted' ? '#f59e0b' : '#6b7280',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons
                name={
                  rsvpStatus === 'accepted'
                    ? 'checkmark-circle'
                    : rsvpStatus === 'waitlisted'
                    ? 'time'
                    : 'hourglass'
                }
                size={20}
                color={rsvpStatus === 'accepted' ? c.primary : rsvpStatus === 'waitlisted' ? '#f59e0b' : '#6b7280'}
              />
              <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>
                {rsvpStatus === 'accepted'
                  ? "You're attending!"
                  : rsvpStatus === 'waitlisted'
                  ? "You're on the waitlist"
                  : 'RSVP pending'}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleCancelRSVP}
            style={{
              backgroundColor: '#ff444420',
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: BorderRadius.md,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#ff4444', fontWeight: '700', fontSize: 14 }}>Cancel RSVP</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={handleRSVP}
          disabled={isFull && !event.allow_join_requests}
          style={({ pressed }) => ({
            backgroundColor:
              isFull && !event.allow_join_requests
                ? '#6b7280'
                : pressed
                ? `${c.primary}dd`
                : c.primary,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: BorderRadius.md,
            alignItems: 'center',
            opacity: isFull && !event.allow_join_requests ? 0.5 : 1,
          })}
        >
          <Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>
            {isFull && event.allow_join_requests
              ? 'Join Waitlist'
              : isFull
              ? 'Event Full'
              : 'RSVP to Event'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
