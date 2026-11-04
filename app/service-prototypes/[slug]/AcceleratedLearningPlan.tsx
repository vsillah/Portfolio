'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import transcript from '@/docs/accelerated-course-modules/l01-guided-video/approved-composite/l01-approved-transcript.json'
import l02Transcript from '@/docs/accelerated-course-modules/l02-native-composite/l02-learner-transcript.json'
import styles from './learning-plan.module.css'

export const l01Media = {
  video: '/accelerated/lessons/l01/approved-ee09bf72/accelerated-l01-native-composite.mp4',
  captions: '/accelerated/lessons/l01/approved-ee09bf72/l01-approved-captions.vtt',
  duration: '09:00',
} as const

export const l02Media = {
  video: '/accelerated/lessons/l02/approved-ded23edb/accelerated-l02-native-composite.mp4',
  captions: '/accelerated/lessons/l02/approved-ded23edb/l02-captions.vtt',
  duration: '10:00',
  compositeSha256: 'ded23edb31cd957689617e3d132f1360957ffe3a60bb5274f478f910b09e3af6',
  sourceSha256: '2beae8254c76a6f8bf168afb8483e83e63c13b621ec3934c81397d3167cd1a3d',
  captionsSourceSha256: 'ed1f824f36a64d9b783266c54a9840e2d89a71e1e526bd55efbbea7359d70ca0',
} as const

type Act = 'Signals' | 'Alignment' | 'Momentum' | 'Synthesis'
type Lesson = { id: string; title: string; minutes: number; act: Act; summary: string; exercise: string; artifact: string }

// Learner copy is derived from the approved 16-lesson outline. Production packets remain in docs.
export const lessons: Lesson[] = [
  { id: 'L01', title: 'Build smarter, stay human', minutes: 9, act: 'Signals', summary: 'Spot when faster output is outrunning your team’s ability to decide and learn.', exercise: 'Name one live decision. Sort its inputs into public, approved internal, and restricted.', artifact: 'Decision-file cover sheet and data-use boundary' },
  { id: 'L02', title: 'Prioritize before generating', minutes: 10, act: 'Signals', summary: 'Choose one decision worth testing from a crowded list of requests.', exercise: 'Compare three options by customer pain, value, learning, risk, and reversibility.', artifact: 'Priority decision with two rejected alternatives' },
  { id: 'L03', title: 'Answer-driven discovery', minutes: 9, act: 'Signals', summary: 'Ask for evidence that could change a named decision.', exercise: 'Write your current answer, the strongest objection, and one evidence gap.', artifact: 'Decision question and evidence-gap card' },
  { id: 'L04', title: 'Build small; keep personas alive', minutes: 10, act: 'Signals', summary: 'Turn a static persona into a customer situation you can test and revisit.', exercise: 'Describe a job, context, observed signal, uncertainty, and validation question.', artifact: 'Living persona card' },
  { id: 'L05', title: 'From feedback to signal', minutes: 10, act: 'Alignment', summary: 'Find a pattern in feedback without losing its source or the counterexample.', exercise: 'Code six synthetic comments, name one pattern, and flag what contradicts it.', artifact: 'Feedback-to-signal ledger' },
  { id: 'L06', title: 'Roadmap to PRD, without drift', minutes: 11, act: 'Alignment', summary: 'Keep a roadmap choice connected to evidence through the build handoff.', exercise: 'Trace one bet into acceptance criteria and a measure of success.', artifact: 'Roadmap and PRD trace card' },
  { id: 'L07', title: 'Commit to learning', minutes: 10, act: 'Alignment', summary: 'Put answerable questions beside delivery dates.', exercise: 'Turn one milestone into a learning question, review date, and possible adjustment.', artifact: 'Two-checkpoint learning roadmap' },
  { id: 'L08', title: 'Metrics and the ten-part learning plan', minutes: 12, act: 'Alignment', summary: 'Set a measure and a stop or pivot threshold before results arrive.', exercise: 'Complete the ten book fields and define the measure tied to your decision.', artifact: 'Ten-component learning plan' },
  { id: 'L09', title: 'Map the decision theater', minutes: 11, act: 'Alignment', summary: 'See who can move, slow, or stop a decision and what each person needs.', exercise: 'Map four fictional roles, their objections, and the evidence they need.', artifact: 'Decision theater map' },
  { id: 'L10', title: 'Influence before impact', minutes: 9, act: 'Alignment', summary: 'Make a responsible case for a choice while showing its tradeoffs.', exercise: 'Draft a 90-second recommendation and say what would change your mind.', artifact: 'Stakeholder decision brief' },
  { id: 'L11', title: 'From the shift to a repeatable loop', minutes: 10, act: 'Momentum', summary: 'Carry the learning from one decision into the next.', exercise: 'Draw your workflow and mark the missing review or memory handoff.', artifact: 'Signal-to-decision loop map' },
  { id: 'L12', title: 'Jobs and synthetic signals', minutes: 11, act: 'Momentum', summary: 'Use synthesis and simulation as hypotheses that need checking with people.', exercise: 'Write a job statement, two simulation questions, and the real evidence needed.', artifact: 'Jobs and validation card' },
  { id: 'L13', title: 'Strategic shifts and future concepts', minutes: 11, act: 'Momentum', summary: 'Explore a business-model change before committing resources.', exercise: 'Choose an alternative, its smallest falsifiable test, and a short concept story.', artifact: 'Strategic alternatives and concept-test card' },
  { id: 'L14', title: 'The last mile of influence', minutes: 8, act: 'Momentum', summary: 'Adapt a proposal to its audience while keeping the evidence intact.', exercise: 'Write two short pitches and flag any sentence that outruns the source.', artifact: 'Two-audience pitch card' },
  { id: 'L15', title: 'Governance and the system that learns', minutes: 12, act: 'Synthesis', summary: 'Help another team reuse a useful loop with its owner and stop condition intact.', exercise: 'Name one rule a second team needs before reusing your test.', artifact: 'Scale-readiness and decision-memory record' },
  { id: 'L16', title: 'What comes next', minutes: 8, act: 'Synthesis', summary: 'Leave with one accountable learning move for the next seven days.', exercise: 'Choose an action, a review owner, and a condition that changes the plan.', artifact: 'One-week commitment and assembled decision file' },
]

const acts: { name: Act; line: string; image: string }[] = [
  { name: 'Signals', line: 'Find the decision and the evidence that matters.', image: '/showcases/service-prototypes/v2/sam-signals-plate.webp' },
  { name: 'Alignment', line: 'Carry evidence into a shared plan and a clear decision.', image: '/showcases/service-prototypes/v2/sam-alignment-plate.webp' },
  { name: 'Momentum', line: 'Make each test useful to the next one.', image: '/showcases/service-prototypes/v2/sam-momentum-plate.webp' },
  { name: 'Synthesis', line: 'Set the next move, owner, and review point.', image: '/showcases/service-prototypes/accelerated-sam-infographic.png' },
]

const storyboard: Record<string, string> = {
  L05: '/showcases/accelerated-learning-plan/storyboard-l05.png',
  L08: '/showcases/accelerated-learning-plan/storyboard-l08.png',
  L11: '/showcases/accelerated-learning-plan/storyboard-l11.png',
  L16: '/showcases/accelerated-learning-plan/storyboard-l16.png',
}

export function AcceleratedLearningPlan() {
  const detailRef = useRef<HTMLElement>(null)
  const playerRef = useRef<HTMLElement>(null)
  const watchRef = useRef<HTMLButtonElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [selected, setSelected] = useState('L01')
  const [videoOpen, setVideoOpen] = useState(false)
  const [captionsOn, setCaptionsOn] = useState(true)
  const [filter, setFilter] = useState<Act | 'All'>('All')
  const [query, setQuery] = useState('')
  const [completed, setCompleted] = useState<string[]>([])
  const lesson = lessons.find((item) => item.id === selected) ?? lessons[0]
  const act = acts.find((item) => item.name === lesson.act) ?? acts[0]
  const visible = lessons.filter((item) => (filter === 'All' || item.act === filter) && `${item.id} ${item.title} ${item.summary}`.toLowerCase().includes(query.toLowerCase().trim()))
  const current = lessons.find((item) => !completed.includes(item.id))?.id
  const next = lessons[lessons.findIndex((item) => item.id === lesson.id) + 1]
  const totalMinutes = lessons.reduce((sum, item) => sum + item.minutes, 0)
  const locked = (id: string) => id !== 'L01' && id !== 'L02'
  useEffect(() => {
    if (videoOpen) {
      playerRef.current?.focus()
      playerRef.current?.scrollIntoView?.({ block: 'start' })
    }
  }, [videoOpen])
  const selectLesson = (id: string) => {
    setSelected(id)
    setVideoOpen(false)
    if (window.matchMedia?.('(max-width: 1050px)').matches) {
      detailRef.current?.scrollIntoView({ block: 'start' })
    }
  }
  const setCaptionMode = (enabled: boolean) => {
    setCaptionsOn(enabled)
    const track = videoRef.current?.textTracks[0]
    if (track) track.mode = enabled ? 'showing' : 'disabled'
  }

  return <section className={styles.plan} aria-label="Accelerated learning plan">
    <div className={styles.heading}>
      <div><p className={styles.kicker}>YOUR LEARNING PLAN</p><h2>Sixteen lessons. One decision file.</h2><p>Bring one safe, real decision through the course. Each lesson adds a page you can review with your team.</p></div>
      <div className={styles.overview}><strong>{completed.length}<span> / 16</span></strong><span>lessons complete in this preview</span><progress value={completed.length} max={16} aria-label="Lessons complete"/><small>{totalMinutes} minutes of planned teaching · practice time is separate</small></div>
    </div>
    <div className={styles.layout}>
      <div className={styles.catalog}>
        <div className={styles.catalogTools}><label htmlFor="lesson-search">Find a lesson</label><input id="lesson-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles or topics"/><div className={styles.filters} role="group" aria-label="Filter lessons by act">{(['All', 'Signals', 'Alignment', 'Momentum', 'Synthesis'] as const).map((name) => <button type="button" key={name} aria-pressed={filter === name} onClick={() => setFilter(name)}>{name}</button>)}</div></div>
        {visible.length === 0 ? <div className={styles.empty}><strong>No lessons found.</strong><p>Try another term or show the full plan.</p><button type="button" onClick={() => { setQuery(''); setFilter('All') }}>Show all lessons</button></div> : acts.map((group) => {
          const groupLessons = visible.filter((item) => item.act === group.name)
          if (!groupLessons.length) return null
          return <section key={group.name} className={styles.actGroup} aria-label={`${group.name} lessons`}><div className={styles.actHeader}><div><h3>{group.name}</h3><p>{group.line}</p></div><span>{groupLessons.length} lessons</span></div><div className={styles.lessonList}>{groupLessons.map((item) => <button type="button" key={item.id} className={styles.lessonRow} aria-label={`${item.id}: ${item.title}, ${locked(item.id) ? 'locked' : completed.includes(item.id) ? 'complete' : current === item.id ? 'current' : 'ready'}`} aria-current={selected === item.id ? 'true' : undefined} onClick={() => selectLesson(item.id)}><span className={styles.lessonNumber}>{item.id}</span><span className={styles.lessonName}><strong>{item.title}</strong><small>{item.minutes} min · {item.artifact}</small></span><span className={styles.state} data-state={locked(item.id) ? 'locked' : completed.includes(item.id) ? 'complete' : current === item.id ? 'current' : 'ready'}>{locked(item.id) ? 'Locked' : completed.includes(item.id) ? 'Complete' : current === item.id ? 'Current' : 'Ready'}</span></button>)}</div></section>
        })}
      </div>
      <article ref={detailRef} className={styles.detail} aria-live="polite">
        <div className={styles.detailTop}><span>{lesson.id} · {lesson.act} · {lesson.minutes} min</span><span className={styles.detailState} data-state={locked(lesson.id) ? 'locked' : completed.includes(lesson.id) ? 'complete' : current === lesson.id ? 'current' : 'ready'}>{locked(lesson.id) ? 'Video locked · brief preview' : completed.includes(lesson.id) ? 'Complete' : current === lesson.id ? 'Current lesson' : 'Ready to explore'}</span></div>
        <h3>{lesson.title}</h3><p className={styles.summary}>{lesson.summary}</p>
        <div className={styles.visuals}><figure><Image src={act.image} alt={`${lesson.act} visual from the Accelerated workshop`} width={520} height={350} unoptimized/><figcaption>{lesson.act} · approved workshop visual</figcaption></figure>{storyboard[lesson.id] && <figure><Image src={storyboard[lesson.id]} alt={`Representative storyboard frame for ${lesson.id}`} width={520} height={350} unoptimized/><figcaption>Storyboard preview · representative frame</figcaption></figure>}</div>
        <div className={styles.practice}><div><span>TRY IT</span><p>{lesson.exercise}</p></div><div><span>ADD TO YOUR DECISION FILE</span><p>{lesson.artifact}</p></div></div>
        {lesson.id === 'L01' ? videoOpen ? <section ref={playerRef} tabIndex={-1} className={styles.player} aria-label="L01 guided video">
          <div className={styles.playerHeading}><div><strong>Guided video · L01</strong><p>Watch the nine-minute lesson, then use the exercise above to start your decision file.</p></div><button type="button" className={styles.returnButton} onClick={() => { setVideoOpen(false); window.requestAnimationFrame(() => watchRef.current?.focus()) }}>← Return to Learning plan</button></div>
          <video ref={videoRef} controls playsInline preload="metadata" aria-label="L01 Build smarter, stay human guided video" onLoadedMetadata={() => setCaptionMode(captionsOn)}>
            <source src={l01Media.video} type="video/mp4" />
            <track kind="captions" src={l01Media.captions} srcLang="en" label="English captions" default />
            Your browser cannot play this video. The read-along transcript is available below.
          </video>
          <div className={styles.playerTools}><span>Duration {l01Media.duration}</span><button type="button" aria-pressed={captionsOn} onClick={() => setCaptionMode(!captionsOn)}>English captions {captionsOn ? 'on' : 'off'}</button></div>
          <details className={styles.transcript}><summary>Read along with L01 transcript</summary><ol>{transcript.cues.map((cue, index) => <li key={`${cue.start}-${index}`}><time>{cue.start}</time><span>{cue.text}</span></li>)}</ol></details>
        </section> : <div className={styles.mediaNotice}><strong>L01 guided video is ready</strong><p>Watch the approved nine-minute lesson with English captions and a read-along transcript.</p><button ref={watchRef} type="button" onClick={() => setVideoOpen(true)}>Watch L01 guided video · 09:00</button></div> : lesson.id === 'L02' ? videoOpen ? <section ref={playerRef} tabIndex={-1} className={styles.player} aria-label="L02 guided video">
          <div className={styles.playerHeading}><div><strong>Guided video · L02</strong><p>Watch the ten-minute lesson, then choose one priority to test in your decision file.</p></div><button type="button" className={styles.returnButton} onClick={() => { setVideoOpen(false); window.requestAnimationFrame(() => watchRef.current?.focus()) }}>← Return to Learning plan</button></div>
          <video ref={videoRef} controls playsInline preload="metadata" aria-label="L02 Prioritize before generating guided video" onLoadedMetadata={() => setCaptionMode(captionsOn)}>
            <source src={l02Media.video} type="video/mp4" />
            <track kind="captions" src={l02Media.captions} srcLang="en" label="English captions" default />
            Your browser cannot play this video. The read-along transcript is available below.
          </video>
          <div className={styles.playerTools}><span>Duration {l02Media.duration}</span><button type="button" aria-pressed={captionsOn} onClick={() => setCaptionMode(!captionsOn)}>English captions {captionsOn ? 'on' : 'off'}</button></div>
          <details className={styles.transcript}><summary>Read along with L02 transcript</summary><ol>{l02Transcript.cues.map((cue, index) => <li key={`${cue.start}-${index}`}><time>{cue.start}</time><span>{cue.text}</span></li>)}</ol></details>
        </section> : <div className={styles.mediaNotice}><strong>L02 guided video is ready</strong><p>Watch the approved ten-minute composite with English captions and a read-along transcript. Some visual passages are intentionally silent.</p><button ref={watchRef} type="button" onClick={() => setVideoOpen(true)}>Watch L02 guided video · 10:00</button></div> : <div className={styles.mediaNotice}><strong>Guided video is pending</strong><p>The lesson brief and visual preview are available here. Recorded teaching and worksheets will appear after production review.</p><button type="button" disabled aria-label={`Watch ${lesson.id} guided video, unavailable until production review`}>Video unavailable</button></div>}
        <div className={styles.actions}><button type="button" disabled={locked(lesson.id)} title={locked(lesson.id) ? 'Completion opens after the guided video is approved' : undefined} onClick={() => setCompleted((items) => items.includes(lesson.id) ? items.filter((id) => id !== lesson.id) : [...items, lesson.id])}>{locked(lesson.id) ? 'Completion unavailable' : completed.includes(lesson.id) ? 'Mark as incomplete' : 'Mark lesson complete'}</button>{next && <button type="button" className={styles.secondary} onClick={() => { selectLesson(next.id); setFilter('All'); setQuery('') }}>Next lesson · {next.id}</button>}</div>
        <p className={styles.previewNote}>Progress is for this preview only. Use public, synthetic, or approved material in the exercises.</p>
      </article>
    </div>
  </section>
}
