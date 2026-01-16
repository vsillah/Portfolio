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
