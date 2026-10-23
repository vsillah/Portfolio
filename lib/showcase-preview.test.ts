import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveShowcasePreview, SHOWCASE_PREVIEW_VISUALS } from './showcase-preview'

type AuditRow = {
  entity: string
  id: string
  current_visual: string | null
  classification: string
  proposed_visual: string | null
  source_evidence: string
  blocker_recovery: string
}

const audit = JSON.parse(readFileSync(path.join(process.cwd(), 'docs/showcase-audit/public-offerings-2026-10-22.json'), 'utf8')) as { rows: AuditRow[] }

describe('public showcase preview contract', () => {
  it('accounts for every card in the observed public snapshot', () => {
    expect(audit.rows).toHaveLength(32)
    expect(audit.rows.filter((row) => row.entity === 'product')).toHaveLength(6)
    expect(audit.rows.filter((row) => row.entity === 'service')).toHaveLength(9)
    expect(audit.rows.filter((row) => row.entity === 'merchandise')).toHaveLength(6)
    expect(audit.rows.filter((row) => row.entity === 'publication')).toHaveLength(3)
    expect(audit.rows.filter((row) => row.entity === 'project')).toHaveLength(4)
    expect(audit.rows.filter((row) => row.entity === 'prototype')).toHaveLength(4)
    expect(audit.rows.every((row) => row.id && row.current_visual !== undefined && row.source_evidence && row.blocker_recovery)).toBe(true)
  })

  it('uses a unique identity and an exact source URL for each candidate', () => {
    const keys = SHOWCASE_PREVIEW_VISUALS.map((v) => `${v.entity}:${v.id}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (const visual of SHOWCASE_PREVIEW_VISUALS) {
      const row = audit.rows.find((item) => item.entity === visual.entity && item.id === visual.id)
      expect(row).toBeTruthy()
      expect(row?.current_visual ?? null).toBe(visual.expectedCurrentUrl)
      expect(row?.proposed_visual).toBe(visual.previewUrl)
      expect(existsSync(path.join(process.cwd(), 'public', visual.previewUrl))).toBe(true)
      expect(resolveShowcasePreview(visual.entity, visual.id, visual.expectedCurrentUrl)?.previewUrl).toBe(visual.previewUrl)
      expect(resolveShowcasePreview(visual.entity, visual.id, '/changed-image.png')).toBeNull()
      expect(resolveShowcasePreview(visual.entity, visual.id, visual.expectedCurrentUrl)?.previewUrl).toBe(visual.previewUrl)
    }
  })

  it('binds ManifestR to a labeled concept based on the verified product identity', () => {
    const manifest = audit.rows.find((row) => row.id === 'cbba8f12-9257-4320-a361-f3f7455dafe2')
    expect(manifest?.classification).toContain('source-grounded illustrative concept')
    expect(manifest?.proposed_visual).toBe('/showcases/manifestr-vision-concept.svg')
    expect(manifest?.source_evidence).toContain('provider-free Studio render')
    expect(SHOWCASE_PREVIEW_VISUALS.some((visual) => visual.id === manifest?.id)).toBe(true)
    const svg = readFileSync(path.join(process.cwd(), 'public/showcases/manifestr-vision-concept.svg'), 'utf8')
    expect(svg).toContain('ILLUSTRATIVE CONCEPT')
    expect(svg).not.toContain('<image')
  })

  it('labels every concept in the asset and in metadata', () => {
    for (const visual of SHOWCASE_PREVIEW_VISUALS.filter((v) => v.kind === 'illustrative_concept')) {
      const svgPath = visual.previewUrl.endsWith('.png') ? visual.previewUrl.replace(/\.png$/, '.svg') : visual.previewUrl
      const svg = readFileSync(path.join(process.cwd(), 'public', svgPath), 'utf8')
      expect(svg).toContain('ILLUSTRATIVE CONCEPT')
      expect(visual.alt.toLowerCase()).toContain('illustrative concept')
    }
  })

  it('keeps the diagnostic preview free of operator and account fields', () => {
    const svg = readFileSync(path.join(process.cwd(), 'public/showcases/product-diagnostic-concept-v2.svg'), 'utf8')
    expect(svg).not.toMatch(/Vambah Sillah|vsi|linkedin\.com|amadutown\.com|financial revenue/i)
    expect(svg).toContain('NO CUSTOMER DATA')
    expect(existsSync(path.join(process.cwd(), 'public/showcases/product-diagnostic-capture.png'))).toBe(false)
  })

  it('shows the complete source-derived lead workflow without a clipped source crop', () => {
    const svg = readFileSync(path.join(process.cwd(), 'public/showcases/product-leadgen-workflow-v2.svg'), 'utf8')
    for (const stage of ['New lead', 'Research agent', 'Data extraction', 'Lead score', 'Team notification']) {
      expect(svg).toContain(stage)
    }
    expect(svg).not.toContain('<image')
    expect(existsSync(path.join(process.cwd(), 'public/showcases/product-leadgen-capture.png'))).toBe(false)
  })
})
