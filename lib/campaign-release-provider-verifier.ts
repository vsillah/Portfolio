import 'server-only'
import { z } from 'zod'
import { certificationScopeSchema, type CertificationScope } from './campaign-release-provider-certification'
import { campaignCertificationContracts } from './campaign-release-certification'
import { releaseHash } from './campaign-release-manifest'

const digest = z.string().regex(/^[a-f0-9]{64}$/)
export const verifierProviders = ['linkedin','instagram','facebook','x','tiktok','gmail','heygen','youtube','manual_social'] as const
export type VerifierProvider = typeof verifierProviders[number]
const observationSchema = z.object({
  scopeDigest: digest, resourceDigest: digest, evidenceDigest: digest,
  observedAt: z.iso.datetime({ offset: true }), status: z.enum(['accepted','uncertain','confirmed','rejected','unknown']),
  spentCents: z.number().int().nonnegative().max(1000000), readbackComplete: z.boolean(), noDeliveryProven: z.boolean(),
}).strict()
export type ReadbackObservation = z.infer<typeof observationSchema>
const requestSchema = z.object({
  commandId: z.uuid(), receiptId: z.uuid(), certificationId: z.uuid().nullable(), runId: z.uuid(),
  scope: certificationScopeSchema, attemptId: z.uuid(), intentId: z.uuid(),
  owner: z.string().min(1).max(200), expectedVersion: z.number().int().positive(), observation: observationSchema,
}).strict()
export type VerifierRequest = z.infer<typeof requestSchema>

/** Metadata-only broker projection. The existing broker owns secret resolution;
 * an independently approved synchronizer must project its reference UUID/version.
 * Never import the executable broker here: it can load env files and secret values. */
export const verifierCredentialReferenceSchema = z.object({
  referenceId: z.uuid(), version: z.number().int().positive(), provider: z.enum(verifierProviders),
  accountDigest: digest, environment: z.enum(['staging','production']), active: z.boolean(),
}).strict()

/** Authenticated adapters attest already-observed provider evidence. No transport,
 * credentials, resource creation or provider SDK capability belongs in this API.
 * The callback is trusted reviewed server code, not an untrusted plugin sandbox. */
export interface ProviderReadbackVerifier {
  readonly provider: VerifierProvider
  readonly verifierId: string
  readonly version: number
  verify(scope: Readonly<CertificationScope>, observation: Readonly<ReadbackObservation>): ReadbackObservation
}
export interface PrivateVerifierBoundary {
  // Dedicated connection to campaign_verifier.ingest; never a service-role RPC.
  ingest(request: VerifierRequest): Promise<unknown>
}
const resultSchema = z.object({
  protocol: z.literal('campaign-provider-verifier/v1'), commandId: z.uuid(), runId: z.uuid(), receiptId: z.uuid(),
  certificationId: z.uuid().nullable(), scopeDigest: digest, resourceDigest: digest,
  outcome: z.enum(['accepted','uncertain','confirmed','rejected','reconciliation_required']), completionRecorded: z.boolean(),
  campaignReservedCents: z.number().int().nonnegative(), campaignSpentCents: z.number().int().nonnegative(),
  attemptId: z.uuid(), attemptVersion: z.number().int().positive(),
  providerEnabled: z.literal(false), dispatched: z.literal(false), dispatchEligible: z.literal(false),
}).strict()
export const providerReadbackContracts = Object.freeze(Object.fromEntries(verifierProviders.map(provider => [provider,
  Object.freeze({ ...campaignCertificationContracts[provider], access: 'existing-resource-readback-only' as const }),
])))

export class CampaignProviderVerifierBridge {
  private readonly registry: ReadonlyMap<string, ProviderReadbackVerifier>
  constructor(private readonly boundary: PrivateVerifierBoundary, verifiers: readonly ProviderReadbackVerifier[] = []) {
    const entries = new Map<string, ProviderReadbackVerifier>()
    for (const verifier of verifiers) {
      if (!verifierProviders.includes(verifier.provider) || !z.uuid().safeParse(verifier.verifierId).success ||
        !Number.isSafeInteger(verifier.version) || verifier.version < 1) throw new Error('Invalid verifier registration.')
      const key = `${verifier.provider}:${verifier.verifierId}:${verifier.version}`
      if (entries.has(key)) throw new Error('Duplicate verifier registration.')
      // Capture reviewed identities and callback once; later object mutation cannot rebind them.
      entries.set(key, Object.freeze({ provider: verifier.provider, verifierId: verifier.verifierId,
        version: verifier.version, verify: verifier.verify.bind(verifier) }))
    }
    this.registry = entries
  }
  get registeredVerifierCount() { return this.registry.size }
  async ingest(input: unknown) {
    try {
      const request = requestSchema.parse(input), scope = request.scope
      if (scope.provider === 'sms' || scope.environment === 'local' || scope.mode !== 'controlled_delivery') throw new Error()
      const verifier = this.registry.get(`${scope.provider}:${scope.verifierId}:${scope.verifierVersion}`)
      if (!verifier) throw new Error()
      const observation = observationSchema.parse(verifier.verify(Object.freeze(structuredClone(scope)), Object.freeze(structuredClone(request.observation))))
      // A verifier may reject the observation but cannot rewrite its identity/spend/proof.
      if (releaseHash(observation) !== releaseHash(request.observation) || observation.scopeDigest !== releaseHash(scope) ||
        observation.spentCents > scope.spendCapCents) throw new Error()
      const result = resultSchema.parse(await this.boundary.ingest({ ...request, observation }))
      if (result.commandId !== request.commandId || result.runId !== request.runId || result.receiptId !== request.receiptId ||
        result.certificationId !== request.certificationId || result.attemptId !== request.attemptId ||
        result.attemptVersion !== request.expectedVersion + 1 || result.scopeDigest !== releaseHash(scope) ||
        result.resourceDigest !== observation.resourceDigest || result.campaignSpentCents + result.campaignReservedCents > scope.spendCapCents ||
        (result.completionRecorded && result.outcome !== 'confirmed')) throw new Error()
      return result
    } catch {
      // Do not leak adapter/provider/DB exception text or schema input values.
      throw new Error('Readback verification refused; retain reservation and reconcile. Providers remain disabled.')
    }
  }
}
