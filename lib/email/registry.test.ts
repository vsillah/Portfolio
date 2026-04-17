import { describe, expect, it } from 'vitest'
import { EMAIL_TEMPLATE_REGISTRY, getRegistryEntryById } from '@/lib/email/registry'

describe('EMAIL_TEMPLATE_REGISTRY', () => {
  it('has unique ids', () => {
    const ids = EMAIL_TEMPLATE_REGISTRY.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('static entries with preview return non-empty html', () => {
    for (const e of EMAIL_TEMPLATE_REGISTRY) {
      if (e.mode === 'static' && e.getPreviewHtml) {
        const html = e.getPreviewHtml()
        expect(html.length).toBeGreaterThan(50)
        expect(html).toContain('<')
      }
    }
  })

  it('resolves llm entry by id', () => {
    const row = getRegistryEntryById('llm_email_cold_outreach')
    expect(row?.mode).toBe('llm')
    expect(row?.systemPromptKey).toBe('email_cold_outreach')
  })
})
