#!/usr/bin/env node
/*
 * Commons Economy Map transport generator.
 *
 * Produces the one commit-bound envelope the Insights skin is allowed to read,
 * exclusively from the canonical Commons producer: `serializeEconomy()` in
 * `src/commons/economy-model.ts`, read from the exact pinned commit's git
 * object (never the producer's working tree, never retyped). The output is a
 * generated TypeScript module carrying provenance, a generated-file warning,
 * the Commons route table read from the same commit, and the envelope that
 * `adaptEconomyEnvelope` validates.
 *
 *   node scripts/commons-economy/generate-envelope.mjs --commons <rotla-immersive checkout>          write
 *   node scripts/commons-economy/generate-envelope.mjs --commons <rotla-immersive checkout> --check  fail on drift
 *
 * Read-only towards Commons: it runs `git rev-parse`, `git config --get` and
 * `git show` only. No network, provider, credential or listener is used.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const pin = JSON.parse(readFileSync(join(root, 'components/insights/commons-economy/transport-pin.json'), 'utf8'))

const args = process.argv.slice(2)
const flag = name => { const i = args.indexOf(name); return i === -1 ? null : (args[i + 1] ?? null) }
const commons = flag('--commons') ?? process.env.COMMONS_REPO
const check = args.includes('--check')
const out = resolve(root, flag('--out') ?? pin.generatedFile)

function die(message) { console.error(`commons-economy transport: ${message}`); process.exit(1) }
if (!commons) die('pass --commons <path to the rotla-immersive checkout> (or COMMONS_REPO)')
const git = (...rest) => execFileSync('git', ['-C', resolve(commons), ...rest], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

/* 1. The producer is the exact pinned repository and commit. */
let resolved
try { resolved = git('rev-parse', '--verify', `${pin.producerCommit}^{commit}`).trim() } catch { die(`producer commit ${pin.producerCommit} is not present in ${commons}`) }
if (resolved !== pin.producerCommit) die(`producer commit resolved to ${resolved}, expected ${pin.producerCommit}`)
let remote = ''
try { remote = git('config', '--get', 'remote.origin.url').trim() } catch { /* checked below */ }
const normalized = remote.replace(/^git@github\.com:/, 'github.com/').replace(/^https?:\/\//, '').replace(/\.git$/, '')
if (normalized !== pin.producerRepository) die(`producer repository is ${normalized || 'unknown'}, expected ${pin.producerRepository}`)

const source = git('show', `${pin.producerCommit}:${pin.producerModule}`)
if (/^\s*import\s/m.test(source) || /\brequire\(/.test(source)) die(`${pin.producerModule} must import nothing to be carried across repositories`)
const routeSource = git('show', `${pin.producerCommit}:${pin.routeSource}`)

/* 2. Run the producer's own serializer on the exact module text. */
const require = createRequire(join(root, 'package.json'))
const ts = require('typescript')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const scratch = mkdtempSync(join(tmpdir(), 'commons-economy-transport-'))
let modelVersion, payload
try {
  const file = join(scratch, 'economy-model.mjs')
  writeFileSync(file, js)
  const producer = await import(pathToFileURL(file).href)
  if (typeof producer[pin.producerExport] !== 'function') die(`${pin.producerModule} has no ${pin.producerExport}()`)
  modelVersion = producer.ECONOMY_MODEL_VERSION
  payload = producer[pin.producerExport]()
  if (payload !== producer[pin.producerExport]()) die('producer serialization is not deterministic')
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
if (!Number.isInteger(modelVersion)) die('producer has no integer ECONOMY_MODEL_VERSION')
if (typeof payload !== 'string' || !payload.endsWith('\n')) die('producer did not return a serialized payload')
const payloadSha256 = createHash('sha256').update(payload, 'utf8').digest('hex')

/* 3. The Commons routes that exist at the same commit, read from the producer's own route table. */
const routes = [...new Set([...routeSource.matchAll(/route === '(\/[a-z0-9/-]+)'/g)].map(match => `/commons${match[1]}`))].sort()
if (routes.length === 0) die(`no routes found in ${pin.routeSource}`)
const joinPaths = [...new Set(JSON.parse(payload).joins.map(item => item.href.split(/[?#]/)[0]))].sort()
const unverifiedJoinPaths = joinPaths.filter(path => !routes.includes(path))

/* 4. Emit the generated module. Field order is fixed; nothing depends on time or machine. */
const warning = `GENERATED FILE. DO NOT EDIT. Produced by ${pin.generator} from ${pin.producerRepository}@${pin.producerCommit} (${pin.producerModule}, ${pin.producerExport}). Regenerate with: ${pin.generationCommand}`
const transport = {
  generatedFileWarning: warning,
  provenance: {
    producerRepository: pin.producerRepository,
    producerCommit: pin.producerCommit,
    producerModule: pin.producerModule,
    producerExport: pin.producerExport,
    schema: pin.envelopeSchema,
    schemaVersion: pin.envelopeSchemaVersion,
    modelVersion,
    payloadSha256,
    generator: pin.generator,
    generationCommand: pin.generationCommand,
  },
  commonsRoutes: { source: `${pin.producerRepository}@${pin.producerCommit}:${pin.routeSource}`, routes, unverifiedJoinPaths },
  envelope: { schema: pin.envelopeSchema, schemaVersion: pin.envelopeSchemaVersion, modelVersion, payloadSha256, payload },
}
const text = [
  '/*',
  ` * ${warning}`,
  ' *',
  ' * Commons is the sole authored source of every node, flow, caption, layer,',
  ' * responsibility, correction rule and walkthrough in this envelope. Any hand',
  ' * edit fails the generator --check, transport.ts provenance checks, and the',
  ' * adapter hash check.',
  ' */',
  '/* eslint-disable */',
  `export const commonsEconomyTransport = ${JSON.stringify(transport, null, 2)}`,
  '',
].join('\n')

if (check) {
  if (!existsSync(out)) die(`${pin.generatedFile} is missing; run: ${pin.generationCommand}`)
  if (readFileSync(out, 'utf8') !== text) die(`${pin.generatedFile} drifted from ${pin.producerRepository}@${pin.producerCommit}; run: ${pin.generationCommand}`)
  console.log(`commons-economy transport: up to date (payload ${payloadSha256}, ${routes.length} routes, ${unverifiedJoinPaths.length} unverified join paths)`)
} else {
  writeFileSync(out, text)
  console.log(`commons-economy transport: wrote ${pin.generatedFile} (payload ${payloadSha256}, model v${modelVersion})`)
}
