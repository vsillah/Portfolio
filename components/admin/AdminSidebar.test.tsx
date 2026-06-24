import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminSidebar, { NAV_ITEM_ICONS } from './AdminSidebar'
import { ADMIN_NAV, isNavItemActive } from '@/lib/admin-nav'

const usePathnameMock = vi.fn(() => '/admin/agents/runs/run-1')

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}))

describe('AdminSidebar Agent Ops hierarchy', () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue('/admin/agents/runs/run-1')
  })

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
    expect(within(nav).getByRole('link', { name: 'Governance' })).toHaveAttribute('href', '/admin/agents/governance')
  })

  it('removes Agent Ops routes from Quality & insights nav config', () => {
    const qualityCategory = ADMIN_NAV.categories.find((category) => category.label === 'Quality & insights')
    const agentOpsCategory = ADMIN_NAV.categories.find((category) => category.label === 'Agent Ops')

    expect(qualityCategory?.items.map((item) => item.href)).not.toContain('/admin/agents')
    expect(agentOpsCategory?.items.map((item) => item.href)).toEqual([
      '/admin/agents',
      '/admin/agents/standup',
      '/admin/agents/coordination',
      '/admin/agents/content-intelligence',
      '/admin/agents/swarm-board',
      '/admin/agents/runs',
      '/admin/agents/automations',
      '/admin/agents/open-brain',
      '/admin/agents/governance',
    ])
  })

  it('keeps nested run detail routes active under Run Console, not Mission Control', () => {
    expect(isNavItemActive('/admin/agents/runs', '/admin/agents/runs/run-1')).toBe(true)
    expect(isNavItemActive('/admin/agents', '/admin/agents/runs/run-1')).toBe(false)
  })

  it('keeps Content Hub expanded and product management active for nested catalog routes', () => {
    usePathnameMock.mockReturnValue('/admin/content/products')

    render(<AdminSidebar />)

    const nav = screen.getByRole('navigation', { name: 'Admin navigation' })
    const productHubLink = within(nav)
      .getAllByRole('link', { name: 'Products' })
      .find((link) => link.getAttribute('href') === '/admin/products')

    expect(within(nav).getByRole('button', { name: /Content Hub/i })).toHaveAttribute('aria-current', 'page')
    expect(productHubLink).toHaveAttribute('aria-current', 'page')
    expect(isNavItemActive('/admin/products', '/admin/content/products')).toBe(true)
  })

  it('collapses inactive sidebar sections until the operator opens them', () => {
    render(<AdminSidebar />)

    const nav = screen.getByRole('navigation', { name: 'Admin navigation' })
    const agentOpsSection = within(nav).getByRole('button', { name: /Agent Ops/i })
    const pipelineSection = within(nav).getByRole('button', { name: /Pipeline/i })

    expect(agentOpsSection).toHaveAttribute('aria-expanded', 'true')
    expect(pipelineSection).toHaveAttribute('aria-expanded', 'false')
    expect(within(nav).queryByRole('link', { name: 'Lead Pipeline' })).not.toBeInTheDocument()

    fireEvent.click(pipelineSection)

    expect(pipelineSection).toHaveAttribute('aria-expanded', 'true')
    expect(within(nav).getByRole('link', { name: 'Lead Pipeline' })).toHaveAttribute('href', '/admin/outreach')
  })

  it('keeps every sidebar nav link mapped to an icon', () => {
    const navHrefs = ADMIN_NAV.categories.flatMap((category) => [
      ...category.items.map((item) => item.href),
      ...(category.children ?? []).map((item) => item.href),
    ])
    const missingIcons = [...new Set(navHrefs)].filter((href) => !NAV_ITEM_ICONS[href])

    expect(missingIcons).toEqual([])
  })
})
