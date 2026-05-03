import { describe, expect, it } from 'vitest'

import { CHATBOT_KNOWLEDGE_SOURCES, getChatbotKnowledgeBody } from '../chatbot-knowledge'

describe('chatbot knowledge corpus', () => {
  it('includes the public-safe personality corpus source', () => {
    expect(CHATBOT_KNOWLEDGE_SOURCES).toContainEqual({
      path: 'docs/vambah-personality-public-safe.md',
      sectionTitle: 'Vambah Personality Corpus (public-safe)',
    })
  })

  it('loads the personality corpus in the chatbot knowledge body', async () => {
    const result = await getChatbotKnowledgeBody()

    expect(result).toHaveProperty('body')
    if (!('body' in result)) return

    expect(result.body).toContain('## Source: Vambah Personality Corpus (public-safe)')
    expect(result.body).toContain('Source pack: `2026.05.03-d2eabc3d4b55`')
    expect(result.body).toContain('raw_private_content_included: false')
  })
})
