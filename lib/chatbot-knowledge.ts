/**
 * Chatbot knowledge source configuration.
 * Ordered list of repo doc paths (relative to project root) and optional section titles.
 * The homepage chatbot fetches concatenated content from GET /api/knowledge or GET /api/knowledge/chatbot.
 *
 * On Vercel, doc files are not in the serverless bundle, so we rely on build-time embedded content
 * (lib/chatbot-knowledge-content.generated.ts from scripts/build-chatbot-knowledge.ts).
 * Locally, we fall back to reading from the filesystem when the generated file is missing.
 */

import { readFile } from 'fs/promises'
import path from 'path'

export interface ChatbotKnowledgeEntry {
  /** Path relative to project root (e.g. docs/user-help-guide.md) */
  path: string
  /** Optional section header shown before this doc's content (e.g. "User Help Guide") */
  sectionTitle?: string
}

/** Ordered list of docs included in chatbot knowledge (used for runtime fallback and by build script). */
export const CHATBOT_KNOWLEDGE_SOURCES: ChatbotKnowledgeEntry[] = [
  { path: 'docs/chatbot-products-and-services-overview.md', sectionTitle: 'What AmaduTown Offers (products and services)' },
  { path: 'docs/chatbot-campaigns-overview.md', sectionTitle: 'Active Promotions & Attraction Campaigns' },
  { path: 'docs/user-help-guide.md', sectionTitle: 'User Help Guide' },
  { path: 'docs/admin-sales-lead-pipeline-sop.md', sectionTitle: 'Admin & Sales Lead Pipeline (overview)' },
  { path: 'README.md', sectionTitle: 'Project overview' },
]

/**
 * Build concatenated markdown for the chatbot.
 * Uses embedded content from build script when available (production/Vercel); otherwise reads from filesystem (local dev).
 */
export async function getChatbotKnowledgeBody(): Promise<{ body: string } | { error: string; status: 404 | 500 }> {
  try {
    const mod = await import('./chatbot-knowledge-content.generated')
    const body = mod.CHATBOT_KNOWLEDGE_BODY
    if (body && typeof body === 'string') {
      return { body }
    }
  } catch {
    // Generated file missing (e.g. dev without running build:knowledge) — fall back to fs
  }

  const cwd = process.cwd()
  const parts: string[] = []

  for (const entry of CHATBOT_KNOWLEDGE_SOURCES) {
    const absolutePath = path.join(cwd, entry.path)
    try {
      const content = await readFile(absolutePath, 'utf-8')
      const sectionHeader = entry.sectionTitle
        ? `## Source: ${entry.sectionTitle}\n\n`
        : `## Source: ${entry.path}\n\n`
      parts.push(sectionHeader + content.trim())
    } catch (err) {
      console.warn(`Chatbot knowledge: skipped ${entry.path}`, err instanceof Error ? err.message : err)
    }
  }

  if (parts.length === 0) {
    return { error: 'No knowledge sources could be read', status: 404 }
  }

  return { body: parts.join('\n\n---\n\n') }
}
