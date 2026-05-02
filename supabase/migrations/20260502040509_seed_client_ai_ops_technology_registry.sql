-- Seed the first AI Ops technology registry baseline.
--
-- These rows intentionally avoid claiming live pricing. Operators must refresh
-- pricing before attaching recommendations to a proposal.

WITH seed_options (
  vendor,
  product_name,
  category,
  best_fit,
  avoid_when,
  source_url,
  pricing_model,
  setup_complexity,
  integration_complexity,
  data_ownership_fit,
  monitoring_support,
  security_notes
) AS (
  VALUES
    ('Apple', 'Mac mini', 'hardware', 'Mac-first clients that need a compact always-on local AI Ops node.', 'Client requires Windows-only management tooling or rack-mounted server hardware.', 'https://www.apple.com/mac-mini/', 'one_time', 'low', 'low', 'local', 'medium', 'Client-owned hardware; pair with MDM, disk encryption, and remote access controls.'),
    ('Dell', 'OptiPlex Micro', 'hardware', 'PC-first clients that need a compact always-on Windows or Linux node.', 'Client needs GPU-heavy local inference or Mac-only workflows.', 'https://www.dell.com/en-us/shop/desktop-computers/sr/desktops/optiplex-desktops', 'one_time', 'low', 'low', 'local', 'medium', 'Client-owned hardware; pair with endpoint management, disk encryption, and remote access controls.'),
    ('1Password', 'Business', 'credential_vault', 'Client teams that need shared vaults, role-based access, and contractor handoff controls.', 'Client cannot approve per-user SaaS spend or requires fully self-hosted credential storage.', 'https://1password.com/business', 'per_user', 'low', 'medium', 'hybrid', 'high', 'Use client-owned workspace; AmaduTown access should be named, time-bound, and revocable.'),
    ('Bitwarden', 'Teams or Enterprise', 'credential_vault', 'Budget-sensitive teams that still need shared vaults and administrative controls.', 'Client requires the richer governance workflows of a higher-touch enterprise suite.', 'https://bitwarden.com/business/', 'per_user', 'low', 'medium', 'hybrid', 'high', 'Use client-owned organization; require named accounts and emergency access policy.'),
    ('Tailscale', 'Business VPN', 'access_networking', 'Fast private access to client-owned nodes without exposing services publicly.', 'Client policy requires an existing VPN, dedicated firewall appliance, or no mesh network.', 'https://tailscale.com/business-vpn', 'per_user', 'low', 'medium', 'hybrid', 'high', 'Use device approval, ACLs, and client-owned admin control.'),
    ('Cloudflare', 'Zero Trust', 'access_networking', 'Clients that need identity-aware access, browser isolation, DNS filtering, or policy controls.', 'Very small clients need the lowest-friction setup and have no Cloudflare footprint.', 'https://www.cloudflare.com/zero-trust/', 'per_user', 'medium', 'medium', 'hybrid', 'high', 'Use approval-based access policies and keep production service changes approval-gated.'),
    ('Jamf', 'Jamf Now', 'identity_mdm', 'Mac-first small teams that need lightweight device management.', 'Client fleet is primarily Windows or already managed through Microsoft 365.', 'https://www.jamf.com/products/jamf-now/', 'monthly', 'low', 'medium', 'hybrid', 'medium', 'Use client-owned Jamf tenant; require offboarding and lost-device procedures.'),
    ('Microsoft', 'Intune', 'identity_mdm', 'Microsoft 365 clients that need Windows, Mac, and mobile endpoint management.', 'Client does not use Microsoft identity or needs a lighter small-business setup.', 'https://www.microsoft.com/security/business/microsoft-intune', 'per_user', 'medium', 'medium', 'hybrid', 'high', 'Use client tenant and enforce conditional access with staged rollout.'),
    ('Ollama', 'Local model runtime', 'ai_runtime', 'Local-first prototype inference on client-owned hardware.', 'Client requires managed uptime SLAs, hosted model routing, or centralized enterprise controls.', 'https://ollama.com/', 'unknown', 'low', 'medium', 'local', 'medium', 'Keep model and prompt logs local; benchmark before using in production workflows.'),
    ('OpenAI', 'API Platform', 'ai_runtime', 'Managed model access when quality, tool calling, and latency matter more than local-only execution.', 'Client data policy forbids external model APIs or requires isolated self-hosted inference.', 'https://platform.openai.com/', 'usage_based', 'low', 'medium', 'cloud', 'high', 'Use client-owned API/account when possible; document data handling and approval boundaries.'),
    ('Supabase', 'Postgres and Vector', 'vector_database', 'Project data, task state, vector search, and admin dashboards that need fast spin-up.', 'Client requires all database services to run on-premises.', 'https://supabase.com/', 'monthly', 'medium', 'medium', 'hybrid', 'high', 'Use RLS, service-role isolation, backups, and client-owned project where feasible.'),
    ('n8n', 'Cloud', 'automation', 'Workflow automation that benefits from managed hosting and fast iteration.', 'Client policy requires all automation execution on local infrastructure.', 'https://n8n.io/cloud/', 'monthly', 'low', 'medium', 'cloud', 'high', 'Keep secrets in client-owned credentials; avoid silent production mutations.'),
    ('Sentry', 'Application Monitoring', 'monitoring', 'Application error tracking and performance monitoring for deployed client-facing tools.', 'Client cannot approve third-party telemetry or needs only local logs.', 'https://sentry.io/', 'monthly', 'low', 'medium', 'cloud', 'high', 'Scrub sensitive payloads; document retention and client access.'),
    ('Backblaze', 'B2 Cloud Storage', 'backup', 'Low-cost offsite backups for client-owned exports and artifacts.', 'Client requires backup storage only inside its physical premises.', 'https://www.backblaze.com/cloud-storage', 'usage_based', 'medium', 'medium', 'cloud', 'medium', 'Encrypt before upload when storing sensitive client data; client owns account and keys.')
)
INSERT INTO client_ai_ops_technology_options (
  vendor,
  product_name,
  category,
  best_fit,
  avoid_when,
  source_url,
  pricing_model,
  setup_complexity,
  integration_complexity,
  data_ownership_fit,
  monitoring_support,
  security_notes
)
SELECT
  vendor,
  product_name,
  category,
  best_fit,
  avoid_when,
  source_url,
  pricing_model,
  setup_complexity,
  integration_complexity,
  data_ownership_fit,
  monitoring_support,
  security_notes
FROM seed_options
ON CONFLICT (vendor, product_name) DO UPDATE SET
  category = EXCLUDED.category,
  best_fit = EXCLUDED.best_fit,
  avoid_when = EXCLUDED.avoid_when,
  source_url = EXCLUDED.source_url,
  pricing_model = EXCLUDED.pricing_model,
  setup_complexity = EXCLUDED.setup_complexity,
  integration_complexity = EXCLUDED.integration_complexity,
  data_ownership_fit = EXCLUDED.data_ownership_fit,
  monitoring_support = EXCLUDED.monitoring_support,
  security_notes = EXCLUDED.security_notes,
  active = true,
  updated_at = now();

WITH snapshot_seed (vendor, product_name, pricing_state, billing_period, notes) AS (
  VALUES
    ('Apple', 'Mac mini', 'needs_review', 'one_time', 'Initial registry seed. Refresh live pricing before proposal use.'),
    ('Dell', 'OptiPlex Micro', 'needs_review', 'one_time', 'Initial registry seed. Refresh live pricing before proposal use.'),
    ('1Password', 'Business', 'needs_review', 'monthly', 'Initial registry seed. Refresh live pricing before proposal use.'),
    ('Bitwarden', 'Teams or Enterprise', 'needs_review', 'monthly', 'Initial registry seed. Refresh live pricing before proposal use.'),
    ('Tailscale', 'Business VPN', 'needs_review', 'monthly', 'Initial registry seed. Refresh live pricing before proposal use.'),
    ('Cloudflare', 'Zero Trust', 'needs_review', 'monthly', 'Initial registry seed. Refresh live pricing before proposal use.'),
    ('Jamf', 'Jamf Now', 'needs_review', 'monthly', 'Initial registry seed. Refresh live pricing before proposal use.'),
    ('Microsoft', 'Intune', 'needs_review', 'monthly', 'Initial registry seed. Refresh live pricing before proposal use.'),
    ('Ollama', 'Local model runtime', 'needs_review', NULL, 'Initial registry seed. Validate runtime fit and hardware requirements before proposal use.'),
    ('OpenAI', 'API Platform', 'needs_review', 'usage_based', 'Initial registry seed. Refresh live pricing and data-handling assumptions before proposal use.'),
    ('Supabase', 'Postgres and Vector', 'needs_review', 'monthly', 'Initial registry seed. Refresh live pricing and plan limits before proposal use.'),
    ('n8n', 'Cloud', 'needs_review', 'monthly', 'Initial registry seed. Refresh live pricing and execution limits before proposal use.'),
    ('Sentry', 'Application Monitoring', 'needs_review', 'monthly', 'Initial registry seed. Refresh live pricing and telemetry limits before proposal use.'),
    ('Backblaze', 'B2 Cloud Storage', 'needs_review', 'usage_based', 'Initial registry seed. Refresh live pricing and storage assumptions before proposal use.')
)
INSERT INTO client_ai_ops_technology_price_snapshots (
  technology_option_id,
  pricing_state,
  amount_low,
  amount_high,
  currency,
  billing_period,
  source_url,
  notes
)
SELECT
  option.id,
  seed.pricing_state,
  NULL,
  NULL,
  'USD',
  seed.billing_period,
  option.source_url,
  seed.notes
FROM snapshot_seed seed
JOIN client_ai_ops_technology_options option
  ON option.vendor = seed.vendor
 AND option.product_name = seed.product_name
WHERE NOT EXISTS (
  SELECT 1
  FROM client_ai_ops_technology_price_snapshots existing
  WHERE existing.technology_option_id = option.id
    AND existing.notes = seed.notes
);
