# Quick Start: Stripe Tickets with Supabase Only

Everything runs on Supabase - no separate backend needed!

## Step 1: Get Your Stripe Keys

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy your **Test Publishable Key** (starts with `pk_test_`)
3. Copy your **Test Secret Key** (starts with `sk_test_`)
4. Go to https://dashboard.stripe.com/test/settings/connect
5. Enable Stripe Connect if needed
6. Under "OAuth settings", add redirect URI: `http://localhost:8081/auth/stripe/callback`
7. Copy your **Connect Client ID** (starts with `ca_`)

## Step 2: Set Environment Variables

Add to your `.env` file:
```env
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
EXPO_PUBLIC_STRIPE_CONNECT_CLIENT_ID_TEST=ca_...
EXPO_PUBLIC_APP_URL=http://localhost:8081
```

## Step 3: Deploy Supabase Edge Functions

Install Supabase CLI:
```bash
npm install -g supabase
```

Login:
```bash
supabase login
```

Link your project:
```bash
supabase link --project-ref your-project-ref
```
(Find your project ref in Supabase Dashboard → Settings → General → Reference ID)

Set secrets (your Stripe keys):
```bash
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...  # Get this after setting up webhook
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
(Service role key: Supabase Dashboard → Settings → API → service_role key)

Deploy the functions:
```bash
supabase functions deploy stripe-connect-callback
supabase functions deploy stripe-checkout-create
supabase functions deploy stripe-webhook
```

## Step 4: Set Up Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://your-project-ref.supabase.co/functions/v1/stripe-webhook`
4. Select events:
   - `checkout.session.completed`
   - `charge.refunded`
5. Copy the "Signing secret" (starts with `whsec_`)
6. Set it: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`

## Step 5: Apply Database Migration

Run `supabase/migrations/0043_stripe_tickets.sql` in Supabase SQL Editor.

## Step 6: Test It!

1. **Create organization account:**
   ```sql
   UPDATE users SET account_type = 'organization' WHERE email = 'your-email@example.com';
   ```

2. **Connect Stripe:**
   - Navigate to `/organizations/stripe-connect` in your app
   - Click "Connect Stripe Account"
   - Complete Stripe onboarding (use test mode, click "Skip this form" for quick testing)

3. **Create ticketed event:**
   - Go to `/organizations/events/new-ticketed`
   - Fill in event details
   - Add ticket tiers (e.g., "General Admission" - $25.00)
   - Create event

4. **Purchase tickets:**
   - As a different user, go to the event
   - Click "Purchase Tickets"
   - Use test card: `4242 4242 4242 4242`
   - Complete checkout
   - You should automatically be RSVP'd!

## Troubleshooting

**"Function not found"**
- Make sure you deployed: `supabase functions deploy function-name`
- Check you're using the correct project ref

**"Stripe secret key not configured"**
- Verify secrets are set: `supabase secrets list`
- Make sure you used `supabase secrets set` not `.env` file

**Webhook not working**
- Test locally: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`
- Check webhook URL in Stripe Dashboard matches your Supabase function URL
- Verify `STRIPE_WEBHOOK_SECRET` is set correctly

## That's It!

No separate backend needed - everything runs on Supabase Edge Functions! 🎉
