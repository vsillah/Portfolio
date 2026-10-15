import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ArtifactEvidenceTrace from '@/components/admin/ArtifactEvidenceTrace'
import { ARTIFACT_EVIDENCE_CATEGORIES } from '@/lib/artifact-evidence-manifest'
import { completeArtifactEvidenceManifest } from '@/lib/__tests__/artifact-evidence-fixture'

const VERSION = '2026-10-15T12:00:00.000Z'

const manifest = () => completeArtifactEvidenceManifest(VERSION)

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

  it('keeps numerical evaluation inside selected proof and links dimensions to exact receipts', () => {
    render(<ArtifactEvidenceTrace manifest={manifest()} currentContentVersion={VERSION} />)
    fireEvent.click(screen.getByRole('button', { name: /Trace evidence/i }))
    fireEvent.click(within(screen.getByLabelText('Artifact trace list')).getByRole('button', { name: /copy_script evidence/i }))

    const evaluation = screen.getByLabelText('copy_script evidence numerical evaluation')
    expect(within(evaluation).getByText('88.8/100 · advance')).toBeVisible()
    expect(within(evaluation).getByText('Outlier-pattern fit')).toBeVisible()
    fireEvent.click(within(evaluation).getByText('Source support'))
    for (const link of within(evaluation).getAllByRole('link', { name: /evidence:copy_script-0:source_support/i })) {
      expect(link).toHaveAttribute('href', expect.stringContaining('/admin/source-protocol'))
    }
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
