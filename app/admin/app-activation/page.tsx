'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
import type { OperatorAction, OperatorRecord, OperatorSnapshot } from '@/lib/app-activation-operator'

const actions: { key: OperatorAction; label: string; destructive?: boolean }[] = [
  { key: 'start_review', label: 'Start or resume review' },
  { key: 'approve', label: 'Approve interest' },
  { key: 'waitlist', label: 'Waitlist interest' },
  { key: 'reject', label: 'Reject interest', destructive: true },
  { key: 'prepare_invitation', label: 'Prepare synthetic invitation' },
  { key: 'revoke_invitation', label: 'Revoke invitation', destructive: true },
  { key: 'revoke_grant', label: 'Revoke grant', destructive: true },
]
const statuses = ['submitted', 'in_review', 'approved', 'waitlisted', 'rejected'] as const
const surface = 'rounded-2xl border border-border bg-card p-4 shadow-sm'
const control = 'min-h-10 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-radiant-gold'

function actionBlocker(row: OperatorRecord, action: OperatorAction): string | null {
  if (action === 'start_review') return row.status === 'submitted' || row.status === 'waitlisted' ? null : 'Only submitted or waitlisted interest can enter review.'
  if (action === 'approve' && row.status !== 'in_review') return 'Start or resume review before approval.'
  if (action === 'waitlist' && row.status !== 'in_review' && row.status !== 'approved') return 'Start review before waitlisting.'
  if (action === 'reject' && !['in_review', 'approved', 'waitlisted'].includes(row.status)) return row.status === 'rejected' ? 'Rejection is final. A new interest is required.' : 'Start review before rejection.'
  if ((action === 'waitlist' || action === 'reject') && row.status === 'approved') {
    if (row.grant && !row.grant.revokedAt && (!row.grant.expiresAt || new Date(row.grant.expiresAt) > new Date())) return 'Revoke the active grant first.'
    if (row.invitation?.status === 'issued' && new Date(row.invitation.expiresAt) > new Date()) return 'Revoke the issued invitation first.'
  }
  if (action === 'prepare_invitation') {
    if (row.status !== 'approved') return 'Approve interest after review first.'
    if (row.consent?.decision !== 'granted') return 'Current adult contact consent must be recorded through approved intake.'
    if (!row.source.receipt) return 'Capture a source receipt through approved intake.'
    if (!row.release.ready) return `Complete release review: ${row.release.reason}`
    if (row.invitation) return 'An invitation already exists. Review or revoke its state.'
  }
  if (action === 'revoke_invitation' && (!row.invitation || row.invitation.status !== 'issued' || new Date(row.invitation.expiresAt) <= new Date())) return 'Only a current, unredeemed invitation can be revoked.'
  if (action === 'revoke_grant' && (!row.grant || !!row.grant.revokedAt || (row.grant.expiresAt && new Date(row.grant.expiresAt) <= new Date()))) return 'Only an active grant can be revoked.'
  return null
}

function AppActivationConsole() {
  const [snapshot, setSnapshot] = useState<OperatorSnapshot | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [app, setApp] = useState('')
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const [pending, setPending] = useState<OperatorAction | null>(null)
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Sign in with an admin account to view activation review.')
      const response = await fetch('/api/admin/app-activation', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Activation review could not load.')
      setSnapshot(body)
      setSelected(previous => previous && body.records.some((row: OperatorRecord) => row.id === previous) ? previous : body.records[0]?.id || '')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Activation review could not load.') }
    finally { setBusy(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const rows = useMemo(() => (snapshot?.records || []).filter(row =>
    (!app || row.appKey === app) && (!status || row.status === status) &&
    (!query.trim() || [row.adultEmail, row.id, row.source.receipt].some(value => value.toLowerCase().includes(query.trim().toLowerCase())))
  ), [snapshot, app, status, query])
  const record = snapshot?.records.find(row => row.id === selected)
  const counts = useMemo(() => Object.fromEntries(statuses.map(value => [value, (snapshot?.records || []).filter(row => (!app || row.appKey === app) && row.status === value).length])), [snapshot, app])
  const activeAction = actions.find(action => action.key === pending)

  async function submit() {
    if (!record || !pending) return
    setBusy(true); setError(''); setNotice('')
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Admin session expired. Sign in again before acting.')
      const response = await fetch('/api/admin/app-activation', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ appKey: record.appKey, recordId: record.id, action: pending, reason, confirmation }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Operator action failed.')
      setSnapshot(previous => previous ? { ...previous, records: previous.records.map(row => row.id === body.record.id ? body.record : row) } : previous)
      setNotice(body.message)
      setPending(null); setReason(''); setConfirmation('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Operator action failed.') }
    finally { setBusy(false) }
  }

  return <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6 lg:p-8">
    <header className="space-y-2"><p className="text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">Internal · app activation</p><h1 className="text-2xl font-bold md:text-3xl">Operator review</h1><p className="max-w-3xl text-sm text-muted-foreground">Adult interest, review decisions, invitations, and grants have separate states. Interest does not grant access or authorize outreach.</p></header>
    {snapshot && <div role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{snapshot.message}</div>}
    {error && <div role="alert" className="rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-200">{error} <button type="button" className="ml-2 underline" onClick={() => void load()}>Retry</button></div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">{notice}</div>}
    {busy && <p role="status" className="text-sm text-muted-foreground">Working…</p>}
    {snapshot?.mode === 'unconfigured' && <section className={surface}><h2 className="font-semibold">Provider setup required</h2><p className="mt-2 text-sm text-muted-foreground">The Phase 1 schema is source only. An authorized hosted migration, provider configuration, and separate release review are required before live operations can be added. For local UI review, set <code>APP_ACTIVATION_REVIEW_MODE=synthetic</code> with the development server.</p></section>}
    {snapshot?.mode === 'synthetic' && <>
      <section className={surface} aria-label="Search and filters"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="grid gap-1 text-sm font-medium">App<select aria-label="Filter by app" className={control} value={app} onChange={e => { setApp(e.target.value); setPending(null) }}><option value="">All apps</option>{snapshot.apps.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Status<select aria-label="Filter by status" className={control} value={status} onChange={e => { setStatus(e.target.value); setPending(null) }}><option value="">All statuses</option>{statuses.map(item => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}</select></label><label className="grid gap-1 text-sm font-medium sm:col-span-2">Search adult email, ID, or receipt<input aria-label="Search adult email, ID, or receipt" className={control} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search synthetic records" /></label></div><div className="mt-3 flex flex-wrap items-center gap-2 text-sm">{statuses.map(item => <span key={item} className="rounded-full bg-muted px-2 py-1">{item.replace('_', ' ')}: {counts[item]}</span>)}<button type="button" className="rounded-lg border border-border px-3 py-1.5 font-medium hover:bg-muted focus:outline-none focus:ring-2 focus:ring-radiant-gold" onClick={() => { setApp(''); setStatus(''); setQuery(''); setPending(null) }}>Clear filters</button></div></section>
      <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.6fr)]"><section className={surface} aria-label="Interest records"><h2 className="mb-3 text-lg font-semibold">Adult interest records <span className="text-sm font-normal text-muted-foreground">({rows.length})</span></h2>{snapshot.records.length === 0 ? <p className="text-sm text-muted-foreground">No interest records exist. Capture an adult source receipt through a separately approved intake path.</p> : rows.length === 0 ? <p role="status" className="text-sm text-muted-foreground">No records match. Clear filters or try another app, status, or search.</p> : <div className="max-h-[58rem] space-y-2 overflow-auto">{rows.map(row => <button type="button" key={row.id} onClick={() => { setSelected(row.id); setPending(null); setError('') }} aria-pressed={selected === row.id} className={`w-full rounded-xl border p-3 text-left focus:outline-none focus:ring-2 focus:ring-radiant-gold ${selected === row.id ? 'border-amber-500 bg-amber-500/10' : 'border-border hover:bg-muted'}`}><span className="block break-all font-medium">{row.adultEmail}</span><span className="mt-1 block text-xs text-muted-foreground">{snapshot.apps.find(item => item.key === row.appKey)?.name} · {row.status.replace('_', ' ')} · {row.id}</span></button>)}</div>}</section>
      <section className={surface} aria-label="Record details">{record ? <><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold break-all">{record.adultEmail}</h2><p className="text-xs text-muted-foreground">{record.appKey} · {record.id}</p></div><span className="rounded-full border border-border px-3 py-1 text-sm font-medium">{record.status.replace('_', ' ')}</span></div><div className="mt-5 grid gap-3 md:grid-cols-2"><div className="rounded-xl bg-muted p-3 text-sm"><h3 className="font-semibold">Source receipt</h3><p className="mt-1 break-all">{record.source.receipt || 'Missing receipt'}</p><p className="text-muted-foreground">{record.source.type} · {record.source.capturedAt}</p></div><div className="rounded-xl bg-muted p-3 text-sm"><h3 className="font-semibold">Adult consent</h3><p className="mt-1">{record.consent ? `${record.consent.decision} · ${record.consent.version}` : 'No consent receipt'}</p><p className="text-muted-foreground">{record.consent?.recordedAt || 'Record consent through approved intake.'}</p></div><div className="rounded-xl bg-muted p-3 text-sm"><h3 className="font-semibold">Release readiness</h3><p className="mt-1">{record.release.ready ? 'Ready for synthetic review' : 'Blocked'}</p><p className="text-muted-foreground">{record.release.reason}</p></div><div className="rounded-xl bg-muted p-3 text-sm"><h3 className="font-semibold">Invitation</h3><p className="mt-1">{record.invitation ? `${record.invitation.status} · ${record.invitation.id}` : 'None prepared'}</p><p className="text-muted-foreground">{record.invitation ? `Expires ${record.invitation.expiresAt}` : 'Approval and current consent required.'}</p></div><div className="rounded-xl bg-muted p-3 text-sm md:col-span-2"><h3 className="font-semibold">Access grant</h3><p className="mt-1">{record.grant ? record.grant.revokedAt ? 'Revoked' : record.grant.expiresAt && new Date(record.grant.expiresAt) <= new Date() ? 'Expired' : 'Active' : 'No grant'}</p><p className="text-muted-foreground">{record.grant ? `Expires ${record.grant.expiresAt || 'not set'} · Revoked ${record.grant.revokedAt || 'no'}` : 'An invitation is not access.'}</p></div></div>
      <div className="mt-5">
        <h3 className="font-semibold">Operator actions</h3>
        <p className="mt-1 text-xs text-muted-foreground">Actions update this local fixture only. Each decision requires an audit reason.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {actions.map(action => {
            const blocker = actionBlocker(record, action.key)
            return <div key={action.key} className="rounded-lg border border-border p-2">
              <button type="button" disabled={busy || !!blocker} onClick={() => { setPending(action.key); setReason(''); setConfirmation(''); setError('') }} className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-radiant-gold disabled:cursor-not-allowed disabled:opacity-50 ${action.destructive ? 'border-red-500 text-red-800 hover:bg-red-500/10 dark:text-red-200' : action.key === 'approve' || action.key === 'prepare_invitation' ? 'border-amber-600 bg-amber-500/15 hover:bg-amber-500/25' : 'border-border hover:bg-muted'}`}>{action.label}</button>
              {blocker && <p className="mt-1 text-xs text-muted-foreground">{blocker}</p>}
            </div>
          })}
        </div>
      </div>
      {pending && activeAction && <div className="mt-4 rounded-xl border border-amber-500/50 bg-amber-500/5 p-4"><h3 className="font-semibold">{activeAction.label}</h3><p className="mt-1 text-sm text-muted-foreground">This changes only synthetic review state and writes a local audit event.</p><label className="mt-3 grid gap-1 text-sm font-medium">Audit reason<textarea aria-label="Audit reason" className={control} value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={3} placeholder="Why is this decision appropriate?" /></label>{activeAction.destructive && <label className="mt-3 grid gap-1 text-sm font-medium">Type {pending} to confirm<input aria-label={`Type ${pending} to confirm`} className={control} value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" /></label>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy || reason.trim().length < 8 || !!(activeAction.destructive && confirmation !== pending)} onClick={() => void submit()} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-radiant-gold disabled:cursor-not-allowed disabled:opacity-50 ${activeAction.destructive ? 'bg-red-700' : 'bg-amber-700'}`}>Confirm {activeAction.label.toLowerCase()}</button><button type="button" className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-radiant-gold" onClick={() => { setPending(null); setReason(''); setConfirmation('') }}>Cancel</button></div></div>}
      <div className="mt-6"><h3 className="font-semibold">Audit history</h3><ol className="mt-2 space-y-2">{record.events.map(item => <li key={item.id} className="rounded-lg border border-border p-3 text-sm"><strong>{item.type.replaceAll('_', ' ')}</strong><span className="block text-xs text-muted-foreground">{item.at} · {item.actor}</span><p className="mt-1">{item.reason}</p></li>)}</ol></div></> : <p className="text-sm text-muted-foreground">Select an interest record to review its source, consent, lifecycle, and audit history.</p>}</section></div>
    </>}
  </div>
}

export default function AppActivationPage() { return <ProtectedRoute requireAdmin><AppActivationConsole /></ProtectedRoute> }
