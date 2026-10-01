import type { ImgHTMLAttributes } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import StaffGuide from './StaffGuide'
import { guideSections } from './staff-guide-content'

// A plain image keeps the component test independent of Next image optimization.
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ priority: _priority, alt, ...props }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => <img alt={alt} {...props} /> }))
afterEach(() => { window.location.hash = ''; vi.restoreAllMocks() })

describe('staff onboarding', () => {
  it('opens with concise orientation and keeps deeper content collapsed', () => {
    const { container } = render(<StaffGuide />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A place to learn.')
    expect(container.querySelectorAll('details')).toHaveLength(6)
    expect(container.querySelectorAll('details[open]')).toHaveLength(0)
    expect(screen.getByRole('link', { name: /Start your first week/ })).toHaveAttribute('href', '#first-week')
    expect(screen.getByRole('link', { name: 'Print / Save as PDF' })).toHaveAttribute('href', '/help/staff/print')
  })
  it('opens a linked section on direct arrival and subsequent hash navigation', () => {
    Element.prototype.scrollIntoView = vi.fn()
    window.location.hash = '#tool-map'
    const { container } = render(<StaffGuide />)
    expect(container.querySelector('#tool-map')).toHaveAttribute('open')
    window.location.hash = '#first-week'
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(container.querySelector('#first-week')).toHaveAttribute('open')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })
  it('reopens the first-week section when its anchor is already selected', () => {
    const { container } = render(<StaffGuide />)
    window.location.hash = '#first-week'
    container.querySelector<HTMLDetailsElement>('#first-week')!.open = false
    fireEvent.click(screen.getByRole('link', { name: /Start your first week/ }))
    expect(container.querySelector('#first-week')).toHaveAttribute('open')
  })
  it('includes all sections in print and invokes only the browser print action', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const { container } = render(<StaffGuide printMode />)
    expect(container.querySelectorAll('details')).toHaveLength(0)
    guideSections.forEach(section => expect(container.querySelector(`#${section.id}`)).toBeInTheDocument())
    expect(screen.getAllByRole('checkbox')).toHaveLength(15)
    fireEvent.click(screen.getByRole('button', { name: 'Print / Save as PDF' }))
    expect(print).toHaveBeenCalledOnce()
  })
  it('expands collapsed content for native print, then restores the reader state', () => {
    const { container } = render(<StaffGuide />)
    container.querySelector('details')!.open = true
    fireEvent(window, new Event('beforeprint'))
    expect(container.querySelectorAll('details[open]')).toHaveLength(6)
    fireEvent(window, new Event('afterprint'))
    expect(container.querySelectorAll('details[open]')).toHaveLength(1)
  })
  it('provides useful practice checkboxes and capability limits without execution controls', () => {
    render(<StaffGuide printMode />)
    const task = screen.getByRole('checkbox', { name: /Day 1: Confirm your supervisor/ })
    fireEvent.click(task)
    expect(task).toBeChecked()
    expect(screen.getByText(/This guide grants no account access/)).toBeInTheDocument()
    expect(screen.getByText(/offline, synthetic comparison harness/)).toBeInTheDocument()
    expect(screen.getByText(/not a live service-status report/)).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
  it('is reachable from both existing Help entry points', () => {
    for (const file of ['app/help/page.tsx', 'app/admin/help/page.tsx']) {
      expect(readFileSync(file, 'utf8')).toContain('href="/help/staff"')
    }
  })
})
