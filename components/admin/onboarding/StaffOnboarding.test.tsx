import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StaffOnboarding from './StaffOnboarding'
import Page from '@/app/admin/help/onboarding/page'
import { sections } from '@/lib/staff-onboarding'

const mocks = vi.hoisted(() => ({ pdf: vi.fn(), protectedRoute: vi.fn() }))
vi.mock('@/lib/staff-onboarding-pdf', () => ({ generateStaffOnboardingPDFBlob: mocks.pdf }))
vi.mock('@/components/ProtectedRoute', () => ({ default: (props: { requireAdmin: boolean; children: React.ReactNode }) => { mocks.protectedRoute(props.requireAdmin); return props.children } }))
vi.mock('next/image', () => ({ default: ({ alt }: { alt: string }) => <span>{alt}</span> }))

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/admin/help/onboarding')
  Element.prototype.scrollIntoView = vi.fn()
})

describe('staff onboarding', () => {
  it('retains the existing admin access gate', () => {
    render(<Page />)
    expect(mocks.protectedRoute).toHaveBeenCalledWith(true)
  })
  it('starts concise and opens the first-week step with keyboard focus', () => {
    const { container } = render(<StaffOnboarding />)
    expect(container.querySelectorAll('details[open]')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Start your first week' }))
    expect(container.querySelector('#week')).toHaveAttribute('open')
    expect(window.location.hash).toBe('#week')
    expect(document.activeElement).toBe(container.querySelector('#week summary'))
    const checks = screen.getAllByRole('checkbox')
    fireEvent.click(checks[0])
    expect(screen.getByText(/1 of 5 practice steps checked/)).toBeInTheDocument()
    fireEvent.click(checks[0])
    expect(screen.getByText(/0 of 5 practice steps checked/)).toBeInTheDocument()
  })
  it('opens a bookmarked section on load and when the hash changes', () => {
    window.history.replaceState(null, '', '#boundaries')
    const { container } = render(<StaffOnboarding />)
    expect(container.querySelector('#boundaries')).toHaveAttribute('open')
    window.history.replaceState(null, '', '#tools')
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(container.querySelector('#tools')).toHaveAttribute('open')
    expect(new Set(sections.map(section => section.id)).size).toBe(sections.length)
  })
  it('reports download failure and lets the reader retry', async () => {
    mocks.pdf.mockRejectedValue(new Error('offline'))
    render(<StaffOnboarding />)
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    await waitFor(() => expect(screen.getByText(/PDF could not be prepared/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled()
    expect(screen.getByRole('heading', { name: 'Welcome to your workspace' })).toBeVisible()
  })
  it('downloads the full static guide without submitting checklist or provider data', async () => {
    mocks.pdf.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }))
    URL.createObjectURL = vi.fn(() => 'blob:guide')
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<StaffOnboarding />)
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    await waitFor(() => expect(screen.getByText(/PDF prepared/)).toBeInTheDocument())
    expect(mocks.pdf).toHaveBeenCalledWith()
    expect(click).toHaveBeenCalledOnce()
    click.mockRestore()
  })
})
