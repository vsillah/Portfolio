import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Calendly URL pattern: https://calendly.com/{username}/{event-type} */
const VALID_CALENDLY_URL = /^https:\/\/calendly\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/

export function isValidCalendlyUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.length > 0 && VALID_CALENDLY_URL.test(url.trim())
}

/**
 * Normalizes image URLs for display. Local paths (no protocol) are made root-relative
 * so they load from /public/ instead of relative to the current page.
 */
export function toAbsoluteImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return ''
  const t = url.trim()
  if (!t) return ''
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  if (t.startsWith('/')) return t
  return `/${t}`
}