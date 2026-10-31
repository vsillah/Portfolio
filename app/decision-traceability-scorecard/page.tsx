import type { Metadata } from 'next'
import DecisionTraceability from './scorecard'

export const metadata: Metadata = {
  title: 'Decision Traceability Scorecard | AmaduTown',
  description: 'A practical four-part check for keeping reasoning, ownership, thresholds, and evidence visible after a decision.',
}

export default function DecisionTraceabilityPage() {
  return <DecisionTraceability />
}
