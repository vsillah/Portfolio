import { describe, expect, it } from 'vitest'

import {
  assertDeterministicVisualRenderRequest,
  buildDeterministicVisualAssetPatch,
  deterministicVisualCandidateHash,
  deterministicVisualRenderInputHash,
  deterministicVisualStoragePath,
  projectDeterministicVisualRender,
  readDeterministicVisualSpec,
} from './social-deterministic-visual'
import {
  buildDeterministicVisualSvg,
  renderDeterministicVisualPng,
} from './social-deterministic-visual-renderer'
import { practitionerContentQaFixture } from './social-practitioner-content-qa-fixture'
import { socialCopyVersion } from './social-copy-revision'

function approvedItem() {
  const item = practitionerContentQaFixture('ready') as any
  item.id = 'social-1'
  item.status = 'approved'
  item.rag_context.source = 'social_content_calendar_authorization'
  item.rag_context.calendar_item_id = 'calendar-1'
  item.rag_context.publish_gate = 'draft_only'
  item.rag_context.qa_fixture = undefined
  return item
}

function renderPatch(item = approvedItem()) {
  const copyVersion = socialCopyVersion(item)
  const spec = readDeterministicVisualSpec(item.rag_context)!
  const candidateHash = deterministicVisualCandidateHash(spec)
  const brandAssetHash = 'b'.repeat(64)
  const renderInputHash = deterministicVisualRenderInputHash({ copyVersion, candidateHash, visualType: item.framework_visual_type, brandAssetHash })
  const storagePath = deterministicVisualStoragePath({
    socialContentId: item.id,
    copyVersion,
    candidateId: spec.candidate.candidate_id,
    renderInputHash,
  })
  return buildDeterministicVisualAssetPatch({
    item,
    copyVersion,
    candidateHash,
    renderInputHash,
    brandAssetHash,
    assetSha256: 'a'.repeat(64),
    assetUrl: `https://storage.example/storage/v1/object/public/social-content/${storagePath}`,
    storagePath,
    actor: 'admin-1',
    renderedAt: '2026-10-10T20:05:00.000Z',
  })
}

describe('deterministic Social Content visual binding', () => {
  it('hashes candidate content while ignoring lifecycle status and artifact URL', () => {
    const spec = readDeterministicVisualSpec(approvedItem().rag_context)!
    const currentHash = deterministicVisualCandidateHash(spec)
    expect(deterministicVisualCandidateHash({
      ...spec,
      candidate: { ...spec.candidate, status: 'approved', artifact_url: 'https://storage.example/current.png' },
    })).toBe(currentHash)
    expect(deterministicVisualCandidateHash({ ...spec, headline: `${spec.headline} changed` })).not.toBe(currentHash)
    expect(deterministicVisualCandidateHash({
      ...spec,
      architecture: {
        ...spec.architecture!,
        connectors: spec.architecture!.connectors.map((connector, index) => (
          index === 0 ? { ...connector, label: `${connector.label} changed` } : connector
        )),
      },
    })).not.toBe(currentHash)
  })

  it('projects ready, current, stale, missing-candidate, and storage-blocked states', () => {
    const item = approvedItem()
    const copyVersion = socialCopyVersion(item)
    const ready = projectDeterministicVisualRender({ item, copyVersion, storageAvailable: true })
    expect(ready).toMatchObject({ state: 'ready', code: 'ready', can_render: true, provider: 'none', provider_calls_enabled: false })

    Object.assign(item, renderPatch(item))
    const current = projectDeterministicVisualRender({ item, copyVersion, storageAvailable: true })
    expect(current).toMatchObject({ state: 'current', code: 'already_current', can_render: false })

    item.rag_context.deterministic_visual_asset.provider_receipt.external_call = true
    expect(projectDeterministicVisualRender({ item, copyVersion, storageAvailable: true })).toMatchObject({
      state: 'ready', code: 'asset_stale', can_render: true,
    })
    item.rag_context.deterministic_visual_asset.provider_receipt.external_call = false

    item.rag_context.deterministic_visual_asset.copy_version = '0'.repeat(64)
    const stale = projectDeterministicVisualRender({ item, copyVersion, storageAvailable: true })
    expect(stale).toMatchObject({ state: 'ready', code: 'asset_stale', can_render: true })

    const missing = approvedItem()
    missing.rag_context.practitioner_content_quality.deterministic_visual.candidate.candidate_id = ''
    expect(projectDeterministicVisualRender({ item: missing, copyVersion: socialCopyVersion(missing), storageAvailable: true })).toMatchObject({
      state: 'blocked', code: 'candidate_missing', can_render: false,
    })

    expect(projectDeterministicVisualRender({ item: approvedItem(), copyVersion, storageAvailable: false })).toMatchObject({
      state: 'blocked', code: 'storage_unavailable', can_render: false,
    })

    const unsupported = approvedItem()
    unsupported.rag_context.practitioner_content_quality.deterministic_visual.system_version = 'unsupported'
    expect(projectDeterministicVisualRender({ item: unsupported, copyVersion: socialCopyVersion(unsupported), storageAvailable: true })).toMatchObject({
      state: 'blocked', code: 'candidate_missing', can_render: false,
    })
  })

  it('binds architecture as a strict visual type and blocks mismatched or disconnected candidates', () => {
    const mismatched = approvedItem()
    mismatched.framework_visual_type = 'timeline'
    expect(projectDeterministicVisualRender({
      item: mismatched,
      copyVersion: socialCopyVersion(mismatched),
      storageAvailable: true,
    })).toMatchObject({
      state: 'blocked',
      code: 'visual_type_mismatch',
      can_render: false,
      recovery_action: expect.stringMatching(/exactly matches/i),
    })

    const disconnected = approvedItem()
    disconnected.rag_context.practitioner_content_quality.deterministic_visual.architecture.connectors = []
    expect(projectDeterministicVisualRender({
      item: disconnected,
      copyVersion: socialCopyVersion(disconnected),
      storageAvailable: true,
    })).toMatchObject({
      state: 'blocked',
      code: 'architecture_structure_invalid',
      can_render: false,
      summary: expect.stringMatching(/explicit connectors/i),
      recovery_action: expect.stringMatching(/three labeled architecture nodes and two labeled connectors/i),
    })
  })

  it('rejects stale copy and candidate hashes before rendering', () => {
    const item = approvedItem()
    const projection = projectDeterministicVisualRender({ item, copyVersion: socialCopyVersion(item), storageAvailable: true })
    expect(() => assertDeterministicVisualRenderRequest({
      projection,
      expectedCopyVersion: 'stale',
      expectedCandidateId: projection.candidate_id,
      expectedCandidateHash: projection.candidate_hash,
    })).toThrow('Copy changed')
    expect(() => assertDeterministicVisualRenderRequest({
      projection,
      expectedCopyVersion: projection.copy_version,
      expectedCandidateId: projection.candidate_id,
      expectedCandidateHash: 'changed',
    })).toThrow('candidate content changed')
  })

  it('builds a provider-none receipt and resets downstream asset decisions', () => {
    const item = approvedItem()
    item.rag_context.section_gate_reviews = {
      visual_assets: { status: 'approved' },
      privacy: { status: 'approved' },
    }
    const patch = renderPatch(item)
    expect(patch.rag_context.deterministic_visual_asset).toMatchObject({
      status: 'current',
      social_content_id: 'social-1',
      provider_receipt: { provider: 'none', model: null, status: 'not_called', external_call: false },
      provider_calls: { gemini: false, heygen: false, n8n_media: false, other_media: false },
      external_actions: { provider_upload: false, platform_draft: false, schedule: false, publish: false, external_send: false },
    })
    expect((patch.rag_context.section_gate_reviews as any).visual_assets).toMatchObject({ status: 'pending', invalidation_reason: 'deterministic_asset_rendered' })
    expect((patch.rag_context.section_gate_reviews as any).privacy).toMatchObject({ status: 'pending', invalidation_reason: 'deterministic_asset_rendered' })
    expect(patch.rag_context.linkedin_draft_handoff).toBeNull()
    expect(patch.content_format).toBe('single_image')
  })

  it('escapes candidate text before producing SVG markup', () => {
    const spec = readDeterministicVisualSpec(approvedItem().rag_context)!
    const svg = buildDeterministicVisualSvg({ ...spec, headline: '<script>alert("x")</script>' }, 'architecture')
    expect(svg).toContain('&lt;script&gt;')
    expect(svg).not.toContain('<script>')
  })

  it.each(['1.91:1', '1:1', '4:5', '9:16'] as const)(
    'keeps internal governance wording out of the %s publication asset',
    (aspectRatio) => {
      const spec = readDeterministicVisualSpec(approvedItem().rag_context)!
      const svg = buildDeterministicVisualSvg({ ...spec, aspect_ratio: aspectRatio }, 'architecture')
      expect(svg).toContain('AmaduTown Advisory Solutions')
      expect(svg).toContain('data-visual-type="architecture"')
      expect(svg.match(/data-architecture-node=/g)).toHaveLength(3)
      expect(svg.match(/data-architecture-connector=/g)).toHaveLength(2)
      expect(svg.match(/marker-end="url\(#architecture-arrow\)"/g)).toHaveLength(2)
      expect(svg).not.toMatch(/deterministic\s+review\s+asset/i)
      expect(svg).not.toMatch(/provider\s+(?:none|not[\s_-]*called|disabled|off)/i)
      expect(svg).not.toMatch(/human\s+approval\s+(?:required|pending)/i)
      expect(svg).not.toMatch(/approval\s+(?:required|pending)/i)
      expect(svg).not.toMatch(/external\s+call\s+(?:false|disabled|off)/i)
      expect(svg).not.toMatch(/internal\s+(?:review|governance|only)/i)
      expect(svg).not.toMatch(/(?:for\s+)?review\s+only/i)
      expect(svg).not.toMatch(/not\s+for\s+publication/i)
      expect(svg).not.toMatch(/draft\s+asset/i)
    },
  )

  it('fails closed before PNG rasterization when candidate text contains an internal governance note', async () => {
    const spec = readDeterministicVisualSpec(approvedItem().rag_context)!
    await expect(renderDeterministicVisualPng({
      spec: { ...spec, headline: 'Provider none — human approval required' },
      visualType: 'architecture',
      logoPng: Buffer.alloc(0),
    })).rejects.toThrow('not safe for publication')
  })

  it('refuses to substitute the architecture composition for another selected visual type', () => {
    const spec = readDeterministicVisualSpec(approvedItem().rag_context)!
    expect(() => buildDeterministicVisualSvg(spec, 'timeline')).toThrow('does not match candidate visual type')
  })
})
