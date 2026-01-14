-- Lead Funnel Product Store - Database Schema
-- Run this SQL in Supabase SQL Editor

-- Products table - Store all lead magnets/products
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('ebook', 'training', 'calculator', 'music', 'app', 'merchandise')),
  price DECIMAL(10, 2), -- NULL for free items
  file_path TEXT, -- Path to file in Supabase Storage
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discount codes - Discount code management (must be created before orders)
CREATE TABLE IF NOT EXISTS discount_codes (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL,
  applicable_product_ids BIGINT[], -- NULL or empty array = all products
  max_uses INTEGER, -- NULL = unlimited
  used_count INTEGER DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES user_profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cart items - Session-based shopping cart
CREATE TABLE IF NOT EXISTS cart_items (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_id TEXT, -- For guest users
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure one cart item per user/session + product combination
  UNIQUE(user_id, product_id),
  UNIQUE(session_id, product_id)
);

-- Orders - Purchase records
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL, -- NULL for guest orders
  guest_email TEXT, -- For guest orders
  guest_name TEXT, -- For guest orders
  total_amount DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  final_amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  stripe_payment_intent_id TEXT, -- For paid orders
  discount_code_id BIGINT REFERENCES discount_codes(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order items - Items in each order
CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_at_purchase DECIMAL(10, 2) NOT NULL, -- Price at time of purchase
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User discount codes - Track which users have used which codes
CREATE TABLE IF NOT EXISTS user_discount_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  discount_code_id BIGINT NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Prevent duplicate usage per user
  UNIQUE(user_id, discount_code_id)
);

-- Downloads - Track product downloads
CREATE TABLE IF NOT EXISTS downloads (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT
);

-- Social shares - Track social media shares
CREATE TABLE IF NOT EXISTS social_shares (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'facebook', 'linkedin', 'other')),
  shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  discount_earned DECIMAL(10, 2) DEFAULT 0,
  share_url TEXT
);

-- Referrals - Referral tracking
CREATE TABLE IF NOT EXISTS referrals (
  id BIGSERIAL PRIMARY KEY,
  referrer_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  referred_email TEXT NOT NULL,
  referral_code TEXT NOT NULL,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  discount_applied DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_session ON cart_items(session_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_guest_email ON orders(guest_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_discount_codes_user ON user_discount_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_downloads_user ON downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_downloads_order ON downloads(order_id);
CREATE INDEX IF NOT EXISTS idx_social_shares_user ON social_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_social_shares_order ON social_shares(order_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_email ON referrals(referred_email);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products
DROP POLICY IF EXISTS "Public can view active products" ON products;
CREATE POLICY "Public can view active products"
  ON products FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage products" ON products;
CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for cart_items
DROP POLICY IF EXISTS "Users can manage their own cart" ON cart_items;
CREATE POLICY "Users can manage their own cart"
  ON cart_items FOR ALL
  USING (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR
    (session_id IS NOT NULL AND session_id = current_setting('app.session_id', true))
  );

-- RLS Policies for orders
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR
    (guest_email IS NOT NULL AND guest_email = current_setting('app.guest_email', true))
  );

DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
CREATE POLICY "Users can create their own orders"
  ON orders FOR INSERT
  WITH CHECK (
    (user_id IS NULL OR auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for order_items
DROP POLICY IF EXISTS "Users can view their order items" ON order_items;
CREATE POLICY "Users can view their order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id AND (
        (orders.user_id IS NOT NULL AND orders.user_id = auth.uid()) OR
        (orders.guest_email IS NOT NULL AND orders.guest_email = current_setting('app.guest_email', true))
      )
    )
  );

DROP POLICY IF EXISTS "System can create order items" ON order_items;
CREATE POLICY "System can create order items"
  ON order_items FOR INSERT
  WITH CHECK (true); -- Order creation happens server-side

DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
CREATE POLICY "Admins can view all order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for discount_codes
DROP POLICY IF EXISTS "Public can view active discount codes" ON discount_codes;
CREATE POLICY "Public can view active discount codes"
  ON discount_codes FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage discount codes" ON discount_codes;
CREATE POLICY "Admins can manage discount codes"
  ON discount_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for user_discount_codes
DROP POLICY IF EXISTS "Users can view their discount code usage" ON user_discount_codes;
CREATE POLICY "Users can view their discount code usage"
  ON user_discount_codes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their discount code usage" ON user_discount_codes;
CREATE POLICY "Users can insert their discount code usage"
  ON user_discount_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all discount code usage" ON user_discount_codes;
CREATE POLICY "Admins can view all discount code usage"
  ON user_discount_codes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for downloads
DROP POLICY IF EXISTS "Users can view their downloads" ON downloads;
CREATE POLICY "Users can view their downloads"
  ON downloads FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their downloads" ON downloads;
CREATE POLICY "Users can insert their downloads"
  ON downloads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all downloads" ON downloads;
CREATE POLICY "Admins can view all downloads"
  ON downloads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for social_shares
DROP POLICY IF EXISTS "Users can view their social shares" ON social_shares;
CREATE POLICY "Users can view their social shares"
  ON social_shares FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their social shares" ON social_shares;
CREATE POLICY "Users can insert their social shares"
  ON social_shares FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all social shares" ON social_shares;
CREATE POLICY "Admins can view all social shares"
  ON social_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for referrals
DROP POLICY IF EXISTS "Users can view their referrals" ON referrals;
CREATE POLICY "Users can view their referrals"
  ON referrals FOR SELECT
  USING (auth.uid() = referrer_user_id);

DROP POLICY IF EXISTS "Users can insert their referrals" ON referrals;
CREATE POLICY "Users can insert their referrals"
  ON referrals FOR INSERT
  WITH CHECK (auth.uid() = referrer_user_id);

DROP POLICY IF EXISTS "Admins can view all referrals" ON referrals;
CREATE POLICY "Admins can view all referrals"
  ON referrals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_store_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_store_updated_at();

DROP TRIGGER IF EXISTS cart_items_updated_at ON cart_items;
CREATE TRIGGER cart_items_updated_at
  BEFORE UPDATE ON cart_items
  FOR EACH ROW
  EXECUTE FUNCTION update_store_updated_at();

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_store_updated_at();

DROP TRIGGER IF EXISTS discount_codes_updated_at ON discount_codes;
CREATE TRIGGER discount_codes_updated_at
  BEFORE UPDATE ON discount_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_store_updated_at();

-- Function to increment discount code usage
CREATE OR REPLACE FUNCTION increment_discount_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE discount_codes
  SET used_count = used_count + 1
  WHERE id = NEW.discount_code_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to increment discount usage
DROP TRIGGER IF EXISTS user_discount_codes_increment_usage ON user_discount_codes;
CREATE TRIGGER user_discount_codes_increment_usage
  AFTER INSERT ON user_discount_codes
  FOR EACH ROW
  EXECUTE FUNCTION increment_discount_usage();
