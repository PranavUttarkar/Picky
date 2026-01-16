import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { BorderRadius, Spacing } from '@/theme/designTokens';
import HeaderSpacer from '@/components/HeaderSpacer';
import GradientHeader from '@/components/GradientHeader';
import TicketTierEditor from '@/components/TicketTierEditor';
import TicketCustomizationPanel from '@/components/TicketCustomizationPanel';
import { useRouter } from 'expo-router';
import { createEvent, type EventInput } from '@/services/events';
import { createTicketTier, type TicketTierInput } from '@/services/tickets';
import { updateTicketCustomization } from '@/services/tickets';
import { isStripeConnected } from '@/services/stripe';
import type { EventTicket, TicketCustomization } from '@/types/models';

export default function NewTicketedEventScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);

  // Event fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [location, setLocation] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Ticket configuration
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [editingTicket, setEditingTicket] = useState<EventTicket | null>(null);
  const [showTicketEditor, setShowTicketEditor] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const [customization, setCustomization] = useState<TicketCustomization | null>(null);

  React.useEffect(() => {
    checkStripeConnection();
  }, []);

  const checkStripeConnection = async () => {
    const connected = await isStripeConnected();
    setStripeConnected(connected);
    if (!connected) {
      Alert.alert(
        'Stripe Not Connected',
        'You need to connect your Stripe account before creating ticketed events. Would you like to connect now?',
        [
          { text: 'Cancel', onPress: () => router.back() },
          {
            text: 'Connect',
            onPress: () => router.push('/organizations/stripe-connect'),
          },
        ]
      );
    }
  };

  const handleSaveTicket = async (input: TicketTierInput) => {
    if (!editingTicket) {
      // Creating new ticket - will be saved after event is created
      setTickets([...tickets, { ...input } as any]);
    } else {
      // Updating existing ticket - will be saved after event is created
      setTickets(tickets.map((t) => (t.id === editingTicket.id ? { ...t, ...input } : t)));
    }
    setShowTicketEditor(false);
    setEditingTicket(null);
  };

  const handleDeleteTicket = async () => {
    if (editingTicket) {
      setTickets(tickets.filter((t) => t.id !== editingTicket.id));
      setShowTicketEditor(false);
      setEditingTicket(null);
    }
  };

  const handleCreateEvent = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Event title is required');
      return;
    }

    if (tickets.length === 0) {
      Alert.alert('Error', 'At least one ticket tier is required');
      return;
    }

    if (!stripeConnected) {
      Alert.alert('Error', 'Stripe account must be connected');
      return;
    }

    setLoading(true);
    try {
      // Create event
      const eventInput: EventInput = {
        title: title.trim(),
        description: description.trim() || null,
        date_time: dateTime || new Date().toISOString(),
        location: location.trim() || null,
        tags: tags.length > 0 ? tags : null,
        is_ticketed: true,
        ticket_customization: customization,
        visibility: 'public',
      };

      const event = await createEvent(eventInput);

      // Create ticket tiers
      for (const ticketInput of tickets) {
        await createTicketTier(event.id, ticketInput as TicketTierInput);
      }

      // Update customization if provided
      if (customization) {
        await updateTicketCustomization(event.id, customization);
      }

      Alert.alert('Success', 'Ticketed event created!', [
        { text: 'OK', onPress: () => router.replace(`/events/${event.id}`) },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <HeaderSpacer />
      <GradientHeader
        title="Create Ticketed Event"
        subtitle="Sell tickets for your event"
        onBack={() => router.back()}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: 100 }}
      >
        {!stripeConnected ? (
          <View style={{ padding: Spacing.lg, alignItems: 'center' }}>
            <Text style={{ color: c.text, fontSize: 16, textAlign: 'center', marginBottom: Spacing.md }}>
              Please connect your Stripe account first
            </Text>
            <Pressable
              onPress={() => router.push('/organizations/stripe-connect')}
              style={{
                backgroundColor: c.primary,
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: BorderRadius.md,
              }}
            >
              <Text style={{ color: '#000', fontWeight: '700' }}>Connect Stripe</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: Spacing.md }}>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>
              Event Details
            </Text>

            {/* Basic event fields would go here - simplified for now */}
            <View
              style={{
                backgroundColor: c.card,
                padding: Spacing.md,
                borderRadius: BorderRadius.md,
              }}
            >
              <Text style={{ color: c.muted, fontSize: 12 }}>
                Event creation form fields would go here (title, description, date, etc.)
              </Text>
            </View>

            {/* Ticket Tiers */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
                <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>
                  Ticket Tiers ({tickets.length})
                </Text>
                <Pressable
                  onPress={() => {
                    setEditingTicket(null);
                    setShowTicketEditor(true);
                  }}
                  style={{
                    backgroundColor: c.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: BorderRadius.sm,
                  }}
                >
                  <Text style={{ color: '#000', fontWeight: '700', fontSize: 12 }}>+ Add Tier</Text>
                </Pressable>
              </View>

              {tickets.map((ticket, index) => (
                <Pressable
                  key={index}
                  onPress={() => {
                    setEditingTicket(ticket);
                    setShowTicketEditor(true);
                  }}
                  style={{
                    backgroundColor: c.card,
                    padding: Spacing.md,
                    borderRadius: BorderRadius.md,
                    marginBottom: Spacing.sm,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '600' }}>{ticket.name}</Text>
                  <Text style={{ color: c.muted, fontSize: 12 }}>
                    ${((ticket as any).price_cents / 100).toFixed(2)}
                  </Text>
                </Pressable>
              ))}

              {showTicketEditor && (
                <TicketTierEditor
                  ticket={editingTicket}
                  onSave={handleSaveTicket}
                  onCancel={() => {
                    setShowTicketEditor(false);
                    setEditingTicket(null);
                  }}
                  onDelete={handleDeleteTicket}
                />
              )}
            </View>

            {/* Customization */}
            <View>
              <Pressable
                onPress={() => setShowCustomization(!showCustomization)}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: c.card,
                  padding: Spacing.md,
                  borderRadius: BorderRadius.md,
                }}
              >
                <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>
                  Ticket Customization
                </Text>
                <Text style={{ color: c.muted }}>{showCustomization ? 'Hide' : 'Show'}</Text>
              </Pressable>

              {showCustomization && (
                <TicketCustomizationPanel
                  customization={customization}
                  onSave={async (custom) => {
                    setCustomization(custom);
                    setShowCustomization(false);
                  }}
                  onCancel={() => setShowCustomization(false)}
                />
              )}
            </View>

            <Pressable
              onPress={handleCreateEvent}
              disabled={loading || tickets.length === 0}
              style={{
                backgroundColor: (loading || tickets.length === 0) ? '#6b7280' : c.primary,
                paddingVertical: 14,
                borderRadius: BorderRadius.md,
                alignItems: 'center',
                marginTop: Spacing.md,
                opacity: (loading || tickets.length === 0) ? 0.6 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>
                  Create Event
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
