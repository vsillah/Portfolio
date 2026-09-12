import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
const m=vi.hoisted(()=>({session:vi.fn(),refresh:vi.fn()}))
vi.mock('@/lib/auth',()=>({getCurrentSession:m.session}))
vi.mock('@/lib/supabase',()=>({supabase:{auth:{refreshSession:m.refresh}}}))
import {useSavedProposal} from './useSavedProposal'
beforeEach(()=>{vi.resetAllMocks();m.session.mockResolvedValue({access_token:'token'});vi.stubGlobal('fetch',vi.fn())})
it('restores on remount and retries expired auth using the fresh token',async()=>{
 m.session.mockResolvedValueOnce({access_token:'old'}).mockResolvedValue({access_token:'new'})
 vi.mocked(fetch).mockResolvedValueOnce({status:401,ok:false} as Response).mockResolvedValue({status:200,ok:true,json:async()=>({proposal:{id:'saved'}})} as Response)
 const first=renderHook(()=>useSavedProposal('session'))
 await waitFor(()=>expect(first.result.current.proposal?.id).toBe('saved'))
 expect(m.refresh).toHaveBeenCalledOnce();expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('sales_session_id=session'),{headers:{Authorization:'Bearer new'}})
 first.unmount();const second=renderHook(()=>useSavedProposal('session'));await waitFor(()=>expect(second.result.current.proposal?.id).toBe('saved'))
})
it('ignores a late response for the previous session',async()=>{
 let resolveOld!:(r:Response)=>void
 vi.mocked(fetch).mockImplementationOnce(()=>new Promise(r=>{resolveOld=r})).mockResolvedValue({ok:true,status:200,json:async()=>({proposal:{id:'new'}})} as Response)
 const h=renderHook(({id})=>useSavedProposal(id),{initialProps:{id:'old'}})
 await waitFor(()=>expect(fetch).toHaveBeenCalledOnce());h.rerender({id:'new'})
 await waitFor(()=>expect(h.result.current.proposal?.id).toBe('new'))
 await act(async()=>resolveOld({ok:true,status:200,json:async()=>({proposal:{id:'old'}})} as Response))
 expect(h.result.current.proposal?.id).toBe('new')
})
it('offers a retry after failed lookup without creating a proposal',async()=>{
 vi.mocked(fetch).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ok:true,status:200,json:async()=>({proposal:null})} as Response)
 const h=renderHook(()=>useSavedProposal('session'));await waitFor(()=>expect(h.result.current.error).toBe('Offline'))
 act(()=>h.result.current.refresh());await waitFor(()=>expect(h.result.current.loading).toBe(false));expect(h.result.current.error).toBe('')
 expect(fetch).toHaveBeenCalledTimes(2)
})
