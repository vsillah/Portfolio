'use client'

import { useRef, useState } from 'react'
import { FilePlus2, Send, MessageSquare, RefreshCw, ExternalLink } from 'lucide-react'
import { isConfirmedPreflightRejection } from '@/lib/warm-outreach-action-outcome'
import { getCurrentSession } from '@/lib/auth'
import { warmCopyBlocker, warmCopyEvidenceBlocker } from '@/lib/warm-outreach-copy-quality'
import { buildWarmGmailActionRequest, type WarmGmailActionReadiness } from '@/lib/warm-gmail-action-request'
import type { WarmGmailDraftReviewData } from './WarmGmailDraftReviewPanel'

export default function WarmGmailExecutionActions({ data, onRefresh }: {
  data: WarmGmailDraftReviewData
  onRefresh: () => Promise<void>
}) {
  const [confirmation, setConfirmation] = useState<{ action: 'draft' | 'update' | 'send' | 'slack'; readiness: WarmGmailActionReadiness } | null>(null)
  const [lastAction, setLastAction] = useState<'draft' | 'update' | 'send' | 'slack' | null>(null)
  const [slackTarget, setSlackTarget] = useState<{ workspaceId: string; channelId: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [locked, setLocked] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{ draftId?: string; messageId?: string; threadId?: string } | null>(null)
  const inputs = data.generationInputs ?? {}
  const draft = inputs.gmail_draft_creation as Record<string, unknown> | undefined
  const authorization = inputs.warm_gmail_send_authorization as Record<string, unknown> | undefined
  const slackDelivery = inputs.warm_gmail_review_slack_delivery as Record<string, unknown> | undefined
  const reviewRequest = inputs.warm_gmail_send_slack_approval_request as Record<string, unknown> | undefined
  const blocker = warmCopyEvidenceBlocker(inputs)
  const revisionRequired = inputs.copy_revision_requires_provider_reconciliation === true
  const terminal = locked || data.status === 'sent' || data.status === 'queued' || Boolean(blocker)
  const recoverSlack = lastAction === 'slack' || (!lastAction && Boolean(slackDelivery) && slackDelivery?.state !== 'sent')
  const reviewed = data.status === 'approved' && !warmCopyBlocker(data.body)

  async function post(suffix: string, body: Record<string, unknown>) {
    const session = await getCurrentSession()
    if (!session?.access_token) throw new Error('Sign in to Portfolio as an administrator, then refresh this review.')
    const response = await fetch(`/api/admin/outreach/${encodeURIComponent(data.id)}/${suffix}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body),
    })
    const result = await response.json()
    return { response, result }
  }
  async function run(work: () => Promise<void>) {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setMessage(null)
    try { await work() } catch (error) { setMessage(error instanceof Error ? error.message : 'Action could not be completed. Refresh the current state.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  async function prepare(action: 'draft' | 'update' | 'send' | 'slack') {
    setLastAction(action)
    setConfirmation(null)
    await run(async () => {
      const { response, result } = await post(action === 'draft' || action === 'update' ? 'gmail-user-draft' : action === 'send' ? 'gmail-user-send' : 'slack-review-delivery', action === 'draft' || action === 'update' ? { noSendSmoke: true, ...(action === 'update' ? { prepareDraftUpdate: true } : {}) } : { prepareOnly: true })
      if (!response.ok || (action !== 'draft' && action !== 'update' && !result.readyForConfirmation)) {
        setMessage(result.error ?? result.message ?? 'Resolve the Gmail setup blocker, then refresh readiness.')
        return
      }
      buildWarmGmailActionRequest(action, result, data)
      if (action === 'slack') setSlackTarget(result.slackDestination)
      setConfirmation({ action, readiness: result })
    })
  }
  async function confirm() {
    if (!confirmation || terminal) return
    await run(async () => {
      const { action, readiness } = confirmation
      const payload = buildWarmGmailActionRequest(action, readiness, data)
      setConfirmation(null)
      // A dropped HTTP response can follow a successful provider call. Never offer an automatic retry.
      setLocked(true)
      const { response, result } = await post(action === 'draft' || action === 'update' ? 'gmail-user-draft' : action === 'send' ? 'gmail-user-send' : 'slack-review-delivery', payload)
      setMessage(result.error ?? result.message ?? 'Refresh the recorded outcome before continuing.')
      if (action === 'slack' && response.ok && result.sent === true) {
        setLocked(false)
      } else if (response.ok && (result.gmailDraftCreated === true || result.gmailDraftUpdated === true || result.existingDraft === true)) {
        setReceipt(result); setLocked(false)
      } else if (result.gmailSendCalled === true || result.duplicatePrevented === true) setReceipt(result)
      await onRefresh()
      if (isConfirmedPreflightRejection(result)) setLocked(false)
    })
  }
  async function requestReview() {
    await run(async () => {
      const { response, result } = await post('slack-send-approval', { expectedUpdatedAt: data.updatedAt })
      setMessage(response.ok ? 'Review request prepared in Portfolio. Slack delivery has not occurred. Complete the separate authorization review, then refresh.' : result.error ?? 'Review request could not be prepared.')
      await onRefresh()
    })
  }
  const button = 'inline-flex items-center justify-center gap-2 min-h-10 rounded border border-radiant-gold/50 px-3 py-2 text-sm text-radiant-gold disabled:opacity-50'
  return <section aria-label="Gmail actions" className="mt-3 space-y-3 rounded border border-silicon-slate p-3">
    <p className="text-sm font-semibold">Mailbox and delivery</p>
    {!reviewed && !terminal && <p className="text-sm text-muted-foreground">Approve the final copy above before preparing a mailbox draft.</p>}
    {terminal ? <p role="status" className="text-sm">{blocker ?? (data.status === 'sent' ? 'Sent evidence is recorded. Further sends are locked.' : `This action is locked. Review ${recoverSlack ? 'the Slack channel' : 'the mailbox'} and the recorded outcome before attempting another action.`)}</p> : reviewed && !confirmation && <div className="flex flex-wrap gap-2">
      {revisionRequired ? <button className={button} disabled={busy || !draft?.draft_id} onClick={() => void prepare('update')}><FilePlus2 size={16} aria-hidden />Review Gmail draft update</button> : !draft?.draft_id ? <button className={button} disabled={busy} onClick={() => void prepare('draft')}><FilePlus2 size={16} aria-hidden />Review Gmail draft creation</button> : <>
        <a className={button} href={`https://mail.google.com/mail/#drafts?compose=${encodeURIComponent(String(draft.draft_id))}`} target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden />Inspect mailbox draft</a>
        {authorization?.status !== 'approved' ? <>{!slackDelivery && <button className={button} disabled={busy} onClick={() => void requestReview()}><MessageSquare size={16} aria-hidden />Prepare review request</button>}{reviewRequest?.status === 'pending' && !slackDelivery && <button className={button} disabled={busy} onClick={() => void prepare('slack')}><MessageSquare size={16} aria-hidden />Review Slack delivery</button>}</> : <button className={button} disabled={busy} onClick={() => void prepare('send')}><Send size={16} aria-hidden />Review Gmail send</button>}
      </>}
    </div>}
    {confirmation && !terminal && <div role="group" aria-label="Exact Gmail confirmation" className="space-y-2 rounded border border-amber-400/50 p-3">
      <p className="text-sm font-semibold">{confirmation.action === 'update' ? 'Update the existing Gmail draft' : confirmation.action === 'draft' ? 'Create one draft in Gmail' : confirmation.action === 'slack' ? 'Send this review to Slack' : 'Send this Gmail draft now'}</p>
      {confirmation.action === 'slack' && <p className="break-words text-sm">Slack workspace {confirmation.readiness.slackDestination?.workspaceId}<br />Channel {confirmation.readiness.slackDestination?.channelId}</p>}
      <p className="break-words text-sm">From {confirmation.readiness.reviewedCopy.sender}<br />To {confirmation.readiness.reviewedCopy.recipientEmail}</p>
      <p className="break-words font-semibold">{confirmation.readiness.reviewedCopy.subject || '(no subject)'}</p>
      <p className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm">{confirmation.readiness.reviewedCopy.body}</p>
      <p className="text-sm">{confirmation.action === 'update' ? 'This replaces the known mailbox draft with the revised copy. A fresh authorization is required before sending.' : confirmation.action === 'draft' ? 'This creates a mailbox draft. It does not send an email.' : confirmation.action === 'slack' ? 'This posts the saved review to the Slack destination above. It does not send Gmail or record an approval decision.' : 'This sends the displayed message to the recipient above. The approved copy replaces mailbox edits in the same send request.'}</p>
      <div className="grid grid-cols-2 gap-2">
        <button disabled={busy} onClick={() => void confirm()} className={`inline-flex items-center justify-center gap-2 min-h-10 rounded px-3 py-2 text-sm font-semibold disabled:opacity-50 ${confirmation.action === 'send' ? 'bg-red-700 text-white' : 'bg-radiant-gold text-black'}`}>{confirmation.action === 'draft' || confirmation.action === 'update' ? <FilePlus2 size={16} className="shrink-0" aria-hidden /> : confirmation.action === 'slack' ? <MessageSquare size={16} className="shrink-0" aria-hidden /> : <Send size={16} className="shrink-0" aria-hidden />}{confirmation.action === 'update' ? 'Update Gmail draft' : confirmation.action === 'draft' ? 'Create Gmail draft' : confirmation.action === 'slack' ? 'Send review to Slack' : 'Send this Gmail draft'}</button>
        <button className={button} disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button>
      </div>
    </div>}
    {slackDelivery?.state === 'sent' && <p className="text-sm">{revisionRequired ? 'Previous Slack review.' : 'Slack review delivered.'} <a className="underline" href={`https://app.slack.com/client/${slackDelivery.workspace_id}/${slackDelivery.slack_channel}/thread/${slackDelivery.slack_channel}-${slackDelivery.slack_message_ts}`} target="_blank" rel="noreferrer">Open review in Slack</a></p>}
    {busy && <p role="status" className="text-sm">Checking and saving the requested action…</p>}
    {message && <p role="status" className="break-words text-sm">{message}</p>}
    {receipt && <details className="text-sm"><summary>Receipt details</summary><p className="break-all">Draft: {receipt.draftId ?? 'Recorded in queue'}<br />Message: {receipt.messageId ?? 'Not returned'}<br />Thread: {receipt.threadId ?? 'Not returned'}</p></details>}
    <div className="flex flex-wrap gap-3 text-sm">
      <button disabled={busy} className="underline disabled:opacity-50" onClick={() => void run(async () => { setConfirmation(null); await onRefresh(); setMessage('Current review refreshed. Resolve any remaining setup or reconciliation requirement before continuing.') })}><RefreshCw size={14} className="mr-1 inline" aria-hidden />Refresh review</button>
      {terminal && (!recoverSlack || slackTarget || slackDelivery) && <a className="underline" href={recoverSlack ? `https://app.slack.com/client/${slackDelivery?.workspace_id ?? slackTarget?.workspaceId}/${slackDelivery?.channel_id ?? slackTarget?.channelId}` : draft?.draft_id ? `https://mail.google.com/mail/#drafts?compose=${encodeURIComponent(String(draft.draft_id))}` : 'https://mail.google.com/mail/#drafts'} target="_blank" rel="noreferrer">{recoverSlack ? 'Open Slack to reconcile' : 'Open Gmail to reconcile'}</a>}
    </div>
  </section>
}
