'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { adultConsent, activationFailureMessage, classifyActivationResponse, type ActivationExperience, type ActivationFailure } from '@/lib/app-activation-experience'

type Props = { app: ActivationExperience; intakeEnabled: boolean; redemptionEnabled: boolean; handoffEnabled: boolean; returnUrl: string | null }

export default function ActivationExperiencePage({ app, intakeEnabled, redemptionEnabled, handoffEnabled, returnUrl }: Props) {
  const [email, setEmail] = useState('')
  const [adult, setAdult] = useState(false)
  const [consent, setConsent] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState<ActivationFailure | null>(null)
  const [redeemed, setRedeemed] = useState(false)
  const [hasInvitation, setHasInvitation] = useState(false)
  const tokenRef = useRef<string | null>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    // Invitation material stays in memory for this visit only. Remove it from the address bar
    // before presenting any UI, and never persist it across an Auth redirect.
    const fragment = window.location.hash.slice(1)
    const token = new URLSearchParams(fragment).get('invite')
    if (token) {
      tokenRef.current = token
      setHasInvitation(true)
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    return () => { tokenRef.current = null }
  }, [])

  useEffect(() => { if (message || failure) statusRef.current?.focus() }, [message, failure])

  async function submitInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!intakeEnabled || !adult || !consent || pending) return
    setPending(true); setFailure(null); setMessage('')
    try {
      const response = await fetch('/api/activation/interest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appKey: app.appKey, adultEmail: email, adultConfirmed: true, consentGranted: true, consentVersion: adultConsent.version, idempotencyKey: crypto.randomUUID(), sourceReceipt: app.sourceReceipt }),
      })
      if (response.ok) { setMessage('Your interest was recorded for review. No account or app access has been granted.'); setEmail(''); setConsent(false) }
      else setFailure(classifyActivationResponse(response.status))
    } catch { setFailure('unavailable') }
    finally { setPending(false) }
  }

  async function redeem() {
    if (!redemptionEnabled || !tokenRef.current || !adult || pending) return
    setPending(true); setFailure(null); setMessage('')
    try {
      const { data } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token
      if (!accessToken) { setFailure('auth'); return }
      const response = await fetch('/api/activation/redeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ appKey: app.appKey, token: tokenRef.current, adultConfirmed: true }),
      })
      if (response.ok) {
        tokenRef.current = null; setHasInvitation(false); setRedeemed(true)
        setMessage('Invitation accepted. Your adult account has access when the app handoff is enabled.')
      } else setFailure(classifyActivationResponse(response.status))
    } catch { setFailure('unavailable') }
    finally { setPending(false) }
  }

  async function continueToApp() {
    if (!handoffEnabled || !returnUrl || !adult || pending) return
    setPending(true); setFailure(null); setMessage('')
    try {
      const { data } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token
      if (!accessToken) { setFailure('auth'); return }
      const response = await fetch('/api/activation/handoff', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ appKey: app.appKey, returnUrl, adultConfirmed: true }),
      })
      if (!response.ok) { setFailure(classifyActivationResponse(response.status)); return }
      const result: unknown = await response.json()
      if (!result || typeof result !== 'object' || !('returnUrl' in result) || typeof result.returnUrl !== 'string') { setFailure('unavailable'); return }
      const target = new URL(result.returnUrl)
      if (target.protocol !== 'https:' || target.origin !== new URL(returnUrl).origin || !target.hash.startsWith('#activation_code=')) { setFailure('unavailable'); return }
      window.location.assign(target.toString())
    } catch { setFailure('unavailable') }
    finally { setPending(false) }
  }

  return <div className="mx-auto max-w-5xl px-5 pb-20 pt-32 sm:px-10 lg:px-12">
    <Link href={app.returnPath} className="text-sm font-semibold text-radiant-gold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-radiant-gold">Back to {app.name}</Link>
    <div className="mt-10 max-w-3xl"><p className="font-heading text-xs uppercase tracking-widest text-radiant-gold">Adult controlled access</p><h1 className="mt-4 font-premium text-4xl sm:text-5xl">Explore the {app.name} pilot.</h1><p className="mt-5 text-lg leading-8 text-muted-foreground">A small tester group starts with an adult decision. Review what contact means, then choose whether to express interest. An invitation is a separate step.</p></div>
    <div className="mt-10 grid min-w-0 gap-6 lg:grid-cols-[1.15fr_.85fr]">
      <section aria-labelledby="consent-heading" className="min-w-0 rounded-3xl border border-border bg-card p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-widest text-radiant-gold">Consent {adultConsent.version}</p><h2 id="consent-heading" className="mt-3 font-premium text-2xl">{adultConsent.title}</h2><p className="mt-4 leading-7 text-muted-foreground">{adultConsent.statement}</p><p className="mt-5 text-sm leading-6 text-muted-foreground">Contact consent is limited to this tester review. No child information, payment, or app account is requested here.</p></section>
      <section aria-labelledby="interest-heading" className="min-w-0 rounded-3xl border border-radiant-gold/30 bg-card p-6 sm:p-8"><h2 id="interest-heading" className="font-premium text-2xl">Express adult interest</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Interest goes to the Portfolio review queue when intake opens. It does not guarantee an invitation.</p>
        <form onSubmit={submitInterest} className="mt-6 space-y-5"><label className="block text-sm font-medium">Your email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={!intakeEnabled || pending} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground disabled:opacity-60" /></label>
          <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} disabled={(!intakeEnabled && !redemptionEnabled && !handoffEnabled) || pending} className="mt-1 h-5 w-5 shrink-0 accent-radiant-gold" /><span>I confirm I am an adult.</span></label>
          <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={!intakeEnabled} className="mt-1 h-5 w-5 shrink-0 accent-radiant-gold" /><span>I agree to the contact statement above, version {adultConsent.version}.</span></label>
          <button type="submit" disabled={!intakeEnabled || !adult || !consent || pending} className="min-h-12 w-full rounded-full bg-radiant-gold px-5 py-3 font-semibold text-imperial-navy disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-radiant-gold">{pending ? 'Please wait…' : 'Send interest for review'}</button>
        </form>{!intakeEnabled && <p className="mt-5 rounded-xl border border-border p-4 text-sm leading-6" role="status">{activationFailureMessage('disabled')}</p>}</section>
    </div>
    <section aria-labelledby="invite-heading" className="mt-6 rounded-3xl border border-border bg-card p-6 sm:p-8"><h2 id="invite-heading" className="font-premium text-2xl">Have an invitation?</h2><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Sign in with the adult email that received it, then open the one-time invitation link again. The invitation expires and can be used once.</p><div className="mt-5 flex flex-wrap gap-3">{redemptionEnabled && <Link href={`/auth/login?redirect=${encodeURIComponent(`/activate/${app.appKey}`)}`} className="inline-flex min-h-12 items-center rounded-full border border-radiant-gold px-5 py-3 font-semibold text-radiant-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-radiant-gold">Sign in as an adult</Link>}<button type="button" onClick={redeem} disabled={!redemptionEnabled || !hasInvitation || !adult || pending} className="min-h-12 rounded-full bg-radiant-gold px-5 py-3 font-semibold text-imperial-navy disabled:cursor-not-allowed disabled:opacity-50">Accept invitation</button><button type="button" onClick={continueToApp} disabled={!handoffEnabled || !adult || pending} className="min-h-12 rounded-full border border-radiant-gold px-5 py-3 font-semibold text-radiant-gold disabled:cursor-not-allowed disabled:opacity-50">Continue to app</button></div>
      {!hasInvitation && !redeemed && <p className="mt-4 text-sm text-muted-foreground">No invitation link is open. If yours has expired or was already used, ask the pilot team for help.</p>}
      {!handoffEnabled && <p className="mt-4 text-sm text-muted-foreground">App handoff is closed until the app is ready to receive adult access.</p>}
    </section>
    {(message || failure) && <p ref={statusRef} tabIndex={-1} role={failure ? 'alert' : 'status'} className="mt-6 rounded-xl border border-radiant-gold/40 bg-card p-4 leading-6 focus:outline-none">{failure ? activationFailureMessage(failure) : message}</p>}
  </div>
}
