#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import {
  buildCredentialBaselineTemplate,
  buildCredentialReport,
  type CredentialSinkPresenceObservation,
  type CredentialRotationPacket,
  renderCredentialBaselineTemplateMarkdown,
  renderCredentialReportMarkdown,
} from '../lib/credential-report'

type EnvironmentName = 'dev' | 'staging' | 'prod'
type SourceOfTruth = 'infisical' | '1password'
type RotationMode = 'generated-shared-secret' | 'provider-dashboard-or-api' | 'manual-reauth'

type CredentialInventory = {
  schemaVersion: number
  policy: {
    sourceOfTruth: string
    runtimeSinks: string[]
    agentAuthority: string
    defaultCadenceDays: Record<string, number>
  }
  providers: {
    infisical: {
      projectSlug: string
      projectId?: string
      secretPath: string
      envMap: Record<EnvironmentName, string>
    }
    onepassword: {
      vaults: Record<EnvironmentName, string>
    }
  }
  secrets: CredentialSecret[]
}

type CredentialSecret = {
  id: string
  envVar: string
  displayName: string
  category: string
  risk: string
  sourceOfTruth: SourceOfTruth
  rotationMode: RotationMode
  rotationCadenceDays: number
  environments: EnvironmentName[]
  runtimeSinks: string[]
  verification: string[]
  rollback: string
  approvalRequired?: EnvironmentName[]
  baseline?: Partial<Record<EnvironmentName, CredentialBaseline>>
  lastRotatedAt?: Partial<Record<EnvironmentName, string>>
}

type CredentialBaseline = {
  status: 'pending-provider-confirmation' | 'confirmed' | 'unknown'
  lastRotatedAt: string | null
  evidence: string
  updatedAt: string
}

type RotationPacket = {
  createdAt: string
  type: 'rotation' | 'runtime-sync'
  environment: EnvironmentName
  secretId: string
  envVar: string
  sourceOfTruth: SourceOfTruth
  rotationMode: RotationMode
  cadenceDays: number
  runtimeSinks: string[]
  approvalRequired: boolean
  generatedFingerprint: string | null
  action: string
  verification: string[]
  rollback: string
  localEnvUpdated?: string
}

type ParsedArgs = {
  command: string
  options: Record<string, string | boolean>
  passthrough: string[]
}

const ROOT = path.resolve(__dirname, '..')
const INVENTORY_PATH = path.join(ROOT, 'docs', 'credential-inventory.json')
const AUDIT_DIR = path.join(ROOT, '.credential-rotation-audits')
const VALID_ENVS: EnvironmentName[] = ['dev', 'staging', 'prod']
const PROVIDER_READ_TIMEOUT_MS = 10_000
const PROVIDER_WRITE_TIMEOUT_MS = 60_000
const VERCEL_METADATA_TIMEOUT_MS = 15_000
const N8N_METADATA_TIMEOUT_MS = 15_000

function main() {
  const args = parseArgs(process.argv.slice(2))
  const inventory = loadInventory()

  switch (args.command) {
    case 'list-due':
      listDue(inventory, args)
      break
    case 'report':
      report(inventory, args)
      break
    case 'baseline-template':
      baselineTemplate(inventory, args)
      break
    case 'bootstrap-infisical':
      bootstrapInfisical(inventory, args)
      break
    case 'inject':
      inject(inventory, args)
      break
    case 'rotate':
      rotate(inventory, args)
      break
    case 'sync-runtime':
      syncRuntime(inventory, args)
      break
    case 'smoke':
      smoke(inventory, args)
      break
    case 'help':
    case '':
      printHelp()
      break
    default:
      fail(`Unknown command: ${args.command}`)
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const splitAt = argv.indexOf('--')
  const head = splitAt === -1 ? argv : argv.slice(0, splitAt)
  const passthrough = splitAt === -1 ? [] : argv.slice(splitAt + 1)
  const [command = 'help', ...rest] = head
  const options: Record<string, string | boolean> = {}

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i]
    if (!token.startsWith('--')) fail(`Unexpected positional argument before passthrough: ${token}`)
    const key = token.slice(2)
    const next = rest[i + 1]
    if (!next || next.startsWith('--')) {
      options[key] = true
    } else {
      options[key] = next
      i += 1
    }
  }

  return { command, options, passthrough }
}

function loadInventory(): CredentialInventory {
  return JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as CredentialInventory
}

function getEnv(args: ParsedArgs): EnvironmentName {
  const raw = String(args.options.env || 'staging')
  if (!VALID_ENVS.includes(raw as EnvironmentName)) {
    fail(`Invalid --env ${raw}. Expected one of: ${VALID_ENVS.join(', ')}`)
  }
  return raw as EnvironmentName
}

function findSecret(inventory: CredentialInventory, idOrEnvVar: string): CredentialSecret {
  const secret = inventory.secrets.find((item) => item.id === idOrEnvVar || item.envVar === idOrEnvVar)
  if (!secret) fail(`Secret not found in inventory: ${idOrEnvVar}`)
  return secret
}

function envSecrets(inventory: CredentialInventory, env: EnvironmentName): CredentialSecret[] {
  return inventory.secrets.filter((secret) => secret.environments.includes(env))
}

function listDue(inventory: CredentialInventory, args: ParsedArgs) {
  const env = getEnv(args)
  const asOf = new Date(String(args.options['as-of'] || new Date().toISOString()))
  if (Number.isNaN(asOf.getTime())) fail(`Invalid --as-of value: ${String(args.options['as-of'])}`)

  const rows = envSecrets(inventory, env).map((secret) => {
    const baseline = getBaseline(secret, env)
    const lastRotatedAt = baseline.lastRotatedAt
    const dueAt = lastRotatedAt ? addDays(new Date(lastRotatedAt), secret.rotationCadenceDays) : null
    const status = !lastRotatedAt ? 'needs-baseline' : dueAt && dueAt <= asOf ? 'due' : 'ok'
    return {
      id: secret.id,
      envVar: secret.envVar,
      sourceOfTruth: secret.sourceOfTruth,
      rotationMode: secret.rotationMode,
      cadenceDays: secret.rotationCadenceDays,
      lastRotatedAt,
      dueAt: dueAt ? dueAt.toISOString().slice(0, 10) : null,
      status,
      baselineStatus: baseline.status,
      baselineEvidence: baseline.evidence,
      approvalRequired: secret.approvalRequired?.includes(env) ?? false,
    }
  })

  if (args.options.json) {
    console.log(JSON.stringify(rows, null, 2))
    return
  }

  console.log(`Credential rotation status for ${env} as of ${asOf.toISOString().slice(0, 10)}`)
  for (const row of rows) {
    const approval = row.approvalRequired ? ' approval-required' : ''
    const due = row.dueAt ? ` due=${row.dueAt}` : ' due=unknown'
    console.log(`${row.status.padEnd(14)} ${row.envVar.padEnd(32)} ${row.rotationMode}${due} baseline=${row.baselineStatus}${approval}`)
  }
}

function report(inventory: CredentialInventory, args: ParsedArgs) {
  const env = getEnv(args)
  const asOf = String(args.options['as-of'] || new Date().toISOString())
  const sinkPresence = args.options['check-sinks'] ? collectRuntimeSinkPresence(inventory, env) : []
  const credentialReport = buildCredentialReport(inventory, env, asOf, readRotationPackets(), sinkPresence)

  if (args.options.json) {
    console.log(JSON.stringify(credentialReport, null, 2))
    return
  }

  console.log(renderCredentialReportMarkdown(credentialReport))
}

function baselineTemplate(inventory: CredentialInventory, args: ParsedArgs) {
  const env = getEnv(args)
  const updatedAt = String(args.options['updated-at'] || new Date().toISOString())
  const entries = buildCredentialBaselineTemplate(inventory, env, updatedAt)

  if (args.options.json) {
    console.log(JSON.stringify(entries, null, 2))
    return
  }

  console.log(renderCredentialBaselineTemplateMarkdown(env, entries))
}

function bootstrapInfisical(inventory: CredentialInventory, args: ParsedArgs) {
  const env = getEnv(args)
  const sourceFile = String(args.options.source || '.env.local')
  const apply = Boolean(args.options.apply)
  const localValues = readLocalEnvValues(sourceFile)
  const selected = selectSecrets(inventory, args, env)
    .filter((secret) => secret.sourceOfTruth === 'infisical')

  const rows = selected.map((secret) => {
    const value = localValues.get(secret.envVar)?.trim() ?? ''
    return {
      envVar: secret.envVar,
      secretId: secret.id,
      runtimeSinks: secret.runtimeSinks,
      action: value ? apply ? 'will-import' : 'would-import' : 'skipped-missing-or-empty',
      hasValue: Boolean(value),
      value,
    }
  })
  const importable = rows.filter((row) => row.hasValue)
  const skipped = rows.filter((row) => !row.hasValue)

  console.log(`Infisical bootstrap ${apply ? 'apply' : 'dry-run'} for ${env}`)
  console.log(`source=${sourceFile}`)
  console.log(`tracked-infisical-secrets=${selected.length}`)
  console.log(`importable=${importable.length}`)
  console.log(`skipped-missing-or-empty=${skipped.length}`)
  console.log('')
  for (const row of rows) {
    console.log(`${row.action.padEnd(24)} ${row.envVar}`)
  }

  if (!apply) {
    console.log('')
    console.log('No values were written. Re-run with --apply to populate Infisical from the local runtime sink.')
    return
  }

  if (importable.length === 0) {
    console.log('No importable values found; Infisical was not changed.')
    return
  }

  const imported = writeInfisicalSecretsFile(inventory, env, importable.map((row) => [row.envVar, row.value]))
  console.log('')
  console.log(`Infisical populated for ${imported} key(s). Values were not printed.`)
  console.log('Baseline evidence remains pending-provider-confirmation until provider history or approved rotation packets are recorded.')
}

function inject(inventory: CredentialInventory, args: ParsedArgs) {
  const env = getEnv(args)
  if (args.passthrough.length === 0) fail('credentials:inject requires a command after --')
  const selected = selectSecrets(inventory, args, env)
  const injectedEnv: Record<string, string> = {}

  for (const secret of selected) {
    injectedEnv[secret.envVar] = readSecret(inventory, secret, env)
  }

  const result = spawnSync(args.passthrough[0], args.passthrough.slice(1), {
    cwd: ROOT,
    env: { ...process.env, ...injectedEnv },
    stdio: 'inherit',
  })
  process.exit(result.status ?? 1)
}

function rotate(inventory: CredentialInventory, args: ParsedArgs) {
  const env = getEnv(args)
  const secretName = String(args.options.secret || '')
  if (!secretName) fail('credentials:rotate requires --secret <id-or-env-var>')
  const secret = findSecret(inventory, secretName)
  if (!secret.environments.includes(env)) fail(`${secret.envVar} is not configured for ${env}`)

  const approvalRequired = secret.approvalRequired?.includes(env) ?? false
  const generated = secret.rotationMode === 'generated-shared-secret'
    ? generateSecret(Number(args.options.length || 48))
    : null
  const writesLocalEnv = Boolean(generated && args.options['local-env'])

  const packet = buildPacket({
    type: 'rotation',
    env,
    secret,
    generatedFingerprint: generated ? fingerprint(generated) : null,
    approvalRequired,
    action: generated
      ? writesLocalEnv
        ? 'Generated replacement value and wrote it to the requested ignored local env sink. Update Infisical and runtime sinks, verify, then revoke the old credential after approval if required.'
        : 'Dry-run only. Generated replacement value in memory for fingerprinting, then discarded it. Re-run with --local-env <path> when ready to write an ignored local env sink.'
      : 'Provider-backed rotation required. Create the replacement at the provider, update source of truth, sync runtime sinks, verify, then revoke the old credential.',
  })

  if (generated && args.options['local-env']) {
    writeLocalEnv(String(args.options['local-env']), secret.envVar, generated)
    packet.localEnvUpdated = String(args.options['local-env'])
  }

  writePacket(packet)
  printPacketSummary(packet)
}

function syncRuntime(inventory: CredentialInventory, args: ParsedArgs) {
  const env = getEnv(args)
  const secretName = String(args.options.secret || '')
  if (!secretName) fail('credentials:sync-runtime requires --secret <id-or-env-var>')
  const secret = findSecret(inventory, secretName)
  if (!secret.environments.includes(env)) fail(`${secret.envVar} is not configured for ${env}`)

  const packet = buildPacket({
    type: 'runtime-sync',
    env,
    secret,
    generatedFingerprint: null,
    approvalRequired: secret.approvalRequired?.includes(env) ?? false,
    action: 'Sync runtime sinks from the source of truth. The broker prepares the sink checklist and verification commands without printing secret values.',
  })

  if (args.options['local-env']) {
    const value = readSecret(inventory, secret, env)
    writeLocalEnv(String(args.options['local-env']), secret.envVar, value)
    packet.localEnvUpdated = String(args.options['local-env'])
  }

  writePacket(packet)
  printPacketSummary(packet)
}

function smoke(inventory: CredentialInventory, args: ParsedArgs) {
  const env = getEnv(args)
  const requireProviderAccess = Boolean(args.options['require-provider-access'])
  const checks: Array<{ label: string; command: string[]; required: boolean }> = [
    { label: 'Inventory loads', command: ['node', '-e', `JSON.parse(require('fs').readFileSync(${JSON.stringify(INVENTORY_PATH)}, 'utf8'));`], required: true },
    { label: 'n8n export secret scan', command: ['bash', 'scripts/check-n8n-secrets.sh'], required: true },
    { label: 'Infisical CLI available', command: ['infisical', '--version'], required: requireProviderAccess },
    { label: '1Password CLI available', command: ['op', '--version'], required: requireProviderAccess },
  ]

  if (process.env.N8N_API_KEY) {
    checks.push({ label: 'n8n workflow drift warning check', command: ['npm', 'run', 'n8n:drift-check', '--', '--warn'], required: false })
  }

  const results = checks.map((check) => runCheck(check))
  const providerResults = runProviderAccessChecks(inventory, env, requireProviderAccess)
  const dueCount = envSecrets(inventory, env).filter((secret) => !getBaseline(secret, env).lastRotatedAt).length
  console.log(`Credential inventory secrets for ${env}: ${envSecrets(inventory, env).length}`)
  console.log(`Secrets missing rotation baseline for ${env}: ${dueCount}`)

  const failedRequired = results.filter((result) => result.required && !result.ok)
  const failedProviderRequired = providerResults.filter((result) => result.required && !result.ok)
  if (failedRequired.length > 0 || failedProviderRequired.length > 0) {
    process.exit(1)
  }
}

function getBaseline(secret: CredentialSecret, env: EnvironmentName): CredentialBaseline {
  const explicit = secret.baseline?.[env]
  if (explicit) return explicit
  return {
    status: secret.lastRotatedAt?.[env] ? 'confirmed' : 'unknown',
    lastRotatedAt: secret.lastRotatedAt?.[env] ?? null,
    evidence: secret.lastRotatedAt?.[env] ? 'legacy lastRotatedAt field' : 'baseline not recorded',
    updatedAt: 'unknown',
  }
}

function runProviderAccessChecks(inventory: CredentialInventory, env: EnvironmentName, required: boolean) {
  const checks: Array<{ provider: SourceOfTruth; label: string; secret: CredentialSecret | undefined; required: boolean }> = [
    {
      provider: 'infisical',
      label: 'Infisical scoped secret read',
      secret: envSecrets(inventory, env).find((secret) => secret.sourceOfTruth === 'infisical'),
      required,
    },
    {
      provider: '1password',
      label: '1Password scoped item read',
      secret: envSecrets(inventory, env).find((secret) => secret.sourceOfTruth === '1password'),
      required,
    },
  ]

  return checks.map((check) => {
    if (!check.secret) {
      console.log(`skipped ${check.label} no ${check.provider} secret in inventory for ${env}`)
      return { ...check, ok: !check.required }
    }

    const result = tryReadSecret(inventory, check.secret, env)
    const marker = result.ok ? 'ok' : check.required ? 'failed' : 'skipped'
    console.log(`${marker.padEnd(7)} ${check.label} (${check.secret.envVar})`)
    if (result.ok === false && check.required) console.error(result.message)
    return { ...check, ok: result.ok }
  })
}

function selectSecrets(inventory: CredentialInventory, args: ParsedArgs, env: EnvironmentName): CredentialSecret[] {
  const raw = args.options.secret
  if (!raw) return envSecrets(inventory, env)
  return String(raw)
    .split(',')
    .map((part) => findSecret(inventory, part.trim()))
    .filter((secret) => secret.environments.includes(env))
}

function readSecret(inventory: CredentialInventory, secret: CredentialSecret, env: EnvironmentName): string {
  const result = tryReadSecret(inventory, secret, env)
  if (result.ok === false) fail(result.message)
  return result.value
}

function tryReadSecret(
  inventory: CredentialInventory,
  secret: CredentialSecret,
  env: EnvironmentName,
): { ok: true; value: string } | { ok: false; message: string } {
  if (secret.sourceOfTruth === 'infisical') {
    const infisicalEnv = inventory.providers.infisical.envMap[env]
    const secretPath = inventory.providers.infisical.secretPath
    const args = ['secrets', 'get', secret.envVar, '--env', infisicalEnv, '--path', secretPath, '--plain']
    if (inventory.providers.infisical.projectId) args.push('--projectId', inventory.providers.infisical.projectId)
    const result = spawnSync('infisical', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      timeout: PROVIDER_READ_TIMEOUT_MS,
    })
    if (result.status !== 0) {
      return {
        ok: false,
        message: `Infisical read failed for ${secret.envVar}. Authenticate the Infisical CLI and confirm ${infisicalEnv}${secretPath} access.`,
      }
    }
    const value = result.stdout.trim()
    if (!value) return { ok: false, message: `Infisical returned an empty value for ${secret.envVar}.` }
    return { ok: true, value }
  }

  const vault = inventory.providers.onepassword.vaults[env]
  const result = spawnSync('op', ['item', 'get', secret.envVar, '--vault', vault, '--format', 'json'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    timeout: PROVIDER_READ_TIMEOUT_MS,
  })
  if (result.status !== 0) {
    return { ok: false, message: `1Password read failed for ${secret.envVar}. Expected item ${secret.envVar} in vault ${vault}.` }
  }
  let item: { fields?: Array<{ id?: string; label?: string; value?: string }> }
  try {
    item = JSON.parse(result.stdout) as { fields?: Array<{ id?: string; label?: string; value?: string }> }
  } catch {
    return { ok: false, message: `1Password returned invalid JSON for ${secret.envVar}.` }
  }
  const field = item.fields?.find((candidate) => candidate.label === 'credential' || candidate.id === 'credential')
  const value = field?.value?.trim() ?? ''
  if (!value) return { ok: false, message: `1Password returned an empty value for ${secret.envVar}.` }
  return { ok: true, value }
}

function writeLocalEnv(filePath: string, envVar: string, value: string) {
  const resolved = path.resolve(ROOT, filePath)
  if (!resolved.startsWith(ROOT)) fail(`Refusing to write outside repo: ${filePath}`)

  const current = existsSync(resolved) ? readFileSync(resolved, 'utf8') : ''
  const lines = current.split(/\r?\n/)
  const escaped = value.includes('\n') ? JSON.stringify(value) : value
  const nextLine = `${envVar}=${escaped}`
  let replaced = false
  const next = lines.map((line) => {
    if (line.startsWith(`${envVar}=`)) {
      replaced = true
      return nextLine
    }
    return line
  })
  if (!replaced) next.push(nextLine)
  writeFileSync(resolved, `${next.filter((line, index) => line.length > 0 || index < next.length - 1).join('\n')}\n`)
}

function readLocalEnvValues(filePath: string): Map<string, string> {
  const resolved = path.resolve(ROOT, filePath)
  if (!resolved.startsWith(ROOT)) fail(`Refusing to read outside repo: ${filePath}`)
  if (!existsSync(resolved)) fail(`Local env source not found: ${filePath}`)

  const values = new Map<string, string>()
  for (const line of readFileSync(resolved, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    const key = match[1]
    let value = match[2] ?? ''
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    values.set(key, value)
  }
  return values
}

function writeInfisicalSecretsFile(
  inventory: CredentialInventory,
  env: EnvironmentName,
  entries: Array<[string, string]>
): number {
  const infisicalEnv = inventory.providers.infisical.envMap[env]
  const secretPath = inventory.providers.infisical.secretPath
  const tempDir = mkdtempSync(path.join(tmpdir(), 'portfolio-infisical-bootstrap-'))
  const tempFile = path.join(tempDir, 'secrets.env')

  try {
    const content = entries.map(([key, value]) => `${key}=${formatEnvValue(value)}`).join('\n')
    writeFileSync(tempFile, `${content}\n`, { mode: 0o600 })

    const command = ['secrets', 'set', '--file', tempFile, '--env', infisicalEnv, '--path', secretPath, '--silent']
    if (inventory.providers.infisical.projectId) command.push('--projectId', inventory.providers.infisical.projectId)
    const result = spawnSync('infisical', command, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      timeout: PROVIDER_WRITE_TIMEOUT_MS,
    })

    if (result.status !== 0) {
      fail(`Infisical bootstrap failed for ${env}. Confirm CLI authentication and ${infisicalEnv}${secretPath} write access.`)
    }

    return entries.length
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

function formatEnvValue(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]*$/.test(value)) return value
  return JSON.stringify(value)
}

function buildPacket(input: {
  type: 'rotation' | 'runtime-sync'
  env: EnvironmentName
  secret: CredentialSecret
  generatedFingerprint: string | null
  approvalRequired: boolean
  action: string
}): RotationPacket {
  return {
    createdAt: new Date().toISOString(),
    type: input.type,
    environment: input.env,
    secretId: input.secret.id,
    envVar: input.secret.envVar,
    sourceOfTruth: input.secret.sourceOfTruth,
    rotationMode: input.secret.rotationMode,
    cadenceDays: input.secret.rotationCadenceDays,
    runtimeSinks: input.secret.runtimeSinks,
    approvalRequired: input.approvalRequired,
    generatedFingerprint: input.generatedFingerprint,
    action: input.action,
    verification: input.secret.verification.map((item) => item.split('{env}').join(input.env)),
    rollback: input.secret.rollback,
  }
}

function writePacket(packet: RotationPacket) {
  mkdirSync(AUDIT_DIR, { recursive: true })
  const stamp = packet.createdAt.split(':').join('-').replace(/\.\d+Z$/, 'Z')
  const filename = `${stamp}-${packet.environment}-${packet.secretId}-${packet.type}.json`
  writeFileSync(path.join(AUDIT_DIR, filename), `${JSON.stringify(packet, null, 2)}\n`)
}

function readRotationPackets(): CredentialRotationPacket[] {
  if (!existsSync(AUDIT_DIR)) return []
  return readdirSync(AUDIT_DIR)
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => {
      try {
        return [JSON.parse(readFileSync(path.join(AUDIT_DIR, file), 'utf8')) as CredentialRotationPacket]
      } catch {
        return []
      }
    })
}

function collectRuntimeSinkPresence(
  inventory: CredentialInventory,
  env: EnvironmentName
): CredentialSinkPresenceObservation[] {
  const checkedAt = new Date().toISOString()
  const localEnvKeys = readLocalEnvKeys(env)
  const vercelEnvKeys = readVercelEnvKeys(env)
  const n8nCredentialMetadata = readN8nCredentialMetadata()

  return envSecrets(inventory, env).flatMap((secret) => secret.runtimeSinks.map((sink) => {
    if (sink === 'local-env') {
      return localEnvPresenceObservation(secret, sink, checkedAt, localEnvKeys)
    }
    if (sink === 'Vercel') {
      return vercelPresenceObservation(secret, sink, checkedAt, vercelEnvKeys)
    }
    if (sink === 'n8n Variables') {
      return n8nVariablePresenceObservation(secret, sink, checkedAt)
    }
    if (sink === 'n8n Credentials') {
      return n8nCredentialPresenceObservation(secret, sink, checkedAt, n8nCredentialMetadata)
    }

    return {
      secretId: secret.id,
      envVar: secret.envVar,
      sink,
      status: 'unknown',
      evidence: `${sink} metadata check is not configured in this read-only broker path.`,
      checkedAt,
    } satisfies CredentialSinkPresenceObservation
  }))
}

type N8nCredentialMetadata = {
  unavailableReason: string | null
  credentials: Array<{ name: string; type: string }>
}

function readN8nCredentialMetadata(): N8nCredentialMetadata {
  const apiKey = process.env.N8N_API_KEY
  const baseUrl = (process.env.N8N_BASE_URL || 'https://amadutown.app.n8n.cloud').replace(/\/$/, '')

  if (!apiKey) {
    return {
      unavailableReason: 'n8n credential metadata unavailable because N8N_API_KEY is not set.',
      credentials: [],
    }
  }

  const script = `
const baseUrl = process.env.N8N_BASE_URL || 'https://amadutown.app.n8n.cloud';
const apiKey = process.env.N8N_API_KEY;
(async () => {
  const response = await fetch(baseUrl.replace(/\\/$/, '') + '/api/v1/credentials', {
    headers: { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' },
  });
  if (!response.ok) process.exit(1);
  const body = await response.json();
  const items = Array.isArray(body) ? body : Array.isArray(body.data) ? body.data : [];
  const credentials = items.map((item) => ({ name: String(item.name || ''), type: String(item.type || '') }));
  console.log(JSON.stringify({ credentials }));
})().catch(() => process.exit(1));
`
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, N8N_BASE_URL: baseUrl, N8N_API_KEY: apiKey },
    timeout: N8N_METADATA_TIMEOUT_MS,
  })

  if (result.status !== 0) {
    return {
      unavailableReason: 'n8n credential metadata unavailable. Authenticate N8N_API_KEY and confirm read access to /api/v1/credentials.',
      credentials: [],
    }
  }

  try {
    const parsed = JSON.parse(result.stdout) as { credentials?: Array<{ name?: string; type?: string }> }
    return {
      unavailableReason: null,
      credentials: (parsed.credentials ?? []).map((credential) => ({
        name: credential.name ?? '',
        type: credential.type ?? '',
      })),
    }
  } catch {
    return {
      unavailableReason: 'n8n credential metadata returned invalid JSON after value-free reduction.',
      credentials: [],
    }
  }
}

function n8nVariablePresenceObservation(
  secret: CredentialSecret,
  sink: string,
  checkedAt: string
): CredentialSinkPresenceObservation {
  return {
    secretId: secret.id,
    envVar: secret.envVar,
    sink,
    status: 'unknown',
    evidence: 'n8n variable metadata was not checked because the variables API may include secret values. Use a future key-only adapter or approved sanitized export.',
    checkedAt,
  }
}

function n8nCredentialPresenceObservation(
  secret: CredentialSecret,
  sink: string,
  checkedAt: string,
  metadata: N8nCredentialMetadata
): CredentialSinkPresenceObservation {
  if (metadata.unavailableReason) {
    return {
      secretId: secret.id,
      envVar: secret.envVar,
      sink,
      status: 'unavailable',
      evidence: metadata.unavailableReason,
      checkedAt,
    }
  }

  const keys = n8nCredentialReferenceKeys(secret).map((key) => key.toLowerCase())
  const matches = metadata.credentials.filter((credential) => {
    const name = credential.name.toLowerCase()
    const type = credential.type.toLowerCase()
    return keys.some((key) => name === key || type === key || name.includes(key) || type.includes(key))
  })

  if (matches.length > 0) {
    return {
      secretId: secret.id,
      envVar: secret.envVar,
      sink,
      status: 'present',
      evidence: `Found n8n credential metadata for ${secret.envVar}: ${formatReferenceList(matches.map((credential) => `${credential.name || 'unnamed'}:${credential.type || 'unknown'}`))}.`,
      checkedAt,
    }
  }

  return {
    secretId: secret.id,
    envVar: secret.envVar,
    sink,
    status: 'missing',
    evidence: `No n8n credential metadata matched ${secret.envVar}.`,
    checkedAt,
  }
}

function n8nCredentialReferenceKeys(secret: CredentialSecret): string[] {
  const keys: Record<string, string[]> = {
    ANTHROPIC_API_KEY: ['anthropicApi', 'anthropic api key', 'anthropic account'],
    APIFY_API_TOKEN: ['apifyApi', 'apify account'],
    OPENAI_API_KEY: ['openAiApi', 'openai account', 'openai staging account'],
    OPENROUTER_API_KEY: ['openRouterApi', 'openrouter account', 'openrouter api'],
  }
  return keys[secret.envVar] ?? [secret.envVar.toLowerCase(), secret.displayName.toLowerCase()]
}

function formatReferenceList(references: string[]): string {
  const displayed = references.slice(0, 4)
  const suffix = references.length > displayed.length ? ` and ${references.length - displayed.length} more` : ''
  return `${displayed.join(', ')}${suffix}`
}

function vercelTargetForEnv(env: EnvironmentName): 'development' | 'preview' | 'production' {
  if (env === 'dev') return 'development'
  if (env === 'prod') return 'production'
  return 'preview'
}

function readVercelEnvKeys(env: EnvironmentName): { target: string; keys: Set<string>; unavailableReason: string | null } {
  const target = vercelTargetForEnv(env)
  const result = spawnSync('vercel', ['env', 'list', target, '--format', 'json', '--cwd', ROOT, '--non-interactive'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    timeout: VERCEL_METADATA_TIMEOUT_MS,
  })

  if (result.status !== 0) {
    return {
      target,
      keys: new Set(),
      unavailableReason: `Vercel env metadata unavailable for ${target}. Authenticate the Vercel CLI and confirm project access.`,
    }
  }

  const jsonStart = result.stdout.indexOf('{')
  if (jsonStart === -1) {
    return {
      target,
      keys: new Set(),
      unavailableReason: `Vercel env metadata for ${target} did not include JSON output.`,
    }
  }

  try {
    const parsed = JSON.parse(result.stdout.slice(jsonStart)) as { envs?: Array<{ key?: string }> }
    return {
      target,
      keys: new Set((parsed.envs ?? []).flatMap((item) => item.key ? [item.key] : [])),
      unavailableReason: null,
    }
  } catch {
    return {
      target,
      keys: new Set(),
      unavailableReason: `Vercel env metadata for ${target} returned invalid JSON.`,
    }
  }
}

function vercelPresenceObservation(
  secret: CredentialSecret,
  sink: string,
  checkedAt: string,
  vercelEnvKeys: { target: string; keys: Set<string>; unavailableReason: string | null }
): CredentialSinkPresenceObservation {
  if (vercelEnvKeys.unavailableReason) {
    return {
      secretId: secret.id,
      envVar: secret.envVar,
      sink,
      status: 'unavailable',
      evidence: vercelEnvKeys.unavailableReason,
      checkedAt,
    }
  }

  if (vercelEnvKeys.keys.has(secret.envVar)) {
    return {
      secretId: secret.id,
      envVar: secret.envVar,
      sink,
      status: 'present',
      evidence: `Found key name in Vercel ${vercelEnvKeys.target} environment metadata.`,
      checkedAt,
    }
  }

  return {
    secretId: secret.id,
    envVar: secret.envVar,
    sink,
    status: 'missing',
    evidence: `Key name was not listed in Vercel ${vercelEnvKeys.target} environment metadata.`,
    checkedAt,
  }
}

function readLocalEnvKeys(env: EnvironmentName): { files: Array<{ file: string; keys: Set<string> }>; missingFiles: string[] } {
  const candidates = Array.from(new Set([
    `.env.${env}`,
    env === 'dev' ? '.env.local' : `.env.${env}.local`,
    '.env.local',
  ]))
  const files: Array<{ file: string; keys: Set<string> }> = []
  const missingFiles: string[] = []

  for (const file of candidates) {
    const resolved = path.join(ROOT, file)
    if (!existsSync(resolved)) {
      missingFiles.push(file)
      continue
    }
    const keys = new Set<string>()
    for (const line of readFileSync(resolved, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)
      if (match) keys.add(match[1])
    }
    files.push({ file, keys })
  }

  return { files, missingFiles }
}

function localEnvPresenceObservation(
  secret: CredentialSecret,
  sink: string,
  checkedAt: string,
  localEnvKeys: { files: Array<{ file: string; keys: Set<string> }>; missingFiles: string[] }
): CredentialSinkPresenceObservation {
  const matches = localEnvKeys.files.filter((file) => file.keys.has(secret.envVar)).map((file) => file.file)
  if (matches.length > 0) {
    return {
      secretId: secret.id,
      envVar: secret.envVar,
      sink,
      status: 'present',
      evidence: `Found key name in local env file: ${matches.join(', ')}.`,
      checkedAt,
    }
  }

  if (localEnvKeys.files.length === 0) {
    return {
      secretId: secret.id,
      envVar: secret.envVar,
      sink,
      status: 'unavailable',
      evidence: `No local env files found to inspect. Checked: ${localEnvKeys.missingFiles.join(', ')}.`,
      checkedAt,
    }
  }

  return {
    secretId: secret.id,
    envVar: secret.envVar,
    sink,
    status: 'missing',
    evidence: `Key name was not found in inspected local env files: ${localEnvKeys.files.map((file) => file.file).join(', ')}.`,
    checkedAt,
  }
}

function printPacketSummary(packet: RotationPacket) {
  console.log(`${packet.type} packet written for ${packet.envVar} (${packet.environment})`)
  console.log(`source=${packet.sourceOfTruth} sinks=${packet.runtimeSinks.join(', ')}`)
  if (packet.approvalRequired) console.log('approval=required before production/client-impacting revocation')
  if (packet.generatedFingerprint) console.log(`new-value-fingerprint=${packet.generatedFingerprint}`)
  if (packet.localEnvUpdated) console.log(`local-env-updated=${packet.localEnvUpdated}`)
  console.log('verification:')
  for (const item of packet.verification) console.log(`- ${item}`)
}

function runCheck(check: { label: string; command: string[]; required: boolean }) {
  const result = spawnSync(check.command[0], check.command.slice(1), {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })
  const ok = result.status === 0
  const marker = ok ? 'ok' : check.required ? 'failed' : 'skipped'
  console.log(`${marker.padEnd(7)} ${check.label}`)
  if (!ok && check.required) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    if (output) console.error(output)
  }
  return { ...check, ok }
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

function generateSecret(length: number): string {
  if (!Number.isFinite(length) || length < 32 || length > 128) fail('--length must be between 32 and 128')
  return randomBytes(Math.ceil(length * 0.75)).toString('base64url').slice(0, length)
}

function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function printHelp() {
  console.log(`Credential broker

Commands:
  list-due      --env <dev|staging|prod> [--as-of YYYY-MM-DD] [--json]
  report        --env <dev|staging|prod> [--as-of YYYY-MM-DD] [--check-sinks] [--json]
  baseline-template --env <dev|staging|prod> [--updated-at YYYY-MM-DD] [--json]
  bootstrap-infisical --env <dev|staging|prod> [--source .env.local] [--secret id-or-envVar[,..]] [--apply]
  inject        --env <dev|staging|prod> [--secret id-or-envVar[,..]] -- <command>
  rotate        --env <dev|staging|prod> --secret <id-or-envVar> [--local-env .env.staging] [--length 48]
  sync-runtime  --env <dev|staging|prod> --secret <id-or-envVar> [--local-env .env.staging]
  smoke         --env <dev|staging|prod>
  smoke         --env <dev|staging|prod> --require-provider-access

The broker never prints secret values. Rotation packets are written to .credential-rotation-audits/.`)
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

main()
