# Supabase CLI Setup Guide

## Finding Your Project Ref

Your project ref is a 20-character string found in your Supabase project URL or dashboard.

### Method 1: From Project URL
Your Supabase project URL looks like:
```
https://abcdefghijklmnopqrst.supabase.co
```
The project ref is: `abcdefghijklmnopqrst` (the part before `.supabase.co`)

### Method 2: From Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → General
4. Look for "Reference ID" - this is your project ref

## Linking Your Project

Once you have your project ref, link it:

```bash
supabase link --project-ref abcdefghijklmnopqrst
```

Replace `abcdefghijklmnopqrst` with your actual project ref.

## Setting Secrets

After linking, set your secrets:

```bash
# Set Stripe test secret key
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_your_key_here

# Set Stripe webhook secret (get this from Stripe Dashboard after setting up webhook)
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_secret_here

# Set Supabase service role key (from Supabase Dashboard → Settings → API)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Alternative: Using .env File

If you prefer to use a `.env` file for Supabase CLI, create `supabase/.env`:

```env
SUPABASE_PROJECT_REF=abcdefghijklmnopqrst
SUPABASE_ACCESS_TOKEN=your_access_token
```

Then link with:
```bash
supabase link --env-file supabase/.env
```

## Deploy Functions

After linking and setting secrets:

```bash
supabase functions deploy stripe-connect-callback
supabase functions deploy stripe-checkout-create
supabase functions deploy stripe-webhook
```

## Troubleshooting

**"Invalid project ref format"**
- Make sure it's exactly 20 characters
- No dashes or special characters
- Copy directly from Supabase Dashboard

**"No arguments found"**
- Make sure you're providing the project ref: `supabase link --project-ref YOUR_REF`
- Or use `--env-file` flag if using environment file

**"Not authenticated"**
- Run `supabase login` first
- This will open a browser to authenticate
