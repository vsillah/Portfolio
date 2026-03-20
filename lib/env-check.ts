/**
 * Lightweight environment validation — logs warnings on startup.
 * Import from root layout or instrumentation.ts to run once.
 */

import {
  getAppDeploymentTier,
  isMockN8nEnabled,
  isN8nOutboundDisabled,
} from './n8n-runtime-flags'

const isDev = process.env.NEXT_PUBLIC_APP_ENV === 'development'
  || process.env.NODE_ENV === 'development'

const warnings: string[] = []

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  warnings.push('NEXT_PUBLIC_SUPABASE_URL is not set — Supabase will not work')
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  warnings.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set — Supabase will not work')
}

if (isDev && getAppDeploymentTier() === 'development') {
  const mockN8n = isMockN8nEnabled()
  const disableOutbound = isN8nOutboundDisabled()

  if (!mockN8n && !disableOutbound) {
    warnings.push(
      'Dev environment with MOCK_N8N=false and N8N_DISABLE_OUTBOUND=false — ' +
      'outbound n8n webhooks will fire against configured URLs. ' +
      'Set MOCK_N8N=true or N8N_DISABLE_OUTBOUND=true to prevent this.'
    )
  }

  if (!mockN8n && disableOutbound) {
    warnings.push(
      'N8N_DISABLE_OUTBOUND=true but MOCK_N8N=false — chat/diagnostic will return mock responses ' +
      '(via the outbound gate) but MOCK_N8N mock logic is not active. This is fine for most cases.'
    )
  }
}

if (warnings.length > 0) {
  console.warn(
    `\n[env-check] ${warnings.length} warning(s):\n` +
    warnings.map((w, i) => `  ${i + 1}. ${w}`).join('\n') +
    '\n'
  )
}

export const envCheckComplete = true
