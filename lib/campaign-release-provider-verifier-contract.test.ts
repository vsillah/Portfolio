// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { CampaignProviderVerifierBridge, providerReadbackContracts, verifierCredentialReferenceSchema, verifierProviders, type VerifierRequest, type ProviderReadbackVerifier } from './campaign-release-provider-verifier'
import { campaignCertificationContracts } from './campaign-release-certification'
import { releaseHash } from './campaign-release-manifest'
const id = (n:number) => `11111111-1111-4111-8111-${String(n).padStart(12,'0')}`
function fixture(provider:typeof verifierProviders[number]='linkedin'):VerifierRequest {
  const scope={provider,operation:campaignCertificationContracts[provider].operation as VerifierRequest['scope']['operation'],
    receiptType:campaignCertificationContracts[provider].receipt,accountId:'synthetic-account',actionId:id(1),releaseId:id(2),
    manifestHash:releaseHash('manifest'),contentHash:releaseHash('content'),deliveryKey:`campaign-action:${releaseHash('delivery')}`,
    authorizationKey:`campaign-authorization:${releaseHash('authority')}`,destinationDigest:releaseHash('destination'),environment:'staging' as const,
    credentialReferenceId:id(3),credentialVersion:1,mode:'controlled_delivery' as const,spendCapCents:50,currency:'USD' as const,verifierId:id(4),verifierVersion:1}
  return {commandId:id(5),receiptId:id(6),certificationId:id(7),runId:id(8),scope,attemptId:id(9),intentId:id(10),owner:'synthetic-worker',expectedVersion:1,
    observation:{scopeDigest:releaseHash(scope),resourceDigest:releaseHash('resource'),evidenceDigest:releaseHash('evidence'),observedAt:new Date().toISOString(),
      status:'confirmed',spentCents:10,readbackComplete:true,noDeliveryProven:false}}
}
const adapter = (r:VerifierRequest):ProviderReadbackVerifier => ({provider:r.scope.provider as typeof verifierProviders[number],verifierId:r.scope.verifierId,version:1,verify:(_s,o)=>({...o})})
const result = (r:VerifierRequest) => ({protocol:'campaign-provider-verifier/v1',commandId:r.commandId,runId:r.runId,receiptId:r.receiptId,certificationId:r.certificationId,
  scopeDigest:releaseHash(r.scope),resourceDigest:r.observation.resourceDigest,outcome:'confirmed',completionRecorded:true,
  campaignReservedCents:0,campaignSpentCents:10,attemptId:r.attemptId,attemptVersion:2,providerEnabled:false,dispatched:false,dispatchEligible:false})
describe('server-only verifier contracts',()=>{
  it.each(verifierProviders)('%s exact contract can reach only the injected private evidence boundary',async provider=>{
    const r=fixture(provider), ingest=vi.fn(async()=>result(r)), bridge=new CampaignProviderVerifierBridge({ingest},[adapter(r)])
    expect(providerReadbackContracts[provider]).toMatchObject({enabled:false,access:'existing-resource-readback-only'})
    expect(await bridge.ingest(r)).toEqual(result(r));expect(ingest).toHaveBeenCalledExactlyOnceWith(r)
  })
  it('defaults empty and does not invoke the boundary',async()=>{
    const ingest=vi.fn(), bridge=new CampaignProviderVerifierBridge({ingest})
    expect(bridge.registeredVerifierCount).toBe(0);await expect(bridge.ingest(fixture())).rejects.toThrow('remain disabled');expect(ingest).not.toHaveBeenCalled()
  })
  it.each(['verifierId','verifierVersion','credentialReferenceId','credentialVersion','accountId','environment','contentHash','destinationDigest'])('rejects %s identity drift before persistence',async key=>{
    const r=fixture(), ingest=vi.fn(),bridge=new CampaignProviderVerifierBridge({ingest},[adapter(r)])
    Object.assign(r.scope,{[key]:key.endsWith('Version')?2:key.endsWith('Id')?id(99):key==='environment'?'production':releaseHash('wrong')})
    await expect(bridge.ingest(r)).rejects.toThrow('retain reservation');expect(ingest).not.toHaveBeenCalled()
  })
  it('parks SMS and rejects secret-bearing envelope fields without echoing them',async()=>{
    const r=fixture(),ingest=vi.fn(),bridge=new CampaignProviderVerifierBridge({ingest},[adapter(r)])
    await expect(bridge.ingest({...r,token:'synthetic-sentinel'})).rejects.toThrow(/^Readback verification refused;/)
    await expect(bridge.ingest({...r,scope:{...r.scope,provider:'sms',operation:'send_sms',receiptType:'sms_delivery_receipt'}})).rejects.toThrow('remain disabled')
    expect(ingest).not.toHaveBeenCalled()
  })
  it('redacts adapter and database exception details',async()=>{
    const r=fixture(),bad=adapter(r);bad.verify=()=>{throw new Error('synthetic-sentinel')}
    for(const bridge of [new CampaignProviderVerifierBridge({ingest:vi.fn()},[bad]),new CampaignProviderVerifierBridge({ingest:async()=>{throw new Error('synthetic-sentinel')}},[adapter(r)])]) {
      try {await bridge.ingest(r);expect.unreachable()}catch(e){expect(String(e)).not.toContain('synthetic-sentinel')}
    }
  })
  it('rejects ambiguous boundary responses and verifier rewriting',async()=>{
    const r=fixture(),bad=adapter(r);bad.verify=(_s,o)=>({...o,spentCents:0})
    await expect(new CampaignProviderVerifierBridge({ingest:vi.fn()},[bad]).ingest(r)).rejects.toThrow()
    for(const patch of [{dispatched:true},{attemptVersion:99},{scopeDigest:releaseHash('wrong')},{campaignSpentCents:51},{outcome:'accepted',completionRecorded:true}]) {
      await expect(new CampaignProviderVerifierBridge({ingest:async()=>({...result(r),...patch})},[adapter(r)]).ingest(r)).rejects.toThrow()
    }
  })
  it('accepts only metadata broker references, never resolvers or raw secrets',()=>{
    const r=fixture(),reference={referenceId:r.scope.credentialReferenceId,version:1,provider:'linkedin',accountDigest:releaseHash(r.scope.accountId),environment:'staging',active:true}
    expect(verifierCredentialReferenceSchema.safeParse(reference).success).toBe(true)
    for(const extra of [{token:'synthetic'},{secretPath:'synthetic'},{resolve:()=>''}])expect(verifierCredentialReferenceSchema.safeParse({...reference,...extra}).success).toBe(false)
  })
  it('registers no provider transport, outbound action, worker, route, cron or env activation',()=>{
    const code=readFileSync('lib/campaign-release-provider-verifier.ts','utf8')
    expect(code).toContain("import 'server-only'")
    expect(code).not.toMatch(/fetch\(|process\.env|axios|https?:\/\/|credential-broker['"]|\.publish\(|\.send\(|\.render\(|\.schedule\(/)
    const sql=readFileSync('supabase/migrations/20261004021121_campaign_provider_verifier_bridge.sql','utf8')
    expect(sql.replace(/--[^\n]*/g, '')).not.toMatch(/grant (?!execute on function public\.campaign_inspect_provider_certification)|create role|net\.http|cron\.schedule/i)
    expect(sql).toContain('principal=session_user')
  })
})
