import type {
  ArtifactEvaluationDimension,
  ArtifactEvaluationDimensionKey,
  ArtifactEvaluationKind,
  ArtifactEvaluationReceipt,
} from '@/lib/artifact-evidence-evaluation'
import { ARTIFACT_EVIDENCE_CATEGORIES, type ArtifactEvidenceCategory, type ArtifactEvidenceManifest } from '@/lib/artifact-evidence-manifest'

const KIND_BY_CATEGORY: Partial<Record<ArtifactEvidenceCategory, ArtifactEvaluationKind>> = {
  copy_script: 'script_message',
  visual_field: 'headline_hook',
  visual_template: 'visual_concept',
  thumbnail: 'thumbnail',
  title: 'title_subject',
  description: 'description',
  cta: 'cta',
}

const SCORES: Record<ArtifactEvaluationDimensionKey, { score: number; weight: number; threshold: number; basis: ArtifactEvaluationDimension['basis']; direction: ArtifactEvaluationDimension['direction'] }> = {
  outlier_pattern_fit: { score: 84, weight: 25, threshold: 70, basis: 'measured', direction: 'higher_is_better' },
  source_support: { score: 92, weight: 20, threshold: 80, basis: 'measured', direction: 'higher_is_better' },
  core_audience_fit: { score: 88, weight: 15, threshold: 70, basis: 'heuristic', direction: 'higher_is_better' },
  timeliness: { score: 90, weight: 10, threshold: 65, basis: 'measured', direction: 'higher_is_better' },
  product_work_evidence_fit: { score: 95, weight: 20, threshold: 80, basis: 'measured', direction: 'higher_is_better' },
  originality_repetition_risk: { score: 18, weight: 10, threshold: 35, basis: 'model_judgment', direction: 'lower_is_better' },
}

export function completeEvaluationReceipt(kind: ArtifactEvaluationKind, elementId: string, version: string): ArtifactEvaluationReceipt {
  const dimensions = {} as Record<ArtifactEvaluationDimensionKey, ArtifactEvaluationDimension>
  for (const [key, definition] of Object.entries(SCORES) as Array<[ArtifactEvaluationDimensionKey, (typeof SCORES)[ArtifactEvaluationDimensionKey]]>) {
    const receiptId = `evidence:${elementId}:${key}`
    dimensions[key] = {
      status: 'scored',
      score: definition.score,
      basis: definition.basis,
      direction: definition.direction,
      weight: definition.weight,
      threshold: definition.threshold,
      percentile: key === 'outlier_pattern_fit' ? 83.3 : null,
      rank: key === 'outlier_pattern_fit' ? { position: 2, total: 12 } : null,
      deterministic_inputs: [{ name: `${key}_input`, value: String(definition.score), receipt_id: receiptId }],
      source_receipts: [{ receipt_id: receiptId, href: `/admin/source-protocol?receipt=${encodeURIComponent(receiptId)}` }],
      rationale: `${key.replaceAll('_', ' ')} is bounded to the approved fixture receipt.`,
    }
  }
  return {
    version: 'artifact-evaluation-scorecard/v1',
    receipt_id: `evaluation:${elementId}:v1`,
    evaluation_kind: kind,
    content_version: version,
    evaluated_at: version,
    weighting_version: 'artifact-evaluation-weights/v1',
    benchmark_cohort: {
      cohort_id: 'cohort:comparable-creators:fixture:v1',
      status: 'approved',
      sample_size: 12,
      observed_from: '2026-10-01T00:00:00.000Z',
      observed_to: '2026-10-14T00:00:00.000Z',
      fresh_until: '2026-10-29T00:00:00.000Z',
      source_receipts: [{ receipt_id: 'cohort-receipt:fixture:v1', href: '/admin/agents/content-intelligence?section=research&cohort=fixture' }],
    },
    dimensions,
    overall: {
      score: 88.8,
      threshold: 75,
      recommendation: 'advance',
      confidence_score: 91,
      confidence_label: 'high',
      rationale: 'All six dimensions are scored from approved fixture receipts and meet the current weighted recommendation contract.',
      source_receipts: Object.values(dimensions).flatMap((dimension) => dimension.source_receipts),
    },
  }
}

export function completeArtifactEvidenceManifest(version: string): ArtifactEvidenceManifest {
  return {
    version: 'artifact-evidence-manifest/v2',
    manifest_id: 'artifact-manifest:test:v2',
    manifest_hash: `sha256:${'a'.repeat(64)}`,
    content_version: version,
    artifact_label: 'Traceable customer artifact',
    preview_url: '/review-assets/social-content/jev-customer-facing-poster.png',
    preview_alt: 'Traceable artifact preview',
    final_output_hashes: [{ label: 'MP4', sha256: 'b'.repeat(64) }],
    elements: ARTIFACT_EVIDENCE_CATEGORIES.map((category, index) => {
      const evaluationKind = KIND_BY_CATEGORY[category]
      const elementId = `${category}-${index}`
      return {
        id: elementId,
        category,
        label: category === 'source_research' ? 'Private research summary' : `${category} evidence`,
        input_excerpt: `Bounded ${category} input`,
        customer_facing: category !== 'source_research' && category !== 'transformation',
        review_only: category === 'source_research' || category === 'transformation',
        redacted: category === 'source_research',
        source_identity: `source:${category}`,
        source_record_type: category === 'source_research' ? 'open_brain_approved_memory' : 'portfolio_source_record',
        authoritative_href: `/admin/source-protocol?receipt=${category}`,
        evidence_receipt_ids: [`evidence:${category}`],
        version_hash: `sha256:${'c'.repeat(64)}`,
        content_version: version,
        rights_privacy_status: 'passed' as const,
        rights_privacy_receipt_ids: [`rights:${category}`],
        transformation_step: `Bind ${category} into the final artifact.`,
        ...(evaluationKind ? { evaluation_kind: evaluationKind, evaluation_receipt: completeEvaluationReceipt(evaluationKind, elementId, version) } : {}),
        ...(index < 3 ? { region: { x: 20 + index * 20, y: 30 } } : {}),
      }
    }),
  }
}
