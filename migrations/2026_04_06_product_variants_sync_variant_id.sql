-- Add printful_sync_variant_id to product_variants
-- This stores the Printful store sync variant ID (includes print files),
-- as opposed to printful_variant_id which is the catalog variant ID.
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS printful_sync_variant_id bigint;
