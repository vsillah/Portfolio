'use client'
import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FileText, CheckCircle, RefreshCw } from 'lucide-react'
import StagedProposalList from '@/components/proposals/StagedProposalList'
import { getCurrentSession } from '@/lib/auth'
  async function post(path: string, body?: unknown) {
    const session = await getCurrentSession()
    if (!session?.access_token) throw new Error('Sign in as an administrator to continue.')
    const r = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error)
    return data
  }

export default function PrepareProposalPage() {
  return <Suspense fallback={<p className="p-8">Restoring proposal…</p>}><PrepareProposalContent /></Suspense>
}
function PrepareProposalContent() {
  const proposalId = useSearchParams().get('proposalId')
  const [key, setKey] = useState('')
  const [storageKey, setStorageKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ proposalId: string; contentDigest: string; ready: boolean; proposal: { client_name: string; bundle_name: string; status: string; terms_text: string; valid_until: string | null }; agreement: string; policy: { totalCents: number; depositCents: number; balanceCents: number }; released: boolean; accessActive: boolean; proposalSigned: boolean; agreementSigned: boolean; depositPaid: boolean; delivered: boolean; deliveryAccepted: boolean; deliveryNote: string | null; actionsEnabled: boolean; retryPayload?: Record<string, unknown> } | null>(null)
  const [links, setLinks] = useState<{ proposalPath: string; dashboardPath: string } | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [note, setNote] = useState('')
  const loadPackage = useCallback(async (id: string) => {
    const data = await post(`/api/admin/proposals/${id}/staged`)
    setResult(data); setLinks(data.links); setNote(data.deliveryNote || '')
    if (data.ready) { const session = await getCurrentSession(); if (session) { const slot = `staged-preparation:${session.user.id}`; localStorage.removeItem(slot); sessionStorage.removeItem(slot + ':fields') } }
    window.history.replaceState(null, '', `/admin/sales/proposals/prepare?proposalId=${encodeURIComponent(id)}`)
  }, [])
  useEffect(() => { (async () => {
    setLoading(true); setReviewed(false); setActionErrors({}); setMessage('')
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Sign in as an administrator to continue.')
      const slot = `staged-preparation:${session.user.id}`
      setStorageKey(slot)
      const id = proposalId
      if (id) { await loadPackage(id); return }
      setResult(null); setLinks(null)
      const pendingKey = localStorage.getItem(slot) || crypto.randomUUID()
      localStorage.setItem(slot, pendingKey); setKey(pendingKey)
      const saved = sessionStorage.getItem(slot + ':fields')
      if (saved) setDraft(JSON.parse(saved))
      const lookup = await post(`/api/admin/proposals/prepare-staged?preparationKey=${pendingKey}`)
      if (lookup.packages?.[0]) await loadPackage(lookup.packages[0].proposal_id)
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not restore proposal.') }
    finally { setLoading(false) }
  })() }, [loadPackage, proposalId])
  async function prepare(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage('')
    const f = new FormData(e.currentTarget)
    sessionStorage.setItem(storageKey + ':fields', JSON.stringify(Object.fromEntries(f.entries())))
    const text = (k: string) => String(f.get(k) || '')
    const totalCents = Math.round(Number(text('total')) * 100)
    const depositCents = Math.round(Number(text('deposit')) * 100)
    try {
      const data = await post('/api/admin/proposals/prepare-staged', { preparation_key: key, contact_id: Number(text('contact')), client_name: text('name'), client_email: text('email'), client_company: text('company'), title: text('title'),
        line_items: [{ title: text('title'), description: text('scope'), price: totalCents / 100, content_type: 'service' }],
        terms_text: text('scope'), agreement_text: text('agreement'), valid_until: text('expiry') ? new Date(text('expiry')).toISOString() : null,
        policy: { version: 1, currency: 'usd', totalCents, depositCents, balanceCents: totalCents - depositCents, acceptanceCriteria: text('criteria').split('\n').filter(Boolean) } })
      await loadPackage(data.proposalId); sessionStorage.removeItem(storageKey + ':fields'); localStorage.removeItem(storageKey); setMessage('Draft package prepared. Client access remains closed until release.')
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Preparation failed.') }
    finally { setBusy(false) }
  }
  async function operate(action: 'release' | 'deliver') {
    if (!result) return
    setBusy(true); setActionErrors(m => ({ ...m, [action]: '' }))
    try {
      const data = await post(`/api/admin/proposals/${result.proposalId}/staged`, { action, digest: result.contentDigest, termsReviewed: reviewed, accessReviewed: reviewed, note })
      if (action === 'release') setLinks(data)
      await loadPackage(result.proposalId)
      setActionErrors(m => ({ ...m, [action]: action === 'release' ? 'Client access opened. No message was sent.' : 'Delivery submitted for client acceptance.' }))
    } catch (e) { setActionErrors(m => ({ ...m, [action]: e instanceof Error ? e.message : 'Action failed.' })) }
    finally { setBusy(false) }
  }
  const field = 'block w-full rounded-lg border border-radiant-gold/20 bg-background p-3 mt-2 text-foreground'
  const button = 'inline-flex items-center gap-2 rounded-lg bg-radiant-gold px-4 py-3 font-semibold text-imperial-navy disabled:bg-muted disabled:text-muted-foreground'
  return <main className="max-w-4xl mx-auto p-4 sm:p-8 text-foreground">
    <Link href="/admin/sales" className="text-radiant-gold underline">Back to Sales</Link><h1 className="my-4 flex items-center gap-2 text-2xl font-semibold"><FileText />{result ? result.proposal.bundle_name : 'Prepare a proposal with a deposit'}</h1>
    <p className="my-4">{result ? "Review the saved package and its current status." : <>Create an unsigned proposal, reviewed customer agreement and pending client dashboard. No payment, start date or message is created.</>}</p>
    {message && <p className="my-4 border border-amber-500 rounded p-4" role="status">{message}</p>}
    {!result && !loading && <StagedProposalList />}
    {loading && <p>Restoring proposal…</p>}
    {!result && !loading && key && <form onSubmit={prepare} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">{[['contact','Existing contact ID','number'],['name','Client name','text'],['email','Client email','email'],['company','Company','text'],['title','Engagement title','text'],['total','Fixed total (USD)','number'],['deposit','Deposit (USD)','number']].map(([name,label,type]) => <label key={name}>{label}<input required={name !== 'company'} className={field} defaultValue={draft[name] || ''} name={name} type={type} step={type === 'number' ? '0.01' : undefined} /></label>)}</div>
      <label className="block">Approved scope, timing and payment terms<textarea required className={field} rows={8} defaultValue={draft.scope || ''} name="scope" /></label>
      <label className="block">Exact customer agreement text<textarea required className={field} rows={8} defaultValue={draft.agreement || ''} name="agreement" /></label>
      <p className="text-sm">Review the full agreement before release. Standard agreement clauses such as interest, jurisdiction and assignment are not automatically added.</p>
      <label className="block">Delivery acceptance criteria (one per line)<textarea required className={field} rows={4} defaultValue={draft.criteria || ''} name="criteria" /></label>
      <label className="block">Optional proposal expiry<input className={field} type="datetime-local" defaultValue={draft.expiry || ''} name="expiry" /></label>
      <p className="text-sm">Leave expiry blank only when no deadline is intended. A prepared package cannot be changed under the same preparation key.</p>
      <button className={button} disabled={busy || !key} type="submit">Prepare draft package</button>
    </form>}
    {result && <section className="my-8 space-y-4 rounded-lg border border-radiant-gold/20 p-4">
      <p className="font-semibold">{result.proposal.client_name} · {result.proposal.status.replaceAll('_', ' ')}</p>
      <p>Proposal {result.proposalSigned ? 'signed' : 'unsigned'} · Agreement {result.agreementSigned ? 'signed' : 'unsigned'} · Deposit {result.depositPaid ? 'confirmed' : 'pending'}</p>
      <button className={button} disabled={busy} onClick={() => loadPackage(result.proposalId).catch(e => setMessage(e.message))}><RefreshCw size={16} />Refresh status</button>
      {!result.ready && result.retryPayload && <button className={button} disabled={busy} onClick={async () => { setBusy(true); try { await post('/api/admin/proposals/prepare-staged', result.retryPayload); await loadPackage(result.proposalId) } catch(e) { setMessage(e instanceof Error ? e.message : 'Retry failed.') } finally { setBusy(false) } }}>Finish document preparation</button>}
      <details><summary className="cursor-pointer text-radiant-gold">Reviewed scope (locked)</summary><p className="whitespace-pre-wrap mt-3">{result.proposal.terms_text}</p></details>
      <details><summary className="cursor-pointer text-radiant-gold">Reviewed agreement and commercial terms (locked)</summary><div className="mt-3 space-y-3"><p className="whitespace-pre-wrap">{result.agreement}</p><p>Fixed total: ${(result.policy.totalCents / 100).toFixed(2)} USD · Deposit: ${(result.policy.depositCents / 100).toFixed(2)} · Balance: ${(result.policy.balanceCents / 100).toFixed(2)}</p><p>Expiry: {result.proposal.valid_until ? new Date(result.proposal.valid_until).toLocaleString() : 'No expiry'}</p><p>Anyone possessing the private client link can view and sign this package.</p></div></details>
      <h2 className="text-lg font-semibold">Release review</h2>
      {!result.released && <label className="flex gap-3"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />The exact agreement, expiry and client access model are approved. Anyone possessing the private client link can view and sign this package.</label>}
      <button className={button} disabled={busy || !reviewed || result.released || !result.ready || !result.actionsEnabled} onClick={() => operate('release')}>{result.released ? <><CheckCircle size={16} />{result.accessActive ? 'Client access open' : 'Access revoked'}</> : 'Open client access'}</button>{actionErrors.release && <p role="status" className="text-amber-600">{actionErrors.release}</p>}
      {links && <div className="flex flex-wrap gap-4"><a className="underline text-radiant-gold" href={links.proposalPath}>Review client proposal</a><a className="underline text-radiant-gold" href={links.dashboardPath}>Open client dashboard</a></div>}
      <h2 className="text-lg font-semibold">Submit completed delivery for review</h2>
      <label className="block">Delivery summary and where to review the work<textarea className={field} disabled={result.delivered} value={note} onChange={e => setNote(e.target.value)} /></label>
      <button className={button} disabled={busy || !note.trim() || !result.depositPaid || result.delivered || !result.actionsEnabled} onClick={() => operate('deliver')}>{result.delivered ? (result.deliveryAccepted ? 'Delivery accepted' : 'Delivery awaiting client review') : 'Request delivery acceptance'}</button>{!result.depositPaid && <p>Delivery submission becomes available after the deposit is confirmed.</p>}{actionErrors.deliver && <p role="status" className="text-amber-600">{actionErrors.deliver}</p>}
    </section>}
  </main>
}
