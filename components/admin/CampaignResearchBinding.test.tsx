import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CampaignResearchBinding from './CampaignResearchBinding'
import type { AgentWorkItem } from '@/lib/agent-work-items'
import type { ResearchCalendarTarget } from '@/lib/campaign-research-targets'
const packets = [{ id: 'p1', title: 'Usable public pattern', source_url: 'https://example.com/framework', status: 'review_ready', pattern_status: 'usable_framework', pattern_packet: { hook: 'A question' }, updated_at: '2026-10-06T00:00:00Z' }, { id: 'p2', title: 'Already approved pattern', source_url: 'https://example.com/second', status: 'approved', pattern_status: 'usable_framework', pattern_packet: { hook: 'An observation' }, updated_at: '2026-10-06T00:00:00Z' }]
const targets = Array.from({ length: 14 }, (_, i) => ({ id: `w${i}`, title: `Handoff ${i}`, source_type: 'social_content_calendar_authorization', metadata: { campaign_id: 'campaign', campaign_name: 'Readiness Challenge', calendar_item_id: `c${i}`, social_content_id: `s${i}`, channel: 'linkedin', campaign_phase: 'teach', scheduled_for: '2026-10-08', draft_handoff_only: true, research_packet_ids: [] } } as unknown as AgentWorkItem))
const calendar = targets.map((t, i) => ({ id: `c${i}`, campaign_id: 'campaign', social_content_id: `s${i}`, channel: 'linkedin', campaign_phase: 'teach', authorization_status: 'authorized', metadata: { platform_draft_handoff: { work_item_id: t.id } } } as ResearchCalendarTarget))
const response = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))
function setup(fetcher = vi.fn((url: string) => response(url.includes('?source_type') ? { work_items: targets } : {})), c = calendar, ps = packets) {
 const reload = vi.fn(async () => {})
 render(<CampaignResearchBinding packets={ps} calendarItems={c} authedFetch={fetcher} onLinked={reload}/>); return { fetcher, reload }
}
async function select() {
 await screen.findByText(/14 handoffs shown/)
 fireEvent.click(screen.getByLabelText(/Usable public pattern/)); fireEvent.click(screen.getByLabelText(/Already approved pattern/))
 fireEvent.click(screen.getByLabelText(/^Handoff 0/)); fireEvent.click(screen.getByLabelText(/^Handoff 1Readiness/))
 fireEvent.change(screen.getByLabelText('Campaign evidence decision note'), { target: { value: 'Public structure only; no source copy.' } })
 fireEvent.click(screen.getByRole('button', { name: /Approve & link/ }))
}
describe('campaign evidence binding', () => {
 it('approves only selected review-ready packets then links multiple targets with an explicit note', async () => {
  const { fetcher } = setup(); await select()
  await screen.findByText(/2 packet\(s\) linked to 2 handoff/)
  const writes = fetcher.mock.calls.filter(c => !c[0].includes('?'))
  expect(writes.map(c => c[0])).toEqual(['/api/admin/social-content/intelligence/research-packets/p1/review', '/api/admin/agents/work-items/w0/research-packets', '/api/admin/agents/work-items/w1/research-packets'])
  expect(JSON.parse(String((writes[1] as unknown as [string, RequestInit])[1].body))).toEqual({ mode: 'link_approved', packet_ids: ['p1', 'p2'], decision_note: 'Public structure only; no source copy.' })
 })
 it('shows blocked packets and unauthorized handoffs with no enabled submit', async () => {
  setup(undefined, calendar.map(c => ({ ...c, authorization_status: 'pending' } as ResearchCalendarTarget)), [{ ...packets[0], pattern_status: 'too_close_to_source' }])
  await screen.findByText(/14 handoffs shown/)
  expect(screen.getByLabelText(/Usable public pattern/)).toBeDisabled()
  expect(screen.getByLabelText(/^Handoff 0/)).toBeDisabled()
  expect(screen.getByRole('button', { name: /Approve & link/ })).toBeDisabled()
 })
 it('shows empty and unauthorized recovery states', async () => {
  setup(vi.fn(() => response({ error: 'Unauthorized: sign in as admin' }, 401)), [], [])
  await screen.findByRole('alert'); expect(screen.getByText(/No campaign handoffs found/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Open the campaign calendar/ })).toBeInTheDocument()
 })
 it('reports partial completion and stops on an API failure', async () => {
  const fetcher = vi.fn((url: string) => response(url.includes('?source_type') ? { work_items: targets } : url.includes('/w1/') ? { error: 'Calendar changed' } : {}, url.includes('/w1/') ? 409 : 200))
  setup(fetcher); await select()
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('1 packet(s) approved; 1 handoff(s) linked before stopping. Calendar changed'))
 })
})
