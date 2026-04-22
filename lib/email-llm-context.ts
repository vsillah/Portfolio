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

function applySentinel(
  prompt: string,
  sentinel: 'pinecone_context' | 'prior_site_chat',
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

export async function appendPineconeAndChatContextToSystemPrompt(
  systemPrompt: string,
  input: {
    contact: ContactEnrichment
    /** Use the same text you send to the model as research (capped inside RAG query builder). */
    researchTextForRag: string
  }
): Promise<string> {
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

  // Backward-compat: when a template has NOT adopted a sentinel, append at end
  // so existing templates continue to benefit from RAG / chat context without
  // any edit. Once a template adopts the sentinel, it controls placement.
  if (!ragApply.hadSentinel && ragBlock) {
    out += `\n\n${DEFAULT_PINECONE_HEADING}\n${ragBlock}`
  }
  if (!chatApply.hadSentinel && chatBlock) {
    out += `\n\n${DEFAULT_PRIOR_CHAT_HEADING}\n${chatBlock}`
  }

  return out
}
