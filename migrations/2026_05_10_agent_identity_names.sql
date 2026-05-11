-- Agent display identity update.
-- Technical keys remain stable for routes, traces, Slack commands, and n8n ownership.

INSERT INTO agent_registry (key, name, runtime, pod, active, updated_at)
VALUES
  ('chief-of-staff', 'Shaka (Zulu) - Chief of Staff', 'n8n', 'Chief of Staff', true, now()),
  ('strategic-narrative', 'Amina (Zazzau) - Strategic Narrative', 'codex', 'Strategy & Narrative', false, now()),
  ('proposal-business-model', 'Mansa Musa (Mali) - Proposal & Business Model', 'codex', 'Strategy & Narrative', false, now()),
  ('legacy-institution-builder', 'Sundiata Keita (Mali) - Legacy Institution Builder', 'codex', 'Strategy & Narrative', false, now()),
  ('research-source-register', 'Askia Muhammad (Songhai) - Research Source Register', 'n8n', 'Research & Knowledge', true, now()),
  ('private-knowledge-librarian', 'Hatshepsut (Kemet) - Private Knowledge Librarian', 'n8n', 'Research & Knowledge', true, now()),
  ('decision-journal', 'Nzinga (Ndongo/Matamba) - Decision Journal', 'manual', 'Research & Knowledge', false, now()),
  ('voice-content-architect', 'Nefertiti (Kemet) - Voice & Content Architect', 'n8n', 'Content Production', true, now()),
  ('content-repurposing', 'Hannibal (Carthage) - Content Repurposing', 'n8n', 'Content Production', true, now()),
  ('amadutown-brand', 'Taharqa (Kush) - AmaduTown Brand', 'codex', 'Content Production', false, now()),
  ('course-curriculum-builder', 'Menelik II (Ethiopia) - Course & Curriculum Builder', 'codex', 'Content Production', false, now()),
  ('engineering-copilot', 'Piye (Kush) - Engineering Copilot', 'codex', 'Product & Automation', true, now()),
  ('automation-systems', 'Yaa Asantewaa (Ashanti) - Automation Systems', 'n8n', 'Product & Automation', true, now()),
  ('agent-tooling-parity', 'Ezana (Aksum) - Agent Tooling Parity', 'codex', 'Product & Automation', false, now()),
  ('website-product-copy', 'Makeda (Sheba) - Website & Product Copy', 'manual', 'Publishing & Follow-Up', true, now()),
  ('inbox-follow-up', 'Samori Toure (Wassoulou) - Inbox & Follow-Up', 'n8n', 'Publishing & Follow-Up', true, now()),
  ('warm-lead-capture', 'Behanzin (Dahomey) - Warm Lead Capture', 'n8n', 'Publishing & Follow-Up', true, now()),
  ('meeting-intake-follow-up', 'Amanirenas (Kush) - Meeting Intake & Follow-Up', 'n8n', 'Publishing & Follow-Up', true, now())
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  runtime = EXCLUDED.runtime,
  pod = EXCLUDED.pod,
  active = EXCLUDED.active,
  updated_at = now();
