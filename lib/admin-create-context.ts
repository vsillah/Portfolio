/**
 * Admin "create in context" URL pattern.
 * Use when a form has a dropdown to select an existing entity and you want to offer
 * "Create new" that opens the create page with context (e.g. type, return path).
 *
 * Query params convention:
 * - open=add — open the add/create form on load
 * - type=<value> — pre-fill type (e.g. type=audiobook for lead magnets)
 * - returnTo=<path> — after create, redirect here (optional)
 */

export const ADMIN_CREATE_PARAMS = {
  OPEN: 'open',
  OPEN_ADD: 'add',
  TYPE: 'type',
  RETURN_TO: 'returnTo',
} as const

export type AdminCreateResource = 'lead-magnets'

/**
 * Build URL to create a new resource with optional type and return path.
 * Use for "Create X" links next to entity dropdowns in admin forms.
 */
export function adminCreateUrl(
  resource: AdminCreateResource,
  options?: { type?: string; returnTo?: string }
): string {
  const path = '/admin/content/lead-magnets'
  const params = new URLSearchParams()
  params.set(ADMIN_CREATE_PARAMS.OPEN, ADMIN_CREATE_PARAMS.OPEN_ADD)
  if (options?.type) params.set(ADMIN_CREATE_PARAMS.TYPE, options.type)
  if (options?.returnTo) params.set(ADMIN_CREATE_PARAMS.RETURN_TO, options.returnTo)
  return `${path}?${params.toString()}`
}
