import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  useWindowDimensions,
  Alert,
  Platform,
  Modal,
  ScrollView,
  Linking,
  Animated,
  LayoutAnimation,
  UIManager,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { BorderRadius, Shadows, Spacing, Typography, Colors } from '@/theme/designTokens';
import GradientBackground from '@/components/GradientBackground';
import FoodRowCard from '@/components/FoodRowCard';
import FoodGridCard from '@/components/FoodGridCard';
import EventRowCard from '@/components/EventRowCard';
import EventGridCard from '@/components/EventGridCard';
import { listRestaurants, searchRestaurants, getTopUserRestaurantMatches } from '@/services/food';
import { listEvents, searchEvents, getTopUserMatches, createEvent, uploadEventImages } from '@/services/events';
import type { Restaurant, Event } from '@/types/models';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { optimisticUpdate } from '@/utils/optimistic';
import { useSavedNotification } from '@/utils/SavedNotificationContext';
import dayjs from 'dayjs';
import LazyImage from '@/components/LazyImage';
import FloatingAddButton from '@/components/FloatingAddButton';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import LocationPicker from '@/components/LocationPicker';
import { validateEventCopy, checkProfanity } from '@/utils/profanity';
import HeaderSpacer from '@/components/HeaderSpacer';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type DiscoverMode = 'food' | 'events';
type SortMode = 'match' | 'closest' | 'latest' | 'open' | 'upcoming';

// Helper function to check if a restaurant is currently open
const isRestaurantOpen = (restaurant: Restaurant): boolean => {
  const now = dayjs();
  const dayOfWeek = now.format('dddd').toLowerCase();
  
  // Get the open time for today
  const openTimeKey = `open_time_${dayOfWeek}` as keyof Restaurant;
  const openTimeStr = restaurant[openTimeKey] as string | null | undefined;
  
  if (!openTimeStr || openTimeStr.toLowerCase() === 'closed') return false;
  
  // Parse time ranges like "11AM-10PM" or "11:00AM-10:00PM" or "Open 24 hours"
  if (openTimeStr.toLowerCase().includes('24 hours')) return true;
  
  const timeMatch = openTimeStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?\s*[-–]\s*(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
  if (!timeMatch) return false;
  
  const [, openHour, openMin = '0', openPeriod, closeHour, closeMin = '0', closePeriod] = timeMatch;
  
  const parseTime = (hour: string, min: string, period?: string): number => {
    let h = parseInt(hour, 10);
    const m = parseInt(min, 10);
    if (period) {
      if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
      if (period.toUpperCase() === 'AM' && h === 12) h = 0;
    }
    return h * 60 + m;
  };
  
  const openMins = parseTime(openHour, openMin, openPeriod);
  let closeMins = parseTime(closeHour, closeMin, closePeriod);
  
  // Handle overnight hours (e.g., 10PM-2AM)
  if (closeMins <= openMins) closeMins += 24 * 60;
  
  const currentMins = now.hour() * 60 + now.minute();
  
  return currentMins >= openMins && currentMins <= closeMins;
};

// Modal Section Component
type ModalSectionProps = {
  id: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  cardBg: string;
  textColor: string;
  mutedColor: string;
  children: React.ReactNode;
};

const ModalSection = memo(function ModalSection({ id, title, isOpen, onToggle, cardBg, textColor, mutedColor, children }: ModalSectionProps) {
  return (
    <View style={{ marginBottom: 14, borderRadius: 12, borderWidth: 1, borderColor: '#00000020', backgroundColor: cardBg }}>
      <Pressable
        onPress={onToggle}
        style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {id === 'images' ? <Ionicons name="image-outline" size={18} color={mutedColor} /> : null}
          {id === 'location' ? <Ionicons name="location-outline" size={18} color={mutedColor} /> : null}
          <Text style={{ color: textColor, fontWeight: '700', fontSize: 15 }}>{title}</Text>
        </View>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={mutedColor} />
      </Pressable>
      {isOpen ? <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>{children}</View> : null}
    </View>
  );
});

// Add Event Modal Component
type AddEventModalProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const AddEventModal = memo(function AddEventModal({ visible, onClose, onSaved }: AddEventModalProps) {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isNarrowScreen = screenWidth < 500;

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [titleLocal, setTitleLocal] = useState('');
  const [descLocal, setDescLocal] = useState('');
  const [tagsCsv, setTagsCsv] = useState('');
  const [tagsCsvLocal, setTagsCsvLocal] = useState('');
  const [image1, setImage1] = useState('');
  const [image2, setImage2] = useState('');
  const [image3, setImage3] = useState('');
  const [pickedUris, setPickedUris] = useState<string[]>([]);
  const [dateTime, setDateTime] = useState<string>(
    dayjs().add(2, 'day').hour(18).minute(0).second(0).millisecond(0).toISOString()
  );
  const [dateInput, setDateInput] = useState<string>(dayjs().add(2, 'day').format('YYYY-MM-DD'));
  const [timeInput, setTimeInput] = useState<string>('6:00');
  const [endTimeISO, setEndTimeISO] = useState<string | null>(
    dayjs().add(2, 'day').hour(20).minute(0).second(0).millisecond(0).toISOString()
  );
  const [endTimeInput, setEndTimeInput] = useState<string>('8:00');
  const [startMeridiem, setStartMeridiem] = useState<'AM' | 'PM'>('PM');
  const [endMeridiem, setEndMeridiem] = useState<'AM' | 'PM'>('PM');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [rsvp, setRsvp] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  // RSVP Settings
  const [enableRSVP, setEnableRSVP] = useState(false);
  const [capacity, setCapacity] = useState('');
  const [allowWaitlist, setAllowWaitlist] = useState(true);
  const [rsvpRequired, setRsvpRequired] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const [openSections, setOpenSections] = useState({
    essentials: true,
    images: false,
    location: false,
    rsvp: false,
  });

  const prevLatRef = useRef<number | null>(null);
  const prevLngRef = useRef<number | null>(null);
  const [locationStatus, setLocationStatus] = useState('');

  const toggleEssentials = () => setOpenSections((p) => ({ ...p, essentials: !p.essentials }));
  const toggleImages = () => setOpenSections((p) => ({ ...p, images: !p.images }));
  const toggleLocation = () => setOpenSections((p) => ({ ...p, location: !p.location }));
  const toggleRsvp = () => setOpenSections((p) => ({ ...p, rsvp: !p.rsvp }));

  const activeImageInputs = useMemo(() => {
    const count = [image1, image2, image3].filter((s) => s && s.trim().length > 0).length;
    return count === 3 ? 3 : count + 1;
  }, [image1, image2, image3]);

  const imageUrlList = useMemo(() => [image1, image2, image3], [image1, image2, image3]);
  const setImageByIndex = (idx: number, val: string) => {
    if (idx === 0) setImage1(val);
    else if (idx === 1) setImage2(val);
    else if (idx === 2) setImage3(val);
  };

  const typedUrls = useMemo(() => {
    return [image1, image2, image3].filter((s) => s && s.trim().length > 0 && !pickedUris.includes(s));
  }, [image1, image2, image3, pickedUris]);

  const resetForm = () => {
    setTitle('');
    setDesc('');
    setTitleLocal('');
    setDescLocal('');
    setTagsCsv('');
    setTagsCsvLocal('');
    setImage1('');
    setImage2('');
    setImage3('');
    setPickedUris([]);
    setDateTime(dayjs().add(2, 'day').hour(18).minute(0).second(0).millisecond(0).toISOString());
    setDateInput(dayjs().add(2, 'day').format('YYYY-MM-DD'));
    setTimeInput('6:00');
    setEndTimeISO(dayjs().add(2, 'day').hour(20).minute(0).second(0).millisecond(0).toISOString());
    setEndTimeInput('8:00');
    setStartMeridiem('PM');
    setEndMeridiem('PM');
    setLocation('');
    setLatitude(null);
    setLongitude(null);
    setRsvp('');
    setEnableRSVP(false);
    setCapacity('');
    setAllowWaitlist(true);
    setRsvpRequired(false);
    setSavingEvent(false);
    setShowValidation(false);
    setLocationStatus('');
    prevLatRef.current = null;
    prevLngRef.current = null;
  };

  const submit = async () => {
    setShowValidation(true);
    const finalTitle = titleLocal.trim() || title.trim();
    const finalTagsCsv = tagsCsvLocal.trim() || tagsCsv.trim();

    if (!finalTitle) {
      Alert.alert('Missing title', 'Please provide an event title.');
      return;
    }
    if (!finalTagsCsv) {
      Alert.alert('Missing tags', 'Please add at least one tag to categorize your event.');
      return;
    }

    const allImages = [...pickedUris, image1, image2, image3].filter(Boolean);
    if (allImages.length === 0) {
      Alert.alert('Add an image', 'Please add at least one image URL or pick a photo.');
      return;
    }

    const profCheck = checkProfanity(finalTitle + ' ' + (descLocal || desc) + ' ' + finalTagsCsv);
    if (!profCheck.isClean) {
      Alert.alert('Inappropriate content', `Please remove inappropriate words: ${profCheck.reasons?.join(', ')}`);
      return;
    }

    setSavingEvent(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        Alert.alert('Not authenticated', 'Please sign in to create an event.');
        setSavingEvent(false);
        return;
      }

      const payload: any = {
        title: finalTitle,
        description: descLocal || desc,
        date_time: dateTime,
        end_time: endTimeISO,
        location: location || null,
        latitude,
        longitude,
        tags: finalTagsCsv.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
        rsvp_url: rsvp.trim() || null,
        organizer_id: user.id,
        visibility: 'public' as const,
        // RSVP settings
        capacity: enableRSVP && capacity ? parseInt(capacity, 10) : null,
        allow_join_requests: enableRSVP && allowWaitlist,
        rsvp_required: enableRSVP && rsvpRequired,
      };

      const eventData = await createEvent(payload);
      if (!eventData?.id) throw new Error('Event creation failed');

      // Upload images if any
      if (pickedUris.length > 0) {
        await uploadEventImages(pickedUris);
      }

      // Update with typed URLs
      const typedImageUrls = [image1, image2, image3].filter((s) => s && s.trim().length > 0);
      if (typedImageUrls.length > 0) {
        const existing = eventData.image_urls || [];
        const merged = [...existing, ...typedImageUrls].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
        await supabase.from('events').update({ image_urls: merged }).eq('id', eventData.id);
      }

      Alert.alert('Success', 'Event created successfully!');
      resetForm();
      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not create event');
    } finally {
      setSavingEvent(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => !savingEvent && onClose()}>
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.background }}>
        <HeaderSpacer />
        <BlurView intensity={30} tint={scheme === 'dark' ? 'dark' : 'light'} style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Add Event</Text>
            <Pressable
              onPress={onClose}
              style={{ backgroundColor: '#00000020', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
            >
              <Ionicons name="close" size={24} color={c.text} />
            </Pressable>
          </View>
        </BlurView>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
          <ModalSection
            id="essentials"
            title="Details"
            isOpen={openSections.essentials}
            onToggle={toggleEssentials}
            cardBg={c.card}
            textColor={c.text}
            mutedColor={c.muted}
          >
            <TextInput
              placeholder="Title"
              placeholderTextColor={c.muted}
              value={titleLocal}
              onChangeText={setTitleLocal}
              onBlur={() => setTitle(titleLocal)}
              style={{
                color: c.text,
                backgroundColor: '#00000010',
                padding: 12,
                borderRadius: 10,
                fontSize: 15,
                borderWidth: 1,
                borderColor: showValidation && !titleLocal.trim() ? '#ff4444' : '#00000020',
              }}
            />
            <View>
              <TextInput
                placeholder="Description, Building/Room Number, etc."
                placeholderTextColor={c.muted}
                value={descLocal}
                onChangeText={setDescLocal}
                onBlur={() => setDesc(descLocal)}
                multiline
                style={{
                  color: c.text,
                  backgroundColor: '#00000010',
                  padding: 12,
                  borderRadius: 10,
                  minHeight: 100,
                  fontSize: 14,
                }}
              />
              <Text style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>{descLocal.length} chars</Text>
            </View>
            <View style={{ gap: 6 }}>
              <TextInput
                placeholder="Tags (comma separated ex: workshop, engineering, free food)"
                placeholderTextColor={c.muted}
                value={tagsCsvLocal}
                onChangeText={setTagsCsvLocal}
                onBlur={() => setTagsCsv(tagsCsvLocal)}
                style={{
                  color: c.text,
                  backgroundColor: '#00000010',
                  padding: 12,
                  borderRadius: 10,
                  fontSize: 14,
                  borderWidth: 1,
                  borderColor: showValidation && !tagsCsvLocal.trim().length ? '#ff4444' : '#00000020',
                }}
                autoCapitalize="none"
              />
              {tagsCsvLocal.trim().length === 0 ? (
                showValidation ? (
                  <Text style={{ color: '#ff6666', fontSize: 11 }}>Add at least one tag.</Text>
                ) : null
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {Array.from(
                    new Set(
                      tagsCsvLocal
                        .split(',')
                        .map((t) => t.trim().toLowerCase())
                        .filter(Boolean)
                    )
                  )
                    .slice(0, 12)
                    .map((t) => (
                      <View
                        key={t}
                        style={{ backgroundColor: c.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}
                      >
                        <Text style={{ color: '#000', fontSize: 11, fontWeight: '700' }}>#{t}</Text>
                      </View>
                    ))}
                </View>
              )}
            </View>
          </ModalSection>

          {/* When Section */}
          <View
            style={{ marginBottom: 14, borderRadius: 12, borderWidth: 1, borderColor: '#00000020', backgroundColor: c.card }}
          >
            <View style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="time-outline" size={18} color={c.muted} />
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>When</Text>
            </View>
            {Platform.OS === 'web' ? (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
                <Pressable
                  style={{ backgroundColor: '#00000010', padding: 12, borderRadius: 10, position: 'relative' }}
                  onPress={() => {
                    const input = (globalThis as any).document?.getElementById?.('discover-event-date-picker');
                    if (input) input.showPicker?.() || input.click?.();
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '700', textAlign: 'center' }}>
                    {dayjs(dateTime).format('dddd, MMMM D, YYYY')}
                  </Text>
                  {Platform.OS === 'web' && (
                    <input
                      id="discover-event-date-picker"
                      type="date"
                      value={dateInput}
                      onChange={(e: any) => {
                        const val = e.target.value;
                        setDateInput(val);
                        const parsed = dayjs(val, 'YYYY-MM-DD', true);
                        if (parsed.isValid()) {
                          const current = dayjs(dateTime);
                          const merged = parsed.hour(current.hour()).minute(current.minute()).second(0).millisecond(0);
                          setDateTime(merged.toISOString());
                          if (endTimeISO) {
                            const end = dayjs(endTimeISO);
                            const endMerged = parsed.hour(end.hour()).minute(end.minute()).second(0).millisecond(0);
                            setEndTimeISO(endMerged.toISOString());
                          }
                        }
                      }}
                      style={{
                        position: 'absolute',
                        opacity: 0,
                        width: '100%',
                        height: '100%',
                        top: 0,
                        left: 0,
                        cursor: 'pointer',
                      }}
                    />
                  )}
                </Pressable>

                <View style={{ flexDirection: isNarrowScreen ? 'column' : 'row', gap: 8 }}>
                  <View style={{ flex: isNarrowScreen ? undefined : 1 }}>
                    <Text style={{ color: c.muted, fontSize: 11, marginBottom: 4 }}>Start Time</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TextInput
                        placeholder="e.g. 3:30"
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
                        }}
                        style={{
                          flex: 1,
                          color: c.text,
                          backgroundColor: '#00000010',
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 10,
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="default"
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
                          let h24 = hour % 12;
                          const baseDate = dayjs(dateInput, 'YYYY-MM-DD', true).isValid()
                            ? dayjs(dateInput, 'YYYY-MM-DD', true)
                            : dayjs(dateTime);
                          const merged = baseDate.hour(h24).minute(minute).second(0).millisecond(0);
                          setDateTime(merged.toISOString());
                        }}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 8,
                          backgroundColor: startMeridiem === 'AM' ? c.primary : 'transparent',
                          borderWidth: 1,
                          borderColor: '#00000030',
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
                          let h24 = (hour % 12) + 12;
                          const baseDate = dayjs(dateInput, 'YYYY-MM-DD', true).isValid()
                            ? dayjs(dateInput, 'YYYY-MM-DD', true)
                            : dayjs(dateTime);
                          const merged = baseDate.hour(h24).minute(minute).second(0).millisecond(0);
                          setDateTime(merged.toISOString());
                        }}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 8,
                          backgroundColor: startMeridiem === 'PM' ? c.primary : 'transparent',
                          borderWidth: 1,
                          borderColor: '#00000030',
                        }}
                      >
                        <Text style={{ color: startMeridiem === 'PM' ? '#000' : c.text, fontWeight: '700' }}>PM</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={{ flex: isNarrowScreen ? undefined : 1 }}>
                    <Text style={{ color: c.muted, fontSize: 11, marginBottom: 4 }}>End Time (optional)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TextInput
                        placeholder="e.g. 5:00"
                        placeholderTextColor={c.muted}
                        value={endTimeInput}
                        onChangeText={(val) => {
                          setEndTimeInput(val);
                          const m = val.trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
                          if (val.trim() === '') {
                            setEndTimeISO(null);
                            return;
                          }
                          if (!m) return;
                          let hour = parseInt(m[1], 10);
                          const minute = m[2] ? parseInt(m[2], 10) : 0;
                          if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return;
                          let h24 = hour % 12;
                          if (endMeridiem === 'PM') h24 += 12;
                          const baseStart = dayjs(dateTime);
                          const end = baseStart.hour(h24).minute(minute).second(0).millisecond(0);
                          setEndTimeISO(end.toISOString());
                        }}
                        style={{
                          flex: 1,
                          color: c.text,
                          backgroundColor: '#00000010',
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 10,
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="default"
                      />
                      <Pressable
                        onPress={() => {
                          setEndMeridiem('AM');
                          const m = endTimeInput.trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
                          if (!m) return;
                          let hour = Math.min(12, Math.max(1, parseInt(m[1], 10)));
                          const minute = m[2] ? Math.min(59, Math.max(0, parseInt(m[2], 10))) : 0;
                          let h24 = hour % 12;
                          const baseStart = dayjs(dateTime);
                          const end = baseStart.hour(h24).minute(minute).second(0).millisecond(0);
                          setEndTimeISO(end.toISOString());
                        }}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 8,
                          backgroundColor: endMeridiem === 'AM' ? c.primary : 'transparent',
                          borderWidth: 1,
                          borderColor: '#00000030',
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
                          let h24 = (hour % 12) + 12;
                          const baseStart = dayjs(dateTime);
                          const end = baseStart.hour(h24).minute(minute).second(0).millisecond(0);
                          setEndTimeISO(end.toISOString());
                        }}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 8,
                          backgroundColor: endMeridiem === 'PM' ? c.primary : 'transparent',
                          borderWidth: 1,
                          borderColor: '#00000030',
                        }}
                      >
                        <Text style={{ color: endMeridiem === 'PM' ? '#000' : c.text, fontWeight: '700' }}>PM</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
                <Text style={{ color: c.muted, fontSize: 11 }}>
                  Start: {dayjs(dateTime).format('YYYY-MM-DD h:mm A')}{' '}
                  {endTimeISO ? `· End: ${dayjs(endTimeISO).format('h:mm A')}` : ''}
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
                    <Text style={{ color: c.text, fontWeight: '700' }}>
                      {endTimeISO ? dayjs(endTimeISO).format('h:mm A') : 'Add end (optional)'}
                    </Text>
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
                      const merged = base.hour(selected.getHours()).minute(selected.getMinutes()).second(0).millisecond(0);
                      setEndTimeISO(merged.toISOString());
                    }}
                  />
                ) : null}
              </View>
            )}
          </View>

          <ModalSection
            id="images"
            title="Images"
            isOpen={openSections.images}
            onToggle={toggleImages}
            cardBg={c.card}
            textColor={c.text}
            mutedColor={c.muted}
          >
            <View style={{ gap: 10 }}>
              {activeImageInputs >= 1 &&
                Array.from({ length: activeImageInputs }).map((_, idx) => (
                  <TextInput
                    key={idx}
                    placeholder={idx === 0 ? 'Cover image URL or paste' : `Image ${idx + 1} URL`}
                    placeholderTextColor={c.muted}
                    value={imageUrlList[idx]}
                    onChangeText={(val) => setImageByIndex(idx, val)}
                    style={{
                      color: c.text,
                      backgroundColor: '#00000010',
                      padding: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor:
                        showValidation && idx === 0 && pickedUris.length === 0 && [image1, image2, image3].every((s) => !(s && s.trim().length))
                          ? '#ff4444'
                          : '#00000020',
                    }}
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
                  style={{
                    backgroundColor: c.primary,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Ionicons name="image" size={16} color="#000" />
                  <Text style={{ color: '#000', fontWeight: '700' }}>Pick Photos</Text>
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
          </ModalSection>

          <ModalSection
            id="location"
            title="Location"
            isOpen={openSections.location}
            onToggle={toggleLocation}
            cardBg={c.card}
            textColor={c.text}
            mutedColor={c.muted}
          >
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
          </ModalSection>

          {/* RSVP Settings */}
          <ModalSection
            id="rsvp"
            title="RSVP & Capacity"
            isOpen={openSections.rsvp}
            onToggle={toggleRsvp}
            cardBg={c.card}
            textColor={c.text}
            mutedColor={c.muted}
          >
            <View style={{ gap: 12 }}>
              {/* Enable RSVP Toggle */}
              <Pressable
                onPress={() => setEnableRSVP(!enableRSVP)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#00000010',
                  padding: 12,
                  borderRadius: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>Enable Custom RSVP</Text>
                  <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
                    Manage attendees, set capacity, and track RSVPs
                  </Text>
                </View>
                <View
                  style={{
                    width: 50,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: enableRSVP ? c.primary : '#00000020',
                    justifyContent: 'center',
                    alignItems: enableRSVP ? 'flex-end' : 'flex-start',
                    paddingHorizontal: 2,
                  }}
                >
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: '#fff',
                    }}
                  />
                </View>
              </Pressable>

              {enableRSVP && (
                <>
                  {/* Capacity Limit */}
                  <View>
                    <Text style={{ color: c.text, fontWeight: '600', fontSize: 13, marginBottom: 6 }}>
                      Event Capacity
                    </Text>
                    <TextInput
                      placeholder="e.g. 50 (leave empty for unlimited)"
                      placeholderTextColor={c.muted}
                      value={capacity}
                      onChangeText={(val) => setCapacity(val.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      style={{
                        color: c.text,
                        backgroundColor: '#00000010',
                        padding: 12,
                        borderRadius: 10,
                        fontSize: 14,
                      }}
                    />
                    <Text style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>
                      Maximum number of attendees who can RSVP
                    </Text>
                  </View>

                  {/* Allow Waitlist */}
                  {capacity && parseInt(capacity) > 0 && (
                    <Pressable
                      onPress={() => setAllowWaitlist(!allowWaitlist)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: '#00000010',
                        padding: 12,
                        borderRadius: 10,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>Enable Waitlist</Text>
                        <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
                          Allow users to join a waitlist when capacity is full
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 50,
                          height: 30,
                          borderRadius: 15,
                          backgroundColor: allowWaitlist ? c.primary : '#00000020',
                          justifyContent: 'center',
                          alignItems: allowWaitlist ? 'flex-end' : 'flex-start',
                          paddingHorizontal: 2,
                        }}
                      >
                        <View
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 13,
                            backgroundColor: '#fff',
                          }}
                        />
                      </View>
                    </Pressable>
                  )}

                  {/* RSVP Required */}
                  <Pressable
                    onPress={() => setRsvpRequired(!rsvpRequired)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#00000010',
                      padding: 12,
                      borderRadius: 10,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>RSVP Required</Text>
                      <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
                        Attendees must RSVP to view event details
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 50,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: rsvpRequired ? c.primary : '#00000020',
                        justifyContent: 'center',
                        alignItems: rsvpRequired ? 'flex-end' : 'flex-start',
                        paddingHorizontal: 2,
                      }}
                    >
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          backgroundColor: '#fff',
                        }}
                      />
                    </View>
                  </Pressable>

                  {/* Info Box */}
                  <View
                    style={{
                      backgroundColor: c.primary + '15',
                      padding: 12,
                      borderRadius: 10,
                      borderLeftWidth: 3,
                      borderLeftColor: c.primary,
                    }}
                  >
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Ionicons name="information-circle" size={18} color={c.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.text, fontSize: 12, lineHeight: 18 }}>
                          With RSVP enabled, you can view who has RSVPed, manage the waitlist, and track attendance.
                          Attendees will see real-time capacity info.
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </View>
          </ModalSection>

          {/* External RSVP URL (optional) */}
          <View
            style={{ marginBottom: 14, borderRadius: 12, borderWidth: 1, borderColor: '#00000020', backgroundColor: c.card }}
          >
            <View style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="link-outline" size={18} color={c.muted} />
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>External RSVP Link</Text>
            </View>
            <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
              <TextInput
                placeholder="External RSVP URL (optional, if using another platform)"
                placeholderTextColor={c.muted}
                value={rsvp}
                onChangeText={setRsvp}
                style={{ color: c.text, backgroundColor: '#00000010', padding: 12, borderRadius: 10 }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {rsvp.trim().length > 0 ? (
                <Text style={{ color: c.muted, fontSize: 11 }}>This will be shown alongside the custom RSVP button.</Text>
              ) : null}
            </View>
          </View>
        </ScrollView>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, zIndex: 100 }}>
          <BlurView intensity={30} tint={scheme === 'dark' ? 'dark' : 'light'} style={{ borderRadius: 16, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', gap: 12, padding: 12 }}>
              <Pressable
                onPress={() => {
                  if (savingEvent) return;
                  submit();
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: savingEvent ? c.muted : pressed ? `${c.primary}dd` : c.primary,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: savingEvent ? 0.7 : 1,
                  cursor: Platform.OS === 'web' ? 'pointer' : undefined,
                } as any)}
              >
                <Text style={{ color: '#000', fontWeight: '700' }}>{savingEvent ? 'Saving…' : 'Create Event'}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (savingEvent) return;
                  onClose();
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: pressed ? '#00000050' : '#00000030',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: savingEvent ? 0.7 : 1,
                  cursor: Platform.OS === 'web' ? 'pointer' : undefined,
                } as any)}
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

export default function DiscoverPage() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const columns = width >= 1280 ? 3 : isWide ? 2 : 1;
  const GAP = 12;
  const MAX_COL_WIDTH = 420;
  const MAX_GRID_WIDTH = columns * MAX_COL_WIDTH + GAP * (columns - 1);

  // Toggle state
  const [mode, setMode] = useState<DiscoverMode>('food');
  const [view, setView] = useState<'row' | 'grid'>(isWide ? 'grid' : 'row');
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('match');
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  // Interests state
  const [interestsExpanded, setInterestsExpanded] = useState(false);
  const [foodInterests, setFoodInterests] = useState<string[]>([]);
  const [eventInterests, setEventInterests] = useState<string[]>([]);
  const [editingInterests, setEditingInterests] = useState(false);
  const [newInterestInput, setNewInterestInput] = useState('');
  const [savingInterests, setSavingInterests] = useState(false);
  
  // Animation for toggle
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: mode === 'food' ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  }, [mode]);

  // Food state
  const [foodRecommended, setFoodRecommended] = useState<Restaurant[]>([]);
  const [foodItems, setFoodItems] = useState<Restaurant[]>([]);
  const [foodPage, setFoodPage] = useState(0);
  const [foodHasMore, setFoodHasMore] = useState(true);
  const [foodLoading, setFoodLoading] = useState(false);
  const [savedRestaurantIds, setSavedRestaurantIds] = useState<string[]>([]);

  // Events state
  const [eventRecommended, setEventRecommended] = useState<Event[]>([]);
  const [eventItems, setEventItems] = useState<Event[]>([]);
  const [eventPage, setEventPage] = useState(0);
  const [eventHasMore, setEventHasMore] = useState(true);
  const [eventLoading, setEventLoading] = useState(false);
  const [savedEventIds, setSavedEventIds] = useState<number[]>([]);

  // Common state
  const [isAuthed, setIsAuthed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const PAGE_SIZE = 20;
  const endReachedDuringMomentum = useRef(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Budget filter for food (multiple ranges: [[min, max], ...] or empty for no filter)
  const [budgetRanges, setBudgetRanges] = useState<Array<[number, number]>>([]);

  // Location for food
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locAttempted, setLocAttempted] = useState(false);
  const [locLoading, setLocLoading] = useState(false);

  // Add event modal state
  const [addEventModalOpen, setAddEventModalOpen] = useState(false);

  const { triggerNotification } = useSavedNotification();

  // Location helper
  const ensureLocation = useCallback(async () => {
    if (userLocation || locLoading) return userLocation;
    setLocAttempted(true);
    setLocLoading(true);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).geolocation) {
        return await new Promise<{ lat: number; lon: number } | null>((resolve) => {
          (navigator as any).geolocation.getCurrentPosition(
            (pos: any) => {
              const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
              setUserLocation(loc);
              resolve(loc);
            },
            () => resolve(null),
            { enableHighAccuracy: true, maximumAge: 300000, timeout: 10000 }
          );
        });
      } else {
        const Location: any = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return null;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserLocation(loc);
        return loc;
      }
    } catch {
      return null;
    } finally {
      setLocLoading(false);
    }
  }, [userLocation, locLoading]);

  // Auth check and load interests
  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      setIsAuthed(!!user);
      setUserId(user?.id ?? null);
      if (user) {
        // Load saved restaurants
        const sr = await supabase
          .from('saved_restaurants')
          .select('restaurant_id')
          .eq('user_id', user.id);
        setSavedRestaurantIds(((sr.data ?? []) as any[]).map((r: any) => String(r.restaurant_id)));
        
        // Load saved events
        const se = await supabase
          .from('saved_events')
          .select('event_id')
          .eq('user_id', user.id);
        setSavedEventIds(((se.data ?? []) as any[]).map((e: any) => e.event_id));
        
        // Load food interests
        const fi = await supabase
          .from('user_food_interests')
          .select('names')
          .eq('user_id', user.id)
          .maybeSingle();
        setFoodInterests(((fi.data?.names as any) ?? []).map((n: string) => n.toLowerCase()));
        
        // Load event interests
        const ei = await supabase
          .from('user_event_interests')
          .select('names')
          .eq('user_id', user.id)
          .maybeSingle();
        setEventInterests(((ei.data?.names as any) ?? []).map((n: string) => n.toLowerCase()));
      }
    })();
  }, []);

  // Load food data
  const loadFoodPage = async (p: number) => {
    setFoodLoading(true);
    try {
      const from = p * PAGE_SIZE;
      const base = await listRestaurants(from, PAGE_SIZE);
      setFoodItems((prev) => (p === 0 ? base : [...prev, ...base]));
      setFoodHasMore(base.length === PAGE_SIZE);
      setFoodPage(p + 1);
    } finally {
      setFoodLoading(false);
    }
  };

  // Load events data
  const loadEventPage = async (p: number) => {
    setEventLoading(true);
    try {
      const from = p * PAGE_SIZE;
      const base = await listEvents(from, PAGE_SIZE);
      setEventItems((prev) => (p === 0 ? base : [...prev, ...base]));
      setEventHasMore(base.length === PAGE_SIZE);
      setEventPage(p + 1);
    } finally {
      setEventLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    (async () => {
      try {
        // Load food recommendations
        const foodTop = await getTopUserRestaurantMatches(10);
        setFoodRecommended(foodTop as any);
        
        // Load event recommendations
        const eventTop = await getTopUserMatches(10);
        setEventRecommended(eventTop as any);
        
        // Load initial pages
        if (foodPage === 0 && foodItems.length === 0) void loadFoodPage(0);
        if (eventPage === 0 && eventItems.length === 0) void loadEventPage(0);
      } catch {}
    })();
  }, []);

  // Search debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        if (mode === 'food') {
          const results = await searchRestaurants(query, 0, 40);
          setFoodItems(results);
          setFoodHasMore(false);
        } else {
          const results = await searchEvents(query, 0, 40);
          setEventItems(results);
          setEventHasMore(false);
        }
      } catch {}
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode]);

  // Combined data
  const foodCombined = useMemo(() => {
    if (query.trim().length >= 2) return foodItems;
    const recIds = new Set(foodRecommended.map((r) => r.id));
    const rest = foodItems.filter((i) => !recIds.has(i.id));
    return [...foodRecommended, ...rest];
  }, [foodItems, foodRecommended, query]);

  const eventCombined = useMemo(() => {
    if (query.trim().length >= 2) return eventItems;
    const recIds = new Set(eventRecommended.map((e) => e.id));
    const rest = eventItems.filter((i) => !recIds.has(i.id));
    return [...eventRecommended, ...rest];
  }, [eventItems, eventRecommended, query]);

  // Filter food by budget range
  const filteredFood = useMemo(() => {
    if (budgetRanges.length === 0) return foodCombined;
    
    const parseMaxPrice = (range?: string | null): number | null => {
      if (!range) return null;
      const cleaned = String(range).replace(/[\$\s]/g, '').replace(/[–—]/g, '-');
      
      if (/[+]/.test(cleaned)) {
        const match = cleaned.match(/(\d+)/);
        return match ? Number(match[1]) : null;
      }
      
      const numbers = cleaned.match(/\d+/g)?.map(Number) ?? [];
      if (numbers.length >= 2) return numbers[1];
      if (numbers.length === 1) return numbers[0];
      
      const dollarSigns = (String(range).match(/\$/g) || []).length;
      return dollarSigns ? dollarSigns * 10 : null;
    };
    
    return foodCombined.filter((restaurant) => {
      const maxPrice = parseMaxPrice(restaurant.price_range);
      if (maxPrice === null) return true;
      
      // Check if price falls within ANY of the selected ranges
      return budgetRanges.some(([minBudget, maxBudget]) => 
        maxPrice >= minBudget && maxPrice <= maxBudget
      );
    });
  }, [foodCombined, budgetRanges]);

  // Sort data based on sortMode
  const sortedFood = useMemo(() => {
    if (sortMode === 'match') {
      return [...filteredFood].sort((a, b) => ((b as any).match_percent ?? 0) - ((a as any).match_percent ?? 0));
    }
    if (sortMode === 'open') {
      // Filter to only open restaurants, then sort by match percent
      const openRestaurants = filteredFood.filter(r => isRestaurantOpen(r));
      return openRestaurants.sort((a, b) => ((b as any).match_percent ?? 0) - ((a as any).match_percent ?? 0));
    }
    if (sortMode === 'closest' && userLocation) {
      const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const toRad = (d: number) => (d * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };
      return [...filteredFood].sort((a, b) => {
        const aLat = Number(a.latitude), aLon = Number(a.longitude);
        const bLat = Number(b.latitude), bLon = Number(b.longitude);
        const aDist = (aLat && aLon) ? haversine(userLocation.lat, userLocation.lon, aLat, aLon) : Infinity;
        const bDist = (bLat && bLon) ? haversine(userLocation.lat, userLocation.lon, bLat, bLon) : Infinity;
        return aDist - bDist;
      });
    }
    return filteredFood;
  }, [filteredFood, sortMode, userLocation]);

  const sortedEvents = useMemo(() => {
    if (sortMode === 'match') {
      return [...eventCombined].sort((a, b) => ((b as any).match_percent ?? 0) - ((a as any).match_percent ?? 0));
    }
    if (sortMode === 'latest') {
      return [...eventCombined].sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());
    }
    if (sortMode === 'upcoming') {
      // Filter to only future events and sort by closest to current time
      const now = dayjs();
      const futureEvents = eventCombined.filter(e => dayjs(e.date_time).isAfter(now));
      return futureEvents.sort((a, b) => {
        const aTime = dayjs(a.date_time).valueOf();
        const bTime = dayjs(b.date_time).valueOf();
        return aTime - bTime; // Closest upcoming first
      });
    }
    if (sortMode === 'closest' && userLocation) {
      const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const toRad = (d: number) => (d * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };
      return [...eventCombined].sort((a, b) => {
        const aLat = a.latitude, aLon = a.longitude;
        const bLat = b.latitude, bLon = b.longitude;
        const aDist = (aLat && aLon) ? haversine(userLocation.lat, userLocation.lon, aLat, aLon) : Infinity;
        const bDist = (bLat && bLon) ? haversine(userLocation.lat, userLocation.lon, bLat, bLon) : Infinity;
        return aDist - bDist;
      });
    }
    return eventCombined;
  }, [eventCombined, sortMode, userLocation]);

  const savedRestaurantSet = useMemo(() => new Set(savedRestaurantIds), [savedRestaurantIds]);
  const savedEventSet = useMemo(() => new Set(savedEventIds), [savedEventIds]);

  const requireAuth = async (): Promise<boolean> => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      router.push('/onboarding/welcome');
      return false;
    }
    return true;
  };

  const toggleSaveRestaurant = async (id: string) => {
    const ok = await requireAuth();
    if (!ok) return;
    const user = (await supabase.auth.getUser()).data.user!;
    const isSaved = savedRestaurantSet.has(id);
    await optimisticUpdate({
      apply: () => {
        const prev = savedRestaurantIds;
        setSavedRestaurantIds((s) => (isSaved ? s.filter((x) => x !== id) : [...s, id]));
        return prev;
      },
      rollback: (prev) => setSavedRestaurantIds(prev),
      mutate: async () => {
        if (isSaved) {
          await supabase.from('saved_restaurants').delete().eq('user_id', user.id).eq('restaurant_id', id);
        } else {
          await supabase.from('saved_restaurants').insert({ user_id: user.id, restaurant_id: id });
          await triggerNotification();
        }
      },
    });
  };

  const toggleSaveEvent = async (id: number) => {
    const ok = await requireAuth();
    if (!ok) return;
    const user = (await supabase.auth.getUser()).data.user!;
    const isSaved = savedEventSet.has(id);
    await optimisticUpdate({
      apply: () => {
        const prev = savedEventIds;
        setSavedEventIds((s) => (isSaved ? s.filter((x) => x !== id) : [...s, id]));
        return prev;
      },
      rollback: (prev) => setSavedEventIds(prev),
      mutate: async () => {
        if (isSaved) {
          await supabase.from('saved_events').delete().eq('user_id', user.id).eq('event_id', id);
        } else {
          await supabase.from('saved_events').insert({ user_id: user.id, event_id: id });
          await triggerNotification();
        }
      },
    });
  };

  // Interest management
  const currentInterests = mode === 'food' ? foodInterests : eventInterests;
  const setCurrentInterests = mode === 'food' ? setFoodInterests : setEventInterests;

  const addInterest = (text: string) => {
    const parts = text.split(/[,\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return;
    setCurrentInterests(prev => {
      const next = [...prev, ...parts].filter((v, i, a) => a.indexOf(v) === i).slice(0, 24);
      return next;
    });
  };

  const removeInterest = (tag: string) => {
    setCurrentInterests(prev => prev.filter(t => t !== tag));
  };

  const saveInterests = async () => {
    if (!userId) return;
    setSavingInterests(true);
    try {
      const table = mode === 'food' ? 'user_food_interests' : 'user_event_interests';
      await supabase.from(table).upsert({ user_id: userId, names: currentInterests });
      setEditingInterests(false);
    } catch {}
    setSavingInterests(false);
  };

  const toggleInterestsExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setInterestsExpanded(prev => !prev);
    setEditingInterests(false);
  };

  // Budget filter with price ranges
  const BUDGET_RANGES: Array<{ label: string; range: [number, number] }> = [
    { label: '$0-10', range: [0, 10] },
    { label: '$10-20', range: [10, 20] },
    { label: '$20-30', range: [20, 30] },
    { label: '$30-40', range: [30, 40] },
    { label: '$40+', range: [40, 999] },
  ];

  const handleBudgetRangeToggle = useCallback((range: [number, number]) => {
    setBudgetRanges(prev => {
      const isSelected = prev.some(r => r[0] === range[0] && r[1] === range[1]);
      if (isSelected) {
        return prev.filter(r => !(r[0] === range[0] && r[1] === range[1]));
      } else {
        return [...prev, range];
      }
    });
  }, []);

  const clearAllBudgetRanges = useCallback(() => {
    setBudgetRanges([]);
  }, []);

  // Budget Filter Component
  const BudgetFilter = useMemo(() => (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: BorderRadius.md,
        padding: Spacing.sm,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="wallet-outline" size={16} color={c.primary} />
          <Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>Price Range</Text>
          {budgetRanges.length > 0 && (
            <View
              style={{
                backgroundColor: c.primary,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: BorderRadius.full,
              }}
            >
              <Text style={{ color: scheme === 'dark' ? '#000' : '#fff', fontSize: 10, fontWeight: '700' }}>
                {budgetRanges.length}
              </Text>
            </View>
          )}
        </View>
        {budgetRanges.length > 0 && (
          <Pressable onPress={clearAllBudgetRanges} hitSlop={8}>
            <Text style={{ color: c.primary, fontSize: 12, fontWeight: '600' }}>Clear All</Text>
          </Pressable>
        )}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {BUDGET_RANGES.map(({ label, range }) => {
          const isSelected = budgetRanges.some(r => r[0] === range[0] && r[1] === range[1]);
          
          return (
            <Pressable
              key={label}
              onPress={() => handleBudgetRangeToggle(range)}
              style={{
                backgroundColor: isSelected
                  ? c.primary
                  : scheme === 'dark'
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.06)',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: BorderRadius.full,
                minWidth: 58,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: isSelected ? (scheme === 'dark' ? '#000' : '#fff') : c.text,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  ), [c, scheme, budgetRanges, handleBudgetRangeToggle, clearAllBudgetRanges]);

  // Interests Bar Component
  const InterestsBar = () => {
    if (!isAuthed) return null;
    
    return (
      <View
        style={{
          backgroundColor: c.card,
          borderRadius: BorderRadius.md,
          marginBottom: Spacing.sm,
          borderWidth: 1,
          borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        <Pressable
          onPress={toggleInterestsExpanded}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: Spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="heart" size={16} color={c.primary} />
            <Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>
              Your Interests
            </Text>
            {currentInterests.length > 0 && (
              <View style={{
                backgroundColor: c.primary + '20',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 10,
              }}>
                <Text style={{ color: c.primary, fontSize: 11, fontWeight: '600' }}>
                  {currentInterests.length}
                </Text>
              </View>
            )}
          </View>
          <Ionicons
            name={interestsExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={c.muted}
          />
        </Pressable>

        {interestsExpanded && (
          <View style={{ paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm }}>
            {editingInterests ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {currentInterests.map((tag, i) => (
                    <View
                      key={`${tag}-${i}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: c.primary,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ color: scheme === 'dark' ? '#000' : '#fff', fontSize: 12, fontWeight: '600' }}>
                        {tag}
                      </Text>
                      <Pressable onPress={() => removeInterest(tag)}>
                        <Ionicons name="close" size={14} color={scheme === 'dark' ? '#000' : '#fff'} />
                      </Pressable>
                    </View>
                  ))}
                </View>
                <TextInput
                  value={newInterestInput}
                  onChangeText={(val) => {
                    if (/[,\n]/.test(val)) {
                      addInterest(val);
                      setNewInterestInput('');
                    } else {
                      setNewInterestInput(val);
                    }
                  }}
                  onSubmitEditing={() => {
                    addInterest(newInterestInput);
                    setNewInterestInput('');
                  }}
                  placeholder={mode === 'food' ? 'Add cuisine (e.g. mexican, sushi)' : 'Add interest (e.g. tech, music)'}
                  placeholderTextColor={c.muted}
                  style={{
                    backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    color: c.text,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    fontSize: 14,
                  }}
                  autoCapitalize="none"
                  returnKeyType="done"
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={saveInterests}
                    disabled={savingInterests}
                    style={{
                      backgroundColor: savingInterests ? c.muted : c.primary,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: scheme === 'dark' ? '#000' : '#fff', fontWeight: '700' }}>
                      {savingInterests ? 'Saving...' : 'Save'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEditingInterests(false)}
                    style={{
                      backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: c.text, fontWeight: '600' }}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {currentInterests.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {currentInterests.map((tag, i) => (
                      <View
                        key={`${tag}-${i}`}
                        style={{
                          backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                        }}
                      >
                        <Text style={{ color: c.text, fontSize: 12 }}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: c.muted, fontSize: 12 }}>
                    No interests added yet. Tap Edit to add some!
                  </Text>
                )}
                <Pressable
                  onPress={() => setEditingInterests(true)}
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>Edit</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const ListHeader = () => (
    <View>
      <InterestsBar />
      {mode === 'food' && BudgetFilter}
    </View>
  );

  const currentData = mode === 'food' ? sortedFood : sortedEvents;
  const currentLoading = mode === 'food' ? foodLoading : eventLoading;
  const currentHasMore = mode === 'food' ? foodHasMore : eventHasMore;
  const currentPage = mode === 'food' ? foodPage : eventPage;
  const loadMore = mode === 'food' ? loadFoodPage : loadEventPage;

  const sortOptions: { key: SortMode; label: string; icon: string }[] = [
    { key: 'match', label: 'Top Match', icon: 'sparkles' },
    { key: 'closest', label: 'Closest', icon: 'location' },
    ...(mode === 'food' ? [{ key: 'open' as SortMode, label: 'Open Now', icon: 'time-outline' }] : []),
    ...(mode === 'events' ? [
      { key: 'upcoming' as SortMode, label: 'Upcoming', icon: 'calendar-outline' },
      { key: 'latest' as SortMode, label: 'Latest', icon: 'time' },
    ] : []),
  ];

  return (
    <GradientBackground variant="dim">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flex: 1, paddingHorizontal: Spacing.md, paddingTop: Math.max(insets.top > 0 ? 12 : 16, 12) }}>
          {/* Toggle Header */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            paddingVertical: Spacing.sm,
          }}>
            {/* Mode Toggle */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                borderRadius: BorderRadius.lg,
                padding: 4,
              }}
            >
              <Pressable
                onPress={() => setMode('food')}
                style={{
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.sm,
                  borderRadius: BorderRadius.md,
                  backgroundColor: mode === 'food' ? c.primary : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons 
                    name="restaurant" 
                    size={16} 
                    color={mode === 'food' ? (scheme === 'dark' ? '#000' : '#fff') : c.muted} 
                  />
                  <Text
                    style={{
                      color: mode === 'food' ? (scheme === 'dark' ? '#000' : '#fff') : c.text,
                      fontWeight: '700',
                      fontSize: 14,
                    }}
                  >
                    Food
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => setMode('events')}
                style={{
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.sm,
                  borderRadius: BorderRadius.md,
                  backgroundColor: mode === 'events' ? c.primary : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons 
                    name="calendar" 
                    size={16} 
                    color={mode === 'events' ? (scheme === 'dark' ? '#000' : '#fff') : c.muted} 
                  />
                  <Text
                    style={{
                      color: mode === 'events' ? (scheme === 'dark' ? '#000' : '#fff') : c.text,
                      fontWeight: '700',
                      fontSize: 14,
                    }}
                  >
                    Events
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Right side buttons */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Sort/Filter Button */}
              <Pressable
                onPress={() => setShowSortMenu(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  paddingHorizontal: Spacing.sm,
                  paddingVertical: Spacing.sm,
                  borderRadius: BorderRadius.md,
                }}
              >
                <Ionicons name="filter" size={16} color={c.text} />
                <Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>
                  {sortOptions.find(o => o.key === sortMode)?.label}
                </Text>
              </Pressable>

              {/* View Toggle */}
              <Pressable
                onPress={() => setView((v) => (v === 'row' ? 'grid' : 'row'))}
                style={{
                  backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  padding: Spacing.sm,
                  borderRadius: BorderRadius.md,
                }}
              >
                <Ionicons name={view === 'row' ? 'grid-outline' : 'list-outline'} size={20} color={c.text} />
              </Pressable>
            </View>
          </View>

          {/* Search Bar */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              borderRadius: BorderRadius.lg,
              paddingHorizontal: Spacing.sm,
              marginBottom: Spacing.sm,
            }}
          >
            <Ionicons name="search" size={18} color={c.muted} />
            <TextInput
              ref={inputRef}
              placeholder={mode === 'food' ? 'Search restaurants or cuisines...' : 'Search events...'}
              placeholderTextColor={c.muted}
              value={query}
              onChangeText={setQuery}
              style={{
                flex: 1,
                paddingVertical: Spacing.sm + 2,
                paddingHorizontal: Spacing.sm,
                color: c.text,
                fontSize: 15,
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color={c.muted} />
              </Pressable>
            )}
          </View>

          {/* Content */}
          {view === 'row' ? (
            <FlatList
              data={currentData as any[]}
              keyExtractor={(item) => String(item.id)}
              ListHeaderComponent={ListHeader}
              contentContainerStyle={{ gap: 10, paddingBottom: 120 }}
              style={{ flex: 1 }}
              renderItem={({ item }) => {
                if (mode === 'food') {
                  return (
                    <FoodRowCard
                      item={item as Restaurant}
                      matchPercent={(item as any).match_percent}
                      onOpenDetails={() => router.push(`/foods/${encodeURIComponent(item.id)}`)}
                      onSelect={() => {}}
                      selected={false}
                      isSaved={savedRestaurantSet.has(item.id)}
                      onToggleSave={toggleSaveRestaurant}
                    />
                  );
                } else {
                  return (
                    <EventRowCard
                      event={item as Event}
                      matchPercent={(item as any).match_percent}
                      onOpenDetails={() => router.push(`/events/${encodeURIComponent(item.id)}`)}
                      isSaved={savedEventSet.has(item.id)}
                      onToggleSave={() => toggleSaveEvent(item.id)}
                    />
                  );
                }
              }}
              onEndReachedThreshold={0.2}
              onMomentumScrollBegin={() => { endReachedDuringMomentum.current = false; }}
              onEndReached={() => {
                const allow = Platform.OS === 'web' || !endReachedDuringMomentum.current;
                if (allow) {
                  endReachedDuringMomentum.current = true;
                  if (!currentLoading && currentHasMore && query.trim().length < 2) {
                    void loadMore(currentPage);
                  }
                }
              }}
            />
          ) : (
            <FlatList
              data={currentData as any[]}
              key={`grid-${columns}-${mode}`}
              keyExtractor={(item) => String(item.id)}
              numColumns={columns}
              ListHeaderComponent={ListHeader}
              columnWrapperStyle={columns > 1 ? { gap: GAP } : undefined}
              contentContainerStyle={{
                gap: 12,
                paddingBottom: 120,
                alignSelf: 'center',
                maxWidth: MAX_GRID_WIDTH,
                width: '100%',
              }}
              style={{ flex: 1 }}
              renderItem={({ item, index }) => {
                const total = currentData.length;
                const rem = total % columns;
                const isLastPartialRow = columns > 1 && rem !== 0 && index >= total - rem;
                return (
                  <View style={isLastPartialRow || total < columns ? { width: MAX_COL_WIDTH, flex: 0 } : { flex: 1 }}>
                    {mode === 'food' ? (
                      <FoodGridCard
                        item={item as Restaurant}
                        matchPercent={(item as any).match_percent}
                        onOpenDetails={() => router.push(`/foods/${encodeURIComponent(item.id)}`)}
                        onSelect={() => {}}
                        selected={false}
                        isSaved={savedRestaurantSet.has(item.id)}
                        onToggleSave={toggleSaveRestaurant}
                      />
                    ) : (
                      <EventGridCard
                        event={item as Event}
                        matchPercent={(item as any).match_percent}
                        onOpenDetails={() => router.push(`/events/${encodeURIComponent(item.id)}`)}
                        isSaved={savedEventSet.has(item.id)}
                        onToggleSave={() => toggleSaveEvent(item.id)}
                      />
                    )}
                  </View>
                );
              }}
              onEndReachedThreshold={0.2}
              onMomentumScrollBegin={() => { endReachedDuringMomentum.current = false; }}
              onEndReached={() => {
                const allow = Platform.OS === 'web' || !endReachedDuringMomentum.current;
                if (allow) {
                  endReachedDuringMomentum.current = true;
                  if (!currentLoading && currentHasMore && query.trim().length < 2) {
                    void loadMore(currentPage);
                  }
                }
              }}
            />
          )}
        </View>

        {/* Sort Menu Modal */}
        <Modal
          visible={showSortMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSortMenu(false)}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
            onPress={() => setShowSortMenu(false)}
          >
            <View
              style={{
                backgroundColor: c.card,
                borderRadius: BorderRadius.lg,
                padding: Spacing.md,
                width: '80%',
                maxWidth: 300,
              }}
            >
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 16, marginBottom: Spacing.sm }}>
                Sort By
              </Text>
              {sortOptions.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={async () => {
                    if (opt.key === 'closest') {
                      await ensureLocation();
                    }
                    setSortMode(opt.key);
                    setShowSortMenu(false);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: Spacing.sm,
                    paddingHorizontal: Spacing.sm,
                    backgroundColor: sortMode === opt.key ? c.primary + '20' : 'transparent',
                    borderRadius: BorderRadius.md,
                  }}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={20}
                    color={sortMode === opt.key ? c.primary : c.muted}
                  />
                  <Text
                    style={{
                      color: sortMode === opt.key ? c.primary : c.text,
                      fontWeight: sortMode === opt.key ? '700' : '500',
                      fontSize: 15,
                    }}
                  >
                    {opt.label}
                  </Text>
                  {sortMode === opt.key && (
                    <Ionicons name="checkmark" size={18} color={c.primary} style={{ marginLeft: 'auto' }} />
                  )}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* Add Event Modal */}
        <AddEventModal
          visible={addEventModalOpen}
          onClose={() => setAddEventModalOpen(false)}
          onSaved={async () => {
            // Reload events after creating new event
            setEventPage(0);
            setEventItems([]);
            await loadEventPage(0);
            const eventTop = await getTopUserMatches(10);
            setEventRecommended(eventTop as any);
          }}
        />

        {/* Floating Add Event Button - Only visible in events mode */}
        {mode === 'events' && isAuthed && (
          <FloatingAddButton
            onPress={() => setAddEventModalOpen(true)}
            accessibilityLabel="Add Event"
            size={isWide ? 80 : 56} // Adjust size dynamically
            bottom={90} // Move up for desktop screens
            right={isWide? 45: 20}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}
