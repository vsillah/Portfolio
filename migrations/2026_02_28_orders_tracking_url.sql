-- Add tracking_url to orders for clickable tracking links (Printful shipments provide this)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'tracking_url'
  ) THEN
    ALTER TABLE orders ADD COLUMN tracking_url TEXT;
  END IF;
END $$;
