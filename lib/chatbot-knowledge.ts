/**
 * Chatbot knowledge source configuration.
 * Ordered list of repo doc paths (relative to project root) and optional section titles.
 * The homepage chatbot fetches concatenated content from these files via GET /api/knowledge or GET /api/knowledge/chatbot.
 * Edit this list to add or remove docs; source of truth stays in git.
 */

import { readFile } from 'fs/promises'
import path from 'path'

export interface ChatbotKnowledgeEntry {
  /** Path relative to project root (e.g. docs/user-help-guide.md) */
  path: string
  /** Optional section header shown before this doc's content (e.g. "User Help Guide") */
  sectionTitle?: string
}

/** Ordered list of docs included in chatbot knowledge. */
export const CHATBOT_KNOWLEDGE_SOURCES: ChatbotKnowledgeEntry[] = [
  { path: 'docs/user-help-guide.md', sectionTitle: 'User Help Guide' },
  { path: 'docs/admin-sales-lead-pipeline-sop.md', sectionTitle: 'Admin & Sales Lead Pipeline (overview)' },
  { path: 'README.md', sectionTitle: 'Project overview' },
]

/**
 * Build concatenated markdown from CHATBOT_KNOWLEDGE_SOURCES (reads from filesystem).
 * Used by GET /api/knowledge and GET /api/knowledge/chatbot.
 */
export async function getChatbotKnowledgeBody(): Promise<{ body: string } | { error: string; status: 404 | 500 }> {
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
