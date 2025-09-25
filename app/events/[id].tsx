import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, Linking, ScrollView } from 'react-native';
import LazyImage from '@/components/LazyImage';
import { useLocalSearchParams } from 'expo-router';
import dayjs from 'dayjs';
import * as Calendar from 'expo-calendar';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientHeader from '@/components/GradientHeader';
import Chip from '@/components/Chip';
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
      <View style={{ flex: 1 }}>
        {(() => {
          const imgs: string[] = (event as any).image_urls?.length
            ? (event as any).image_urls
            : event.image_url
            ? [event.image_url]
            : [];
          if (!imgs.length) return null;
          if (imgs.length === 1) {
            return (
              <LazyImage
                uri={imgs[0]}
                width={'100%'}
                height={220}
                accessibilityLabel={`Event image for ${event.title}`}
              />
            );
          }
          return (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ width: '100%', maxHeight: 240 }}
              contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 12 }}
            >
              {imgs.map((u, i) => (
                <LazyImage
                  key={i}
                  uri={u}
                  width={300}
                  height={220}
                  borderRadius={12}
                  style={{ marginRight: 12 }}
                  accessibilityLabel={`Gallery image ${i + 1} for ${event.title}`}
                />
              ))}
            </ScrollView>
          );
        })()}
        <View style={{ padding: 16 }}>
          <GradientHeader
            title={event.title}
            onBack={() => router.replace('/(tabs)/home')}
            backLabel="Back to home"
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
    </View>
  );
}
