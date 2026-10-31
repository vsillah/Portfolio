import type { Metadata } from 'next'
import DecisionTraceability from './scorecard'

export const metadata: Metadata = {
  title: 'Dark Castle Chess Decision Traceability Scorecard | AmaduTown',
  description: 'Dark Castle Chess product states inspire a free four-part check for keeping reasoning, ownership, thresholds, and evidence visible after a decision.',
}

export default function DecisionTraceabilityPage() {
  return <DecisionTraceability />
}
