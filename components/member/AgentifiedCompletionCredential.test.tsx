import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AgentifiedCompletionCredential from './AgentifiedCompletionCredential'
import { agentifiedCertificateSvg, certificateRecordId } from './agentified-certificate-artwork'

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } } }))

beforeEach(() => window.history.pushState({}, '', '/member/dashboard?qa=agentified-credential'))
afterEach(() => { cleanup(); window.history.pushState({}, '', '/') })

describe('Agentified certificate', () => {
  it('previews the named certificate and claims with the existing preview path', async () => {
    render(<AgentifiedCompletionCredential profileName="Course Learner" preview />)
    const preview = await screen.findByRole('img', { name: 'Unclaimed Agentified completion certificate preview' })
    expect(preview).toHaveTextContent('Certificate of Completion')
    expect(preview).toHaveTextContent('Course Learner')
    expect(preview).toHaveTextContent('AGENTIFIED')
    fireEvent.change(screen.getByRole('textbox', { name: 'Name on certificate' }), { target: { value: 'Amina Example' } })
    fireEvent.click(screen.getByRole('button', { name: 'Claim certificate' }))
    await waitFor(() => expect(screen.getByRole('img', { name: 'Claimed Agentified completion certificate for Amina Example' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Download certificate' })).toBeEnabled()
    expect(screen.getAllByText(/AT-AGT-[0-9A-F]{16}/)).toHaveLength(2)
  })

  it('blocks claiming before all lessons and links to the learning plan', async () => {
    window.history.pushState({}, '', '/member/dashboard?qa=agentified-credential&certificate=blocked')
    render(<AgentifiedCompletionCredential preview />)
    await screen.findByText('15 / 16 lessons')
    expect(screen.queryByRole('button', { name: 'Claim certificate' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue lessons' })).toHaveAttribute('href', '/agentified/learningplan')
  })

  it('shows claimed, verified, revoked, and long-name synthetic states without live links', async () => {
    for (const scene of ['claimed', 'verified', 'revoked', 'long-name']) {
      window.history.pushState({}, '', `/member/dashboard?qa=agentified-credential&certificate=${scene}`)
      const view = render(<AgentifiedCompletionCredential preview />)
      const image = await screen.findByRole('img', { name: /Claimed Agentified completion certificate/ })
      expect(image).toHaveTextContent(scene === 'verified' ? 'Active · AT-AGT-' : 'Verification link off')
      expect(screen.queryByRole('link', { name: 'View verification' })).not.toBeInTheDocument()
      view.unmount()
    }
  })

  it('updates preview verification state without touching the credential API', async () => {
    window.history.pushState({}, '', '/member/dashboard?qa=agentified-credential&certificate=claimed')
    render(<AgentifiedCompletionCredential preview />)
    await screen.findByRole('button', { name: 'Create verification link' })
    fireEvent.click(screen.getByRole('button', { name: 'Create verification link' }))
    expect(screen.getByRole('img', { name: /Claimed Agentified completion certificate/ })).toHaveTextContent('Active · AT-AGT-')
    fireEvent.click(screen.getByRole('button', { name: 'Turn off verification link' }))
    expect(screen.getByRole('img', { name: /Claimed Agentified completion certificate/ })).toHaveTextContent('Verification link off')
  })

  it('keeps token and markup out of the vector artifact', () => {
    const credential = { learner_name: '<Amina & Team>', completed_at: '2026-11-05T12:00:00.000Z', verification_token: 'f'.repeat(64) }
    const svg = agentifiedCertificateSvg(credential, '')
    expect(svg).toContain('&lt;Amina &amp; Team&gt;')
    expect(svg).not.toContain(credential.verification_token)
    expect(svg).toContain('width="1600" height="1100"')
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"')
    expect(certificateRecordId(credential)).toEqual(certificateRecordId({ ...credential, verification_token: null }))
    expect(svg).toContain('NOT PROFESSIONAL ACCREDITATION')
  })
})
