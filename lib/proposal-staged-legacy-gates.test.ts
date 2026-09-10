import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const m=vi.hoisted(()=>({from:vi.fn(),update:vi.fn()}))
vi.mock('@/lib/supabase',()=>({supabaseAdmin:{from:m.from}}))
vi.mock('@/lib/auth-server',()=>({verifyAdmin:async()=>({user:{id:'admin'}}),isAuthError:()=>false}))
import { PATCH } from '@/app/api/proposals/[id]/route'
import { POST as generateCode } from '@/app/api/admin/proposals/[id]/generate-code/route'
import { POST as attachDocument } from '@/app/api/admin/proposals/[id]/documents/route'
beforeEach(()=>{vi.resetAllMocks();const c:any={};for(const n of ['select','eq'])c[n]=vi.fn(()=>c);c.single=async()=>({data:{id:'p',staged_package:true},error:null});c.update=m.update;m.from.mockReturnValue(c)})
it.each([{action:'mark_viewed'},{action:'mark_sent'},{terms_text:'replacement',total_amount:1,client_email:'other@example.invalid'}])('blocks legacy staged mutation %j',async body=>{
 const r=await PATCH(new NextRequest('http://localhost/api/proposals/p',{method:'PATCH',body:JSON.stringify(body)}),{params:Promise.resolve({id:'p'})});expect(r.status).toBe(403);expect(m.update).not.toHaveBeenCalled()
})
it.each([generateCode,attachDocument])('blocks legacy access rotation or public document attachment',async handler=>{
 const r=await handler(new NextRequest('http://localhost/api/admin/proposals/p',{method:'POST'}),{params:Promise.resolve({id:'p'})});expect(r.status).toBe(403);expect(m.update).not.toHaveBeenCalled()
})
