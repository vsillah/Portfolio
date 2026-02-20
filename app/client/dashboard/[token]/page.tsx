'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import DashboardStatCards from '@/components/client-dashboard/DashboardStatCards'
import ScoreRadarChart from '@/components/client-dashboard/ScoreRadarChart'
import ConfidenceRadar from '@/components/client-dashboard/ConfidenceRadar'
import StrengthenConfidenceBlock from '@/components/client-dashboard/StrengthenConfidenceBlock'
import TrajectoryChart from '@/components/client-dashboard/TrajectoryChart'
import GapAnalysisPanel from '@/components/client-dashboard/GapAnalysisPanel'
import TaskChecklist from '@/components/client-dashboard/TaskChecklist'
import MilestoneTimeline from '@/components/client-dashboard/MilestoneTimeline'
import AssessmentDetails from '@/components/client-dashboard/AssessmentDetails'
import QuickOverview from '@/components/client-dashboard/QuickOverview'
import AccelerationCards from '@/components/client-dashboard/AccelerationCards'
import CampaignProgressSection from '@/components/client-dashboard/CampaignProgressSection'
import type { DashboardData, LeadDashboardData, DashboardTask } from '@/lib/client-dashboard'
import type { AccelerationRecommendation } from '@/lib/acceleration-engine'

export type DashboardStage = 'lead' | 'client'

export default function ClientDashboardPage() {
  const params = useParams()
  const token = params.token as string

  const [dashboard, setDashboard] = useState<DashboardData | LeadDashboardData | null>(null)
  const [stage, setStage] = useState<DashboardStage>('client')
  const [recommendations, setRecommendations] = useState<AccelerationRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <h1 className="text-2xl font-bold text-white mb-2">Dashboard Not Found</h1>
          <p className="text-gray-400">
            {error || 'This dashboard link may be invalid or expired. Please contact your consultant for a new link.'}
          </p>
        </div>
      </div>
    )
  }

  // Lead-stage view (assessment + confidence + strengthen; no tasks/milestones/trajectory yet)
  if (stage === 'lead' && 'confidence' in dashboard) {
    const leadData = dashboard as LeadDashboardData
    const { project, assessment, scores, gapAnalysis, confidence, strengthenQuestions, engagementSteps, industryBenchmarksMessage } = leadData
    return (
      <div className="min-h-screen bg-gray-950">
        <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">Your Assessment Dashboard</h1>
              <p className="text-xs text-gray-500">Lead view — complete your engagement to unlock full dashboard</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-300">{project.client_name}</p>
              {project.client_company && (
                <p className="text-xs text-gray-500">{project.client_company}</p>
              )}
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <p className="text-sm text-gray-400 italic">{industryBenchmarksMessage}</p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ScoreRadarChart scores={scores.categoryScores} />
            <div className="lg:col-span-2">
              {assessment ? (
                <AssessmentDetails assessment={assessment} valueReport={null} />
              ) : (
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                  <p className="text-gray-500 text-sm">No assessment data available yet.</p>
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
          <div className="bg-gray-900/50 rounded-xl border border-gray-800 border-dashed p-6 text-center">
            <p className="text-gray-500 text-sm">
              Tasks, milestones, and trajectory will appear here once you start your engagement.
            </p>
          </div>
        </main>
        <footer className="border-t border-gray-800 mt-12 py-6">
          <p className="text-center text-xs text-gray-600">
            Questions? Contact your consultant for assistance.
          </p>
        </footer>
      </div>
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
    nextMeeting,
    valueReport,
  } = dashboard as DashboardData

  const tasksCompleted = tasks.filter((t: DashboardTask) => t.status === 'complete').length
  const highPriorityRemaining = tasks.filter(
    (t: DashboardTask) => t.priority === 'high' && t.status !== 'complete'
  ).length
  const activeTasks = tasks.filter((t: DashboardTask) => t.status !== 'complete').length

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Client Dashboard</h1>
            <p className="text-xs text-gray-500">{project.project_name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-300">{project.client_name}</p>
            {project.client_company && (
              <p className="text-xs text-gray-500">{project.client_company}</p>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Row 1: Stat Cards */}
        <DashboardStatCards
          overallScore={scores.overallScore}
          scoreDelta={scores.delta}
          tasksCompleted={tasksCompleted}
          tasksTotal={tasks.length}
          highPriorityRemaining={highPriorityRemaining}
        />

        {/* Row 2: Radar + Assessment + Quick Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <ScoreRadarChart scores={scores.categoryScores} />
          </div>
          <div className="lg:col-span-1">
            {assessment ? (
              <AssessmentDetails assessment={assessment} valueReport={valueReport} />
            ) : (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Assessment
                </h3>
                <p className="text-gray-500 text-sm">
                  No assessment data available yet.
                </p>
              </div>
            )}
          </div>
          <div className="lg:col-span-1">
            <QuickOverview
              assessmentDate={project.project_start_date}
              activeTasks={activeTasks}
              nextMeeting={nextMeeting}
            />
          </div>
        </div>

        {/* Row 3: Gap Analysis */}
        <GapAnalysisPanel gaps={gapAnalysis} />

        {/* Row 4: Acceleration Opportunities */}
        <AccelerationCards
          recommendations={recommendations}
          token={token}
          onDismiss={handleDismissRec}
        />

        {/* Campaign Progress */}
        <CampaignProgressSection clientEmail={project.client_email} />

        {/* Row 5: Task Checklist */}
        {tasks.length > 0 && (
          <TaskChecklist
            tasks={tasks}
            token={token}
            onTaskUpdate={handleTaskUpdate}
          />
        )}

        {/* Row 6: Milestones */}
        <MilestoneTimeline milestones={milestones as []} />

        {/* Row 7: Trajectory */}
        {snapshots.length > 0 && (
          <TrajectoryChart token={token} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12 py-6">
        <p className="text-center text-xs text-gray-600">
          Questions about your dashboard? Contact your consultant for assistance.
        </p>
      </footer>
    </div>
  )
}
