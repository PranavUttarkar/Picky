# Stripe Ticket System Testing Guide

This guide walks you through testing the ticket feature end-to-end using Stripe test mode.

## Prerequisites

1. **Stripe Account Setup**
   - Sign up at https://stripe.com (or log in)
   - Go to Dashboard → Developers → API keys
   - Copy your **Test** publishable key and secret key
   - Add them to your `.env` file:
     ```
     EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
     EXPO_PUBLIC_STRIPE_SECRET_KEY_TEST=sk_test_...
     ```

2. **Stripe Connect Setup**
   - Go to Dashboard → Settings → Connect
   - Enable Stripe Connect (if not already enabled)
   - Go to Settings → Connect → Settings
   - Under "OAuth settings", add a redirect URI:
     - For local testing: `exp://localhost:8081/--/auth/stripe/callback`
     - For web: `http://localhost:8081/auth/stripe/callback`
     - For production: `https://your-domain.com/auth/stripe/callback`
   - Copy your **Connect Client ID** (starts with `ca_`)
   - Add to `.env`:
     ```
     EXPO_PUBLIC_STRIPE_CONNECT_CLIENT_ID_TEST=ca_...
     ```

3. **Environment Variables**
   Make sure your `.env` file has:
   ```
   EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
   EXPO_PUBLIC_STRIPE_CONNECT_CLIENT_ID_TEST=ca_...
   EXPO_PUBLIC_APP_URL=http://localhost:8081 (or your app URL)
   ```
   
   **Note:** Stripe secret keys should be set as Supabase Edge Function secrets (not in `.env`):
   - Go to Supabase Dashboard → Settings → Edge Functions → Secrets
   - Set `STRIPE_SECRET_KEY_TEST=sk_test_...`
   - Set `STRIPE_WEBHOOK_SECRET=whsec_...` (from Stripe Dashboard)
   - Set `SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`

4. **Database Migration**
   - Make sure migration `0043_stripe_tickets.sql` has been applied to your Supabase database

## Step-by-Step Testing

### Step 1: Create an Organization Account

1. Sign up or log in to the app
2. Go to Profile → Account Settings
3. Change account type to "Organization" (if available) OR
4. Create a new user and set `account_type = 'organization'` in the database:
   ```sql
   UPDATE users SET account_type = 'organization' WHERE email = 'your-email@example.com';
   ```

### Step 2: Connect Stripe Account

1. Navigate to `/organizations/stripe-connect` (or find the link in your organization profile)
2. Click "Connect Stripe Account"
3. You'll be redirected to Stripe's OAuth page
4. **For testing, use Stripe's test mode:**
   - Click "Skip this form" (for testing)
   - Or fill out minimal info (email, country)
   - Complete the onboarding
5. You'll be redirected back to the app
6. The app should show "Stripe Connected (Test Mode)"

**Note:** The OAuth callback handler needs to be implemented. See "Backend Setup" below.

### Step 3: Create a Ticketed Event

1. Navigate to `/organizations/events/new-ticketed`
2. Fill in event details:
   - Title: "Test Concert"
   - Description: "A test event for tickets"
   - Date/Time: Future date
   - Location: "Test Venue"
3. Add Ticket Tiers:
   - Click "+ Add Tier"
   - Name: "General Admission"
   - Price: $25.00
   - Capacity: 100 (optional)
   - Save
   - Add another tier: "VIP" - $50.00 - Capacity: 20
4. (Optional) Customize ticket appearance
5. Click "Create Event"

### Step 4: View the Ticketed Event

1. Navigate to the event detail page (`/events/[id]`)
2. You should see:
   - "Ticketed Event" badge
   - Ticket pricing information
   - "Purchase Tickets" button (instead of RSVP)

### Step 5: Purchase Tickets (as a different user)

1. **Switch to a different user account** (or use incognito/private browsing)
2. Navigate to the ticketed event
3. Click "Purchase Tickets"
4. Select ticket quantities:
   - General Admission: 2 tickets
   - VIP: 1 ticket
5. Click "Proceed to Checkout"
6. You'll be redirected to Stripe Checkout
7. **Use Stripe test card:**
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)
8. Complete the payment
9. You should be redirected back to the event page
10. The event should show you as "attending" (RSVP created automatically)

### Step 6: Verify Purchase

1. As the event organizer, go to the event management page
2. Check ticket sales:
   - General Admission: 2 sold
   - VIP: 1 sold
   - Total revenue should be displayed
3. Check attendees list - you should see the purchaser

### Step 7: Test Capacity Limits

1. Edit the event and reduce ticket capacity:
   - General Admission: Set capacity to 1
2. Try to purchase 2 tickets
3. Should show error: "Only 1 tickets available"
4. Purchase 1 ticket successfully
5. Try to purchase another - should show "Sold Out"

### Step 8: Test Early Bird Pricing

1. Edit a ticket tier
2. Enable "Early Bird Pricing"
3. Set Early Bird Price: $20.00 (regular is $25.00)
4. Set Early Bird End Date: Tomorrow
5. Save
6. Purchase a ticket - should charge $20.00
7. Wait until after the end date (or manually set date in past)
8. Price should revert to $25.00

## Backend Setup Required

The current implementation requires backend API endpoints for:

1. **Stripe Connect OAuth Callback** (`/api/stripe/connect/callback`)
   - Exchanges OAuth code for Stripe account ID
   - Returns account status

2. **Checkout Session Creation** (`/api/stripe/checkout/create`)
   - Creates Stripe Checkout Session
   - Uses Stripe secret key (server-side only)

See `api/stripe-webhook.ts` for webhook handler template.

### Supabase Edge Functions Setup

The backend is implemented as Supabase Edge Functions. See `docs/supabase-edge-functions-setup.md` for deployment instructions.

**Quick setup:**
1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link project: `supabase link --project-ref your-project-ref`
4. Set secrets: `supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...`
5. Deploy functions:
   ```bash
   supabase functions deploy stripe-connect-callback
   supabase functions deploy stripe-checkout-create
   supabase functions deploy stripe-webhook
   ```

**Old Backend Setup (if not using Supabase Edge Functions):**

If you prefer a separate backend instead of Supabase Edge Functions, create these API routes:

**`api/stripe/connect/callback.ts`** (or similar for your platform):
```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.EXPO_PUBLIC_STRIPE_SECRET_KEY_TEST!, {
  apiVersion: '2024-12-18.acacia',
});

export async function POST(request: Request) {
  const { code, isTestMode } = await request.json();
  
  try {
    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    });
    
    return Response.json({
      accountId: response.stripe_user_id,
      accountStatus: 'active', // or check response.details_submitted
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
```

**`api/stripe/checkout/create.ts`**:
```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.EXPO_PUBLIC_STRIPE_SECRET_KEY_TEST!, {
  apiVersion: '2024-12-18.acacia',
});

export async function POST(request: Request) {
  const { eventId, ticketSelections, stripeAccountId, isTestMode, successUrl, cancelUrl } = await request.json();
  
  // Validate ticket availability (query your database)
  // ... validation logic ...
  
  const lineItems = ticketSelections.map((sel: any) => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: `Ticket for Event ${eventId}`,
      },
      unit_amount: sel.priceCents, // Get from database
    },
    quantity: sel.quantity,
  }));
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: request.headers.get('user-id'), // Pass user ID
    metadata: {
      eventId: eventId.toString(),
      ticketSelections: JSON.stringify(ticketSelections),
    },
  }, {
    stripeAccount: stripeAccountId, // Connect account
  });
  
  return Response.json({
    sessionId: session.id,
    url: session.url,
  });
}
```

## Troubleshooting

### "Stripe Connect client ID not configured"
- Make sure `EXPO_PUBLIC_STRIPE_CONNECT_CLIENT_ID_TEST` is in your `.env`
- Restart your dev server after adding env vars

### "Failed to connect Stripe account"
- Check that the OAuth redirect URI matches what you set in Stripe Dashboard
- Verify the backend callback endpoint is working

### "Failed to create checkout session"
- Check that the backend API endpoint is accessible
- Verify Stripe secret key is correct
- Check browser console for detailed error

### Tickets not showing after purchase
- Check webhook is configured and receiving events
- Verify `checkout.session.completed` webhook is processing
- Check database for `ticket_purchases` records

### RSVP not created after purchase
- Check webhook handler is creating `event_attendees` record
- Verify `ticket_purchase_id` is linked correctly

## Stripe Test Cards

Use these test cards in Stripe Checkout:

- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- **3D Secure:** `4000 0027 6000 3184`
- **Insufficient Funds:** `4000 0000 0000 9995`

## Next Steps

Once testing is complete:
1. Set up webhook endpoint in Stripe Dashboard
2. Test webhook with Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe-webhook`
3. Switch to live mode when ready for production
4. Update environment variables to use live keys
