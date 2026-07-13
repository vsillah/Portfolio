import type { OpenBrainRagProjectionDocument } from './open-brain'

export type OpenBrainRagRetrievalQaStatus = 'pass' | 'warn' | 'fail'

export interface OpenBrainRagRetrievalQaQuery {
  id: string
  question: string
  expectedTerms: string[]
  forbiddenTerms?: string[]
  minScore?: number
}

export interface OpenBrainRagRetrievalQaResult {
  queryId: string
  question: string
  status: OpenBrainRagRetrievalQaStatus
  score: number
  matchedTerms: string[]
  missingTerms: string[]
  forbiddenHits: string[]
  topDocumentId: string | null
  topDocumentTitle: string | null
  sourceHash: string | null
  note: string
}

export interface OpenBrainRagRetrievalQaReport {
  generatedAt: string
  status: OpenBrainRagRetrievalQaStatus
  overview: {
    documentCount: number
    queryCount: number
    passedQueries: number
    warningQueries: number
    failedQueries: number
    metadataFailures: number
    privacyFailures: number
    pineconeWriteStatus: 'blocked_pending_approval'
  }
  results: OpenBrainRagRetrievalQaResult[]
  metadataFindings: string[]
  privacyFindings: string[]
  recommendations: string[]
}

export const DEFAULT_OPEN_BRAIN_RAG_RETRIEVAL_QA_QUERIES: OpenBrainRagRetrievalQaQuery[] = [
  {
    id: 'personality-corpus-projection-rule',
    question: 'Can Open Brain explain how the public-safe personality corpus should be used by agents and RAG?',
    expectedTerms: ['personality corpus', 'public-safe', 'projection', 'agent context', 'rag'],
    forbiddenTerms: ['Anthropic_chat_data', 'ChatGPT export'],
  },
  {
    id: 'private-export-boundary',
    question: 'Does the retrieved context preserve the boundary around raw private exports?',
    expectedTerms: ['raw private exports', 'local-only', 'wiki pages', 'chatbot knowledge', 'Pinecone'],
    forbiddenTerms: ['api key', 'password', 'secret'],
  },
  {
    id: 'approval-gated-pinecone',
    question: 'Does retrieved context say Pinecone ingestion is downstream and approval-gated?',
    expectedTerms: ['Pinecone', 'approval', 'downstream', 'projection', 'rebuildable'],
    forbiddenTerms: ['auto-apply', 'automatic write', 'write without approval'],
  },
]

const CONTACT_OR_SECRET_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'email_address', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { label: 'phone_number', pattern: /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/ },
  { label: 'secret_like_value', pattern: /\b(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD)\b\s*[:=]/i },
  { label: 'openai_key_like_value', pattern: /\bsk-[A-Za-z0-9_-]{12,}\b/ },
  { label: 'github_token_like_value', pattern: /\bgithub_pat_[A-Za-z0-9_]{12,}\b/ },
]

export function evaluateOpenBrainRagRetrievalQa(input: {
  documents: OpenBrainRagProjectionDocument[]
  queries?: OpenBrainRagRetrievalQaQuery[]
  generatedAt?: string
}): OpenBrainRagRetrievalQaReport {
  const generatedAt = input.generatedAt || new Date().toISOString()
  const documents = input.documents
  const queries = input.queries || DEFAULT_OPEN_BRAIN_RAG_RETRIEVAL_QA_QUERIES
  const metadataFindings = validateProjectionMetadata(documents)
  const privacyFindings = validateProjectionPrivacy(documents)
  const results = queries.map((query) => evaluateQuery(query, documents))
  const failedQueries = results.filter((result) => result.status === 'fail').length
  const warningQueries = results.filter((result) => result.status === 'warn').length
  const passedQueries = results.filter((result) => result.status === 'pass').length
  const status: OpenBrainRagRetrievalQaStatus = metadataFindings.length > 0 || privacyFindings.length > 0 || failedQueries > 0
    ? 'fail'
    : warningQueries > 0
      ? 'warn'
      : 'pass'

  return {
    generatedAt,
    status,
    overview: {
      documentCount: documents.length,
      queryCount: queries.length,
      passedQueries,
      warningQueries,
      failedQueries,
      metadataFailures: metadataFindings.length,
      privacyFailures: privacyFindings.length,
      pineconeWriteStatus: 'blocked_pending_approval',
    },
    results,
    metadataFindings,
    privacyFindings,
    recommendations: buildRecommendations({
      documentCount: documents.length,
      metadataFindings,
      privacyFindings,
      failedQueries,
      warningQueries,
    }),
  }
}

export function formatOpenBrainRagRetrievalQaReport(report: OpenBrainRagRetrievalQaReport): string {
  const lines = [
    '# Open Brain RAG Retrieval QA Packet',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Status: \`${report.status}\``,
    '',
    '## Overview',
    '',
    `- Documents evaluated: ${report.overview.documentCount}`,
    `- Queries evaluated: ${report.overview.queryCount}`,
    `- Passed queries: ${report.overview.passedQueries}`,
    `- Warning queries: ${report.overview.warningQueries}`,
    `- Failed queries: ${report.overview.failedQueries}`,
    `- Metadata failures: ${report.overview.metadataFailures}`,
    `- Privacy failures: ${report.overview.privacyFailures}`,
    `- Pinecone write status: \`${report.overview.pineconeWriteStatus}\``,
    '',
    '## Retrieval Checks',
    '',
    ...report.results.flatMap((result) => [
      `### ${result.queryId}`,
      '',
      `- Status: \`${result.status}\``,
      `- Score: ${result.score.toFixed(2)}`,
      `- Top document: ${result.topDocumentTitle ? `${result.topDocumentTitle} (\`${result.topDocumentId}\`)` : 'none'}`,
      `- Source hash: ${result.sourceHash ? `\`${result.sourceHash}\`` : 'none'}`,
      `- Matched terms: ${result.matchedTerms.length ? result.matchedTerms.map((term) => `\`${term}\``).join(', ') : 'none'}`,
      `- Missing terms: ${result.missingTerms.length ? result.missingTerms.map((term) => `\`${term}\``).join(', ') : 'none'}`,
      `- Forbidden hits: ${result.forbiddenHits.length ? result.forbiddenHits.map((term) => `\`${term}\``).join(', ') : 'none'}`,
      `- Note: ${result.note}`,
      '',
    ]),
    '## Metadata Findings',
    '',
    ...(report.metadataFindings.length ? report.metadataFindings.map((finding) => `- ${finding}`) : ['- None.']),
    '',
    '## Privacy Findings',
    '',
    ...(report.privacyFindings.length ? report.privacyFindings.map((finding) => `- ${finding}`) : ['- None.']),
    '',
    '## Recommendations',
    '',
    ...report.recommendations.map((recommendation) => `- ${recommendation}`),
    '',
  ]

  return `${lines.join('\n')}\n`
}

function evaluateQuery(
  query: OpenBrainRagRetrievalQaQuery,
  documents: OpenBrainRagProjectionDocument[],
): OpenBrainRagRetrievalQaResult {
  const minScore = query.minScore ?? 0.6
  const ranked = documents
    .map((document) => ({
      document,
      expectedMatches: findTerms(document.text, query.expectedTerms),
      forbiddenHits: findTerms(document.text, query.forbiddenTerms || []),
      queryOverlap: overlapScore(query.question, `${document.title}\n${document.text}`),
    }))
    .sort((a, b) => {
      const aScore = a.expectedMatches.length + a.queryOverlap
      const bScore = b.expectedMatches.length + b.queryOverlap
      return bScore - aScore
    })

  const top = ranked[0] || null
  const matchedTerms = top?.expectedMatches || []
  const forbiddenHits = top?.forbiddenHits || []
  const missingTerms = query.expectedTerms.filter((term) => !matchedTerms.includes(term))
  const score = query.expectedTerms.length === 0 ? 1 : matchedTerms.length / query.expectedTerms.length
  const status: OpenBrainRagRetrievalQaStatus = !top || forbiddenHits.length > 0 || score < minScore
    ? 'fail'
    : score < 1
      ? 'warn'
      : 'pass'

  return {
    queryId: query.id,
    question: query.question,
    status,
    score,
    matchedTerms,
    missingTerms,
    forbiddenHits,
    topDocumentId: top?.document.id || null,
    topDocumentTitle: top?.document.title || null,
    sourceHash: top?.document.metadata.sourceHash || null,
    note: !top
      ? 'No public-safe Open Brain RAG projection documents are available.'
      : forbiddenHits.length > 0
        ? 'Top document contains forbidden retrieval terms.'
        : score < minScore
          ? 'Top document did not meet the minimum expected-term coverage.'
          : score < 1
            ? 'Top document is usable but missing at least one expected term.'
            : 'Top document satisfies the retrieval check.',
  }
}

function validateProjectionMetadata(documents: OpenBrainRagProjectionDocument[]) {
  const findings: string[] = []
  const ids = new Set<string>()
  for (const document of documents) {
    if (ids.has(document.id)) findings.push(`${document.id}: duplicate projection document id`)
    ids.add(document.id)
    if (!document.title.trim()) findings.push(`${document.id}: title is required`)
    if (!document.text.trim()) findings.push(`${document.id}: text is required`)
    if (!document.metadata.openBrainMemoryId) findings.push(`${document.id}: missing Open Brain memory id`)
    if (!document.metadata.sourceHash) findings.push(`${document.id}: missing source hash`)
    if (!document.metadata.projectionVersion) findings.push(`${document.id}: missing projection version`)
    if (!document.metadata.deletionKey) findings.push(`${document.id}: missing deletion key`)
    if (!document.metadata.rollbackKey) findings.push(`${document.id}: missing rollback key`)
    if (document.metadata.privacyTier !== 'public_safe') findings.push(`${document.id}: privacy tier must be public_safe`)
  }
  return findings
}

function validateProjectionPrivacy(documents: OpenBrainRagProjectionDocument[]) {
  const findings: string[] = []
  for (const document of documents) {
    for (const { label, pattern } of CONTACT_OR_SECRET_PATTERNS) {
      if (pattern.test(document.text)) findings.push(`${document.id}: ${label} detected in projection text`)
    }
  }
  return findings
}

function buildRecommendations(input: {
  documentCount: number
  metadataFindings: string[]
  privacyFindings: string[]
  failedQueries: number
  warningQueries: number
}) {
  const recommendations: string[] = []
  if (input.documentCount === 0) {
    recommendations.push('Approve at least one public-safe Open Brain memory before staging Open Brain projection content for RAG.')
  }
  if (input.metadataFindings.length > 0) {
    recommendations.push('Fix projection metadata before any chatbot or Pinecone staging: memory id, source hash, projection version, deletion key, and rollback key are required.')
  }
  if (input.privacyFindings.length > 0) {
    recommendations.push('Remove private/contact/secret-like material from approved public-safe memories before projection.')
  }
  if (input.failedQueries > 0) {
    recommendations.push('Do not cut over Pinecone until failed retrieval checks are corrected with approved public-safe memory content.')
  }
  if (input.warningQueries > 0) {
    recommendations.push('Review warning queries and improve source summaries before production retrieval promotion.')
  }
  recommendations.push('Keep Pinecone as a downstream rebuildable projection; no writes should occur until explicit cutover approval.')
  return recommendations
}

function findTerms(text: string, terms: string[]) {
  const normalized = normalize(text)
  return terms.filter((term) => normalized.includes(normalize(term)))
}

function overlapScore(question: string, text: string) {
  const questionTerms = new Set(tokenize(question))
  const textTerms = new Set(tokenize(text))
  if (questionTerms.size === 0) return 0
  let overlap = 0
  questionTerms.forEach((term) => {
    if (textTerms.has(term)) overlap += 1
  })
  return overlap / questionTerms.size
}

function tokenize(text: string) {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2)
}

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}
