'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle2, Download, PanelLeftClose, PanelLeftOpen, RotateCcw, Save, Send, Trash2 } from 'lucide-react'
import transcript from '@/docs/accelerated-course-modules/l01-guided-video/approved-composite/l01-approved-transcript.json'
import l02Transcript from '@/docs/accelerated-course-modules/l02-native-composite/l02-learner-transcript.json'
import l03Transcript from '@/docs/accelerated-course-modules/l03-native-composite/l03-learner-transcript.json'
import l04Transcript from '@/docs/accelerated-course-modules/l04-learner-binding/l04-learner-transcript.json'
import l05Transcript from '@/docs/accelerated-course-modules/l05-l08-learner-binding/l05-transcript.json'
import l06Transcript from '@/docs/accelerated-course-modules/l05-l08-learner-binding/l06-transcript.json'
import l07Transcript from '@/docs/accelerated-course-modules/l05-l08-learner-binding/l07-transcript.json'
import l08Transcript from '@/docs/accelerated-course-modules/l05-l08-learner-binding/l08-transcript.json'
import l09Transcript from '@/docs/accelerated-course-modules/l09-l12-learner-binding/l09-transcript.json'
import l10Transcript from '@/docs/accelerated-course-modules/l09-l12-learner-binding/l10-transcript.json'
import l11Transcript from '@/docs/accelerated-course-modules/l09-l12-learner-binding/l11-transcript.json'
import l12Transcript from '@/docs/accelerated-course-modules/l09-l12-learner-binding/l12-transcript.json'
import l13Transcript from '@/docs/accelerated-course-modules/l13-l16-learner-binding/l13-transcript.json'
import l14Transcript from '@/docs/accelerated-course-modules/l13-l16-learner-binding/l14-transcript.json'
import l15Transcript from '@/docs/accelerated-course-modules/l13-l16-learner-binding/l15-transcript.json'
import l16Transcript from '@/docs/accelerated-course-modules/l13-l16-learner-binding/l16-transcript.json'
import styles from './learning-plan.module.css'
import { lessons, DECISION_FILE_VERSION, DECISION_FILE_STORAGE_KEY, emptyDecisionFile, validateDecisionFile, type Act, type DecisionFileDraft } from '@/lib/accelerated-decision-file'
import { GUEST_PROGRESS_KEY, validateLearningState, type LearningState } from '@/lib/accelerated-member-progress'
import { supabase } from '@/lib/supabase'
import { lessonPosters } from '@/lib/accelerated-lesson-posters'
import endScreenBindings from '@/lib/accelerated-end-screen-bindings.json'
import visualParityBindings from '@/lib/accelerated-visual-parity-bindings.json'
import CompletionCredential from '@/components/member/CompletionCredential'
export { lessons } from '@/lib/accelerated-decision-file'
export { default as visualParityBindings } from '@/lib/accelerated-visual-parity-bindings.json'

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

export const l03Media = {
  video: '/accelerated/lessons/l03/approved-02b9c3ea/accelerated-l03-native-composite.mp4',
  captions: '/accelerated/lessons/l03/approved-02b9c3ea/l03-captions.vtt',
  duration: '09:00',
  compositeSha256: '02b9c3ea941c22ffaf87b3bc4e4c4612951499af15485e0261910fad6014053a',
  sourceSha256: '064e049bfaee6d60d5d811d516dbcdf9c14466602afef9a34e07cbf31c551198',
  captionsSourceSha256: 'ee59adb3cd88e195c25bebaeb04ca0f9b78cc42c7291b1300b205f5958a917de',
} as const

export const l04Media = {
  video: '/accelerated/lessons/l04/approved-b239a55b/accelerated-l04-native-composite.mp4',
  captions: '/accelerated/lessons/l04/approved-b239a55b/l04-captions.vtt',
  duration: '10:00',
  compositeSha256: 'b239a55b2ac28cad77ccea5af6df10c9ec91ddb48d7810f9021e6c68f28c1613',
  sourceSha256: 'cf8f8e78c48a8f4471e0a4bb53b57b4f71f3ad52d30f92cf356482b4d1be9c3e',
  captionsSourceSha256: 'a183b1c2b5e100f449eb12481b314d09bd65d11aa0b81321c8499ac5bd03474c',
  transcript: l04Transcript,
} as const

export const approvedL05L08Media = {
  L05: { video: '/accelerated/lessons/l05/approved-bd1e53b5/accelerated-l05-native-composite.mp4', captions: '/accelerated/lessons/l05/approved-bd1e53b5/l05-captions.vtt', duration: '10:00', compositeSha256: 'bd1e53b579ccb412d619a537fe409bdcdb2a66fcaf747392d0b1b5c204facd62', transcript: l05Transcript },
  L06: { video: '/accelerated/lessons/l06/approved-16167226/accelerated-l06-native-composite.mp4', captions: '/accelerated/lessons/l06/approved-16167226/l06-captions.vtt', duration: '11:00', compositeSha256: '161672263694973697e6270e601ab24c84efbdd69b30f387f4138b6da740b729', transcript: l06Transcript },
  L07: { video: '/accelerated/lessons/l07/approved-6e3e00a0/accelerated-l07-native-composite.mp4', captions: '/accelerated/lessons/l07/approved-6e3e00a0/l07-captions.vtt', duration: '10:00', compositeSha256: '6e3e00a0146efc8c82b34adbcd86f17e8fc84067f0d30e5afde146a7faa2d31f', transcript: l07Transcript },
  L08: { video: '/accelerated/lessons/l08/approved-1b6c9da2/accelerated-l08-native-composite.mp4', captions: '/accelerated/lessons/l08/approved-1b6c9da2/l08-captions.vtt', duration: '12:00', compositeSha256: '1b6c9da23a74b9f699da43d26753fb714223304972225af498942ef8322bcc6b', transcript: l08Transcript },
} as const

export const approvedL09L12Media = {
  L09: { video: '/accelerated/lessons/l09/approved-0abafea5/accelerated-l09-native-composite.mp4', captions: '/accelerated/lessons/l09/approved-0abafea5/l09-captions.vtt', duration: '11:00', compositeSha256: '0abafea5f81201d7a5d0f03ed5cb7209c82057c75e4f3811aae86863cd38ae2a', transcript: l09Transcript },
  L10: { video: '/accelerated/lessons/l10/approved-7beb8af5/accelerated-l10-native-composite.mp4', captions: '/accelerated/lessons/l10/approved-7beb8af5/l10-captions.vtt', duration: '09:00', compositeSha256: '7beb8af5894653da01ee7bd902a87e76819f2bd4da7116993e79ecbb135e8297', transcript: l10Transcript },
  L11: { video: '/accelerated/lessons/l11/approved-1dcb3b03/accelerated-l11-native-composite.mp4', captions: '/accelerated/lessons/l11/approved-1dcb3b03/l11-captions.vtt', duration: '10:00', compositeSha256: '1dcb3b035096c8d15e11c1168dbc4008e179e0052eb374cf70f10ca8c0ba6fc0', transcript: l11Transcript },
  L12: { video: '/accelerated/lessons/l12/approved-39294821/accelerated-l12-native-composite.mp4', captions: '/accelerated/lessons/l12/approved-39294821/l12-captions.vtt', duration: '11:00', compositeSha256: '39294821b1e9aec78c5e58dec7fe3f174158b0bf536670962a0829a731593f6c', transcript: l12Transcript },
} as const

export const reviewL13L16Media = {
  L13: { video: '/accelerated/lessons/l13/review-0ae3ce85/accelerated-l13-native-composite.mp4', captions: '/accelerated/lessons/l13/review-0ae3ce85/l13-captions.vtt', duration: '11:00', compositeSha256: '0ae3ce8516cd4a754aab0da6debad03b7085b6d7bc2c61f459fb8bb0ff2a7bf1', transcript: l13Transcript },
  L14: { video: '/accelerated/lessons/l14/review-2b178dd6/accelerated-l14-native-composite.mp4', captions: '/accelerated/lessons/l14/review-2b178dd6/l14-captions.vtt', duration: '08:00', compositeSha256: '2b178dd6a64f8b619c0f64544d2e655ae73b7dba3b93775aef91d18e0407a143', transcript: l14Transcript },
  L15: { video: '/accelerated/lessons/l15/review-67d066c8/accelerated-l15-native-composite.mp4', captions: '/accelerated/lessons/l15/review-67d066c8/l15-captions.vtt', duration: '12:00', compositeSha256: '67d066c87bd2af6a3bf1184b66e329cd17b928f41842da3d3d35cabd230d68f3', transcript: l15Transcript },
  L16: { video: '/accelerated/lessons/l16/review-5ee4267c/accelerated-l16-native-composite.mp4', captions: '/accelerated/lessons/l16/review-5ee4267c/l16-captions.vtt', duration: '08:00', compositeSha256: '5ee4267cac68f05d587225c994d9156a53a2051cc36e059141be997d16161bc0', transcript: l16Transcript },
} as const

const acts: { name: Act; line: string }[] = [
  { name: 'Signals', line: 'Find the decision and the evidence that matters.' },
  { name: 'Alignment', line: 'Carry evidence into a shared plan and a clear decision.' },
  { name: 'Momentum', line: 'Make each test useful to the next one.' },
  { name: 'Synthesis', line: 'Set the next move, owner, and review point.' },
]

const LOCAL_SAVED_AT_KEY = `${DECISION_FILE_STORAGE_KEY}:saved-at`
const savedTime = (value: string) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value))

export function AcceleratedLearningPlan({ mode = 'plan' }: { mode?: 'plan' | 'decision-file' }) {
  const detailRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const memberUserRef = useRef<string | null>(null)
  const memberRevisionRef = useRef<number>(0)
  const memberSaveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const persistedAnswersRef = useRef<string | null>(null)
  const workspaceActionRef = useRef(false)
  const [selected, setSelected] = useState('L01')
  const [posterRevealed, setPosterRevealed] = useState(false)
  const [endedLesson, setEndedLesson] = useState<string | null>(null)
  const [captionsOn, setCaptionsOn] = useState(true)
  const [catalogCollapsed, setCatalogCollapsed] = useState(true)
  const [filter, setFilter] = useState<Act | 'All'>('All')
  const [query, setQuery] = useState('')
  const [completed, setCompleted] = useState<string[]>([])
  const [videoSeconds, setVideoSeconds] = useState<Record<string, number>>({})
  const [memberToken, setMemberToken] = useState<string | null>(null)
  const [memberClaimed, setMemberClaimed] = useState(false)
  const [memberNotice, setMemberNotice] = useState('')
  const [ready, setReady] = useState(false)
  const [draft, setDraft] = useState<DecisionFileDraft | null>(null)
  const [localSavedAt, setLocalSavedAt] = useState<string | null>(null)
  const [localSaveTimeUnavailable, setLocalSaveTimeUnavailable] = useState(false)
  const [accountSavedAt, setAccountSavedAt] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareName, setShareName] = useState('')
  const [shareEmail, setShareEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [shareState, setShareState] = useState('')
  const [sent, setSent] = useState(false)
  const [fixtureReceived, setFixtureReceived] = useState(false)
  const [workspaceBusy, setWorkspaceBusy] = useState(false)
  const lesson = lessons.find((item) => item.id === selected) ?? lessons[0]
  const posterUrl = lessonPosters[lesson.id as keyof typeof lessonPosters]
  const visible = lessons.filter((item) => (filter === 'All' || item.act === filter) && `${item.id} ${item.title} ${item.summary}`.toLowerCase().includes(query.toLowerCase().trim()))
  const current = lessons.find((item) => !completed.includes(item.id))?.id
  const next = lessons[lessons.findIndex((item) => item.id === lesson.id) + 1]
  const totalMinutes = lessons.reduce((sum, item) => sum + item.minutes, 0)
  const locked = (_id: string) => false
  const approvedBatchMedia = selected === 'L04' ? l04Media : selected in approvedL05L08Media ? approvedL05L08Media[selected as keyof typeof approvedL05L08Media] : selected in approvedL09L12Media ? approvedL09L12Media[selected as keyof typeof approvedL09L12Media] : selected in reviewL13L16Media ? reviewL13L16Media[selected as keyof typeof reviewL13L16Media] : null
  const lessonMedia = selected === 'L01'
    ? { ...l01Media, transcript }
    : selected === 'L02'
      ? { ...l02Media, transcript: l02Transcript }
      : selected === 'L03'
        ? { ...l03Media, transcript: l03Transcript }
        : approvedBatchMedia
  const endBinding = endScreenBindings.lessons.find((item) => item.lessonId === lesson.id)
  const visualBinding = visualParityBindings.lessons.find((item) => item.lessonId === lesson.id)
  const nextBinding = endScreenBindings.lessons.find((item) => item.lessonId === next?.id)
  const endBindingMatches = Boolean(endBinding && visualBinding && lessonMedia && endBinding.videoPath === lessonMedia.video && endBinding.videoSha256 === visualBinding.sourceVideoSha256 && endBinding.captionPath === lessonMedia.captions && endBinding.captionSha256 === visualBinding.captionSha256 && endBinding.posterPath === posterUrl && (!next || nextBinding?.posterPath === lessonPosters[next.id as keyof typeof lessonPosters]))
  const showEndScreen = endedLesson === lesson.id && endBindingMatches
  const handleVideoEnded = () => {
    const video = videoRef.current
    if (!video || !endBindingMatches || !endBinding) return
    const parts = endBinding.finalCaptionEnd.split(':').map(Number)
    const captionEnd = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]
    if (Number.isFinite(video.duration) && Math.abs(video.duration - captionEnd) <= 0.15) setEndedLesson(lesson.id)
  }
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DECISION_FILE_STORAGE_KEY)
      const checked = saved ? validateDecisionFile(JSON.parse(saved)) : null
      setDraft(checked?.ok ? checked.draft : emptyDecisionFile(crypto.randomUUID()))
      persistedAnswersRef.current = JSON.stringify(checked?.ok ? checked.draft.answers : {})
      if (checked?.ok) {
        if (Object.values(checked.draft.answers).some((answer) => answer.trim())) setLocalSaveTimeUnavailable(true)
        try {
          const marker = localStorage.getItem(LOCAL_SAVED_AT_KEY)
          const record = marker ? JSON.parse(marker) : null
          if (record?.worksheetId === checked.draft.worksheetId && typeof record.savedAt === 'string' && !Number.isNaN(Date.parse(record.savedAt))) { setLocalSavedAt(record.savedAt); setLocalSaveTimeUnavailable(false) }
        } catch { /* A damaged timestamp must not prevent the worksheet from loading. */ }
      }
      const progress = localStorage.getItem(GUEST_PROGRESS_KEY)
      if (progress) {
        const savedProgress = validateLearningState(JSON.parse(progress))
        if (savedProgress.ok) {
          setCompleted(savedProgress.state.completed)
          setVideoSeconds(savedProgress.state.videoSeconds)
          setSelected(savedProgress.state.currentLessonId)
        }
      }
      if (saved && !checked?.ok) setShareState('A previous workshop draft could not be restored. Your exported copy remains available if you saved one.')
    } catch {
      setDraft(emptyDecisionFile(crypto.randomUUID()))
      setShareState('Local storage is unavailable. Export a copy to keep your work.')
    }
    setReady(true)
  }, [])
  useEffect(() => {
    if (!draft || !ready || memberClaimed) return
    try {
      localStorage.setItem(DECISION_FILE_STORAGE_KEY, JSON.stringify(draft))
      const answers = JSON.stringify(draft.answers)
      if (answers !== persistedAnswersRef.current) {
        const savedAt = new Date().toISOString()
        localStorage.setItem(LOCAL_SAVED_AT_KEY, JSON.stringify({ worksheetId: draft.worksheetId, savedAt }))
        persistedAnswersRef.current = answers
        setLocalSavedAt(savedAt)
        setLocalSaveTimeUnavailable(false)
      }
    }
    catch { setShareState('Local storage is full or unavailable. Export a copy to keep your work.') }
  }, [draft, ready, memberClaimed])
  useEffect(() => {
    if (!draft || !ready || memberClaimed) return
    try { localStorage.setItem(GUEST_PROGRESS_KEY, JSON.stringify({ version: DECISION_FILE_VERSION, worksheet: draft, completed, videoSeconds, currentLessonId: selected, updatedAt: new Date().toISOString() })) }
    catch { setMemberNotice('Local progress could not be saved. Download your worksheet as a backup.') }
  }, [draft, completed, videoSeconds, selected, ready, memberClaimed])
  useEffect(() => {
    let active = true
    async function loadMember() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active || !session) return
      memberUserRef.current = session.user.id
      setMemberToken(session.access_token)
      setShareEmail(session.user.email ?? '')
      setShareName(
        typeof session.user.user_metadata?.full_name === 'string'
          ? session.user.user_metadata.full_name
          : typeof session.user.user_metadata?.name === 'string'
            ? session.user.user_metadata.name
            : '',
      )
      try {
        const response = await fetch('/api/accelerated/member', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' })
        if (!response.ok) { setMemberNotice('Member progress is unavailable. Your local work is still here.'); return }
        const result = await response.json()
        if (!active) return
        if (typeof result.profileName === 'string' && result.profileName.trim()) setShareName(result.profileName.trim())
        if (!result.enrollment) return
        memberRevisionRef.current = result.enrollment.revision
        setMemberClaimed(true)
        setSelected(result.enrollment.current_lesson_id)
        setCompleted(result.lessons.filter((item: { completed_at: string | null }) => item.completed_at).map((item: { lesson_id: string }) => item.lesson_id))
        setVideoSeconds(Object.fromEntries(result.lessons.map((item: { lesson_id: string; video_seconds: number }) => [item.lesson_id, item.video_seconds])))
        if (result.worksheet) setDraft({ version: DECISION_FILE_VERSION, worksheetId: result.worksheet.worksheet_id, answers: result.worksheet.answers, updatedAt: result.worksheet.updated_at })
        if (result.worksheet && typeof result.worksheet.updated_at === 'string' && !Number.isNaN(Date.parse(result.worksheet.updated_at))) setAccountSavedAt(result.worksheet.updated_at)
      } catch { setMemberNotice('Member progress is unavailable. Your local work is still here.') }
    }
    void loadMember()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (memberUserRef.current && session?.user.id !== memberUserRef.current) window.location.reload()
      else setMemberToken(session?.access_token ?? null)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])
  const learningState = (): LearningState | null => draft ? { version: DECISION_FILE_VERSION, worksheet: draft, completed, videoSeconds, currentLessonId: selected, updatedAt: new Date().toISOString() } : null
  const saveMember = async (action: 'claim' | 'save', state = learningState()) => {
    if (!state || !memberToken) return
    if (action === 'claim') {
      try {
        const stored = localStorage.getItem(GUEST_PROGRESS_KEY)
        const checked = stored ? validateLearningState(JSON.parse(stored)) : null
        if (checked?.ok) state = checked.state
      } catch { /* The current validated state remains the claim source. */ }
    }
    const snapshot = state
    memberSaveQueueRef.current = memberSaveQueueRef.current.then(async () => {
      const response = await fetch('/api/accelerated/member', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` }, body: JSON.stringify({ action, consent: action === 'claim', expectedRevision: memberRevisionRef.current, state: snapshot }) })
      const result = await response.json()
      if (!response.ok) { setMemberNotice(result.error || 'Could not save member progress. Reload to reconcile your latest copy.'); return }
      memberRevisionRef.current = result.revision
      if (action === 'claim') {
        setMemberClaimed(true)
        localStorage.removeItem(GUEST_PROGRESS_KEY)
        localStorage.removeItem(DECISION_FILE_STORAGE_KEY)
        localStorage.removeItem(LOCAL_SAVED_AT_KEY)
      }
      setAccountSavedAt(new Date().toISOString())
      setMemberNotice(action === 'claim' ? 'Guest progress is now linked to your member account.' : 'Saved to your member account.')
    }).catch(() => { setMemberNotice('Member progress could not be saved. Reload to reconcile your latest copy.') })
    await memberSaveQueueRef.current
  }
  useEffect(() => {
    if (!ready || !memberClaimed || !draft || mode === 'decision-file' || workspaceActionRef.current) return
    setMemberNotice('Saving this lesson and worksheet to your profile…')
    const timer = window.setTimeout(() => { void saveMember('save') }, 1200)
    return () => window.clearTimeout(timer)
    // Saving is driven by the current lesson and worksheet changes, after claim.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, completed, videoSeconds, selected, ready, memberClaimed])
  const updateAnswer = (id: string, value: string) => {
    setDraft((current) => current ? { ...current, answers: { ...current.answers, [id]: value }, updatedAt: new Date().toISOString() } : current)
    setSent(false)
    setConsent(false)
  }
  const commitWorkspace = async (action: 'save' | 'delete' | 'submit', answers = draft?.answers ?? {}) => {
    if (!draft || !memberToken || !memberClaimed) return false
    workspaceActionRef.current = true
    setWorkspaceBusy(true)
    setShareState(action === 'submit' ? 'Sending your reviewed Decision File…' : action === 'delete' ? 'Clearing your saved answers…' : 'Saving all sixteen pages…')
    try {
      await memberSaveQueueRef.current
      const response = await fetch('/api/accelerated/member/completion-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
        body: JSON.stringify({
          action, commandId: crypto.randomUUID(), expectedRevision: memberRevisionRef.current,
          draft: { ...draft, answers }, name: shareName.trim(), email: shareEmail.trim().toLowerCase(), consent: action === 'submit' && consent,
        }),
      })
      const result = await response.json()
      if (!response.ok) { setShareState(result.error || 'This action could not be completed. Reload to reconcile your work.'); return false }
      memberRevisionRef.current = result.revision
      setAccountSavedAt(new Date().toISOString())
      if (action === 'delete') {
        setDraft((current) => current ? { ...current, answers: {}, updatedAt: new Date().toISOString() } : current)
        setSent(false)
        setShareOpen(false)
        setConsent(false)
      }
      if (action === 'submit') { setSent(true); setShareOpen(false); setFixtureReceived(false); setConsent(false) }
      setShareState(action === 'save' ? 'All sixteen pages are saved to your member account.' : action === 'delete' ? 'Your saved worksheet answers were cleared. A previously submitted review copy, if any, remains with AmaduTown.' : 'Decision File received for human review. No assessment or project was created.')
      return true
    } catch { setShareState('Could not connect. Your current work is still on this device.'); return false }
    finally { setWorkspaceBusy(false); workspaceActionRef.current = false }
  }
  const exportDraft = () => {
    if (!draft) return
    const consolidated = `# Accelerated Decision File\n\nCourse edition: ${draft.version}\n\n${acts.map((group) => `## ${group.name}\n\n${lessons.filter((item) => item.act === group.name).map((item) => `### ${item.id} · ${item.artifact}\n\n${draft.answers[item.id] || 'No response yet.'}`).join('\n\n')}\n`).join('\n')}`
    const url = URL.createObjectURL(new Blob([mode === 'decision-file' ? consolidated : JSON.stringify(draft, null, 2)], { type: mode === 'decision-file' ? 'text/markdown' : 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = mode === 'decision-file' ? 'accelerated-decision-file.md' : 'accelerated-decision-file.json'
    link.click()
    URL.revokeObjectURL(url)
  }
  const clearDraft = () => {
    const target = memberClaimed ? 'your AmaduTown profile' : 'this device'
    if (mode === 'plan') {
      if (!window.confirm(`Clear only ${lesson.id} · ${lesson.title} from ${target}? Your other lesson answers and completion progress will stay. ${memberClaimed ? 'This change will be saved to your member profile.' : 'This change will be saved on this device.'}`)) return
      setDraft((current) => current ? { ...current, answers: { ...current.answers, [lesson.id]: '' }, updatedAt: new Date().toISOString() } : current)
      setSent(false)
      setConsent(false)
      setShareState(`${lesson.id} response cleared. Your other lesson answers and completion progress remain.`)
      return
    }
    if (!window.confirm(`Clear all sixteen worksheet answers from ${target}? Export a copy first if you want to keep them.${memberClaimed ? ' Any copy already sent for review remains with AmaduTown.' : ''}`)) return
    if (memberClaimed) { void commitWorkspace('delete', {}); return }
    setDraft(emptyDecisionFile(crypto.randomUUID()))
    setSent(false)
    setFixtureReceived(false)
    setShareName('')
    setShareEmail('')
    setConsent(false)
    setShareOpen(false)
    setShareState('The local worksheet has been cleared.')
  }
  const submitDraft = async () => {
    if (!draft || !consent || !shareName.trim() || !shareEmail.trim()) { setShareState('Enter your name and email, then agree to share this worksheet.'); return }
    if (memberClaimed && mode === 'decision-file') { await commitWorkspace('submit'); return }
    setShareState('Sending…')
    try {
      if (memberClaimed) await saveMember('save')
      const response = await fetch('/api/accelerated/decision-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(memberToken ? { Authorization: `Bearer ${memberToken}` } : {}),
        },
        body: JSON.stringify({ draft, worksheetId: draft.worksheetId, name: shareName.trim(), email: shareEmail.trim(), consent: true }),
      })
      const result = await response.json()
      if (!response.ok) { setShareState(result.error || 'Could not send your worksheet. Your local copy is still here.'); return }
      setSent(true)
      setFixtureReceived(Boolean(result.fixture))
      setShareOpen(false)
      setShareState('')
    } catch { setShareState('Could not connect. Your local copy is still here. Try again when you are online.') }
  }
  const selectLesson = (id: string) => {
    setSelected(id)
    setPosterRevealed(false)
    setEndedLesson(null)
    if (window.matchMedia?.('(max-width: 1050px)').matches) {
      detailRef.current?.scrollIntoView({ block: 'start' })
    }
  }
  const setCaptionMode = (enabled: boolean) => {
    setCaptionsOn(enabled)
    const track = videoRef.current?.textTracks[0]
    if (track) track.mode = enabled ? 'showing' : 'disabled'
  }
  const restoreVideo = () => {
    setCaptionMode(captionsOn)
    if (videoRef.current && videoSeconds[selected] > 0) videoRef.current.currentTime = videoSeconds[selected]
  }
  const recordVideo = () => {
    const seconds = Math.floor(videoRef.current?.currentTime ?? 0)
    if (seconds > 0 && seconds % 5 === 0 && seconds !== videoSeconds[selected]) setVideoSeconds((positions) => ({ ...positions, [selected]: seconds }))
  }

  const startedPages = Object.values(draft?.answers ?? {}).filter((answer) => answer.trim()).length
  const saveWorksheet = () => {
    if (!draft) return
    if (memberClaimed) {
      if (mode === 'decision-file') { void commitWorkspace('save'); return }
      void saveMember('save')
      return
    }
    try {
      localStorage.setItem(DECISION_FILE_STORAGE_KEY, JSON.stringify(draft))
      const answers = JSON.stringify(draft.answers)
      if (answers !== persistedAnswersRef.current) {
        const savedAt = new Date().toISOString()
        localStorage.setItem(LOCAL_SAVED_AT_KEY, JSON.stringify({ worksheetId: draft.worksheetId, savedAt }))
        persistedAnswersRef.current = answers
        setLocalSavedAt(savedAt)
        setLocalSaveTimeUnavailable(false)
      }
      setShareState('Saved on this device.')
    }
    catch { setShareState('Local storage is unavailable. Download a copy to keep your work.') }
  }
  const worksheetActions = <div className={styles.worksheetActions}>
    <button type="button" className={`${styles.iconAction} ${styles.secondaryAction}`} disabled={workspaceBusy} aria-label={mode === 'decision-file' ? 'Save all pages' : memberClaimed ? 'Save to profile' : 'Save on this device'} data-tooltip={mode === 'decision-file' ? 'Save all pages' : memberClaimed ? 'Save to profile' : 'Save on this device'} onClick={saveWorksheet}><Save aria-hidden="true" /></button>
    <button type="button" className={`${styles.iconAction} ${styles.secondaryAction}`} aria-label="Download copy" data-tooltip="Download copy" onClick={exportDraft}><Download aria-hidden="true" /></button>
    <button type="button" className={`${styles.iconAction} ${styles.dangerAction}`} disabled={workspaceBusy} aria-label={mode === 'decision-file' ? 'Delete all answers' : 'Clear worksheet'} data-tooltip={mode === 'decision-file' ? 'Delete all answers' : 'Clear worksheet'} onClick={clearDraft}><Trash2 aria-hidden="true" /></button>
    <button type="button" className={`${styles.iconAction} ${styles.primaryAction}`} disabled={workspaceBusy} aria-label={memberClaimed ? 'Review for assessment' : 'Review and send'} data-tooltip={memberClaimed ? 'Review for assessment' : 'Review and send'} onClick={() => { setShareOpen(true); setConsent(false); setShareState('') }}><Send aria-hidden="true" /></button>
  </div>
  const shareReview = shareOpen && <div className={styles.sharePanel} role="region" aria-label="Review before sharing"><h4>Review what you will share</h4><p>{memberClaimed ? 'This saved profile worksheet will be bound to your assessment intake so AmaduTown can review your decision and narrow relevant products or services. It does not create a paid-client project, purchase, or appointment.' : 'AmaduTown will use these answers to understand your decision, consider existing services, and decide whether an assessment would help. A person reviews the work. Sending does not book a meeting or add you to a mailing list.'}</p><div className={styles.shareAnswers}>{lessons.map((item) => <label key={item.id} htmlFor={`share-${item.id}`}><strong>{item.id} · {item.artifact}</strong><textarea id={`share-${item.id}`} value={draft?.answers[item.id] ?? ''} onChange={(event) => updateAnswer(item.id, event.target.value)} maxLength={4000} rows={3} aria-label={`Edit ${item.id} before sharing`} /></label>)}</div><div className={styles.shareContact}><label>Name<input value={shareName} onChange={(event) => setShareName(event.target.value)} maxLength={120} autoComplete="name" /></label><label>Email<input type="email" value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} maxLength={254} autoComplete="email" /></label></div><label className={styles.consent}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I have reviewed these answers and agree to send them to AmaduTown for human assessment review.</label><div className={styles.worksheetActions}><button type="button" className={styles.primaryAction} disabled={!consent || !shareName.trim() || !shareEmail.trim() || !Object.values(draft?.answers ?? {}).some((answer) => answer.trim())} onClick={submitDraft}>{memberClaimed ? 'Send for assessment review' : 'Send to AmaduTown'}</button><button type="button" className={styles.secondaryAction} onClick={() => setShareOpen(false)}>Keep editing</button></div></div>

  if (mode === 'decision-file') return <section className={`${styles.plan} ${styles.decisionFile}`} aria-label="Accelerated Decision File">
    <div className={styles.heading}>
      <div><p className={styles.kicker}>YOUR WORKSHOP WORKBOOK</p><h2>The Accelerated Decision File</h2><p>Carry one real decision through all sixteen lessons. Your work stays in this browser unless you choose to sign in or send it to AmaduTown.</p></div>
      <div className={styles.overview}><strong>{startedPages}<span> / 16</span></strong><span>pages started</span><progress value={startedPages} max={16} aria-label="Decision File pages started"/><small>Review every page before sharing</small></div>
    </div>
    <div className={styles.workspaceNav}><Link href="/accelerated/learningplan" className={styles.workspaceBack}><ArrowLeft aria-hidden="true" />Back to the Learning Plan</Link><span role="status" aria-live="polite">{memberClaimed ? accountSavedAt ? `Last saved to your account at ${savedTime(accountSavedAt)}` : 'Not saved to your account yet' : localSavedAt ? `Last saved locally at ${savedTime(localSavedAt)}` : localSaveTimeUnavailable ? 'Saved locally · time unavailable' : 'Not saved locally yet'}</span></div>
    {memberToken && !memberClaimed && <div className={styles.continuityAction}><button type="button" onClick={() => void saveMember('claim')}>Claim guest progress for this account</button>{memberNotice && <span role="status">{memberNotice}</span>}</div>}
    <div className={styles.decisionFileGroups}>{acts.map((group) => <section key={group.name} className={styles.decisionFileGroup} aria-labelledby={`decision-file-${group.name.toLowerCase()}`}><div className={styles.actHeader}><div><h3 id={`decision-file-${group.name.toLowerCase()}`}>{group.name}</h3><p>{group.line}</p></div><span>{lessons.filter((item) => item.act === group.name).length} pages</span></div><div className={styles.decisionFilePages}>{lessons.filter((item) => item.act === group.name).map((item) => <label key={item.id} htmlFor={`decision-file-page-${item.id}`}><span>{item.id}</span><strong>{item.artifact}</strong><small>{item.exercise}</small><textarea id={`decision-file-page-${item.id}`} value={draft?.answers[item.id] ?? ''} onChange={(event) => updateAnswer(item.id, event.target.value)} maxLength={4000} rows={5} placeholder="Add your working notes" /></label>)}</div></section>)}</div>
    <div className={styles.decisionFileFooter}><div><strong>Keep the work. Share only when you are ready.</strong><p>Download a copy at any time. Sending opens a protected human review; it does not create an assessment, purchase, or appointment.</p></div>{worksheetActions}</div>
    {shareState && <p role="status" className={styles.workspaceStatus}>{shareState}</p>}
    {sent && <div className={styles.receipt} role="status"><strong>{fixtureReceived ? 'Local test complete' : 'Decision file received'}</strong><p>{fixtureReceived ? 'This was a synthetic local test. Nothing was sent to AmaduTown.' : 'AmaduTown will review your decision file before suggesting a next step. No assessment or appointment has been created.'}</p><p>Keep your downloaded or local copy for your records.</p></div>}
    {shareReview}
    <CompletionCredential token={memberToken} completedCount={completed.length} profileName={shareName} />
  </section>

  return <section className={styles.plan} aria-label="Accelerated learning plan">
    <div className={styles.heading}>
      <div><p className={styles.kicker}>YOUR LEARNING PLAN</p><h2>Sixteen lessons. One decision file.</h2><p>Bring one safe, real decision through the course. Each lesson adds a page you can review with your team.</p></div>
      <div className={styles.overview}><strong>{completed.length}<span> / 16</span></strong><span>lessons complete</span><progress value={completed.length} max={16} aria-label="Lessons complete"/><small>{totalMinutes} minutes of planned teaching · practice time is separate</small></div>
    </div>
    <div className={styles.continuityAction}>{completed.length === lessons.length && <Link href="/accelerated/decision-file">Review complete Decision File</Link>}{memberToken ? memberClaimed ? <a href="/member/dashboard">Open dashboard</a> : <button type="button" onClick={() => void saveMember('claim')}>Claim this progress</button> : <a href="/auth/login?redirect=%2Faccelerated%2Flearningplan">Sign in to save progress</a>}{memberNotice && <span role="status">{memberNotice}</span>}</div>
    <div className={`${styles.layout} ${catalogCollapsed ? styles.layoutCollapsed : ''}`}>
      <div className={styles.catalog} data-collapsed={catalogCollapsed ? 'true' : 'false'}>
        <div className={styles.catalogHeader}><strong>Lessons</strong><button type="button" className={styles.catalogToggle} aria-expanded={!catalogCollapsed} aria-label={catalogCollapsed ? 'Expand lesson navigation' : 'Collapse lesson navigation'} data-tooltip={catalogCollapsed ? 'Expand lesson navigation' : 'Collapse lesson navigation'} onClick={() => setCatalogCollapsed((collapsed) => !collapsed)}>{catalogCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}</button></div>
        <div className={styles.catalogTools}><label htmlFor="lesson-search">Find a lesson</label><input id="lesson-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles or topics"/><div className={styles.filters} role="group" aria-label="Filter lessons by act">{(['All', 'Signals', 'Alignment', 'Momentum', 'Synthesis'] as const).map((name) => <button type="button" key={name} aria-pressed={filter === name} onClick={() => setFilter(name)}>{name}</button>)}</div></div>
        {visible.length === 0 ? <div className={styles.empty}><strong>No lessons found.</strong><p>Try another term or show the full plan.</p><button type="button" onClick={() => { setQuery(''); setFilter('All') }}>Show all lessons</button></div> : acts.map((group) => {
          const groupLessons = visible.filter((item) => item.act === group.name)
          if (!groupLessons.length) return null
          return <section key={group.name} className={styles.actGroup} aria-label={`${group.name} lessons`}><div className={styles.actHeader}><div><h3>{group.name}</h3><p>{group.line}</p></div><span>{groupLessons.length} lessons</span></div><div className={styles.lessonList}>{groupLessons.map((item) => {
            const state = locked(item.id) ? 'locked' : completed.includes(item.id) ? 'complete' : current === item.id ? 'current' : 'ready'
            const stateLabel = state === 'locked' ? 'Locked' : state === 'complete' ? 'Complete' : state === 'current' ? 'Current' : 'Ready'
            return <button type="button" key={item.id} className={styles.lessonRow} aria-label={`${item.id}: ${item.title}, ${state}`} aria-current={selected === item.id ? 'true' : undefined} onClick={() => selectLesson(item.id)}><span className={styles.lessonNumber}>{item.id}</span><span className={styles.lessonName}><strong>{item.title}</strong><small>{item.minutes} min · {item.artifact}</small></span><span className={styles.state} data-state={state} title={stateLabel}>{stateLabel}</span></button>
          })}</div></section>
        })}
      </div>
      <article ref={detailRef} className={styles.detail} aria-live="polite">
        <div className={styles.detailTop}><span>{lesson.id} · {lesson.act} · {lesson.minutes} min</span></div>
        <h3>{lesson.title}</h3><p className={styles.summary}>{lesson.summary}</p>
        <section className={styles.worksheet} aria-label={`${lesson.id} decision file worksheet`}>
          <div className={styles.worksheetHeading}><div><span>DECISION FILE · {lesson.act}</span><h4>{lesson.artifact}</h4></div><span>{startedPages} / 16 pages started</span></div>
          <label htmlFor={`decision-file-${lesson.id}`}>Your response to this lesson</label>
          <textarea id={`decision-file-${lesson.id}`} value={draft?.answers[lesson.id] ?? ''} onChange={(event) => updateAnswer(lesson.id, event.target.value)} maxLength={4000} rows={5} placeholder={lesson.exercise} />
          {worksheetActions}
          {shareState && <p role="status">{shareState}</p>}
          {sent && <div className={styles.receipt} role="status"><strong>{fixtureReceived ? 'Local test complete' : 'Decision file received'}</strong><p>{fixtureReceived ? 'This was a synthetic local test. Nothing was sent to AmaduTown.' : 'AmaduTown will review your decision file before suggesting a next step. No assessment or appointment has been created.'}</p><p>Keep your downloaded or local copy for your records.</p></div>}
          {shareReview}
        </section>
        {lessonMedia ? <section className={styles.player} aria-label={`${lesson.id} guided video`}>
          <div className={styles.playerHeading}><strong>Guided video · {lesson.id}</strong></div>
          <div className={styles.videoStage} data-ended={showEndScreen} style={{ backgroundImage: `url(${posterUrl})` }}><video key={lesson.id} ref={videoRef} className={posterRevealed ? styles.videoReveal : undefined} onPlaying={() => { setPosterRevealed(true); setEndedLesson(null) }} onSeeking={() => setEndedLesson(null)} onEmptied={() => { setPosterRevealed(false); setEndedLesson(null) }} onEnded={handleVideoEnded} controls playsInline preload="metadata" poster={posterUrl} aria-description={`${lesson.id} ${lesson.title} cover with presenter and ${lesson.act} learning artwork`} aria-label={`${lesson.id} ${lesson.title} guided video`} onLoadedMetadata={restoreVideo} onTimeUpdate={recordVideo}>
            <source src={visualBinding?.videoPath ?? ''} type="video/mp4" />
            <track kind="captions" src={lessonMedia.captions} srcLang="en" label="English captions" default />
            Your browser cannot play this video. The read-along transcript is available below.
          </video>
          {showEndScreen && <div className={styles.lessonEndScreen} role="status" aria-label={`${lesson.id} video finished`}>
            <div className={styles.lessonEndSummary}><span>{!next && completed.length === lessons.length ? 'COURSE COMPLETE' : next ? 'LESSON VIDEO FINISHED' : 'FINAL VIDEO FINISHED'}</span><strong>{lesson.id} · {lesson.title}</strong><small>{completed.length} of {lessons.length} lessons marked complete</small><div className={styles.lessonEndProgress} role="progressbar" aria-label="Course lessons marked complete" aria-valuenow={completed.length} aria-valuemin={0} aria-valuemax={lessons.length}><span style={{ width: `${completed.length / lessons.length * 100}%` }} /></div></div>
            {next && nextBinding ? <button type="button" className={styles.lessonEndNext} onClick={() => { selectLesson(next.id); setFilter('All'); setQuery(''); setEndedLesson(null) }} aria-label={`Continue to ${next.id}: ${next.title}`}><img src={nextBinding.posterPath} alt={`${next.id} ${next.title} lesson cover`} /><span><small>UP NEXT · {next.id}</small><strong>{next.title}</strong><em>Open lesson <ArrowRight aria-hidden="true" /></em></span></button> : <Link href="/accelerated/decision-file" className={styles.lessonEndDecision}><span>YOUR NEXT MOVE</span><strong>Open the Decision File</strong><small>Carry the choice, evidence, and review date into one accountable next step.</small><em>Open Decision File <ArrowRight aria-hidden="true" /></em></Link>}
          </div>}</div>
          <div className={styles.playerTools}><span>Duration {lessonMedia.duration}</span><button type="button" aria-pressed={captionsOn} onClick={() => setCaptionMode(!captionsOn)}>English captions {captionsOn ? 'on' : 'off'}</button></div>
          <details className={styles.transcript}><summary>Read along with {lesson.id} transcript</summary><ol>{lessonMedia.transcript.cues.map((cue, index) => <li key={`${cue.start}-${index}`}><time>{cue.start}</time><span>{cue.text}</span></li>)}</ol></details>
        </section> : <div className={styles.mediaNotice}><strong>Guided video is pending</strong><p>The lesson brief and visual preview are available here. Recorded teaching and worksheets will appear after production review.</p><button type="button" disabled aria-label={`Watch ${lesson.id} guided video, unavailable until production review`}>Video unavailable</button></div>}
        <div className={styles.actions}>{(() => {
          const completionLabel = locked(lesson.id) ? 'Completion unavailable' : completed.includes(lesson.id) ? 'Mark as incomplete' : 'Mark lesson complete'
          return <button type="button" className={styles.iconAction} disabled={locked(lesson.id)} aria-label={completionLabel} data-tooltip={locked(lesson.id) ? 'Completion opens after the guided video is approved' : completionLabel} onClick={() => setCompleted((items) => items.includes(lesson.id) ? items.filter((id) => id !== lesson.id) : [...items, lesson.id])}>{completed.includes(lesson.id) ? <RotateCcw aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}</button>
        })()}{next && <button type="button" className={`${styles.iconAction} ${styles.secondary}`} aria-label={`Next lesson · ${next.id}`} data-tooltip={`Next lesson · ${next.id}`} onClick={() => { selectLesson(next.id); setFilter('All'); setQuery('') }}><ArrowRight aria-hidden="true" /></button>}{!next && <Link href="/accelerated/decision-file" className={styles.secondaryAction}>Open complete Decision File</Link>}</div>
      </article>
    </div>
  </section>
}
