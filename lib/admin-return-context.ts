/**
 * Safe returnTo URL helpers for admin page-to-page navigation.
 *
 * Convention: source pages append `?returnTo=<encoded admin path>` when linking
 * to detail/child pages. Destination pages read it for the primary "Back" button.
 * Breadcrumbs remain static (canonical hierarchy). One returnTo per navigation —
 * no multi-hop stacks.
 *
 * Security: only `/admin/…` paths are accepted; protocol/host and open-redirect
 * vectors are rejected.
 */

export const RETURN_TO_PARAM = 'returnTo' as const

/**
 * Validate and sanitize a return path.
 * Returns the clean path or null if invalid.
 */
export function validateReturnPath(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string') return null

  const trimmed = path.trim()
  if (!trimmed) return null

  // Reject protocol-relative URLs (open redirect)
  if (trimmed.startsWith('//')) return null

  // Reject absolute URLs with a scheme
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null

  // Must start with /admin/
  if (!trimmed.startsWith('/admin/') && trimmed !== '/admin') return null

  return trimmed
}

/**
 * Build a URL to `destination` with a safe returnTo pointing back to `returnPath`.
 * If returnPath is invalid, the destination URL is returned without returnTo.
 */
export function buildLinkWithReturn(
  destination: string,
  returnPath: string
): string {
  const safe = validateReturnPath(returnPath)
  if (!safe) return destination

  const separator = destination.includes('?') ? '&' : '?'
  return `${destination}${separator}${RETURN_TO_PARAM}=${encodeURIComponent(safe)}`
}

/**
 * Read and validate returnTo from URLSearchParams.
 * Returns the validated path or null.
 */
export function parseReturnTo(
  searchParams: URLSearchParams | { get: (key: string) => string | null }
): string | null {
  const raw = searchParams.get(RETURN_TO_PARAM)
  return validateReturnPath(raw)
}

/**
 * Get the effective back URL: returnTo if valid, otherwise the provided default.
 */
export function getBackUrl(
  searchParams: URLSearchParams | { get: (key: string) => string | null },
  defaultPath: string
): string {
  return parseReturnTo(searchParams) ?? defaultPath
}

/**
 * Build the current admin path for use as `returnPath` in `buildLinkWithReturn`.
 * Drops `returnTo` from the query string so nested links do not accumulate junk.
 */
export function buildAdminReturnPath(pathname: string, searchParamsString: string | undefined): string {
  const path = pathname?.trim() || '/admin'
  const raw = (searchParamsString ?? '').trim()
  if (!raw) return path
  const sp = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw)
  sp.delete(RETURN_TO_PARAM)
  const q = sp.toString()
  return q ? `${path}?${q}` : path
}
