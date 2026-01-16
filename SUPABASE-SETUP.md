# Supabase Edge Functions Setup - Step by Step

## Step 1: Install and Login

```bash
# Install Supabase CLI globally
npm install -g supabase

# Login (opens browser)
supabase login
```

## Step 2: Find Your Project Ref

Your project ref is in your Supabase project URL:
- URL: `https://osjqpxscuycbgtbojngb.supabase.co`
- Project ref: `osjqpxscuycbgtbojngb`

Or find it in Supabase Dashboard → Settings → General → Reference ID

## Step 3: Link Your Project

```bash
supabase link --project-ref osjqpxscuycbgtbojngb
```

Replace `osjqpxscuycbgtbojngb` with your actual project ref (20 characters, no dashes).

## Step 4: Set Secrets

Get your keys:

1. **Stripe Secret Key**: https://dashboard.stripe.com/test/apikeys → Secret key
2. **Service Role Key**: Supabase Dashboard → Settings → API → service_role key
3. **Webhook Secret**: Get this after setting up webhook (see Step 6)

Set them:
```bash
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

(Webhook secret will be set after Step 6)

## Step 5: Deploy Functions

```bash
supabase functions deploy stripe-connect-callback
supabase functions deploy stripe-checkout-create
supabase functions deploy stripe-webhook
```

## Step 6: Set Up Webhook in Stripe

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. URL: `https://osjqpxscuycbgtbojngb.supabase.co/functions/v1/stripe-webhook`
   (Replace with your project ref)
4. Select events:
   - `checkout.session.completed`
   - `charge.refunded`
5. Copy the "Signing secret" (starts with `whsec_`)
6. Set it:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

## Step 7: Test

1. Create organization account
2. Connect Stripe at `/organizations/stripe-connect`
3. Create ticketed event
4. Purchase tickets with test card `4242 4242 4242 4242`

## Common Issues

**"Invalid project ref format"**
- Must be exactly 20 characters
- No dashes, just letters/numbers
- Example: `osjqpxscuycbgtbojngb` ✅
- Example: `osjqpx-scuycbgtbojngb` ❌

**"No arguments found"**
- You need to provide the project ref: `--project-ref YOUR_REF`
- Or check you're in the right directory

**Can't find project ref**
- Check Supabase Dashboard → Settings → General
- Or look at your project URL (the part before `.supabase.co`)
