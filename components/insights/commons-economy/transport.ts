/*
 * Commons Economy Map: the Phase 6 cross-repository transport.
 *
 * The only way a model reaches the Insights skin is the machine-generated,
 * commit-bound module in `./generated/`, written by
 * `scripts/commons-economy/generate-envelope.mjs` from the exact pinned Commons
 * producer. This file authors no model content. It checks that the generated
 * module still carries the pinned provenance and that the provenance agrees
 * with the envelope, then hands only the envelope to `adaptEconomyEnvelope`.
 * Any disagreement closes the map.
 *
 * Join destinations: the generated route table proves which `/commons…` paths
 * exist at the producer commit, but no origin serving that commit is verified
 * from source (the producer branch is not on Commons main, and the public host
 * mapping is a provider setting outside the Commons app). Until one is,
 * `verifiedCommonsOrigin` stays null and every destination prints as text.
 */
import pin from './transport-pin.json'
import { commonsEconomyTransport } from './generated/commons-economy-envelope.generated'
import { adaptEconomyEnvelope, type AdapterResult } from './adapter'

export type CommonsEconomyTransport = typeof commonsEconomyTransport

export const verifiedCommonsOrigin: string | null = null

export const expectedWarning = `GENERATED FILE. DO NOT EDIT. Produced by ${pin.generator} from ${pin.producerRepository}@${pin.producerCommit} (${pin.producerModule}, ${pin.producerExport}). Regenerate with: ${pin.generationCommand}`

/* Returns the envelope only when the generated module's provenance is exactly the pin and agrees with its envelope. */
export function provenEnvelope(transport: CommonsEconomyTransport = commonsEconomyTransport): CommonsEconomyTransport['envelope'] | null {
  const { provenance: p, envelope: e } = transport
  const bound =
    transport.generatedFileWarning === expectedWarning &&
    p.producerRepository === pin.producerRepository &&
    p.producerCommit === pin.producerCommit &&
    p.producerModule === pin.producerModule &&
    p.producerExport === pin.producerExport &&
    p.generator === pin.generator &&
    p.generationCommand === pin.generationCommand &&
    p.schema === pin.envelopeSchema && e.schema === p.schema &&
    p.schemaVersion === pin.envelopeSchemaVersion && e.schemaVersion === p.schemaVersion &&
    e.modelVersion === p.modelVersion &&
    e.payloadSha256 === p.payloadSha256 &&
    transport.commonsRoutes.source === `${pin.producerRepository}@${pin.producerCommit}:${pin.routeSource}`
  return bound ? e : null
}

/* The transported envelope, admitted only after provenance and the Phase 5 adapter both accept it. */
export async function acceptedTransport(transport: CommonsEconomyTransport = commonsEconomyTransport): Promise<{ envelope: CommonsEconomyTransport['envelope'] | null; result: AdapterResult }> {
  const envelope = provenEnvelope(transport)
  if (!envelope) return { envelope: null, result: { ok: false, code: 'envelope', detail: 'generated transport provenance does not match the pin' } }
  const result = await adaptEconomyEnvelope(envelope)
  return { envelope: result.ok ? envelope : null, result }
}

/* A Commons destination links only when its path is in the generated route table and a serving origin is verified. */
export function resolveCommonsJoin(href: string, origin: string | null = verifiedCommonsOrigin, routes: readonly string[] = commonsEconomyTransport.commonsRoutes.routes): string | null {
  if (!origin) return null
  const path = href.split(/[?#]/)[0]
  return routes.includes(path) ? `${origin}${href}` : null
}
