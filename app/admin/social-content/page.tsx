'use client'

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { buildLinkWithReturn } from '@/lib/admin-return-context'
import {
  Share2,
  FileText,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  Image as ImageIcon,
  Volume2,
  Linkedin,
  Play,
  Zap,
  AlertCircle,
  Info,
  ThumbsUp,
  ThumbsDown,
  Square,
  Search,
  Calendar,
  CheckSquare,
  Mic,
  MicOff,
  Sparkles,
  Plus,
  Youtube,
  AtSign,
  Instagram,
  Facebook,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import AgenticContentReviewPacketPager from '@/components/admin/AgenticContentReviewPacketPager'
import { ExtractionStatusChip } from '@/components/admin/ExtractionStatusChip'
import { useExtractionStatus } from '@/lib/hooks/useExtractionStatus'
import { getCurrentSession } from '@/lib/auth'
import { getAgenticContentReviewPacketsForSurface } from '@/lib/agentic-content-review-packets'
import {
  STATUS_CONFIG,
  CONTENT_STATUSES,
  PLATFORMS,
  truncateForPreview,
  formatHashtags,
} from '@/lib/social-content'
import type { SocialContentItem, ContentStatus, SocialPlatform } from '@/lib/social-content'
import Link from 'next/link'

interface Stats {
  draft: number
  approved: number
  scheduled: number
  published: number
  rejected: number
  total: number
}

type SafePlatformConfig = {
  id: string
  platform: SocialPlatform
  settings: Record<string, unknown>
  is_active: boolean
  credentials_configured: boolean
  provider_setup?: {
    provider: string
    requirements: Record<string, boolean>
    ready: boolean
    human_gate: string
  } | null
  created_at: string
  updated_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface MeetingRecord {
  id: string
  meeting_type: string
  meeting_date: string
  created_at: string
  duration_minutes: number | null
  meeting_title: string | null
  participants: string[]
  source_url: string | null
  snippet: string | null
  queued_count: number
  has_transcript: boolean
}

interface ContentFrameworkOption {
  id: string
  display_name: string
  creator_name: string
  summary: string
}

interface VoiceNoteIntake {
  id: string
  title: string
  status: string
  target_outputs: string[]
  audio_file_name: string | null
  created_at: string
}

interface LaunchDraftSeedLink {
  id: string
  assetId: string | null
  href: string
}

interface LaunchApprovalLink extends LaunchDraftSeedLink {
  status?: string
  productionWorkItemCount?: number
  publishTriggered?: boolean
  error?: string
}

interface LaunchApprovalResult {
  success: boolean
  message: string
  inserted: LaunchDraftSeedLink[]
  existing: LaunchDraftSeedLink[]
  approved: LaunchApprovalLink[]
  failed: LaunchApprovalLink[]
  remainingExternalGates: string[]
}

type WorkflowView = 'review' | 'evidence' | 'create'

const VOICE_NOTE_OUTPUTS = [
  { value: 'linkedin_post', label: 'LinkedIn' },
  { value: 'linkedin_carousel', label: 'Carousel' },
  { value: 'pptx_deck', label: 'PowerPoint' },
  { value: 'video_script', label: 'Script' },
  { value: 'heygen_video', label: 'HeyGen' },
  { value: 'elevenlabs_audio', label: 'Audio' },
  { value: 'short_caption', label: 'Captions' },
]

const MEETINGS_PER_PAGE = 5
const AGENTIC_SOCIAL_REVIEW_PACKETS = getAgenticContentReviewPacketsForSurface('social')

function SocialContentQueuePage() {
  const [items, setItems] = useState<SocialContentItem[]>([])
  const [stats, setStats] = useState<Stats>({ draft: 0, approved: 0, scheduled: 0, published: 0, rejected: 0, total: 0 })
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all')
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [launchApprovalRunning, setLaunchApprovalRunning] = useState(false)
  const [launchApprovalResult, setLaunchApprovalResult] = useState<LaunchApprovalResult | null>(null)
  const [activeWorkflowView, setActiveWorkflowView] = useState<WorkflowView>('review')
  const [platformConfigs, setPlatformConfigs] = useState<SafePlatformConfig[]>([])
  const [platformConfigsLoading, setPlatformConfigsLoading] = useState(true)
  const [youtubeConnecting, setYoutubeConnecting] = useState(false)
  const [youtubeConnectionNotice, setYoutubeConnectionNotice] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [xConnecting, setXConnecting] = useState(false)
  const [xConnectionNotice, setXConnectionNotice] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [metaConnecting, setMetaConnecting] = useState(false)
  const [metaConnectionNotice, setMetaConnectionNotice] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // Extraction trigger state
  const [meetings, setMeetings] = useState<MeetingRecord[]>([])
  const [meetingsTotal, setMeetingsTotal] = useState(0)
  const [meetingsLoading, setMeetingsLoading] = useState(false)
  const [meetingSearch, setMeetingSearch] = useState('')
  const [meetingDateFrom, setMeetingDateFrom] = useState('')
  const [meetingDateTo, setMeetingDateTo] = useState('')
  const [meetingsPage, setMeetingsPage] = useState(1)
  const [selectedMeetings, setSelectedMeetings] = useState<Set<string>>(new Set())
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerResult, setTriggerResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showTriggerPanel, setShowTriggerPanel] = useState(false)

  const [showVoicePanel, setShowVoicePanel] = useState(false)
  const [voiceIntakes, setVoiceIntakes] = useState<VoiceNoteIntake[]>([])
  const [contentFrameworks, setContentFrameworks] = useState<ContentFrameworkOption[]>([])
  const [voiceTitle, setVoiceTitle] = useState('')
  const [voiceTopic, setVoiceTopic] = useState('')
  const [voiceAudience, setVoiceAudience] = useState('')
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceOutputs, setVoiceOutputs] = useState<string[]>(['linkedin_post', 'linkedin_carousel', 'pptx_deck', 'video_script', 'heygen_video', 'elevenlabs_audio'])
  const [voiceFrameworks, setVoiceFrameworks] = useState<string[]>(['alex-hormozi-value-equation', 'nick-saraev-ai-content-engine'])
  const [voiceAudioFile, setVoiceAudioFile] = useState<File | null>(null)
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [voiceSubmitting, setVoiceSubmitting] = useState(false)
  const [voiceGeneratingId, setVoiceGeneratingId] = useState<string | null>(null)
  const [pptxGeneratingPackageId, setPptxGeneratingPackageId] = useState<string | null>(null)
  const [voiceResult, setVoiceResult] = useState<{
    success: boolean
    message: string
    href?: string | null
    packageId?: string | null
    agentRunId?: string | null
    pptxUrl?: string | null
  } | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<BlobPart[]>([])

  const fetchItems = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (platformFilter !== 'all') params.set('platform', platformFilter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/admin/social-content?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setItems(data.items)
        setStats(data.stats)
        setPagination(data.pagination)
      }
    } catch (err) {
      console.error('Failed to fetch social content:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, platformFilter, search])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const fetchPlatformConfigs = useCallback(async () => {
    setPlatformConfigsLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch('/api/admin/social-content/config?safe=true', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return

      const data = await res.json()
      setPlatformConfigs(Array.isArray(data.configs) ? data.configs : [])
    } catch (err) {
      console.error('Failed to fetch social platform config:', err)
    } finally {
      setPlatformConfigsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlatformConfigs()
  }, [fetchPlatformConfigs])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const youtubeConnected = params.get('youtube_connected')
    const youtubeError = params.get('youtube_error')
    const youtubeChannel = params.get('youtube_channel')
    const xConnected = params.get('x_connected')
    const xError = params.get('x_error')
    const xHandle = params.get('x_handle')
    const metaConnected = params.get('meta_connected')
    const metaError = params.get('meta_error')
    const facebookPage = params.get('facebook_page')
    const instagramHandle = params.get('instagram_handle')

    if (youtubeConnected === 'true') {
      setYoutubeConnectionNotice({
        type: 'success',
        message: youtubeChannel
          ? `YouTube connected to ${youtubeChannel}. Uploads remain gated by final approval.`
          : 'YouTube connected. Uploads remain gated by final approval.',
      })
      fetchPlatformConfigs()
      return
    }

    if (youtubeError) {
      setYoutubeConnectionNotice({
        type: 'error',
        message: `YouTube connection did not complete (${youtubeError.replace(/_/g, ' ')}).`,
      })
    }

    if (xConnected === 'true') {
      setXConnectionNotice({
        type: 'success',
        message: xHandle
          ? `X connected to @${xHandle.replace(/^@/, '')}. Posting remains gated by final submission approval.`
          : 'X connected. Posting remains gated by final submission approval.',
      })
      fetchPlatformConfigs()
      return
    }

    if (xError) {
      setXConnectionNotice({
        type: 'error',
        message: `X connection did not complete (${xError.replace(/_/g, ' ')}).`,
      })
    }

    if (metaConnected === 'true') {
      setMetaConnectionNotice({
        type: 'success',
        message: [
          facebookPage ? `Facebook connected to ${facebookPage}.` : 'Facebook connected.',
          instagramHandle ? `Instagram connected to @${instagramHandle.replace(/^@/, '')}.` : null,
          'Posting remains gated by final submission approval.',
        ].filter(Boolean).join(' '),
      })
      fetchPlatformConfigs()
      return
    }

    if (metaError) {
      setMetaConnectionNotice({
        type: 'error',
        message: `Meta connection did not complete (${metaError.replace(/_/g, ' ')}).`,
      })
    }
  }, [fetchPlatformConfigs])

  const extractionStatus = useExtractionStatus(() => fetchItems())

  const youtubeConfig = platformConfigs.find((config) => config.platform === 'youtube')
  const youtubeConnected = Boolean(youtubeConfig?.is_active && youtubeConfig.credentials_configured)
  const youtubeChannelLabel = typeof youtubeConfig?.settings?.channel_title === 'string'
    ? youtubeConfig.settings.channel_title
    : typeof youtubeConfig?.settings?.channel_id === 'string' && youtubeConfig.settings.channel_id
      ? youtubeConfig.settings.channel_id
      : null
  const xConfig = platformConfigs.find((config) => config.platform === 'x')
  const xConnected = Boolean(xConfig?.is_active && xConfig.credentials_configured)
  const xHandleLabel = typeof xConfig?.settings?.profile_handle === 'string'
    ? `@${xConfig.settings.profile_handle.replace(/^@/, '')}`
    : typeof xConfig?.settings?.connected_account === 'string'
      ? xConfig.settings.connected_account
      : '@amadutown'
  const instagramConfig = platformConfigs.find((config) => config.platform === 'instagram')
  const instagramSetup = instagramConfig?.provider_setup
  const instagramReady = Boolean(instagramConfig?.is_active && instagramSetup?.ready)
  const facebookConfig = platformConfigs.find((config) => config.platform === 'facebook')
  const facebookSetup = facebookConfig?.provider_setup
  const facebookReady = Boolean(facebookConfig?.is_active && facebookSetup?.ready)
  const metaReady = instagramReady && facebookReady
  const instagramRequirements = [
    ['Professional Instagram account', instagramSetup?.requirements?.professional_account],
    ['Meta Page linkage', instagramSetup?.requirements?.meta_page_linked],
    ['Access token stored', instagramSetup?.requirements?.access_token],
    ['IG user/business account ID', instagramSetup?.requirements?.ig_user_business_id],
    ['App review/permissions', instagramSetup?.requirements?.app_review_permissions],
    ['Facebook Page token', facebookSetup?.requirements?.page_access_token],
    ['Facebook Page ID', facebookSetup?.requirements?.page_id],
  ] as const

  const handleConnectYouTube = async () => {
    setYoutubeConnecting(true)
    setYoutubeConnectionNotice(null)
    try {
      const session = await getCurrentSession()
      if (!session) {
        setYoutubeConnectionNotice({ type: 'error', message: 'Sign in before connecting YouTube.' })
        return
      }

      const res = await fetch('/api/auth/youtube', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.auth_url) {
        setYoutubeConnectionNotice({
          type: 'error',
          message: data?.error || 'YouTube connection could not start.',
        })
        return
      }

      window.location.assign(data.auth_url)
    } catch {
      setYoutubeConnectionNotice({ type: 'error', message: 'YouTube connection could not start.' })
    } finally {
      setYoutubeConnecting(false)
    }
  }

  const handleConnectX = async () => {
    setXConnecting(true)
    setXConnectionNotice(null)
    try {
      const session = await getCurrentSession()
      if (!session) {
        setXConnectionNotice({ type: 'error', message: 'Sign in before connecting X.' })
        return
      }

      const res = await fetch('/api/auth/x', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.auth_url) {
        setXConnectionNotice({
          type: 'error',
          message: data?.error || 'X connection could not start.',
        })
        return
      }

      window.location.assign(data.auth_url)
    } catch {
      setXConnectionNotice({ type: 'error', message: 'X connection could not start.' })
    } finally {
      setXConnecting(false)
    }
  }

  const handleConnectMeta = async () => {
    setMetaConnecting(true)
    setMetaConnectionNotice(null)
    try {
      const session = await getCurrentSession()
      if (!session) {
        setMetaConnectionNotice({ type: 'error', message: 'Sign in before connecting Meta.' })
        return
      }

      const res = await fetch('/api/auth/meta', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.auth_url) {
        setMetaConnectionNotice({
          type: 'error',
          message: data?.error || 'Meta connection could not start.',
        })
        return
      }

      window.location.assign(data.auth_url)
    } catch {
      setMetaConnectionNotice({ type: 'error', message: 'Meta connection could not start.' })
    } finally {
      setMetaConnecting(false)
    }
  }

  const fetchMeetings = useCallback(async (pageOverride?: number) => {
    setMeetingsLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const page = pageOverride ?? meetingsPage
      const offset = (page - 1) * MEETINGS_PER_PAGE
      const params = new URLSearchParams({ limit: String(MEETINGS_PER_PAGE), offset: String(offset) })
      if (meetingSearch) params.set('q', meetingSearch)
      if (meetingDateFrom) params.set('from', meetingDateFrom)
      if (meetingDateTo) params.set('to', meetingDateTo)
      const res = await fetch(`/api/admin/social-content/trigger?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMeetings(data.meetings ?? [])
        setMeetingsTotal(data.total ?? 0)
      }
    } catch (err) {
      console.error('Failed to fetch meetings:', err)
    } finally {
      setMeetingsLoading(false)
    }
  }, [meetingSearch, meetingDateFrom, meetingDateTo, meetingsPage])

  useEffect(() => {
    if (showTriggerPanel) fetchMeetings()
  }, [showTriggerPanel, fetchMeetings])

  const fetchVoiceIntakes = useCallback(async () => {
    setVoiceLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const res = await fetch('/api/admin/social-content/voice-notes?limit=8', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setVoiceIntakes(data.intakes ?? [])
        setContentFrameworks(data.frameworks ?? [])
      }
    } catch (err) {
      console.error('Failed to fetch voice-note intakes:', err)
    } finally {
      setVoiceLoading(false)
    }
  }, [])

  useEffect(() => {
    if (showVoicePanel) fetchVoiceIntakes()
  }, [showVoicePanel, fetchVoiceIntakes])

  // Debounced meeting search — reset to page 1 on filter change
  useEffect(() => {
    if (!showTriggerPanel) return
    const timer = setTimeout(() => { setMeetingsPage(1); fetchMeetings(1) }, 350)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingSearch, meetingDateFrom, meetingDateTo])

  const handleTriggerExtraction = async (meetingIds?: string[]) => {
    setTriggerLoading(true)
    setTriggerResult(null)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const ids = meetingIds ?? (selectedMeetings.size > 0 ? [...selectedMeetings] : undefined)
      const body: Record<string, unknown> = {}
      if (ids && ids.length > 0) body.meeting_record_ids = ids
      const res = await fetch('/api/admin/social-content/trigger', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setTriggerResult({
        success: data.success ?? false,
        message: data.message ?? (res.ok ? 'Extraction triggered' : 'Failed to trigger extraction'),
      })
      if (data.success) {
        extractionStatus.onTriggerStarted(data.runs?.[0]?.run_id)
      }
    } catch {
      setTriggerResult({ success: false, message: 'Network error — could not reach the server.' })
    } finally {
      setTriggerLoading(false)
    }
  }

  const handleRetryFailed = async () => {
    const failedMeetingIds = extractionStatus.recentRuns
      .filter(r => r.status === 'failed' && r.meeting_record_id)
      .map(r => r.meeting_record_id!)
    if (failedMeetingIds.length === 0) return
    await handleTriggerExtraction(failedMeetingIds)
  }

  const toggleVoiceOutput = (output: string) => {
    setVoiceOutputs((current) =>
      current.includes(output) ? current.filter((item) => item !== output) : [...current, output]
    )
  }

  const toggleVoiceFramework = (frameworkId: string) => {
    setVoiceFrameworks((current) =>
      current.includes(frameworkId) ? current.filter((item) => item !== frameworkId) : [...current, frameworkId]
    )
  }

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const file = new File([blob], `voice-note-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`, { type: blob.type })
        setVoiceAudioFile(file)
        stream.getTracks().forEach((track) => track.stop())
        setIsRecording(false)
      }
      recorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setVoiceResult(null)
    } catch (err) {
      console.error('Recording failed:', err)
      setVoiceResult({ success: false, message: 'Microphone access failed. Paste rough notes or use the audio fallback.' })
    }
  }

  const stopVoiceRecording = () => {
    recorderRef.current?.stop()
  }

  const submitVoiceIntake = async () => {
    setVoiceSubmitting(true)
    setVoiceResult(null)
    try {
      const session = await getCurrentSession()
      if (!session) return
      if (!voiceAudioFile && voiceTranscript.trim().length < 10) {
        throw new Error('Record a voice note or add at least a short rough note.')
      }
      const formData = new FormData()
      if (voiceTitle.trim()) formData.append('title', voiceTitle.trim())
      if (voiceTopic.trim()) formData.append('topic_hint', voiceTopic.trim())
      if (voiceAudience.trim()) formData.append('target_audience', voiceAudience.trim())
      if (voiceTranscript.trim()) formData.append('transcript_text', voiceTranscript.trim())
      for (const output of voiceOutputs) formData.append('target_outputs', output)
      for (const framework of voiceFrameworks) formData.append('framework_ids', framework)
      if (voiceAudioFile) formData.append('audio', voiceAudioFile)

      const res = await fetch('/api/admin/social-content/voice-notes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create voice-note intake')
      setVoiceResult({ success: true, message: 'Voice note captured. Generate the package when ready.' })
      setVoiceTitle('')
      setVoiceTopic('')
      setVoiceAudience('')
      setVoiceTranscript('')
      setVoiceAudioFile(null)
      await fetchVoiceIntakes()
    } catch (err) {
      setVoiceResult({ success: false, message: err instanceof Error ? err.message : 'Failed to create voice-note intake.' })
    } finally {
      setVoiceSubmitting(false)
    }
  }

  const generateVoicePackage = async (intakeId: string) => {
    setVoiceGeneratingId(intakeId)
    setVoiceResult(null)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const res = await fetch(`/api/admin/social-content/voice-notes/${intakeId}/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ create_downstream_drafts: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate content package')
      setVoiceResult({
        success: true,
        message: data.alreadyGenerated
          ? 'Package already generated for this intake. Review the existing gates or artifact.'
          : `Package generated with ${data.outputs?.length ?? 0} drafts and ${data.approvals?.length ?? 0} approval gates.`,
        href: data.downstream?.socialContentId ? `/admin/social-content/${data.downstream.socialContentId}` : null,
        packageId: data.package?.id ?? null,
        agentRunId: data.agentRunId ?? null,
      })
      await Promise.all([fetchVoiceIntakes(), fetchItems()])
    } catch (err) {
      setVoiceResult({ success: false, message: err instanceof Error ? err.message : 'Failed to generate content package.' })
    } finally {
      setVoiceGeneratingId(null)
    }
  }

  const generatePptxArtifact = async (packageId: string) => {
    setPptxGeneratingPackageId(packageId)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const res = await fetch(`/api/admin/social-content/content-packages/${packageId}/pptx`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403 && data.agentRunId) {
          throw new Error('Media generation approval is required before creating the PPTX. Review the Agent Ops gate first.')
        }
        throw new Error(data.error || 'Failed to generate PPTX artifact')
      }
      setVoiceResult((current) => ({
        success: true,
        message: `PowerPoint generated: ${data.fileName ?? 'content-package.pptx'}`,
        href: current?.href ?? null,
        packageId,
        agentRunId: current?.agentRunId ?? null,
        pptxUrl: data.signedUrl ?? null,
      }))
    } catch (err) {
      setVoiceResult((current) => ({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to generate PPTX artifact.',
        href: current?.href ?? null,
        packageId,
        agentRunId: current?.agentRunId ?? null,
      }))
    } finally {
      setPptxGeneratingPackageId(null)
    }
  }

  const approveLaunchPackage = async () => {
    setLaunchApprovalRunning(true)
    setLaunchApprovalResult(null)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const res = await fetch('/api/admin/social-content/launch-approvals', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok && res.status !== 207) throw new Error(data.error || 'Failed to approve launch package')
      const approvedCount = data.summary?.approved ?? 0
      const failedCount = data.summary?.failed ?? 0
      setLaunchApprovalResult({
        success: failedCount === 0,
        message: failedCount === 0
          ? `${approvedCount} launch draft${approvedCount === 1 ? '' : 's'} internally approved. External execution remains gated.`
          : `${approvedCount} launch draft${approvedCount === 1 ? '' : 's'} approved; ${failedCount} need manual review.`,
        inserted: data.inserted ?? [],
        existing: data.existing ?? [],
        approved: data.approved ?? [],
        failed: data.failed ?? [],
        remainingExternalGates: data.remainingExternalGates ?? [],
      })
      setStatusFilter('approved')
      setPlatformFilter('linkedin')
      await fetchItems(1)
    } catch (err) {
      setLaunchApprovalResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to approve launch package.',
        inserted: [],
        existing: [],
        approved: [],
        failed: [],
        remainingExternalGates: [],
      })
    } finally {
      setLaunchApprovalRunning(false)
    }
  }

  const handleQuickApprove = async (e: React.MouseEvent, itemId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setActionLoading(itemId)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const res = await fetch(`/api/admin/social-content/${itemId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        fetchItems(pagination.page)
      }
    } catch (err) {
      console.error('Failed to approve:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleQuickReject = async (e: React.MouseEvent, itemId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setActionLoading(itemId)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const res = await fetch(`/api/admin/social-content/${itemId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'rejected' }),
      })
      if (res.ok) {
        fetchItems(pagination.page)
      }
    } catch (err) {
      console.error('Failed to reject:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const platformIcon = (platform: string) => {
    if (platform === 'linkedin') return <Linkedin className="w-4 h-4 text-blue-400" />
    return <Share2 className="w-4 h-4 text-gray-400" />
  }

  const workflowViews: Array<{
    id: WorkflowView
    label: string
    description: string
    metric: string
    icon: ReactNode
  }> = [
    {
      id: 'review',
      label: 'Review draft queue',
      description: 'Approve, revise, or inspect actual content drafts.',
      metric: `${stats.draft} drafts`,
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      id: 'evidence',
      label: 'Launch evidence',
      description: 'Review source packets, challenger results, and seeded draft gates.',
      metric: `${AGENTIC_SOCIAL_REVIEW_PACKETS.length} packets`,
      icon: <FileText className="h-4 w-4" />,
    },
    {
      id: 'create',
      label: 'Create content',
      description: 'Use meetings or voice notes to create internal draft packages.',
      metric: 'Intake tools',
      icon: <Sparkles className="h-4 w-4" />,
    },
  ]

  return (
    <div className="admin-console-page min-h-screen p-6 text-foreground lg:p-8">
      <Breadcrumbs items={[{ label: 'Admin', href: '/admin' }, { label: 'Social Content' }]} />

      {/* Header */}
      <div className="admin-console-surface-header mb-6 mt-5 flex items-center gap-4 rounded-xl border p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-radiant-gold/40 bg-radiant-gold/15 text-radiant-gold">
          <Share2 className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="admin-console-eyebrow mb-2">Content Operations</div>
          <h1 className="text-2xl font-bold text-foreground">Social Content Queue</h1>
          <p className="text-muted-foreground text-sm">Review draft content first. Evidence packets and creation tools stay available without taking over the approval queue.</p>
        </div>
      </div>

      <div className="admin-console-card mb-6 rounded-lg border p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="admin-console-eyebrow mb-2">Workflow focus</div>
            <h2 className="text-lg font-semibold text-foreground">Choose the job you are doing now</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Select a work mode to keep review, evidence, and intake from competing in the same scroll.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3" role="tablist" aria-label="Social content workflow views">
          {workflowViews.map((view) => {
            const isActive = activeWorkflowView === view.id
            return (
              <button
                key={view.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveWorkflowView(view.id)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  isActive
                    ? 'border-radiant-gold/70 bg-radiant-gold/15 text-foreground shadow-[0_0_0_1px_rgba(226,194,93,0.22)]'
                    : 'border-silicon-slate bg-background/35 text-muted-foreground hover:border-radiant-gold/40 hover:bg-background/55 hover:text-foreground'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${
                    isActive
                      ? 'border-radiant-gold/50 bg-radiant-gold/20 text-radiant-gold'
                      : 'border-silicon-slate bg-imperial-navy/50 text-gray-400'
                  }`}>
                    {view.icon}
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${
                    isActive
                      ? 'border-radiant-gold/40 bg-radiant-gold/10 text-radiant-gold'
                      : 'border-silicon-slate bg-imperial-navy/50 text-gray-400'
                  }`}>
                    {view.metric}
                  </span>
                </div>
                <div className="mt-3 text-sm font-semibold text-foreground">{view.label}</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{view.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="admin-console-card mb-6 rounded-lg border p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-pink-400/30 bg-pink-500/10 text-pink-200">
              <Instagram className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="admin-console-eyebrow mb-1">Provider setup</div>
              <h2 className="text-base font-semibold text-foreground">Meta Instagram/Facebook readiness</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {metaReady
                  ? 'Instagram and Facebook are ready for governed image, carousel, Reel, or Page submission. Final posting still requires asset, rights/privacy, and submit gates.'
                  : 'Connect Meta before Instagram or Facebook companion posts can be submitted. This stores the provider adapter only; it does not post, schedule, or alter copy.'}
              </p>
              {metaConnectionNotice && (
                <p className={`mt-2 text-xs ${metaConnectionNotice.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
                  {metaConnectionNotice.message}
                </p>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {instagramRequirements.map(([label, ready]) => (
                  <div
                    key={label}
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs ${
                      ready
                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
                        : 'border-silicon-slate bg-imperial-navy/40 text-gray-400'
                    }`}
                  >
                    <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${ready ? 'text-emerald-300' : 'text-gray-600'}`} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Secrets are not displayed or seeded here. Provider configuration does not create drafts, schedule, or publish.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <span className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${
              platformConfigsLoading
                ? 'border-silicon-slate bg-imperial-navy/50 text-gray-400'
                : metaReady
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }`}>
              {platformConfigsLoading ? 'Checking' : metaReady ? 'Ready' : 'Blocked'}
            </span>
            <button
              type="button"
              onClick={handleConnectMeta}
              disabled={metaConnecting}
              className="admin-console-button-secondary justify-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              {metaConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Facebook className="h-4 w-4" />}
              {metaConnecting ? 'Opening Meta...' : metaReady ? 'Reconnect Meta' : 'Connect Meta'}
            </button>
          </div>
        </div>
      </div>

      <div className="admin-console-card mb-6 rounded-lg border p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-400/30 bg-red-500/10 text-red-200">
              <Youtube className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="admin-console-eyebrow mb-1">Provider setup</div>
              <h2 className="text-base font-semibold text-foreground">YouTube channel connection</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {youtubeConnected
                  ? `Connected${youtubeChannelLabel ? ` to ${youtubeChannelLabel}` : ''}. Publishing still requires a final YouTube draft, video URL, and explicit submit approval.`
                  : 'Connect the channel before YouTube uploads. This only authorizes the provider adapter; it does not create, schedule, upload, or publish content.'}
              </p>
              {youtubeConnectionNotice && (
                <p className={`mt-2 text-xs ${youtubeConnectionNotice.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
                  {youtubeConnectionNotice.message}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${
              platformConfigsLoading
                ? 'border-silicon-slate bg-imperial-navy/50 text-gray-400'
                : youtubeConnected
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }`}>
              {platformConfigsLoading ? 'Checking' : youtubeConnected ? 'Connected' : 'Not connected'}
            </span>
            <button
              type="button"
              onClick={handleConnectYouTube}
              disabled={youtubeConnecting}
              className="admin-console-button-secondary justify-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              {youtubeConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />}
              {youtubeConnecting ? 'Opening YouTube...' : youtubeConnected ? 'Reconnect YouTube' : 'Connect YouTube'}
            </button>
          </div>
        </div>
      </div>

      <div className="admin-console-card mb-6 rounded-lg border p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-300/30 bg-gray-100/10 text-gray-100">
              <AtSign className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="admin-console-eyebrow mb-1">Provider setup</div>
              <h2 className="text-base font-semibold text-foreground">X account connection</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {xConnected
                  ? `Connected${xHandleLabel ? ` to ${xHandleLabel}` : ''}. Posting still requires an approved draft and explicit platform submission.`
                  : 'Connect @amadutown before X posts or threads can be submitted. This authorizes the provider adapter only; it does not post, schedule, or alter copy.'}
              </p>
              {xConnectionNotice && (
                <p className={`mt-2 text-xs ${xConnectionNotice.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
                  {xConnectionNotice.message}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${
              platformConfigsLoading
                ? 'border-silicon-slate bg-imperial-navy/50 text-gray-400'
                : xConnected
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }`}>
              {platformConfigsLoading ? 'Checking' : xConnected ? 'Connected' : 'Not connected'}
            </span>
            <button
              type="button"
              onClick={handleConnectX}
              disabled={xConnecting}
              className="admin-console-button-secondary justify-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              {xConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <AtSign className="h-4 w-4" />}
              {xConnecting ? 'Opening X...' : xConnected ? 'Reconnect X' : 'Connect X'}
            </button>
          </div>
        </div>
      </div>

      {activeWorkflowView === 'evidence' && (
      <div className="admin-console-card mb-6 rounded-lg border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="admin-console-eyebrow mb-2">Agentic challenger loop</div>
            <h2 className="text-lg font-semibold text-foreground">Human editorial review packets</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              These assets have passed Amina challenger review and can be reviewed by Vambah here before any scheduling, publishing, visual build, or provider step.
            </p>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            {AGENTIC_SOCIAL_REVIEW_PACKETS.length} ready
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-radiant-gold/40 bg-radiant-gold/10 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-200">Approve launch package</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              Creates missing draft-only rows, approves the challenger-cleared launch drafts, and opens post-approval handoff work. It still does not schedule, publish, send outreach, build visuals, or call providers.
            </p>
          </div>
          <button
            type="button"
            onClick={approveLaunchPackage}
            disabled={launchApprovalRunning}
            className="admin-console-button-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {launchApprovalRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {launchApprovalRunning ? 'Approving...' : 'Approve Launch Package'}
          </button>
        </div>

        {launchApprovalResult && (
          <div className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
            launchApprovalResult.success
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}>
            <div className="flex items-center gap-2">
              {launchApprovalResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <span>{launchApprovalResult.message}</span>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <span className="rounded-md border border-silicon-slate bg-imperial-navy/40 px-2.5 py-2">
                {launchApprovalResult.inserted.length} seeded
              </span>
              <span className="rounded-md border border-silicon-slate bg-imperial-navy/40 px-2.5 py-2">
                {launchApprovalResult.existing.length} already existed
              </span>
              <span className="rounded-md border border-silicon-slate bg-imperial-navy/40 px-2.5 py-2">
                {launchApprovalResult.approved.length} internally approved
              </span>
            </div>
            {launchApprovalResult.remainingExternalGates.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {launchApprovalResult.remainingExternalGates.map((gate) => (
                  <span key={gate} className="rounded-full border border-radiant-gold/30 bg-imperial-navy/50 px-2.5 py-1 text-xs text-radiant-gold">
                    {gate.replace(/_/g, ' ')} still gated
                  </span>
                ))}
              </div>
            )}
            {(launchApprovalResult.approved.length > 0 || launchApprovalResult.failed.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {launchApprovalResult.approved.map((draft) => (
                  <Link
                    key={`${draft.assetId ?? draft.id}:${draft.id}`}
                    href={draft.href}
                    className="inline-flex items-center gap-1 rounded-full border border-radiant-gold/30 px-2.5 py-1 text-xs text-radiant-gold hover:bg-radiant-gold/10"
                  >
                    Open approved draft <Eye className="h-3 w-3" />
                  </Link>
                ))}
                {launchApprovalResult.failed.map((draft) => (
                  <Link
                    key={`${draft.assetId ?? draft.id}:${draft.id}:failed`}
                    href={draft.href}
                    className="inline-flex items-center gap-1 rounded-full border border-red-500/30 px-2.5 py-1 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    Review failed draft <AlertCircle className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <AgenticContentReviewPacketPager
          packets={AGENTIC_SOCIAL_REVIEW_PACKETS}
          nextGateHref="#social-content-approval-queue"
          nextGateLabel="Open approval queue"
          showDecisionActions={false}
        />
      </div>
      )}

      {activeWorkflowView === 'create' && (
      <>
      <div className="admin-console-card mb-6 rounded-lg border p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="admin-console-eyebrow mb-2">Create content</div>
            <h2 className="text-lg font-semibold text-foreground">Turn approved source material into draft rows</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              These tools create internal Social Content drafts for review. They do not publish, schedule, send outreach, generate paid-provider assets, or change production settings.
            </p>
          </div>
          <span className="rounded-full border border-radiant-gold/30 bg-radiant-gold/10 px-3 py-1 text-xs font-medium text-radiant-gold">
            Draft-only
          </span>
        </div>
      </div>

      {/* Meeting Transcript Intake */}
      <div className="admin-console-card relative z-30 mb-6 rounded-lg border p-4" style={{ overflow: 'visible' }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
              <Zap className="h-4 w-4 text-radiant-gold" />
              Create from meetings
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Use this when a meeting transcript already contains a concrete proof point, client lesson, or campaign angle. Select the meetings first, then create draft-only content for review.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                'Source: meeting transcripts',
                'Output: Social Content drafts',
                'Gate: human review before publishing',
              ].map((label) => (
                <span key={label} className="rounded-full border border-silicon-slate bg-imperial-navy/50 px-2.5 py-1 text-[11px] text-gray-300">
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="relative z-50 flex flex-col items-start gap-3 overflow-visible sm:flex-row sm:items-center lg:justify-end">
            <button
              onClick={() => setShowTriggerPanel((p) => !p)}
              className="admin-console-button-primary"
            >
              <Zap className="w-4 h-4" />
              {showTriggerPanel ? 'Close meeting picker' : 'Open meeting picker'}
            </button>
            <ExtractionStatusChip
              state={extractionStatus.state}
              currentRun={extractionStatus.currentRun}
              recentRuns={extractionStatus.recentRuns}
              runningCount={extractionStatus.runningCount}
              elapsedMs={extractionStatus.elapsedMs}
              isDrawerOpen={extractionStatus.isDrawerOpen}
              isHistoryOpen={extractionStatus.isHistoryOpen}
              toggleDrawer={extractionStatus.toggleDrawer}
              toggleHistory={extractionStatus.toggleHistory}
              markRunFailed={extractionStatus.markRunFailed}
              onRetry={() => handleTriggerExtraction()}
              onRetryFailed={handleRetryFailed}
            />
          </div>
        </div>

        {showTriggerPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-4 rounded-lg border border-silicon-slate bg-imperial-navy/55 p-5"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-200">Meeting transcript picker</h3>
              <span
                className="text-gray-600 hover:text-gray-400 transition-colors cursor-help"
                title="Runs WF-SOC-001 to create draft-only social content from selected meeting transcripts."
              >
                <Info className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Search & Date Filters */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-gray-500 mb-1">Search meetings</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input
                    type="text"
                    value={meetingSearch}
                    onChange={(e) => setMeetingSearch(e.target.value)}
                    placeholder="Type, transcript, topic..."
                    className="w-full rounded-lg border border-silicon-slate bg-imperial-navy/70 py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-radiant-gold/60 transition-colors"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <input
                  type="date"
                  value={meetingDateFrom}
                  onChange={(e) => setMeetingDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-silicon-slate bg-imperial-navy/70 px-2 py-2 text-sm text-foreground focus:outline-none focus:border-radiant-gold/60 sm:w-32"
                />
                <span className="text-xs text-gray-500">to</span>
                <input
                  type="date"
                  value={meetingDateTo}
                  onChange={(e) => setMeetingDateTo(e.target.value)}
                  className="w-full rounded-lg border border-silicon-slate bg-imperial-navy/70 px-2 py-2 text-sm text-foreground focus:outline-none focus:border-radiant-gold/60 sm:w-32"
                />
                {(meetingDateFrom || meetingDateTo) && (
                  <button onClick={() => { setMeetingDateFrom(''); setMeetingDateTo('') }} className="text-xs text-gray-400 hover:text-white">Clear</button>
                )}
              </div>
            </div>

            {/* Meeting List */}
            {meetingsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading meetings...
              </div>
            ) : meetings.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-500">
                No matching meeting transcripts found.{(meetingSearch || meetingDateFrom) ? ' Try clearing filters.' : ' Use the voice-note builder below when the source is still a brainstorm.'}
              </div>
            ) : (
              <>
                {/* Selection header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedMeetings.size > 0 ? (
                      <>
                        <span className="text-xs text-amber-500">{selectedMeetings.size} selected</span>
                        <button
                          onClick={() => {
                            const allIds = new Set(meetings.map(m => m.id))
                            setSelectedMeetings(prev =>
                              prev.size === allIds.size ? new Set() : allIds
                            )
                          }}
                          className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white"
                        >
                          {selectedMeetings.size === meetings.length ? 'Deselect all' : 'Select all'}
                        </button>
                        <button
                          onClick={() => setSelectedMeetings(new Set())}
                          className="text-xs px-2 py-1 rounded border border-amber-600/40 text-amber-500 bg-amber-600/10"
                        >
                          Clear
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-gray-500">Select meetings to turn into draft content, or use all recent transcripts.</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{meetingsTotal} meeting{meetingsTotal !== 1 ? 's' : ''}</span>
                </div>

                {/* Meeting rows */}
                <div className="space-y-1.5">
                  {meetings.map((m) => {
                    const isSelected = selectedMeetings.has(m.id)
                    const date = m.meeting_date ? new Date(m.meeting_date) : null
                    const title = m.meeting_title || 'Untitled meeting'
                    const showTypePill = m.meeting_type && m.meeting_title && m.meeting_title !== m.meeting_type.replace(/_/g, ' ')
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMeetings(prev => {
                          const next = new Set(prev)
                          if (next.has(m.id)) next.delete(m.id)
                          else next.add(m.id)
                          return next
                        })}
                        className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors ${
                          isSelected
                            ? 'border-amber-600/40 bg-amber-600/5'
                            : 'border-gray-800 bg-gray-800/50 hover:bg-gray-800'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-amber-500 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-600 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-gray-200 font-medium truncate">{title}</span>
                            {showTypePill && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded font-medium">
                                {m.meeting_type.replace(/_/g, ' ')}
                              </span>
                            )}
                            {date && (
                              <span className="text-xs text-gray-500">
                                {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {!!m.duration_minutes && m.duration_minutes > 0 && (
                              <span className="text-xs text-gray-500">{m.duration_minutes}m</span>
                            )}
                          </div>
                          {m.participants?.length > 0 && (
                            <div className="text-xs text-amber-400/70 mt-0.5 truncate">
                              with {m.participants.join(', ')}
                            </div>
                          )}
                          {m.snippet && (
                            <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{m.snippet}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {m.has_transcript && (
                            <span className="text-[9px] px-1 py-0.5 bg-emerald-500/15 text-emerald-400 rounded">Transcript</span>
                          )}
                          {m.queued_count > 0 && (
                            <span className="text-[9px] px-1 py-0.5 bg-blue-500/15 text-blue-400 rounded">
                              {m.queued_count} post{m.queued_count > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Pagination */}
                {(() => {
                  const totalPages = Math.max(1, Math.ceil(meetingsTotal / MEETINGS_PER_PAGE))
                  if (totalPages <= 1) return null
                  return (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-gray-500">Page {meetingsPage} of {totalPages}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setMeetingsPage((p) => Math.max(1, p - 1))}
                          disabled={meetingsPage === 1}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-800 border border-gray-700 text-gray-300 hover:border-amber-600/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-3 h-3" /> Prev
                        </button>
                        <button
                          onClick={() => setMeetingsPage((p) => Math.min(totalPages, p + 1))}
                          disabled={meetingsPage === totalPages}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-800 border border-gray-700 text-gray-300 hover:border-amber-600/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Next <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
              {extractionStatus.state === 'running' || extractionStatus.state === 'stale' ? (
                <button
                  onClick={() => {
                    const runningRuns = extractionStatus.recentRuns.filter(r => r.status === 'running')
                    for (const run of runningRuns) {
                      extractionStatus.markRunFailed(run.id, 'Cancelled by user')
                    }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 transition-colors"
                >
                  <Square className="w-3.5 h-3.5" />
                  Cancel{(extractionStatus.runningCount ?? 0) > 1 ? ` All (${extractionStatus.runningCount})` : ' Extraction'}
                </button>
              ) : (
                <button
                  onClick={() => handleTriggerExtraction()}
                  disabled={triggerLoading}
                  className="admin-console-button-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {triggerLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {triggerLoading
                    ? 'Triggering...'
                    : selectedMeetings.size > 0
                      ? `Create Drafts from ${selectedMeetings.size} Meeting${selectedMeetings.size > 1 ? 's' : ''}`
                      : 'Create Drafts from Recent Meetings'
                  }
                </button>
              )}
              {selectedMeetings.size > 0 && selectedMeetings.size <= 3 && (() => {
                const titles = [...selectedMeetings]
                  .map(id => meetings.find(mt => mt.id === id)?.meeting_title || 'Untitled')
                  .join(', ')
                return (
                  <span className="text-xs text-amber-500 truncate max-w-[300px]">
                    {titles}
                  </span>
                )
              })()}
            </div>

            {triggerResult && (
              <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                triggerResult.success
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>
                {triggerResult.success ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                {triggerResult.message}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Voice-note Package Intake */}
      <div className="admin-console-card mb-6 rounded-lg border p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
              <Mic className="h-4 w-4 text-radiant-gold" />
              Voice-note package builder
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Use this when the idea is still rough or starts as a brainstorm. It creates a draft package for review before any publishing, scheduling, or provider step.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                'Source: voice note or typed idea',
                'Output: multi-format draft package',
                'Gate: internal review',
              ].map((label) => (
                <span key={label} className="rounded-full border border-silicon-slate bg-imperial-navy/50 px-2.5 py-1 text-[11px] text-gray-300">
                  {label}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowVoicePanel((p) => !p)}
            className="admin-console-button-primary"
          >
            <Sparkles className="h-4 w-4" />
            Build Package
          </button>
        </div>

        {showVoicePanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 grid gap-4 rounded-lg border border-silicon-slate bg-imperial-navy/55 p-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]"
          >
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-gray-500">Title</span>
                  <input
                    value={voiceTitle}
                    onChange={(e) => setVoiceTitle(e.target.value)}
                    placeholder="Optional package title"
                    className="w-full rounded-lg border border-silicon-slate bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-radiant-gold/60"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-gray-500">Topic</span>
                  <input
                    value={voiceTopic}
                    onChange={(e) => setVoiceTopic(e.target.value)}
                    placeholder="Main idea or angle"
                    className="w-full rounded-lg border border-silicon-slate bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-radiant-gold/60"
                  />
                </label>
              </div>

              <input
                value={voiceAudience}
                onChange={(e) => setVoiceAudience(e.target.value)}
                placeholder="Audience: founders, operators, nonprofit leaders, product teams..."
                className="w-full rounded-lg border border-silicon-slate bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-radiant-gold/60"
              />

              <textarea
                value={voiceTranscript}
                onChange={(e) => setVoiceTranscript(e.target.value)}
                rows={6}
                placeholder="Optional while recording. If left blank, the captured audio is transcribed server-side when OPENAI_API_KEY is configured."
                className="w-full rounded-lg border border-silicon-slate bg-imperial-navy/70 px-3 py-2 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-radiant-gold/60"
              />

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    isRecording
                      ? 'border-red-500/50 bg-red-500/15 text-red-300'
                      : 'border-radiant-gold/40 bg-radiant-gold/10 text-radiant-gold hover:bg-radiant-gold/20'
                  }`}
                >
                  {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {isRecording ? 'Stop Recording' : 'Record Natively'}
                </button>
                {voiceAudioFile && (
                  <span className="truncate text-xs text-emerald-400">Captured: {voiceAudioFile.name}</span>
                )}
              </div>

              <div>
                <div className="mb-2 text-xs text-gray-500">Outputs</div>
                <div className="flex flex-wrap gap-2">
                  {VOICE_NOTE_OUTPUTS.map((output) => (
                    <button
                      key={output.value}
                      type="button"
                      onClick={() => toggleVoiceOutput(output.value)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        voiceOutputs.includes(output.value)
                          ? 'border-radiant-gold/60 bg-radiant-gold/15 text-radiant-gold'
                          : 'border-silicon-slate text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {output.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs text-gray-500">Frameworks</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {contentFrameworks.map((framework) => (
                    <button
                      key={framework.id}
                      type="button"
                      onClick={() => toggleVoiceFramework(framework.id)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        voiceFrameworks.includes(framework.id)
                          ? 'border-radiant-gold/60 bg-radiant-gold/10'
                          : 'border-silicon-slate hover:border-gray-500'
                      }`}
                    >
                      <div className="text-xs font-semibold text-gray-200">{framework.creator_name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{framework.display_name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={submitVoiceIntake}
                disabled={voiceSubmitting || (!voiceAudioFile && voiceTranscript.trim().length < 10) || voiceOutputs.length === 0}
                className="admin-console-button-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {voiceSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Intake
              </button>
            </div>

            <div className="space-y-3">
              {voiceResult && (
                <div className={`rounded-lg border px-3 py-2 text-sm ${
                  voiceResult.success
                    ? 'border-green-500/30 bg-green-500/10 text-green-300'
                    : 'border-red-500/30 bg-red-500/10 text-red-300'
                }`}>
                  <div>{voiceResult.message}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {voiceResult.href && (
                      <Link href={voiceResult.href} className="inline-flex items-center gap-1 text-xs text-radiant-gold hover:underline">
                        Open generated draft <Eye className="h-3 w-3" />
                      </Link>
                    )}
                    {voiceResult.agentRunId && (
                      <Link href={`/admin/agents/runs/${voiceResult.agentRunId}`} className="inline-flex items-center gap-1 text-xs text-radiant-gold hover:underline">
                        Review gates <CheckCircle2 className="h-3 w-3" />
                      </Link>
                    )}
                    {voiceResult.packageId && !voiceResult.pptxUrl && (
                      <button
                        type="button"
                        onClick={() => generatePptxArtifact(voiceResult.packageId!)}
                        disabled={pptxGeneratingPackageId === voiceResult.packageId}
                        className="inline-flex items-center gap-1 text-xs text-radiant-gold hover:underline disabled:opacity-50"
                      >
                        {pptxGeneratingPackageId === voiceResult.packageId ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                        Generate PPTX
                      </button>
                    )}
                    {voiceResult.pptxUrl && (
                      <a href={voiceResult.pptxUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-radiant-gold hover:underline">
                        Open PowerPoint <FileText className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-silicon-slate bg-background/30 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-200">Recent intakes</h3>
                  <button onClick={fetchVoiceIntakes} className="text-xs text-radiant-gold hover:underline">Refresh</button>
                </div>
                {voiceLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>
                ) : voiceIntakes.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">No voice-note intakes yet.</p>
                ) : (
                  <div className="space-y-2">
                    {voiceIntakes.map((intake) => (
                      <div key={intake.id} className="rounded-lg border border-silicon-slate/80 bg-imperial-navy/50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-gray-200">{intake.title}</div>
                            <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-gray-500">
                              <span>{intake.status.replace(/_/g, ' ')}</span>
                              {intake.audio_file_name && <span>audio captured</span>}
                              <span>{new Date(intake.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {(intake.target_outputs ?? []).slice(0, 5).map((output) => (
                                <span key={output} className="rounded-full bg-silicon-slate/70 px-2 py-0.5 text-[10px] text-gray-300">{output.replace(/_/g, ' ')}</span>
                              ))}
                            </div>
                          </div>
                          {intake.status === 'packet_generated' ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-300">
                              Generated
                            </span>
                          ) : (
                          <button
                            onClick={() => generateVoicePackage(intake.id)}
                            disabled={voiceGeneratingId === intake.id}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-radiant-gold/40 px-2.5 py-1.5 text-xs text-radiant-gold hover:bg-radiant-gold/10 disabled:opacity-50"
                          >
                            {voiceGeneratingId === intake.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            Generate
                          </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
      </>
      )}

      {activeWorkflowView === 'review' && (
      <>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Drafts', value: stats.draft, color: 'text-gray-400' },
          { label: 'Approved', value: stats.approved, color: 'text-blue-400' },
          { label: 'Scheduled', value: stats.scheduled, color: 'text-amber-400' },
          { label: 'Published', value: stats.published, color: 'text-green-400' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-400' },
        ].map((stat) => (
          <div key={stat.label} className="admin-console-metric rounded-xl border p-3 text-center">
            <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="admin-console-card mb-6 flex flex-wrap items-center gap-3 rounded-lg border p-4">
        <Filter className="w-4 h-4 text-gray-500" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ContentStatus | 'all')}
          className="rounded-lg border border-silicon-slate bg-imperial-navy/70 px-3 py-1.5 text-sm text-foreground"
        >
          <option value="all">All Statuses</option>
          {CONTENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value as SocialPlatform | 'all')}
          className="rounded-lg border border-silicon-slate bg-imperial-navy/70 px-3 py-1.5 text-sm text-foreground"
        >
          <option value="all">All Platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search posts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-silicon-slate bg-imperial-navy/70 px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Content List */}
      <div id="social-content-approval-queue" className="scroll-mt-24" />
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No social content yet.</p>
          <p className="text-sm mt-1">Content will appear here when the extraction workflow runs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => {
            const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  href={buildLinkWithReturn(`/admin/social-content/${item.id}`, '/admin/social-content')}
                  className="admin-console-card admin-console-interactive block rounded-xl border p-4 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Image thumbnail */}
                    <div className="w-16 h-16 rounded-lg border border-silicon-slate bg-imperial-navy/70 flex-shrink-0 overflow-hidden flex items-center justify-center relative">
                      {item.image_url ? (
                        <Image src={item.image_url} alt="" className="object-cover" fill sizes="64px" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-gray-600" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {platformIcon(item.platform)}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusCfg.bgColor} ${statusCfg.color} border ${statusCfg.borderColor}`}>
                          {statusCfg.label}
                        </span>
                        {item.framework_visual_type && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/50">
                            {item.framework_visual_type}
                          </span>
                        )}
                        {item.voiceover_url && (
                          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </div>
                      <p className="text-sm text-gray-300 line-clamp-2">
                        {truncateForPreview(item.post_text, 200)}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        {item.meeting_title && (
                          <span className="flex items-center gap-1 text-blue-400/70 truncate max-w-[250px]">
                            <FileText className="w-3 h-3 flex-shrink-0" />
                            {item.meeting_title}
                          </span>
                        )}
                        {item.hashtags?.length > 0 && (
                          <span className="text-amber-500/70 truncate max-w-[200px]">
                            {formatHashtags(item.hashtags.slice(0, 3))}
                          </span>
                        )}
                        {item.scheduled_for && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Scheduled: {new Date(item.scheduled_for).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 mt-1" onClick={(e) => e.stopPropagation()}>
                      {(item.status === 'draft' || item.status === 'rejected') && (
                        <>
                          <button
                            onClick={(e) => handleQuickApprove(e, item.id)}
                            disabled={actionLoading === item.id}
                            title="Approve"
                            className="p-1.5 rounded-lg bg-green-900/30 hover:bg-green-900/60 text-green-400 border border-green-800/50 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ThumbsUp className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={(e) => handleQuickReject(e, item.id)}
                            disabled={actionLoading === item.id}
                            title="Reject"
                            className="p-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/60 text-red-400 border border-red-800/50 transition-colors disabled:opacity-50"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <Eye className="w-4 h-4 text-gray-600" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => fetchItems(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchItems(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}

export default function SocialContentPage() {
  return (
    <ProtectedRoute requireAdmin>
      <SocialContentQueuePage />
    </ProtectedRoute>
  )
}
