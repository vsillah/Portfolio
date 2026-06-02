#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'
import dotenv from 'dotenv'
import path from 'path'
import type { VercelResearchPlan } from '../lib/vercel-deployment-research'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

function parseLimit(argv: string[]) {
  const index = argv.indexOf('--limit')
  if (index === -1) return 20
  const raw = argv[index + 1]
  const parsed = Number.parseInt(raw || '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error('--limit must be a positive integer')
  return parsed
}

function readVercelResearchPlan(limit: number): VercelResearchPlan {
  const result = spawnSync('tsx', ['scripts/vercel-deployment-research-plan.ts', '--json', '--limit', String(limit)], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.status !== 0) {
    const message = result.stderr.trim() || result.stdout.trim() || 'deploy:research:plan failed'
    throw new Error(message)
  }

  return JSON.parse(result.stdout) as VercelResearchPlan
}

async function main() {
  const { recordVercelAutoResearchProducerTraces } = await import('../lib/open-brain')
  const plan = readVercelResearchPlan(parseLimit(process.argv.slice(2)))
  const result = await recordVercelAutoResearchProducerTraces(plan)
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
    proposals: result.proposals.map((proposal) => ({
      id: proposal.id,
      status: proposal.status,
      proposedKind: proposal.proposedMemory.kind,
      title: proposal.proposedMemory.title,
      privacyTier: proposal.proposedMemory.privacyTier,
      sourceIds: proposal.sourceIds,
    })),
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
  if (result.status === 'missing') process.exitCode = 1
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[open-brain-autoresearch-producer] failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
