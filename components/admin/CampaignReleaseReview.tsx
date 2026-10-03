'use client'
import { useCallback, useEffect, useState } from 'react'
import { getCurrentSession } from '@/lib/auth'
import type { ReleaseDecision, ReleaseRecord } from '@/lib/campaign-release-manifest'
import { campaignReadiness, campaignRecoveryView, type ApprovalProgress, type SyntheticExecutionProgress } from '@/lib/campaign-release-recovery-view'

const evidenceCurrent = (record: ReleaseRecord) => record.manifest.actions.every(action => Date.parse(action.evidenceExpiresAt) > Date.now())

function HashEvidence({ label, value }: { label: string; value: string }) {
  return <details className="mt-2 text-xs">
    <summary className="cursor-pointer" title={value}>{label}: <span className="font-mono">{value.slice(0, 8)}…{value.slice(-6)}</span></summary>
    <code className="mt-1 block break-all" aria-label={`Full ${label.toLowerCase()}`}>{value}</code>
  </details>
}

export default function CampaignReleaseReview({ campaignId, releaseId }: { campaignId: string; releaseId?: string | null }) {
  const [releases, setReleases] = useState<ReleaseRecord[]>([])
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [bindings, setBindings] = useState<ApprovalProgress[]>([])
  const [attempts, setAttempts] = useState<SyntheticExecutionProgress[]>([])
  const load = useCallback(async () => {
    setBusy(true)
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Sign in again to review releases.')
      const response = await fetch(`/api/admin/campaigns/${campaignId}/releases${releaseId ? `?release=${encodeURIComponent(releaseId)}` : ''}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!response.ok) throw new Error('Release records unavailable. Refresh to retry.')
      const result = await response.json()
      setBindings(result.approvalProgress ?? []); setReleases(result.releases); setAttempts(result.executionProgress ?? []); setNotice('')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Release records unavailable.') }
    finally { setBusy(false) }
  }, [campaignId, releaseId])
  useEffect(() => { void load() }, [load])
  async function decide(record: ReleaseRecord, decision: ReleaseDecision) {
    if (decision === 'stop' && !window.confirm('Permanently stop this release? Completed external actions cannot be recalled.')) return
    setBusy(true)
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Sign in again to review releases.')
      const response = await fetch(`/api/admin/campaigns/${campaignId}/releases`, { method: 'PATCH', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ releaseId: record.manifest.releaseId, hash: record.hash, decision }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Decision unconfirmed. Refresh before retrying.')
      setReleases(previous => previous.map(row => row.manifest.releaseId === record.manifest.releaseId ? result.record : row))
      setNotice(`Release ${result.record.state.replaceAll('_', ' ')}. Provider execution remains gated.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Decision unconfirmed.') }
    finally { setBusy(false) }
  }
  return <section className="my-6 min-w-0 rounded-xl border border-gray-700 bg-gray-900 p-4" aria-label="Campaign releases">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Campaign releases</h2><button disabled={busy} onClick={() => void load()} className="rounded border border-gray-600 px-3 py-2 disabled:opacity-50">Refresh releases</button></div>
    <p className="mt-2 text-sm text-gray-300">Approve the exact content and scope. Provider execution is disabled.</p>
    {notice && <p role="status" className="mt-3 rounded border border-amber-700 p-3 text-sm">{notice}</p>}
    {!busy && !releases.length && <p className="mt-3 text-sm">No release prepared. Complete the campaign content calendar and channel reviews, then have the campaign owner assemble the release packet.</p>}
    {releases.map(record => <article key={record.manifest.releaseId} id={`release-${record.manifest.releaseId}`} className="mt-4 min-w-0 rounded-lg border border-gray-700 p-3">
      <h3 className="font-semibold">{record.manifest.class === 'broadcast_release' ? 'Broadcast Release' : 'Relationship Outreach Batch'} · {record.state.replaceAll('_', ' ')}</h3>
      <p className="mt-1 break-words">{record.manifest.objective}</p>
      <p className="mt-2 text-sm text-gray-300">{record.manifest.actions.length} {record.manifest.actions.length === 1 ? 'action' : 'actions'} · ${(record.manifest.spendCapCents / 100).toFixed(2)} USD cap · Expires {new Date(record.manifest.expiresAt).toLocaleString()}</p>
      <dl aria-label="Release readiness" className="mt-3 flex flex-wrap gap-2 text-xs leading-5">
        {Object.entries(campaignReadiness(record, bindings, Date.now(), attempts)).filter(([key]) => key !== 'nextAction').map(([key, value]) => <div key={key} className="min-w-0 max-w-full rounded border border-gray-600 px-2 py-1"><dt className="capitalize text-gray-400">{key}</dt><dd className="break-words">{value}</dd></div>)}
      </dl>
      <p className="mt-2 text-sm text-amber-200">Next: {campaignReadiness(record, bindings, Date.now(), attempts).nextAction}</p>
      <details className="mt-3 rounded border border-gray-700 p-3">
        <summary className="cursor-pointer font-medium">Readiness and recovery</summary>
        <p className="mt-2 text-xs text-gray-400">Sandbox evidence only. Acceptance leaves delivery unconfirmed; uncertain outcomes retain reservations.</p>
        <ol className="mt-3 space-y-3">
          {campaignRecoveryView(record, attempts).map((step, index) => <li key={step.actionId} className="min-w-0 border-t border-gray-700 pt-2 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{index + 1}. {record.manifest.actions[index].provider}</span><span className={step.state === 'Reconcile outcome' ? 'text-amber-200' : 'text-gray-300'}>{step.state}</span></div>
            <p className="mt-1 break-words">{step.detail}</p><p className="mt-1 text-xs text-gray-300">Receipt trust: {step.trust}</p>
            {step.attempts > 0 && <p className="mt-1 text-xs text-gray-400">Attempt {step.attempts} · ${(step.reservedCents / 100).toFixed(2)} reserved · ${(step.spentCents / 100).toFixed(2)} recorded spend</p>}
            {step.receipt && <details className="mt-2"><summary className="cursor-pointer underline">Inspect test receipt</summary><code className="mt-1 block break-all">{step.receipt}</code></details>}
            <a className="mt-2 inline-block underline" href={record.manifest.actions[index].source.table === 'social_content_queue' ? `/admin/social-content/${record.manifest.actions[index].source.id}` : record.manifest.actions[index].source.table === 'outreach_queue' ? '/admin/outreach' : '/admin/content/video-generation'}>Review step {index + 1} evidence</a>
          </li>)}
        </ol>
      </details>
      <details className="mt-3"><summary className="cursor-pointer py-2">Review content and scope</summary>
        {record.manifest.actions.map(action => <div key={action.id} className="my-3 min-w-0 rounded border border-gray-700 p-3 text-sm">
          <p className="font-semibold">{action.provider} · {action.operation}</p>
          <p className="break-all">Account: {action.accountId}</p><p>Audience: {action.audience}</p>
          {action.recipients.map(recipient => <p key={recipient.address} className="break-all">Recipient: {recipient.address}</p>)}
          <p className="mt-2 font-medium">{action.copy.title}</p><p className="whitespace-pre-wrap break-words">{action.copy.body}</p>
          <p className="mt-2">Scheduled: {new Date(action.scheduledFor).toLocaleString()} · Up to ${(action.maxSpendCents / 100).toFixed(2)}</p>
          <p>Expected receipt: {({ platform_post_id: 'Published post confirmation', gmail_message_id: 'Gmail delivery record', heygen_video_id: 'HeyGen video record', manual_confirmation: 'Operator confirmation' })[action.expectedReceipt]}</p>
          <a className="mt-2 inline-block underline" href={action.source.table === 'social_content_queue' ? `/admin/social-content/${action.source.id}` : action.source.table === 'outreach_queue' ? '/admin/outreach' : '/admin/content/video-generation'}>Open channel review</a>
          <details className="mt-2"><summary className="cursor-pointer">Assets, consent, and exact metadata</summary>
            {action.assets.length ? action.assets.map(asset => <div className="mt-2 break-all" key={asset.ref}><p>Asset: {asset.ref}</p><p>Privacy review: {asset.privacyReviewId}</p><HashEvidence label="Content hash" value={asset.sha256} /></div>) : <p className="mt-2">No media assets.</p>}
            {action.recipients.map(recipient => <div className="mt-2 break-all" key={recipient.address}><p>Consent evidence: {recipient.consentEvidenceId}</p><p>Suppression check: {recipient.suppressionEvidenceId}</p></div>)}
            <dl className="mt-2">{Object.entries(action.copy.metadata).map(([key, value]) => <div className="mt-1 break-words" key={key}><dt className="font-semibold">{key.replaceAll('_', ' ')}</dt><dd>{value}</dd></div>)}</dl>
            <p className="mt-2">Evidence expires: {action.evidenceExpiresAt ? new Date(action.evidenceExpiresAt).toLocaleString() : 'Missing — prepare a fresh packet'}</p>
            <p className="mt-2">Required earlier actions: {action.dependsOn.length}</p>
          </details>
        </div>)}
        <HashEvidence label="Manifest hash" value={record.hash} />
        <p className="mt-2 text-sm">Stop conditions: {record.manifest.stopConditions.join(', ').replaceAll('_', ' ')}</p>
      </details>
      <div className="mt-3 flex flex-wrap gap-2">
        {(['approve', 'revise', 'hold', 'stop'] as const).map(decision => <button key={decision} disabled={busy || record.state === 'stopped' || (decision === 'approve' && (record.state !== 'pending' || !evidenceCurrent(record) || Date.parse(record.manifest.expiresAt) <= Date.now()))} onClick={() => void decide(record, decision)} className={`rounded px-3 py-2 text-sm disabled:opacity-40 ${decision === 'approve' ? 'bg-blue-600' : decision === 'stop' ? 'border border-red-500 text-red-200' : 'border border-gray-500'}`}>{({ approve: 'Approve release', revise: 'Request revision', hold: 'Hold', stop: 'Emergency stop' })[decision]}</button>)}
      </div>
      {!evidenceCurrent(record) && <p className="mt-2 text-sm text-amber-200">Evidence expired or missing. Update channel checks, then prepare a fresh release.</p>}
      <p className="mt-2 text-xs text-gray-400">Held, revised, stopped, or expired releases require a fresh packet before approval.</p>
      <details className="mt-3 text-sm"><summary className="cursor-pointer">Decision history ({record.audit.length})</summary>{record.audit.map((event, index) => <p className="mt-2 break-all" key={index}>{event.at} · {event.decision} · {event.actor}</p>)}</details>
    </article>)}
  </section>
}
