/**
 * BuiltWith tag / category -> our canonical category.
 *
 * Used by the feasibility engine to decide whether a client's detected
 * technology overlaps with one of our platform categories (match),
 * integrates with us (integrate), or represents a gap. Unknown tags are
 * passed through as-is and treated as informational.
 *
 * Keep the map narrow — ~30 entries covering the categories we actually
 * compare against in our-tech-stack. Adding an entry is a data change.
 */

import type { OurStackCategory } from './our-tech-stack'

export const BUILTWITH_TAG_MAP: Record<string, OurStackCategory> = {
  // Analytics
  Analytics: 'analytics',
  'Analytics and Tracking': 'analytics',
  'Tag Management': 'analytics',

  // CMS
  CMS: 'cms',
  Blog: 'cms',
  'Content Management': 'cms',

  // Ecommerce
  Ecommerce: 'ecommerce',
  Shop: 'ecommerce',
  'Shopping Cart': 'ecommerce',

  // Payments
  Payment: 'payments',
  Payments: 'payments',
  'Payment Processors': 'payments',

  // Email / marketing
  'Email Hosting Providers': 'email',
  Email: 'email',
  'Marketing Automation': 'marketing',
  Newsletter: 'email',

  // CRM
  CRM: 'crm',
  'Customer Relationship Management': 'crm',

  // Hosting / CDN
  Hosting: 'hosting',
  CDN: 'hosting',
  'Platform as a Service': 'hosting',
  'Content Delivery Network': 'hosting',

  // Frameworks
  Frameworks: 'framework',
  'JavaScript Frameworks': 'framework',
  'Web Frameworks': 'framework',

  // Database
  Databases: 'database',

  // Auth
  Auth: 'auth',
  Authentication: 'auth',
  SSO: 'auth',

  // Automation / integration
  'Workflow Automation': 'automation',
  Automation: 'automation',
  'Integration Platform': 'automation',

  // AI / voice / video
  AI: 'ai',
  LLM: 'ai',
  'Machine Learning': 'ai',
  Voice: 'voice',
  'Voice AI': 'voice',
  Video: 'video',
  'Video Hosting': 'video',
}

/**
 * Normalize a BuiltWith tag/category string to our canonical category.
 * Returns null when no mapping exists (caller should treat as unknown).
 */
export function normalizeBuiltWithTag(rawTag?: string | null): OurStackCategory | null {
  if (!rawTag || typeof rawTag !== 'string') return null
  const trimmed = rawTag.trim()
  if (!trimmed) return null
  return BUILTWITH_TAG_MAP[trimmed] ?? null
}
