# Quick Setup Commands

## Your Project Ref
Based on your codebase, your project ref is: **`osjqpxscuycbgtbojngb`**

## Step-by-Step Commands

### 1. Login to Supabase CLI
```bash
supabase login
```
(This opens a browser to authenticate)

### 2. Link Your Project
```bash
supabase link --project-ref osjqpxscuycbgtbojngb
```

### 3. Set Secrets
```bash
# Stripe test secret key (from Stripe Dashboard → API keys)
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_your_key_here

# Supabase service role key (from Supabase Dashboard → Settings → API)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your_key_here

# Webhook secret (set this after configuring webhook in Stripe)
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
```

### 4. Deploy Functions
```bash
supabase functions deploy stripe-connect-callback
supabase functions deploy stripe-checkout-create
supabase functions deploy stripe-webhook
```

### 5. Verify Secrets Are Set
```bash
supabase secrets list
```

## Common Errors & Fixes

**Error: "Invalid project ref format"**
- Make sure you're using: `supabase link --project-ref osjqpxscuycbgtbojngb`
- The project ref must be exactly 20 characters, no dashes
- Don't include `https://` or `.supabase.co`

**Error: "No arguments found"**
- You forgot the `--project-ref` flag
- Use: `supabase link --project-ref osjqpxscuycbgtbojngb`
- Not: `supabase link osjqpxscuycbgtbojngb`

**Error: "Not authenticated"**
- Run `supabase login` first
- This will open your browser to authenticate

**Error: "Project not found"**
- Double-check the project ref in Supabase Dashboard
- Go to Settings → General → Reference ID
- Make sure you're logged into the correct Supabase account

## After Setup

Once functions are deployed, your webhook URL will be:
```
https://osjqpxscuycbgtbojngb.supabase.co/functions/v1/stripe-webhook
```

Configure this in Stripe Dashboard → Webhooks.
