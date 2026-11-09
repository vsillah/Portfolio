'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import ProductCard from '@/components/ProductCard'
import ServiceCard from '@/components/ServiceCard'
import { addServiceToCart, addToCart, getCartCount } from '@/lib/cart'
import type { Product, Service } from '@/lib/types/store'
import { supabase } from '@/lib/supabase'
import { projectQuoteOffers, quoteQuestions, type DerivedContext, type QuoteAnswers, type QuoteOffer,
  type QuoteDimension } from '@/lib/accelerated-quote-refinement'

type Question = typeof quoteQuestions[number]
type Context = { orderId: number; workshop?: 'accelerated' | 'agentified'; title: string; summary: string[]; derivedFacts: DerivedContext['facts'];
  questions: Question[]; offers: QuoteOffer[]; answers: QuoteAnswers; revision: number; refinementId: string | null; submitted?: boolean;
  reviewedOfferId: string; requestedOfferId: string }

export const synthetic: Context = {
  orderId: 1203, title: 'Custom implementation plan',
  summary: ['A priority decision is documented (L02)', 'An evidence gap is documented (L03)', 'Decision roles are documented (L09)'],
  derivedFacts: { audience: { value: 'small_team', sourceField: 'L09' } },
  questions: quoteQuestions.filter((q) => ['delivery', 'timeline', 'implementation', 'budget', 'support'].includes(q.id)),
  offers: [
    { kind: 'service', id: '11111111-1111-4111-8111-111111111111', title: 'Custom implementation plan', price: null, quoteBased: true, deliveryMethod: 'virtual', reviewedRecommendationId: 'r1', catalog: {
      id: '11111111-1111-4111-8111-111111111111', title: 'Custom implementation plan', description: 'A scoped implementation plan with direct guidance for your team.', service_type: 'consulting', delivery_method: 'virtual', duration_hours: null, duration_description: 'Scope set after review', price: null, is_quote_based: true, min_participants: 1, max_participants: null, image_url: '/showcases/gallery-accelerated-cohort-outcome.svg', video_url: null, video_thumbnail_url: null, presentation_url: null, is_featured: false } },
    { kind: 'service', id: '22222222-2222-4222-8222-222222222222', title: 'In-person strategy workshop', price: 1800, quoteBased: false, deliveryMethod: 'in_person', catalog: {
      id: '22222222-2222-4222-8222-222222222222', title: 'In-person strategy workshop', description: 'A facilitated working session to set priorities.', service_type: 'workshop', delivery_method: 'in_person', duration_hours: 4, duration_description: 'Half day', price: 1800, is_quote_based: false, min_participants: 2, max_participants: 20, image_url: '/ATAS_Innovation_Workshop.webp', video_url: null, video_thumbnail_url: null, presentation_url: null, is_featured: false } },
    { kind: 'service', id: '33333333-3333-4333-8333-333333333333', title: 'Custom coaching support', price: null, quoteBased: true, deliveryMethod: 'virtual', catalog: {
      id: '33333333-3333-4333-8333-333333333333', title: 'Custom coaching support', description: 'Direct support for a team working through a decision.', service_type: 'coaching', delivery_method: 'virtual', duration_hours: null, duration_description: 'Scope set after review', price: null, is_quote_based: true, min_participants: 1, max_participants: null, image_url: '/showcases/service-self-paced-course-concept.svg', video_url: null, video_thumbnail_url: null, presentation_url: null, is_featured: false } },
    { kind: 'product', id: '903', title: 'Self-guided toolkit', price: 199, quoteBased: false, productType: 'digital', catalog: {
      id: 903, title: 'Self-guided toolkit', description: 'Templates and prompts to move from decision to action.', type: 'digital', price: 199, image_url: '/accelerated_cover_ebook.webp', is_featured: false } },
  ], answers: {}, revision: 0, refinementId: null,
  reviewedOfferId: '11111111-1111-4111-8111-111111111111', requestedOfferId: '11111111-1111-4111-8111-111111111111',
}

const draftKey = (id: number) => `accelerated-quote-draft:${id}`

export default function MemberQuoteForm() {
  const [context, setContext] = useState<Context | null>(null)
  const [answers, setAnswers] = useState<QuoteAnswers>({})
  const [savedAnswers, setSavedAnswers] = useState<QuoteAnswers>({})
  const [revision, setRevision] = useState(0)
  const [refinementId, setRefinementId] = useState<string | null>(null)
  const [requestedOfferId, setRequestedOfferId] = useState('')
  const [savedRequestedOfferId, setSavedRequestedOfferId] = useState('')
  const [cartCount, setCartCount] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'sending' | 'sent' | 'error'>('loading')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (process.env.NODE_ENV === 'development' && params.get('qa') === 'quote') {
      setPreview(true); setContext(synthetic); setCartCount(getCartCount());
      const draft = readDraft(synthetic.orderId, synthetic.revision, synthetic)
      setAnswers(draft.answers); setRequestedOfferId(draft.requestedOfferId)
      setSavedRequestedOfferId(synthetic.requestedOfferId); setStatus('ready'); return
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
      const draft = readDraft(orderId, result.revision, result)
      setContext(result); setAnswers(draft.answers); setSavedAnswers(result.answers)
      setRequestedOfferId(draft.requestedOfferId); setSavedRequestedOfferId(result.requestedOfferId); setCartCount(getCartCount())
      setRevision(result.revision); setRefinementId(result.refinementId); setStatus(result.submitted ? 'sent' : 'ready')
    })().catch((reason) => { if (active) { setError(reason instanceof Error ? reason.message : 'Quote request unavailable.'); setStatus('error') } })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (context && status !== 'sent' && status !== 'loading') sessionStorage.setItem(draftKey(context.orderId), JSON.stringify({ revision, answers, requestedOfferId }))
  }, [context, status, revision, answers, requestedOfferId])

  const projection = useMemo(() => context && projectQuoteOffers(context.offers,
    { facts: context.derivedFacts, summary: context.summary, sourceFields: [] }, answers,
    context.questions.map((q) => q.id)), [context, answers])
  const dirty = JSON.stringify(answers) !== JSON.stringify(savedAnswers) || requestedOfferId !== savedRequestedOfferId
  const reviewed = context?.offers.find((offer) => offer.kind === 'service' && offer.id === context.reviewedOfferId)
  const alternatives = (showAll ? context?.offers : projection?.remaining)?.filter((offer) => offer.id !== context?.reviewedOfferId) ?? []
  const detailHref = (offer: QuoteOffer) => `/${offer.kind === 'product' ? 'store' : 'services'}/${encodeURIComponent(offer.id)}?fromQuote=${preview ? 'qa' : context?.orderId}`
  const addProduct = (id: number) => { addToCart(id); setCartCount(getCartCount()) }
  const addService = (id: string) => { addServiceToCart(id); setCartCount(getCartCount()) }
  const requestQuote = (id: string) => {
    if (id !== context?.reviewedOfferId && projection?.excluded.some((offer) => offer.id === id))
      setError('This quote service does not fit the current filters. Adjust an answer before requesting review.')
    else { setRequestedOfferId(id); setError('') }
    document.getElementById('quote-review-action')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const card = (offer: QuoteOffer) => offer.catalog ? <motion.div key={`${offer.kind}:${offer.id}`} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.18 }} className="min-w-0">
    {offer.kind === 'product' ? <ProductCard product={offer.catalog as Product} onAddToCart={addProduct} viewDetailsHref={detailHref(offer)} />
      : <ServiceCard service={offer.catalog as Service} onAddToCart={addService} onRequestQuote={requestQuote} viewDetailsHref={detailHref(offer)}
          actionDisabledReason={status === 'sent' && offer.quoteBased ? 'Already sent for review' : undefined} />}
  </motion.div> : null

  async function save() {
    if (!context || preview) return
    setStatus('saving'); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sign in again to save your answers.')
      const response = await fetch('/api/accelerated/member/quotes/refine', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ orderId: context.orderId, answers, requestedOfferId, expectedRevision: revision, idempotencyKey: crypto.randomUUID() }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Quote context could not be saved.')
      setSavedAnswers({ ...answers }); setSavedRequestedOfferId(requestedOfferId); setRevision(result.revision); setRefinementId(result.refinementId)
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
      sessionStorage.removeItem(draftKey(context.orderId)); setStatus('sent')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Quote request could not be sent.'); setStatus('ready') }
  }

  return <section className="mx-auto max-w-7xl px-4 py-8 text-platinum-white sm:px-6 sm:py-12">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Link className="inline-flex min-h-11 items-center text-sm text-radiant-gold underline" href="/member/dashboard">Back to member dashboard</Link>
      {context && <Link href="/checkout" className="text-sm text-radiant-gold underline">Cart ({cartCount})</Link>}
    </div>
    <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-radiant-gold">{context?.workshop === 'agentified' ? 'Agentified' : 'Accelerated'} · reviewed quote</p>
    <h1 className="mt-2 font-heading text-3xl font-bold sm:text-4xl">Find your fit</h1>
    <p className="mt-2 text-sm text-platinum-white/70">Your {context?.workshop === 'agentified' ? 'Operating File' : 'Decision File'} sets the starting point. Refine the active catalog below.</p>
    {status === 'loading' && <p className="mt-8" role="status">Loading your quote catalog…</p>}
    {status === 'error' && <div className="mt-8 rounded-lg border border-amber-400/40 p-5" role="alert"><p>{error}</p><Link className="mt-3 inline-block text-radiant-gold underline" href="/member/dashboard">Open member dashboard</Link></div>}
    {context && <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,245px)_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24">
        <details className="rounded-lg border border-white/20 bg-silicon-slate/40 p-4 lg:hidden">
          <summary className="cursor-pointer font-semibold">Refine options · {context.questions.length} questions</summary>
          <div className="mt-4 space-y-4">{questionFields('mobile')}</div>
        </details>
        <div className="hidden rounded-lg border border-white/20 bg-silicon-slate/40 p-4 lg:block">
          <h2 className="font-heading text-lg font-semibold">Refine options</h2>
          <p className="mt-1 text-xs text-platinum-white/65">Only unanswered {context.workshop === 'agentified' ? 'Operating File' : 'Decision File'} questions.</p>
          <div className="mt-4 space-y-4">{questionFields('desktop')}</div>
        </div>
        <details className="mt-3 text-xs text-platinum-white/70"><summary className="cursor-pointer">{context.workshop === 'agentified' ? 'Operating File' : 'Decision File'} context</summary>
          <ul className="mt-2 list-inside list-disc space-y-1">{context.summary.map((item) => <li key={item}>{item}</li>)}</ul>
        </details>
      </aside>
      <main className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2" aria-live="polite">
          <h2 className="font-heading text-xl font-semibold">Active catalog</h2>
          <span className="text-sm text-platinum-white/75">{projection?.remaining.length ?? 0} matching options · {projection?.excluded.length ?? 0} filtered out</span>
        </div>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3" data-testid="catalog-grid">
        {reviewed && <div className="min-w-0 rounded-xl border-2 border-radiant-gold/70 bg-radiant-gold/10 p-3" data-testid="reviewed-offer">
          <p className="mb-2 text-sm font-semibold text-radiant-gold">Your reviewed recommendation · pinned</p>
          {projection?.excluded.some((offer) => offer.id === reviewed.id) && <p className="mb-2 text-sm text-amber-200">Your current answers differ from this recommendation. The fit needs another review.</p>}
          {card(reviewed)}
        </div>}
        {status !== 'sent' && <AnimatePresence mode="popLayout">{alternatives.map((offer) => card(offer))}</AnimatePresence>}
        </div>
        {status === 'sent' ? <div className="mt-5 rounded-lg border border-green-400/40 p-5" role="status">Your quote request is in review. The current recommendation stays in place while we review any requested alternative.</div> : <>
          {projection?.status === 'no_match' && <div className="mt-5 rounded-lg border border-amber-400/40 p-4 text-sm" role="status">
            No other option fits every answer. Review your filters or show the full catalog; your recommendation remains pinned.
            <button type="button" onClick={() => setShowAll(true)} className="ml-2 text-radiant-gold underline">Show all options</button>
          </div>}
          {!alternatives.length && projection?.status !== 'no_match' && <p className="mt-5 text-sm text-platinum-white/70">No additional catalog options fit yet. Adjust a filter to explore others.</p>}
          {showAll && <button type="button" onClick={() => setShowAll(false)} className="mt-3 text-sm text-radiant-gold underline">Return to matching options</button>}
          {!!projection?.excluded.length && <details className="mt-5 text-sm text-platinum-white/70"><summary className="cursor-pointer text-radiant-gold">Why {projection.excluded.length} options fell away</summary>
            <ul className="mt-2 space-y-1">{projection.excluded.map((offer) => <li key={offer.kind + offer.id}>{offer.title}: {offer.reasons.join('; ')}</li>)}</ul>
          </details>}
          <div id="quote-review-action" className="mt-6 rounded-lg border border-radiant-gold/30 bg-silicon-slate/40 p-4">
            <h3 className="font-semibold">Request a quote review</h3>
            <p className="mt-1 text-sm text-platinum-white/70">Quote order #{context.orderId} · {context.offers.find((offer) => offer.id === requestedOfferId)?.title ?? context.title}</p>
            {requestedOfferId !== context.reviewedOfferId && <p className="mt-1 text-sm text-amber-200">This alternative is a request for review. Your approved recommendation has not changed.</p>}
            {error && <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>}
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => void save()} disabled={preview || status !== 'ready' || !dirty && !!refinementId} className="min-h-11 rounded-md border border-radiant-gold px-5 py-2 font-semibold text-radiant-gold disabled:opacity-50">{preview ? 'Preview only' : status === 'saving' ? 'Saving…' : 'Save context'}</button>
              <button type="button" onClick={() => void send()} disabled={preview || status !== 'ready' || dirty || !refinementId || projection?.status === 'no_match'} className="min-h-11 rounded-md bg-radiant-gold px-5 py-2 font-semibold text-imperial-navy disabled:opacity-50">{status === 'sending' ? 'Sending…' : 'Send for review'}</button>
            </div>
            <p className="mt-2 text-xs text-platinum-white/60">We will review the scope before confirming a price or starting a project. No payment is due.</p>
          </div>
        </>}
      </main>
    </div>}
  </section>

  function questionFields(surface: 'mobile' | 'desktop') {
    return context?.questions.map((question) => <fieldset key={question.id} disabled={status === 'sent'}>
      <legend className="text-sm font-semibold">{question.label}</legend>
      <div className="mt-2 flex flex-wrap gap-1.5">{question.options.map(([value, label]) => <label key={value} className={`cursor-pointer rounded border px-2 py-1.5 text-xs ${answers[question.id] === value ? 'border-radiant-gold bg-radiant-gold/20' : 'border-white/25'}`}>
        <input type="radio" name={`${surface}-${question.id}`} value={value} checked={answers[question.id] === value} onChange={() => { setAnswers((current) => ({ ...current, [question.id]: value })); setShowAll(false) }} className="mr-1 accent-radiant-gold" />{label}
      </label>)}</div>
    </fieldset>)
  }
}

function readDraft(orderId: number, revision: number, context: Context) {
  try {
    const raw = sessionStorage.getItem(draftKey(orderId))
    if (raw) {
      const draft = JSON.parse(raw) as { revision?: number; answers?: QuoteAnswers; requestedOfferId?: string }
      if (draft.revision === revision) {
        const answers = Object.fromEntries(Object.entries(draft.answers ?? {}).filter(([key, value]) =>
          context.questions.some((question) => question.id === key && question.options.some(([option]) => option === value)))) as QuoteAnswers
        const requestedOfferId = context.offers.some((offer) => offer.kind === 'service' && offer.quoteBased && offer.id === draft.requestedOfferId)
          ? draft.requestedOfferId! : context.requestedOfferId
        return { answers, requestedOfferId }
      }
    }
  } catch { sessionStorage.removeItem(draftKey(orderId)) }
  return { answers: context.answers, requestedOfferId: context.requestedOfferId }
}
