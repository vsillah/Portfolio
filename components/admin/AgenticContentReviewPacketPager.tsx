'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import AgenticContentReviewPacketCard from '@/components/admin/AgenticContentReviewPacketCard'
import type { AgenticContentReviewPacket } from '@/lib/agentic-content-review-packets'

type AgenticContentReviewPacketPagerProps = {
  packets: AgenticContentReviewPacket[]
  nextGateHref?: string
  nextGateLabel?: string
  showDecisionActions?: boolean
}

export default function AgenticContentReviewPacketPager({
  packets,
  nextGateHref,
  nextGateLabel,
  showDecisionActions = true,
}: AgenticContentReviewPacketPagerProps) {
  const [activePacketIndex, setActivePacketIndex] = useState(0)
  const packetCount = packets.length
  const activePacket = packets[activePacketIndex]
  const hasPrevious = activePacketIndex > 0
  const hasNext = activePacketIndex < packetCount - 1

  if (!activePacket) {
    return (
      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        No review packets are ready yet.
      </div>
    )
  }

  return (
    <section className="mt-4 rounded-lg border border-border bg-muted/25 p-3 text-foreground" aria-label="Review packet pager">
      <div className="flex flex-col gap-3 border-b border-border pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-radiant-gold">
            <FileText className="h-3.5 w-3.5" />
            Review packet
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-muted-foreground">
              Packet {activePacketIndex + 1} of {packetCount}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{activePacket.title}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="agentic-review-packet-select">Select review packet</label>
          <select
            id="agentic-review-packet-select"
            value={activePacketIndex}
            onChange={(event) => setActivePacketIndex(Number(event.target.value))}
            className="input-brand h-9 max-w-full px-3 text-xs font-medium sm:max-w-72"
            aria-label="Select review packet"
          >
            {packets.map((packet, index) => (
              <option key={packet.assetId} value={index}>
                {index + 1}. {packet.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setActivePacketIndex((index) => Math.max(0, index - 1))}
            disabled={!hasPrevious}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-radiant-gold/50 hover:text-radiant-gold disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </button>
          <button
            type="button"
            onClick={() => setActivePacketIndex((index) => Math.min(packetCount - 1, index + 1))}
            disabled={!hasNext}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-radiant-gold/50 hover:text-radiant-gold disabled:cursor-not-allowed disabled:opacity-45"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <AgenticContentReviewPacketCard
          packet={activePacket}
          nextGateHref={nextGateHref}
          nextGateLabel={nextGateLabel}
          showDecisionActions={showDecisionActions}
        />
      </div>
    </section>
  )
}
