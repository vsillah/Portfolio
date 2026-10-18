import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { deterministicSha256Hex } from '../../lib/deterministic-sha256.mjs'

const root = process.cwd()
const buildScriptPath = path.join(root, 'scripts/qa/build-social-campaign-youtube-thumbnails.mjs')
const decisions = [
  JSON.parse(readFileSync(path.join(root, 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/thumbnail-decision-receipt.json'), 'utf8')),
  JSON.parse(readFileSync(path.join(root, 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/thumbnail-decision-receipt.json'), 'utf8')),
]
const selections = [
  JSON.parse(readFileSync(path.join(root, 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/dark-castle-thumbnail-selection-receipt.json'), 'utf8')),
  JSON.parse(readFileSync(path.join(root, 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/ai-audit-thumbnail-selection-receipt.json'), 'utf8')),
]

describe('YouTube thumbnail v3 generation contract', () => {
  it('keeps both live decisions canonically fingerprinted and playlist calibration at zero performance weight', () => {
    for (const decision of decisions) {
      const { version: _version, receipt_id: _receiptId, route: _route, input_version: inputVersion, output_version: _outputVersion, selection: _selection, ...canonicalInput } = decision
      expect(inputVersion).toBe(`sha256:${deterministicSha256Hex(JSON.stringify(canonicalInput))}`)
      expect(decision.selection.status).toBe('ready')
      expect(decision.live_evidence.comparisons.filter((sample: { decision: string }) => sample.decision === 'included').length).toBeGreaterThanOrEqual(decision.live_evidence.minimum_sample_size)
      expect(decision.live_evidence.comparisons.some((sample: { outlier_qualified: boolean }) => sample.outlier_qualified)).toBe(true)
      expect(decision.user_preference_signals).toHaveLength(1)
      expect(decision.user_preference_signals[0]).toMatchObject({
        evidence_role: 'taste_calibration_only',
        performance_weight: 0,
        performance_status: 'unscored',
      })
      expect(decision.user_preference_signals[0].item_identities).toHaveLength(14)
      expect(decision.user_preference_signals[0].applied_traits).toEqual(expect.arrayContaining([
        'one dominant human or product focal object',
        'one-second comprehension',
        'short large teaser copy',
        'clear title-thumbnail contrast',
        'strong feed-size contrast',
        'one simplified first-party proof object',
      ]))
    }
    expect(new Set(decisions.map((decision) => decision.selection.selected_composition)).size).toBe(2)
    expect(new Set(decisions.map((decision) => decision.candidate_identity.composition_signature)).size).toBe(2)
  })

  it('fails closed before rasterization when fresh campaign-specific HeyGen identity remixes are absent', () => {
    const environment = { ...process.env }
    for (const prefix of ['DARK_CASTLE', 'AI_AUDIT']) {
      for (const suffix of ['HEYGEN_IMAGE_PATH', 'HEYGEN_IMAGE_URL', 'HEYGEN_IDENTITY_RECEIPT_ID', 'HEYGEN_LOOK_ID', 'HEYGEN_ENVIRONMENT', 'HEYGEN_ALTERNATE_IMAGE_PATH', 'HEYGEN_ALTERNATE_IMAGE_URL', 'HEYGEN_ALTERNATE_LOOK_ID', 'HEYGEN_ALTERNATE_ENVIRONMENT']) {
        delete environment[`${prefix}_${suffix}`]
      }
    }
    const result = spawnSync(process.execPath, [buildScriptPath], { cwd: root, env: environment, encoding: 'utf8' })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('fresh HeyGen Pro identity remix is required')
  })

  it('binds each final v3 output to a distinct HeyGen primary and governed alternate', () => {
    for (const selection of selections) {
      expect(selection.receipt_id).toMatch(/^thumbnail:.+:youtube-long-form:20261018:v3$/)
      expect(selection.identity_remix_rotation).toMatchObject({ provider: 'heygen_pro', included_credit_count: 1 })
      expect(selection.identity_remix_rotation.primary.source_url).toMatch(/^https:\/\/dynamic\.heygen\.ai\//)
      expect(selection.identity_remix_rotation.primary.role).toBe('selected_primary')
      expect(selection.identity_remix_rotation.alternates).toHaveLength(1)
      expect(selection.identity_remix_rotation.alternates[0]).toMatchObject({ role: 'governed_rotation_input' })
      expect(selection.identity_remix_rotation.alternates[0].source_url).not.toBe(selection.identity_remix_rotation.primary.source_url)
      expect(selection.first_party_supporting_sources[0]).toMatchObject({ rights_status: 'approved_identity_remix_review_only' })
      const outputPath = path.join(root, 'public', selection.output.artifact_url)
      expect(selection.output.sha256).toBe(`sha256:${createHash('sha256').update(readFileSync(outputPath)).digest('hex')}`)
    }
    expect(new Set(selections.map((selection) => selection.composition.layout_family)).size).toBe(2)
    expect(new Set(selections.map((selection) => selection.identity_remix_rotation.primary.look_id)).size).toBe(2)
    expect(new Set(selections.map((selection) => selection.identity_remix_rotation.primary.background_environment)).size).toBe(2)
  })

  it('does not reference a reusable local portrait fallback', () => {
    const script = readFileSync(buildScriptPath, 'utf8')
    expect(script).not.toContain('Profile_Photo_1.jpg')
    expect(script).not.toContain('vambah-approved-profile.jpg')
    expect(script).toContain('approved_identity_remix_review_only')
  })
})
