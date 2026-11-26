/*
 * Commons Economy Map: the fail-closed consumer contract for the Insights skin.
 *
 * The canonical model is produced by `src/commons/economy-model.ts`
 * (`serializeEconomy`) in the Roxbury Commons repository. This file holds no
 * node, flow, caption, layer, responsibility, correction rule, source,
 * boundary stamp or walkthrough. It only checks that one serialized envelope is
 * exactly the accepted canonical payload and has the expected shape, then
 * hands the parsed model to the skin. Any doubt returns a rejection and the
 * skin renders nothing from the envelope.
 *
 * Transport is deliberately absent: how an envelope reaches this function is
 * a Phase 6 decision. There is no fallback model and no bundled copy.
 */

export const ENVELOPE_SCHEMA = 'commons.economy-map.envelope'
export const ENVELOPE_SCHEMA_VERSION = 1
export const SUPPORTED_MODEL_VERSION = 1
/* The canonical payload accepted for Phase 5 review (producer checkpoint 2c0ce0c). A newer payload is stale until re-accepted. */
export const ACCEPTED_PAYLOAD_SHA256 = 'eceba4f6279e62c79d888b043e30fe1bd62b08def56e1412c6a0abf0f1190cff'

/* ---------- Closed vocabularies (schema, not content: every printed word comes from the payload) ---------- */

export const BOUNDARIES = ['fictional', 'proposed', 'future', 'historical', 'tbd'] as const
export const LABEL_MODES = ['book', 'commons'] as const
export const ALTITUDES = ['block', 'building', 'household'] as const
export const HOLDERS = ['resident', 'household', 'worker', 'producer', 'steward', 'chapter', 'future-body'] as const
export const AUTHORITIES = ['proposed', 'tbd'] as const
export const MODEL_LAYERS = ['proposed', 'roxbury', 'tried', 'future'] as const
export const FLOWS = ['goods', 'funding', 'decisions'] as const
export const NODE_KINDS = ['group', 'enterprise', 'fund', 'stewardship', 'norms', 'baseline', 'services', 'land', 'voice', 'centre', 'credits', 'historical'] as const
export const SHARED_ASSETS = ['kitchen-space', 'tools', 'bikes'] as const
export const JOIN_PURPOSES = ['claim', 'learn', 'read'] as const
export const SOURCE_KINDS = ['book', 'repository'] as const
export const SOURCE_CHECKS = ['pending', 'verified', 'in-repository'] as const
export const HISTORICAL_RECORDS = ['practice', 'proposal'] as const
export const EDGE_ROLES = ['main', 'support'] as const
export const WALKS = ['meal', 'dollar', 'vote'] as const
export const RESPONSIBILITY_KEYS = ['initiates', 'authorizes', 'performs', 'records', 'reviews'] as const

export type Boundary = (typeof BOUNDARIES)[number]
export type LabelMode = (typeof LABEL_MODES)[number]
export type AltitudeId = (typeof ALTITUDES)[number]
export type HolderId = (typeof HOLDERS)[number]
export type Authority = (typeof AUTHORITIES)[number]
export type ModelLayerId = (typeof MODEL_LAYERS)[number]
export type FlowId = (typeof FLOWS)[number]
export type LayerId = ModelLayerId | FlowId
export type WalkId = (typeof WALKS)[number]
export type ResponsibilityKey = (typeof RESPONSIBILITY_KEYS)[number]

export type LabelPair = { book: string; commons: string }
export type Duty = { holder: HolderId; who: string; authority: Authority }
export type JoinRef = { id: string; href: string; label: string; purpose: (typeof JOIN_PURPOSES)[number] }
export type Source = { id: string; title: string; kind: (typeof SOURCE_KINDS)[number]; use: string; check: (typeof SOURCE_CHECKS)[number]; path?: string }
export type Layer = { id: LayerId; kind: 'model' | 'flow'; label: LabelPair; defaultOn: boolean; line: string }
export type Caption = { id: string; detail: AltitudeId; text: string }
export type Claim = { id: string; label: string; holder: HolderId; join: string }
export type EconomyNode = {
  id: string; kind: (typeof NODE_KINDS)[number]; label: LabelPair; layers: ModelLayerId[]; boundaries: Boundary[]
  parent?: string; muted?: true; interactive?: false
  tap: { works: string; decides: { text: string; authority: Authority }; claims: Claim[] }
  captions: Caption[]; joins: string[]; sources: string[]
  historical?: { record: (typeof HISTORICAL_RECORDS)[number]; source: string; limitation?: string }
}
export type Edge = { id: string; flow: FlowId; from: string; to: string; role: (typeof EDGE_ROLES)[number]; label: LabelPair; layers: ModelLayerId[]; boundaries: Boundary[]; carries?: (typeof SHARED_ASSETS)[number][] }
export type EdgeRef = { edge: string; label: LabelPair; from: string; to: string }
export type ResponsibilityLine = { key: ResponsibilityKey; label: string; holder: HolderId; holderLabel: string; who: string; authority: Authority; stamp: string }
export type CorrectionLine =
  | { key: 'corrects'; label: string; decided: true; holder: HolderId; holderLabel: string; who: string; authority: Authority; stamp: string; derivedFrom: 'reviews' }
  | { key: 'corrects'; label: string; decided: false; text: string; stamp: string }
export type WalkthroughStep = {
  id: string; n: number; of: number; title: string; caption: string; at: string; place: LabelPair; via?: EdgeRef; supports: EdgeRef[]
  altitude: AltitudeId; altitudeLabel: string; responsibilities: ResponsibilityLine[]; correction: CorrectionLine; stamps: string[]; joins: JoinRef[]; unresolved: boolean
}
export type Walkthrough = { id: WalkId; flow: FlowId; ink: string; label: string; line: string; steps: WalkthroughStep[] }
export type HistoricalLine = { node: string; record: (typeof HISTORICAL_RECORDS)[number]; check: 'pending' | 'verified'; stamp: string; text: string }
export type View = { layers: Record<LayerId, boolean>; hero: string; altitude: AltitudeId; labels: LabelMode; walk: WalkId | null; step: number }

export type EconomyModel = {
  version: number
  boundaryStamp: Record<Boundary, string>
  labelModes: { id: LabelMode; label: string }[]
  altitudes: { id: AltitudeId; label: string; rank: number; audience: string }[]
  altitudeRule: string
  holders: { id: HolderId; label: string; line: string }[]
  joins: JoinRef[]
  sources: Source[]
  layers: Layer[]
  flows: { id: FlowId; ink: string; label: LabelPair }[]
  sharedAssets: { id: (typeof SHARED_ASSETS)[number]; label: string }[]
  nodes: EconomyNode[]
  edges: Edge[]
  walks: unknown[]
  locked: { roxburyFromStart: true; hero: string; fundingCarries: 'shared-assets-only'; spendableCredits: 'future'; everythingFictional: true; governancePhase2: 'paused' }
  stamps: string[]
  defaultView: View
  historicalLines: HistoricalLine[]
  walkthroughs: Walkthrough[]
}

export type RejectionCode = 'envelope' | 'schema-version' | 'model-version' | 'hash' | 'stale' | 'non-canonical' | 'schema' | 'boundary' | 'enum' | 'reference' | 'derivation'
export type AdapterResult = { ok: true; model: EconomyModel; payloadSha256: string } | { ok: false; code: RejectionCode; detail: string }
export type AdapterOptions = { acceptedPayloadSha256?: string }

/* ---------- Canonical serialization, matching the producer's `serializeEconomy` ---------- */

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().filter(key => record[key] !== undefined).map(key => [key, canonical(record[key])]))
  }
  return value
}
export const serializeCanonical = (data: unknown) => `${JSON.stringify(canonical(data), null, 2)}\n`

export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

/* ---------- Strict shape checks ---------- */

class Rejection extends Error {
  constructor(readonly code: RejectionCode, detail: string) { super(detail) }
}
const fail = (code: RejectionCode, detail: string): never => { throw new Rejection(code, detail) }

type Spec = { required: string[]; optional?: string[] }
function shape(value: unknown, at: string, spec: Spec): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('schema', `${at} is not an object`)
  const record = value as Record<string, unknown>
  const allowed = new Set([...spec.required, ...(spec.optional ?? [])])
  for (const key of spec.required) if (!(key in record)) fail('schema', `${at}.${key} is missing`)
  for (const key of Object.keys(record)) if (!allowed.has(key)) fail('schema', `${at}.${key} is not part of the schema`)
  return record
}
function list(value: unknown, at: string, { nonEmpty = false } = {}): unknown[] {
  if (!Array.isArray(value)) fail('schema', `${at} is not a list`)
  const items = value as unknown[]
  if (nonEmpty && items.length === 0) fail('schema', `${at} is empty`)
  return items
}
function text(value: unknown, at: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail('schema', `${at} is not printable text`)
  return value as string
}
function oneOf<T extends string>(value: unknown, allowed: readonly T[], at: string): T {
  if (typeof value !== 'string') fail('schema', `${at} is not a string`)
  if (!allowed.includes(value as T)) fail('enum', `${at} has unknown value "${String(value)}"`)
  return value as T
}
function literal(value: unknown, expected: unknown, at: string) {
  if (value !== expected) fail('schema', `${at} must be ${JSON.stringify(expected)}`)
}
const pair = (value: unknown, at: string) => { const record = shape(value, at, { required: ['book', 'commons'] }); text(record.book, `${at}.book`); text(record.commons, `${at}.commons`) }
const boundaries = (value: unknown, at: string) => {
  const items = list(value, at)
  if (items.length === 0) fail('boundary', `${at} carries no boundary`)
  items.forEach((item, index) => oneOf(item, BOUNDARIES, `${at}[${index}]`))
}
const unique = (ids: string[], at: string) => { if (new Set(ids).size !== ids.length) fail('schema', `${at} has duplicate ids`) }
const exactSet = (ids: string[], expected: readonly string[], at: string) => {
  if (ids.length !== expected.length || expected.some(id => !ids.includes(id))) fail('enum', `${at} must list exactly ${expected.join(', ')}`)
}
const duty = (value: unknown, at: string) => {
  const record = shape(value, at, { required: ['holder', 'who', 'authority'] })
  oneOf(record.holder, HOLDERS, `${at}.holder`); text(record.who, `${at}.who`); oneOf(record.authority, AUTHORITIES, `${at}.authority`)
}
const joinRef = (value: unknown, at: string) => {
  const record = shape(value, at, { required: ['id', 'href', 'label', 'purpose'] })
  text(record.id, `${at}.id`); text(record.label, `${at}.label`); oneOf(record.purpose, JOIN_PURPOSES, `${at}.purpose`)
  if (typeof record.href !== 'string' || !/^\/commons(\/|$|\?|#)/.test(record.href)) fail('schema', `${at}.href is not a Commons path`)
}
const edgeRef = (value: unknown, at: string) => {
  const record = shape(value, at, { required: ['edge', 'label', 'from', 'to'] })
  text(record.edge, `${at}.edge`); pair(record.label, `${at}.label`); text(record.from, `${at}.from`); text(record.to, `${at}.to`)
}

function checkModel(data: unknown): EconomyModel {
  const top = shape(data, 'payload', { required: ['altitudeRule', 'altitudes', 'boundaryStamp', 'defaultView', 'edges', 'flows', 'historicalLines', 'holders', 'joins', 'labelModes', 'layers', 'locked', 'nodes', 'sharedAssets', 'sources', 'stamps', 'version', 'walks', 'walkthroughs'] })
  if (top.version !== SUPPORTED_MODEL_VERSION) fail('model-version', `payload.version ${String(top.version)} is not supported`)

  if (!top.boundaryStamp || typeof top.boundaryStamp !== 'object' || Array.isArray(top.boundaryStamp)) fail('schema', 'payload.boundaryStamp is not an object')
  const stampRecord = top.boundaryStamp as Record<string, unknown>
  for (const key of Object.keys(stampRecord)) oneOf(key, BOUNDARIES, `payload.boundaryStamp key`)
  for (const key of BOUNDARIES) if (!(key in stampRecord)) fail('boundary', `payload.boundaryStamp.${key} is missing`)
  for (const key of BOUNDARIES) text(stampRecord[key], `payload.boundaryStamp.${key}`)

  list(top.labelModes, 'payload.labelModes').forEach((item, i) => { const r = shape(item, `labelModes[${i}]`, { required: ['id', 'label'] }); oneOf(r.id, LABEL_MODES, `labelModes[${i}].id`); text(r.label, `labelModes[${i}].label`) })
  exactSet((top.labelModes as { id: string }[]).map(item => item.id), LABEL_MODES, 'payload.labelModes')

  list(top.altitudes, 'payload.altitudes').forEach((item, i) => {
    const r = shape(item, `altitudes[${i}]`, { required: ['id', 'label', 'rank', 'audience'] })
    oneOf(r.id, ALTITUDES, `altitudes[${i}].id`); text(r.label, `altitudes[${i}].label`); text(r.audience, `altitudes[${i}].audience`)
    if (r.rank !== i) fail('schema', `altitudes[${i}].rank must be ${i}`)
  })
  exactSet((top.altitudes as { id: string }[]).map(item => item.id), ALTITUDES, 'payload.altitudes')
  text(top.altitudeRule, 'payload.altitudeRule')

  list(top.holders, 'payload.holders').forEach((item, i) => { const r = shape(item, `holders[${i}]`, { required: ['id', 'label', 'line'] }); oneOf(r.id, HOLDERS, `holders[${i}].id`); text(r.label, `holders[${i}].label`); text(r.line, `holders[${i}].line`) })
  exactSet((top.holders as { id: string }[]).map(item => item.id), HOLDERS, 'payload.holders')

  list(top.joins, 'payload.joins').forEach((item, i) => joinRef(item, `joins[${i}]`))
  const joinIds = (top.joins as JoinRef[]).map(item => item.id); unique(joinIds, 'payload.joins')

  list(top.sources, 'payload.sources', { nonEmpty: true }).forEach((item, i) => {
    const r = shape(item, `sources[${i}]`, { required: ['id', 'title', 'kind', 'use', 'check'], optional: ['path'] })
    text(r.id, `sources[${i}].id`); text(r.title, `sources[${i}].title`); oneOf(r.kind, SOURCE_KINDS, `sources[${i}].kind`); text(r.use, `sources[${i}].use`); oneOf(r.check, SOURCE_CHECKS, `sources[${i}].check`)
    if ('path' in r) text(r.path, `sources[${i}].path`)
  })
  const sourceIds = (top.sources as Source[]).map(item => item.id); unique(sourceIds, 'payload.sources')

  list(top.layers, 'payload.layers').forEach((item, i) => {
    const r = shape(item, `layers[${i}]`, { required: ['id', 'kind', 'label', 'defaultOn', 'line'] })
    const kind = oneOf(r.kind, ['model', 'flow'] as const, `layers[${i}].kind`)
    oneOf(r.id, kind === 'model' ? MODEL_LAYERS : FLOWS, `layers[${i}].id`)
    pair(r.label, `layers[${i}].label`); text(r.line, `layers[${i}].line`)
    if (typeof r.defaultOn !== 'boolean') fail('schema', `layers[${i}].defaultOn is not a boolean`)
  })
  exactSet((top.layers as Layer[]).map(item => item.id), [...MODEL_LAYERS, ...FLOWS], 'payload.layers')

  list(top.flows, 'payload.flows').forEach((item, i) => { const r = shape(item, `flows[${i}]`, { required: ['id', 'ink', 'label'] }); oneOf(r.id, FLOWS, `flows[${i}].id`); text(r.ink, `flows[${i}].ink`); pair(r.label, `flows[${i}].label`) })
  exactSet((top.flows as { id: string }[]).map(item => item.id), FLOWS, 'payload.flows')

  list(top.sharedAssets, 'payload.sharedAssets').forEach((item, i) => { const r = shape(item, `sharedAssets[${i}]`, { required: ['id', 'label'] }); oneOf(r.id, SHARED_ASSETS, `sharedAssets[${i}].id`); text(r.label, `sharedAssets[${i}].label`) })

  list(top.nodes, 'payload.nodes', { nonEmpty: true }).forEach((item, i) => {
    const at = `nodes[${i}]`
    const r = shape(item, at, { required: ['id', 'kind', 'label', 'layers', 'boundaries', 'tap', 'captions', 'joins', 'sources'], optional: ['parent', 'muted', 'interactive', 'historical'] })
    text(r.id, `${at}.id`); oneOf(r.kind, NODE_KINDS, `${at}.kind`); pair(r.label, `${at}.label`)
    list(r.layers, `${at}.layers`, { nonEmpty: true }).forEach((id, j) => oneOf(id, MODEL_LAYERS, `${at}.layers[${j}]`))
    boundaries(r.boundaries, `${at}.boundaries`)
    if ('parent' in r) text(r.parent, `${at}.parent`)
    if ('muted' in r) literal(r.muted, true, `${at}.muted`)
    if ('interactive' in r) literal(r.interactive, false, `${at}.interactive`)
    const tap = shape(r.tap, `${at}.tap`, { required: ['works', 'decides', 'claims'] })
    text(tap.works, `${at}.tap.works`)
    const decides = shape(tap.decides, `${at}.tap.decides`, { required: ['text', 'authority'] })
    text(decides.text, `${at}.tap.decides.text`); oneOf(decides.authority, AUTHORITIES, `${at}.tap.decides.authority`)
    list(tap.claims, `${at}.tap.claims`).forEach((claim, j) => {
      const c = shape(claim, `${at}.tap.claims[${j}]`, { required: ['id', 'label', 'holder', 'join'] })
      text(c.id, `${at}.tap.claims[${j}].id`); text(c.label, `${at}.tap.claims[${j}].label`); oneOf(c.holder, HOLDERS, `${at}.tap.claims[${j}].holder`)
      if (!joinIds.includes(c.join as string)) fail('reference', `${at}.tap.claims[${j}].join is unknown`)
    })
    list(r.captions, `${at}.captions`).forEach((caption, j) => {
      const c = shape(caption, `${at}.captions[${j}]`, { required: ['id', 'detail', 'text'] })
      text(c.id, `${at}.captions[${j}].id`); oneOf(c.detail, ALTITUDES, `${at}.captions[${j}].detail`); text(c.text, `${at}.captions[${j}].text`)
    })
    list(r.joins, `${at}.joins`).forEach((id, j) => { if (!joinIds.includes(id as string)) fail('reference', `${at}.joins[${j}] is unknown`) })
    list(r.sources, `${at}.sources`, { nonEmpty: true }).forEach((id, j) => { if (!sourceIds.includes(id as string)) fail('reference', `${at}.sources[${j}] is unknown`) })
    if ('historical' in r) {
      const h = shape(r.historical, `${at}.historical`, { required: ['record', 'source'], optional: ['limitation'] })
      oneOf(h.record, HISTORICAL_RECORDS, `${at}.historical.record`)
      if (!sourceIds.includes(h.source as string)) fail('reference', `${at}.historical.source is unknown`)
      if ('limitation' in h) text(h.limitation, `${at}.historical.limitation`)
    }
  })
  const nodes = top.nodes as EconomyNode[]
  const nodeIds = nodes.map(item => item.id); unique(nodeIds, 'payload.nodes')
  for (const item of nodes) if (item.parent !== undefined && !nodeIds.includes(item.parent)) fail('reference', `node ${item.id} has an unknown parent`)

  list(top.edges, 'payload.edges').forEach((item, i) => {
    const at = `edges[${i}]`
    const r = shape(item, at, { required: ['id', 'flow', 'from', 'to', 'role', 'label', 'layers', 'boundaries'], optional: ['carries'] })
    text(r.id, `${at}.id`); oneOf(r.flow, FLOWS, `${at}.flow`); oneOf(r.role, EDGE_ROLES, `${at}.role`); pair(r.label, `${at}.label`)
    if (!nodeIds.includes(r.from as string) || !nodeIds.includes(r.to as string)) fail('reference', `${at} joins an unknown node`)
    list(r.layers, `${at}.layers`, { nonEmpty: true }).forEach((id, j) => oneOf(id, MODEL_LAYERS, `${at}.layers[${j}]`))
    boundaries(r.boundaries, `${at}.boundaries`)
    if ('carries' in r) list(r.carries, `${at}.carries`, { nonEmpty: true }).forEach((id, j) => oneOf(id, SHARED_ASSETS, `${at}.carries[${j}]`))
  })
  const edges = top.edges as Edge[]
  const edgeIds = edges.map(item => item.id); unique(edgeIds, 'payload.edges')

  list(top.walks, 'payload.walks', { nonEmpty: true }).forEach((item, i) => {
    const r = shape(item, `walks[${i}]`, { required: ['id', 'flow', 'label', 'line', 'steps'] })
    oneOf(r.id, WALKS, `walks[${i}].id`); oneOf(r.flow, FLOWS, `walks[${i}].flow`); text(r.label, `walks[${i}].label`); text(r.line, `walks[${i}].line`)
    list(r.steps, `walks[${i}].steps`, { nonEmpty: true }).forEach((step, j) => {
      const at = `walks[${i}].steps[${j}]`
      const s = shape(step, at, { required: ['id', 'at', 'title', 'caption', 'altitude', ...RESPONSIBILITY_KEYS, 'boundaries'], optional: ['via', 'supports'] })
      text(s.id, `${at}.id`); text(s.title, `${at}.title`); text(s.caption, `${at}.caption`); oneOf(s.altitude, ALTITUDES, `${at}.altitude`)
      if (!nodeIds.includes(s.at as string)) fail('reference', `${at}.at is unknown`)
      if ('via' in s && !edgeIds.includes(s.via as string)) fail('reference', `${at}.via is unknown`)
      if ('supports' in s) list(s.supports, `${at}.supports`).forEach((id, k) => { if (!edgeIds.includes(id as string)) fail('reference', `${at}.supports[${k}] is unknown`) })
      for (const key of RESPONSIBILITY_KEYS) duty(s[key], `${at}.${key}`)
      boundaries(s.boundaries, `${at}.boundaries`)
    })
  })

  list(top.walkthroughs, 'payload.walkthroughs', { nonEmpty: true }).forEach((item, i) => {
    const r = shape(item, `walkthroughs[${i}]`, { required: ['id', 'flow', 'ink', 'label', 'line', 'steps'] })
    oneOf(r.id, WALKS, `walkthroughs[${i}].id`); oneOf(r.flow, FLOWS, `walkthroughs[${i}].flow`); text(r.ink, `walkthroughs[${i}].ink`); text(r.label, `walkthroughs[${i}].label`); text(r.line, `walkthroughs[${i}].line`)
    list(r.steps, `walkthroughs[${i}].steps`, { nonEmpty: true }).forEach((step, j) => {
      const at = `walkthroughs[${i}].steps[${j}]`
      const s = shape(step, at, { required: ['id', 'n', 'of', 'title', 'caption', 'at', 'place', 'supports', 'altitude', 'altitudeLabel', 'responsibilities', 'correction', 'stamps', 'joins', 'unresolved'], optional: ['via'] })
      text(s.id, `${at}.id`); text(s.title, `${at}.title`); text(s.caption, `${at}.caption`); pair(s.place, `${at}.place`)
      oneOf(s.altitude, ALTITUDES, `${at}.altitude`); text(s.altitudeLabel, `${at}.altitudeLabel`)
      if (!nodeIds.includes(s.at as string)) fail('reference', `${at}.at is unknown`)
      if (!Number.isInteger(s.n) || !Number.isInteger(s.of)) fail('schema', `${at}.n/of must be integers`)
      if (typeof s.unresolved !== 'boolean') fail('schema', `${at}.unresolved is not a boolean`)
      if ('via' in s) edgeRef(s.via, `${at}.via`)
      list(s.supports, `${at}.supports`).forEach((ref, k) => edgeRef(ref, `${at}.supports[${k}]`))
      list(s.responsibilities, `${at}.responsibilities`).forEach((line, k) => {
        const l = shape(line, `${at}.responsibilities[${k}]`, { required: ['key', 'label', 'holder', 'holderLabel', 'who', 'authority', 'stamp'] })
        oneOf(l.key, RESPONSIBILITY_KEYS, `${at}.responsibilities[${k}].key`); text(l.label, `${at}.responsibilities[${k}].label`); oneOf(l.holder, HOLDERS, `${at}.responsibilities[${k}].holder`)
        text(l.holderLabel, `${at}.responsibilities[${k}].holderLabel`); text(l.who, `${at}.responsibilities[${k}].who`); oneOf(l.authority, AUTHORITIES, `${at}.responsibilities[${k}].authority`); text(l.stamp, `${at}.responsibilities[${k}].stamp`)
      })
      const corr = s.correction as Record<string, unknown>
      if (corr && typeof corr === 'object' && corr.decided === true) {
        const c = shape(corr, `${at}.correction`, { required: ['key', 'label', 'decided', 'holder', 'holderLabel', 'who', 'authority', 'stamp', 'derivedFrom'] })
        literal(c.key, 'corrects', `${at}.correction.key`); literal(c.derivedFrom, 'reviews', `${at}.correction.derivedFrom`); text(c.label, `${at}.correction.label`)
        oneOf(c.holder, HOLDERS, `${at}.correction.holder`); text(c.holderLabel, `${at}.correction.holderLabel`); text(c.who, `${at}.correction.who`); oneOf(c.authority, AUTHORITIES, `${at}.correction.authority`); text(c.stamp, `${at}.correction.stamp`)
      } else {
        const c = shape(corr, `${at}.correction`, { required: ['key', 'label', 'decided', 'text', 'stamp'] })
        literal(c.key, 'corrects', `${at}.correction.key`); literal(c.decided, false, `${at}.correction.decided`); text(c.label, `${at}.correction.label`); text(c.text, `${at}.correction.text`); text(c.stamp, `${at}.correction.stamp`)
      }
      if (list(s.stamps, `${at}.stamps`).length === 0) fail('boundary', `${at} carries no boundary stamp`)
      ;(s.stamps as unknown[]).forEach((line, k) => text(line, `${at}.stamps[${k}]`))
      list(s.joins, `${at}.joins`).forEach((ref, k) => joinRef(ref, `${at}.joins[${k}]`))
    })
  })

  list(top.historicalLines, 'payload.historicalLines').forEach((item, i) => {
    const r = shape(item, `historicalLines[${i}]`, { required: ['node', 'record', 'check', 'stamp', 'text'] })
    if (!nodeIds.includes(r.node as string)) fail('reference', `historicalLines[${i}].node is unknown`)
    oneOf(r.record, HISTORICAL_RECORDS, `historicalLines[${i}].record`); oneOf(r.check, ['pending', 'verified'] as const, `historicalLines[${i}].check`); text(r.stamp, `historicalLines[${i}].stamp`); text(r.text, `historicalLines[${i}].text`)
  })

  const locked = shape(top.locked, 'payload.locked', { required: ['roxburyFromStart', 'hero', 'fundingCarries', 'spendableCredits', 'everythingFictional', 'governancePhase2'] })
  literal(locked.everythingFictional, true, 'payload.locked.everythingFictional'); literal(locked.roxburyFromStart, true, 'payload.locked.roxburyFromStart')
  literal(locked.fundingCarries, 'shared-assets-only', 'payload.locked.fundingCarries'); literal(locked.spendableCredits, 'future', 'payload.locked.spendableCredits')
  literal(locked.governancePhase2, 'paused', 'payload.locked.governancePhase2')
  if (!nodeIds.includes(locked.hero as string)) fail('reference', 'payload.locked.hero is unknown')

  if (list(top.stamps, 'payload.stamps').length === 0) fail('boundary', 'payload.stamps is empty')
  ;(top.stamps as unknown[]).forEach((line, i) => text(line, `payload.stamps[${i}]`))

  const view = shape(top.defaultView, 'payload.defaultView', { required: ['layers', 'hero', 'altitude', 'labels', 'walk', 'step'] })
  const viewLayers = shape(view.layers, 'payload.defaultView.layers', { required: [...MODEL_LAYERS, ...FLOWS] })
  for (const key of [...MODEL_LAYERS, ...FLOWS]) if (typeof viewLayers[key] !== 'boolean') fail('schema', `payload.defaultView.layers.${key} is not a boolean`)
  if (!nodeIds.includes(view.hero as string)) fail('reference', 'payload.defaultView.hero is unknown')
  oneOf(view.altitude, ALTITUDES, 'payload.defaultView.altitude'); oneOf(view.labels, LABEL_MODES, 'payload.defaultView.labels')
  if (view.walk !== null) oneOf(view.walk, WALKS, 'payload.defaultView.walk')
  if (!Number.isInteger(view.step)) fail('schema', 'payload.defaultView.step is not an integer')

  const model = top as unknown as EconomyModel
  checkBoundaries(model)
  checkDerivations(model)
  return model
}

/* Every boundary the skin prints must be the model's own stamp, and every printed authority must be unresolved. */
function checkBoundaries(model: EconomyModel) {
  const stamps = new Set(Object.values(model.boundaryStamp))
  if (!model.stamps.includes(model.boundaryStamp.fictional)) fail('boundary', 'payload.stamps omits the fictional stamp')
  for (const walk of model.walkthroughs) for (const step of walk.steps) {
    for (const line of step.responsibilities) if (line.stamp !== model.boundaryStamp[line.authority]) fail('boundary', `step ${step.id} prints a stamp that is not its authority's`)
    for (const line of step.stamps) if (!stamps.has(line)) fail('boundary', `step ${step.id} prints an unknown stamp`)
  }
}

/* The derived walkthroughs and historical lines must agree with the base model they were derived from. */
function checkDerivations(model: EconomyModel) {
  const nodeById = new Map(model.nodes.map(item => [item.id, item]))
  const edgeById = new Map(model.edges.map(item => [item.id, item]))
  const walks = model.walks as { id: WalkId; flow: FlowId; label: string; line: string; steps: ({ id: string; at: string; via?: string; supports?: string[]; altitude: AltitudeId; boundaries: Boundary[] } & Record<ResponsibilityKey, Duty>)[] }[]
  if (walks.length !== model.walkthroughs.length) fail('derivation', 'walkthroughs do not match walks')
  walks.forEach((walk, i) => {
    const derived = model.walkthroughs[i]
    if (derived.id !== walk.id || derived.flow !== walk.flow || derived.label !== walk.label || derived.line !== walk.line) fail('derivation', `walkthrough ${derived.id} does not match its walk`)
    if (derived.ink !== model.flows.find(item => item.id === walk.flow)?.ink) fail('derivation', `walkthrough ${derived.id} ink does not match its flow`)
    if (derived.steps.length !== walk.steps.length) fail('derivation', `walkthrough ${derived.id} step count differs`)
    walk.steps.forEach((step, j) => {
      const d = derived.steps[j]
      const place = nodeById.get(step.at)!
      if (d.id !== step.id || d.at !== step.at || d.n !== j + 1 || d.of !== walk.steps.length || d.altitude !== step.altitude) fail('derivation', `step ${d.id} does not match its walk step`)
      if (d.place.book !== place.label.book || d.place.commons !== place.label.commons) fail('derivation', `step ${d.id} place label differs`)
      if ((d.via?.edge ?? null) !== (step.via ?? null)) fail('derivation', `step ${d.id} arrival differs`)
      if (d.via && edgeById.get(d.via.edge)?.label.commons !== d.via.label.commons) fail('derivation', `step ${d.id} arrival label differs`)
      if (d.supports.map(ref => ref.edge).join() !== (step.supports ?? []).join()) fail('derivation', `step ${d.id} supports differ`)
      if (d.responsibilities.map(line => line.key).join() !== RESPONSIBILITY_KEYS.join()) fail('derivation', `step ${d.id} responsibilities are out of order`)
      d.responsibilities.forEach(line => { const source = step[line.key]; if (line.who !== source.who || line.holder !== source.holder || line.authority !== source.authority) fail('derivation', `step ${d.id} ${line.key} differs`) })
      if (d.correction.decided && (d.correction.who !== step.reviews.who || d.correction.holder !== step.reviews.holder)) fail('derivation', `step ${d.id} correction is not derived from review`)
      if (d.stamps.join('|') !== step.boundaries.map(id => model.boundaryStamp[id]).join('|')) fail('derivation', `step ${d.id} stamps differ`)
      if (d.joins.map(ref => ref.id).join() !== place.joins.join()) fail('derivation', `step ${d.id} joins differ`)
      if (d.unresolved !== RESPONSIBILITY_KEYS.some(key => step[key].authority === 'tbd')) fail('derivation', `step ${d.id} unresolved flag differs`)
    })
  })
  const historical = model.nodes.filter(item => item.historical).map(item => item.id)
  if (model.historicalLines.map(item => item.node).join() !== historical.join()) fail('derivation', 'historical lines do not match historical nodes')
}

/* ---------- The one entry point ---------- */

export async function adaptEconomyEnvelope(input: unknown, options: AdapterOptions = {}): Promise<AdapterResult> {
  const accepted = options.acceptedPayloadSha256 ?? ACCEPTED_PAYLOAD_SHA256
  try {
    let envelope = input
    if (typeof envelope === 'string') {
      try { envelope = JSON.parse(envelope) } catch { fail('envelope', 'envelope is not JSON') }
    }
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) fail('envelope', 'no envelope was supplied')
    const record = envelope as Record<string, unknown>
    const allowed = ['schema', 'schemaVersion', 'modelVersion', 'payloadSha256', 'payload']
    for (const key of allowed) if (!(key in record)) fail('envelope', `envelope.${key} is missing`)
    for (const key of Object.keys(record)) if (!allowed.includes(key)) fail('envelope', `envelope.${key} is not part of the envelope`)
    if (record.schema !== ENVELOPE_SCHEMA) fail('envelope', 'envelope.schema is not the Commons economy envelope')
    if (record.schemaVersion !== ENVELOPE_SCHEMA_VERSION) fail('schema-version', `envelope.schemaVersion ${String(record.schemaVersion)} is not supported`)
    if (record.modelVersion !== SUPPORTED_MODEL_VERSION) fail('model-version', `envelope.modelVersion ${String(record.modelVersion)} is not supported`)
    if (typeof record.payloadSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(record.payloadSha256)) fail('hash', 'envelope.payloadSha256 is not a SHA-256 hex digest')
    if (typeof record.payload !== 'string') fail('envelope', 'envelope.payload is not the serialized model')

    const payload = record.payload as string
    const digest = await sha256Hex(payload)
    if (digest !== record.payloadSha256) fail('hash', 'payload does not match envelope.payloadSha256')
    if (digest !== accepted) fail('stale', 'payload is not the accepted canonical model')

    let data: unknown
    try { data = JSON.parse(payload) } catch { fail('schema', 'payload is not JSON') }
    if (serializeCanonical(data) !== payload) fail('non-canonical', 'payload is not in canonical serialized form')
    const model = checkModel(data)
    if (model.version !== record.modelVersion) fail('model-version', 'payload.version does not match envelope.modelVersion')
    return { ok: true, model, payloadSha256: digest }
  } catch (error) {
    if (error instanceof Rejection) return { ok: false, code: error.code, detail: error.message }
    return { ok: false, code: 'schema', detail: 'envelope could not be read' }
  }
}
