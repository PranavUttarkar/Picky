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
  Alert,
  Linking,
  Platform,
  LayoutAnimation,
  UIManager,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import GradientHeader from '@/components/GradientHeader';
import AnimatedPage from '@/components/AnimatedPage';
import { LinearGradient } from 'expo-linear-gradient';
import HeaderSpacer from '@/components/HeaderSpacer';
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
import LocationPicker from '@/components/LocationPicker';

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
  }) => void;
  resetForm: () => void;
  events: Event[];
  deleteEvent: (id: number) => void;
};

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

type AddEditEventModalProps = {
  visible: boolean;
  initialEvent: Event | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

const AddEditEventModal = memo(function AddEditEventModal({
  visible,
  initialEvent,
  onClose,
  onSaved,
}: AddEditEventModalProps) {
  const c = useThemeColors();
  const { scheme } = useTheme();

  // Local modal state
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [image1, setImage1] = useState('');
  const [image2, setImage2] = useState('');
  const [image3, setImage3] = useState('');
  const [pickedUris, setPickedUris] = useState<string[]>([]);
  const [dateTime, setDateTime] = useState<string>(
    dayjs().add(2, 'day').hour(18).minute(0).second(0).millisecond(0).toISOString(),
  );
  const [dateInput, setDateInput] = useState<string>(dayjs().add(2, 'day').format('YYYY-MM-DD'));
  const [timeInput, setTimeInput] = useState<string>(dayjs().add(2, 'day').format('HH:mm'));
  const [endTimeISO, setEndTimeISO] = useState<string | null>(
    dayjs().add(2, 'day').hour(20).minute(0).second(0).millisecond(0).toISOString(),
  );
  const [endTimeInput, setEndTimeInput] = useState<string>('8:00');
  const [startMeridiem, setStartMeridiem] = useState<'AM' | 'PM'>(dayjs().add(2, 'day').format('A') as 'AM' | 'PM');
  const [endMeridiem, setEndMeridiem] = useState<'AM' | 'PM'>('PM');
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [tagsCsv, setTagsCsv] = useState('');
  const [rsvp, setRsvp] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);

  // Initialize from props when opened
  useEffect(() => {
    if (!visible) return;
    if (initialEvent) {
      setTitle(initialEvent.title);
      setDesc(initialEvent.description ?? '');
      const imgs: string[] = (initialEvent as any).image_urls?.length
        ? (initialEvent as any).image_urls
        : initialEvent.image_url
        ? [initialEvent.image_url]
        : [];
      setImage1(imgs[0] || '');
      setImage2(imgs[1] || '');
      setImage3(imgs[2] || '');
      setPickedUris([]);
      setDateTime(initialEvent.date_time);
      setDateInput(dayjs(initialEvent.date_time).format('YYYY-MM-DD'));
      setTimeInput(dayjs(initialEvent.date_time).format('h:mm'));
      setStartMeridiem(dayjs(initialEvent.date_time).format('A') as 'AM' | 'PM');
      if ((initialEvent as any).end_time) {
        const et = dayjs((initialEvent as any).end_time);
        setEndTimeISO(et.toISOString());
        setEndTimeInput(et.format('h:mm'));
        setEndMeridiem(et.format('A') as 'AM' | 'PM');
      } else {
        const start = dayjs(initialEvent.date_time);
        let def = start.clone().hour(20).minute(0).second(0).millisecond(0);
        if (def.isBefore(start)) def = start.add(1, 'hour').second(0).millisecond(0);
        setEndTimeISO(def.toISOString());
        setEndTimeInput(def.format('h:mm'));
        setEndMeridiem(def.format('A') as 'AM' | 'PM');
      }
      setLocation(initialEvent.location ?? '');
      setLatitude(initialEvent.latitude ?? null);
      setLongitude(initialEvent.longitude ?? null);
      setTagsCsv((initialEvent.tags ?? []).join(', '));
      setRsvp((initialEvent as any).rsvp_url ?? '');
      setShowEndTimePicker(false);
    } else {
      const base = dayjs().add(2, 'day');
      const start = base.hour(18).minute(0).second(0).millisecond(0);
      const endDefault = base.hour(20).minute(0).second(0).millisecond(0);
      setTitle('');
      setDesc('');
      setImage1('');
      setImage2('');
      setImage3('');
      setPickedUris([]);
      setDateTime(start.toISOString());
      setDateInput(base.format('YYYY-MM-DD'));
      setTimeInput(start.format('h:mm'));
      setEndTimeISO(endDefault.toISOString());
      setEndTimeInput('8:00');
      setStartMeridiem(start.format('A') as 'AM' | 'PM');
      setEndMeridiem(endDefault.format('A') as 'AM' | 'PM');
      setShowEndTimePicker(false);
      setLocation('');
      setLatitude(null);
      setLongitude(null);
      setTagsCsv('');
      setRsvp('');
    }
  }, [visible, initialEvent]);

  const typedUrls = useMemo(
    () => [image1, image2, image3].map((s) => (s || '').trim()).filter(Boolean),
    [image1, image2, image3],
  );

  const submit = async () => {
    const titleVal = title.trim();
    if (!titleVal) {
      setShowValidation(true);
      Alert.alert('Missing title', 'Please give your event a title.');
      return;
    }
    const profanityErr = validateEventCopy(titleVal, desc);
    if (profanityErr) {
      Alert.alert('Inappropriate content', profanityErr);
      return;
    }
    const hasPicked = pickedUris.length > 0;
    const hasUrl = [image1, image2, image3].some((s) => !!s && s.trim().length > 0);
    if (!hasPicked && !hasUrl) {
      setShowValidation(true);
      Alert.alert(
        'Add an image',
        'Please add at least one image by pasting a URL or picking a photo.',
      );
      return;
    }
    const dtIso = dayjs(dateTime).isValid()
      ? dayjs(dateTime).toISOString()
      : dayjs().add(1, 'day').toISOString();
    let endTimeIso: string | null = null;
    if (endTimeISO) {
      const end = dayjs(endTimeISO);
      if (!end.isValid()) {
        Alert.alert('Invalid end time', 'Please enter a valid end time or clear it.');
        return;
      }
      if (end.isBefore(dayjs(dtIso))) {
        Alert.alert('End time before start', 'End time must be after the start time.');
        return;
      }
      endTimeIso = end.toISOString();
    }
    const tags = tagsCsv
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    if (!tags.length) {
      setShowValidation(true);
      Alert.alert('Missing tags', 'Please add at least one tag to categorize your event.');
      return;
    }
    // Validate location is required
    const locationVal = location.trim();
    if (!locationVal || latitude == null || longitude == null) {
      setShowValidation(true);
      Alert.alert('Missing location', 'Please select a location for your event.');
      return;
    }
    // Passed required-field validation
    if (showValidation) setShowValidation(false);
    const { cleaned: imageUrlsFromText, errors: imageErrors } = sanitizeEventImageUrls([
      image1,
      image2,
      image3,
    ]);
    if (imageErrors.length) Alert.alert('Image issues', imageErrors.join('\n'));

    let uploadedUrls: string[] = [];
    if (pickedUris.length) {
      try {
        const limited = pickedUris.slice(0, 3);
        const compressedUris: string[] = [];
        for (const uri of limited) {
          try {
            const result = await ImageManipulator.manipulateAsync(
              uri,
              [{ resize: { width: 1600 } }],
              {
                compress: 0.8,
                format: ImageManipulator.SaveFormat.JPEG,
              },
            );
            compressedUris.push(result.uri);
          } catch {}
        }
        uploadedUrls = await uploadEventImages(compressedUris);
      } catch (e: any) {
        Alert.alert('Upload failed', e?.message ?? 'Could not upload images');
        return;
      }
    }
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
      description: desc.trim() || null,
      image_urls: finalImages,
      image_url: finalImages[0] || null,
      date_time: dtIso,
      end_time: endTimeIso,
      location: locationVal,
      latitude: latitude,
      longitude: longitude,
      tags,
      rsvp_url: rsvp.trim() || null,
    };
    setSavingEvent(true);
    try {
      if (initialEvent?.id) {
        await updateEvent(initialEvent.id, payload);
        Alert.alert('Updated', 'Your event was updated.');
      } else {
        await createEvent(payload);
        Alert.alert('Created', 'Your event was created.');
      }
      onClose();
      await onSaved();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save event');
    } finally {
      setSavingEvent(false);
    }
  };

  // Keep web inputs in sync if dateTime changes from other flows
  useEffect(() => {
    setDateInput(dayjs(dateTime).format('YYYY-MM-DD'));
    setTimeInput(dayjs(dateTime).format('h:mm'));
    setStartMeridiem(dayjs(dateTime).format('A') as 'AM' | 'PM');
  }, [dateTime]);

  useEffect(() => {
    if (endTimeISO) {
      setEndTimeInput(dayjs(endTimeISO).format('h:mm'));
      setEndMeridiem(dayjs(endTimeISO).format('A') as 'AM' | 'PM');
    } else {
      setEndTimeInput('');
    }
  }, [endTimeISO]);

  // Collapsible section state (progressive disclosure)
  const [openSections, setOpenSections] = useState<{ [k: string]: boolean }>(() => ({
    essentials: true,
    images: true,
    location: true, // auto open location by default (chevron shown as up)
  }));
  const [showValidation, setShowValidation] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const prevLatRef = useRef<number | null>(null);
  const prevLngRef = useRef<number | null>(null);

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Streamlined image URL handling: show only one empty input at a time
  const imageUrlList = [image1, image2, image3];
  const setImageByIndex = (i: number, v: string) => {
    if (i === 0) setImage1(v); else if (i === 1) setImage2(v); else if (i === 2) setImage3(v);
  };
  const activeImageInputs = imageUrlList.filter((_, idx) => {
    // show until first empty after a filled; ensures minimal clutter
    const filledBefore = imageUrlList.slice(0, idx).some((s) => (s || '').trim().length > 0);
    const currentFilled = (imageUrlList[idx] || '').trim().length > 0;
    if (idx === 0) return true;
    if (currentFilled) return true;
    // show one next empty only if prior has content
    return filledBefore && !currentFilled;
  });

  // Section component inline (small, avoids extra file)
  const Section: React.FC<{ id: string; title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ id, title, children }) => {
    const open = openSections[id];
    return (
      <View style={{ marginBottom: 14, borderRadius: 12, borderWidth: 1, borderColor: '#00000020', backgroundColor: c.card }}>
        <Pressable
          onPress={() => toggleSection(id)}
          accessibilityRole="button"
          accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${title} section`}
          style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {id === 'images' ? <Ionicons name="image-outline" size={18} color={c.muted} /> : null}
                {id === 'location' ? <Ionicons name="location-outline" size={18} color={c.muted} /> : null}
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{title}</Text>
              </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
        </Pressable>
        {open ? <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>{children}</View> : null}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => !savingEvent && onClose()}>
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.background }}>
        <HeaderSpacer />
        <BlurView intensity={30} tint={scheme === 'dark' ? 'dark' : 'light'} style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>{initialEvent ? 'Edit Event' : 'Add Event'}</Text>
            <Pressable
              onPress={onClose}
              style={{ backgroundColor: '#00000020', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
            >
              <Ionicons name="close" size={24} color={c.text} />
            </Pressable>
          </View>
        </BlurView>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
          <Section id="essentials" title="Details">
            <TextInput
              placeholder="Title"
              placeholderTextColor={c.muted}
              value={title}
              onChangeText={setTitle}
              style={{ color: c.text, backgroundColor: '#00000010', padding: 12, borderRadius: 10, fontSize: 15, borderWidth: 1, borderColor: showValidation && !title.trim() ? '#ff4444' : '#00000020' }}
            />
            <View>
              <TextInput
                placeholder="Description, Building/Room Number, etc."
                placeholderTextColor={c.muted}
                value={desc}
                onChangeText={setDesc}
                multiline
                style={{ color: c.text, backgroundColor: '#00000010', padding: 12, borderRadius: 10, minHeight: 100, fontSize: 14 }}
              />
              <Text style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>{desc.length} chars</Text>
            </View>
            <View style={{ gap: 6 }}>
              <TextInput
                placeholder="Tags (comma seperated ex: workshop, engineering, free food)"
                placeholderTextColor={c.muted}
                value={tagsCsv}
                onChangeText={setTagsCsv}
                style={{
                  color: c.text,
                  backgroundColor: '#00000010',
                  padding: 12,
                  borderRadius: 10,
                  fontSize: 14,
                  borderWidth: 1,
                  borderColor: showValidation && !tagsCsv.trim().length ? '#ff4444' : '#00000020',
                }}
                autoCapitalize="none"
              />
              {tagsCsv.trim().length === 0 ? (
                showValidation ? <Text style={{ color: '#ff6666', fontSize: 11 }}>Add at least one tag.</Text> : null
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {Array.from(new Set(tagsCsv.split(',').map(t => t.trim().toLowerCase()).filter(Boolean))).slice(0,12).map(t => (
                    <View key={t} style={{ backgroundColor: c.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
                      <Text style={{ color: '#000', fontSize: 11, fontWeight: '700' }}>#{t}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Section>
          {/* Static When card */}
          <View style={{ marginBottom: 14, borderRadius: 12, borderWidth: 1, borderColor: '#00000020', backgroundColor: c.card }}>
            <View style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="time-outline" size={18} color={c.muted} />
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>When</Text>
            </View>
            {Platform.OS === 'web' ? (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
                <TextInput
                  placeholder="Date (YYYY-MM-DD)"
                  placeholderTextColor={c.muted}
                  value={dateInput}
                  onChangeText={(val) => {
                    setDateInput(val);
                    const parsed = dayjs(val, 'YYYY-MM-DD', true);
                    if (parsed.isValid()) {
                      const current = dayjs(dateTime);
                      const merged = parsed
                        .hour(current.hour())
                        .minute(current.minute())
                        .second(0)
                        .millisecond(0);
                      setDateTime(merged.toISOString());
                      // also adjust end time date portion if exists
                      if (endTimeISO) {
                        const end = dayjs(endTimeISO);
                        const endMerged = parsed
                          .hour(end.hour())
                          .minute(end.minute())
                          .second(0)
                          .millisecond(0);
                        setEndTimeISO(endMerged.toISOString());
                      }
                    }
                  }}
                  style={{ color: c.text, backgroundColor: '#00000010', padding: 12, borderRadius: 10 }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {/* Start time + inline AM/PM */}
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput
                      placeholder="Start (e.g. 3:30)"
                      placeholderTextColor={c.muted}
                      value={timeInput}
                      onChangeText={(val) => {
                        setTimeInput(val);
                        const m = val.trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
                        if (!m) return;
                        let hour = parseInt(m[1], 10);
                        const minute = m[2] ? parseInt(m[2], 10) : 0;
                        if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return;
                        let h24 = hour % 12;
                        if (startMeridiem === 'PM') h24 += 12;
                        const baseDate = dayjs(dateInput, 'YYYY-MM-DD', true).isValid()
                          ? dayjs(dateInput, 'YYYY-MM-DD', true)
                          : dayjs(dateTime);
                        const merged = baseDate.hour(h24).minute(minute).second(0).millisecond(0);
                        setDateTime(merged.toISOString());
                        if (endTimeISO) {
                          const end = dayjs(endTimeISO);
                          if (end.isBefore(merged)) {
                            const bumped = merged.add(1, 'hour');
                            setEndTimeISO(bumped.toISOString());
                            setEndTimeInput(bumped.format('h:mm'));
                            setEndMeridiem(bumped.format('A') as 'AM' | 'PM');
                          }
                        }
                      }}
                      style={{ flex: 1, color: c.text, backgroundColor: '#00000010', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
                    />
                    <Pressable
                      onPress={() => {
                        setStartMeridiem('AM');
                        const m = timeInput.trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
                        let hour: number;
                        let minute: number;
                        if (m) {
                          hour = Math.min(12, Math.max(1, parseInt(m[1], 10)));
                          minute = m[2] ? Math.min(59, Math.max(0, parseInt(m[2], 10))) : 0;
                        } else {
                          const cur = dayjs(dateTime);
                          hour = parseInt(cur.format('h'), 10);
                          minute = cur.minute();
                          setTimeInput(cur.format('h:mm'));
                        }
                        let h24 = hour % 12; // AM => keep 0-11
                        const baseDate = dayjs(dateInput, 'YYYY-MM-DD', true).isValid()
                          ? dayjs(dateInput, 'YYYY-MM-DD', true)
                          : dayjs(dateTime);
                        const merged = baseDate.hour(h24).minute(minute).second(0).millisecond(0);
                        setDateTime(merged.toISOString());
                      }}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        backgroundColor: startMeridiem === 'AM' ? c.primary : 'transparent',
                        borderWidth: 1,
                        borderColor: '#00000030',
                        minWidth: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: startMeridiem === 'AM' ? '#000' : c.text, fontWeight: '700' }}>AM</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setStartMeridiem('PM');
                        const m = timeInput.trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
                        let hour: number;
                        let minute: number;
                        if (m) {
                          hour = Math.min(12, Math.max(1, parseInt(m[1], 10)));
                          minute = m[2] ? Math.min(59, Math.max(0, parseInt(m[2], 10))) : 0;
                        } else {
                          const cur = dayjs(dateTime);
                          hour = parseInt(cur.format('h'), 10);
                          minute = cur.minute();
                          setTimeInput(cur.format('h:mm'));
                        }
                        let h24 = (hour % 12) + 12; // PM => force 12-23
                        const baseDate = dayjs(dateInput, 'YYYY-MM-DD', true).isValid()
                          ? dayjs(dateInput, 'YYYY-MM-DD', true)
                          : dayjs(dateTime);
                        const merged = baseDate.hour(h24).minute(minute).second(0).millisecond(0);
                        setDateTime(merged.toISOString());
                      }}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        backgroundColor: startMeridiem === 'PM' ? c.primary : 'transparent',
                        borderWidth: 1,
                        borderColor: '#00000030',
                        minWidth: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: startMeridiem === 'PM' ? '#000' : c.text, fontWeight: '700' }}>PM</Text>
                    </Pressable>
                  </View>

                  {/* End time + inline AM/PM */}
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput
                      placeholder="End (optional)"
                      placeholderTextColor={c.muted}
                      value={endTimeInput}
                      onChangeText={(val) => {
                        setEndTimeInput(val);
                        const m = val.trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
                        if (val.trim() === '') { setEndTimeISO(null); return; }
                        if (!m) return;
                        let hour = parseInt(m[1], 10);
                        const minute = m[2] ? parseInt(m[2], 10) : 0;
                        if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return;
                        let h24 = hour % 12;
                        if (endMeridiem === 'PM') h24 += 12;
                        const baseStart = dayjs(dateTime);
                        let end = baseStart.hour(h24).minute(minute).second(0).millisecond(0);
                        if (end.isBefore(baseStart)) end = end.add(1, 'hour');
                        setEndTimeISO(end.toISOString());
                      }}
                      style={{ flex: 1, color: c.text, backgroundColor: '#00000010', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
                    />
                    <Pressable
                      onPress={() => {
                        setEndMeridiem('AM');
                        const m = endTimeInput.trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
                        if (!m) return;
                        let hour = Math.min(12, Math.max(1, parseInt(m[1], 10)));
                        const minute = m[2] ? Math.min(59, Math.max(0, parseInt(m[2], 10))) : 0;
                        let h24 = hour % 12; // AM => keep 0-11
                        const baseStart = dayjs(dateTime);
                        let end = baseStart.hour(h24).minute(minute).second(0).millisecond(0);
                        if (end.isBefore(baseStart)) end = end.add(1, 'hour');
                        setEndTimeISO(end.toISOString());
                      }}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        backgroundColor: endMeridiem === 'AM' ? c.primary : 'transparent',
                        borderWidth: 1,
                        borderColor: '#00000030',
                        minWidth: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: endMeridiem === 'AM' ? '#000' : c.text, fontWeight: '700' }}>AM</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setEndMeridiem('PM');
                        const m = endTimeInput.trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
                        if (!m) return;
                        let hour = Math.min(12, Math.max(1, parseInt(m[1], 10)));
                        const minute = m[2] ? Math.min(59, Math.max(0, parseInt(m[2], 10))) : 0;
                        let h24 = (hour % 12) + 12; // PM => force 12-23
                        const baseStart = dayjs(dateTime);
                        let end = baseStart.hour(h24).minute(minute).second(0).millisecond(0);
                        if (end.isBefore(baseStart)) end = end.add(1, 'hour');
                        setEndTimeISO(end.toISOString());
                      }}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        backgroundColor: endMeridiem === 'PM' ? c.primary : 'transparent',
                        borderWidth: 1,
                        borderColor: '#00000030',
                        minWidth: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: endMeridiem === 'PM' ? '#000' : c.text, fontWeight: '700' }}>PM</Text>
                    </Pressable>
                  </View>
                </View>
                {endTimeISO && dayjs(endTimeISO).isValid() && dayjs(endTimeISO).isBefore(dayjs(dateTime)) ? (
                  <Text style={{ color: '#ef4444', fontSize: 12 }}>End time must be after start time.</Text>
                ) : null}
                <Text style={{ color: c.muted, fontSize: 11 }}>
                  Start: {dayjs(dateTime).format('YYYY-MM-DD h:mm A')} {endTimeISO ? `· End: ${dayjs(endTimeISO).format('h:mm A')}` : ''}
                </Text>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  style={{ backgroundColor: '#00000010', padding: 12, borderRadius: 10, alignItems: 'center' }}
                >
                  <Text style={{ color: c.text, fontWeight: '700' }}>{dayjs(dateTime).format('YYYY-MM-DD')}</Text>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => setShowTimePicker(true)}
                    style={{ flex: 1, backgroundColor: '#00000010', padding: 12, borderRadius: 10, alignItems: 'center' }}
                  >
                    <Text style={{ color: c.text, fontWeight: '700' }}>{dayjs(dateTime).format('h:mm A')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowEndTimePicker(true)}
                    style={{ flex: 1, backgroundColor: '#00000010', padding: 12, borderRadius: 10, alignItems: 'center' }}
                  >
                    <Text style={{ color: c.text, fontWeight: '700' }}>{endTimeISO ? dayjs(endTimeISO).format('h:mm A') : 'Add end (optional)'}</Text>
                  </Pressable>
                </View>
                {showDatePicker ? (
                  <DateTimePicker
                    mode="date"
                    value={new Date(dateTime)}
                    onChange={(evt, selectedDate) => {
                      setShowDatePicker(false);
                      if (!selectedDate) return;
                      const current = dayjs(dateTime);
                      const merged = current
                        .year(selectedDate.getFullYear())
                        .month(selectedDate.getMonth())
                        .date(selectedDate.getDate());
                      setDateTime(merged.toISOString());
                    }}
                  />
                ) : null}
                {showTimePicker ? (
                  <DateTimePicker
                    mode="time"
                    value={new Date(dateTime)}
                    onChange={(evt, selectedTime) => {
                      setShowTimePicker(false);
                      if (!selectedTime) return;
                      const current = dayjs(dateTime);
                      const merged = current
                        .hour(selectedTime.getHours())
                        .minute(selectedTime.getMinutes())
                        .second(0)
                        .millisecond(0);
                      setDateTime(merged.toISOString());
                    }}
                  />
                ) : null}
                {showEndTimePicker ? (
                  <DateTimePicker
                    mode="time"
                    value={new Date(endTimeISO ?? dateTime)}
                    onChange={(evt, selected) => {
                      setShowEndTimePicker(false);
                      if (!selected) return;
                      const base = dayjs(dateTime);
                      const merged = base
                        .hour(selected.getHours())
                        .minute(selected.getMinutes())
                        .second(0)
                        .millisecond(0);
                      setEndTimeISO(merged.toISOString());
                    }}
                  />
                ) : null}
              </View>
            )}
          </View>
          <Section id="images" title="Images">
            <View style={{ gap: 10 }}>
              {activeImageInputs.map((v, idx) => (
                <TextInput
                  key={idx}
                  placeholder={idx === 0 ? 'Cover image URL or paste' : `Image ${idx + 1} URL`}
                  placeholderTextColor={c.muted}
                  value={imageUrlList[idx]}
                  onChangeText={(val) => setImageByIndex(idx, val)}
                  style={{ color: c.text, backgroundColor: '#00000010', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: showValidation && idx === 0 && pickedUris.length === 0 && [image1,image2,image3].every(s => !(s && s.trim().length)) ? '#ff4444' : '#00000020' }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              ))}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {pickedUris.map((u) => (
                  <View key={u} style={{ position: 'relative' }}>
                    <Image source={{ uri: u }} style={{ width: 80, height: 80, borderRadius: 10, backgroundColor: '#00000020' }} />
                    <Pressable
                      onPress={() => setPickedUris((prev) => prev.filter((x) => x !== u))}
                      style={{ position: 'absolute', top: 4, right: 4, backgroundColor: '#00000080', borderRadius: 12, padding: 2 }}
                    >
                      <Ionicons name="close" color="#fff" size={14} />
                    </Pressable>
                  </View>
                ))}
                {typedUrls.map((u, i) => (
                  <View key={'typed-' + u + i} style={{ position: 'relative' }}>
                    <Image source={{ uri: u }} style={{ width: 80, height: 80, borderRadius: 10, backgroundColor: '#00000020' }} />
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Pressable
                  onPress={async () => {
                    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (perm.status !== 'granted') {
                      Alert.alert('Permission needed', 'Enable photo library access to pick images');
                      return;
                    }
                    try {
                      const result = await ImagePicker.launchImageLibraryAsync({
                        allowsMultipleSelection: true,
                        selectionLimit: 3,
                        quality: 0.9,
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      });
                      if (!result.canceled) {
                        const uris = result.assets.map((a) => a.uri);
                        setPickedUris((prev) => {
                          const merged = [...prev, ...uris];
                          const unique: string[] = [];
                          for (const m of merged) if (!unique.includes(m)) unique.push(m);
                          return unique.slice(0, 3);
                        });
                      }
                    } catch (e: any) {
                      Alert.alert('Pick failed', e?.message || 'Could not pick images');
                    }
                  }}
                  style={{ backgroundColor: c.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Ionicons name="image" size={16} color="#000" />
                  <Text style={{ color: '#000', fontWeight: '700' }}>Pick Photos</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    if (Platform.OS === 'web') {
                      try {
                        const doc: any = (globalThis as any).document;
                        if (!doc) {
                          Alert.alert('Not supported', 'Camera/file input is not available in this environment');
                          return;
                        }
                        const input: any = doc.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        // Hint mobile browsers to open camera when possible
                        (input as any).capture = 'environment';
                        input.onchange = () => {
                          try {
                            const file = (input as any).files && (input as any).files[0];
                            if (!file) return;
                            const url = URL.createObjectURL(file);
                            setPickedUris((prev) => {
                              const merged = [...prev, url];
                              const unique: string[] = [];
                              for (const m of merged) if (!unique.includes(m)) unique.push(m);
                              return unique.slice(0, 3);
                            });
                          } catch (err: any) {
                            Alert.alert('Camera failed', err?.message || 'Could not access camera');
                          }
                        };
                        input.click();
                      } catch (err: any) {
                        Alert.alert('Camera failed', err?.message || 'Could not access camera');
                      }
                      return;
                    }
                    // Native (iOS/Android) camera flow
                    const perm = await ImagePicker.requestCameraPermissionsAsync();
                    if (perm.status !== 'granted') {
                      Alert.alert('Permission needed', 'Enable camera access to take a photo');
                      return;
                    }
                    try {
                      const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
                      if (!result.canceled && result.assets?.length) {
                        const uri = result.assets[0].uri;
                        setPickedUris((prev) => {
                          const merged = [...prev, uri];
                          const unique: string[] = [];
                          for (const m of merged) if (!unique.includes(m)) unique.push(m);
                          return unique.slice(0, 3);
                        });
                      }
                    } catch (e: any) {
                      Alert.alert('Camera failed', e?.message || 'Could not take photo');
                    }
                  }}
                  style={{ backgroundColor: '#00000030', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }}
                >
                  <Text style={{ color: c.text }}>Take Photo</Text>
                </Pressable>
                {pickedUris.length > 0 ? (
                  <Pressable
                    onPress={() => setPickedUris([])}
                    style={{ backgroundColor: '#00000030', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }}
                  >
                    <Text style={{ color: c.text }}>Clear Pics</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={{ color: c.muted, fontSize: 11 }}>
                First image is cover. Up to 3 images (picked + URLs combined, no duplicates).
              </Text>
            </View>
          </Section>
          <Section id="location" title="Location">
            <LocationPicker
              value={location}
              latitude={latitude}
              longitude={longitude}
              onLocationChange={(loc, lat, lng) => {
                setLocation(loc);
                setLatitude(lat);
                setLongitude(lng);
                if (lat != null && lng != null && prevLatRef.current == null && prevLngRef.current == null) {
                  setLocationStatus(`📍Current location added: (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
                }
                prevLatRef.current = lat;
                prevLngRef.current = lng;
              }}
              placeholder="Location"
              textColor={c.text}
              backgroundColor="#00000010"
              placeholderColor={c.muted}
            />
            {locationStatus ? <Text style={{ color: c.muted, fontSize: 11 }}>{locationStatus}</Text> : null}
          </Section>
          {/* RSVP URL card */}
          <View style={{ marginBottom: 14, borderRadius: 12, borderWidth: 1, borderColor: '#00000020', backgroundColor: c.card }}>
            <View style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="link-outline" size={18} color={c.muted} />
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>RSVP</Text>
            </View>
            <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
              <TextInput
                placeholder="RSVP URL (optional)"
                placeholderTextColor={c.muted}
                value={rsvp}
                onChangeText={setRsvp}
                style={{ color: c.text, backgroundColor: '#00000010', padding: 12, borderRadius: 10 }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {rsvp.trim().length > 0 ? (
                <Text style={{ color: c.muted, fontSize: 11 }}>Remember to verify the link works.</Text>
              ) : null}
            </View>
          </View>
        </ScrollView>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12 }}>
          <BlurView intensity={30} tint={scheme === 'dark' ? 'dark' : 'light'} style={{ borderRadius: 16, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', gap: 12, padding: 12 }}>
              <Pressable
                onPress={submit}
                disabled={savingEvent}
                style={{ flex: 1, backgroundColor: savingEvent ? c.muted : c.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#000', fontWeight: '700' }}>
                  {savingEvent ? 'Saving…' : initialEvent ? 'Update Event' : 'Create Event'}
                </Text>
              </Pressable>
              <Pressable
                onPress={onClose}
                disabled={savingEvent}
                style={{ flex: 1, backgroundColor: '#00000030', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: c.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
            </View>
          </BlurView>
        </View>
      </SafeAreaView>
    </Modal>
  );
});

type FiltersTopBarProps = {
  c: ReturnType<typeof useThemeColors>;
  query: string;
  setQuery: (v: string) => void;
  mode: 'all' | 'personalized';
  setMode: React.Dispatch<React.SetStateAction<'all' | 'personalized'>>;
  viewMode: 'row' | 'grid';
  setViewMode: React.Dispatch<React.SetStateAction<'row' | 'grid'>>;
};

import { topBarStyles } from '@/components/TopBarStyles';

const FiltersTopBar = memo(function FiltersTopBar({
  c,
  query,
  setQuery,
  mode,
  setMode,
  viewMode,
  setViewMode,
  onOpenAdd,
  isAuthed,
}: FiltersTopBarProps & { onOpenAdd: () => void; isAuthed: boolean }) {
  const inputRef = useRef<TextInput>(null);
  const styles = topBarStyles(c);
  return (
    <View style={{ paddingBottom: 12 }}>
      {/* Search bar with icon (shared style) */}
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <Pressable
            accessibilityLabel="Focus search"
            style={styles.searchIconPressable}
            onPress={() => inputRef.current?.focus?.()}
          >
            <Ionicons name="search" size={18} color={c.muted} />
          </Pressable>
          <TextInput
            ref={inputRef}
            placeholder="Search events (e.g. free food, tech)"
            placeholderTextColor={c.muted}
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>
      {/* Mode, view toggle, add event */}
      <View style={styles.rowWrap}>
        {[
          { key: 'all', label: 'Upcoming' },
          { key: 'personalized', label: 'Personalized' },
        ].map((opt) => {
          const active = mode === (opt.key as any);
          return (
            <Pressable
              key={opt.key}
              onPress={() => {
                if (opt.key === 'personalized' && !isAuthed) {
                  router.push('/onboarding/welcome');
                  return;
                }
                setMode(opt.key as any);
              }}
              style={styles.modeButton(active)}
            >
              <Text style={styles.modeButtonText(active)}>{opt.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setViewMode((v) => (v === 'row' ? 'grid' : 'row'))}
          style={styles.toggleButton}
          accessibilityLabel={viewMode === 'row' ? 'Switch to grid view' : 'Switch to list view'}
        >
          <Ionicons name={viewMode === 'row' ? 'grid' : 'list'} size={18} color={c.text} />
        </Pressable>
        <Pressable
          onPress={onOpenAdd}
          style={styles.actionButton}
          accessibilityRole="link"
          accessibilityLabel={isAuthed ? 'Add Event' : 'Sign in to add event'}
        >
          <Ionicons name="add" size={16} color="#000" />
          <Text style={styles.actionButtonText}>Add Event</Text>
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
            // marginHorizontal: 4,
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
            // marginHorizontal: 4,
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
          // marginHorizontal: 4,
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
  const isWide = width >= 900; // switch default to grid on larger screens
  const [viewMode, setViewMode] = useState<'row' | 'grid'>(isWide ? 'grid' : 'row');
  const columns = viewMode === 'row' ? 1 : width >= 1280 ? 3 : isWide ? 2 : 1;
  // Grid sizing: cap total grid width, keep equal columns within that bound
  const GAP = 12;
  const MAX_COL_WIDTH = 440; // slightly larger for event cards
  const MAX_GRID_WIDTH = columns * MAX_COL_WIDTH + GAP * (columns - 1);
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
        'id,title,description,image_url,image_urls,date_time,end_time,location,tags,rsvp_url,created_by',
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
        // Default to Soonest for guests
        setMode('all');
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

  // Track list and content heights to auto-load when content is shorter than viewport
  const listViewportHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const fillCheckDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maybeLoadMoreIfShort = () => {
    if (fillCheckDebounce.current) clearTimeout(fillCheckDebounce.current);
    fillCheckDebounce.current = setTimeout(() => {
      const vh = listViewportHeightRef.current;
      const ch = contentHeightRef.current;
      if (vh > 0 && ch > 0 && ch < vh * 1.05 && hasMore && !isFetching) {
        loadNextPage();
      }
    }, 50);
  };

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

  const { tags: queryTags, words: queryWords } = useMemo(() => parseQuery(query), [query]);

  // Build tag universe from currently loaded events
  const allTags: string[] = useMemo(
    () =>
      Array.from(new Set(events.flatMap((e: any) => (e.tags ?? []).map((t: string) => t)))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [events],
  );

  // Derived filtered list based on text and tag filters
  const filteredBase = useMemo(() => {
    return events.filter((e: any) => {
      // Tag match: all queryTags must be present (case-insensitive)
      const lowerEventTags = (e.tags ?? []).map((t: string) => t.toLowerCase());
      if (queryTags.length) {
        const et = lowerEventTags;
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
  }, [events, queryTags, activeTags, queryWords]);

  // Apply mode-specific sorting/filtering
  const filtered = useMemo(() => {
    const arr = [...filteredBase];
    if (mode === 'personalized') {
      arr.sort((a: any, b: any) => match(b.id, b.tags) - match(a.id, a.tags));
    } else {
      arr.sort((a: any, b: any) => dayjs(a.date_time).valueOf() - dayjs(b.date_time).valueOf());
    }
    return arr;
  }, [filteredBase, mode, scores, myTags]);

  // Keep a ref of the current filtered length for the viewability callback
  useEffect(() => {
    filteredLengthRef.current = filtered.length;
  }, [filtered.length]);

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

  // Filters: top bar outside list, interests/tags/results inside list header
  // Add/Edit Event modal controller state (isolate modal to avoid parent re-renders on typing)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEvent, setModalEvent] = useState<Event | null>(null);

  const openAddModal = async () => {
    const ok = await requireAuth();
    if (!ok) return;
    setModalEvent(null);
    setModalOpen(true);
  };

  const openEditModal = async (e: Event) => {
    const ok = await requireAuth();
    if (!ok) return;
    setModalEvent(e);
    setModalOpen(true);
  };

  // (modal state moved into AddEditEventModal)

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
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenAdd={openAddModal}
        isAuthed={isAuthed}
      />
    ),
    [c, query, mode, isAuthed, viewMode, width],
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
    [c, myTags, activeTags, allTags, query, filtered.length, mode, isAuthed, viewMode, width],
  );

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.background }}>
      <GradientBackground variant="dim">
        <View style={{ flex: 1, padding: 16 }}>
          <GradientHeader title="Events" />
          {isAdmin ? (
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
          ) : null}
          {filtersTopBar}
          <FlatList
        ref={listRef}
        data={filtered}
        key={`layout-${columns}`}
        keyExtractor={(e: any) => String(e.id)}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: GAP } : undefined}
        contentContainerStyle={
          columns > 1
            ? {
                gap: 12,
                paddingBottom: 32,
                alignSelf: 'center',
                maxWidth: MAX_GRID_WIDTH,
                width: '100%',
              }
            : {
                gap: 12,
                paddingBottom: 32,

                /* horizontal padding provided by outer container */

                // In row mode, allow full available width similar to food tab
                // (no maxWidth constraint so cards are not overly narrow on wide screens)
              }
        }
        style={{ flex: 1 }}
        onLayout={(e) => {
          listViewportHeightRef.current = e.nativeEvent.layout.height;
          maybeLoadMoreIfShort();
        }}
        onContentSizeChange={(_w, h) => {
          contentHeightRef.current = h;
          maybeLoadMoreIfShort();
        }}
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
        // removeClippedSubviews can break onEndReached on some Android devices
        removeClippedSubviews={false}
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
        renderItem={({ item, index }) => {
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
          const total = filtered.length;
          const rem = total % columns;
          const isLastPartialRow = columns > 1 && rem !== 0 && index >= total - rem;
          if (columns > 1) {
            return (
              <View
                style={
                  isLastPartialRow || total < columns
                    ? { width: MAX_COL_WIDTH, flex: 0 }
                    : { flex: 1 }
                }
              >
                <EventGridCard {...cardProps} />
              </View>
            );
          }
          return <EventRowCard {...cardProps} />;
        }}
          />

      {/* Floating Add Event Button (FAB) */}
          <View pointerEvents="box-none" style={{ position: 'absolute', right: 16, bottom: 24 }}>
        <Pressable
          onPress={openAddModal}
          accessibilityRole="button"
          accessibilityLabel="Add Event"
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: c.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <Ionicons name="add" size={26} color="#000" />
        </Pressable>
          </View>
        </View>
      </GradientBackground>

      {/* Event Details Modal */}
      <Modal
        visible={detailsOpen}
        animationType="slide"
        onRequestClose={() => setDetailsOpen(false)}
      >
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.background }}>
          <HeaderSpacer />
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
                {selectedEvent
                  ? (() => {
                      const start = dayjs(selectedEvent.date_time);
                      const end = (selectedEvent as any).end_time
                        ? dayjs((selectedEvent as any).end_time)
                        : null;
                      const sameDay = end ? start.isSame(end, 'day') : true;
                      const datePart = start.format('ddd, MMM D');
                      const timePart = end
                        ? sameDay
                          ? `${start.format('h:mm')}–${end.format('h:mm A')}`
                          : `${start.format('h:mm A')} → ${end.format('MMM D h:mm A')}`
                        : start.format('h:mm A');
                      return `${datePart} • ${timePart}`;
                    })()
                  : ''}
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
                      const end = (
                        (selectedEvent as any).end_time
                          ? dayjs((selectedEvent as any).end_time)
                          : dayjs(selectedEvent!.date_time).add(2, 'hour')
                      ).toISOString();
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
                      name={savedSet.has(selectedEvent.id) ? 'heart' : 'heart-outline'}
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
      <AddEditEventModal
        visible={modalOpen}
        initialEvent={modalEvent}
        onClose={() => setModalOpen(false)}
        onSaved={onRefresh}
      />
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
    </SafeAreaView>
  );
}
