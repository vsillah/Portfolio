import { createHash } from 'node:crypto'
import { serializeCanonical } from './adapter'

/*
 * A schema-shaped synthetic model for validation tests. Every label is a
 * placeholder ("Synthetic …"); none reproduces a canonical Commons value.
 */

const stamp = { fictional: 'Synthetic stamp F', proposed: 'Synthetic stamp P', future: 'Synthetic stamp U', historical: 'Synthetic stamp H', tbd: 'Synthetic stamp T' }
const pair = (name: string) => ({ book: `Synthetic book ${name}`, commons: `Synthetic local ${name}` })
const duty = (holder: string, who: string, authority: 'proposed' | 'tbd') => ({ holder, who, authority })
const holderLabel: Record<string, string> = { resident: 'Synthetic holder R', worker: 'Synthetic holder W', steward: 'Synthetic holder S' }
const responsibilityLabel = { initiates: 'Synthetic duty 1', authorizes: 'Synthetic duty 2', performs: 'Synthetic duty 3', records: 'Synthetic duty 4', reviews: 'Synthetic duty 5' }

export const syntheticModel = () => structuredClone(buildModel())

function buildModel() {
  const joins = [{ id: 'j-one', href: '/commons/synthetic', label: 'Synthetic destination', purpose: 'claim' }]
  const nodes = [
    { id: 'n-group', kind: 'group', label: pair('group'), layers: ['proposed', 'roxbury'], boundaries: ['fictional', 'proposed'], tap: { works: 'Synthetic work G', decides: { text: 'Synthetic decision G', authority: 'tbd' }, claims: [] }, captions: [{ id: 'n-group-block', detail: 'block', text: 'Synthetic caption at block' }], joins: [], sources: ['s-one'] },
    { id: 'n-a', kind: 'enterprise', parent: 'n-group', label: pair('A'), layers: ['proposed', 'roxbury'], boundaries: ['fictional', 'proposed'], tap: { works: 'Synthetic work A', decides: { text: 'Synthetic decision A', authority: 'proposed' }, claims: [{ id: 'c-a', label: 'Synthetic claim A', holder: 'resident', join: 'j-one' }] }, captions: [{ id: 'n-a-block', detail: 'block', text: 'Synthetic caption A block' }, { id: 'n-a-household', detail: 'household', text: 'Synthetic caption A household' }], joins: ['j-one'], sources: ['s-one'] },
    { id: 'n-centre', kind: 'centre', label: pair('centre'), layers: ['proposed', 'roxbury'], boundaries: ['fictional'], tap: { works: 'Synthetic work C', decides: { text: 'Synthetic decision C', authority: 'tbd' }, claims: [] }, captions: [], joins: [], sources: ['s-one'] },
    { id: 'n-future', kind: 'credits', label: pair('future'), layers: ['future'], boundaries: ['future'], tap: { works: 'Synthetic work U', decides: { text: 'Synthetic decision U', authority: 'tbd' }, claims: [] }, captions: [], joins: [], sources: ['s-one'] },
    { id: 'n-old', kind: 'historical', label: pair('old'), layers: ['tried'], boundaries: ['historical'], interactive: false, muted: true, tap: { works: 'Synthetic work O', decides: { text: 'Synthetic decision O', authority: 'tbd' }, claims: [] }, captions: [], joins: [], sources: ['s-one'], historical: { record: 'practice', source: 's-one' } },
  ]
  const edges = [
    { id: 'goods.a-to-centre', flow: 'goods', from: 'n-a', to: 'n-centre', role: 'main', label: pair('goods edge'), layers: ['proposed', 'roxbury'], boundaries: ['fictional', 'proposed'] },
    { id: 'funding.group-to-a', flow: 'funding', from: 'n-group', to: 'n-a', role: 'main', label: pair('funding edge'), layers: ['proposed', 'roxbury'], boundaries: ['fictional', 'proposed'], carries: ['tools'] },
  ]
  const steps = [
    { id: 'w-1', at: 'n-a', title: 'Synthetic step one', caption: 'Synthetic step caption one', altitude: 'block', initiates: duty('worker', 'Synthetic who 1', 'proposed'), authorizes: duty('worker', 'Synthetic who 2', 'tbd'), performs: duty('worker', 'Synthetic who 3', 'proposed'), records: duty('steward', 'Synthetic who 4', 'proposed'), reviews: duty('steward', 'Synthetic who 5', 'proposed'), boundaries: ['fictional', 'proposed'] },
    { id: 'w-2', at: 'n-centre', via: 'goods.a-to-centre', title: 'Synthetic step two', caption: 'Synthetic step caption two', altitude: 'household', initiates: duty('resident', 'Synthetic who 6', 'proposed'), authorizes: duty('resident', 'Synthetic who 7', 'proposed'), performs: duty('resident', 'Synthetic who 8', 'proposed'), records: duty('steward', 'Synthetic who 9', 'proposed'), reviews: duty('steward', 'Synthetic reviewer who corrects', 'tbd'), boundaries: ['fictional'] },
  ]
  const walk = { id: 'meal', flow: 'goods', label: 'Synthetic walk', line: 'Synthetic walk line', steps }
  const nodeOf = (id: string) => nodes.find(item => item.id === id)!
  const walkthrough = {
    id: 'meal', flow: 'goods', ink: 'synthetic-ink-goods', label: walk.label, line: walk.line,
    steps: steps.map((step, index) => {
      const keys = ['initiates', 'authorizes', 'performs', 'records', 'reviews'] as const
      const via = 'via' in step && step.via ? edges.find(item => item.id === step.via)! : null
      return {
        id: step.id, n: index + 1, of: steps.length, title: step.title, caption: step.caption, at: step.at, place: nodeOf(step.at).label,
        ...(via ? { via: { edge: via.id, label: via.label, from: via.from, to: via.to } } : {}),
        supports: [], altitude: step.altitude, altitudeLabel: `Synthetic altitude ${step.altitude}`,
        responsibilities: keys.map(key => ({ key, label: responsibilityLabel[key], holder: step[key].holder, holderLabel: holderLabel[step[key].holder], who: step[key].who, authority: step[key].authority, stamp: stamp[step[key].authority] })),
        correction: /\bcorrect(s|ion)?\b/i.test(step.reviews.who)
          ? { key: 'corrects', label: 'Synthetic duty 6', decided: true, holder: step.reviews.holder, holderLabel: holderLabel[step.reviews.holder], who: step.reviews.who, authority: step.reviews.authority, stamp: stamp[step.reviews.authority], derivedFrom: 'reviews' }
          : { key: 'corrects', label: 'Synthetic duty 6', decided: false, text: 'Synthetic undecided correction', stamp: stamp.tbd },
        stamps: step.boundaries.map(id => stamp[id as keyof typeof stamp]),
        joins: nodeOf(step.at).joins.map(id => joins.find(item => item.id === id)!),
        unresolved: keys.some(key => step[key].authority === 'tbd'),
      }
    }),
  }
  return {
    version: 1,
    boundaryStamp: stamp,
    labelModes: [{ id: 'book', label: 'Synthetic mode book' }, { id: 'commons', label: 'Synthetic mode local' }],
    altitudes: [
      { id: 'block', label: 'Synthetic altitude block', rank: 0, audience: 'Synthetic audience 0' },
      { id: 'building', label: 'Synthetic altitude building', rank: 1, audience: 'Synthetic audience 1' },
      { id: 'household', label: 'Synthetic altitude household', rank: 2, audience: 'Synthetic audience 2' },
    ],
    altitudeRule: 'Synthetic altitude rule',
    holders: ['resident', 'household', 'worker', 'producer', 'steward', 'chapter', 'future-body'].map(id => ({ id, label: holderLabel[id] ?? `Synthetic holder ${id}`, line: `Synthetic holder line ${id}` })),
    joins,
    sources: [{ id: 's-one', title: 'Synthetic source', kind: 'repository', use: 'Synthetic use', check: 'pending' }],
    layers: [
      { id: 'proposed', kind: 'model', label: pair('layer P'), defaultOn: true, line: 'Synthetic line' },
      { id: 'roxbury', kind: 'model', label: pair('layer R'), defaultOn: true, line: 'Synthetic line' },
      { id: 'tried', kind: 'model', label: pair('layer T'), defaultOn: false, line: 'Synthetic line' },
      { id: 'future', kind: 'model', label: pair('layer U'), defaultOn: false, line: 'Synthetic line' },
      { id: 'goods', kind: 'flow', label: pair('flow G'), defaultOn: true, line: 'Synthetic line' },
      { id: 'funding', kind: 'flow', label: pair('flow F'), defaultOn: false, line: 'Synthetic line' },
      { id: 'decisions', kind: 'flow', label: pair('flow D'), defaultOn: false, line: 'Synthetic line' },
    ],
    flows: [{ id: 'goods', ink: 'synthetic-ink-goods', label: pair('flow G') }, { id: 'funding', ink: 'synthetic-ink-funding', label: pair('flow F') }, { id: 'decisions', ink: 'synthetic-ink-decisions', label: pair('flow D') }],
    sharedAssets: [{ id: 'tools', label: 'Synthetic asset' }],
    nodes,
    edges,
    walks: [walk],
    locked: { roxburyFromStart: true, hero: 'n-a', fundingCarries: 'shared-assets-only', spendableCredits: 'future', everythingFictional: true, governancePhase2: 'paused' },
    stamps: [stamp.fictional, 'Synthetic page stamp'],
    defaultView: { layers: { proposed: true, roxbury: true, tried: false, future: false, goods: true, funding: false, decisions: false }, hero: 'n-a', altitude: 'block', labels: 'commons', walk: null, step: 0 },
    historicalLines: [{ node: 'n-old', record: 'practice', check: 'pending', stamp: 'Synthetic pending stamp', text: 'Synthetic pending line' }],
    walkthroughs: [walkthrough],
  }
}

export const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

/* Wraps any model (or raw payload text) as an envelope whose hash is correct for that payload. */
export function envelopeFor(model: unknown, overrides: Record<string, unknown> = {}) {
  const payload = typeof model === 'string' ? model : serializeCanonical(model)
  return { schema: 'commons.economy-map.envelope', schemaVersion: 1, modelVersion: 1, payloadSha256: sha256(payload), payload, ...overrides }
}
