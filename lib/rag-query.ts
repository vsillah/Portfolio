/**
 * Calls the n8n "amadutown-rag-query" webhook (Pinecone-backed RAG) to retrieve
 * voice-of-brand snippets for email and other in-app LLM steps.
 * Mirrors the HTTP contract used in WF-SOC-001 and WF-MCH (POST JSON { query }).
 */

import { isMockN8nEnabled, isN8nOutboundDisabled } from '@/lib/n8n-runtime-flags'

/** Kept in sync with `lib/n8n.ts` default base URL (avoid importing the full n8n client from email paths). */
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://amadutown.app.n8n.cloud'

const RAG_TIMEOUT_MS = 25_000
/** Max characters injected into the system prompt from a single RAG response. */
export const RAG_MAX_PROMPT_CHARS = 12_000

function getRagQueryWebhookUrl(): string {
  return process.env.N8N_RAG_QUERY_WEBHOOK_URL?.trim() || `${N8N_BASE_URL}/webhook/amadutown-rag-query`
}

/**
 * Best-effort stringify of n8n RAG webhook JSON for use inside system prompts.
 */
export function ragResponseToPromptBlock(data: unknown): string {
  if (data == null) return ''

  if (typeof data === 'string') {
    return data.length > RAG_MAX_PROMPT_CHARS
      ? data.slice(0, RAG_MAX_PROMPT_CHARS) + '\n…'
      : data
  }

  if (typeof data === 'object' && !Array.isArray(data)) {
    const o = data as Record<string, unknown>
    const text =
      o.output ??
      o.text ??
      o.response ??
      o.message ??
      o.result ??
      (Array.isArray(o.data) && o.data.length > 0 ? o.data[0] : null)
    if (typeof text === 'string' && text.trim()) {
      return text.length > RAG_MAX_PROMPT_CHARS
        ? text.slice(0, RAG_MAX_PROMPT_CHARS) + '\n…'
        : text
    }
  }

  try {
    const s = JSON.stringify(data, null, 0)
    return s.length > RAG_MAX_PROMPT_CHARS ? s.slice(0, RAG_MAX_PROMPT_CHARS) + '\n…' : s
  } catch {
    return ''
  }
}

/**
 * Build a natural-language query for RAG, aligned with WF-SOC-001.
 * Uses a generous slice of the research brief so retrieval matches meeting + value context.
 */
export function buildEmailRagQueryText(context: {
  company: string | null
  industry: string | null
  researchSnippet: string
}): string {
  const base =
    'Personal stories, case studies, writing style, and experiences related to: '
  const who = [context.industry, context.company].filter(Boolean).join(' at ')
  const focus = (context.researchSnippet || '').trim().slice(0, 4_000)
  const q = [who, focus].filter(Boolean).join(' — ') || 'general B2B advisory, AI, and automation for SMBs'
  return base + q
}

export type RagQueryOptions = {
  /** Set for /api/admin/rag-health so connectivity is tested even when EMAIL_RAG_ENABLED=false. */
  ignoreEmailRagEnabled?: boolean
}

export type RagSkippedReason =
  | 'email_rag_disabled'
  | 'n8n_outbound_disabled'
  | 'mock_n8n_enabled'
  | 'empty_query'
  | null

export type RagErrorClass = 'http' | 'timeout' | 'network' | 'parse' | null

/** Telemetry for outreach_queue.generation_inputs and admin "Why this draft?". */
export interface RagFetchDiagnostics {
  rag_query_chars: number
  skipped_reason: RagSkippedReason
  /** True when an HTTP request was issued (or would have been if not short-circuited). */
  attempted: boolean
  error_class: RagErrorClass
  http_status: number | null
  latency_ms: number | null
  /** True when HTTP succeeded but the normalized RAG block was empty. */
  empty_response: boolean
}

const emptyDiagnostics = (
  query: string,
  skipped: RagSkippedReason,
): RagFetchDiagnostics => ({
  rag_query_chars: query.trim().length,
  skipped_reason: skipped,
  attempted: false,
  error_class: null,
  http_status: null,
  latency_ms: null,
  empty_response: false,
})

/**
 * POST to the RAG webhook and return plain text + structured skip/error/empty flags.
 */
export async function fetchRagContextForEmailQueryWithDiagnostics(
  query: string,
  options?: RagQueryOptions,
): Promise<{ block: string | null; diagnostics: RagFetchDiagnostics }> {
  const q = query.trim()
  const baseDiag = (): RagFetchDiagnostics => ({
    rag_query_chars: q.length,
    skipped_reason: null,
    attempted: true,
    error_class: null,
    http_status: null,
    latency_ms: null,
    empty_response: false,
  })

  if (!options?.ignoreEmailRagEnabled && process.env.EMAIL_RAG_ENABLED === 'false') {
    return { block: null, diagnostics: emptyDiagnostics(query, 'email_rag_disabled') }
  }

  if (isN8nOutboundDisabled()) {
    return { block: null, diagnostics: emptyDiagnostics(query, 'n8n_outbound_disabled') }
  }

  if (isMockN8nEnabled()) {
    return { block: null, diagnostics: emptyDiagnostics(query, 'mock_n8n_enabled') }
  }

  if (!q) {
    return { block: null, diagnostics: emptyDiagnostics(query, 'empty_query') }
  }

  const url = getRagQueryWebhookUrl()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS)
  const t0 = Date.now()

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: q }),
      signal: controller.signal,
    })

    const latency_ms = Date.now() - t0

    if (!res.ok) {
      console.warn('[email-rag] RAG webhook HTTP', res.status, await res.text().catch(() => ''))
      return {
        block: null,
        diagnostics: {
          ...baseDiag(),
          error_class: 'http',
          http_status: res.status,
          latency_ms,
        },
      }
    }

    const data = (await res.json().catch(() => null)) as unknown
    if (data == null) {
      return {
        block: null,
        diagnostics: {
          ...baseDiag(),
          error_class: 'parse',
          latency_ms,
          empty_response: true,
        },
      }
    }

    let block: string | null = null
    if (Array.isArray(data) && data.length > 0) {
      block = ragResponseToPromptBlock(data[0]) || null
    } else {
      const b = ragResponseToPromptBlock(data)
      block = b.trim() ? b : null
    }

    return {
      block,
      diagnostics: {
        ...baseDiag(),
        latency_ms,
        empty_response: block == null || block.length === 0,
      },
    }
  } catch (e) {
    const latency_ms = Date.now() - t0
    const name = e instanceof Error ? e.name : ''
    const isAbort =
      name === 'AbortError' || (e instanceof DOMException && e.name === 'AbortError')
    console.warn('[email-rag] RAG fetch failed:', e)
    return {
      block: null,
      diagnostics: {
        ...baseDiag(),
        error_class: isAbort ? 'timeout' : 'network',
        latency_ms,
      },
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * When EMAIL_RAG_ENABLED is not "false", POST to the RAG webhook and return plain text, or null on skip/failure.
 */
export async function fetchRagContextForEmailQuery(
  query: string,
  options?: RagQueryOptions
): Promise<string | null> {
  const { block } = await fetchRagContextForEmailQueryWithDiagnostics(query, options)
  return block
}
