import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ExternalLink, PauseCircle, RotateCcw } from 'lucide-react'
import {
  buildAgenticContentReviewActionHref,
  type AgenticContentReviewPacket,
} from '@/lib/agentic-content-review-packets'

const GITHUB_DOC_BASE_URL = 'https://github.com/vsillah/Portfolio/blob/main/'

function sourcePacketUrl(path: string) {
  return `${GITHUB_DOC_BASE_URL}${path}`
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
}

export default function AgenticContentReviewPacketCard({
  packet,
  nextGateHref,
  nextGateLabel = 'Open current queue',
}: AgenticContentReviewPacketCardProps) {
  const copy = surfaceCopy(packet)

  return (
    <div className="rounded-lg border border-silicon-slate bg-imperial-navy/45 p-4">
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500">
        <span className="rounded-full border border-radiant-gold/30 px-2 py-0.5 text-radiant-gold">{packet.priority}</span>
        <span>{packet.channel}</span>
        <span>{packet.output}</span>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-gray-100">{packet.title}</h3>
      <p className="mt-2 text-xs leading-5 text-gray-400">{packet.humanReview}</p>

      <div className="mt-3 rounded-md border border-radiant-gold/25 bg-radiant-gold/10 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-radiant-gold">Human decision</div>
        <p className="mt-1 text-xs leading-5 text-gray-200">{packet.decisionPrompt}</p>
        <div className="mt-3 grid gap-2 text-[11px] leading-5 sm:grid-cols-2">
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-100">
            <span className="font-semibold text-emerald-300">Approve path:</span> {packet.approveMeaning}
          </div>
          <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-2 text-amber-100">
            <span className="font-semibold text-amber-300">Send back:</span> {packet.sendBackMeaning}
          </div>
        </div>
      </div>

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

      <div className="mt-3 grid gap-2 text-[11px] leading-5 sm:grid-cols-3">
        <Link
          href={buildAgenticContentReviewActionHref(packet, 'approve_next_gate')}
          className="rounded-md border border-emerald-500/35 bg-emerald-500/10 p-2 text-emerald-100 transition-colors hover:border-emerald-400"
        >
          <span className="flex items-center gap-1.5 font-semibold text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {copy.approveLabel}
          </span>
          <span className="mt-1 block text-emerald-100/80">{copy.approveHelp}</span>
        </Link>
        <Link
          href={buildAgenticContentReviewActionHref(packet, 'send_back_for_repair')}
          className="rounded-md border border-amber-500/35 bg-amber-500/10 p-2 text-amber-100 transition-colors hover:border-amber-400"
        >
          <span className="flex items-center gap-1.5 font-semibold text-amber-300">
            <RotateCcw className="h-3.5 w-3.5" />
            Send back
          </span>
          <span className="mt-1 block text-amber-100/80">Opens a repair prompt for Amina before another human pass.</span>
        </Link>
        <Link
          href={buildAgenticContentReviewActionHref(packet, 'hold_for_human')}
          className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-rose-100 transition-colors hover:border-rose-400"
        >
          <span className="flex items-center gap-1.5 font-semibold text-rose-300">
            <PauseCircle className="h-3.5 w-3.5" />
            Hold
          </span>
          <span className="mt-1 block text-rose-100/80">Frames the unresolved risk for a human-only decision.</span>
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={sourcePacketUrl(packet.packetPath)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-silicon-slate bg-background/50 px-3 py-2 text-xs font-medium text-gray-200 transition-colors hover:border-radiant-gold/50 hover:text-radiant-gold"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Review source packet
        </a>
        {nextGateHref ? (
          <a
            href={nextGateHref}
            className="inline-flex items-center gap-1.5 rounded-md border border-silicon-slate bg-background/50 px-3 py-2 text-xs font-medium text-gray-200 transition-colors hover:border-radiant-gold/50 hover:text-radiant-gold"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {nextGateLabel}
          </a>
        ) : null}
      </div>
    </div>
  )
}
