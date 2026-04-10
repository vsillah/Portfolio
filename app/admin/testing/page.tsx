'use client'

/**
 * Admin Testing Dashboard
 * 
 * Manage E2E test runs, view results, and handle error remediation.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  ChevronRight,
  Loader2,
  AlertTriangle
} from 'lucide-react'
import Link from 'next/link'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import type { JourneyStage, TestStatus } from '@/lib/testing/types'
import { effectiveTestRunStatus, scenarioIncludesDiagnosticStep } from '@/lib/testing'
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

type TestCleanupModalMode = 'flag_only' | 'all'

type TestCleanupPreview =
  | {
      mode: 'flag_only'
      total: number
      counts: Record<string, number>
      tablesScanned: number
    }
  | {
      mode: 'all'
      total: number
      flagPhase: { counts: Record<string, number>; total: number; tablesScanned: number }
      emailPhase: { lines: Array<{ key: string; label: string; count: number }>; total: number }
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
  { id: 'audit_from_meetings', name: 'Audit from Meetings', tags: ['smoke', 'admin', 'meetings', 'audit-from-meetings'], journeyStage: 'lead' },
  { id: 'meeting_pipeline_synthetic', name: 'Meeting Pipeline (Synthetic)', tags: ['pipeline', 'synthetic', 'mock-data'], journeyStage: 'lead' },
  { id: 'discovery_to_proposal_synthetic', name: 'Discovery to Proposal (Synthetic)', tags: ['pipeline', 'synthetic', 'mock-data'], journeyStage: ['lead', 'client'] },
  { id: 'credential_rotation_smoke', name: 'Credential Rotation Smoke', tags: ['credential-rotation', 'smoke'], journeyStage: 'lead' },
  { id: 'full_funnel', name: 'Full Funnel Journey', tags: ['critical'], journeyStage: ['prospect', 'lead', 'client'] },
  { id: 'browse_and_buy', name: 'Browse and Buy', tags: ['e-commerce'], journeyStage: 'client' },
  // Populate demo (E2E-based, no SQL)
  { id: 'seed_warm_leads', name: 'Seed: Warm Leads', tags: ['seed', 'populate-demo'], journeyStage: 'lead' },
  { id: 'seed_cold_lead', name: 'Seed: Cold Lead', tags: ['seed', 'populate-demo'], journeyStage: 'lead' },
  { id: 'seed_discovery_contact', name: 'Seed: Discovery Contact', tags: ['seed', 'populate-demo'], journeyStage: 'lead' },
  { id: 'seed_sarah_mitchell', name: 'Seed: Sarah Mitchell + Diagnostic', tags: ['seed', 'populate-demo'], journeyStage: 'lead' },
  { id: 'seed_paid_proposal_jordan', name: 'Seed: Paid Proposal (Jordan)', tags: ['seed', 'populate-demo'], journeyStage: 'client' },
  { id: 'seed_lead_qual_99999', name: 'Seed: Lead Qual (id 99999)', tags: ['seed', 'populate-demo'], journeyStage: 'lead' },
  { id: 'seed_onboarding_project', name: 'Seed: Onboarding Project', tags: ['seed', 'populate-demo'], journeyStage: 'client' },
  { id: 'seed_kickoff_project', name: 'Seed: Kickoff Project', tags: ['seed', 'populate-demo'], journeyStage: 'client' },
  { id: 'seed_discovery_sql_compat', name: 'Seed: Discovery (test-discovery@)', tags: ['seed', 'populate-demo'], journeyStage: 'lead' },
  // Chatbot question bank scenarios
  { id: 'chatbot_question_bank_stratified', name: 'Chatbot Questions (Stratified)', tags: ['chat', 'chatbot-questions'], journeyStage: 'prospect' },
  { id: 'chatbot_question_bank_boundary', name: 'Chatbot Questions (Boundary)', tags: ['chat', 'chatbot-questions'], journeyStage: 'prospect' },
  { id: 'chatbot_question_bank_diagnostic', name: 'Chatbot Questions (Diagnostic)', tags: ['chat', 'chatbot-questions'], journeyStage: 'prospect' },
  { id: 'chatbot_question_bank_all', name: 'Chatbot Questions (All ~200)', tags: ['chat', 'chatbot-questions', 'long-run'], journeyStage: 'prospect' },
]

const SCENARIO_PRESETS = [
  { id: 'all', label: 'All' },
  { id: 'journey', label: 'Client Journey' },
  { id: 'critical', label: 'Critical' },
  { id: 'smoke', label: 'Smoke' },
  { id: 'chatbot_questions', label: 'Chatbot Questions' },
  { id: 'chatbot_questions_all', label: 'Chatbot: All ~200' },
  { id: 'synthetic', label: 'Synthetic Pipeline' },
  { id: 'credential_smoke', label: 'Credential Smoke' },
  { id: 'populate_demo', label: 'Populate Demo Data' },
] as const

/** Presets handled by POST body.scenarioPreset on the server */
const API_SCENARIO_PRESET_IDS = new Set<string>(['all', 'critical', 'smoke', 'journey', 'populate_demo'])

function scenarioIdsForPreset(presetId: string): string[] {
  switch (presetId) {
    case 'journey':
      return [...JOURNEY_SCENARIO_IDS]
    case 'critical':
      return SCENARIOS.filter(s => s.tags.includes('critical')).map(s => s.id)
    case 'smoke':
      return SCENARIOS.filter(s => s.tags.includes('smoke')).map(s => s.id)
    case 'synthetic':
      return ['meeting_pipeline_synthetic', 'discovery_to_proposal_synthetic']
    case 'credential_smoke':
      return ['credential_rotation_smoke']
    case 'chatbot_questions':
      return [
        'chatbot_question_bank_stratified',
        'chatbot_question_bank_boundary',
        'chatbot_question_bank_diagnostic',
      ]
    case 'chatbot_questions_all':
      return ['chatbot_question_bank_all']
    case 'populate_demo':
      return [
        'seed_warm_leads',
        'seed_cold_lead',
        'seed_discovery_contact',
        'service_inquiry',
        'seed_sarah_mitchell',
        'seed_paid_proposal_jordan',
        'seed_lead_qual_99999',
        'seed_onboarding_project',
        'seed_kickoff_project',
        'seed_discovery_sql_compat',
      ]
    case 'all':
      return SCENARIOS.map(s => s.id)
    default:
      return []
  }
}

function intersectScenariosWithStage(ids: string[], stage: JourneyStage): string[] {
  const inStage = new Set(scenariosForStage(stage).map(s => s.id))
  return ids.filter(id => inStage.has(id))
}

function primaryStageForScenario(scenarioId: string): JourneyStage {
  const s = SCENARIOS.find(x => x.id === scenarioId)
  if (!s) return 'prospect'
  return Array.isArray(s.journeyStage) ? s.journeyStage[0] : s.journeyStage
}

/** Rebuild POST /api/testing/run payload from orchestrator config stored on test_runs.config */
function parseStoredRunConfig(config: unknown): {
  scenarioIds: string[]
  personaIds: string[]
  maxConcurrentClients: number
  runDurationMs: number
  cleanupAfter: boolean
} | null {
  if (!config || typeof config !== 'object') return null
  const c = config as Record<string, unknown>
  const scenarios = c.scenarios
  if (!Array.isArray(scenarios) || scenarios.length === 0) return null
  const scenarioIds: string[] = []
  for (const item of scenarios) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const sc = row.scenario
    if (sc && typeof sc === 'object') {
      const id = (sc as Record<string, unknown>).id
      if (typeof id === 'string') scenarioIds.push(id)
    }
  }
  if (scenarioIds.length === 0) return null
  const first = scenarios[0] as Record<string, unknown>
  const pool = first.personaPool
  const personaIds: string[] = []
  if (Array.isArray(pool)) {
    for (const p of pool) {
      if (p && typeof p === 'object') {
        const id = (p as Record<string, unknown>).id
        if (typeof id === 'string') personaIds.push(id)
      }
    }
  }
  const maxConcurrentClients = typeof c.maxConcurrentClients === 'number' ? c.maxConcurrentClients : 1
  const runDurationMs = typeof c.runDuration === 'number' ? c.runDuration : 60_000
  const cleanupAfter = typeof c.cleanupAfter === 'boolean' ? c.cleanupAfter : true
  return { scenarioIds, personaIds, maxConcurrentClients, runDurationMs, cleanupAfter }
}

function formatDurationMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const rs = s % 60
  return `${m}:${rs.toString().padStart(2, '0')}`
}

/** Compact relative time for status pills (e.g. "5m ago", "2d ago"). */
function formatRelativeTimeShort(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diff = Math.max(0, Date.now() - t)
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 14) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  const y = Math.floor(d / 365)
  return `${y}y ago`
}

function humanizeTableName(table: string): string {
  return table
    .split('_')
    .map(w => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function getLastSuccessfulTestRun(runs: TestRun[]): TestRun | undefined {
  const ok = runs.filter(r => effectiveTestRunStatus(r) === 'completed')
  if (ok.length === 0) return undefined
  return ok.reduce((best, r) => {
    const tr = new Date(r.completed_at ?? r.started_at).getTime()
    const tb = new Date(best.completed_at ?? best.started_at).getTime()
    return tr > tb ? r : best
  })
}

function runDisplayLabel(run: TestRun): string {
  const parsed = parseStoredRunConfig(run.config)
  if (parsed && parsed.scenarioIds.length > 0) {
    const first = SCENARIOS.find(s => s.id === parsed.scenarioIds[0])
    const n = parsed.scenarioIds.length
    if (n === 1) return first?.name ?? parsed.scenarioIds[0]
    return `${first?.name ?? 'Bundle'} +${n - 1} more`
  }
  const c = run.config as Record<string, unknown>
  if (typeof c.scenarioPreset === 'string') {
    const p = SCENARIO_PRESETS.find(x => x.id === c.scenarioPreset)
    return p?.label ?? c.scenarioPreset
  }
  return run.run_id.length > 22 ? `${run.run_id.slice(0, 20)}…` : run.run_id
}

function collectLiveActivitiesForRun(run: TestRun | undefined): LiveClientActivity[] {
  if (!run?.liveStats?.liveActivity?.length) return []
  return run.liveStats.liveActivity
}

function computeE2eProgressPercent(opts: {
  run?: TestRun
  liveActivities: LiveClientActivity[]
  elapsedMs: number
  runDurationMs: number
  /** When set, run has ended (bar shows full width; caller styles color). */
  terminal?: boolean
}): number {
  if (opts.terminal) return 100
  const { run, liveActivities, elapsedMs, runDurationMs } = opts
  if (liveActivities.length > 0) {
    let sum = 0
    for (const a of liveActivities) {
      sum += a.totalSteps > 0 ? Math.min(1, (a.currentStepIndex + 1) / a.totalSteps) : 0
    }
    return Math.min(96, Math.round((sum / liveActivities.length) * 100))
  }
  if (run && run.clients_spawned > 0) {
    const done = run.clients_completed + run.clients_failed
    return Math.min(96, Math.round((done / run.clients_spawned) * 100))
  }
  const dur = runDurationMs > 0 ? runDurationMs : 60_000
  const t = Math.min(0.9, elapsedMs / dur)
  return Math.max(3, Math.round(t * 100))
}

const PRESET_OPTGROUPS: { label: string; ids: (typeof SCENARIO_PRESETS)[number]['id'][] }[] = [
  { label: 'Core', ids: ['all', 'journey', 'critical', 'smoke', 'credential_smoke'] },
  { label: 'Chatbot', ids: ['chatbot_questions', 'chatbot_questions_all'] },
  { label: 'Data & synthetic', ids: ['synthetic', 'populate_demo'] },
]

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

/** Matches admin filter rows: native select, compact (see outreach, social-content, chatbot-questions). */
const adminSelectClass =
  'w-full max-w-xl rounded-lg px-3 py-2 text-sm bg-imperial-navy/80 border border-radiant-gold/25 text-platinum-white focus:outline-none focus:ring-2 focus:ring-radiant-gold/50'
const adminLabelClass = 'block text-sm font-medium text-platinum-white/80 mb-1.5'

const CHATBOT_QUESTIONS_HREF = '/admin/testing/chatbot-questions'
/** Chat → diagnostic E2E touches system prompts for chat and diagnostic flows. */
const CHAT_DIAGNOSTIC_ADMIN_HREF = '/admin/prompts'

function scenarioEditLink(s: ScenarioMeta): { href: string; title: string } | null {
  if (s.tags.includes('chatbot-questions')) {
    return { href: CHATBOT_QUESTIONS_HREF, title: 'Edit chatbot question bank' }
  }
  if (scenarioIncludesDiagnosticStep(s.id)) {
    return {
      href: CHAT_DIAGNOSTIC_ADMIN_HREF,
      title: 'System prompts — chat and diagnostic flows',
    }
  }
  return null
}

function presetEditLink(presetId: string): { href: string; title: string } | null {
  if (presetId === 'chatbot_questions' || presetId === 'chatbot_questions_all') {
    return { href: CHATBOT_QUESTIONS_HREF, title: 'Edit chatbot question bank' }
  }
  return null
}

function E2eListboxEditLink({
  href,
  title,
  onNavigate,
}: {
  href: string
  title: string
  onNavigate: () => void
}) {
  return (
    <Link
      href={href}
      title={title}
      aria-label={title}
      onClick={() => onNavigate()}
      className="flex shrink-0 items-center self-stretch border-l border-radiant-gold/15 px-3 py-2 text-xs font-medium text-radiant-gold hover:bg-radiant-gold/10 hover:text-gold-light focus:outline-none focus:ring-2 focus:ring-inset focus:ring-radiant-gold/50"
    >
      Edit
    </Link>
  )
}

function E2ePresetBundleListbox({
  id,
  labelText,
  value,
  onChange,
}: {
  id: string
  labelText: string
  value: string
  onChange: (presetId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerId = `${id}-trigger`

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [open])

  const presetLabel =
    SCENARIO_PRESETS.find(p => p.id === value)?.label ?? SCENARIO_PRESETS[0]?.label ?? 'Preset'

  const pick = (presetId: string) => {
    onChange(presetId)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative max-w-xl">
      <label htmlFor={triggerId} className={adminLabelClass}>
        {labelText}
      </label>
      <button
        id={triggerId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => {
          if (e.key === 'Escape') setOpen(false)
        }}
        className={`${adminSelectClass} flex w-full items-center justify-between gap-2 text-left`}
      >
        <span className="truncate">{presetLabel}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          aria-label={labelText}
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-lg border border-radiant-gold/25 bg-imperial-navy/95 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm"
        >
          {PRESET_OPTGROUPS.map(g => {
            const presets = SCENARIO_PRESETS.filter(p => (g.ids as readonly string[]).includes(p.id))
            if (presets.length === 0) return null
            return (
              <div key={g.label}>
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-platinum-white/45">
                  {g.label}
                </div>
                {presets.map(p => {
                  const edit = presetEditLink(p.id)
                  return (
                    <div
                      key={p.id}
                      className={`flex w-full items-stretch border-b border-radiant-gold/10 last:border-b-0 ${
                        value === p.id ? 'bg-radiant-gold/12' : ''
                      }`}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={value === p.id}
                        onClick={() => pick(p.id)}
                        className="min-w-0 flex-1 px-3 py-2 text-left text-sm text-platinum-white/90 hover:bg-radiant-gold/10"
                      >
                        {value === p.id ? '✓ ' : ''}
                        {p.label}
                      </button>
                      {edit ? (
                        <E2eListboxEditLink
                          href={edit.href}
                          title={edit.title}
                          onNavigate={() => setOpen(false)}
                        />
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function E2eCustomScenarioListbox({
  id,
  labelText,
  value,
  onChange,
  disabled,
  customStage,
}: {
  id: string
  labelText: string
  customStage: JourneyStage | ''
  value: string
  onChange: (next: string) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerId = `${id}-trigger`

  useEffect(() => {
    setOpen(false)
  }, [customStage])

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [open])

  const list = customStage ? scenariosForStage(customStage) : []
  const chatbot = list.filter(s => s.tags.includes('chatbot-questions'))
  const rest = list.filter(s => !s.tags.includes('chatbot-questions'))

  const displayLabel =
    value === '__all__'
      ? 'All scenarios in this stage'
      : (list.find(s => s.id === value)?.name ?? 'All scenarios in this stage')

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative max-w-xl">
      <label htmlFor={triggerId} className={adminLabelClass}>
        {labelText}
      </label>
      <button
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={e => {
          if (e.key === 'Escape') setOpen(false)
        }}
        className={`${adminSelectClass} flex w-full items-center justify-between gap-2 text-left disabled:opacity-45 disabled:cursor-not-allowed`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && !disabled && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          aria-label={labelText}
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-lg border border-radiant-gold/25 bg-imperial-navy/95 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm"
        >
          <button
            type="button"
            role="option"
            aria-selected={value === '__all__'}
            onClick={() => pick('__all__')}
            className={`flex w-full px-3 py-2 text-left text-sm hover:bg-radiant-gold/10 ${
              value === '__all__'
                ? 'bg-radiant-gold/15 text-platinum-white'
                : 'text-platinum-white/90'
            }`}
          >
            {value === '__all__' ? '✓ ' : ''}
            All scenarios in this stage
          </button>
          {chatbot.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-platinum-white/45">
                Chatbot
              </div>
              {chatbot.map(s => {
                const edit = scenarioEditLink(s)
                return (
                  <div
                    key={s.id}
                    className={`flex w-full items-stretch border-b border-radiant-gold/10 last:border-b-0 ${
                      value === s.id ? 'bg-radiant-gold/12' : ''
                    }`}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === s.id}
                      onClick={() => pick(s.id)}
                      className="min-w-0 flex-1 px-3 py-2 text-left text-sm text-platinum-white/90 hover:bg-radiant-gold/10"
                    >
                      {value === s.id ? '✓ ' : ''}
                      {s.name}
                    </button>
                    {edit ? (
                      <E2eListboxEditLink
                        href={edit.href}
                        title={edit.title}
                        onNavigate={() => setOpen(false)}
                      />
                    ) : null}
                  </div>
                )
              })}
            </>
          )}
          {rest.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-platinum-white/45">
                {chatbot.length > 0 ? 'Other' : 'Scenarios'}
              </div>
              {rest.map(s => {
                const edit = scenarioEditLink(s)
                return (
                  <div
                    key={s.id}
                    className={`flex w-full items-stretch border-b border-radiant-gold/10 last:border-b-0 ${
                      value === s.id ? 'bg-radiant-gold/12' : ''
                    }`}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === s.id}
                      onClick={() => pick(s.id)}
                      className="min-w-0 flex-1 px-3 py-2 text-left text-sm text-platinum-white/90 hover:bg-radiant-gold/10"
                    >
                      {value === s.id ? '✓ ' : ''}
                      {s.name}
                    </button>
                    {edit ? (
                      <E2eListboxEditLink
                        href={edit.href}
                        title={edit.title}
                        onNavigate={() => setOpen(false)}
                      />
                    ) : null}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}

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
  const [runMode, setRunMode] = useState<'preset' | 'custom'>('preset')
  const [selectedPresetId, setSelectedPresetId] = useState<string>('smoke')
  const [presetStageFilter, setPresetStageFilter] = useState<'' | JourneyStage>('')
  const [customStage, setCustomStage] = useState<JourneyStage | ''>('')
  const [customScenarioChoice, setCustomScenarioChoice] = useState<string>('__all__')
  const [showAdvancedRun, setShowAdvancedRun] = useState(false)
  const [runDetailRunId, setRunDetailRunId] = useState<string | null>(null)
  const [runDetailLoading, setRunDetailLoading] = useState(false)
  const [runDetailData, setRunDetailData] = useState<Record<string, unknown> | null>(null)
  const [showScriptsPanel, setShowScriptsPanel] = useState(false)
  const [selectedErrors, setSelectedErrors] = useState<string[]>([])
  const [cursorPrompt, setCursorPrompt] = useState<string | null>(null)
  const [remediationLoading, setRemediationLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  /** Local run control: track started run until DB shows terminal, then brief "finished" for the popover. */
  const [e2eUi, setE2eUi] = useState<
    | null
    | { kind: 'active'; runId: string; startedAtMs: number }
    | { kind: 'finished'; runId: string; success: boolean; finishedAtMs: number }
  >(null)
  const [e2ePopoverOpen, setE2ePopoverOpen] = useState(false)
  const [e2eTick, setE2eTick] = useState(0)
  const e2ePopoverRef = useRef<HTMLDivElement>(null)
  const e2eTerminalHandledRef = useRef<string | null>(null)
  const [stripeCheckoutLoading, setStripeCheckoutLoading] = useState(false)
  const [lastCheckoutUrl, setLastCheckoutUrl] = useState<string | null>(null)
  const [triggeringScripts, setTriggeringScripts] = useState<Record<string, boolean>>({})
  const [scriptLastRun, setScriptLastRun] = useState<Record<string, { at: string; success: boolean }>>({})
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [testCleanupModalMode, setTestCleanupModalMode] = useState<TestCleanupModalMode | null>(null)
  const [testCleanupPreviewLoading, setTestCleanupPreviewLoading] = useState(false)
  const [testCleanupPreviewError, setTestCleanupPreviewError] = useState<string | null>(null)
  const [testCleanupPreview, setTestCleanupPreview] = useState<TestCleanupPreview | null>(null)
  const [testCleanupAcknowledged, setTestCleanupAcknowledged] = useState(false)
  const testCleanupCancelRef = useRef<HTMLButtonElement>(null)
  const purgeFlagTriggerRef = useRef<HTMLButtonElement>(null)
  const cleanupFullTriggerRef = useRef<HTMLButtonElement>(null)
  const testCleanupReturnFocusRef = useRef<HTMLButtonElement | null>(null)

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

  const showToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text })
    setTimeout(() => setToastMessage(null), 4000)
  }, [])

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
  }, [fetchData])

  // Poll while server reports in-memory orchestrators or we are waiting for a started run to finish.
  useEffect(() => {
    const needsPoll =
      activeRuns.length > 0 ||
      (e2eUi?.kind === 'active')
    if (!needsPoll) return
    const interval = setInterval(() => {
      void fetchData()
    }, 2000)
    return () => clearInterval(interval)
  }, [fetchData, activeRuns.length, e2eUi?.kind])
  
  // Re-fetch errors when the modal is open and data refreshes (e.g. after remediation)
  useEffect(() => {
    if (errorsModalRunId) {
      fetchErrors(errorsModalRunId)
    }
  }, [errorsModalRunId, fetchErrors])

  useEffect(() => {
    if (runMode !== 'custom') return
    if (!customStage) {
      setSelectedScenarios([])
      return
    }
    const inStage = scenariosForStage(customStage)
    if (customScenarioChoice === '__all__') {
      setSelectedScenarios(inStage.map(s => s.id))
    } else {
      const one = inStage.find(s => s.id === customScenarioChoice)
      setSelectedScenarios(one ? [one.id] : inStage.map(s => s.id))
    }
  }, [runMode, customStage, customScenarioChoice])

  useEffect(() => {
    if (!runDetailRunId) {
      setRunDetailData(null)
      return
    }
    let cancelled = false
    setRunDetailLoading(true)
    fetch(`/api/testing/status?runId=${encodeURIComponent(runDetailRunId)}`)
      .then(async res => {
        const data = (await res.json()) as Record<string, unknown>
        if (!res.ok) {
          return { error: typeof data.error === 'string' ? data.error : 'Failed to load run' }
        }
        return data
      })
      .then(data => {
        if (!cancelled) setRunDetailData(data)
      })
      .catch(() => {
        if (!cancelled) setRunDetailData({ error: 'Failed to load run' })
      })
      .finally(() => {
        if (!cancelled) setRunDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [runDetailRunId])

  const runDetailOutcome = useMemo((): TestStatus | null => {
    if (!runDetailData || typeof runDetailData.error === 'string') return null
    if (typeof runDetailData.displayStatus === 'string') {
      return runDetailData.displayStatus as TestStatus
    }
    const st = runDetailData.stats as Record<string, number> | undefined
    if (st != null && runDetailData.status != null) {
      return effectiveTestRunStatus({
        status: runDetailData.status as TestStatus,
        clients_spawned: Number(st.clientsSpawned) || 0,
        clients_completed: Number(st.clientsCompleted) || 0,
        clients_failed: Number(st.clientsFailed) || 0,
      })
    }
    if (runDetailData.status != null) return runDetailData.status as TestStatus
    return null
  }, [runDetailData])

  const successfulRunsCount = useMemo(
    () => testRuns.filter(r => effectiveTestRunStatus(r) === 'completed').length,
    [testRuns]
  )

  const lastSuccessfulRun = useMemo(() => getLastSuccessfulTestRun(testRuns), [testRuns])
  const lastSuccessClientCount = lastSuccessfulRun?.clients_completed ?? 0
  const lastSuccessAtLabel = lastSuccessfulRun
    ? formatRelativeTimeShort(lastSuccessfulRun.completed_at ?? lastSuccessfulRun.started_at)
    : null

  const e2ePrimaryRunId = useMemo(() => {
    if (e2eUi?.kind === 'active' || e2eUi?.kind === 'finished') return e2eUi.runId
    if (activeRuns.length > 0) return activeRuns[0]
    return null
  }, [e2eUi, activeRuns])

  const e2ePrimaryRun = useMemo(
    () => (e2ePrimaryRunId ? testRuns.find(r => r.run_id === e2ePrimaryRunId) : undefined),
    [testRuns, e2ePrimaryRunId]
  )

  const e2eLiveActivities = useMemo(
    () => collectLiveActivitiesForRun(e2ePrimaryRun),
    [e2ePrimaryRun]
  )

  const e2eRunDurationMs = useMemo(() => {
    const parsed = e2ePrimaryRun ? parseStoredRunConfig(e2ePrimaryRun.config) : null
    return parsed?.runDurationMs ?? runDuration * 1000
  }, [e2ePrimaryRun, runDuration])

  const e2eElapsedLabel = useMemo(() => {
    void e2eTick
    if (e2eUi?.kind === 'finished' && e2ePrimaryRun) {
      const end = e2ePrimaryRun.completed_at
        ? new Date(e2ePrimaryRun.completed_at).getTime()
        : e2eUi.finishedAtMs
      const sec = Math.max(0, Math.floor((end - new Date(e2ePrimaryRun.started_at).getTime()) / 1000))
      return `${sec}s`
    }
    if (e2eUi?.kind === 'active') {
      const sec = Math.max(0, Math.floor((Date.now() - e2eUi.startedAtMs) / 1000))
      return `${sec}s`
    }
    if (e2ePrimaryRun) {
      const sec = Math.max(0, Math.floor((Date.now() - new Date(e2ePrimaryRun.started_at).getTime()) / 1000))
      return `${sec}s`
    }
    return '0s'
  }, [e2eUi, e2ePrimaryRun, e2eTick])

  const e2eProgressPercent = useMemo(() => {
    void e2eTick
    const terminal =
      e2eUi?.kind === 'finished' ||
      (e2ePrimaryRun != null &&
        e2ePrimaryRun.status !== 'running' &&
        e2ePrimaryRun.status !== 'pending')
    const elapsedMs =
      e2eUi?.kind === 'active'
        ? Date.now() - e2eUi.startedAtMs
        : e2ePrimaryRun
          ? Date.now() - new Date(e2ePrimaryRun.started_at).getTime()
          : 0
    return computeE2eProgressPercent({
      run: e2ePrimaryRun,
      liveActivities: e2eLiveActivities,
      elapsedMs,
      runDurationMs: e2eRunDurationMs,
      terminal: !!terminal,
    })
  }, [e2eUi, e2ePrimaryRun, e2eLiveActivities, e2eRunDurationMs, e2eTick])

  /** One in-flight suite at a time from this UI (matches single orchestrator focus). */
  const e2eBlocksNewStart = useMemo(
    () =>
      activeRuns.length > 0 ||
      e2eUi?.kind === 'active' ||
      (e2ePrimaryRun != null &&
        (e2ePrimaryRun.status === 'running' || e2ePrimaryRun.status === 'pending')),
    [activeRuns.length, e2eUi?.kind, e2ePrimaryRun]
  )

  const e2eCanCancelPrimary = useMemo(
    () =>
      e2ePrimaryRunId != null &&
      activeRuns.includes(e2ePrimaryRunId) &&
      e2eUi?.kind !== 'finished',
    [e2ePrimaryRunId, activeRuns, e2eUi?.kind]
  )

  const e2eShowInlineProgress =
    e2eBlocksNewStart || e2eUi?.kind === 'finished'

  /** One line for the progress card — never duplicate the primary button label. */
  const e2eProgressCaption = useMemo(() => {
    if (e2eUi?.kind === 'finished') {
      return e2eUi.success ? 'Completed successfully' : 'Finished with issues'
    }
    if (!e2eBlocksNewStart) return 'Status'
    if (e2eCanCancelPrimary) {
      if (e2eLiveActivities.length > 0) {
        const n = e2eLiveActivities.length
        return `${n} simulated client${n === 1 ? '' : 's'} active`
      }
      const spawned = e2ePrimaryRun?.clients_spawned ?? 0
      if (spawned > 0) {
        const done = (e2ePrimaryRun?.clients_completed ?? 0) + (e2ePrimaryRun?.clients_failed ?? 0)
        return `${done}/${spawned} clients finished`
      }
      return 'Spawning clients…'
    }
    return 'Connecting to test runner…'
  }, [
    e2eUi,
    e2eBlocksNewStart,
    e2eCanCancelPrimary,
    e2eLiveActivities.length,
    e2ePrimaryRun?.clients_spawned,
    e2ePrimaryRun?.clients_completed,
    e2ePrimaryRun?.clients_failed,
  ])

  useEffect(() => {
    if (e2eUi?.kind !== 'active') return
    const tr = testRuns.find(r => r.run_id === e2eUi.runId)
    if (!tr) return
    if (tr.status === 'running' || tr.status === 'pending') return
    if (e2eTerminalHandledRef.current === tr.run_id) return
    e2eTerminalHandledRef.current = tr.run_id
    const success = effectiveTestRunStatus(tr) === 'completed'
    showToast(
      success ? 'success' : 'error',
      success ? 'E2E run completed successfully' : 'E2E run finished with failures or incomplete clients'
    )
    setE2eUi({ kind: 'finished', runId: tr.run_id, success, finishedAtMs: Date.now() })
  }, [e2eUi, testRuns, showToast])

  useEffect(() => {
    if (e2eUi?.kind !== 'finished') return
    const t = setTimeout(() => setE2eUi(null), 6000)
    return () => clearTimeout(t)
  }, [e2eUi])

  useEffect(() => {
    const primaryNeedsTick =
      e2ePrimaryRun?.status === 'running' || e2ePrimaryRun?.status === 'pending'
    const tickNeeded =
      e2eUi?.kind === 'active' || activeRuns.length > 0 || primaryNeedsTick
    if (!tickNeeded) return
    const id = setInterval(() => setE2eTick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [e2eUi?.kind, activeRuns.length, e2ePrimaryRun])

  useEffect(() => {
    if (!e2ePopoverOpen) return
    const onDown = (e: MouseEvent) => {
      if (e2ePopoverRef.current && !e2ePopoverRef.current.contains(e.target as Node)) {
        setE2ePopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [e2ePopoverOpen])

  useEffect(() => {
    if (!testCleanupModalMode) return
    setTestCleanupAcknowledged(false)
    setTestCleanupPreview(null)
    setTestCleanupPreviewError(null)
    let cancelled = false
    ;(async () => {
      setTestCleanupPreviewLoading(true)
      try {
        const session = await getCurrentSession()
        const headers: Record<string, string> = {}
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
        const res = await fetch(
          `/api/admin/testing/cleanup-seeds?mode=${testCleanupModalMode}`,
          { headers }
        )
        const data = (await res.json()) as Record<string, unknown>
        if (cancelled) return
        if (!res.ok || data.success !== true) {
          setTestCleanupPreviewError(
            typeof data.error === 'string' ? data.error : 'Could not load purge preview.'
          )
          return
        }
        if (data.mode === 'flag_only') {
          setTestCleanupPreview({
            mode: 'flag_only',
            total: typeof data.total === 'number' ? data.total : 0,
            counts: (data.counts as Record<string, number>) ?? {},
            tablesScanned: typeof data.tablesScanned === 'number' ? data.tablesScanned : 0,
          })
        } else if (data.mode === 'all') {
          const fp = data.flagPhase as
            | { counts: Record<string, number>; total: number; tablesScanned: number }
            | undefined
          const ep = data.emailPhase as
            | { lines: Array<{ key: string; label: string; count: number }>; total: number }
            | undefined
          if (fp && ep) {
            setTestCleanupPreview({
              mode: 'all',
              total: typeof data.total === 'number' ? data.total : 0,
              flagPhase: fp,
              emailPhase: ep,
            })
          } else {
            setTestCleanupPreviewError('Unexpected preview response.')
          }
        } else {
          setTestCleanupPreviewError('Unexpected preview response.')
        }
      } catch {
        if (!cancelled) setTestCleanupPreviewError('Could not load purge preview.')
      } finally {
        if (!cancelled) setTestCleanupPreviewLoading(false)
      }
    })()
    let rafId = 0
    rafId = requestAnimationFrame(() => testCleanupCancelRef.current?.focus())
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTestCleanupModalMode(null)
        requestAnimationFrame(() => testCleanupReturnFocusRef.current?.focus())
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      document.removeEventListener('keydown', onKey)
    }
  }, [testCleanupModalMode])

  const e2eShowLiveInActivityPopover =
    e2eShowInlineProgress && e2eUi?.kind !== 'finished'

  const e2eActivityPopover =
    e2ePopoverOpen ? (
      <div
        className="absolute left-0 top-full z-50 mt-1.5 w-[min(20rem,calc(100vw-2rem))] min-w-[16rem] rounded-xl border border-radiant-gold/25 bg-imperial-navy/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm"
        role="dialog"
        aria-label="E2E run activity"
      >
        {e2eShowLiveInActivityPopover && (
          <div className="mb-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-xs">
                {e2eCanCancelPrimary ? (
                  <Users className="h-4 w-4 shrink-0 text-radiant-gold/75" aria-hidden />
                ) : (
                  <Loader2
                    className="h-4 w-4 shrink-0 animate-spin text-radiant-gold/80"
                    aria-hidden
                  />
                )}
                <span className="font-medium text-platinum-white/90">{e2eProgressCaption}</span>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-platinum-white/50">
                {e2eElapsedLabel}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full border border-radiant-gold/15 bg-imperial-navy/80">
              <div
                className="h-full bg-gradient-to-r from-bronze to-radiant-gold transition-[width] duration-500 ease-out"
                style={{ width: `${e2eProgressPercent}%` }}
              />
            </div>
          </div>
        )}

        <div
          className={
            e2eShowLiveInActivityPopover
              ? 'border-t border-radiant-gold/15 pt-3'
              : ''
          }
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-platinum-white/45">
              Recent
            </span>
            <button
              type="button"
              onClick={() => {
                setE2ePopoverOpen(false)
                document
                  .getElementById('e2e-recent-runs-full')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-radiant-gold/90 hover:text-gold-light focus:outline-none focus:ring-2 focus:ring-radiant-gold/50 rounded"
            >
              <Clock className="w-3 h-3" aria-hidden />
              View all
            </button>
          </div>
          {testRuns.length === 0 ? (
            <p className="text-xs text-platinum-white/45">No runs yet</p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {testRuns.slice(0, 3).map(r => {
                const out = effectiveTestRunStatus(r)
                const dot =
                  out === 'completed'
                    ? 'bg-emerald-400'
                    : out === 'failed'
                      ? 'bg-red-400'
                      : r.status === 'running' || r.status === 'pending'
                        ? 'bg-radiant-gold animate-pulse'
                        : 'bg-platinum-white/40'
                const done = r.clients_completed + r.clients_failed
                const itemsLabel =
                  r.clients_spawned > 0 ? `${done}/${r.clients_spawned} clients` : '0 clients'
                let dur = '—'
                if (r.completed_at) {
                  dur = formatDurationMs(
                    new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()
                  )
                } else if (r.status === 'running' || r.status === 'pending') {
                  dur = formatDurationMs(Date.now() - new Date(r.started_at).getTime())
                }
                const startedShort = new Date(r.started_at).toLocaleString(undefined, {
                  month: 'numeric',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
                return (
                  <li
                    key={r.run_id}
                    className="flex items-start gap-2 rounded-lg border border-radiant-gold/10 bg-silicon-slate/20 px-2 py-1.5"
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-xs font-medium text-platinum-white/90">
                          {runDisplayLabel(r)}
                        </span>
                        <span className="shrink-0 text-[10px] tabular-nums text-platinum-white/45">
                          {dur}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-platinum-white/50">
                        <span>{startedShort}</span>
                        <span className="tabular-nums">{itemsLabel}</span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    ) : null

  // Start a test run (preset, explicit scenario ids, or selectedScenarios from custom builder)
  const startTestRun = async (
    preset?: string,
    overrideScenarioIds?: string[],
    opts?: {
      personaIds?: string[]
      maxConcurrentClients?: number
      runDurationMs?: number
      cleanupAfter?: boolean
    }
  ) => {
    try {
      const session = await getCurrentSession()
      const effPersonas =
        opts?.personaIds !== undefined
          ? opts.personaIds.length > 0
            ? opts.personaIds
            : undefined
          : selectedPersonas.length > 0
            ? selectedPersonas
            : undefined
      const effMax = opts?.maxConcurrentClients ?? maxConcurrent
      const effDur = opts?.runDurationMs ?? runDuration * 1000
      const effCleanup =
        preset === 'populate_demo' ? false : opts?.cleanupAfter ?? cleanupAfter
      const body: Record<string, unknown> = {
        personaIds: effPersonas,
        maxConcurrentClients: effMax,
        runDuration: effDur,
        cleanupAfter: effCleanup,
        adminToken: session?.access_token ?? undefined,
      }
      if (overrideScenarioIds && overrideScenarioIds.length > 0) {
        body.scenarioIds = overrideScenarioIds
      } else if (preset) {
        body.scenarioPreset = preset
      } else if (selectedScenarios.length > 0) {
        body.scenarioIds = selectedScenarios
      } else {
        body.scenarioPreset = 'all'
      }

      const res = await fetch('/api/testing/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      
      const data = await res.json()
      
      if (data.success) {
        const rid = typeof data.runId === 'string' ? data.runId : ''
        if (rid) {
          e2eTerminalHandledRef.current = null
          setE2eUi({ kind: 'active', runId: rid, startedAtMs: Date.now() })
          setE2ePopoverOpen(true)
        }
        showToast('success', `Test run started: ${data.runId}`)
        void fetchData()
      } else {
        showToast('error', data.error || 'Failed to start test')
      }
    } catch (error) {
      console.error('Failed to start test:', error)
      showToast('error', 'Failed to start test run')
    }
  }

  const rerunWithStoredConfig = async (config: unknown) => {
    const parsed = parseStoredRunConfig(config)
    if (!parsed) {
      showToast('error', "Could not read this run's saved configuration to rerun.")
      return
    }
    await startTestRun(undefined, parsed.scenarioIds, {
      personaIds: parsed.personaIds,
      maxConcurrentClients: parsed.maxConcurrentClients,
      runDurationMs: parsed.runDurationMs,
      cleanupAfter: parsed.cleanupAfter,
    })
  }

  const rerunFromRun = async (run: TestRun) => {
    await rerunWithStoredConfig(run.config)
  }

  const handleStartRun = async () => {
    if (runMode === 'preset') {
      const pid = selectedPresetId
      if (pid === 'populate_demo') {
        await startTestRun('populate_demo')
        return
      }
      if (presetStageFilter) {
        const baseIds = pid === 'all' ? SCENARIOS.map(s => s.id) : scenarioIdsForPreset(pid)
        const filtered = intersectScenariosWithStage(baseIds, presetStageFilter)
        if (filtered.length === 0) {
          showToast('error', 'No scenarios in this preset for the selected stage.')
          return
        }
        await startTestRun(undefined, filtered)
        return
      }
      if (API_SCENARIO_PRESET_IDS.has(pid)) {
        await startTestRun(pid === 'all' ? 'all' : pid)
        return
      }
      const ids = scenarioIdsForPreset(pid)
      if (ids.length === 0) {
        showToast('error', 'No scenarios for this preset.')
        return
      }
      await startTestRun(undefined, ids)
      return
    }
    if (!customStage) {
      showToast('error', 'Choose a journey stage.')
      return
    }
    if (selectedScenarios.length === 0) {
      showToast('error', 'No scenarios match this stage.')
      return
    }
    await startTestRun()
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
        showToast('info', 'Test run stop requested')
        setE2eUi(cur =>
          cur?.kind === 'active' && cur.runId === runId ? null : cur
        )
        void fetchData()
      } else {
        showToast('error', 'Could not stop this run (it may have already finished)')
      }
    } catch (error) {
      console.error('Failed to stop test:', error)
      showToast('error', 'Failed to stop test run')
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
        element.classList.add('ring-2', 'ring-radiant-gold/70')
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-radiant-gold/70')
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
      pending: { color: 'bg-radiant-gold/15 text-gold-light border-radiant-gold/40', label: 'Pending' },
      analyzing: { color: 'bg-silicon-slate/60 text-platinum-white border-radiant-gold/30', label: 'Analyzing' },
      generating_fix: { color: 'bg-silicon-slate/60 text-platinum-white border-radiant-gold/30', label: 'Generating Fix' },
      review_required: { color: 'bg-bronze/25 text-gold-light border-bronze/50', label: 'Sent to Cursor' },
      applied: { color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', label: 'Applied' },
      failed: { color: 'bg-red-500/20 text-red-300 border-red-500/45', label: 'Failed' },
      rejected: { color: 'bg-platinum-white/10 text-platinum-white/60 border-platinum-white/20', label: 'Rejected' }
    }
    
    // Status config for error-level remediation status
    const errorStatusConfig: Record<string, { color: string; label: string }> = {
      pending: { color: 'bg-platinum-white/10 text-platinum-white/60 border-platinum-white/20', label: 'Pending' },
      in_progress: { color: 'bg-radiant-gold/15 text-gold-light border-radiant-gold/40', label: 'In Progress' },
      fixed: { color: 'bg-green-500/20 text-green-400 border-green-500/50', label: 'Fixed' },
      ignored: { color: 'bg-platinum-white/10 text-platinum-white/55 border-platinum-white/20', label: 'Ignored' },
      wont_fix: { color: 'bg-platinum-white/10 text-platinum-white/55 border-platinum-white/20', label: "Won't Fix" }
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
    activeRuns,
    embedded = false,
  }: {
    testRuns: TestRun[]
    activeRuns: string[]
    embedded?: boolean
  }) => {
    const shell = embedded
      ? 'rounded-lg border border-radiant-gold/15 bg-silicon-slate/20 p-4'
      : 'glass-card p-6 mb-8 border border-radiant-gold/20'
    // Collect all live activity from active runs
    const liveActivities: LiveClientActivity[] = []
    
    for (const runId of activeRuns) {
      const run = testRuns.find(r => r.run_id === runId)
      if (run?.liveStats?.liveActivity) {
        liveActivities.push(...run.liveStats.liveActivity)
      }
    }
    
    const HeadingTag = embedded ? 'h3' : 'h2'
    const headingClass = embedded
      ? 'text-base font-semibold font-heading text-platinum-white'
      : 'text-xl font-semibold font-heading text-platinum-white'

    if (liveActivities.length === 0) {
      return (
        <section
          className={shell}
          aria-live="polite"
          aria-label="Live test activity"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-3 h-3 rounded-full bg-radiant-gold animate-pulse shadow-[0_0_12px_rgba(212,175,55,0.5)]" />
            <HeadingTag className={headingClass}>Live activity</HeadingTag>
            <span className="text-platinum-white/60 text-sm">
              ({activeRuns.length} active run{activeRuns.length !== 1 ? 's' : ''})
            </span>
          </div>
          <p className="text-platinum-white/55 text-sm">Waiting for clients to start…</p>
        </section>
      )
    }
    
    return (
      <section
        className={shell}
        aria-live="polite"
        aria-label="Live test activity"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-3 h-3 rounded-full bg-radiant-gold animate-pulse shadow-[0_0_12px_rgba(212,175,55,0.5)]" />
          <HeadingTag className={headingClass}>Live activity</HeadingTag>
          <span className="text-platinum-white/60 text-sm">
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
                className="rounded-lg p-4 border border-radiant-gold/15 bg-silicon-slate/35"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.status === 'running' ? 'bg-radiant-gold animate-pulse' :
                      activity.status === 'error' ? 'bg-red-400' :
                      'bg-emerald-400'
                    }`} />
                    <span className="font-medium text-platinum-white">{activity.personaName}</span>
                    <span className="text-platinum-white/50 text-sm">({activity.personaId})</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-platinum-white/55">
                    <Clock className="w-4 h-4 text-radiant-gold/80" />
                    {elapsedSec}s
                  </div>
                </div>
                
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm text-platinum-white/85">{activity.scenarioName}</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-imperial-navy/80 rounded-full h-2 overflow-hidden border border-radiant-gold/10">
                    <div 
                      className="bg-gradient-to-r from-bronze to-radiant-gold h-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-platinum-white/50 w-16 text-right tabular-nums">
                    Step {activity.currentStepIndex + 1}/{activity.totalSteps}
                  </span>
                </div>
                
                <div className="mt-2 text-sm">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${
                    activity.currentStepType === 'chat' ? 'bg-silicon-slate/50 text-gold-light border-radiant-gold/25' :
                    activity.currentStepType === 'navigate' ? 'bg-silicon-slate/50 text-platinum-white/90 border-platinum-white/15' :
                    activity.currentStepType === 'checkout' ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30' :
                    activity.currentStepType === 'diagnostic' ? 'bg-bronze/20 text-gold-light border-bronze/40' :
                    activity.currentStepType === 'addToCart' ? 'bg-radiant-gold/10 text-gold-light border-radiant-gold/30' :
                    'bg-silicon-slate/40 text-platinum-white/70 border-platinum-white/10'
                  }`}>
                    {activity.currentStepType}
                  </span>
                  <span className="text-platinum-white/55 ml-2">{activity.currentStepDescription}</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    )
  }
  
  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      running: 'bg-radiant-gold/20 text-gold-light border border-radiant-gold/45',
      completed: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/35',
      failed: 'bg-red-500/15 text-red-200 border border-red-500/40',
      pending: 'bg-platinum-white/10 text-platinum-white/70 border border-platinum-white/20',
      cancelled: 'bg-silicon-slate/50 text-platinum-white/55 border border-platinum-white/15'
    }
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium capitalize ${styles[status] || styles.pending}`}>
        {status.replace(/_/g, ' ')}
      </span>
    )
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-imperial-navy text-platinum-white p-8 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-radiant-gold" aria-hidden />
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-imperial-navy text-platinum-white p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'E2E Testing' }
        ]} />

        {/* Header */}
        <div className="flex justify-between items-start gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold font-heading text-platinum-white">E2E testing</h1>
            <p className="text-platinum-white/60 mt-1 text-sm">
              Run simulated clients, watch progress, review history
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void fetchData()}
              className="p-2.5 rounded-lg border border-radiant-gold/25 text-platinum-white/80 hover:bg-radiant-gold/10 hover:text-platinum-white focus:outline-none focus:ring-2 focus:ring-radiant-gold/50 transition-colors"
              aria-label="Refresh data"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Start run */}
        <section id="start-test-run" className="glass-card p-6 mb-8 border border-radiant-gold/25">
          <h2 className="text-xl font-semibold font-heading text-platinum-white mb-4">Start a run</h2>

          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="e2e-run-mode" className={adminLabelClass}>Scenario source</label>
                <select
                  id="e2e-run-mode"
                  value={runMode}
                  onChange={e => {
                    const v = e.target.value as 'preset' | 'custom'
                    setRunMode(v)
                    if (v === 'custom' && !customStage) setCustomStage('prospect')
                  }}
                  className={adminSelectClass}
                >
                  <option value="preset">Preset bundle</option>
                  <option value="custom">By journey stage</option>
                </select>
              </div>
            </div>

            {runMode === 'preset' && (
              <div className="space-y-4">
                <div>
                  <E2ePresetBundleListbox
                    id="e2e-preset"
                    labelText="Preset"
                    value={selectedPresetId}
                    onChange={presetId => {
                      setSelectedPresetId(presetId)
                      setPresetStageFilter('')
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="e2e-preset-stage" className={adminLabelClass}>
                    Limit to stage <span className="text-platinum-white/45 font-normal">(optional)</span>
                  </label>
                  <select
                    id="e2e-preset-stage"
                    value={presetStageFilter}
                    onChange={e => setPresetStageFilter(e.target.value as '' | JourneyStage)}
                    disabled={selectedPresetId === 'populate_demo'}
                    className={`${adminSelectClass} disabled:opacity-45`}
                    title={selectedPresetId === 'populate_demo' ? 'Populate demo runs a fixed bundle' : undefined}
                  >
                    <option value="">All stages</option>
                    {JOURNEY_STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {runMode === 'custom' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="e2e-custom-stage" className={adminLabelClass}>Journey stage</label>
                  <select
                    id="e2e-custom-stage"
                    value={customStage}
                    onChange={e => {
                      const v = e.target.value as JourneyStage | ''
                      setCustomStage(v)
                      setCustomScenarioChoice('__all__')
                    }}
                    className={adminSelectClass}
                  >
                    <option value="">Select stage…</option>
                    {JOURNEY_STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <E2eCustomScenarioListbox
                    id="e2e-custom-scenario"
                    labelText="Scenario"
                    value={customScenarioChoice}
                    onChange={setCustomScenarioChoice}
                    disabled={!customStage}
                    customStage={customStage}
                  />
                </div>
              </div>
            )}

            <fieldset className="border-0 p-0 m-0">
              <legend className={adminLabelClass}>Personas</legend>
              <div className="flex flex-col gap-2 w-fit max-w-full max-h-48 overflow-y-auto rounded-lg border border-radiant-gold/20 bg-imperial-navy/40 p-3 pr-2">
                {PERSONAS.map(p => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 cursor-pointer text-sm text-platinum-white/90 hover:text-platinum-white"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPersonas.includes(p.id)}
                      onChange={() => {
                        setSelectedPersonas(prev =>
                          prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                        )
                      }}
                      className="w-4 h-4 rounded border-radiant-gold/40 text-radiant-gold focus:ring-radiant-gold/50 shrink-0"
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <button
                type="button"
                onClick={() => setShowAdvancedRun(v => !v)}
                className="flex items-center gap-2 text-sm text-radiant-gold hover:text-gold-light focus:outline-none focus:ring-2 focus:ring-radiant-gold/50 rounded-md"
                aria-expanded={showAdvancedRun}
              >
                {showAdvancedRun ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Advanced
              </button>
              {showAdvancedRun && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-radiant-gold/15">
                  <div>
                    <label className="block text-sm font-medium text-platinum-white/80 mb-2">
                      Concurrent clients
                    </label>
                    <input
                      type="number"
                      value={maxConcurrent}
                      onChange={e => setMaxConcurrent(parseInt(e.target.value) || 1)}
                      min={1}
                      max={10}
                      className="w-full rounded-lg px-4 py-2 bg-imperial-navy/80 border border-radiant-gold/20 text-platinum-white focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-platinum-white/80 mb-2">
                      Duration (seconds)
                    </label>
                    <input
                      type="number"
                      value={runDuration}
                      onChange={e => setRunDuration(parseInt(e.target.value) || 60)}
                      min={30}
                      max={600}
                      className="w-full rounded-lg px-4 py-2 bg-imperial-navy/80 border border-radiant-gold/20 text-platinum-white focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-platinum-white/85">
                      <input
                        type="checkbox"
                        checked={cleanupAfter}
                        onChange={e => setCleanupAfter(e.target.checked)}
                        className="w-4 h-4 rounded border-radiant-gold/40 text-radiant-gold focus:ring-radiant-gold/50"
                      />
                      Clean up after run
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 pt-2 border-t border-radiant-gold/15">
              {e2eShowInlineProgress ? (
                <div className="flex flex-wrap items-center gap-3">
                  {e2eBlocksNewStart && (
                    <div className="flex shrink-0 items-center">
                      {e2eCanCancelPrimary && e2ePrimaryRunId ? (
                        <button
                          type="button"
                          onClick={() => {
                            void stopTestRun(e2ePrimaryRunId)
                          }}
                          className="inline-flex items-center gap-2 border border-red-500/45 bg-red-500/15 px-6 py-3 rounded-lg text-sm font-medium text-red-100 hover:bg-red-500/25 focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:ring-offset-2 focus:ring-offset-imperial-navy"
                        >
                          <Square className="w-5 h-5 shrink-0" aria-hidden />
                          Cancel run
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium border border-radiant-gold/15 bg-imperial-navy/50 text-platinum-white/45 cursor-not-allowed"
                          title="Cancel appears once the test runner is connected."
                        >
                          <Loader2 className="w-5 h-5 shrink-0 animate-spin text-radiant-gold/50" aria-hidden />
                          Starting…
                        </button>
                      )}
                    </div>
                  )}
                  <div className="relative max-w-full min-w-0" ref={e2ePopoverRef}>
                    <button
                      type="button"
                      onClick={() => setE2ePopoverOpen(v => !v)}
                      className="inline-flex max-w-full items-center gap-2 rounded-full border border-radiant-gold/35 bg-imperial-navy/55 px-3.5 py-2 text-left text-xs text-platinum-white/90 shadow-sm transition-colors hover:border-radiant-gold/50 hover:bg-imperial-navy/75 focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                      aria-live="polite"
                      aria-expanded={e2ePopoverOpen}
                      aria-haspopup="dialog"
                      aria-label="Run status and recent runs"
                    >
                      {e2eUi?.kind === 'finished' ? (
                        e2eUi.success ? (
                          <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />
                        )
                      ) : e2eCanCancelPrimary ? (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-radiant-gold shadow-[0_0_8px_rgba(245,194,66,0.45)]"
                          aria-hidden
                        />
                      ) : (
                        <Loader2
                          className="h-3.5 w-3.5 shrink-0 animate-spin text-radiant-gold/85"
                          aria-hidden
                        />
                      )}
                      <span className="min-w-0 truncate font-medium">{e2eProgressCaption}</span>
                      <span className="shrink-0 tabular-nums text-platinum-white/50">
                        {e2eElapsedLabel}
                      </span>
                      {e2ePopoverOpen ? (
                        <ChevronUp className="h-3.5 w-3.5 shrink-0 text-platinum-white/55" aria-hidden />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-platinum-white/55" aria-hidden />
                      )}
                    </button>
                    {e2eActivityPopover}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleStartRun()}
                    className="btn-gold inline-flex shrink-0 items-center gap-2 px-6 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-radiant-gold focus:ring-offset-2 focus:ring-offset-imperial-navy"
                  >
                    <Play className="w-5 h-5" aria-hidden />
                    Start run
                  </button>
                  <div className="relative max-w-full min-w-0" ref={e2ePopoverRef}>
                    <button
                      type="button"
                      onClick={() => setE2ePopoverOpen(v => !v)}
                      className="inline-flex max-w-full items-center gap-2 rounded-full border border-radiant-gold/35 bg-imperial-navy/55 px-3.5 py-2 text-left text-xs text-platinum-white/90 shadow-sm transition-colors hover:border-radiant-gold/50 hover:bg-imperial-navy/75 focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                      aria-expanded={e2ePopoverOpen}
                      aria-haspopup="dialog"
                      aria-label="Last successful run and recent history"
                    >
                      {lastSuccessfulRun ? (
                        <>
                          <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                          <span className="font-medium">
                            {lastSuccessClientCount} successful{' '}
                            {lastSuccessClientCount === 1 ? 'client' : 'clients'}
                          </span>
                          <span className="text-platinum-white/40" aria-hidden>
                            ·
                          </span>
                          <span className="shrink-0 text-platinum-white/60">{lastSuccessAtLabel}</span>
                        </>
                      ) : (
                        <>
                          <Clock className="h-3.5 w-3.5 shrink-0 text-radiant-gold/70" aria-hidden />
                          <span className="font-medium text-platinum-white/70">No completed runs yet</span>
                        </>
                      )}
                      {e2ePopoverOpen ? (
                        <ChevronUp className="h-3.5 w-3.5 shrink-0 text-platinum-white/55" aria-hidden />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-platinum-white/55" aria-hidden />
                      )}
                    </button>
                    {e2eActivityPopover}
                  </div>
                </div>
              )}
            </div>

            {activeRuns.length > 0 && (
              <div className="pt-4 border-t border-radiant-gold/10 -mx-2 px-2 sm:-mx-0 sm:px-0">
                <LiveActivityPanel embedded testRuns={testRuns} activeRuns={activeRuns} />
              </div>
            )}

            <div className="rounded-xl border border-red-500/20 bg-red-950/10 px-4 py-5 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="flex gap-3 min-w-0">
                  <AlertTriangle
                    className="w-5 h-5 shrink-0 text-red-400/90 mt-0.5"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-platinum-white/90">
                      Maintenance <span className="text-red-300/80 font-normal">(destructive)</span>
                    </h3>
                    <p className="text-xs text-platinum-white/55 mt-1 leading-relaxed max-w-prose">
                      Remove flagged test rows only — separate from starting a run. Use the preview in the
                      confirmation dialog to see how many rows would be deleted.
                    </p>
                  </div>
                </div>
                <button
                  ref={purgeFlagTriggerRef}
                  type="button"
                  onClick={() => {
                    testCleanupReturnFocusRef.current = purgeFlagTriggerRef.current
                    setTestCleanupModalMode('flag_only')
                  }}
                  disabled={cleanupLoading}
                  className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg border border-red-400/40 bg-imperial-navy/60 text-red-100 hover:bg-red-950/40 hover:border-red-400/55 disabled:opacity-50 px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-400/50 self-start sm:self-center"
                >
                  <Trash2 className="w-4 h-4" aria-hidden />
                  Purge test data…
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Test Runs */}
        <section
          id="e2e-recent-runs-full"
          className="glass-card p-6 mb-8 border border-radiant-gold/20 scroll-mt-24"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
            <h2 className="text-xl font-semibold font-heading text-platinum-white">Recent runs</h2>
            {testRuns.length > 0 && (
              <p className="text-sm text-platinum-white/55 tabular-nums">
                <span className="text-emerald-300/90 font-medium">{successfulRunsCount}</span>
                {' '}successful of {testRuns.length} loaded
              </p>
            )}
          </div>
          
          {testRuns.length === 0 ? (
            <p className="text-platinum-white/50 text-sm">No test runs yet</p>
          ) : (
            <>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-platinum-white/55 border-b border-radiant-gold/20">
                      <th scope="col" className="pb-3 pr-3 font-medium">Run ID</th>
                      <th scope="col" className="pb-3 pr-3 font-medium">Run status</th>
                      <th scope="col" className="pb-3 pr-3 font-medium">
                        <span className="block">Spawned</span>
                        <span className="sr-only">Clients spawned for this run</span>
                      </th>
                      <th scope="col" className="pb-3 pr-3 font-medium">
                        <span className="block">Succeeded</span>
                        <span className="sr-only">Clients that completed successfully</span>
                      </th>
                      <th scope="col" className="pb-3 pr-3 font-medium">Errors</th>
                      <th scope="col" className="pb-3 pr-3 font-medium">Started</th>
                      <th scope="col" className="pb-3 pr-3 font-medium">Run details</th>
                      <th scope="col" className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testRuns
                      .slice(runsPage * RUNS_PER_PAGE, (runsPage + 1) * RUNS_PER_PAGE)
                      .map(run => {
                      const outcome = effectiveTestRunStatus(run)
                      return (
                      <tr 
                        key={run.run_id}
                        className="border-b border-radiant-gold/10 hover:bg-silicon-slate/25"
                      >
                        <td className="py-3 pr-3 font-mono text-xs text-platinum-white/90">{run.run_id}</td>
                        <td className="py-3 pr-3">
                          <StatusBadge status={outcome} />
                        </td>
                        <td className="py-3 pr-3 tabular-nums text-platinum-white/85">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-radiant-gold/60 shrink-0" aria-hidden />
                            <span>{run.clients_spawned}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-3 tabular-nums text-platinum-white/85">
                          {run.clients_spawned > 0 ? run.clients_completed : '—'}
                        </td>
                        <td className="py-3 pr-3">
                          {outcome === 'failed' ? (
                            <button
                              type="button"
                              onClick={() => void openErrorsModal(run.run_id)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-500/15 text-red-200 border border-red-400/35 hover:bg-red-500/25 focus:outline-none focus:ring-2 focus:ring-red-400/50"
                            >
                              <Wrench className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Errors & remediate
                                {run.clients_failed > 0 ? (
                                  <span className="tabular-nums"> ({run.clients_failed})</span>
                                ) : null}
                              </span>
                            </button>
                          ) : outcome === 'completed' || outcome === 'cancelled' ? (
                            <button
                              type="button"
                              onClick={() => void openErrorsModal(run.run_id)}
                              className="text-xs text-radiant-gold/80 hover:text-gold-light underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-radiant-gold/50 rounded"
                            >
                              Log
                            </button>
                          ) : (
                            <span className="text-xs text-platinum-white/35">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-platinum-white/55 text-xs whitespace-nowrap">
                          {new Date(run.started_at).toLocaleString()}
                        </td>
                        <td className="py-3 pr-3">
                          <button
                            type="button"
                            onClick={() => setRunDetailRunId(run.run_id)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-radiant-gold hover:text-gold-light underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-radiant-gold/50 rounded"
                          >
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            View run
                          </button>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {run.status === 'running' && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation()
                                  stopTestRun(run.run_id)
                                }}
                                className="p-1.5 rounded-md text-platinum-white/80 hover:bg-red-500/20 hover:text-red-200 focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                                title="Stop run"
                              >
                                <Square className="w-4 h-4" />
                              </button>
                            )}
                            {run.status !== 'running' && run.status !== 'pending' && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation()
                                  void rerunFromRun(run)
                                }}
                                className="p-1.5 rounded-md text-radiant-gold/90 hover:bg-radiant-gold/15 focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                                title="Rerun with same scenarios and personas"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation()
                                cleanupRun(run.run_id)
                              }}
                              className="p-1.5 rounded-md text-platinum-white/60 hover:bg-silicon-slate/60 focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                              title="Delete run record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>

              {testRuns.length > RUNS_PER_PAGE && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-radiant-gold/15">
                  <span className="text-sm text-platinum-white/50">
                    {runsPage * RUNS_PER_PAGE + 1}–{Math.min((runsPage + 1) * RUNS_PER_PAGE, testRuns.length)} of {testRuns.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRunsPage(p => Math.max(0, p - 1))}
                      disabled={runsPage === 0}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-radiant-gold/25 bg-silicon-slate/30 text-platinum-white/90 hover:border-radiant-gold/45 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Prev
                    </button>
                    <span className="text-sm text-platinum-white/50 px-2 tabular-nums">
                      {runsPage + 1} / {Math.ceil(testRuns.length / RUNS_PER_PAGE)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRunsPage(p => Math.min(Math.ceil(testRuns.length / RUNS_PER_PAGE) - 1, p + 1))}
                      disabled={(runsPage + 1) * RUNS_PER_PAGE >= testRuns.length}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-radiant-gold/25 bg-silicon-slate/30 text-platinum-white/90 hover:border-radiant-gold/45 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
        
        {/* Client Journey Scripts */}
        <section className="glass-card p-6 mb-8 border border-radiant-gold/20 border-l-4 border-l-radiant-gold/70">
          <button
            type="button"
            onClick={() => setShowScriptsPanel(!showScriptsPanel)}
            className="flex items-center justify-between w-full text-left focus:outline-none focus:ring-2 focus:ring-radiant-gold/50 rounded-lg -m-1 p-1"
            aria-expanded={showScriptsPanel}
            aria-controls="journey-scripts-panel"
          >
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold font-heading text-platinum-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-radiant-gold" aria-hidden />
                Scripts & references
              </h2>
              {completedScripts.size > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/15 text-emerald-200 border border-emerald-500/35 tabular-nums">
                  {completedScripts.size}/{ALL_JOURNEY_SCRIPTS.length}
                </span>
              )}
            </div>
            {showScriptsPanel ? <ChevronUp className="text-platinum-white/60" /> : <ChevronDown className="text-platinum-white/60" />}
          </button>
          {showScriptsPanel && (
            <div id="journey-scripts-panel" className="mt-6 space-y-6">
              <div className="flex items-center justify-end">
                {completedScripts.size > 0 && (
                  <button
                    type="button"
                    onClick={resetSession}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-radiant-gold/30 bg-silicon-slate/40 text-platinum-white/90 hover:border-radiant-gold/50 focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset session
                  </button>
                )}
              </div>

              {/* Journey stepper */}
              <div className="flex flex-wrap items-center justify-center gap-2 py-3">
                {JOURNEY_STAGES.map((stage, i) => {
                  const stageScripts = getScriptsByStage(stage.id)
                  const stageDone = stageScripts.length > 0 && stageScripts.every(s => completedScripts.has(s.id))
                  return (
                    <div key={stage.id} className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 border ${
                        stageDone
                          ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40'
                          : stage.id === 'prospect' ? 'bg-silicon-slate/50 text-gold-light border-radiant-gold/30'
                          : stage.id === 'lead' ? 'bg-bronze/15 text-gold-light border-bronze/40'
                          : 'bg-silicon-slate/40 text-platinum-white/90 border-platinum-white/15'
                      }`}>
                        {stageDone && <CheckCircle className="w-3 h-3 text-emerald-300" />}
                        {stage.label}
                      </span>
                      {i < JOURNEY_STAGES.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-platinum-white/35" aria-hidden />
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
                      stage.id === 'prospect' ? 'text-radiant-gold/90' :
                      stage.id === 'lead' ? 'text-gold-light' :
                      'text-platinum-white/80'
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
                                ? 'bg-emerald-500/10 border-emerald-500/35'
                                : !prereqOk
                                  ? 'bg-imperial-navy/60 border-platinum-white/10 opacity-55'
                                  : 'bg-silicon-slate/35 border-radiant-gold/15'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {isDone ? (
                                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                                  ) : !prereqOk ? (
                                    <Lock className="w-3.5 h-3.5 text-platinum-white/40 shrink-0" aria-hidden />
                                  ) : (
                                    <span className="text-xs text-platinum-white/45 font-mono tabular-nums">Step {idx + 1}</span>
                                  )}
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                    isStripe
                                      ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/35'
                                      : isCleanup
                                        ? 'bg-red-500/15 text-red-200 border-red-400/35'
                                        : script.type === 'seed_sql'
                                          ? 'bg-bronze/20 text-gold-light border-bronze/45'
                                          : 'bg-radiant-gold/10 text-gold-light border-radiant-gold/30'
                                  }`}>
                                    {isStripe ? 'Stripe Checkout' : isCleanup ? 'Cleanup' : script.type === 'seed_sql' ? 'Seed SQL' : 'Trigger'}
                                  </span>
                                  <span className={`font-medium text-sm truncate text-platinum-white/90 ${isDone ? 'text-emerald-200' : ''}`}>{script.label}</span>
                                </div>
                                <p className="text-platinum-white/55 text-xs mb-1">{script.description}</p>
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
                                <p className="text-platinum-white/40 text-xs mt-1">{script.downstreamImpact}</p>
                                {relatedScenario && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRunMode('custom')
                                      setCustomStage(primaryStageForScenario(relatedScenario.id))
                                      setCustomScenarioChoice(relatedScenario.id)
                                      document.getElementById('start-test-run')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                      showToast('info', `Selected scenario: ${relatedScenario.name}`)
                                    }}
                                    className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border border-radiant-gold/35 bg-radiant-gold/10 text-gold-light hover:bg-radiant-gold/20 focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                                  >
                                    {relatedScenario.name}
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
                                      className="flex items-center gap-1.5 btn-gold !px-3 !py-1.5 !text-xs disabled:opacity-45 disabled:cursor-not-allowed rounded-lg focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                                      title={!prereqOk ? 'Complete prerequisite first' : isDone ? 'Already completed' : 'Create test checkout'}
                                    >
                                      {stripeCheckoutLoading ? (
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <CreditCard className="w-3.5 h-3.5" />
                                      )}
                                      {stripeCheckoutLoading ? 'Creating...' : isDone ? 'Done' : 'Create Test Checkout'}
                                    </button>
                                    <span className="text-platinum-white/45 text-[10px] tabular-nums">4242…4242</span>
                                    {lastCheckoutUrl && (
                                      <div className="flex gap-1 items-center">
                                        <input
                                          readOnly
                                          value={lastCheckoutUrl}
                                          className="bg-imperial-navy/90 border border-radiant-gold/20 rounded px-2 py-0.5 font-mono text-[10px] w-40 truncate text-platinum-white/80"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(lastCheckoutUrl)
                                            showToast('success', 'Copied to clipboard')
                                          }}
                                          className="px-1.5 py-0.5 border border-radiant-gold/30 bg-silicon-slate/50 hover:bg-silicon-slate/70 rounded text-[10px] focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
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
                                    ref={cleanupFullTriggerRef}
                                    type="button"
                                    onClick={() => {
                                      testCleanupReturnFocusRef.current = cleanupFullTriggerRef.current
                                      setTestCleanupModalMode('all')
                                    }}
                                    disabled={cleanupLoading || !prereqOk || isDone}
                                    className="flex items-center gap-1.5 border border-red-400/45 text-red-100 hover:bg-red-500/15 disabled:opacity-45 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-400/40"
                                    title={!prereqOk ? 'Complete prerequisite first' : isDone ? 'Already cleaned up' : 'Review and delete test seed data'}
                                  >
                                    {cleanupLoading ? (
                                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                    {cleanupLoading ? 'Cleaning...' : isDone ? 'Cleaned' : 'Clean Up Test Data…'}
                                  </button>
                                )}
                                {/* Seed SQL action */}
                                {script.type === 'seed_sql' && (
                                  <button
                                    onClick={() => copySeedSql(script)}
                                    disabled={!prereqOk || isDone}
                                    className="flex items-center gap-1.5 border border-radiant-gold/35 bg-silicon-slate/45 text-platinum-white/90 hover:border-radiant-gold/55 disabled:opacity-45 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
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
                                    className="flex items-center gap-1.5 border border-emerald-500/45 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-45 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
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

            </div>
          )}
        </section>

        {testCleanupModalMode && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]"
            onClick={() => {
              setTestCleanupModalMode(null)
              requestAnimationFrame(() => testCleanupReturnFocusRef.current?.focus())
            }}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="test-cleanup-modal-title"
              className="bg-imperial-navy border border-red-500/35 rounded-2xl w-full max-w-lg max-h-[min(90vh,720px)] flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.45)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 border-b border-red-500/20 shrink-0">
                <h2
                  id="test-cleanup-modal-title"
                  className="text-lg font-semibold font-heading text-platinum-white flex items-center gap-2"
                >
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" aria-hidden />
                  {testCleanupModalMode === 'all'
                    ? 'Full test data cleanup?'
                    : 'Purge all flagged test data?'}
                </h2>
                {testCleanupModalMode === 'all' ? (
                  <p className="text-sm text-platinum-white/65 mt-2 leading-relaxed">
                    Runs the <strong className="font-medium text-platinum-white/80">full</strong> cleanup:
                    all rows with{' '}
                    <span className="font-mono text-xs text-platinum-white/80">is_test_data = true</span>{' '}
                    plus known demo contacts, linked diagnostic audits, chat sessions, proposals, and client
                    projects used by seed journeys. Production data without those patterns is not targeted.
                  </p>
                ) : (
                  <p className="text-sm text-platinum-white/65 mt-2 leading-relaxed">
                    Permanently deletes every row where{' '}
                    <span className="font-mono text-xs text-platinum-white/80">is_test_data = true</span> in
                    the scanned tables. Rows without that flag are not affected.
                  </p>
                )}
              </div>
              <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                {testCleanupPreviewLoading ? (
                  <div className="flex items-center gap-2 text-sm text-platinum-white/60" aria-live="polite">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
                    Calculating row counts…
                  </div>
                ) : testCleanupPreviewError ? (
                  <p className="text-sm text-red-200">{testCleanupPreviewError}</p>
                ) : testCleanupPreview?.mode === 'flag_only' ? (
                  <>
                    <div
                      className="rounded-lg border border-radiant-gold/20 bg-silicon-slate/20 p-4"
                      aria-live="polite"
                    >
                      <p className="text-2xl font-semibold tabular-nums text-platinum-white">
                        {testCleanupPreview.total}
                      </p>
                      <p className="text-xs text-platinum-white/55 mt-1">
                        row{testCleanupPreview.total === 1 ? '' : 's'} would be deleted ·{' '}
                        {testCleanupPreview.tablesScanned} tables scanned (flagged test data only)
                      </p>
                    </div>
                    {testCleanupPreview.total > 0 &&
                      Object.values(testCleanupPreview.counts).some(n => n > 0) && (
                        <ul className="max-h-32 overflow-y-auto text-xs text-platinum-white/70 space-y-1 border border-radiant-gold/10 rounded-lg p-2 bg-imperial-navy/40">
                          {Object.entries(testCleanupPreview.counts)
                            .filter(([, n]) => n > 0)
                            .sort((a, b) => b[1] - a[1])
                            .map(([table, n]) => (
                              <li key={table} className="flex justify-between gap-2 tabular-nums">
                                <span>{humanizeTableName(table)}</span>
                                <span className="text-platinum-white/50">{n}</span>
                              </li>
                            ))}
                        </ul>
                      )}
                    {testCleanupPreview.total === 0 && (
                      <p className="text-sm text-platinum-white/60">Nothing to purge right now.</p>
                    )}
                    <p className="text-xs text-red-200/90">This cannot be undone.</p>
                    {testCleanupPreview.total > 0 && (
                      <label className="flex items-start gap-2 cursor-pointer text-sm text-platinum-white/85">
                        <input
                          type="checkbox"
                          checked={testCleanupAcknowledged}
                          onChange={e => setTestCleanupAcknowledged(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-red-400/50 text-red-600 focus:ring-red-400/50"
                        />
                        <span>
                          I understand this will permanently delete {testCleanupPreview.total} flagged test row
                          {testCleanupPreview.total === 1 ? '' : 's'}.
                        </span>
                      </label>
                    )}
                  </>
                ) : testCleanupPreview?.mode === 'all' ? (
                  <>
                    <div
                      className="rounded-lg border border-radiant-gold/20 bg-silicon-slate/20 p-4"
                      aria-live="polite"
                    >
                      <p className="text-2xl font-semibold tabular-nums text-platinum-white">
                        {testCleanupPreview.total}
                      </p>
                      <p className="text-xs text-platinum-white/55 mt-1">
                        row{testCleanupPreview.total === 1 ? '' : 's'} would be removed in total (
                        {testCleanupPreview.flagPhase.total} flagged · {testCleanupPreview.emailPhase.total}{' '}
                        email/demo related)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-platinum-white/50">
                        1 · Flagged test rows
                      </h3>
                      <p className="text-xs text-platinum-white/55">
                        Rows where <span className="font-mono text-platinum-white/70">is_test_data = true</span>{' '}
                        ({testCleanupPreview.flagPhase.tablesScanned} tables)
                      </p>
                      {Object.values(testCleanupPreview.flagPhase.counts).some(n => n > 0) ? (
                        <ul className="max-h-28 overflow-y-auto text-xs text-platinum-white/70 space-y-1 border border-radiant-gold/10 rounded-lg p-2 bg-imperial-navy/40">
                          {Object.entries(testCleanupPreview.flagPhase.counts)
                            .filter(([, n]) => n > 0)
                            .sort((a, b) => b[1] - a[1])
                            .map(([table, n]) => (
                              <li key={table} className="flex justify-between gap-2 tabular-nums">
                                <span>{humanizeTableName(table)}</span>
                                <span className="text-platinum-white/50">{n}</span>
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-platinum-white/45">No flagged rows in preview.</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-platinum-white/50">
                        2 · Known test emails &amp; demo records
                      </h3>
                      <ul className="max-h-36 overflow-y-auto text-xs text-platinum-white/70 space-y-1 border border-radiant-gold/10 rounded-lg p-2 bg-imperial-navy/40">
                        {testCleanupPreview.emailPhase.lines.map(line => (
                          <li key={line.key} className="flex justify-between gap-2 tabular-nums">
                            <span className="min-w-0 pr-2">{line.label}</span>
                            <span className="text-platinum-white/50 shrink-0">{line.count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {testCleanupPreview.total === 0 && (
                      <p className="text-sm text-platinum-white/60">Nothing to clean up right now.</p>
                    )}
                    <p className="text-xs text-red-200/90">This cannot be undone.</p>
                    {testCleanupPreview.total > 0 && (
                      <label className="flex items-start gap-2 cursor-pointer text-sm text-platinum-white/85">
                        <input
                          type="checkbox"
                          checked={testCleanupAcknowledged}
                          onChange={e => setTestCleanupAcknowledged(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-red-400/50 text-red-600 focus:ring-red-400/50"
                        />
                        <span>
                          I understand this will permanently delete {testCleanupPreview.total} row
                          {testCleanupPreview.total === 1 ? '' : 's'} (flagged data plus seed contacts and
                          related records).
                        </span>
                      </label>
                    )}
                  </>
                ) : null}
              </div>
              <div className="p-5 border-t border-radiant-gold/15 flex flex-wrap gap-2 justify-end shrink-0">
                <button
                  ref={testCleanupCancelRef}
                  type="button"
                  onClick={() => {
                    setTestCleanupModalMode(null)
                    requestAnimationFrame(() => testCleanupReturnFocusRef.current?.focus())
                  }}
                  className="px-4 py-2 rounded-lg border border-radiant-gold/25 text-platinum-white/90 hover:bg-silicon-slate/40 focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                >
                  Cancel
                </button>
                {testCleanupPreview &&
                  testCleanupPreview.total > 0 &&
                  !testCleanupPreviewError &&
                  !testCleanupPreviewLoading &&
                  testCleanupModalMode && (
                    <button
                      type="button"
                      disabled={cleanupLoading || !testCleanupAcknowledged}
                      onClick={async () => {
                        const mode = testCleanupModalMode
                        setCleanupLoading(true)
                        showToast(
                          'info',
                          mode === 'all' ? 'Running full test data cleanup…' : 'Purging flagged test data…'
                        )
                        try {
                          const session = await getCurrentSession()
                          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
                          if (session?.access_token) {
                            headers['Authorization'] = `Bearer ${session.access_token}`
                          }
                          const res = await fetch('/api/admin/testing/cleanup-seeds', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({
                              mode: mode === 'all' ? 'all' : 'flag_only',
                            }),
                          })
                          const data = await res.json()
                          if (data.success) {
                            showToast(
                              'success',
                              mode === 'all'
                                ? `Full cleanup removed ${data.totalDeleted} row(s).`
                                : `Removed ${data.totalDeleted} flagged test row(s).`
                            )
                            if (mode === 'all') {
                              markScriptCompleted('cleanup_test_data')
                              resetSession()
                            }
                            setTestCleanupModalMode(null)
                            void fetchData()
                            requestAnimationFrame(() => testCleanupReturnFocusRef.current?.focus())
                          } else {
                            showToast('error', data.error || 'Cleanup failed')
                          }
                        } catch {
                          showToast('error', 'Failed to clean up test data')
                        } finally {
                          setCleanupLoading(false)
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-400/60"
                    >
                      {cleanupLoading
                        ? 'Working…'
                        : `Delete ${testCleanupPreview.total} row${testCleanupPreview.total === 1 ? '' : 's'}`}
                    </button>
                  )}
              </div>
            </div>
          </div>
        )}

        {runDetailRunId && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => setRunDetailRunId(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="run-detail-title"
          >
            <div
              className="bg-imperial-navy border border-radiant-gold/25 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.45)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 p-5 border-b border-radiant-gold/20 shrink-0">
                <h2 id="run-detail-title" className="text-lg font-semibold font-heading text-platinum-white">
                  Run details
                </h2>
                <button
                  type="button"
                  onClick={() => setRunDetailRunId(null)}
                  className="p-2 rounded-lg text-platinum-white/60 hover:bg-silicon-slate/50 hover:text-platinum-white focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1 text-sm">
                {runDetailLoading ? (
                  <div className="flex justify-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-radiant-gold" />
                  </div>
                ) : runDetailData && typeof runDetailData.error === 'string' ? (
                  <p className="text-red-200">{runDetailData.error}</p>
                ) : runDetailData ? (
                  <div className="space-y-5">
                    <p className="font-mono text-xs text-platinum-white/70 break-all">{String(runDetailData.runId ?? runDetailRunId)}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(() => {
                        const st = runDetailData.stats as Record<string, number> | undefined
                        if (!st) return null
                        return (
                          <>
                            <div className="rounded-lg border border-radiant-gold/15 bg-silicon-slate/25 p-3">
                              <p className="text-platinum-white/50 text-xs">Spawned</p>
                              <p className="text-lg font-semibold tabular-nums text-platinum-white">{st.clientsSpawned ?? '—'}</p>
                            </div>
                            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3">
                              <p className="text-platinum-white/50 text-xs">Passed clients</p>
                              <p className="text-lg font-semibold tabular-nums text-emerald-200">{st.clientsCompleted ?? '—'}</p>
                            </div>
                            <div className="rounded-lg border border-red-400/25 bg-red-500/10 p-3">
                              <p className="text-platinum-white/50 text-xs">Failed clients</p>
                              <p className="text-lg font-semibold tabular-nums text-red-200">{st.clientsFailed ?? '—'}</p>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                    {runDetailOutcome != null && (
                      <div className="flex items-center gap-2">
                        <span className="text-platinum-white/60">Status</span>
                        <StatusBadge status={runDetailOutcome} />
                      </div>
                    )}
                    {typeof runDetailData.scenarioBreakdown === 'object' &&
                    runDetailData.scenarioBreakdown !== null && (
                      <div>
                        <h3 className="text-sm font-medium text-platinum-white/80 mb-2">Scenarios</h3>
                        <div className="rounded-lg border border-radiant-gold/15 overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-platinum-white/55 border-b border-radiant-gold/15 bg-silicon-slate/30">
                                <th className="p-2">Scenario</th>
                                <th className="p-2 tabular-nums">Passed</th>
                                <th className="p-2 tabular-nums">Failed</th>
                                <th className="p-2 tabular-nums">Running</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(runDetailData.scenarioBreakdown as Record<string, { passed?: number; failed?: number; running?: number }>).map(([name, row]) => (
                                <tr key={name} className="border-b border-radiant-gold/10">
                                  <td className="p-2 font-mono text-platinum-white/85">{name}</td>
                                  <td className="p-2 tabular-nums text-emerald-200/90">{row.passed ?? 0}</td>
                                  <td className="p-2 tabular-nums text-red-200/90">{row.failed ?? 0}</td>
                                  <td className="p-2 tabular-nums text-gold-light">{row.running ?? 0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {(() => {
                      const st = runDetailData.stats as Record<string, number> | undefined
                      const failedClients = st?.clientsFailed ?? 0
                      const spawned = Number(st?.clientsSpawned) || 0
                      const completed = Number(st?.clientsCompleted) || 0
                      const needsRemediate =
                        runDetailOutcome === 'failed' ||
                        failedClients > 0 ||
                        (spawned > 0 && completed < spawned)
                      if (!needsRemediate) return null
                      return (
                        <p className="text-sm text-red-200/90 border border-red-400/30 rounded-lg p-3 bg-red-500/10">
                          Open <strong className="text-red-100">Errors & remediate</strong> below to review failures and send fixes to Cursor.
                        </p>
                      )
                    })()}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const id = runDetailRunId
                          setRunDetailRunId(null)
                          if (id) void openErrorsModal(id)
                        }}
                        className="btn-gold !px-4 !py-2 !text-sm inline-flex items-center gap-2 rounded-lg"
                      >
                        <Wrench className="w-4 h-4" />
                        Errors & remediate
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void rerunWithStoredConfig(runDetailData.config)
                          setRunDetailRunId(null)
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-radiant-gold/40 text-gold-light hover:bg-radiant-gold/10 text-sm focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Rerun
                      </button>
                      <button
                        type="button"
                        onClick={() => setRunDetailRunId(null)}
                        className="px-4 py-2 rounded-lg border border-radiant-gold/35 text-gold-light hover:bg-radiant-gold/10 text-sm"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-platinum-white/55">No data</p>
                )}
              </div>
            </div>
          </div>
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
              className="bg-imperial-navy border border-radiant-gold/25 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.45)]"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-radiant-gold/20 shrink-0">
                <div>
                  <h2 className="text-lg font-semibold font-heading text-platinum-white">Run errors</h2>
                  <p className="text-platinum-white/50 text-sm font-mono mt-0.5">{errorsModalRunId}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-platinum-white/55 text-sm tabular-nums">
                    {selectedErrors.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const selectable = errors.filter(e => e.remediation_status !== 'fixed' && e.remediation_status !== 'wont_fix' && e.remediation_status !== 'ignored')
                      if (selectedErrors.length === selectable.length && selectable.length > 0) {
                        setSelectedErrors([])
                      } else {
                        setSelectedErrors(selectable.map(e => e.error_id))
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs border border-radiant-gold/30 bg-silicon-slate/40 text-platinum-white/90 hover:border-radiant-gold/50 focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                  >
                    {selectedErrors.length > 0 ? 'Deselect all' : 'Select all'}
                  </button>
                  <button
                    type="button"
                    onClick={() => createRemediation('cursor_task')}
                    disabled={selectedErrors.length === 0 || remediationLoading}
                    className="flex items-center gap-1.5 btn-gold !px-3 !py-1.5 !text-xs disabled:opacity-40 rounded-lg focus:outline-none focus:ring-2 focus:ring-radiant-gold/60"
                  >
                    {remediationLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-imperial-navy border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Wrench className="w-3.5 h-3.5" />
                    )}
                    {remediationLoading ? 'Processing…' : 'Send to Cursor'}
                  </button>
                  <button
                    type="button"
                    onClick={() => createRemediation('github_pr')}
                    disabled={selectedErrors.length === 0}
                    className="flex items-center gap-1.5 border border-radiant-gold/35 bg-transparent text-gold-light hover:bg-radiant-gold/10 disabled:opacity-35 px-3 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Create PR
                  </button>
                  <button
                    type="button"
                    onClick={closeErrorsModal}
                    className="p-2 rounded-lg text-platinum-white/60 hover:text-platinum-white hover:bg-silicon-slate/50 focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
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
                    <RefreshCw className="w-6 h-6 animate-spin text-radiant-gold" />
                  </div>
                ) : errors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-platinum-white/55">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mb-3" />
                    <p className="font-medium text-platinum-white">No errors for this run</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {errors.map(error => {
                      const remInfo = getErrorRemediationInfo(error)
                      const isFixed = error.remediation_status === 'fixed'
                      const isWontFix = error.remediation_status === 'wont_fix' || error.remediation_status === 'ignored'
                      const isInProgress = error.remediation_status === 'in_progress' || (remInfo && !isFixed && !isWontFix)

                      let borderClass = 'border-radiant-gold/15 bg-silicon-slate/30'
                      if (selectedErrors.includes(error.error_id)) {
                        borderClass = 'border-radiant-gold bg-radiant-gold/10'
                      } else if (isFixed) {
                        borderClass = 'border-emerald-500/40 bg-emerald-500/10'
                      } else if (isWontFix) {
                        borderClass = 'border-platinum-white/15 bg-imperial-navy/50 opacity-60'
                      } else if (isInProgress) {
                        borderClass = 'border-bronze/45 bg-bronze/10'
                      }

                      const IconComponent = isFixed ? CheckCircle : isWontFix ? XCircle : AlertCircle
                      const iconColor = isFixed ? 'text-emerald-400' : isWontFix ? 'text-platinum-white/45' : 'text-red-300'

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
                              className={`mt-1 rounded border-radiant-gold/40 text-radiant-gold focus:ring-radiant-gold/50 ${isFixed || isWontFix ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <IconComponent className={`w-4 h-4 shrink-0 ${iconColor}`} />
                                <span className={`font-medium text-platinum-white/95 ${isWontFix ? 'line-through text-platinum-white/45' : ''}`}>{error.error_type}</span>
                                <span className="text-platinum-white/50">in {error.step_type}</span>
                                <span className="text-platinum-white/40 text-sm">({error.scenario})</span>
                                {remInfo && (
                                  <RemediationBadge
                                    status={remInfo.status}
                                    remediationId={remInfo.remediationId}
                                    errorStatus={remInfo.errorStatus}
                                    onClick={remInfo.remediationId ? () => scrollToRemediation(remInfo.remediationId!) : undefined}
                                  />
                                )}
                              </div>
                              <p className="text-platinum-white/80 text-sm">{error.error_message}</p>

                              {error.step_config && Object.keys(error.step_config).length > 0 && (
                                <div className="mt-2 p-2 bg-imperial-navy/80 border border-radiant-gold/10 rounded text-xs">
                                  <span className="text-platinum-white/45 font-medium">Step config</span>
                                  <div className="mt-1 font-mono text-platinum-white/65">
                                    {Object.entries(error.step_config)
                                      .filter(([key]) => key !== 'type')
                                      .map(([key, value]) => (
                                        <div key={key} className="ml-2">
                                          <span className="text-radiant-gold/90">{key}:</span>{' '}
                                          <span className="text-platinum-white/80">
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
            <div className="bg-imperial-navy border border-radiant-gold/25 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.45)]">
              <div className="flex justify-between items-center p-4 border-b border-radiant-gold/20">
                <h3 className="text-lg font-semibold font-heading text-platinum-white">Cursor task prompt</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(cursorPrompt)}
                    className="flex items-center gap-2 btn-gold !py-2 !px-4 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-radiant-gold/60"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => setCursorPrompt(null)}
                    className="p-2 rounded-lg text-platinum-white/60 hover:bg-silicon-slate/50 hover:text-platinum-white focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                <pre className="whitespace-pre-wrap text-sm text-platinum-white/80 font-mono">
                  {cursorPrompt}
                </pre>
              </div>
            </div>
          </div>
        )}
        
        {/* Remediation */}
        {remediations.length > 0 && (
          <section className="glass-card p-6 mb-8 border border-radiant-gold/20 border-l-4 border-l-bronze/80">
            <h2 className="text-xl font-semibold font-heading text-platinum-white mb-4">Remediation</h2>
            
            <div className="space-y-3">
              {remediations.map(rem => (
                <div
                  key={rem.id}
                  id={`remediation-${rem.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 bg-silicon-slate/30 border border-radiant-gold/10 rounded-lg transition-all duration-300"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Wrench className="w-4 h-4 text-radiant-gold shrink-0" />
                      <span className="font-mono text-sm text-platinum-white/50">{rem.id.substring(0, 12)}…</span>
                      <StatusBadge status={rem.status} />
                      <span className={`px-2 py-0.5 rounded-md text-xs border ${
                        rem.priority === 'critical' ? 'bg-red-500/15 text-red-200 border-red-400/40' :
                        rem.priority === 'high' ? 'bg-orange-500/15 text-orange-200 border-orange-400/40' :
                        rem.priority === 'medium' ? 'bg-radiant-gold/15 text-gold-light border-radiant-gold/35' :
                        'bg-silicon-slate/50 text-platinum-white/70 border-platinum-white/15'
                      }`}>
                        {rem.priority}
                      </span>
                    </div>
                    <p className="text-platinum-white/50 text-sm">
                      {rem.error_ids.length} error(s) · {new Date(rem.created_at).toLocaleString()}
                    </p>
                    {rem.analysis?.rootCause && (
                      <p className="text-platinum-white/75 text-sm mt-1 line-clamp-2">
                        {rem.analysis.rootCause.substring(0, 100)}…
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {rem.cursor_task_id && (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await fetch(`/api/testing/remediation/${rem.id}`)
                          const data = await res.json()
                          if (data.cursorTaskPrompt) {
                            setCursorPrompt(data.cursorTaskPrompt)
                          }
                        }}
                        className="p-2 rounded-lg border border-radiant-gold/25 text-platinum-white/80 hover:bg-radiant-gold/10 focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                        title="View Cursor task"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    )}
                    {rem.github_pr_url && (
                      <a
                        href={rem.github_pr_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg border border-radiant-gold/25 text-platinum-white/80 hover:bg-radiant-gold/10 focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                        title="View GitHub PR"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    {['review_required', 'pending', 'analyzing', 'generating_fix'].includes(rem.status) && (
                      <>
                        <button
                          type="button"
                          onClick={() => markRemediationComplete(rem.id, 'fixed')}
                          className="flex items-center gap-1 px-3 py-1.5 border border-emerald-500/45 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                          title="Mark all errors as fixed"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Fixed
                        </button>
                        <button
                          type="button"
                          onClick={() => markRemediationComplete(rem.id, 'wont_fix')}
                          className="flex items-center gap-1 px-3 py-1.5 border border-platinum-white/25 text-platinum-white/80 hover:bg-silicon-slate/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                          title="Mark all errors as won't fix"
                        >
                          <XCircle className="w-4 h-4" />
                          Won&apos;t fix
                        </button>
                      </>
                    )}
                    {rem.status === 'applied' && (
                      <span className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/15 text-emerald-200 border border-emerald-500/35 rounded-lg text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Completed
                      </span>
                    )}
                    {rem.status === 'rejected' && (
                      <span className="flex items-center gap-1 px-3 py-1.5 bg-platinum-white/10 text-platinum-white/55 border border-platinum-white/15 rounded-lg text-sm">
                        <XCircle className="w-4 h-4" />
                        Closed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        
        {toastMessage && (
          <div
            role="status"
            className={`fixed bottom-4 right-4 max-w-md px-4 py-3 rounded-lg border shadow-lg flex items-center gap-3 z-50 ${
              toastMessage.type === 'success'
                ? 'bg-imperial-navy border-emerald-500/40 text-emerald-100'
                : toastMessage.type === 'error'
                  ? 'bg-imperial-navy border-red-400/45 text-red-100'
                  : 'bg-imperial-navy border-radiant-gold/40 text-gold-light'
            }`}
          >
            {toastMessage.type === 'info' && (
              <div className="w-4 h-4 border-2 border-radiant-gold border-t-transparent rounded-full animate-spin shrink-0" />
            )}
            <span className="text-sm">{toastMessage.text}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-platinum-white/60 hover:text-platinum-white ml-auto shrink-0 focus:outline-none focus:ring-2 focus:ring-radiant-gold/50 rounded"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
