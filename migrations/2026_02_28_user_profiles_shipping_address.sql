-- Add shipping_address to user_profiles for saving and prefilling on future orders.
-- Same shape as order shipping_address: address1, address2, city, state_code, zip, country_code, phone.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'shipping_address'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN shipping_address JSONB;
  END IF;
END $$;

COMMENT ON COLUMN user_profiles.shipping_address IS 'Default shipping address for merchandise orders; prefilled at checkout.';
