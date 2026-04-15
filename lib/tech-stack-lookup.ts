/**
 * Tech stack lookup via BuiltWith Domain API.
 * Use a company website domain to fetch detected technologies so sales doesn't need to ask during calls.
 *
 * Requires BUILTWITH_API_KEY in env. Get a key at https://builtwith.com/signup
 * API: https://api.builtwith.com/domain-api
 */

const BUILTWITH_API_KEY = process.env.BUILTWITH_API_KEY
const BUILTWITH_DOMAIN_API = 'https://api.builtwith.com/v22/api.json'

export interface TechStackItem {
  name: string
  tag?: string
  categories?: string[]
  parent?: string
}

export interface TechStackLookupResult {
  ok: boolean
  domain: string
  technologies?: TechStackItem[]
  byTag?: Record<string, string[]>
  error?: string
  creditsRemaining?: number
}

/** Exported for tests — normalizes BuiltWith Domain API v22 (and legacy) JSON into tech rows. */
export function technologiesFromBuiltWithPayload(data: unknown): {
  technologies: TechStackItem[]
  byTag: Record<string, string[]>
} {
  const technologies: TechStackItem[] = []
  const byTag: Record<string, string[]> = {}

  if (!data || typeof data !== 'object') {
    return { technologies, byTag }
  }

  const root = data as Record<string, unknown>

  const pathsToWalk: unknown[] = []

  function collectPaths(paths: unknown) {
    if (!Array.isArray(paths)) return
    pathsToWalk.push(...paths)
  }

  /** Result may be { Paths: [...] } or an array of such objects (alternate API shapes). */
  function collectFromResultInner(inner: unknown) {
    if (inner == null) return
    if (Array.isArray(inner)) {
      for (const piece of inner) {
        if (piece && typeof piece === 'object') {
          collectPaths((piece as Record<string, unknown>).Paths)
        }
      }
      return
    }
    if (typeof inner === 'object') {
      collectPaths((inner as Record<string, unknown>).Paths)
    }
  }

  if (Array.isArray(root.Results)) {
    for (const block of root.Results) {
      if (!block || typeof block !== 'object') continue
      const b = block as Record<string, unknown>
      collectPaths(b.Paths)
      collectFromResultInner(b.Result)
    }
  }

  if (pathsToWalk.length === 0 && root.Result != null) {
    const top = root.Result
    if (Array.isArray(top)) {
      for (const piece of top) {
        if (piece && typeof piece === 'object') {
          collectPaths((piece as Record<string, unknown>).Paths)
        }
      }
    } else if (typeof top === 'object') {
      collectPaths((top as Record<string, unknown>).Paths)
    }
  }

  function techDisplayName(tech: Record<string, unknown>): string | null {
    const raw = tech.Name ?? tech.name
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
    if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
    return null
  }

  function techTag(tech: Record<string, unknown>): string | undefined {
    const raw = tech.Tag ?? tech.tag
    return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined
  }

  /** v22: flat { Name, Tag, ... } or legacy { Technology: { ... } }. */
  function pushFromTechNode(raw: unknown) {
    if (!raw || typeof raw !== 'object') return
    const o = raw as Record<string, unknown>
    const tech =
      o.Technology && typeof o.Technology === 'object'
        ? (o.Technology as Record<string, unknown>)
        : o
    const name = techDisplayName(tech)
    if (!name) return
    const tag = techTag(tech)
    const categories = Array.isArray(tech.Categories)
      ? tech.Categories.filter((c): c is string => typeof c === 'string')
      : undefined
    const parentRaw = tech.Parent ?? tech.parent
    const parent = typeof parentRaw === 'string' && parentRaw.trim() ? parentRaw.trim() : undefined
    const item: TechStackItem = {
      name,
      parent: parent || undefined,
      tag,
      categories: categories?.length ? categories : undefined,
    }
    technologies.push(item)
    if (tag) {
      if (!byTag[tag]) byTag[tag] = []
      if (!byTag[tag].includes(name)) byTag[tag].push(name)
    }
  }

  function walkPathObject(path: Record<string, unknown>) {
    const direct = path.Technologies
    if (Array.isArray(direct)) {
      for (const t of direct) pushFromTechNode(t)
    }
    const pathEntry = path.Path
    const pathArray = Array.isArray(pathEntry) ? pathEntry : pathEntry ? [pathEntry] : []
    for (const p of pathArray) {
      if (!p || typeof p !== 'object') continue
      const techs = (p as { Technologies?: unknown[] }).Technologies
      if (!Array.isArray(techs)) continue
      for (const t of techs) pushFromTechNode(t)
    }
  }

  for (const path of pathsToWalk) {
    if (path && typeof path === 'object') walkPathObject(path as Record<string, unknown>)
  }

  const seen = new Set<string>()
  const unique = technologies.filter((t) => {
    if (seen.has(t.name)) return false
    seen.add(t.name)
    return true
  })

  return { technologies: unique, byTag }
}

/**
 * Extract root domain for BuiltWith lookup (e.g. "https://www.example.com/path" -> "example.com").
 */
export function domainForLookup(input: string): string | null {
  if (!input || typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    let host = trimmed
    if (trimmed.includes('://')) {
      const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
      host = u.hostname
    } else if (trimmed.includes('/')) {
      host = trimmed.split('/')[0]
    }
    // Remove leading www.
    const lower = host.toLowerCase().replace(/^www\./, '')
    if (!lower || lower.length < 2) return null
    return lower
  } catch {
    return null
  }
}

/**
 * Fetch tech stack for a domain using BuiltWith Domain API.
 * Returns normalized list of technologies and an optional byTag map (e.g. Analytics -> [Google Analytics]).
 */
export async function fetchTechStackByDomain(
  domainOrUrl: string
): Promise<TechStackLookupResult> {
  const domain = domainForLookup(domainOrUrl)
  if (!domain) {
    return { ok: false, domain: domainOrUrl, error: 'Invalid or missing domain' }
  }

  if (!BUILTWITH_API_KEY || BUILTWITH_API_KEY === '00000000-0000-0000-0000-000000000000') {
    return {
      ok: false,
      domain,
      error: 'Tech stack lookup is not configured. Add BUILTWITH_API_KEY to enable.',
    }
  }

  const url = new URL(BUILTWITH_DOMAIN_API)
  url.searchParams.set('KEY', BUILTWITH_API_KEY)
  url.searchParams.set('LOOKUP', domain)

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    })

    const creditsHeader = res.headers.get('X-API-CREDITS-REMAINING')
    const creditsRemaining = creditsHeader ? parseInt(creditsHeader, 10) : undefined
    const numCredits = typeof creditsRemaining === 'number' && !Number.isNaN(creditsRemaining) ? creditsRemaining : undefined

    if (res.status === 429) {
      const body = await res.json().catch(() => ({}))
      const retryAfter = (body as { retryAfterSeconds?: number }).retryAfterSeconds
      return {
        ok: false,
        domain,
        error: `Rate limit exceeded. ${retryAfter ? `Retry after ${retryAfter}s.` : ''}`,
        creditsRemaining: numCredits,
      }
    }

    if (!res.ok) {
      const text = await res.text()
      let errMsg = `BuiltWith API error: ${res.status}`
      try {
        const j = JSON.parse(text) as { error?: string; Message?: string }
        if (j.error) errMsg = j.error
        else if (j.Message) errMsg = j.Message
      } catch {
        if (text.length < 200) errMsg = text
      }
      return {
        ok: false,
        domain,
        error: errMsg,
        creditsRemaining: numCredits,
      }
    }

    const data = (await res.json()) as {
      Lookup?: string
      /** v22 single-domain responses use Results[0].Result.Paths (see domain_api_v22.json). */
      Results?: Array<{ Lookup?: string; Result?: { Paths?: unknown[] } }>
      /** Older / alternate shape: top-level Result */
      Result?: unknown
      Errors?: Array<{ Message?: string }>
    }

    if (data.Errors && data.Errors.length > 0) {
      const msg = data.Errors.map((e) => e.Message || 'Unknown').join('; ')
      return {
        ok: false,
        domain: data.Lookup || domain,
        error: msg,
        creditsRemaining: numCredits,
      }
    }

    const resolvedLookup =
      (Array.isArray(data.Results) && data.Results[0]?.Lookup) || data.Lookup || domain

    const { technologies: unique, byTag } = technologiesFromBuiltWithPayload(data)

    return {
      ok: true,
      domain: resolvedLookup,
      technologies: unique,
      byTag: Object.keys(byTag).length ? byTag : undefined,
      creditsRemaining: numCredits,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed'
    return {
      ok: false,
      domain,
      error: message,
    }
  }
}
