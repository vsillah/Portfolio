import { describe, expect, it, vi } from 'vitest'
vi.mock('./slack-agent-environment', () => ({ getSlackAgentSource: () => ({ sourceEnvironment: 'production', sourceOrigin: 'https://portfolio.example.invalid', hosted: true }) }))
import { campaignReleaseSlackBlocks } from './campaign-release-slack'
import { fixture } from './campaign-release-test-fixture'
import { releaseHash } from './campaign-release-manifest'
import { decodeSlackActionValue } from './agent-slack-blocks'
describe('campaign release Slack card', () => {
  it('binds each decision to the exact manifest and omits private copy and recipients', () => {
    const manifest = fixture(), hash = releaseHash(manifest)
    const blocks = campaignReleaseSlackBlocks({ manifest, hash, state: 'pending', version: 1, audit: [] })
    const actions = blocks.find(block => block.type === 'actions')!
    if (actions.type !== 'actions') throw new Error('Missing actions')
    expect(actions.elements.map(button => button.text.text)).toEqual(['Approve release', 'Request revision', 'Hold', 'Open in Portfolio', 'Emergency stop'])
    for (const button of actions.elements.filter(button => button.value)) {
      expect(decodeSlackActionValue(button.value)).toMatchObject({ runId: manifest.releaseId, manifestHash: hash, schemaVersion: 'campaign-release/v1' })
    }
    expect(JSON.stringify(blocks)).not.toContain(manifest.actions[0].copy.body)
    expect(actions.elements[4].style).toBe('danger')
    expect(actions.elements[3].url).toContain(`?release=${manifest.releaseId}`)
  })
})
