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

    const technologies: TechStackItem[] = []
    const byTag: Record<string, string[]> = {}

    // Response shape: Result can be single object or array (multi-lookup). Paths[].Path[].Technologies[].
    const result = data.Result
    if (!result) {
      return {
        ok: true,
        domain: data.Lookup || domain,
        technologies: [],
        byTag: {},
        creditsRemaining: numCredits,
      }
    }

    const paths = Array.isArray(result) ? result : [result]
    for (const pathObj of paths) {
      const pathsList = (pathObj as { Paths?: Array<{ Path?: unknown }> }).Paths
      if (!Array.isArray(pathsList)) continue
      for (const path of pathsList) {
        const pathEntry = path.Path
        const pathArray = Array.isArray(pathEntry) ? pathEntry : pathEntry ? [pathEntry] : []
        for (const p of pathArray) {
          const techs = (p as { Technologies?: Array<{ Technology?: unknown }> }).Technologies
          if (!Array.isArray(techs)) continue
          for (const t of techs) {
            const tech = t.Technology
            if (!tech || typeof tech !== 'object') continue
            const name = (tech as { Name?: string }).Name
            if (!name || typeof name !== 'string') continue
            const tag = (tech as { Tag?: string }).Tag
            const categories = (tech as { Categories?: string[] }).Categories
            const parent = (tech as { Parent?: string }).Parent
            const item: TechStackItem = { name, parent: parent || undefined, tag, categories }
            technologies.push(item)
            if (tag) {
              if (!byTag[tag]) byTag[tag] = []
              if (!byTag[tag].includes(name)) byTag[tag].push(name)
            }
          }
        }
      }
    }

    // Dedupe by name (same tech can appear on multiple paths)
    const seen = new Set<string>()
    const unique = technologies.filter((t) => {
      if (seen.has(t.name)) return false
      seen.add(t.name)
      return true
    })

    return {
      ok: true,
      domain: data.Lookup || domain,
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
