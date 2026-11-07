'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Download, Menu, Save, Send, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AGENTIFIED_GUEST_KEY, AGENTIFIED_VERSION, agentifiedActs, agentifiedLessons, emptyAgentifiedDraft, validateAgentifiedState, type AgentifiedDraft, type AgentifiedState } from '@/lib/agentified-workshop'
import styles from './workshop.module.css'
import { agentifiedLessonPosters, agentifiedPosterAlt } from '@/lib/agentified-lesson-posters'
import { AgentifiedLessonHero } from './AgentifiedLessonHero'

type Mode = 'plan' | 'file'
const lessonById = (id: string) => agentifiedLessons.find((lesson) => lesson.id === id) ?? agentifiedLessons[0]
const newState = (worksheetId: string): AgentifiedState => ({ version: AGENTIFIED_VERSION, worksheet: emptyAgentifiedDraft(worksheetId), completed: [], videoSeconds: {}, currentLessonId: 'L01', updatedAt: new Date().toISOString() })

export function AgentifiedWorkshop({ mode }: { mode: Mode }) {
  const [state, setState] = useState<AgentifiedState | null>(null)
  const [ready, setReady] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [memberToken, setMemberToken] = useState<string | null>(null)
  const [memberEmail, setMemberEmail] = useState('')
  const [memberName, setMemberName] = useState('')
  const [claimed, setClaimed] = useState(false)
  const revisionRef = useRef(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [consent, setConsent] = useState(false)
  const memberUser = useRef<string | null>(null)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const detailRef = useRef<HTMLElement>(null)
  const selected = state?.currentLessonId ?? 'L01'
  const lesson = lessonById(selected)
  const started = Object.values(state?.worksheet.answers ?? {}).filter((answer) => answer.trim()).length

  useEffect(() => {
    let next = newState(crypto.randomUUID())
    try {
      const raw = localStorage.getItem(AGENTIFIED_GUEST_KEY)
      if (raw) {
        const checked = validateAgentifiedState(JSON.parse(raw))
        if (checked.ok) next = checked.state
        else setNotice(checked.error)
      }
    } catch { setNotice('Local storage is unavailable. Download a copy to keep your work.') }
    const requested = new URLSearchParams(window.location.search).get('lesson')?.toUpperCase()
    if (requested && agentifiedLessons.some((item) => item.id === requested)) next = { ...next, currentLessonId: requested }
    setState(next)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready || !state || claimed) return
    try { localStorage.setItem(AGENTIFIED_GUEST_KEY, JSON.stringify({ ...state, updatedAt: new Date().toISOString() })) }
    catch { setNotice('Local storage is unavailable. Download a copy to keep your work.') }
  }, [state, ready, claimed])

  useEffect(() => {
    let active = true
    async function loadMember() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active || !session) return
      memberUser.current = session.user.id
      setMemberToken(session.access_token)
      setMemberEmail(session.user.email ?? '')
      setMemberName(typeof session.user.user_metadata?.full_name === 'string' ? session.user.user_metadata.full_name : '')
      try {
        const response = await fetch('/api/agentified/member', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' })
        if (!response.ok) { setNotice('Account progress is unavailable. Your local work is still here.'); return }
        const result = await response.json()
        if (!active || !result.enrollment) return
        revisionRef.current = result.enrollment.revision
        setClaimed(true)
        setState({
          version: AGENTIFIED_VERSION,
          worksheet: result.worksheet ? { version: AGENTIFIED_VERSION, worksheetId: result.worksheet.worksheet_id, answers: result.worksheet.answers, updatedAt: result.worksheet.updated_at } : emptyAgentifiedDraft(crypto.randomUUID()),
          completed: result.lessons.filter((item: { completed_at: string | null }) => item.completed_at).map((item: { lesson_id: string }) => item.lesson_id),
          videoSeconds: Object.fromEntries(result.lessons.map((item: { lesson_id: string; video_seconds: number }) => [item.lesson_id, item.video_seconds])),
          currentLessonId: result.enrollment.current_lesson_id,
          updatedAt: result.enrollment.updated_at,
        })
      } catch { setNotice('Account progress is unavailable. Your local work is still here.') }
    }
    void loadMember()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (memberUser.current && session?.user.id !== memberUser.current) window.location.reload()
      else setMemberToken(session?.access_token ?? null)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  const update = (mutate: (current: AgentifiedState) => AgentifiedState) => setState((current) => current ? { ...mutate(current), updatedAt: new Date().toISOString() } : current)
  const select = (id: string) => {
    update((current) => ({ ...current, currentLessonId: id }))
    window.history.replaceState(null, '', `${window.location.pathname}?lesson=${id}`)
    setNavOpen(false)
    if (window.matchMedia('(max-width: 900px)').matches) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start' }))
  }
  const answer = (id: string, value: string) => {
    update((current) => ({ ...current, worksheet: { ...current.worksheet, answers: { ...current.worksheet.answers, [id]: value }, updatedAt: new Date().toISOString() } }))
    setConsent(false)
  }
  const sendProgress = async (action: 'claim' | 'save', snapshot = state) => {
    if (!snapshot || !memberToken) return false
    let accepted = false
    saveQueue.current = saveQueue.current.then(async () => {
      const response = await fetch('/api/agentified/member', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` }, body: JSON.stringify({ action, consent: action === 'claim', expectedRevision: revisionRef.current, state: { ...snapshot, updatedAt: new Date().toISOString() } }) })
      const result = await response.json()
      if (!response.ok) { setNotice(result.error || 'Could not save. Reload before trying again.'); return }
      revisionRef.current = result.revision
      if (action === 'claim') { setClaimed(true); localStorage.removeItem(AGENTIFIED_GUEST_KEY) }
      setNotice(action === 'claim' ? 'This work is now linked to your member account.' : 'Saved to your member account.')
      accepted = true
    }).catch(() => setNotice('Could not save. Your local work is still here.'))
    await saveQueue.current
    return accepted
  }
  useEffect(() => {
    if (!claimed || !state || busy) return
    const timer = window.setTimeout(() => { void sendProgress('save', state) }, 1400)
    return () => window.clearTimeout(timer)
    // Save follows the current state after claim; the queue serializes writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, claimed])
  const command = async (action: 'save' | 'delete' | 'submit', answers = state?.worksheet.answers ?? {}) => {
    if (!state || !memberToken || !claimed) return false
    setBusy(true)
    setNotice(action === 'submit' ? 'Sending for human review…' : 'Saving…')
    try {
      await saveQueue.current
      const response = await fetch('/api/agentified/member/operating-file', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` }, body: JSON.stringify({ action, commandId: crypto.randomUUID(), expectedRevision: revisionRef.current, draft: { ...state.worksheet, answers }, name: memberName.trim(), email: memberEmail, consent: action === 'submit' && consent }) })
      const result = await response.json()
      if (!response.ok) { setNotice(result.error || 'Could not complete this action. Reload before trying again.'); return false }
      revisionRef.current = result.revision
      setNotice(action === 'submit' ? 'Operating File received for human review. No purchase or project was created.' : action === 'delete' ? 'Saved responses were cleared. A review copy already sent remains with AmaduTown.' : 'All pages saved to your member account.')
      if (action === 'submit') { setReviewOpen(false); setConsent(false) }
      return true
    } catch { setNotice('Could not connect. Your work is still on this device.'); return false }
    finally { setBusy(false) }
  }
  const save = () => {
    if (!state) return
    if (claimed) { void (mode === 'file' ? command('save') : sendProgress('save')); return }
    try { localStorage.setItem(AGENTIFIED_GUEST_KEY, JSON.stringify({ ...state, updatedAt: new Date().toISOString() })); setNotice('Saved on this device.') }
    catch { setNotice('Local storage is unavailable. Download a copy to keep your work.') }
  }
  const download = () => {
    if (!state) return
    const markdown = `# Agentified Operating File\n\n${agentifiedActs.map((act) => `## ${act}\n\n${agentifiedLessons.filter((item) => item.act === act).map((item) => `### ${item.id} · ${item.outputs.join(' + ')}\n\n${state.worksheet.answers[item.id] || 'No response yet.'}`).join('\n\n')}`).join('\n\n')}`
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }))
    const link = document.createElement('a'); link.href = url; link.download = 'agentified-operating-file.md'; link.click(); URL.revokeObjectURL(url)
  }
  const clear = async () => {
    if (!state || !window.confirm(`Delete all sixteen responses from ${claimed ? 'your member account' : 'this device'}? Download a copy first if you want to keep them.${claimed ? ' A submitted review copy remains with AmaduTown.' : ''}`)) return
    if (claimed && !(await command('delete', {}))) return
    update((current) => ({ ...current, worksheet: { ...current.worksheet, answers: {}, updatedAt: new Date().toISOString() } }))
    setReviewOpen(false); setConsent(false)
    if (!claimed) setNotice('Local responses cleared.')
  }
  const actions = <div className={styles.actions}><button type="button" title="Save responses" aria-label="Save responses" onClick={save} disabled={busy}><Save /></button><button type="button" title="Download Operating File" aria-label="Download Operating File" onClick={download}><Download /></button><button type="button" title="Delete all responses" aria-label="Delete all responses" onClick={() => void clear()} disabled={busy} className={styles.danger}><Trash2 /></button></div>

  return <section className={styles.workshop} aria-label={mode === 'plan' ? 'Agentified Learning Plan' : 'Agentified Operating File'}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Agentified workshop</p><h1>{mode === 'plan' ? 'Learning Plan' : 'Operating File'}</h1><p>{mode === 'plan' ? 'Sixteen lessons. One bounded job carried from first receipt to final audit.' : 'Keep each decision, boundary, and receipt in one working file.'}</p></div><div className={styles.headerLinks}><Link href={mode === 'plan' ? '/agentified/operating-file' : '/agentified/learningplan'}>{mode === 'plan' ? 'Open Operating File' : 'Back to lessons'} <ArrowRight size={16} /></Link><Link href="/agentified">Book page</Link></div></header>
    <div className={styles.progress}><strong>{state?.completed.length ?? 0} / 16 lessons complete</strong><span>{started} / 16 pages started</span><div role="progressbar" aria-valuenow={state?.completed.length ?? 0} aria-valuemin={0} aria-valuemax={16} aria-label="Lesson progress"><span style={{ width: `${((state?.completed.length ?? 0) / 16) * 100}%` }} /></div></div>
    {memberToken && !claimed && <div className={styles.continuity}><p>Your guest work stays on this device until you choose to link it.</p><button type="button" onClick={() => void sendProgress('claim')} disabled={!ready || busy}>Claim guest progress for this account</button></div>}
    {!memberToken && <div className={styles.continuity}><p>Guest work stays on this device. Sign in to continue across devices, then claim it explicitly.</p><Link href={`/auth/login?redirect=${encodeURIComponent(mode === 'plan' ? '/agentified/learningplan' : '/agentified/operating-file')}`}>Sign in</Link></div>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {mode === 'plan' ? <div className={styles.planLayout}>
      <aside className={`${styles.nav} ${navOpen ? styles.navOpen : ''}`} aria-label="Lessons"><div className={styles.navHeading}><strong>Lessons</strong><button type="button" aria-label={navOpen ? 'Collapse lesson navigation' : 'Expand lesson navigation'} aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}>{navOpen ? <X /> : <Menu />}</button></div><div className={styles.navBody}>{agentifiedActs.map((act) => <section key={act}><h2>{act}</h2>{agentifiedLessons.filter((item) => item.act === act).map((item) => { const status = state?.completed.includes(item.id) ? 'Complete' : item.id === selected ? 'Current' : 'Read'; return <button type="button" key={item.id} onClick={() => select(item.id)} aria-current={item.id === selected ? 'step' : undefined}><span>{item.id}</span><strong>{item.title}</strong><em data-status={status}>{status}</em></button> })}</section>)}</div></aside>
      <article className={styles.lesson} ref={detailRef}><div className={styles.lessonMeta}>{lesson.id} · {lesson.act}</div><h2>{lesson.title}</h2><p>{lesson.outcome}</p><div className={styles.lessonColumns}><div className={styles.media}><div className={styles.mediaHead}><strong>Guided lesson</strong><span>Video locked</span></div><AgentifiedLessonHero key={lesson.id} lessonId={lesson.id} title={lesson.title} poster={agentifiedLessonPosters[lesson.id as keyof typeof agentifiedLessonPosters]} altText={agentifiedPosterAlt(lesson)} /><p>The guided video is being prepared. Read the lesson below and work through its Operating File page now.</p><details className={styles.artifact}><summary>Explore lesson diagram</summary>{lesson.visuals.map((visual) => <figure key={visual.src}><Image src={visual.src} alt={visual.alt} width={1200} height={800} sizes="(max-width: 900px) 100vw, 50vw" /><figcaption>{lesson.title}</figcaption></figure>)}</details><details className={styles.transcript}><summary>Read lesson transcript</summary><div>{lesson.segments.map((segment) => <p key={segment.from}><span>{segment.from}–{segment.to}</span>{segment.spoken}</p>)}</div></details><p className={styles.caseNote}>Follow Morgan at Harbor Learning Circle as one proposed session moves through evidence, review, and a human decision.</p></div><div className={styles.worksheet}><div className={styles.worksheetTop}><span>OPERATING FILE · {lesson.id}</span><strong>{lesson.outputs.join(' + ')}</strong></div><label htmlFor={`answer-${lesson.id}`}>{lesson.exercise}</label><textarea id={`answer-${lesson.id}`} value={state?.worksheet.answers[lesson.id] ?? ''} onChange={(event) => answer(lesson.id, event.target.value)} maxLength={4000} rows={8} placeholder="Write your working response here" />{actions}<Link href={`/agentified/operating-file#${lesson.id}`}>Open this page in the full file</Link></div></div><div className={styles.lessonFooter}><button type="button" onClick={() => update((current) => ({ ...current, completed: current.completed.includes(lesson.id) ? current.completed.filter((id) => id !== lesson.id) : [...current.completed, lesson.id] }))}>{state?.completed.includes(lesson.id) ? 'Mark for review' : 'Mark lesson complete'}</button>{agentifiedLessons[agentifiedLessons.findIndex((item) => item.id === lesson.id) + 1] && <button type="button" className={styles.secondary} onClick={() => select(agentifiedLessons[agentifiedLessons.findIndex((item) => item.id === lesson.id) + 1].id)}>Next lesson <ArrowRight size={16} /></button>}</div></article>
    </div> : <><div className={styles.fileGroups}>{agentifiedActs.map((act) => <section key={act}><h2>{act}</h2><div>{agentifiedLessons.filter((item) => item.act === act).map((item) => <label id={item.id} key={item.id} htmlFor={`file-${item.id}`}><span>{item.id}</span><strong>{item.outputs.join(' + ')}</strong><small>{item.exercise}</small><textarea id={`file-${item.id}`} value={state?.worksheet.answers[item.id] ?? ''} onChange={(event) => answer(item.id, event.target.value)} maxLength={4000} rows={5} placeholder="Add your working response" /><Link href={`/agentified/learningplan?lesson=${item.id}`}>Open lesson</Link></label>)}</div></section>)}</div><div className={styles.fileFooter}><div><strong>Keep the work. Share only when you are ready.</strong><p>Download a copy at any time. Sending requires a signed-in account and your review.</p></div>{actions}<button type="button" className={styles.primary} onClick={() => setReviewOpen(true)} disabled={!claimed || !started}>Review before sending <Send size={16} /></button></div>{reviewOpen && <section className={styles.review} aria-label="Review before sharing"><h2>Review what you will send</h2><p>AmaduTown will use this file for human assessment review. Sending does not create a purchase, appointment, or client project. Your account email is the return address.</p><div>{agentifiedLessons.map((item) => <label key={item.id} htmlFor={`review-${item.id}`}><strong>{item.id} · {item.outputs.join(' + ')}</strong><textarea id={`review-${item.id}`} value={state?.worksheet.answers[item.id] ?? ''} onChange={(event) => answer(item.id, event.target.value)} maxLength={4000} rows={3} /></label>)}</div><label className={styles.name}>Name for review<input value={memberName} onChange={(event) => setMemberName(event.target.value)} maxLength={120} autoComplete="name" /></label><p>Account email: {memberEmail}</p><label className={styles.consent}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I reviewed these responses and agree to send them to AmaduTown for human assessment review.</label><div className={styles.reviewActions}><button type="button" className={styles.primary} disabled={!consent || !memberName.trim() || busy} onClick={() => void command('submit')}>Send for review</button><button type="button" onClick={() => setReviewOpen(false)}>Keep editing</button></div></section>}</>}
  </section>
}
