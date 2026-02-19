/**
 * Resource funnel stages for lead magnets (client-facing).
 * Single source of truth: used in migration CHECK, API, Resources page filter, admin.
 * Clients see display labels; never "Gate Keepers" or "Deal Closers."
 */

export const LEAD_MAGNET_FUNNEL_STAGES = [
  'attention_capture',
  'scheduling_show_rate',
  'sales_call_process',
  'close_onboarding',
  'delivery_results',
  'flywheel_reinvestment',
] as const

export type LeadMagnetFunnelStage = (typeof LEAD_MAGNET_FUNNEL_STAGES)[number]

export const FUNNEL_STAGE_LABELS: Record<LeadMagnetFunnelStage, string> = {
  attention_capture: 'Attention & Capture',
  scheduling_show_rate: 'Scheduling & Show Rate',
  sales_call_process: 'Sales Call Process',
  close_onboarding: 'Close & Onboarding',
  delivery_results: 'Delivery & Results',
  flywheel_reinvestment: 'Flywheel & Reinvestment',
}

/** Ordered list for display/filter (same order as LEAD_MAGNET_FUNNEL_STAGES) */
export const FUNNEL_STAGE_OPTIONS: { value: LeadMagnetFunnelStage; label: string }[] =
  LEAD_MAGNET_FUNNEL_STAGES.map((value) => ({
    value,
    label: FUNNEL_STAGE_LABELS[value],
  }))

export function getFunnelStageLabel(stage: string | null | undefined): string {
  if (!stage) return ''
  return FUNNEL_STAGE_LABELS[stage as LeadMagnetFunnelStage] ?? stage
}

export function isValidFunnelStage(value: string): value is LeadMagnetFunnelStage {
  return LEAD_MAGNET_FUNNEL_STAGES.includes(value as LeadMagnetFunnelStage)
}
