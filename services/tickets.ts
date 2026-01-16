import { supabase } from './supabase';
import type { EventTicket, TicketTierInput, TicketPurchase, TicketCustomization } from '@/types/models';
import { createRateLimiter, RateLimitPresets } from '@/utils/rateLimiter';

const ticketLimiter = createRateLimiter({ ...RateLimitPresets.create, key: 'tickets:create' });
const purchaseLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60000, key: 'tickets:purchase' });

// Get all tickets for an event
export async function getEventTickets(eventId: number): Promise<EventTicket[]> {
  const { data, error } = await supabase
    .from('event_tickets')
    .select('*')
    .eq('event_id', eventId)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as EventTicket[];
}

// Get a single ticket by ID
export async function getTicket(ticketId: number): Promise<EventTicket | null> {
  const { data, error } = await supabase
    .from('event_tickets')
    .select('*')
    .eq('id', ticketId)
    .maybeSingle();

  if (error) throw error;
  return data as EventTicket | null;
}

// Get current price for a ticket (handles early bird pricing)
export async function getTicketCurrentPrice(ticketId: number): Promise<number> {
  const { data, error } = await supabase.rpc('get_ticket_price_cents', {
    p_ticket_id: ticketId,
  });

  if (error) throw error;
  return typeof data === 'number' ? data : Number(data) || 0;
}

// Check if ticket has capacity
export async function ticketHasCapacity(ticketId: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('ticket_has_capacity', {
    p_ticket_id: ticketId,
  });

  if (error) throw error;
  return data === true;
}

// Get available quantity for a ticket
export async function getTicketAvailableQuantity(ticketId: number): Promise<number> {
  const { data, error } = await supabase.rpc('get_ticket_available_quantity', {
    p_ticket_id: ticketId,
  });

  if (error) throw error;
  return typeof data === 'number' ? data : Number(data) || 0;
}

// Create ticket tier for an event
export async function createTicketTier(
  eventId: number,
  input: TicketTierInput
): Promise<EventTicket> {
  return ticketLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    // Verify user owns the event
    const { data: event } = await supabase
      .from('events')
      .select('created_by, is_ticketed')
      .eq('id', eventId)
      .single();

    if (!event) throw new Error('Event not found');
    if (event.created_by !== auth.user.id) {
      throw new Error('Only event organizers can create ticket tiers');
    }
    if (!event.is_ticketed) {
      throw new Error('Event must be marked as ticketed first');
    }

    // Get current max display_order
    const { data: existingTickets } = await supabase
      .from('event_tickets')
      .select('display_order')
      .eq('event_id', eventId)
      .order('display_order', { ascending: false })
      .limit(1);

    const maxOrder = existingTickets && existingTickets.length > 0
      ? (existingTickets[0] as any).display_order
      : -1;

    const { data, error } = await supabase
      .from('event_tickets')
      .insert({
        event_id: eventId,
        name: input.name,
        description: input.description || null,
        price_cents: input.price_cents,
        capacity: input.capacity || null,
        is_early_bird: input.is_early_bird || false,
        early_bird_end_date: input.early_bird_end_date || null,
        early_bird_price_cents: input.early_bird_price_cents || null,
        display_order: input.display_order ?? maxOrder + 1,
      })
      .select()
      .single();

    if (error) throw error;
    return data as EventTicket;
  });
}

// Update ticket tier
export async function updateTicketTier(
  ticketId: number,
  input: Partial<TicketTierInput>
): Promise<EventTicket> {
  return ticketLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    // Verify user owns the event
    const { data: ticket } = await supabase
      .from('event_tickets')
      .select('event_id, events!inner(created_by)')
      .eq('id', ticketId)
      .single();

    if (!ticket) throw new Error('Ticket not found');
    const event = (ticket as any).events;
    if (event.created_by !== auth.user.id) {
      throw new Error('Only event organizers can update ticket tiers');
    }

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.price_cents !== undefined) updateData.price_cents = input.price_cents;
    if (input.capacity !== undefined) updateData.capacity = input.capacity;
    if (input.is_early_bird !== undefined) updateData.is_early_bird = input.is_early_bird;
    if (input.early_bird_end_date !== undefined) updateData.early_bird_end_date = input.early_bird_end_date;
    if (input.early_bird_price_cents !== undefined) updateData.early_bird_price_cents = input.early_bird_price_cents;
    if (input.display_order !== undefined) updateData.display_order = input.display_order;

    const { data, error } = await supabase
      .from('event_tickets')
      .update(updateData)
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;
    return data as EventTicket;
  });
}

// Delete ticket tier
export async function deleteTicketTier(ticketId: number): Promise<void> {
  return ticketLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    // Verify user owns the event
    const { data: ticket } = await supabase
      .from('event_tickets')
      .select('event_id, events!inner(created_by)')
      .eq('id', ticketId)
      .single();

    if (!ticket) throw new Error('Ticket not found');
    const event = (ticket as any).events;
    if (event.created_by !== auth.user.id) {
      throw new Error('Only event organizers can delete ticket tiers');
    }

    // Check if there are any purchases for this ticket
    const { count } = await supabase
      .from('ticket_purchases')
      .select('*', { count: 'exact', head: true })
      .eq('ticket_id', ticketId)
      .eq('status', 'completed');

    if (count && count > 0) {
      throw new Error('Cannot delete ticket tier with completed purchases');
    }

    const { error } = await supabase
      .from('event_tickets')
      .delete()
      .eq('id', ticketId);

    if (error) throw error;
  });
}

// Get user's ticket purchases
export async function getMyTicketPurchases(): Promise<TicketPurchase[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await supabase
    .from('ticket_purchases')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as TicketPurchase[];
}

// Get ticket purchases for an event (organizer view)
export async function getEventTicketPurchases(eventId: number): Promise<TicketPurchase[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  // Verify user owns the event
  const { data: event } = await supabase
    .from('events')
    .select('created_by')
    .eq('id', eventId)
    .single();

  if (!event || event.created_by !== auth.user.id) {
    throw new Error('Only event organizers can view ticket purchases');
  }

  const { data, error } = await supabase
    .from('ticket_purchases')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as TicketPurchase[];
}

// Validate ticket selections before purchase
export async function validateTicketSelections(
  selections: Array<{ ticketId: number; quantity: number }>
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const selection of selections) {
    const ticket = await getTicket(selection.ticketId);
    if (!ticket) {
      errors.push(`Ticket ${selection.ticketId} not found`);
      continue;
    }

    const hasCapacity = await ticketHasCapacity(selection.ticketId);
    if (!hasCapacity) {
      errors.push(`Ticket "${ticket.name}" is sold out`);
      continue;
    }

    const available = await getTicketAvailableQuantity(selection.ticketId);
    if (selection.quantity > available) {
      errors.push(`Only ${available} tickets available for "${ticket.name}"`);
      continue;
    }

    if (selection.quantity <= 0) {
      errors.push(`Invalid quantity for "${ticket.name}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Create ticket purchase record (called by webhook)
export async function createTicketPurchase(
  eventId: number,
  ticketId: number,
  userId: string,
  stripePaymentIntentId: string,
  stripeCheckoutSessionId: string,
  amountPaidCents: number,
  quantity: number
): Promise<TicketPurchase> {
  const { data, error } = await supabase
    .from('ticket_purchases')
    .insert({
      event_id: eventId,
      ticket_id: ticketId,
      user_id: userId,
      stripe_payment_intent_id: stripePaymentIntentId,
      stripe_checkout_session_id: stripeCheckoutSessionId,
      amount_paid_cents: amountPaidCents,
      quantity,
      status: 'completed',
      purchased_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  // Create RSVP automatically
  const purchase = data as TicketPurchase;
  await supabase.rpc('rsvp_to_event', {
    p_event_id: eventId,
    p_status: 'accepted',
  });

  // Link RSVP to purchase
  const { data: rsvp } = await supabase
    .from('event_attendees')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (rsvp) {
    await supabase
      .from('event_attendees')
      .update({ ticket_purchase_id: purchase.id })
      .eq('id', (rsvp as any).id);
  }

  return purchase;
}

// Update ticket customization for an event
export async function updateTicketCustomization(
  eventId: number,
  customization: TicketCustomization
): Promise<void> {
  return ticketLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    // Verify user owns the event
    const { data: event } = await supabase
      .from('events')
      .select('created_by')
      .eq('id', eventId)
      .single();

    if (!event || event.created_by !== auth.user.id) {
      throw new Error('Only event organizers can update ticket customization');
    }

    const { error } = await supabase
      .from('events')
      .update({ ticket_customization: customization })
      .eq('id', eventId);

    if (error) throw error;
  });
}

// Get ticket sales summary for an event
export async function getTicketSalesSummary(eventId: number): Promise<{
  totalRevenue: number;
  totalTicketsSold: number;
  purchasesByStatus: Record<string, number>;
}> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  // Verify user owns the event
  const { data: event } = await supabase
    .from('events')
    .select('created_by')
    .eq('id', eventId)
    .single();

  if (!event || event.created_by !== auth.user.id) {
    throw new Error('Only event organizers can view sales summary');
  }

  const { data: purchases } = await supabase
    .from('ticket_purchases')
    .select('amount_paid_cents, quantity, status')
    .eq('event_id', eventId)
    .eq('status', 'completed');

  let totalRevenue = 0;
  let totalTicketsSold = 0;
  const purchasesByStatus: Record<string, number> = {};

  (purchases ?? []).forEach((p: any) => {
    totalRevenue += p.amount_paid_cents;
    totalTicketsSold += p.quantity;
    purchasesByStatus[p.status] = (purchasesByStatus[p.status] || 0) + 1;
  });

  return {
    totalRevenue,
    totalTicketsSold,
    purchasesByStatus,
  };
}
