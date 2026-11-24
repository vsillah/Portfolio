import { redirect } from 'next/navigation'
import { agentifiedCalendarDrafts } from '@/lib/agentified-calendar-drafts'

export const dynamic = 'force-dynamic'

export default async function AgentifiedCalendarRedirect({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string }>
}) {
  const { asset } = await searchParams
  const draft = agentifiedCalendarDrafts().find((item) => item.asset_id === asset)
  const focus = draft ? `&calendar_item=${encodeURIComponent(draft.id)}` : ''
  redirect(`/admin/agents/content-intelligence?section=calendar${focus}`)
}
