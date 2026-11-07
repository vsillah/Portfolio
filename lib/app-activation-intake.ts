export type AdultInterestForm = {
  appKey: string
  adultEmail: string
  consentGranted: boolean
  adultConfirmed: boolean
  consentVersion: string
  idempotencyKey: string
  sourceReceipt: string
}

export async function submitAdultInterest(endpoint: string, form: AdultInterestForm): Promise<Response> {
  return fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
}

export function normalizeAdultEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null
}

export function isAdultInterestForm(value: unknown): value is AdultInterestForm {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const form = value as Record<string, unknown>
  return typeof form.appKey === 'string' && /^[a-z0-9][a-z0-9-]{1,62}$/.test(form.appKey)
    && typeof form.adultEmail === 'string' && !!normalizeAdultEmail(form.adultEmail)
    && form.consentGranted === true && form.adultConfirmed === true
    && typeof form.consentVersion === 'string' && form.consentVersion.length > 0 && form.consentVersion.length <= 80
    && typeof form.idempotencyKey === 'string' && /^[a-f0-9-]{36}$/.test(form.idempotencyKey)
    && typeof form.sourceReceipt === 'string' && /^[a-zA-Z0-9:_-]{8,120}$/.test(form.sourceReceipt)
}
