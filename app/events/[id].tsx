import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import dayjs from 'dayjs';
import * as Calendar from 'expo-calendar';
import { useThemeColors } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import type { Event } from '@/types/models';

export default function EventDetails() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    const eid = parseInt(String(id), 10);
    if (!eid) return;
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        router.replace('/onboarding/welcome');
        return;
      }
    })();
    supabase
      .from('events')
      .select('*')
      .eq('id', eid)
      .single()
      .then(({ data }) => setEvent((data ?? null) as Event | null));
  }, [id]);

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
  };

  if (!event) return null;
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {event.image_url ? (
        <Image source={{ uri: event.image_url }} style={{ width: '100%', height: 220 }} />
      ) : null}
      <View style={{ padding: 16 }}>
        <Text style={{ color: c.text, fontSize: 24, fontWeight: '800' }}>{event.title}</Text>
        <Text style={{ color: c.muted, marginTop: 4 }}>
          {dayjs(event.date_time).format('ddd, MMM D • h:mm A')} • {event.location}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 8,
          }}
        >
          {(event.tags ?? []).map((t: string) => (
            <View
              key={t}
              style={{
                backgroundColor: '#00000020',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: c.text, fontSize: 12 }}>{t}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: c.text, marginTop: 12 }}>{event.description}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <Pressable
            onPress={addToCalendar}
            style={{
              backgroundColor: c.primary,
              padding: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: '#000', fontWeight: '700' }}>Add to calendar</Text>
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
            style={{ backgroundColor: '#00000030', padding: 12, borderRadius: 12 }}
          >
            <Text style={{ color: c.text, fontWeight: '700' }}>Start a poll</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
