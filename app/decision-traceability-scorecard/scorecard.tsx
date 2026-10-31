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
  { step: '06', label: 'EXPLORE', title: 'Compare the move in front of you', trigger: 'Study a position', response: 'Candidates shows evaluated moves and continuation lines beside the position.', value: 'You can revisit the move and the reason together.', scene: 'explore' },
] as const

function CapabilityScene({ scene }: { scene: typeof capabilities[number]['scene'] }) {
  const base = '/lead-magnets/dark-castle-capabilities/'
  if (scene === 'path') return <div className={`${styles.sceneFrame} ${styles.drillCapture}`}><Image src={`${base}drill.jpg`} alt="Dark Castle Drill lesson with a Black-to-move board, Hint and Answer controls, and the Black versus 1.e4 lesson stage" width={780} height={715} sizes="(max-width: 650px) 90vw, 45vw" /></div>
  if (scene === 'walk') return <div className={`${styles.sceneFrame} ${styles.walkCapture}`}><Image src={`${base}walkthrough.jpg`} alt="Dark Castle Walk-through lesson stages and the starting board" width={730} height={675} sizes="(max-width: 650px) 90vw, 45vw" /><Image src={`${base}walk-step.jpg`} alt="Walk-through explanation for the next pawn move with Next part and Play from here controls" width={725} height={128} sizes="(max-width: 650px) 80vw, 40vw" /></div>
  if (scene === 'mistake') return <div className={`${styles.sceneFrame} ${styles.mistakeCapture}`}><Image src={`${base}mistake-save.jpg`} alt="Save for practice action from a reviewed move" width={325} height={80} sizes="(max-width: 650px) 55vw, 25vw" /><span aria-hidden>↓</span><div><Image src={`${base}mistake-library-heading.jpg`} alt="Dark Castle Saved games with the Practice tab selected" width={520} height={140} sizes="(max-width: 650px) 80vw, 39vw" /><Image src={`${base}mistake-library-filter.jpg`} alt="All practice and My Mistakes filters" width={520} height={85} sizes="(max-width: 650px) 80vw, 39vw" /></div></div>
  if (scene === 'coach') return <CoachClip />
  if (scene === 'variation') return <div className={`${styles.sceneFrame} ${styles.variationCapture}`}><Image src={`${base}variation.jpg`} alt="Dark Castle variation board with a highlighted knight and piece silhouettes showing earlier squares" width={425} height={495} sizes="(max-width: 650px) 80vw, 35vw" /></div>
  return <div className={`${styles.sceneFrame} ${styles.candidatesCapture}`}><Image src={`${base}candidates.jpg`} alt="Dark Castle Candidates panel with three evaluated continuation lines for Black to move" width={745} height={840} sizes="(max-width: 650px) 80vw, 38vw" /></div>
}

function CoachClip() {
  const [failed, setFailed] = useState(false)
  const base = '/lead-magnets/dark-castle-capabilities/'
  return <div className={`${styles.sceneFrame} ${styles.coachCapture}`}>
    {failed ? <Image src={`${base}coach-loop-poster.jpg`} alt="Dark Castle Coach move review and board" width={360} height={682} /> :
      <video autoPlay muted loop playsInline controls preload="metadata" poster={`${base}coach-loop-poster.jpg`} aria-label="Dark Castle Coach move review and board in motion" onError={() => setFailed(true)}>
        <source src={`${base}coach-loop.mp4`} type="video/mp4" />
        Your browser cannot play this clip. The Coach view is described below.
      </video>}
  </div>
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
  const [activeCapability, setActiveCapability] = useState(0)

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
      <figure className={styles.heroProduct}><Image src="/lead-magnets/dark-castle-capabilities/drill.jpg" alt="Dark Castle Drill lesson with a chess position and study controls" width={780} height={715} priority /><figcaption><span>LEARN → PLAY → REVIEW → PRACTICE</span><strong>A move can become the next lesson.</strong></figcaption></figure>
    </section>

    <section className={styles.capabilities} aria-labelledby="capabilities-heading">
      <div className={styles.capabilitiesIntro}><p className={styles.eyebrow}>WHAT DARK CASTLE DOES DIFFERENTLY</p><h2 id="capabilities-heading">Keep the lesson close to the move.</h2><p>Lessons, play, review, and practice connect around choices on the board. These views come from Dark Castle’s browser and iOS builds.</p></div>
      <div className={styles.gallery} role="region" aria-label="Dark Castle capability gallery" tabIndex={0} onKeyDown={(event) => { if (event.key === 'ArrowRight') setActiveCapability((activeCapability + 1) % capabilities.length); if (event.key === 'ArrowLeft') setActiveCapability((activeCapability + capabilities.length - 1) % capabilities.length); if (event.key === 'Home') setActiveCapability(0); if (event.key === 'End') setActiveCapability(capabilities.length - 1) }}>
        <div className={styles.galleryRail} role="group" aria-label="Choose a capability">{capabilities.map((item, index) => <button key={item.step} type="button" onClick={() => setActiveCapability(index)} aria-current={index === activeCapability ? 'true' : undefined}>{item.step} <span>{item.label}</span></button>)}</div>
        <article className={styles.gallerySlide}>
          <div className={styles.galleryMedia}><CapabilityScene scene={capabilities[activeCapability].scene} /><p>{capabilities[activeCapability].label} / DARK CASTLE CHESS</p></div>
          <div className={styles.galleryCopy}><span>{capabilities[activeCapability].step} / {capabilities[activeCapability].label}</span><h3>{capabilities[activeCapability].title}</h3><p><b>{capabilities[activeCapability].trigger}.</b> {capabilities[activeCapability].response}</p><p>{capabilities[activeCapability].value}</p><div className={styles.galleryControls}><button type="button" onClick={() => setActiveCapability((activeCapability + capabilities.length - 1) % capabilities.length)} aria-label="Previous capability">← Previous</button><span aria-live="polite">{activeCapability + 1} of {capabilities.length}</span><button type="button" onClick={() => setActiveCapability((activeCapability + 1) % capabilities.length)} aria-label="Next capability">Next →</button></div></div>
        </article>
      </div>
      <aside className={styles.comparison} aria-labelledby="comparison-heading"><div><p className={styles.eyebrow}>A PLACE IN THE CHESS WORLD</p><h3 id="comparison-heading">A connected practice thread.</h3><p>Chess.com and Lichess offer broad places to play and study. Dark Castle focuses this experience on carrying a lesson into play, bringing a move back through review, and turning that finding into the next practice position.</p><figure className={styles.comparisonVisual}><Image src="/lead-magnets/dark-castle-capabilities/mistake-library-heading.jpg" alt="Dark Castle Saved games with the Practice tab selected" width={520} height={140} /><figcaption>Review becomes a place to practice again.</figcaption></figure></div><ul><li><strong>Chess.com</strong><span>Lessons, Game Review, and MoveTrainer give players several ways to study and retry.</span></li><li><strong>Lichess</strong><span>Analysis, studies, game-based puzzles, and learn-from-mistakes tools support its broad play community.</span></li><li><strong>Dark Castle</strong><span>Drill, Walk-through, review, My Mistakes, and Coach keep the learning loop close to the board.</span></li></ul></aside>
    </section>

    <section id="assessment" className={styles.journey} aria-labelledby="assessment-heading">
      <div className={styles.journeyIntro}>
        <p className={styles.eyebrow}>FROM THE GAME TO YOUR WORK</p>
        <h2 id="assessment-heading">Pick one decision worth revisiting.</h2>
        <p>Choose a recent product, policy, or investment decision. Answer four questions about the record behind it.</p>
        <span className={styles.progress}>{answered} of 4 checks complete</span>
        <figure className={styles.journeyVisual}><Image src="/lead-magnets/dark-castle-capabilities/variation.jpg" alt="Dark Castle variation board showing a piece's prior position" width={425} height={495} /><figcaption>On the board, the earlier position stays visible. What would help your team retrace a choice?</figcaption></figure>
      </div>
      <div className={styles.questionPair}>{TRACE_DIMENSIONS.slice(0, 2).map(renderQuestion)}</div>
      <div className={styles.questionPair}>{TRACE_DIMENSIONS.slice(2).map((item, index) => renderQuestion(item, index + 2))}</div>
    </section>

    <section className={styles.payoff} aria-label="Your score and worksheet">
      <div className={styles.payoffMain}>
        <div className={styles.result} aria-live="polite" aria-labelledby="result-heading">
          {result ? <><div className={styles.resultScore}><span>{result.total}<small>/ 8</small></span><p>YOUR TRACEABILITY SCORE</p></div><div className={styles.resultCopy}><p className={styles.eyebrow}>START HERE</p><h2 id="result-heading">{result.total === 8 ? 'Put your record to the test.' : `Make ${weakest!.label.toLowerCase()} visible.`}</h2><p>{result.total === 8 ? 'You have the essentials. Ask someone who was not in the room to read the record and tell you what would cause a review.' : weakest!.fix}</p><p className={styles.resultAction}><strong>Next action:</strong> Write one decision in the worksheet with an owner, a review trigger, and the evidence you used.</p></div></> : <><div className={styles.resultScore}><span>—<small>/ 8</small></span><p>YOUR TRACEABILITY SCORE</p></div><div className={styles.resultCopy}><p className={styles.eyebrow}>YOUR RESULT</p><h2 id="result-heading">See what needs attention.</h2><p>Answer four questions to get a score and a practical first step.</p></div></>}
        </div>
        <figure className={styles.payoffVisual}><Image src="/lead-magnets/dark-castle-capabilities/coach-review.jpg" alt="Dark Castle Coach review showing a move to study" width={740} height={490} /><figcaption>Review the move. Keep the reason.</figcaption></figure>
        <div className={styles.download} aria-labelledby="download-heading">
          <div><p className={styles.eyebrow}>THE FREE ONE-PAGE RECORD</p><h2 id="download-heading">Take the record with you.</h2><p>Keep the reason, owner, review trigger, and evidence together.</p><a className={styles.secondary} href="/decision-traceability-worksheet.pdf" download>Download the free PDF <span aria-hidden>↓</span></a><p className={styles.smallPrint}>No email required.</p></div>
          <div className={styles.paperPreview} aria-hidden><span>DARK CASTLE CHESS / FIELD NOTE 01</span><h3>Decision record</h3><div>01 &nbsp; The choice and why</div><div>02 &nbsp; The accountable owner</div><div>03 &nbsp; The trigger to revisit</div><div>04 &nbsp; Evidence and open questions</div><small>Created by AmaduTown</small></div>
          <figure className={styles.worksheetVisual}><Image src="/lead-magnets/dark-castle-capabilities/walk-step.jpg" alt="Dark Castle walk-through explaining the next move" width={725} height={128} /><figcaption>One move, one reason worth recording.</figcaption></figure>
        </div>
      </div>

      <section className={styles.capture} aria-labelledby="capture-heading">
        <div><p className={styles.eyebrow}>OPTIONAL FOLLOW-UP</p><h2 id="capture-heading">Want more tools for clearer decisions?</h2><p>Share your email if you would like practical notes from AmaduTown. The worksheet is yours either way.</p><figure className={styles.followupVisual}><Image src="/lead-magnets/dark-castle-capabilities/mistake-library-filter.jpg" alt="Dark Castle My Mistakes practice filter" width={520} height={85} /><figcaption>A useful record gives you a way back.</figcaption></figure></div>
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
