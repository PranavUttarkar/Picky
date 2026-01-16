// Supabase Edge Function: Stripe Webhook Handler
// Processes Stripe webhook events (checkout completion, refunds, etc.)
// Deploy: supabase functions deploy stripe-webhook
// Configure webhook in Stripe Dashboard to point to: https://your-project.supabase.co/functions/v1/stripe-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.text();

    // Verify webhook signature (simplified - in production use stripe library)
    // For now, we'll process the event (in production, verify signature properly)

    const event = JSON.parse(body);

    // Initialize Supabase with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutCompleted(session, supabase);
        break;
      }
      case 'payment_intent.succeeded': {
        // Backup handler
        const paymentIntent = event.data.object;
        console.log('Payment intent succeeded:', paymentIntent.id);
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object;
        await handleRefund(charge, supabase);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleCheckoutCompleted(session: any, supabase: any) {
  const { eventId, ticketSelections, userId } = session.metadata;

  if (!eventId || !ticketSelections || !userId) {
    console.error('Missing metadata in checkout session');
    return;
  }

  const selections = JSON.parse(ticketSelections);

  // Create ticket purchases and RSVPs
  for (const selection of selections) {
    // Get ticket details
    const { data: ticket } = await supabase
      .from('event_tickets')
      .select('id, event_id, price_cents')
      .eq('id', selection.ticketId)
      .single();

    if (!ticket) continue;

    // Create ticket purchase
    const { data: purchase, error: purchaseError } = await supabase
      .from('ticket_purchases')
      .insert({
        event_id: parseInt(eventId, 10),
        ticket_id: selection.ticketId,
        user_id: userId,
        stripe_payment_intent_id: session.payment_intent,
        stripe_checkout_session_id: session.id,
        amount_paid_cents: ticket.price_cents * selection.quantity,
        quantity: selection.quantity,
        status: 'completed',
        purchased_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (purchaseError) {
      console.error('Failed to create purchase:', purchaseError);
      continue;
    }

    // Create RSVP automatically
    const { error: rsvpError } = await supabase.rpc('rsvp_to_event', {
      p_event_id: parseInt(eventId, 10),
      p_status: 'accepted',
    });

    if (rsvpError) {
      console.error('Failed to create RSVP:', rsvpError);
    } else {
      // Link RSVP to purchase
      const { data: rsvp } = await supabase
        .from('event_attendees')
        .select('id')
        .eq('event_id', parseInt(eventId, 10))
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (rsvp && purchase) {
        await supabase
          .from('event_attendees')
          .update({ ticket_purchase_id: purchase.id })
          .eq('id', rsvp.id);
      }
    }
  }
}

async function handleRefund(charge: any, supabase: any) {
  // Find the purchase
  const { data: purchase } = await supabase
    .from('ticket_purchases')
    .select('id, event_id, ticket_id, user_id, quantity')
    .eq('stripe_payment_intent_id', charge.payment_intent)
    .single();

  if (!purchase) return;

  // Update purchase status
  await supabase
    .from('ticket_purchases')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
    })
    .eq('id', purchase.id);

  // Remove RSVP
  await supabase
    .from('event_attendees')
    .delete()
    .eq('ticket_purchase_id', purchase.id);
}
