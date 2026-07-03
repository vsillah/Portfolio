#!/usr/bin/env tsx
import { recordPersonalityCorpusProducerTrace } from '../lib/open-brain'
import { resolvePersonalityCorpusPaths } from '../lib/personality-corpus-paths'

async function main() {
  const result = await recordPersonalityCorpusProducerTrace()
  const corpusPaths = resolvePersonalityCorpusPaths()
  const output = {
    status: result.status,
    reason: result.reason,
    corpusPaths: {
      activeHome: corpusPaths.activeHome,
      activeSource: corpusPaths.activeSource,
      preferredHome: corpusPaths.preferredHome,
      legacyHome: corpusPaths.legacyHome,
      publicSafeRagPack: corpusPaths.publicSafeRagPack,
      exists: corpusPaths.exists,
      rawPrivateExportsTracked: false,
    },
    source: result.source ? {
      id: result.source.id,
      kind: result.source.kind,
      title: result.source.title,
      privacyTier: result.source.privacyTier,
      path: result.source.path,
      fingerprint: result.source.fingerprint,
    } : null,
    event: result.event ? {
      id: result.event.id,
      kind: result.event.kind,
      title: result.event.title,
      privacyTier: result.event.privacyTier,
      sourceIds: result.event.sourceIds,
      fingerprint: result.event.fingerprint,
      metadata: result.event.metadata,
    } : null,
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
  if (result.status === 'missing') process.exitCode = 1
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[open-brain-personality-corpus-producer] failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
