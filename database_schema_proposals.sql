-- ============================================================================
-- Proposals Schema
-- Handles proposal/contract generation for sales sessions
-- ============================================================================

-- Proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to sales session
  sales_session_id UUID REFERENCES sales_sessions(id),
  
  -- Client information
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_company TEXT,
  
  -- Proposal content
  bundle_id UUID REFERENCES offer_bundles(id),
  bundle_name TEXT NOT NULL,
  line_items JSONB NOT NULL DEFAULT '[]',
  -- Line items structure:
  -- [
  --   {
  --     "content_type": "product",
  --     "content_id": "uuid",
  --     "title": "Product Name",
  --     "description": "Product description",
  --     "offer_role": "core_offer",
  --     "price": 99.00,
  --     "perceived_value": 150.00
  --   }
  -- ]
  
  -- Pricing
  subtotal DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  discount_description TEXT,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Terms and validity
  terms_text TEXT,
  valid_until TIMESTAMP WITH TIME ZONE,
  
  -- Status flow: draft → sent → viewed → accepted → paid → fulfilled
  status TEXT NOT NULL DEFAULT 'draft',
  
  -- PDF storage (Supabase Storage URL)
  pdf_url TEXT,
  
  -- Tracking timestamps
  sent_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Stripe integration
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  
  -- Link to order after payment
  order_id BIGINT REFERENCES orders(id),
  
  -- Audit fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add proposal and sales session links to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sales_session_id UUID REFERENCES sales_sessions(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES proposals(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_proposals_sales_session ON proposals(sales_session_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_client_email ON proposals(client_email);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_sales_session ON orders(sales_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_proposal ON orders(proposal_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_proposals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_proposals_updated_at ON proposals;
CREATE TRIGGER trigger_proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_proposals_updated_at();

-- RLS Policies
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- Admins can manage all proposals
DROP POLICY IF EXISTS "Admins can manage proposals" ON proposals;
CREATE POLICY "Admins can manage proposals"
  ON proposals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Public can view proposals by ID (for client access via link)
DROP POLICY IF EXISTS "Public can view proposals by id" ON proposals;
CREATE POLICY "Public can view proposals by id"
  ON proposals FOR SELECT
  USING (true);

-- ============================================================================
-- Helper function to get proposal with resolved details
-- ============================================================================
CREATE OR REPLACE FUNCTION get_proposal_summary(p_proposal_id UUID)
RETURNS TABLE (
  id UUID,
  client_name TEXT,
  client_email TEXT,
  client_company TEXT,
  bundle_name TEXT,
  item_count INTEGER,
  subtotal DECIMAL(10,2),
  discount_amount DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  status TEXT,
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.client_name,
    p.client_email,
    p.client_company,
    p.bundle_name,
    jsonb_array_length(p.line_items)::INTEGER as item_count,
    p.subtotal,
    p.discount_amount,
    p.total_amount,
    p.status,
    p.valid_until,
    p.created_at
  FROM proposals p
  WHERE p.id = p_proposal_id;
END;
$$ LANGUAGE plpgsql;
