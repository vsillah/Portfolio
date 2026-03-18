-- Installment payment plans: tables and columns for installment billing via Stripe Subscriptions

-- Track installment plan configuration per proposal or order
CREATE TABLE IF NOT EXISTS installment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES proposals(id),
  order_id BIGINT REFERENCES orders(id),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT NOT NULL,
  num_installments INTEGER NOT NULL CHECK (num_installments >= 2),
  installment_amount DECIMAL(10,2) NOT NULL,
  fee_percent DECIMAL(5,2) NOT NULL DEFAULT 10,
  fee_amount DECIMAL(10,2) NOT NULL,
  total_with_fee DECIMAL(10,2) NOT NULL,
  base_amount DECIMAL(10,2) NOT NULL,
  installments_paid INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'failed', 'canceled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Track each individual installment payment
CREATE TABLE IF NOT EXISTS installment_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_plan_id UUID NOT NULL REFERENCES installment_plans(id),
  payment_number INTEGER NOT NULL,
  stripe_invoice_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Service term on proposals (defaults from bundle, configurable per proposal)
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS service_term_months INTEGER;

-- Default service term on bundles (flows into proposals)
ALTER TABLE offer_bundles
  ADD COLUMN IF NOT EXISTS default_service_term_months INTEGER;

-- Seed the default installment fee percent into site_settings
INSERT INTO site_settings (key, value)
VALUES ('installment_fee_percent', '10')
ON CONFLICT (key) DO NOTHING;

-- RLS: installment_plans readable by service role; no public access needed
ALTER TABLE installment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE installment_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on installment_plans"
  ON installment_plans FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on installment_payments"
  ON installment_payments FOR ALL
  USING (true)
  WITH CHECK (true);
