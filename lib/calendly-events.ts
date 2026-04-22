/**
 * Calendly event registry used by the Gamma `Let's Talk` CTA slide.
 *
 * One source of truth for:
 *  - the canonical set of event keys (stable identifiers used across API/UI/DB)
 *  - human-facing copy (label, duration, blurb) that renders on the slide
 *  - the env var that holds the booking URL for each event
 *  - the default mapping from `GammaReportType` → `CalendlyEventKey`
 *
 * See `.cursor/plans/calendly-per-report-type_d49ba7dc.plan.md` for the
 * confirmed funnel mapping:
 *   - prospect_overview, audit_summary, offer_presentation → Discovery Call
 *   - value_quantification, implementation_strategy         → Onboarding Call
 */

import type { GammaReportType } from './gamma-report-builder'

export type CalendlyEventKey =
  | 'discovery_call'
  | 'onboarding'
  | 'kickoff'
  | 'progress_checkin'
  | 'renewal_review'
  | 'delivery_review'

export interface CalendlyEventMeta {
  key: CalendlyEventKey
  /** Human label used on the slide CTA, e.g. "Discovery Call". */
  label: string
  /** Duration tag rendered under the CTA, e.g. "30 minutes". */
  duration: string
  /** One-liner that frames the meeting purpose on the slide. */
  blurb: string
  /** Env var holding the Calendly URL for this event. */
  envVar: string
}

export const CALENDLY_EVENT_KEYS: readonly CalendlyEventKey[] = [
  'discovery_call',
  'onboarding',
  'kickoff',
  'progress_checkin',
  'renewal_review',
  'delivery_review',
] as const

export const CALENDLY_EVENT_META: Record<CalendlyEventKey, CalendlyEventMeta> = {
  discovery_call: {
    key: 'discovery_call',
    label: 'Discovery Call',
    duration: '30 minutes',
    blurb: "No pitch — just your situation and what's worth trying.",
    envVar: 'NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL',
  },
  onboarding: {
    key: 'onboarding',
    label: 'Onboarding Call',
    duration: '45 minutes',
    blurb: 'Kick off the engagement — intake, credentials, tooling, and comms cadence.',
    envVar: 'CALENDLY_ONBOARDING_CALL_URL',
  },
  kickoff: {
    key: 'kickoff',
    label: 'Kick Off Meeting',
    duration: '60 minutes',
    blurb: 'Align scope, team intros, timeline, deliverables, and risks before Phase 1.',
    envVar: 'CALENDLY_KICKOFF_MEETING_URL',
  },
  progress_checkin: {
    key: 'progress_checkin',
    label: 'Progress Check-in',
    duration: '30 minutes',
    blurb: 'Walk through what shipped, what is blocked, and what we are adjusting.',
    envVar: 'CALENDLY_PROGRESS_CHECKIN_URL',
  },
  renewal_review: {
    key: 'renewal_review',
    label: 'Renewal Review',
    duration: '30 minutes',
    blurb: 'Review outcomes and decide on continuation, expansion, or a clean handoff.',
    envVar: 'CALENDLY_RENEWAL_REVIEW_URL',
  },
  delivery_review: {
    key: 'delivery_review',
    label: 'Delivery & Review',
    duration: '45 minutes',
    blurb: 'Walk through the delivered work, validate against scope, and confirm next steps.',
    envVar: 'CALENDLY_DELIVERY_REVIEW_URL',
  },
}

/**
 * Report-type → default event key map.
 *
 * Admin can override per-generation via a dropdown (see
 * `app/admin/reports/gamma/page.tsx`). Defaults reflect the confirmed funnel:
 *  - Pre-commit report types (prospect_overview, audit_summary,
 *    offer_presentation) → Discovery Call. The commit ask is embedded on the
 *    Discovery Call itself.
 *  - Post-commit report types (value_quantification,
 *    implementation_strategy) → Onboarding Call. Both decks are delivered
 *    after the prospect has signed and is ready to onboard.
 */
export const DEFAULT_CALENDLY_EVENT_FOR_REPORT_TYPE: Record<
  GammaReportType,
  CalendlyEventKey
> = {
  prospect_overview: 'discovery_call',
  audit_summary: 'discovery_call',
  offer_presentation: 'discovery_call',
  value_quantification: 'onboarding',
  implementation_strategy: 'onboarding',
}

export function defaultCalendlyEventForReportType(
  reportType: GammaReportType
): CalendlyEventKey {
  return DEFAULT_CALENDLY_EVENT_FOR_REPORT_TYPE[reportType] ?? 'discovery_call'
}

export function isCalendlyEventKey(value: unknown): value is CalendlyEventKey {
  return (
    typeof value === 'string' &&
    (CALENDLY_EVENT_KEYS as readonly string[]).includes(value)
  )
}

/**
 * Resolve the public URL for a Calendly event, with a multi-step fallback so
 * the `Let's Talk` slide always renders a working link:
 *
 *   1. `meta.envVar` (the event-specific URL)
 *   2. Discovery Call URL (`NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL`), then
 *      legacy `CALENDLY_DISCOVERY_LINK`
 *   3. `https://amadutown.com` as the last-resort marketing URL
 *
 * When a non-discovery event falls back to the discovery URL because its env
 * var is missing/empty, we `console.warn` once per resolution so the
 * admin-generated deck still renders but the gap is surfaced in logs.
 */
export function getCalendlyUrlForEvent(key: CalendlyEventKey): string {
  const meta = CALENDLY_EVENT_META[key]
  const specific = readEnv(meta.envVar)
  if (specific) return specific

  const discovery = readEnv('NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL') || readEnv('CALENDLY_DISCOVERY_LINK')

  if (key !== 'discovery_call') {
    const fallbackUrl = discovery || 'https://amadutown.com'
    console.warn(
      `[calendly-events] env var "${meta.envVar}" is not set for event "${key}"; ` +
        `falling back to ${discovery ? 'Discovery Call URL' : 'amadutown.com'}. ` +
        `Set ${meta.envVar} in .env.local and Vercel to route "${meta.label}" correctly.`
    )
    return fallbackUrl
  }

  return discovery || 'https://amadutown.com'
}

function readEnv(name: string): string | undefined {
  const v = process.env[name]
  if (typeof v !== 'string') return undefined
  const trimmed = v.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Convenience accessor used by the builder / admin UI to get both the meta
 * (label, duration, blurb) and the resolved URL in one call.
 */
export function resolveCalendlyEvent(key: CalendlyEventKey): CalendlyEventMeta & { url: string } {
  const meta = CALENDLY_EVENT_META[key]
  return { ...meta, url: getCalendlyUrlForEvent(key) }
}
