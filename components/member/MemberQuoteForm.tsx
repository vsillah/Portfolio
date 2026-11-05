'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { projectQuoteOffers, quoteQuestions, type DerivedContext, type QuoteAnswers, type QuoteOffer,
  type QuoteDimension } from '@/lib/accelerated-quote-refinement'

type Question = typeof quoteQuestions[number]
type Context = { orderId: number; title: string; summary: string[]; derivedFacts: DerivedContext['facts'];
  questions: Question[]; offers: QuoteOffer[]; answers: QuoteAnswers; revision: number; refinementId: string | null; submitted?: boolean }

const synthetic: Context = {
  orderId: 1203, title: 'Custom implementation plan',
  summary: ['A priority decision is documented (L02)', 'An evidence gap is documented (L03)', 'Decision roles are documented (L09)'],
  derivedFacts: { audience: { value: 'small_team', sourceField: 'L09' } },
  questions: quoteQuestions.filter((q) => ['delivery', 'timeline', 'implementation', 'budget', 'support'].includes(q.id)),
  offers: [
    { kind: 'service', id: 's1', title: 'Custom implementation plan', price: null, quoteBased: true, deliveryMethod: 'virtual', reviewedRecommendationId: 'r1' },
    { kind: 'service', id: 's2', title: 'In-person strategy workshop', price: 1800, quoteBased: false, deliveryMethod: 'in-person' },
    { kind: 'product', id: 'p1', title: 'Self-guided toolkit', price: 199, quoteBased: false, productType: 'digital' },
  ], answers: {}, revision: 0, refinementId: null,
}

export default function MemberQuoteForm() {
  const [context, setContext] = useState<Context | null>(null)
  const [answers, setAnswers] = useState<QuoteAnswers>({})
  const [savedAnswers, setSavedAnswers] = useState<QuoteAnswers>({})
  const [revision, setRevision] = useState(0)
  const [refinementId, setRefinementId] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'sending' | 'sent' | 'error'>('loading')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (process.env.NODE_ENV === 'development' && params.get('qa') === 'quote') {
      setPreview(true); setContext(synthetic); setStatus('ready'); return
    }
    const orderId = Number(params.get('orderId'))
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      setError('Open a reviewed quote request from your member dashboard.'); setStatus('error'); return
    }
    let active = true
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (!session) throw new Error('Sign in to continue your quote request.')
      const response = await fetch(`/api/accelerated/member/quotes/refine?orderId=${orderId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store',
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Your quote request could not be loaded.')
      if (!active) return
      setContext(result); setAnswers(result.answers); setSavedAnswers(result.answers)
      setRevision(result.revision); setRefinementId(result.refinementId); setStatus(result.submitted ? 'sent' : 'ready')
    })().catch((reason) => { if (active) { setError(reason instanceof Error ? reason.message : 'Quote request unavailable.'); setStatus('error') } })
    return () => { active = false }
  }, [])

  const projection = useMemo(() => context && projectQuoteOffers(context.offers,
    { facts: context.derivedFacts, summary: context.summary, sourceFields: [] }, answers,
    context.questions.map((q) => q.id)), [context, answers])
  const dirty = JSON.stringify(answers) !== JSON.stringify(savedAnswers)

  async function save() {
    if (!context || preview) return
    setStatus('saving'); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sign in again to save your answers.')
      const response = await fetch('/api/accelerated/member/quotes/refine', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ orderId: context.orderId, answers, expectedRevision: revision, idempotencyKey: crypto.randomUUID() }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Quote context could not be saved.')
      setSavedAnswers({ ...answers }); setRevision(result.revision); setRefinementId(result.refinementId)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Quote context could not be saved.') }
    setStatus('ready')
  }

  async function send() {
    if (!context || !refinementId || dirty || preview || projection?.status === 'no_match') return
    setStatus('sending'); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sign in again to send your quote request.')
      const response = await fetch('/api/accelerated/member/quotes/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ orderId: context.orderId, refinementId }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Quote request could not be sent.')
      setStatus('sent')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Quote request could not be sent.'); setStatus('ready') }
  }

  return <section className="mx-auto max-w-4xl px-4 py-10 text-platinum-white sm:px-6 sm:py-16">
    <Link className="mb-8 inline-flex min-h-11 items-center text-sm text-radiant-gold underline" href="/member/dashboard">Back to member dashboard</Link>
    <p className="text-xs font-semibold uppercase tracking-widest text-radiant-gold">Accelerated · reviewed recommendation</p>
    <h1 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">Shape your quote request</h1>
    <p className="mt-3 max-w-2xl text-platinum-white/75">Your Decision File and reviewed recommendation are already connected. Answer only what is still needed to guide an operator review. No payment is due.</p>
    {status === 'loading' && <p className="mt-8" role="status">Loading your quote context…</p>}
    {status === 'error' && <div className="mt-8 rounded-lg border border-amber-400/40 p-5" role="alert">
      <p>{error}</p><Link className="mt-3 inline-block text-radiant-gold underline" href="/member/dashboard">Open member dashboard</Link>
    </div>}
    {context && <>
      <div className="mt-8 rounded-lg border border-radiant-gold/30 bg-silicon-slate/40 p-5">
        <p className="text-sm text-platinum-white/65">Quote request #{context.orderId} · operator-reviewed service</p>
        <p className="mt-1 text-lg font-semibold">{context.title}</p>
        <p className="mt-2 text-sm text-platinum-white/75">We keep the reviewed recommendation visible while checking other active catalog options. Any alternative needs operator review.</p>
      </div>
      <div className="mt-6 rounded-lg border border-white/15 p-5">
        <h2 className="font-heading text-xl font-semibold">Already in your Decision File</h2>
        <p className="mt-1 text-sm text-platinum-white/70">We use the submitted version as context. Your private worksheet text stays out of this screen.</p>
        {context.summary.length ? <ul className="mt-3 list-inside list-disc space-y-1 text-sm">{context.summary.map((item) => <li key={item}>{item}</li>)}</ul>
          : <p className="mt-3 text-sm text-amber-200">The file has limited decision context. Your answers below will need operator review.</p>}
        {Object.entries(context.derivedFacts).map(([dimension, fact]) => fact && <p key={dimension} className="mt-2 text-sm text-platinum-white/80">{dimension}: {fact.value.replaceAll('_', ' ')} · source {fact.sourceField}</p>)}
      </div>
      {status === 'sent' ? <div className="mt-6 rounded-lg border border-green-400/40 p-5" role="status">
        <p>Your context is saved with quote order #{context.orderId}. An operator will review the fit and scope before sharing a price.</p>
        <Link className="mt-3 inline-block text-radiant-gold underline" href="/member/dashboard">Back to member dashboard</Link>
      </div> : <>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {context.questions.map((question) => <fieldset key={question.id} className="rounded-lg border border-white/20 p-4">
            <legend className="px-1 font-semibold">{question.label}</legend>
            <div className="mt-2 flex flex-wrap gap-2">{question.options.map(([value, label]) => <label key={value} className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${answers[question.id] === value ? 'border-radiant-gold bg-radiant-gold/20' : 'border-white/25'}`}>
              <input type="radio" name={question.id} value={value} checked={answers[question.id] === value}
                onChange={() => setAnswers((current) => ({ ...current, [question.id]: value }))} className="mr-2 accent-radiant-gold" />{label}
            </label>)}</div>
          </fieldset>)}
        </div>
        <div className="mt-8 rounded-lg border border-white/20 p-5" aria-live="polite">
          <h2 className="font-heading text-xl font-semibold">Current fit</h2>
          {projection?.status === 'no_match' ? <p className="mt-2 text-amber-200">No catalog option fits these choices. Adjust an answer or return to your dashboard and ask for operator review.</p>
            : <p className="mt-2 text-sm text-platinum-white/75">{projection?.remaining.length ?? 0} possible options · {projection?.excluded.length ?? 0} fell away. {projection?.needsOperatorReview ? 'An operator must confirm fit.' : 'Ready for operator scope review.'}</p>}
          {projection?.unanswered.length ? <p className="mt-2 text-sm text-amber-200">Still useful to answer: {projection.unanswered.join(', ').replaceAll('_', ' ')}. “Not sure” is okay; an operator will resolve it.</p> : null}
          <ul className="mt-4 space-y-3">{projection?.remaining.slice(0, 5).map((offer) => <li key={`${offer.kind}:${offer.id}`} className="rounded-md border border-white/15 p-3 text-sm">
            <p className="font-semibold">{offer.title} {offer.reviewedRecommendationId ? <span className="text-radiant-gold">· reviewed</span> : <span className="text-amber-200">· operator review needed</span>}</p>
            <p className="mt-1 text-platinum-white/70">{offer.reasons.join('; ')}</p>
          </li>)}</ul>
          {projection && projection.remaining.length > 5 ? <p className="mt-2 text-sm text-platinum-white/65">+{projection.remaining.length - 5} more active catalog options for operator review</p> : null}
          {projection?.excluded.length ? <details className="mt-4 text-sm"><summary className="cursor-pointer text-radiant-gold">Why {projection.excluded.length} options fell away</summary>
            <ul className="mt-2 space-y-2">{projection.excluded.slice(0, 10).map((offer) => <li key={`${offer.kind}:${offer.id}`}>{offer.title}: {offer.reasons.join('; ')}</li>)}</ul>
          </details> : null}
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-amber-200">{error}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => void save()} disabled={preview || status !== 'ready' || !dirty && !!refinementId}
            className="min-h-11 rounded-md border border-radiant-gold px-5 py-3 font-semibold text-radiant-gold disabled:opacity-50">{preview ? 'Preview only' : status === 'saving' ? 'Saving…' : 'Save context'}</button>
          <button type="button" onClick={() => void send()} disabled={preview || status !== 'ready' || dirty || !refinementId || projection?.status === 'no_match'}
            className="min-h-11 rounded-md bg-radiant-gold px-5 py-3 font-semibold text-imperial-navy disabled:opacity-50">{status === 'sending' ? 'Sending…' : 'Send for operator review'}</button>
        </div>
        <p className="mt-3 text-sm text-platinum-white/65">Saving records your choices on this quote order. Sending creates an internal review request; it does not change your recommendation, start a project, or charge you.</p>
      </>}
    </>}
  </section>
}
