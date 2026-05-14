import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AdminSidebar from './AdminSidebar'
import { ADMIN_NAV, isNavItemActive } from '@/lib/admin-nav'

const usePathnameMock = vi.fn(() => '/admin/agents/runs/run-1')

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}))

describe('AdminSidebar Agent Ops hierarchy', () => {
  it('moves Agent Ops routes into a dedicated sidebar section', () => {
    render(<AdminSidebar />)

    const nav = screen.getByRole('navigation', { name: 'Admin navigation' })
    expect(within(nav).getByText('Agent Ops')).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Mission Control' })).toHaveAttribute('href', '/admin/agents')
    expect(within(nav).getByRole('link', { name: 'Standup Room' })).toHaveAttribute('href', '/admin/agents/standup')
    expect(within(nav).getByRole('link', { name: 'Decision Queue' })).toHaveAttribute('href', '/admin/agents/coordination')
    expect(within(nav).getByRole('link', { name: 'Agent Kanban' })).toHaveAttribute('href', '/admin/agents/swarm-board')
    expect(within(nav).getByRole('link', { name: 'Run Console' })).toHaveAttribute('href', '/admin/agents/runs')
    expect(within(nav).getByRole('link', { name: 'Automation Context' })).toHaveAttribute('href', '/admin/agents/automations')
    expect(within(nav).getByRole('link', { name: 'Open Brain' })).toHaveAttribute('href', '/admin/agents/open-brain')
  })

  it('removes Agent Ops routes from Quality & insights nav config', () => {
    const qualityCategory = ADMIN_NAV.categories.find((category) => category.label === 'Quality & insights')
    const agentOpsCategory = ADMIN_NAV.categories.find((category) => category.label === 'Agent Ops')

    expect(qualityCategory?.items.map((item) => item.href)).not.toContain('/admin/agents')
    expect(agentOpsCategory?.items.map((item) => item.href)).toEqual([
      '/admin/agents',
      '/admin/agents/standup',
      '/admin/agents/coordination',
      '/admin/agents/swarm-board',
      '/admin/agents/runs',
      '/admin/agents/automations',
      '/admin/agents/open-brain',
    ])
  })

  it('keeps nested run detail routes active under Run Console, not Mission Control', () => {
    expect(isNavItemActive('/admin/agents/runs', '/admin/agents/runs/run-1')).toBe(true)
    expect(isNavItemActive('/admin/agents', '/admin/agents/runs/run-1')).toBe(false)
  })
})
