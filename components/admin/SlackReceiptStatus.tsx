import Link from 'next/link'
import { slackReceiptStatus } from '@/lib/slack-receipt-status'

export default function SlackReceiptStatus({ run }: { run: Record<string, unknown> }) {
  const receipt = slackReceiptStatus(run)
  if (!receipt) return null
  return (
    <section aria-label="Slack action receipt" className="agent-ops-card mb-6 min-w-0 rounded-lg border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Slack action receipt</h2>
        <Link href={receipt.reviewHref} className="agent-ops-button-secondary">Review decision</Link>
      </div>
      <dl className="my-3 flex flex-wrap gap-3 text-sm">
        <div className="min-w-0 rounded-lg border px-3 py-2"><dt className="text-xs text-muted-foreground">{receipt.topic}</dt><dd className="break-words font-medium">{receipt.decision}</dd></div>
        <div className="min-w-0 rounded-lg border px-3 py-2"><dt className="text-xs text-muted-foreground">Original Slack card</dt><dd className="break-words font-medium">{receipt.delivery}</dd></div>
      </dl>
      <p className="text-sm text-muted-foreground">{receipt.next}</p>
      {receipt.text || receipt.deliveryError ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium">Receipt details</summary>
          {receipt.text ? <p className="mt-2 whitespace-pre-wrap break-words">{receipt.text}</p> : null}
          {receipt.deliveryError ? <p className="mt-2 break-words">{receipt.deliveryError}</p> : null}
        </details>
      ) : null}
    </section>
  )
}
