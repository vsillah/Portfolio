#!/usr/bin/env tsx
import { recordCodexAutomationProducerTraces } from '../lib/open-brain'

async function main() {
  const result = await recordCodexAutomationProducerTraces()
  const output = {
    status: result.status,
    reason: result.reason,
    overview: result.overview,
    sources: result.sources.map((source) => ({
      id: source.id,
      kind: source.kind,
      title: source.title,
      privacyTier: source.privacyTier,
      path: source.path,
      fingerprint: source.fingerprint,
    })),
    events: result.events.map((event) => ({
      id: event.id,
      kind: event.kind,
      title: event.title,
      privacyTier: event.privacyTier,
      sourceIds: event.sourceIds,
      fingerprint: event.fingerprint,
      metadata: event.metadata,
    })),
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
  if (result.status === 'missing') process.exitCode = 1
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[open-brain-automation-producer] failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
