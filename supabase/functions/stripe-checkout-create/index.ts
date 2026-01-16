// Supabase Edge Function: Create Stripe Checkout Session
// Creates a checkout session for ticket purchases
// Deploy: supabase functions deploy stripe-checkout-create

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@17.4.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      eventId,
      ticketSelections,
      stripeAccountId,
      isTestMode = true,
      successUrl,
      cancelUrl,
    } = await req.json();

    if (!eventId || !ticketSelections || !stripeAccountId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Stripe secret key
    const stripeSecretKey = isTestMode
      ? Deno.env.get('STRIPE_SECRET_KEY_TEST')
      : Deno.env.get('STRIPE_SECRET_KEY_LIVE');

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe secret key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate tickets and get current prices
    const lineItems = [];
    let totalAmount = 0;

    for (const selection of ticketSelections) {
      // Get ticket details from database
      const { data: ticket, error: ticketError } = await supabase
        .from('event_tickets')
        .select('id, name, price_cents, capacity, sold_count, is_early_bird, early_bird_end_date, early_bird_price_cents')
        .eq('id', selection.ticketId)
        .eq('event_id', eventId)
        .single();

      if (ticketError || !ticket) {
        return new Response(
          JSON.stringify({ error: `Ticket ${selection.ticketId} not found` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check capacity
      if (ticket.capacity && ticket.sold_count + selection.quantity > ticket.capacity) {
        return new Response(
          JSON.stringify({ error: `Not enough tickets available for "${ticket.name}"` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get current price (handles early bird)
      let priceCents = ticket.price_cents;
      if (ticket.is_early_bird && ticket.early_bird_end_date) {
        const endDate = new Date(ticket.early_bird_end_date);
        if (endDate > new Date() && ticket.early_bird_price_cents) {
          priceCents = ticket.early_bird_price_cents;
        }
      }

      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: ticket.name,
            description: `Ticket for event #${eventId}`,
          },
          unit_amount: priceCents,
        },
        quantity: selection.quantity,
      });

      totalAmount += priceCents * selection.quantity;
    }

    // Initialize Stripe client
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia',
    });

    // Create checkout session
    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: user.id,
        metadata: {
          eventId: eventId.toString(),
          ticketSelections: JSON.stringify(ticketSelections),
          userId: user.id,
        },
        // For Connect accounts, payments go to the connected account
        payment_intent_data: {
          application_fee_amount: Math.round(totalAmount * 0.02), // 2% platform fee (optional)
        },
      },
      {
        stripeAccount: stripeAccountId, // Use Connect account
      }
    );

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
