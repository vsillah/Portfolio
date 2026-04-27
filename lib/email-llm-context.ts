import type { ContactEnrichment } from '@/lib/lead-research-context'
import { buildEmailRagQueryText, fetchRagContextForEmailQuery } from '@/lib/rag-query'
import { fetchRecentSiteChatExcerptForLeadEmail } from '@/lib/lead-chat-excerpt'

/**
 * Append / substitute Pinecone RAG and site-chat context around the template
 * system prompt. Follows the same Mustache-style sentinel convention used for
 * {{#meeting_action_items}}…{{/meeting_action_items}} (see meeting-tasks-context.ts).
 *
 * Behavior:
 * - When a template contains `{{pinecone_context}}` (optionally wrapped by
 *   `{{#pinecone_context}}…{{/pinecone_context}}`), the RAG text is substituted
 *   in place. Empty RAG → the wrapped block is stripped and bare placeholder
 *   becomes empty string.
 * - When a template does NOT contain the `{{pinecone_context}}` placeholder,
 *   and RAG text is non-empty, we append a default block at the end of the
 *   prompt — backward-compatible with templates that haven't adopted the
 *   sentinel yet.
 * - Same rules apply to `{{prior_site_chat}}` (off unless EMAIL_RAG_INCLUDE_SITE_CHAT=true).
 */

const DEFAULT_PINECONE_HEADING =
  "## Vambah's past work and phrasing (use this to match tone and drop in one concrete story)"
const DEFAULT_PRIOR_CHAT_HEADING =
  '## Prior site chat with this email address (use for continuity; do not quote verbatim unless natural)'

type SentinelKey = 'pinecone_context' | 'prior_site_chat' | 'prior_outreach_history'

function applySentinel(
  prompt: string,
  sentinel: SentinelKey,
  value: string | null
): { prompt: string; hadSentinel: boolean } {
  const blockRe = new RegExp(`\\{\\{#${sentinel}\\}\\}([\\s\\S]*?)\\{\\{\\/${sentinel}\\}\\}`, 'g')
  const bareRe = new RegExp(`\\{\\{${sentinel}\\}\\}`, 'g')

  const hadSentinel = blockRe.test(prompt) || bareRe.test(prompt)
  // reset lastIndex after .test()
  blockRe.lastIndex = 0
  bareRe.lastIndex = 0

  const withBlock = prompt.replace(blockRe, value ? '$1' : '')
  const replaced = withBlock.replace(bareRe, value ?? '')
  return { prompt: replaced, hadSentinel }
}

/**
 * Apply (or strip) the `{{#prior_outreach_history}}…{{/prior_outreach_history}}`
 * sentinel in a system prompt with the supplied rendered block.
 *
 * Phase 3 traceability: distinct from {@link appendPineconeAndChatContextWithMetadata}
 * because the prior-outreach loader needs `contactId` (not just the contact
 * row) and is only relevant to outreach generators — not delivery emails.
 *
 * Behavior matches the pinecone / prior_site_chat sentinels:
 *   - Sentinel present + block non-empty → block is substituted in place.
 *   - Sentinel present + block null/empty → wrapped block stripped, bare
 *     placeholder becomes empty string.
 *   - Sentinel absent + block non-empty → default heading + block appended at
 *     end of prompt (back-compat for any template that hasn't adopted the
 *     sentinel yet).
 */
export function applyPriorOutreachHistorySentinel(
  systemPrompt: string,
  block: string | null,
): string {
  const result = applySentinel(systemPrompt, 'prior_outreach_history', block)
  if (!result.hadSentinel && block && block.trim() !== '') {
    return `${result.prompt}\n\n${block}`
  }
  return result.prompt
}

/**
 * Metadata produced by {@link appendPineconeAndChatContextWithMetadata} alongside
 * the assembled prompt. Surfaced to `outreach_queue.generation_inputs` for
 * Phase 2 traceability ("why this draft?"). The `pineconeBlockHash` is a short
 * sha256 prefix of the RAG block — useful for spotting drafts that share the
 * same retrieved corpus chunk without storing the full block per row.
 */
export interface PineconeChatContextMetadata {
  pineconeChars: number
  priorChatPresent: boolean
  pineconeBlockHash: string | null
}

export async function appendPineconeAndChatContextToSystemPrompt(
  systemPrompt: string,
  input: {
    contact: ContactEnrichment
    /** Use the same text you send to the model as research (capped inside RAG query builder). */
    researchTextForRag: string
  }
): Promise<string> {
  const { prompt } = await appendPineconeAndChatContextWithMetadata(systemPrompt, input)
  return prompt
}

/**
 * Same as {@link appendPineconeAndChatContextToSystemPrompt} but also returns
 * the sizes / fingerprint of what was injected. Callers that persist a
 * generation trace (outreach-queue-generator) use this; everything else can
 * keep using the simpler wrapper.
 */
export async function appendPineconeAndChatContextWithMetadata(
  systemPrompt: string,
  input: {
    contact: ContactEnrichment
    researchTextForRag: string
  }
): Promise<{ prompt: string; metadata: PineconeChatContextMetadata }> {
  const ragQuery = buildEmailRagQueryText({
    company: input.contact.company,
    industry: input.contact.industry,
    researchSnippet: input.researchTextForRag,
  })

  const [ragBlock, chatBlock] = await Promise.all([
    fetchRagContextForEmailQuery(ragQuery),
    fetchRecentSiteChatExcerptForLeadEmail(input.contact.email),
  ])

  const ragApply = applySentinel(systemPrompt, 'pinecone_context', ragBlock)
  const chatApply = applySentinel(ragApply.prompt, 'prior_site_chat', chatBlock)

  let out = chatApply.prompt

  if (!ragApply.hadSentinel && ragBlock) {
    out += `\n\n${DEFAULT_PINECONE_HEADING}\n${ragBlock}`
  }
  if (!chatApply.hadSentinel && chatBlock) {
    out += `\n\n${DEFAULT_PRIOR_CHAT_HEADING}\n${chatBlock}`
  }

  return {
    prompt: out,
    metadata: {
      pineconeChars: ragBlock?.length ?? 0,
      priorChatPresent: Boolean(chatBlock && chatBlock.length > 0),
      pineconeBlockHash: ragBlock ? hashBlockShort(ragBlock) : null,
    },
  }
}

/**
 * Short, deterministic fingerprint of the RAG block. Truncated to 12 hex chars
 * — enough to spot duplicates within the outreach_queue corpus without leaking
 * full content to anyone reading generation_inputs.
 */
function hashBlockShort(block: string): string {
  // Lazily required so this file remains client-safe at import time; this
  // helper is only ever called from server code paths.
  const crypto = require('crypto') as typeof import('crypto')
  return crypto.createHash('sha256').update(block).digest('hex').slice(0, 12)
}
