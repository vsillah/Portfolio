/**
 * Canonical product types and labels. Use everywhere (API validation, admin UI, migrations).
 */

export const PRODUCT_TYPES = [
  'ebook',
  'training',
  'calculator',
  'music',
  'app',
  'merchandise',
  'template',
] as const

export type ProductType = (typeof PRODUCT_TYPES)[number]

/** Display labels for admin UI and filters. */
export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  ebook: 'E-Book',
  training: 'Training Curriculum',
  calculator: 'AI Audit Calculator',
  music: 'Music',
  app: 'App Download',
  merchandise: 'Merchandise',
  template: 'Template',
}
