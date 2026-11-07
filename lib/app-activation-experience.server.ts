import 'server-only'
import { activationRuntimeConfigured, configuredAppOrigins } from './app-activation-repository.server'
import { activationExperiences, adultConsent } from './app-activation-experience'

export function activationPageConfig(appKey: string) {
  const app = activationExperiences[appKey]
  if (!app) return null
  const origins = configuredAppOrigins()[appKey] || []
  const intakeEnabled = activationRuntimeConfigured() && origins.length > 0 && process.env.APP_ACTIVATION_CONSENT_VERSION === adultConsent.version
  let returnUrl: string | null = null
  try {
    const configured = JSON.parse(process.env.APP_ACTIVATION_APP_RETURN_URLS || '{}') as Record<string, unknown>
    const candidate = configured[appKey]
    if (typeof candidate === 'string') {
      const url = new URL(candidate)
      if (url.protocol === 'https:' && origins.includes(url.origin) && !url.username && !url.password && !url.hash) returnUrl = url.toString()
    }
  } catch { /* Missing or invalid return configuration keeps handoff closed. */ }
  let hasAppSecret = false
  try {
    const secrets = JSON.parse(process.env.APP_ACTIVATION_APP_SECRETS || '{}') as Record<string, unknown>
    hasAppSecret = typeof secrets[appKey] === 'string' && secrets[appKey].length >= 32
  } catch { /* Missing secret keeps handoff closed. */ }
  return { app, intakeEnabled, redemptionEnabled: intakeEnabled, handoffEnabled: intakeEnabled && process.env.APP_ACTIVATION_HANDOFF_ENABLED === 'true' && !!returnUrl && hasAppSecret, returnUrl }
}
