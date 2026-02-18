-- Add template product type and attachment columns for templatized offerings
-- Supports: asset_url (e.g. GitHub/repo link), instructions_file_path (install guide in storage)
-- Constraint name must be products_type_check; if your DB uses a different name, drop that instead.

-- 1. Extend products.type to include 'template'
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_type_check;

ALTER TABLE products
  ADD CONSTRAINT products_type_check
  CHECK (type IN ('ebook', 'training', 'calculator', 'music', 'app', 'merchandise', 'template'));

-- 2. Add optional columns for template products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS asset_url TEXT,
  ADD COLUMN IF NOT EXISTS instructions_file_path TEXT;

COMMENT ON COLUMN products.asset_url IS 'For type=template: link to repo, n8n JSON, or external asset';
COMMENT ON COLUMN products.instructions_file_path IS 'For type=template: path in Supabase Storage to install/setup guide (PDF or doc)';
