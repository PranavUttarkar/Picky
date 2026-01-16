# Stripe Ticket System - Quick Start

This system allows organizations to sell tickets for events using Stripe Connect, all running on Supabase (no separate backend needed).

## Setup Steps

### 1. Environment Variables

Add to your `.env` file:
```env
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
EXPO_PUBLIC_STRIPE_CONNECT_CLIENT_ID_TEST=ca_...
EXPO_PUBLIC_APP_URL=http://localhost:8081
```

### 2. Get Stripe Connect Client ID

1. Go to https://dashboard.stripe.com/test/settings/connect
2. Enable Stripe Connect if needed
3. Under "OAuth settings", add redirect URI: `http://localhost:8081/auth/stripe/callback`
4. Copy the Client ID (starts with `ca_`)

### 3. Deploy Supabase Edge Functions

Install Supabase CLI:
```bash
npm install -g supabase
```

Login and link your project:
```bash
supabase login
supabase link --project-ref your-project-ref
```

Set secrets (Stripe keys):
```bash
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Deploy functions:
```bash
supabase functions deploy stripe-connect-callback
supabase functions deploy stripe-checkout-create
supabase functions deploy stripe-webhook
```

### 4. Configure Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-project-ref.supabase.co/functions/v1/stripe-webhook`
3. Select events: `checkout.session.completed`, `charge.refunded`
4. Copy signing secret and set: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`

### 5. Apply Database Migration

Run `supabase/migrations/0043_stripe_tickets.sql` in your Supabase SQL Editor.

## Testing

1. **Create organization account**: Set `account_type = 'organization'` in database
2. **Connect Stripe**: Navigate to `/organizations/stripe-connect` and connect
3. **Create ticketed event**: Go to `/organizations/events/new-ticketed`
4. **Purchase tickets**: Use test card `4242 4242 4242 4242`

See `docs/stripe-testing-guide.md` for detailed testing steps.

## Architecture

- **Client**: React Native app calls Supabase Edge Functions
- **Edge Functions**: Handle Stripe API calls (OAuth, checkout, webhooks)
- **Database**: Stores ticket data, purchases, and RSVPs
- **No separate backend needed** - everything runs on Supabase!

## Files

- `supabase/functions/` - Edge Functions (OAuth, checkout, webhook)
- `services/stripe.ts` - Client-side Stripe service
- `services/tickets.ts` - Ticket management service
- `components/` - UI components for tickets
- `app/organizations/` - Organization screens
