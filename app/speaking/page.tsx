'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown, ArrowRight, Check, RotateCcw } from 'lucide-react'
import {
  audienceOptions, formatOptions, outcomeOptions, topicOptions,
  recommendSpeakerFit, speakingServiceHref, type SpeakerFitInput,
} from '@/lib/speaker-fit'
import styles from './speaking.module.css'

const emptyBrief: SpeakerFitInput = { audience: '', outcome: '', format: '', topic: '' }

const talkDirections = [
  { number: '01', title: 'Agentic systems & AI governance', detail: 'Decision rights, accountability, and operating rhythms for teams working with agents.' },
  { number: '02', title: 'Practical AI & product transformation', detail: 'A builder’s view of discovery, product judgment, and the work that happens after a pilot.' },
  { number: '03', title: 'Access, equity & technology', detail: 'Who gets the tools, who shapes them, and what changes when communities build from their own knowledge.' },
  { number: '04', title: 'Systems that reduce burden', detail: 'Designing for the people closest to the work, with capacity and dignity in view.' },
  { number: '05', title: 'Books, authorship & ideas', detail: 'Conversations around The Equity Code, Accelerated, and Agentified, shaped by the questions in the room.' },
]

const questions = [
  { question: 'Can the talk fit our event theme?', answer: 'Start with the Speaker Fit Brief. It gives us a useful direction to discuss; the final talk is shaped with your audience and event goals in mind.' },
  { question: 'Is this an in-person engagement?', answer: 'The current Speaking Engagement service is listed as a one-hour, in-person engagement. Share your event format and location when you inquire so the scope is clear.' },
  { question: 'What should we send with an inquiry?', answer: 'Event date and location, audience, expected attendance, the decision or question you want people to leave with, and any accessibility requirements.' },
  { question: 'Can we discuss a panel or fireside conversation?', answer: 'Yes. Use the brief to describe the format you have in mind, then review the current service and discuss the fit before committing to a scope.' },
]

function ChoiceGroup({ legend, name, options, value, onChange }: {
  legend: string
  name: keyof SpeakerFitInput
  options: readonly { value: string; label: string }[]
  value: string
  onChange: (name: keyof SpeakerFitInput, value: string) => void
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend>{legend}</legend>
      <div className={styles.choices}>
        {options.map((option) => (
          <label key={option.value} className={`${styles.choice} ${value === option.value ? styles.choiceActive : ''}`}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(name, option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function SpeakingPage() {
  const [brief, setBrief] = useState<SpeakerFitInput>(emptyBrief)
  const [submitted, setSubmitted] = useState<SpeakerFitInput | null>(null)
  const [error, setError] = useState(false)
  const result = submitted ? recommendSpeakerFit(submitted) : null

  const change = (name: keyof SpeakerFitInput, value: string) => {
    setBrief((current) => ({ ...current, [name]: value }))
    setSubmitted(null)
    setError(false)
  }

  const generate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!recommendSpeakerFit(brief)) {
      setError(true)
      return
    }
    setError(false)
    setSubmitted({ ...brief })
  }

  const reset = () => {
    setBrief({ ...emptyBrief })
    setSubmitted(null)
    setError(false)
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="AmaduTown home">
          <Image src="/amadutown-logo-upscaled.png" alt="" width={27} height={34} priority />
          <span>AmaduTown</span>
        </Link>
        <nav aria-label="Speaking page navigation" className={styles.nav}>
          <a href="#topics">Talk directions</a>
          <a href="#brief">Speaker Fit Brief</a>
          <Link href={speakingServiceHref()} className={styles.navCta}>Explore the engagement <ArrowRight size={15} /></Link>
        </nav>
      </header>

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroMedia}>
          <Image
            src="/speaking/vambah-profile.jpg"
            alt="Vambah Sillah smiling in a brick-walled room"
            fill
            priority
            sizes="(max-width: 650px) 100vw, 64vw"
            className={styles.heroImage}
          />
        </div>
        <div className={styles.heroShade} />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>Vambah Sillah <span>·</span> Speaking</p>
          <h1 id="hero-title">A better question can <em>change the room.</em></h1>
          <p className={styles.heroIntro}>For audiences building with AI, navigating change, and asking who gets access to what comes next.</p>
          <div className={styles.heroActions}>
            <a href="#brief" className={styles.primaryCta}>Build your event brief <ArrowRight size={18} /></a>
            <Link href={speakingServiceHref()} className={styles.textCta}>View speaking service <ArrowRight size={16} /></Link>
          </div>
        </div>
        <a href="#approach" className={styles.scrollCue} aria-label="Explore the speaking approach">Explore <ArrowDown size={15} /></a>
      </section>

      <section className={styles.intro} id="approach">
        <div className={styles.sectionIndex}>The approach <span>001 / 004</span></div>
        <div className={styles.introGrid}>
          <h2>Give people a way to <em>move.</em></h2>
          <div>
            <p>People leave events with plenty to think about. The harder part comes on Monday, when a team has to make a decision with the time and resources it actually has.</p>
            <p>Vambah brings product strategy, community perspective, and hands-on AI work into the same conversation. The aim is a room that can see the system more clearly and take a practical next step.</p>
          </div>
        </div>
      </section>

      <section className={styles.topics} id="topics">
        <div className={styles.sectionIndex}>Talk directions <span>002 / 004</span></div>
        <div className={styles.sectionHeading}>
          <h2>Where the conversation can go.</h2>
          <p>These are starting points. The strongest talk begins with what your audience is working through.</p>
        </div>
        <div className={styles.topicList}>
          {talkDirections.map((talk) => (
            <div className={styles.topicRow} key={talk.number}>
              <span className={styles.topicNumber}>{talk.number}</span>
              <h3>{talk.title}</h3>
              <p>{talk.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.briefSection} id="brief">
        <div className={styles.sectionIndex}>For event organizers <span>003 / 004</span></div>
        <div className={styles.briefHeading}>
          <div>
            <p className={styles.kicker}>A useful place to start</p>
            <h2>The Speaker <em>Fit Brief.</em></h2>
          </div>
          <p>Choose what you know about the room. You’ll get a talk direction and a short planning checklist you can use immediately. Your choices stay in this browser.</p>
        </div>
        <form onSubmit={generate} className={styles.form} noValidate>
          <ChoiceGroup legend="Who will be in the room?" name="audience" options={audienceOptions} value={brief.audience} onChange={change} />
          <ChoiceGroup legend="What should they leave with?" name="outcome" options={outcomeOptions} value={brief.outcome} onChange={change} />
          <ChoiceGroup legend="What kind of session?" name="format" options={formatOptions} value={brief.format} onChange={change} />
          <ChoiceGroup legend="Which conversation feels timely?" name="topic" options={topicOptions} value={brief.topic} onChange={change} />
          {error && <p className={styles.error} role="alert">Choose one answer in each section to build your brief.</p>}
          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryCta}>Build my brief <ArrowRight size={18} /></button>
            <button type="button" onClick={reset} className={styles.reset}><RotateCcw size={15} /> Clear choices</button>
          </div>
        </form>
        {result && (
          <section className={styles.result} aria-live="polite" aria-label="Your speaker fit brief">
            <p className={styles.kicker}>Your speaker fit brief</p>
            <h3>{result.title}</h3>
            <p className={styles.resultFit}>{result.fit}</p>
            <p>{result.angle}</p>
            <h4>Next steps for your planning team</h4>
            <ul>{result.checklist.map((item) => <li key={item}><Check size={17} aria-hidden="true" />{item}</li>)}</ul>
            <Link href={speakingServiceHref(submitted!)} className={styles.resultCta}>Explore the Speaking Engagement <ArrowRight size={18} /></Link>
            <p className={styles.resultNote}>The service page carries your brief choices in its URL. No information has been submitted.</p>
          </section>
        )}
      </section>

      <section className={styles.proof} id="work">
        <div className={styles.sectionIndex}>The work behind the ideas <span>004 / 004</span></div>
        <div className={styles.proofGrid}>
          <div className={styles.proofCopy}>
            <h2>Ideas tested against <em>real work.</em></h2>
            <p>Vambah is a product strategist, author, and builder. At AmaduTown, his work connects AI and automation with the operating needs of organizations. His writing explores how technology, access, and human agency meet.</p>
            <div className={styles.proofLinks}>
              <Link href="/#publications">Explore publications <ArrowRight size={15} /></Link>
              <Link href="/services">Explore services <ArrowRight size={15} /></Link>
            </div>
          </div>
          <div className={styles.bookShelf}>
            <figure><Image src="/The_Equity_Code_Cover.webp" alt="Cover of The Equity Code" width={240} height={383} sizes="(max-width: 600px) 30vw, 180px" /><figcaption>The Equity Code</figcaption></figure>
            <figure><Image src="/accelerated_cover_ebook.webp" alt="Cover of Accelerated" width={240} height={360} sizes="(max-width: 600px) 30vw, 180px" /><figcaption>Accelerated</figcaption></figure>
            <figure><Image src="/agentified-cover.jpg" alt="Cover of Agentified" width={240} height={384} sizes="(max-width: 600px) 30vw, 180px" /><figcaption>Agentified</figcaption></figure>
          </div>
        </div>
      </section>

      <section className={styles.faq} id="faq">
        <h2>For the person planning the event.</h2>
        <div className={styles.faqList}>
          {questions.map(({ question, answer }) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}
        </div>
      </section>

      <footer className={styles.footer}>
        <div><p className={styles.kicker}>Bring the conversation to your room</p><h2>Start with the question your audience needs to answer.</h2></div>
        <Link href={speakingServiceHref()} className={styles.primaryCta}>Explore the Speaking Engagement <ArrowRight size={18} /></Link>
        <div className={styles.footerBottom}><span>Vambah Sillah · AmaduTown</span><Link href="/">Back to AmaduTown</Link></div>
      </footer>
    </main>
  )
}
