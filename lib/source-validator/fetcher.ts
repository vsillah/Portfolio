/**
 * VEP Source Validator - URL fetcher with Supabase-backed cache
 *
 * Safety:
 *   - HEAD first; fall back to GET only if HEAD unsupported
 *   - Response body capped at MAX_BODY_BYTES (1 MB)
 *   - 10s total timeout
 *   - Custom UA
 *   - Per-domain throttle (simple in-process last-request-at map; enough for
 *     the batch sizes we run today)
 *   - Denylist from tiers.ts
 *
 * Cache:
 *   - Keyed by sha256 of normalized URL (lowercased host, trailing slash stripped,
 *     fragments dropped, common tracking params removed)
 *   - Honored while within ttl_days of fetched_at; TTL is domain-type aware
 *     (government 30d, analyst 14d, trade 14d, press 7d, general 3d)
 */

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { extractHostname, isFetchDenylisted, inferDomainType } from './tiers'
import type { CachedFetchResult } from './types'

const USER_AGENT = 'AmaduTownVEP-SourceValidator/1.0 (+https://amadutown.com)'
const DEFAULT_TIMEOUT_MS = 10_000
const MAX_BODY_BYTES = 1_000_000
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'mc_cid', 'mc_eid', 'ref', 'ref_src',
])

const TTL_DAYS_BY_TYPE: Record<string, number> = {
  government: 30,
  analyst: 14,
  trade: 14,
  press: 7,
  general: 3,
}

const lastRequestAtByDomain = new Map<string, number>()
const MIN_DOMAIN_INTERVAL_MS = 1000

/**
 * Normalize URL for cache keying.
 */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim())
    u.hostname = u.hostname.toLowerCase()
    u.hash = ''
    // Strip tracking params
    const keep = new URLSearchParams()
    u.searchParams.forEach((v, k) => {
      if (!TRACKING_PARAMS.has(k.toLowerCase())) keep.append(k, v)
    })
    u.search = keep.toString()
    // Strip trailing slash (except for root path)
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '')
    }
    return u.toString()
  } catch {
    return raw.trim()
  }
}

export function hashUrl(url: string): string {
  return createHash('sha256').update(normalizeUrl(url)).digest('hex')
}

interface CacheRow {
  url_hash: string
  url: string
  domain: string
  status_code: number | null
  final_url: string | null
  title: string | null
  published_date: string | null
  content_length: number | null
  fetched_at: string
  ttl_days: number
  error_reason: string | null
}

async function readCache(urlHash: string): Promise<CacheRow | null> {
  if (!supabaseAdmin) return null
  const { data } = await supabaseAdmin
    .from('source_validation_cache')
    .select('*')
    .eq('url_hash', urlHash)
    .maybeSingle()
  return (data as CacheRow | null) ?? null
}

function isFresh(row: CacheRow): boolean {
  const fetchedAt = new Date(row.fetched_at).getTime()
  const expiresAt = fetchedAt + row.ttl_days * 24 * 60 * 60 * 1000
  return Date.now() < expiresAt
}

async function writeCache(row: CacheRow): Promise<void> {
  if (!supabaseAdmin) return
  await supabaseAdmin
    .from('source_validation_cache')
    .upsert(row, { onConflict: 'url_hash' })
}

/**
 * Extract title from an HTML snippet. Intentionally regex-based (no DOM parser)
 * because we only ever read the first ~1 MB of the body.
 */
function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  if (!m) return null
  return m[1].trim().replace(/\s+/g, ' ').slice(0, 500) || null
}

/**
 * Extract a published date from common meta tags / JSON-LD fields.
 * Returns an ISO string or null.
 */
function extractPublishedDate(html: string): string | null {
  const patterns: RegExp[] = [
    /<meta[^>]+(?:property|name)=["'](?:article:published_time|og:published_time|pubdate|publishdate|date)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:article:published_time|og:published_time|pubdate|publishdate|date)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
  ]
  for (const rx of patterns) {
    const m = rx.exec(html)
    if (m && m[1]) {
      const d = new Date(m[1])
      if (!Number.isNaN(d.getTime())) return d.toISOString()
    }
  }
  return null
}

async function throttleDomain(domain: string): Promise<void> {
  const last = lastRequestAtByDomain.get(domain) ?? 0
  const waitMs = Math.max(0, MIN_DOMAIN_INTERVAL_MS - (Date.now() - last))
  if (waitMs > 0) {
    await new Promise((r) => setTimeout(r, waitMs))
  }
  lastRequestAtByDomain.set(domain, Date.now())
}

async function fetchWithTimeout(url: string, method: 'HEAD' | 'GET'): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  try {
    return await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: method === 'GET' ? 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' : '*/*',
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Read a capped number of bytes from a response body.
 */
async function readCappedText(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return await res.text()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        chunks.push(value)
        total += value.byteLength
        if (total >= maxBytes) break
      }
    }
  } finally {
    try { await reader.cancel() } catch { /* ignore */ }
  }
  let offset = 0
  const out = new Uint8Array(total)
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(out)
}

/**
 * Fetch a URL with caching; returns null if the URL is invalid.
 */
export async function fetchUrlCached(rawUrl: string, options: {
  /** Skip cache read; still writes cache. */
  force?: boolean
} = {}): Promise<CachedFetchResult | null> {
  const url = normalizeUrl(rawUrl)
  const host = extractHostname(url)
  if (!host) return null

  const urlHash = hashUrl(url)

  if (!options.force) {
    const cached = await readCache(urlHash)
    if (cached && isFresh(cached)) {
      return {
        url,
        final_url: cached.final_url,
        status_code: cached.status_code,
        domain: cached.domain,
        title: cached.title,
        published_date: cached.published_date,
        content_length: cached.content_length,
        fetched_at: cached.fetched_at,
        error_reason: cached.error_reason,
        cache_hit: true,
      }
    }
  }

  const domainType = inferDomainType(host, null)
  const ttlDays = TTL_DAYS_BY_TYPE[domainType] ?? 3

  if (isFetchDenylisted(host)) {
    const row: CacheRow = {
      url_hash: urlHash,
      url,
      domain: host,
      status_code: null,
      final_url: null,
      title: null,
      published_date: null,
      content_length: null,
      fetched_at: new Date().toISOString(),
      ttl_days: 30,
      error_reason: 'fetch_denylisted',
    }
    await writeCache(row)
    return { ...row, cache_hit: false }
  }

  await throttleDomain(host)

  let statusCode: number | null = null
  let finalUrl: string | null = null
  let title: string | null = null
  let publishedDate: string | null = null
  let contentLength: number | null = null
  let errorReason: string | null = null

  try {
    // HEAD first
    let res: Response | null = null
    try {
      res = await fetchWithTimeout(url, 'HEAD')
    } catch (e) {
      errorReason = `head_error:${(e as Error).message?.slice(0, 100)}`
    }

    const headOk = res && res.status >= 200 && res.status < 400
    const headUnsupported = res && (res.status === 405 || res.status === 501)

    if (headOk && res) {
      statusCode = res.status
      finalUrl = res.url
      const len = res.headers.get('content-length')
      contentLength = len ? Number(len) : null
    }

    // GET to extract title/date (skip if HEAD was terminally bad and not a 405/501)
    if (headOk || headUnsupported || !res) {
      try {
        await throttleDomain(host)
        const getRes = await fetchWithTimeout(url, 'GET')
        statusCode = getRes.status
        finalUrl = getRes.url
        if (getRes.ok) {
          const ctype = getRes.headers.get('content-type') ?? ''
          if (ctype.includes('html') || ctype.includes('text/')) {
            const body = await readCappedText(getRes, MAX_BODY_BYTES)
            title = extractTitle(body)
            publishedDate = extractPublishedDate(body)
            contentLength = body.length
          }
        }
      } catch (e) {
        errorReason = errorReason ?? `get_error:${(e as Error).message?.slice(0, 100)}`
      }
    } else if (res) {
      statusCode = res.status
      finalUrl = res.url
    }
  } catch (e) {
    errorReason = errorReason ?? `fetch_error:${(e as Error).message?.slice(0, 100)}`
  }

  const row: CacheRow = {
    url_hash: urlHash,
    url,
    domain: host,
    status_code: statusCode,
    final_url: finalUrl,
    title,
    published_date: publishedDate,
    content_length: contentLength,
    fetched_at: new Date().toISOString(),
    ttl_days: ttlDays,
    error_reason: errorReason,
  }
  await writeCache(row)
  return { ...row, cache_hit: false }
}
