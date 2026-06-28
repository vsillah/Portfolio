import { describe, expect, it } from 'vitest'
import {
  evaluateVideoScript,
  scriptTemplatePromptBlock,
  SEEDED_VIDEO_SCRIPT_TEMPLATES,
} from './video-script-intelligence'

describe('video-script-intelligence', () => {
  it('blocks scripts with no clear pain point or CTA before render', () => {
    const scorecard = evaluateVideoScript({
      scriptText: 'This is a general lesson about AI and product work.',
      outline: {
        hook: 'AI and product work.',
      },
    })

    expect(scorecard.blockers).toEqual(expect.arrayContaining([
      'Script needs a clearer audience pain point before render.',
      'Script needs an explicit CTA before render.',
    ]))
    expect(scorecard.overall_score).toBeLessThan(60)
  })

  it('passes a source-safe Accelerated script outline with a visible CTA', () => {
    const scorecard = evaluateVideoScript({
      scriptText: 'The problem is that AI can create faster than teams can govern. I built the Portfolio workflow to show the receipt. Join the Accelerated Workshop interest path if you want the operating loop.',
      outline: {
        pain_point: 'AI can create faster than teams can govern.',
        hook: 'AI can create faster than teams can govern.',
        open_loop: 'Show the operating loop that closes the gap.',
        proof_demo: 'I built the Portfolio workflow to show the receipt.',
        cta: 'Join the Accelerated Workshop interest path.',
        source_distance_notes: 'AmaduTown original proof.',
      },
    })

    expect(scorecard.blockers).toEqual([])
    expect(scorecard.cta_clarity).toBeGreaterThanOrEqual(75)
    expect(scorecard.source_distance_safety).toBeGreaterThanOrEqual(75)
  })

  it('adds selected template and research pattern evidence to the prompt block', () => {
    const block = scriptTemplatePromptBlock(
      SEEDED_VIDEO_SCRIPT_TEMPLATES[0],
      [
        {
          title: 'Useful outlier',
          source_url: 'https://youtu.be/IUE8o_e4uCY',
          hook_transcript: 'Most scripts fail because the opening does not name the pain.',
          pattern_packet: {
            hook_structure: 'Name the pain before the lesson.',
            promise_value: 'A repeatable structure.',
            cta_style: 'Ask viewers to apply it.',
          },
        },
      ],
    )

    expect(block).toContain('Selected script template: Killer script')
    expect(block).toContain('Approved public research pattern evidence')
    expect(block).toContain('Use these as outline patterns only')
  })
})
