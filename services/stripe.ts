import { supabase } from './supabase';
import type { OrganizationStripeAccount } from '@/types/models';
import { createRateLimiter, RateLimitPresets } from '@/utils/rateLimiter';

const stripeLimiter = createRateLimiter({ maxRequests: 20, windowMs: 60000, key: 'stripe:api' });

// Get Stripe secret key based on test mode
function getStripeSecretKey(isTestMode: boolean): string {
  const key = isTestMode
    ? process.env.EXPO_PUBLIC_STRIPE_SECRET_KEY_TEST
    : process.env.EXPO_PUBLIC_STRIPE_SECRET_KEY_LIVE;
  
  if (!key) {
    throw new Error(`Stripe ${isTestMode ? 'test' : 'live'} secret key not configured`);
  }
  
  return key;
}

// Get Stripe publishable key based on test mode
export function getStripePublishableKey(isTestMode: boolean): string {
  const key = isTestMode
    ? process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST
    : process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE;
  
  if (!key) {
    throw new Error(`Stripe ${isTestMode ? 'test' : 'live'} publishable key not configured`);
  }
  
  return key;
}

// Get organization's Stripe account
export async function getOrganizationStripeAccount(userId?: string): Promise<OrganizationStripeAccount | null> {
  const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
  if (!targetUserId) return null;

  const { data, error } = await supabase
    .from('organization_stripe_accounts')
    .select('*')
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (error) throw error;
  return data as OrganizationStripeAccount | null;
}

// Check if organization has Stripe connected
export async function isStripeConnected(userId?: string): Promise<boolean> {
  const account = await getOrganizationStripeAccount(userId);
  return account !== null && account.stripe_account_status === 'active';
}

// Create Stripe Connect OAuth link
export async function createStripeConnectLink(isTestMode: boolean = true): Promise<string> {
  return stripeLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    // Verify user is an organization
    const { data: userData } = await supabase
      .from('users')
      .select('account_type')
      .eq('id', auth.user.id)
      .single();

    if (userData?.account_type !== 'organization') {
      throw new Error('Only organization accounts can connect Stripe');
    }

    // Construct OAuth redirect URI
    // For Expo: exp://localhost:8081/--/auth/stripe/callback
    // For web: http://localhost:8081/auth/stripe/callback
    const appUrl = process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:8081';
    const redirectUri = `${appUrl}/auth/stripe/callback`;
    const clientId = isTestMode
      ? process.env.EXPO_PUBLIC_STRIPE_CONNECT_CLIENT_ID_TEST
      : process.env.EXPO_PUBLIC_STRIPE_CONNECT_CLIENT_ID_LIVE;

    if (!clientId) {
      throw new Error('Stripe Connect client ID not configured');
    }

    const state = `${auth.user.id}:${isTestMode ? 'test' : 'live'}`;
    
    // In a real implementation, you'd want to store this state server-side and verify it
    const oauthUrl = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${clientId}&scope=read_write&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
    
    return oauthUrl;
  });
}

// Handle Stripe Connect OAuth callback
export async function handleStripeConnectCallback(
  code: string,
  state: string
): Promise<OrganizationStripeAccount> {
  return stripeLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    // Parse state to get user ID and test mode
    const [userId, mode] = state.split(':');
    if (userId !== auth.user.id) {
      throw new Error('Invalid state parameter');
    }

    const isTestMode = mode === 'test';

    // Exchange code for account ID via Supabase Edge Function
    const { data: callbackData, error: callbackError } = await supabase.functions.invoke('stripe-connect-callback', {
      body: { code, isTestMode },
    });

    if (callbackError) {
      throw new Error(callbackError.message || 'Failed to connect Stripe account');
    }

    const { accountId, accountStatus } = callbackData;
    
    if (!accountId) {
      throw new Error('Invalid response from Stripe OAuth');
    }

    // Store account in database
    const { data, error } = await supabase
      .from('organization_stripe_accounts')
      .upsert({
        user_id: auth.user.id,
        stripe_account_id: accountId,
        stripe_account_status: accountStatus || 'pending',
        is_test_mode: isTestMode,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    // Update organization profile
    await supabase
      .from('organization_profiles')
      .update({ stripe_connected: true })
      .eq('user_id', auth.user.id);

    return data as OrganizationStripeAccount;
  });
}

// Disconnect Stripe account
export async function disconnectStripeAccount(): Promise<void> {
  return stripeLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('organization_stripe_accounts')
      .delete()
      .eq('user_id', auth.user.id);

    if (error) throw error;

    // Update organization profile
    await supabase
      .from('organization_profiles')
      .update({ stripe_connected: false })
      .eq('user_id', auth.user.id);
  });
}

// Create Stripe Checkout Session (this should be done server-side)
// For now, this is a placeholder that would call a backend API
export async function createCheckoutSession(
  eventId: number,
  ticketSelections: Array<{ ticketId: number; quantity: number }>,
  successUrl: string,
  cancelUrl: string
): Promise<{ sessionId: string; url: string }> {
  return stripeLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    // Get event and verify it's ticketed
    const { data: event } = await supabase
      .from('events')
      .select('id, is_ticketed, created_by')
      .eq('id', eventId)
      .single();

    if (!event || !event.is_ticketed) {
      throw new Error('Event is not ticketed');
    }

    // Get organization's Stripe account
    const stripeAccount = await getOrganizationStripeAccount(event.created_by);
    if (!stripeAccount || stripeAccount.stripe_account_status !== 'active') {
      throw new Error('Organization does not have an active Stripe account');
    }

    // Get user ID for the checkout session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get ticket prices from database for the checkout session
    const { getEventTickets, getTicketCurrentPrice } = await import('./tickets');
    const tickets = await getEventTickets(eventId);
    
    // Build ticket selections with prices
    const ticketSelectionsWithPrices = await Promise.all(
      ticketSelections.map(async (sel) => {
        const ticket = tickets.find((t) => t.id === sel.ticketId);
        if (!ticket) {
          throw new Error(`Ticket ${sel.ticketId} not found`);
        }
        const priceCents = await getTicketCurrentPrice(ticket.id);
        return {
          ...sel,
          priceCents,
        };
      })
    );

    // Call Supabase Edge Function to create checkout session
    const { data, error } = await supabase.functions.invoke('stripe-checkout-create', {
      body: {
        eventId,
        ticketSelections: ticketSelectionsWithPrices,
        stripeAccountId: stripeAccount.stripe_account_id,
        isTestMode: stripeAccount.is_test_mode,
        successUrl,
        cancelUrl,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to create checkout session');
    }

    return data;
  });
}
