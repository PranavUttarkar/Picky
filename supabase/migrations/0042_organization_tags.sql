-- Organization tags table for better discoverability
CREATE TABLE IF NOT EXISTS organization_tags (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tags TEXT[] DEFAULT '{}' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE organization_tags ENABLE ROW LEVEL SECURITY;

-- Policies for organization_tags
-- Allow anyone to read organization tags
CREATE POLICY "Anyone can read organization tags"
    ON organization_tags
    FOR SELECT
    USING (true);

-- Allow organization accounts to insert/update their own tags
CREATE POLICY "Organizations can manage their own tags"
    ON organization_tags
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.account_type = 'organization'
        )
    );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_organization_tags_user_id ON organization_tags(user_id);

-- Create index for tag searching (GIN index for array contains)
CREATE INDEX IF NOT EXISTS idx_organization_tags_tags ON organization_tags USING GIN(tags);

-- Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_organization_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_organization_tags_updated_at
    BEFORE UPDATE ON organization_tags
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_tags_updated_at();

-- Comment on table
COMMENT ON TABLE organization_tags IS 'Tags for organization accounts to improve discoverability';
