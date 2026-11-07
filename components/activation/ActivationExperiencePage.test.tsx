import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ActivationExperiencePage from './ActivationExperiencePage'
import { activationExperiences, adultConsent } from '@/lib/app-activation-experience'

const auth = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: auth.getSession } } }))

const props = { app: activationExperiences['trumpet-trainer'], intakeEnabled: false, redemptionEnabled: false, handoffEnabled: false, returnUrl: null }

describe('adult activation page', () => {
  beforeEach(() => { vi.restoreAllMocks(); auth.getSession.mockReset().mockResolvedValue({ data: { session: null } }); window.history.replaceState(null, '', '/activate/trumpet-trainer') })
  it('shows versioned consent and fails closed without any submission', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(<ActivationExperiencePage {...props} />)
    expect(screen.getByText(adultConsent.statement)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'I confirm I am an adult.' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /I agree to the contact statement/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send interest for review' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Continue to app' })).toBeDisabled()
    expect(screen.getByText(/Tester activation is closed for now/)).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
  it('strips an invitation fragment from the address bar without rendering the token', async () => {
    const token = 'SYNTHETIC_INVITATION_MATERIAL_01234567890123456789'
    window.history.replaceState(null, '', `/activate/trumpet-trainer#invite=${token}`)
    const { container } = render(<ActivationExperiencePage {...props} />)
    await waitFor(() => expect(window.location.hash).toBe(''))
    expect(container.textContent).not.toContain(token)
    expect(screen.getByRole('button', { name: 'Accept invitation' })).toBeDisabled()
  })
  it('binds the exact consent version in an enabled interest request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 202 }))
    render(<ActivationExperiencePage {...props} intakeEnabled />)
    expect(screen.getByRole('checkbox', { name: 'I confirm I am an adult.' })).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'adult@example.test' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'I confirm I am an adult.' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the contact statement/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Send interest for review' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, request] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/activation/interest')
    expect(JSON.parse(String(request?.body))).toMatchObject({ appKey: 'trumpet-trainer', consentVersion: adultConsent.version, adultConfirmed: true, consentGranted: true })
  })
  it('sends a synthetic invitation only to the first-party redemption route and handles replay safely', async () => {
    const token = 'SYNTHETIC_INVITATION_MATERIAL_01234567890123456789'
    window.history.replaceState(null, '', `/activate/trumpet-trainer#invite=${token}`)
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'synthetic-session' } } })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }))
    const { container } = render(<ActivationExperiencePage {...props} redemptionEnabled />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'I confirm I am an adult.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/invalid, expired, or already used/))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/activation/redeem')
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toMatchObject({ appKey: 'trumpet-trainer', token, adultConfirmed: true })
    expect(container.textContent).not.toContain(token)
    expect(window.location.hash).toBe('')
  })
  it('keeps app handoff closed without a reviewed return URL and secret', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(<ActivationExperiencePage {...props} handoffEnabled={false} />)
    expect(screen.getByRole('button', { name: 'Continue to app' })).toBeDisabled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
