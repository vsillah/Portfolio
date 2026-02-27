-- Allow evaluation_categories.source = 'open_code' for categories created by promoting an open code directly (no axial generation).
-- Issue categories dropdown (for_annotation) will include both axial_code and open_code.

ALTER TABLE evaluation_categories
  DROP CONSTRAINT IF EXISTS evaluation_categories_source_check;

ALTER TABLE evaluation_categories
  ADD CONSTRAINT evaluation_categories_source_check
  CHECK (source IN ('manual', 'axial_code', 'open_code'));
