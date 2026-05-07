import {
  buildKnowledgeGovernanceStatus,
  type KnowledgeSourceManifestEntry,
} from '@/lib/knowledge-governance'

export const KNOWLEDGE_SOURCE_MANIFEST: KnowledgeSourceManifestEntry[] = [
  {
    sourceId: 'portfolio-chatbot-products-services',
    title: 'What AmaduTown Offers',
    sourceType: 'portfolio_doc',
    namespace: 'public_chatbot',
    privacyTier: 'public',
    canonicalPathOrUrl: 'docs/chatbot-products-and-services-overview.md',
    intendedConsumers: ['public_chatbot', 'voice_agent'],
    approvedForRag: true,
    notes: 'Authoritative public service/product facts; /api/knowledge remains primary.',
  },
  {
    sourceId: 'portfolio-chatbot-campaigns',
    title: 'Active Promotions and Attraction Campaigns',
    sourceType: 'portfolio_doc',
    namespace: 'public_chatbot',
    privacyTier: 'public',
    canonicalPathOrUrl: 'docs/chatbot-campaigns-overview.md',
    intendedConsumers: ['public_chatbot', 'voice_agent'],
    approvedForRag: true,
  },
  {
    sourceId: 'vambah-personality-public-safe',
    title: 'Vambah Personality Corpus Public-Safe Pack',
    sourceType: 'public_safe_corpus',
    namespace: 'voice_story',
    privacyTier: 'public_safe',
    canonicalPathOrUrl: 'docs/vambah-personality-public-safe.md',
    intendedConsumers: ['public_chatbot', 'outreach_email', 'content_agents'],
    approvedForRag: true,
    notes: 'Private-derived aggregate only; raw private exports are not included.',
  },
  {
    sourceId: 'portfolio-user-help-guide',
    title: 'Portfolio User Help Guide',
    sourceType: 'portfolio_doc',
    namespace: 'public_chatbot',
    privacyTier: 'public',
    canonicalPathOrUrl: 'docs/user-help-guide.md',
    intendedConsumers: ['public_chatbot'],
    approvedForRag: true,
  },
  {
    sourceId: 'admin-sales-lead-pipeline-sop',
    title: 'Admin Sales Lead Pipeline SOP',
    sourceType: 'ops_runbook',
    namespace: 'internal_ops',
    privacyTier: 'internal',
    canonicalPathOrUrl: 'docs/admin-sales-lead-pipeline-sop.md',
    intendedConsumers: ['admin_internal', 'agent_ops'],
    approvedForRag: true,
  },
  {
    sourceId: 'legacy-publications-pinecone',
    title: 'Legacy Publications Pinecone Index',
    sourceType: 'legacy_pinecone',
    namespace: 'legacy_quarantine',
    privacyTier: 'internal',
    canonicalPathOrUrl: 'pinecone://publications',
    intendedConsumers: ['audit_only'],
    approvedForRag: false,
    notes: 'Read-only legacy index retained for audit and rollback until shadow index passes.',
  },
]

export const KNOWLEDGE_GOVERNANCE_STATUS =
  buildKnowledgeGovernanceStatus(KNOWLEDGE_SOURCE_MANIFEST)
