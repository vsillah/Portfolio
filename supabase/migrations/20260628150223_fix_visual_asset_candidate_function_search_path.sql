-- Lock the search path for the visual asset candidate trigger function.
-- This is a no-op for fresh databases where the original migration already
-- creates the function with a fixed search path, and repairs databases that
-- applied the first version of the migration during PR validation.
ALTER FUNCTION public.set_visual_asset_candidates_updated_at() SET search_path = public;
