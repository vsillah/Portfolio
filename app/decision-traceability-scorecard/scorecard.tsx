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

    <section className={styles.proof} aria-labelledby="proof-heading">
      <div className={styles.proofIntro}><p className={styles.eyebrow}>THE PRODUCT STATES BEHIND THE TOOL</p><h2 id="proof-heading">Follow the move, then the response.</h2><p>These are real Dark Castle Chess screens. The board changes, and the surrounding context changes with it.</p></div>
      <figure className={styles.proofStep}>
        <Image src="/review-assets/social-content/storyboard-review/explore-position.jpg" alt="Dark Castle Chess Explore after e4: board position, Black to move, move guidance, and e4 in notation" width={1248} height={969} sizes="(max-width: 900px) 90vw, 60vw" />
        <figcaption><span className={styles.stepNumber}>02 / EXPLORE AFTER E4</span><h3>The position stays visible.</h3><p>Explore shows Black to move. Move guidance lists possible replies, and the notation panel records e4.</p><a href="/review-assets/social-content/storyboard-review/explore-position.jpg" target="_blank" rel="noopener noreferrer">View full-size gameplay screen ↗</a></figcaption>
      </figure>
      <figure className={styles.proofStep}>
        <Image src="/review-assets/social-content/storyboard-review/explore-computer.jpg" alt="Dark Castle Chess after Black plays e5: board, notation showing e4 and e5, move guidance, and candidate moves" width={1248} height={969} sizes="(max-width: 900px) 90vw, 60vw" />
        <figcaption><span className={styles.stepNumber}>03 / AFTER BLACK PLAYS E5</span><h3>The next choice has context.</h3><p>The board shows e5. Notation records both moves, while move guidance and candidate moves sit beside the position. The displayed percentages are in-product estimates.</p><a href="/review-assets/social-content/storyboard-review/explore-computer.jpg" target="_blank" rel="noopener noreferrer">View full-size gameplay screen ↗</a></figcaption>
      </figure>
    </section>

    <section className={styles.story} aria-labelledby="story-heading">
      <div><p className={styles.eyebrow}>FROM THE GAME TO YOUR WORK</p><h2 id="story-heading">What should a decision record keep in view?</h2></div>
      <div><p>The game screens show a position, a move, and the information beside them. Use the scorecard to check a team decision with the same care.</p><ol className={styles.bridgeChecks}><li><strong>Reasoning</strong><span>Why this choice?</span></li><li><strong>Ownership</strong><span>Who can revisit it?</span></li><li><strong>Threshold</strong><span>What would change it?</span></li><li><strong>Evidence</strong><span>What was known then?</span></li></ol><p>The four checks are a worksheet for your decision. They are not features or measured outcomes of the game.</p></div>
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
      <div className={styles.paperPreview} aria-hidden><span>DARK CASTLE CHESS / FIELD NOTE 01</span><h3>Decision record</h3><div>01 &nbsp; The choice and why</div><div>02 &nbsp; The accountable owner</div><div>03 &nbsp; The trigger to revisit</div><div>04 &nbsp; Evidence and open questions</div><small>Created by AmaduTown · Keep the reasoning with the result.</small></div>
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
