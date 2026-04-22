/**
 * Calls the n8n "amadutown-rag-query" webhook (Pinecone-backed RAG) to retrieve
 * voice-of-brand snippets for email and other in-app LLM steps.
 * Mirrors the HTTP contract used in WF-SOC-001 and WF-MCH (POST JSON { query }).
 */

import { isMockN8nEnabled, isN8nOutboundDisabled } from '@/lib/n8n-runtime-flags'

/** Kept in sync with `lib/n8n.ts` default base URL (avoid importing the full n8n client from email paths). */
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://amadutown.app.n8n.cloud'

const RAG_TIMEOUT_MS = 25_000
const MAX_PROMPT_CHARS = 6_000

function getRagQueryWebhookUrl(): string {
  return process.env.N8N_RAG_QUERY_WEBHOOK_URL?.trim() || `${N8N_BASE_URL}/webhook/amadutown-rag-query`
}

/**
 * Best-effort stringify of n8n RAG webhook JSON for use inside system prompts.
 */
export function ragResponseToPromptBlock(data: unknown): string {
  if (data == null) return ''

  if (typeof data === 'string') {
    return data.length > MAX_PROMPT_CHARS ? data.slice(0, MAX_PROMPT_CHARS) + '\n…' : data
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
      return text.length > MAX_PROMPT_CHARS ? text.slice(0, MAX_PROMPT_CHARS) + '\n…' : text
    }
  }

  try {
    const s = JSON.stringify(data, null, 0)
    return s.length > MAX_PROMPT_CHARS ? s.slice(0, MAX_PROMPT_CHARS) + '\n…' : s
  } catch {
    return ''
  }
}

/**
 * Build a short natural-language query for RAG, aligned with WF-SOC-001.
 */
export function buildEmailRagQueryText(context: {
  company: string | null
  industry: string | null
  researchSnippet: string
}): string {
  const base =
    'Personal stories, case studies, writing style, and experiences related to: '
  const who = [context.industry, context.company].filter(Boolean).join(' at ')
  const focus = (context.researchSnippet || '').trim().slice(0, 1_200)
  const q = [who, focus].filter(Boolean).join(' — ') || 'general B2B advisory, AI, and automation for SMBs'
  return base + q
}

export type RagQueryOptions = {
  /** Set for /api/admin/rag-health so connectivity is tested even when EMAIL_RAG_ENABLED=false. */
  ignoreEmailRagEnabled?: boolean
}

/**
 * When EMAIL_RAG_ENABLED is not "false", POST to the RAG webhook and return plain text, or null on skip/failure.
 */
export async function fetchRagContextForEmailQuery(
  query: string,
  options?: RagQueryOptions
): Promise<string | null> {
  if (!options?.ignoreEmailRagEnabled && process.env.EMAIL_RAG_ENABLED === 'false') {
    return null
  }

  if (isN8nOutboundDisabled() || isMockN8nEnabled()) {
    return null
  }

  const q = query.trim()
  if (!q) return null

  const url = getRagQueryWebhookUrl()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: q }),
      signal: controller.signal,
    })

    if (!res.ok) {
      console.warn('[email-rag] RAG webhook HTTP', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = (await res.json().catch(() => null)) as unknown
    if (data == null) return null

    if (Array.isArray(data) && data.length > 0) {
      return ragResponseToPromptBlock(data[0]) || null
    }

    const block = ragResponseToPromptBlock(data)
    return block.trim() ? block : null
  } catch (e) {
    console.warn('[email-rag] RAG fetch failed:', e)
    return null
  } finally {
    clearTimeout(timer)
  }
}
