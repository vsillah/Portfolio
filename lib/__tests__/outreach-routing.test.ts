/**
 * Lightweight unit tests for the constants + helpers that drive channel
 * routing on the lead-level outreach generation endpoint
 * (`/api/admin/outreach/leads/[id]/generate`) and the model whitelist
 * validation on the System Prompts admin (`/api/admin/prompts/[key]`).
 *
 * Wiring an actual HTTP route test would require a much heavier scaffolding
 * (Next request/response, auth, supabase). Pinning the helpers gives us a
 * fast regression net for the rules that decide:
 *   - which templates are allowed for which channel,
 *   - which models the dispatcher will accept,
 *   - which provider a given model id maps to.
 */

import { describe, expect, it } from 'vitest'

import {
  EMAIL_TEMPLATE_KEYS,
  LINKEDIN_TEMPLATE_KEYS,
  OUTREACH_CHANNELS,
  TEMPLATE_KEYS_BY_CHANNEL,
  isOutreachPromptKey,
} from '@/lib/constants/prompt-keys'
import {
  DEFAULT_OUTREACH_MODEL,
  SUPPORTED_OUTREACH_MODELS,
  getModelProvider,
  inferProvider,
  isSupportedOutreachModel,
} from '@/lib/constants/llm-models'

describe('outreach channel routing helpers', () => {
  it('OUTREACH_CHANNELS exposes exactly email and linkedin', () => {
    expect([...OUTREACH_CHANNELS].sort()).toEqual(['email', 'linkedin'])
  })

  it('TEMPLATE_KEYS_BY_CHANNEL.linkedin only contains LinkedIn template keys', () => {
    for (const key of TEMPLATE_KEYS_BY_CHANNEL.linkedin) {
      expect((LINKEDIN_TEMPLATE_KEYS as readonly string[]).includes(key)).toBe(true)
      expect((EMAIL_TEMPLATE_KEYS as readonly string[]).includes(key)).toBe(false)
    }
  })

  it('TEMPLATE_KEYS_BY_CHANNEL.email only contains email template keys', () => {
    for (const key of TEMPLATE_KEYS_BY_CHANNEL.email) {
      expect((EMAIL_TEMPLATE_KEYS as readonly string[]).includes(key)).toBe(true)
      expect((LINKEDIN_TEMPLATE_KEYS as readonly string[]).includes(key)).toBe(false)
    }
  })

  it('isOutreachPromptKey accepts email + linkedin template keys', () => {
    expect(isOutreachPromptKey('email_cold_outreach')).toBe(true)
    expect(isOutreachPromptKey('email_follow_up')).toBe(true)
    expect(isOutreachPromptKey('linkedin_cold_outreach')).toBe(true)
  })

  it('isOutreachPromptKey rejects non-outreach prompt keys', () => {
    expect(isOutreachPromptKey('chatbot')).toBe(false)
    expect(isOutreachPromptKey('llm_judge')).toBe(false)
    expect(isOutreachPromptKey('definitely_not_a_real_key')).toBe(false)
  })

  it('routing the wrong template to the wrong channel is detectable', () => {
    // Mimics the inline guard in the /generate route.
    const isAllowedForChannel = (
      channel: 'email' | 'linkedin',
      templateKey: string,
    ): boolean => TEMPLATE_KEYS_BY_CHANNEL[channel].includes(templateKey)

    expect(isAllowedForChannel('email', 'linkedin_cold_outreach')).toBe(false)
    expect(isAllowedForChannel('linkedin', 'email_follow_up')).toBe(false)
    expect(isAllowedForChannel('email', 'email_cold_outreach')).toBe(true)
    expect(isAllowedForChannel('linkedin', 'linkedin_cold_outreach')).toBe(true)
  })
})

describe('outreach model whitelist + provider inference', () => {
  it('SUPPORTED_OUTREACH_MODELS lists at least one OpenAI and one Anthropic model', () => {
    const providers = new Set(SUPPORTED_OUTREACH_MODELS.map((m) => m.provider))
    expect(providers.has('openai')).toBe(true)
    expect(providers.has('anthropic')).toBe(true)
  })

  it('DEFAULT_OUTREACH_MODEL is itself in the whitelist', () => {
    expect(isSupportedOutreachModel(DEFAULT_OUTREACH_MODEL)).toBe(true)
  })

  it('isSupportedOutreachModel rejects ids outside the whitelist', () => {
    expect(isSupportedOutreachModel('not-a-real-model')).toBe(false)
    expect(isSupportedOutreachModel('')).toBe(false)
  })

  it('getModelProvider resolves whitelisted ids', () => {
    expect(getModelProvider('gpt-4o-mini')).toBe('openai')
    expect(getModelProvider('claude-3-5-haiku-20241022')).toBe('anthropic')
    expect(getModelProvider('not-a-real-model')).toBeNull()
  })

  it('inferProvider falls back on naming heuristics for unknown ids', () => {
    // Whitelisted lookups still win.
    expect(inferProvider('gpt-4o')).toBe('openai')
    expect(inferProvider('claude-sonnet-4-20250514')).toBe('anthropic')
    // Unknown but `claude-*` should still go to Anthropic so legacy
    // config rows do not silently break.
    expect(inferProvider('claude-future-model')).toBe('anthropic')
    // Anything else defaults to OpenAI.
    expect(inferProvider('o1-preview')).toBe('openai')
    expect(inferProvider('gpt-5-blah')).toBe('openai')
  })
})
