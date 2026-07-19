'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Check, Copy, Loader2 } from 'lucide-react'
import DashboardStatCards from '@/components/client-dashboard/DashboardStatCards'
import ExecutiveSummary, {
  ActionFocusCommentary,
  AssessmentScoresCommentary,
  TrajectoryCommentary,
} from '@/components/client-dashboard/ExecutiveSummary'
import ScoreRadarChart from '@/components/client-dashboard/ScoreRadarChart'
import AssessmentScoreBreakdown from '@/components/client-dashboard/AssessmentScoreBreakdown'
import ConfidenceRadar from '@/components/client-dashboard/ConfidenceRadar'
import StrengthenConfidenceBlock from '@/components/client-dashboard/StrengthenConfidenceBlock'
import TrajectoryChart from '@/components/client-dashboard/TrajectoryChart'
import GapAnalysisPanel from '@/components/client-dashboard/GapAnalysisPanel'
import TaskChecklist from '@/components/client-dashboard/TaskChecklist'
import MilestoneTimeline from '@/components/client-dashboard/MilestoneTimeline'
import AssessmentDetails from '@/components/client-dashboard/AssessmentDetails'
import AccelerationCards from '@/components/client-dashboard/AccelerationCards'
import CampaignProgressSection from '@/components/client-dashboard/CampaignProgressSection'
import DocumentsSection from '@/components/client-dashboard/DocumentsSection'
import ReportsSection from '@/components/client-dashboard/ReportsSection'
import AccountSummarySection from '@/components/client-dashboard/AccountSummarySection'
import MeetingHistory from '@/components/client-dashboard/MeetingHistory'
import AiOpsRoadmapSection from '@/components/client-dashboard/AiOpsRoadmapSection'
import BuildEvidenceInvestmentSection from '@/components/client-dashboard/BuildEvidenceInvestmentSection'
import type { DashboardData, LeadDashboardData, DashboardTask } from '@/lib/client-dashboard'
import type { AccelerationRecommendation } from '@/lib/acceleration-engine'
import SiteThemeCorner from '@/components/SiteThemeCorner'

export type DashboardStage = 'lead' | 'client'

export default function ClientDashboardPage() {
  const params = useParams()
  const token = params.token as string

  const [dashboard, setDashboard] = useState<DashboardData | LeadDashboardData | null>(null)
  const [stage, setStage] = useState<DashboardStage>('client')
  const [recommendations, setRecommendations] = useState<AccelerationRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedDashboardUrl, setCopiedDashboardUrl] = useState(false)
  const copyResetTimeoutRef = useRef<number | null>(null)

  // Fetch dashboard data
  useEffect(() => {
    if (!token) return

    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const [dashRes, accelRes] = await Promise.all([
          fetch(`/api/client/dashboard/${token}`),
          fetch(`/api/client/dashboard/${token}/accelerators`),
        ])

        if (!dashRes.ok) {
          const err = await dashRes.json()
          throw new Error(err.error || 'Failed to load dashboard')
        }

        const { data: dashData, stage: resStage } = await dashRes.json()
        setDashboard(dashData)
        setStage(resStage === 'lead' ? 'lead' : 'client')

        if (accelRes?.ok) {
          const accelData = await accelRes.json()
          setRecommendations(accelData.recommendations || [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [token])

  // Task status update handler (optimistic UI) — only for client dashboard
  const handleTaskUpdate = useCallback(
    (taskId: string, newStatus: string) => {
      if (!dashboard) return

      setDashboard((prev) => {
        if (!prev) return prev
        if (!('tasks' in prev) || !Array.isArray(prev.tasks)) return prev
        const updatedTasks = prev.tasks.map((t: DashboardTask) =>
          t.id === taskId
            ? {
                ...t,
                status: newStatus as DashboardTask['status'],
                completed_at: newStatus === 'complete' ? new Date().toISOString() : null,
              }
            : t
        )
        return { ...prev, tasks: updatedTasks }
      })
    },
    [dashboard]
  )

  // Recommendation dismiss handler
  const handleDismissRec = useCallback((recId: string) => {
    setRecommendations((prev) => prev.filter((r) => r.id !== recId))
  }, [])

  const handleCopyDashboardUrl = useCallback(async () => {
    if (typeof window === 'undefined') return

    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopiedDashboardUrl(true)

      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }

      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopiedDashboardUrl(false)
        copyResetTimeoutRef.current = null
      }, 2000)
    } catch (copyError) {
      console.error('Failed to copy dashboard URL', copyError)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
    }
  }, [])

  // Loading state
  if (loading) {
    return (
      <>
        <SiteThemeCorner />
      <div className="min-h-screen bg-imperial-navy flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-radiant-gold mx-auto mb-4" />
          <p className="text-platinum-white/70 text-sm">Loading your dashboard...</p>
        </div>
      </div>
      </>
    )
  }

  // Error state
  if (error || !dashboard) {
    return (
      <>
        <SiteThemeCorner />
      <div className="min-h-screen bg-imperial-navy flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <h1 className="text-2xl font-bold text-platinum-white mb-2">Dashboard Not Found</h1>
          <p className="text-platinum-white/65">
            {error || 'This dashboard link may be invalid or expired. Please contact your consultant for a new link.'}
          </p>
        </div>
      </div>
      </>
    )
  }

  // Lead-stage view (assessment + confidence + strengthen; no tasks/milestones/trajectory yet)
  if (stage === 'lead' && 'confidence' in dashboard) {
    const leadData = dashboard as LeadDashboardData
    const { project, assessment, scores, gapAnalysis, confidence, strengthenQuestions, engagementSteps, industryBenchmarksMessage } = leadData
    return (
      <>
        <SiteThemeCorner />
      <div className="min-h-screen bg-imperial-navy text-platinum-white">
        <header className="sticky top-0 z-10 border-b border-radiant-gold/20 bg-imperial-navy/90 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/amadutown-logo-upscaled.png"
                alt="AmaduTown Advisory Solutions"
                className="h-11 w-auto"
              />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-radiant-gold">
                  AmaduTown Client Portal
                </p>
                <h1 className="text-lg font-bold text-platinum-white">Your Assessment Dashboard</h1>
                <p className="text-xs text-platinum-white/55">Lead view - complete your engagement to unlock full dashboard</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-platinum-white">{project.client_name}</p>
              {project.client_company && (
                <p className="text-xs text-radiant-gold/75">{project.client_company}</p>
              )}
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <p className="text-sm text-platinum-white/65 italic">{industryBenchmarksMessage}</p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ScoreRadarChart scores={scores.categoryScores} />
            <div className="lg:col-span-2">
              {assessment ? (
              <AssessmentDetails
                assessment={assessment}
                valueReport={null}
              />
              ) : (
                <div className="rounded-lg border border-radiant-gold/15 bg-silicon-slate/35 p-5">
                  <p className="text-platinum-white/55 text-sm">No assessment data available yet.</p>
                </div>
              )}
            </div>
          </div>
          <GapAnalysisPanel gaps={gapAnalysis} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ConfidenceRadar confidence={confidence} />
            <StrengthenConfidenceBlock
              strengthenQuestions={strengthenQuestions}
              engagementSteps={engagementSteps}
            />
          </div>
          <div className="rounded-lg border border-dashed border-radiant-gold/25 bg-silicon-slate/25 p-6 text-center">
            <p className="text-platinum-white/55 text-sm">
              Tasks, milestones, and trajectory will appear here once you start your engagement.
            </p>
          </div>
        </main>
        <footer className="border-t border-radiant-gold/15 mt-12 py-6">
          <p className="text-center text-xs text-platinum-white/40">
            Questions? Contact your consultant for assistance.
          </p>
        </footer>
      </div>
      </>
    )
  }

  // Client-stage view (full dashboard)
  const {
    project,
    assessment,
    scores,
    gapAnalysis,
    tasks,
    milestones,
    snapshots,
    documents,
    timeTracking,
    nextMeeting,
    valueReport,
    valueReports,
    gammaReports,
    aiOpsRoadmap,
    buildEvidence,
    accountSummary,
  } = dashboard as DashboardData

  const tasksCompleted = tasks.filter((t: DashboardTask) => t.status === 'complete').length
  const highPriorityRemaining = tasks.filter(
    (t: DashboardTask) => t.priority === 'high' && t.status !== 'complete'
  ).length
  const activeTasks = tasks.filter((t: DashboardTask) => t.status !== 'complete').length

  return (
    <>
      <SiteThemeCorner />
    <div className="min-h-screen bg-imperial-navy text-platinum-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-radiant-gold/20 bg-imperial-navy/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/amadutown-logo-upscaled.png"
              alt="AmaduTown Advisory Solutions"
              className="h-11 w-auto shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-radiant-gold">
                AmaduTown Client Portal
              </p>
              <h1 className="text-lg font-bold text-platinum-white">Client Dashboard</h1>
              <p className="truncate text-xs text-platinum-white/55">{project.project_name}</p>
            </div>
          </div>
          <div className="shrink-0">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={handleCopyDashboardUrl}
                className="inline-flex items-center gap-2 rounded-md border border-radiant-gold/25 bg-silicon-slate/45 px-3 py-1.5 text-xs font-medium text-radiant-gold transition hover:border-radiant-gold/50 hover:bg-silicon-slate/60"
                aria-label="Copy dashboard URL"
              >
                {copiedDashboardUrl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedDashboardUrl ? 'Copied' : 'Copy URL'}</span>
              </button>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-platinum-white">{project.client_name}</p>
              {project.client_company && (
                <p className="text-xs text-radiant-gold/75">{project.client_company}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Row 1: Stat Cards */}
        <DashboardStatCards
          overallScore={scores.overallScore}
          scoreDelta={scores.delta}
          tasksCompleted={tasksCompleted}
          tasksTotal={tasks.length}
          highPriorityRemaining={highPriorityRemaining}
        />

        <ExecutiveSummary
          clientCompany={project.client_company}
          highPriorityRemaining={highPriorityRemaining}
          diagnosticSummary={assessment?.diagnostic_summary || null}
          recommendedActions={assessment?.recommended_actions || null}
        />

        {/* Row 2: Radar + Trajectory */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="grid gap-3 xl:grid-cols-[minmax(220px,0.75fr)_minmax(0,1.25fr)] xl:items-stretch">
              <AssessmentScoresCommentary categoryScores={scores.categoryScores} />
              <ScoreRadarChart scores={scores.categoryScores} />
            </div>
            <AssessmentScoreBreakdown
              scores={scores.categoryScores}
              hasFormalAssessment={Boolean(assessment)}
              formalAssessmentHref="/tools/audit"
            />
          </div>
          <div className="space-y-3">
            <div className="grid gap-3 xl:grid-cols-[minmax(220px,0.75fr)_minmax(0,1.25fr)] xl:items-stretch">
              <TrajectoryCommentary
                scoreDelta={scores.delta}
                snapshotsCount={snapshots.length}
              />
              {snapshots.length > 0 ? (
                <TrajectoryChart token={token} />
              ) : (
                <div className="rounded-lg border border-radiant-gold/15 bg-silicon-slate/35 p-5">
                  <h3 className="mb-2 text-sm font-medium uppercase tracking-wider text-radiant-gold">
                    Score Trajectory
                  </h3>
                  <p className="text-sm text-platinum-white/55">
                    Score trajectory will appear once milestone-based projections are available.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <AccountSummarySection
          accountSummary={accountSummary}
          timeTracking={timeTracking || { total_seconds: 0, by_target: [] }}
          milestones={milestones || []}
          documents={documents || []}
        />

        {/* Row 3: Gap Analysis */}
        <GapAnalysisPanel gaps={gapAnalysis} />

        {/* Row 4: Acceleration Opportunities */}
        <AccelerationCards
          recommendations={recommendations}
          token={token}
          onDismiss={handleDismissRec}
        />

        {/* Row 5: Assessment */}
        <div className="grid grid-cols-1 gap-6">
          <div>
            {assessment ? (
              <AssessmentDetails
                assessment={assessment}
                valueReport={valueReport}
                assessmentDate={project.project_start_date}
              />
            ) : (
              <div className="rounded-lg border border-radiant-gold/15 bg-silicon-slate/35 p-5">
                <h3 className="text-sm font-medium text-radiant-gold uppercase tracking-wider mb-2">
                  Assessment
                </h3>
                <p className="text-platinum-white/55 text-sm">
                  No assessment data available yet.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Row 6: Reports & Presentations (only when reports exist) */}
        {((valueReports && valueReports.length > 0) || (gammaReports && gammaReports.length > 0)) && (
          <ReportsSection
            valueReports={valueReports || []}
            gammaReports={gammaReports || []}
          />
        )}

        {aiOpsRoadmap && (
          <AiOpsRoadmapSection roadmap={aiOpsRoadmap} />
        )}

        {/* Row 7: Documents and resources */}
        <div className="grid grid-cols-1 gap-6">
          <DocumentsSection documents={documents || []} />
        </div>

        {buildEvidence && (
          <BuildEvidenceInvestmentSection buildEvidence={buildEvidence} />
        )}

        {/* Campaign Progress */}
        <CampaignProgressSection clientEmail={project.client_email} />

        {/* Row 8: Task Checklist */}
        {tasks.length > 0 && (
          <div className="space-y-3">
            <TaskChecklist
              tasks={tasks}
              token={token}
              onTaskUpdate={handleTaskUpdate}
            />
            <ActionFocusCommentary
              tasksCompleted={tasksCompleted}
              tasksTotal={tasks.length}
              highPriorityRemaining={highPriorityRemaining}
              recommendationsCount={recommendations.length}
            />
          </div>
        )}

        {/* Row 9: Milestones */}
        <MilestoneTimeline milestones={milestones as []} />

        {/* Row 10: Meeting History */}
        <MeetingHistory token={token} />
      </main>

      {/* Footer */}
      <footer className="border-t border-radiant-gold/15 mt-12 py-6">
        <p className="text-center text-xs text-platinum-white/40">
          Questions about your dashboard? Contact your consultant for assistance.
        </p>
      </footer>
    </div>
    </>
  )
}
