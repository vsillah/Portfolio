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

  function renderQuestion(item: typeof TRACE_DIMENSIONS[number], index: number) {
    return <fieldset key={item.id} className={styles.question}>
      <legend><span className={styles.number}>0{index + 1}</span><span><small>{item.label.toUpperCase()}</small><strong>{item.question}</strong></span></legend>
      <div className={styles.options}>{[item.low, item.mid, item.high].map((label, points) => <label key={points} className={`${styles.option} ${answers[item.id] === points ? styles.selected : ''}`}><input type="radio" name={item.id} value={points} checked={answers[item.id] === points} onChange={() => { setAnswers((current) => ({ ...current, [item.id]: points })); resetForEdit() }} /><span className={styles.optionMarker} aria-hidden /><span><strong>{captions[points]}</strong><small>{label}</small></span></label>)}</div>
    </fieldset>
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div className={styles.productBrand}><Image src="/lead-magnets/dark-castle-chess-logo.png" alt="Dark Castle Chess castle logo" width={72} height={72} className={styles.castleLogo} /><span>DARK CASTLE <small>CHESS</small></span></div>
      <Link href="/" className={styles.publisher}><Image src="/amadutown-logo-upscaled.png" alt="" width={25} height={32} className={styles.publisherLogo} /><span>Created by <strong>AmaduTown</strong></span></Link>
    </header>

    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>DARK CASTLE CHESS / FIELD NOTE 01</p>
        <h1>The board shows the move. <em>Can you show the reason?</em></h1>
        <p className={styles.lede}>Dark Castle Chess keeps the position, move guidance, and notation in view. This free scorecard carries that idea into a decision your team may need to revisit.</p>
        <p className={styles.heroOffer}>Decision Traceability Scorecard <span>+ one-page worksheet</span></p>
        <a className={styles.primary} href="#assessment">Score a decision <span aria-hidden>↗</span></a>
        <p className={styles.heroNote}>Four checks. About three minutes. Your result appears before any email request.</p>
      </div>
      <figure className={styles.heroVisual}>
        <div className={styles.proofImage}><Image src="/review-assets/social-content/storyboard-review/explore-start.jpg" alt="Dark Castle Chess game start screen showing the board, coach prompt, move guidance, and notation" width={1248} height={969} sizes="(max-width: 900px) 90vw, 44vw" priority /></div>
        <figcaption className={styles.visualCaption}><span className={styles.goldDot} /> 01 / START AS WHITE <strong>The board and its context share one screen.</strong><a href="/review-assets/social-content/storyboard-review/explore-start.jpg" target="_blank" rel="noopener noreferrer">View full-size gameplay screen ↗</a></figcaption>
      </figure>
    </section>

    <section id="assessment" className={styles.journey} aria-labelledby="assessment-heading">
      <div className={styles.journeyIntro}>
        <p className={styles.eyebrow}>FROM THE GAME TO YOUR WORK</p>
        <h2 id="assessment-heading">Pick one decision worth revisiting.</h2>
        <p>The game screens stay beside four checks as you rate a decision your team could hand to someone tomorrow.</p>
        <span className={styles.progress}>{answered} of 4 checks complete</span>
      </div>
      <figure className={styles.gameFrame}>
        <Image src="/review-assets/social-content/storyboard-review/explore-position.jpg" alt="Dark Castle Chess Explore after e4: board position, Black to move, move guidance, and e4 in notation" width={1248} height={969} sizes="(max-width: 900px) 90vw, 38vw" />
        <figcaption><strong>02 / EXPLORE AFTER E4</strong><span>Black to move. Guidance and e4 notation remain beside the board.</span><a href="/review-assets/social-content/storyboard-review/explore-position.jpg" target="_blank" rel="noopener noreferrer">View full-size gameplay screen ↗</a></figcaption>
      </figure>
      <div className={styles.questionPair}>{TRACE_DIMENSIONS.slice(0, 2).map(renderQuestion)}</div>
      <figure className={styles.gameFrame}>
        <Image src="/review-assets/social-content/storyboard-review/explore-computer.jpg" alt="Dark Castle Chess after Black plays e5: board, notation showing e4 and e5, move guidance, and candidate moves" width={1248} height={969} sizes="(max-width: 900px) 90vw, 38vw" />
        <figcaption><strong>03 / AFTER BLACK PLAYS E5</strong><span>Board, e4/e5 notation, guidance, and candidate moves. Percentages are in-product estimates.</span><a href="/review-assets/social-content/storyboard-review/explore-computer.jpg" target="_blank" rel="noopener noreferrer">View full-size gameplay screen ↗</a></figcaption>
      </figure>
      <div className={styles.questionPair}>{TRACE_DIMENSIONS.slice(2).map((item, index) => renderQuestion(item, index + 2))}</div>
    </section>

    <section className={styles.payoff} aria-label="Your score and worksheet">
      <div className={styles.payoffMain}>
        <div className={styles.result} aria-live="polite" aria-labelledby="result-heading">
          {result ? <><div className={styles.resultScore}><span>{result.total}<small>/ 8</small></span><p>YOUR TRACEABILITY SCORE</p></div><div className={styles.resultCopy}><p className={styles.eyebrow}>YOUR FIRST REPAIR</p><h2 id="result-heading">Make {weakest!.label.toLowerCase()} visible.</h2><p>{result.total === 8 ? 'The record is strong across all four checks. Test it with someone who was not in the room: can they understand the choice and the trigger to revisit it?' : `Your weakest check is ${weakest!.label.toLowerCase()}. ${weakest!.fix}`}</p><p className={styles.resultAction}><strong>Next action:</strong> Write one decision in the worksheet with an owner, a review trigger, and the evidence you used.</p></div></> : <><div className={styles.resultScore}><span>—<small>/ 8</small></span><p>YOUR TRACEABILITY SCORE</p></div><div className={styles.resultCopy}><p className={styles.eyebrow}>RESULT PREVIEW</p><h2 id="result-heading">Your next step appears here.</h2><p>Answer all four checks to see where the record needs work. Your answers stay in this browser unless you request an email follow-up.</p></div></>}
        </div>
        <div className={styles.download} aria-labelledby="download-heading">
          <div><p className={styles.eyebrow}>THE FREE ONE-PAGE RECORD</p><h2 id="download-heading">Take the record with you.</h2><p>Keep the reason, owner, review trigger, and evidence together.</p><a className={styles.secondary} href="/decision-traceability-worksheet.pdf" download>Download the free PDF <span aria-hidden>↓</span></a><p className={styles.smallPrint}>No email required.</p></div>
          <div className={styles.paperPreview} aria-hidden><span>DARK CASTLE CHESS / FIELD NOTE 01</span><h3>Decision record</h3><div>01 &nbsp; The choice and why</div><div>02 &nbsp; The accountable owner</div><div>03 &nbsp; The trigger to revisit</div><div>04 &nbsp; Evidence and open questions</div><small>Created by AmaduTown</small></div>
        </div>
      </div>

      <section className={styles.capture} aria-labelledby="capture-heading">
        <div><p className={styles.eyebrow}>OPTIONAL FOLLOW-UP</p><h2 id="capture-heading">Want a follow-up?</h2><p>Leave an email if you want AmaduTown to write about this scorecard and practical decision tools. Your score and PDF are available without it.</p></div>
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
    </section>
    <footer className={styles.footer}><span>© AmaduTown Advisory Solutions</span><Link href="/legal/privacy">Privacy</Link><Link href="/">Portfolio</Link></footer>
  </main>
}
