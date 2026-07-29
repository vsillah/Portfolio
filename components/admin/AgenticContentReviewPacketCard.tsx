import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, PauseCircle, RotateCcw } from 'lucide-react'
import {
  buildAgenticContentReviewActionHref,
  type AgenticContentReviewPacket,
} from '@/lib/agentic-content-review-packets'

const GITHUB_DOC_BASE_URL = 'https://github.com/vsillah/Portfolio/blob/main/'

function sourcePacketUrl(path: string) {
  return `${GITHUB_DOC_BASE_URL}${path}`
}

function priorityLabel(priority: AgenticContentReviewPacket['priority']) {
  switch (priority) {
    case 'P0': return 'High priority'
    case 'P1': return 'Medium priority'
    case 'P2': return 'Low priority'
    default: return 'Normal priority'
  }
}

function surfaceCopy(packet: AgenticContentReviewPacket) {
  switch (packet.targetSurface) {
    case 'social':
      return {
        approveLabel: 'Approve next gate',
        approveHelp: 'Creates a traceable planning step before any scheduling or publishing.',
      }
    case 'video':
      return {
        approveLabel: 'Approve render-readiness',
        approveHelp: 'Creates a traceable render-readiness step before provider execution.',
      }
    case 'content':
      return {
        approveLabel: 'Approve production planning',
        approveHelp: 'Creates a traceable production step before export, client sharing, or implementation.',
      }
  }
}

type AgenticContentReviewPacketCardProps = {
  packet: AgenticContentReviewPacket
  nextGateHref?: string
  nextGateLabel?: string
  decisionNote?: string
}

export default function AgenticContentReviewPacketCard({
  packet,
  nextGateHref,
  nextGateLabel = 'Open current queue',
  decisionNote,
}: AgenticContentReviewPacketCardProps) {
  const copy = surfaceCopy(packet)
  const hasDecisionNote = Boolean(decisionNote?.trim())
  const sendBackHelp = hasDecisionNote ? 'Sends this revision note to the repair task.' : 'Add a decision note before sending back.'

  return (
    <div className="rounded-lg border border-silicon-slate bg-imperial-navy/45 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500">
          <span className="rounded-full border border-radiant-gold/30 px-2 py-0.5 text-radiant-gold">{priorityLabel(packet.priority)}</span>
          <span>{packet.channel}</span>
          <span>{packet.output}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:justify-end" aria-label="Reference links">
          {packet.launchDraftPath ? (
            <a
              href={sourcePacketUrl(packet.launchDraftPath)}
              target="_blank"
              rel="noreferrer"
              title="Open source draft"
              aria-label="Open source draft"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2.5 text-[11px] font-medium text-emerald-100 transition-colors hover:border-emerald-400 hover:text-emerald-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Draft
            </a>
          ) : null}
          <a
            href={sourcePacketUrl(packet.packetPath)}
            target="_blank"
            rel="noreferrer"
            title="Open source packet"
            aria-label="Open source packet"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-silicon-slate bg-background/50 px-2.5 text-[11px] font-medium text-gray-200 transition-colors hover:border-radiant-gold/50 hover:text-radiant-gold"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Packet
          </a>
          {nextGateHref ? (
            <a
              href={nextGateHref}
              title={nextGateLabel}
              aria-label={nextGateLabel}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-silicon-slate bg-background/50 px-2.5 text-[11px] font-medium text-gray-200 transition-colors hover:border-radiant-gold/50 hover:text-radiant-gold"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Queue
            </a>
          ) : null}
        </div>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-gray-100">{packet.title}</h3>
      <p className="mt-2 text-xs leading-5 text-gray-400">{packet.humanReview}</p>

      <div className="mt-3 grid gap-2 text-[11px] text-gray-500 sm:grid-cols-2">
        <div>
          <span className="text-gray-400">Challenger</span>
          <div className="mt-0.5 text-emerald-300">{packet.challengerAgent} - {packet.challengerStatus}</div>
        </div>
        <div>
          <span className="text-gray-400">Approval</span>
          <div className="mt-0.5 text-emerald-300">{packet.approvalStatus}</div>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-silicon-slate/70 bg-background/40 p-2 text-[11px] leading-5 text-gray-400">
        <div><span className="text-gray-500">Source packet:</span> <code className="text-radiant-gold">{packet.packetPath}</code></div>
        <div><span className="text-gray-500">Next gate:</span> {packet.nextGate}</div>
      </div>

      {packet.evidencePacket ? (
        <div className="mt-3 rounded-md border border-blue-400/20 bg-blue-500/10 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-200">
            <FileText className="h-3.5 w-3.5" />
            Evidence packet
          </div>
          <p className="mt-2 text-xs leading-5 text-gray-100">{packet.evidencePacket.draftPreview}</p>
          <div className="mt-3 grid gap-3 text-[11px] leading-5 lg:grid-cols-2">
            <div>
              <div className="font-semibold uppercase tracking-[0.12em] text-radiant-gold/90">Source basis</div>
              <ul className="mt-1 space-y-1 text-gray-300">
                {packet.evidencePacket.sourceBasis.map((source) => (
                  <li key={source}>- {source}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-semibold uppercase tracking-[0.12em] text-emerald-300">Amina clearance</div>
              <ul className="mt-1 space-y-1 text-gray-300">
                {packet.evidencePacket.challengerFindings.map((finding) => (
                  <li key={finding}>- {finding}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-semibold uppercase tracking-[0.12em] text-amber-300">Human checks</div>
              <ul className="mt-1 space-y-1 text-gray-300">
                {packet.evidencePacket.humanChecks.map((check) => (
                  <li key={check}>- {check}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-semibold uppercase tracking-[0.12em] text-rose-300">Still gated</div>
              <ul className="mt-1 space-y-1 text-gray-300">
                {packet.evidencePacket.closedGates.map((gate) => (
                  <li key={gate}>- {gate}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Link
          href={buildAgenticContentReviewActionHref(packet, 'approve_next_gate')}
          title={copy.approveHelp}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-emerald-500/45 bg-emerald-500/15 px-3 py-2 font-semibold text-emerald-100 transition-colors hover:border-emerald-300 hover:bg-emerald-500/25 sm:flex-none"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {copy.approveLabel}
        </Link>
        <Link
          href={buildAgenticContentReviewActionHref(packet, 'send_back_for_repair', decisionNote)}
          title={sendBackHelp}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-amber-500/45 bg-amber-500/15 px-3 py-2 font-semibold text-amber-100 transition-colors hover:border-amber-300 hover:bg-amber-500/25 sm:flex-none"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Send back
        </Link>
        <Link
          href={buildAgenticContentReviewActionHref(packet, 'hold_for_human', decisionNote)}
          title="Frames the unresolved risk for a human-only decision."
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-rose-500/40 bg-rose-500/15 px-3 py-2 font-semibold text-rose-100 transition-colors hover:border-rose-300 hover:bg-rose-500/25 sm:flex-none"
        >
          <PauseCircle className="h-3.5 w-3.5" />
          Hold
        </Link>
      </div>
    </div>
  )
}
