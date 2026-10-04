'use client'
import { useCallback, useEffect, useState } from 'react'
import { getCurrentSession } from '@/lib/auth'
import type { ReleaseRecord } from '@/lib/campaign-release-manifest'
import type { CampaignSlackProjection } from '@/lib/campaign-slack-bridge'

export default function CampaignSlackReview({ record, onRecord }: { record: ReleaseRecord; onRecord: (record: ReleaseRecord) => void }) {
  const [projection, setProjection] = useState<CampaignSlackProjection | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const endpoint = `/api/admin/campaigns/${record.manifest.campaignId}/releases/slack`
  const load = useCallback(async () => {
    setBusy(true)
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Sign in again to inspect Slack receipts.')
      const response = await fetch(`${endpoint}?release=${record.manifest.releaseId}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!response.ok) throw new Error('Slack outcome unavailable. Refresh before retrying.')
      const result: CampaignSlackProjection = await response.json()
      setProjection(result); onRecord(result.release); setNotice('')
    } catch (error) { setProjection(null); setNotice(error instanceof Error ? error.message : 'Slack outcome unavailable.') }
    finally { setBusy(false) }
  }, [endpoint, record.manifest.releaseId, onRecord])
  useEffect(() => { void load() }, [load, record.version])
  async function route(dispatch: boolean) {
    setBusy(true)
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Sign in again to route this release.')
      const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseId: record.manifest.releaseId, hash: record.hash, version: record.version, dispatch }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Request unconfirmed. Refresh before retrying.')
      await load()
      setNotice(result.sent ? 'Review card sent. Waiting for a signed decision.' : 'Intent saved. No new Slack message sent.')
    } catch (error) { setProjection(null); setNotice(error instanceof Error ? error.message : 'Request unconfirmed. Refresh before retrying.') }
    finally { setBusy(false) }
  }
  const intent = projection?.intents.find(item => item.version === record.version) ?? projection?.intents[0]
  const receipt = projection?.receipts[0]
  const canPrepare = !intent && record.state === 'pending'
  const canDispatch = projection?.gate.enabled && intent?.state === 'prepared' && intent.version === record.version && record.state === 'pending'
  const dispatchLabel = !intent ? 'No dispatch' : ({ prepared: 'Intent saved · no dispatch', sending: 'Dispatch unconfirmed', sent: 'Review card sent', unconfirmed: 'Dispatch unconfirmed', rejected: 'Dispatch rejected' })[intent.state]
  const callbackLabel = !receipt ? 'No confirmed callback' : receipt.state === 'reconciliation_required' || receipt.status === 'failed' ? 'Callback outcome unconfirmed' : receipt.status === 'already_recorded' ? 'Duplicate decision recorded' : receipt.status === 'completed' ? 'Decision recorded' : receipt.status === 'blocked' ? 'Decision blocked' : 'Callback accepted · decision pending'
  return <details className="mt-3 rounded border border-gray-700 p-3 text-sm" aria-label="Slack release review">
    <summary className="cursor-pointer font-medium">Slack review{projection ? ` · ${receipt ? callbackLabel : dispatchLabel}` : ''}</summary>
    <p className="mt-2">{projection ? `${receipt ? dispatchLabel : callbackLabel}.` : 'Load Slack status before routing this release.'}</p>
    {projection && <p className="mt-2 text-xs text-gray-300">{projection.gate.reason}</p>}
    {intent && ['sending', 'unconfirmed', 'rejected'].includes(intent.state) && <p className="mt-2 text-amber-200">Inspect the dispatch record with the Integration Captain. Reconcile the original card before preparing another release; this intent cannot resend.</p>}
    {receipt && <div className="mt-2 min-w-0">
      <p className="break-words">{receipt.text || 'Refresh to check the durable worker outcome. Do not repeat the decision.'}</p>
      <p className="mt-1">{receipt.delivery === 'delivered' ? 'Original Slack card updated.' : receipt.delivery === 'failed' ? 'Original card update failed or blocked.' : 'Original card update unconfirmed.'}</p>
      {receipt.deliveryError && <p className="mt-1 break-words text-amber-200">{receipt.deliveryError}</p>}
      <a className="mt-2 inline-block underline" href={`/admin/agents/runs/${receipt.id}`}>Inspect callback receipt</a>
    </div>}
    {intent && <a className="mt-2 inline-block underline" href={`/admin/agents/runs/${intent.id}`}>Inspect dispatch record</a>}
    <div className="mt-3 flex flex-wrap gap-2">
      {canPrepare && <button className="rounded border border-gray-500 px-3 py-2 disabled:opacity-40" disabled={busy || !projection} onClick={() => void route(false)}>Prepare Slack review</button>}
      {intent?.state === 'prepared' && <button className="rounded border border-gray-500 px-3 py-2 disabled:opacity-40" disabled={busy || !canDispatch} onClick={() => void route(true)}>Send review to Slack</button>}
      <button className="rounded border border-gray-600 px-3 py-2 disabled:opacity-40" disabled={busy} onClick={() => void load()}>Refresh Slack status</button>
    </div>
    {notice && <p role="status" className="mt-2 break-words text-amber-200">{notice}</p>}
  </details>
}
