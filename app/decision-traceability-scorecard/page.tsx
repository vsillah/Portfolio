import type { Metadata } from 'next'
import DecisionTraceability from './scorecard'

export const metadata: Metadata = {
  title: 'Dark Castle Chess Decision Traceability Scorecard | AmaduTown',
  description: 'Check whether a decision has a clear reason, owner, review trigger, and evidence. Get a free score and one-page worksheet from Dark Castle Chess.',
}

export default function DecisionTraceabilityPage() {
  return <DecisionTraceability />
}
