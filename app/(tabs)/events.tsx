import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  SafeAreaView,
  Alert,
  Linking,
  Platform,
  LayoutAnimation,
  UIManager,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ThreeDButton, ThreeDCard } from '@/components/ThreeD';
import EventRowCard from '@/components/EventRowCard';
import EventGridCard from '@/components/EventGridCard';
import dayjs from 'dayjs';
import LazyImage from '@/components/LazyImage';
import EventImages from '@/components/EventImages';
import ImageGallery from '@/components/ImageGallery';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Chip from '@/components/Chip';
import { supabase } from '@/services/supabase';
import { optimisticUpdate } from '@/utils/optimistic';
import { sanitizeEventImageUrls } from '@/utils/images';
import { validateEventCopy, checkProfanity } from '@/utils/profanity';
import { router } from 'expo-router';
import type { Event } from '@/types/models';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSavedNotification } from '@/utils/SavedNotificationContext';
import { getMyGroups } from '@/services/groups';
import {
  createEvent,
  updateEvent,
  deleteEvent as adminDeleteEvent,
  deleteEventDirect,
  uploadEventImages,
  deleteEventImages,
} from '@/services/events';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

type AdminHeaderProps = {
  c: ReturnType<typeof useThemeColors>;
  isAdmin: boolean;
  adminOpen: boolean;
  setAdminOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingId: number | null;
  fTitle: string;
  setFTitle: (v: string) => void;
  fDesc: string;
  setFDesc: (v: string) => void;
  fImage1: string;
  setFImage1: (v: string) => void;
  fImage2: string;
  setFImage2: (v: string) => void;
  fImage3: string;
  setFImage3: (v: string) => void;
  fDateTime: string;
  setFDateTime: (v: string) => void;
  fLocation: string;
  setFLocation: (v: string) => void;
  fTagsCsv: string;
  setFTagsCsv: (v: string) => void;
  fRsvp: string;
  setFRsvp: (v: string) => void;
  showDatePicker: boolean;
  setShowDatePicker: (v: boolean) => void;
  showTimePicker: boolean;
  setShowTimePicker: (v: boolean) => void;
  upsertEvent: (values?: {
    title: string;
    desc: string;
    image: string;
    dateTime: string;
    location: string;
    tagsCsv: string;
    rsvp: string;
    editingId?: number | null;
  }) => void | Promise<void>;
  resetForm: () => void;
  events: Event[];
  deleteEvent: (id: number) => void;
};

// Keep this container at module scope so it doesn't remount on list updates
const EventsContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <GradientBackground contentContainerStyle={{ flex: 1, padding: 12 }}>
    <AnimatedPage variant="fade-up" style={{ flex: 1 }}>
      {children}
    </AnimatedPage>
  </GradientBackground>
);

const AdminHeader = memo(function AdminHeader(props: AdminHeaderProps) {
  const {
    c,
    isAdmin,
    adminOpen,
    setAdminOpen,
    editingId,
    fTitle,
    setFTitle,
    fDesc,
    setFDesc,
    fImage1,
    setFImage1,
    fImage2,
    setFImage2,
    fImage3,
    setFImage3,
    fDateTime,
    setFDateTime,
    fLocation,
    setFLocation,
    fTagsCsv,
    setFTagsCsv,
    fRsvp,
    setFRsvp,
    showDatePicker,
    setShowDatePicker,
    showTimePicker,
    setShowTimePicker,
    upsertEvent,
    resetForm,
    events,
    deleteEvent,
  } = props;

  // Local admin form state to avoid re-rendering parent on each keystroke
  const [titleLocal, setTitleLocal] = useState(fTitle);
  const [descLocal, setDescLocal] = useState(fDesc);
  const [image1Local, setImage1Local] = useState(fImage1);
  const [image2Local, setImage2Local] = useState(fImage2);
  const [image3Local, setImage3Local] = useState(fImage3);
  const [dateTimeLocal, setDateTimeLocal] = useState(fDateTime);
  const [locationLocal, setLocationLocal] = useState(fLocation);
  const [tagsCsvLocal, setTagsCsvLocal] = useState(fTagsCsv);
  const [rsvpLocal, setRsvpLocal] = useState(fRsvp);
  // Web-specific date/time text inputs (keep in sync with ISO state)
  const [dateInput, setDateInput] = useState(dayjs(fDateTime).format('YYYY-MM-DD'));
  const [timeInput, setTimeInput] = useState(dayjs(fDateTime).format('HH:mm'));

  useEffect(() => {
    setTitleLocal(fTitle);
    setDescLocal(fDesc);
    setImage1Local(fImage1);
    setImage2Local(fImage2);
    setImage3Local(fImage3);
    setDateTimeLocal(fDateTime);
    setDateInput(dayjs(fDateTime).format('YYYY-MM-DD'));
    setTimeInput(dayjs(fDateTime).format('HH:mm'));
    setLocationLocal(fLocation);
    setTagsCsvLocal(fTagsCsv);
    setRsvpLocal(fRsvp);
  }, [editingId, fTitle, fDesc, fImage1, fImage2, fImage3, fDateTime, fLocation, fTagsCsv, fRsvp]);

  return (
    <View style={{ paddingBottom: 12 }}>
      <View
        style={{
          backgroundColor: c.card,
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: '#00000020',
        }}
      >
        <Pressable onPress={() => setAdminOpen((v) => !v)}>
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>
            Admin: Manage Events: {adminOpen ? '▲' : '▼'}
          </Text>
        </Pressable>
        {adminOpen ? (
          <View style={{ marginTop: 8, gap: 8 }}>
            {editingId ? <Text style={{ color: c.muted }}>Editing event #{editingId}</Text> : null}
            <TextInput
              placeholder="Title"
              placeholderTextColor={c.muted}
              value={titleLocal}
              onChangeText={setTitleLocal}
              style={{ color: c.text, backgroundColor: '#00000010', padding: 10, borderRadius: 8 }}
              autoComplete="off"
              blurOnSubmit={false}
            />
            <TextInput
              placeholder="Description"
              placeholderTextColor={c.muted}
              value={descLocal}
              onChangeText={setDescLocal}
              multiline
              style={{
                color: c.text,
                backgroundColor: '#00000010',
                padding: 10,
                borderRadius: 8,
                minHeight: 60,
              }}
              autoComplete="off"
              blurOnSubmit={false}
            />
            <View style={{ gap: 6 }}>
              {[
                {
                  label: 'Image 1 URL (cover)',
                  value: image1Local,
                  setter: setImage1Local,
                },
                {
                  label: 'Image 2 URL',
                  value: image2Local,
                  setter: setImage2Local,
                },
                {
                  label: 'Image 3 URL',
                  value: image3Local,
                  setter: setImage3Local,
                },
              ].map((cfg, idx) => (
                <TextInput
                  key={idx}
                  placeholder={cfg.label}
                  placeholderTextColor={c.muted}
                  value={cfg.value}
                  onChangeText={cfg.setter}
                  style={{
                    color: c.text,
                    backgroundColor: '#00000010',
                    padding: 10,
                    borderRadius: 8,
                  }}
                  autoComplete="off"
                  blurOnSubmit={false}
                />
              ))}
              <Text style={{ color: c.muted, fontSize: 11 }}>
                Provide up to 3 images. First acts as card cover; others appear as thumbnails /
                gallery.
              </Text>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: c.text, fontWeight: '700' }}>Event Date & Time</Text>
              {Platform.OS === 'web' ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={c.muted}
                    value={dateInput}
                    onChangeText={(val) => {
                      setDateInput(val);
                      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                        const candidate = dayjs(`${val}T${timeInput}`);
                        if (candidate.isValid()) setDateTimeLocal(candidate.toISOString());
                      }
                    }}
                    style={{
                      flex: 1,
                      color: c.text,
                      backgroundColor: '#00000010',
                      padding: 10,
                      borderRadius: 8,
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TextInput
                    placeholder="HH:MM"
                    placeholderTextColor={c.muted}
                    value={timeInput}
                    onChangeText={(val) => {
                      setTimeInput(val);
                      if (/^\d{2}:\d{2}$/.test(val)) {
                        const candidate = dayjs(`${dateInput}T${val}`);
                        if (candidate.isValid()) setDateTimeLocal(candidate.toISOString());
                      }
                    }}
                    style={{
                      flex: 1,
                      color: c.text,
                      backgroundColor: '#00000010',
                      padding: 10,
                      borderRadius: 8,
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    style={{
                      flex: 1,
                      backgroundColor: '#00000010',
                      padding: 10,
                      borderRadius: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: c.text, fontWeight: '700' }}>
                      {dayjs(dateTimeLocal).format('YYYY-MM-DD')}
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
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: c.text, fontWeight: '700' }}>
                      {dayjs(dateTimeLocal).format('h:mm A')}
                    </Text>
                  </Pressable>
                </View>
              )}
              <Text style={{ color: c.muted, fontSize: 11 }}>
                Stored in UTC. For web, use 24h time (HH:MM). Example: 2025-09-30 and 18:30.
              </Text>
            </View>
            {showDatePicker ? (
              <DateTimePicker
                mode="date"
                value={new Date(dateTimeLocal)}
                onChange={(evt, selectedDate) => {
                  setShowDatePicker(false);
                  if (!selectedDate) return;
                  const current = dayjs(dateTimeLocal);
                  const merged = current
                    .year(selectedDate.getFullYear())
                    .month(selectedDate.getMonth())
                    .date(selectedDate.getDate());
                  setDateTimeLocal(merged.toISOString());
                }}
              />
            ) : null}
            {showTimePicker ? (
              <DateTimePicker
                mode="time"
                value={new Date(dateTimeLocal)}
                onChange={(evt, selectedTime) => {
                  setShowTimePicker(false);
                  if (!selectedTime) return;
                  const current = dayjs(dateTimeLocal);
                  const merged = current
                    .hour(selectedTime.getHours())
                    .minute(selectedTime.getMinutes())
                    .second(0)
                    .millisecond(0);
                  setDateTimeLocal(merged.toISOString());
                }}
              />
            ) : null}
            <TextInput
              placeholder="Location"
              placeholderTextColor={c.muted}
              value={locationLocal}
              onChangeText={setLocationLocal}
              style={{ color: c.text, backgroundColor: '#00000010', padding: 10, borderRadius: 8 }}
              autoComplete="off"
              blurOnSubmit={false}
            />
            <TextInput
              placeholder="Tags (comma-separated)"
              placeholderTextColor={c.muted}
              value={tagsCsvLocal}
              onChangeText={setTagsCsvLocal}
              style={{ color: c.text, backgroundColor: '#00000010', padding: 10, borderRadius: 8 }}
              autoCapitalize="none"
              autoComplete="off"
              blurOnSubmit={false}
            />
            <TextInput
              placeholder="RSVP URL (optional)"
              placeholderTextColor={c.muted}
              value={rsvpLocal}
              onChangeText={setRsvpLocal}
              style={{ color: c.text, backgroundColor: '#00000010', padding: 10, borderRadius: 8 }}
              autoCapitalize="none"
              autoComplete="off"
              blurOnSubmit={false}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <ThreeDButton
                title={editingId ? 'Update Event' : 'Create Event'}
                onPress={() =>
                  upsertEvent({
                    title: titleLocal,
                    desc: descLocal,
                    image: image1Local, // backward compat single field
                    dateTime: dateTimeLocal,
                    location: locationLocal,
                    tagsCsv: tagsCsvLocal,
                    rsvp: rsvpLocal,
                    editingId,
                  })
                }
              />
              {editingId ? <ThreeDButton title="Cancel" onPress={resetForm} /> : null}
            </View>
            <View style={{ marginTop: 8, gap: 8 }}>
              {events
                .filter((e: any) => e.id > 0)
                .slice(0, 8)
                .map((e: any) => (
                  <View
                    key={e.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: c.text }}>
                      #{e.id} · {e.title}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pressable
                        onPress={() => {
                          setFTitle(e.title);
                          setFDesc(e.description ?? '');
                          const imgs = (e as any).image_urls ?? [];
                          setFImage1(imgs[0] || e.image_url || '');
                          setFImage2(imgs[1] || '');
                          setFImage3(imgs[2] || '');
                          setFDateTime(e.date_time);
                          setFLocation(e.location ?? '');
                          setFTagsCsv((e.tags ?? []).join(', '));
                          setFRsvp(e.rsvp_url ?? '');
                        }}
                        style={{
                          backgroundColor: '#00000030',
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ color: c.text }}>Edit</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => deleteEvent(e.id)}
                        style={{
                          backgroundColor: '#ff444433',
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ color: '#ff5555' }}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
});

type FiltersTopBarProps = {
  c: ReturnType<typeof useThemeColors>;
  query: string;
  setQuery: (v: string) => void;
  mode: 'all' | 'personalized';
  setMode: React.Dispatch<React.SetStateAction<'all' | 'personalized'>>;
};

const FiltersTopBar = memo(function FiltersTopBar({
  c,
  query,
  setQuery,
  mode,
  setMode,
  onOpenAdd,
  isAuthed,
}: FiltersTopBarProps & { onOpenAdd: () => void; isAuthed: boolean }) {
  const inputRef = useRef<TextInput>(null);
  return (
    <View style={{ paddingBottom: 12 }}>
      <View
        style={{
          backgroundColor: c.card,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: '#00000020',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Focus search"
            // Keep simple tap area and let input hold focus
            style={{ padding: 4 }}
            onPress={() => {
              inputRef.current?.focus?.();
            }}
          >
            <Ionicons name="search" size={18} color={c.muted} />
          </Pressable>
          <TextInput
            ref={inputRef}
            placeholder="Search anything from 'free food' to 'tech'"
            placeholderTextColor={c.muted}
            value={query}
            onChangeText={setQuery}
            style={{ color: c.text, fontSize: 16, flex: 1 }}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          gap: 6,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            gap: 6,
            flexShrink: 1,
            backgroundColor: c.card,
            padding: 6,
            borderRadius: 12,
          }}
        >
          {[
            { key: 'all', label: 'Soonest' },
            { key: 'personalized', label: 'Personalized' },
          ].map((opt) => {
            const active = mode === (opt.key as any);
            return (
              <Pressable
                key={opt.key}
                onPress={() => setMode(opt.key as any)}
                style={{
                  backgroundColor: active ? c.primary : 'transparent',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: active ? '#000' : c.text, fontWeight: '700' }}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={onOpenAdd}
          style={{
            backgroundColor: c.primary,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
          }}
          accessibilityRole="link"
          accessibilityLabel={isAuthed ? 'Add Event' : 'Sign in to add event'}
        >
          <Text style={{ color: '#000' }}>Add Event</Text>
        </Pressable>
      </View>
    </View>
  );
});

type FiltersScrollableProps = {
  c: ReturnType<typeof useThemeColors>;
  myTags: string[];
  activeTags: string[];
  setActiveTags: React.Dispatch<React.SetStateAction<string[]>>;
  setMyTags: React.Dispatch<React.SetStateAction<string[]>>;
  allTags: string[];
  query: string;
  setQuery: (v: string) => void;
  filteredCount: number;
  mode: 'all' | 'personalized';
  isAuthed: boolean;
};

const FiltersScrollable = memo(function FiltersScrollable({
  c,
  myTags,
  activeTags,
  setActiveTags,
  setMyTags,
  allTags,
  query,
  setQuery,
  filteredCount,
  mode,
  isAuthed,
}: FiltersScrollableProps) {
  const [editing, setEditing] = useState(false);
  const [editTags, setEditTags] = useState<string[]>(myTags);
  const [newTagInput, setNewTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Sync when myTags changes externally (e.g., after profile edit)
  // Hooks must not be called conditionally; use a guarded effect instead.
  useEffect(() => {
    if (!editing && editTags !== myTags) {
      setEditTags(myTags);
    }
  }, [editing, editTags, myTags]);

  const normalize = (arr: string[]) =>
    arr
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 24);

  const commitInput = (raw: string) => {
    if (!raw) return;
    const parts = raw
      .split(/[\n,]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (!parts.length) return;
    setEditTags((prev) => normalize([...prev, ...parts]));
  };

  const removeTag = (t: string) => setEditTags((prev) => prev.filter((x) => x !== t));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      router.push('/onboarding/welcome');
      setSaving(false);
      return;
    }
    const arr = normalize(editTags);
    if (arr.length < 1) {
      setMsg('Add at least one interest.');
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from('user_interests_temp')
      .upsert({ user_id: user.id, names: arr });
    if (error) {
      setMsg(error.message);
    } else {
      setMyTags(arr);
      setMsg(`Saved ${arr.length} interest${arr.length === 1 ? '' : 's'}.`);
      setEditing(false);
    }
    setSaving(false);
  };

  return (
    <View style={{ paddingBottom: 12 }}>
      {myTags.length || editing ? (
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: '#00000020',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '800' }}>Your interests</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {editing ? (
                <Pressable
                  onPress={() => {
                    setEditing(false);
                    setEditTags(myTags);
                    setMsg(null);
                  }}
                  disabled={saving}
                  style={{
                    backgroundColor: '#00000030',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: c.text }}>Cancel</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  setEditing((v) => !v);
                  setMsg(null);
                }}
                disabled={saving}
                style={{
                  backgroundColor: editing ? c.primary : '#00000020',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: editing ? '#000' : c.text }}>
                  {editing ? (saving ? 'Saving…' : 'Editing') : 'Edit'}
                </Text>
              </Pressable>
            </View>
          </View>
          {editing ? (
            <View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {editTags.map((t) => (
                  <View
                    key={t}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      backgroundColor: c.primary,
                      borderRadius: 999,
                      gap: 4,
                    }}
                  >
                    <Text style={{ color: '#000', fontSize: 12, fontWeight: '700' }}>{t}</Text>
                    <Pressable onPress={() => removeTag(t)} accessibilityLabel={`Remove ${t}`}>
                      <Text style={{ color: '#000', fontWeight: '700' }}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
              <TextInput
                value={newTagInput}
                onChangeText={(val) => {
                  if (/[,\n]/.test(val)) {
                    commitInput(val);
                    setNewTagInput('');
                  } else {
                    setNewTagInput(val);
                  }
                }}
                onSubmitEditing={() => {
                  commitInput(newTagInput);
                  setNewTagInput('');
                }}
                placeholder={editTags.length ? 'Add another interest' : 'Add an interest'}
                placeholderTextColor={c.muted}
                style={{
                  backgroundColor: '#00000020',
                  color: c.text,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  fontSize: 14,
                }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                blurOnSubmit={false}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Pressable
                  onPress={save}
                  disabled={saving}
                  style={{
                    backgroundColor: saving ? c.muted : c.primary,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: '#000', fontWeight: '700' }}>
                    {saving ? 'Saving…' : 'Save'}
                  </Text>
                </Pressable>
                {editTags.length ? (
                  <Pressable
                    onPress={() => setEditTags([])}
                    disabled={saving}
                    style={{
                      backgroundColor: '#00000030',
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: c.text, fontWeight: '700' }}>Clear</Text>
                  </Pressable>
                ) : null}
              </View>
              {msg ? (
                <Text
                  style={{
                    marginTop: 6,
                    color: msg.startsWith('Saved') ? c.muted : '#ff6666',
                    fontSize: 12,
                  }}
                >
                  {msg}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {myTags.map((t, i) => {
                const active = activeTags.includes(t);
                return (
                  <Pressable
                    key={`${t}-${i}`}
                    onPress={() =>
                      setActiveTags((prev) =>
                        prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
                      )
                    }
                    style={{
                      backgroundColor: active ? c.primary : '#00000020',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ color: active ? '#000' : c.text, fontSize: 12 }}>#{t}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ) : !isAuthed ? (
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: '#00000020',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '800' }}>Your interests</Text>
          </View>
          <Text style={{ color: c.muted }}>Personalize your event feed by adding interests.</Text>
          <Pressable
            onPress={() => router.push('/onboarding/welcome')}
            style={{ marginTop: 8 }}
            accessibilityRole="link"
            accessibilityLabel="Create account to add interests"
          >
            <Text style={{ color: c.primary, fontWeight: '700', textDecorationLine: 'underline' }}>
              Create account to add interests
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Predefined filter tags */}
      <View
        style={{
          backgroundColor: c.card,
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: '#00000020',
        }}
      >
        <Text style={{ color: c.text, fontWeight: '800', marginBottom: 8 }}>Filter by tags</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {['culture', 'engineering', 'business', 'live music'].map((tag) => {
            const active = activeTags.includes(tag);
            const predefinedTags = ['culture', 'engineering', 'business', 'live music'];
            return (
              <Pressable
                key={tag}
                onPress={() =>
                  setActiveTags((prev) => {
                    if (prev.includes(tag)) {
                      // If this tag is already active, remove it
                      return prev.filter((x) => x !== tag);
                    } else {
                      // Remove any other predefined tags and add this one
                      const withoutPredefined = prev.filter((x) => !predefinedTags.includes(x));
                      return [...withoutPredefined, tag];
                    }
                  })
                }
                style={{
                  backgroundColor: active ? c.primary : '#00000020',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: active ? '#000' : c.text, fontSize: 14, fontWeight: '600' }}>
                  {tag.charAt(0).toUpperCase() + tag.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Hide global/all tags chips below; only show 'Your interests' above */}

      {/* <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: c.muted }}>
          Showing {filteredCount} {filteredCount === 1 ? 'event' : 'events'}
        </Text>
        {mode === 'personalized' ? (
          <Text style={{ color: c.muted }}>Sorted by match</Text>
        ) : (
          <Text style={{ color: c.muted }}>Soonest first</Text>
        )}
      </View> */}
    </View>
  );
});

export default function Home() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const { width } = useWindowDimensions();
  const { triggerNotification } = useSavedNotification();
  const isWide = width >= 900; // switch to grid on larger screens
  const columns = width >= 1280 ? 3 : isWide ? 2 : 1;
  const listRef = useRef<FlatList<Event>>(null);
  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 30 });
  const lastVisibleIndexRef = useRef(0);
  const filteredLengthRef = useRef(0);
  const [events, setEvents] = useState<Event[]>([]);
  const [myTags, setMyTags] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [saved, setSaved] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [mode, setMode] = useState<'all' | 'personalized'>('personalized');
  const [isAdmin, setIsAdmin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Modal state for event details
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Confirm delete modal state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  // Track which card is expanded; collapsed shows truncated description + hint
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  // Admin form state
  const [adminOpen, setAdminOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fImage1, setFImage1] = useState('');
  const [fImage2, setFImage2] = useState('');
  const [fImage3, setFImage3] = useState('');
  const [fDateTime, setFDateTime] = useState(
    dayjs().add(1, 'day').hour(18).minute(0).second(0).toISOString(),
  );
  const [fLocation, setFLocation] = useState('');
  const [fTagsCsv, setFTagsCsv] = useState('');
  const [fRsvp, setFRsvp] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Pagination + caching
  const PAGE_SIZE = 15;
  const CACHE_KEY = 'events_cache_v1';
  // Removed dummy/placeholder events: feed now reflects only real upcoming events

  const saveCache = async (items: Event[]) => {
    try {
      const payload = { ts: Date.now(), items };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {}
  };

  const loadCache = async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.items)) {
        setEvents(parsed.items as Event[]);
      }
    } catch {}
  };

  const fetchPage = async (pageIndex: number): Promise<Event[]> => {
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('events')
      .select(
        'id,title,description,image_url,image_urls,date_time,location,tags,rsvp_url,created_by',
      )
      .gte('date_time', new Date().toISOString())
      .order('date_time', { ascending: true })
      .range(from, to);
    if (error) return [] as Event[];
    return (data ?? []) as Event[];
  };

  const loadFirstPage = async () => {
    setIsFetching(true);
    try {
      const first = await fetchPage(0);
      const hasMoreNow = first.length === PAGE_SIZE;
      setEvents(first as Event[]);
      setHasMore(hasMoreNow);
      await saveCache(first as Event[]);
      setPage(1);
    } finally {
      setIsFetching(false);
    }
  };

  const loadNextPage = async () => {
    if (isFetching || !hasMore) return;
    setIsFetching(true);
    try {
      const next = await fetchPage(page);
      if (next.length === 0) {
        setHasMore(false);
      } else {
        setEvents((prev) => {
          const map = new Map<number, Event>();
          for (const e of prev) map.set((e as any).id, e as Event);
          for (const e of next as any[]) map.set((e as any).id, e as Event);
          const merged = Array.from(map.values()).sort(
            (a: any, b: any) => dayjs(a.date_time).valueOf() - dayjs(b.date_time).valueOf(),
          );
          saveCache(merged);
          return merged;
        });
        if (next.length < PAGE_SIZE) setHasMore(false);
        setPage((p) => p + 1);
      }
    } finally {
      setIsFetching(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    await loadFirstPage();
    setRefreshing(false);
  };

  useEffect(() => {
    // Load cached first for instant paint, then fetch
    loadCache().finally(() => {
      loadFirstPage();
    });
    // Load user-specific info
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        setIsAuthed(false);
        return; // guests can still see events; just skip personalized data
      }
      setIsAuthed(true);
      setCurrentUserId(user.id);
      // Admin detection
      const { data: urow } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();
      setIsAdmin(!!urow?.is_admin);

      const { data } = await supabase
        .from('user_interests_temp')
        .select('names')
        .eq('user_id', user.id)
        .maybeSingle();
      setMyTags(((data?.names as any) ?? []).map((t: string) => t.toLowerCase()));

      const se = await supabase.from('saved_events').select('event_id').eq('user_id', user.id);
      setSaved((se.data ?? []).map((r: any) => r.event_id));

      // Fetch personal scoring from Supabase RPC (secure function)
      const { data: rpcScores } = await supabase.rpc('get_user_event_scores');
      if (rpcScores) {
        const map: Record<number, number> = {};
        for (const row of rpcScores as any[]) {
          map[Number(row.event_id)] = Number(row.match_percent);
        }
        setScores(map);
      }
    })();
  }, []);

  // (moved) Keep a ref of the current filtered length for viewability callback

  // Prefetch the next page when user scrolls near the end
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index?: number | null }> }) => {
      const maxIndex = Math.max(
        0,
        ...viewableItems.map((v) => (typeof v.index === 'number' ? (v.index as number) : 0)),
      );
      if (maxIndex > lastVisibleIndexRef.current) {
        lastVisibleIndexRef.current = maxIndex;
        const remaining = filteredLengthRef.current - maxIndex - 1;
        // If within 8 items from the end, start loading next page early
        if (remaining <= 8) {
          loadNextPage();
        }
      }
    },
  );

  const requireAuth = async (): Promise<boolean> => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      router.push('/onboarding/welcome');
      return false;
    }
    return true;
  };

  const handlePollCreation = async (eventId: number) => {
    const authed = await requireAuth();
    if (!authed) return;

    try {
      const groups = await getMyGroups();

      if (groups.length === 0) {
        Alert.alert(
          'Join a Group First!',
          'Polls are more fun with friends! Join or create a group to start polling about events with your crew.',
          [
            { text: 'Maybe Later', style: 'cancel' },
            {
              text: 'Find Groups',
              onPress: () => {
                router.push('/groups');
              },
              style: 'default',
            },
          ],
        );
        return;
      }
      // User has groups, proceed with poll creation
      router.push({ pathname: '/polls/new', params: { fromEvent: eventId } });
    } catch (error) {
      Alert.alert('Error', 'Failed to check group membership. Please try again.');
    }
  };

  const toggleSave = async (id: number) => {
    const authed = await requireAuth();
    if (!authed) return;
    const user = (await supabase.auth.getUser()).data.user!;
    const isSaved = saved.includes(id);
    await optimisticUpdate({
      apply: () => {
        const prev = saved;
        setSaved((s) => (isSaved ? s.filter((x) => x !== id) : [...s, id]));
        return prev;
      },
      rollback: (prev) => setSaved(prev),
      mutate: async () => {
        if (isSaved) {
          const { error } = await supabase
            .from('saved_events')
            .delete()
            .eq('user_id', user.id)
            .eq('event_id', id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('saved_events')
            .insert({ user_id: user.id, event_id: id });
          if (error) throw error;
          // Trigger notification for new saved item
          await triggerNotification();
        }
      },
    });
  };
  const savedSet = useMemo(() => new Set(saved), [saved]);

  const match = (eventId: number, tags?: string[]) => {
    // Prefer server-computed score when available
    const fromServer = scores[eventId];
    if (typeof fromServer === 'number') return fromServer;

    // Local fallback with 50% baseline + additive bonuses
    const baseline = 50; // All events start at 50%
    let finalScore = baseline;

    // Add interest bonus (0-35%) if there are tags to compare
    if (tags && tags.length > 0 && myTags.length > 0) {
      // Normalize case to ensure case-insensitive comparisons
      const uniqueEvent = Array.from(new Set(tags.map((t) => t.toLowerCase())));
      const uniqueUser = Array.from(new Set(myTags.map((t) => t.toLowerCase())));
      const e = uniqueEvent.length;
      const u = uniqueUser.length;

      if (e > 0 && u > 0) {
        let inter = 0;
        for (const t of uniqueEvent) if (uniqueUser.includes(t)) inter++;

        if (inter > 0) {
          const coverage = inter / e; // how much of event is covered
          const affinity = inter / Math.sqrt(e * u); // cosine-like
          const dice = (2 * inter) / (e + u);

          // Interest bonus: blend components and scale to 0-35%
          const interestBonus = (0.4 * coverage + 0.35 * affinity + 0.25 * dice) * 35;
          finalScore += Math.max(0, Math.min(35, interestBonus));
        }
      }
    }

    // Add recency bonus (0-15%) for events happening soon
    const eventObj = events.find((ev: any) => ev.id === eventId);
    if (eventObj?.date_time) {
      const dt = dayjs(eventObj.date_time);
      if (dt.isAfter(dayjs())) {
        const horizon = 14;
        const daysAhead = Math.min(horizon, Math.max(0, dt.diff(dayjs(), 'day')));
        const recencyFactor = (horizon - daysAhead) / horizon; // 1 today -> 0 at horizon
        const recencyBonus = recencyFactor * 15; // 0-15% bonus
        finalScore += Math.max(0, Math.min(15, recencyBonus));
      }
    }

    // Cap at 100% and return as integer
    return Math.max(50, Math.min(100, Math.round(finalScore)));
  };

  // Parse query to extract hashtags as tag filters and plain text terms
  const parseQuery = (q: string) => {
    const tags: string[] = [];
    const words: string[] = [];
    for (const token of q.split(/\s+/).filter(Boolean)) {
      if (token.startsWith('#') && token.length > 1) {
        tags.push(token.slice(1).toLowerCase());
      } else {
        words.push(token.toLowerCase());
      }
    }
    return { tags, words };
  };

  const { tags: queryTags, words: queryWords } = parseQuery(query);

  // Build tag universe from currently loaded events
  const allTags: string[] = Array.from(
    new Set(events.flatMap((e: any) => (e.tags ?? []).map((t: string) => t))),
  ).sort((a, b) => a.localeCompare(b));

  // Derived filtered list based on text and tag filters
  const filteredBase = events.filter((e: any) => {
    // Tag match: all queryTags must be present (case-insensitive)
    const lowerEventTags = (e.tags ?? []).map((t: string) => t.toLowerCase());
    if (queryTags.length) {
      const et = (e.tags ?? []).map((t: string) => t.toLowerCase());
      for (const t of queryTags) if (!et.includes(t)) return false;
    }
    // Also apply active tag chip filters (AND logic)
    if (activeTags.length) {
      for (const t of activeTags.map((t) => t.toLowerCase()))
        if (!lowerEventTags.includes(t)) return false;
    }
    // Text match on title/description/location
    if (queryWords.length) {
      const hay = `${e.title} ${e.description ?? ''} ${e.location ?? ''}`.toLowerCase();
      for (const w of queryWords) if (!hay.includes(w)) return false;
    }
    return true;
  });

  // Apply mode-specific sorting/filtering
  const filtered = [...filteredBase].sort((a: any, b: any) => {
    if (mode === 'personalized') {
      return match(b.id, b.tags) - match(a.id, a.tags);
    }
    // Default: chronological by date_time
    return dayjs(a.date_time).valueOf() - dayjs(b.date_time).valueOf();
  });

  // Admin: reset form helper
  const resetForm = () => {
    setEditingId(null);
    setFTitle('');
    setFDesc('');
    setFImage1('');
    setFImage2('');
    setFImage3('');
    setFDateTime(dayjs().add(1, 'day').hour(18).minute(0).second(0).toISOString());
    setFLocation('');
    setFTagsCsv('');
    setFRsvp('');
  };

  const upsertEvent = async (values?: {
    title: string;
    desc: string;
    image: string;
    dateTime: string;
    location: string;
    tagsCsv: string;
    rsvp: string;
    editingId?: number | null;
  }) => {
    // Basic validation
    const titleVal = values?.title ?? fTitle;
    const descVal = values?.desc ?? fDesc;
    const imageVal = values?.image ?? fImage1; // legacy single field
    const dateTimeVal = values?.dateTime ?? fDateTime;
    const locationVal = values?.location ?? fLocation;
    const tagsCsvVal = values?.tagsCsv ?? fTagsCsv;
    const rsvpVal = values?.rsvp ?? fRsvp;
    const editingIdVal = values?.editingId ?? editingId;

    if (!titleVal.trim()) {
      Alert.alert('Missing title', 'Please provide a title for the event.');
      return;
    }
    const profanityErr = validateEventCopy(titleVal.trim(), descVal);
    if (profanityErr) {
      Alert.alert('Inappropriate content', profanityErr);
      return;
    }
    // Require at least one image URL in admin flow
    const hasAnyAdminImage = [fImage1, fImage2, fImage3].some((s) => !!s && s.trim().length > 0);
    if (!hasAnyAdminImage) {
      Alert.alert('Add an image', 'Please add at least one image URL for the event.');
      return;
    }
    const dtIso = dayjs(dateTimeVal).isValid()
      ? dayjs(dateTimeVal).toISOString()
      : dayjs().add(1, 'day').toISOString();
    const tags = tagsCsvVal
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Not signed in', 'You must be signed in as admin.');
      return;
    }
    const { cleaned: imageUrls, errors: imageErrors } = sanitizeEventImageUrls([
      fImage1,
      fImage2,
      fImage3,
    ]);
    if (imageErrors.length) {
      Alert.alert('Image issues', imageErrors.join('\n'));
    }
    const payload: any = {
      title: titleVal.trim(),
      description: descVal.trim() || null,
      image_urls: imageUrls.length ? imageUrls : imageVal.trim() ? [imageVal.trim()] : null,
      image_url: imageUrls[0] || imageVal.trim() || null,
      date_time: dtIso,
      location: locationVal.trim() || null,
      tags,
      rsvp_url: rsvpVal.trim() || null,
    };
    if (editingIdVal) {
      const { error } = await supabase.from('events').update(payload).eq('id', editingIdVal);
      if (error) {
        Alert.alert('Update failed', error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('events').insert({ ...payload, created_by: user.id });
      if (error) {
        Alert.alert('Create failed', error.message);
        return;
      }
    }
    resetForm();
    await onRefresh();
    Alert.alert('Success', editingIdVal ? 'Event updated' : 'Event created');
  };

  // Open cross-platform confirmation modal
  const deleteEvent = (id: number) => {
    setDeleteTargetId(id);
    const found = events.find((e: any) => e.id === id) as Event | undefined;
    setDeleteTarget(found ?? null);
    setConfirmDeleteOpen(true);
  };

  const performDelete = async () => {
    if (!deleteTargetId) return;
    try {
      setIsDeleting(true);
      const owner = deleteTarget && (deleteTarget as any).created_by === currentUserId;
      if (isAdmin) {
        await adminDeleteEvent(deleteTargetId);
      } else if (owner) {
        await deleteEventDirect(deleteTargetId);
      } else {
        Alert.alert('Not allowed', 'You can only delete events you created.');
        return;
      }
      // Best-effort: remove uploaded images if we stored storage paths
      const paths: string[] | undefined = (deleteTarget as any)?.image_storage_paths;
      if (paths?.length) {
        try {
          await deleteEventImages(paths);
        } catch {}
      }
      setConfirmDeleteOpen(false);
      setDeleteTargetId(null);
      setDeleteTarget(null);
      await onRefresh();
      Alert.alert('Deleted', 'The event was deleted.');
    } finally {
      setIsDeleting(false);
    }
  };

  const onOpenDetails = async (item: Event) => {
    const { data } = await supabase.from('events').select('*').eq('id', item.id).maybeSingle();
    setSelectedEvent((data ?? item) as Event);
    setDetailsOpen(true);
  };

  const prefillForEdit = (e: Event) => {
    setAdminOpen(true);
    setEditingId(e.id);
    setFTitle(e.title);
    setFDesc(e.description ?? '');
    const imgs = (e as any).image_urls ?? [];
    setFImage1(imgs[0] || e.image_url || '');
    setFImage2(imgs[1] || '');
    setFImage3(imgs[2] || '');
    setFDateTime(e.date_time);
    setFLocation(e.location ?? '');
    setFTagsCsv((e.tags ?? []).map((t: string) => t.toLowerCase()).join(', '));
    setFRsvp(e.rsvp_url ?? '');
    // Scroll to top to reveal the admin panel
    listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
  };

  // Container moved to module scope above (EventsContainer)

  // Admin header memo: only depends on admin form state, not search
  const adminHeader = useMemo(
    () =>
      isAdmin ? (
        <AdminHeader
          c={c}
          isAdmin={isAdmin}
          adminOpen={adminOpen}
          setAdminOpen={setAdminOpen}
          editingId={editingId}
          fTitle={fTitle}
          setFTitle={setFTitle}
          fDesc={fDesc}
          setFDesc={setFDesc}
          fImage1={fImage1}
          setFImage1={setFImage1}
          fImage2={fImage2}
          setFImage2={setFImage2}
          fImage3={fImage3}
          setFImage3={setFImage3}
          fDateTime={fDateTime}
          setFDateTime={setFDateTime}
          fLocation={fLocation}
          setFLocation={setFLocation}
          fTagsCsv={fTagsCsv}
          setFTagsCsv={setFTagsCsv}
          fRsvp={fRsvp}
          setFRsvp={setFRsvp}
          showDatePicker={showDatePicker}
          setShowDatePicker={setShowDatePicker}
          showTimePicker={showTimePicker}
          setShowTimePicker={setShowTimePicker}
          upsertEvent={upsertEvent}
          resetForm={resetForm}
          events={events}
          deleteEvent={deleteEvent}
        />
      ) : null,
    [
      c,
      isAdmin,
      adminOpen,
      editingId,
      fTitle,
      fDesc,
      fImage1,
      fImage2,
      fImage3,
      fDateTime,
      fLocation,
      fTagsCsv,
      fRsvp,
      showDatePicker,
      showTimePicker,
      events,
    ],
  );

  // TODO: Replace current vertical card layout with horizontal row cards (EventRowCard component)
  // New layout plan:
  //  - Left: square/16:9 thumb (first image) using EventImages with maxDisplay=1 or a dedicated thumb
  //  - Right: title, date/time, location, tags (single-line truncated), actions row
  //  - Keep expand for description reveal below row or in modal

  // Filters: top bar outside list, interests/tags/results inside list header
  // Add/Edit Event modal state
  const [addOpen, setAddOpen] = useState(false);
  const [editEventId, setEditEventId] = useState<number | null>(null);
  const [mTitle, setMTitle] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mImage1, setMImage1] = useState('');
  const [mImage2, setMImage2] = useState('');
  const [mImage3, setMImage3] = useState('');
  const [pickedUris, setPickedUris] = useState<string[]>([]);
  const [mDateTime, setMDateTime] = useState(
    dayjs().add(2, 'day').hour(18).minute(0).second(0).toISOString(),
  );
  const [mLocation, setMLocation] = useState('');
  const [mTagsCsv, setMTagsCsv] = useState('');
  const [mRsvp, setMRsvp] = useState('');
  const [mShowDatePicker, setMShowDatePicker] = useState(false);
  const [mShowTimePicker, setMShowTimePicker] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);

  const openAddModal = async () => {
    const ok = await requireAuth();
    if (!ok) return;
    setEditEventId(null);
    setMTitle('');
    setMDesc('');
    setMImage1('');
    setMImage2('');
    setMImage3('');
    setPickedUris([]);
    setMDateTime(dayjs().add(2, 'day').hour(18).minute(0).second(0).toISOString());
    setMLocation('');
    setMTagsCsv('');
    setMRsvp('');
    setAddOpen(true);
  };

  const openEditModal = async (e: Event) => {
    const ok = await requireAuth();
    if (!ok) return;
    setEditEventId(e.id);
    setMTitle(e.title);
    setMDesc(e.description ?? '');
    const imgs = (e as any).image_urls ?? [];
    setMImage1(imgs[0] || e.image_url || '');
    setMImage2(imgs[1] || '');
    setMImage3(imgs[2] || '');
    setPickedUris([]);
    setMDateTime(e.date_time);
    setMLocation(e.location ?? '');
    setMTagsCsv((e.tags ?? []).join(', '));
    setMRsvp((e as any).rsvp_url ?? '');
    setAddOpen(true);
  };

  // Memoize typed URL previews so unrelated state changes don't re-create arrays
  const typedUrls = useMemo(
    () => [mImage1, mImage2, mImage3].map((s) => (s || '').trim()).filter(Boolean),
    [mImage1, mImage2, mImage3],
  );

  const submitModal = async () => {
    const titleVal = mTitle.trim();
    if (!titleVal) {
      Alert.alert('Missing title', 'Please give your event a title.');
      return;
    }
    // Profanity validation (client-side)
    const profanityErr = validateEventCopy(titleVal, mDesc);
    if (profanityErr) {
      Alert.alert('Inappropriate content', profanityErr);
      return;
    }
    // Require at least one image (picked or URL)
    const hasPicked = pickedUris.length > 0;
    const hasUrl = [mImage1, mImage2, mImage3].some((s) => !!s && s.trim().length > 0);
    if (!hasPicked && !hasUrl) {
      Alert.alert(
        'Add an image',
        'Please add at least one image by pasting a URL or picking a photo.',
      );
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
    const { cleaned: imageUrlsFromText, errors: imageErrors } = sanitizeEventImageUrls([
      mImage1,
      mImage2,
      mImage3,
    ]);
    if (imageErrors.length) Alert.alert('Image issues', imageErrors.join('\n'));
    // Upload any picked photos, then merge with typed URLs (dedupe and cap at 3)
    let uploadedUrls: string[] = [];
    if (pickedUris.length) {
      try {
        const limited = pickedUris.slice(0, 3);
        const compressedUris: string[] = [];
        for (const uri of limited) {
          try {
            const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1440 } }], {
              // Improve quality to reduce blurriness, especially on web
              compress: 0.9,
              format: ImageManipulator.SaveFormat.JPEG,
            });
            compressedUris.push(out.uri);
          } catch {
            compressedUris.push(uri);
          }
        }
        uploadedUrls = await uploadEventImages(compressedUris);
      } catch (e: any) {
        Alert.alert('Upload failed', e?.message ?? 'Could not upload images');
        return;
      }
    }
    // Merge sources: prefer picked photos first, then typed URLs; dedupe; cap at 3
    const merged = [...uploadedUrls, ...imageUrlsFromText];
    const seen = new Set<string>();
    const finalImages = merged
      .map((u) => (u || '').trim())
      .filter((u) => {
        if (!u) return false;
        const key = u.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);
    if (!finalImages.length) {
      Alert.alert(
        'Add an image',
        'Please add at least one valid image by pasting a URL or picking a photo.',
      );
      return;
    }
    const payload = {
      title: titleVal,
      description: mDesc.trim() || null,
      image_urls: finalImages,
      image_url: finalImages[0] || null,
      date_time: dtIso,
      location: mLocation.trim() || null,
      tags,
      rsvp_url: mRsvp.trim() || null,
    };
    setSavingEvent(true);
    try {
      if (editEventId) {
        await updateEvent(editEventId, payload);
        Alert.alert('Updated', 'Your event was updated.');
      } else {
        await createEvent(payload);
        Alert.alert('Created', 'Your event was created.');
      }
      setAddOpen(false);
      await onRefresh();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save event');
    } finally {
      setSavingEvent(false);
    }
  };

  // Gradient bordered match badge
  const MatchBadge: React.FC<{ value: number }> = ({ value }) => (
    <LinearGradient
      colors={['#34d399', '#3b82f6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ padding: 1.5, borderRadius: 999 }}
    >
      <View
        style={{
          backgroundColor: scheme === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.6)',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: c.text, fontWeight: '800' }}>
          {value}% Match{value > 65 ? '!' : ''}
        </Text>
      </View>
    </LinearGradient>
  );

  // Filters header elements (top bar + scrollable interests/tags) — define after openAddModal
  const filtersTopBar = useMemo(
    () => (
      <FiltersTopBar
        c={c}
        query={query}
        setQuery={setQuery}
        mode={mode}
        setMode={setMode}
        onOpenAdd={openAddModal}
        isAuthed={isAuthed}
      />
    ),
    [c, query, mode, isAuthed],
  );

  const filtersScrollable = useMemo(
    () => (
      <FiltersScrollable
        c={c}
        myTags={myTags}
        activeTags={activeTags}
        setActiveTags={setActiveTags}
        setMyTags={setMyTags}
        allTags={allTags}
        query={query}
        setQuery={setQuery}
        filteredCount={filtered.length}
        mode={mode}
        isAuthed={isAuthed}
      />
    ),
    [c, myTags, activeTags, allTags, query, filtered.length, mode, isAuthed],
  );

  return (
    <EventsContainer>
      {adminHeader}
      {filtersTopBar}
      <FlatList
        ref={listRef}
        data={filtered}
        key={`layout-${columns}`}
        keyExtractor={(e: any) => String(e.id)}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
        contentContainerStyle={{ gap: 12, paddingBottom: 32 }}
        ListHeaderComponent={filtersScrollable}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReachedThreshold={0.6}
        onEndReached={loadNextPage}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfigRef.current}
        initialNumToRender={8}
        maxToRenderPerBatch={columns > 1 ? 12 : 10}
        windowSize={12}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          <View style={{ paddingTop: 48, alignItems: 'center' }}>
            <Text style={{ color: c.muted, marginBottom: 8 }}>No events match your filters</Text>
            <ThreeDButton
              title="Reset filters"
              onPress={() => {
                setQuery('');
                setActiveTags([]);
                setMode('all');
              }}
            />
          </View>
        }
        ListFooterComponent={
          isFetching && hasMore ? (
            <View style={{ paddingVertical: 16, gap: 12 }}>
              {[...Array(Math.max(1, columns))].map((_, row) => (
                <View key={row} style={{ flexDirection: 'row', gap: 12 }}>
                  {[...Array(columns)].map((__, col) => (
                    <View
                      key={`${row}-${col}`}
                      style={{
                        flex: 1,
                        height: columns > 1 ? 260 : 110,
                        backgroundColor: '#00000010',
                        borderRadius: 12,
                        overflow: 'hidden',
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isOwner = currentUserId && (item as any).created_by === currentUserId;
          const cardProps = {
            event: item,
            isSaved: savedSet.has(item.id),
            onToggleSave: toggleSave,
            onOpenDetails: () => onOpenDetails(item),
            onPoll: item.id > 0 ? () => handlePollCreation(item.id) : undefined,
            onEdit:
              (isAdmin || isOwner) && item.id > 0
                ? () => (isOwner ? openEditModal(item) : prefillForEdit(item))
                : undefined,
            onDelete: (isAdmin || isOwner) && item.id > 0 ? () => deleteEvent(item.id) : undefined,
            isAdmin: isAdmin || !!isOwner,
            matchPercent: match(item.id, item.tags),
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
      />

      {/* Event Details Modal */}
      <Modal
        visible={detailsOpen}
        animationType="slide"
        onRequestClose={() => setDetailsOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
          <BlurView
            intensity={30}
            tint={scheme === 'dark' ? 'dark' : 'light'}
            style={{ padding: 12 }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Event details</Text>
              <Pressable
                onPress={() => setDetailsOpen(false)}
                style={{
                  backgroundColor: '#00000020',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                }}
              >
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>
          </BlurView>
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            {(() => {
              const imgs: string[] = (selectedEvent as any)?.image_urls?.length
                ? (selectedEvent as any).image_urls
                : selectedEvent?.image_url
                ? [selectedEvent.image_url]
                : [];
              if (!imgs.length) return null;
              return (
                <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                  <ImageGallery images={imgs} showArrows />
                </View>
              );
            })()}
            <View style={{ padding: 16 }}>
              <Text style={{ color: c.text, fontSize: 24, fontWeight: '800' }}>
                {selectedEvent?.title}
              </Text>
              <Text style={{ color: c.muted, marginTop: 4 }}>
                {selectedEvent ? dayjs(selectedEvent.date_time).format('ddd, MMM D • h:mm A') : ''}
                {selectedEvent?.location ? ` • ${selectedEvent.location}` : ''}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 8,
                }}
              >
                {(selectedEvent?.tags ?? []).map((t, i) => (
                  <View
                    key={`${t}-${i}`}
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
              {selectedEvent?.description ? (
                <Text style={{ color: c.text, marginTop: 12 }}>{selectedEvent.description}</Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                {selectedEvent?.id && selectedEvent.id > 0 ? (
                  <Pressable
                    onPress={() => {
                      // simple add-to-calendar using ICS deep link (fallback)
                      const title = encodeURIComponent(selectedEvent!.title);
                      const start = dayjs(selectedEvent!.date_time).toISOString();
                      const end = dayjs(selectedEvent!.date_time).add(2, 'hour').toISOString();
                      const details = encodeURIComponent(selectedEvent!.description ?? '');
                      const location = encodeURIComponent(selectedEvent!.location ?? '');
                      const href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start
                        .replace(/[-:\.]/g, '')
                        .replace('.000Z', 'Z')}/${end
                        .replace(/[-:\.]/g, '')
                        .replace('.000Z', 'Z')}&details=${details}&location=${location}`;
                      Linking.openURL(href);
                    }}
                    style={{
                      backgroundColor: c.primary,
                      padding: 12,
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ color: '#000', fontWeight: '700' }}>Add to calendar</Text>
                  </Pressable>
                ) : null}
                {selectedEvent?.id && selectedEvent.id > 0 ? (
                  <Pressable
                    onPress={() => toggleSave(selectedEvent.id)}
                    style={{
                      backgroundColor: '#00000030',
                      padding: 12,
                      borderRadius: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Ionicons
                      name={savedSet.has(selectedEvent.id) ? 'bookmark' : 'bookmark-outline'}
                      size={18}
                      color={savedSet.has(selectedEvent.id) ? c.primary : c.text}
                    />
                    <Text style={{ color: c.text, fontWeight: '700' }}>
                      {savedSet.has(selectedEvent.id) ? 'Saved' : 'Save'}
                    </Text>
                  </Pressable>
                ) : null}
                {selectedEvent?.rsvp_url ? (
                  <Pressable
                    onPress={() => Linking.openURL(String(selectedEvent!.rsvp_url))}
                    style={{
                      backgroundColor: '#00000030',
                      padding: 12,
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ color: c.text, fontWeight: '700' }}>Open RSVP link</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add/Edit Event Modal (user flow) */}
      <Modal
        visible={addOpen}
        animationType="slide"
        onRequestClose={() => !savingEvent && setAddOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
          <BlurView
            intensity={30}
            tint={scheme === 'dark' ? 'dark' : 'light'}
            style={{ padding: 12 }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>
                {editEventId ? 'Edit event' : 'Add event'}
              </Text>
              <Pressable
                onPress={() => setAddOpen(false)}
                style={{
                  backgroundColor: '#00000020',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                }}
              >
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>
          </BlurView>
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            <View style={{ padding: 16 }}>
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
              {/* Removed image source selector per UX: we now prefer picked photos if present, else use typed URLs */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  marginBottom: 8,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                {pickedUris.map((u, i) => (
                  <View key={`${u}-${i}`} style={{ position: 'relative' }}>
                    <View
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 8,
                        overflow: 'hidden',
                        backgroundColor: '#00000015',
                      }}
                    >
                      <LazyImage uri={u} width={72} height={72} borderRadius={8} />
                    </View>
                    <Pressable
                      onPress={() => setPickedUris((prev) => prev.filter((_, idx) => idx !== i))}
                      accessibilityLabel={`Remove image ${i + 1}`}
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        backgroundColor: '#00000080',
                        borderRadius: 999,
                        padding: 4,
                      }}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                <Pressable
                  onPress={async () => {
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (status !== 'granted') {
                      Alert.alert(
                        'Permission needed',
                        'Please allow photo library access to upload images.',
                      );
                      return;
                    }
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      allowsMultipleSelection: true,
                      selectionLimit: 3,
                      quality: 0.9,
                    });
                    if (!result.canceled) {
                      const uris =
                        (result.assets as ImagePicker.ImagePickerAsset[] | undefined)
                          ?.map((a) => a.uri)
                          .filter(Boolean) ?? [];
                      setPickedUris((prev) => [...prev, ...uris].slice(0, 3));
                    }
                  }}
                  style={{
                    backgroundColor: c.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: '#000', fontWeight: '700' }}>
                    Choose images ({pickedUris.length}/3)
                  </Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    const { status } = await ImagePicker.requestCameraPermissionsAsync();
                    if (status !== 'granted') {
                      Alert.alert(
                        'Permission needed',
                        'Please allow camera access to take a photo.',
                      );
                      return;
                    }
                    const result = await ImagePicker.launchCameraAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      quality: 0.9,
                    });
                    if (!result.canceled && result.assets?.[0]?.uri) {
                      setPickedUris((prev) => [result.assets[0].uri, ...prev].slice(0, 3));
                    }
                  }}
                  style={{
                    backgroundColor: '#00000020',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '700' }}>Take photo</Text>
                </Pressable>
                {pickedUris.length > 0 ? (
                  <Pressable
                    onPress={() => setPickedUris([])}
                    style={{
                      backgroundColor: '#00000020',
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: c.text, fontWeight: '700' }}>Clear picked</Text>
                  </Pressable>
                ) : null}
              </View>
              {/* Preview thumbnails for typed URLs */}
              {typedUrls.length ? (
                <View style={{ gap: 6, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {typedUrls.map((u, i) => (
                      <View key={`typed-${u}-${i}`} style={{ position: 'relative' }}>
                        <View
                          style={{
                            width: 72,
                            height: 72,
                            borderRadius: 8,
                            overflow: 'hidden',
                            backgroundColor: '#00000015',
                          }}
                        >
                          <LazyImage uri={u} width={72} height={72} borderRadius={8} />
                        </View>
                        {/* Provide quick remove buttons for each URL slot */}
                        {i === 0 ? (
                          <Pressable
                            onPress={() => setMImage1('')}
                            accessibilityLabel="Remove first URL"
                            style={{
                              position: 'absolute',
                              top: -6,
                              right: -6,
                              backgroundColor: '#00000080',
                              borderRadius: 999,
                              padding: 4,
                            }}
                          >
                            <Ionicons name="close" size={14} color="#fff" />
                          </Pressable>
                        ) : i === 1 ? (
                          <Pressable
                            onPress={() => setMImage2('')}
                            accessibilityLabel="Remove second URL"
                            style={{
                              position: 'absolute',
                              top: -6,
                              right: -6,
                              backgroundColor: '#00000080',
                              borderRadius: 999,
                              padding: 4,
                            }}
                          >
                            <Ionicons name="close" size={14} color="#fff" />
                          </Pressable>
                        ) : (
                          <Pressable
                            onPress={() => setMImage3('')}
                            accessibilityLabel="Remove third URL"
                            style={{
                              position: 'absolute',
                              top: -6,
                              right: -6,
                              backgroundColor: '#00000080',
                              borderRadius: 999,
                              padding: 4,
                            }}
                          >
                            <Ionicons name="close" size={14} color="#fff" />
                          </Pressable>
                        )}
                      </View>
                    ))}
                  </View>
                  {typedUrls.length > 0 ? (
                    <Pressable
                      onPress={() => {
                        setMImage1('');
                        setMImage2('');
                        setMImage3('');
                      }}
                      style={{
                        backgroundColor: '#00000020',
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 10,
                        alignSelf: 'flex-start',
                      }}
                    >
                      <Text style={{ color: c.text, fontWeight: '700' }}>Clear URLs</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              <Text style={{ color: c.muted, fontSize: 11, marginBottom: 8 }}>
                Provide up to 3 images. The first is the cover. Picked photos and pasted URLs are
                combined (no duplicates), up to 3 total.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <Pressable
                  onPress={() => setMShowDatePicker(true)}
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
                  onPress={() => setMShowTimePicker(true)}
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
              {mShowDatePicker ? (
                <DateTimePicker
                  mode="date"
                  value={new Date(mDateTime)}
                  onChange={(evt, selectedDate) => {
                    setMShowDatePicker(false);
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
              {mShowTimePicker ? (
                <DateTimePicker
                  mode="time"
                  value={new Date(mDateTime)}
                  onChange={(evt, selectedTime) => {
                    setMShowTimePicker(false);
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
              <TextInput
                placeholder="Location"
                placeholderTextColor={c.muted}
                value={mLocation}
                onChangeText={setMLocation}
                style={{
                  color: c.text,
                  backgroundColor: '#00000010',
                  padding: 10,
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              />
              <TextInput
                placeholder="Tags (comma-separated)"
                placeholderTextColor={c.muted}
                value={mTagsCsv}
                onChangeText={setMTagsCsv}
                style={{
                  color: c.text,
                  backgroundColor: '#00000010',
                  padding: 10,
                  borderRadius: 8,
                  marginBottom: 8,
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                placeholder="RSVP URL (optional)"
                placeholderTextColor={c.muted}
                value={mRsvp}
                onChangeText={setMRsvp}
                style={{
                  color: c.text,
                  backgroundColor: '#00000010',
                  padding: 10,
                  borderRadius: 8,
                  marginBottom: 8,
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <ThreeDButton
                  title={editEventId ? 'Update Event' : 'Create Event'}
                  onPress={submitModal}
                />
                <ThreeDButton title="Cancel" onPress={() => setAddOpen(false)} />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {/* Confirm Delete Modal */}
      <Modal
        visible={confirmDeleteOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !isDeleting && setConfirmDeleteOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <View
            style={{
              backgroundColor: c.card,
              borderRadius: 16,
              padding: 16,
              width: '100%',
              maxWidth: 420,
              borderWidth: 1,
              borderColor: '#00000020',
            }}
          >
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Delete event?</Text>
            <Text style={{ color: c.muted, marginTop: 8 }}>
              This action cannot be undone. Are you sure you want to permanently delete this event?
            </Text>
            <View
              style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}
            >
              <Pressable
                onPress={() => !isDeleting && setConfirmDeleteOpen(false)}
                style={{
                  backgroundColor: '#00000020',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 10,
                }}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={{ color: c.text, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={performDelete}
                disabled={isDeleting}
                style={{
                  backgroundColor: '#ef4444',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 10,
                  opacity: isDeleting ? 0.6 : 1,
                }}
                accessibilityRole="button"
                accessibilityLabel="Confirm delete"
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </EventsContainer>
  );
}
