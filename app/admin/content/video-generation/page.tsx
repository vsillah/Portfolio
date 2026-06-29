'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Video, Play, RefreshCw, Loader2, ExternalLink, CheckCircle,
  FileText, X, Lightbulb, Image as ImageIcon, Wand2, ChevronDown,
  ChevronUp, ChevronLeft, ChevronRight, Sparkles, Camera, FolderSync,
  PenLine, Zap, Filter, Square, CheckSquare, Plus, Settings, Clock,
  Search, User, Calendar, Trash2, RotateCcw,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import AssetPicker from '@/components/admin/AssetPicker'
import AgenticContentReviewPacketCard from '@/components/admin/AgenticContentReviewPacketCard'
import { ExtractionStatusChip } from '@/components/admin/ExtractionStatusChip'
import { useWorkflowStatus } from '@/lib/hooks/useWorkflowStatus'
import ProgressPanel, { type ProgressStep } from '@/components/admin/ProgressPanel'
import { readSSEStream } from '@/lib/sse-reader'
import { getCurrentSession } from '@/lib/auth'
import { VIDEO_CHANNEL_CONFIGS, type VideoChannel } from '@/lib/constants/video-channel'
import { buildVideoRenderApproval, VIDEO_RENDER_APPROVAL_PACKET_PATH } from '@/lib/video-render-approval'
import {
  getAgenticContentReviewPacketsForSurface,
  type AgenticContentReviewPacket,
} from '@/lib/agentic-content-review-packets'
import {
  buildAgenticVideoRenderReadinessActionHref,
  getAgenticVideoRenderReadinessPackets,
  type AgenticVideoRenderReadinessPacket,
} from '@/lib/agentic-video-render-readiness-packets'

/* ───────────── Types ───────────── */

interface AvatarOption { id: string; name: string; type: 'avatar' }
interface TemplateOption { templateId: string; name: string; aspectRatio: 'landscape' | 'portrait' }
interface BrandVoiceOption { id: string; name: string }

interface DraftItem {
  id: string
  title: string
  script_text: string
  storyboard_json: { scenes?: Array<{ sceneNumber?: number; description?: string; brollHint?: string }> } | null
  source: string
  status: string
  video_generation_job_id: string | null
  custom_prompt?: string | null
  script_template_id?: string | null
  script_outline?: ScriptOutline | null
  script_scorecard?: ScriptScorecard | null
  research_packet_ids?: string[] | null
  created_at: string
}

interface DraftEditForm {
  title: string
  scriptText: string
  storyboardText: string
}

interface RenderReadinessReport {
  ready: boolean
  blockingIssues: string[]
  warnings: string[]
  details: {
    scriptCharacters: number
    storyboardScenes: number
    brollAssetIds: string[]
    heygenMode: 'template' | 'avatar_voice' | 'missing'
    approvalBoundary: string
    scriptScorecard: ScriptScorecard
  }
}

interface ScriptOutline {
  pain_point?: string
  hook?: string
  open_loop?: string
  frame?: string
  proof_demo?: string
  teaching_beats?: string[]
  cta?: string
  closing_question?: string
  thumbnail_promise?: string
  source_distance_notes?: string
}

interface ScriptScorecard {
  overall_score: number
  pain_clarity: number
  hook_strength: number
  loop_retention: number
  proof_density: number
  cta_clarity: number
  vambah_authority: number
  source_distance_safety: number
  blockers: string[]
  warnings: string[]
  notes: string[]
}

interface ScriptTemplate {
  id: string
  key: string
  name: string
  description: string
  source_type: 'seeded' | 'creator_pattern' | 'amadutown_performance'
  source_urls: string[]
  outline: ScriptOutline
  status: string
}

interface DriveQueueItem {
  id: string
  drive_file_id: string
  drive_file_name: string
  script_text_prior: string | null
  script_text: string
  effective_at: string
  detected_at: string
  status: string
}

interface VideoJob {
  id: string
  script_source: string
  script_text: string
  drive_file_name: string | null
  target_type: string | null
  target_id: string | null
  avatar_id: string
  voice_id: string
  aspect_ratio: string
  channel: string
  heygen_video_id: string | null
  heygen_status: string | null
  error_message: string | null
  video_url: string | null
  video_share_url: string | null
  video_record_id: number | null
  broll_asset_ids: string[] | null
  created_at: string
}

interface BrollAsset {
  id: string
  route: string
  route_description: string | null
  filename: string
  screenshot_path: string | null
  clip_path: string | null
  captured_at: string
}

interface ContactOption {
  email: string
  name: string | null
  company: string | null
  source: 'client' | 'lead'
}

interface MeetingRecord {
  id: string
  meeting_type: string | null
  meeting_date: string | null
  duration_minutes: number | null
  summary: string | null
  client_name: string | null
  client_company: string | null
  client_email: string | null
  has_transcript: boolean
  key_decisions_count: number
}

type SourceFilter = 'all' | 'llm_generated' | 'drive_script' | 'manual'
type JobStatusFilter = 'all' | 'pending' | 'completed' | 'failed'
type WorkspaceTab = 'script' | 'assets' | 'readiness' | 'generated' | 'source'
type ReviewWorkspaceKind = 'script_packet' | 'draft' | 'job'

interface EvidencePacketState {
  content?: string
  error?: string
  loading?: boolean
}

interface ReviewWorkspaceItem {
  id: string
  kind: ReviewWorkspaceKind
  title: string
  channel: string
  stage: string
  nextAction: string
  statusLabel: string
  statusTone: 'ready' | 'blocked' | 'pending' | 'done'
  priorityLabel: string
  sourcePacketPath?: string
  draftId?: string
  jobIds: string[]
  brollAssetIds: string[]
  scriptPacket?: AgenticContentReviewPacket
  readinessPacket?: AgenticVideoRenderReadinessPacket
  draft?: DraftItem
  jobs: VideoJob[]
}

const GITHUB_DOC_BASE_URL = 'https://github.com/vsillah/Portfolio/blob/main/'

/* ───────────── Helpers ───────────── */

function sourcePacketUrl(path: string) {
  return `${GITHUB_DOC_BASE_URL}${path}`
}

function priorityLabel(priority?: string | null) {
  switch (priority) {
    case 'P0': return 'High priority'
    case 'P1': return 'Medium priority'
    case 'P2': return 'Low priority'
    default: return 'Normal priority'
  }
}

function statusToneClass(tone: ReviewWorkspaceItem['statusTone']) {
  switch (tone) {
    case 'ready': return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
    case 'blocked': return 'border-rose-500/35 bg-rose-500/10 text-rose-200'
    case 'done': return 'border-sky-500/35 bg-sky-500/10 text-sky-200'
    default: return 'border-radiant-gold/35 bg-radiant-gold/10 text-radiant-gold'
  }
}

function safeDateLabel(value?: string | null) {
  if (!value) return 'No date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No date'
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function sourceBadge(source: string) {
  switch (source) {
    case 'llm_generated': return { label: 'Meetings', cls: 'bg-purple-500/20 text-purple-400' }
    case 'drive_script': return { label: 'Drive', cls: 'bg-blue-500/20 text-blue-400' }
    case 'manual': return { label: 'Input', cls: 'bg-emerald-500/20 text-emerald-400' }
    default: return { label: source, cls: 'bg-gray-500/20 text-gray-400' }
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatStoryboardForEdit(draft: DraftItem) {
  return JSON.stringify(draft.storyboard_json ?? { scenes: [] }, null, 2)
}

function brollStaleness(capturedAt: string): 'fresh' | 'stale' | 'old' {
  const days = (Date.now() - new Date(capturedAt).getTime()) / 86400000
  if (days > 30) return 'old'
  if (days > 7) return 'stale'
  return 'fresh'
}

function lastRunLabel(date: Date | null): string | null {
  if (!date) return null
  const diff = Date.now() - date.getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function emptyScriptScorecard(): ScriptScorecard {
  return {
    overall_score: 0,
    pain_clarity: 0,
    hook_strength: 0,
    loop_retention: 0,
    proof_density: 0,
    cta_clarity: 0,
    vambah_authority: 0,
    source_distance_safety: 0,
    blockers: [],
    warnings: [],
    notes: [],
  }
}

function scoreTone(score?: number) {
  if ((score ?? 0) >= 75) return 'text-emerald-300 border-emerald-500/35 bg-emerald-500/10'
  if ((score ?? 0) >= 55) return 'text-amber-200 border-amber-500/35 bg-amber-500/10'
  return 'text-red-200 border-red-500/35 bg-red-500/10'
}

const HEYGEN_SCRIPT_MAX = 5000
const AGENTIC_VIDEO_REVIEW_PACKETS = getAgenticContentReviewPacketsForSurface('video')
const AGENTIC_VIDEO_RENDER_READINESS_PACKETS = getAgenticVideoRenderReadinessPackets()

/* ───────────── Component ───────────── */

export default function VideoGenerationPage() {
  /* --- Shared video settings (page-level defaults) --- */
  const [channel, setChannel] = useState<VideoChannel>('youtube')
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9')
  const [useTemplate, setUseTemplate] = useState(false)
  const [avatars, setAvatars] = useState<AvatarOption[]>([])
  const [avatarsLoading, setAvatarsLoading] = useState(true)
  const [selectedAvatarId, setSelectedAvatarId] = useState('')

  /* --- HeyGen Config (DB-managed defaults) --- */
  interface ConfigAsset { id: string; asset_type: string; asset_id: string; asset_name: string; is_default: boolean; is_favorite: boolean; metadata: Record<string, unknown> }
  const [configAvatars, setConfigAvatars] = useState<ConfigAsset[]>([])
  const [configVoices, setConfigVoices] = useState<ConfigAsset[]>([])
  const [configDefaults, setConfigDefaults] = useState<{ avatarId: string | null; voiceId: string | null }>({ avatarId: null, voiceId: null })
  const [configLoading, setConfigLoading] = useState(false)
  const [triggerAllLoading, setTriggerAllLoading] = useState(false)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [brandVoices, setBrandVoices] = useState<BrandVoiceOption[]>([])
  const [brandVoicesLoading, setBrandVoicesLoading] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedBrandVoiceId, setSelectedBrandVoiceId] = useState('')

  /* --- Plan: From Scratch --- */
  const [scratchLimit, setScratchLimit] = useState(5)
  const [scratchRunning, setScratchRunning] = useState(false)
  const [scriptTemplates, setScriptTemplates] = useState<ScriptTemplate[]>([])
  const [scriptTemplatesLoading, setScriptTemplatesLoading] = useState(false)
  const [selectedScriptTemplateId, setSelectedScriptTemplateId] = useState('')
  const [scriptIntent, setScriptIntent] = useState('')

  /* --- Client context picker --- */
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false)
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null)
  const [manualEmailMode, setManualEmailMode] = useState(false)
  const [manualEmail, setManualEmail] = useState('')
  const contactDropdownRef = useRef<HTMLDivElement>(null)

  /* --- Plan: From a Direction --- */
  const [directionText, setDirectionText] = useState('')
  const [directionLimit, setDirectionLimit] = useState(1)
  const [directionRunning, setDirectionRunning] = useState(false)
  const [showDirectionDetails, setShowDirectionDetails] = useState(false)
  const [promptAudience, setPromptAudience] = useState('')
  const [promptTone, setPromptTone] = useState('')
  const [promptAngle, setPromptAngle] = useState('')
  const [formattedPrompt, setFormattedPrompt] = useState('')
  const [formattingPrompt, setFormattingPrompt] = useState(false)
  const [polishWithLLM, setPolishWithLLM] = useState(false)

  /* --- Plan: From Drive --- */
  const [driveItems, setDriveItems] = useState<DriveQueueItem[]>([])
  const [driveLoading, setDriveLoading] = useState(true)
  const [addingToDrafts, setAddingToDrafts] = useState<string | null>(null)

  /* --- B-roll Library --- */
  const [brollAssets, setBrollAssets] = useState<BrollAsset[]>([])
  const [brollLoading, setBrollLoading] = useState(true)
  const [brollCapturing, setBrollCapturing] = useState<false | 'all' | 'missing'>(false)

  /* --- Decide: Drafts Queue --- */
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [draftsLoading, setDraftsLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [generatingDraftId, setGeneratingDraftId] = useState<string | null>(null)
  const [generatingBatch, setGeneratingBatch] = useState(false)
  const [batchMessage, setBatchMessage] = useState<string | null>(null)
  const [generatingGamma, setGeneratingGamma] = useState(false)
  const [gammaUrl, setGammaUrl] = useState<string | null>(null)
  const [gammaError, setGammaError] = useState<string | null>(null)

  /* --- Decide: Selection mode + tabs + B-roll overrides --- */
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set())
  const [draftOutputTab, setDraftOutputTab] = useState<Record<string, 'heygen' | 'gamma'>>({})
  const [draftBroll, setDraftBroll] = useState<Record<string, string[]>>({})
  const [brollDropdownDraft, setBrollDropdownDraft] = useState<string | null>(null)
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [savingDraftId, setSavingDraftId] = useState<string | null>(null)
  const [draftEditForms, setDraftEditForms] = useState<Record<string, DraftEditForm>>({})
  const [draftEditError, setDraftEditError] = useState<string | null>(null)
  const [renderApprovalDrafts, setRenderApprovalDrafts] = useState<Record<string, boolean>>({})
  const [batchRenderApprovalConfirmed, setBatchRenderApprovalConfirmed] = useState(false)
  const [renderReadinessDrafts, setRenderReadinessDrafts] = useState<Record<string, RenderReadinessReport>>({})
  const [checkingReadinessDraftId, setCheckingReadinessDraftId] = useState<string | null>(null)

  /* --- Progress panels --- */
  const [scratchProgress, setScratchProgress] = useState<ProgressStep[] | null>(null)
  const [scratchProgressError, setScratchProgressError] = useState<string | null>(null)
  const scratchAbortRef = useRef<AbortController | null>(null)

  const [directionProgress, setDirectionProgress] = useState<ProgressStep[] | null>(null)
  const [directionProgressError, setDirectionProgressError] = useState<string | null>(null)
  const directionAbortRef = useRef<AbortController | null>(null)

  const [brollProgress, setBrollProgress] = useState<ProgressStep[] | null>(null)
  const [brollProgressError, setBrollProgressError] = useState<string | null>(null)
  const brollAbortRef = useRef<AbortController | null>(null)

  const [addToDraftsProgress, setAddToDraftsProgress] = useState<{ itemId: string; steps: ProgressStep[] } | null>(null)

  const [heygenProgress, setHeygenProgress] = useState<{ draftId: string; steps: ProgressStep[] } | null>(null)
  const [gammaProgress, setGammaProgress] = useState<{ draftId: string; steps: ProgressStep[] } | null>(null)
  const [batchProgress, setBatchProgress] = useState<ProgressStep[] | null>(null)

  /* --- Last-run timestamps --- */
  const [lastRunScratch, setLastRunScratch] = useState<Date | null>(null)
  const [lastRunDirection, setLastRunDirection] = useState<Date | null>(null)
  const [lastRunBroll, setLastRunBroll] = useState<Date | null>(null)

  /* --- Layout: sticky nav, plan tabs, broll collapse, decide pagination --- */
  const [planTab, setPlanTab] = useState<'meetings' | 'input'>('meetings')
  const [brollExpanded, setBrollExpanded] = useState(false)
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null)
  const [draftsPage, setDraftsPage] = useState(1)
  const [scriptReviewDecisionNotes, setScriptReviewDecisionNotes] = useState<Record<string, string>>({})
  const [activeWorkspaceItemId, setActiveWorkspaceItemId] = useState<string | null>(null)
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('script')
  const [evidencePackets, setEvidencePackets] = useState<Record<string, EvidencePacketState>>({})
  const [productionToolsOpen, setProductionToolsOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<'plan' | 'decide' | 'review'>('plan')
  const planRef = useRef<HTMLDivElement>(null)
  const decideRef = useRef<HTMLDivElement>(null)
  const reviewRef = useRef<HTMLDivElement>(null)

  /* --- Review: Jobs --- */
  const [jobs, setJobs] = useState<VideoJob[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobStatusFilter, setJobStatusFilter] = useState<JobStatusFilter>('all')
  const [jobsPage, setJobsPage] = useState(1)
  const [jobsTotal, setJobsTotal] = useState(0)
  const [jobSelectionMode, setJobSelectionMode] = useState(false)
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set())
  const [batchRefreshing, setBatchRefreshing] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [batchRetrying, setBatchRetrying] = useState(false)

  /* --- Plan: From Meetings — meeting records --- */
  const [meetingRecords, setMeetingRecords] = useState<MeetingRecord[]>([])
  const [meetingsLoading, setMeetingsLoading] = useState(false)
  const [meetingsTotal, setMeetingsTotal] = useState(0)
  const [meetingSearch, setMeetingSearch] = useState('')
  const [meetingDateFrom, setMeetingDateFrom] = useState('')
  const [meetingDateTo, setMeetingDateTo] = useState('')
  const [meetingsPage, setMeetingsPage] = useState(1)
  const [meetingSelectionMode, setMeetingSelectionMode] = useState(false)
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<Set<string>>(new Set())

  /* ───────────── Fetch helpers ───────────── */

  const getToken = useCallback(async () => {
    const s = await getCurrentSession()
    return s?.access_token ?? null
  }, [])

  const fetchEvidencePacket = useCallback(async (packetPath: string) => {
    if (!packetPath) return
    setEvidencePackets(current => ({
      ...current,
      [packetPath]: { ...current[packetPath], loading: true, error: undefined },
    }))

    const token = await getToken()
    if (!token) {
      setEvidencePackets(current => ({
        ...current,
        [packetPath]: { loading: false, error: 'Admin session required to load the evidence packet.' },
      }))
      return
    }

    try {
      const res = await fetch(`/api/admin/video-generation/evidence-packet?path=${encodeURIComponent(packetPath)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load evidence packet')
      }
      setEvidencePackets(current => ({
        ...current,
        [packetPath]: { loading: false, content: typeof data.content === 'string' ? data.content : '' },
      }))
    } catch (error) {
      setEvidencePackets(current => ({
        ...current,
        [packetPath]: {
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load evidence packet',
        },
      }))
    }
  }, [getToken])

  const fetchDrafts = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch('/api/admin/video-generation/ideas-queue?status=pending', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setDrafts(data.items ?? [])
      }
    } catch (err) { console.error('Fetch drafts error:', err) }
    finally { setDraftsLoading(false) }
  }, [getToken])

  const fetchDriveItems = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch('/api/admin/video-generation/queue?status=pending', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setDriveItems(data.items ?? [])
      }
    } catch (err) { console.error('Fetch drive queue error:', err) }
    finally { setDriveLoading(false) }
  }, [getToken])

  const fetchBrollLibrary = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch('/api/admin/video-generation/broll-library', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setBrollAssets(data.assets ?? [])
      }
    } catch (err) { console.error('Fetch broll library error:', err) }
    finally { setBrollLoading(false) }
  }, [getToken])

  const fetchScriptTemplates = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    setScriptTemplatesLoading(true)
    try {
      const res = await fetch('/api/admin/video-generation/script-templates', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const templatesList = (data.templates ?? []) as ScriptTemplate[]
        setScriptTemplates(templatesList)
        setSelectedScriptTemplateId(current => current || templatesList.find(template => template.key === 'killer_script')?.id || templatesList[0]?.id || '')
      }
    } catch (err) { console.error('Fetch script templates error:', err) }
    finally { setScriptTemplatesLoading(false) }
  }, [getToken])

  const effectiveEmail = manualEmailMode ? manualEmail.trim() : (selectedContact?.email ?? '')

  const clearContactSelection = () => {
    setSelectedContact(null)
    setManualEmailMode(false)
    setManualEmail('')
    setContactSearch('')
  }

  const JOBS_PER_PAGE = 5

  const fetchJobs = useCallback(async (statusOverride?: JobStatusFilter, pageOverride?: number) => {
    const token = await getToken()
    if (!token) return
    const status = statusOverride ?? jobStatusFilter
    const page = pageOverride ?? jobsPage
    const offset = (page - 1) * JOBS_PER_PAGE
    const params = new URLSearchParams({ limit: String(JOBS_PER_PAGE), offset: String(offset) })
    if (status !== 'all') params.set('status', status)
    try {
      const res = await fetch(`/api/admin/video-generation/jobs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setJobs(data.jobs ?? [])
        setJobsTotal(data.total ?? 0)
      }
    } catch (err) { console.error('Fetch jobs error:', err) }
    finally { setJobsLoading(false) }
  }, [getToken, jobStatusFilter, jobsPage])

  const MEETINGS_PER_PAGE = 5

  const fetchMeetings = useCallback(async (pageOverride?: number) => {
    const token = await getToken()
    if (!token) return
    setMeetingsLoading(true)
    const page = pageOverride ?? meetingsPage
    const offset = (page - 1) * MEETINGS_PER_PAGE
    const params = new URLSearchParams({ limit: String(MEETINGS_PER_PAGE), offset: String(offset) })
    if (meetingSearch) params.set('q', meetingSearch)
    if (effectiveEmail) params.set('client', effectiveEmail)
    if (meetingDateFrom) params.set('from', meetingDateFrom)
    if (meetingDateTo) params.set('to', meetingDateTo)
    try {
      const res = await fetch(`/api/admin/video-generation/meetings?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMeetingRecords(data.meetings ?? [])
        setMeetingsTotal(data.total ?? 0)
      }
    } catch (err) { console.error('Fetch meetings error:', err) }
    finally { setMeetingsLoading(false) }
  }, [getToken, meetingSearch, effectiveEmail, meetingDateFrom, meetingDateTo, meetingsPage])

  /* ───────────── Init ───────────── */

  useEffect(() => { fetchDrafts() }, [fetchDrafts])
  useEffect(() => { fetchDriveItems() }, [fetchDriveItems])
  useEffect(() => { fetchBrollLibrary() }, [fetchBrollLibrary])
  useEffect(() => { fetchScriptTemplates() }, [fetchScriptTemplates])
  useEffect(() => { fetchJobs() }, [fetchJobs])
  useEffect(() => { if (planTab === 'meetings') fetchMeetings() }, [fetchMeetings, planTab])

  // Debounced meeting search
  useEffect(() => {
    const timer = setTimeout(() => { setMeetingsPage(1); fetchMeetings(1) }, 350)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingSearch, meetingDateFrom, meetingDateTo])

  // Reset job page on filter change
  useEffect(() => {
    setJobsPage(1)
    setSelectedJobIds(new Set())
    fetchJobs(jobStatusFilter, 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobStatusFilter])

  // Poll pending HeyGen jobs every 30s
  useEffect(() => {
    const hasPending = jobs.some(j => ['pending', 'waiting', 'processing'].includes(j.heygen_status ?? ''))
    if (!hasPending) return
    const interval = setInterval(fetchJobs, 30000)
    return () => clearInterval(interval)
  }, [jobs, fetchJobs])

  const fetchHeyGenConfig = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    setConfigLoading(true)
    try {
      const res = await fetch('/api/admin/video-generation/heygen-config', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setConfigAvatars(data.avatars ?? [])
        setConfigVoices(data.voices ?? [])
        setConfigDefaults(data.defaults ?? { avatarId: null, voiceId: null })
      }
    } catch { /* ignore */ }
    finally { setConfigLoading(false) }
  }, [getToken])

  const heygenWorkflow = useWorkflowStatus(
    { apiBase: '/api/admin/video-generation/workflow-status', workflowId: 'vgen_heygen', enabled: productionToolsOpen },
    () => { void fetchHeyGenConfig() },
  )
  const driveWorkflow = useWorkflowStatus(
    { apiBase: '/api/admin/video-generation/workflow-status', workflowId: 'vgen_drive', enabled: productionToolsOpen },
    () => { void fetchDriveItems() },
  )

  const eitherRunning =
    heygenWorkflow.state === 'running' || heygenWorkflow.state === 'stale' ||
    driveWorkflow.state === 'running' || driveWorkflow.state === 'stale'

  const triggerHeyGenSync = async () => {
    heygenWorkflow.onTriggerStarted()
    try {
      const token = await getToken()
      if (!token) {
        heygenWorkflow.refetch()
        return
      }
      await fetch('/api/admin/video-generation/heygen-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      })
      await fetchHeyGenConfig()
    } catch {
      await fetchHeyGenConfig()
    } finally {
      heygenWorkflow.refetch()
    }
  }

  const handleSyncAll = async () => {
    setTriggerAllLoading(true)
    heygenWorkflow.onTriggerStarted()
    driveWorkflow.onTriggerStarted()
    try {
      const token = await getToken()
      if (!token) {
        heygenWorkflow.refetch()
        driveWorkflow.refetch()
        return
      }
      const [heyOutcome, driveOutcome] = await Promise.allSettled([
        (async () => {
          const res = await fetch('/api/admin/video-generation/heygen-config', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sync' }),
          })
          return { res }
        })(),
        (async () => {
          const res = await fetch('/api/admin/video-generation/sync-drive', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ force: false }),
          })
          return { res }
        })(),
      ])
      if (heyOutcome.status === 'fulfilled' && heyOutcome.value.res.ok) {
        await fetchHeyGenConfig()
      }
      if (driveOutcome.status === 'fulfilled' && driveOutcome.value.res.ok) {
        await fetchDriveItems()
      }
    } finally {
      heygenWorkflow.refetch()
      driveWorkflow.refetch()
      setTriggerAllLoading(false)
    }
  }

  const handleCancelAll = () => {
    if (heygenWorkflow.currentRun && (heygenWorkflow.state === 'running' || heygenWorkflow.state === 'stale')) {
      heygenWorkflow.markRunFailed(heygenWorkflow.currentRun.id, 'Cancelled by user')
    }
    if (driveWorkflow.currentRun && (driveWorkflow.state === 'running' || driveWorkflow.state === 'stale')) {
      driveWorkflow.markRunFailed(driveWorkflow.currentRun.id, 'Cancelled by user')
    }
  }

  const setHeyGenDefault = useCallback(async (assetType: 'avatar' | 'voice', assetId: string) => {
    const token = await getToken()
    if (!token) return
    try {
      await fetch('/api/admin/video-generation/heygen-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_default', assetType, assetId }),
      })
      await fetchHeyGenConfig()
    } catch { /* ignore */ }
  }, [getToken, fetchHeyGenConfig])

  const toggleFavoriteAsset = useCallback(async (assetType: 'avatar' | 'voice', assetId: string, favorite: boolean) => {
    const token = await getToken()
    if (!token) return
    try {
      await fetch('/api/admin/video-generation/heygen-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_favorite', assetType, assetId, favorite }),
      })
      await fetchHeyGenConfig()
    } catch { /* ignore */ }
  }, [getToken, fetchHeyGenConfig])

  const addManualAsset = useCallback(async (assetType: 'avatar' | 'voice', assetId: string, assetName: string) => {
    const token = await getToken()
    if (!token) return
    try {
      await fetch('/api/admin/video-generation/heygen-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_manual', assetType, assetId, assetName }),
      })
      await fetchHeyGenConfig()
    } catch { /* ignore */ }
  }, [getToken, fetchHeyGenConfig])

  const resolveHeyGenName = useCallback(async (assetType: 'avatar' | 'voice', assetId: string): Promise<{ name: string | null; error: string | null }> => {
    const token = await getToken()
    if (!token) return { name: null, error: 'Not authenticated' }
    try {
      const res = await fetch('/api/admin/video-generation/heygen-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_name', assetType, assetId }),
      })
      const data = await res.json().catch(() => ({}))
      return { name: data.name ?? null, error: data.error ?? null }
    } catch { return { name: null, error: 'Network error' } }
  }, [getToken])

  useEffect(() => {
    if (!productionToolsOpen) return
    fetchHeyGenConfig()
  }, [fetchHeyGenConfig, productionToolsOpen])

  useEffect(() => {
    const load = async () => {
      const token = await getToken()
      if (!token) return
      try {
        const res = await fetch('/api/admin/video-generation/avatars', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && Array.isArray(data.avatars)) setAvatars(data.avatars)
      } catch { /* ignore */ }
      finally { setAvatarsLoading(false) }
    }
    load()
  }, [getToken])

  useEffect(() => {
    if (!useTemplate) return
    const load = async () => {
      setTemplatesLoading(true)
      setBrandVoicesLoading(true)
      const token = await getToken()
      if (!token) return
      try {
        const [tRes, bRes] = await Promise.all([
          fetch('/api/admin/video-generation/templates', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/admin/video-generation/brand-voices', { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const tData = await tRes.json().catch(() => ({}))
        const bData = await bRes.json().catch(() => ({}))
        if (tRes.ok && Array.isArray(tData.templates)) setTemplates(tData.templates)
        if (bRes.ok && Array.isArray(bData.brandVoices)) setBrandVoices(bData.brandVoices)
      } catch { /* ignore */ }
      finally { setTemplatesLoading(false); setBrandVoicesLoading(false) }
    }
    load()
  }, [useTemplate, getToken])

  const handleChannelChange = (ch: VideoChannel) => {
    setChannel(ch)
    setAspectRatio(VIDEO_CHANNEL_CONFIGS[ch].defaultAspectRatio)
  }

  /* ───────────── Client context picker ───────────── */

  const fetchContacts = useCallback(async (q = '') => {
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch(`/api/admin/contacts-search?q=${encodeURIComponent(q)}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setContacts(data.contacts ?? [])
      }
    } catch { /* ignore */ }
  }, [getToken])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  useEffect(() => {
    if (!contactDropdownOpen) return
    const timer = setTimeout(() => fetchContacts(contactSearch), 250)
    return () => clearTimeout(timer)
  }, [contactSearch, contactDropdownOpen, fetchContacts])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(e.target as Node)) {
        setContactDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /* ───────────── Sticky nav: IntersectionObserver ───────────── */

  useEffect(() => {
    const refs = [
      { ref: planRef, id: 'plan' as const },
      { ref: decideRef, id: 'decide' as const },
      { ref: reviewRef, id: 'review' as const },
    ]
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const match = refs.find(r => r.ref.current === entry.target)
            if (match) setActiveSection(match.id)
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )
    for (const { ref } of refs) {
      if (ref.current) observer.observe(ref.current)
    }
    return () => observer.disconnect()
  }, [])

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /* ───────────── B-roll: auto-expand on capture ───────────── */

  useEffect(() => {
    if (brollCapturing || brollProgress) setBrollExpanded(true)
  }, [brollCapturing, brollProgress])

  /* ───────────── Decide: pagination ───────────── */

  const DRAFTS_PER_PAGE = 5

  useEffect(() => { setDraftsPage(1) }, [sourceFilter])

  /* ───────────── Plan: From Scratch ───────────── */

  const ideasSteps: ProgressStep[] = [
    { id: 'fetching_context', label: 'Loading context', status: 'pending' },
    { id: 'calling_llm', label: 'Brainstorming with AI', status: 'pending' },
    { id: 'parsing', label: 'Processing response', status: 'pending' },
    { id: 'inserting', label: 'Saving drafts', status: 'pending' },
  ]

  function advanceIdeasSteps(
    currentSteps: ProgressStep[],
    event: Record<string, unknown>
  ): ProgressStep[] {
    const stepId = event.step as string
    if (stepId === 'done' || stepId === 'error') {
      return currentSteps.map(s => ({ ...s, status: stepId === 'done' ? 'done' as const : (s.status === 'active' ? 'error' as const : s.status) }))
    }
    return currentSteps.map(s => {
      if (s.id === stepId) return { ...s, status: 'active' as const, detail: event.detail as string | undefined }
      if (s.status === 'active') return { ...s, status: 'done' as const }
      return s
    })
  }

  const runFromScratch = async () => {
    setScratchRunning(true)
    setScratchProgressError(null)
    const steps = ideasSteps.map(s => ({ ...s, label: s.id === 'calling_llm' ? 'Brainstorming with GPT-4o' : s.label }))
    setScratchProgress(steps)
    const abort = new AbortController()
    scratchAbortRef.current = abort
    try {
      const token = await getToken()
      if (!token) return
      let latestSteps = steps
      await readSSEStream({
        url: '/api/admin/video-generation/generate-ideas',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: 'from_scratch',
          limit: scratchLimit,
          includeTranscripts: true,
          email: effectiveEmail || undefined,
          meetingIds: selectedMeetingIds.size > 0 ? Array.from(selectedMeetingIds) : undefined,
          scriptTemplateId: selectedScriptTemplateId || undefined,
          scriptIntent: scriptIntent || undefined,
        }),
        signal: abort.signal,
        onEvent: (event) => {
          if ((event.step as string) === 'error') {
            setScratchProgressError(event.error as string)
            latestSteps = advanceIdeasSteps(latestSteps, event)
            setScratchProgress([...latestSteps])
            return
          }
          latestSteps = advanceIdeasSteps(latestSteps, event)
          setScratchProgress([...latestSteps])
          if ((event.step as string) === 'done') {
            const count = (event.inserted as number) ?? scratchLimit
            latestSteps = latestSteps.map(s => s.id === 'inserting' ? { ...s, status: 'done' as const, detail: `${count} draft(s) created` } : s)
            setScratchProgress([...latestSteps])
            fetchDrafts()
            clearContactSelection()
          }
        },
        onError: (err) => {
          setScratchProgressError(err.message)
          setScratchProgress(prev => prev ? prev.map(s => s.status === 'active' || s.status === 'pending' ? { ...s, status: 'error' as const } : s) : null)
        },
      })
    } catch (err) {
      if (!abort.signal.aborted) {
        setScratchProgressError(err instanceof Error ? err.message : 'Failed to generate drafts')
        setScratchProgress(prev => prev ? prev.map(s => s.status === 'active' || s.status === 'pending' ? { ...s, status: 'error' as const } : s) : null)
      }
    } finally {
      setScratchRunning(false)
      scratchAbortRef.current = null
      setLastRunScratch(new Date())
    }
  }

  /* ───────────── Plan: From a Direction ───────────── */

  function formatPromptLocally(raw: string, details?: { audience?: string; tone?: string; angle?: string }): string {
    const sections: string[] = [raw.trim()]
    if (details?.audience) sections.push(`TARGET AUDIENCE: ${details.audience}`)
    if (details?.tone) sections.push(`TONE / STYLE: ${details.tone}`)
    if (details?.angle) sections.push(`ANGLE / HOOK: ${details.angle}`)
    return sections.join('\n\n')
  }

  const handleMagicFormat = async () => {
    if (!directionText.trim()) return
    const localFormatted = formatPromptLocally(directionText, { audience: promptAudience, tone: promptTone, angle: promptAngle })
    if (!polishWithLLM) { setFormattedPrompt(localFormatted); return }
    setFormattingPrompt(true)
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch('/api/admin/video-generation/format-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rawText: directionText, audience: promptAudience || undefined, tone: promptTone || undefined, angle: promptAngle || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      setFormattedPrompt(res.ok && data.formattedPrompt ? data.formattedPrompt : localFormatted)
    } catch { setFormattedPrompt(localFormatted) }
    finally { setFormattingPrompt(false) }
  }

  const runFromDirection = async () => {
    if (!directionText.trim() && !formattedPrompt.trim()) return
    setDirectionRunning(true)
    setDirectionProgressError(null)
    const steps = ideasSteps.map(s => ({ ...s, label: s.id === 'calling_llm' ? 'Polishing with GPT-4o' : s.label }))
    setDirectionProgress(steps)
    const abort = new AbortController()
    directionAbortRef.current = abort
    try {
      const token = await getToken()
      if (!token) return
      let latestSteps = steps
      await readSSEStream({
        url: '/api/admin/video-generation/generate-ideas',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: 'from_direction',
          limit: directionLimit,
          customPrompt: (formattedPrompt || directionText).trim(),
          audience: promptAudience || undefined,
          tone: promptTone || undefined,
          angle: promptAngle || undefined,
          scriptTemplateId: selectedScriptTemplateId || undefined,
          scriptIntent: scriptIntent || undefined,
        }),
        signal: abort.signal,
        onEvent: (event) => {
          if ((event.step as string) === 'error') {
            setDirectionProgressError(event.error as string)
            latestSteps = advanceIdeasSteps(latestSteps, event)
            setDirectionProgress([...latestSteps])
            return
          }
          latestSteps = advanceIdeasSteps(latestSteps, event)
          setDirectionProgress([...latestSteps])
          if ((event.step as string) === 'done') {
            const count = (event.inserted as number) ?? directionLimit
            latestSteps = latestSteps.map(s => s.id === 'inserting' ? { ...s, status: 'done' as const, detail: `${count} draft(s) created` } : s)
            setDirectionProgress([...latestSteps])
            fetchDrafts()
            setDirectionText('')
            setFormattedPrompt('')
            setPromptAudience('')
            setPromptTone('')
            setPromptAngle('')
            setScriptIntent('')
          }
        },
        onError: (err) => {
          setDirectionProgressError(err.message)
          setDirectionProgress(prev => prev ? prev.map(s => s.status === 'active' || s.status === 'pending' ? { ...s, status: 'error' as const } : s) : null)
        },
      })
    } catch (err) {
      if (!abort.signal.aborted) {
        setDirectionProgressError(err instanceof Error ? err.message : 'Failed to create drafts')
        setDirectionProgress(prev => prev ? prev.map(s => s.status === 'active' || s.status === 'pending' ? { ...s, status: 'error' as const } : s) : null)
      }
    } finally {
      setDirectionRunning(false)
      directionAbortRef.current = null
      setLastRunDirection(new Date())
    }
  }

  /* ───────────── Plan: From Drive ───────────── */

  const syncDrive = async (force = false) => {
    driveWorkflow.onTriggerStarted()
    try {
      const token = await getToken()
      if (!token) {
        driveWorkflow.refetch()
        return
      }
      await fetch('/api/admin/video-generation/sync-drive', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      await fetchDriveItems()
    } catch {
      /* chip + refetch reflect failure */
    } finally {
      driveWorkflow.refetch()
    }
  }

  const addToDrafts = async (driveItemId: string) => {
    setAddingToDrafts(driveItemId)
    const steps: ProgressStep[] = [
      { id: 'reading', label: 'Reading', status: 'active' },
      { id: 'creating', label: 'Creating draft', status: 'pending' },
    ]
    setAddToDraftsProgress({ itemId: driveItemId, steps: steps.map(s => ({ ...s })) })
    const t1 = setTimeout(() => setAddToDraftsProgress(prev => prev ? { ...prev, steps: prev.steps.map((s, i) => i === 0 ? { ...s, status: 'done' as const } : i === 1 ? { ...s, status: 'active' as const } : s) } : null), 800)
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch(`/api/admin/video-generation/queue/${driveItemId}/add-to-drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      clearTimeout(t1)
      if (!res.ok) {
        setAddToDraftsProgress(prev => prev ? { ...prev, steps: prev.steps.map(s => s.status === 'active' || s.status === 'pending' ? { ...s, status: 'error' as const, detail: data?.error } : s) } : null)
        return
      }
      setAddToDraftsProgress(prev => prev ? { ...prev, steps: prev.steps.map(s => ({ ...s, status: 'done' as const })) } : null)
      fetchDriveItems()
      fetchDrafts()
    } catch {
      clearTimeout(t1)
      setAddToDraftsProgress(prev => prev ? { ...prev, steps: prev.steps.map(s => s.status === 'active' || s.status === 'pending' ? { ...s, status: 'error' as const } : s) } : null)
    } finally {
      setAddingToDrafts(null)
    }
  }

  /* ───────────── B-roll Library ───────────── */

  const captureBrollLibrary = async (onlyMissing: boolean) => {
    setBrollCapturing(onlyMissing ? 'missing' : 'all')
    setBrollProgressError(null)
    setBrollProgress([{ id: 'starting', label: 'Preparing capture...', status: 'active' }])
    const abort = new AbortController()
    brollAbortRef.current = abort
    try {
      const token = await getToken()
      if (!token) return
      const routeStepsMap = new Map<string, ProgressStep>()
      let currentSteps: ProgressStep[] = [{ id: 'starting', label: 'Preparing capture...', status: 'active' }]

      await readSSEStream({
        url: '/api/admin/video-generation/broll-library/capture',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ onlyMissing, recordVideos: true }),
        signal: abort.signal,
        onEvent: (event) => {
          const step = event.step as string

          if (step === 'starting') {
            currentSteps = [{ id: 'starting', label: 'Preparing capture...', status: 'done' }]
            setBrollProgress([...currentSteps])
            return
          }

          if (step === 'capturing') {
            const route = event.route as string
            const substep = event.substep as string
            const detail = event.detail as string
            const existing = routeStepsMap.get(route)
            if (!existing) {
              const prev = Array.from(routeStepsMap.values()).pop()
              if (prev && prev.status === 'active') prev.status = 'done'
              const newStep: ProgressStep = { id: `route-${route}`, label: route, status: 'active', detail }
              routeStepsMap.set(route, newStep)
            } else {
              existing.status = substep === 'done' ? 'done' : 'active'
              existing.detail = detail
            }
            currentSteps = [
              { id: 'starting', label: 'Preparing capture...', status: 'done' },
              ...Array.from(routeStepsMap.values()),
            ]
            setBrollProgress([...currentSteps])
            return
          }

          if (step === 'upserting') {
            const prev = Array.from(routeStepsMap.values()).pop()
            if (prev && prev.status === 'active') prev.status = 'done'
            currentSteps = [
              { id: 'starting', label: 'Preparing capture...', status: 'done' },
              ...Array.from(routeStepsMap.values()),
              { id: 'upserting', label: 'Saving to library...', status: 'active' },
            ]
            setBrollProgress([...currentSteps])
            return
          }

          if (step === 'done') {
            const captured = (event.captured as number) ?? 0
            currentSteps = currentSteps.map(s => s.id === 'upserting'
              ? { ...s, status: 'done' as const, detail: `${captured} route(s) saved` }
              : { ...s, status: 'done' as const }
            )
            setBrollProgress([...currentSteps])
            fetchBrollLibrary()
            return
          }

          if (step === 'error') {
            setBrollProgressError(event.error as string)
            currentSteps = currentSteps.map(s => s.status === 'active' ? { ...s, status: 'error' as const } : s)
            setBrollProgress([...currentSteps])
          }
        },
        onError: (err) => {
          setBrollProgressError(err.message)
          setBrollProgress(prev => prev ? prev.map(s => s.status === 'active' || s.status === 'pending' ? { ...s, status: 'error' as const } : s) : null)
        },
      })
    } catch (err) {
      if (!abort.signal.aborted) {
        setBrollProgressError(err instanceof Error ? err.message : 'Capture failed')
        setBrollProgress(prev => prev ? prev.map(s => s.status === 'active' || s.status === 'pending' ? { ...s, status: 'error' as const } : s) : null)
      }
    } finally {
      setBrollCapturing(false)
      brollAbortRef.current = null
      setLastRunBroll(new Date())
    }
  }

  /* ───────────── Decide: Draft actions ───────────── */

  const heygenStepsDef: ProgressStep[] = [
    { id: 'validating', label: 'Validating script', status: 'pending' },
    { id: 'matching_broll', label: 'Matching B-roll assets', status: 'pending' },
    { id: 'sending', label: 'Sending to HeyGen', status: 'pending' },
    { id: 'saving', label: 'Creating job record', status: 'pending' },
  ]

  const checkRenderReadiness = async (draftId: string) => {
    setCheckingReadinessDraftId(draftId)
    try {
      const token = await getToken()
      if (!token) return
      const draft = drafts.find(d => d.id === draftId)
      const brollIds = draft ? getDraftBroll(draft) : undefined
      const res = await fetch(`/api/admin/video-generation/ideas-queue/${draftId}/render-readiness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          channel,
          aspectRatio,
          useTemplate,
          templateId: useTemplate ? selectedTemplateId || undefined : undefined,
          brandVoiceId: useTemplate ? selectedBrandVoiceId || undefined : undefined,
          avatarId: !useTemplate ? selectedAvatarId || undefined : undefined,
          brollAssetIds: brollIds && brollIds.length > 0 ? brollIds : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRenderReadinessDrafts(prev => ({
          ...prev,
          [draftId]: {
            ready: false,
            blockingIssues: [data?.error ?? 'Readiness check failed.'],
            warnings: [],
            details: {
              scriptCharacters: draft?.script_text.length ?? 0,
              storyboardScenes: draft?.storyboard_json?.scenes?.length ?? 0,
              brollAssetIds: brollIds ?? [],
              heygenMode: 'missing',
              approvalBoundary: 'Readiness failed before approval could be evaluated.',
              scriptScorecard: draft?.script_scorecard ?? emptyScriptScorecard(),
            },
          },
        }))
        return
      }
      if (data?.report) {
        setRenderReadinessDrafts(prev => ({ ...prev, [draftId]: data.report as RenderReadinessReport }))
      }
    } finally {
      setCheckingReadinessDraftId(null)
    }
  }

  const generateFromDraft = async (draftId: string) => {
    setGeneratingDraftId(draftId)
    const steps = heygenStepsDef.map(s => ({ ...s }))
    setHeygenProgress({ draftId, steps })

    const timers: ReturnType<typeof setTimeout>[] = []
    const advanceAt = (idx: number, ms: number) => {
      timers.push(setTimeout(() => {
        setHeygenProgress(prev => {
          if (!prev || prev.draftId !== draftId) return prev
          const updated = prev.steps.map((s, i) => {
            if (i < idx) return { ...s, status: 'done' as const }
            if (i === idx) return { ...s, status: 'active' as const }
            return s
          })
          return { ...prev, steps: updated }
        })
      }, ms))
    }
    advanceAt(0, 0)
    advanceAt(1, 1000)
    advanceAt(2, 2000)

    try {
      const token = await getToken()
      if (!token) return
      const draft = drafts.find(d => d.id === draftId)
      const brollIds = draft ? getDraftBroll(draft) : undefined
      const res = await fetch(`/api/admin/video-generation/ideas-queue/${draftId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
	        body: JSON.stringify({
	          channel, aspectRatio, useTemplate,
	          templateId: useTemplate ? selectedTemplateId || undefined : undefined,
	          brandVoiceId: useTemplate ? selectedBrandVoiceId || undefined : undefined,
	          avatarId: !useTemplate ? selectedAvatarId || undefined : undefined,
	          brollAssetIds: brollIds && brollIds.length > 0 ? brollIds : undefined,
	          renderApproval: buildVideoRenderApproval(Boolean(renderApprovalDrafts[draftId])),
	        }),
	      })
      const data = await res.json().catch(() => ({}))
      timers.forEach(clearTimeout)
      if (!res.ok) {
        setHeygenProgress(prev => prev ? { ...prev, steps: prev.steps.map(s => s.status === 'active' || s.status === 'pending' ? { ...s, status: 'error' as const, detail: data?.error } : s) } : null)
        return
      }
      setHeygenProgress(prev => prev ? { ...prev, steps: prev.steps.map(s => s.id === 'saving'
        ? { ...s, status: 'done' as const, detail: `Job ${data.jobId?.slice(0, 8) ?? ''} created` }
        : { ...s, status: 'done' as const }
      ) } : null)
      fetchDrafts()
      fetchJobs()
    } catch {
      timers.forEach(clearTimeout)
      setHeygenProgress(prev => prev ? { ...prev, steps: prev.steps.map(s => s.status === 'active' || s.status === 'pending' ? { ...s, status: 'error' as const } : s) } : null)
    } finally {
      setGeneratingDraftId(null)
    }
  }

  const dismissDraft = async (draftId: string) => {
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch(`/api/admin/video-generation/ideas-queue/${draftId}/dismiss`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) fetchDrafts()
      else { const d = await res.json().catch(() => ({})); alert(d?.error || 'Failed to dismiss') }
    } catch { alert('Failed to dismiss') }
  }

  const beginEditDraft = (draft: DraftItem) => {
    setDraftEditError(null)
    setEditingDraftId(draft.id)
    setDraftEditForms(prev => ({
      ...prev,
      [draft.id]: {
        title: draft.title,
        scriptText: draft.script_text,
        storyboardText: formatStoryboardForEdit(draft),
      },
    }))
  }

  const updateDraftEditForm = (draftId: string, patch: Partial<DraftEditForm>) => {
    setDraftEditForms(prev => ({
      ...prev,
      [draftId]: {
        ...(prev[draftId] ?? {
          title: '',
          scriptText: '',
          storyboardText: '{\n  "scenes": []\n}',
        }),
        ...patch,
      },
    }))
  }

  const cancelEditDraft = (draftId: string) => {
    setDraftEditError(null)
    setEditingDraftId(null)
    setDraftEditForms(prev => {
      const next = { ...prev }
      delete next[draftId]
      return next
    })
  }

  const saveDraftEdits = async (draftId: string) => {
    const form = draftEditForms[draftId]
    if (!form) return

    let storyboardJson: unknown
    try {
      storyboardJson = JSON.parse(form.storyboardText)
    } catch {
      setDraftEditError('Storyboard must be valid JSON.')
      return
    }

    setSavingDraftId(draftId)
    setDraftEditError(null)
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch(`/api/admin/video-generation/ideas-queue/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.title,
          scriptText: form.scriptText,
          storyboardJson,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDraftEditError(data?.error || 'Failed to save draft edits.')
        return
      }
      setDrafts(prev => prev.map(draft => draft.id === draftId ? data.item : draft))
      cancelEditDraft(draftId)
    } catch {
      setDraftEditError('Failed to save draft edits.')
    } finally {
      setSavingDraftId(null)
    }
  }

  const createGammaFromScript = async (scriptText: string, title?: string, draftId?: string) => {
    setGammaError(null); setGammaUrl(null)
    setGeneratingGamma(true)
    const steps: ProgressStep[] = [
      { id: 'preparing', label: 'Preparing script', status: 'active' },
      { id: 'creating', label: 'Creating Gamma presentation', status: 'pending' },
    ]
    if (draftId) setGammaProgress({ draftId, steps: steps.map(s => ({ ...s })) })
    setTimeout(() => {
      if (draftId) setGammaProgress(prev => prev ? { ...prev, steps: prev.steps.map((s, i) => i === 0 ? { ...s, status: 'done' as const } : i === 1 ? { ...s, status: 'active' as const } : s) } : null)
    }, 800)
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch('/api/admin/gamma-reports/from-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scriptText, title: title || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGammaError(data?.error || 'Failed to create Gamma')
        if (draftId) setGammaProgress(prev => prev ? { ...prev, steps: prev.steps.map(s => s.status === 'active' || s.status === 'pending' ? { ...s, status: 'error' as const } : s) } : null)
        return
      }
      setGammaUrl(data.gammaUrl ?? null)
      if (draftId) setGammaProgress(prev => prev ? { ...prev, steps: prev.steps.map(s => s.id === 'creating'
        ? { ...s, status: 'done' as const, detail: 'Presentation ready' }
        : { ...s, status: 'done' as const }
      ) } : null)
    } catch (err) {
      setGammaError(err instanceof Error ? err.message : 'Something went wrong.')
      if (draftId) setGammaProgress(prev => prev ? { ...prev, steps: prev.steps.map(s => s.status === 'active' || s.status === 'pending' ? { ...s, status: 'error' as const } : s) } : null)
    } finally {
      setGeneratingGamma(false)
    }
  }

  /* ───────────── Review: Job actions ───────────── */

  const [previewJob, setPreviewJob] = useState<VideoJob | null>(null)
  const [refreshingUrl, setRefreshingUrl] = useState<string | null>(null)

  const refreshJobStatus = async (jobId: string) => {
    const token = await getToken()
    if (!token) return
    try { await fetch(`/api/admin/video-generation/status?jobId=${jobId}`, { headers: { Authorization: `Bearer ${token}` } }); fetchJobs() }
    catch { /* ignore */ }
  }

  const refreshVideoUrl = async (job: VideoJob) => {
    if (!job.heygen_video_id) return
    setRefreshingUrl(job.id)
    const token = await getToken()
    if (!token) { setRefreshingUrl(null); return }
    try {
      const res = await fetch(`/api/admin/video-generation/status?jobId=${job.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.videoUrl) {
        setPreviewJob(prev => prev && prev.id === job.id ? { ...prev, video_url: data.videoUrl } : prev)
      }
      fetchJobs()
    } catch { /* ignore */ }
    finally { setRefreshingUrl(null) }
  }

  /* ───────────── Derived data ───────────── */

  const filteredDrafts = sourceFilter === 'all' ? drafts : drafts.filter(d => d.source === sourceFilter)
  const totalDraftPages = Math.max(1, Math.ceil(filteredDrafts.length / DRAFTS_PER_PAGE))
  const safeDraftsPage = Math.min(draftsPage, totalDraftPages)
  const pagedDrafts = filteredDrafts.slice(
    (safeDraftsPage - 1) * DRAFTS_PER_PAGE,
    safeDraftsPage * DRAFTS_PER_PAGE
  )

  function brollReadiness(draft: DraftItem): { ready: number; total: number } {
    const hints = draft.storyboard_json?.scenes?.map(s => s.brollHint).filter(Boolean) ?? []
    if (hints.length === 0) return { ready: 0, total: 0 }
    let ready = 0
    for (const hint of hints) {
      const lower = (hint as string).toLowerCase()
      if (brollAssets.some(a => a.filename.toLowerCase().includes(lower) || (a.route_description ?? '').toLowerCase().includes(lower))) {
        ready++
      }
    }
    return { ready, total: hints.length }
  }

  const brollSummary = (() => {
    const stale = brollAssets.filter(a => brollStaleness(a.captured_at) === 'stale').length
    const old = brollAssets.filter(a => brollStaleness(a.captured_at) === 'old').length
    return { total: brollAssets.length, stale, old }
  })()

  const pendingJobCount = jobs.filter(j => ['pending', 'waiting', 'processing'].includes(j.heygen_status ?? '')).length
  const latestCompletedReviewJob = jobs.find(j => (j.heygen_status === 'completed' || Boolean(j.video_url)) && Boolean(j.video_url))

  /* ───────────── Decide: Selection helpers ───────────── */

  const toggleSelection = (id: string) => {
    setSelectedDraftIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedDraftIds(new Set(filteredDrafts.map(d => d.id)))
  const deselectAll = () => setSelectedDraftIds(new Set())

	  const exitSelectionMode = () => {
	    setSelectionMode(false)
	    setSelectedDraftIds(new Set())
	    setBatchRenderApprovalConfirmed(false)
	  }

  const changeDraftsPage = (p: number) => {
    setDraftsPage(p)
    setExpandedDraftId(null)
  }

  const getOutputTab = (draftId: string, scriptLen: number): 'heygen' | 'gamma' => {
    if (draftOutputTab[draftId]) return draftOutputTab[draftId]
    return scriptLen > HEYGEN_SCRIPT_MAX ? 'gamma' : 'heygen'
  }

  const autoMatchBroll = useCallback((draft: DraftItem): string[] => {
    const hints = draft.storyboard_json?.scenes?.map(s => s.brollHint).filter(Boolean) as string[] ?? []
    if (hints.length === 0 || brollAssets.length === 0) return []
    const matched: string[] = []
    for (const hint of hints) {
      const lower = hint.toLowerCase()
      const match = brollAssets.find(a =>
        a.filename.toLowerCase().includes(lower) ||
        (a.route_description ?? '').toLowerCase().includes(lower)
      )
      if (match && !matched.includes(match.id)) matched.push(match.id)
    }
    return matched
  }, [brollAssets])

  const getDraftBroll = useCallback((draft: DraftItem): string[] => {
    if (draftBroll[draft.id] !== undefined) return draftBroll[draft.id]
    return autoMatchBroll(draft)
  }, [draftBroll, autoMatchBroll])

  const workspaceItems = useMemo<ReviewWorkspaceItem[]>(() => {
    const readinessBySource = new Map(
      AGENTIC_VIDEO_RENDER_READINESS_PACKETS.map(packet => [packet.sourceAssetId, packet]),
    )
    const jobsByTarget = new Map<string, VideoJob[]>()
    for (const job of jobs) {
      if (!job.target_id) continue
      const current = jobsByTarget.get(job.target_id) ?? []
      current.push(job)
      jobsByTarget.set(job.target_id, current)
    }

    const packetItems = AGENTIC_VIDEO_REVIEW_PACKETS.map((packet): ReviewWorkspaceItem => {
      const readinessPacket = readinessBySource.get(packet.assetId)
      return {
        id: `packet:${packet.assetId}`,
        kind: 'script_packet',
        title: packet.title,
        channel: packet.channel,
        stage: 'Script review',
        nextAction: 'Approve render-readiness or send back with a note',
        statusLabel: 'Needs approval',
        statusTone: 'ready',
        priorityLabel: priorityLabel(packet.priority),
        sourcePacketPath: packet.packetPath,
        jobIds: [],
        brollAssetIds: [],
        scriptPacket: packet,
        readinessPacket,
        jobs: [],
      }
    })

    const draftItems = filteredDrafts.map((draft): ReviewWorkspaceItem => {
      const matchedJobs = [
        ...(jobsByTarget.get(draft.id) ?? []),
        ...jobs.filter(job => job.id === draft.video_generation_job_id),
      ].filter((job, index, all) => all.findIndex(candidate => candidate.id === job.id) === index)
      const report = renderReadinessDrafts[draft.id]
      const isBlocked = report ? !report.ready : false
      return {
        id: `draft:${draft.id}`,
        kind: 'draft',
        title: draft.title || 'Untitled draft',
        channel: draft.source === 'drive_script' ? 'Drive script' : channel,
        stage: report ? 'Render readiness' : 'Draft review',
        nextAction: report
          ? report.ready ? 'Approve internal render readiness' : 'Resolve render blockers'
          : 'Review script anatomy, B-roll, and readiness',
        statusLabel: report ? report.ready ? 'Ready' : 'Blocked' : 'Draft',
        statusTone: report ? report.ready ? 'ready' : 'blocked' : 'pending',
        priorityLabel: 'Normal priority',
        draftId: draft.id,
        jobIds: matchedJobs.map(job => job.id),
        brollAssetIds: getDraftBroll(draft),
        draft,
        jobs: matchedJobs,
      }
    })

    const draftJobIds = new Set(draftItems.flatMap(item => item.jobIds))
    const looseJobItems = jobs
      .filter(job => !draftJobIds.has(job.id))
      .map((job): ReviewWorkspaceItem => ({
        id: `job:${job.id}`,
        kind: 'job',
        title: job.drive_file_name ?? (job.script_text.slice(0, 64) || 'Video generation job'),
        channel: job.channel,
        stage: 'Generated review',
        nextAction: job.video_url ? 'Review the internal render' : 'Track generation status',
        statusLabel: job.video_url || job.heygen_status === 'completed' ? 'Ready' : job.heygen_status ?? 'Pending',
        statusTone: job.video_url || job.heygen_status === 'completed' ? 'done' : job.heygen_status === 'failed' ? 'blocked' : 'pending',
        priorityLabel: 'Normal priority',
        jobIds: [job.id],
        brollAssetIds: job.broll_asset_ids ?? [],
        jobs: [job],
      }))

    return [...packetItems, ...draftItems, ...looseJobItems]
  }, [channel, filteredDrafts, getDraftBroll, jobs, renderReadinessDrafts])

  const selectedWorkspaceItem = useMemo(() => {
    return workspaceItems.find(item => item.id === activeWorkspaceItemId) ?? workspaceItems[0] ?? null
  }, [activeWorkspaceItemId, workspaceItems])

  useEffect(() => {
    if (activeWorkspaceItemId && workspaceItems.some(item => item.id === activeWorkspaceItemId)) return
    const nextItem = workspaceItems.find(item => item.statusTone === 'ready')
      ?? workspaceItems.find(item => item.statusTone === 'blocked')
      ?? workspaceItems[0]
    setActiveWorkspaceItemId(nextItem?.id ?? null)
  }, [activeWorkspaceItemId, workspaceItems])

  useEffect(() => {
    if (!selectedWorkspaceItem?.sourcePacketPath || activeWorkspaceTab !== 'source') return
    const current = evidencePackets[selectedWorkspaceItem.sourcePacketPath]
    if (current?.loading || current?.content) return
    void fetchEvidencePacket(selectedWorkspaceItem.sourcePacketPath)
  }, [activeWorkspaceTab, evidencePackets, fetchEvidencePacket, selectedWorkspaceItem?.sourcePacketPath])

  const removeBrollFromDraft = (draftId: string, assetId: string) => {
    setDraftBroll(prev => {
      const current = prev[draftId] ?? autoMatchBroll(drafts.find(d => d.id === draftId)!)
      return { ...prev, [draftId]: current.filter(id => id !== assetId) }
    })
  }

  const addBrollToDraft = (draftId: string, assetId: string) => {
    setDraftBroll(prev => {
      const current = prev[draftId] ?? autoMatchBroll(drafts.find(d => d.id === draftId)!)
      if (current.includes(assetId)) return prev
      return { ...prev, [draftId]: [...current, assetId] }
    })
    setBrollDropdownDraft(null)
  }

  const selectedEligibleCount = Array.from(selectedDraftIds).filter(id => {
    const d = drafts.find(dr => dr.id === id)
    return d && d.script_text.length <= HEYGEN_SCRIPT_MAX
  }).length

  const selectedCount = selectedDraftIds.size

  /* ───────────── Meetings: Selection helpers ───────────── */

  const toggleMeetingSelection = (id: string) => {
    setSelectedMeetingIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const selectAllMeetings = () => setSelectedMeetingIds(new Set(meetingRecords.map(m => m.id)))
  const deselectAllMeetings = () => setSelectedMeetingIds(new Set())
  const totalMeetingPages = Math.max(1, Math.ceil(meetingsTotal / MEETINGS_PER_PAGE))

  /* ───────────── Review: Selection helpers ───────────── */

  const toggleJobSelection = (id: string) => {
    setSelectedJobIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const selectAllJobs = () => setSelectedJobIds(new Set(jobs.map(j => j.id)))
  const deselectAllJobs = () => setSelectedJobIds(new Set())
  const exitJobSelectionMode = () => { setJobSelectionMode(false); setSelectedJobIds(new Set()) }
  const totalJobPages = Math.max(1, Math.ceil(jobsTotal / JOBS_PER_PAGE))
  const changeJobsPage = (p: number) => { setJobsPage(p); setSelectedJobIds(new Set()); fetchJobs(undefined, p) }

  const selectedFailedJobIds = Array.from(selectedJobIds).filter(id => {
    const j = jobs.find(job => job.id === id)
    return j && j.heygen_status === 'failed'
  })
  const selectedRefreshableJobIds = Array.from(selectedJobIds).filter(id => {
    const j = jobs.find(job => job.id === id)
    return j && ['pending', 'waiting', 'processing'].includes(j.heygen_status ?? '')
  })

  /* ───────────── Review: Batch handlers ───────────── */

  const batchRefreshJobs = async () => {
    if (selectedRefreshableJobIds.length === 0) return
    setBatchRefreshing(true)
    try {
      const token = await getToken()
      if (!token) return
      await fetch('/api/admin/video-generation/jobs/batch-refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds: selectedRefreshableJobIds }),
      })
      await fetchJobs()
    } catch { /* ignore */ }
    finally { setBatchRefreshing(false) }
  }

  const batchDeleteJobs = async () => {
    if (selectedJobIds.size === 0) return
    if (!confirm(`Delete ${selectedJobIds.size} job(s)? This cannot be undone.`)) return
    setBatchDeleting(true)
    try {
      const token = await getToken()
      if (!token) return
      await fetch('/api/admin/video-generation/jobs/batch-delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds: Array.from(selectedJobIds) }),
      })
      setSelectedJobIds(new Set())
      await fetchJobs()
    } catch { /* ignore */ }
    finally { setBatchDeleting(false) }
  }

  const batchRetryJobs = async () => {
    if (selectedFailedJobIds.length === 0) return
    setBatchRetrying(true)
    try {
      const token = await getToken()
      if (!token) return
      await fetch('/api/admin/video-generation/jobs/batch-retry', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds: selectedFailedJobIds }),
      })
      setSelectedJobIds(new Set())
      await fetchJobs()
    } catch { /* ignore */ }
    finally { setBatchRetrying(false) }
  }

  /* ───────────── Decide: Batch handlers ───────────── */

  const batchGenerateVideos = async () => {
    const eligible = Array.from(selectedDraftIds)
      .map(id => drafts.find(d => d.id === id))
      .filter((d): d is DraftItem => !!d && d.script_text.length <= HEYGEN_SCRIPT_MAX)
    if (eligible.length === 0) return

    setBatchMessage(null)
    setGeneratingBatch(true)
    const steps: ProgressStep[] = [
      { id: 'queuing', label: `Queuing ${eligible.length} draft(s)`, status: 'active' },
      { id: 'sending', label: 'Sending to HeyGen', status: 'pending' },
    ]
    setBatchProgress(steps)
    try {
      const token = await getToken()
      if (!token) return
      setTimeout(() => setBatchProgress(prev => prev ? prev.map((s, i) => i === 0 ? { ...s, status: 'done' as const } : i === 1 ? { ...s, status: 'active' as const } : s) : null), 1000)
      const items = eligible.map(d => ({
        id: d.id,
        brollAssetIds: getDraftBroll(d),
      }))
      const res = await fetch('/api/admin/video-generation/ideas-queue/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
	        body: JSON.stringify({
	          items,
	          channel, aspectRatio, useTemplate,
	          templateId: useTemplate ? selectedTemplateId || undefined : undefined,
	          brandVoiceId: useTemplate ? selectedBrandVoiceId || undefined : undefined,
	          avatarId: !useTemplate ? selectedAvatarId || undefined : undefined,
	          renderApproval: buildVideoRenderApproval(batchRenderApprovalConfirmed),
	        }),
	      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setBatchMessage(data?.error || 'Batch failed')
        setBatchProgress(prev => prev ? prev.map(s => s.status === 'active' || s.status === 'pending' ? { ...s, status: 'error' as const } : s) : null)
        return
      }
      const started = data?.started ?? 0
      setBatchMessage(data?.message ?? `${started} video(s) started.`)
      setBatchProgress(prev => prev ? prev.map(s => s.id === 'sending'
        ? { ...s, status: 'done' as const, detail: `${started} video(s) started` }
        : { ...s, status: 'done' as const }
      ) : null)
	      setBatchRenderApprovalConfirmed(false)
	      exitSelectionMode()
      fetchDrafts()
      fetchJobs()
    } catch (err) {
      setBatchMessage(err instanceof Error ? err.message : 'Batch failed')
      setBatchProgress(prev => prev ? prev.map(s => s.status === 'active' || s.status === 'pending' ? { ...s, status: 'error' as const } : s) : null)
    } finally {
      setGeneratingBatch(false)
    }
  }

  const batchCreatePresentations = async () => {
    const selected = Array.from(selectedDraftIds)
      .map(id => drafts.find(d => d.id === id))
      .filter((d): d is DraftItem => !!d)
    if (selected.length === 0) return

    setGeneratingGamma(true)
    setBatchMessage(null)
    const steps: ProgressStep[] = [
      { id: 'sending', label: `Creating ${selected.length} presentation(s)`, status: 'active' },
    ]
    setBatchProgress(steps)
    try {
      const token = await getToken()
      if (!token) return
      let completed = 0
      for (const draft of selected) {
        try {
          const res = await fetch('/api/admin/gamma-reports/from-script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ scriptText: draft.script_text, title: draft.title || undefined }),
          })
          if (res.ok) completed++
        } catch { /* continue */ }
      }
      setBatchMessage(`${completed} of ${selected.length} presentation(s) created.`)
      setBatchProgress(prev => prev ? prev.map(s => ({ ...s, status: 'done' as const, detail: `${completed}/${selected.length} created` })) : null)
      exitSelectionMode()
    } catch (err) {
      setBatchMessage(err instanceof Error ? err.message : 'Batch failed')
      setBatchProgress(prev => prev ? prev.map(s => s.status === 'active' || s.status === 'pending' ? { ...s, status: 'error' as const } : s) : null)
    } finally {
      setGeneratingGamma(false)
    }
  }

  /* ───────────── Render ───────────── */

  const cardCls = 'bg-silicon-slate/50 rounded-xl border border-silicon-slate p-6'
  const btnPrimary = 'flex items-center gap-2 px-4 py-2 bg-radiant-gold/20 text-radiant-gold font-medium rounded-lg hover:bg-radiant-gold/30 disabled:opacity-50 disabled:cursor-not-allowed'
  const btnSmall = 'flex items-center gap-1 text-xs px-2 py-1 rounded disabled:opacity-50'
  const inputCls = 'w-full bg-background border border-silicon-slate rounded-lg px-3 py-2 text-foreground placeholder-gray-500 focus:ring-2 focus:ring-radiant-gold/50'
  const selectCls = inputCls + ' disabled:opacity-60'
  const selectedScriptTemplate = scriptTemplates.find(template => template.id === selectedScriptTemplateId) ?? null
  const workspaceTabs: Array<{ id: WorkspaceTab; label: string }> = [
    { id: 'script', label: 'Script' },
    { id: 'assets', label: 'B-roll & Assets' },
    { id: 'readiness', label: 'Render Readiness' },
    { id: 'generated', label: 'Generated Review' },
    { id: 'source', label: 'Source Packet' },
  ]
  const selectedBrollAssets = selectedWorkspaceItem
    ? brollAssets.filter(asset => selectedWorkspaceItem.brollAssetIds.includes(asset.id))
    : []
  const selectedEvidenceState = selectedWorkspaceItem?.sourcePacketPath
    ? evidencePackets[selectedWorkspaceItem.sourcePacketPath]
    : undefined

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-background text-foreground p-6">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Content Hub', href: '/admin/content' },
            { label: 'Video Generation', href: '/admin/content/video-generation' },
          ]}
        />

        <div className="max-w-6xl mx-auto mt-8">
          <h1 className="text-2xl font-bold text-radiant-gold mb-2 flex items-center gap-2">
            <Video className="w-7 h-7" />
            Video Generation
          </h1>

          <div className={cardCls + ' mb-6'}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-radiant-gold">Review workspace</div>
                <h2 className="mt-1 text-lg font-semibold text-foreground">Selected content item</h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-gray-400">
                  Queue first, item details second. Provider execution, rendering, upload, scheduling, and publishing stay gated.
                </p>
              </div>
              <span className="rounded-full border border-silicon-slate bg-background/50 px-3 py-1 text-xs text-gray-300">
                {workspaceItems.length} review item{workspaceItems.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(16rem,0.85fr)_minmax(0,1.45fr)]">
              <div className="flex h-full flex-col rounded-lg border border-silicon-slate bg-background/40">
                <div className="flex items-center justify-between border-b border-silicon-slate px-3 py-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-300">Review Queue</h3>
                  <span className="text-[10px] text-gray-500">Needs action first</span>
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-2">
                  {workspaceItems.length === 0 ? (
                    <div className="rounded-md border border-dashed border-silicon-slate p-4 text-xs text-gray-500">
                      No reviewable content is loaded yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {workspaceItems.map(item => {
                        const selected = selectedWorkspaceItem?.id === item.id
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setActiveWorkspaceItemId(item.id)
                              setActiveWorkspaceTab('script')
                            }}
                            className={`w-full rounded-lg border p-3 text-left transition-colors ${
                              selected
                                ? 'border-radiant-gold/60 bg-radiant-gold/10'
                                : 'border-silicon-slate bg-imperial-navy/35 hover:border-radiant-gold/35'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">{item.channel}</div>
                                <div className="mt-1 truncate text-sm font-semibold text-gray-100">{item.title}</div>
                              </div>
                              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusToneClass(item.statusTone)}`}>
                                {item.statusLabel}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                              <span>{item.stage}</span>
                              <span className="text-gray-600">/</span>
                              <span>{item.priorityLabel}</span>
                            </div>
                            <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-gray-500">{item.nextAction}</div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0 rounded-lg border border-silicon-slate bg-background/35">
                {selectedWorkspaceItem ? (
                  <>
                    <div className="border-b border-silicon-slate p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                            <span>{selectedWorkspaceItem.channel}</span>
                            <span>{selectedWorkspaceItem.priorityLabel}</span>
                            <span>{selectedWorkspaceItem.stage}</span>
                          </div>
                          <h3 className="mt-1 truncate text-lg font-semibold text-foreground">{selectedWorkspaceItem.title}</h3>
                          <p className="mt-1 text-xs text-gray-400">{selectedWorkspaceItem.nextAction}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusToneClass(selectedWorkspaceItem.statusTone)}`}>
                          {selectedWorkspaceItem.statusLabel}
                        </span>
                      </div>
                      <div className="mt-3 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                        No external provider action will run from these review tabs.
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {workspaceTabs.map(tab => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveWorkspaceTab(tab.id)}
                            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                              activeWorkspaceTab === tab.id
                                ? 'border-radiant-gold/60 bg-radiant-gold/15 text-radiant-gold'
                                : 'border-silicon-slate bg-background/50 text-gray-300 hover:border-radiant-gold/35'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-4">
                      {activeWorkspaceTab === 'script' && (
                        <div className="space-y-4">
                          {selectedWorkspaceItem.scriptPacket ? (
                            <>
                              <label className="block rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">Decision note for send-back</div>
                                <textarea
                                  value={scriptReviewDecisionNotes[selectedWorkspaceItem.scriptPacket.assetId] ?? ''}
                                  onChange={(event) => {
                                    const value = event.target.value
                                    setScriptReviewDecisionNotes((current) => ({
                                      ...current,
                                      [selectedWorkspaceItem.scriptPacket!.assetId]: value,
                                    }))
                                  }}
                                  rows={3}
                                  placeholder="What should Amina revise before this returns to human review?"
                                  className="mt-2 w-full rounded-md border border-silicon-slate bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-gray-500 focus:border-radiant-gold/50"
                                />
                              </label>
                              <AgenticContentReviewPacketCard
                                key={selectedWorkspaceItem.scriptPacket.assetId}
                                packet={selectedWorkspaceItem.scriptPacket}
                                nextGateHref="#production-tools"
                                nextGateLabel="Open production tools"
                                decisionNote={scriptReviewDecisionNotes[selectedWorkspaceItem.scriptPacket.assetId] ?? ''}
                              />
                            </>
                          ) : selectedWorkspaceItem.draft ? (
                            <div className="grid gap-3">
                              <div className="rounded-lg border border-silicon-slate bg-imperial-navy/40 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <h4 className="text-sm font-semibold text-foreground">Script anatomy</h4>
                                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${scoreTone(selectedWorkspaceItem.draft.script_scorecard?.overall_score)}`}>
                                    Score {selectedWorkspaceItem.draft.script_scorecard?.overall_score ?? 0}
                                  </span>
                                </div>
                                <div className="mt-3 grid gap-2 text-xs text-gray-300 md:grid-cols-2">
                                  <div><span className="text-gray-500">Pain:</span> {selectedWorkspaceItem.draft.script_outline?.pain_point || 'Not captured'}</div>
                                  <div><span className="text-gray-500">Hook:</span> {selectedWorkspaceItem.draft.script_outline?.hook || 'Not captured'}</div>
                                  <div><span className="text-gray-500">Loop:</span> {selectedWorkspaceItem.draft.script_outline?.open_loop || 'Not captured'}</div>
                                  <div><span className="text-gray-500">CTA:</span> {selectedWorkspaceItem.draft.script_outline?.cta || 'Not captured'}</div>
                                </div>
                              </div>
                              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-silicon-slate bg-background/60 p-3 text-xs leading-5 text-gray-300">
                                {selectedWorkspaceItem.draft.script_text}
                              </pre>
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedDraftId(selectedWorkspaceItem.draftId ?? null)
                                  scrollTo(decideRef)
                                }}
                                className="inline-flex w-fit items-center gap-2 rounded-md border border-silicon-slate bg-background/50 px-3 py-2 text-xs font-medium text-gray-200 hover:border-radiant-gold/40 hover:text-radiant-gold"
                              >
                                <PenLine className="h-3.5 w-3.5" />
                                Open draft controls
                              </button>
                            </div>
                          ) : (
                            <div className="rounded-lg border border-silicon-slate bg-background/50 p-4 text-xs text-gray-400">
                              This item has no editable script packet.
                            </div>
                          )}
                        </div>
                      )}

                      {activeWorkspaceTab === 'assets' && (
                        <div className="space-y-4">
                          {selectedWorkspaceItem.draft?.storyboard_json?.scenes?.length ? (
                            <div className="rounded-lg border border-silicon-slate bg-imperial-navy/35 p-3">
                              <h4 className="text-sm font-semibold text-foreground">Storyboard B-roll hints</h4>
                              <div className="mt-3 grid gap-2">
                                {selectedWorkspaceItem.draft.storyboard_json.scenes.map((scene, index) => (
                                  <div key={`${scene.sceneNumber ?? index}-${scene.brollHint ?? 'hint'}`} className="rounded-md border border-silicon-slate bg-background/45 p-2 text-xs text-gray-300">
                                    <span className="font-medium text-gray-100">Scene {scene.sceneNumber ?? index + 1}:</span> {scene.brollHint || scene.description || 'No B-roll hint'}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="rounded-lg border border-silicon-slate bg-imperial-navy/35 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-sm font-semibold text-foreground">Matched assets</h4>
                              <span className="text-[10px] text-gray-500">{selectedBrollAssets.length} linked to this item</span>
                            </div>
                            {selectedBrollAssets.length === 0 ? (
                              <p className="mt-3 rounded-md border border-dashed border-silicon-slate p-3 text-xs text-gray-500">
                                No B-roll assets are linked to this item yet.
                              </p>
                            ) : (
                              <div className="mt-3 grid gap-2 md:grid-cols-2">
                                {selectedBrollAssets.map(asset => (
                                  <div key={asset.id} className="rounded-md border border-silicon-slate bg-background/45 p-3 text-xs text-gray-300">
                                    <div className="font-medium text-gray-100">{asset.route_description || asset.route}</div>
                                    <div className="mt-1 text-[10px] text-gray-500">{asset.filename} · {safeDateLabel(asset.captured_at)}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <details className="rounded-lg border border-silicon-slate bg-background/40">
                            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-gray-300 hover:text-radiant-gold">
                              Manage global B-roll library
                            </summary>
                            <div className="border-t border-silicon-slate p-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setBrollExpanded(true)
                                  scrollTo(planRef)
                                }}
                                className="inline-flex items-center gap-2 rounded-md border border-silicon-slate bg-background/50 px-3 py-2 text-xs font-medium text-gray-200 hover:border-radiant-gold/40 hover:text-radiant-gold"
                              >
                                <Camera className="h-3.5 w-3.5" />
                                Open library controls
                              </button>
                            </div>
                          </details>
                        </div>
                      )}

                      {activeWorkspaceTab === 'readiness' && (
                        <div className="space-y-4">
                          {selectedWorkspaceItem.readinessPacket ? (
                            <div className="rounded-lg border border-silicon-slate bg-imperial-navy/35 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-sm font-semibold text-foreground">Render-readiness packet</h4>
                                <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                                  {selectedWorkspaceItem.readinessPacket.approvalStatus}
                                </span>
                              </div>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <div>
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Required checks</div>
                                  <ul className="mt-2 space-y-1 text-xs text-gray-300">
                                    {selectedWorkspaceItem.readinessPacket.requiredChecks.map(check => <li key={check}>- {check}</li>)}
                                  </ul>
                                </div>
                                <div>
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Hard blocks</div>
                                  <ul className="mt-2 space-y-1 text-xs text-gray-300">
                                    {selectedWorkspaceItem.readinessPacket.hardBlocks.map(block => <li key={block}>- {block}</li>)}
                                  </ul>
                                </div>
                              </div>
                              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                <a href={buildAgenticVideoRenderReadinessActionHref(selectedWorkspaceItem.readinessPacket, 'prepare_preflight')} className="rounded-md border border-emerald-500/35 bg-emerald-500/10 p-2 text-xs font-medium text-emerald-100 hover:border-emerald-400">
                                  Prepare preflight
                                </a>
                                <a href={buildAgenticVideoRenderReadinessActionHref(selectedWorkspaceItem.readinessPacket, 'send_back_to_script_repair')} className="rounded-md border border-amber-500/35 bg-amber-500/10 p-2 text-xs font-medium text-amber-100 hover:border-amber-400">
                                  Send back
                                </a>
                                <a href={buildAgenticVideoRenderReadinessActionHref(selectedWorkspaceItem.readinessPacket, 'hold_provider_work')} className="rounded-md border border-rose-500/35 bg-rose-500/10 p-2 text-xs font-medium text-rose-100 hover:border-rose-400">
                                  Hold provider work
                                </a>
                              </div>
                            </div>
                          ) : null}

                          {selectedWorkspaceItem.draft ? (
                            <div className="rounded-lg border border-silicon-slate bg-imperial-navy/35 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-sm font-semibold text-foreground">Draft readiness</h4>
                                <button
                                  type="button"
                                  onClick={() => checkRenderReadiness(selectedWorkspaceItem.draft!.id)}
                                  disabled={checkingReadinessDraftId === selectedWorkspaceItem.draft.id}
                                  className="inline-flex items-center gap-2 rounded-md border border-silicon-slate bg-background/50 px-3 py-2 text-xs font-medium text-gray-200 hover:border-radiant-gold/40 hover:text-radiant-gold disabled:opacity-50"
                                >
                                  {checkingReadinessDraftId === selectedWorkspaceItem.draft.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckSquare className="h-3.5 w-3.5" />}
                                  Check readiness
                                </button>
                              </div>
                              {renderReadinessDrafts[selectedWorkspaceItem.draft.id] ? (
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  <div className="rounded-md border border-silicon-slate bg-background/45 p-3">
                                    <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">Blockers</div>
                                    <ul className="mt-2 space-y-1 text-xs text-gray-300">
                                      {renderReadinessDrafts[selectedWorkspaceItem.draft.id].blockingIssues.length
                                        ? renderReadinessDrafts[selectedWorkspaceItem.draft.id].blockingIssues.map(issue => <li key={issue}>- {issue}</li>)
                                        : <li>No blocking issues.</li>}
                                    </ul>
                                  </div>
                                  <div className="rounded-md border border-silicon-slate bg-background/45 p-3">
                                    <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">Warnings</div>
                                    <ul className="mt-2 space-y-1 text-xs text-gray-300">
                                      {renderReadinessDrafts[selectedWorkspaceItem.draft.id].warnings.length
                                        ? renderReadinessDrafts[selectedWorkspaceItem.draft.id].warnings.map(warning => <li key={warning}>- {warning}</li>)
                                        : <li>No warnings.</li>}
                                    </ul>
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-3 text-xs text-gray-500">Run the readiness check before internal render approval.</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {activeWorkspaceTab === 'generated' && (
                        <div className="space-y-3">
                          {selectedWorkspaceItem.jobs.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-silicon-slate p-4 text-xs text-gray-500">
                              No render jobs are linked to this item yet.
                            </div>
                          ) : (
                            selectedWorkspaceItem.jobs.map(job => (
                              <div key={job.id} className="rounded-lg border border-silicon-slate bg-imperial-navy/35 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <div className="text-sm font-semibold text-foreground">{job.drive_file_name ?? 'Generated video job'}</div>
                                    <div className="mt-1 text-[10px] text-gray-500">{job.channel} · {job.aspect_ratio} · {safeDateLabel(job.created_at)}</div>
                                  </div>
                                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusToneClass(job.video_url || job.heygen_status === 'completed' ? 'done' : job.heygen_status === 'failed' ? 'blocked' : 'pending')}`}>
                                    {job.video_url || job.heygen_status === 'completed' ? 'Ready' : job.heygen_status ?? 'Pending'}
                                  </span>
                                </div>
                                {job.video_url ? (
                                  <div className="mt-3">
                                    <video src={job.video_url} controls className="max-h-80 w-full rounded-md border border-silicon-slate bg-black" />
                                  </div>
                                ) : job.error_message ? (
                                  <p className="mt-3 text-xs text-rose-300">{job.error_message}</p>
                                ) : (
                                  <p className="mt-3 text-xs text-gray-500">No internal render is ready yet.</p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {activeWorkspaceTab === 'source' && (
                        <div className="space-y-3">
                          {selectedWorkspaceItem.sourcePacketPath ? (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground">Evidence packet</h4>
                                  <p className="mt-1 text-xs text-gray-500">{selectedWorkspaceItem.sourcePacketPath}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => fetchEvidencePacket(selectedWorkspaceItem.sourcePacketPath!)}
                                    disabled={selectedEvidenceState?.loading}
                                    className="inline-flex items-center gap-2 rounded-md border border-silicon-slate bg-background/50 px-3 py-2 text-xs font-medium text-gray-200 hover:border-radiant-gold/40 hover:text-radiant-gold disabled:opacity-50"
                                  >
                                    {selectedEvidenceState?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                    Reload
                                  </button>
                                  <a
                                    href={sourcePacketUrl(selectedWorkspaceItem.sourcePacketPath)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 rounded-md border border-silicon-slate bg-background/50 px-3 py-2 text-xs font-medium text-gray-200 hover:border-radiant-gold/40 hover:text-radiant-gold"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    GitHub
                                  </a>
                                </div>
                              </div>
                              {selectedEvidenceState?.error ? (
                                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                                  {selectedEvidenceState.error}
                                </div>
                              ) : selectedEvidenceState?.content ? (
                                <pre className="max-h-[30rem] overflow-auto whitespace-pre-wrap rounded-lg border border-silicon-slate bg-background/70 p-4 text-xs leading-5 text-gray-300">
                                  {selectedEvidenceState.content}
                                </pre>
                              ) : (
                                <div className="rounded-lg border border-dashed border-silicon-slate p-4 text-xs text-gray-500">
                                  {selectedEvidenceState?.loading ? 'Loading evidence packet...' : 'Open this tab to load the evidence packet inline.'}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="rounded-lg border border-dashed border-silicon-slate p-4 text-xs text-gray-500">
                              No source packet is linked to this item.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-sm text-gray-500">No content item selected.</div>
                )}
              </div>
            </div>
          </div>

          <details
            id="production-tools"
            open={productionToolsOpen}
            onToggle={(event) => setProductionToolsOpen(event.currentTarget.open)}
            className="mb-6 rounded-xl border border-silicon-slate bg-silicon-slate/35"
          >
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-gray-200 hover:text-radiant-gold">
              <Settings className="h-4 w-4" />
              Production Tools
              <span className="ml-2 text-xs font-normal text-gray-500">Draft creation, Drive import, HeyGen settings, global B-roll library, and job tables</span>
            </summary>
            <div className="border-t border-silicon-slate p-4">

          {/* Pipeline sync controls (same toolbar pattern as Value Evidence: full run + pills only) */}
          <div className="flex items-center gap-3 flex-wrap mb-6">
            {eitherRunning ? (
              <button
                type="button"
                onClick={handleCancelAll}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 transition-colors"
              >
                <Square className="w-4 h-4" />
                Cancel Pipeline
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSyncAll}
                disabled={triggerAllLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg text-sm font-medium hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 transition-all"
              >
                {triggerAllLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Run Full Pipeline
              </button>
            )}
            <ExtractionStatusChip
              label="HeyGen"
              pipelinePhase={{ current: 1, total: 2 }}
              state={heygenWorkflow.state}
              currentRun={heygenWorkflow.currentRun}
              recentRuns={heygenWorkflow.recentRuns}
              elapsedMs={heygenWorkflow.elapsedMs}
              isDrawerOpen={heygenWorkflow.isDrawerOpen}
              isHistoryOpen={heygenWorkflow.isHistoryOpen}
              toggleDrawer={heygenWorkflow.toggleDrawer}
              toggleHistory={heygenWorkflow.toggleHistory}
              markRunFailed={heygenWorkflow.markRunFailed}
              onRetry={triggerHeyGenSync}
            />
            <ExtractionStatusChip
              label="Drive"
              pipelinePhase={{ current: 2, total: 2 }}
              state={driveWorkflow.state}
              currentRun={driveWorkflow.currentRun}
              recentRuns={driveWorkflow.recentRuns}
              elapsedMs={driveWorkflow.elapsedMs}
              isDrawerOpen={driveWorkflow.isDrawerOpen}
              isHistoryOpen={driveWorkflow.isHistoryOpen}
              toggleDrawer={driveWorkflow.toggleDrawer}
              toggleHistory={driveWorkflow.toggleHistory}
              markRunFailed={driveWorkflow.markRunFailed}
              onRetry={() => syncDrive(false)}
              drawerFooterAction={{
                label: 'Force resync all (re-scan entire folder)',
                onClick: () => { void syncDrive(true) },
                disabled: driveWorkflow.state === 'running' || driveWorkflow.state === 'stale',
              }}
            />
          </div>

          {/* ═══════════ HEYGEN CONFIG ═══════════ */}
          <details className="group mb-4 rounded-lg border border-silicon-slate bg-background/60">
            <summary className="flex items-center gap-2 cursor-pointer px-4 py-2.5 text-xs text-gray-400 hover:text-foreground select-none">
              <Settings className="w-3.5 h-3.5" />
              <span className="font-medium">HeyGen Configuration</span>
              {configDefaults.avatarId && (
                <span className="text-[10px] text-gray-300 ml-1">
                  Avatar: {configAvatars.find(a => a.asset_id === configDefaults.avatarId)?.asset_name ?? 'Unknown'}
                </span>
              )}
              {configDefaults.voiceId && (
                <span className="text-[10px] text-gray-300 ml-1">
                  · Voice: {configVoices.find(v => v.asset_id === configDefaults.voiceId)?.asset_name ?? 'Unknown'}
                </span>
              )}
              {!configDefaults.avatarId && !configDefaults.voiceId && <span className="text-[10px] text-amber-400/70 ml-1">No defaults set — open the HeyGen pill above and run sync, then pick below</span>}
              <ChevronDown className="w-3 h-3 ml-auto group-open:rotate-180 transition-transform" />
            </summary>
            <div className="px-4 pb-4 pt-2 space-y-3">
              {configLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}

              {/* Avatar picker (includes inline Add by ID) */}
              {configAvatars.length > 0 && (
                <AssetPicker
                  label="Avatar"
                  items={configAvatars}
                  selectedId={configDefaults.avatarId}
                  onSelect={(id) => setHeyGenDefault('avatar', id)}
                  onToggleFavorite={(id, fav) => toggleFavoriteAsset('avatar', id, fav)}
                  onAddManual={async (id, name) => { await addManualAsset('avatar', id, name) }}
                  onSetDefault={(id) => setHeyGenDefault('avatar', id)}
                  onResolveName={(id) => resolveHeyGenName('avatar', id)}
                />
              )}

              {/* Voice picker */}
              {configVoices.length > 0 && (
                <AssetPicker
                  label="Voice"
                  items={configVoices}
                  selectedId={configDefaults.voiceId}
                  onSelect={(id) => setHeyGenDefault('voice', id)}
                  onToggleFavorite={(id, fav) => toggleFavoriteAsset('voice', id, fav)}
                  onSetDefault={(id) => setHeyGenDefault('voice', id)}
                />
              )}

              {configAvatars.length === 0 && configVoices.length === 0 && !configLoading && (
                <p className="text-[10px] text-gray-500">No avatars or voices yet. Open the <span className="text-amber-400/90">HeyGen</span> status pill above and tap Run.</p>
              )}
            </div>
          </details>

          {/* ═══════════ STICKY PHASE NAV ═══════════ */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-silicon-slate -mx-6 px-6 py-2 mb-6">
            <div className="max-w-6xl mx-auto flex items-center gap-1">
              {([
                { id: 'plan' as const, ref: planRef, label: 'Plan', count: `${driveItems.length > 0 ? driveItems.length + ' Drive · ' : ''}${drafts.length > 0 ? '' : '0 drafts'}${drafts.length > 0 ? '' : ''}`.trim() || undefined },
                { id: 'decide' as const, ref: decideRef, label: 'Decide', count: `${filteredDrafts.length} draft${filteredDrafts.length !== 1 ? 's' : ''}` },
                { id: 'review' as const, ref: reviewRef, label: 'Review', count: `${jobsTotal} job${jobsTotal !== 1 ? 's' : ''}${pendingJobCount > 0 ? ` · ${pendingJobCount} processing` : ''}` },
              ]).map(({ id, ref, label, count }, i) => (
                <button
                  key={id}
                  onClick={() => scrollTo(ref)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeSection === id
                      ? 'bg-radiant-gold/15 text-radiant-gold'
                      : 'text-gray-400 hover:text-foreground hover:bg-silicon-slate/30'
                  }`}
                >
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-radiant-gold/20 text-radiant-gold text-[10px] font-bold">{i + 1}</span>
                  {label}
                  {count && <span className="text-[10px] text-gray-500 font-normal">{count}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* ═══════════ PHASE 1: PLAN ═══════════ */}
          <div ref={planRef} className="mb-10 scroll-mt-16">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-radiant-gold/20 text-radiant-gold text-xs font-bold">1</span>
              Plan
            </h2>
            <p className="text-xs text-gray-400 mb-4 -mt-2">Choose a starting point for new video drafts. All paths create entries in the Decide queue below.</p>
            <div className="mb-4 rounded-lg border border-radiant-gold/30 bg-radiant-gold/5 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-radiant-gold">
                    <FileText className="h-3.5 w-3.5" />
                    Script intelligence
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-foreground">Choose the script outline before generation</h3>
                  <p className="mt-1 text-xs leading-5 text-gray-400">
                    Templates guide pain point, hook, open loop, proof, CTA, and closing question. They do not call HeyGen, ElevenLabs, render, upload, schedule, or publish.
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium text-emerald-300">
                  Provider gates locked
                </span>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <label className="block text-xs text-gray-400">
                  Script template
                  <select
                    value={selectedScriptTemplateId}
                    onChange={e => setSelectedScriptTemplateId(e.target.value)}
                    disabled={scriptTemplatesLoading || scriptTemplates.length === 0}
                    className={selectCls + ' mt-1 text-sm'}
                  >
                    {scriptTemplatesLoading ? <option>Loading templates...</option> : null}
                    {scriptTemplates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.source_type.replace(/_/g, ' ')})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-gray-400">
                  Script intent
                  <input
                    value={scriptIntent}
                    onChange={e => setScriptIntent(e.target.value)}
                    placeholder="Example: make Module 0 feel urgent, show the pain, and point to the workshop interest path."
                    className={inputCls + ' mt-1 text-sm'}
                  />
                </label>
              </div>
              {selectedScriptTemplate ? (
                <div className="mt-3 grid gap-2 text-[10px] text-gray-400 md:grid-cols-3">
                  <div className="rounded-md border border-silicon-slate/70 bg-background/60 p-2">
                    <span className="text-gray-500">Pain</span>
                    <p className="mt-1 line-clamp-2 text-gray-300">{selectedScriptTemplate.outline?.pain_point || selectedScriptTemplate.description}</p>
                  </div>
                  <div className="rounded-md border border-silicon-slate/70 bg-background/60 p-2">
                    <span className="text-gray-500">Hook / loop</span>
                    <p className="mt-1 line-clamp-2 text-gray-300">{selectedScriptTemplate.outline?.hook || selectedScriptTemplate.outline?.open_loop || 'Template hook pending.'}</p>
                  </div>
                  <div className="rounded-md border border-silicon-slate/70 bg-background/60 p-2">
                    <span className="text-gray-500">CTA</span>
                    <p className="mt-1 line-clamp-2 text-gray-300">{selectedScriptTemplate.outline?.cta || 'CTA required before render.'}</p>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">

              {/* Tabbed card: From Meetings / From Input (spans 2 cols) */}
              <div className={cardCls + ' lg:col-span-2'}>
                {/* Tab bar */}
                <div className="flex items-center gap-0.5 border-b border-silicon-slate mb-4 -mt-1">
                  <button
                    onClick={() => setPlanTab('meetings')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                      planTab === 'meetings' ? 'border-radiant-gold text-radiant-gold' : 'border-transparent text-gray-400 hover:text-foreground'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" /> From Meetings
                  </button>
                  <button
                    onClick={() => setPlanTab('input')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                      planTab === 'input' ? 'border-radiant-gold text-radiant-gold' : 'border-transparent text-gray-400 hover:text-foreground'
                    }`}
                  >
                    <PenLine className="w-3.5 h-3.5" /> From Input
                  </button>
                </div>

                {/* From Meetings tab */}
                {planTab === 'meetings' && (
                  <div className="space-y-3">
                    {/* Filters row: client context + search + date range */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Client context picker */}
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Client context</label>
                        {selectedContact && !manualEmailMode ? (
                          <div className="flex items-center gap-2 px-2 py-1.5 bg-background border border-radiant-gold/30 rounded-lg">
                            <User className="w-3.5 h-3.5 text-radiant-gold shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs text-foreground truncate">{selectedContact.name || selectedContact.email}</span>
                              {selectedContact.company && <span className="text-[10px] text-gray-500 ml-1">· {selectedContact.company}</span>}
                            </div>
                            <button onClick={clearContactSelection} className="shrink-0 text-gray-400 hover:text-rose-400 p-0.5"><X className="w-3 h-3" /></button>
                          </div>
                        ) : manualEmailMode ? (
                          <div className="flex items-center gap-1">
                            <input type="email" value={manualEmail} onChange={e => setManualEmail(e.target.value)} placeholder="client@example.com" className={inputCls + ' text-xs flex-1'} autoFocus />
                            <button onClick={clearContactSelection} className="text-[10px] text-gray-400 hover:text-foreground shrink-0">Cancel</button>
                          </div>
                        ) : (
                          <div ref={contactDropdownRef} className="relative">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                              <input type="text" value={contactSearch} onChange={e => { setContactSearch(e.target.value); setContactDropdownOpen(true) }} onFocus={() => setContactDropdownOpen(true)} placeholder="Search client..." className={inputCls + ' text-xs pl-7'} />
                            </div>
                            {contactDropdownOpen && (
                              <div className="absolute top-full left-0 right-0 mt-1 z-20 max-h-48 overflow-y-auto bg-background border border-silicon-slate rounded-lg shadow-xl">
                                {contacts.length === 0 && contactSearch ? (
                                  <div className="px-3 py-2 text-[10px] text-gray-500">No matches.</div>
                                ) : contacts.map(c => (
                                  <button key={c.email} onClick={() => { setSelectedContact(c); setContactDropdownOpen(false); setContactSearch('') }} className="w-full text-left px-2.5 py-1.5 hover:bg-silicon-slate/50 flex items-center gap-2 border-b border-silicon-slate/30 last:border-0">
                                    <User className="w-3 h-3 text-gray-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[11px] text-foreground truncate">{c.name || c.email}{c.company && <span className="text-gray-400 ml-1">· {c.company}</span>}</div>
                                    </div>
                                    <span className={`shrink-0 text-[9px] px-1 py-0.5 rounded font-medium ${c.source === 'client' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>{c.source === 'client' ? 'Client' : 'Lead'}</span>
                                  </button>
                                ))}
                                <button onClick={() => { setManualEmailMode(true); setContactDropdownOpen(false); setContactSearch('') }} className="w-full text-left px-2.5 py-1.5 hover:bg-silicon-slate/50 flex items-center gap-2 text-[10px] text-gray-400 border-t border-silicon-slate">
                                  <PenLine className="w-3 h-3" /> Enter email manually...
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Text search */}
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Search meetings</label>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                          <input type="text" value={meetingSearch} onChange={e => setMeetingSearch(e.target.value)} placeholder="Type, transcript, topic..." className={inputCls + ' text-xs pl-7'} />
                        </div>
                      </div>
                    </div>
                    {/* Date range */}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-gray-500 shrink-0" />
                      <input type="date" value={meetingDateFrom} onChange={e => setMeetingDateFrom(e.target.value)} className={inputCls + ' text-xs w-32'} />
                      <span className="text-[10px] text-gray-500">to</span>
                      <input type="date" value={meetingDateTo} onChange={e => setMeetingDateTo(e.target.value)} className={inputCls + ' text-xs w-32'} />
                      {(meetingDateFrom || meetingDateTo) && (
                        <button onClick={() => { setMeetingDateFrom(''); setMeetingDateTo('') }} className="text-[10px] text-gray-400 hover:text-foreground">Clear</button>
                      )}
                    </div>

                    {/* Meeting records list */}
                    {meetingsLoading ? (
                      <div className="flex items-center gap-2 text-xs text-gray-400 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading meetings...</div>
                    ) : meetingRecords.length === 0 ? (
                      <div className="text-center py-4 text-xs text-gray-500">No meetings found.{(meetingSearch || effectiveEmail || meetingDateFrom) && ' Try adjusting your filters.'}</div>
                    ) : (
                      <>
                        {/* Selection bar */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setMeetingSelectionMode(v => !v); if (meetingSelectionMode) deselectAllMeetings() }} className={`text-[10px] px-2 py-1 rounded border ${meetingSelectionMode ? 'border-radiant-gold/40 text-radiant-gold bg-radiant-gold/10' : 'border-silicon-slate text-gray-400 hover:text-foreground'}`}>
                              {meetingSelectionMode ? 'Cancel' : 'Select'}
                            </button>
                            {meetingSelectionMode && (
                              <>
                                <button onClick={selectAllMeetings} className="text-[10px] text-radiant-gold hover:text-gold-light">All</button>
                                <button onClick={deselectAllMeetings} className="text-[10px] text-gray-400 hover:text-foreground">None</button>
                                {selectedMeetingIds.size > 0 && <span className="text-[10px] text-gray-400">{selectedMeetingIds.size} selected</span>}
                              </>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-500">{meetingsTotal} meeting{meetingsTotal !== 1 ? 's' : ''}</span>
                        </div>
                        {/* Rows */}
                        <div className="space-y-1">
                          {meetingRecords.map(m => (
                            <button
                              key={m.id}
                              onClick={() => meetingSelectionMode ? toggleMeetingSelection(m.id) : toggleMeetingSelection(m.id)}
                              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                                selectedMeetingIds.has(m.id) ? 'border-radiant-gold/40 bg-radiant-gold/5' : 'border-silicon-slate/50 bg-silicon-slate/20 hover:bg-silicon-slate/40'
                              }`}
                            >
                              {meetingSelectionMode && (
                                selectedMeetingIds.has(m.id) ? <CheckSquare className="w-3.5 h-3.5 text-radiant-gold shrink-0" /> : <Square className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {m.meeting_type && <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded font-medium">{m.meeting_type}</span>}
                                  {m.meeting_date && <span className="text-[10px] text-gray-500">{new Date(m.meeting_date).toLocaleDateString()}</span>}
                                  {m.duration_minutes && <span className="text-[10px] text-gray-500">{m.duration_minutes}m</span>}
                                  {m.client_name && <span className="text-[10px] text-gray-400">{m.client_name}{m.client_company ? ` · ${m.client_company}` : ''}</span>}
                                </div>
                                {m.summary && <div className="text-[11px] text-gray-400 mt-0.5 truncate">{m.summary}</div>}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {m.has_transcript && <span className="text-[9px] px-1 py-0.5 bg-emerald-500/15 text-emerald-400 rounded">Transcript</span>}
                                {m.key_decisions_count > 0 && <span className="text-[9px] px-1 py-0.5 bg-blue-500/15 text-blue-400 rounded">{m.key_decisions_count} decisions</span>}
                              </div>
                            </button>
                          ))}
                        </div>
                        {/* Pagination */}
                        {totalMeetingPages > 1 && (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-gray-500">Page {meetingsPage} of {totalMeetingPages}</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setMeetingsPage(p => Math.max(1, p - 1))} disabled={meetingsPage === 1} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-background border border-silicon-slate text-gray-300 hover:border-radiant-gold/30 disabled:opacity-40 disabled:cursor-not-allowed">
                                <ChevronLeft className="w-3 h-3" /> Prev
                              </button>
                              <button onClick={() => setMeetingsPage(p => Math.min(totalMeetingPages, p + 1))} disabled={meetingsPage === totalMeetingPages} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-background border border-silicon-slate text-gray-300 hover:border-radiant-gold/30 disabled:opacity-40 disabled:cursor-not-allowed">
                                Next <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Generate controls */}
                    <div className="flex items-center gap-2 pt-1 border-t border-silicon-slate/50">
                      <label className="text-xs text-gray-400">Drafts</label>
                      <select value={scratchLimit} onChange={e => setScratchLimit(Number(e.target.value))} className="bg-background border border-silicon-slate rounded-lg px-2 py-1 text-foreground text-xs">
                        {[1, 2, 3, 5, 7, 10].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <button onClick={runFromScratch} disabled={scratchRunning || directionRunning} className={btnPrimary + ' flex-1 justify-center text-xs'}>
                        {scratchRunning ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating...</> : <><Lightbulb className="w-3.5 h-3.5" />Generate Drafts{selectedMeetingIds.size > 0 ? ` (${selectedMeetingIds.size} meetings)` : ''}</>}
                      </button>
                    </div>
                    {lastRunScratch && !scratchRunning && (
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <Clock className="w-3 h-3" /> Last run: {lastRunLabel(lastRunScratch)}
                      </div>
                    )}
                    {scratchProgress && (
                      <ProgressPanel
                        title="Generating Drafts"
                        steps={scratchProgress}
                        error={scratchProgressError}
                        onCancel={() => { scratchAbortRef.current?.abort(); setScratchRunning(false); setScratchProgress(null); setScratchProgressError(null) }}
                      />
                    )}
                  </div>
                )}

                {/* From Input tab */}
                {planTab === 'input' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-400">Bring your script, topic, or rough notes. AI polishes and adds a storyboard.</p>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Script, topic, or notes</label>
                      <textarea value={directionText} onChange={e => setDirectionText(e.target.value)} placeholder="Paste a script, describe a topic, or drop rough notes..." rows={4} maxLength={5000} className={inputCls + ' text-sm'} />
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-gray-500">{directionText.length.toLocaleString()} / 5,000</span>
                        <button type="button" onClick={() => setShowDirectionDetails(v => !v)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-foreground">
                          {showDirectionDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {showDirectionDetails ? 'Hide details' : 'Add details'}
                        </button>
                      </div>
                    </div>
                    {showDirectionDetails && (
                      <div className="grid grid-cols-1 gap-2">
                        <input type="text" value={promptAudience} onChange={e => setPromptAudience(e.target.value)} placeholder="Target audience" className={inputCls + ' text-xs'} />
                        <input type="text" value={promptTone} onChange={e => setPromptTone(e.target.value)} placeholder="Tone / style" className={inputCls + ' text-xs'} />
                        <input type="text" value={promptAngle} onChange={e => setPromptAngle(e.target.value)} placeholder="Angle / hook" className={inputCls + ' text-xs'} />
                      </div>
                    )}
                    {directionText.trim() && (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={handleMagicFormat} disabled={formattingPrompt} className="flex items-center gap-1 px-2 py-1 bg-purple-600/20 text-purple-300 text-xs rounded-lg hover:bg-purple-600/30 disabled:opacity-50">
                          {formattingPrompt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          Magic Format
                        </button>
                        <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
                          <input type="checkbox" checked={polishWithLLM} onChange={e => setPolishWithLLM(e.target.checked)} className="rounded border-silicon-slate" />
                          <Sparkles className="w-3 h-3" /> Polish with AI
                        </label>
                      </div>
                    )}
                    {formattedPrompt && (
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">Formatted prompt (editable)</label>
                        <textarea value={formattedPrompt} onChange={e => setFormattedPrompt(e.target.value)} rows={3} className="w-full bg-background border border-purple-500/30 rounded-lg px-3 py-2 text-foreground text-xs focus:ring-2 focus:ring-purple-500/50" />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-400">Drafts</label>
                      <select value={directionLimit} onChange={e => setDirectionLimit(Number(e.target.value))} className="bg-background border border-silicon-slate rounded-lg px-2 py-1 text-foreground text-xs">
                        {[1, 2, 3, 5].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <button onClick={runFromDirection} disabled={directionRunning || scratchRunning || (!directionText.trim() && !formattedPrompt.trim())} className={btnPrimary + ' w-full justify-center text-sm'}>
                      {directionRunning ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : <><PenLine className="w-4 h-4" />Create Drafts</>}
                    </button>
                    {lastRunDirection && !directionRunning && (
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <Clock className="w-3 h-3" /> Last run: {lastRunLabel(lastRunDirection)}
                      </div>
                    )}
                    {directionProgress && (
                      <ProgressPanel
                        title="Creating Drafts"
                        steps={directionProgress}
                        error={directionProgressError}
                        onCancel={() => { directionAbortRef.current?.abort(); setDirectionRunning(false); setDirectionProgress(null); setDirectionProgressError(null) }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* From Drive sidebar */}
              <div className={cardCls + ' flex min-h-0 flex-col'}>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                  <FolderSync className="w-4 h-4 text-radiant-gold" />
                  From Drive
                </h3>
                {driveLoading ? (
                  <div className="text-xs text-gray-400">Loading...</div>
                ) : driveItems.length === 0 ? (
                  <p className="text-xs text-gray-500">No pending Drive files. Open the Drive pill above and run sync to check for scripts.</p>
                ) : (
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                    {driveItems.map(item => (
                      <div key={item.id} className="p-2 bg-background/50 rounded-lg border border-silicon-slate">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-foreground truncate flex-1">{item.drive_file_name}</span>
                          <button onClick={() => addToDrafts(item.id)} disabled={!!addingToDrafts} className={btnSmall + ' bg-radiant-gold/20 text-radiant-gold hover:bg-radiant-gold/30'}>
                            {addingToDrafts === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                            Add to Drafts
                          </button>
                        </div>
                        {addToDraftsProgress && addToDraftsProgress.itemId === item.id && (
                          <ProgressPanel title="Adding to Drafts" steps={addToDraftsProgress.steps} variant="inline" onCancel={() => setAddToDraftsProgress(null)} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══════════ B-ROLL LIBRARY (collapsible) ═══════════ */}
          <div className="mb-10">
            <button
              type="button"
              onClick={() => setBrollExpanded(v => !v)}
              className="w-full flex items-center justify-between p-3 bg-silicon-slate/50 rounded-xl border border-silicon-slate hover:border-radiant-gold/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 text-radiant-gold" />
                <span className="text-sm font-semibold text-foreground">B-roll Library</span>
                <span className="text-[10px] text-gray-400">
                  {brollSummary.total} asset{brollSummary.total !== 1 ? 's' : ''}
                  {brollSummary.stale > 0 && <span className="text-amber-400 ml-1">· {brollSummary.stale} stale</span>}
                  {brollSummary.old > 0 && <span className="text-red-400 ml-1">· {brollSummary.old} old</span>}
                </span>
                {lastRunBroll && !brollCapturing && (
                  <span className="flex items-center gap-1 text-[10px] text-gray-500">
                    <Clock className="w-3 h-3" /> {lastRunLabel(lastRunBroll)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span onClick={e => { e.stopPropagation(); captureBrollLibrary(true) }} className={`${btnSmall} ${!!brollCapturing ? 'opacity-50 cursor-not-allowed' : ''} bg-radiant-gold/20 text-radiant-gold hover:bg-radiant-gold/30 cursor-pointer`}>
                  {brollCapturing === 'missing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                  Capture Missing
                </span>
                <span onClick={e => { e.stopPropagation(); captureBrollLibrary(false) }} className={`${btnSmall} ${!!brollCapturing ? 'opacity-50 cursor-not-allowed' : ''} bg-radiant-gold/20 text-radiant-gold hover:bg-radiant-gold/30 cursor-pointer`}>
                  {brollCapturing === 'all' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Capture All
                </span>
                {brollExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            <AnimatePresence>
              {brollExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4">
                    {brollProgress && (
                      <ProgressPanel
                        title={brollCapturing === 'missing' ? 'Capturing Missing Routes' : 'Capturing All Routes'}
                        steps={brollProgress}
                        error={brollProgressError}
                        onCancel={() => { brollAbortRef.current?.abort(); setBrollCapturing(false); setBrollProgress(null); setBrollProgressError(null) }}
                      />
                    )}
                    {brollLoading ? (
                      <div className="text-gray-400 text-sm">Loading library...</div>
                    ) : brollAssets.length === 0 ? (
                      <div className={cardCls + ' text-center py-8'}>
                        <Camera className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">No B-roll captured yet. Click &quot;Capture All&quot; to capture all site routes.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {brollAssets.map(asset => {
                          const freshness = brollStaleness(asset.captured_at)
                          const borderColor = freshness === 'old' ? 'border-red-500/50' : freshness === 'stale' ? 'border-amber-500/50' : 'border-silicon-slate'
                          return (
                            <div key={asset.id} className={`bg-background/50 rounded-lg border ${borderColor} p-3`}>
                              <div className="aspect-video bg-silicon-slate/30 rounded mb-2 flex items-center justify-center">
                                {asset.screenshot_path ? (
                                  <ImageIcon className="w-6 h-6 text-gray-500" />
                                ) : (
                                  <Camera className="w-6 h-6 text-gray-600" />
                                )}
                              </div>
                              <div className="text-xs text-foreground font-medium truncate">{asset.route_description ?? asset.route}</div>
                              <div className="text-[10px] text-gray-500 mt-0.5">{asset.route}</div>
                              <div className="flex items-center justify-between mt-1">
                                <span className={`text-[10px] ${freshness === 'old' ? 'text-red-400' : freshness === 'stale' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {timeAgo(asset.captured_at)}
                                </span>
                                <div className="flex items-center gap-1">
                                  {asset.screenshot_path && <span className="text-[10px] text-gray-500">PNG</span>}
                                  {asset.clip_path && <span className="text-[10px] text-gray-500">WebM</span>}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ═══════════ PHASE 2: DECIDE ═══════════ */}
          <div id="decide" ref={decideRef} className="mb-10 scroll-mt-16">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-radiant-gold/20 text-radiant-gold text-xs font-bold">2</span>
              Decide
              <span className="text-xs text-gray-400 font-normal ml-1">{filteredDrafts.length} draft{filteredDrafts.length !== 1 ? 's' : ''}</span>
            </h2>

            {/* Toolbar: filters + select toggle + refresh */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-gray-400 mr-1" />
                {(['all', 'llm_generated', 'drive_script', 'manual'] as SourceFilter[]).map(f => (
                  <button key={f} onClick={() => setSourceFilter(f)} className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${sourceFilter === f ? 'bg-radiant-gold/20 text-radiant-gold' : 'text-gray-400 hover:text-foreground'}`}>
                    {f === 'all' ? 'All' : f === 'llm_generated' ? 'Meetings' : f === 'drive_script' ? 'Drive' : 'Input'}
                    {f !== 'all' && <span className="ml-1 text-gray-500">({drafts.filter(d => d.source === f).length})</span>}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${selectionMode ? 'bg-radiant-gold/20 text-radiant-gold' : 'text-gray-400 hover:text-foreground'}`}
                >
                  <CheckSquare className="w-3.5 h-3.5 inline mr-1" />
                  {selectionMode ? 'Exit Select' : 'Select'}
                </button>
                <button onClick={fetchDrafts} className="text-xs text-radiant-gold hover:text-gold-light flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>
            </div>

            {/* Selection bar (visible only in selection mode) */}
            {selectionMode && (
              <div className="flex items-center gap-3 mb-3 p-2.5 bg-radiant-gold/5 border border-radiant-gold/20 rounded-lg">
                <span className="text-xs text-foreground font-medium">{selectedCount} selected</span>
                <button onClick={selectedCount === filteredDrafts.length ? deselectAll : selectAll} className="text-xs text-radiant-gold hover:text-gold-light">
                  {selectedCount === filteredDrafts.length ? 'Deselect All' : 'Select All'}
                </button>
                <div className="flex-1" />
	                <button
	                  onClick={batchGenerateVideos}
	                  disabled={selectedEligibleCount === 0 || generatingBatch || !batchRenderApprovalConfirmed}
	                  className={btnSmall + ' bg-radiant-gold text-imperial-navy hover:bg-gold-light disabled:bg-gray-600 disabled:text-gray-400'}
	                >
	                  {generatingBatch ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
	                  {batchRenderApprovalConfirmed ? `Generate Videos (${selectedEligibleCount})` : 'Confirm render gate'}
	                </button>
                <button
                  onClick={batchCreatePresentations}
                  disabled={selectedCount === 0 || generatingGamma}
                  className={btnSmall + ' bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50'}
                >
	                  {generatingGamma ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
	                  Create Presentations ({selectedCount})
	                </button>
	                <label className="flex max-w-md items-start gap-2 text-[10px] leading-4 text-gray-400">
	                  <input
	                    type="checkbox"
	                    checked={batchRenderApprovalConfirmed}
	                    onChange={e => setBatchRenderApprovalConfirmed(e.target.checked)}
	                    className="mt-0.5"
	                  />
	                  <span>Shaka render approval confirmed for selected drafts. One internal review render each; publishing stays separate.</span>
	                </label>
              </div>
            )}

            {batchMessage && <p className="text-sm text-muted-foreground mb-2">{batchMessage}</p>}
            {batchProgress && (
              <div className="mb-3">
                <ProgressPanel title="Batch Operation" steps={batchProgress} onCancel={() => setBatchProgress(null)} />
              </div>
            )}

            {/* Drafts list — compact rows with expand-one */}
            {draftsLoading ? (
              <div className="text-gray-400">Loading drafts...</div>
            ) : filteredDrafts.length === 0 ? (
              <div className={cardCls + ' text-center py-8'}>
                <Lightbulb className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No pending drafts. Use the Plan section above to create some.</p>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  {pagedDrafts.map(draft => {
                    const badge = sourceBadge(draft.source)
                    const overLimit = draft.script_text.length > HEYGEN_SCRIPT_MAX
                    const draftBrollIds = getDraftBroll(draft)
                    const isSelected = selectedDraftIds.has(draft.id)
                    const isExpanded = expandedDraftId === draft.id
	                    const sceneCount = draft.storyboard_json?.scenes?.length ?? 0
                    const isEditing = editingDraftId === draft.id
                    const renderApprovalConfirmed = Boolean(renderApprovalDrafts[draft.id])
                    const renderReadiness = renderReadinessDrafts[draft.id]
                    const checkingReadiness = checkingReadinessDraftId === draft.id
                    const editForm = draftEditForms[draft.id] ?? {
                      title: draft.title,
                      scriptText: draft.script_text,
                      storyboardText: formatStoryboardForEdit(draft),
                    }
                    const editOverLimit = editForm.scriptText.length > HEYGEN_SCRIPT_MAX
                    const draftScorecard = draft.script_scorecard ?? emptyScriptScorecard()
                    const draftOutline = draft.script_outline ?? {}
                    const scriptBlocked = (draftScorecard.blockers?.length ?? 0) > 0

                    return (
                      <div key={draft.id} className={`bg-silicon-slate/50 rounded-lg border ${isSelected ? 'border-radiant-gold/50' : isExpanded ? 'border-radiant-gold/30' : 'border-silicon-slate'} transition-colors`}>
                        {/* Compact row */}
                        <div
                          className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-silicon-slate/70 transition-colors rounded-lg"
                          onClick={() => {
                            if (selectionMode) { toggleSelection(draft.id); return }
                            setExpandedDraftId(isExpanded ? null : draft.id)
                          }}
                        >
                          {selectionMode && (
                            <button onClick={e => { e.stopPropagation(); toggleSelection(draft.id) }} className="shrink-0 text-gray-400 hover:text-radiant-gold">
                              {isSelected ? <CheckSquare className="w-4 h-4 text-radiant-gold" /> : <Square className="w-4 h-4" />}
                            </button>
                          )}
                          <span className="text-sm font-medium text-foreground truncate min-w-0 flex-1">{draft.title}</span>
                          <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.cls}`}>{badge.label}</span>
                          <span className={`shrink-0 text-[10px] font-mono ${overLimit ? 'text-red-400' : 'text-gray-500'}`}>
                            {draft.script_text.length.toLocaleString()}c
                          </span>
                          {sceneCount > 0 && <span className="shrink-0 text-[10px] text-gray-500">{sceneCount} scenes</span>}
                          {draftBrollIds.length > 0 && <span className="shrink-0 text-[10px] text-emerald-400">{draftBrollIds.length} B-roll</span>}
                          <span className="shrink-0 text-[10px] text-gray-500">{timeAgo(draft.created_at)}</span>
                          {!selectionMode && (
                            <button onClick={e => { e.stopPropagation(); dismissDraft(draft.id) }} disabled={!!generatingDraftId} className="shrink-0 text-gray-500 hover:text-rose-400 p-0.5">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          {!selectionMode && (
                            isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                          )}
                        </div>

                        {/* Expanded detail panel */}
                        <AnimatePresence>
                          {isExpanded && !selectionMode && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-2 border-t border-silicon-slate/50">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <div className="text-xs font-medium text-foreground">Human review</div>
                                    <div className="text-[10px] text-gray-500">Edit title, script, and storyboard before generation.</div>
                                  </div>
                                  {isEditing ? (
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => cancelEditDraft(draft.id)} disabled={savingDraftId === draft.id} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-foreground border border-silicon-slate rounded-lg disabled:opacity-50">
                                        <X className="w-3 h-3" /> Cancel
                                      </button>
                                      <button onClick={() => saveDraftEdits(draft.id)} disabled={savingDraftId === draft.id || editOverLimit} className={btnPrimary + ' text-xs' + (editOverLimit ? ' opacity-50 cursor-not-allowed' : '')}>
                                        {savingDraftId === draft.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                        Save Review
                                      </button>
                                    </div>
                                  ) : (
                                    <button onClick={() => beginEditDraft(draft)} disabled={!!generatingDraftId || generatingBatch || generatingGamma} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-radiant-gold border border-radiant-gold/30 rounded-lg hover:bg-radiant-gold/10 disabled:opacity-50">
                                      <PenLine className="w-3 h-3" /> Review/Edit
                                    </button>
                                  )}
                                </div>

                                {isEditing ? (
                                  <div className="mb-3 space-y-3 rounded-lg border border-radiant-gold/20 bg-radiant-gold/5 p-3">
                                    <div>
                                      <label className="mb-1 block text-[10px] text-gray-400">Title</label>
                                      <input
                                        value={editForm.title}
                                        onChange={e => updateDraftEditForm(draft.id, { title: e.target.value })}
                                        className={inputCls + ' text-sm'}
                                      />
                                    </div>
                                    <div>
                                      <div className="mb-1 flex items-center justify-between">
                                        <label className="block text-[10px] text-gray-400">Script</label>
                                        <span className={`text-[10px] font-mono ${editOverLimit ? 'text-red-400' : 'text-gray-500'}`}>
                                          {editForm.scriptText.length.toLocaleString()} / {HEYGEN_SCRIPT_MAX.toLocaleString()}
                                        </span>
                                      </div>
                                      <textarea
                                        value={editForm.scriptText}
                                        onChange={e => updateDraftEditForm(draft.id, { scriptText: e.target.value })}
                                        rows={10}
                                        className={inputCls + ' font-mono text-xs'}
                                      />
                                    </div>
                                    <div>
                                      <label className="mb-1 block text-[10px] text-gray-400">Storyboard JSON</label>
                                      <textarea
                                        value={editForm.storyboardText}
                                        onChange={e => updateDraftEditForm(draft.id, { storyboardText: e.target.value })}
                                        rows={7}
                                        className={inputCls + ' font-mono text-xs'}
                                      />
                                    </div>
                                    {editOverLimit && (
                                      <div className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 rounded px-2 py-1">
                                        Shorten the script before saving. HeyGen rejects scripts over {HEYGEN_SCRIPT_MAX.toLocaleString()} characters.
                                      </div>
                                    )}
                                    {draftEditError && (
                                      <div className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 rounded px-2 py-1">
                                        {draftEditError}
                                      </div>
                                    )}
                                  </div>
                                ) : null}

                                {!isEditing && (
                                  <div className="mb-3 rounded-lg border border-silicon-slate bg-background/50 p-3">
                                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <div className="text-xs font-medium text-foreground">Script anatomy</div>
                                        <div className="text-[10px] text-gray-500">Pain, hook, loop, proof, CTA, and source-distance score before render.</div>
                                      </div>
                                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${scoreTone(draftScorecard.overall_score)}`}>
                                        Score {draftScorecard.overall_score || 0}
                                      </span>
                                    </div>
                                    <div className="grid gap-2 text-[10px] md:grid-cols-2">
                                      <div className="rounded-md border border-silicon-slate/70 p-2">
                                        <span className="text-gray-500">Pain point</span>
                                        <p className="mt-1 line-clamp-2 text-gray-300">{draftOutline.pain_point || 'Missing pain point.'}</p>
                                      </div>
                                      <div className="rounded-md border border-silicon-slate/70 p-2">
                                        <span className="text-gray-500">Hook / loop</span>
                                        <p className="mt-1 line-clamp-2 text-gray-300">{draftOutline.hook || draftOutline.open_loop || 'Missing hook.'}</p>
                                      </div>
                                      <div className="rounded-md border border-silicon-slate/70 p-2">
                                        <span className="text-gray-500">Proof cue</span>
                                        <p className="mt-1 line-clamp-2 text-gray-300">{draftOutline.proof_demo || 'Proof cue pending.'}</p>
                                      </div>
                                      <div className="rounded-md border border-silicon-slate/70 p-2">
                                        <span className="text-gray-500">CTA / close</span>
                                        <p className="mt-1 line-clamp-2 text-gray-300">{draftOutline.cta || draftOutline.closing_question || 'CTA required before render.'}</p>
                                      </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                                      <span className={`rounded-full border px-2 py-0.5 ${scoreTone(draftScorecard.pain_clarity)}`}>Pain {draftScorecard.pain_clarity || 0}</span>
                                      <span className={`rounded-full border px-2 py-0.5 ${scoreTone(draftScorecard.hook_strength)}`}>Hook {draftScorecard.hook_strength || 0}</span>
                                      <span className={`rounded-full border px-2 py-0.5 ${scoreTone(draftScorecard.cta_clarity)}`}>CTA {draftScorecard.cta_clarity || 0}</span>
                                      <span className={`rounded-full border px-2 py-0.5 ${scoreTone(draftScorecard.source_distance_safety)}`}>Source distance {draftScorecard.source_distance_safety || 0}</span>
                                    </div>
                                    {draftScorecard.blockers?.length ? (
                                      <ul className="mt-2 space-y-0.5 text-[10px] text-red-200">
                                        {draftScorecard.blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}
                                      </ul>
                                    ) : null}
                                    {draftScorecard.warnings?.length ? (
                                      <ul className="mt-2 space-y-0.5 text-[10px] text-amber-200">
                                        {draftScorecard.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
                                      </ul>
                                    ) : null}
                                  </div>
                                )}

                                {/* Script preview + storyboard */}
                                {!isEditing && <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs text-gray-400">Script</span>
                                      <span className="text-[10px] font-mono text-gray-500">{draft.script_text.length.toLocaleString()} chars</span>
                                    </div>
                                    <pre className="text-xs text-foreground bg-background rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
                                      {draft.script_text.slice(0, 800)}{draft.script_text.length > 800 ? '...' : ''}
                                    </pre>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-400 mb-1">Storyboard</div>
                                    <div className="text-xs text-gray-400 bg-background rounded p-2 max-h-32 overflow-auto">
                                      {draft.storyboard_json?.scenes?.map((s, i) => (
                                        <div key={i} className="mb-1">
                                          {s.sceneNumber ?? i + 1}. {s.description ?? '—'}
                                          {s.brollHint ? <span className="text-radiant-gold/80 ml-1">[{s.brollHint}]</span> : null}
                                        </div>
                                      )) ?? 'No storyboard'}
                                    </div>
                                  </div>
                                </div>}

                                {/* Output tabs */}
                                {(() => {
                                  const activeTab = getOutputTab(draft.id, draft.script_text.length)
                                  return (
                                    <div>
                                      <div className="flex items-center gap-0.5 border-b border-silicon-slate mb-3">
                                        <button
                                          onClick={() => setDraftOutputTab(prev => ({ ...prev, [draft.id]: 'heygen' }))}
                                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                                            activeTab === 'heygen' ? 'border-radiant-gold text-radiant-gold' : 'border-transparent text-gray-400 hover:text-foreground'
                                          }`}
                                        >
                                          <Video className="w-3 h-3" /> Video
                                          {overLimit && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                                        </button>
                                        <button
                                          onClick={() => setDraftOutputTab(prev => ({ ...prev, [draft.id]: 'gamma' }))}
                                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                                            activeTab === 'gamma' ? 'border-amber-400 text-amber-400' : 'border-transparent text-gray-400 hover:text-foreground'
                                          }`}
                                        >
                                          <FileText className="w-3 h-3" /> Presentation
                                        </button>
                                      </div>

                                      {activeTab === 'heygen' && (
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-3 text-[10px]">
                                            <span className={overLimit ? 'text-red-400 font-semibold' : draft.script_text.length > HEYGEN_SCRIPT_MAX * 0.8 ? 'text-amber-400' : 'text-gray-500'}>
                                              {draft.script_text.length.toLocaleString()} / {HEYGEN_SCRIPT_MAX.toLocaleString()} chars
                                            </span>
                                            {overLimit && <span className="text-red-400">Over by {(draft.script_text.length - HEYGEN_SCRIPT_MAX).toLocaleString()}</span>}
                                            {draftBrollIds.length > 0 && <span className="text-emerald-400">{draftBrollIds.length} B-roll asset{draftBrollIds.length !== 1 ? 's' : ''} linked</span>}
                                          </div>
                                          {overLimit && (
                                            <div className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 rounded px-2 py-1">
                                              Script exceeds HeyGen limit. Shorten the script or switch to the Presentation tab.
                                            </div>
                                          )}
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            {draftBrollIds.map(assetId => {
                                              const asset = brollAssets.find(a => a.id === assetId)
                                              if (!asset) return null
                                              return (
                                                <span key={assetId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-400">
                                                  {asset.route_description ?? asset.route}
                                                  <button onClick={() => removeBrollFromDraft(draft.id, assetId)} className="hover:text-red-400"><X className="w-2.5 h-2.5" /></button>
                                                </span>
                                              )
                                            })}
                                            <div className="relative">
                                              <button onClick={() => setBrollDropdownDraft(brollDropdownDraft === draft.id ? null : draft.id)} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-radiant-gold border border-dashed border-gray-600 rounded hover:border-radiant-gold/50 transition-colors">
                                                <Plus className="w-2.5 h-2.5" /> Add B-roll
                                              </button>
                                              {brollDropdownDraft === draft.id && (
                                                <div className="absolute top-full left-0 mt-1 z-20 w-56 max-h-48 overflow-y-auto bg-background border border-silicon-slate rounded-lg shadow-xl p-1">
                                                  {brollAssets.length === 0 ? (
                                                    <div className="text-[10px] text-gray-500 p-2">No B-roll assets. Capture some first.</div>
                                                  ) : (
                                                    brollAssets.filter(a => !draftBrollIds.includes(a.id)).map(asset => (
                                                      <button key={asset.id} onClick={() => addBrollToDraft(draft.id, asset.id)} className="w-full text-left px-2 py-1.5 text-[10px] text-foreground hover:bg-silicon-slate/50 rounded flex items-center gap-2">
                                                        <ImageIcon className="w-3 h-3 text-gray-500 shrink-0" />
                                                        <span className="truncate">{asset.route_description ?? asset.route}</span>
                                                      </button>
                                                    ))
                                                  )}
                                                  {brollAssets.filter(a => !draftBrollIds.includes(a.id)).length === 0 && brollAssets.length > 0 && (
                                                    <div className="text-[10px] text-gray-500 p-2">All assets already added.</div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          <details className="group">
                                            <summary className="flex items-center gap-2 cursor-pointer text-[10px] text-gray-400 hover:text-foreground select-none">
                                              <Settings className="w-3 h-3" />
                                              <span>{VIDEO_CHANNEL_CONFIGS[channel]?.label ?? channel} · {aspectRatio} · {useTemplate ? 'Template' : 'Custom avatar'}</span>
                                              <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                                            </summary>
                                            <div className="mt-2 p-3 bg-background/50 rounded-lg border border-silicon-slate flex flex-wrap items-start gap-4">
                                              <div>
                                                <label className="block text-[10px] text-gray-400 mb-1">Presenter</label>
                                                <div className="inline-flex rounded-lg border border-silicon-slate bg-background/50 p-0.5">
                                                  <button type="button" onClick={() => setUseTemplate(false)} className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${!useTemplate ? 'bg-radiant-gold/20 text-radiant-gold' : 'text-gray-400 hover:text-foreground'}`}>Custom avatar</button>
                                                  <button type="button" onClick={() => setUseTemplate(true)} className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${useTemplate ? 'bg-radiant-gold/20 text-radiant-gold' : 'text-gray-400 hover:text-foreground'}`}>Template</button>
                                                </div>
                                              </div>
                                              {useTemplate ? (
                                                <>
                                                  <div>
                                                    <label className="block text-[10px] text-gray-400 mb-1">Template</label>
                                                    <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} disabled={templatesLoading} className={selectCls + ' text-[10px] min-w-[120px]'}>
                                                      {templatesLoading ? <option>Loading...</option> : <><option value="">Default</option>{templates.map(t => <option key={t.templateId} value={t.templateId}>{t.name}</option>)}</>}
                                                    </select>
                                                  </div>
                                                  <div>
                                                    <label className="block text-[10px] text-gray-400 mb-1">Brand Voice</label>
                                                    <select value={selectedBrandVoiceId} onChange={e => setSelectedBrandVoiceId(e.target.value)} disabled={brandVoicesLoading} className={selectCls + ' text-[10px] min-w-[120px]'}>
                                                      {brandVoicesLoading ? <option>Loading...</option> : <><option value="">Default</option>{brandVoices.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</>}
                                                    </select>
                                                  </div>
                                                </>
                                              ) : (
                                                <div>
                                                  <label className="block text-[10px] text-gray-400 mb-1">Avatar</label>
                                                  <select value={selectedAvatarId} onChange={e => setSelectedAvatarId(e.target.value)} disabled={avatarsLoading} className={selectCls + ' text-[10px] min-w-[120px]'}>
                                                    {avatarsLoading ? <option>Loading...</option> : <><option value="">Default</option>{avatars.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</>}
                                                  </select>
                                                </div>
                                              )}
                                              <div>
                                                <label className="block text-[10px] text-gray-400 mb-1">Channel</label>
                                                <select value={channel} onChange={e => handleChannelChange(e.target.value as VideoChannel)} className={selectCls + ' text-[10px] min-w-[90px]'}>
                                                  {Object.entries(VIDEO_CHANNEL_CONFIGS).map(([id, cfg]) => <option key={id} value={id}>{cfg.label}</option>)}
                                                </select>
                                              </div>
                                              <div>
                                                <label className="block text-[10px] text-gray-400 mb-1">Aspect ratio</label>
                                                <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as '16:9' | '9:16')} className={selectCls + ' text-[10px] min-w-[90px]'}>
                                                  <option value="16:9">16:9</option>
                                                  <option value="9:16">9:16</option>
                                                </select>
                                              </div>
	                                            </div>
	                                          </details>
                                          <div className="rounded-lg border border-silicon-slate bg-background/50 p-2">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <div>
                                                <div className="text-[10px] font-medium text-foreground">Render readiness</div>
                                                <div className="text-[10px] text-gray-500">Read-only check for draft status, HeyGen config, script length, and B-roll matches.</div>
                                              </div>
                                              <button
                                                onClick={() => checkRenderReadiness(draft.id)}
                                                disabled={checkingReadiness || isEditing || !!generatingDraftId || !!generatingBatch || generatingGamma}
                                                className="flex items-center gap-1.5 rounded-lg border border-silicon-slate px-2.5 py-1.5 text-[10px] text-gray-300 hover:border-radiant-gold/50 hover:text-radiant-gold disabled:opacity-50"
                                              >
                                                {checkingReadiness ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                                                Check readiness
                                              </button>
                                            </div>
                                            {renderReadiness && (
                                              <div className="mt-2 space-y-1 text-[10px]">
                                                <div className={renderReadiness.ready ? 'text-emerald-400' : 'text-amber-400'}>
                                                  {renderReadiness.ready ? 'Ready for approval-gated internal render.' : 'Resolve blocking issues before render.'}
                                                </div>
                                                <div className="flex flex-wrap gap-2 text-gray-500">
                                                  <span>{renderReadiness.details.scriptCharacters.toLocaleString()} chars</span>
                                                  <span>{renderReadiness.details.storyboardScenes} scenes</span>
                                                  <span>{renderReadiness.details.brollAssetIds.length} B-roll</span>
                                                  <span>{renderReadiness.details.heygenMode === 'template' ? 'Template' : renderReadiness.details.heygenMode === 'avatar_voice' ? 'Avatar + voice' : 'Missing HeyGen config'}</span>
                                                  <span>Script score {renderReadiness.details.scriptScorecard?.overall_score ?? 0}</span>
                                                </div>
                                                {renderReadiness.details.scriptScorecard ? (
                                                  <div className="flex flex-wrap gap-1 text-[10px]">
                                                    <span className={`rounded-full border px-2 py-0.5 ${scoreTone(renderReadiness.details.scriptScorecard.pain_clarity)}`}>Pain {renderReadiness.details.scriptScorecard.pain_clarity}</span>
                                                    <span className={`rounded-full border px-2 py-0.5 ${scoreTone(renderReadiness.details.scriptScorecard.cta_clarity)}`}>CTA {renderReadiness.details.scriptScorecard.cta_clarity}</span>
                                                    <span className={`rounded-full border px-2 py-0.5 ${scoreTone(renderReadiness.details.scriptScorecard.source_distance_safety)}`}>Source distance {renderReadiness.details.scriptScorecard.source_distance_safety}</span>
                                                  </div>
                                                ) : null}
                                                {renderReadiness.blockingIssues.length > 0 && (
                                                  <ul className="space-y-0.5 text-amber-300">
                                                    {renderReadiness.blockingIssues.map((issue, index) => <li key={index}>{issue}</li>)}
                                                  </ul>
                                                )}
                                                {renderReadiness.warnings.length > 0 && (
                                                  <ul className="space-y-0.5 text-gray-400">
                                                    {renderReadiness.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
                                                  </ul>
                                                )}
                                                <div className="text-gray-500">{renderReadiness.details.approvalBoundary}</div>
                                              </div>
                                            )}
                                          </div>
	                                          <label className="flex items-start gap-2 rounded-lg border border-silicon-slate bg-background/50 p-2 text-[10px] leading-4 text-gray-400">
	                                            <input
	                                              type="checkbox"
	                                              checked={renderApprovalConfirmed}
	                                              onChange={e => setRenderApprovalDrafts(prev => ({ ...prev, [draft.id]: e.target.checked }))}
	                                              className="mt-0.5"
	                                            />
	                                            <span>
	                                              Shaka render approval confirmed from <code className="text-radiant-gold">{VIDEO_RENDER_APPROVAL_PACKET_PATH}</code>. One internal HeyGen review render only; publishing, ElevenLabs, n8n audio, and social queues remain separate approvals.
	                                            </span>
	                                          </label>
	                                          <button onClick={() => generateFromDraft(draft.id)} disabled={scriptBlocked || overLimit || isEditing || !renderApprovalConfirmed || !!generatingDraftId || !!generatingBatch || generatingGamma} className={btnPrimary + ' text-xs' + (scriptBlocked || overLimit || isEditing || !renderApprovalConfirmed ? ' opacity-50 cursor-not-allowed' : '')}>
	                                            {generatingDraftId === draft.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
	                                            {isEditing ? 'Save review first' : scriptBlocked ? 'Resolve script gate' : !renderApprovalConfirmed ? 'Confirm render gate' : generatingDraftId && generatingDraftId !== draft.id ? 'Busy...' : 'Generate Video'}
	                                          </button>
                                          {heygenProgress && heygenProgress.draftId === draft.id && (
                                            <ProgressPanel title="Generating Video" steps={heygenProgress.steps} variant="inline" onCancel={() => setHeygenProgress(null)} />
                                          )}
                                        </div>
                                      )}

                                      {activeTab === 'gamma' && (
                                        <div className="space-y-3">
                                          <div className="text-[10px] text-emerald-400/80">No character limit — ideal for long scripts.</div>
                                          <button onClick={() => createGammaFromScript(draft.script_text, draft.title, draft.id)} disabled={generatingGamma || !!generatingDraftId || !!generatingBatch} className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 font-medium rounded-lg hover:bg-amber-500/30 disabled:opacity-50 text-xs">
                                            {generatingGamma ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                                            Create Presentation
                                          </button>
                                          {gammaProgress && gammaProgress.draftId === draft.id && (
                                            <ProgressPanel title="Creating Presentation" steps={gammaProgress.steps} variant="inline" onCancel={() => setGammaProgress(null)} />
                                          )}
                                          {gammaUrl && gammaProgress?.draftId === draft.id && (
                                            <p className="text-xs text-emerald-400">Presentation ready: <a href={gammaUrl} target="_blank" rel="noopener noreferrer" className="underline">Open in Gamma</a></p>
                                          )}
                                          {gammaError && gammaProgress?.draftId === draft.id && (
                                            <p className="text-xs text-red-400">{gammaError}</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>

                {/* Pagination */}
                {totalDraftPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-silicon-slate">
                    <span className="text-sm text-gray-400">
                      Showing {(safeDraftsPage - 1) * DRAFTS_PER_PAGE + 1}–{Math.min(safeDraftsPage * DRAFTS_PER_PAGE, filteredDrafts.length)} of {filteredDrafts.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => changeDraftsPage(safeDraftsPage - 1)} disabled={safeDraftsPage === 1} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-background border border-silicon-slate text-gray-300 hover:border-radiant-gold/30 disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronLeft className="w-4 h-4" /> Prev
                      </button>
                      <span className="text-sm text-gray-400 px-2">Page {safeDraftsPage} of {totalDraftPages}</span>
                      <button onClick={() => changeDraftsPage(safeDraftsPage + 1)} disabled={safeDraftsPage === totalDraftPages} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-background border border-silicon-slate text-gray-300 hover:border-radiant-gold/30 disabled:opacity-40 disabled:cursor-not-allowed">
                        Next <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ═══════════ PHASE 3: REVIEW ═══════════ */}
          <div ref={reviewRef} className="mb-10 scroll-mt-16">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-radiant-gold/20 text-radiant-gold text-xs font-bold">3</span>
                Review
                <span className="text-xs text-gray-400 font-normal ml-1">
                  {jobsTotal} job{jobsTotal !== 1 ? 's' : ''}
                  {pendingJobCount > 0 && <span className="text-amber-400"> · {pendingJobCount} processing</span>}
                </span>
              </h2>
              <button onClick={() => fetchJobs()} className="text-xs text-radiant-gold hover:text-gold-light flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {/* Status filter pills + selection toggle */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-1">
                {(['all', 'pending', 'completed', 'failed'] as JobStatusFilter[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setJobStatusFilter(s)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                      jobStatusFilter === s
                        ? 'bg-radiant-gold/15 text-radiant-gold border border-radiant-gold/30'
                        : 'text-gray-400 hover:text-foreground border border-transparent hover:border-silicon-slate'
                    }`}
                  >
                    {s === 'all' ? 'All' : s === 'pending' ? 'Processing' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
                {pendingJobCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 text-[10px] font-medium ml-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> auto-refreshing
                  </span>
                )}
              </div>
              <button
                onClick={() => { if (jobSelectionMode) exitJobSelectionMode(); else setJobSelectionMode(true) }}
                className={`text-[10px] px-2 py-1 rounded border ${jobSelectionMode ? 'border-radiant-gold/40 text-radiant-gold bg-radiant-gold/10' : 'border-silicon-slate text-gray-400 hover:text-foreground'}`}
              >
                {jobSelectionMode ? 'Cancel' : 'Select'}
              </button>
            </div>

            {/* Batch actions bar */}
            {jobSelectionMode && selectedJobIds.size > 0 && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-silicon-slate/50 rounded-lg border border-silicon-slate">
                <span className="text-xs text-gray-400">{selectedJobIds.size} selected</span>
                <button onClick={selectAllJobs} className="text-[10px] text-radiant-gold hover:text-gold-light">All</button>
                <button onClick={deselectAllJobs} className="text-[10px] text-gray-400 hover:text-foreground">None</button>
                <div className="flex-1" />
                {selectedRefreshableJobIds.length > 0 && (
                  <button onClick={batchRefreshJobs} disabled={batchRefreshing} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 disabled:opacity-50">
                    {batchRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Refresh ({selectedRefreshableJobIds.length})
                  </button>
                )}
                {selectedFailedJobIds.length > 0 && (
                  <button onClick={batchRetryJobs} disabled={batchRetrying} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 disabled:opacity-50">
                    {batchRetrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    Retry Failed ({selectedFailedJobIds.length})
                  </button>
                )}
                <button onClick={batchDeleteJobs} disabled={batchDeleting} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-50">
                  {batchDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Delete ({selectedJobIds.size})
                </button>
              </div>
            )}

            {latestCompletedReviewJob && (
              <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                        <CheckCircle className="h-3 w-3" />
                        Finished review artifact
                      </span>
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-200">
                        Internal render only
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-foreground">
                      Review the generated video, not just the job row
                    </h3>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-gray-400">
                      This is the completed HeyGen review render. Your decision should be based on the video itself:
                      pacing, avatar delivery, script clarity, B-roll fit, and whether the CTA is obvious.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                    <span>{latestCompletedReviewJob.channel} · {latestCompletedReviewJob.aspect_ratio}</span>
                    <span>{new Date(latestCompletedReviewJob.created_at).toLocaleString()}</span>
                    {latestCompletedReviewJob.broll_asset_ids?.length ? (
                      <span>{latestCompletedReviewJob.broll_asset_ids.length} B-roll</span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
                  <div className="overflow-hidden rounded-lg border border-silicon-slate bg-black">
                    <video
                      src={latestCompletedReviewJob.video_url ?? undefined}
                      controls
                      preload="metadata"
                      className="aspect-video w-full bg-black"
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-lg border border-silicon-slate bg-background/60 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">Review checklist</div>
                      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-gray-300">
                        <li className="flex gap-2"><CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />Pain point is clear in the opening.</li>
                        <li className="flex gap-2"><CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />CTA is obvious by the close.</li>
                        <li className="flex gap-2"><CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />Avatar cadence feels natural enough for review.</li>
                        <li className="flex gap-2"><CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />B-roll/proof moments support the argument.</li>
                      </ul>
                    </div>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">Still locked</div>
                      <p className="mt-2 text-xs leading-5 text-gray-400">
                        This does not approve upload, scheduling, social publishing, ElevenLabs/n8n audio, or any external post.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setPreviewJob(latestCompletedReviewJob)}
                        className="flex items-center gap-1 rounded-lg bg-radiant-gold px-3 py-2 text-xs font-semibold text-void-black hover:bg-gold-light"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Open review player
                      </button>
                      <button
                        onClick={() => refreshVideoUrl(latestCompletedReviewJob)}
                        disabled={refreshingUrl === latestCompletedReviewJob.id}
                        className="flex items-center gap-1 rounded-lg border border-silicon-slate px-3 py-2 text-xs font-medium text-gray-300 hover:border-radiant-gold/40 disabled:opacity-50"
                      >
                        {refreshingUrl === latestCompletedReviewJob.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Refresh URL
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {jobsLoading ? (
              <div className="text-gray-400 py-4">Loading jobs...</div>
            ) : jobs.length === 0 && jobStatusFilter === 'all' && jobsTotal === 0 ? (
              <div className={cardCls + ' text-center py-8'}>
                <Video className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">
                  No generated videos yet.
                  {drafts.length > 0 && <> You have <strong className="text-foreground">{drafts.length} pending draft{drafts.length !== 1 ? 's' : ''}</strong> ready to generate.</>}
                  {drafts.length === 0 && <> Use the Plan section to create drafts first.</>}
                </p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-500">No {jobStatusFilter !== 'all' ? jobStatusFilter : ''} jobs found.</div>
            ) : (
              <div className="space-y-2">
                {jobs.map(job => (
                  <div key={job.id} className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border transition-colors ${
                    selectedJobIds.has(job.id) ? 'border-radiant-gold/40 bg-radiant-gold/5' : 'border-silicon-slate bg-silicon-slate/50'
                  }`}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {jobSelectionMode && (
                        <button onClick={() => toggleJobSelection(job.id)} className="shrink-0">
                          {selectedJobIds.has(job.id) ? <CheckSquare className="w-4 h-4 text-radiant-gold" /> : <Square className="w-4 h-4 text-gray-500" />}
                        </button>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground truncate max-w-[280px]">{job.script_text?.slice(0, 60) ?? '(no script)'}...</span>
                          <span className="text-[10px] text-gray-500">{job.channel} · {job.aspect_ratio}</span>
                          {job.broll_asset_ids && job.broll_asset_ids.length > 0 && (
                            <span className="text-[9px] px-1 py-0.5 bg-blue-500/20 text-blue-400 rounded font-medium">{job.broll_asset_ids.length} B-roll</span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{new Date(job.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {['pending', 'waiting', 'processing'].includes(job.heygen_status ?? '') && (
                        <>
                          <span className="flex items-center gap-1 text-[10px] text-amber-400"><Loader2 className="w-3 h-3 animate-spin" />{job.heygen_status}</span>
                          <button onClick={() => refreshJobStatus(job.id)} className="text-[10px] text-radiant-gold hover:text-gold-light">Check</button>
                        </>
                      )}
                      {(job.heygen_status === 'completed' || job.video_url) && (
                        <>
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle className="w-3 h-3" /> Done</span>
                          {job.video_url && (
                            <button onClick={() => setPreviewJob(job)} className="flex items-center gap-1 text-[10px] text-radiant-gold hover:text-gold-light">
                              <Play className="w-3 h-3" /> View
                            </button>
                          )}
                        </>
                      )}
                      {job.heygen_status === 'failed' && (
                        <span className="text-[10px] text-red-400">Failed{job.error_message ? `: ${job.error_message.slice(0, 40)}` : ''}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalJobPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] text-gray-500">
                  Showing {(jobsPage - 1) * JOBS_PER_PAGE + 1}–{Math.min(jobsPage * JOBS_PER_PAGE, jobsTotal)} of {jobsTotal}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => changeJobsPage(jobsPage - 1)} disabled={jobsPage === 1} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-background border border-silicon-slate text-gray-300 hover:border-radiant-gold/30 disabled:opacity-40 disabled:cursor-not-allowed">
                    <ChevronLeft className="w-3 h-3" /> Prev
                  </button>
                  <span className="text-[10px] text-gray-400">Page {jobsPage} / {totalJobPages}</span>
                  <button onClick={() => changeJobsPage(jobsPage + 1)} disabled={jobsPage === totalJobPages} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-background border border-silicon-slate text-gray-300 hover:border-radiant-gold/30 disabled:opacity-40 disabled:cursor-not-allowed">
                    Next <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

            </div>
          </details>

        </div>
      </div>

      {/* ── Video Preview Modal ── */}
      <AnimatePresence>
        {previewJob && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setPreviewJob(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-3xl mx-4 rounded-xl overflow-hidden border border-silicon-slate bg-background shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-silicon-slate">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-foreground truncate">
                    {previewJob.script_text?.slice(0, 80) ?? 'Video preview'}
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">{previewJob.channel} · {previewJob.aspect_ratio}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button
                    onClick={() => refreshVideoUrl(previewJob)}
                    disabled={refreshingUrl === previewJob.id}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-radiant-gold/10 text-radiant-gold hover:bg-radiant-gold/20 disabled:opacity-50"
                    title="Refresh video URL (HeyGen URLs expire after 7 days)"
                  >
                    {refreshingUrl === previewJob.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Refresh URL
                  </button>
                  {previewJob.video_share_url && (
                    <a
                      href={previewJob.video_share_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                    >
                      <ExternalLink className="w-3 h-3" /> Share Page
                    </a>
                  )}
                  {previewJob.video_url && (
                    <a
                      href={previewJob.video_url}
                      download
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    >
                      <ExternalLink className="w-3 h-3" /> Download
                    </a>
                  )}
                  <button onClick={() => setPreviewJob(null)} className="p-1 rounded hover:bg-silicon-slate text-gray-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="bg-black flex items-center justify-center">
                {previewJob.video_url ? (
                  <video
                    key={previewJob.video_url}
                    src={previewJob.video_url}
                    controls
                    autoPlay
                    className="w-full max-h-[70vh]"
                    onError={(e) => {
                      const target = e.currentTarget
                      if (!target.dataset.retried) {
                        target.dataset.retried = '1'
                        refreshVideoUrl(previewJob)
                      }
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-16 text-gray-500">
                    <Video className="w-10 h-10" />
                    <p className="text-sm">No video URL available</p>
                    <button
                      onClick={() => refreshVideoUrl(previewJob)}
                      className="flex items-center gap-1 text-xs text-radiant-gold hover:text-gold-light"
                    >
                      <RefreshCw className="w-3 h-3" /> Try refreshing from HeyGen
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </ProtectedRoute>
  )
}
