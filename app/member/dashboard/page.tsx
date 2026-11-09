'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { lessons } from '@/lib/accelerated-decision-file'
import { agentifiedLessons } from '@/lib/agentified-workshop'
import type { DashboardData, LeadDashboardData } from '@/lib/client-dashboard'
import AssessmentScoreBreakdown from '@/components/client-dashboard/AssessmentScoreBreakdown'
import AccountSummarySection from '@/components/client-dashboard/AccountSummarySection'
import TaskChecklist from '@/components/client-dashboard/TaskChecklist'
import MilestoneTimeline from '@/components/client-dashboard/MilestoneTimeline'
import DocumentsSection from '@/components/client-dashboard/DocumentsSection'
import ReportsSection from '@/components/client-dashboard/ReportsSection'
import MeetingHistory, { type Meeting } from '@/components/client-dashboard/MeetingHistory'
import RecommendationAction, { type ReviewedRecommendation } from '@/components/member/RecommendationAction'
import CompletionCredential from '@/components/member/CompletionCredential'
import AgentifiedCompletionCredential from '@/components/member/AgentifiedCompletionCredential'

type MemberOrder = {
  id: number
  workshop: 'accelerated' | 'agentified' | null
  status: string
  final_amount: number
  created_at: string
  order_items: { id: number; products?: { title: string } | null; services?: { title: string } | null }[]
}

const orderLabels: Record<string, string> = {
  pending: 'Pending payment', completed: 'Paid / completed', quote_pending: 'Quote pending',
  failed: 'Payment failed', cancelled: 'Cancelled', refunded: 'Refunded',
}

function orderAction(status: string, id: number, preview = false, workshop: MemberOrder['workshop'] = null) {
  if (status === 'pending') return { href: `/checkout/payment?orderId=${id}`, label: 'Continue payment' }
  if (status === 'completed') return { href: `/purchases?orderId=${id}`, label: 'View receipt and details' }
  if (status === 'quote_pending') return { href: preview ? `/member/quote?qa=${workshop === 'agentified' ? 'quote-agentified' : 'quote'}` : `/member/quote?orderId=${id}`, label: 'Continue quote request' }
  return { href: `/purchases?orderId=${id}`, label: 'Review order' }
}

type MemberData = {
  profileName: string | null
  enrollment: { current_lesson_id: string } | null
  lessons: { lesson_id: string; completed_at: string | null; video_seconds: number }[]
  worksheet: { answers: Record<string, string> } | null
  decisionFileCount: number
  assessmentStatus: { status: string; summary: string | null } | null
  assessment: LeadDashboardData | null
  recommendations: ReviewedRecommendation[]
  orders: MemberOrder[]
  projects: DashboardData[]
  projectWorkshops?: Record<string, 'accelerated' | 'agentified'>
  projectMeetings: Record<string, Meeting[]>
}

function syntheticMember(state: string): MemberData {
  const assessed = state === 'assessed' || state === 'paid' || state === 'orders'
  const completionCount = state === 'completion-ready' ? 16 : state === 'completion-blocked' ? 15 : 5
  return {
    profileName: 'Course Learner',
    enrollment: { current_lesson_id: completionCount >= 15 ? 'L16' : 'L06' },
    lessons: lessons.slice(0, completionCount).map((lesson) => ({ lesson_id: lesson.id, completed_at: '2026-11-05T12:00:00Z', video_seconds: 90 })),
    worksheet: { answers: { L01: 'A synthetic team decision', L02: 'Three safe options' } },
    decisionFileCount: assessed ? 1 : 0,
    assessmentStatus: assessed ? { status: 'completed', summary: 'The team has a clear decision but needs a stronger evidence handoff.' } : null,
    assessment: null,
    recommendations: assessed ? [
      { id: 'synthetic-fixed', title: 'Decision support session', rationale: 'A reviewed next step tied to the assessment.', offer_kind: 'service', offer_id: 'synthetic-service', reviewed_at: '2026-11-05T12:00:00Z', approved_price: 240, approved_is_quote_based: false },
      { id: 'synthetic-quote', title: 'Custom implementation plan', rationale: 'The scope needs a conversation before pricing.', offer_kind: 'service', offer_id: 'synthetic-quote-service', reviewed_at: '2026-11-05T12:00:00Z', approved_price: null, approved_is_quote_based: true },
    ] : [],
    orders: state === 'orders' || state === 'paid' ? [
      { id: 1201, workshop: 'accelerated', status: 'pending', final_amount: 240, created_at: '2026-11-05T12:00:00Z', order_items: [{ id: 1, services: { title: 'Decision support session' } }] },
      { id: 1202, workshop: 'accelerated', status: 'completed', final_amount: 240, created_at: '2026-11-04T12:00:00Z', order_items: [{ id: 2, services: { title: 'Decision support session' } }] },
      { id: 1203, workshop: 'accelerated', status: 'quote_pending', final_amount: 0, created_at: '2026-11-03T12:00:00Z', order_items: [{ id: 3, services: { title: 'Custom implementation plan' } }] },
      { id: 2203, workshop: 'agentified', status: 'quote_pending', final_amount: 0, created_at: '2026-11-03T11:00:00Z', order_items: [{ id: 6, services: { title: 'Monthly Advisory Retainer' } }] },
      { id: 1204, workshop: 'accelerated', status: 'failed', final_amount: 240, created_at: '2026-11-02T12:00:00Z', order_items: [{ id: 4, services: { title: 'Decision support session' } }] },
      { id: 1205, workshop: 'accelerated', status: 'cancelled', final_amount: 240, created_at: '2026-11-01T12:00:00Z', order_items: [{ id: 5, services: { title: 'Decision support session' } }] },
    ] : [],
    projects: state === 'paid' ? [{ project: { id: 'synthetic-project', project_name: 'Client engagement' }, accountSummary: null, timeTracking: { total_seconds: 0, by_target: [] }, tasks: [{ id: 'synthetic-task', title: 'Review the evidence handoff', description: 'Review the project evidence', status: 'pending', category: 'planning', priority: 'high', diy_resources: [] }], milestones: [{ id: 'synthetic-milestone', title: 'Evidence review', status: 'pending', target_date: '2026-11-30' }], documents: [], valueReports: [], gammaReports: [] } as unknown as DashboardData] : [],
    projectMeetings: state === 'paid' ? { 'synthetic-project': [{ id: 'synthetic-meeting', meeting_type: 'review', meeting_date: '2026-11-05T12:00:00Z', duration_minutes: 30, structured_notes: null, key_decisions: ['Test the evidence handoff'], action_items: null, open_questions: null, recording_url: null }] } : {},
  }
}

function syntheticAgentified(state: string) {
  const assessed = state === 'agentified-assessed' || state === 'agentified-paid' || state === 'agentified-credential'
  const completed = state === 'agentified-credential' ? 16 : 5
  return {
    enrollment: { current_lesson_id: completed === 16 ? 'L16' : 'L06' },
    lessons: agentifiedLessons.slice(0, completed).map((lesson) => ({ lesson_id: lesson.id, completed_at: '2026-11-05T12:00:00Z' })),
    worksheet: { answers: { L01: 'A bounded agent job', L02: 'A decision card' } },
    operatingFileCount: assessed ? 1 : 0,
    assessmentStatus: assessed ? { status: 'completed', summary: 'The agent roles are clear; the handoff needs a stronger review gate.' } : null,
    assessment: null,
    recommendations: assessed ? [
      { id: 'agentified-fixed', title: 'Agent workflow review', rationale: 'A reviewed service tied to the Operating File.', offer_kind: 'service', offer_id: 'synthetic-service', reviewed_at: '2026-11-05T12:00:00Z', approved_price: 240, approved_is_quote_based: false },
      { id: 'agentified-quote', title: 'Custom agent implementation', rationale: 'Scope and controls need a review.', offer_kind: 'service', offer_id: 'synthetic-quote-service', reviewed_at: '2026-11-05T12:00:00Z', approved_price: null, approved_is_quote_based: true },
    ] as ReviewedRecommendation[] : [],
  }
}

export default function MemberDashboardPage() {
  const [data, setData] = useState<MemberData | null>(null)
  const [agentified, setAgentified] = useState<{ enrollment: { current_lesson_id: string } | null; lessons: { completed_at: string | null }[]; worksheet: { answers: Record<string, string> } | null; operatingFileCount: number; assessmentStatus: { status: string; summary: string | null } | null; assessment: LeadDashboardData | null; recommendations: ReviewedRecommendation[] } | null>(null)
  const [error, setError] = useState('')
  const [agentifiedError, setAgentifiedError] = useState('')
  const [loading, setLoading] = useState(true)
  const [previewMode, setPreviewMode] = useState(false)
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    async function load() {
      const preview = process.env.NODE_ENV !== 'production' ? new URLSearchParams(window.location.search).get('qa') : null
      if (preview && ['member', 'assessed', 'paid', 'orders', 'completion-ready', 'completion-blocked'].includes(preview)) { setPreviewMode(true); setData(syntheticMember(preview)); setAgentified({ enrollment: null, lessons: [], worksheet: null, operatingFileCount: 0, assessmentStatus: null, assessment: null, recommendations: [] }); setLoading(false); return }
      if (preview && ['agentified-member', 'agentified-assessed', 'agentified-paid', 'agentified-credential'].includes(preview)) { setPreviewMode(true); setData(syntheticMember(preview === 'agentified-paid' ? 'paid' : 'member')); setAgentified(syntheticAgentified(preview)); setLoading(false); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { if (active) { setError('Sign in to see your member dashboard.'); setLoading(false) }; return }
      const request = (path: string) => fetch(path, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      })
      const acceleratedRequest = request('/api/accelerated/member').then(async (response) => {
          if (!response.ok) throw new Error('accelerated')
          return response.json()
        }).then((result) => { if (active) setData(result) })
        .catch(() => { if (active) setError('Your Accelerated and client records are temporarily unavailable.') })
      const agentifiedRequest = request('/api/agentified/member').then(async (response) => {
          if (!response.ok) throw new Error('agentified')
          return response.json()
        }).then((result) => { if (active) setAgentified(result) })
        .catch(() => { if (active) setAgentifiedError('Your Agentified progress is temporarily unavailable.') })
      await Promise.allSettled([acceleratedRequest, agentifiedRequest])
      if (!active) return
      setLoading(false)
    }
    void load()
    return () => { active = false; controller.abort() }
  }, [])
  const complete = data?.lessons.filter((item) => item.completed_at).length ?? 0
  const pages = Object.values(data?.worksheet?.answers ?? {}).filter((value) => value.trim()).length
  return <main className="min-h-screen bg-imperial-navy px-4 py-10 text-platinum-white sm:px-8">
    <div className="mx-auto max-w-5xl space-y-8">
      <header><p className="text-sm uppercase tracking-widest text-radiant-gold">AmaduTown member</p><h1 className="mt-2 text-3xl font-bold">Your learning, in one place</h1><p className="mt-2 text-platinum-white/70">Pick up the next lesson. Your assessment and client work appear here only after they are linked to your account.</p></header>
      {agentified ? <section className="space-y-4" aria-label="Agentified workshop journey">
        <section className="space-y-4" aria-label="Agentified progress"><div><p className="text-sm uppercase tracking-widest text-radiant-gold">Agentified workshop</p><h2 className="mt-1 text-2xl font-semibold">Build a governed agent operating system</h2></div><div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-radiant-gold/25 bg-silicon-slate/40 p-5"><span className="text-sm text-platinum-white/65">Lessons</span><strong className="mt-2 block text-3xl">{agentified.lessons.filter((item) => item.completed_at).length} / {agentifiedLessons.length}</strong><progress className="mt-3 w-full" value={agentified.lessons.filter((item) => item.completed_at).length} max={agentifiedLessons.length} aria-label="Agentified lessons complete" /></div>
          <div className="rounded-lg border border-radiant-gold/25 bg-silicon-slate/40 p-5"><span className="text-sm text-platinum-white/65">Operating File pages started</span><strong className="mt-2 block text-3xl">{Object.values(agentified.worksheet?.answers ?? {}).filter((answer) => answer.trim()).length} / {agentifiedLessons.length}</strong><p className="mt-2 text-xs text-platinum-white/60">{agentified.operatingFileCount ? `${agentified.operatingFileCount} submitted for review` : 'Your work stays private until you send it.'}</p><Link className="mt-3 inline-block text-radiant-gold underline" href="/agentified/operating-file">Open Operating File</Link></div>
          <div className="rounded-lg border border-radiant-gold/25 bg-silicon-slate/40 p-5"><span className="text-sm text-platinum-white/65">Continue</span><strong className="mt-2 block text-2xl">{agentified.enrollment?.current_lesson_id ?? 'L01'}</strong><Link className="mt-3 inline-block text-radiant-gold underline" href={agentified.enrollment ? `/agentified/learningplan?lesson=${agentified.enrollment.current_lesson_id}` : '/agentified/learningplan'}>{agentified.enrollment ? 'Open learning plan' : 'Review and claim guest progress'}</Link></div>
        </div>{(!previewMode || new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('qa') === 'agentified-credential') && <AgentifiedCompletionCredential profileName={data?.profileName} preview={previewMode} />}</section>
        <section className="rounded-lg border border-radiant-gold/25 p-6" aria-label="Agentified assessment"><h2 className="text-xl font-semibold">Agentified assessment</h2>{agentified.assessment ? <><p className="mt-2 text-sm text-platinum-white/75">{agentified.assessment.assessment?.diagnostic_summary ?? 'Your Agentified assessment is ready.'}</p><AssessmentScoreBreakdown scores={agentified.assessment.scores.categoryScores} hasFormalAssessment /></> : agentified.assessmentStatus ? <p className="mt-2 text-sm text-platinum-white/65">{agentified.assessmentStatus.summary ?? 'Your reviewed assessment is linked to this Operating File.'}</p> : <p className="mt-2 text-sm text-platinum-white/65">Your assessment appears here after the Operating File and assessment are reviewed together.</p>}</section>
        <section className="rounded-lg border border-radiant-gold/25 p-6" aria-label="Agentified recommendations"><h2 className="text-xl font-semibold">Agentified next steps</h2>{agentified.recommendations?.length ? <ul className="mt-3 space-y-4">{agentified.recommendations.map((item) => <li key={item.id}><strong>{item.title}</strong><p className="text-sm text-platinum-white/65">{item.rationale}</p><RecommendationAction item={item} preview={previewMode} /></li>)}</ul> : <p className="mt-2 text-sm text-platinum-white/65">Reviewed offers appear here when they fit your Operating File and assessment.</p>}</section>
      </section> : agentifiedError ? <section className="rounded-lg border border-radiant-gold/25 p-6"><p role="alert">{agentifiedError}</p><Link className="mt-2 inline-block text-radiant-gold underline" href="/agentified/learningplan">Open the Agentified Learning Plan</Link></section> : null}
      {loading ? <p role="status">Loading your dashboard…</p> : error ? <section className="rounded-lg border border-radiant-gold/25 p-6"><p role="alert">{error}</p>{error.startsWith('Sign in') ? <Link className="text-radiant-gold underline" href="/auth/login?redirect=%2Fmember%2Fdashboard">Sign in</Link> : null}</section> : data ? <>
        <section className="space-y-4" aria-label="Accelerated course"><div><p className="text-sm uppercase tracking-widest text-radiant-gold">Accelerated course</p><h2 className="mt-1 text-2xl font-semibold">Building Smarter Products with AI</h2></div><div className="grid gap-4 sm:grid-cols-3" aria-label="Accelerated progress">
          <div className="rounded-lg border border-radiant-gold/25 bg-silicon-slate/40 p-5"><span className="text-sm text-platinum-white/65">Lessons</span><strong className="mt-2 block text-3xl">{complete} / {lessons.length}</strong><progress className="mt-3 w-full" value={complete} max={lessons.length} aria-label="Lessons complete" /></div>
          <div className="rounded-lg border border-radiant-gold/25 bg-silicon-slate/40 p-5"><span className="text-sm text-platinum-white/65">Decision File pages started</span><strong className="mt-2 block text-3xl">{pages} / {lessons.length}</strong><p className="mt-2 text-xs text-platinum-white/60">{data.decisionFileCount ? `${data.decisionFileCount} submitted file linked by review` : 'Your worksheet is private until you choose to send it.'}</p><Link className="mt-3 inline-block text-radiant-gold underline" href="/accelerated/decision-file">Open complete Decision File</Link></div>
          <div className="rounded-lg border border-radiant-gold/25 bg-silicon-slate/40 p-5"><span className="text-sm text-platinum-white/65">Continue</span><strong className="mt-2 block text-2xl">{data.enrollment?.current_lesson_id ?? 'L01'}</strong><Link className="mt-3 inline-block text-radiant-gold underline" href="/service-prototypes/accelerated-cohort?view=3">Open learning plan</Link></div>
        </div><CompletionCredential completedCount={complete} profileName={data.profileName} /></section>
        <section className="rounded-lg border border-radiant-gold/25 p-6" aria-label="Assessment"><h2 className="text-xl font-semibold">Assessment</h2>{data.assessment ? <><p className="my-3 text-platinum-white/75">{data.assessment.assessment?.diagnostic_summary ?? 'Your completed assessment is linked to this account.'}</p><AssessmentScoreBreakdown scores={data.assessment.scores.categoryScores} hasFormalAssessment /></> : data.assessmentStatus ? <p className="mt-2 text-platinum-white/65">Completed assessment linked. {data.assessmentStatus.summary ?? 'The report is not available in this dashboard yet.'}</p> : <p className="mt-2 text-platinum-white/65">No completed assessment has been linked to this account. We review the assessment link before it appears here.</p>}</section>
        <section className="rounded-lg border border-radiant-gold/25 p-6" aria-label="Reviewed recommendations"><h2 className="text-xl font-semibold">Recommended next steps</h2>{data.recommendations.length ? <ul className="mt-3 space-y-4">{data.recommendations.map((item) => <li key={item.id} className="border-t border-radiant-gold/15 pt-4 first:border-0 first:pt-0"><strong>{item.title}</strong><p className="text-sm text-platinum-white/65">{item.rationale}</p><RecommendationAction item={item} preview={previewMode} /></li>)}</ul> : <p className="mt-2 text-platinum-white/65">No reviewed recommendation yet.</p>}</section>
        <section className="rounded-lg border border-radiant-gold/25 p-6" aria-label="Orders"><h2 className="text-xl font-semibold">Your orders</h2>{data.orders?.length ? <ul className="mt-3 space-y-3">{data.orders.map((order) => {
          const action = orderAction(order.status, order.id, previewMode, order.workshop)
          return <li key={order.id} className="flex flex-col gap-3 border-t border-radiant-gold/15 pt-3 first:border-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
            <div><strong>Order #{order.id}</strong>{order.workshop && <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-radiant-gold">{order.workshop}</span>}<p className="text-sm text-platinum-white/70">{order.order_items?.map((line) => line.products?.title || line.services?.title || 'Item').join(', ') || 'Order details'}</p><p className="text-xs text-platinum-white/60">{new Date(order.created_at).toLocaleDateString()} · {order.status === 'quote_pending' ? 'Price pending review' : `$${Number(order.final_amount).toFixed(2)}`}</p></div>
            <div className="flex flex-wrap items-center gap-3"><span className="rounded-full border border-radiant-gold/30 px-3 py-1 text-xs">{orderLabels[order.status] ?? 'Order update'}</span><Link className="min-h-11 inline-flex items-center text-radiant-gold underline" href={action.href}>{action.label}</Link></div>
          </li>
        })}</ul> : <p className="mt-2 text-platinum-white/65">No orders yet. Reviewed offers appear above after review.</p>}</section>
        <section className="space-y-4" aria-label="Client work"><h2 className="text-xl font-semibold">Client work</h2>{data.projects.length ? data.projects.map((project) => <div key={project.project.id} className="space-y-5 rounded-lg border border-radiant-gold/25 p-6"><h3 className="text-lg font-semibold">{project.project.project_name}</h3>{data.projectWorkshops?.[project.project.id] && <p className="text-xs font-semibold uppercase tracking-widest text-radiant-gold">{data.projectWorkshops[project.project.id]} · paid client project</p>}<AccountSummarySection accountSummary={project.accountSummary} timeTracking={project.timeTracking} milestones={project.milestones} documents={project.documents} />
          <div className="grid gap-5 lg:grid-cols-2"><div><h4 className="mb-2 font-semibold">Tasks</h4>{project.tasks?.length ? <><p className="mb-2 text-xs text-platinum-white/60">Task status is read only here. Use your client dashboard link to update it.</p><TaskChecklist tasks={project.tasks} readOnly /></> : <p className="text-sm text-platinum-white/65">No tasks yet.</p>}</div><div><h4 className="mb-2 font-semibold">Milestones</h4>{project.milestones?.length ? <MilestoneTimeline milestones={project.milestones as []} /> : <p className="text-sm text-platinum-white/65">No milestones yet.</p>}</div></div>
          <div><h4 className="mb-2 font-semibold">Meetings</h4>{data.projectMeetings?.[project.project.id]?.length ? <MeetingHistory initialMeetings={data.projectMeetings[project.project.id]} /> : <p className="text-sm text-platinum-white/65">No meetings yet.</p>}</div>
          <div><h4 className="mb-2 font-semibold">Documents and reports</h4><DocumentsSection documents={project.documents ?? []} />{(project.valueReports?.length || project.gammaReports?.length) ? <ReportsSection valueReports={project.valueReports ?? []} gammaReports={project.gammaReports ?? []} /> : null}{!project.documents?.length && !project.valueReports?.length && !project.gammaReports?.length && <p className="text-sm text-platinum-white/65">No documents or reports yet.</p>}</div>
        </div>) : <p className="text-platinum-white/65">No paid client project is linked to this account.</p>}</section>
      </> : null}
    </div>
  </main>
}
