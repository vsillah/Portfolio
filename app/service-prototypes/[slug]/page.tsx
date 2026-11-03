'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BarChart3, Bot, BrainCircuit, ClipboardList, FileText, HelpCircle, MessageSquare, Route, Trophy, Users, Megaphone } from 'lucide-react'
import { useParams, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { prototypeForSlug } from '@/lib/service-prototypes'
import styles from './prototype.module.css'

type Lead = { name: string; need: string; source: string; priority: string; consent: string; status: string }
const leads: Lead[] = [
  { name: 'Morgan Ellis', need: 'Enrollment questions', source: 'Website chat', priority: 'High', consent: 'Follow-up approved', status: 'Needs a person' },
  { name: 'Casey Brooks', need: 'Program availability', source: 'Website chat', priority: 'Medium', consent: 'Follow-up approved', status: 'Qualified' },
  { name: 'Taylor Reed', need: 'Partnership inquiry', source: 'Contact form', priority: 'Medium', consent: 'No outreach consent', status: 'Review' },
]
const modules = ['Start with the decision', 'Turn feedback into signal', 'Build the learning plan', 'Govern the workflow']

function Chip({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'good' | 'warn' }) {
  return <span className={`${styles.chip} ${styles[tone]}`}>{children}</span>
}

function Card({ title, eyebrow, children, className = '' }: { title: string; eyebrow?: string; children: React.ReactNode; className?: string }) {
  return <section className={`${styles.card} ${className}`}>{eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}<h2>{title}</h2>{children}</section>
}

const samViews = ['Full framework', 'Signals', 'Alignment', 'Momentum'] as const
const signalInputs = ['Blank pages', 'Feedback', 'Questions', 'Observations'] as const
const signalIcons = [FileText, MessageSquare, HelpCircle, BarChart3] as const
const alignmentSteps = [
  { name: 'Metrics', detail: 'Agree on the measure that will tell the team whether the signal matters.' },
  { name: 'PRD', detail: 'Write the problem, evidence and decision rule in one working brief.' },
  { name: 'Roadmap', detail: 'Sequence the smallest useful test before scaling the plan.' },
  { name: 'Outcomes', detail: 'Review what changed for people and what the team learned.' },
  { name: 'Stakeholder buy-in', detail: 'Build shared ownership before the team moves up the alignment ladder.' },
] as const
const momentumExamples = [
  { name: 'StratQuest', detail: 'Frame the next strategic question.', position: 'Upper-left medallion' },
  { name: 'ClientQ', detail: 'Bring a client question into the loop.', position: 'Top medallion' },
  { name: 'SudoPoll', detail: 'Test a signal with a bounded poll.', position: 'Upper-right medallion' },
  { name: 'Learning Engine', detail: 'Carry evidence into the next cycle.', position: 'Lower-left medallion' },
  { name: 'AI Persuasive GPT', detail: 'Turn reviewed learning into a clearer message.', position: 'Lower-right medallion' },
] as const

function SamPlate({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  return <figure className={styles.samPlate} data-sam-plate><Image src={src} alt={alt} width={width} height={height} unoptimized/></figure>
}

function SignalsCanvas({ compact = false }: { compact?: boolean }) {
  const [input, setInput] = useState<(typeof signalInputs)[number]>('Feedback')
  const selectedIndex = signalInputs.indexOf(input)
  const selectedDetail = ['Choose the page or prompt the team needs to investigate.', 'Group the feedback into a pattern worth testing.', 'Turn the open question into a bounded test.', 'Compare observations and look for a repeatable signal.'][selectedIndex]
  return <article className={`${styles.samActCanvas} ${compact ? styles.samActCompact : ''}`} data-sam-act="signals">
    <header><span>ACT I · FROM BLANK PAGES TO BOLD IDEAS</span><h3>Signals</h3><p>Raw noise → clear signal</p></header>
    <div className={styles.samPlateLayout}>
      <SamPlate src="/showcases/service-prototypes/v2/sam-signals-plate.png" width={1024} height={1536} alt="Ornate gold synthesis funnel gathers pages, feedback, questions and observations, then points to a luminous target."/>
      <div className={styles.samControlPanel}><p className={styles.samPanelLabel}>Choose a workshop input</p><div className={styles.samControls} aria-label="Workshop inputs">{signalInputs.map((item, index) => { const Icon = signalIcons[index]; return <button type="button" key={item} aria-pressed={input === item} onClick={() => setInput(item)}><Icon size={18} aria-hidden="true"/><span>{item}</span></button> })}</div><div className={styles.samCallout} aria-live="polite"><span>TESTABLE SIGNAL</span><strong>{input} → one question to test</strong><p>{selectedDetail}</p></div></div>
    </div>
  </article>
}

function AlignmentCanvas({ compact = false }: { compact?: boolean }) {
  const [step, setStep] = useState<(typeof alignmentSteps)[number]>(alignmentSteps[0])
  const alignmentIcons = [BarChart3, ClipboardList, Route, Trophy, Users] as const
  return <article className={`${styles.samActCanvas} ${compact ? styles.samActCompact : ''}`} data-sam-act="alignment">
    <header><span>ACT II · FROM INSIGHTS TO IMPACT</span><h3>Alignment</h3><p>Insight → shared direction</p></header>
    <div className={styles.samPlateLayout}>
      <SamPlate src="/showcases/service-prototypes/v2/sam-alignment-plate.png" width={1060} height={1484} alt="Dimensional gold alignment pyramid: stakeholder handshakes at the base, ascending metric, PRD and roadmap platforms, and a trophy at the summit."/>
      <div className={styles.samControlPanel}><p className={styles.samPanelLabel}>Alignment canvas</p><div className={styles.samControls} aria-label="Alignment layers">{alignmentSteps.map((item, index) => { const Icon = alignmentIcons[index]; return <button type="button" key={item.name} aria-pressed={step.name === item.name} onClick={() => setStep(item)}><Icon size={18} aria-hidden="true"/><span>{item.name}</span></button> })}</div><div className={styles.samCallout} aria-live="polite"><span>SHARED DIRECTION</span><strong>{step.name}</strong><p>{step.detail}</p></div></div>
    </div>
  </article>
}

function MomentumCanvas({ compact = false }: { compact?: boolean }) {
  const [example, setExample] = useState<(typeof momentumExamples)[number]>(momentumExamples[3])
  const exampleIcons = [Route, MessageSquare, Bot, BrainCircuit, Megaphone] as const
  return <article className={`${styles.samActCanvas} ${compact ? styles.samActCompact : ''}`} data-sam-act="momentum">
    <header><span>ACT III · FROM TESTING TO TRANSFORMATION</span><h3>Momentum</h3><p>Systems that compound</p></header>
    <div className={styles.samPlateLayout}>
      <SamPlate src="/showcases/service-prototypes/v2/sam-momentum-plate.png" width={1254} height={1254} alt="Ornate six-segment gold compounding loop around an inner build, test and learn cycle, connected to five product medallions."/>
      <div className={styles.samControlPanel}><p className={styles.samPanelLabel}>Explore the product medallions</p><div className={`${styles.samControls} ${styles.samMomentumControls}`} aria-label="Momentum product examples">{momentumExamples.map((item, index) => { const Icon = exampleIcons[index]; return <button type="button" key={item.name} aria-pressed={example.name === item.name} onClick={() => setExample(item)}><Icon size={18} aria-hidden="true"/><span>{item.name}</span><small>{item.position}</small></button> })}</div><div className={styles.samCallout} aria-live="polite"><span>COMPOUNDING LEARNING</span><strong>{example.name}</strong><p>{example.detail}</p></div></div>
    </div>
  </article>
}

function SamArtifact({ initialView = 0, compact = false }: { initialView?: number; compact?: boolean }) {
  const [active, setActive] = useState(initialView)
  const dialog = useRef<HTMLDialogElement>(null)
  return <section className={`${styles.samArtifact} ${compact ? styles.samArtifactCompact : ''}`} aria-label="Signals, Alignment, Momentum framework">
    <div className={styles.samToolbar} role="group" aria-label="Framework views">{samViews.map((label, index) => <button key={label} type="button" aria-pressed={active === index} onClick={() => setActive(index)}>{label}</button>)}</div>
    <div className={styles.samCanvas} data-testid="sam-artifact">
      {active === 0 ? <div className={styles.samSystem} data-sam-view="full"><SignalsCanvas compact/><div className={styles.samBridge}>Structure It <span aria-hidden="true">↓</span></div><AlignmentCanvas compact/><div className={styles.samBridge}>Scale It <span aria-hidden="true">↓</span></div><MomentumCanvas compact/></div> : active === 1 ? <SignalsCanvas/> : active === 2 ? <AlignmentCanvas/> : <MomentumCanvas/>}
      <p className={styles.samPrinciple}>“The system that learns is the system that wins.” <span>— Vambah Sillah</span></p>
    </div>
    <button type="button" className={styles.samZoom} onClick={() => dialog.current?.showModal()}>View original book artifact</button>
    <dialog ref={dialog} className={styles.samDialog} aria-label="Full Signals, Alignment, Momentum infographic" onClick={(event) => { if (event.target === dialog.current) dialog.current?.close() }}><div className={styles.samDialogInner}><button type="button" onClick={() => dialog.current?.close()}>Close infographic</button><Image src="/showcases/service-prototypes/accelerated-sam-infographic.png" alt="Full Accelerated Signals, Alignment, Momentum infographic with funnel, alignment ladder, Structure It and Scale It bridges, compounding momentum loop, product examples and learning engine" width={1136} height={944} unoptimized/></div></dialog>
  </section>
}

function LeadChatbot({ view }: { view: number }) {
  const [messages, setMessages] = useState(['Welcome. What would you like to learn about our programs?', 'I’m looking for a program for my child.', 'I can help with that. What age group are you interested in?'])
  const [draft, setDraft] = useState('')
  const [consent, setConsent] = useState(false)
  const [handoff, setHandoff] = useState(false)
  const [selected, setSelected] = useState(0)
  if (view === 0) return <div className={styles.twoColumns}>
    <Card title="A welcoming first conversation" eyebrow="Northstar Learning · website experience">
      <p>Families can ask a question in their own words. The team keeps the final decision and the relationship.</p>
      <div className={styles.heroPhoto}><div><small>NORTHSTAR PROGRAMS</small><strong>Every family deserves a clear next step.</strong><span>Programs, enrollment, and support in one place.</span><div className={styles.heroPrograms}><span>Early learning</span><span>Family resources</span><span>Enrollment</span></div></div></div>
      <div className={styles.actionRow}><button onClick={() => setMessages([...messages, 'I would like to learn about enrollment.'])}>Ask about enrollment</button><button className={styles.secondary} onClick={() => setHandoff(true)}>Talk with a person</button></div>
    </Card>
    <Card title="Ask Northstar" eyebrow="Conversation preview">
      <div className={styles.chat}>{messages.map((message, index) => <p key={index} className={index % 2 ? styles.userBubble : styles.botBubble}>{message}</p>)}{handoff && <p className={styles.botBubble}>I can bring a team member into this conversation. Please share a contact method only if you want a follow-up.</p>}</div>
      <form className={styles.inputRow} onSubmit={(event) => { event.preventDefault(); if (draft.trim()) { setMessages([...messages, draft.trim(), 'Thanks. A team member can review this question with you.']); setDraft('') } }}><input aria-label="Your question" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type your question"/><button type="submit">Send</button></form>
      <label className={styles.check}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)}/> I agree to a follow-up from the team.</label>
      <p className={styles.note}>{consent ? 'Follow-up consent recorded in this preview.' : 'No follow-up is requested unless you opt in.'}</p>
    </Card>
  </div>
  if (view === 1) return <div className={styles.twoColumns}>
    <Card title="Conversation inbox" eyebrow="Operator workspace"><p>Review the question, qualification and permission before deciding who should respond.</p><div className={styles.list}>{leads.map((lead, index) => <button key={lead.name} className={selected === index ? styles.selectedRow : styles.row} onClick={() => setSelected(index)}><strong>{lead.name}</strong><span>{lead.need}</span><Chip tone={lead.status === 'Needs a person' ? 'warn' : 'plain'}>{lead.status}</Chip></button>)}</div></Card>
    <Card title={leads[selected].name} eyebrow="Lead summary"><div className={styles.facts}><span>Question</span><strong>{leads[selected].need}</strong><span>Source</span><strong>{leads[selected].source}</strong><span>Priority</span><strong>{leads[selected].priority}</strong><span>Permission</span><strong>{leads[selected].consent}</strong></div><p className={styles.note}>Suggested next step: {leads[selected].consent === 'No outreach consent' ? 'Keep in review; wait for the visitor to opt in.' : 'Assign a person to answer the specific question.'}</p><button disabled={leads[selected].consent === 'No outreach consent'} title={leads[selected].consent === 'No outreach consent' ? 'Follow-up requires consent' : undefined} onClick={() => setHandoff(true)}>Assign human follow-up</button>{handoff && <Chip tone="good">Handoff recorded for review</Chip>}</Card>
  </div>
  return <div className={styles.twoColumns}><Card title="Human handoff" eyebrow="Conversation state"><p>Morgan asked about enrollment timing and requested a person. The assistant gathered the question and stopped before making a promise about placement.</p><div className={styles.timeline}><p><b>10:14</b> Visitor asked about fall enrollment</p><p><b>10:15</b> Assistant clarified age range and preferred program</p><p><b>10:16</b> Visitor approved a follow-up</p><p><b>10:17</b> Human review requested</p></div></Card><Card title="What the operator receives" eyebrow="Ready for review"><div className={styles.facts}><span>Need</span><strong>Enrollment availability</strong><span>Preferred reply</span><strong>Email</strong><span>Consent</span><strong>Explicit opt-in</strong><span>Open question</span><strong>Which age group has space?</strong></div><p className={styles.note}>A staff member confirms availability before responding.</p><button onClick={() => setHandoff(true)}>{handoff ? 'Assigned to admissions' : 'Assign to admissions'}</button></Card></div>
}

function Workflow({ view }: { view: number }) {
  const [selected, setSelected] = useState(0)
  const [recovered, setRecovered] = useState(false)
  const [routed, setRouted] = useState(false)
  if (view === 0) return <div className={styles.twoColumns}><Card title="Lead intake" eyebrow="Operations queue"><p>New inquiries enter one review queue with source, consent and next action visible.</p><div className={styles.list}>{leads.map((lead, i) => <button key={lead.name} className={selected === i ? styles.selectedRow : styles.row} onClick={() => setSelected(i)}><strong>{lead.name}</strong><span>{lead.source}</span><Chip>{lead.status}</Chip></button>)}</div></Card><Card title="Qualification record" eyebrow={leads[selected].name}><div className={styles.facts}><span>Intent</span><strong>{leads[selected].need}</strong><span>Source</span><strong>{leads[selected].source}</strong><span>Consent</span><strong>{leads[selected].consent}</strong><span>Suggested route</span><strong>{selected === 2 ? 'Partnership review' : 'Admissions'}</strong></div><p className={styles.note}>Enrichment: program area and urgency are inferred for staff review. No external contact lookup runs in this prototype.</p></Card></div>
  if (view === 1) return <div className={styles.twoColumns}><Card title="Routing review" eyebrow="Decision desk"><div className={styles.metricGrid}><div><b>3</b><span>New inquiries</span></div><div><b>1</b><span>Needs human review</span></div><div><b>2h</b><span>Response target</span></div></div><div className={styles.timeline}><p><b>Step 1</b> Check source and permission</p><p><b>Step 2</b> Review qualification signals</p><p><b>Step 3</b> Assign owner and due time</p></div></Card><Card title="Morgan Ellis" eyebrow="Ready to route"><div className={styles.facts}><span>Priority</span><strong>High · enrollment timing</strong><span>Owner</span><strong>Admissions team</strong><span>SLA</span><strong>Reply within 2 hours</strong><span>Audit</span><strong>Human approval required</strong></div><button onClick={() => setRouted(true)}>{routed ? 'Routed to admissions' : 'Approve route'}</button>{routed && <p className={styles.note}>Route and due time recorded in this local preview.</p>}</Card></div>
  return <div className={styles.twoColumns}><Card title="Exceptions and recovery" eyebrow="Operations health"><p>An enrichment step timed out. The original inquiry remains available, and the retry is visible to the operator.</p><div className={styles.alert}><b>{recovered ? 'Recovered' : 'Needs attention'}</b><span>{recovered ? 'Enrichment replay completed. The item is ready for staff review.' : 'Program lookup timed out for Casey Brooks.'}</span></div><button onClick={() => setRecovered(true)} disabled={recovered}>{recovered ? 'Retry complete' : 'Retry lookup'}</button></Card><Card title="Audit trail" eyebrow="Casey Brooks"><div className={styles.timeline}><p><b>09:42</b> Inquiry received from website chat</p><p><b>09:42</b> Consent confirmed</p><p><b>09:43</b> Program lookup timed out</p><p><b>09:44</b> Item held for review</p>{recovered && <p><b>09:45</b> Retry succeeded; human review resumed</p>}</div><p className={styles.note}>No message is sent automatically from this preview.</p></Card></div>
}

function Website({ view }: { view: number }) {
  const [audience, setAudience] = useState<'families' | 'supporters'>('families')
  const [open, setOpen] = useState(false)
  if (view === 2) return <div className={styles.twoColumns}><Card title="A clear path on a small screen" eyebrow="Responsive experience"><p>Program information remains readable and the next action stays close at hand.</p><div className={styles.phonePreview}><div className={styles.phoneTop}>JULIE’S FAMILY LEARNING <span>☰</span></div><div className={styles.phonePhoto}>Learning support that meets families where they are</div><div className={styles.phoneBody}><b>Programs for real family schedules</b><p>Find the right support, then talk with the team.</p><button onClick={() => setOpen(true)}>Explore programs</button></div></div></Card><Card title="What changes on mobile" eyebrow="Navigation and next action"><div className={styles.timeline}><p><b>01</b> The program message leads</p><p><b>02</b> Navigation remains reachable</p><p><b>03</b> A clear program action follows</p></div><p className={styles.note}>This is a responsive presentation of the KinFlo-built experience, using a local interactive path.</p><button onClick={() => setOpen(true)}>Open program path</button>{open && <div className={styles.alert}><b>Program path opened</b><span>Choose a program, check the fit, then contact the team.</span></div>}</Card></div>
  return <div className={styles.twoColumns}><Card title={view === 0 ? "Julie's Family Learning" : view === 1 ? 'Find your way in' : 'A clear path on a small screen'} eyebrow="KinFlo-built example"><p>Learning support, family partnership and practical next steps belong together.</p><div className={styles.julieHero} role="img" aria-label="KinFlo-built Julie’s Family Learning homepage with learning support headline and program navigation"/><button className={styles.julieAction} onClick={() => setOpen(true)}>Explore program path</button><p className={styles.note}>Captured from the KinFlo-built Julie page. The path controls in this preview use sample states.</p></Card><Card title={view === 0 ? 'An experience with direction' : view === 1 ? 'Choose your path' : 'Mobile navigation'} eyebrow="Page flow"><div className={styles.segment}><button className={audience === 'families' ? styles.active : ''} onClick={() => setAudience('families')}>For families</button><button className={audience === 'supporters' ? styles.active : ''} onClick={() => setAudience('supporters')}>For supporters</button></div><div className={styles.pathCard}><b>{audience === 'families' ? 'Start with your child’s needs' : 'Help make support possible'}</b><p>{audience === 'families' ? 'See learning programs, understand eligibility and contact the team.' : 'Learn how to volunteer, partner or support the program.'}</p><button className={styles.secondary} onClick={() => setOpen(true)}>{audience === 'families' ? 'View program path' : 'View support path'}</button></div>{open && <div className={styles.alert}><b>{audience === 'families' ? 'Program path' : 'Support path'}</b><span>{audience === 'families' ? 'Choose a program, check the fit, then contact the team.' : 'Choose how to help, read the expectations, then contact the team.'}</span></div>}</Card></div>
}

function Cohort({ view }: { view: number }) {
  const [task, setTask] = useState(false)
  const [note, setNote] = useState('')
  return <div className={`${styles.twoColumns} ${styles.samLayout}`}><Card title={view === 0 ? 'Your cohort workspace' : view === 1 ? 'Live build session' : 'The learning plan'} eyebrow="Accelerated · facilitated cohort"><p>{view === 0 ? 'A shared rhythm for teams learning to make better product decisions with AI.' : view === 1 ? 'Work with a facilitator and peers on one decision from your own context.' : 'Record the assumption, signal, metric, review date and decision before building.'}</p><div className={styles.metricGrid}><div><b>04</b><span>Learning modules</span></div><div><b>02</b><span>Live sessions</span></div><div><b>{task ? '1/1' : '0/1'}</b><span>Current exercise</span></div></div><div className={styles.list}>{modules.map((module, i) => <div className={styles.row} key={module}><strong>{String(i + 1).padStart(2, '0')}</strong><span>{module}</span><Chip tone={i === 0 && task ? 'good' : 'plain'}>{i === 0 && task ? 'Done' : i === 0 ? 'Now' : 'Next'}</Chip></div>)}</div></Card><Card title={view === 1 ? 'Session room' : view === 2 ? 'Facilitated exercise' : 'This week’s work'} eyebrow={view === 1 ? '90-minute session' : 'The operating model'}><SamArtifact key={view} initialView={view === 1 ? 1 : view === 2 ? 2 : 0}/><label className={styles.field}>The decision we need to make<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write one decision in plain language"/></label><button onClick={() => setTask(true)} disabled={!note.trim()} title={!note.trim() ? 'Write a decision first' : undefined}>{task ? 'Exercise saved' : 'Save exercise'}</button><p className={styles.note}>{task ? 'Saved locally for this preview.' : 'Your facilitator will help pressure-test this with the group.'}</p></Card></div>
}

function Course({ view }: { view: number }) {
  const [lesson, setLesson] = useState(0)
  const [complete, setComplete] = useState(false)
  const [answer, setAnswer] = useState('')
  const [segment, setSegment] = useState(0)
  const segments = ['Name the decision your team needs to make.', 'List the evidence you have and the evidence you need.', 'Set a review date and decide what would change your mind.']
  return <div className={styles.twoColumns}><Card title="Accelerated: Building Smarter Products with AI" eyebrow="Self-paced learning"><p>Move through short lessons, practice on a real decision and keep the resources close.</p><div className={styles.progress}><span style={{ width: complete ? '100%' : '25%' }}/></div><p className={styles.note}>{complete ? 'Core lesson complete' : '1 of 4 modules started'}</p><div className={styles.list}>{modules.map((module, i) => <button key={module} className={lesson === i ? styles.selectedRow : styles.row} onClick={() => { setLesson(i); setSegment(0) }}><strong>{String(i + 1).padStart(2, '0')}</strong><span>{module}</span><Chip>{lesson === i ? 'Open' : 'View'}</Chip></button>)}</div><SamArtifact compact/></Card><Card title={view === 2 ? 'Check your understanding' : modules[lesson]} eyebrow={view === 0 ? 'Course overview' : view === 1 ? 'Guided lesson · transcript & resources' : 'Assessment & certificate'}>{view !== 2 ? <><div className={styles.videoStage}><small>GUIDED LESSON · {segment + 1} / {segments.length}</small><strong>{segments[segment]}</strong><button onClick={() => setSegment((segment + 1) % segments.length)}>{segment === segments.length - 1 ? 'Replay lesson' : 'Next segment'}</button></div><details open={view === 1}><summary>Read the lesson transcript</summary><p>Start with a decision your team needs to make. Name the evidence you have, the evidence you need and the review point. AI can help organize the material; your team owns the judgment.</p></details><details><summary>View lesson resources</summary><p>Decision worksheet · Learning plan template · Evidence review checklist</p></details><button onClick={() => setComplete(true)}>{complete ? 'Lesson complete' : 'Mark lesson complete'}</button></> : <><p>Which step comes first in an answer-driven discovery loop?</p><div className={styles.list}>{['Generate a roadmap', 'Name the decision', 'Choose a model'].map((item) => <label key={item} className={styles.choice}><input type="radio" name="assessment" checked={answer === item} onChange={() => setAnswer(item)}/>{item}</label>)}</div><button onClick={() => setComplete(true)} disabled={answer !== 'Name the decision'} title={answer !== 'Name the decision' ? 'Choose the decision first' : undefined}>Submit answer</button><div className={styles.certificate}>{complete ? 'Certificate milestone unlocked for this preview' : 'Certificate available after required lessons and assessment'}</div></>}</Card></div>
}

function Masterclass({ view }: { view: number }) {
  const [question, setQuestion] = useState('')
  const [questions, setQuestions] = useState(['Where should an executive team place the approval gate?'])
  const [checked, setChecked] = useState(false)
  return <div className={styles.twoColumns}><Card title={view === 0 ? 'The executive decision room' : view === 1 ? 'Your working brief' : 'Questions worth resolving'} eyebrow="Premium AI Masterclass"><div className={styles.stage}><Image src="/speaking/vambah-profile.jpg" alt="Vambah Sillah, masterclass instructor" width={136} height={170}/><div><small>INSTRUCTOR STAGE · SESSION PREVIEW</small><strong>Build an AI plan your team can govern.</strong><span>Vambah Sillah · AmaduTown</span></div></div><p>Focused discussion, a working brief and a concrete decision to take back to your team.</p><div className={styles.timeline}><p><b>01</b> Choose the business constraint</p><p><b>02</b> Place the human decision points</p><p><b>03</b> Set a test and review date</p></div></Card><Card title={view === 1 ? 'Executive workbook' : view === 2 ? 'Q&A and takeaways' : 'Session agenda'} eyebrow="Decision support">{view === 1 ? <><p>Use the workbook to turn the session into one bounded next step.</p><label className={styles.check}><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)}/> We have named the owner of the decision.</label><div className={styles.facts}><span>Decision</span><strong>Where will AI reduce waiting?</strong><span>Guardrail</span><strong>A person approves external action</strong><span>Review</span><strong>Measure quality and staff time</strong></div><Chip tone={checked ? 'good' : 'warn'}>{checked ? 'Owner confirmed' : 'Owner still needed'}</Chip></> : view === 2 ? <><form className={styles.inputRow} onSubmit={(event) => { event.preventDefault(); if (question.trim()) { setQuestions([...questions, question.trim()]); setQuestion('') } }}><input aria-label="Ask a question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Add a question for the room"/><button type="submit">Add</button></form><div className={styles.list}>{questions.map((item, i) => <div className={styles.row} key={i}><strong>Q{i + 1}</strong><span>{item}</span></div>)}</div><div className={styles.pathCard}><b>Takeaway</b><p>Start with one workflow, name the owner, test quality and keep a human at consequential gates.</p></div></> : <><div className={styles.metricGrid}><div><b>60</b><span>Minutes of teaching</span></div><div><b>30</b><span>Minutes of Q&A</span></div><div><b>1</b><span>Executive brief</span></div></div><p className={styles.note}>The recording and workbook are part of the full delivery. This prototype shows the session structure.</p></>}</Card></div>
}

export default function ServicePrototypePage() {
  const { slug } = useParams() as { slug: string }
  const search = useSearchParams()
  const prototype = prototypeForSlug(slug)
  const initial = useMemo(() => Math.max(0, Math.min(2, Number(search.get('view') || 1) - 1 || 0)), [search])
  const [view, setView] = useState(initial)
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  if (!prototype) return <main className={styles.missing}><h1>Prototype unavailable</h1><p>This service preview could not be found.</p><Link href="/services">Return to services</Link></main>
  const content = slug === 'ai-lead-chatbot' ? <LeadChatbot view={view}/> : slug === 'lead-workflow-agent' ? <Workflow view={view}/> : slug === 'website-ux-refresh' ? <Website view={view}/> : slug === 'accelerated-cohort' ? <Cohort view={view}/> : slug === 'self-paced-course' ? <Course view={view}/> : <Masterclass view={view}/>
  return <main className={`${styles.shell} ${dark ? styles.dark : ''}`} data-prototype={slug}>
    <header className={styles.header}><div className={styles.brand}><Image src="/amadutown-logo-upscaled.png" alt="AmaduTown" width={34} height={46}/><span>AmaduTown <small>Service experiences</small></span></div><div className={styles.headerActions}><Link href="/services">All services</Link><button aria-label={dark ? 'Use light mode' : 'Use dark mode'} onClick={() => setTheme(dark ? 'light' : 'dark')}>{dark ? 'Light mode' : 'Dark mode'}</button></div></header>
    <div className={styles.container}><div className={`${styles.intro} ${slug === 'accelerated-cohort' ? styles.cohortIntro : ''}`}><div><p className={styles.eyebrow}>Explore the experience</p><h1>{prototype.title}</h1><p>See how the service could work in practice. Names and activity in this interactive preview are fictional.</p></div>{slug === 'accelerated-cohort' ? <figure className={styles.cohortBookFeature}><Image src="/accelerated_cover_ebook.jpg" alt="Accelerated: Building Smarter Products with AI book cover by Vambah Sillah" width={140} height={210} priority unoptimized data-testid="accelerated-cover"/><figcaption>Accelerated · Vambah Sillah</figcaption></figure> : <Chip>Interactive preview</Chip>}</div><nav className={styles.tabs} aria-label="Experience views">{prototype.views.map((label, index) => <button key={label} aria-current={view === index ? 'page' : undefined} className={view === index ? styles.active : ''} onClick={() => setView(index)}>{label}</button>)}</nav>{content}<footer className={styles.footer}>This preview uses sample information. We shape the final experience around your team, audience and operating constraints.</footer></div>
  </main>
}
