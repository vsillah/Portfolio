'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { scoreTrace, TRACE_CONSENT_VERSION, TRACE_DIMENSIONS, type TraceAnswers } from '@/lib/decision-traceability'
import styles from './scorecard.module.css'

type SubmitState = 'idle' | 'sending' | 'saved' | 'duplicate' | 'error'
const captions = ['Needs a record', 'Partly visible', 'Clear enough to revisit']
const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
const capabilities = [
  { step: '01', label: 'LEARN', title: 'A path through the ideas', trigger: 'Choose a lesson', response: 'Drill presents a position, a hint, and an answer to study.', value: 'Practice has a place in a larger sequence.', scene: 'path' },
  { step: '02', label: 'WALK THROUGH', title: 'See the reason behind a move', trigger: 'Open a walk-through', response: 'The board advances with the lesson, one decision at a time.', value: 'A line becomes something you can explain.', scene: 'walk' },
  { step: '03', label: 'REVIEW', title: 'Keep a mistake worth studying', trigger: 'Review a game', response: 'Save a move to My Mistakes, then return to it in practice.', value: 'The next session starts with a real choice you made.', scene: 'mistake' },
  { step: '04', label: 'COACH', title: 'Turn a finding into a next step', trigger: 'Open move review', response: 'Coach points to a move to study and offers a way back into it.', value: 'The explanation has somewhere to go.', scene: 'coach' },
  { step: '05', label: 'VARIATION', title: 'Follow the pieces through a line', trigger: 'Compare a variation', response: 'Piece silhouettes and paths keep the board connected to its earlier position.', value: 'You can track what changed without losing the piece.', scene: 'variation' },
  { step: '06', label: 'EXPLORE', title: 'Compare the move in front of you', trigger: 'Study a position', response: 'Candidates, notation, and hints give the choice more context.', value: 'You can revisit the move and the reason together.', scene: 'explore' },
] as const

function CapabilityScene({ scene }: { scene: typeof capabilities[number]['scene'] }) {
  if (scene === 'path') return <div className={styles.pathScene} aria-hidden><span>01 · The board</span><span>04 · Piece safety</span><span>07 · Planning</span><strong>10 · Black vs 1.e4</strong><small>DRILL <b>Hint</b> <b>Answer</b></small></div>
  if (scene === 'walk') return <div className={styles.walkScene} aria-hidden><span>WALK-THROUGH</span><div className={styles.miniBoard}><i>♜</i><i>♞</i><i>♝</i><i>♛</i><i>♚</i><i>♝</i><i>♞</i><i>♜</i><i>♟</i><i>♟</i><i>♟</i><i>♟</i><i>♟</i><i>♟</i><i>♟</i><i>♟</i></div><p>Move → reason → next move</p></div>
  if (scene === 'mistake') return <div className={styles.mistakeScene} aria-hidden><span>GAME REVIEW</span><strong>One move to revisit</strong><div>Save to My Mistakes <b>↗</b></div><div>Practice this position <b>→</b></div></div>
  if (scene === 'coach') return <div className={styles.coachScene} aria-hidden><span>COACH · MOVE REVIEW</span><strong>3. Nxe5</strong><p>One move to study</p><div><b>Study</b><b>Again</b></div></div>
  if (scene === 'variation') return <div className={styles.variationScene} aria-hidden><span>VARIATION VIEW</span><div><i>♞</i><em>··········→</em><i>♞</i></div><p>Same piece · new square</p></div>
  return <div className={styles.exploreScene} aria-hidden><span>EXPLORE</span><div><b>Candidate moves</b><strong>1. e4</strong><strong>1. d4</strong><strong>1. Nf3</strong></div><p>Board · notation · hint</p></div>
}

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
      if (!response.ok) throw new Error(payload.error || 'We could not take your request. Please try again.')
      setState(payload.status === 'duplicate' ? 'duplicate' : 'saved')
      setMessage(payload.status === 'duplicate' ? payload.message : 'Thanks. Your follow-up request is in.')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'We could not take your request. Please try again.')
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
        <p className={styles.lede}>In Dark Castle Chess, every move leaves a position to study. Use this free scorecard to bring the same care to a decision your team may need to revisit.</p>
        <p className={styles.heroOffer}>Decision Traceability Scorecard <span>+ one-page worksheet</span></p>
        <a className={styles.primary} href="#assessment">Score a decision <span aria-hidden>↗</span></a>
        <p className={styles.heroNote}>Four checks. About three minutes. See your score before sharing your email.</p>
      </div>
      <div className={styles.heroLoop} role="img" aria-label="Dark Castle learning loop: learn, play, review, and practice">
        <p>DARK CASTLE LEARNING LOOP</p><div><span>Learn</span><span>Play</span><span>Review</span><span>Practice</span></div><strong>A move can become the next lesson.</strong>
      </div>
    </section>

    <section className={styles.capabilities} aria-labelledby="capabilities-heading">
      <div className={styles.capabilitiesIntro}><p className={styles.eyebrow}>WHAT DARK CASTLE DOES DIFFERENTLY</p><h2 id="capabilities-heading">Keep the lesson close to the move.</h2><p>Lessons, play, review, and practice connect around choices on the board. These illustrations draw on Dark Castle’s browser and iOS builds.</p></div>
      <div className={styles.capabilityGrid}>{capabilities.map((item) => <article className={styles.capabilityCard} key={item.step}>
        <div className={styles.capabilityTop}><span>{item.step} / {item.label}</span><h3>{item.title}</h3></div>
        <CapabilityScene scene={item.scene} />
        <div className={styles.capabilityDetail}><p><b>{item.trigger}.</b> {item.response}</p><p>{item.value}</p></div>
      </article>)}</div>
    </section>

    <section id="assessment" className={styles.journey} aria-labelledby="assessment-heading">
      <div className={styles.journeyIntro}>
        <p className={styles.eyebrow}>FROM THE GAME TO YOUR WORK</p>
        <h2 id="assessment-heading">Pick one decision worth revisiting.</h2>
        <p>Choose a recent product, policy, or investment decision. Answer four questions about the record behind it.</p>
        <span className={styles.progress}>{answered} of 4 checks complete</span>
      </div>
      <div className={styles.questionPair}>{TRACE_DIMENSIONS.slice(0, 2).map(renderQuestion)}</div>
      <div className={styles.questionPair}>{TRACE_DIMENSIONS.slice(2).map((item, index) => renderQuestion(item, index + 2))}</div>
    </section>

    <section className={styles.payoff} aria-label="Your score and worksheet">
      <div className={styles.payoffMain}>
        <div className={styles.result} aria-live="polite" aria-labelledby="result-heading">
          {result ? <><div className={styles.resultScore}><span>{result.total}<small>/ 8</small></span><p>YOUR TRACEABILITY SCORE</p></div><div className={styles.resultCopy}><p className={styles.eyebrow}>START HERE</p><h2 id="result-heading">{result.total === 8 ? 'Put your record to the test.' : `Make ${weakest!.label.toLowerCase()} visible.`}</h2><p>{result.total === 8 ? 'You have the essentials. Ask someone who was not in the room to read the record and tell you what would cause a review.' : weakest!.fix}</p><p className={styles.resultAction}><strong>Next action:</strong> Write one decision in the worksheet with an owner, a review trigger, and the evidence you used.</p></div></> : <><div className={styles.resultScore}><span>—<small>/ 8</small></span><p>YOUR TRACEABILITY SCORE</p></div><div className={styles.resultCopy}><p className={styles.eyebrow}>YOUR RESULT</p><h2 id="result-heading">See what needs attention.</h2><p>Answer four questions to get a score and a practical first step.</p></div></>}
        </div>
        <div className={styles.download} aria-labelledby="download-heading">
          <div><p className={styles.eyebrow}>THE FREE ONE-PAGE RECORD</p><h2 id="download-heading">Take the record with you.</h2><p>Keep the reason, owner, review trigger, and evidence together.</p><a className={styles.secondary} href="/decision-traceability-worksheet.pdf" download>Download the free PDF <span aria-hidden>↓</span></a><p className={styles.smallPrint}>No email required.</p></div>
          <div className={styles.paperPreview} aria-hidden><span>DARK CASTLE CHESS / FIELD NOTE 01</span><h3>Decision record</h3><div>01 &nbsp; The choice and why</div><div>02 &nbsp; The accountable owner</div><div>03 &nbsp; The trigger to revisit</div><div>04 &nbsp; Evidence and open questions</div><small>Created by AmaduTown</small></div>
        </div>
      </div>

      <section className={styles.capture} aria-labelledby="capture-heading">
        <div><p className={styles.eyebrow}>OPTIONAL FOLLOW-UP</p><h2 id="capture-heading">Want more tools for clearer decisions?</h2><p>Share your email if you would like practical notes from AmaduTown. The worksheet is yours either way.</p></div>
        <form onSubmit={submit} noValidate>
          <label className={styles.emailLabel} htmlFor="trace-email">Work email</label>
          <input id="trace-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); resetForEdit() }} autoComplete="email" required maxLength={254} />
          <label className={styles.consent}><input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); resetForEdit() }} /><span>I agree to receive an email follow-up from AmaduTown about this scorecard and practical decision tools. I can unsubscribe or request deletion at any time.</span></label>
          <button className={styles.primary} type="submit" disabled={!result || !consent || state === 'sending' || state === 'saved' || state === 'duplicate'}>{state === 'sending' ? 'Saving…' : state === 'saved' ? 'Request saved' : state === 'duplicate' ? 'Already saved' : 'Request follow-up'} <span aria-hidden>↗</span></button>
          {offline && <p role="status" className={styles.formError}>You are offline. The score and PDF remain available; reconnect to submit.</p>}
          {message && <p role="status" className={state === 'error' ? styles.formError : styles.formSuccess}>{message}</p>}
          <p className={styles.smallPrint}>If you request a follow-up, we will use your email and score to respond. You can unsubscribe or ask us to delete your information at any time. <Link href="/legal/privacy">Privacy policy</Link>.</p>
        </form>
      </section>
    </section>
    <footer className={styles.footer}><span>© AmaduTown Advisory Solutions</span><Link href="/legal/privacy">Privacy</Link><Link href="/">Portfolio</Link></footer>
  </main>
}
