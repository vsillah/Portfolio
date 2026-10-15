import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ArtifactEvidenceTrace from '@/components/admin/ArtifactEvidenceTrace'
import { ARTIFACT_EVIDENCE_CATEGORIES, type ArtifactEvidenceManifest } from '@/lib/artifact-evidence-manifest'

const VERSION = '2026-10-15T12:00:00.000Z'

function manifest(): ArtifactEvidenceManifest {
  return {
    version: 'artifact-evidence-manifest/v1',
    manifest_id: 'artifact-manifest:test:v1',
    manifest_hash: `sha256:${'a'.repeat(64)}`,
    content_version: VERSION,
    artifact_label: 'Traceable customer artifact',
    preview_url: '/review-assets/social-content/jev-customer-facing-poster.png',
    preview_alt: 'Traceable artifact preview',
    final_output_hashes: [{ label: 'MP4', sha256: 'b'.repeat(64) }],
    elements: ARTIFACT_EVIDENCE_CATEGORIES.map((category, index) => ({
      id: `${category}-${index}`,
      category,
      label: category === 'source_research' ? 'Private research summary' : `${category} evidence`,
      input_excerpt: `Bounded ${category} input`,
      customer_facing: category !== 'source_research' && category !== 'transformation',
      review_only: category === 'source_research' || category === 'transformation',
      redacted: category === 'source_research',
      source_identity: `source:${category}`,
      source_record_type: 'portfolio_source_record',
      authoritative_href: `/admin/source-protocol?receipt=${category}`,
      evidence_receipt_ids: [`evidence:${category}`],
      version_hash: `sha256:${'c'.repeat(64)}`,
      content_version: VERSION,
      rights_privacy_status: 'passed' as const,
      rights_privacy_receipt_ids: [`rights:${category}`],
      transformation_step: `Bind ${category}.`,
      ...(index < 3 ? { region: { x: 20 + index * 20, y: 30 } } : {}),
    })),
  }
}

describe('ArtifactEvidenceTrace', () => {
  it('keeps the artifact clean by default and maps overlay numbers exactly to the trace list when enabled', () => {
    render(<ArtifactEvidenceTrace manifest={manifest()} currentContentVersion={VERSION} />)
    expect(screen.queryByLabelText('Artifact trace list')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Trace 1:/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Trace evidence/i }))

    const list = screen.getByLabelText('Artifact trace list')
    expect(within(list).getAllByRole('button')).toHaveLength(ARTIFACT_EVIDENCE_CATEGORIES.length)
    expect(screen.getByRole('button', { name: /Trace 1: copy_script evidence/i })).toHaveTextContent('1')
    expect(within(list).getAllByRole('button')[0]).toHaveTextContent('1')
  })

  it('opens compact proof from keyboard-operable controls and exposes the exact safe deep link', () => {
    render(<ArtifactEvidenceTrace manifest={manifest()} currentContentVersion={VERSION} />)
    fireEvent.click(screen.getByRole('button', { name: /Trace evidence/i }))
    const trace = screen.getByRole('button', { name: /Trace 1: copy_script evidence/i })
    trace.focus()
    fireEvent.keyDown(trace, { key: 'Enter' })
    fireEvent.click(trace)
    const detail = screen.getByLabelText('Trace 1 evidence detail')
    expect(detail).toBeVisible()
    expect(within(detail).getByRole('link', { name: 'Open authoritative evidence' })).toHaveAttribute('href', '/admin/source-protocol?receipt=copy_script')
  })

  it('remains usable at mobile width and never reveals a private source excerpt', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    render(<ArtifactEvidenceTrace manifest={manifest()} currentContentVersion={VERSION} />)
    fireEvent.click(screen.getByRole('button', { name: /Trace evidence/i }))
    fireEvent.click(screen.getByRole('button', { name: /Private research summary/i }))
    expect(screen.getByText('[Private source withheld — approved summary only]')).toBeVisible()
    expect(screen.queryByText('Bounded source_research input')).not.toBeInTheDocument()
  })

  it('shows a readable historical manifest receipt after the content version advances', () => {
    render(<ArtifactEvidenceTrace manifest={manifest()} currentContentVersion={VERSION} recordedSnapshot={{ manifest_id: 'artifact-manifest:old:v1', manifest_hash: `sha256:${'d'.repeat(64)}`, content_version: '2026-10-14T12:00:00.000Z' }} />)
    expect(screen.getByText(/preserved from an earlier content version/i)).toBeVisible()
    expect(screen.getByText(/artifact-manifest:old:v1/i)).toBeVisible()
  })
})
