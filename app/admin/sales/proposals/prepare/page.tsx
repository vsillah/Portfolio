'use client'
import { useState } from 'react'
import { getCurrentSession } from '@/lib/auth'
export default function PrepareProposalPage() {
  const [key] = useState(() => crypto.randomUUID())
  const [result, setResult] = useState<{ proposalId: string; contentDigest: string; ready: boolean } | null>(null)
  const [links, setLinks] = useState<{ proposalPath: string; dashboardPath: string } | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [note, setNote] = useState('')
  async function post(path: string, body: unknown) {
    const session = await getCurrentSession()
    if (!session?.access_token) throw new Error('Sign in as an administrator to continue.')
    const r = await fetch(path, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error)
    return data
  }
  async function prepare(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage('')
    const f = new FormData(e.currentTarget)
    const text = (k: string) => String(f.get(k) || '')
    const totalCents = Math.round(Number(text('total')) * 100)
    const depositCents = Math.round(Number(text('deposit')) * 100)
    try {
      const data = await post('/api/admin/proposals/prepare-staged', { preparation_key: key, contact_id: Number(text('contact')), client_name: text('name'), client_email: text('email'), client_company: text('company'), title: text('title'),
        line_items: [{ title: text('title'), description: text('scope'), price: totalCents / 100, content_type: 'service' }],
        terms_text: text('scope'), agreement_text: text('agreement'), valid_until: text('expiry') ? new Date(text('expiry')).toISOString() : null,
        policy: { version: 1, currency: 'usd', totalCents, depositCents, balanceCents: totalCents - depositCents, acceptanceCriteria: text('criteria').split('\n').filter(Boolean) } })
      setResult(data); setMessage('Draft package prepared. Client access remains closed until release. Repeating preparation with unchanged content reuses this package.')
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Preparation failed.') }
    finally { setBusy(false) }
  }
  async function operate(action: 'release' | 'deliver') {
    if (!result) return
    setBusy(true)
    try {
      const data = await post(`/api/admin/proposals/${result.proposalId}/staged`, { action, digest: result.contentDigest, termsReviewed: reviewed, accessReviewed: reviewed, note })
      if (action === 'release') setLinks(data)
      setMessage(action === 'release' ? 'Client access opened. No message was sent.' : 'Delivery submitted for client acceptance. Balance remains locked until they accept.')
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Action failed.') }
    finally { setBusy(false) }
  }
  const field = 'block w-full rounded border border-gray-500 bg-gray-900 p-3 mt-2'
  const button = 'rounded bg-blue-700 px-4 py-3 text-white disabled:bg-gray-600'
  return <main className="max-w-4xl mx-auto p-4 sm:p-8 text-gray-100">
    <h1 className="text-2xl font-semibold">Prepare a proposal with a deposit</h1>
    <p className="my-4">Create an unsigned proposal, reviewed customer agreement and pending client dashboard. No payment, start date or message is created.</p>
    {message && <p className="my-4 border border-amber-500 rounded p-4" role="status">{message}</p>}
    <form onSubmit={prepare} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">{[['contact','Existing contact ID','number'],['name','Client name','text'],['email','Client email','email'],['company','Company','text'],['title','Engagement title','text'],['total','Fixed total (USD)','number'],['deposit','Deposit (USD)','number']].map(([name,label,type]) => <label key={name}>{label}<input required={name !== 'company'} className={field} name={name} type={type} step={type === 'number' ? '0.01' : undefined} /></label>)}</div>
      <label className="block">Approved scope, timing and payment terms<textarea required className={field} rows={8} name="scope" /></label>
      <label className="block">Exact customer agreement text<textarea required className={field} rows={8} name="agreement" /></label>
      <p className="text-sm">Review the full agreement before release. Standard agreement clauses such as interest, jurisdiction and assignment are not automatically added.</p>
      <label className="block">Delivery acceptance criteria (one per line)<textarea required className={field} rows={4} name="criteria" /></label>
      <label className="block">Optional proposal expiry<input className={field} type="datetime-local" name="expiry" /></label>
      <p className="text-sm">Leave expiry blank only when no deadline is intended. A prepared package cannot be changed under the same preparation key.</p>
      <button className={button} disabled={busy} type="submit">{result ? 'Verify / retry preparation' : 'Prepare draft package'}</button>
    </form>
    {result && <section className="my-8 space-y-4 rounded border border-gray-500 p-4">
      <h2 className="text-lg font-semibold">Release review</h2>
      <label className="flex gap-3"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />The exact agreement, expiry and client access model are approved. Anyone possessing the private client link can view and sign this package.</label>
      <button className={button} disabled={busy || !reviewed} onClick={() => operate('release')}>Open client access</button>
      {links && <div className="flex flex-wrap gap-4"><a className="underline text-blue-300" href={links.proposalPath}>Review client proposal</a><a className="underline text-blue-300" href={links.dashboardPath}>Open client dashboard</a></div>}
      <h2 className="text-lg font-semibold">Submit completed delivery for review</h2>
      <label className="block">Delivery summary and where to review the work<textarea className={field} value={note} onChange={e => setNote(e.target.value)} /></label>
      <button className={button} disabled={busy || !note.trim()} onClick={() => operate('deliver')}>Request delivery acceptance</button>
    </section>}
  </main>
}
