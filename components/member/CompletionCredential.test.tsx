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
    expect(preview).toHaveTextContent('Month DD, YYYY')
    expect(preview).toHaveTextContent('Building Smarter Products with AI')
    expect(preview).toHaveTextContent('AT-ACC-0000-0000')
    expect(preview).toHaveTextContent('Vambah Sillah')
    expect(preview).toHaveTextContent('Owner, AmaduTown · Author, Accelerated')
    expect(preview.querySelector('[class*="signatureLine"]')).toBeInTheDocument()
    expect(preview.querySelector('img[src*="vambah-signature.png"]')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'AmaduTown shield' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Name on certificate' }), { target: { value: 'Course Learner' } })
    expect(preview).toHaveTextContent('Course Learner')
    fireEvent.click(screen.getByRole('button', { name: 'Claim certificate' }))
    await waitFor(() => expect(screen.getByLabelText('Claimed Accelerated completion certificate')).toHaveTextContent('Course Learner'))
    expect(screen.queryByLabelText('Unclaimed Accelerated completion certificate preview')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download certificate' })).toBeEnabled()
  })

  it('prefills the editable certificate name from the signed-in member profile', async () => {
    render(<CompletionCredential profileName="Profile Member" />)
    const input = await screen.findByRole('textbox', { name: 'Name on certificate' })
    expect(input).toHaveValue('Profile Member')
    expect(screen.getByLabelText('Unclaimed Accelerated completion certificate preview')).toHaveTextContent('Profile Member')
    fireEvent.change(input, { target: { value: 'Preferred Certificate Name' } })
    expect(input).toHaveValue('Preferred Certificate Name')
    expect(screen.getByLabelText('Unclaimed Accelerated completion certificate preview')).toHaveTextContent('Preferred Certificate Name')
  })

  it('keeps the certificate absent at 15/16 with a lesson recovery link', async () => {
    window.history.pushState({}, '', '/member/dashboard?qa=completion-blocked')
    render(<CompletionCredential />)
    await screen.findByText('15 / 16 lessons')
    expect(screen.queryByLabelText(/completion certificate preview/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Claim certificate' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue lessons' })).toHaveAttribute('href', '/accelerated/learningplan')
  })

  it('uses the approved fixed-ratio certificate frame inside the themed member card', () => {
    const css = readFileSync('components/member/CompletionCredential.module.css', 'utf8')
    for (const surface of ['.card', '.verificationPage', '.verificationCard']) expect(css).toContain(`:global(html.dark) ${surface}`)
    expect(css).toContain("url('/accelerated/certificate-frame.png')")
    expect(css).toContain('aspect-ratio: 1424 / 1104')
    expect(css).toContain('container-type: inline-size')
    expect(css).toContain('var(--font-cormorant)')
    expect(css).not.toContain('.botanical')
    expect(css).not.toContain('.artwork:before')
    const component = readFileSync('components/member/CompletionCredential.tsx', 'utf8')
    expect(component).toContain("fetch('/accelerated/certificate-frame.png')")
    expect(component).toContain("fetch('/accelerated/vambah-signature.png')")
    expect(component).toContain('recordLabel(credential)')
    const config = readFileSync('next.config.js', 'utf8')
    expect(config).toContain("'./public/accelerated/certificate-frame.png'")
    expect(config).toContain("'./public/accelerated/vambah-signature.png'")
  })
})
