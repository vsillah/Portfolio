import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ServicePrototypePage from './page'

const route = vi.hoisted(() => ({ slug: 'accelerated-cohort', search: '' }))

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: route.slug }),
  useSearchParams: () => new URLSearchParams(route.search),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}))

vi.mock('next/image', () => ({
  default: ({ unoptimized: _unoptimized, priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean; priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

function open(slug: string, search = '') {
  cleanup()
  route.slug = slug
  route.search = search
  return render(<ServicePrototypePage />)
}

describe('service prototype entry', () => {
  beforeEach(() => {
    route.slug = 'accelerated-cohort'
    route.search = ''
  })

  it('opens the first view by default and clamps a requested view onto a real tab', () => {
    open('accelerated-cohort')
    expect(screen.getByRole('button', { name: 'Cohort home' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Your cohort workspace' })).toBeInTheDocument()

    open('accelerated-cohort', 'view=3')
    expect(screen.getByRole('button', { name: 'Learning plan' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Sixteen lessons. One decision file.' })).toBeInTheDocument()

    open('accelerated-cohort', 'view=9')
    expect(screen.getByRole('button', { name: 'Learning plan' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('heading', { name: 'Your cohort workspace' })).not.toBeInTheDocument()

    for (const search of ['view=0', 'view=foo', 'view=']) {
      open('accelerated-cohort', search)
      expect(screen.getByRole('button', { name: 'Cohort home' })).toHaveAttribute('aria-current', 'page')
    }

    open('missing-service', 'view=3')
    expect(screen.getByRole('heading', { name: 'Prototype unavailable' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to services' })).toHaveAttribute('href', '/services')
    expect(document.querySelector('[data-prototype]')).toBeNull()
  })

  it('blocks follow-up without consent and ignores a blank visitor question', () => {
    open('ai-lead-chatbot', 'view=2')
    fireEvent.click(screen.getByRole('button', { name: /Taylor Reed/ }))
    expect(screen.getByRole('button', { name: 'Assign human follow-up' })).toBeDisabled()
    expect(screen.getByText(/wait for the visitor to opt in/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Morgan Ellis/ }))
    expect(screen.getByRole('button', { name: 'Assign human follow-up' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Assign human follow-up' }))
    expect(screen.getByText('Handoff recorded for review')).toBeInTheDocument()

    open('ai-lead-chatbot', 'view=9')
    expect(screen.getByRole('button', { name: 'Human handoff' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Human handoff' })).toBeInTheDocument()

    open('ai-lead-chatbot')
    const question = screen.getByRole('textbox', { name: 'Your question' })
    fireEvent.change(question, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.queryByText(/A team member can review this question/)).not.toBeInTheDocument()
    fireEvent.change(question, { target: { value: '  When does enrollment open?  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByText('When does enrollment open?')).toBeInTheDocument()
    expect(screen.getByText('Thanks. A team member can review this question with you.')).toBeInTheDocument()
    expect(question).toHaveValue('')
  })
})
