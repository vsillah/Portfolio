'use client'

import Link from 'next/link'
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowUpDown,
  BarChart3,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  Database,
  ExternalLink,
  FileSearch,
  FileText,
  Film,
  Info,
  Instagram,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  XCircle,
  Youtube,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import Pagination from '@/components/admin/Pagination'
import { getCurrentSession } from '@/lib/auth'
import type { AgentWorkItem } from '@/lib/agent-work-items'
import type { CampaignType } from '@/lib/campaigns'
import {
  CAMPAIGN_PHASE_LABELS,
  SOCIAL_CONTENT_CALENDAR_SOURCE_LABELS,
  SOCIAL_CONTENT_CALENDAR_TEMPLATE_KEYS,
  SOCIAL_CONTENT_CALENDAR_TEMPLATES,
  calendarMilestoneRationale,
} from '@/lib/social-content-calendar'

type ResearchPacket = {
  id: string
  source_url: string
  platform: string
  creator_name: string | null
  creator_handle: string | null
  title: string | null
  caption: string | null
  thumbnail_url: string | null
  hook_transcript: string | null
  outlier_score: number
  pattern_status: string
  retrieved_at: string
  actor_metadata: Record<string, unknown>
  metrics: Record<string, unknown>
}

type EvidenceForm = {
  source_url: string
  platform: string
  title: string
  creator_name: string
  creator_handle: string
  thumbnail_url: string
  hook_transcript: string
  views: string
  likes: string
  comments: string
  follower_count: string
  retrieval_notes: string
}

type DailyDigest = {
  generated_at: string
  lookback_days: number
  summary: {
    new_research_packets: number
    usable_patterns: number
    shaka_insights: number
    blocked_or_sensitive_items: number
  }
  strongest_patterns: Array<{
    packet_id: string
    title: string
    source_url: string
    platform: string
    creator: string | null
    outlier_score: number
    pattern_status: string
    hook_structure: string | null
    promise_value: string | null
    thumbnail_pattern: string | null
  }>
  recommended_insights: Array<{
    work_item_id: string
    title: string
    status: string
    priority: string
    triggering_event: string | null
    why_vambah_can_speak: string | null
    sensitivity: string
  }>
  suggested_channel_lanes: Array<{
    work_item_id: string
    insight_title: string
    channel: string
    label: string
    status: string
    required_inputs: string[]
  }>
  thumbnail_opportunities: Array<{
    packet_id: string
    title: string
    thumbnail_pattern: string | null
  }>
  blocked_or_sensitive_items: Array<{
    type: string
    id: string
    title: string
    reason: string
  }>
  governance: Record<string, string>
  side_effects: Record<string, boolean>
}

type CalendarItem = {
  id: string
  campaign_id: string | null
  agent_work_item_id: string | null
  social_content_id: string | null
  channel: 'linkedin' | 'youtube_shorts' | 'instagram_reels' | 'tiktok' | 'thumbnail'
  campaign_phase: 'tease' | 'teach' | 'proof' | 'offer'
  title: string
  planned_angle: string | null
  scheduled_for: string
  due_status: string
  authorization_status: string
  authorization_due_at: string | null
  autonomy_eligible: boolean
  metadata?: Record<string, unknown> | null
  attraction_campaigns?: { id: string; name: string; slug: string } | null
  agent_work_items?: { id: string; title: string; status: string } | null
  social_content_queue?: { id: string; status: string } | null
}

type CampaignOption = {
  id: string
  name: string
  description?: string | null
  campaign_type?: CampaignType
  status: string
  starts_at: string | null
  ends_at: string | null
}

type CalendarForm = {
  title: string
  campaign_id: string
  channel: CalendarItem['channel']
  campaign_phase: CalendarItem['campaign_phase']
  scheduled_for: string
  planned_angle: string
  metadata?: Record<string, unknown>
}

type IntelligenceSection = 'calendar' | 'digest' | 'evidence' | 'research' | 'insights'
type SortDirection = 'asc' | 'desc'
type ResearchSortKey = 'score' | 'retrieved' | 'title'
type InsightSortKey = 'updated' | 'title' | 'priority'

const EMPTY_EVIDENCE_FORM: EvidenceForm = {
  source_url: '',
  platform: 'youtube',
  title: '',
  creator_name: '',
  creator_handle: '',
  thumbnail_url: '',
  hook_transcript: '',
  views: '',
  likes: '',
  comments: '',
  follower_count: '',
  retrieval_notes: '',
}

const EMPTY_CALENDAR_FORM: CalendarForm = {
  title: '',
  campaign_id: '',
  channel: 'linkedin',
  campaign_phase: 'tease',
  scheduled_for: '',
  planned_angle: '',
  metadata: {},
}

const CALENDAR_PHASES: Array<{ key: CalendarItem['campaign_phase']; label: string }> = [
  { key: 'tease', label: 'Tease' },
  { key: 'teach', label: 'Teach' },
  { key: 'proof', label: 'Proof' },
  { key: 'offer', label: 'Offer' },
]

const CALENDAR_CHANNEL_LABELS: Record<CalendarItem['channel'], string> = {
  linkedin: 'LinkedIn',
  youtube_shorts: 'YouTube Shorts',
  instagram_reels: 'Instagram Reels',
  tiktok: 'TikTok',
  thumbnail: 'Thumbnail',
}

const SECTION_TABS: Array<{
  key: IntelligenceSection
  label: string
  description: string
}> = [
  {
    key: 'calendar',
    label: 'Calendar',
    description: 'Campaign arc lanes and due authorization gates.',
  },
  {
    key: 'digest',
    label: 'Daily Digest',
    description: 'Read-only summary of what Shaka should review next.',
  },
  {
    key: 'evidence',
    label: 'Evidence',
    description: 'Free-first source capture and paid-scraper approval boundaries.',
  },
  {
    key: 'research',
    label: 'Research',
    description: 'Creator evidence packets, source transparency, and pattern linking.',
  },
  {
    key: 'insights',
    label: 'Backlog',
    description: 'Central Shaka social topic triggers from Agentic Dashboard.',
  },
]

const TABLE_PAGE_SIZE = 6
const TEMPLATE_PAGE_SIZE = 4

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function optionalNumber(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function insightFor(item: AgentWorkItem) {
  const metadata = item.metadata ?? {}
  const insight = metadata.insight && typeof metadata.insight === 'object' && !Array.isArray(metadata.insight)
    ? metadata.insight as Record<string, unknown>
    : {}
  return {
    title: stringValue(insight.title) ?? item.title,
    triggeringEvent: stringValue(insight.triggering_event),
    whyVambahCanSpeak: stringValue(insight.why_vambah_can_speak),
    sensitivity: stringValue(insight.sensitivity) ?? 'needs_review',
  }
}

function channelLaneFor(item: AgentWorkItem, channel: 'linkedin' | 'youtube_shorts' | 'instagram_reels' | 'tiktok') {
  const metadata = recordValue(item.metadata)
  const lanes = recordValue(metadata.channel_lanes)
  return recordValue(lanes[channel])
}

function channelLaneStatus(item: AgentWorkItem, channel: 'linkedin' | 'youtube_shorts' | 'instagram_reels' | 'tiktok') {
  return stringValue(channelLaneFor(item, channel).status) ?? 'not_started'
}

function hasChannelReviewDraft(item: AgentWorkItem, channel: 'linkedin' | 'youtube_shorts' | 'instagram_reels' | 'tiktok') {
  return Object.keys(recordValue(channelLaneFor(item, channel).draft_packet)).length > 0
}

function hasPrimaryChannelReviewDrafts(item: AgentWorkItem) {
  return hasChannelReviewDraft(item, 'linkedin')
    && hasChannelReviewDraft(item, 'youtube_shorts')
    && hasChannelReviewDraft(item, 'instagram_reels')
    && hasChannelReviewDraft(item, 'tiktok')
}

function suggestedResearchPacketIds(item: AgentWorkItem) {
  return metadataStringArray(recordValue(item.metadata).suggested_research_packet_ids)
}

function hasApprovedResearchPatterns(item: AgentWorkItem) {
  const insight = recordValue(recordValue(item.metadata).insight)
  const patterns = Array.isArray(insight.approved_research_patterns) ? insight.approved_research_patterns : []
  return patterns.some((pattern) => Object.keys(recordValue(pattern)).length > 0)
}

function channelReviewPillClass(status: string) {
  if (status === 'approved') return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
  if (status === 'in_review' || status === 'draft_ready') return 'border-blue-500/35 bg-blue-500/10 text-blue-100'
  if (status === 'blocked') return 'border-red-500/35 bg-red-500/10 text-red-100'
  return 'border-amber-500/35 bg-amber-500/10 text-amber-100'
}

function platformIcon(platform: string) {
  if (platform.includes('youtube')) return <Youtube className="h-4 w-4 text-red-200" />
  if (platform.includes('instagram')) return <Instagram className="h-4 w-4 text-pink-200" />
  return <Film className="h-4 w-4 text-blue-200" />
}

function formatCalendarDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Unscheduled'
}

function toDatetimeLocalValue(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function calendarSourceLabel(url: string) {
  try {
    return SOCIAL_CONTENT_CALENDAR_SOURCE_LABELS[url] || new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function metadataStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function normalizeSearch(value: string | null | undefined) {
  return (value ?? '').toLowerCase()
}

function sortableDate(value: string | null | undefined) {
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function sortDirectionMultiplier(direction: SortDirection) {
  return direction === 'asc' ? 1 : -1
}

function templateMetadataFor(
  templateKey: keyof typeof SOCIAL_CONTENT_CALENDAR_TEMPLATES,
  milestoneKey: string,
  campaign?: CampaignOption | null,
) {
  const template = SOCIAL_CONTENT_CALENDAR_TEMPLATES[templateKey]
  const milestone = template.milestones.find((candidate) => candidate.key === milestoneKey)
  if (!milestone) return {}

  const campaignContext = {
    name: campaign?.name || 'Unassigned calendar item',
    description: campaign?.description ?? null,
    campaign_type: campaign?.campaign_type ?? undefined,
  }
  const rationale = calendarMilestoneRationale(campaignContext, template, milestone)

  return {
    generated_from: 'content_intelligence_template_milestone',
    campaign_arc: template.key,
    template_key: template.key,
    template_label: template.label,
    template_goal_types: template.goal_types,
    template_source_urls: template.source_urls,
    milestone_key: milestone.key,
    recommended_lead_time_days: milestone.recommended_lead_time_days,
    milestone_rationale: rationale,
    campaign_fit_summary: rationale.campaign_fit,
    source_labels: rationale.source_labels,
    required_assets: milestone.required_assets,
    approval_gates: milestone.approval_gates,
    source_urls: milestone.source_urls,
    external_execution_enabled: false,
  }
}

export default function ContentIntelligencePage() {
  return (
    <ProtectedRoute requireAdmin>
      <ContentIntelligenceContent />
    </ProtectedRoute>
  )
}

function ContentIntelligenceContent() {
  const [packets, setPackets] = useState<ResearchPacket[]>([])
  const [insights, setInsights] = useState<AgentWorkItem[]>([])
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([])
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [evidenceForm, setEvidenceForm] = useState<EvidenceForm>(EMPTY_EVIDENCE_FORM)
  const [submittingEvidence, setSubmittingEvidence] = useState(false)
  const [evidenceNotice, setEvidenceNotice] = useState<string | null>(null)
  const [selectedPacketId, setSelectedPacketId] = useState('')
  const [selectedInsightId, setSelectedInsightId] = useState('')
  const [linkDecisionNote, setLinkDecisionNote] = useState('')
  const [linkingPattern, setLinkingPattern] = useState(false)
  const [linkingSuggestedInsightId, setLinkingSuggestedInsightId] = useState<string | null>(null)
  const [linkNotice, setLinkNotice] = useState<string | null>(null)
  const [preparingReviewInsightId, setPreparingReviewInsightId] = useState<string | null>(null)
  const [reviewDraftNotice, setReviewDraftNotice] = useState<string | null>(null)
  const [digest, setDigest] = useState<DailyDigest | null>(null)
  const [activationScopeNote, setActivationScopeNote] = useState('')
  const [requestingActivation, setRequestingActivation] = useState(false)
  const [activationNotice, setActivationNotice] = useState<string | null>(null)
  const [calendarForm, setCalendarForm] = useState<CalendarForm>(EMPTY_CALENDAR_FORM)
  const [calendarNotice, setCalendarNotice] = useState<string | null>(null)
  const [creatingCalendarItem, setCreatingCalendarItem] = useState(false)
  const [calendarCampaignFilter, setCalendarCampaignFilter] = useState('')
  const [calendarChannelFilter, setCalendarChannelFilter] = useState('')
  const [calendarPhaseFilter, setCalendarPhaseFilter] = useState('')
  const [calendarAuthorizationFilter, setCalendarAuthorizationFilter] = useState('')
  const [calendarActionItemId, setCalendarActionItemId] = useState<string | null>(null)
  const [rejectingCalendarItemId, setRejectingCalendarItemId] = useState<string | null>(null)
  const [calendarDecisionNotes, setCalendarDecisionNotes] = useState<Record<string, string>>({})
  const [editingCalendarItemId, setEditingCalendarItemId] = useState<string | null>(null)
  const [calendarEditForms, setCalendarEditForms] = useState<Record<string, CalendarForm>>({})
  const [activeSection, setActiveSection] = useState<IntelligenceSection>('calendar')
  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({
    templateLibrary: true,
    calendarPlanner: true,
    digestActivation: false,
    evidenceSources: false,
    evidenceForm: true,
    patternLink: false,
  })
  const [researchSearch, setResearchSearch] = useState('')
  const [researchPlatformFilter, setResearchPlatformFilter] = useState('')
  const [researchPatternFilter, setResearchPatternFilter] = useState('')
  const [researchSort, setResearchSort] = useState<ResearchSortKey>('score')
  const [researchSortDirection, setResearchSortDirection] = useState<SortDirection>('desc')
  const [researchPage, setResearchPage] = useState(1)
  const [templatePage, setTemplatePage] = useState(1)
  const [insightSearch, setInsightSearch] = useState('')
  const [insightStatusFilter, setInsightStatusFilter] = useState('')
  const [insightSort, setInsightSort] = useState<InsightSortKey>('updated')
  const [insightSortDirection, setInsightSortDirection] = useState<SortDirection>('desc')
  const [insightPage, setInsightPage] = useState(1)

  const authedFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const session = await getCurrentSession()
    if (!session?.access_token) throw new Error('Missing admin session')
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${session.access_token}`)
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    return fetch(path, {
      ...init,
      headers,
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [packetResponse, insightResponse, digestResponse, calendarResponse, campaignResponse] = await Promise.all([
        authedFetch('/api/admin/social-content/intelligence/research-packets?limit=12'),
        authedFetch('/api/admin/agents/work-items?source_type=social_topic_trigger&limit=12'),
        authedFetch('/api/admin/social-content/intelligence/daily-digest?lookback_days=5&limit=12'),
        authedFetch('/api/admin/social-content/calendar?limit=50'),
        authedFetch('/api/admin/campaigns?limit=50'),
      ])
      const packetBody = await packetResponse.json().catch(() => ({}))
      const insightBody = await insightResponse.json().catch(() => ({}))
      const digestBody = await digestResponse.json().catch(() => ({}))
      const calendarBody = await calendarResponse.json().catch(() => ({}))
      const campaignBody = await campaignResponse.json().catch(() => ({}))
      if (!packetResponse.ok) throw new Error(packetBody.error || `Research packets HTTP ${packetResponse.status}`)
      if (!insightResponse.ok) throw new Error(insightBody.error || `Insights HTTP ${insightResponse.status}`)
      if (!digestResponse.ok) throw new Error(digestBody.error || `Digest HTTP ${digestResponse.status}`)
      if (!calendarResponse.ok) throw new Error(calendarBody.error || `Calendar HTTP ${calendarResponse.status}`)
      if (!campaignResponse.ok) throw new Error(campaignBody.error || `Campaigns HTTP ${campaignResponse.status}`)
      setPackets(Array.isArray(packetBody.packets) ? packetBody.packets : [])
      setInsights(Array.isArray(insightBody.work_items) ? insightBody.work_items : [])
      setDigest(digestBody.digest ?? null)
      setCalendarItems(Array.isArray(calendarBody.items) ? calendarBody.items : [])
      setCampaigns(Array.isArray(campaignBody.data) ? campaignBody.data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Content Intelligence')
      setPackets([])
      setInsights([])
      setDigest(null)
      setCalendarItems([])
      setCampaigns([])
    } finally {
      setLoading(false)
    }
  }, [authedFetch])

  useEffect(() => {
    load()
  }, [load])

  const strongestPacket = useMemo(() => packets[0] ?? null, [packets])

  const filteredCalendarItems = useMemo(() => {
    return calendarItems.filter((item) => {
      if (calendarCampaignFilter && item.campaign_id !== calendarCampaignFilter) return false
      if (calendarChannelFilter && item.channel !== calendarChannelFilter) return false
      if (calendarPhaseFilter && item.campaign_phase !== calendarPhaseFilter) return false
      if (calendarAuthorizationFilter && item.authorization_status !== calendarAuthorizationFilter) return false
      return true
    })
  }, [
    calendarAuthorizationFilter,
    calendarCampaignFilter,
    calendarChannelFilter,
    calendarItems,
    calendarPhaseFilter,
  ])

  const calendarItemsByPhase = useMemo(() => {
    return CALENDAR_PHASES.reduce((lanes, phase) => {
      lanes[phase.key] = filteredCalendarItems.filter((item) => item.campaign_phase === phase.key)
      return lanes
    }, {} as Record<CalendarItem['campaign_phase'], CalendarItem[]>)
  }, [filteredCalendarItems])

  const templateTotalPages = Math.max(
    1,
    Math.ceil(SOCIAL_CONTENT_CALENDAR_TEMPLATE_KEYS.length / TEMPLATE_PAGE_SIZE),
  )

  const pagedTemplateKeys = useMemo(() => {
    const start = (templatePage - 1) * TEMPLATE_PAGE_SIZE
    return SOCIAL_CONTENT_CALENDAR_TEMPLATE_KEYS.slice(start, start + TEMPLATE_PAGE_SIZE)
  }, [templatePage])

  const togglePanel = useCallback((key: string) => {
    setExpandedPanels((current) => ({ ...current, [key]: !current[key] }))
  }, [])

  const researchPlatforms = useMemo(() => {
    return Array.from(new Set(packets.map((packet) => packet.platform).filter(Boolean))).sort()
  }, [packets])

  const researchPatternStatuses = useMemo(() => {
    return Array.from(new Set(packets.map((packet) => packet.pattern_status).filter(Boolean))).sort()
  }, [packets])

  const filteredResearchPackets = useMemo(() => {
    const search = normalizeSearch(researchSearch)
    const direction = sortDirectionMultiplier(researchSortDirection)
    return packets
      .filter((packet) => {
        if (researchPlatformFilter && packet.platform !== researchPlatformFilter) return false
        if (researchPatternFilter && packet.pattern_status !== researchPatternFilter) return false
        if (!search) return true
        return [
          packet.title,
          packet.caption,
          packet.creator_name,
          packet.creator_handle,
          packet.source_url,
          packet.hook_transcript,
        ].some((value) => normalizeSearch(value).includes(search))
      })
      .sort((left, right) => {
        if (researchSort === 'score') {
          return (Number(left.outlier_score) - Number(right.outlier_score)) * direction
        }
        if (researchSort === 'retrieved') {
          return (sortableDate(left.retrieved_at) - sortableDate(right.retrieved_at)) * direction
        }
        return (left.title ?? left.caption ?? left.source_url).localeCompare(right.title ?? right.caption ?? right.source_url) * direction
      })
  }, [
    packets,
    researchPatternFilter,
    researchPlatformFilter,
    researchSearch,
    researchSort,
    researchSortDirection,
  ])

  const pagedResearchPackets = useMemo(() => {
    const start = (researchPage - 1) * TABLE_PAGE_SIZE
    return filteredResearchPackets.slice(start, start + TABLE_PAGE_SIZE)
  }, [filteredResearchPackets, researchPage])

  const researchTotalPages = Math.max(1, Math.ceil(filteredResearchPackets.length / TABLE_PAGE_SIZE))

  const insightStatuses = useMemo(() => {
    return Array.from(new Set(insights.map((item) => item.status).filter(Boolean))).sort()
  }, [insights])

  const filteredInsights = useMemo(() => {
    const search = normalizeSearch(insightSearch)
    const direction = sortDirectionMultiplier(insightSortDirection)
    const priorityScore: Record<string, number> = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
    }
    return insights
      .filter((item) => {
        if (insightStatusFilter && item.status !== insightStatusFilter) return false
        if (!search) return true
        const insight = insightFor(item)
        return [
          insight.title,
          insight.triggeringEvent,
          insight.whyVambahCanSpeak,
          item.status,
          item.priority,
        ].some((value) => normalizeSearch(value).includes(search))
      })
      .sort((left, right) => {
        if (insightSort === 'updated') {
          return (sortableDate(left.updated_at) - sortableDate(right.updated_at)) * direction
        }
        if (insightSort === 'priority') {
          return ((priorityScore[left.priority] ?? 0) - (priorityScore[right.priority] ?? 0)) * direction
        }
        return insightFor(left).title.localeCompare(insightFor(right).title) * direction
      })
  }, [
    insightSearch,
    insightSort,
    insightSortDirection,
    insightStatusFilter,
    insights,
  ])

  const pagedInsights = useMemo(() => {
    const start = (insightPage - 1) * TABLE_PAGE_SIZE
    return filteredInsights.slice(start, start + TABLE_PAGE_SIZE)
  }, [filteredInsights, insightPage])

  const insightTotalPages = Math.max(1, Math.ceil(filteredInsights.length / TABLE_PAGE_SIZE))

  useEffect(() => {
    setResearchPage(1)
  }, [researchPatternFilter, researchPlatformFilter, researchSearch, researchSort, researchSortDirection])

  useEffect(() => {
    setInsightPage(1)
  }, [insightSearch, insightSort, insightSortDirection, insightStatusFilter])

  const selectedCalendarCampaign = useMemo(() => {
    return campaigns.find((campaign) => campaign.id === calendarForm.campaign_id) ?? null
  }, [calendarForm.campaign_id, campaigns])

  useEffect(() => {
    setSelectedPacketId((current) => current || packets[0]?.id || '')
  }, [packets])

  useEffect(() => {
    setSelectedInsightId((current) => current || insights[0]?.id || '')
  }, [insights])

  const submitRecordedEvidence = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setEvidenceNotice(null)

    const sourceUrl = evidenceForm.source_url.trim()
    if (!sourceUrl) {
      setError('Source URL is required to store recorded evidence.')
      return
    }

    const metrics = {
      views: optionalNumber(evidenceForm.views),
      likes: optionalNumber(evidenceForm.likes),
      comments: optionalNumber(evidenceForm.comments),
      follower_count: optionalNumber(evidenceForm.follower_count),
    }

    setSubmittingEvidence(true)
    try {
      const response = await authedFetch('/api/admin/social-content/intelligence/research-runs', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'recorded_evidence',
          evidence_items: [
            {
              source_url: sourceUrl,
              platform: evidenceForm.platform,
              creator_name: evidenceForm.creator_name.trim() || null,
              creator_handle: evidenceForm.creator_handle.trim() || null,
              title: evidenceForm.title.trim() || null,
              thumbnail_url: evidenceForm.thumbnail_url.trim() || null,
              hook_transcript: evidenceForm.hook_transcript.trim() || null,
              metrics,
              retrieval_method: 'codex_browser',
              retrieval_notes: evidenceForm.retrieval_notes.trim() || null,
            },
          ],
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `Evidence store HTTP ${response.status}`)
      setEvidenceForm(EMPTY_EVIDENCE_FORM)
      setEvidenceNotice('Recorded public evidence stored.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to store recorded evidence')
    } finally {
      setSubmittingEvidence(false)
    }
  }, [authedFetch, evidenceForm, load])

  const linkResearchPattern = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLinkNotice(null)

    if (!selectedPacketId || !selectedInsightId) {
      setError('Choose a research packet and Shaka insight before linking a pattern.')
      return
    }

    setLinkingPattern(true)
    try {
      const response = await authedFetch(`/api/admin/agents/work-items/${selectedInsightId}/research-packets`, {
        method: 'POST',
        body: JSON.stringify({
          packet_ids: [selectedPacketId],
          decision_note: linkDecisionNote.trim() || null,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `Pattern link HTTP ${response.status}`)
      setLinkDecisionNote('')
      setLinkNotice('Research pattern linked to Shaka insight.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link research pattern')
    } finally {
      setLinkingPattern(false)
    }
  }, [authedFetch, linkDecisionNote, load, selectedInsightId, selectedPacketId])

  const linkSuggestedResearchPattern = useCallback(async (item: AgentWorkItem) => {
    const packetIds = suggestedResearchPacketIds(item)
    if (!packetIds.length) {
      setError('No suggested research packets are available for this Shaka insight.')
      return
    }

    setError(null)
    setLinkNotice(null)
    setLinkingSuggestedInsightId(item.id)
    try {
      const response = await authedFetch(`/api/admin/agents/work-items/${item.id}/research-packets`, {
        method: 'POST',
        body: JSON.stringify({
          packet_ids: packetIds,
          decision_note: 'Linked suggested public research pattern from Content Intelligence backlog.',
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `Suggested pattern link HTTP ${response.status}`)
      const linkedPatterns = packets
        .filter((packet) => packetIds.includes(packet.id))
        .map((packet) => ({
          packet_id: packet.id,
          source_url: packet.source_url,
          platform: packet.platform,
          creator_name: packet.creator_name,
          creator_handle: packet.creator_handle,
          title: packet.title,
          outlier_score: packet.outlier_score,
          pattern_status: packet.pattern_status,
        }))
      setInsights((current) => current.map((currentItem) => {
        if (currentItem.id !== item.id) return currentItem
        const nextItem = (body.work_item ?? currentItem) as AgentWorkItem
        const metadata = recordValue(nextItem.metadata)
        const insight = recordValue(metadata.insight)
        const existingPatterns = Array.isArray(insight.approved_research_patterns)
          ? insight.approved_research_patterns
          : []
        return {
          ...nextItem,
          metadata: {
            ...metadata,
            insight: {
              ...insight,
              approved_research_patterns: [
                ...existingPatterns.filter((pattern) => !packetIds.includes(String(recordValue(pattern).packet_id ?? ''))),
                ...linkedPatterns,
              ],
            },
          },
        }
      }))
      setLinkNotice('Suggested research linked to Shaka insight.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link suggested research')
    } finally {
      setLinkingSuggestedInsightId(null)
    }
  }, [authedFetch, packets])

  const prepareChannelReviewDrafts = useCallback(async (insightId: string) => {
    setError(null)
    setReviewDraftNotice(null)
    setPreparingReviewInsightId(insightId)
    try {
      const response = await authedFetch(`/api/admin/agents/work-items/${insightId}/social-channels/prepare-review-drafts`, {
        method: 'POST',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `Review draft HTTP ${response.status}`)
      if (body.work_item) {
        setInsights((current) => current.map((item) => (item.id === insightId ? body.work_item : item)))
      } else {
        await load()
      }
      setReviewDraftNotice('LinkedIn, YouTube Shorts, Instagram Reels, and TikTok review drafts are ready for human approval.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare channel review drafts')
    } finally {
      setPreparingReviewInsightId(null)
    }
  }, [authedFetch, load])

  const requestDailyActivationReview = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setActivationNotice(null)
    setRequestingActivation(true)
    try {
      const response = await authedFetch('/api/admin/social-content/intelligence/daily-digest/activation-request', {
        method: 'POST',
        body: JSON.stringify({
          cadence: 'daily',
          lookback_days: digest?.lookback_days ?? 5,
          scope_note: activationScopeNote.trim() || null,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `Activation request HTTP ${response.status}`)
      setActivationScopeNote('')
      setActivationNotice('Daily activation review added to Agentic Dashboard backlog.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request daily activation review')
    } finally {
      setRequestingActivation(false)
    }
  }, [activationScopeNote, authedFetch, digest?.lookback_days])

  const createCalendarItem = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setCalendarNotice(null)

    if (!calendarForm.title.trim() || !calendarForm.scheduled_for) {
      setError('Calendar item title and due time are required.')
      return
    }

    setCreatingCalendarItem(true)
    try {
      const formMetadata = recordValue(calendarForm.metadata)
      const templateKey = typeof formMetadata.template_key === 'string'
        && formMetadata.template_key in SOCIAL_CONTENT_CALENDAR_TEMPLATES
        ? formMetadata.template_key as keyof typeof SOCIAL_CONTENT_CALENDAR_TEMPLATES
        : null
      const milestoneKey = typeof formMetadata.milestone_key === 'string'
        ? formMetadata.milestone_key
        : null
      const metadata = templateKey && milestoneKey
        ? templateMetadataFor(templateKey, milestoneKey, selectedCalendarCampaign)
        : formMetadata
      const response = await authedFetch('/api/admin/social-content/calendar', {
        method: 'POST',
        body: JSON.stringify({
          ...calendarForm,
          campaign_id: calendarForm.campaign_id || null,
          planned_angle: calendarForm.planned_angle.trim() || null,
          scheduled_for: new Date(calendarForm.scheduled_for).toISOString(),
          metadata,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `Calendar create HTTP ${response.status}`)
      setCalendarForm(EMPTY_CALENDAR_FORM)
      setCalendarNotice('Calendar item planned. Human authorization remains pending.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create calendar item')
    } finally {
      setCreatingCalendarItem(false)
    }
  }, [authedFetch, calendarForm, load, selectedCalendarCampaign])

  const applyTemplateMilestone = useCallback((
    templateKey: keyof typeof SOCIAL_CONTENT_CALENDAR_TEMPLATES,
    milestoneKey: string,
  ) => {
    const template = SOCIAL_CONTENT_CALENDAR_TEMPLATES[templateKey]
    const milestone = template.milestones.find((candidate) => candidate.key === milestoneKey)
    if (!milestone) return

    setCalendarForm((current) => {
      const campaign = campaigns.find((candidate) => candidate.id === current.campaign_id) ?? null
      return {
        ...current,
        title: `${milestone.title_prefix}${campaign?.name ? `: ${campaign.name}` : ''}`,
        channel: milestone.channel,
        campaign_phase: milestone.campaign_phase,
        planned_angle: milestone.planned_angle,
        metadata: templateMetadataFor(templateKey, milestone.key, campaign),
      }
    })
    setCalendarNotice(`${template.label}: ${milestone.title_prefix} loaded into the planner.`)
  }, [campaigns])

  const authorizeCalendarItem = useCallback(async (item: CalendarItem) => {
    setError(null)
    setCalendarNotice(null)
    setCalendarActionItemId(item.id)
    try {
      const response = await authedFetch(`/api/admin/social-content/calendar/${item.id}/authorize`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `Calendar authorize HTTP ${response.status}`)
      setCalendarNotice(body.handoff?.social_content_id
        ? 'Draft handoff authorized and Social Content draft created.'
        : 'Draft handoff authorized for channel planning.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to authorize calendar item')
    } finally {
      setCalendarActionItemId(null)
    }
  }, [authedFetch, load])

  const rejectCalendarItem = useCallback(async (item: CalendarItem) => {
    const decisionNote = calendarDecisionNotes[item.id]?.trim() ?? ''
    if (!decisionNote) {
      setRejectingCalendarItemId(item.id)
      setError('Decision note is required when rejecting a calendar item.')
      return
    }

    setError(null)
    setCalendarNotice(null)
    setCalendarActionItemId(item.id)
    try {
      const response = await authedFetch(`/api/admin/social-content/calendar/${item.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ decision_note: decisionNote }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `Calendar reject HTTP ${response.status}`)
      setCalendarDecisionNotes((current) => ({ ...current, [item.id]: '' }))
      setRejectingCalendarItemId(null)
      setCalendarNotice('Calendar item rejected and returned to Shaka for revision.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject calendar item')
    } finally {
      setCalendarActionItemId(null)
    }
  }, [authedFetch, calendarDecisionNotes, load])

  const beginEditCalendarItem = useCallback((item: CalendarItem) => {
    setEditingCalendarItemId(item.id)
    setCalendarEditForms((current) => ({
      ...current,
      [item.id]: {
        title: item.title,
        campaign_id: item.campaign_id ?? '',
        channel: item.channel,
        campaign_phase: item.campaign_phase,
        scheduled_for: toDatetimeLocalValue(item.scheduled_for),
        planned_angle: item.planned_angle ?? '',
      },
    }))
  }, [])

  const cancelEditCalendarItem = useCallback((id: string) => {
    setEditingCalendarItemId((current) => (current === id ? null : current))
  }, [])

  const updateCalendarEditForm = useCallback((id: string, patch: Partial<CalendarForm>) => {
    setCalendarEditForms((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? EMPTY_CALENDAR_FORM),
        ...patch,
      },
    }))
  }, [])

  const saveCalendarItemEdits = useCallback(async (item: CalendarItem) => {
    const form = calendarEditForms[item.id]
    if (!form?.title.trim() || !form.scheduled_for) {
      setError('Calendar item title and due time are required.')
      return
    }

    setError(null)
    setCalendarNotice(null)
    setCalendarActionItemId(item.id)
    try {
      const response = await authedFetch(`/api/admin/social-content/calendar/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: form.title.trim(),
          campaign_id: form.campaign_id || null,
          channel: form.channel,
          campaign_phase: form.campaign_phase,
          planned_angle: form.planned_angle.trim() || null,
          scheduled_for: new Date(form.scheduled_for).toISOString(),
          authorization_status: 'pending',
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `Calendar update HTTP ${response.status}`)
      setEditingCalendarItemId(null)
      setCalendarNotice(item.authorization_status === 'rejected'
        ? 'Calendar item updated and returned to pending review.'
        : 'Calendar item updated. Human authorization remains pending.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update calendar item')
    } finally {
      setCalendarActionItemId(null)
    }
  }, [authedFetch, calendarEditForms, load])

  return (
    <div className="agent-ops-page min-h-screen p-5 text-foreground lg:p-7">
      <div className="mx-auto max-w-7xl">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Content Intelligence' },
        ]} />

        <header className="agent-ops-surface-header mb-6 mt-5 flex flex-col gap-4 rounded-xl border p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="agent-ops-eyebrow mb-2">
              <FileSearch size={16} />
              Content Intelligence
            </div>
            <h1 className="text-3xl font-bold">Research and Shaka insight queue</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Public creator research stays read-only. Shaka insights stay centralized in the Agentic Dashboard backlog, then feed LinkedIn, YouTube Shorts, Instagram Reels, and thumbnail lanes.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="agent-ops-button-secondary disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </header>

        {error ? (
          <div className="mb-6 rounded-lg border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="mb-6 grid gap-3 md:grid-cols-4">
          <MetricCard label="Research packets" value={packets.length} />
          <MetricCard label="Shaka insights" value={insights.length} />
          <MetricCard label="Top outlier score" value={strongestPacket ? Math.round(Number(strongestPacket.outlier_score)) : 0} />
          <MetricCard label="Paid scraper runs" value={0} tone="amber" />
        </div>

        <SectionTabs
          activeSection={activeSection}
          onChange={setActiveSection}
          counts={{
            calendar: calendarItems.length,
            digest: digest ? digest.summary.new_research_packets + digest.summary.shaka_insights : 0,
            evidence: researchPlatforms.length,
            research: packets.length,
            insights: insights.length,
          }}
        />

        {activeSection === 'calendar' ? (
        <section className="agent-ops-card mb-6 rounded-lg border p-4">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="agent-ops-eyebrow mb-2">
                <CalendarDays size={16} />
                Content Calendar
              </div>
              <h2 className="text-lg font-semibold">Campaign arc and due gates</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Channel-agnostic plan tied to campaigns and Shaka insights. Authorization prepares internal draft handoffs only.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              External publishing locked
            </span>
          </div>

          <CollapsiblePanel
            title="Template research library"
            panelKey="templateLibrary"
            expanded={expandedPanels.templateLibrary}
            onToggle={togglePanel}
            className="mb-4 border-blue-500/25 bg-blue-500/10"
            icon={<Info className="h-4 w-4 text-blue-100" />}
            tooltip="Source-backed milestone models available before any campaign plan is generated."
            rightSlot={(
              <span className="inline-flex w-fit rounded-full border border-blue-300/25 px-2.5 py-1 text-[0.68rem] font-semibold text-blue-100">
                {SOCIAL_CONTENT_CALENDAR_TEMPLATE_KEYS.length} templates
              </span>
            )}
          >
            <div className="grid gap-2 xl:grid-cols-4">
              {pagedTemplateKeys.map((key) => {
                const template = SOCIAL_CONTENT_CALENDAR_TEMPLATES[key]
                return (
                  <div key={key} className="rounded-lg border border-blue-300/20 bg-background/35 p-3">
                    <p className="text-xs font-semibold text-blue-50">{template.label}</p>
                    <p className="mt-1 line-clamp-3 text-[0.68rem] leading-5 text-blue-100/75">
                      {template.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {template.goal_types.slice(0, 2).map((goal) => (
                        <span key={goal} className="rounded-full border border-blue-300/20 px-2 py-0.5 text-[0.62rem] text-blue-100/70">
                          {goal.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {template.milestones.map((milestone) => (
                        <div key={milestone.key} className="flex items-center justify-between gap-2 rounded-md border border-blue-300/10 bg-background/25 px-2 py-1.5 text-[0.66rem] text-blue-100/75">
                          <div className="min-w-0">
                            <span className="block font-semibold text-blue-100">
                              {CAMPAIGN_PHASE_LABELS[milestone.campaign_phase]}
                            </span>
                            <span className="block truncate">
                              {CALENDAR_CHANNEL_LABELS[milestone.channel]} · {milestone.recommended_lead_time_days}d lead
                            </span>
                          </div>
                          <button
                            type="button"
                            aria-label={`Use ${template.label} ${CAMPAIGN_PHASE_LABELS[milestone.campaign_phase]} milestone`}
                            onClick={() => applyTemplateMilestone(key, milestone.key)}
                            className="shrink-0 rounded-md border border-blue-300/25 px-2 py-1 text-[0.62rem] font-semibold text-blue-50 transition hover:bg-blue-500/20"
                          >
                            Use
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {template.source_urls.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-blue-300/20 px-2 py-0.5 text-[0.62rem] font-semibold text-blue-100/80 hover:bg-blue-500/20"
                        >
                          {calendarSourceLabel(url)}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <Pagination
              page={templatePage}
              totalPages={templateTotalPages}
              total={SOCIAL_CONTENT_CALENDAR_TEMPLATE_KEYS.length}
              pageSize={TEMPLATE_PAGE_SIZE}
              onPageChange={setTemplatePage}
            />
          </CollapsiblePanel>

          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Campaign
              <select
                value={calendarCampaignFilter}
                onChange={(event) => setCalendarCampaignFilter(event.target.value)}
                className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
              >
                <option value="">All campaigns</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Channel
              <select
                value={calendarChannelFilter}
                onChange={(event) => setCalendarChannelFilter(event.target.value)}
                className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
              >
                <option value="">All channels</option>
                {Object.entries(CALENDAR_CHANNEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Phase
              <select
                value={calendarPhaseFilter}
                onChange={(event) => setCalendarPhaseFilter(event.target.value)}
                className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
              >
                <option value="">All phases</option>
                {CALENDAR_PHASES.map((phase) => (
                  <option key={phase.key} value={phase.key}>{phase.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Authorization
              <select
                value={calendarAuthorizationFilter}
                onChange={(event) => setCalendarAuthorizationFilter(event.target.value)}
                className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
              >
                <option value="">All states</option>
                <option value="pending">Pending</option>
                <option value="authorized">Authorized</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
                <option value="not_required">Not required</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 xl:grid-cols-4">
            {CALENDAR_PHASES.map((phase) => (
              <div key={phase.key} className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{phase.label}</h3>
                  <span className="rounded-full border border-silicon-slate/70 px-2 py-0.5 text-xs text-muted-foreground">
                    {calendarItemsByPhase[phase.key].length}
                  </span>
                </div>
                <div className="space-y-2">
                  {calendarItemsByPhase[phase.key].length ? calendarItemsByPhase[phase.key].map((item) => (
                    <CalendarItemCard
                      key={item.id}
                      item={item}
                      actionItemId={calendarActionItemId}
                      rejectingItemId={rejectingCalendarItemId}
                      decisionNote={calendarDecisionNotes[item.id] ?? ''}
                      editForm={calendarEditForms[item.id] ?? null}
                      isEditing={editingCalendarItemId === item.id}
                      campaigns={campaigns}
                      onAuthorize={authorizeCalendarItem}
                      onBeginEdit={beginEditCalendarItem}
                      onCancelEdit={cancelEditCalendarItem}
                      onEditFormChange={updateCalendarEditForm}
                      onSaveEdit={saveCalendarItemEdits}
                      onBeginReject={(id) => setRejectingCalendarItemId(id)}
                      onDecisionNoteChange={(id, value) => setCalendarDecisionNotes((current) => ({
                        ...current,
                        [id]: value,
                      }))}
                      onReject={rejectCalendarItem}
                    />
                  )) : (
                    <p className="rounded-md border border-silicon-slate/60 bg-background/35 p-3 text-xs text-muted-foreground">
                      No planned items.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <CollapsiblePanel
            title="Plan calendar item"
            panelKey="calendarPlanner"
            expanded={expandedPanels.calendarPlanner}
            onToggle={togglePanel}
            className="mt-4 border-radiant-gold/35 bg-radiant-gold/10"
            icon={<Plus className="h-4 w-4 text-radiant-gold" />}
            tooltip="Creates a pending calendar gate only. Use a template milestone above or plan manually."
            rightSlot={calendarNotice ? (
              <span className="inline-flex w-fit rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                {calendarNotice}
              </span>
            ) : null}
          >
          <form onSubmit={createCalendarItem}>
            {(() => {
              const metadata = recordValue(calendarForm.metadata)
              const templateLabel = typeof metadata.template_label === 'string' ? metadata.template_label : null
              const milestoneKey = typeof metadata.milestone_key === 'string' ? metadata.milestone_key : null
              const sourceLabels = metadataStringArray(metadata.source_labels)
              if (!templateLabel) return null

              return (
                <div className="mb-3 rounded-md border border-radiant-gold/30 bg-background/35 p-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-radiant-gold">Template applied: </span>
                  {templateLabel}{milestoneKey ? ` · ${milestoneKey.replace(/_/g, ' ')}` : ''}
                  {sourceLabels.length > 0 ? (
                    <span className="ml-2 text-muted-foreground">
                      Source: {sourceLabels.slice(0, 2).join(', ')}
                    </span>
                  ) : null}
                </div>
              )
            })()}
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_14rem_12rem]">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Title
                <input
                  required
                  type="text"
                  value={calendarForm.title}
                  onChange={(event) => setCalendarForm((current) => ({ ...current, title: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Scheduled for
                <input
                  required
                  type="datetime-local"
                  value={calendarForm.scheduled_for}
                  onChange={(event) => setCalendarForm((current) => ({ ...current, scheduled_for: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Channel
                <select
                  value={calendarForm.channel}
                  onChange={(event) => setCalendarForm((current) => ({ ...current, channel: event.target.value as CalendarItem['channel'] }))}
                  className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                >
                  {Object.entries(CALENDAR_CHANNEL_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-[14rem_1fr]">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Phase
                <select
                  value={calendarForm.campaign_phase}
                  onChange={(event) => setCalendarForm((current) => ({ ...current, campaign_phase: event.target.value as CalendarItem['campaign_phase'] }))}
                  className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                >
                  {CALENDAR_PHASES.map((phase) => (
                    <option key={phase.key} value={phase.key}>{phase.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Campaign
                <select
                  value={calendarForm.campaign_id}
                  onChange={(event) => setCalendarForm((current) => ({ ...current, campaign_id: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                >
                  <option value="">No campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Planned angle
              <textarea
                value={calendarForm.planned_angle}
                onChange={(event) => setCalendarForm((current) => ({ ...current, planned_angle: event.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
              />
            </label>
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={creatingCalendarItem}
                className="agent-ops-button-primary disabled:opacity-60"
              >
                <Plus size={16} />
                {creatingCalendarItem ? 'Planning...' : 'Plan Item'}
              </button>
            </div>
          </form>
          </CollapsiblePanel>
        </section>
        ) : null}

        {activeSection === 'digest' ? (
        <section className="agent-ops-card mb-6 rounded-lg border p-4">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="agent-ops-eyebrow mb-2">
                <CalendarDays size={16} />
                Daily review digest
              </div>
              <h2 className="text-lg font-semibold">What Shaka should review next</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Read-only digest from public research and central backlog items. Activation, drafting, media generation, upload, schedule, and publish gates stay locked.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              No side effects
            </span>
          </div>
          <CollapsiblePanel
            title="Activation review"
            panelKey="digestActivation"
            expanded={expandedPanels.digestActivation}
            onToggle={togglePanel}
            className="mb-4 border-radiant-gold/35 bg-radiant-gold/10"
            icon={<CheckCircle2 className="h-4 w-4 text-radiant-gold" />}
            tooltip="Creates a backlog review item only. Cron activation, Apify collection, drafting, media, uploads, scheduling, and publishing remain locked."
            rightSlot={activationNotice ? (
              <span className="inline-flex w-fit rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                {activationNotice}
              </span>
            ) : null}
          >
          <form onSubmit={requestDailyActivationReview}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <label className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Activation review note
                <input
                  type="text"
                  value={activationScopeNote}
                  onChange={(event) => setActivationScopeNote(event.target.value)}
                  placeholder="Optional scope guidance before Shaka reviews the daily run."
                  className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                />
              </label>
              <button
                type="submit"
                disabled={requestingActivation}
                className="agent-ops-button-primary shrink-0 disabled:opacity-60"
              >
                <CheckCircle2 size={16} />
                {requestingActivation ? 'Requesting...' : 'Request Daily Activation Review'}
              </button>
            </div>
          </form>
          </CollapsiblePanel>
          {digest ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.45fr)]">
              <div className="grid gap-3 md:grid-cols-4">
                <DigestMetric label="New research" value={digest.summary.new_research_packets} />
                <DigestMetric label="Usable patterns" value={digest.summary.usable_patterns} />
                <DigestMetric label="Insights" value={digest.summary.shaka_insights} />
                <DigestMetric label="Blocked/privacy" value={digest.summary.blocked_or_sensitive_items} tone="amber" />
              </div>
              <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Governance</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <DigestPill label="Schedule" value={digest.governance.schedule_activation} />
                  <DigestPill label="Apify" value={digest.governance.apify_collection} />
                  <DigestPill label="Publish" value={digest.governance.publishing} />
                </div>
              </div>
              <DigestList
                title="Strongest patterns"
                empty="No usable patterns in the current lookback."
                items={digest.strongest_patterns.map((pattern) => ({
                  id: pattern.packet_id,
                  title: pattern.title,
                  detail: pattern.hook_structure ?? pattern.promise_value ?? pattern.pattern_status,
                  href: pattern.source_url,
                  meta: `Outlier ${Math.round(Number(pattern.outlier_score))}`,
                }))}
              />
              <DigestList
                title="Recommended insights"
                empty="No Shaka insight backlog items found."
                items={digest.recommended_insights.map((insight) => ({
                  id: insight.work_item_id,
                  title: insight.title,
                  detail: insight.why_vambah_can_speak ?? insight.triggering_event ?? insight.sensitivity,
                  href: `/admin/agents/social-insights/${insight.work_item_id}`,
                  meta: insight.status.replace(/_/g, ' '),
                }))}
              />
              <DigestList
                title="Channel lanes"
                empty="No channel lane suggestions yet."
                items={digest.suggested_channel_lanes.slice(0, 4).map((lane) => ({
                  id: `${lane.work_item_id}-${lane.channel}`,
                  title: `${lane.label}: ${lane.insight_title}`,
                  detail: lane.required_inputs.join(', '),
                  href: `/admin/agents/social-insights/${lane.work_item_id}`,
                  meta: lane.status.replace(/_/g, ' '),
                }))}
              />
              <DigestList
                title="Thumbnail opportunities"
                empty="No thumbnail opportunities in the current lookback."
                items={digest.thumbnail_opportunities.map((item) => ({
                  id: item.packet_id,
                  title: item.title,
                  detail: item.thumbnail_pattern ?? 'Review source thumbnail pattern.',
                  meta: 'thumbnail',
                }))}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 px-4 py-8 text-center text-sm text-muted-foreground">
              {loading ? 'Loading daily digest...' : 'Daily digest is not available yet.'}
            </div>
          )}
        </section>
        ) : null}

        {activeSection === 'evidence' ? (
        <section className="agent-ops-card mb-6 rounded-lg border p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Free-first evidence layer</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Codex/browser review and public manual evidence are the default research path. Paid scrapers are fallback tools only when a scoped source cannot be captured cheaply.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              Paid scraper approval required
            </span>
          </div>
          <CollapsiblePanel
            title="Source options"
            panelKey="evidenceSources"
            expanded={expandedPanels.evidenceSources}
            onToggle={togglePanel}
            className="mt-4 border-silicon-slate/70 bg-silicon-slate/10"
            icon={<Database className="h-4 w-4 text-radiant-gold" />}
            tooltip="Free captured evidence is the default. Paid scrapers stay behind scoped cost approval."
          >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ActorCard title="Default" actor="Recorded public evidence from Codex/browser review. Cost: $0." />
            <ActorCard title="YouTube fallback" actor="pintostudio/youtube-transcript-scraper only after cost approval" />
            <ActorCard title="YouTube data fallback" actor="streamers/youtube-scraper only after cost approval" />
            <ActorCard title="Instagram/TikTok fallback" actor="apify/instagram-scraper or clockworks/tiktok-scraper only after cost approval" />
          </div>
          </CollapsiblePanel>
          <CollapsiblePanel
            title="Add recorded public evidence"
            panelKey="evidenceForm"
            expanded={expandedPanels.evidenceForm}
            onToggle={togglePanel}
            className="mt-4 border-silicon-slate/70 bg-silicon-slate/20"
            icon={<FileSearch className="h-4 w-4 text-blue-200" />}
            tooltip="Free review packet. No scraper, generation, upload, schedule, or publish action."
            rightSlot={evidenceNotice ? (
              <span className="inline-flex w-fit rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                {evidenceNotice}
              </span>
            ) : null}
          >
          <form onSubmit={submitRecordedEvidence}>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_12rem]">
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Source URL
                <input
                  required
                  type="url"
                  value={evidenceForm.source_url}
                  onChange={(event) => setEvidenceForm((current) => ({ ...current, source_url: event.target.value }))}
                  placeholder="https://youtube.com/watch?v=..."
                  className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Platform
                <select
                  value={evidenceForm.platform}
                  onChange={(event) => setEvidenceForm((current) => ({ ...current, platform: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                >
                  <option value="youtube">YouTube</option>
                  <option value="youtube_shorts">YouTube Shorts</option>
                  <option value="instagram">Instagram</option>
                  <option value="instagram_reels">Instagram Reels</option>
                  <option value="tiktok">TikTok</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <EvidenceInput label="Title" value={evidenceForm.title} onChange={(value) => setEvidenceForm((current) => ({ ...current, title: value }))} />
              <EvidenceInput label="Creator" value={evidenceForm.creator_name} onChange={(value) => setEvidenceForm((current) => ({ ...current, creator_name: value }))} />
              <EvidenceInput label="Handle" value={evidenceForm.creator_handle} onChange={(value) => setEvidenceForm((current) => ({ ...current, creator_handle: value }))} />
              <EvidenceInput label="Thumbnail URL" value={evidenceForm.thumbnail_url} onChange={(value) => setEvidenceForm((current) => ({ ...current, thumbnail_url: value }))} />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <EvidenceInput label="Views" type="number" value={evidenceForm.views} onChange={(value) => setEvidenceForm((current) => ({ ...current, views: value }))} />
              <EvidenceInput label="Likes" type="number" value={evidenceForm.likes} onChange={(value) => setEvidenceForm((current) => ({ ...current, likes: value }))} />
              <EvidenceInput label="Comments" type="number" value={evidenceForm.comments} onChange={(value) => setEvidenceForm((current) => ({ ...current, comments: value }))} />
              <EvidenceInput label="Followers" type="number" value={evidenceForm.follower_count} onChange={(value) => setEvidenceForm((current) => ({ ...current, follower_count: value }))} />
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <EvidenceTextarea label="Hook or first 30 seconds" value={evidenceForm.hook_transcript} onChange={(value) => setEvidenceForm((current) => ({ ...current, hook_transcript: value }))} />
              <EvidenceTextarea label="Notes" value={evidenceForm.retrieval_notes} onChange={(value) => setEvidenceForm((current) => ({ ...current, retrieval_notes: value }))} />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={submittingEvidence}
                className="agent-ops-button-primary disabled:opacity-60"
              >
                <FileSearch size={16} />
                {submittingEvidence ? 'Storing...' : 'Store Evidence Packet'}
              </button>
            </div>
          </form>
          </CollapsiblePanel>
        </section>
        ) : null}

        {activeSection === 'research' || activeSection === 'insights' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.45fr)]">
          {activeSection === 'research' ? (
          <section className="agent-ops-card rounded-lg border p-4">
            <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Public creator research</h2>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Evidence packets and reusable patterns.</span>
                  <InfoTooltip label="Preserves source transparency without copying creator scripts, titles, thumbnails, or visual identity." />
                </div>
              </div>
            </div>
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading research packets...</div>
            ) : packets.length ? (
              <div className="space-y-4">
                {insights.length ? (
                  <CollapsiblePanel
                    title="Link pattern to Shaka insight"
                    panelKey="patternLink"
                    expanded={expandedPanels.patternLink}
                    onToggle={togglePanel}
                    className="border-radiant-gold/35 bg-radiant-gold/10"
                    icon={<CheckCircle2 className="h-4 w-4 text-radiant-gold" />}
                    tooltip="Adds the reusable pattern to the central backlog item. No draft, media, upload, schedule, or publish action runs."
                    rightSlot={linkNotice ? (
                      <span className="inline-flex w-fit rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                        {linkNotice}
                      </span>
                    ) : null}
                  >
                  <form onSubmit={linkResearchPattern}>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Research packet
                        <select
                          value={selectedPacketId}
                          onChange={(event) => setSelectedPacketId(event.target.value)}
                          className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                        >
                          {packets.map((packet) => (
                            <option key={packet.id} value={packet.id}>
                              {(packet.title ?? packet.creator_name ?? packet.source_url).slice(0, 90)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Shaka insight
                        <select
                          value={selectedInsightId}
                          onChange={(event) => setSelectedInsightId(event.target.value)}
                          className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                        >
                          {insights.map((item) => (
                            <option key={item.id} value={item.id}>
                              {insightFor(item).title.slice(0, 90)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Decision note
                      <textarea
                        value={linkDecisionNote}
                        onChange={(event) => setLinkDecisionNote(event.target.value)}
                        rows={2}
                        placeholder="Why this source pattern is safe and useful for this insight."
                        className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                      />
                    </label>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="submit"
                        disabled={linkingPattern}
                        className="agent-ops-button-primary disabled:opacity-60"
                      >
                        <CheckCircle2 size={16} />
                        {linkingPattern ? 'Linking...' : 'Link Pattern'}
                      </button>
                    </div>
                  </form>
                  </CollapsiblePanel>
                ) : null}
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_14rem]">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Search
                    <span className="mt-1 flex items-center gap-2 rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <input
                        type="search"
                        value={researchSearch}
                        onChange={(event) => setResearchSearch(event.target.value)}
                        placeholder="Title, creator, source, hook..."
                        className="w-full bg-transparent text-sm normal-case tracking-normal text-foreground outline-none"
                      />
                    </span>
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Platform
                    <select
                      value={researchPlatformFilter}
                      onChange={(event) => setResearchPlatformFilter(event.target.value)}
                      className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                    >
                      <option value="">All platforms</option>
                      {researchPlatforms.map((platform) => (
                        <option key={platform} value={platform}>{platform.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pattern
                    <select
                      value={researchPatternFilter}
                      onChange={(event) => setResearchPatternFilter(event.target.value)}
                      className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                    >
                      <option value="">All pattern states</option>
                      {researchPatternStatuses.map((status) => (
                        <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="overflow-x-auto rounded-lg border border-silicon-slate/70">
                  <table className="min-w-full divide-y divide-silicon-slate/70 text-sm">
                    <thead className="bg-silicon-slate/35 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left">
                          <SortButton active={researchSort === 'title'} direction={researchSortDirection} onClick={() => {
                            setResearchSort('title')
                            setResearchSortDirection(researchSort === 'title' && researchSortDirection === 'asc' ? 'desc' : 'asc')
                          }}>
                            Source
                          </SortButton>
                        </th>
                        <th scope="col" className="px-3 py-2 text-left">Platform</th>
                        <th scope="col" className="px-3 py-2 text-right">
                          <SortButton active={researchSort === 'score'} direction={researchSortDirection} onClick={() => {
                            setResearchSort('score')
                            setResearchSortDirection(researchSort === 'score' && researchSortDirection === 'desc' ? 'asc' : 'desc')
                          }}>
                            Outlier
                          </SortButton>
                        </th>
                        <th scope="col" className="px-3 py-2 text-left">Pattern</th>
                        <th scope="col" className="px-3 py-2 text-right">
                          <SortButton active={researchSort === 'retrieved'} direction={researchSortDirection} onClick={() => {
                            setResearchSort('retrieved')
                            setResearchSortDirection(researchSort === 'retrieved' && researchSortDirection === 'desc' ? 'asc' : 'desc')
                          }}>
                            Retrieved
                          </SortButton>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-silicon-slate/60 bg-background/20">
                      {pagedResearchPackets.map((packet) => (
                        <tr key={packet.id} className="align-top">
                          <td className="max-w-md px-3 py-3">
                            <a href={packet.source_url} target="_blank" rel="noreferrer" className="font-semibold text-blue-100 hover:text-blue-50">
                              {packet.title ?? packet.caption ?? packet.source_url}
                            </a>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {packet.creator_name ?? packet.creator_handle ?? 'Creator unknown'}
                            </p>
                            {packet.hook_transcript ? (
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground" title={packet.hook_transcript}>
                                Hook: {packet.hook_transcript}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-100">
                              {platformIcon(packet.platform)}
                              {packet.platform.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right font-semibold text-radiant-gold">
                            {Math.round(Number(packet.outlier_score))}
                          </td>
                          <td className="px-3 py-3">
                            <span className="rounded-full border border-silicon-slate/70 px-2 py-0.5 text-xs text-muted-foreground">
                              {packet.pattern_status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-xs text-muted-foreground">
                            {new Date(packet.retrieved_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredResearchPackets.length ? (
                  <Pagination
                    page={researchPage}
                    totalPages={researchTotalPages}
                    total={filteredResearchPackets.length}
                    pageSize={TABLE_PAGE_SIZE}
                    onPageChange={setResearchPage}
                  />
                ) : (
                  <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 px-4 py-8 text-center text-sm text-muted-foreground">
                    No research packets match the current filters.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 px-4 py-12 text-center text-sm text-muted-foreground">
                No research packets have been stored yet. Store free recorded public evidence first; use paid scrapers only after explicit approval.
              </div>
            )}
          </section>
          ) : null}

          {activeSection === 'insights' ? (
          <section className="agent-ops-card rounded-lg border p-4">
            <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Shaka insight backlog</h2>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Central Agentic Dashboard work items.</span>
                  <InfoTooltip label="Social Content pages filter this same backlog instead of creating a separate queue." />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Search
                  <span className="mt-1 flex items-center gap-2 rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="search"
                      value={insightSearch}
                      onChange={(event) => setInsightSearch(event.target.value)}
                      placeholder="Title, triggering event, why now..."
                      className="w-full bg-transparent text-sm normal-case tracking-normal text-foreground outline-none"
                    />
                  </span>
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                  <select
                    value={insightStatusFilter}
                    onChange={(event) => setInsightStatusFilter(event.target.value)}
                    className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                  >
                    <option value="">All states</option>
                    {insightStatuses.map((status) => (
                      <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </label>
              </div>
              {reviewDraftNotice ? (
                <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                  {reviewDraftNotice}
                </div>
              ) : null}
              {linkNotice ? (
                <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                  {linkNotice}
                </div>
              ) : null}
              {insights.length ? (
                <>
                  <div className="overflow-x-auto rounded-lg border border-silicon-slate/70">
                    <table className="min-w-full divide-y divide-silicon-slate/70 text-sm">
                      <thead className="bg-silicon-slate/35 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left">
                            <SortButton active={insightSort === 'title'} direction={insightSortDirection} onClick={() => {
                              setInsightSort('title')
                              setInsightSortDirection(insightSort === 'title' && insightSortDirection === 'asc' ? 'desc' : 'asc')
                            }}>
                              Insight
                            </SortButton>
                          </th>
                          <th scope="col" className="px-3 py-2 text-left">Status</th>
                          <th scope="col" className="px-3 py-2 text-left">Channel review</th>
                          <th scope="col" className="px-3 py-2 text-right">
                            <SortButton active={insightSort === 'priority'} direction={insightSortDirection} onClick={() => {
                              setInsightSort('priority')
                              setInsightSortDirection(insightSort === 'priority' && insightSortDirection === 'desc' ? 'asc' : 'desc')
                            }}>
                              Priority
                            </SortButton>
                          </th>
                          <th scope="col" className="px-3 py-2 text-right">
                            <SortButton active={insightSort === 'updated'} direction={insightSortDirection} onClick={() => {
                              setInsightSort('updated')
                              setInsightSortDirection(insightSort === 'updated' && insightSortDirection === 'desc' ? 'asc' : 'desc')
                            }}>
                              Updated
                            </SortButton>
                          </th>
                          <th scope="col" className="px-3 py-2 text-right">Next step</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-silicon-slate/60 bg-background/20">
                        {pagedInsights.map((item) => {
                          const insight = insightFor(item)
                          const linkedinStatus = channelLaneStatus(item, 'linkedin')
                          const youtubeStatus = channelLaneStatus(item, 'youtube_shorts')
                          const instagramStatus = channelLaneStatus(item, 'instagram_reels')
                          const tiktokStatus = channelLaneStatus(item, 'tiktok')
                          const hasReviewDrafts = hasPrimaryChannelReviewDrafts(item)
                          const hasApprovedResearch = hasApprovedResearchPatterns(item)
                          const suggestedPacketIds = suggestedResearchPacketIds(item)
                          const isPreparingReview = preparingReviewInsightId === item.id
                          const isLinkingSuggested = linkingSuggestedInsightId === item.id
                          return (
                            <tr key={item.id} className="align-top">
                              <td className="max-w-xl px-3 py-3">
                                <Link href={`/admin/agents/social-insights/${item.id}`} className="font-semibold text-blue-100 hover:text-blue-50">
                                  {insight.title}
                                </Link>
                                {insight.triggeringEvent ? (
                                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                    {insight.triggeringEvent}
                                  </p>
                                ) : null}
                                {insight.whyVambahCanSpeak ? (
                                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground" title={insight.whyVambahCanSpeak}>
                                    Why now: {insight.whyVambahCanSpeak}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-3 py-3">
                                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-100">
                                  {item.status.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex flex-col gap-1.5">
                                  <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs ${channelReviewPillClass(linkedinStatus)}`}>
                                    LinkedIn: {linkedinStatus.replace(/_/g, ' ')}
                                  </span>
                                  <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs ${channelReviewPillClass(youtubeStatus)}`}>
                                    YouTube: {youtubeStatus.replace(/_/g, ' ')}
                                  </span>
                                  <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs ${channelReviewPillClass(instagramStatus)}`}>
                                    Instagram: {instagramStatus.replace(/_/g, ' ')}
                                  </span>
                                  <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs ${channelReviewPillClass(tiktokStatus)}`}>
                                    TikTok: {tiktokStatus.replace(/_/g, ' ')}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right text-xs font-semibold text-radiant-gold">
                                {item.priority.replace(/_/g, ' ')}
                              </td>
                              <td className="px-3 py-3 text-right text-xs text-muted-foreground">
                                {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : 'Unknown'}
                              </td>
                              <td className="px-3 py-3 text-right">
                                <div className="flex flex-col items-end gap-2">
                                  {!hasApprovedResearch && suggestedPacketIds.length ? (
                                    <button
                                      type="button"
                                      onClick={() => linkSuggestedResearchPattern(item)}
                                      disabled={isLinkingSuggested}
                                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-radiant-gold/45 bg-radiant-gold/10 px-3 py-1.5 text-xs font-semibold text-radiant-gold transition hover:bg-radiant-gold/15 disabled:opacity-60"
                                    >
                                      <CheckCircle2 size={14} />
                                      {isLinkingSuggested ? 'Linking...' : 'Link Suggested Research'}
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => prepareChannelReviewDrafts(item.id)}
                                    disabled={isPreparingReview || !hasApprovedResearch}
                                    title={hasApprovedResearch ? undefined : 'Link an approved research pattern before preparing review drafts.'}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/45 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/15 disabled:opacity-60"
                                  >
                                    <FileText size={14} />
                                    {isPreparingReview ? 'Preparing...' : hasReviewDrafts ? 'Refresh Review Drafts' : 'Prepare Review Drafts'}
                                  </button>
                                  {hasReviewDrafts ? (
                                    <Link href={`/admin/agents/social-insights/${item.id}`} className="text-xs text-blue-200 hover:text-blue-100">
                                      Open human review
                                    </Link>
                                  ) : !hasApprovedResearch ? (
                                    <span className="text-[0.68rem] text-muted-foreground">Research link required</span>
                                  ) : (
                                    <span className="text-[0.68rem] text-muted-foreground">No publish action</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {filteredInsights.length ? (
                    <Pagination
                      page={insightPage}
                      totalPages={insightTotalPages}
                      total={filteredInsights.length}
                      pageSize={TABLE_PAGE_SIZE}
                      onPageChange={setInsightPage}
                    />
                  ) : (
                    <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 px-4 py-8 text-center text-sm text-muted-foreground">
                      No Shaka insight items match the current filters.
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 px-4 py-10 text-center text-sm text-muted-foreground">
                  No Shaka insight work items found.
                </div>
              )}
            </div>
          </section>
          ) : null}
        </div>
        ) : null}
      </div>
    </div>
  )
}

function SectionTabs({
  activeSection,
  onChange,
  counts,
}: {
  activeSection: IntelligenceSection
  onChange: (section: IntelligenceSection) => void
  counts: Record<IntelligenceSection, number>
}) {
  return (
    <nav aria-label="Content intelligence sections" className="mb-6 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-2">
      <div className="grid gap-2 md:grid-cols-5">
        {SECTION_TABS.map((section) => {
          const isActive = section.key === activeSection
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => onChange(section.key)}
              aria-pressed={isActive}
              title={section.description}
              className={`flex min-h-16 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition ${
                isActive
                  ? 'border-radiant-gold/55 bg-radiant-gold/15 text-radiant-gold'
                  : 'border-silicon-slate/60 bg-background/30 text-muted-foreground hover:border-white/30 hover:text-foreground'
              }`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{section.label}</span>
                <span className="mt-0.5 block truncate text-[0.68rem] opacity-80">{section.description}</span>
              </span>
              <span className="shrink-0 rounded-full border border-current/30 px-2 py-0.5 text-xs font-semibold">
                {counts[section.key]}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function CollapsiblePanel({
  title,
  panelKey,
  expanded,
  onToggle,
  children,
  className = '',
  icon,
  tooltip,
  rightSlot,
}: {
  title: string
  panelKey: string
  expanded: boolean
  onToggle: (key: string) => void
  children: ReactNode
  className?: string
  icon?: ReactNode
  tooltip?: string
  rightSlot?: ReactNode
}) {
  const contentId = `content-intelligence-${panelKey}`
  return (
    <div className={`rounded-lg border p-3 ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => onToggle(panelKey)}
          aria-expanded={expanded}
          aria-controls={contentId}
          className="inline-flex min-w-0 items-center gap-2 text-left text-sm font-semibold"
        >
          {icon}
          <span>{title}</span>
          {tooltip ? <InfoTooltip label={tooltip} /> : null}
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {rightSlot ? <div className="flex shrink-0 items-center gap-2">{rightSlot}</div> : null}
      </div>
      {expanded ? (
        <div id={contentId} className="mt-3">
          {children}
        </div>
      ) : null}
    </div>
  )
}

function InfoTooltip({ label }: { label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-silicon-slate/70 text-muted-foreground"
    >
      <Info className="h-3.5 w-3.5" />
    </span>
  )
}

function SortButton({
  active,
  direction,
  onClick,
  children,
}: {
  active: boolean
  direction: SortDirection
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 font-semibold ${active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      title={active ? `Sorted ${direction === 'asc' ? 'ascending' : 'descending'}` : 'Sort'}
    >
      {children}
      <ArrowUpDown className="h-3.5 w-3.5" />
    </button>
  )
}

function MetricCard({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'amber' }) {
  return (
    <div className={`rounded-lg border p-4 ${tone === 'amber' ? 'border-amber-500/30 bg-amber-500/10' : 'border-silicon-slate/70 bg-silicon-slate/20'}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function DigestMetric({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'amber' }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === 'amber' ? 'border-amber-500/30 bg-amber-500/10' : 'border-silicon-slate/70 bg-background/40'}`}>
      <p className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}

function DigestPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-100">
      {label}: {value.replace(/_/g, ' ')}
    </span>
  )
}

function DigestList({
  title,
  empty,
  items,
}: {
  title: string
  empty: string
  items: Array<{ id: string; title: string; detail: string | null; meta?: string; href?: string }>
}) {
  return (
    <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => {
          const body = (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{item.title}</p>
                {item.meta ? (
                  <span className="shrink-0 rounded-full border border-silicon-slate/70 px-2 py-0.5 text-[0.68rem] text-muted-foreground">
                    {item.meta}
                  </span>
                ) : null}
              </div>
              {item.detail ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.detail}</p> : null}
            </>
          )
          return item.href ? (
            <Link key={item.id} href={item.href} className="block rounded-md border border-silicon-slate/60 bg-background/35 p-2 transition hover:border-radiant-gold/45">
              {body}
            </Link>
          ) : (
            <div key={item.id} className="rounded-md border border-silicon-slate/60 bg-background/35 p-2">
              {body}
            </div>
          )
        }) : (
          <p className="rounded-md border border-silicon-slate/60 bg-background/35 p-3 text-xs text-muted-foreground">{empty}</p>
        )}
      </div>
    </div>
  )
}

function calendarAuthorizationTone(status: string) {
  if (status === 'authorized') {
    return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
  }
  if (status === 'rejected' || status === 'expired') {
    return 'border-red-500/35 bg-red-500/10 text-red-100'
  }
  return 'border-amber-500/35 bg-amber-500/10 text-amber-100'
}

function CalendarItemCard({
  item,
  actionItemId,
  rejectingItemId,
  decisionNote,
  editForm,
  isEditing,
  campaigns,
  onAuthorize,
  onBeginEdit,
  onCancelEdit,
  onEditFormChange,
  onSaveEdit,
  onBeginReject,
  onDecisionNoteChange,
  onReject,
}: {
  item: CalendarItem
  actionItemId: string | null
  rejectingItemId: string | null
  decisionNote: string
  editForm: CalendarForm | null
  isEditing: boolean
  campaigns: CampaignOption[]
  onAuthorize: (item: CalendarItem) => void
  onBeginEdit: (item: CalendarItem) => void
  onCancelEdit: (id: string) => void
  onEditFormChange: (id: string, patch: Partial<CalendarForm>) => void
  onSaveEdit: (item: CalendarItem) => void
  onBeginReject: (id: string) => void
  onDecisionNoteChange: (id: string, value: string) => void
  onReject: (item: CalendarItem) => void
}) {
  const campaignName = item.attraction_campaigns?.name ?? 'No campaign'
  const metadata = recordValue(item.metadata)
  const platformDraftHandoff = recordValue(metadata.platform_draft_handoff)
  const handoffWorkItemId = typeof platformDraftHandoff.work_item_id === 'string'
    ? platformDraftHandoff.work_item_id
    : null
  const socialContentId = item.social_content_id
    ?? (typeof platformDraftHandoff.social_content_id === 'string' ? platformDraftHandoff.social_content_id : null)
  const isPending = item.authorization_status === 'pending'
  const isRejected = item.authorization_status === 'rejected'
  const showRejectNote = rejectingItemId === item.id || isRejected
  const isBusy = actionItemId === item.id
  const canEdit = isPending || isRejected
  return (
    <div className="rounded-md border border-silicon-slate/60 bg-background/35 p-3">
      {isEditing && editForm ? (
        <div className="space-y-3">
          <label className="block text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Title
            <input
              type="text"
              value={editForm.title}
              onChange={(event) => onEditFormChange(item.id, { title: event.target.value })}
              disabled={isBusy}
              className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-xs normal-case tracking-normal text-foreground disabled:opacity-60"
            />
          </label>
          <label className="block text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Scheduled for
            <input
              type="datetime-local"
              value={editForm.scheduled_for}
              onChange={(event) => onEditFormChange(item.id, { scheduled_for: event.target.value })}
              disabled={isBusy}
              className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-xs normal-case tracking-normal text-foreground disabled:opacity-60"
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Channel
              <select
                value={editForm.channel}
                onChange={(event) => onEditFormChange(item.id, { channel: event.target.value as CalendarItem['channel'] })}
                disabled={isBusy}
                className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-xs normal-case tracking-normal text-foreground disabled:opacity-60"
              >
                {Object.entries(CALENDAR_CHANNEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Phase
              <select
                value={editForm.campaign_phase}
                onChange={(event) => onEditFormChange(item.id, { campaign_phase: event.target.value as CalendarItem['campaign_phase'] })}
                disabled={isBusy}
                className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-xs normal-case tracking-normal text-foreground disabled:opacity-60"
              >
                {CALENDAR_PHASES.map((phase) => (
                  <option key={phase.key} value={phase.key}>{phase.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Campaign
            <select
              value={editForm.campaign_id}
              onChange={(event) => onEditFormChange(item.id, { campaign_id: event.target.value })}
              disabled={isBusy}
              className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-xs normal-case tracking-normal text-foreground disabled:opacity-60"
            >
              <option value="">No campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Planned angle
            <textarea
              value={editForm.planned_angle}
              onChange={(event) => onEditFormChange(item.id, { planned_angle: event.target.value })}
              rows={2}
              disabled={isBusy}
              className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-xs normal-case tracking-normal text-foreground disabled:opacity-60"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => onSaveEdit(item)}
              disabled={isBusy}
              className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              {isBusy ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => onCancelEdit(item.id)}
              disabled={isBusy}
              className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-md border border-silicon-slate/70 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-white/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-5">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatCalendarDate(item.scheduled_for)}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold ${calendarAuthorizationTone(item.authorization_status)}`}>
              {item.authorization_status.replace(/_/g, ' ')}
            </span>
          </div>
          {item.planned_angle ? (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.planned_angle}</p>
          ) : null}
          {(() => {
            const rationale = recordValue(metadata.milestone_rationale)
            const summary = typeof rationale.summary === 'string'
              ? rationale.summary
              : typeof metadata.campaign_fit_summary === 'string'
                ? metadata.campaign_fit_summary
                : ''
            const sourceLabels = metadataStringArray(metadata.source_labels)

            if (!summary && sourceLabels.length === 0) return null

            return (
              <div className="mt-3 rounded-md border border-silicon-slate/60 bg-background/40 p-2">
                {summary ? (
                  <p className="text-[0.68rem] leading-5 text-muted-foreground">
                    <span className="font-semibold text-foreground/80">Why this exists: </span>
                    {summary}
                  </p>
                ) : null}
                {sourceLabels.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sourceLabels.slice(0, 2).map((label) => (
                      <span key={label} className="rounded-full border border-silicon-slate/70 px-2 py-0.5 text-[0.62rem] text-muted-foreground">
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })()}
          <div className="mt-3 flex flex-wrap gap-2 text-[0.68rem] text-muted-foreground">
            <span className="rounded-full border border-silicon-slate/70 px-2 py-0.5">
              {CALENDAR_CHANNEL_LABELS[item.channel]}
            </span>
            <span className="rounded-full border border-silicon-slate/70 px-2 py-0.5">
              {item.due_status.replace(/_/g, ' ')}
            </span>
          </div>
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {item.campaign_id ? (
          <Link href={`/admin/campaigns/${item.campaign_id}`} className="text-blue-200 hover:text-blue-100">
            {campaignName}
          </Link>
        ) : (
          <span className="text-muted-foreground">{campaignName}</span>
        )}
        {item.agent_work_item_id ? (
          <Link href={`/admin/agents/social-insights/${item.agent_work_item_id}`} className="text-blue-200 hover:text-blue-100">
            Insight
          </Link>
        ) : null}
        {item.social_content_id ? (
          <Link href={`/admin/social-content/${item.social_content_id}`} className="text-blue-200 hover:text-blue-100">
            Draft
          </Link>
        ) : null}
        {handoffWorkItemId ? (
          <Link href={`/admin/agents/social-insights/${handoffWorkItemId}`} className="text-blue-200 hover:text-blue-100">
            Handoff
          </Link>
        ) : null}
        {!item.social_content_id && socialContentId ? (
          <Link href={`/admin/social-content/${socialContentId}`} className="text-blue-200 hover:text-blue-100">
            Draft
          </Link>
        ) : null}
      </div>
      {showRejectNote ? (
        <label className="mt-3 block text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Decision note
          <textarea
            value={decisionNote}
            onChange={(event) => onDecisionNoteChange(item.id, event.target.value)}
            rows={2}
            disabled={isBusy || (!isPending && !isRejected)}
            placeholder="What should Shaka revise before this can be authorized?"
            className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-xs normal-case tracking-normal text-foreground disabled:opacity-60"
          />
        </label>
      ) : null}
      {isPending || isRejected ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {canEdit && !isEditing ? (
            <button
              type="button"
              onClick={() => onBeginEdit(item)}
              disabled={isBusy}
              className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onAuthorize(item)}
            disabled={isBusy || isEditing}
            className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isBusy ? 'Authorizing...' : 'Authorize Draft Handoff'}
          </button>
          <button
            type="button"
            onClick={() => showRejectNote ? onReject(item) : onBeginReject(item.id)}
            disabled={isBusy || isEditing}
            className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <XCircle className="h-3.5 w-3.5" />
            {isRejected ? 'Rejected' : showRejectNote ? 'Submit Rejection' : 'Reject'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ActorCard({ title, actor }: { title: string; actor: string }) {
  return (
    <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Database className="h-4 w-4 text-radiant-gold" />
        {title}
      </div>
      <p className="break-words text-xs leading-5 text-muted-foreground">{actor}</p>
    </div>
  )
}

function EvidenceInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number'
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
      <input
        type={type}
        min={type === 'number' ? 0 : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
      />
    </label>
  )
}

function EvidenceTextarea({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
      />
    </label>
  )
}

function SourceMetric({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-silicon-slate/70 px-2 py-0.5">
      <BarChart3 className="h-3 w-3" />
      {label}: {value.toLocaleString()}
    </span>
  )
}
