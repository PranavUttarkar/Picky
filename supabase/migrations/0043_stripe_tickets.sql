-- Stripe Ticket System Migration
-- Adds support for organizations to sell tickets via Stripe Connect

-- 1. Organization Stripe Accounts table
CREATE TABLE IF NOT EXISTS organization_stripe_accounts (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL UNIQUE,
  stripe_account_status text NOT NULL DEFAULT 'pending',
  is_test_mode boolean NOT NULL DEFAULT true,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Event Tickets table (ticket tiers/types)
CREATE TABLE IF NOT EXISTS event_tickets (
  id bigserial PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  sold_count integer NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  is_early_bird boolean NOT NULL DEFAULT false,
  early_bird_end_date timestamptz,
  early_bird_price_cents integer CHECK (early_bird_price_cents IS NULL OR early_bird_price_cents >= 0),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Ticket Purchases table
CREATE TABLE IF NOT EXISTS ticket_purchases (
  id bigserial PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ticket_id bigint NOT NULL REFERENCES event_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_payment_intent_id text UNIQUE,
  stripe_checkout_session_id text,
  amount_paid_cents integer NOT NULL CHECK (amount_paid_cents >= 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  purchased_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Modify events table
ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS is_ticketed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ticket_customization jsonb DEFAULT '{}'::jsonb;

-- 5. Modify organization_profiles table
ALTER TABLE organization_profiles
  ADD COLUMN IF NOT EXISTS stripe_connected boolean NOT NULL DEFAULT false;

-- 6. Modify event_attendees table to link to purchases
ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS ticket_purchase_id bigint REFERENCES ticket_purchases(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_org_stripe_accounts_user_id ON organization_stripe_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_org_stripe_accounts_stripe_id ON organization_stripe_accounts(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_event_id ON event_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_display_order ON event_tickets(event_id, display_order);
CREATE INDEX IF NOT EXISTS idx_ticket_purchases_event_id ON ticket_purchases(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_purchases_user_id ON ticket_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_purchases_ticket_id ON ticket_purchases(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_purchases_status ON ticket_purchases(status);
CREATE INDEX IF NOT EXISTS idx_ticket_purchases_stripe_pi ON ticket_purchases(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_ticket_purchases_stripe_session ON ticket_purchases(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_ticket_purchase ON event_attendees(ticket_purchase_id);
CREATE INDEX IF NOT EXISTS idx_events_is_ticketed ON events(is_ticketed);

-- Enable RLS
ALTER TABLE organization_stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization_stripe_accounts
-- Only organization owner can view/update their account
DROP POLICY IF EXISTS "org_stripe_accounts_select" ON organization_stripe_accounts;
CREATE POLICY "org_stripe_accounts_select" ON organization_stripe_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "org_stripe_accounts_insert" ON organization_stripe_accounts;
CREATE POLICY "org_stripe_accounts_insert" ON organization_stripe_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.account_type = 'organization'
    )
  );

DROP POLICY IF EXISTS "org_stripe_accounts_update" ON organization_stripe_accounts;
CREATE POLICY "org_stripe_accounts_update" ON organization_stripe_accounts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "org_stripe_accounts_delete" ON organization_stripe_accounts;
CREATE POLICY "org_stripe_accounts_delete" ON organization_stripe_accounts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for event_tickets
-- Public read, only event creator can modify
DROP POLICY IF EXISTS "event_tickets_select" ON event_tickets;
CREATE POLICY "event_tickets_select" ON event_tickets
  FOR SELECT
  USING (true); -- Public read

DROP POLICY IF EXISTS "event_tickets_insert" ON event_tickets;
CREATE POLICY "event_tickets_insert" ON event_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = event_tickets.event_id 
      AND events.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "event_tickets_update" ON event_tickets;
CREATE POLICY "event_tickets_update" ON event_tickets
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = event_tickets.event_id 
      AND events.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = event_tickets.event_id 
      AND events.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "event_tickets_delete" ON event_tickets;
CREATE POLICY "event_tickets_delete" ON event_tickets
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = event_tickets.event_id 
      AND events.created_by = auth.uid()
    )
  );

-- RLS Policies for ticket_purchases
-- Users can view their own purchases, organizers can view for their events
DROP POLICY IF EXISTS "ticket_purchases_select" ON ticket_purchases;
CREATE POLICY "ticket_purchases_select" ON ticket_purchases
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = ticket_purchases.event_id 
      AND events.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ticket_purchases_insert" ON ticket_purchases;
CREATE POLICY "ticket_purchases_insert" ON ticket_purchases
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ticket_purchases_update" ON ticket_purchases;
CREATE POLICY "ticket_purchases_update" ON ticket_purchases
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = ticket_purchases.event_id 
      AND events.created_by = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = ticket_purchases.event_id 
      AND events.created_by = auth.uid()
    )
  );

-- Helper function to get current price for a ticket (handles early bird)
CREATE OR REPLACE FUNCTION get_ticket_price_cents(p_ticket_id bigint)
RETURNS integer
LANGUAGE sql STABLE
AS $$
  SELECT 
    CASE 
      WHEN t.is_early_bird 
        AND t.early_bird_end_date IS NOT NULL 
        AND t.early_bird_end_date > now()
        AND t.early_bird_price_cents IS NOT NULL
      THEN t.early_bird_price_cents
      ELSE t.price_cents
    END
  FROM event_tickets t
  WHERE t.id = p_ticket_id;
$$;

-- Helper function to check if ticket tier has capacity
CREATE OR REPLACE FUNCTION ticket_has_capacity(p_ticket_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT 
    CASE 
      WHEN t.capacity IS NULL THEN true
      ELSE t.sold_count < t.capacity
    END
  FROM event_tickets t
  WHERE t.id = p_ticket_id;
$$;

-- Helper function to get available quantity for a ticket tier
CREATE OR REPLACE FUNCTION get_ticket_available_quantity(p_ticket_id bigint)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT 
    CASE 
      WHEN t.capacity IS NULL THEN 999999 -- Unlimited
      ELSE GREATEST(0, t.capacity - t.sold_count)
    END
  FROM event_tickets t
  WHERE t.id = p_ticket_id;
$$;

-- Function to update sold_count when purchase is completed
CREATE OR REPLACE FUNCTION update_ticket_sold_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only update on status change to/from completed
  IF (OLD.status = 'completed' AND NEW.status != 'completed') THEN
    -- Refund or cancellation: decrease sold_count
    UPDATE event_tickets
    SET sold_count = GREATEST(0, sold_count - NEW.quantity)
    WHERE id = NEW.ticket_id;
  ELSIF (OLD.status != 'completed' AND NEW.status = 'completed') THEN
    -- Purchase completed: increase sold_count
    UPDATE event_tickets
    SET sold_count = sold_count + NEW.quantity
    WHERE id = NEW.ticket_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_ticket_sold_count
  AFTER UPDATE OF status ON ticket_purchases
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_ticket_sold_count();

-- Trigger to update sold_count on insert if status is completed
CREATE OR REPLACE FUNCTION update_ticket_sold_count_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE event_tickets
    SET sold_count = sold_count + NEW.quantity
    WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_ticket_sold_count_on_insert
  AFTER INSERT ON ticket_purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_sold_count_on_insert();

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_organization_stripe_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_org_stripe_accounts_updated_at
  BEFORE UPDATE ON organization_stripe_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_organization_stripe_accounts_updated_at();

CREATE OR REPLACE FUNCTION update_event_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_event_tickets_updated_at
  BEFORE UPDATE ON event_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_event_tickets_updated_at();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_ticket_price_cents(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION ticket_has_capacity(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ticket_available_quantity(bigint) TO authenticated;

-- Comments
COMMENT ON TABLE organization_stripe_accounts IS 'Stripe Connect account information for organizations';
COMMENT ON TABLE event_tickets IS 'Ticket tiers/types for ticketed events';
COMMENT ON TABLE ticket_purchases IS 'Records of ticket purchases via Stripe';
