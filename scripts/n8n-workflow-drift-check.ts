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

import 'dotenv/config'
import { diffLines } from 'diff'

type WorkflowPair = {
  label: string
  prodId: string
  stagId: string
  /** Extra dot-paths (applied on top of DEFAULT_IGNORE_PATHS) that should
   * always be ignored for this pair — e.g. environment-specific channel IDs. */
  ignorePaths?: string[]
}

const WORKFLOW_PAIRS: WorkflowPair[] = [
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

type N8nNode = {
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

type N8nWorkflow = {
  id: string
  name: string
  active: boolean
  nodes: N8nNode[]
  connections: Record<string, unknown>
}

const API_BASE = (process.env.N8N_BASE_URL || 'https://amadutown.app.n8n.cloud').replace(/\/$/, '')
const API_KEY = process.env.N8N_API_KEY

if (!API_KEY) {
  console.error('❌ N8N_API_KEY is required (Settings → API Keys in n8n Cloud).')
  console.error('   Add it to .env.local or export it in your shell.')
  process.exit(2)
}

const WARN_ONLY = process.argv.includes('--warn')

async function fetchWorkflow(id: string): Promise<N8nWorkflow> {
  const res = await fetch(`${API_BASE}/api/v1/workflows/${id}`, {
    headers: { 'X-N8N-API-KEY': API_KEY as string, Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`n8n API ${res.status} for workflow ${id}: ${await res.text()}`)
  }
  return (await res.json()) as N8nWorkflow
}

/** Strip fields that drift by env, recursively. */
function prune(value: unknown, pathStack: string[] = [], ignoreExtra: string[] = []): unknown {
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

function normalizeNode(node: N8nNode, ignoreExtra: string[]): Record<string, unknown> {
  const pruned = prune(node, [], ignoreExtra) as Record<string, unknown>
  return pruned
}

/** Normalize connections to be stable under env-specific node ID/position drift. */
function normalizeConnections(connections: Record<string, unknown>): string {
  const keys = Object.keys(connections).sort()
  const out: Record<string, unknown> = {}
  for (const k of keys) out[k] = connections[k]
  return JSON.stringify(out, null, 2)
}

type DriftReport = {
  label: string
  nodeDiffs: Array<{ name: string; kind: 'only-prod' | 'only-stag' | 'different'; detail?: string }>
  connectionDiff?: string
  hasDrift: boolean
}

function compareWorkflows(label: string, prod: N8nWorkflow, stag: N8nWorkflow, ignoreExtra: string[]): DriftReport {
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

function printReport(report: DriftReport) {
  const bar = '─'.repeat(Math.max(40, report.label.length + 2))
  console.log(`\n${bar}\n${report.label}\n${bar}`)
  if (!report.hasDrift) {
    console.log('✅ No drift — PROD and STAG match on tracked fields.')
    return
  }
  for (const n of report.nodeDiffs) {
    if (n.kind === 'only-prod') console.log(`  ➕ Only in PROD: "${n.name}"`)
    else if (n.kind === 'only-stag') console.log(`  ➕ Only in STAG: "${n.name}"`)
    else {
      console.log(`  ≠ Node drift on "${n.name}":`)
      if (n.detail) console.log(n.detail.split('\n').map((l) => '      ' + l).join('\n'))
    }
  }
  if (report.connectionDiff) {
    console.log('  ≠ Connection graph drift:')
    console.log(report.connectionDiff.split('\n').map((l) => '      ' + l).join('\n'))
  }
}

async function main() {
  console.log(`🔎 n8n drift check @ ${API_BASE}\n   Pairs: ${WORKFLOW_PAIRS.length}`)
  let anyDrift = false
  for (const pair of WORKFLOW_PAIRS) {
    try {
      const [prod, stag] = await Promise.all([fetchWorkflow(pair.prodId), fetchWorkflow(pair.stagId)])
      const report = compareWorkflows(pair.label, prod, stag, pair.ignorePaths ?? [])
      printReport(report)
      if (report.hasDrift) anyDrift = true
    } catch (err) {
      console.log(`\n❌ ${pair.label}: ${err instanceof Error ? err.message : String(err)}`)
      anyDrift = true
    }
  }

  console.log('')
  if (!anyDrift) {
    console.log('✅ All workflow pairs are in sync.')
    process.exit(0)
  }
  if (WARN_ONLY) {
    console.log('⚠️  Drift detected but --warn mode is on; exiting 0.')
    process.exit(0)
  }
  console.log('❌ Drift detected. Fix STAG/PROD or update ignorePaths for expected diffs.')
  process.exit(1)
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(2)
})
