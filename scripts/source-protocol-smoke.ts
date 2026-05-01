import {
  buildAnswerReceipt,
  buildMonthlyPayoutSettlement,
  type LicenseGrant,
  type LicensedWork,
  type RetrievedSourceChunk,
  type SourceChunk,
} from '../lib/source-respecting-llm-protocol'

const args = new Set(process.argv.slice(2))
const shouldPost = args.has('--post')

const work: LicensedWork = {
  id: '22222222-2222-4222-8222-222222222222',
  creatorId: '11111111-1111-4111-8111-111111111111',
  title: 'Demo Book About Access',
  rightsHolderType: 'author',
  banStatus: 'challenged',
  chainOfTitleVerified: true,
}

const grant: LicenseGrant = {
  id: '33333333-3333-4333-8333-333333333333',
  workId: work.id,
  status: 'active',
  allowedUses: ['retrieval', 'citation', 'summarization', 'educational', 'commercial'],
  blockedTopics: ['minors_private_data', 'doxxing'],
  quoteLimitCharacters: 280,
}

const sourceChunk: SourceChunk = {
  id: '44444444-4444-4444-8444-444444444444',
  workId: work.id,
  creatorId: work.creatorId,
  textHash: 'demo-hash-access-imagination-build',
  citationLabel: 'Demo Book About Access, synthetic excerpt 1',
  location: 'demo-p.1',
}

const retrieved: RetrievedSourceChunk = {
  chunk: sourceChunk,
  licenseGrant: grant,
  retrievalScore: 0.94,
  cited: true,
  supportsAnswer: true,
  supportedOutputTokens: 120,
  quotedCharacters: 96,
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required when --post is used.`)
  return value
}

async function postJson(url: string, token: string, body: unknown): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`POST ${url} failed with ${response.status}: ${text}`)
  }

  console.log(`POST ${url} -> ${response.status}`)
  console.log(text)
}

async function main(): Promise<void> {
  const receipt = buildAnswerReceipt({
    modelId: 'allenai/Olmo-3-7B-Instruct',
    works: [work],
    sources: [retrieved],
    context: {
      intendedUses: ['summarization', 'educational'],
      queryText: 'What does the demo source say about access?',
      outputTokenCount: 120,
      netQueryRevenueUsd: 2,
      generatedAt: new Date().toISOString(),
    },
  })

  const settlement = buildMonthlyPayoutSettlement({
    period: new Date().toISOString().slice(0, 7),
    receipts: [receipt],
    minimumSettlementUsd: 10,
  })

  console.log(
    JSON.stringify(
      {
        mode: shouldPost ? 'post' : 'dry-run',
        receipt: {
          id: receipt.id,
          attributedChunks: receipt.attributedChunks.length,
          creatorPoolUsd: receipt.creatorPoolUsd,
          abuseFlags: receipt.abuseFlags,
        },
        settlement: {
          period: settlement.period,
          payouts: settlement.payouts.length,
          totalAccruedUsd: settlement.totalAccruedUsd,
          totalPayableUsd: settlement.totalPayableUsd,
          heldCreatorIds: settlement.heldCreatorIds,
        },
      },
      null,
      2
    )
  )

  if (!shouldPost) {
    console.log('Dry run complete. Pass --post to call the internal persistence APIs.')
    return
  }

  const baseUrl = requiredEnv('SOURCE_PROTOCOL_API_BASE_URL').replace(/\/$/, '')
  const token = requiredEnv('SOURCE_PROTOCOL_INGEST_SECRET')

  await postJson(`${baseUrl}/api/admin/source-protocol/receipts`, token, { receipt })
  await postJson(`${baseUrl}/api/admin/source-protocol/monthly-payouts`, token, { settlement })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
