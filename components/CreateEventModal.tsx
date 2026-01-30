import { useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  View,
  Text,
  Platform,
  Modal,
  ScrollView,
  TextInput,
  Image,
  Pressable,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderSpacer from '@/components/HeaderSpacer';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import LocationPicker from '@/components/LocationPicker';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { checkProfanity } from '@/utils/profanity';
import { createEvent, updateEvent, uploadEventImages } from '@/services/events';
import { supabase } from '@/services/supabase';
import dayjs from 'dayjs';
import type { Event } from '@/types/models';

// Tag recommendation system - keywords mapped to suggested tags
const TAG_KEYWORDS: Record<string, string[]> = {
  // Food related
  'free food': ['free', 'food', 'pizza', 'lunch', 'dinner', 'breakfast', 'snacks', 'catering', 'refreshments', 'meal'],
  'food': ['food', 'eat', 'dining', 'restaurant', 'cuisine', 'chef', 'cooking', 'bake', 'culinary'],
  
  // Academic / Professional
  'engineering': ['engineer', 'engineering', 'mechanical', 'electrical', 'civil', 'computer', 'aerospace', 'chemical', 'biomedical', 'industrial'],
  'workshop': ['workshop', 'hands-on', 'training', 'learn', 'tutorial', 'skill', 'bootcamp', 'class'],
  'seminar': ['seminar', 'lecture', 'speaker', 'talk', 'presentation', 'keynote', 'panel'],
  'career': ['career', 'job', 'internship', 'resume', 'interview', 'hiring', 'recruit', 'employment', 'professional'],
  'research': ['research', 'study', 'lab', 'thesis', 'dissertation', 'academic', 'science', 'experiment'],
  'networking': ['network', 'connect', 'professional', 'mixer', 'meet', 'mingle', 'business'],
  
  // Social / Entertainment
  'social': ['social', 'hangout', 'party', 'gathering', 'meetup', 'friends', 'community'],
  'sports': ['sport', 'game', 'match', 'football', 'basketball', 'soccer', 'baseball', 'volleyball', 'tennis', 'athletic', 'fitness', 'gym', 'workout'],
  'music': ['music', 'concert', 'band', 'live', 'performance', 'sing', 'dance', 'dj', 'festival'],
  'movie': ['movie', 'film', 'cinema', 'watch', 'screening', 'theater'],
  'game night': ['game', 'board game', 'video game', 'trivia', 'competition', 'esports'],
  
  // Cultural / Arts
  'cultural': ['culture', 'cultural', 'international', 'diversity', 'heritage', 'tradition'],
  'art': ['art', 'gallery', 'exhibition', 'creative', 'painting', 'sculpture', 'design'],
  
  // Service / Community
  'volunteer': ['volunteer', 'service', 'charity', 'donate', 'help', 'community service', 'philanthropy', 'nonprofit'],
  'fundraiser': ['fundrais', 'donate', 'charity', 'benefit', 'cause'],
  
  // Tech
  'tech': ['tech', 'technology', 'coding', 'programming', 'software', 'app', 'hackathon', 'startup', 'ai', 'machine learning', 'data'],
  'hackathon': ['hackathon', 'hack', 'code', 'build', 'develop', 'pitch'],
  
  // Health / Wellness
  'health': ['health', 'wellness', 'mental', 'fitness', 'yoga', 'meditation', 'self-care', 'mindfulness'],
  
  // Campus specific
  'study': ['study', 'exam', 'finals', 'midterm', 'review', 'tutoring', 'homework'],
  'club': ['club', 'organization', 'org', 'meeting', 'general meeting', 'info session'],
  'outdoor': ['outdoor', 'outside', 'nature', 'hike', 'camping', 'picnic', 'park'],
};

// Popular default tags to always show
const DEFAULT_TAGS = ['free food', 'social', 'networking', 'workshop', 'sports', 'music', 'career', 'tech', 'volunteer'];

// Function to get recommended tags based on title and description
function getRecommendedTags(title: string, description: string, existingTags: string[]): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const recommended: Set<string> = new Set();
  
  // Check each tag's keywords against the text
  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        recommended.add(tag);
        break; // Found a match for this tag, move to next tag
      }
    }
  }
  
  // Filter out already added tags
  const existingLower = existingTags.map(t => t.toLowerCase());
  const filteredRecommended = Array.from(recommended).filter(
    tag => !existingLower.includes(tag.toLowerCase())
  );
  
  // Get default tags that aren't already added or recommended
  const defaultSuggestions = DEFAULT_TAGS.filter(
    tag => !existingLower.includes(tag.toLowerCase()) && !recommended.has(tag)
  );
  
  // Return recommended first, then defaults (up to 8 total)
  return [...filteredRecommended, ...defaultSuggestions].slice(0, 8);
}

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
  showErrorIndicator?: boolean;
};

const ModalSection = memo(function ModalSection({ id, title, isOpen, onToggle, cardBg, textColor, mutedColor, children, showErrorIndicator }: ModalSectionProps) {
  return (
    <View style={{ marginBottom: 14, borderRadius: 12, borderWidth: 1, borderColor: showErrorIndicator ? '#ff4444' : '#00000020', backgroundColor: cardBg }}>
      <Pressable
        onPress={onToggle}
        style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {id === 'images' ? <Ionicons name="image-outline" size={18} color={showErrorIndicator ? '#ff4444' : mutedColor} /> : null}
          {id === 'location' ? <Ionicons name="location-outline" size={18} color={mutedColor} /> : null}
          <Text style={{ color: showErrorIndicator ? '#ff4444' : textColor, fontWeight: '700', fontSize: 15 }}>{title}</Text>
          {showErrorIndicator && (
            <View style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#ff4444',
              marginLeft: 4,
            }} />
          )}
        </View>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={mutedColor} />
      </Pressable>
      {isOpen ? <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>{children}</View> : null}
    </View>
  );
});

// Create Event Modal Component
type CreateEventModalProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: (newEvent?: Event) => void | Promise<void>;
  /** If provided, the modal will be in "edit mode" and update the existing event */
  editEvent?: Event | null;
};

export default memo(function CreateEventModal({ visible, onClose, onSaved, editEvent }: CreateEventModalProps) {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isNarrowScreen = screenWidth < 500;
  
  // Determine if we're in edit mode
  const isEditMode = !!editEvent;

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
  const [validationError, setValidationError] = useState<string | null>(null);

  // RSVP Settings
  const [enableRSVP, setEnableRSVP] = useState(false);
  const [capacity, setCapacity] = useState('');
  const [allowWaitlist, setAllowWaitlist] = useState(true);
  const [rsvpRequired, setRsvpRequired] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // End date state (for multi-day events)
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDateISO, setEndDateISO] = useState<string | null>(null);
  const [endDateInput, setEndDateInput] = useState<string>('');

  const [openSections, setOpenSections] = useState({
    essentials: true,
    images: true, // Default expanded
    location: false,
    rsvp: false,
  });

  const prevLatRef = useRef<number | null>(null);
  const prevLngRef = useRef<number | null>(null);
  const [locationStatus, setLocationStatus] = useState('');

  // Generate unique ID for date picker input
  const datePickerId = useMemo(() => `create-event-date-picker-${Date.now()}`, []);

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
    setHasEndDate(false);
    setEndDateISO(null);
    setEndDateInput('');
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
    setValidationError(null);
    setLocationStatus('');
    prevLatRef.current = null;
    prevLngRef.current = null;
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      resetForm();
    }
  }, [visible]);

  // Populate form when in edit mode
  useEffect(() => {
    if (visible && editEvent) {
      // Populate all fields from the event
      setTitle(editEvent.title || '');
      setTitleLocal(editEvent.title || '');
      setDesc(editEvent.description || '');
      setDescLocal(editEvent.description || '');
      setTagsCsv((editEvent.tags || []).join(', '));
      setTagsCsvLocal((editEvent.tags || []).join(', '));
      
      // Images
      const imgs = editEvent.image_urls || (editEvent.image_url ? [editEvent.image_url] : []);
      setImage1(imgs[0] || '');
      setImage2(imgs[1] || '');
      setImage3(imgs[2] || '');
      setPickedUris([]);
      
      // Date/Time
      if (editEvent.date_time) {
        const dt = dayjs(editEvent.date_time);
        setDateTime(editEvent.date_time);
        setDateInput(dt.format('YYYY-MM-DD'));
        setTimeInput(dt.format('h:mm'));
        setStartMeridiem(dt.hour() >= 12 ? 'PM' : 'AM');
      }
      
      // End time
      if (editEvent.end_time) {
        const et = dayjs(editEvent.end_time);
        setEndTimeISO(editEvent.end_time);
        setEndTimeInput(et.format('h:mm'));
        setEndMeridiem(et.hour() >= 12 ? 'PM' : 'AM');
      } else {
        setEndTimeISO(null);
        setEndTimeInput('');
      }
      
      // End date (multi-day events)
      if (editEvent.end_date) {
        setHasEndDate(true);
        setEndDateISO(editEvent.end_date);
        setEndDateInput(dayjs(editEvent.end_date).format('YYYY-MM-DD'));
      } else {
        setHasEndDate(false);
        setEndDateISO(null);
        setEndDateInput('');
      }
      
      // Location
      setLocation(editEvent.location || '');
      setLatitude(editEvent.latitude ?? null);
      setLongitude(editEvent.longitude ?? null);
      
      // RSVP settings
      setRsvp(editEvent.rsvp_url || '');
      const hasRsvpSettings = !!(editEvent.capacity || editEvent.allow_join_requests || editEvent.rsvp_required);
      setEnableRSVP(hasRsvpSettings);
      setCapacity(editEvent.capacity?.toString() || '');
      setAllowWaitlist(editEvent.allow_join_requests ?? true);
      setRsvpRequired(editEvent.rsvp_required ?? false);
    }
  }, [visible, editEvent]);

  const submit = async () => {
    console.log('[CreateEventModal] Submit called');
    setShowValidation(true);
    setValidationError(null);
    const finalTitle = titleLocal.trim() || title.trim();
    const finalTagsCsv = tagsCsvLocal.trim() || tagsCsv.trim();

    console.log('[CreateEventModal] Validation - Title:', finalTitle, 'Tags:', finalTagsCsv);

    if (!finalTitle) {
      setValidationError('Please provide an event title.');
      return;
    }
    if (!finalTagsCsv) {
      setValidationError('Please add at least one tag to categorize your event.');
      return;
    }

    const allImages = [...pickedUris, image1, image2, image3].filter(Boolean);
    if (allImages.length === 0) {
      setValidationError('Please add at least one image URL or pick a photo.');
      return;
    }

    const profCheck = checkProfanity(finalTitle + ' ' + (descLocal || desc) + ' ' + finalTagsCsv);
    if (!profCheck.isClean) {
      setValidationError(`Please remove inappropriate words: ${profCheck.reasons?.join(', ')}`);
      return;
    }

    setSavingEvent(true);
    setValidationError(null);
    try {
      console.log('[CreateEventModal] Getting user...');
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('[CreateEventModal] Auth error:', authError);
        throw new Error('Authentication error: ' + authError.message);
      }
      const user = authData?.user;
      if (!user) {
        setValidationError('Please sign in to create an event.');
        setSavingEvent(false);
        return;
      }
      console.log('[CreateEventModal] User authenticated:', user.id);

      const payload: any = {
        title: finalTitle,
        description: (descLocal || desc || '').trim() || null,
        date_time: dateTime,
        end_time: endTimeISO,
        end_date: hasEndDate && endDateISO ? endDateISO : null,
        location: location || null,
        latitude,
        longitude,
        tags: finalTagsCsv.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
        rsvp_url: rsvp.trim() || null,
        visibility: 'public' as const,
        // RSVP settings
        capacity: enableRSVP && capacity ? parseInt(capacity, 10) : null,
        allow_join_requests: enableRSVP && allowWaitlist,
        rsvp_required: enableRSVP && rsvpRequired,
      };

      console.log('[CreateEventModal] Payload prepared:', { ...payload, tags: payload.tags?.length });

      // Upload images first if any, then create event with all image URLs
      let uploadedUrls: string[] = [];
      if (pickedUris.length > 0) {
        console.log('[CreateEventModal] Uploading', pickedUris.length, 'images...');
        try {
          uploadedUrls = await uploadEventImages(pickedUris);
          console.log('[CreateEventModal] Uploaded images:', uploadedUrls.length);
        } catch (imgErr: any) {
          console.error('[CreateEventModal] Image upload error:', imgErr);
          // Continue with typed URLs only if upload fails
        }
      }

      // Combine uploaded URLs with typed URLs
      const typedImageUrls = [image1, image2, image3].filter((s) => s && s.trim().length > 0);
      const allImageUrls = [...uploadedUrls, ...typedImageUrls].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
      
      // Include image URLs in the payload
      if (allImageUrls.length > 0) {
        payload.image_urls = allImageUrls;
        payload.image_url = allImageUrls[0];
        console.log('[CreateEventModal] Total image URLs:', allImageUrls.length);
      } else {
        console.warn('[CreateEventModal] No image URLs to include');
      }

      let eventData: Event;

      if (isEditMode && editEvent) {
        // Update existing event
        console.log('[CreateEventModal] Updating event in Supabase...', editEvent.id);
        eventData = await updateEvent(editEvent.id, payload);
        console.log('[CreateEventModal] Event updated:', eventData?.id);
        
        if (!eventData?.id) {
          throw new Error('Event update failed - no event ID returned');
        }

        Alert.alert('Success', 'Event updated successfully!');
      } else {
        // Create new event
        console.log('[CreateEventModal] Creating event in Supabase...');
        eventData = await createEvent(payload);
        console.log('[CreateEventModal] Event created:', eventData?.id);
        
        if (!eventData?.id) {
          throw new Error('Event creation failed - no event ID returned');
        }

        Alert.alert('Success', 'Event created successfully!');
      }

      // Fetch the event with all fields (including creator info)
      console.log('[CreateEventModal] Fetching event...');
      const { data: updatedEvent, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventData.id)
        .single();

      if (fetchError) {
        console.error('[CreateEventModal] Error fetching event:', fetchError);
        // Still continue - we have eventData at least
      } else {
        console.log('[CreateEventModal] Event fetched successfully');
      }

      resetForm();
      if (updatedEvent) {
        await onSaved(updatedEvent as Event);
      } else {
        await onSaved(eventData as Event);
      }
      onClose();
    } catch (err: any) {
      console.error('[CreateEventModal] Error in submit:', err);
      const errorMessage = err?.message || err?.toString() || (isEditMode ? 'Could not update event' : 'Could not create event');
      console.error('[CreateEventModal] Error details:', JSON.stringify(err, null, 2));
      setValidationError(errorMessage);
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
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>{isEditMode ? 'Edit Event' : 'Create Event'}</Text>
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
              
              {/* Recommended Tags */}
              {(() => {
                const existingTags = tagsCsvLocal
                  .split(',')
                  .map((t) => t.trim().toLowerCase())
                  .filter(Boolean);
                const recommended = getRecommendedTags(titleLocal || title, descLocal || desc, existingTags);
                
                if (recommended.length > 0) {
                  return (
                    <View style={{ gap: 6 }}>
                      <Text style={{ color: c.muted, fontSize: 11, fontWeight: '600' }}>
                        {existingTags.length > 0 || titleLocal.trim() || descLocal.trim() ? '✨ Suggested tags:' : '📌 Popular tags:'}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {recommended.map((tag, idx) => (
                          <Pressable
                            key={`rec-${tag}-${idx}`}
                            onPress={() => {
                              const current = tagsCsvLocal.trim();
                              if (current) {
                                setTagsCsvLocal(`${current}, ${tag}`);
                              } else {
                                setTagsCsvLocal(tag);
                              }
                            }}
                            style={({ pressed }) => ({
                              backgroundColor: pressed ? c.primary : `${c.primary}20`,
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderRadius: 999,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                            })}
                          >
                            <Ionicons name="add" size={12} color={c.primary} />
                            <Text style={{ color: c.primary, fontSize: 11, fontWeight: '600' }}>{tag}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  );
                }
                return null;
              })()}
              
              {tagsCsvLocal.trim().length === 0 ? (
                showValidation ? (
                  <Text style={{ color: '#ff6666', fontSize: 11 }}>Add at least one tag.</Text>
                ) : null
              ) : (
                <View style={{ gap: 4 }}>
                  <Text style={{ color: c.muted, fontSize: 11, fontWeight: '600' }}>Your tags:</Text>
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
                      .map((t, idx) => (
                        <View
                          key={`tag-${t}-${idx}`}
                          style={{ backgroundColor: c.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}
                        >
                          <Text style={{ color: '#000', fontSize: 11, fontWeight: '700' }}>#{t}</Text>
                        </View>
                      ))}
                  </View>
                </View>
              )}
            </View>
          </ModalSection>

          {/* Images Section - Right below description */}
          <ModalSection
            id="images"
            title="Images"
            isOpen={openSections.images}
            onToggle={toggleImages}
            cardBg={c.card}
            textColor={c.text}
            mutedColor={c.muted}
            showErrorIndicator={showValidation && pickedUris.length === 0 && [image1, image2, image3].every((s) => !(s && s.trim().length))}
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
                {pickedUris.map((u, idx) => (
                  <View key={`picked-${idx}-${u}`} style={{ position: 'relative' }}>
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
                  <View key={`typed-${i}-${u}`} style={{ position: 'relative' }}>
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
                    const input = (globalThis as any).document?.getElementById?.(datePickerId);
                    if (!input) return;
                    try {
                      // Prefer showPicker when supported, but some browsers require a native
                      // user gesture and may throw — fall back to click in that case.
                      if (typeof input.showPicker === 'function') {
                        input.showPicker();
                      } else if (typeof input.click === 'function') {
                        input.click();
                      }
                    } catch (err) {
                      try {
                        input.click?.();
                      } catch (e) {
                        // Swallow errors — opening the native picker failed.
                      }
                    }
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '700', textAlign: 'center' }}>
                    {dayjs(dateTime).format('dddd, MMMM D, YYYY')}
                  </Text>
                  {Platform.OS === 'web' && (
                    <input
                      id={datePickerId}
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
                  {hasEndDate && endDateISO ? ` · Ends on: ${dayjs(endDateISO).format('MMM D, YYYY')}` : ''}
                </Text>

                {/* Optional End Date for Multi-Day Events */}
                <View style={{ marginTop: 8, gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      if (hasEndDate) {
                        setHasEndDate(false);
                        setEndDateISO(null);
                        setEndDateInput('');
                      } else {
                        setHasEndDate(true);
                        const defaultEnd = dayjs(dateTime).add(1, 'day');
                        setEndDateISO(defaultEnd.toISOString());
                        setEndDateInput(defaultEnd.format('YYYY-MM-DD'));
                      }
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      backgroundColor: '#00000010',
                      padding: 10,
                      borderRadius: 8,
                    }}
                  >
                    <Ionicons
                      name={hasEndDate ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={hasEndDate ? c.primary : c.muted}
                    />
                    <Text style={{ color: c.text, fontSize: 13 }}>Multi-day event (add end date)</Text>
                  </Pressable>

                  {hasEndDate && (
                    <Pressable
                      style={{ backgroundColor: '#00000010', padding: 12, borderRadius: 10, position: 'relative' }}
                      onPress={() => {
                        const input = (globalThis as any).document?.getElementById?.('end-date-picker');
                        if (!input) return;
                        try {
                          if (typeof input.showPicker === 'function') {
                            input.showPicker();
                          } else if (typeof input.click === 'function') {
                            input.click();
                          }
                        } catch (err) {
                          try {
                            input.click?.();
                          } catch (e) {}
                        }
                      }}
                    >
                      <Text style={{ color: c.text, fontWeight: '700', textAlign: 'center' }}>
                        End Date: {endDateISO ? dayjs(endDateISO).format('dddd, MMMM D, YYYY') : 'Select end date'}
                      </Text>
                      {Platform.OS === 'web' && (
                        <input
                          id="end-date-picker"
                          type="date"
                          value={endDateInput}
                          min={dayjs(dateTime).format('YYYY-MM-DD')}
                          onChange={(e: any) => {
                            const val = e.target.value;
                            setEndDateInput(val);
                            const parsed = dayjs(val, 'YYYY-MM-DD', true);
                            if (parsed.isValid()) {
                              setEndDateISO(parsed.hour(23).minute(59).second(59).toISOString());
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
                  )}
                </View>
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

                {/* Optional End Date for Multi-Day Events (Native) */}
                <Pressable
                  onPress={() => {
                    if (hasEndDate) {
                      setHasEndDate(false);
                      setEndDateISO(null);
                      setEndDateInput('');
                    } else {
                      setHasEndDate(true);
                      const defaultEnd = dayjs(dateTime).add(1, 'day');
                      setEndDateISO(defaultEnd.toISOString());
                      setEndDateInput(defaultEnd.format('YYYY-MM-DD'));
                    }
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: '#00000010',
                    padding: 10,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                >
                  <Ionicons
                    name={hasEndDate ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={hasEndDate ? c.primary : c.muted}
                  />
                  <Text style={{ color: c.text, fontSize: 13 }}>Multi-day event (add end date)</Text>
                </Pressable>

                {hasEndDate && (
                  <Pressable
                    onPress={() => setShowEndDatePicker(true)}
                    style={{ backgroundColor: '#00000010', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 }}
                  >
                    <Text style={{ color: c.text, fontWeight: '700' }}>
                      End Date: {endDateISO ? dayjs(endDateISO).format('MMM D, YYYY') : 'Select end date'}
                    </Text>
                  </Pressable>
                )}

                {showEndDatePicker ? (
                  <DateTimePicker
                    mode="date"
                    value={new Date(endDateISO ?? dayjs(dateTime).add(1, 'day').toISOString())}
                    minimumDate={new Date(dateTime)}
                    onChange={(evt, selected) => {
                      setShowEndDatePicker(false);
                      if (!selected) return;
                      const parsed = dayjs(selected);
                      setEndDateISO(parsed.hour(23).minute(59).second(59).toISOString());
                      setEndDateInput(parsed.format('YYYY-MM-DD'));
                    }}
                  />
                ) : null}
              </View>
            )}
          </View>

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
          {/* Floating Error Warning */}
          {validationError && (
            <View style={{
              backgroundColor: '#ff4444',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 12,
              marginBottom: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              shadowColor: '#ff4444',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 4,
            }}>
              <Ionicons name="warning" size={20} color="#fff" />
              <Text style={{ color: '#fff', flex: 1, fontWeight: '600', fontSize: 14 }}>
                {validationError}
              </Text>
              <Pressable 
                onPress={() => setValidationError(null)} 
                hitSlop={8}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>
            </View>
          )}
          <BlurView intensity={30} tint={scheme === 'dark' ? 'dark' : 'light'} style={{ borderRadius: 16, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', gap: 12, padding: 12 }}>
              <Pressable
                onPress={async () => {
                  console.log('[CreateEventModal] Button pressed, savingEvent:', savingEvent);
                  if (savingEvent) {
                    console.log('[CreateEventModal] Already saving, ignoring press');
                    return;
                  }
                  console.log('[CreateEventModal] Calling submit...');
                  try {
                    await submit();
                  } catch (err) {
                    console.error('[CreateEventModal] Unhandled error in button handler:', err);
                  }
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
                <Text style={{ color: '#000', fontWeight: '700' }}>{savingEvent ? 'Saving…' : (isEditMode ? 'Update Event' : 'Create Event')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (savingEvent) return;
                  onClose();
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: pressed ? '#1b1515ea' : '#1b1515c9',
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
