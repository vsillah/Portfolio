#!/usr/bin/env npx tsx

import path from 'path'
import * as dotenv from 'dotenv'
import { auditVisualAssets } from '@/lib/visual-assets'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

function argValue(name: string) {
  const prefix = `--${name}=`
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

async function main() {
  const result = await auditVisualAssets({
    createWorkItem: !process.argv.includes('--no-work-item'),
    auditDate: argValue('date'),
  })

  console.log(JSON.stringify({
    entitiesScanned: result.entitiesScanned,
    candidatesCreated: result.candidatesCreated,
    workItemId: result.workItemId,
    candidateIds: result.candidates.map((candidate) => candidate.id),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
