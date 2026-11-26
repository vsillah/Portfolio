import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import pin from './transport-pin.json'
import { commonsEconomyTransport } from './generated/commons-economy-envelope.generated'
import { ACCEPTED_PAYLOAD_SHA256, ENVELOPE_SCHEMA, ENVELOPE_SCHEMA_VERSION, SUPPORTED_MODEL_VERSION } from './adapter'
import { acceptedTransport, expectedWarning, provenEnvelope, resolveCommonsJoin, verifiedCommonsOrigin, type CommonsEconomyTransport } from './transport'

const root = join(__dirname, '../../..')
const generatedText = readFileSync(join(root, pin.generatedFile), 'utf8')
const copy = (): CommonsEconomyTransport => JSON.parse(JSON.stringify(commonsEconomyTransport))

describe('Commons economy generated transport', () => {
  it('is a generated, commit-bound module that warns against hand edits', () => {
    expect(generatedText.startsWith(`/*\n * ${expectedWarning}\n`)).toBe(true)
    expect(commonsEconomyTransport.generatedFileWarning).toBe(expectedWarning)
    expect(commonsEconomyTransport.provenance).toEqual({
      producerRepository: pin.producerRepository,
      producerCommit: pin.producerCommit,
      producerModule: pin.producerModule,
      producerExport: pin.producerExport,
      schema: ENVELOPE_SCHEMA,
      schemaVersion: ENVELOPE_SCHEMA_VERSION,
      modelVersion: SUPPORTED_MODEL_VERSION,
      payloadSha256: commonsEconomyTransport.envelope.payloadSha256,
      generator: pin.generator,
      generationCommand: pin.generationCommand,
    })
    expect(pin.envelopeSchema).toBe(ENVELOPE_SCHEMA)
    expect(pin.envelopeSchemaVersion).toBe(ENVELOPE_SCHEMA_VERSION)
    expect(pin.producerCommit).toMatch(/^[0-9a-f]{40}$/)
  })

  it('carries a payload whose digest is the recorded hash and the adapter-accepted hash', () => {
    const digest = createHash('sha256').update(commonsEconomyTransport.envelope.payload, 'utf8').digest('hex')
    expect(digest).toBe(commonsEconomyTransport.provenance.payloadSha256)
    expect(digest).toBe(ACCEPTED_PAYLOAD_SHA256)
  })

  it('admits the envelope only after the Phase 5 adapter accepts it', async () => {
    const { envelope, result } = await acceptedTransport()
    expect(result.ok).toBe(true)
    expect(envelope).toBe(commonsEconomyTransport.envelope)
    expect(Object.keys(envelope!).sort()).toEqual(['modelVersion', 'payload', 'payloadSha256', 'schema', 'schemaVersion'])
  })

  it('closes on provenance drift', async () => {
    const drifts: ((t: CommonsEconomyTransport) => void)[] = [
      t => { t.generatedFileWarning = 'hand edited' },
      t => { t.provenance.producerCommit = '0'.repeat(40) },
      t => { t.provenance.producerRepository = 'github.com/someone/else' },
      t => { t.provenance.producerModule = 'src/elsewhere.ts' },
      t => { t.provenance.generationCommand = 'typed by hand' },
      t => { t.provenance.payloadSha256 = 'f'.repeat(64) },
      t => { t.provenance.modelVersion = 2 },
      t => { t.commonsRoutes.source = 'unbound' },
    ]
    for (const drift of drifts) {
      const t = copy(); drift(t)
      expect(provenEnvelope(t)).toBeNull()
      expect((await acceptedTransport(t)).envelope).toBeNull()
    }
  })

  it('closes when the payload is edited, even with a matching recorded hash', async () => {
    const t = copy()
    t.envelope.payload = t.envelope.payload.replace('"version": 1', '"version": 1 ')
    expect((await acceptedTransport(t)).result).toMatchObject({ ok: false, code: 'hash' })
    const digest = createHash('sha256').update(t.envelope.payload, 'utf8').digest('hex')
    t.envelope.payloadSha256 = digest; t.provenance.payloadSha256 = digest
    expect((await acceptedTransport(t)).result).toMatchObject({ ok: false, code: 'stale' })
  })

  it('verifies every Commons destination against the producer route table and links none without a verified origin', () => {
    const { routes, unverifiedJoinPaths } = commonsEconomyTransport.commonsRoutes
    expect(unverifiedJoinPaths).toEqual([])
    expect(routes).toContain('/commons/economy')
    const joins = (JSON.parse(commonsEconomyTransport.envelope.payload) as { joins: { href: string }[] }).joins
    for (const item of joins) {
      expect(routes).toContain(item.href.split(/[?#]/)[0])
      expect(resolveCommonsJoin(item.href)).toBeNull()
    }
    expect(verifiedCommonsOrigin).toBeNull()
    expect(resolveCommonsJoin('/commons/economy', 'https://commons.example')).toBe('https://commons.example/commons/economy')
    expect(resolveCommonsJoin('/commons/not-a-route', 'https://commons.example')).toBeNull()
  })

  it('keeps the payload in the generated module only', () => {
    const payload = commonsEconomyTransport.envelope.payload
    const probe = payload.slice(Math.floor(payload.length / 2), Math.floor(payload.length / 2) + 160)
    const escaped = JSON.stringify(probe).slice(1, -1)
    const holders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name.startsWith('.')) continue
        const path = join(dir, name)
        if (statSync(path).isDirectory()) { walk(path); continue }
        if (!/\.(ts|tsx|js|mjs|cjs|json|md|html)$/.test(name)) continue
        const text = readFileSync(path, 'utf8')
        if (text.includes(probe) || text.includes(escaped)) holders.push(relative(root, path))
      }
    }
    for (const dir of ['app', 'components', 'lib', 'data', 'docs/insights', 'public/insights', 'scripts']) walk(join(root, dir))
    expect(holders).toEqual([pin.generatedFile])
  })
})
