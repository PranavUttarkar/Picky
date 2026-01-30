import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { createTextPoll, createPollWithOptions } from '@/services/polls';
import { getTopGroupMatches, searchEvents } from '@/services/events';
import EventRowCard from '@/components/EventRowCard';
import type { Event } from '@/types/models';

interface InlinePollCreatorProps {
  visible: boolean;
  onClose: () => void;
  groupId: number;
  onPollCreated: (pollId: number) => void;
  colors: any;
}

export default function InlinePollCreator({
  visible,
  onClose,
  groupId,
  onPollCreated,
  colors: c,
}: InlinePollCreatorProps) {
  const [mode, setMode] = useState<'custom' | 'events'>('events');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Custom poll (2-6 options)
  const [customOptions, setCustomOptions] = useState<string[]>(['', '']);
  
  // Events poll
  const [topMatches, setTopMatches] = useState<Event[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Event[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<Set<number>>(new Set());
  const [loadingEvents, setLoadingEvents] = useState(false);
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setMode('events');
      setTitle('');
      setCustomOptions(['', '']);
      setSearch('');
      setSearchResults([]);
      setSelectedEvents(new Set());
      loadTopMatches();
    }
  }, [visible, groupId]);

  const loadTopMatches = async () => {
    try {
      setLoadingEvents(true);
      const events = await getTopGroupMatches(groupId, 6);
      setTopMatches(events);
    } catch {
      setTopMatches([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchEvents(search, 0, 10);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const toggleEvent = (id: number) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addCustomOption = () => {
    if (customOptions.length < 6) {
      setCustomOptions([...customOptions, '']);
    }
  };

  const updateCustomOption = (index: number, value: string) => {
    setCustomOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const removeCustomOption = (index: number) => {
    if (customOptions.length > 2) {
      setCustomOptions((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const onCreate = async () => {
    try {
      setCreating(true);
      let pollId: number;

      if (mode === 'custom') {
        const cleaned = customOptions.map((o) => o.trim()).filter((o) => o.length > 0);
        if (cleaned.length < 2) {
          Alert.alert('Need options', 'Add at least 2 options for a custom poll');
          setCreating(false);
          return;
        }
        pollId = await createTextPoll(groupId, cleaned, {
          title: title?.trim() || null,
        });
      } else {
        // Events mode
        if (selectedEvents.size === 0) {
          Alert.alert('Select events', 'Pick at least one event');
          setCreating(false);
          return;
        }
        const ids = Array.from(selectedEvents);
        pollId = await createPollWithOptions(groupId, ids, {
          title: title?.trim() || null,
          mode: 'single',
        });
      }

      onPollCreated(pollId);
      onClose();
    } catch (e: any) {
      Alert.alert('Create failed', e.message ?? String(e));
    } finally {
      setCreating(false);
    }
  };

  const canCreate =
    mode === 'custom'
      ? customOptions.filter((o) => o.trim()).length >= 2
      : selectedEvents.size > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: c.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '85%',
            paddingBottom: Platform.OS === 'ios' ? 34 : 20,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: c.card,
            }}
          >
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>
              📊 Create Poll
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={c.muted} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Mode selector */}
            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                marginBottom: 16,
              }}
            >
              {[
                { key: 'events', label: 'Events', icon: 'calendar-outline' },
                { key: 'custom', label: 'Custom', icon: 'create-outline' },
              ].map(({ key, label, icon }) => (
                <Pressable
                  key={key}
                  onPress={() => setMode(key as any)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: mode === key ? c.primary : c.card,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                >
                  <Ionicons
                    name={icon as any}
                    size={16}
                    color={mode === key ? '#000' : c.text}
                  />
                  <Text
                    style={{
                      color: mode === key ? '#000' : c.text,
                      fontWeight: '700',
                      fontSize: 13,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Poll title */}
            <Text style={{ color: c.muted, marginBottom: 6, fontSize: 13 }}>
              Poll question (optional)
            </Text>
            <TextInput
              placeholder="e.g., Where should we go tonight?"
              placeholderTextColor={c.muted}
              value={title}
              onChangeText={setTitle}
              style={{
                backgroundColor: c.card,
                color: c.text,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 10,
                marginBottom: 16,
              }}
            />

            {/* Custom mode */}
            {mode === 'custom' && (
              <View>
                <Text style={{ color: c.muted, marginBottom: 8, fontSize: 13 }}>
                  Add 2-6 options
                </Text>
                {customOptions.map((opt, index) => (
                  <View
                    key={index}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: 8,
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: c.primary + '30',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: c.primary, fontWeight: '700', fontSize: 12 }}>
                        {index + 1}
                      </Text>
                    </View>
                    <TextInput
                      placeholder={`Option ${index + 1}`}
                      placeholderTextColor={c.muted}
                      value={opt}
                      onChangeText={(v) => updateCustomOption(index, v)}
                      style={{
                        flex: 1,
                        backgroundColor: c.card,
                        color: c.text,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 10,
                      }}
                    />
                    {customOptions.length > 2 && (
                      <Pressable
                        onPress={() => removeCustomOption(index)}
                        hitSlop={8}
                      >
                        <Ionicons name="close-circle" size={22} color={c.muted} />
                      </Pressable>
                    )}
                  </View>
                ))}
                {customOptions.length < 6 && (
                  <Pressable
                    onPress={addCustomOption}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      padding: 10,
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={c.primary} />
                    <Text style={{ color: c.primary, fontWeight: '600' }}>Add option</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Events mode */}
            {mode === 'events' && (
              <View>
                {/* Search */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: c.card,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    marginBottom: 12,
                  }}
                >
                  <Ionicons name="search" size={18} color={c.muted} />
                  <TextInput
                    placeholder="Search events..."
                    placeholderTextColor={c.muted}
                    value={search}
                    onChangeText={setSearch}
                    style={{
                      flex: 1,
                      color: c.text,
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                    }}
                  />
                </View>

                {/* Selected count */}
                {selectedEvents.size > 0 && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: c.primary + '20',
                      padding: 10,
                      borderRadius: 10,
                      marginBottom: 12,
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={c.primary} />
                    <Text style={{ color: c.text, marginLeft: 8, fontWeight: '600' }}>
                      {selectedEvents.size} event{selectedEvents.size !== 1 ? 's' : ''} selected
                    </Text>
                  </View>
                )}

                {/* Search results or top matches */}
                {search.trim().length >= 3 ? (
                  <View>
                    <Text style={{ color: c.muted, marginBottom: 8, fontSize: 13 }}>
                      Search results
                    </Text>
                    {searchResults.length === 0 ? (
                      <Text style={{ color: c.muted }}>No events found</Text>
                    ) : (
                      searchResults.map((event) => (
                        <Pressable
                          key={event.id}
                          onPress={() => toggleEvent(event.id)}
                          style={{
                            marginBottom: 8,
                            borderWidth: selectedEvents.has(event.id) ? 2 : 0,
                            borderColor: c.primary,
                            borderRadius: 12,
                            overflow: 'hidden',
                          }}
                        >
                          <EventRowCard
                            event={event}
                            isSaved={false}
                            onToggleSave={() => {}}
                            onOpenDetails={() => {}}
                            onPoll={() => toggleEvent(event.id)}
                            pollButtonTitle={selectedEvents.has(event.id) ? 'Remove' : 'Add'}
                          />
                        </Pressable>
                      ))
                    )}
                  </View>
                ) : (
                  <View>
                    <Text style={{ color: c.muted, marginBottom: 8, fontSize: 13 }}>
                      Suggested for your group
                    </Text>
                    {loadingEvents ? (
                      <ActivityIndicator color={c.primary} />
                    ) : topMatches.length === 0 ? (
                      <Text style={{ color: c.muted }}>No suggestions yet</Text>
                    ) : (
                      topMatches.map((event) => (
                        <Pressable
                          key={event.id}
                          onPress={() => toggleEvent(event.id)}
                          style={{
                            marginBottom: 8,
                            borderWidth: selectedEvents.has(event.id) ? 2 : 0,
                            borderColor: c.primary,
                            borderRadius: 12,
                            overflow: 'hidden',
                          }}
                        >
                          <EventRowCard
                            event={event}
                            isSaved={false}
                            onToggleSave={() => {}}
                            onOpenDetails={() => {}}
                            onPoll={() => toggleEvent(event.id)}
                            pollButtonTitle={selectedEvents.has(event.id) ? 'Remove' : 'Add'}
                            matchPercent={(event as any).match_percent}
                          />
                        </Pressable>
                      ))
                    )}
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Create button */}
          <View style={{ padding: 16, paddingTop: 8 }}>
            <Pressable
              onPress={onCreate}
              disabled={!canCreate || creating}
              style={{
                backgroundColor: canCreate && !creating ? c.primary : c.card,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                opacity: canCreate && !creating ? 1 : 0.6,
              }}
            >
              {creating ? (
                <ActivityIndicator color={c.text} />
              ) : (
                <Text style={{ color: canCreate ? '#000' : c.muted, fontWeight: '800', fontSize: 16 }}>
                  {mode === 'custom'
                    ? `Create Poll${customOptions.filter((o) => o.trim()).length >= 2 ? ` (${customOptions.filter((o) => o.trim()).length} options)` : ''}`
                    : `Create Event Poll${selectedEvents.size > 0 ? ` (${selectedEvents.size} selected)` : ''}`}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
