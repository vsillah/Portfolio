import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ArtifactEvidenceTrace from '@/components/admin/ArtifactEvidenceTrace'
import { ARTIFACT_EVIDENCE_CATEGORIES } from '@/lib/artifact-evidence-manifest'
import { completeArtifactEvidenceManifest } from '@/lib/__tests__/artifact-evidence-fixture'
import { channelNativeVideoQaFixture } from '@/lib/social-channel-video-qa-fixture'

const VERSION = '2026-10-15T12:00:00.000Z'
const EVALUATION_AS_OF = '2026-10-16T12:00:00.000Z'

const manifest = () => completeArtifactEvidenceManifest(VERSION)

const packagingManifest = () => {
  const value = manifest()
  const title = value.elements.find((element) => element.category === 'title')!
  const thumbnail = value.elements.find((element) => element.category === 'thumbnail')!
  title.input_excerpt = 'AI Gave You a Score. Who Owns the Decision?'
  thumbnail.input_excerpt = 'WHO OWNS THE DECISION?'
  thumbnail.artifact_url = '/review-assets/social-content/jev-youtube-thumbnail.png'
  return value
}

describe('ArtifactEvidenceTrace', () => {
  it('keeps the artifact clean by default and maps overlay numbers exactly to the trace list when enabled', () => {
    render(<ArtifactEvidenceTrace manifest={manifest()} currentContentVersion={VERSION} evaluationAsOf={EVALUATION_AS_OF} />)
    expect(screen.queryByLabelText('Artifact trace list')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Trace 1:/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Trace evidence/i }))

    const list = screen.getByLabelText('Artifact trace list')
    expect(within(list).getAllByRole('button')).toHaveLength(ARTIFACT_EVIDENCE_CATEGORIES.length)
    expect(screen.getByRole('button', { name: /Trace 1: copy_script evidence/i })).toHaveTextContent('1')
    expect(within(list).getAllByRole('button')[0]).toHaveTextContent('1')
  })

  it('opens compact proof from keyboard-operable controls and exposes the exact safe deep link', () => {
    render(<ArtifactEvidenceTrace manifest={manifest()} currentContentVersion={VERSION} evaluationAsOf={EVALUATION_AS_OF} />)
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
    render(<ArtifactEvidenceTrace manifest={manifest()} currentContentVersion={VERSION} evaluationAsOf={EVALUATION_AS_OF} />)
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
    render(<ArtifactEvidenceTrace manifest={manifest()} currentContentVersion={VERSION} evaluationAsOf={EVALUATION_AS_OF} />)
    fireEvent.click(screen.getByRole('button', { name: /Trace evidence/i }))
    fireEvent.click(screen.getByRole('button', { name: /Private research summary/i }))
    expect(screen.getByText('[Private source withheld — approved summary only]')).toBeVisible()
    expect(screen.queryByText('Bounded source_research input')).not.toBeInTheDocument()
  })

  it('shows a readable historical manifest receipt after the content version advances', () => {
    render(<ArtifactEvidenceTrace manifest={manifest()} currentContentVersion={VERSION} evaluationAsOf={EVALUATION_AS_OF} recordedSnapshot={{ manifest_id: 'artifact-manifest:old:v1', manifest_hash: `sha256:${'d'.repeat(64)}`, content_version: '2026-10-14T12:00:00.000Z' }} />)
    expect(screen.getByText(/preserved from an earlier content version/i)).toBeVisible()
    expect(screen.getByText(/artifact-manifest:old:v1/i)).toBeVisible()
  })

  it('shows the YouTube title and actual bound thumbnail together with progressive evidence details', () => {
    render(<ArtifactEvidenceTrace manifest={packagingManifest()} currentContentVersion={VERSION} evaluationAsOf={EVALUATION_AS_OF} packagingTarget="youtube_shorts" />)

    const packaging = screen.getByLabelText('YouTube Shorts packaging evidence')
    expect(within(packaging).getAllByText('AI Gave You a Score. Who Owns the Decision?')[0]).toBeVisible()
    expect(within(packaging).getAllByText('WHO OWNS THE DECISION?')[0]).toBeVisible()
    expect(within(packaging).getByRole('status')).toHaveTextContent('Asset-package evidence ready')
    expect(within(packaging).getByText('YouTube Shorts asset-package review')).toHaveClass('text-muted-foreground')
    expect(within(packaging).getByText('YouTube Shorts asset-package review')).not.toHaveClass('text-red-700')
    expect(within(packaging).getByAltText(/YouTube Shorts bound thumbnail/i)).toHaveAttribute('src', expect.stringContaining('jev-youtube-thumbnail.png'))

    const titleEvidence = within(packaging).getByText('Title evidence').closest('details')!
    fireEvent.click(within(titleEvidence).getByText('Title evidence'))
    expect(within(titleEvidence).getByText('Normalized score')).toBeVisible()
    expect(within(titleEvidence).getByText('Cohort identity')).toBeVisible()
    expect(within(titleEvidence).getByText('Formula and decision logic')).toBeVisible()
    expect(within(titleEvidence).getByRole('link', { name: 'Open product/source lineage' })).toHaveAttribute('href', '/admin/source-protocol?receipt=title')
  })

  it('shows a missing-thumbnail recovery state and never calls the packet ready', () => {
    const value = packagingManifest()
    value.elements.find((element) => element.category === 'thumbnail')!.artifact_url = null
    render(<ArtifactEvidenceTrace manifest={value} currentContentVersion={VERSION} evaluationAsOf={EVALUATION_AS_OF} packagingTarget="youtube" />)

    const packaging = screen.getByLabelText('YouTube packaging evidence')
    expect(within(packaging).getByRole('status')).toHaveTextContent('Asset package blocked')
    expect(within(packaging).getByRole('img', { name: 'YouTube thumbnail missing' })).toBeVisible()
    expect(within(packaging).getByRole('alert')).toHaveTextContent('Thumbnail evidence is missing its actual bound review asset.')
    expect(within(packaging).getByRole('alert')).toHaveTextContent('A brief or poster alone is not sufficient.')
    expect(within(packaging).queryByText('Asset-package evidence ready')).not.toBeInTheDocument()
  })

  it('keeps the Jev Shorts cohort, public thumbnails, metrics, formulas, and selection logic inspectable on the evidence surface', () => {
    const fixture = channelNativeVideoQaFixture('f966123f-05eb-48ec-a7c2-970afce642ef')
    const artifactManifest = fixture.rag_context.artifact_evidence_manifest
    render(<ArtifactEvidenceTrace manifest={artifactManifest} currentContentVersion={fixture.updated_at} evaluationAsOf="2026-10-18T16:00:00.000Z" packagingTarget="youtube_shorts" />)

    const packaging = screen.getByLabelText('YouTube Shorts packaging evidence')
    expect(within(packaging).getByRole('status')).toHaveTextContent('Asset-package evidence ready')
    expect(within(packaging).getAllByText('AI Scored It 81%. Who Makes the Call?')[0]).toBeVisible()
    expect(within(packaging).getAllByText('AI SCORED IT 81% / WHO DECIDES?')[0]).toBeVisible()
    const thumbnailEvidence = within(packaging).getByText('Thumbnail evidence').closest('details')!
    fireEvent.click(within(thumbnailEvidence).getByText('Thumbnail evidence'))
    const cohort = within(thumbnailEvidence).getByTestId('youtube-thumbnail-research-cohort')
    fireEvent.click(within(cohort).getByText('Inspectable Shorts research cohort'))
    expect(within(cohort).getByText('8 qualified · minimum 6')).toBeVisible()
    expect(within(cohort).getByText(/source exact views \/ same-channel recent-Short median exact views/i)).toBeVisible()
    expect(within(cohort).getByText('Qualified source thumbnails')).toBeVisible()
    expect(within(cohort).getAllByRole('link', { name: 'Open public Short' })).toHaveLength(8)
    expect(within(cohort).getByText('Excluded sources (6)')).toBeVisible()
  })
})
