import Link from 'next/link'
import { CheckCircle2, FileCheck2, PauseCircle, RotateCcw, ShieldCheck } from 'lucide-react'
import {
  buildAgenticVideoRenderReadinessActionHref,
  type AgenticVideoRenderReadinessPacket,
} from '@/lib/agentic-video-render-readiness-packets'

type AgenticVideoRenderReadinessPanelProps = {
  packets: AgenticVideoRenderReadinessPacket[]
}

export default function AgenticVideoRenderReadinessPanel({ packets }: AgenticVideoRenderReadinessPanelProps) {
  return (
    <div className="rounded-lg border border-silicon-slate bg-background/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-radiant-gold">Provider preflight</div>
          <h2 className="mt-1 text-base font-semibold text-foreground">Render-readiness packets</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-400">
            These packets prepare HeyGen, ElevenLabs, Remotion, and HyperFrames readiness after challenger-cleared script review. They do not start provider jobs.
          </p>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          {packets.length} preflight
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {packets.map((packet) => (
          <div key={packet.assetId} className="rounded-lg border border-silicon-slate bg-imperial-navy/45 p-4">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500">
              <span className="rounded-full border border-radiant-gold/30 px-2 py-0.5 text-radiant-gold">{packet.priority}</span>
              <span>{packet.channel}</span>
              <span>{packet.format}</span>
            </div>

            <h3 className="mt-3 text-sm font-semibold text-gray-100">{packet.title}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {packet.providerTargets.map((provider) => (
                <span key={provider} className="rounded-full border border-silicon-slate bg-background/40 px-2 py-0.5 text-[10px] text-gray-300">
                  {provider}
                </span>
              ))}
            </div>

            <div className="mt-3 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-[11px] leading-5 text-emerald-100">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                {packet.readinessStatus}; {packet.approvalStatus}
              </div>
              <p className="mt-1 text-emerald-100/80">{packet.approvalBoundary}</p>
            </div>

            <div className="mt-3 rounded-md border border-silicon-slate/70 bg-background/40 p-2 text-[11px] leading-5 text-gray-400">
              <div><span className="text-gray-500">Source script:</span> <code className="text-radiant-gold">{packet.sourcePacket.assetId}</code></div>
              <div><span className="text-gray-500">Approval packet:</span> <code className="text-radiant-gold">{packet.packetPath}</code></div>
              <div><span className="text-gray-500">Scope:</span> {packet.scope}</div>
            </div>

            <div className="mt-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Required checks</div>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-5 text-gray-300">
                {packet.requiredChecks.map((check) => (
                  <li key={check} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                    <span>{check}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-3 rounded-md border border-rose-500/25 bg-rose-500/10 p-2 text-[11px] leading-5 text-rose-100">
              {packet.hardBlocks[0]}
            </div>

            <div className="mt-3 grid gap-2 text-[11px] leading-5">
              <Link
                href={buildAgenticVideoRenderReadinessActionHref(packet, 'prepare_preflight')}
                className="rounded-md border border-emerald-500/35 bg-emerald-500/10 p-2 text-emerald-100 transition-colors hover:border-emerald-400"
              >
                <span className="flex items-center gap-1.5 font-semibold text-emerald-300">
                  <FileCheck2 className="h-3.5 w-3.5" />
                  Prepare preflight
                </span>
                <span className="mt-1 block text-emerald-100/80">Create a traceable readiness task before render approval.</span>
              </Link>
              <div className="grid gap-2 sm:grid-cols-2">
                <Link
                  href={buildAgenticVideoRenderReadinessActionHref(packet, 'send_back_to_script_repair')}
                  className="rounded-md border border-amber-500/35 bg-amber-500/10 p-2 text-amber-100 transition-colors hover:border-amber-400"
                >
                  <span className="flex items-center gap-1.5 font-semibold text-amber-300">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Script repair
                  </span>
                </Link>
                <Link
                  href={buildAgenticVideoRenderReadinessActionHref(packet, 'hold_provider_work')}
                  className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-rose-100 transition-colors hover:border-rose-400"
                >
                  <span className="flex items-center gap-1.5 font-semibold text-rose-300">
                    <PauseCircle className="h-3.5 w-3.5" />
                    Hold
                  </span>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
