import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { BorderRadius, Spacing } from '@/theme/designTokens';
import type { Event } from '@/types/models';
import { getEventTickets } from '@/services/tickets';
import { supabase } from '@/services/supabase';
import { useState, useEffect } from 'react';

interface TicketEventCardProps {
  event: Event;
  onPress?: () => void;
}

export default function TicketEventCard({ event, onPress }: TicketEventCardProps) {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const [ticketCount, setTicketCount] = useState(0);
  const [minPrice, setMinPrice] = useState<number | null>(null);

  useEffect(() => {
    loadTicketInfo();
  }, [event.id]);

  const loadTicketInfo = async () => {
    try {
      const tickets = await getEventTickets(event.id);
      setTicketCount(tickets.length);

      if (tickets.length > 0) {
        // Get minimum price (considering early bird)
        const prices = await Promise.all(
          tickets.map(async (t) => {
            const { data } = await supabase.rpc('get_ticket_price_cents', {
              p_ticket_id: t.id,
            });
            return typeof data === 'number' ? data : Number(data) || t.price_cents;
          })
        );
        setMinPrice(Math.min(...prices));
      }
    } catch (err) {
      console.error('Failed to load ticket info:', err);
    }
  };

  if (!event.is_ticketed) return null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: c.card,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        borderLeftWidth: 4,
        borderLeftColor: c.primary,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs }}>
        <Ionicons name="ticket" size={20} color={c.primary} />
        <Text style={{ color: c.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
          Ticketed Event
        </Text>
      </View>

      {minPrice !== null && (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>
            From ${(minPrice / 100).toFixed(2)}
          </Text>
          {ticketCount > 1 && (
            <Text style={{ color: c.muted, fontSize: 12 }}>
              ({ticketCount} tiers)
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}
