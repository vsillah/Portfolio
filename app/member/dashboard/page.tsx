'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { lessons } from '@/lib/accelerated-decision-file'
import type { DashboardData, LeadDashboardData } from '@/lib/client-dashboard'
import AssessmentScoreBreakdown from '@/components/client-dashboard/AssessmentScoreBreakdown'
import AccountSummarySection from '@/components/client-dashboard/AccountSummarySection'

type MemberData = {
  enrollment: { current_lesson_id: string } | null
  lessons: { lesson_id: string; completed_at: string | null; video_seconds: number }[]
  worksheet: { answers: Record<string, string> } | null
  decisionFileCount: number
  assessmentStatus: { status: string; summary: string | null } | null
  assessment: LeadDashboardData | null
  recommendations: { id: string; title: string; rationale: string; offer_kind: string; offer_id: string }[]
  projects: DashboardData[]
}

function syntheticMember(state: string): MemberData {
  const assessed = state === 'assessed' || state === 'paid'
  return {
    enrollment: { current_lesson_id: 'L06' },
    lessons: lessons.slice(0, 5).map((lesson) => ({ lesson_id: lesson.id, completed_at: '2026-11-05T12:00:00Z', video_seconds: 90 })),
    worksheet: { answers: { L01: 'A synthetic team decision', L02: 'Three safe options' } },
    decisionFileCount: assessed ? 1 : 0,
    assessmentStatus: assessed ? { status: 'completed', summary: 'Synthetic assessment: the team has a clear decision but needs a stronger evidence handoff.' } : null,
    assessment: null,
    recommendations: assessed ? [{ id: 'synthetic-recommendation', title: 'Review the evidence handoff', rationale: 'Operator-reviewed example for this local preview.', offer_kind: 'service', offer_id: 'synthetic' }] : [],
    projects: state === 'paid' ? [{ project: { id: 'synthetic-project', project_name: 'Synthetic client engagement' }, accountSummary: null, timeTracking: { total_seconds: 0, by_target: [] }, milestones: [], documents: [] } as unknown as DashboardData] : [],
  }
}

export default function MemberDashboardPage() {
  const [data, setData] = useState<MemberData | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    async function load() {
      const preview = process.env.NODE_ENV === 'development' ? new URLSearchParams(window.location.search).get('qa') : null
      if (preview && ['member', 'assessed', 'paid'].includes(preview)) { setData(syntheticMember(preview)); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Sign in to see your member dashboard.'); return }
      try {
        const response = await fetch('/api/accelerated/member', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' })
        if (!response.ok) throw new Error('Your dashboard is temporarily unavailable.')
        const result = await response.json()
        if (active) setData(result)
      } catch { if (active) setError('Your dashboard is temporarily unavailable.') }
    }
    void load()
    return () => { active = false }
  }, [])
  const complete = data?.lessons.filter((item) => item.completed_at).length ?? 0
  const pages = Object.values(data?.worksheet?.answers ?? {}).filter((value) => value.trim()).length
  return <main className="min-h-screen bg-imperial-navy px-4 py-10 text-platinum-white sm:px-8">
    <div className="mx-auto max-w-5xl space-y-8">
      <header><p className="text-sm uppercase tracking-widest text-radiant-gold">AmaduTown member</p><h1 className="mt-2 text-3xl font-bold">Your learning, in one place</h1><p className="mt-2 text-platinum-white/70">Pick up the next lesson. Your assessment and client work appear here only after they are linked to your account.</p></header>
      {error ? <section className="rounded-lg border border-radiant-gold/25 p-6"><p role="alert">{error}</p><Link className="text-radiant-gold underline" href="/auth/login?redirect=%2Fmember%2Fdashboard">Sign in</Link></section> : !data ? <p role="status">Loading your dashboard…</p> : <>
        <section className="grid gap-4 sm:grid-cols-3" aria-label="Course progress">
          <div className="rounded-lg border border-radiant-gold/25 bg-silicon-slate/40 p-5"><span className="text-sm text-platinum-white/65">Lessons</span><strong className="mt-2 block text-3xl">{complete} / {lessons.length}</strong><progress className="mt-3 w-full" value={complete} max={lessons.length} aria-label="Lessons complete" /></div>
          <div className="rounded-lg border border-radiant-gold/25 bg-silicon-slate/40 p-5"><span className="text-sm text-platinum-white/65">Decision File pages started</span><strong className="mt-2 block text-3xl">{pages} / {lessons.length}</strong><p className="mt-2 text-xs text-platinum-white/60">{data.decisionFileCount ? `${data.decisionFileCount} submitted file linked by review` : 'Your worksheet is private until you choose to send it.'}</p></div>
          <div className="rounded-lg border border-radiant-gold/25 bg-silicon-slate/40 p-5"><span className="text-sm text-platinum-white/65">Continue</span><strong className="mt-2 block text-2xl">{data.enrollment?.current_lesson_id ?? 'L01'}</strong><Link className="mt-3 inline-block text-radiant-gold underline" href="/service-prototypes/accelerated-cohort?view=3">Open learning plan</Link></div>
        </section>
        <section className="rounded-lg border border-radiant-gold/25 p-6" aria-label="Assessment"><h2 className="text-xl font-semibold">Assessment</h2>{data.assessment ? <><p className="my-3 text-platinum-white/75">{data.assessment.assessment?.diagnostic_summary ?? 'Your completed assessment is linked to this account.'}</p><AssessmentScoreBreakdown scores={data.assessment.scores.categoryScores} hasFormalAssessment /></> : data.assessmentStatus ? <p className="mt-2 text-platinum-white/65">Completed assessment linked. {data.assessmentStatus.summary ?? 'The report is not available in this dashboard yet.'}</p> : <p className="mt-2 text-platinum-white/65">No completed assessment has been linked to this account. An operator reviews identity before it appears here.</p>}</section>
        <section className="rounded-lg border border-radiant-gold/25 p-6" aria-label="Reviewed recommendations"><h2 className="text-xl font-semibold">Recommended next steps</h2>{data.recommendations.length ? <ul className="mt-3 space-y-3">{data.recommendations.map((item) => <li key={item.id}><strong>{item.title}</strong><p className="text-sm text-platinum-white/65">{item.rationale}</p></li>)}</ul> : <p className="mt-2 text-platinum-white/65">No operator-reviewed recommendation yet.</p>}</section>
        <section className="space-y-4" aria-label="Client work"><h2 className="text-xl font-semibold">Client work</h2>{data.projects.length ? data.projects.map((project) => <div key={project.project.id} className="rounded-lg border border-radiant-gold/25 p-6"><h3 className="mb-3 text-lg font-semibold">{project.project.project_name}</h3><AccountSummarySection accountSummary={project.accountSummary} timeTracking={project.timeTracking} milestones={project.milestones} documents={project.documents} /></div>) : <p className="text-platinum-white/65">No paid client project is linked to this account.</p>}</section>
      </>}
    </div>
  </main>
}
