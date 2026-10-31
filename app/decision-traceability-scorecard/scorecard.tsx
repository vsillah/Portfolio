'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { scoreTrace, TRACE_CONSENT_VERSION, TRACE_DIMENSIONS, type TraceAnswers } from '@/lib/decision-traceability'
import styles from './scorecard.module.css'

type SubmitState = 'idle' | 'sending' | 'saved' | 'duplicate' | 'error'
const captions = ['Needs a record', 'Partly visible', 'Clear enough to revisit']
const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

export default function DecisionTraceability() {
  const [answers, setAnswers] = useState<Partial<TraceAnswers>>({})
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState<SubmitState>('idle')
  const [message, setMessage] = useState('')
  const [submissionKey, setSubmissionKey] = useState('')
  const [attribution, setAttribution] = useState<Record<string, string>>({})
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    setSubmissionKey(crypto.randomUUID())
    const params = new URLSearchParams(window.location.search)
    setAttribution(Object.fromEntries(attributionKeys.map((key) => [key, params.get(key) || ''])))
    const sync = () => setOffline(!navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync) }
  }, [])

  const result = useMemo(() => scoreTrace(answers), [answers])
  const answered = Object.keys(answers).length
  const weakest = result ? TRACE_DIMENSIONS.find((item) => item.id === result.weakest)! : null

  function resetForEdit() {
    setState('idle')
    setMessage('')
    setSubmissionKey(crypto.randomUUID())
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!result || !consent || state === 'sending') {
      setMessage('Complete all four checks and select the email consent checkbox.')
      setState('error')
      return
    }
    if (offline) {
      setMessage('You are offline. Your score stays on this page; reconnect before submitting.')
      setState('error')
      return
    }
    setState('sending')
    setMessage('')
    try {
      const response = await fetch('/api/decision-traceability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent, consentVersion: TRACE_CONSENT_VERSION, answers, attribution, submissionKey }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Your request could not be saved. Please retry.')
      setState(payload.status === 'duplicate' ? 'duplicate' : 'saved')
      setMessage(payload.status === 'duplicate' ? payload.message : 'Saved. You can download the worksheet below and use it with your team.')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Your request could not be saved. Please retry.')
    }
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}><Image src="/amadutown-logo-upscaled.png" alt="AmaduTown" width={48} height={62} className={styles.logo} /><span>AMADUTOWN <small>ADVISORY SOLUTIONS</small></span></Link>
      <span className={styles.headerTag}>A tool for better decisions</span>
    </header>

    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>DECISION TRACEABILITY SCORECARD · FREE WORKSHEET</p>
        <h1>A smart move is easier to repeat when you can see <em>why it worked.</em></h1>
        <p className={styles.lede}>A decision can look right today and still leave the next person guessing. Check four things that help your team revisit a choice: its reasoning, owner, threshold, and evidence.</p>
        <a className={styles.primary} href="#assessment">Score a decision <span aria-hidden>↗</span></a>
        <p className={styles.heroNote}>Four checks. About three minutes. Your result appears before any email request.</p>
      </div>
      <div className={styles.heroVisual}>
        <div className={styles.proofImage}><Image src="/review-assets/social-content/storyboard-review/explore-computer.jpg" alt="Dark Castle Chess Explore board beside candidate moves and move guidance after the computer responds" fill sizes="(max-width: 850px) 90vw, 44vw" /></div>
        <div className={styles.visualCaption}><span className={styles.goldDot} /> FROM DARK CASTLE CHESS <strong>Position. Response. Next choice.</strong></div>
      </div>
    </section>

    <section className={styles.story} aria-labelledby="story-heading">
      <div><p className={styles.eyebrow}>THE IDEA BEHIND THE TOOL</p><h2 id="story-heading">The board remembers e4. What helps the player choose the next move?</h2></div>
      <div><p>In Dark Castle Chess, Explore keeps the position, move guidance, and notation together. After the computer responds, a player can inspect candidate moves alongside the board. Those are visible product states, not a claim about learning outcomes.</p><p>The same question belongs in product reviews, operations, and client work: can the next person see the context of a choice and know when to revisit it?</p></div>
    </section>

    <section id="assessment" className={styles.assessment} aria-labelledby="assessment-heading">
      <div className={styles.sectionIntro}><p className={styles.eyebrow}>THE FOUR-PART CHECK</p><h2 id="assessment-heading">Pick one real decision.</h2><p>Think of a recent launch, policy, investment, or product choice. Rate the record you could hand to someone tomorrow.</p><span className={styles.progress}>{answered} of 4 checks complete</span></div>
      <div className={styles.questions}>
        {TRACE_DIMENSIONS.map((item, index) => <fieldset key={item.id} className={styles.question}>
          <legend><span className={styles.number}>0{index + 1}</span><span><small>{item.label.toUpperCase()}</small><strong>{item.question}</strong></span></legend>
          <div className={styles.options}>{[item.low, item.mid, item.high].map((label, points) => <label key={points} className={`${styles.option} ${answers[item.id] === points ? styles.selected : ''}`}><input type="radio" name={item.id} value={points} checked={answers[item.id] === points} onChange={() => { setAnswers((current) => ({ ...current, [item.id]: points })); resetForEdit() }} /><span className={styles.optionMarker} aria-hidden /><span><strong>{captions[points]}</strong><small>{label}</small></span></label>)}</div>
        </fieldset>)}
      </div>
    </section>

    <section className={styles.result} aria-live="polite" aria-labelledby="result-heading">
      {result ? <><div className={styles.resultScore}><span>{result.total}<small>/ 8</small></span><p>YOUR TRACEABILITY SCORE</p></div><div className={styles.resultCopy}><p className={styles.eyebrow}>YOUR FIRST REPAIR</p><h2 id="result-heading">Make {weakest!.label.toLowerCase()} visible.</h2><p>{result.total === 8 ? 'The record is strong across all four checks. Test it with someone who was not in the room: can they understand the choice and the trigger to revisit it?' : `Your weakest check is ${weakest!.label.toLowerCase()}. ${weakest!.fix} Start there before adding another dashboard or meeting.`}</p><p className={styles.resultAction}><strong>Next action:</strong> Write one decision in the worksheet. Add the owner, the evidence you used, and the condition that would make you change course.</p></div></> : <><div className={styles.resultScore}><span>—<small>/ 8</small></span><p>YOUR TRACEABILITY SCORE</p></div><div className={styles.resultCopy}><p className={styles.eyebrow}>RESULT PREVIEW</p><h2 id="result-heading">A clear next step, tied to your weakest check.</h2><p>Answer all four questions to see where the decision record needs work. Your answers stay in this browser unless you choose to submit an email request.</p></div></>}
    </section>

    <section className={styles.download} aria-labelledby="download-heading">
      <div><p className={styles.eyebrow}>TAKE IT INTO THE ROOM</p><h2 id="download-heading">A worksheet you can actually use.</h2><p>One page to record the choice, the reason, who owns it, what would change it, and what evidence was available. Bring it to your next review.</p><a className={styles.secondary} href="/decision-traceability-worksheet.pdf" download>Download the free PDF <span aria-hidden>↓</span></a><p className={styles.smallPrint}>No email required for the worksheet.</p></div>
      <div className={styles.paperPreview} aria-hidden><span>AMADUTOWN / FIELD NOTE 01</span><h3>Decision record</h3><div>01 &nbsp; The choice and why</div><div>02 &nbsp; The accountable owner</div><div>03 &nbsp; The trigger to revisit</div><div>04 &nbsp; Evidence and open questions</div><small>Keep the reasoning with the result.</small></div>
    </section>

    <section className={styles.capture} aria-labelledby="capture-heading">
      <div><p className={styles.eyebrow}>KEEP THE CONVERSATION OPEN</p><h2 id="capture-heading">Want practical notes on making decisions easier to revisit?</h2><p>Leave an email if you want AmaduTown to follow up about decision traceability and related tools. Your score and the PDF are available either way.</p></div>
      <form onSubmit={submit} noValidate>
        <label className={styles.emailLabel} htmlFor="trace-email">Work email</label>
        <input id="trace-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); resetForEdit() }} autoComplete="email" required placeholder="you@organization.org" maxLength={254} />
        <label className={styles.consent}><input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); resetForEdit() }} /><span>I agree to receive an email follow-up from AmaduTown about this scorecard and practical decision tools. I can unsubscribe or request deletion at any time.</span></label>
        <button className={styles.primary} type="submit" disabled={!result || !consent || state === 'sending' || state === 'saved' || state === 'duplicate'}>{state === 'sending' ? 'Saving…' : state === 'saved' ? 'Request saved' : state === 'duplicate' ? 'Already saved' : 'Request follow-up'} <span aria-hidden>↗</span></button>
        {offline && <p role="status" className={styles.formError}>You are offline. The score and PDF remain available; reconnect to submit.</p>}
        {message && <p role="status" className={state === 'error' ? styles.formError : styles.formSuccess}>{message}</p>}
        <p className={styles.smallPrint}>We store your email, score, weakest area, consent record, and campaign attribution. We do not store your individual answers. No message is sent when you submit this form. <Link href="/legal/privacy">Privacy policy</Link>.</p>
      </form>
    </section>
    <footer className={styles.footer}><span>© AmaduTown Advisory Solutions</span><Link href="/legal/privacy">Privacy</Link><Link href="/">Portfolio</Link></footer>
  </main>
}
