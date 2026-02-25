'use client'

/**
 * Admin Testing Dashboard
 * 
 * Manage E2E test runs, view results, and handle error remediation.
 */

import { useState, useEffect, useCallback } from 'react'
import { 
  Play, 
  Square, 
  RefreshCw, 
  Trash2, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Clock,
  Users,
  FileText,
  Wrench,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Database,
  Zap,
  Info,
  ArrowRight,
  Lock,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import type { JourneyStage } from '@/lib/testing/types'
import { ALL_JOURNEY_SCRIPTS, JOURNEY_STAGES, getScriptsByStage, JOURNEY_SCRIPTS_BY_ID } from '@/lib/testing/journey-scripts'
import type { JourneyScript } from '@/lib/testing/journey-scripts'

// Types
interface LiveClientActivity {
  clientId: string
  personaName: string
  personaId: string
  scenarioId: string
  scenarioName: string
  currentStepIndex: number
  totalSteps: number
  currentStepType: string
  currentStepDescription: string
  startedAt: string
  stepStartedAt: string
  elapsedMs: number
  status: 'running' | 'completing' | 'error'
  lastAction?: string
}

interface TestRun {
  id: string
  run_id: string
  started_at: string
  completed_at?: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  clients_spawned: number
  clients_completed: number
  clients_failed: number
  config: Record<string, unknown>
  liveStats?: {
    clientsRunning: number
    recentErrors: TestError[]
    liveActivity?: LiveClientActivity[]
  }
}

interface TestError {
  error_id: string
  error_type: string
  error_message: string
  scenario: string
  step_type: string
  step_config?: Record<string, unknown>
  occurred_at: string
  remediation_status: string
  remediation_request_id?: string
}

interface RemediationRequest {
  id: string
  status: string
  priority: string
  created_at: string
  error_ids: string[]
  analysis?: {
    rootCause: string
    confidence: number
  }
  github_pr_url?: string
  cursor_task_id?: string
}

// Available scenarios grouped by journey stage
interface ScenarioMeta {
  id: string
  name: string
  tags: string[]
  journeyStage: JourneyStage | JourneyStage[]
}

const SCENARIOS: ScenarioMeta[] = [
  { id: 'quick_browse', name: 'Quick Browse (Smoke)', tags: ['smoke'], journeyStage: 'prospect' },
  { id: 'standalone_audit_tool', name: 'Standalone Audit Tool', tags: ['smoke', 'resources', 'audit', 'lead-magnet'], journeyStage: 'prospect' },
  { id: 'abandoned_cart', name: 'Abandoned Cart', tags: ['e-commerce'], journeyStage: 'prospect' },
  { id: 'chat_to_diagnostic', name: 'Chat to Diagnostic', tags: ['chat'], journeyStage: ['prospect', 'lead'] },
  { id: 'service_inquiry', name: 'Service Inquiry', tags: ['services'], journeyStage: ['prospect', 'lead'] },
  { id: 'warm_lead_pipeline', name: 'Warm Lead Pipeline', tags: ['warm-leads', 'outreach', 'critical'], journeyStage: 'lead' },
  { id: 'support_escalation', name: 'Support Escalation', tags: ['chat'], journeyStage: 'lead' },
  { id: 'full_funnel', name: 'Full Funnel Journey', tags: ['critical'], journeyStage: ['prospect', 'lead', 'client'] },
  { id: 'browse_and_buy', name: 'Browse and Buy', tags: ['e-commerce'], journeyStage: 'client' },
]

const SCENARIO_PRESETS = [
  { id: 'all', label: 'All' },
  { id: 'journey', label: 'Client Journey' },
  { id: 'critical', label: 'Critical' },
  { id: 'smoke', label: 'Smoke' },
] as const

function scenariosForStage(stage: JourneyStage): ScenarioMeta[] {
  return SCENARIOS.filter(s => {
    const stages = Array.isArray(s.journeyStage) ? s.journeyStage : [s.journeyStage]
    return stages.includes(stage)
  })
}

const JOURNEY_SCENARIO_IDS = [
  'quick_browse', 'standalone_audit_tool',
  'chat_to_diagnostic', 'service_inquiry',
  'warm_lead_pipeline', 'support_escalation',
  'full_funnel', 'browse_and_buy',
]

const PERSONAS = [
  { id: 'startup_sarah', name: 'Startup Sarah', traits: ['high urgency', 'questioning'] },
  { id: 'enterprise_eric', name: 'Enterprise Eric', traits: ['thorough', 'detailed'] },
  { id: 'skeptical_sam', name: 'Skeptical Sam', traits: ['price-focused', 'objections'] },
  { id: 'ready_rachel', name: 'Ready Rachel', traits: ['decision maker', 'ready to buy'] },
  { id: 'technical_tom', name: 'Technical Tom', traits: ['technical', 'API-focused'] },
  { id: 'browsing_brenda', name: 'Browsing Brenda', traits: ['exploratory', 'casual'] }
]

const RUNS_PER_PAGE = 5

export default function TestingDashboard() {
  // State
  const [testRuns, setTestRuns] = useState<TestRun[]>([])
  const [activeRuns, setActiveRuns] = useState<string[]>([])
  const [errors, setErrors] = useState<TestError[]>([])
  const [remediations, setRemediations] = useState<RemediationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [errorsModalRunId, setErrorsModalRunId] = useState<string | null>(null)
  const [errorsModalLoading, setErrorsModalLoading] = useState(false)
  const [runsPage, setRunsPage] = useState(0)
  
  // Config state
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([])
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([])
  const [maxConcurrent, setMaxConcurrent] = useState(1)
  const [runDuration, setRunDuration] = useState(60)
  const [cleanupAfter, setCleanupAfter] = useState(true)
  
  // UI state
  const [showConfig, setShowConfig] = useState(false)
  const [showScriptsPanel, setShowScriptsPanel] = useState(false)
  const [selectedErrors, setSelectedErrors] = useState<string[]>([])
  const [cursorPrompt, setCursorPrompt] = useState<string | null>(null)
  const [remediationLoading, setRemediationLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [stripeCheckoutLoading, setStripeCheckoutLoading] = useState(false)
  const [lastCheckoutUrl, setLastCheckoutUrl] = useState<string | null>(null)
  const [triggeringScripts, setTriggeringScripts] = useState<Record<string, boolean>>({})
  const [scriptLastRun, setScriptLastRun] = useState<Record<string, { at: string; success: boolean }>>({})
  const [cleanupLoading, setCleanupLoading] = useState(false)

  // Session state for completed scripts (persisted in sessionStorage)
  const SESSION_KEY = 'journey_test_session'
  const [completedScripts, setCompletedScripts] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        setCompletedScripts(new Set(parsed))
      }
    } catch { /* ignore corrupt data */ }
  }, [])

  const markScriptCompleted = useCallback((scriptId: string) => {
    setCompletedScripts(prev => {
      const next = new Set(prev)
      next.add(scriptId)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  const resetSession = useCallback(() => {
    setCompletedScripts(new Set())
    sessionStorage.removeItem(SESSION_KEY)
    setScriptLastRun({})
  }, [])

  const isPrereqMet = useCallback((script: JourneyScript): boolean => {
    if (!script.prereqScriptId) return true
    return completedScripts.has(script.prereqScriptId)
  }, [completedScripts])

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      // Fetch test runs
      const runsRes = await fetch('/api/testing/run?limit=10')
      const runsData = await runsRes.json()
      setTestRuns(runsData.runs || [])
      setActiveRuns(runsData.activeRuns || [])
      
      // Fetch remediations
      const remRes = await fetch('/api/testing/remediation?limit=10')
      const remData = await remRes.json()
      setRemediations(remData.requests || [])
      
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }, [])
  
  // Fetch errors for a run (used by both inline selection and modal)
  const fetchErrors = useCallback(async (runId: string) => {
    try {
      const res = await fetch(`/api/testing/status?runId=${runId}`)
      const data = await res.json()
      setErrors(data.recentErrors || [])
    } catch (error) {
      console.error('Failed to fetch errors:', error)
    }
  }, [])

  // Open the errors modal for a specific run
  const openErrorsModal = useCallback(async (runId: string) => {
    setErrorsModalRunId(runId)
    setErrorsModalLoading(true)
    setSelectedErrors([])
    try {
      const res = await fetch(`/api/testing/status?runId=${runId}`)
      const data = await res.json()
      setErrors(data.recentErrors || [])
    } catch (error) {
      console.error('Failed to fetch errors:', error)
    } finally {
      setErrorsModalLoading(false)
    }
  }, [])

  const closeErrorsModal = useCallback(() => {
    setErrorsModalRunId(null)
    setSelectedErrors([])
  }, [])
  
  useEffect(() => {
    fetchData()
    
    // Poll for updates when there are active runs (2s for live activity)
    const interval = setInterval(() => {
      if (activeRuns.length > 0) {
        fetchData()
      }
    }, 2000)
    
    return () => clearInterval(interval)
  }, [fetchData, activeRuns.length])
  
  // Re-fetch errors when the modal is open and data refreshes (e.g. after remediation)
  useEffect(() => {
    if (errorsModalRunId) {
      fetchErrors(errorsModalRunId)
    }
  }, [errorsModalRunId, fetchErrors])
  
  // Start a test run (manual scenario selection or preset)
  const startTestRun = async (preset?: string) => {
    try {
      const body: Record<string, unknown> = {
        personaIds: selectedPersonas.length > 0 ? selectedPersonas : undefined,
        maxConcurrentClients: maxConcurrent,
        runDuration: runDuration * 1000,
        cleanupAfter,
      }
      if (preset) {
        body.scenarioPreset = preset
      } else if (selectedScenarios.length > 0) {
        body.scenarioIds = selectedScenarios
      }

      const res = await fetch('/api/testing/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      
      const data = await res.json()
      
      if (data.success) {
        showToast('success', `Test run started: ${data.runId}`)
        fetchData()
      } else {
        showToast('error', data.error || 'Failed to start test')
      }
    } catch (error) {
      console.error('Failed to start test:', error)
      showToast('error', 'Failed to start test run')
    }
  }

  // Apply a scenario preset (selects the right scenario IDs)
  const applyPreset = (presetId: string) => {
    switch (presetId) {
      case 'journey':
        setSelectedScenarios(JOURNEY_SCENARIO_IDS)
        break
      case 'critical':
        setSelectedScenarios(SCENARIOS.filter(s => s.tags.includes('critical')).map(s => s.id))
        break
      case 'smoke':
        setSelectedScenarios(SCENARIOS.filter(s => s.tags.includes('smoke')).map(s => s.id))
        break
      case 'all':
      default:
        setSelectedScenarios([])
        break
    }
  }

  // Trigger a webhook script from the journey scripts panel
  const triggerScript = async (script: JourneyScript) => {
    setTriggeringScripts(prev => ({ ...prev, [script.id]: true }))
    showToast('info', `Triggering ${script.label}...`)
    try {
      const session = await getCurrentSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

      const res = await fetch('/api/admin/testing/trigger-webhook', {
        method: 'POST',
        headers,
        body: JSON.stringify({ scriptId: script.id }),
      })
      const data = await res.json()
      if (data.success) {
        showToast('success', `Trigger sent (HTTP ${data.httpStatus})`)
        setScriptLastRun(prev => ({ ...prev, [script.id]: { at: new Date().toISOString(), success: true } }))
        markScriptCompleted(script.id)
      } else {
        showToast('error', data.error || 'Trigger failed')
        setScriptLastRun(prev => ({ ...prev, [script.id]: { at: new Date().toISOString(), success: false } }))
      }
    } catch {
      showToast('error', 'Failed to trigger webhook')
      setScriptLastRun(prev => ({ ...prev, [script.id]: { at: new Date().toISOString(), success: false } }))
    } finally {
      setTriggeringScripts(prev => ({ ...prev, [script.id]: false }))
    }
  }

  // Copy seed SQL to clipboard
  const copySeedSql = async (script: JourneyScript) => {
    try {
      const session = await getCurrentSession()
      const headers: Record<string, string> = {}
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

      const res = await fetch(`/api/admin/testing/seed-sql?scriptId=${script.id}`, { headers })
      const data = await res.json()
      if (data.sql) {
        await navigator.clipboard.writeText(data.sql)
        showToast('success', 'SQL copied to clipboard! Run it in Supabase, then mark as done.')
        markScriptCompleted(script.id)
      } else {
        showToast('error', data.error || 'Failed to load SQL')
      }
    } catch {
      showToast('error', 'Failed to copy SQL')
    }
  }
  
  // Stop a test run
  const stopTestRun = async (runId: string) => {
    try {
      const res = await fetch(`/api/testing/run?runId=${runId}`, {
        method: 'DELETE'
      })
      
      const data = await res.json()
      
      if (data.success) {
        alert('Test run stopped')
        fetchData()
      }
    } catch (error) {
      console.error('Failed to stop test:', error)
    }
  }
  
  // Clean up test data
  const cleanupRun = async (runId: string) => {
    if (!confirm('Are you sure you want to delete this test run and all its data?')) {
      return
    }
    
    try {
      const res = await fetch(`/api/testing/cleanup?runId=${runId}`, {
        method: 'DELETE'
      })
      
      const data = await res.json()
      
      if (data.success) {
        alert('Test data cleaned up')
        fetchData()
      }
    } catch (error) {
      console.error('Failed to cleanup:', error)
    }
  }
  
  // Show toast notification
  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Get remediation status for an error (checks both error's own field and remediation requests)
  const getErrorRemediationInfo = (error: TestError): { 
    status: string
    remediationId?: string 
    errorStatus?: string
  } | null => {
    // First check if error has a direct remediation_request_id
    if (error.remediation_request_id) {
      const rem = remediations.find(r => r.id === error.remediation_request_id)
      return {
        status: rem?.status || 'pending',
        remediationId: error.remediation_request_id,
        errorStatus: error.remediation_status
      }
    }
    // Fall back to searching in remediation request error_ids
    const rem = remediations.find(r => r.error_ids.includes(error.error_id))
    if (rem) {
      return { status: rem.status, remediationId: rem.id, errorStatus: error.remediation_status }
    }
    return null
  }

  // Scroll to remediation request (closes modal first so the target is visible)
  const scrollToRemediation = (remediationId: string) => {
    closeErrorsModal()
    setTimeout(() => {
      const element = document.getElementById(`remediation-${remediationId}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        element.classList.add('ring-2', 'ring-purple-500')
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-purple-500')
        }, 2000)
      }
    }, 100)
  }

  // Remediation status badge component (clickable)
  const RemediationBadge = ({ 
    status, 
    remediationId,
    errorStatus,
    onClick 
  }: { 
    status: string
    remediationId?: string
    errorStatus?: string
    onClick?: () => void 
  }) => {
    // Status config for remediation request status
    const requestStatusConfig: Record<string, { color: string; label: string }> = {
      pending: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50', label: 'Pending' },
      analyzing: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/50', label: 'Analyzing' },
      generating_fix: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/50', label: 'Generating Fix' },
      review_required: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/50', label: 'Sent to Cursor' },
      applied: { color: 'bg-green-500/20 text-green-400 border-green-500/50', label: 'Applied' },
      failed: { color: 'bg-red-500/20 text-red-400 border-red-500/50', label: 'Failed' },
      rejected: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/50', label: 'Rejected' }
    }
    
    // Status config for error-level remediation status
    const errorStatusConfig: Record<string, { color: string; label: string }> = {
      pending: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/50', label: 'Pending' },
      in_progress: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/50', label: 'In Progress' },
      fixed: { color: 'bg-green-500/20 text-green-400 border-green-500/50', label: 'Fixed' },
      ignored: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/50', label: 'Ignored' },
      wont_fix: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/50', label: "Won't Fix" }
    }
    
    // Use error status if it's been resolved, otherwise use request status
    const useErrorStatus = errorStatus && ['fixed', 'ignored', 'wont_fix'].includes(errorStatus)
    const config = useErrorStatus 
      ? (errorStatusConfig[errorStatus!] || errorStatusConfig.pending)
      : (requestStatusConfig[status] || requestStatusConfig.pending)
    
    return (
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onClick?.()
        }}
        className={`px-2 py-0.5 rounded text-xs border ${config.color} ${onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition-opacity`}
        title={remediationId ? `Click to view remediation request` : undefined}
      >
        {config.label}
      </button>
    )
  }

  // Create remediation request
  const createRemediation = async (output: 'cursor_task' | 'github_pr' | 'n8n_workflow') => {
    if (selectedErrors.length === 0) {
      showToast('error', 'Please select errors to remediate')
      return
    }
    
    setRemediationLoading(true)
    showToast('info', `Creating ${output === 'cursor_task' ? 'Cursor task' : output === 'github_pr' ? 'GitHub PR' : 'n8n workflow'}...`)
    
    try {
      const res = await fetch('/api/testing/remediation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorIds: selectedErrors,
          output,
          priorityLevel: 'medium'
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        showToast('success', `Remediation request created successfully!`)
        setSelectedErrors([])
        fetchData()
        
        // If Cursor task, fetch the prompt immediately
        if (output === 'cursor_task') {
          showToast('info', 'Analyzing errors...')
          // Poll for the prompt to be ready
          let attempts = 0
          const maxAttempts = 30 // 30 seconds timeout
          const pollForPrompt = async () => {
            attempts++
            try {
              const promptRes = await fetch(`/api/testing/remediation/${data.requestId}`)
              const promptData = await promptRes.json()
              const status = promptData.request?.status
              
              // Update toast based on status
              if (status === 'analyzing') {
                showToast('info', 'Analyzing errors...')
              } else if (status === 'generating_fix') {
                showToast('info', 'Generating fix suggestions...')
              }
              
              // Check if we have the prompt
              if (promptData.cursorTaskPrompt) {
                setCursorPrompt(promptData.cursorTaskPrompt)
                showToast('success', 'Cursor task prompt ready! Copy it to use in Cursor.')
                setRemediationLoading(false)
                fetchData() // Refresh the remediations list
                return
              }
              
              // Check for failure statuses
              if (status === 'failed' || status === 'rejected') {
                showToast('error', `Remediation ${status}. Check the console for details.`)
                setRemediationLoading(false)
                return
              }
              
              // Keep polling if not timed out
              if (attempts < maxAttempts) {
                setTimeout(pollForPrompt, 1000)
              } else {
                showToast('error', 'Prompt generation timed out. The request may still be processing - check remediation requests below.')
                setRemediationLoading(false)
                fetchData()
              }
            } catch (pollError) {
              console.error('Polling error:', pollError)
              if (attempts < maxAttempts) {
                setTimeout(pollForPrompt, 1000)
              } else {
                showToast('error', 'Failed to fetch prompt status')
                setRemediationLoading(false)
              }
            }
          }
          pollForPrompt()
        } else {
          setRemediationLoading(false)
        }
      } else {
        showToast('error', data.error || 'Failed to create remediation')
        setRemediationLoading(false)
      }
    } catch (error) {
      console.error('Failed to create remediation:', error)
      showToast('error', 'Failed to create remediation request')
      setRemediationLoading(false)
    }
  }
  
  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('success', 'Copied to clipboard!')
  }

  // Create Stripe test checkout (for WF-001 testing)
  const createStripeTestCheckout = async () => {
    setStripeCheckoutLoading(true)
    showToast('info', 'Creating test checkout...')
    try {
      const session = await getCurrentSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
      const res = await fetch('/api/admin/stripe-test-checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: 'test-stripe@example.com',
          amount: 50
        })
      })
      const data = await res.json()
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank')
        setLastCheckoutUrl(data.checkoutUrl)
        showToast('success', 'Checkout opened. Use 4242 4242 4242 4242 to pay.')
        markScriptCompleted('stripe_test_checkout')
      } else {
        showToast('error', data.error || 'Failed to create checkout')
      }
    } catch {
      showToast('error', 'Failed to create checkout')
    } finally {
      setStripeCheckoutLoading(false)
    }
  }
  
  // Clean up seed test data
  const cleanupSeedData = async () => {
    setCleanupLoading(true)
    showToast('info', 'Cleaning up test data...')
    try {
      const session = await getCurrentSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

      const res = await fetch('/api/admin/testing/cleanup-seeds', {
        method: 'POST',
        headers,
      })
      const data = await res.json()
      if (data.success) {
        showToast('success', `Cleaned up ${data.totalDeleted} test row(s).`)
        markScriptCompleted('cleanup_test_data')
        resetSession()
      } else {
        showToast('error', data.error || 'Cleanup failed')
      }
    } catch {
      showToast('error', 'Failed to clean up test data')
    } finally {
      setCleanupLoading(false)
    }
  }

  // Mark remediation errors as fixed or won't fix
  const markRemediationComplete = async (remediationId: string, status: 'fixed' | 'wont_fix') => {
    try {
      showToast('info', `Marking errors as ${status === 'fixed' ? 'fixed' : "won't fix"}...`)
      
      const res = await fetch('/api/testing/errors/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remediation_request_id: remediationId,
          remediation_status: status
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        showToast('success', `${data.updatedCount} error(s) marked as ${status === 'fixed' ? 'fixed' : "won't fix"}`)
        fetchData()
        if (errorsModalRunId) {
          fetchErrors(errorsModalRunId)
        }
      } else {
        showToast('error', data.error || 'Failed to update errors')
      }
    } catch (error) {
      console.error('Failed to mark remediation complete:', error)
      showToast('error', 'Failed to update errors')
    }
  }
  
  // Live Activity Panel component
  const LiveActivityPanel = ({ 
    testRuns, 
    activeRuns 
  }: { 
    testRuns: TestRun[]
    activeRuns: string[] 
  }) => {
    // Collect all live activity from active runs
    const liveActivities: LiveClientActivity[] = []
    
    for (const runId of activeRuns) {
      const run = testRuns.find(r => r.run_id === runId)
      if (run?.liveStats?.liveActivity) {
        liveActivities.push(...run.liveStats.liveActivity)
      }
    }
    
    if (liveActivities.length === 0) {
      return (
        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <h2 className="text-xl font-semibold">Live Activity</h2>
            <span className="text-gray-400 text-sm">({activeRuns.length} active run{activeRuns.length !== 1 ? 's' : ''})</span>
          </div>
          <p className="text-gray-400">Waiting for clients to start...</p>
        </div>
      )
    }
    
    return (
      <div className="bg-gray-800 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <h2 className="text-xl font-semibold">Live Activity</h2>
          <span className="text-gray-400 text-sm">
            ({liveActivities.length} client{liveActivities.length !== 1 ? 's' : ''} running)
          </span>
        </div>
        
        <div className="space-y-3">
          {liveActivities.map(activity => {
            const progress = activity.totalSteps > 0 
              ? Math.round((activity.currentStepIndex / activity.totalSteps) * 100)
              : 0
            const elapsedSec = Math.round(activity.elapsedMs / 1000)
            
            return (
              <div 
                key={activity.clientId}
                className="bg-gray-700/50 rounded-lg p-4 border border-gray-600"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.status === 'running' ? 'bg-blue-500 animate-pulse' :
                      activity.status === 'error' ? 'bg-red-500' :
                      'bg-green-500'
                    }`} />
                    <span className="font-medium">{activity.personaName}</span>
                    <span className="text-gray-400 text-sm">({activity.personaId})</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    {elapsedSec}s
                  </div>
                </div>
                
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm text-gray-300">{activity.scenarioName}</span>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Progress bar */}
                  <div className="flex-1 bg-gray-600 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-16 text-right">
                    Step {activity.currentStepIndex + 1}/{activity.totalSteps}
                  </span>
                </div>
                
                <div className="mt-2 text-sm">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                    activity.currentStepType === 'chat' ? 'bg-purple-600/30 text-purple-300' :
                    activity.currentStepType === 'navigate' ? 'bg-blue-600/30 text-blue-300' :
                    activity.currentStepType === 'checkout' ? 'bg-green-600/30 text-green-300' :
                    activity.currentStepType === 'diagnostic' ? 'bg-orange-600/30 text-orange-300' :
                    activity.currentStepType === 'addToCart' ? 'bg-yellow-600/30 text-yellow-300' :
                    'bg-gray-600/30 text-gray-300'
                  }`}>
                    {activity.currentStepType}
                  </span>
                  <span className="text-gray-400 ml-2">{activity.currentStepDescription}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  
  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      running: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-gray-100 text-gray-800'
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {status}
      </span>
    )
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'E2E Testing' }
        ]} />

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">E2E Testing Dashboard</h1>
            <p className="text-gray-400 mt-1">
              Manage automated client simulations and error remediation
            </p>
          </div>
          <button
            onClick={fetchData}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
        
        {/* Configuration Panel */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center justify-between w-full"
          >
            <h2 className="text-xl font-semibold">Start New Test Run</h2>
            {showConfig ? <ChevronUp /> : <ChevronDown />}
          </button>
          
          {showConfig && (
            <div className="mt-6 space-y-6">
              {/* Presets */}
              <div>
                <h3 className="font-medium mb-3">Quick Presets</h3>
                <div className="flex flex-wrap gap-2">
                  {SCENARIO_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset.id)}
                      className="px-3 py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="text-gray-400 text-xs mt-1">Client Journey runs scenarios across Prospect → Lead → Client in order.</p>
              </div>

              {/* Scenarios grouped by journey stage */}
              <div>
                <h3 className="font-medium mb-3">Scenarios</h3>
                {JOURNEY_STAGES.map(stage => {
                  const stageScenarios = scenariosForStage(stage.id)
                  if (stageScenarios.length === 0) return null
                  return (
                    <div key={stage.id} className="mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{stage.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {stageScenarios.map(scenario => (
                          <button
                            key={scenario.id}
                            onClick={() => {
                              setSelectedScenarios(prev =>
                                prev.includes(scenario.id)
                                  ? prev.filter(s => s !== scenario.id)
                                  : [...prev, scenario.id]
                              )
                            }}
                            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                              selectedScenarios.includes(scenario.id)
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                          >
                            {scenario.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
                <p className="text-gray-400 text-sm mt-2">
                  {selectedScenarios.length === 0 ? 'All scenarios' : `${selectedScenarios.length} selected`}
                </p>
              </div>
              
              {/* Personas */}
              <div>
                <h3 className="font-medium mb-3">Personas</h3>
                <div className="flex flex-wrap gap-2">
                  {PERSONAS.map(persona => (
                    <button
                      key={persona.id}
                      onClick={() => {
                        setSelectedPersonas(prev =>
                          prev.includes(persona.id)
                            ? prev.filter(p => p !== persona.id)
                            : [...prev, persona.id]
                        )
                      }}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedPersonas.includes(persona.id)
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {persona.name}
                    </button>
                  ))}
                </div>
                <p className="text-gray-400 text-sm mt-2">
                  {selectedPersonas.length === 0 ? 'All personas' : `${selectedPersonas.length} selected`}
                </p>
              </div>
              
              {/* Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Concurrent Clients
                  </label>
                  <input
                    type="number"
                    value={maxConcurrent}
                    onChange={e => setMaxConcurrent(parseInt(e.target.value) || 1)}
                    min={1}
                    max={10}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Duration (seconds)
                  </label>
                  <input
                    type="number"
                    value={runDuration}
                    onChange={e => setRunDuration(parseInt(e.target.value) || 60)}
                    min={30}
                    max={600}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cleanupAfter}
                      onChange={e => setCleanupAfter(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>Clean up after run</span>
                  </label>
                </div>
              </div>
              
              {/* Start Button */}
              <button
                onClick={() => startTestRun()}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-medium transition-colors"
              >
                <Play className="w-5 h-5" />
                Start Test Run
              </button>
            </div>
          )}
        </div>

        {/* Client Journey Scripts */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8 border-l-4 border-rose-500">
          <button
            onClick={() => setShowScriptsPanel(!showScriptsPanel)}
            className="flex items-center justify-between w-full"
            aria-expanded={showScriptsPanel}
            aria-controls="journey-scripts-panel"
          >
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-rose-400" />
                Client Journey Scripts
              </h2>
              {completedScripts.size > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-300 border border-green-500/40">
                  {completedScripts.size}/{ALL_JOURNEY_SCRIPTS.length} done
                </span>
              )}
            </div>
            {showScriptsPanel ? <ChevronUp /> : <ChevronDown />}
          </button>
          {showScriptsPanel && (
            <div id="journey-scripts-panel" className="mt-6 space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-sm">
                  Run each step in order. Steps with prerequisites are locked until the prior step is complete.
                </p>
                {completedScripts.size > 0 && (
                  <button
                    onClick={resetSession}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 transition-colors text-gray-300"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Session
                  </button>
                )}
              </div>

              {/* Journey stepper */}
              <div className="flex items-center justify-center gap-2 py-3">
                {JOURNEY_STAGES.map((stage, i) => {
                  const stageScripts = getScriptsByStage(stage.id)
                  const stageDone = stageScripts.length > 0 && stageScripts.every(s => completedScripts.has(s.id))
                  return (
                    <div key={stage.id} className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                        stageDone
                          ? 'bg-green-500/30 text-green-300 border border-green-500/50'
                          : stage.id === 'prospect' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : stage.id === 'lead' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-green-500/20 text-green-300 border border-green-500/40'
                      }`}>
                        {stageDone && <CheckCircle className="w-3 h-3" />}
                        {stage.label}
                      </span>
                      {i < JOURNEY_STAGES.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Scripts by stage */}
              {JOURNEY_STAGES.map(stage => {
                const scripts = getScriptsByStage(stage.id)
                if (scripts.length === 0) return null
                return (
                  <div key={stage.id}>
                    <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${
                      stage.id === 'prospect' ? 'text-blue-400' :
                      stage.id === 'lead' ? 'text-amber-400' :
                      'text-green-400'
                    }`}>
                      {stage.label}
                    </h3>
                    <div className="space-y-2">
                      {scripts.map((script, idx) => {
                        const isTriggering = triggeringScripts[script.id]
                        const lastRun = scriptLastRun[script.id]
                        const isDone = completedScripts.has(script.id)
                        const prereqOk = isPrereqMet(script)
                        const prereqScript = script.prereqScriptId ? JOURNEY_SCRIPTS_BY_ID[script.prereqScriptId] : null
                        const relatedScenario = script.relatedScenarioId
                          ? SCENARIOS.find(s => s.id === script.relatedScenarioId)
                          : null

                        const isStripe = script.type === 'stripe_checkout'
                        const isCleanup = script.type === 'cleanup'

                        return (
                          <div
                            key={script.id}
                            className={`rounded-lg p-4 border transition-all ${
                              isDone
                                ? 'bg-green-900/10 border-green-500/30'
                                : !prereqOk
                                  ? 'bg-gray-800/50 border-gray-700 opacity-60'
                                  : 'bg-gray-700/50 border-gray-600'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {isDone ? (
                                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                                  ) : !prereqOk ? (
                                    <Lock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                  ) : (
                                    <span className="text-xs text-gray-500 font-mono">Step {idx + 1}</span>
                                  )}
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    isStripe
                                      ? 'bg-green-500/20 text-green-300'
                                      : isCleanup
                                        ? 'bg-red-500/20 text-red-300'
                                        : script.type === 'seed_sql'
                                          ? 'bg-purple-500/20 text-purple-300'
                                          : 'bg-rose-500/20 text-rose-300'
                                  }`}>
                                    {isStripe ? 'Stripe Checkout' : isCleanup ? 'Cleanup' : script.type === 'seed_sql' ? 'Seed SQL' : 'Trigger'}
                                  </span>
                                  <span className={`font-medium text-sm truncate ${isDone ? 'text-green-300' : ''}`}>{script.label}</span>
                                </div>
                                <p className="text-gray-400 text-xs mb-1">{script.description}</p>
                                {!prereqOk && prereqScript && (
                                  <p className="text-amber-400/80 text-xs flex items-center gap-1">
                                    <Lock className="w-3 h-3 shrink-0" />
                                    Complete &ldquo;{prereqScript.label}&rdquo; first.
                                  </p>
                                )}
                                {prereqOk && script.prereq && !isDone && (
                                  <p className="text-amber-400/80 text-xs flex items-center gap-1">
                                    <Info className="w-3 h-3 shrink-0" />
                                    {script.prereq}
                                  </p>
                                )}
                                <p className="text-gray-500 text-xs mt-1">{script.downstreamImpact}</p>
                                {relatedScenario && (
                                  <button
                                    onClick={() => {
                                      setSelectedScenarios([relatedScenario.id])
                                      setShowConfig(true)
                                      showToast('info', `Selected scenario: ${relatedScenario.name}`)
                                    }}
                                    className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors"
                                  >
                                    Run scenario: {relatedScenario.name}
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {/* Stripe checkout inline */}
                                {isStripe && (
                                  <div className="flex flex-col items-end gap-2">
                                    <button
                                      onClick={createStripeTestCheckout}
                                      disabled={stripeCheckoutLoading || !prereqOk || isDone}
                                      className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                      title={!prereqOk ? 'Complete prerequisite first' : isDone ? 'Already completed' : 'Create test checkout'}
                                    >
                                      {stripeCheckoutLoading ? (
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <CreditCard className="w-3.5 h-3.5" />
                                      )}
                                      {stripeCheckoutLoading ? 'Creating...' : isDone ? 'Done' : 'Create Test Checkout'}
                                    </button>
                                    <span className="text-gray-500 text-[10px]">Card: 4242 4242 4242 4242</span>
                                    {lastCheckoutUrl && (
                                      <div className="flex gap-1 items-center">
                                        <input
                                          readOnly
                                          value={lastCheckoutUrl}
                                          className="bg-gray-800 rounded px-2 py-0.5 font-mono text-[10px] w-40 truncate"
                                        />
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(lastCheckoutUrl)
                                            showToast('success', 'Copied to clipboard')
                                          }}
                                          className="px-1.5 py-0.5 bg-gray-600 hover:bg-gray-500 rounded text-[10px]"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* Cleanup action */}
                                {isCleanup && (
                                  <button
                                    onClick={cleanupSeedData}
                                    disabled={cleanupLoading || !prereqOk || isDone}
                                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                    title={!prereqOk ? 'Complete prerequisite first' : isDone ? 'Already cleaned up' : 'Delete test seed data'}
                                  >
                                    {cleanupLoading ? (
                                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                    {cleanupLoading ? 'Cleaning...' : isDone ? 'Cleaned' : 'Clean Up Test Data'}
                                  </button>
                                )}
                                {/* Seed SQL action */}
                                {script.type === 'seed_sql' && (
                                  <button
                                    onClick={() => copySeedSql(script)}
                                    disabled={!prereqOk || isDone}
                                    className="flex items-center gap-1.5 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                    aria-label={`Copy seed SQL for ${script.label}`}
                                    title={!prereqOk ? 'Complete prerequisite first' : isDone ? 'Already completed' : 'Copy SQL to clipboard'}
                                  >
                                    <Database className="w-3.5 h-3.5" />
                                    {isDone ? 'Copied' : 'Copy SQL'}
                                  </button>
                                )}
                                {/* Webhook trigger action */}
                                {script.type === 'trigger_webhook' && (script.webhookPath || script.webhookEnvVar) && (
                                  <button
                                    onClick={() => triggerScript(script)}
                                    disabled={isTriggering || !prereqOk || isDone}
                                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                    aria-label={`Run trigger for ${script.label}`}
                                    title={!prereqOk ? 'Complete prerequisite first' : isDone ? 'Already completed' : 'Run webhook trigger'}
                                  >
                                    {isTriggering ? (
                                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Zap className="w-3.5 h-3.5" />
                                    )}
                                    {isTriggering ? 'Triggering...' : isDone ? 'Done' : 'Run trigger'}
                                  </button>
                                )}
                                {lastRun && !isDone && (
                                  <span className={`text-[10px] ${lastRun.success ? 'text-green-400' : 'text-red-400'}`}>
                                    {lastRun.success ? 'OK' : 'Failed'} {new Date(lastRun.at).toLocaleTimeString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              <p className="text-gray-500 text-xs">
                Order: 1) Copy/run seed SQL in Supabase. 2) Run trigger to fire the webhook. 3) Start test run with the linked scenario. 4) Clean up when done.
              </p>
            </div>
          )}
        </div>
        
        {/* Test Runs */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Recent Test Runs</h2>
          
          {testRuns.length === 0 ? (
            <p className="text-gray-400">No test runs yet</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-700">
                      <th className="pb-3">Run ID</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Clients</th>
                      <th className="pb-3">Success Rate</th>
                      <th className="pb-3">Errors</th>
                      <th className="pb-3">Started</th>
                      <th className="pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testRuns
                      .slice(runsPage * RUNS_PER_PAGE, (runsPage + 1) * RUNS_PER_PAGE)
                      .map(run => (
                      <tr 
                        key={run.run_id}
                        className="border-b border-gray-700/50 hover:bg-gray-700/30"
                      >
                        <td className="py-3 font-mono text-sm">{run.run_id}</td>
                        <td className="py-3">
                          <StatusBadge status={run.status} />
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span>{run.clients_completed}/{run.clients_spawned}</span>
                          </div>
                        </td>
                        <td className="py-3">
                          {run.clients_spawned > 0
                            ? `${Math.round((run.clients_completed / run.clients_spawned) * 100)}%`
                            : '-'}
                        </td>
                        <td className="py-3">
                          {run.clients_failed > 0 ? (
                            <button
                              onClick={() => openErrorsModal(run.run_id)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                              {run.clients_failed} error{run.clients_failed !== 1 ? 's' : ''}
                            </button>
                          ) : (run.status === 'completed' || run.status === 'failed') ? (
                            <button
                              onClick={() => openErrorsModal(run.run_id)}
                              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                            >
                              View
                            </button>
                          ) : (
                            <span className="text-xs text-gray-600">-</span>
                          )}
                        </td>
                        <td className="py-3 text-gray-400">
                          {new Date(run.started_at).toLocaleString()}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {run.status === 'running' && (
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  stopTestRun(run.run_id)
                                }}
                                className="p-1 hover:bg-red-600 rounded transition-colors"
                                title="Stop"
                              >
                                <Square className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                cleanupRun(run.run_id)
                              }}
                              className="p-1 hover:bg-gray-600 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {testRuns.length > RUNS_PER_PAGE && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                  <span className="text-sm text-gray-400">
                    Showing {runsPage * RUNS_PER_PAGE + 1}–{Math.min((runsPage + 1) * RUNS_PER_PAGE, testRuns.length)} of {testRuns.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRunsPage(p => Math.max(0, p - 1))}
                      disabled={runsPage === 0}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Prev
                    </button>
                    <span className="text-sm text-gray-400 px-2">
                      Page {runsPage + 1} of {Math.ceil(testRuns.length / RUNS_PER_PAGE)}
                    </span>
                    <button
                      onClick={() => setRunsPage(p => Math.min(Math.ceil(testRuns.length / RUNS_PER_PAGE) - 1, p + 1))}
                      disabled={(runsPage + 1) * RUNS_PER_PAGE >= testRuns.length}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Live Activity Panel */}
        {activeRuns.length > 0 && (
          <LiveActivityPanel testRuns={testRuns} activeRuns={activeRuns} />
        )}
        
        {/* Errors Modal */}
        {errorsModalRunId && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={closeErrorsModal}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0">
                <div>
                  <h2 className="text-lg font-semibold">Errors</h2>
                  <p className="text-gray-400 text-sm font-mono mt-0.5">{errorsModalRunId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">
                    {selectedErrors.length} selected
                  </span>
                  <button
                    onClick={() => {
                      const selectable = errors.filter(e => e.remediation_status !== 'fixed' && e.remediation_status !== 'wont_fix' && e.remediation_status !== 'ignored')
                      if (selectedErrors.length === selectable.length && selectable.length > 0) {
                        setSelectedErrors([])
                      } else {
                        setSelectedErrors(selectable.map(e => e.error_id))
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs bg-gray-700 hover:bg-gray-600 transition-colors"
                  >
                    {selectedErrors.length > 0 ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    onClick={() => createRemediation('cursor_task')}
                    disabled={selectedErrors.length === 0 || remediationLoading}
                    className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  >
                    {remediationLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Wrench className="w-3.5 h-3.5" />
                    )}
                    {remediationLoading ? 'Processing...' : 'Send to Cursor'}
                  </button>
                  <button
                    onClick={() => createRemediation('github_pr')}
                    disabled={selectedErrors.length === 0}
                    className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Create PR
                  </button>
                  <button
                    onClick={closeErrorsModal}
                    className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal body */}
              <div className="p-5 overflow-y-auto flex-1">
                {errorsModalLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : errors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <CheckCircle className="w-8 h-8 text-green-400 mb-3" />
                    <p className="font-medium">No errors for this run</p>
                    <p className="text-sm text-gray-500 mt-1">All clients completed successfully.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {errors.map(error => {
                      const remInfo = getErrorRemediationInfo(error)
                      const isFixed = error.remediation_status === 'fixed'
                      const isWontFix = error.remediation_status === 'wont_fix' || error.remediation_status === 'ignored'
                      const isInProgress = error.remediation_status === 'in_progress' || (remInfo && !isFixed && !isWontFix)

                      let borderClass = 'border-gray-700 bg-gray-800/50'
                      if (selectedErrors.includes(error.error_id)) {
                        borderClass = 'border-purple-500 bg-purple-900/20'
                      } else if (isFixed) {
                        borderClass = 'border-green-500/50 bg-green-900/10'
                      } else if (isWontFix) {
                        borderClass = 'border-gray-500/50 bg-gray-800/50 opacity-60'
                      } else if (isInProgress) {
                        borderClass = 'border-blue-500/50 bg-blue-900/10'
                      }

                      const IconComponent = isFixed ? CheckCircle : isWontFix ? XCircle : AlertCircle
                      const iconColor = isFixed ? 'text-green-400' : isWontFix ? 'text-gray-400' : 'text-red-400'

                      return (
                        <div
                          key={error.error_id}
                          className={`p-4 rounded-lg border transition-all ${borderClass}`}
                        >
                          <label className={`flex items-start gap-3 ${isFixed || isWontFix ? 'cursor-default' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              checked={selectedErrors.includes(error.error_id)}
                              onChange={e => {
                                if (isFixed || isWontFix) return
                                if (e.target.checked) {
                                  setSelectedErrors(prev => [...prev, error.error_id])
                                } else {
                                  setSelectedErrors(prev => prev.filter(id => id !== error.error_id))
                                }
                              }}
                              disabled={isFixed || isWontFix}
                              className={`mt-1 ${isFixed || isWontFix ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <IconComponent className={`w-4 h-4 ${iconColor}`} />
                                <span className={`font-medium ${isWontFix ? 'line-through text-gray-500' : ''}`}>{error.error_type}</span>
                                <span className="text-gray-400">in {error.step_type}</span>
                                <span className="text-gray-500 text-sm">({error.scenario})</span>
                                {remInfo && (
                                  <RemediationBadge
                                    status={remInfo.status}
                                    remediationId={remInfo.remediationId}
                                    errorStatus={remInfo.errorStatus}
                                    onClick={remInfo.remediationId ? () => scrollToRemediation(remInfo.remediationId!) : undefined}
                                  />
                                )}
                              </div>
                              <p className="text-gray-300 text-sm">{error.error_message}</p>

                              {error.step_config && Object.keys(error.step_config).length > 0 && (
                                <div className="mt-2 p-2 bg-gray-900/50 rounded text-xs">
                                  <span className="text-gray-500 font-medium">Step Config:</span>
                                  <div className="mt-1 font-mono text-gray-400">
                                    {Object.entries(error.step_config)
                                      .filter(([key]) => key !== 'type')
                                      .map(([key, value]) => (
                                        <div key={key} className="ml-2">
                                          <span className="text-blue-400">{key}:</span>{' '}
                                          <span className="text-gray-300">
                                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                          </span>
                                        </div>
                                      ))
                                    }
                                  </div>
                                </div>
                              )}
                            </div>
                          </label>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Cursor Prompt Modal */}
        {cursorPrompt && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold">Cursor Task Prompt</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(cursorPrompt)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Copy to Clipboard
                  </button>
                  <button
                    onClick={() => setCursorPrompt(null)}
                    className="p-2 hover:bg-gray-700 rounded-lg"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                <pre className="whitespace-pre-wrap text-sm text-gray-300 font-mono">
                  {cursorPrompt}
                </pre>
              </div>
            </div>
          </div>
        )}
        
        {/* Remediation Requests */}
        {remediations.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Remediation Requests</h2>
            
            <div className="space-y-3">
              {remediations.map(rem => (
                <div
                  key={rem.id}
                  id={`remediation-${rem.id}`}
                  className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg transition-all duration-300"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Wrench className="w-4 h-4" />
                      <span className="font-mono text-sm text-gray-400">{rem.id.substring(0, 12)}...</span>
                      <StatusBadge status={rem.status} />
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        rem.priority === 'critical' ? 'bg-red-600' :
                        rem.priority === 'high' ? 'bg-orange-600' :
                        rem.priority === 'medium' ? 'bg-yellow-600' :
                        'bg-gray-600'
                      }`}>
                        {rem.priority}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">
                      {rem.error_ids.length} error(s) • {new Date(rem.created_at).toLocaleString()}
                    </p>
                    {rem.analysis?.rootCause && (
                      <p className="text-gray-300 text-sm mt-1">
                        {rem.analysis.rootCause.substring(0, 100)}...
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* View Prompt Button */}
                    {rem.cursor_task_id && (
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/testing/remediation/${rem.id}`)
                          const data = await res.json()
                          if (data.cursorTaskPrompt) {
                            setCursorPrompt(data.cursorTaskPrompt)
                          }
                        }}
                        className="p-2 hover:bg-gray-600 rounded-lg"
                        title="View Cursor Task"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    )}
                    {/* GitHub PR Link */}
                    {rem.github_pr_url && (
                      <a
                        href={rem.github_pr_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-gray-600 rounded-lg"
                        title="View GitHub PR"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    {/* Action buttons - only show for active remediations */}
                    {['review_required', 'pending', 'analyzing', 'generating_fix'].includes(rem.status) && (
                      <>
                        <button
                          onClick={() => markRemediationComplete(rem.id, 'fixed')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors"
                          title="Mark all errors as fixed"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Fixed
                        </button>
                        <button
                          onClick={() => markRemediationComplete(rem.id, 'wont_fix')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm transition-colors"
                          title="Mark all errors as won't fix"
                        >
                          <XCircle className="w-4 h-4" />
                          Won&apos;t Fix
                        </button>
                      </>
                    )}
                    {/* Show completed status indicator */}
                    {rem.status === 'applied' && (
                      <span className="flex items-center gap-1 px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Completed
                      </span>
                    )}
                    {rem.status === 'rejected' && (
                      <span className="flex items-center gap-1 px-3 py-1.5 bg-gray-600/20 text-gray-400 rounded-lg text-sm">
                        <XCircle className="w-4 h-4" />
                        Closed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-in slide-in-from-right ${
            toastMessage.type === 'success' ? 'bg-green-600' :
            toastMessage.type === 'error' ? 'bg-red-600' :
            'bg-blue-600'
          }`}>
            {toastMessage.type === 'info' && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <span className="text-white">{toastMessage.text}</span>
            <button 
              onClick={() => setToastMessage(null)}
              className="text-white/70 hover:text-white ml-2"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
