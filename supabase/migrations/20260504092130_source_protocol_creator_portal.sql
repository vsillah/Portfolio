-- Creator-facing Source Protocol portal access.
-- Links authenticated users to verified creator records without inferring identity
-- from email, names, or public profile data.

CREATE TABLE IF NOT EXISTS source_creator_portal_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES source_creators(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'revoked')),
  can_view_earnings BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_receipts BOOLEAN NOT NULL DEFAULT TRUE,
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_source_creator_portal_accounts_user_status
  ON source_creator_portal_accounts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_source_creator_portal_accounts_creator_id
  ON source_creator_portal_accounts(creator_id);

DROP TRIGGER IF EXISTS source_creator_portal_accounts_updated_at ON source_creator_portal_accounts;
CREATE TRIGGER source_creator_portal_accounts_updated_at
  BEFORE UPDATE ON source_creator_portal_accounts
  FOR EACH ROW EXECUTE FUNCTION update_source_respecting_llm_updated_at();

ALTER TABLE source_creator_portal_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage source creators" ON source_creators;
CREATE POLICY "Admins can manage source creators" ON source_creators
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage source creator portal accounts" ON source_creator_portal_accounts;
CREATE POLICY "Admins can manage source creator portal accounts" ON source_creator_portal_accounts
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Creators can view their own active portal account" ON source_creator_portal_accounts;
CREATE POLICY "Creators can view their own active portal account" ON source_creator_portal_accounts
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL AND user_id = (select auth.uid()) AND status = 'active');

DROP POLICY IF EXISTS "Admins can manage licensed works" ON licensed_works;
CREATE POLICY "Admins can manage licensed works" ON licensed_works
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage license grants" ON license_grants;
CREATE POLICY "Admins can manage license grants" ON license_grants
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage source chunks" ON source_chunks;
CREATE POLICY "Admins can manage source chunks" ON source_chunks
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage answer receipt chunks" ON answer_receipt_chunks;
CREATE POLICY "Admins can manage answer receipt chunks" ON answer_receipt_chunks
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage monthly creator payouts" ON monthly_creator_payouts;
CREATE POLICY "Admins can manage monthly creator payouts" ON monthly_creator_payouts
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage creator rights disputes" ON creator_rights_disputes;
CREATE POLICY "Admins can manage creator rights disputes" ON creator_rights_disputes
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Creators can view their own source creator profile" ON source_creators;
CREATE POLICY "Creators can view their own source creator profile" ON source_creators
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM source_creator_portal_accounts portal
      WHERE portal.creator_id = source_creators.id
        AND portal.user_id = (select auth.uid())
        AND portal.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Creators can view their own licensed works" ON licensed_works;
CREATE POLICY "Creators can view their own licensed works" ON licensed_works
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM source_creator_portal_accounts portal
      WHERE portal.creator_id = licensed_works.creator_id
        AND portal.user_id = (select auth.uid())
        AND portal.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Creators can view grants for their own works" ON license_grants;
CREATE POLICY "Creators can view grants for their own works" ON license_grants
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM licensed_works work
      JOIN source_creator_portal_accounts portal ON portal.creator_id = work.creator_id
      WHERE work.id = license_grants.work_id
        AND portal.user_id = (select auth.uid())
        AND portal.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Creators can view their own source chunks" ON source_chunks;
CREATE POLICY "Creators can view their own source chunks" ON source_chunks
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM source_creator_portal_accounts portal
      WHERE portal.creator_id = source_chunks.creator_id
        AND portal.user_id = (select auth.uid())
        AND portal.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Creators can view their own attributed receipt chunks" ON answer_receipt_chunks;
CREATE POLICY "Creators can view their own attributed receipt chunks" ON answer_receipt_chunks
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM source_creator_portal_accounts portal
      WHERE portal.creator_id = answer_receipt_chunks.creator_id
        AND portal.user_id = (select auth.uid())
        AND portal.status = 'active'
        AND portal.can_view_receipts = TRUE
    )
  );

DROP POLICY IF EXISTS "Creators can view their own monthly payouts" ON monthly_creator_payouts;
CREATE POLICY "Creators can view their own monthly payouts" ON monthly_creator_payouts
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM source_creator_portal_accounts portal
      WHERE portal.creator_id = monthly_creator_payouts.creator_id
        AND portal.user_id = (select auth.uid())
        AND portal.status = 'active'
        AND portal.can_view_earnings = TRUE
    )
  );

DROP POLICY IF EXISTS "Creators can view their own disputes" ON creator_rights_disputes;
CREATE POLICY "Creators can view their own disputes" ON creator_rights_disputes
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM source_creator_portal_accounts portal
      WHERE portal.creator_id = creator_rights_disputes.creator_id
        AND portal.user_id = (select auth.uid())
        AND portal.status = 'active'
    )
  );

GRANT ALL ON source_creator_portal_accounts TO service_role;
