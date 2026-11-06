import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import CompletionCredential from './CompletionCredential'

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } } }))
vi.mock('next/image', () => ({ default: ({ alt, ...props }: { alt: string }) => <img alt={alt} {...props} /> }))

beforeEach(() => { vi.stubEnv('NODE_ENV', 'development'); window.history.pushState({}, '', '/member/dashboard?qa=completion-ready') })
afterEach(() => { cleanup(); vi.unstubAllEnvs(); window.history.pushState({}, '', '/') })

describe('Accelerated completion certificate', () => {
  it('shows the actual unclaimed certificate layout at 16/16 and turns it into a claimed certificate', async () => {
    render(<CompletionCredential />)
    const preview = await screen.findByLabelText('Unclaimed Accelerated completion certificate preview')
    expect(preview).toHaveTextContent('Certificate of Completion')
    expect(preview).toHaveTextContent('Your name')
    expect(preview).toHaveTextContent('Completion date added when claimed')
    expect(screen.getByRole('img', { name: 'AmaduTown shield' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Name on certificate' }), { target: { value: 'Course Learner' } })
    expect(preview).toHaveTextContent('Course Learner')
    fireEvent.click(screen.getByRole('button', { name: 'Claim certificate' }))
    await waitFor(() => expect(screen.getByLabelText('Claimed Accelerated completion certificate')).toHaveTextContent('Course Learner'))
    expect(screen.queryByLabelText('Unclaimed Accelerated completion certificate preview')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download certificate' })).toBeEnabled()
  })

  it('keeps the certificate absent at 15/16 with a lesson recovery link', async () => {
    window.history.pushState({}, '', '/member/dashboard?qa=completion-blocked')
    render(<CompletionCredential />)
    await screen.findByText('15 / 16 lessons')
    expect(screen.queryByLabelText(/completion certificate preview/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Claim certificate' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue lessons' })).toHaveAttribute('href', '/accelerated/learningplan')
  })

  it('uses the Accelerated html.dark theme boundary for all certificate surfaces', () => {
    const css = readFileSync('components/member/CompletionCredential.module.css', 'utf8')
    for (const surface of ['.card', '.verificationPage', '.verificationCard']) expect(css).toContain(`:global(html.dark) ${surface}`)
    expect(css).toContain('--certificate-surface:#f8f5e9')
    expect(css).toContain('--certificate-surface:#112a3a')
    expect(css).toContain('background:var(--certificate-surface)')
    expect(css).toContain('color:var(--certificate-ink)')
  })
})
