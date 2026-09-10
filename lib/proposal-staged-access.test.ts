import { beforeEach, expect, it, vi } from 'vitest'
const m=vi.hoisted(()=>({from:vi.fn(),getBucket:vi.fn()}))
vi.mock('@/lib/supabase',()=>({supabaseAdmin:{from:m.from,storage:{getBucket:m.getBucket}}}))
import { authorizeStagedClient, requirePrivateProposalBucket } from './proposal-staged-server'
function chain(data:unknown){const c:any={};for(const n of ['select','eq'])c[n]=()=>c;c.single=async()=>({data,error:null});return c}
beforeEach(()=>{vi.resetAllMocks();m.from.mockImplementation((t:string)=>chain(t==='proposal_staged_packages'?{ready:true,released_at:'now',client_project_id:'project'}:{access_token:'A'.repeat(64),is_active:true}))})
it('permits authenticated read after initiation flag is off',async()=>{vi.stubEnv('PROPOSAL_STAGED_PAYMENTS_ENABLED','false');expect(await authorizeStagedClient('p','A'.repeat(64))).toMatchObject({ready:true})})
it('rejects wrong or revoked proof',async()=>{await expect(authorizeStagedClient('p','B'.repeat(64))).rejects.toThrow();m.from.mockImplementation((t:string)=>chain(t==='proposal_staged_packages'?{ready:true,released_at:'now',client_project_id:'project'}:{access_token:'A'.repeat(64),is_active:false}));await expect(authorizeStagedClient('p','A'.repeat(64))).rejects.toThrow()})
it('fails closed if the new bucket is public or missing',async()=>{m.getBucket.mockResolvedValue({data:{public:true},error:null});await expect(requirePrivateProposalBucket()).rejects.toThrow();m.getBucket.mockResolvedValue({data:null,error:{}});await expect(requirePrivateProposalBucket()).rejects.toThrow()})
