/**
 * Effective n8n mock / outbound flags.
 *
 * Explicit env always wins (true/false/0/1/yes/no).
 * When unset, **staging** and **production** default to real n8n (both off).
 * **development** keeps legacy behavior: unset means "not mocked" / "not disabled"
 * (same as reading process.env === 'true' only).
 *
 * Set `NEXT_PUBLIC_APP_ENV=staging` on your staging deploy so you can omit
 * `MOCK_N8N` and `N8N_DISABLE_OUTBOUND` from Vercel env.
 */

export type AppDeploymentTier = 'development' | 'staging' | 'production'

/**
 * Deployment tier for integration defaults.
 * Prefer `NEXT_PUBLIC_APP_ENV`; fall back to `VERCEL_ENV=production` for prod-shaped deploys.
 */
export function getAppDeploymentTier(): AppDeploymentTier {
  const raw = process.env.NEXT_PUBLIC_APP_ENV?.toLowerCase().trim()
  if (raw === 'staging') return 'staging'
  if (raw === 'production') return 'production'
  if (raw === 'development') return 'development'
  if (process.env.VERCEL_ENV === 'production') return 'production'
  return 'development'
}

/** undefined = env not set → caller applies tier default */
function parseEnvBool(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === '') return undefined
  const v = raw.toLowerCase().trim()
  if (v === 'true' || v === '1' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'no') return false
  return undefined
}

function defaultMockN8n(tier: AppDeploymentTier): boolean {
  if (tier === 'staging' || tier === 'production') return false
  return false
}

function defaultDisableOutbound(tier: AppDeploymentTier): boolean {
  if (tier === 'staging' || tier === 'production') return false
  return false
}

/**
 * Mock chat/diagnostic responses (no n8n fetch for those paths when true).
 */
export function isMockN8nEnabled(): boolean {
  const override = parseEnvBool(process.env.MOCK_N8N)
  if (override !== undefined) return override
  return defaultMockN8n(getAppDeploymentTier())
}

/**
 * Suppress all outbound n8n webhook fetches when true.
 */
export function isN8nOutboundDisabled(): boolean {
  const override = parseEnvBool(process.env.N8N_DISABLE_OUTBOUND)
  if (override !== undefined) return override
  return defaultDisableOutbound(getAppDeploymentTier())
}

/** For logs / admin diagnostics */
export function describeN8nRuntimeFlags(): {
  tier: AppDeploymentTier
  mockN8n: { effective: boolean; source: 'env' | 'default' }
  disableOutbound: { effective: boolean; source: 'env' | 'default' }
} {
  const tier = getAppDeploymentTier()
  const mockOverride = parseEnvBool(process.env.MOCK_N8N)
  const outOverride = parseEnvBool(process.env.N8N_DISABLE_OUTBOUND)
  return {
    tier,
    mockN8n: {
      effective: isMockN8nEnabled(),
      source: mockOverride !== undefined ? 'env' : 'default',
    },
    disableOutbound: {
      effective: isN8nOutboundDisabled(),
      source: outOverride !== undefined ? 'env' : 'default',
    },
  }
}
