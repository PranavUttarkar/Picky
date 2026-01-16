import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { BorderRadius, Spacing } from '@/theme/designTokens';
import { getEventTickets, getTicketCurrentPrice, getTicketAvailableQuantity } from '@/services/tickets';
import { createCheckoutSession } from '@/services/stripe';
import type { EventTicket, Event } from '@/types/models';
import * as Linking from 'expo-linking';
import HeaderSpacer from './HeaderSpacer';

interface TicketPurchaseModalProps {
  visible: boolean;
  event: Event;
  onClose: () => void;
  onPurchaseComplete?: () => void;
}

export default function TicketPurchaseModal({
  visible,
  event,
  onClose,
  onPurchaseComplete,
}: TicketPurchaseModalProps) {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [selections, setSelections] = useState<Record<number, number>>({});
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [available, setAvailable] = useState<Record<number, number>>({});

  useEffect(() => {
    if (visible) {
      loadTickets();
    } else {
      setSelections({});
    }
  }, [visible, event.id]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const eventTickets = await getEventTickets(event.id);
      setTickets(eventTickets);

      // Load current prices and availability
      const priceMap: Record<number, number> = {};
      const availableMap: Record<number, number> = {};

      for (const ticket of eventTickets) {
        priceMap[ticket.id] = await getTicketCurrentPrice(ticket.id);
        availableMap[ticket.id] = await getTicketAvailableQuantity(ticket.id);
      }

      setPrices(priceMap);
      setAvailable(availableMap);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (ticketId: number, delta: number) => {
    const current = selections[ticketId] || 0;
    const maxAvailable = available[ticketId] || 0;
    const newQuantity = Math.max(0, Math.min(maxAvailable, current + delta));
    
    if (newQuantity === 0) {
      const { [ticketId]: _, ...rest } = selections;
      setSelections(rest);
    } else {
      setSelections({ ...selections, [ticketId]: newQuantity });
    }
  };

  const getTotalPrice = (): number => {
    return Object.entries(selections).reduce((total, [ticketId, quantity]) => {
      const price = prices[Number(ticketId)] || 0;
      return total + price * quantity;
    }, 0);
  };

  const getTotalQuantity = (): number => {
    return Object.values(selections).reduce((sum, qty) => sum + qty, 0);
  };

  const handlePurchase = async () => {
    const ticketSelections = Object.entries(selections)
      .filter(([_, qty]) => qty > 0)
      .map(([ticketId, quantity]) => ({
        ticketId: Number(ticketId),
        quantity,
      }));

    if (ticketSelections.length === 0) {
      Alert.alert('Error', 'Please select at least one ticket');
      return;
    }

    setPurchasing(true);
    try {
      const successUrl = Linking.createURL(`/events/${event.id}?purchase=success`);
      const cancelUrl = Linking.createURL(`/events/${event.id}?purchase=cancelled`);

      const { url } = await createCheckoutSession(
        event.id,
        ticketSelections,
        successUrl,
        cancelUrl
      );

      // Open Stripe Checkout
      const result = await Linking.openURL(url);
      
      if (result) {
        onClose();
        onPurchaseComplete?.();
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to start checkout');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.background }}>
        <HeaderSpacer />
        <BlurView intensity={30} tint={scheme === 'dark' ? 'dark' : 'light'} style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Purchase Tickets</Text>
              <Text style={{ color: c.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                {event.title}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={{ backgroundColor: '#00000020', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
            >
              <Ionicons name="close" size={24} color={c.text} />
            </Pressable>
          </View>
        </BlurView>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: 100 }}
        >
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={c.primary} />
            </View>
          ) : tickets.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Ionicons name="ticket-outline" size={48} color={c.muted} />
              <Text style={{ color: c.muted, fontSize: 14, marginTop: 12 }}>
                No tickets available
              </Text>
            </View>
          ) : (
            <View style={{ gap: Spacing.md }}>
              {tickets.map((ticket) => {
                const quantity = selections[ticket.id] || 0;
                const currentPrice = prices[ticket.id] || ticket.price_cents;
                const availableQty = available[ticket.id] || 0;
                const isSoldOut = availableQty === 0;

                return (
                  <View
                    key={ticket.id}
                    style={{
                      backgroundColor: c.card,
                      borderRadius: BorderRadius.md,
                      padding: Spacing.md,
                      borderWidth: quantity > 0 ? 2 : 1,
                      borderColor: quantity > 0 ? c.primary : (scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                    }}
                  >
                    <View style={{ marginBottom: Spacing.sm }}>
                      <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>
                        {ticket.name}
                      </Text>
                      {ticket.description && (
                        <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
                          {ticket.description}
                        </Text>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
                      <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>
                        ${(currentPrice / 100).toFixed(2)}
                      </Text>
                      {ticket.capacity && (
                        <Text style={{ color: c.muted, fontSize: 12 }}>
                          {ticket.sold_count} / {ticket.capacity} sold
                        </Text>
                      )}
                    </View>

                    {isSoldOut ? (
                      <View
                        style={{
                          backgroundColor: '#ff444420',
                          padding: Spacing.sm,
                          borderRadius: BorderRadius.sm,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: '#ff4444', fontSize: 12, fontWeight: '600' }}>
                          Sold Out
                        </Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                        <Pressable
                          onPress={() => updateQuantity(ticket.id, -1)}
                          disabled={quantity === 0}
                          style={{
                            backgroundColor: quantity === 0 ? '#6b7280' : c.primary,
                            width: 36,
                            height: 36,
                            borderRadius: BorderRadius.sm,
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: quantity === 0 ? 0.5 : 1,
                          }}
                        >
                          <Ionicons name="remove" size={20} color="#000" />
                        </Pressable>

                        <Text style={{ color: c.text, fontSize: 18, fontWeight: '700', minWidth: 30, textAlign: 'center' }}>
                          {quantity}
                        </Text>

                        <Pressable
                          onPress={() => updateQuantity(ticket.id, 1)}
                          disabled={availableQty === 0 || quantity >= availableQty}
                          style={{
                            backgroundColor: (availableQty === 0 || quantity >= availableQty) ? '#6b7280' : c.primary,
                            width: 36,
                            height: 36,
                            borderRadius: BorderRadius.sm,
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: (availableQty === 0 || quantity >= availableQty) ? 0.5 : 1,
                          }}
                        >
                          <Ionicons name="add" size={20} color="#000" />
                        </Pressable>

                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                          <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>
                            ${((currentPrice * quantity) / 100).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {getTotalQuantity() > 0 && (
          <View
            style={{
              backgroundColor: c.card,
              padding: Spacing.md,
              borderTopWidth: 1,
              borderTopColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>
                Total ({getTotalQuantity()} {getTotalQuantity() === 1 ? 'ticket' : 'tickets'})
              </Text>
              <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>
                ${(getTotalPrice() / 100).toFixed(2)}
              </Text>
            </View>
            <Pressable
              onPress={handlePurchase}
              disabled={purchasing || getTotalQuantity() === 0}
              style={{
                backgroundColor: (purchasing || getTotalQuantity() === 0) ? '#6b7280' : c.primary,
                paddingVertical: 14,
                borderRadius: BorderRadius.md,
                alignItems: 'center',
                opacity: (purchasing || getTotalQuantity() === 0) ? 0.6 : 1,
              }}
            >
              {purchasing ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>
                  Proceed to Checkout
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
