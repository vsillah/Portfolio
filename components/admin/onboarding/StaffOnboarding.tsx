'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { evolution, systemFlow, stackMap, sections, firstWeek, onboardingIntro, onboardingDefinition, onboardingReviewed } from '@/lib/staff-onboarding'

const actionClass = 'inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-radiant-gold disabled:opacity-60'

export default function StaffOnboarding() {
  const root = useRef<HTMLDivElement>(null)
  const [checked, setChecked] = useState<string[]>([])
  const [pdfState, setPdfState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  useEffect(() => {
    const revealHash = () => {
      const section = Array.from(root.current?.querySelectorAll('details') ?? []).find(el => `#${el.id}` === window.location.hash)
      if (section) {
        section.open = true
        section.scrollIntoView({ block: 'start' })
      }
    }
    revealHash()
    window.addEventListener('hashchange', revealHash)
    return () => window.removeEventListener('hashchange', revealHash)
  }, [])

  function startWeek() {
    const section = root.current?.querySelector<HTMLDetailsElement>('#week')
    if (!section) return
    section.open = true
    window.history.replaceState(null, '', '#week')
    section.scrollIntoView({ block: 'start', behavior: 'smooth' })
    section.querySelector('summary')?.focus({ preventScroll: true })
  }

  async function downloadPDF() {
    setPdfState('loading')
    try {
      const { generateStaffOnboardingPDFBlob } = await import('@/lib/staff-onboarding-pdf')
      const blob = await generateStaffOnboardingPDFBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'amadutown-staff-onboarding.pdf'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setPdfState('done')
    } catch {
      setPdfState('error')
    }
  }

  return <div ref={root} className="mx-auto max-w-5xl p-4 pb-16 text-foreground sm:p-8" data-testid="staff-onboarding">
    <Breadcrumbs items={[{ label: 'Admin', href: '/admin' }, { label: 'Help', href: '/admin/help' }, { label: 'Staff onboarding' }]} />
    <header className="mb-8 mt-6 rounded-2xl border border-radiant-gold/20 bg-silicon-slate/20 p-5 sm:p-8">
      <div className="mb-5 flex items-center gap-4">
        <Image src="/amadutown-logo-upscaled.png" alt="AmaduTown shield" width={48} height={64} priority className="h-auto w-12 shrink-0" />
        <p className="text-sm font-semibold leading-relaxed text-radiant-gold">AmaduTown Advisory Solutions, LLC<br /><span className="font-normal text-muted-foreground">Staff orientation</span></p>
      </div>
      <h1 className="font-premium text-3xl font-bold leading-tight sm:text-4xl">Welcome to your workspace</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">{onboardingIntro}</p>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed">Start with your onboarding owner: confirm your account, assigned workspace, and who approves your work.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={startWeek} className={`${actionClass} bg-radiant-gold text-imperial-navy hover:bg-gold-light`}>Start your first week</button>
        <button type="button" onClick={downloadPDF} disabled={pdfState === 'loading'} className={`${actionClass} border border-radiant-gold/30 hover:bg-radiant-gold/10`}>{pdfState === 'loading' ? 'Preparing PDF…' : 'Download PDF'}</button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Read at your own pace. Open a section below when you need it. The PDF includes every section for reading or printing.</p>
      <p role="status" aria-live="polite" className="mt-2 text-sm text-radiant-gold">{pdfState === 'error' ? 'The PDF could not be prepared. Retry Download PDF or continue with the guide below.' : pdfState === 'done' ? 'PDF prepared. Check your browser’s Downloads list.' : pdfState === 'loading' ? 'Preparing the complete guide…' : ''}</p>
    </header>
    <section aria-labelledby="portfolio-definition" className="mb-8">
      <h2 id="portfolio-definition" className="font-premium text-2xl font-semibold">What is Portfolio?</h2>
      <p className="mt-3 leading-relaxed text-muted-foreground">{onboardingDefinition}</p>
    </section>
    <div className="space-y-3">
      {sections.map((section, index) => <details key={section.id} id={section.id} className="group scroll-mt-24 rounded-2xl border border-radiant-gold/15 bg-silicon-slate/10 open:bg-silicon-slate/20">
        <summary className="cursor-pointer rounded-2xl p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-radiant-gold sm:p-6">
          <h2 className="inline font-premium text-xl font-semibold">{index + 1}. {section.title}</h2>
          <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{section.summary}</span>
        </summary>
        <div className="space-y-5 border-t border-radiant-gold/10 p-5 sm:p-6">
          {section.id === 'workspace' && <>
            <figure aria-label="Portfolio evolution: three layers of work">
              <figcaption className="mb-3 text-sm font-semibold text-radiant-gold">The work, in three layers</figcaption>
              <ol className="grid gap-3 md:grid-cols-3">{evolution.map((item, i) => <li key={item.title} className="min-w-0 rounded-xl border border-radiant-gold/20 p-4"><p className="text-sm text-radiant-gold">Layer {i + 1}</p><h3 className="mt-2 font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p></li>)}</ol>
            </figure>
            <figure aria-label="System flow from context through approval to receipt">
              <figcaption className="mb-3 text-sm font-semibold text-radiant-gold">Follow one request ↓</figcaption>
              <ol className="grid gap-3 sm:grid-cols-2">{systemFlow.map(item => <li key={item.title} className="min-w-0 rounded-xl bg-background/50 p-4"><h3 className="font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p></li>)}</ol>
            </figure>
            <figure aria-label="Technology map by responsibility">
              <figcaption className="mb-3 text-sm font-semibold text-radiant-gold">The tools behind the work</figcaption>
              <ul className="space-y-3">{stackMap.map(item => <li key={item.title} className="rounded-xl border-l-2 border-radiant-gold/50 bg-background/50 p-4"><h3 className="font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p></li>)}</ul>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Arrows show responsibilities and handoffs, not a live connection check.</p>
            </figure>
          </>}
          {section.id === 'week' && <p className="text-sm text-radiant-gold" role="status">{checked.length} of {firstWeek.length} practice steps checked. For this visit only; checks are not saved or included in the PDF.</p>}
          <div className={section.id === 'tools' ? 'grid gap-4 md:grid-cols-2' : 'space-y-5'}>
            {section.blocks.map(block => <div key={block.title} className={section.id === 'tools' ? 'min-w-0 rounded-xl border border-radiant-gold/10 p-4' : 'min-w-0'}>
              {section.id === 'week' ? <label className="flex cursor-pointer items-start gap-3 rounded-lg py-2">
                <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#D4AF37]" checked={checked.includes(block.title)} onChange={event => setChecked(previous => event.target.checked ? [...previous, block.title] : previous.filter(value => value !== block.title))} />
                <span><span className="block font-semibold">{block.title}</span><span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{block.text}</span></span>
              </label> : <><h3 className="font-semibold">{block.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{block.text}</p></>}
            </div>)}
          </div>
        </div>
      </details>)}
    </div>
    <p className="mt-8 text-xs leading-relaxed text-muted-foreground">Reviewed {onboardingReviewed}. Tool roles reflect repository evidence, not live account or provider readiness. Your owner confirms access, assignments, and approvals.</p>
  </div>
}
