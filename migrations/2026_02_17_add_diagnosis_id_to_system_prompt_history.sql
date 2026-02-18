-- Tie prompt version history to the error diagnosis that applied the change (when applicable)
ALTER TABLE system_prompt_history
  ADD COLUMN IF NOT EXISTS diagnosis_id UUID REFERENCES error_diagnoses(id) ON DELETE SET NULL;

COMMENT ON COLUMN system_prompt_history.diagnosis_id IS 'When set, this version was created by applying an Error Diagnosis recommendation.';
