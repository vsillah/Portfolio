/** Local-first Portfolio eval inventory and monthly evidence review. No provider calls. */
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

export type Freshness = 'absent' | 'stale' | 'current' | 'gated'
type Family = {
  id: string; owner: string; scope: string; testFiles: string[]; command: string[]
  threshold: { kind: string; source: string }; requiredEnvironment: string[]
  mode: 'local' | 'gated'; freshness: { maxAgeDays: number; basis: string }
  evidence: { location: string; format: string; snapshotKey?: string }
  remediation: { owner: string; route: string }
}
type Manifest = { schemaVersion: number; discoveryPattern: string; families: Family[] }
type Snapshot = Record<string, { count: number; latestAt: string | null }>
const root = resolve(process.cwd())

export function discoverTests(directory = root, pattern = /(eval|benchmark|golden|quality|qa|llm-judge|chatbot|video-script|source-validator)/i): string[] {
  const found: string[] = []
  function walk(dir: string) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', '.next', '.codex-worktrees', 'portfolio-old'].includes(item.name)) continue
      const full = join(dir, item.name)
      if (item.isDirectory()) walk(full)
      else if (/\.(test)\.(ts|tsx)$/.test(item.name) && pattern.test(relative(directory, full))) {
        found.push(relative(directory, full).replaceAll('\\', '/'))
      }
    }
  }
  for (const dir of ['lib', 'scripts', 'app']) if (existsSync(join(directory, dir))) walk(join(directory, dir))
  return found.sort()
}

export function validateManifest(manifest: Manifest, discovered: string[]): string[] {
  const errors: string[] = []
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.families)) return ['Unsupported manifest schema']
  if (!manifest.discoveryPattern || typeof manifest.discoveryPattern !== 'string') errors.push('Missing discovery pattern')
  const ids = new Set<string>(), covered = new Set<string>()
  for (const family of manifest.families) {
    if (!family.id || ids.has(family.id)) errors.push(`Missing or duplicate family id: ${family.id}`)
    ids.add(family.id)
    for (const key of ['owner', 'scope'] as const) if (!family[key]) errors.push(`${family.id}: missing ${key}`)
    if (!Array.isArray(family.command) || !family.command.length || family.command.some(arg => !arg || typeof arg !== 'string')) errors.push(`${family.id}: missing executable command`)
    if (!['local', 'gated'].includes(family.mode)) errors.push(`${family.id}: invalid mode`)
    if (!family.threshold?.kind || !family.threshold?.source) errors.push(`${family.id}: missing threshold or source`)
    if (!Array.isArray(family.requiredEnvironment)) errors.push(`${family.id}: missing required environment declaration`)
    if (!Number.isFinite(family.freshness?.maxAgeDays) || family.freshness.maxAgeDays <= 0 || !family.freshness.basis) errors.push(`${family.id}: invalid freshness policy`)
    if (!family.evidence?.location || !family.evidence?.format) errors.push(`${family.id}: missing evidence declaration`)
    if (!family.remediation?.owner || !family.remediation?.route) errors.push(`${family.id}: missing remediation route`)
    if (!Array.isArray(family.testFiles)) errors.push(`${family.id}: missing test coverage list`)
    else for (const file of family.testFiles) {
      if (covered.has(file)) errors.push(`${file}: covered twice`)
      covered.add(file)
      if (!discovered.includes(file)) errors.push(`${file}: listed test is missing or outside discovery`)
    }
    if (family.testFiles?.length && (family.command[0] !== 'vitest' || family.command[1] !== 'run' || family.command.length !== family.testFiles.length + 2 || !family.testFiles.every(file => family.command.includes(file)))) errors.push(`${family.id}: command must run exactly the listed tests`)
    if (!family.testFiles?.length && family.evidence?.snapshotKey && JSON.stringify(family.command) !== JSON.stringify(['tsx', 'scripts/portfolio-eval-monthly.ts', '--evidence-only', family.id])) errors.push(`${family.id}: hosted command must be evidence-only`)
    if (family.mode === 'local' && !family.testFiles?.length) errors.push(`${family.id}: local command needs test files`)
  }
  for (const file of discovered) if (!covered.has(file)) errors.push(`${file}: no manifest owner`)
  return errors
}

export function evidenceFreshness(entry: { count: number; latestAt: string | null } | undefined, maxAgeDays: number, now = new Date()): Freshness {
  if (!entry || entry.count <= 0 || !entry.latestAt) return 'absent'
  const at = new Date(entry.latestAt).getTime()
  if (!Number.isFinite(at) || at > now.getTime()) return 'stale'
  return now.getTime() - at > maxAgeDays * 86400000 ? 'stale' : 'current'
}

export function hostedFreshness(snapshot: Snapshot | undefined, key: string, maxAgeDays: number, now = new Date()): Freshness {
  return snapshot ? evidenceFreshness(snapshot[key], maxAgeDays, now) : 'gated'
}

function run() {
  const args = process.argv.slice(2)
  const only = args[args.indexOf('--evidence-only') + 1]
  const evidenceOnly = args.includes('--evidence-only')
  const includeGated = args.includes('--include-gated')
  const snapshotPath = process.env.PORTFOLIO_EVAL_SNAPSHOT_PATH
  const now = new Date()
  let manifest: Manifest
  const errors: string[] = []
  try {
    const parsed = JSON.parse(readFileSync(join(root, 'data/evals/manifest.json'), 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Manifest must be a JSON object')
    manifest = parsed as Manifest
  }
  catch (error) {
    errors.push(`Manifest unreadable: ${(error as Error).message}`)
    manifest = { schemaVersion: -1, discoveryPattern: 'eval', families: [] }
  }
  let discovered: string[] = []
  try { discovered = discoverTests(root, new RegExp(manifest.discoveryPattern, 'i')) }
  catch (error) { errors.push(`Invalid discovery pattern: ${(error as Error).message}`) }
  errors.push(...validateManifest(manifest, discovered))
  let snapshot: Snapshot | undefined
  let snapshotSha256: string | null = null
  if (snapshotPath) {
    try {
      const raw = readFileSync(resolve(snapshotPath), 'utf8')
      snapshotSha256 = createHash('sha256').update(raw).digest('hex')
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Snapshot must be a JSON object')
      snapshot = parsed as Snapshot
    }
    catch (error) { errors.push(`Snapshot unreadable: ${(error as Error).message}`) }
  }
  if (evidenceOnly && (!only || !manifest.families.some(f => f.id === only && f.evidence.snapshotKey))) errors.push('Unknown evidence-only family')
  const results: Array<{ id: string; status: string; detail: string; owner: string; remediation: string }> = []
  if (!errors.length) for (const family of manifest.families) {
    if (evidenceOnly && family.id !== only) continue
    if (family.evidence.snapshotKey) {
      const status = hostedFreshness(snapshot, family.evidence.snapshotKey, family.freshness.maxAgeDays, now)
      results.push({ id: family.id, status, detail: snapshot ? `${snapshot[family.evidence.snapshotKey]?.count ?? 0} records; latest ${snapshot[family.evidence.snapshotKey]?.latestAt ?? 'none'}` : 'No approved snapshot supplied', owner: family.remediation.owner, remediation: family.remediation.route })
      if ((includeGated || evidenceOnly) && !snapshot) errors.push(`${family.id}: PORTFOLIO_EVAL_SNAPSHOT_PATH unavailable`)
      if (snapshot && status !== 'current') errors.push(`${family.id}: ${status} evidence`)
      continue
    }
    if (family.mode === 'gated' && !includeGated) {
      results.push({ id: family.id, status: 'gated', detail: 'Requires explicit --include-gated and reviewed environment', owner: family.remediation.owner, remediation: family.remediation.route })
      continue
    }
    const missing = family.requiredEnvironment.filter(name => !process.env[name])
    if (missing.length) {
      errors.push(`${family.id}: missing environment ${missing.join(', ')}`)
      results.push({ id: family.id, status: 'blocked', detail: `Missing ${missing.join(', ')}`, owner: family.remediation.owner, remediation: family.remediation.route })
      continue
    }
    const [binary, ...commandArgs] = family.command
    const executable = binary === 'vitest' ? join(root, 'node_modules/.bin/vitest') : binary === 'tsx' ? join(root, 'node_modules/.bin/tsx') : ''
    if (!executable || !existsSync(executable)) {
      errors.push(`${family.id}: command unavailable: ${binary}`)
      results.push({ id: family.id, status: 'blocked', detail: 'Command unavailable', owner: family.remediation.owner, remediation: family.remediation.route })
      continue
    }
    const result = spawnSync(executable, commandArgs, { cwd: root, encoding: 'utf8', timeout: 180000, env: process.env })
    const status = result.status === 0 ? 'passed' : 'failed'
    results.push({ id: family.id, status, detail: (result.stderr || result.stdout || result.error?.message || '').slice(-1200), owner: family.remediation.owner, remediation: family.remediation.route })
    if (status === 'failed') errors.push(`${family.id}: threshold failed (all tests must pass)`)
  }
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim()
  const report = {
    schemaVersion: 1, generatedAt: now.toISOString(), commit: git,
    mode: evidenceOnly ? 'evidence-only' : includeGated ? 'gated' : 'local',
    snapshotSha256,
    coverage: { discoveredTests: discovered.length, registeredTests: manifest.families.flatMap(f => f.testFiles ?? []).length },
    summary: { passed: results.filter(r => r.status === 'passed').length, gated: results.filter(r => r.status === 'gated').length, failed: results.filter(r => !['passed', 'gated', 'current'].includes(r.status)).length, currentEvidence: results.filter(r => r.status === 'current').length },
    results, errors,
  }
  const outputDir = join(root, 'reports/evals/monthly')
  mkdirSync(outputDir, { recursive: true })
  const output = join(outputDir, now.toISOString().replaceAll(':', '-') + '.json')
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
  console.log(`Eval report: ${output}\n${results.map(r => `${r.id}: ${r.status}`).join('\n')}`)
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
}
if (process.argv[1]?.endsWith('portfolio-eval-monthly.ts')) run()
