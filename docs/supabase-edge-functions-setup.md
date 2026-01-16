# Supabase Edge Functions Setup for Stripe

This guide explains how to set up and deploy the Supabase Edge Functions needed for the Stripe ticket system.

## Prerequisites

1. **Supabase CLI** installed:
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link your project**:
   ```bash
   supabase link --project-ref your-project-ref
   ```

## Environment Variables

Set these secrets in your Supabase project dashboard (Settings → Edge Functions → Secrets):

- `STRIPE_SECRET_KEY_TEST` - Your Stripe test secret key (starts with `sk_test_`)
- `STRIPE_SECRET_KEY_LIVE` - Your Stripe live secret key (starts with `sk_live_`) - for production
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret from Stripe Dashboard
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for webhook handler)

**To set secrets:**
```bash
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Deploy Functions

Deploy all three functions:

```bash
# Deploy OAuth callback handler
supabase functions deploy stripe-connect-callback

# Deploy checkout session creator
supabase functions deploy stripe-checkout-create

# Deploy webhook handler
supabase functions deploy stripe-webhook
```

## Function URLs

After deployment, your functions will be available at:
- `https://your-project-ref.supabase.co/functions/v1/stripe-connect-callback`
- `https://your-project-ref.supabase.co/functions/v1/stripe-checkout-create`
- `https://your-project-ref.supabase.co/functions/v1/stripe-webhook`

## Webhook Configuration

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Enter your webhook URL: `https://your-project-ref.supabase.co/functions/v1/stripe-webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `payment_intent.succeeded` (optional backup)
   - `charge.refunded`
5. Copy the "Signing secret" and set it as `STRIPE_WEBHOOK_SECRET` in Supabase

## Testing Locally

You can test functions locally:

```bash
# Start local Supabase (if using local development)
supabase start

# Serve functions locally
supabase functions serve stripe-connect-callback --no-verify-jwt
supabase functions serve stripe-checkout-create
supabase functions serve stripe-webhook --no-verify-jwt
```

## Troubleshooting

### Function not found
- Make sure you've deployed the function: `supabase functions deploy function-name`
- Check that you're using the correct project ref

### Authentication errors
- Check that your Supabase client is properly authenticated
- For webhook, ensure `SUPABASE_SERVICE_ROLE_KEY` is set (bypasses RLS)

### Stripe API errors
- Verify your Stripe secret keys are correct
- Check that keys match the mode (test vs live)
- Ensure Stripe Connect is enabled in your Stripe account

### Webhook not receiving events
- Verify webhook URL in Stripe Dashboard
- Check webhook secret is set correctly
- Test with Stripe CLI: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`
