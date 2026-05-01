#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import * as path from 'node:path'

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
  lastRotatedAt?: Partial<Record<EnvironmentName, string>>
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

function main() {
  const args = parseArgs(process.argv.slice(2))
  const inventory = loadInventory()

  switch (args.command) {
    case 'list-due':
      listDue(inventory, args)
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
    const lastRotatedAt = secret.lastRotatedAt?.[env] ?? null
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
    console.log(`${row.status.padEnd(14)} ${row.envVar.padEnd(32)} ${row.rotationMode}${due}${approval}`)
  }
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
  const checks: Array<{ label: string; command: string[]; required: boolean }> = [
    { label: 'Inventory loads', command: ['node', '-e', `JSON.parse(require('fs').readFileSync(${JSON.stringify(INVENTORY_PATH)}, 'utf8'));`], required: true },
    { label: 'n8n export secret scan', command: ['bash', 'scripts/check-n8n-secrets.sh'], required: true },
    { label: 'Infisical CLI available', command: ['infisical', '--version'], required: false },
    { label: '1Password CLI available', command: ['op', '--version'], required: false },
  ]

  if (process.env.N8N_API_KEY) {
    checks.push({ label: 'n8n workflow drift warning check', command: ['npm', 'run', 'n8n:drift-check', '--', '--warn'], required: false })
  }

  const results = checks.map((check) => runCheck(check))
  const dueCount = envSecrets(inventory, env).filter((secret) => !secret.lastRotatedAt?.[env]).length
  console.log(`Credential inventory secrets for ${env}: ${envSecrets(inventory, env).length}`)
  console.log(`Secrets missing rotation baseline for ${env}: ${dueCount}`)

  const failedRequired = results.filter((result) => result.required && !result.ok)
  if (failedRequired.length > 0) {
    process.exit(1)
  }
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
  if (secret.sourceOfTruth === 'infisical') {
    const infisicalEnv = inventory.providers.infisical.envMap[env]
    const secretPath = inventory.providers.infisical.secretPath
    const result = spawnSync('infisical', ['secrets', 'get', secret.envVar, '--env', infisicalEnv, '--path', secretPath, '--plain'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })
    if (result.status !== 0) {
      fail(`Infisical read failed for ${secret.envVar}. Authenticate the Infisical CLI and confirm ${infisicalEnv}${secretPath} access.`)
    }
    return result.stdout.trim()
  }

  const vault = inventory.providers.onepassword.vaults[env]
  const ref = `op://${vault}/${secret.envVar}/credential`
  const result = spawnSync('op', ['read', ref], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })
  if (result.status !== 0) {
    fail(`1Password read failed for ${secret.envVar}. Expected item ref ${ref}.`)
  }
  return result.stdout.trim()
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
  inject        --env <dev|staging|prod> [--secret id-or-envVar[,..]] -- <command>
  rotate        --env <dev|staging|prod> --secret <id-or-envVar> [--local-env .env.staging] [--length 48]
  sync-runtime  --env <dev|staging|prod> --secret <id-or-envVar> [--local-env .env.staging]
  smoke         --env <dev|staging|prod>

The broker never prints secret values. Rotation packets are written to .credential-rotation-audits/.`)
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

main()
