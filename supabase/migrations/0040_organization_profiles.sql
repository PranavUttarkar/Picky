-- Organization Profiles Migration
-- Creates organization-specific profile data for organization accounts

-- Organization profile table
CREATE TABLE IF NOT EXISTS organization_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'Other',
  description text,
  website text,
  contact_email text,
  founded_year integer,
  member_count text, -- e.g., '1-10', '10-50', '50-100', '100+'
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Category constraint (drop if exists first for idempotency)
ALTER TABLE organization_profiles DROP CONSTRAINT IF EXISTS organization_profiles_category_check;
ALTER TABLE organization_profiles 
ADD CONSTRAINT organization_profiles_category_check 
CHECK (category IN (
  'Student Club', 
  'Business', 
  'Sports Team', 
  'Academic', 
  'Arts & Cultural', 
  'Religious', 
  'Professional', 
  'Nonprofit', 
  'Greek Life',
  'Other'
));

-- Member count constraint (drop if exists first for idempotency)
ALTER TABLE organization_profiles DROP CONSTRAINT IF EXISTS organization_profiles_member_count_check;
ALTER TABLE organization_profiles 
ADD CONSTRAINT organization_profiles_member_count_check 
CHECK (member_count IS NULL OR member_count IN ('1-10', '10-50', '50-100', '100+'));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_organization_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organization_profiles_updated_at ON organization_profiles;
CREATE TRIGGER organization_profiles_updated_at
BEFORE UPDATE ON organization_profiles
FOR EACH ROW EXECUTE FUNCTION update_organization_profiles_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organization_profiles_category ON organization_profiles(category);
CREATE INDEX IF NOT EXISTS idx_organization_profiles_verified ON organization_profiles(verified);

-- Enable RLS
ALTER TABLE organization_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Anyone can read organization profiles (public discovery)
DROP POLICY IF EXISTS "organization_profiles_select" ON organization_profiles;
CREATE POLICY "organization_profiles_select" ON organization_profiles
FOR SELECT TO authenticated
USING (true);

-- Only the organization owner can insert their profile
DROP POLICY IF EXISTS "organization_profiles_insert" ON organization_profiles;
CREATE POLICY "organization_profiles_insert" ON organization_profiles
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND account_type = 'organization'
  )
);

-- Only the organization owner can update their profile
DROP POLICY IF EXISTS "organization_profiles_update" ON organization_profiles;
CREATE POLICY "organization_profiles_update" ON organization_profiles
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Only the organization owner can delete their profile
DROP POLICY IF EXISTS "organization_profiles_delete" ON organization_profiles;
CREATE POLICY "organization_profiles_delete" ON organization_profiles
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Grant permissions
GRANT SELECT ON organization_profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON organization_profiles TO authenticated;

-- Helper function to get organization profile with user info
CREATE OR REPLACE FUNCTION get_organization_with_profile(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  account_type text,
  category text,
  description text,
  website text,
  contact_email text,
  founded_year integer,
  member_count text,
  verified boolean,
  follower_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT 
    u.id,
    u.username,
    u.display_name,
    u.avatar_url,
    u.account_type,
    op.category,
    op.description,
    op.website,
    op.contact_email,
    op.founded_year,
    op.member_count,
    op.verified,
    (SELECT COUNT(*) FROM user_follows WHERE followed_id = u.id) as follower_count
  FROM users u
  LEFT JOIN organization_profiles op ON op.user_id = u.id
  WHERE u.id = p_user_id AND u.account_type = 'organization';
$$;

-- Helper function to discover organizations with profiles
CREATE OR REPLACE FUNCTION discover_organizations_with_profiles(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  category text,
  description text,
  verified boolean,
  follower_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT 
    u.id,
    u.username,
    u.display_name,
    u.avatar_url,
    COALESCE(op.category, 'Other') as category,
    op.description,
    COALESCE(op.verified, false) as verified,
    (SELECT COUNT(*) FROM user_follows WHERE followed_id = u.id) as follower_count
  FROM users u
  LEFT JOIN organization_profiles op ON op.user_id = u.id
  WHERE u.account_type = 'organization'
    AND u.username IS NOT NULL
  ORDER BY follower_count DESC, u.created_at DESC
  LIMIT p_limit;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_organization_with_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION discover_organizations_with_profiles(integer) TO authenticated;

