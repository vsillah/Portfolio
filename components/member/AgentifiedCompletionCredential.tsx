'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Credential = { learner_name: string; completed_at: string; verification_token: string | null; revision: number }
type Status = { available: boolean; eligible: boolean; completedCount: number; credential: Credential | null }

export default function AgentifiedCompletionCredential({ profileName, preview = false }: { profileName?: string | null; preview?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [name, setName] = useState(profileName ?? '')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (profileName && !name) setName(profileName) }, [profileName, name])
  useEffect(() => {
    if (preview) { setStatus({ available: true, eligible: true, completedCount: 16, credential: null }); return }
    let active = true
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      try {
        const response = await fetch('/api/agentified/member/credential', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' })
        if (!response.ok) throw new Error('status')
        if (active) setStatus(await response.json())
      } catch { if (active) setNotice('Completion status is unavailable.') }
    }
    void load()
    return () => { active = false }
  }, [preview])
  async function command(action: 'claim' | 'revoke' | 'rotate') {
    if (preview) {
      if (action === 'claim') setStatus({ available: true, eligible: true, completedCount: 16, credential: { learner_name: name.trim() || 'Course learner', completed_at: new Date().toISOString(), verification_token: null, revision: 1 } })
      setNotice(action === 'claim' ? 'Completion credential claimed.' : 'Sign in to manage a verification link.')
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setNotice('Sign in to manage your credential.'); return }
    setBusy(true); setNotice('')
    try {
      const response = await fetch('/api/agentified/member/credential', {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, name: name.trim(), expectedRevision: status?.credential?.revision }),
      })
      const result = await response.json()
      if (!response.ok) { setNotice(result.error || 'Credential action could not be saved.'); return }
      const refresh = await fetch('/api/agentified/member/credential', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' })
      if (!refresh.ok) throw new Error('refresh')
      setStatus(await refresh.json())
      setNotice(action === 'claim' ? 'Completion credential claimed.' : 'Verification link updated.')
    } catch { setNotice('Credential status is unavailable. Reload before trying again.') }
    finally { setBusy(false) }
  }
  if (status?.available === false) return null
  const credential = status?.credential
  const verificationUrl = credential?.verification_token ? `/agentified/verify/${credential.verification_token}` : null
  return <div className="mt-5 border-t border-radiant-gold/20 pt-4" aria-label="Agentified completion credential">
    <h3 className="font-semibold">Completion credential</h3>
    <p className="mt-2 text-sm text-platinum-white/65">{status?.completedCount ?? 0} / 16 lessons complete</p>
    {credential ? <><p className="mt-2 text-sm">{credential.learner_name} completed Agentified on {new Date(credential.completed_at).toLocaleDateString()}.</p><div className="mt-3 flex flex-wrap gap-4">{verificationUrl ? <Link className="text-radiant-gold underline" href={verificationUrl}>View verification</Link> : null}<button className="text-radiant-gold underline disabled:opacity-50" disabled={busy} onClick={() => void command(verificationUrl ? 'revoke' : 'rotate')}>{verificationUrl ? 'Turn off verification link' : 'Create verification link'}</button></div></>
      : status?.eligible ? <><label className="mt-3 block text-sm">Name on credential<input className="mt-2 block w-full max-w-sm rounded border border-radiant-gold/30 bg-silicon-slate p-2" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoComplete="name" /></label><p className="mt-2 text-xs text-platinum-white/65">The name is fixed after you claim.</p><button className="mt-3 rounded bg-radiant-gold px-4 py-2 text-imperial-navy disabled:opacity-50" disabled={busy || !name.trim()} onClick={() => void command('claim')}>Claim credential</button></>
      : <p className="mt-2 text-sm text-platinum-white/65">Complete and save all sixteen Agentified lessons to claim. Your Operating File answers can stay private.</p>}
    {notice && <p className="mt-2 text-sm" role="status">{notice}</p>}
  </div>
}
