import { savedCopyRecoveryHref } from '@/lib/social-visual-contract-recovery'

type Props = { recordId: string; qaFixture?: string }

export default function SocialVisualContractRecovery({ recordId, qaFixture }: Props) {
  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs leading-5 text-muted-foreground" data-testid="saved-copy-visual-recovery">
      <p><strong className="text-foreground">Blocked:</strong> this saved backlog item has no current, version-bound visual contract. Its approved copy stays saved; visual approval and external actions remain pending.</p>
      <p><strong className="text-foreground">Recovery:</strong> review this item’s saved Copy gate and its own evidence before preparing a separate visual review contract. This link records no decision and changes no binding.</p>
      <a className="inline-flex min-h-11 max-w-full items-center rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-radiant-gold/60" href={savedCopyRecoveryHref(recordId, qaFixture)}>
        Review this record’s saved copy
      </a>
    </div>
  )
}
