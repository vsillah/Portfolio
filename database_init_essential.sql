-- ============================================================================
-- User Profiles Table
-- Links Supabase auth.users to application user profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Profile info
  email TEXT,
  full_name TEXT,
  
  -- Role for authorization
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'support')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- Update trigger
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_profiles ON user_profiles;
CREATE TRIGGER trigger_update_user_profiles
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Grant table-level permissions (required for RLS policies to work)
GRANT ALL ON user_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;
GRANT SELECT ON user_profiles TO anon;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- NOTE: Do NOT add a "read all profiles" policy that queries user_profiles itself.
-- That causes infinite recursion (Postgres error 42P17). If admin-read-all is needed,
-- create a SECURITY DEFINER function instead.
-- The service_role key bypasses RLS entirely and can read all profiles.

-- Function to create user profile automatically on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'user' -- Default role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

COMMENT ON TABLE user_profiles IS 'User profiles with role-based access control';
COMMENT ON COLUMN user_profiles.role IS 'User role: user, admin, support';
-- Portfolio Projects Table
-- This is for showcase projects (different from client_projects which tracks actual client work)
CREATE TABLE IF NOT EXISTS projects (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  github TEXT, -- GitHub repository URL
  live TEXT, -- Live demo URL
  image TEXT, -- Project thumbnail/screenshot URL
  technologies TEXT[] DEFAULT '{}', -- Array of tech stack items
  display_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  file_path TEXT, -- For uploaded project files
  file_type TEXT,
  file_size INTEGER,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_published ON projects(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_projects_display_order ON projects(display_order);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Public can view published projects" ON projects;
CREATE POLICY "Public can view published projects"
  ON projects FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "Admins can manage projects" ON projects;
CREATE POLICY "Admins can manage projects"
  ON projects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_store_updated_at();
-- Videos Table
CREATE TABLE IF NOT EXISTS videos (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  duration INTEGER, -- in seconds
  display_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  file_path TEXT, -- for uploaded video files or documents
  file_type TEXT,
  file_size INTEGER,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Publications Table
CREATE TABLE IF NOT EXISTS publications (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  publication_url TEXT, -- external link
  author TEXT,
  publication_date DATE,
  publisher TEXT,
  display_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  file_path TEXT, -- for uploaded PDF/document files
  file_type TEXT,
  file_size INTEGER,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Music Table
CREATE TABLE IF NOT EXISTS music (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  description TEXT,
  spotify_url TEXT,
  apple_music_url TEXT,
  youtube_url TEXT,
  release_date DATE,
  genre TEXT,
  display_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  file_path TEXT, -- for uploaded audio files or album artwork
  file_type TEXT,
  file_size INTEGER,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Videos
CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_videos_display_order ON videos(display_order);
CREATE INDEX IF NOT EXISTS idx_videos_created_by ON videos(created_by);

-- Indexes for Publications
CREATE INDEX IF NOT EXISTS idx_publications_published ON publications(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_publications_display_order ON publications(display_order);
CREATE INDEX IF NOT EXISTS idx_publications_created_by ON publications(created_by);
CREATE INDEX IF NOT EXISTS idx_publications_date ON publications(publication_date DESC);

-- Indexes for Music
CREATE INDEX IF NOT EXISTS idx_music_published ON music(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_music_display_order ON music(display_order);
CREATE INDEX IF NOT EXISTS idx_music_created_by ON music(created_by);
CREATE INDEX IF NOT EXISTS idx_music_artist ON music(artist);
CREATE INDEX IF NOT EXISTS idx_music_release_date ON music(release_date DESC);

-- Enable RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE music ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Videos
DROP POLICY IF EXISTS "Public can view published videos" ON videos;
CREATE POLICY "Public can view published videos"
  ON videos FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "Admins can manage videos" ON videos;
CREATE POLICY "Admins can manage videos"
  ON videos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for Publications
DROP POLICY IF EXISTS "Public can view published publications" ON publications;
CREATE POLICY "Public can view published publications"
  ON publications FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "Admins can manage publications" ON publications;
CREATE POLICY "Admins can manage publications"
  ON publications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for Music
DROP POLICY IF EXISTS "Public can view published music" ON music;
CREATE POLICY "Public can view published music"
  ON music FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "Admins can manage music" ON music;
CREATE POLICY "Admins can manage music"
  ON music FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
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
-- App Prototypes Table
-- Tracks app prototypes through their lifecycle from concept to production
CREATE TABLE IF NOT EXISTS app_prototypes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  purpose TEXT NOT NULL, -- Why this prototype exists
  production_stage TEXT NOT NULL CHECK (production_stage IN ('Concept', 'Development', 'Beta', 'Production', 'Archived')),
  channel TEXT NOT NULL CHECK (channel IN ('Web', 'Mobile', 'Desktop', 'API')),
  product_type TEXT NOT NULL CHECK (product_type IN ('SaaS', 'Tool', 'Game', 'Utility', 'Other')),
  thumbnail_url TEXT,
  download_url TEXT,
  app_repo_url TEXT,
  deployment_platform TEXT,
  analytics_source TEXT,
  analytics_project_id TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prototype Demos (screenshots, videos, live demos)
CREATE TABLE IF NOT EXISTS prototype_demos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID NOT NULL REFERENCES app_prototypes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  demo_type TEXT NOT NULL CHECK (demo_type IN ('video', 'screenshot', 'live_demo')),
  demo_url TEXT NOT NULL,
  thumbnail_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prototype Stage History (track stage changes)
CREATE TABLE IF NOT EXISTS prototype_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID NOT NULL REFERENCES app_prototypes(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_by UUID REFERENCES user_profiles(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Prototype Enrollments (users can sign up for beta testing)
CREATE TABLE IF NOT EXISTS prototype_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID NOT NULL REFERENCES app_prototypes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  enrollment_type TEXT NOT NULL CHECK (enrollment_type IN ('beta', 'early_access')),
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(prototype_id, user_id)
);

-- Prototype Feedback
CREATE TABLE IF NOT EXISTS prototype_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID NOT NULL REFERENCES app_prototypes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prototype Analytics
CREATE TABLE IF NOT EXISTS prototype_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID NOT NULL REFERENCES app_prototypes(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('active-users', 'pageviews', 'downloads')),
  metric_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(prototype_id, metric_date, metric_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_app_prototypes_stage ON app_prototypes(production_stage);
CREATE INDEX IF NOT EXISTS idx_app_prototypes_channel ON app_prototypes(channel);
CREATE INDEX IF NOT EXISTS idx_app_prototypes_type ON app_prototypes(product_type);
CREATE INDEX IF NOT EXISTS idx_prototype_demos_prototype ON prototype_demos(prototype_id);
CREATE INDEX IF NOT EXISTS idx_prototype_demos_primary ON prototype_demos(is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_prototype_stage_history_prototype ON prototype_stage_history(prototype_id);
CREATE INDEX IF NOT EXISTS idx_prototype_enrollments_prototype ON prototype_enrollments(prototype_id);
CREATE INDEX IF NOT EXISTS idx_prototype_enrollments_user ON prototype_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_prototype_feedback_prototype ON prototype_feedback(prototype_id);
CREATE INDEX IF NOT EXISTS idx_prototype_analytics_prototype ON prototype_analytics(prototype_id);

-- Enable RLS
ALTER TABLE app_prototypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototype_demos ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototype_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototype_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototype_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototype_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for app_prototypes
DROP POLICY IF EXISTS "Public can view prototypes" ON app_prototypes;
CREATE POLICY "Public can view prototypes"
  ON app_prototypes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage prototypes" ON app_prototypes;
CREATE POLICY "Admins can manage prototypes"
  ON app_prototypes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for prototype_demos
DROP POLICY IF EXISTS "Public can view demos" ON prototype_demos;
CREATE POLICY "Public can view demos"
  ON prototype_demos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage demos" ON prototype_demos;
CREATE POLICY "Admins can manage demos"
  ON prototype_demos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for prototype_stage_history
DROP POLICY IF EXISTS "Public can view stage history" ON prototype_stage_history;
CREATE POLICY "Public can view stage history"
  ON prototype_stage_history FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage stage history" ON prototype_stage_history;
CREATE POLICY "Admins can manage stage history"
  ON prototype_stage_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for prototype_enrollments
DROP POLICY IF EXISTS "Users can view their enrollments" ON prototype_enrollments;
CREATE POLICY "Users can view their enrollments"
  ON prototype_enrollments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can enroll themselves" ON prototype_enrollments;
CREATE POLICY "Users can enroll themselves"
  ON prototype_enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all enrollments" ON prototype_enrollments;
CREATE POLICY "Admins can view all enrollments"
  ON prototype_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for prototype_feedback
DROP POLICY IF EXISTS "Public can view feedback" ON prototype_feedback;
CREATE POLICY "Public can view feedback"
  ON prototype_feedback FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can submit feedback" ON prototype_feedback;
CREATE POLICY "Users can submit feedback"
  ON prototype_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Admins can manage feedback" ON prototype_feedback;
CREATE POLICY "Admins can manage feedback"
  ON prototype_feedback FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for prototype_analytics
DROP POLICY IF EXISTS "Public can view analytics" ON prototype_analytics;
CREATE POLICY "Public can view analytics"
  ON prototype_analytics FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage analytics" ON prototype_analytics;
CREATE POLICY "Admins can manage analytics"
  ON prototype_analytics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to track stage changes
CREATE OR REPLACE FUNCTION track_prototype_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.production_stage != NEW.production_stage) THEN
    INSERT INTO prototype_stage_history (prototype_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, OLD.production_stage, NEW.production_stage, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to track stage changes
DROP TRIGGER IF EXISTS app_prototypes_stage_change ON app_prototypes;
CREATE TRIGGER app_prototypes_stage_change
  AFTER UPDATE ON app_prototypes
  FOR EACH ROW
  EXECUTE FUNCTION track_prototype_stage_change();

-- Trigger for updated_at
DROP TRIGGER IF EXISTS app_prototypes_updated_at ON app_prototypes;
CREATE TRIGGER app_prototypes_updated_at
  BEFORE UPDATE ON app_prototypes
  FOR EACH ROW
  EXECUTE FUNCTION update_store_updated_at();
-- Product Links Migration
-- Links products to their source content (music, publications, prototypes)
-- Run this SQL in Supabase SQL Editor

-- Add optional foreign key columns to products table
-- These allow linking a store product to its portfolio showcase item

-- Link to music entries (for downloadable tracks, albums)
ALTER TABLE products ADD COLUMN IF NOT EXISTS music_id BIGINT REFERENCES music(id) ON DELETE SET NULL;

-- Link to publications (for e-books, PDFs)
ALTER TABLE products ADD COLUMN IF NOT EXISTS publication_id BIGINT REFERENCES publications(id) ON DELETE SET NULL;

-- Link to app prototypes (for paid app licenses)
ALTER TABLE products ADD COLUMN IF NOT EXISTS prototype_id UUID REFERENCES app_prototypes(id) ON DELETE SET NULL;

-- Create indexes for efficient lookups (partial indexes for non-null values)
CREATE INDEX IF NOT EXISTS idx_products_music_id ON products(music_id) WHERE music_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_publication_id ON products(publication_id) WHERE publication_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_prototype_id ON products(prototype_id) WHERE prototype_id IS NOT NULL;

-- Unique constraints to ensure one-to-one relationship (optional, remove if many-to-one is desired)
-- Uncomment these if you want to ensure each content item can only have one linked product:
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_products_music_unique ON products(music_id) WHERE music_id IS NOT NULL;
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_products_publication_unique ON products(publication_id) WHERE publication_id IS NOT NULL;
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_products_prototype_unique ON products(prototype_id) WHERE prototype_id IS NOT NULL;

-- Add helpful comments
COMMENT ON COLUMN products.music_id IS 'Optional link to a music entry - shows purchase badge on music card';
COMMENT ON COLUMN products.publication_id IS 'Optional link to a publication - shows purchase badge on publication card';
COMMENT ON COLUMN products.prototype_id IS 'Optional link to an app prototype - shows purchase badge on prototype card';
-- Analytics Events Table
-- Tracks user interactions and page views
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'click', 'download', 'purchase', 'signup', 'custom')),
  event_name TEXT NOT NULL,
  event_data JSONB,
  page_path TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_page ON analytics_events(page_path);

-- Enable RLS
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can insert analytics events" ON analytics_events;
CREATE POLICY "Anyone can insert analytics events"
  ON analytics_events FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all analytics" ON analytics_events;
CREATE POLICY "Admins can view all analytics"
  ON analytics_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
