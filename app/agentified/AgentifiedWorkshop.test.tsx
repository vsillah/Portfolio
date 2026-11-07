import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AGENTIFIED_GUEST_KEY } from '@/lib/agentified-workshop'
import { AgentifiedWorkshop } from './AgentifiedWorkshop'

vi.mock('next/image', () => ({ default: ({ alt, src, priority: _priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string; priority?: boolean }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img alt={alt} src={src} {...props} />
) }))
vi.mock('next/link', () => ({ default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode; href: string }) => <a href={href} {...props}>{children}</a> }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: {
  getSession: vi.fn(async () => ({ data: { session: null } })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
} } }))

describe('Agentified Learning Plan cover and Operating File continuity', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState(null, '', '/agentified/learningplan')
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
  })

  it('shows each selected cover beside the editable file and retains guest work', async () => {
    const { container } = render(<AgentifiedWorkshop mode="plan" />)
    expect(await screen.findByRole('img', { name: /L01 Give the agent a job and a receipt lesson cover/ })).toHaveAttribute('src', '/agentified/posters/l01-poster.webp')
    expect(screen.getByText('Video locked')).toBeInTheDocument()
    expect(screen.queryByText('9–12 min')).not.toBeInTheDocument()
    expect(screen.getByText('Explore lesson diagram')).toBeInTheDocument()
    expect(container.querySelector('video')).toBeNull()
    fireEvent.change(container.querySelector('#answer-L01')!, { target: { value: 'A bounded job with a receipt.' } })
    fireEvent.click(screen.getByRole('button', { name: /Write the permission slip/ }))
    expect(screen.getByRole('img', { name: /L06 Write the permission slip lesson cover/ })).toHaveAttribute('src', '/agentified/posters/l06-poster.webp')
    expect(screen.getByRole('link', { name: /Open this page in the full file/ })).toHaveAttribute('href', '/agentified/operating-file#L06')
    fireEvent.click(screen.getByRole('button', { name: /Give the agent a job and a receipt/ }))
    expect(container.querySelector('#answer-L01')).toHaveValue('A bounded job with a receipt.')
    await waitFor(() => expect(JSON.parse(localStorage.getItem(AGENTIFIED_GUEST_KEY)!).worksheet.answers.L01).toBe('A bounded job with a receipt.'))
  })
})
