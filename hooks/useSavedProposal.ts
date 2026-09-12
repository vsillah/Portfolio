'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentSession } from '@/lib/auth'
export type SavedProposal = {
  id: string; status: string; client_name: string; client_company: string | null;
  bundle_name: string; total_amount: number; terms_text: string | null; valid_until: string | null;
  line_items: Array<{title?: string; name?: string; description?: string; price: number}>;
  access_code: string | null; pdf_url: string | null;
}
export function useSavedProposal(sessionId: string | null | undefined) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{sessionId: string | null; proposal: SavedProposal | null; loading: boolean; error: string}>({sessionId:null,proposal:null,loading:false,error:''})
  useEffect(() => {
    if (!sessionId) return
    let active = true
    setState({sessionId,proposal:null,loading:true,error:''})
    ;(async () => {
      let session = await getCurrentSession()
      if (!session) throw new Error('Sign in to load the saved proposal.')
      let response = await fetch(`/api/proposals?sales_session_id=${encodeURIComponent(sessionId)}`, {headers:{Authorization:`Bearer ${session.access_token}`}})
      if (response.status === 401) {
        await supabase.auth.refreshSession()
        session = await getCurrentSession()
        if (session) response = await fetch(`/api/proposals?sales_session_id=${encodeURIComponent(sessionId)}`, {headers:{Authorization:`Bearer ${session.access_token}`}})
      }
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load the saved proposal.')
      if (active) setState({sessionId,proposal:data.proposal,loading:false,error:''})
    })().catch(e => {if(active) setState({sessionId,proposal:null,loading:false,error:e.message})})
    return () => {active=false}
  }, [sessionId, revision])
  return {...(state.sessionId === sessionId ? state : {proposal:null,loading:!!sessionId,error:''}), refresh: () => setRevision(n => n+1)}
}
