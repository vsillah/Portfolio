#!/usr/bin/env tsx
import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  VERCEL_AUTORESEARCH_IDEAS,
  VERCEL_AUTORESEARCH_IDEA_SOURCE_LABEL,
  VERCEL_AUTORESEARCH_IDEA_SOURCE_TYPE,
} from '@/lib/vercel-autoresearch-ideas'

const envPath = process.env.PORTFOLIO_ENV_FILE
  ?? (existsSync(resolve(process.cwd(), '.env.local'))
    ? resolve(process.cwd(), '.env.local')
    : '/Users/vambahsillah/Projects/Portfolio/.env.local')
config({ path: envPath })

type Options = {
  prod: boolean
  dryRun: boolean
}

function parseArgs(argv: string[]): Options {
  return {
    prod: argv.includes('--prod'),
    dryRun: argv.includes('--dry-run'),
  }
}

function configureProdEnv() {
  if (!process.env.PROD_SUPABASE_URL || !process.env.PROD_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing PROD_SUPABASE_URL or PROD_SUPABASE_SERVICE_ROLE_KEY')
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.PROD_SUPABASE_URL
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.prod) configureProdEnv()
  const createAgentWorkItem = options.dryRun
    ? null
    : (await import('@/lib/agent-work-items')).createAgentWorkItem

  const results = []
  for (const idea of VERCEL_AUTORESEARCH_IDEAS) {
    const definitionOfReady = idea.definitionOfReady.map((item) => `- ${item}`).join('\n')
    if (options.dryRun) {
      results.push({
        id: idea.id,
        title: idea.title,
        status: 'proposed',
        priority: idea.priority,
      })
      continue
    }
    if (!createAgentWorkItem) throw new Error('createAgentWorkItem unavailable')
    const workItem = await createAgentWorkItem({
      title: idea.title,
      objective: [
        idea.objective,
        '',
        'Definition of ready:',
        definitionOfReady,
      ].join('\n'),
      priority: idea.priority,
      status: 'proposed',
      ownerAgentKey: null,
      ownerRuntime: 'codex',
      source: {
        type: VERCEL_AUTORESEARCH_IDEA_SOURCE_TYPE,
        id: idea.id,
        label: VERCEL_AUTORESEARCH_IDEA_SOURCE_LABEL,
      },
      expectedFiles: idea.expectedFiles,
      overlapGroup: idea.overlapGroup,
      metadata: {
        autoresearch_idea: true,
        idea_id: idea.id,
        recommendation: idea.recommendation,
        risk: idea.risk,
        definition_of_ready: idea.definitionOfReady,
        kanban_readiness: {
          ready: false,
        },
      },
      idempotencyKey: `vercel-autoresearch-idea:${idea.id}`,
    })
    results.push({
      id: idea.id,
      work_item_id: workItem.id,
      title: workItem.title,
      status: workItem.status,
      priority: workItem.priority,
    })
  }

  console.log(JSON.stringify({
    ok: true,
    dry_run: options.dryRun,
    target: options.prod ? 'prod' : 'local',
    seeded: results.length,
    work_items: results,
  }, null, 2))
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
