#!/usr/bin/env npx tsx

import path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

function candidateIds() {
  const raw = process.argv.slice(2).find((arg) => arg.startsWith('--ids='))?.slice('--ids='.length)
  return raw ? raw.split(',').map((id) => id.trim()).filter(Boolean) : undefined
}

async function main() {
  const { applyApprovedVisualAssetCandidates } = await import('@/lib/visual-assets')
  const result = await applyApprovedVisualAssetCandidates({
    candidateIds: candidateIds(),
  })

  console.log(JSON.stringify({
    applied: result.applied,
    failed: result.failed,
    failures: result.failures,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
