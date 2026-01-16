import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { BorderRadius, Spacing } from '@/theme/designTokens';
import type { TicketTierInput, EventTicket } from '@/types/models';
import DateTimePicker from '@react-native-community/datetimepicker';

interface TicketTierEditorProps {
  ticket?: EventTicket | null;
  onSave: (input: TicketTierInput) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}

export default function TicketTierEditor({ ticket, onSave, onCancel, onDelete }: TicketTierEditorProps) {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const isEditing = !!ticket;

  const [name, setName] = useState(ticket?.name || '');
  const [description, setDescription] = useState(ticket?.description || '');
  const [price, setPrice] = useState(ticket ? (ticket.price_cents / 100).toFixed(2) : '');
  const [capacity, setCapacity] = useState(ticket?.capacity?.toString() || '');
  const [isEarlyBird, setIsEarlyBird] = useState(ticket?.is_early_bird || false);
  const [earlyBirdPrice, setEarlyBirdPrice] = useState(
    ticket?.early_bird_price_cents ? (ticket.early_bird_price_cents / 100).toFixed(2) : ''
  );
  const [showEarlyBirdDatePicker, setShowEarlyBirdDatePicker] = useState(false);
  const [earlyBirdEndDate, setEarlyBirdEndDate] = useState(
    ticket?.early_bird_end_date ? new Date(ticket.early_bird_end_date) : new Date()
  );

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Ticket name is required');
      return;
    }

    const priceCents = Math.round(parseFloat(price) * 100);
    if (isNaN(priceCents) || priceCents < 0) {
      Alert.alert('Error', 'Valid price is required');
      return;
    }

    if (isEarlyBird && !earlyBirdPrice) {
      Alert.alert('Error', 'Early bird price is required when early bird is enabled');
      return;
    }

    const earlyBirdPriceCents = isEarlyBird && earlyBirdPrice
      ? Math.round(parseFloat(earlyBirdPrice) * 100)
      : null;

    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        price_cents: priceCents,
        capacity: capacity ? parseInt(capacity, 10) : null,
        is_early_bird: isEarlyBird,
        early_bird_end_date: isEarlyBird ? earlyBirdEndDate.toISOString() : null,
        early_bird_price_cents: earlyBirdPriceCents,
      });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save ticket tier');
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    Alert.alert(
      'Delete Ticket Tier',
      'Are you sure you want to delete this ticket tier? This cannot be undone if tickets have been sold.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete ticket tier');
            }
          },
        },
      ]
    );
  };

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        gap: Spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>
          {isEditing ? 'Edit Ticket Tier' : 'New Ticket Tier'}
        </Text>
        {isEditing && onDelete && (
          <Pressable onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#ff4444" />
          </Pressable>
        )}
      </View>

      <View>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
          Name *
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g., General Admission, VIP"
          placeholderTextColor={c.muted}
          style={{
            backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderRadius: BorderRadius.sm,
            padding: Spacing.sm,
            color: c.text,
            fontSize: 14,
          }}
        />
      </View>

      <View>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
          Description
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Optional description"
          placeholderTextColor={c.muted}
          multiline
          numberOfLines={3}
          style={{
            backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderRadius: BorderRadius.sm,
            padding: Spacing.sm,
            color: c.text,
            fontSize: 14,
            minHeight: 60,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
            Price ($) *
          </Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            placeholderTextColor={c.muted}
            keyboardType="decimal-pad"
            style={{
              backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              borderRadius: BorderRadius.sm,
              padding: Spacing.sm,
              color: c.text,
              fontSize: 14,
            }}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
            Capacity (optional)
          </Text>
          <TextInput
            value={capacity}
            onChangeText={setCapacity}
            placeholder="Unlimited"
            placeholderTextColor={c.muted}
            keyboardType="number-pad"
            style={{
              backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              borderRadius: BorderRadius.sm,
              padding: Spacing.sm,
              color: c.text,
              fontSize: 14,
            }}
          />
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: Spacing.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>
            Early Bird Pricing
          </Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>
            Offer discounted pricing until a date
          </Text>
        </View>
        <Switch value={isEarlyBird} onValueChange={setIsEarlyBird} />
      </View>

      {isEarlyBird && (
        <View style={{ gap: Spacing.sm }}>
          <View>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
              Early Bird Price ($)
            </Text>
            <TextInput
              value={earlyBirdPrice}
              onChangeText={setEarlyBirdPrice}
              placeholder="0.00"
              placeholderTextColor={c.muted}
              keyboardType="decimal-pad"
              style={{
                backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderRadius: BorderRadius.sm,
                padding: Spacing.sm,
                color: c.text,
                fontSize: 14,
              }}
            />
          </View>

          <View>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
              Early Bird End Date
            </Text>
            <Pressable
              onPress={() => setShowEarlyBirdDatePicker(true)}
              style={{
                backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderRadius: BorderRadius.sm,
                padding: Spacing.sm,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: c.text, fontSize: 14 }}>
                {earlyBirdEndDate.toLocaleDateString()}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={c.muted} />
            </Pressable>
            {showEarlyBirdDatePicker && (
              <DateTimePicker
                value={earlyBirdEndDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowEarlyBirdDatePicker(false);
                  if (date) setEarlyBirdEndDate(date);
                }}
              />
            )}
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
        <Pressable
          onPress={onCancel}
          style={{
            flex: 1,
            backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            paddingVertical: 12,
            borderRadius: BorderRadius.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: c.text, fontWeight: '600' }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          style={{
            flex: 1,
            backgroundColor: c.primary,
            paddingVertical: 12,
            borderRadius: BorderRadius.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#000', fontWeight: '700' }}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}
