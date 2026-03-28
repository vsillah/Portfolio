-- Phase 2a: Add carousel support columns to social_content_queue
-- Supports multi-slide LinkedIn carousels alongside existing single-image posts.

ALTER TABLE public.social_content_queue
  ADD COLUMN IF NOT EXISTS content_format TEXT NOT NULL DEFAULT 'single_image'
    CHECK (content_format IN ('single_image', 'carousel')),
  ADD COLUMN IF NOT EXISTS content_pillar TEXT,
  ADD COLUMN IF NOT EXISTS companion_post_text TEXT,
  ADD COLUMN IF NOT EXISTS carousel_slides JSONB,
  ADD COLUMN IF NOT EXISTS carousel_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS carousel_slide_urls TEXT[];

COMMENT ON COLUMN public.social_content_queue.content_format IS 'single_image (default, backward compat) or carousel';
COMMENT ON COLUMN public.social_content_queue.content_pillar IS 'Which of Vambah''s 6 content pillars (ai_product_management, corporate_navigation, etc.)';
COMMENT ON COLUMN public.social_content_queue.companion_post_text IS 'Shorter 800-1200 char post text for carousel companion posts';
COMMENT ON COLUMN public.social_content_queue.carousel_slides IS 'Structured JSON array of slide objects (cover, hook, principle, quote, cta)';
COMMENT ON COLUMN public.social_content_queue.carousel_pdf_url IS 'URL to the rendered carousel PDF in Supabase Storage';
COMMENT ON COLUMN public.social_content_queue.carousel_slide_urls IS 'Array of individual slide PNG URLs in Supabase Storage';
