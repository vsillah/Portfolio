#!/usr/bin/env npx tsx

import path from 'path'
import * as dotenv from 'dotenv'
import { captureVisualAssetCandidates } from '@/lib/visual-assets'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

function candidateIds() {
  const raw = process.argv.slice(2).find((arg) => arg.startsWith('--ids='))?.slice('--ids='.length)
  return raw ? raw.split(',').map((id) => id.trim()).filter(Boolean) : undefined
}

async function main() {
  const result = await captureVisualAssetCandidates({
    candidateIds: candidateIds(),
    noStartServer: process.argv.includes('--no-start-server'),
  })

  console.log(JSON.stringify({
    captured: result.captured,
    candidateIds: result.candidates.map((candidate) => candidate.id),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
