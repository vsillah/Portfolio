-- Seed data for Videos, Publications, and Music tables
-- Run this in Supabase SQL Editor to populate the content management tables

-- ===========================================
-- VIDEOS SEED DATA
-- ===========================================

-- Clear existing videos (optional - uncomment if you want to reset)
-- DELETE FROM videos;

-- Insert videos from the hardcoded data in components/Videos.tsx
INSERT INTO videos (title, description, video_url, thumbnail_url, display_order, is_published)
VALUES 
  (
    'Never Know Bar 4 Bar Breakdown, 1st Verse',
    'This is the Bar for Bar Breakdown of "Never Know", the first single release from "Into the Rabbit Hole" album by Mad Hadda',
    'https://www.youtube.com/watch?v=ps5WbgLk4mI',
    'https://img.youtube.com/vi/ps5WbgLk4mI/hqdefault.jpg',
    1,
    true
  ),
  (
    'Never Know Bar 4 Bar Breakdown, 2nd Verse',
    'This is the Bar for Bar Breakdown of "Never Know", the first single release from "Into the Rabbit Hole" album by Mad Hadda',
    'https://www.youtube.com/watch?v=VltoBXKskOE',
    'https://img.youtube.com/vi/VltoBXKskOE/hqdefault.jpg',
    2,
    true
  ),
  (
    'Shoulders of Giants short video',
    'This is the short video of "Shoulders of Giants", the second single release from "Into the Rabbit Hole" album by Mad Hadda',
    'https://www.youtube.com/watch?v=V4phmDS8Bik',
    'https://img.youtube.com/vi/V4phmDS8Bik/hqdefault.jpg',
    3,
    true
  )
ON CONFLICT DO NOTHING;

-- ===========================================
-- PUBLICATIONS SEED DATA
-- ===========================================

-- Clear existing publications (optional - uncomment if you want to reset)
-- DELETE FROM publications;

-- Insert publications from the hardcoded data in components/Publications.tsx
INSERT INTO publications (title, description, publication_url, publisher, file_path, display_order, is_published)
VALUES 
  (
    'The Equity Code',
    'Check out my published work on Amazon',
    'https://a.co/d/bVCvCyT',
    'Amazon',
    '/The_Equity_Code_Cover.png',
    1,
    true
  )
ON CONFLICT DO NOTHING;

-- ===========================================
-- MUSIC SEED DATA (if needed)
-- ===========================================

-- Insert music entries for "Into the Rabbit Hole" album
INSERT INTO music (title, artist, album, description, spotify_url, release_date, genre, display_order, is_published)
VALUES 
  (
    'Into the Rabbit Hole',
    'Mad Hadda',
    'Into the Rabbit Hole',
    'The debut album featuring introspective lyrics and innovative production. A journey through the creative mind.',
    NULL,
    '2024-01-01',
    'Hip-Hop',
    1,
    true
  ),
  (
    'Never Know',
    'Mad Hadda',
    'Into the Rabbit Hole',
    'The first single release from "Into the Rabbit Hole" - a contemplative track about uncertainty and self-discovery.',
    NULL,
    '2024-01-01',
    'Hip-Hop',
    2,
    true
  ),
  (
    'Shoulders of Giants',
    'Mad Hadda',
    'Into the Rabbit Hole',
    'The second single release paying homage to those who came before and paved the way.',
    NULL,
    '2024-01-01',
    'Hip-Hop',
    3,
    true
  )
ON CONFLICT DO NOTHING;

-- ===========================================
-- VERIFICATION QUERIES
-- ===========================================

-- Check the inserted data
-- SELECT * FROM videos ORDER BY display_order;
-- SELECT * FROM publications ORDER BY display_order;
-- SELECT * FROM music ORDER BY display_order;
