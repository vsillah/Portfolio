import { describe, expect, it } from 'vitest'
import { adaptEconomyEnvelope, serializeCanonical } from './adapter'
import { envelopeFor, sha256, syntheticModel } from './synthetic-envelope.test-fixture'

type Model = ReturnType<typeof syntheticModel>
const accept = (envelope: { payloadSha256: string }) => ({ acceptedPayloadSha256: envelope.payloadSha256 })
async function rejects(mutate: (model: Model) => void) {
  const model = syntheticModel()
  mutate(model)
  const envelope = envelopeFor(model)
  return adaptEconomyEnvelope(envelope, accept(envelope))
}

describe('Commons economy adapter', () => {
  it('accepts a well-formed synthetic envelope and returns the parsed model unchanged', async () => {
    const envelope = envelopeFor(syntheticModel())
    const result = await adaptEconomyEnvelope(JSON.stringify(envelope), accept(envelope))
    expect(result.ok).toBe(true)
    if (result.ok) expect(serializeCanonical(result.model)).toBe(envelope.payload)
  })

  it('rejects a missing envelope, unknown envelope keys and the wrong schema', async () => {
    expect(await adaptEconomyEnvelope(null)).toMatchObject({ ok: false, code: 'envelope' })
    expect(await adaptEconomyEnvelope('{not json')).toMatchObject({ ok: false, code: 'envelope' })
    expect(await adaptEconomyEnvelope(envelopeFor(syntheticModel(), { extra: true }))).toMatchObject({ ok: false, code: 'envelope' })
    expect(await adaptEconomyEnvelope(envelopeFor(syntheticModel(), { schema: 'other' }))).toMatchObject({ ok: false, code: 'envelope' })
  })

  it('rejects the wrong envelope schema version and the wrong model version', async () => {
    expect(await adaptEconomyEnvelope(envelopeFor(syntheticModel(), { schemaVersion: 2 }))).toMatchObject({ ok: false, code: 'schema-version' })
    expect(await adaptEconomyEnvelope(envelopeFor(syntheticModel(), { modelVersion: 2 }))).toMatchObject({ ok: false, code: 'model-version' })
    expect(await rejects(model => { (model as { version: number }).version = 2 })).toMatchObject({ ok: false, code: 'model-version' })
  })

  it('rejects a hash mismatch, a malformed hash and a stale but self-consistent payload', async () => {
    const envelope = envelopeFor(syntheticModel())
    expect(await adaptEconomyEnvelope({ ...envelope, payloadSha256: sha256('other') }, accept(envelope))).toMatchObject({ ok: false, code: 'hash' })
    expect(await adaptEconomyEnvelope({ ...envelope, payloadSha256: 'abc' }, accept(envelope))).toMatchObject({ ok: false, code: 'hash' })
    expect(await adaptEconomyEnvelope({ ...envelope, payload: envelope.payload.replace('Synthetic work A', 'Synthetic work Z') }, accept(envelope))).toMatchObject({ ok: false, code: 'hash' })
    expect(await adaptEconomyEnvelope(envelope)).toMatchObject({ ok: false, code: 'stale' })
  })

  it('rejects a payload that is not in canonical serialized form', async () => {
    const payload = JSON.stringify(syntheticModel())
    const envelope = envelopeFor(payload)
    expect(await adaptEconomyEnvelope(envelope, accept(envelope))).toMatchObject({ ok: false, code: 'non-canonical' })
  })

  it('rejects schema faults: missing keys, unknown keys, empty text and wrong types', async () => {
    expect(await rejects(model => { delete (model as Partial<Model>).walkthroughs })).toMatchObject({ ok: false, code: 'schema' })
    expect(await rejects(model => { (model.nodes[0] as Record<string, unknown>).price = 'none' })).toMatchObject({ ok: false, code: 'schema' })
    expect(await rejects(model => { model.nodes[1].tap.works = ' ' })).toMatchObject({ ok: false, code: 'schema' })
    expect(await rejects(model => { (model.layers[0] as Record<string, unknown>).defaultOn = 'yes' })).toMatchObject({ ok: false, code: 'schema' })
  })

  it('rejects missing boundaries anywhere they are required', async () => {
    expect(await rejects(model => { model.nodes[1].boundaries = [] })).toMatchObject({ ok: false, code: 'boundary' })
    expect(await rejects(model => { model.edges[0].boundaries = [] })).toMatchObject({ ok: false, code: 'boundary' })
    expect(await rejects(model => { model.walks[0].steps[0].boundaries = [] })).toMatchObject({ ok: false, code: 'boundary' })
    expect(await rejects(model => { delete (model.boundaryStamp as Partial<Model['boundaryStamp']>).tbd })).toMatchObject({ ok: false, code: 'boundary' })
    expect(await rejects(model => { model.stamps = ['Synthetic page stamp'] })).toMatchObject({ ok: false, code: 'boundary' })
    expect(await rejects(model => { model.walkthroughs[0].steps[0].responsibilities[0].stamp = 'Adopted' })).toMatchObject({ ok: false, code: 'boundary' })
  })

  it('rejects extra enum values in every closed vocabulary it checks', async () => {
    const cases: ((model: Model) => void)[] = [
      model => { model.nodes[1].boundaries.push('adopted') },
      model => { model.edges[0].flow = 'wages' },
      model => { model.nodes[1].kind = 'market' },
      model => { model.nodes[1].tap.decides.authority = 'adopted' },
      model => { model.nodes[1].captions[0].detail = 'street' },
      model => { model.edges[1].carries = ['cash'] },
      model => { model.joins[0].purpose = 'buy' },
      model => { model.layers.push({ id: 'market', kind: 'model', label: model.layers[0].label, defaultOn: false, line: 'x' }) },
      model => { (model.boundaryStamp as Record<string, string>).adopted = 'Adopted' },
      model => { model.walks[0].steps[0].initiates.holder = 'investor' },
    ]
    for (const mutate of cases) expect(await rejects(mutate)).toMatchObject({ ok: false, code: 'enum' })
  })

  it('rejects broken references and derived lines that disagree with their source', async () => {
    expect(await rejects(model => { model.edges[0].to = 'n-missing' })).toMatchObject({ ok: false, code: 'reference' })
    expect(await rejects(model => { model.nodes[1].tap.claims[0].join = 'j-missing' })).toMatchObject({ ok: false, code: 'reference' })
    expect(await rejects(model => { model.walkthroughs[0].steps[0].responsibilities[1].who = 'Synthetic rewritten' })).toMatchObject({ ok: false, code: 'derivation' })
    expect(await rejects(model => { model.walkthroughs[0].steps[0].unresolved = false })).toMatchObject({ ok: false, code: 'derivation' })
    expect(await rejects(model => { Object.assign(model.walkthroughs[0].steps[1].correction, { who: 'Synthetic someone else' }) })).toMatchObject({ ok: false, code: 'derivation' })
    expect(await rejects(model => { model.historicalLines = [] })).toMatchObject({ ok: false, code: 'derivation' })
  })

  it('rejects an unlocked fictional or governance boundary', async () => {
    expect(await rejects(model => { (model.locked as Record<string, unknown>).everythingFictional = false })).toMatchObject({ ok: false, code: 'schema' })
    expect(await rejects(model => { (model.locked as Record<string, unknown>).governancePhase2 = 'active' })).toMatchObject({ ok: false, code: 'schema' })
  })
})
