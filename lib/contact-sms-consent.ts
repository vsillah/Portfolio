import { WEBSITE_BRAND_NAME, WEBSITE_COMPANY_NAME } from './website-brand'

// v1 evidence stays immutable; old browser submissions must review the v2 company naming.
export const SMS_DISCLOSURE_VERSION = 'amadutown-sms-2026-09-09-v2'
export const SMS_PROGRAM = WEBSITE_COMPANY_NAME
export const SMS_SCOPE = 'low-volume marketing and customer-care: business/technology consulting and AI automation'
export const SMS_DISCLOSURE = `I agree to receive marketing and customer-care texts from ${WEBSITE_COMPANY_NAME} about consulting and AI automation services, including automated messages, at the number I provide. Message frequency varies. Message and data rates may apply. Consent is not a condition of purchase. Reply STOP to opt out or HELP for help. ${WEBSITE_BRAND_NAME} will not sell or share mobile information for third-party marketing or promotions.`
export const SMS_PHONE_ERROR = 'Enter a valid mobile number with country code (for example, +1 202 555 0123), or leave SMS consent unchecked.'

// Format validation only: this cannot establish mobile service or phone ownership.
export function normalizeSmsPhone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 40 || !/^[+\d\s().-]+$/.test(value)) return null
  const compact = value.trim().replace(/[\s().-]/g, '')
  const normalized = /^\d{10}$/.test(compact) ? `+1${compact}` : /^1\d{10}$/.test(compact) ? `+${compact}` : compact
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return null
  if (normalized.startsWith('+1') && !/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(normalized)) return null
  return normalized
}
