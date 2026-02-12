-- Fix merchandise products missing is_print_on_demand flag
-- These products have type='merchandise' but is_print_on_demand=false,
-- which prevents the variant selector from appearing on the product detail page.

BEGIN;

-- Set is_print_on_demand = true for all merchandise products that are missing the flag
UPDATE products
SET is_print_on_demand = true,
    updated_at = NOW()
WHERE type = 'merchandise'
  AND (is_print_on_demand = false OR is_print_on_demand IS NULL);

COMMIT;

-- After running this migration, re-run the Printful sync to populate
-- the product_variants table for these products:
--   POST /api/merchandise/sync
-- This will fetch sizes, colors, and pricing from Printful.
