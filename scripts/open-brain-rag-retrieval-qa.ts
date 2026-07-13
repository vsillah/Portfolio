#!/usr/bin/env tsx
import dotenv from 'dotenv'
import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import {
  evaluateOpenBrainRagRetrievalQa,
  formatOpenBrainRagRetrievalQaReport,
} from '../lib/open-brain-rag-retrieval-qa'

const envPath = existsSync(path.join(process.cwd(), '.env.local'))
  ? path.join(process.cwd(), '.env.local')
  : '/Users/vambahsillah/Projects/Portfolio/.env.local'

dotenv.config({ path: envPath, quiet: true })

async function main() {
  const writePath = getWritePath(process.argv.slice(2))
  const { getOpenBrainSnapshot } = await import('../lib/open-brain')
  const snapshot = await getOpenBrainSnapshot()
  const report = evaluateOpenBrainRagRetrievalQa({
    documents: snapshot.ragProjection.documents,
    generatedAt: new Date().toISOString(),
  })
  const markdown = formatOpenBrainRagRetrievalQaReport(report)

  if (writePath) {
    await mkdir(path.dirname(writePath), { recursive: true })
    await writeFile(writePath, markdown, 'utf8')
  }

  process.stdout.write(JSON.stringify({
    status: report.status,
    generatedAt: report.generatedAt,
    documentCount: report.overview.documentCount,
    queryCount: report.overview.queryCount,
    failedQueries: report.overview.failedQueries,
    metadataFailures: report.overview.metadataFailures,
    privacyFailures: report.overview.privacyFailures,
    pineconeWriteStatus: report.overview.pineconeWriteStatus,
    reportPath: writePath || null,
    pineconeWriteAttempted: false,
  }, null, 2))
  process.stdout.write('\n')
}

function getWritePath(args: string[]) {
  const writeIndex = args.findIndex((arg) => arg === '--write')
  if (writeIndex === -1) return null
  const value = args[writeIndex + 1]
  if (!value || value.startsWith('--')) {
    return path.join(process.cwd(), 'docs/open-brain-rag-retrieval-qa.md')
  }
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value)
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[open-brain-rag-retrieval-qa] failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
