#!/usr/bin/env tsx
/**
 * n8n STAG ↔ PROD drift checker
 *
 * Compares the parameters and connection structure of paired n8n workflows
 * (staging vs production) so we can catch config drift early — like the
 * Get-Lead-Data misconfig that only lived in PROD on 2026-04-22.
 *
 * Usage:
 *   npm run n8n:drift-check          # fail on drift (exit 1)
 *   npm run n8n:drift-check -- --warn # print but always exit 0
 *
 * Env (required):
 *   N8N_API_KEY   – Personal API key (Settings → API Keys in n8n Cloud)
 *   N8N_BASE_URL  – Defaults to https://amadutown.app.n8n.cloud
 *
 * Add/edit workflow pairs in WORKFLOW_PAIRS below.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { pathToFileURL } from 'url'
import { diffLines } from 'diff'

export type WorkflowPair = {
  label: string
  prodId: string
  stagId: string
  /** Extra dot-paths (applied on top of DEFAULT_IGNORE_PATHS) that should
   * always be ignored for this pair — e.g. environment-specific channel IDs. */
  ignorePaths?: string[]
}

export const WORKFLOW_PAIRS: WorkflowPair[] = [
  // WF-CLG-002 (Outreach Generation) was retired 2026-04-27 — outreach drafts are
  // now generated in-app via lib/outreach-queue-generator.ts. Auto-follow-ups
  // re-enter the app via /api/webhooks/n8n/outreach-followup-trigger called from
  // WF-CLG-003.
  {
    label: 'WF-CLG-003: Send and Follow-Up',
    prodId: 'l4iaJwxbeMlR7pTr',
    stagId: 'c6YWuqITIeep5QZp',
    ignorePaths: ['parameters.channelId', 'parameters.text', 'parameters.url'],
  },
  {
    label: 'WF-CLG-004: Reply Detection',
    prodId: 'i2IGVOYWcpxFidpf',
    stagId: 'AxE3tBBNDOvD6ogK',
    ignorePaths: ['parameters.channelId', 'parameters.text', 'parameters.url'],
  },
  {
    label: 'WF-VEP-001: Internal Evidence Extraction',
    prodId: 'iqGylSD1c2lDxlDT',
    stagId: '7YdqfO7rewTHICHy',
    ignorePaths: ['parameters.channelId', 'parameters.text', 'parameters.url'],
  },
  {
    label: 'WF-VEP-002: Social Listening Pipeline',
    prodId: 'gUyOBZOknpAt41aF',
    stagId: 'VgDvKIZeuslJSmj8',
    ignorePaths: ['parameters.channelId', 'parameters.text', 'parameters.url'],
  },
]

/** Paths that differ by environment and should always be ignored. */
const DEFAULT_IGNORE_PATHS = [
  'id',                       // node UUID
  'position',                 // canvas coords
  'webhookId',                // differs per env
  'typeVersion',              // minor version drift tolerated
  'createdAt',
  'updatedAt',
  // Any credentials block — prod/stag each have their own creds row
  /^credentials\./,
]

type Logger = {
  log: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

export type N8nNode = {
  id?: string
  name: string
  type: string
  typeVersion?: number
  position?: [number, number]
  parameters?: Record<string, unknown>
  credentials?: Record<string, unknown>
  webhookId?: string
  onError?: string
  retryOnFail?: boolean
  maxTries?: number
  waitBetweenTries?: number
  [key: string]: unknown
}

export type N8nWorkflow = {
  id: string
  name: string
  active: boolean
  nodes: N8nNode[]
  connections: Record<string, unknown>
}

export function loadN8nDriftEnv(cwd = process.cwd()) {
  config({ path: resolve(cwd, '.env.local') })
  config({ path: resolve(cwd, '.env') })
}

async function fetchWorkflow(
  id: string,
  options: { apiBase: string; apiKey: string; fetchImpl: typeof fetch }
): Promise<N8nWorkflow> {
  const res = await options.fetchImpl(`${options.apiBase}/api/v1/workflows/${id}`, {
    headers: { 'X-N8N-API-KEY': options.apiKey, Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`n8n API ${res.status} for workflow ${id}: ${await res.text()}`)
  }
  return (await res.json()) as N8nWorkflow
}

/** Strip fields that drift by env, recursively. */
export function prune(value: unknown, pathStack: string[] = [], ignoreExtra: string[] = []): unknown {
  const currentPath = pathStack.join('.')
  const ignoreAll = [...DEFAULT_IGNORE_PATHS, ...ignoreExtra]
  for (const rule of ignoreAll) {
    if (typeof rule === 'string' && currentPath === rule) return undefined
    if (rule instanceof RegExp && rule.test(currentPath)) return undefined
  }
  if (Array.isArray(value)) {
    return value.map((v, i) => prune(v, [...pathStack, String(i)], ignoreExtra))
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const pruned = prune(v, [...pathStack, k], ignoreExtra)
      if (pruned !== undefined) out[k] = pruned
    }
    return out
  }
  return value
}

export function normalizeNode(node: N8nNode, ignoreExtra: string[]): Record<string, unknown> {
  const pruned = prune(node, [], ignoreExtra) as Record<string, unknown>
  return pruned
}

/** Normalize connections to be stable under env-specific node ID/position drift. */
export function normalizeConnections(connections: Record<string, unknown>): string {
  const keys = Object.keys(connections).sort()
  const out: Record<string, unknown> = {}
  for (const k of keys) out[k] = connections[k]
  return JSON.stringify(out, null, 2)
}

export type DriftReport = {
  label: string
  nodeDiffs: Array<{ name: string; kind: 'only-prod' | 'only-stag' | 'different'; detail?: string }>
  connectionDiff?: string
  hasDrift: boolean
}

export function compareWorkflows(label: string, prod: N8nWorkflow, stag: N8nWorkflow, ignoreExtra: string[]): DriftReport {
  const prodByName = new Map<string, N8nNode>()
  const stagByName = new Map<string, N8nNode>()
  for (const n of prod.nodes) prodByName.set(n.name, n)
  for (const n of stag.nodes) stagByName.set(n.name, n)

  const nodeDiffs: DriftReport['nodeDiffs'] = []

  for (const [name, pNode] of prodByName) {
    const sNode = stagByName.get(name)
    if (!sNode) {
      nodeDiffs.push({ name, kind: 'only-prod' })
      continue
    }
    const a = JSON.stringify(normalizeNode(pNode, ignoreExtra), null, 2)
    const b = JSON.stringify(normalizeNode(sNode, ignoreExtra), null, 2)
    if (a !== b) {
      const patch = diffLines(b, a)
        .map((part) => {
          const prefix = part.added ? '+PROD ' : part.removed ? '-STAG ' : '      '
          return part.value
            .split('\n')
            .filter((l) => l.length > 0)
            .map((l) => prefix + l)
            .join('\n')
        })
        .join('\n')
      nodeDiffs.push({ name, kind: 'different', detail: patch })
    }
  }
  for (const [name] of stagByName) {
    if (!prodByName.has(name)) nodeDiffs.push({ name, kind: 'only-stag' })
  }

  // Connections are compared by node-name keys (env-independent).
  const connA = normalizeConnections(prod.connections)
  const connB = normalizeConnections(stag.connections)
  const connectionDiff =
    connA === connB
      ? undefined
      : diffLines(connB, connA)
          .map((part) => {
            const prefix = part.added ? '+PROD ' : part.removed ? '-STAG ' : '      '
            return part.value
              .split('\n')
              .filter((l) => l.length > 0)
              .map((l) => prefix + l)
              .join('\n')
          })
          .join('\n')

  return {
    label,
    nodeDiffs,
    connectionDiff,
    hasDrift: nodeDiffs.length > 0 || connectionDiff !== undefined,
  }
}

export function printReport(report: DriftReport, logger: Pick<Logger, 'log'> = console) {
  const bar = '─'.repeat(Math.max(40, report.label.length + 2))
  logger.log(`\n${bar}\n${report.label}\n${bar}`)
  if (!report.hasDrift) {
    logger.log('✅ No drift — PROD and STAG match on tracked fields.')
    return
  }
  for (const n of report.nodeDiffs) {
    if (n.kind === 'only-prod') logger.log(`  ➕ Only in PROD: "${n.name}"`)
    else if (n.kind === 'only-stag') logger.log(`  ➕ Only in STAG: "${n.name}"`)
    else {
      logger.log(`  ≠ Node drift on "${n.name}":`)
      if (n.detail) logger.log(n.detail.split('\n').map((l) => '      ' + l).join('\n'))
    }
  }
  if (report.connectionDiff) {
    logger.log('  ≠ Connection graph drift:')
    logger.log(report.connectionDiff.split('\n').map((l) => '      ' + l).join('\n'))
  }
}

export async function runDriftCheck(options: {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
  fetchImpl?: typeof fetch
  warnOnly?: boolean
  workflowPairs?: WorkflowPair[]
  logger?: Logger
} = {}): Promise<number> {
  const env = options.env ?? process.env
  const logger = options.logger ?? console
  const workflowPairs = options.workflowPairs ?? WORKFLOW_PAIRS
  const apiBase = (env.N8N_BASE_URL || 'https://amadutown.app.n8n.cloud').replace(/\/$/, '')
  const apiKey = env.N8N_API_KEY

  if (!apiKey) {
    logger.error('❌ N8N_API_KEY is required (Settings → API Keys in n8n Cloud).')
    logger.error('   Add it to .env.local or export it in your shell.')
    return 2
  }

  logger.log(`🔎 n8n drift check @ ${apiBase}\n   Pairs: ${workflowPairs.length}`)
  let anyDrift = false
  for (const pair of workflowPairs) {
    try {
      const fetchOptions = { apiBase, apiKey, fetchImpl: options.fetchImpl ?? fetch }
      const [prod, stag] = await Promise.all([
        fetchWorkflow(pair.prodId, fetchOptions),
        fetchWorkflow(pair.stagId, fetchOptions),
      ])
      const report = compareWorkflows(pair.label, prod, stag, pair.ignorePaths ?? [])
      printReport(report, logger)
      if (report.hasDrift) anyDrift = true
    } catch (err) {
      logger.log(`\n❌ ${pair.label}: ${err instanceof Error ? err.message : String(err)}`)
      anyDrift = true
    }
  }

  logger.log('')
  if (!anyDrift) {
    logger.log('✅ All workflow pairs are in sync.')
    return 0
  }
  if (options.warnOnly) {
    logger.log('⚠️  Drift detected but --warn mode is on; exiting 0.')
    return 0
  }
  logger.log('❌ Drift detected. Fix STAG/PROD or update ignorePaths for expected diffs.')
  return 1
}

export async function main() {
  loadN8nDriftEnv()
  return runDriftCheck({ warnOnly: process.argv.includes('--warn') })
}

const invokedAsCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedAsCli) {
  main()
    .then((exitCode) => {
      process.exit(exitCode)
    })
    .catch((err) => {
      console.error('Unexpected error:', err)
      process.exit(2)
    })
}
