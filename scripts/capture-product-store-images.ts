#!/usr/bin/env npx tsx
/**
 * Legacy compatibility entrypoint.
 *
 * This script used to upload screenshots and directly mutate products.image_url.
 * It now delegates to the visual asset candidate workflow so homepage imagery
 * stays human-reviewed before public fields change.
 */

import path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  const { auditVisualAssets, captureVisualAssetCandidates } = await import('@/lib/visual-assets')
  console.warn(
    '[capture-product-store-images] Deprecated direct-update path replaced. ' +
      'Creating visual_asset_candidates and capturing screenshots only.',
  )

  const audit = await auditVisualAssets({ createWorkItem: true })
  const capture = await captureVisualAssetCandidates({
    candidateIds: audit.candidates.map((candidate) => candidate.id),
    noStartServer: process.argv.includes('--no-start-server'),
  })

  console.log(JSON.stringify({
    entitiesScanned: audit.entitiesScanned,
    candidatesCreated: audit.candidatesCreated,
    captured: capture.captured,
    passed: capture.passed,
    blocked: capture.blocked,
    workItemId: audit.workItemId,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
