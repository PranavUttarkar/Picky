import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Platform,
  UIManager,
  useWindowDimensions,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderSpacer from '@/components/HeaderSpacer';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import type { Event, EventVisibility } from '@/types/models';
import EventGridCard from '@/components/EventGridCard';
import EventRowCard from '@/components/EventRowCard';
import dayjs from 'dayjs';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ThreeDButton } from '@/components/ThreeD';
import { updateEvent, deleteEventDirect, createEvent } from '@/services/events';
import LocationPicker from '@/components/LocationPicker';
import { Ionicons } from '@expo/vector-icons';

export default function MyEvents() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const [items, setItems] = useState<Event[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [viewMode, setViewMode] = useState<'grid' | 'row'>(isWide ? 'grid' : 'row');
  const columns = viewMode === 'row' ? 1 : width >= 1280 ? 3 : isWide ? 2 : 1;

  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return router.replace('/onboarding/welcome');
      setUserId(user.id);
      const { data, error } = await supabase
        .from('events')
        .select(
          'id,title,date_time,location,description,tags,image_url,image_urls,rsvp_url,created_by,visibility,capacity,allow_join_requests',
        )
        .eq('created_by', user.id)
        .order('date_time', { ascending: true });
      if (!error) setItems((data ?? []) as Event[]);
    })();
  }, []);

  const [saved, setSaved] = useState<number[]>([]);
  useEffect(() => {
    (async () => {
      if (!userId) return;
      const se = await supabase.from('saved_events').select('event_id').eq('user_id', userId);
      setSaved((se.data ?? []).map((r: any) => r.event_id));
    })();
  }, [userId]);
  const savedSet = useMemo(() => new Set(saved), [saved]);

  const onToggleSave = async (eventId: number) => {
    if (!userId) return;
    const isSaved = savedSet.has(eventId);
    try {
      if (isSaved) {
        await supabase.from('saved_events').delete().match({ user_id: userId, event_id: eventId });
        setSaved((prev) => prev.filter((id) => id !== eventId));
      } else {
        await supabase.from('saved_events').insert({ user_id: userId, event_id: eventId });
        setSaved((prev) => [...prev, eventId]);
      }
    } catch {}
  };

  const Container: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <GradientBackground contentContainerStyle={{ flex: 1, padding: 12 }}>
      <AnimatedPage variant="fade-up" style={{ flex: 1 }}>
        {children}
      </AnimatedPage>
    </GradientBackground>
  );

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [mTitle, setMTitle] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mImage1, setMImage1] = useState('');
  const [mImage2, setMImage2] = useState('');
  const [mImage3, setMImage3] = useState('');
  const [mDateTime, setMDateTime] = useState(dayjs().add(1, 'day').toISOString());
  const [mLocation, setMLocation] = useState('');
  const [mLatitude, setMLatitude] = useState<number | null>(null);
  const [mLongitude, setMLongitude] = useState<number | null>(null);
  const [mTagsCsv, setMTagsCsv] = useState('');
  const [mRsvp, setMRsvp] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  // Organizer fields
  const [mVisibility, setMVisibility] = useState<EventVisibility>('public');
  const [mCapacity, setMCapacity] = useState('');
  const [mAllowJoinRequests, setMAllowJoinRequests] = useState(true);
  const [mRsvpRequired, setMRsvpRequired] = useState(false);

  const openEdit = (e: Event) => {
    setEditingId(e.id);
    setMTitle(e.title);
    setMDesc(e.description ?? '');
    const imgs = (e as any).image_urls ?? [];
    setMImage1(imgs[0] || e.image_url || '');
    setMImage2(imgs[1] || '');
    setMImage3(imgs[2] || '');
    setMDateTime(e.date_time);
    setMLocation(e.location ?? '');
    setMLatitude(e.latitude ?? null);
    setMLongitude(e.longitude ?? null);
    setMTagsCsv((e.tags ?? []).join(', '));
    setMRsvp((e as any).rsvp_url ?? '');
    // Organizer fields
    setMVisibility(e.visibility ?? 'public');
    setMCapacity(e.capacity?.toString() ?? '');
    setMAllowJoinRequests(e.allow_join_requests ?? true);
    setMRsvpRequired(e.rsvp_required ?? false);
    setEditOpen(true);
  };

  const openAdd = () => {
    setEditingId(null);
    setMTitle('');
    setMDesc('');
    setMImage1('');
    setMImage2('');
    setMImage3('');
    setMDateTime(dayjs().add(2, 'day').hour(18).minute(0).second(0).toISOString());
    setMLocation('');
    setMLatitude(null);
    setMLongitude(null);
    setMTagsCsv('');
    setMRsvp('');
    // Organizer fields - defaults
    setMVisibility('public');
    setMCapacity('');
    setMAllowJoinRequests(true);
    setMRsvpRequired(false);
    setEditOpen(true);
  };

  const submitEdit = async () => {
    const titleVal = mTitle.trim();
    if (!titleVal) {
      Alert.alert('Missing title', 'Please provide a title for the event.');
      return;
    }
    const dtIso = dayjs(mDateTime).isValid()
      ? dayjs(mDateTime).toISOString()
      : dayjs().add(1, 'day').toISOString();
    const tags = mTagsCsv
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    const imageUrls = [mImage1, mImage2, mImage3].map((s) => (s || '').trim()).filter(Boolean);
    if (!imageUrls.length) {
      Alert.alert('Add an image', 'Please add at least one image URL.');
      return;
    }
    // Parse capacity
    const capacityVal = mCapacity.trim() ? parseInt(mCapacity, 10) : null;
    if (mCapacity.trim() && (isNaN(capacityVal!) || capacityVal! < 1)) {
      Alert.alert('Invalid capacity', 'Capacity must be a positive number.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateEvent(editingId, {
          title: titleVal,
          description: mDesc.trim() || null,
          image_urls: imageUrls.length ? imageUrls : undefined,
          image_url: imageUrls[0] || undefined,
          date_time: dtIso,
          location: mLocation.trim() || null,
          latitude: mLatitude,
          longitude: mLongitude,
          tags,
          rsvp_url: mRsvp.trim() || null,
          visibility: mVisibility,
          capacity: capacityVal,
          allow_join_requests: mAllowJoinRequests,
          rsvp_required: mRsvpRequired,
        });
        setEditOpen(false);
        setItems((prev) =>
          prev
            .map((ev) =>
              ev.id === editingId
                ? ({
                    ...ev,
                    title: titleVal,
                    description: mDesc.trim() || null,
                    image_urls: imageUrls.length ? imageUrls : (ev as any).image_urls ?? null,
                    image_url: imageUrls[0] || (ev as any).image_url || null,
                    date_time: dtIso,
                    location: mLocation.trim() || null,
                    tags,
                    rsvp_url: mRsvp.trim() || null,
                    visibility: mVisibility,
                    capacity: capacityVal,
                    allow_join_requests: mAllowJoinRequests,
                    rsvp_required: mRsvpRequired,
                  } as Event)
                : ev,
            )
            .sort((a, b) => dayjs(a.date_time).valueOf() - dayjs(b.date_time).valueOf()),
        );
        Alert.alert('Updated', 'Your event was updated.');
      } else {
        const created = await createEvent({
          title: titleVal,
          description: mDesc.trim() || null,
          image_urls: imageUrls,
          image_url: imageUrls[0] || null,
          date_time: dtIso,
          location: mLocation.trim() || null,
          latitude: mLatitude,
          longitude: mLongitude,
          tags,
          rsvp_url: mRsvp.trim() || null,
          visibility: mVisibility,
          capacity: capacityVal,
          allow_join_requests: mAllowJoinRequests,
          rsvp_required: mRsvpRequired,
        });
        setEditOpen(false);
        setItems((prev) =>
          [...prev, created].sort(
            (a, b) => dayjs(a.date_time).valueOf() - dayjs(b.date_time).valueOf(),
          ),
        );
        Alert.alert('Created', 'Your event was created.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update event');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (eventId: number) => {
    Alert.alert('Delete event?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEventDirect(eventId);
            setItems((prev) => prev.filter((e) => e.id !== eventId));
            Alert.alert('Deleted', 'The event was deleted.');
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed to delete event');
          }
        },
      },
    ]);
  };

  return (
    <Container>
      {/* Top controls: layout toggle */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>My Events</Text>
          <Pressable
            onPress={openAdd}
            style={{
              backgroundColor: c.primary,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: '#000', fontWeight: '800' }}>Add Event</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: c.card, borderRadius: 10 }}>
          {[
            { k: 'row', label: 'List' },
            { k: 'grid', label: 'Grid' },
          ].map((opt) => {
            const active = viewMode === (opt.k as any);
            return (
              <Pressable
                key={opt.k}
                onPress={() => setViewMode(opt.k as any)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: active ? c.primary : 'transparent',
                }}
              >
                <Text style={{ color: active ? '#000' : c.text, fontWeight: '700' }}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <FlatList
        data={items}
        key={`layout-${columns}`}
        keyExtractor={(e) => String(e.id)}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
        contentContainerStyle={{ gap: 12, paddingBottom: 32, flexGrow: 1 }}
        renderItem={({ item }) => {
          const cardProps = {
            event: item,
            isSaved: savedSet.has(item.id),
            onToggleSave: onToggleSave,
            onOpenDetails: () => router.push(`/events/${item.id}`),
            onPoll: () => router.push({ pathname: '/polls/new', params: { fromEvent: item.id } }),
            onEdit: () => openEdit(item),
            onDelete: () => confirmDelete(item.id),
            onManage: () => router.push(`/events/${item.id}/manage`),
            isAdmin: true,
            showVisibilityBadge: true,
          } as const;
          if (columns > 1) {
            return (
              <View style={{ flex: 1 }}>
                <EventGridCard {...cardProps} />
              </View>
            );
          }
          return <EventRowCard {...cardProps} />;
        }}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <Text style={{ color: c.muted, fontSize: 16, marginBottom: 8 }}>
              You haven’t created any events yet.
            </Text>
            <Pressable
              onPress={() => router.replace('/(tabs)/events')}
              style={{
                backgroundColor: c.primary,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: '#000', fontWeight: '800' }}>Browse Events</Text>
            </Pressable>
          </View>
        }
      />

      {/* Edit Event Modal */}
      <Modal
        visible={editOpen}
        animationType="slide"
        onRequestClose={() => !saving && setEditOpen(false)}
      >
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.background }}>
          <HeaderSpacer />
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 12 }}>
              Edit event
            </Text>
            <TextInput
              placeholder="Title"
              placeholderTextColor={c.muted}
              value={mTitle}
              onChangeText={setMTitle}
              style={{
                color: c.text,
                backgroundColor: '#00000010',
                padding: 10,
                borderRadius: 8,
                marginBottom: 8,
              }}
            />
            <TextInput
              placeholder="Description"
              placeholderTextColor={c.muted}
              value={mDesc}
              onChangeText={setMDesc}
              multiline
              style={{
                color: c.text,
                backgroundColor: '#00000010',
                padding: 10,
                borderRadius: 8,
                minHeight: 80,
                marginBottom: 8,
              }}
            />
            {[
              { v: mImage1, s: setMImage1, l: 'Image 1 URL (cover)' },
              { v: mImage2, s: setMImage2, l: 'Image 2 URL' },
              { v: mImage3, s: setMImage3, l: 'Image 3 URL' },
            ].map((row, idx) => (
              <TextInput
                key={idx}
                placeholder={row.l}
                placeholderTextColor={c.muted}
                value={row.v}
                onChangeText={row.s as any}
                style={{
                  color: c.text,
                  backgroundColor: '#00000010',
                  padding: 10,
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              />
            ))}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={{
                  flex: 1,
                  backgroundColor: '#00000010',
                  padding: 10,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: c.text, fontWeight: '700' }}>
                  {dayjs(mDateTime).format('YYYY-MM-DD')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowTimePicker(true)}
                style={{
                  flex: 1,
                  backgroundColor: '#00000010',
                  padding: 10,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: c.text, fontWeight: '700' }}>
                  {dayjs(mDateTime).format('h:mm A')}
                </Text>
              </Pressable>
            </View>
            {showDatePicker ? (
              <DateTimePicker
                mode="date"
                value={new Date(mDateTime)}
                onChange={(evt, selectedDate) => {
                  setShowDatePicker(false);
                  if (!selectedDate) return;
                  const current = dayjs(mDateTime);
                  const merged = current
                    .year(selectedDate.getFullYear())
                    .month(selectedDate.getMonth())
                    .date(selectedDate.getDate());
                  setMDateTime(merged.toISOString());
                }}
              />
            ) : null}
            {showTimePicker ? (
              <DateTimePicker
                mode="time"
                value={new Date(mDateTime)}
                onChange={(evt, selectedTime) => {
                  setShowTimePicker(false);
                  if (!selectedTime) return;
                  const current = dayjs(mDateTime);
                  const merged = current
                    .hour(selectedTime.getHours())
                    .minute(selectedTime.getMinutes())
                    .second(0)
                    .millisecond(0);
                  setMDateTime(merged.toISOString());
                }}
              />
            ) : null}
            <LocationPicker
              value={mLocation}
              latitude={mLatitude}
              longitude={mLongitude}
              onLocationChange={(loc, lat, lng) => {
                setMLocation(loc);
                setMLatitude(lat);
                setMLongitude(lng);
              }}
              placeholder="Location"
              textColor={c.text}
              backgroundColor="#00000010"
              placeholderColor={c.muted}
            />
            <TextInput
              placeholder="Tags (comma-separated)"
              placeholderTextColor={c.muted}
              value={mTagsCsv}
              onChangeText={setMTagsCsv}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                color: c.text,
                backgroundColor: '#00000010',
                padding: 10,
                borderRadius: 8,
                marginBottom: 8,
              }}
            />
            <TextInput
              placeholder="RSVP URL (optional)"
              placeholderTextColor={c.muted}
              value={mRsvp}
              onChangeText={setMRsvp}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                color: c.text,
                backgroundColor: '#00000010',
                padding: 10,
                borderRadius: 8,
                marginBottom: 8,
              }}
            />

            {/* Organizer Settings Section */}
            <View style={{ 
              backgroundColor: c.card, 
              borderRadius: 12, 
              padding: 12, 
              marginBottom: 12,
              marginTop: 8,
            }}>
              <Text style={{ color: c.text, fontSize: 14, fontWeight: '700', marginBottom: 12 }}>
                Event Settings
              </Text>

              {/* Visibility toggle */}
              <Text style={{ color: c.muted, fontSize: 12, marginBottom: 6 }}>
                Event Visibility
              </Text>
              <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8 }}>
                {(['public', 'private'] as EventVisibility[]).map((vis) => (
                  <Pressable
                    key={vis}
                    onPress={() => setMVisibility(vis)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: mVisibility === vis ? c.primary : '#00000010',
                      paddingVertical: 10,
                      borderRadius: 8,
                      gap: 6,
                    }}
                  >
                    <Ionicons
                      name={vis === 'public' ? 'globe' : 'lock-closed'}
                      size={16}
                      color={mVisibility === vis ? '#000' : c.muted}
                    />
                    <Text style={{
                      color: mVisibility === vis ? '#000' : c.text,
                      fontWeight: '600',
                      textTransform: 'capitalize',
                    }}>
                      {vis}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Capacity */}
              <Text style={{ color: c.muted, fontSize: 12, marginBottom: 6 }}>
                Capacity (leave empty for unlimited)
              </Text>
              <TextInput
                placeholder="Unlimited"
                placeholderTextColor={c.muted}
                value={mCapacity}
                onChangeText={setMCapacity}
                keyboardType="number-pad"
                style={{
                  color: c.text,
                  backgroundColor: '#00000010',
                  padding: 10,
                  borderRadius: 8,
                  marginBottom: 12,
                }}
              />

              {/* Allow join requests (only for private events) */}
              {mVisibility === 'private' && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>
                      Allow Join Requests
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 11 }}>
                      Users can request to join your event
                    </Text>
                  </View>
                  <Switch
                    value={mAllowJoinRequests}
                    onValueChange={setMAllowJoinRequests}
                    trackColor={{ false: c.muted, true: c.primary }}
                  />
                </View>
              )}

              {/* RSVP Required toggle */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>
                    Require RSVP
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 11 }}>
                    Attendees must RSVP to attend this event
                  </Text>
                </View>
                <Switch
                  value={mRsvpRequired}
                  onValueChange={setMRsvpRequired}
                  trackColor={{ false: c.muted, true: c.primary }}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <ThreeDButton title={saving ? 'Saving…' : 'Save'} onPress={submitEdit} />
              <ThreeDButton title="Cancel" onPress={() => setEditOpen(false)} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Container>
  );
}
