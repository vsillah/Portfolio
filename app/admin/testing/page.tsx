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
  ChevronUp
} from 'lucide-react'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

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

// Available scenarios and personas
const SCENARIOS = [
  { id: 'browse_and_buy', name: 'Browse and Buy', tags: ['e-commerce'] },
  { id: 'chat_to_diagnostic', name: 'Chat to Diagnostic', tags: ['chat'] },
  { id: 'service_inquiry', name: 'Service Inquiry', tags: ['services'] },
  { id: 'full_funnel', name: 'Full Funnel Journey', tags: ['critical'] },
  { id: 'abandoned_cart', name: 'Abandoned Cart', tags: ['e-commerce'] },
  { id: 'support_escalation', name: 'Support Escalation', tags: ['chat'] },
  { id: 'quick_browse', name: 'Quick Browse (Smoke)', tags: ['smoke'] },
  { id: 'standalone_audit_tool', name: 'Standalone Audit Tool', tags: ['smoke', 'resources', 'audit', 'lead-magnet'] },
  { id: 'warm_lead_pipeline', name: 'Warm Lead Pipeline', tags: ['warm-leads', 'outreach', 'critical'] }
]

const PERSONAS = [
  { id: 'startup_sarah', name: 'Startup Sarah', traits: ['high urgency', 'questioning'] },
  { id: 'enterprise_eric', name: 'Enterprise Eric', traits: ['thorough', 'detailed'] },
  { id: 'skeptical_sam', name: 'Skeptical Sam', traits: ['price-focused', 'objections'] },
  { id: 'ready_rachel', name: 'Ready Rachel', traits: ['decision maker', 'ready to buy'] },
  { id: 'technical_tom', name: 'Technical Tom', traits: ['technical', 'API-focused'] },
  { id: 'browsing_brenda', name: 'Browsing Brenda', traits: ['exploratory', 'casual'] }
]

export default function TestingDashboard() {
  // State
  const [testRuns, setTestRuns] = useState<TestRun[]>([])
  const [activeRuns, setActiveRuns] = useState<string[]>([])
  const [errors, setErrors] = useState<TestError[]>([])
  const [remediations, setRemediations] = useState<RemediationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  
  // Config state
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([])
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([])
  const [maxConcurrent, setMaxConcurrent] = useState(1)
  const [runDuration, setRunDuration] = useState(60)
  const [cleanupAfter, setCleanupAfter] = useState(true)
  
  // UI state
  const [showConfig, setShowConfig] = useState(false)
  const [selectedErrors, setSelectedErrors] = useState<string[]>([])
  const [cursorPrompt, setCursorPrompt] = useState<string | null>(null)
  const [remediationLoading, setRemediationLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  
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
  
  // Fetch errors for selected run
  const fetchErrors = useCallback(async (runId: string) => {
    try {
      const res = await fetch(`/api/testing/status?runId=${runId}`)
      const data = await res.json()
      setErrors(data.recentErrors || [])
    } catch (error) {
      console.error('Failed to fetch errors:', error)
    }
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
  
  useEffect(() => {
    if (selectedRun) {
      fetchErrors(selectedRun)
    }
  }, [selectedRun, fetchErrors])
  
  // Start a test run
  const startTestRun = async () => {
    try {
      const res = await fetch('/api/testing/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioIds: selectedScenarios.length > 0 ? selectedScenarios : undefined,
          personaIds: selectedPersonas.length > 0 ? selectedPersonas : undefined,
          maxConcurrentClients: maxConcurrent,
          runDuration: runDuration * 1000,
          cleanupAfter
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        alert(`Test run started: ${data.runId}`)
        fetchData()
      } else {
        alert(`Failed to start test: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to start test:', error)
      alert('Failed to start test run')
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

  // Scroll to remediation request
  const scrollToRemediation = (remediationId: string) => {
    const element = document.getElementById(`remediation-${remediationId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Highlight briefly
      element.classList.add('ring-2', 'ring-purple-500')
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-purple-500')
      }, 2000)
    }
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
        // Refresh errors for the selected run
        if (selectedRun) {
          fetchErrors(selectedRun)
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
              {/* Scenarios */}
              <div>
                <h3 className="font-medium mb-3">Scenarios</h3>
                <div className="flex flex-wrap gap-2">
                  {SCENARIOS.map(scenario => (
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
                onClick={startTestRun}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-medium transition-colors"
              >
                <Play className="w-5 h-5" />
                Start Test Run
              </button>
            </div>
          )}
        </div>
        
        {/* Test Runs */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Recent Test Runs</h2>
          
          {testRuns.length === 0 ? (
            <p className="text-gray-400">No test runs yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-700">
                    <th className="pb-3">Run ID</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Clients</th>
                    <th className="pb-3">Success Rate</th>
                    <th className="pb-3">Started</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {testRuns.map(run => (
                    <tr 
                      key={run.run_id}
                      className={`border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer ${
                        selectedRun === run.run_id ? 'bg-gray-700/50' : ''
                      }`}
                      onClick={() => setSelectedRun(run.run_id)}
                    >
                      <td className="py-3 font-mono text-sm">{run.run_id}</td>
                      <td className="py-3">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span>{run.clients_completed}/{run.clients_spawned}</span>
                          {run.clients_failed > 0 && (
                            <span className="text-red-400">({run.clients_failed} failed)</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        {run.clients_spawned > 0
                          ? `${Math.round((run.clients_completed / run.clients_spawned) * 100)}%`
                          : '-'}
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
          )}
        </div>
        
        {/* Live Activity Panel */}
        {activeRuns.length > 0 && (
          <LiveActivityPanel testRuns={testRuns} activeRuns={activeRuns} />
        )}
        
        {/* Errors Panel (shown when a run is selected) */}
        {selectedRun && errors.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                Errors from {selectedRun}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">
                  {selectedErrors.length} selected
                </span>
                <button
                  onClick={() => {
                    if (selectedErrors.length === errors.length) {
                      setSelectedErrors([])
                    } else {
                      setSelectedErrors(errors.map(e => e.error_id))
                    }
                  }}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm transition-colors"
                >
                  {selectedErrors.length === errors.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={() => createRemediation('cursor_task')}
                  disabled={selectedErrors.length === 0 || remediationLoading}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  {remediationLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Wrench className="w-4 h-4" />
                  )}
                  {remediationLoading ? 'Processing...' : 'Send to Cursor'}
                </button>
                <button
                  onClick={() => createRemediation('github_pr')}
                  disabled={selectedErrors.length === 0}
                  className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Create PR
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              {errors.map(error => {
                const remInfo = getErrorRemediationInfo(error)
                const isFixed = error.remediation_status === 'fixed'
                const isWontFix = error.remediation_status === 'wont_fix' || error.remediation_status === 'ignored'
                const isInProgress = error.remediation_status === 'in_progress' || (remInfo && !isFixed && !isWontFix)
                
                // Determine border and background based on status
                let borderClass = 'border-gray-700 bg-gray-700/30'
                if (selectedErrors.includes(error.error_id)) {
                  borderClass = 'border-purple-500 bg-purple-900/20'
                } else if (isFixed) {
                  borderClass = 'border-green-500/50 bg-green-900/10'
                } else if (isWontFix) {
                  borderClass = 'border-gray-500/50 bg-gray-800/50 opacity-60'
                } else if (isInProgress) {
                  borderClass = 'border-blue-500/50 bg-blue-900/10'
                }
                
                // Determine icon based on status
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
                          if (isFixed || isWontFix) return // Prevent selecting resolved errors
                          if (e.target.checked) {
                            setSelectedErrors([...selectedErrors, error.error_id])
                          } else {
                            setSelectedErrors(selectedErrors.filter(id => id !== error.error_id))
                          }
                        }}
                        disabled={isFixed || isWontFix}
                        className={`mt-1 ${isFixed || isWontFix ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
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
                      
                      {/* Step Configuration Details */}
                      {error.step_config && Object.keys(error.step_config).length > 0 && (
                        <div className="mt-2 p-2 bg-gray-900/50 rounded text-xs">
                          <span className="text-gray-500 font-medium">Step Config:</span>
                          <div className="mt-1 font-mono text-gray-400">
                            {Object.entries(error.step_config)
                              .filter(([key]) => key !== 'type') // Don't show type, it's redundant
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
