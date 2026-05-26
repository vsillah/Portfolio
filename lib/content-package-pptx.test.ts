import { describe, expect, it } from 'vitest'
import {
  buildContentPackagePptxBuffer,
  contentPackagePptxFileName,
} from './content-package-pptx'

describe('content package pptx builder', () => {
  it('generates a non-empty PowerPoint buffer', async () => {
    const buffer = await buildContentPackagePptxBuffer({
      title: 'Voice Notes Should Become Content Systems',
      sourcePacket: {
        source_type: 'voice_note',
        topic: 'Voice-note content workflow',
        transcript_excerpt: 'A raw voice note can become a LinkedIn post, a PowerPoint deck, a video script, and a governed approval packet.',
        target_audience: 'operators and founders',
        target_outputs: ['linkedin_post', 'pptx_deck', 'video_script'],
        transcript_characters: 132,
      },
      researchPacket: {
        framework_summary: [
          { creator_name: 'Alex Hormozi', display_name: 'Value Equation' },
          { creator_name: 'Nick Saraev', display_name: 'AI Content Engine' },
        ],
        amadutown_proof_routes: [
          { label: 'Agent Ops Mission Control', route: '/admin/agents' },
          { label: 'Social Content Queue', route: '/admin/social-content' },
        ],
        source_candidates: ['https://amadutown.com/'],
        broll_hints: ['agent ops', 'social content'],
      },
      presentationPlan: {
        requiredAssets: ['Agent Ops screenshot', 'Social Content Queue screenshot'],
      },
      outputs: [
        {
          output_type: 'linkedin_post',
          title: 'LinkedIn',
          body: 'A voice note is not just a reminder. It can be the first draft of a system.',
          payload: {},
        },
        {
          output_type: 'pptx_deck',
          title: 'Deck',
          body: 'Deck brief',
          payload: {},
        },
        {
          output_type: 'video_script',
          title: 'Script',
          body: 'At AmaduTown, the system has to capture the note and hold the publishing gate until a human approves it.',
          payload: {},
        },
      ],
    })

    expect(buffer.length).toBeGreaterThan(40_000)
    expect(buffer.subarray(0, 2).toString()).toBe('PK')
  })

  it('creates a safe deck filename', () => {
    expect(contentPackagePptxFileName('Voice Notes: Content Systems!')).toBe('voice-notes-content-systems.pptx')
  })
})
