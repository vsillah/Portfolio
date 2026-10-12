import { buildApprovedSourceProjection, type SocialTopicSourceProjection } from '@/lib/social-topic-source-receipts'

export function approvedRepositoryEvidenceProjections(approvedAt: string): SocialTopicSourceProjection[] {
  return [
    buildApprovedSourceProjection({
      sourceGroup: 'repository_documents',
      sourceKind: 'approved_repository_document',
      sourceId: 'docs/jev-shadow/README.md',
      productIdentity: 'jev',
      lifecycleStage: 'insight',
      label: 'Jev',
      approvedSummary: 'The approved Jev capability packet documents a provider-gated decision adapter, privacy constraints, mock-only qualification, and a HOLD boundary for live provider use.',
      privacyClassification: 'public_safe',
      provenance: 'portfolio_repository:docs/jev-shadow/README.md:approved_capability_packet',
      approvedAt,
      approvedBy: 'portfolio_repository_review',
      observedAt: approvedAt,
      metadata: {
        topic_identities: ['governed_capability_analysis', 'provider_gated_ai', 'privacy_safe_evaluation'],
        repository_path: 'docs/jev-shadow/README.md',
        approved_summary_only: true,
        raw_private_content_included: false,
      },
    }),
    buildApprovedSourceProjection({
      sourceGroup: 'repository_documents',
      sourceKind: 'approved_repository_implementation',
      sourceId: 'lib/engagement-shadow/benchmark.ts',
      productIdentity: 'jev',
      lifecycleStage: 'in_development',
      label: 'Jev',
      approvedSummary: 'Portfolio contains a bounded Jev-shaped evaluation harness that records provider gates and safe review outcomes without activating live Jev calls.',
      privacyClassification: 'public_safe',
      provenance: 'portfolio_repository:lib/engagement-shadow/benchmark.ts:approved_implementation_evidence',
      approvedAt,
      approvedBy: 'portfolio_repository_review',
      observedAt: approvedAt,
      metadata: {
        topic_identities: ['governed_capability_analysis', 'provider_gated_ai'],
        repository_path: 'lib/engagement-shadow/benchmark.ts',
        approved_summary_only: true,
        raw_private_content_included: false,
      },
    }),
  ]
}
