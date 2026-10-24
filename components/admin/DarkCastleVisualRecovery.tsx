type DarkCastleVisualRecoveryProps = {
  recordId: string
  qaFixture?: string
}

export default function DarkCastleVisualRecovery({ recordId, qaFixture }: DarkCastleVisualRecoveryProps) {
  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
      <p>
        The corrected copy and image are still awaiting Human QA. This record keeps its earlier approved copy.
      </p>
      <p>
        Review the copy saved here, then use the Dark Castle review packet with the Integration Captain to finish the separate copy and visual decisions.
      </p>
      <a
        className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
        href={`/admin/social-content/${encodeURIComponent(recordId)}?step=copy${qaFixture ? `&qa_fixture=${encodeURIComponent(qaFixture)}` : ''}#social-copy-gate`}
      >
        Review this record’s saved copy
      </a>
    </div>
  )
}
