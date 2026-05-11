-- Register the AI risk and compliance intelligence agent.
-- Keeps the routing key stable while adding a user-facing African royal identity.

INSERT INTO agent_registry (
  key,
  name,
  runtime,
  pod,
  description,
  risk_level,
  default_requires_approval,
  active,
  updated_at
)
VALUES (
  'risk-compliance-intelligence',
  'Moremi (Ife) - Risk & Compliance',
  'codex',
  'Research & Knowledge',
  'Monitors AI agent, AI ethics, security, privacy, and regulatory signals, maps them to Portfolio exposure, and opens upgrade requests when gaps appear.',
  'high',
  true,
  true,
  now()
)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  runtime = EXCLUDED.runtime,
  pod = EXCLUDED.pod,
  description = EXCLUDED.description,
  risk_level = EXCLUDED.risk_level,
  default_requires_approval = EXCLUDED.default_requires_approval,
  active = EXCLUDED.active,
  updated_at = now();
