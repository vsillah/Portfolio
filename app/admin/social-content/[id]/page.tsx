'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { getBackUrl } from '@/lib/admin-return-context'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  XCircle,
  Send,
  Loader2,
  Image as ImageIcon,
  Volume2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Linkedin,
  Youtube,
  Instagram,
  Facebook,
  FileText,
  Sparkles,
  ExternalLink,
  AlertCircle,
  LayoutGrid,
  Download,
  Maximize2,
  X,
  BarChart3,
  Plus,
  Trash2,
  MessageSquare,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import {
  STATUS_CONFIG,
  PUBLISH_STATUS_CONFIG,
  PLATFORMS,
  FRAMEWORK_VISUAL_TYPES,
  getFullPostText,
} from '@/lib/social-content'
import {
  getProductionAssets,
  getVideoRedactionGate,
  type RedactionReviewDecision,
} from '@/lib/social-production-assets'
import type {
  SocialContentItem,
  SocialContentPublish,
  ContentStatus,
  FrameworkVisualType,
  SocialPlatform,
} from '@/lib/social-content'
import Link from 'next/link'

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  linkedin: <Linkedin className="w-4 h-4" />,
  youtube: <Youtube className="w-4 h-4" />,
  instagram: <Instagram className="w-4 h-4" />,
  facebook: <Facebook className="w-4 h-4" />,
}

const PLATFORM_COLORS: Record<string, { active: string; inactive: string }> = {
  linkedin: { active: 'bg-blue-600/20 border-blue-500 text-blue-300', inactive: 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600' },
  youtube: { active: 'bg-red-600/20 border-red-500 text-red-300', inactive: 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600' },
  instagram: { active: 'bg-pink-600/20 border-pink-500 text-pink-300', inactive: 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600' },
  facebook: { active: 'bg-blue-600/20 border-blue-500 text-blue-300', inactive: 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600' },
}

type GateState = 'approved' | 'in_review' | 'pending' | 'blocked' | 'rejected'
type SectionGateKey = 'visual_assets' | 'asset_packet' | 'privacy' | 'linkedin_draft'
type SectionGateDecision = 'approved' | 'rejected'

const GATE_STATE_CONFIG: Record<GateState, { label: string; className: string }> = {
  approved: {
    label: 'Approved',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  },
  in_review: {
    label: 'In review',
    className: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
  },
  pending: {
    label: 'Pending',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  },
  blocked: {
    label: 'Blocked',
    className: 'border-red-500/35 bg-red-500/10 text-red-200',
  },
  rejected: {
    label: 'Rejected',
    className: 'border-red-500/40 bg-red-500/10 text-red-200',
  },
}

const SECTION_GATE_KEYS: SectionGateKey[] = ['visual_assets', 'asset_packet', 'privacy', 'linkedin_draft']

const SECTION_GATE_HREFS: Record<SectionGateKey, string> = {
  visual_assets: '#social-visual-assets-gate',
  asset_packet: '#social-asset-packet-gate',
  privacy: '#social-asset-packet-gate',
  linkedin_draft: '#social-draft-approval-gate',
}

const SECTION_GATE_LABELS: Record<SectionGateKey, string> = {
  visual_assets: 'Visual assets',
  asset_packet: 'Asset packet',
  privacy: 'Privacy',
  linkedin_draft: 'LinkedIn draft',
}

function gateStateFromRawStatus(value: string): GateState {
  const status = value.toLowerCase()
  if (!status) return 'pending'
  if (['passed', 'approved', 'complete', 'completed', 'ready', 'summarized', 'manual_packet_summarized'].includes(status)) {
    return 'approved'
  }
  if (['failed', 'blocked', 'rejected', 'error'].includes(status)) return 'blocked'
  if (status.includes('review') || status.includes('running') || status.includes('progress')) return 'in_review'
  return 'pending'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)))
    : []
}

type CalibrationFeedback = {
  prior_post_excerpt: string
  success_examples: CalibrationSuccessExample[]
  engagement_signal: string
  audience_context: string
  revision_request: string
  claim_boundaries: string
}

type CalibrationSuccessExample = {
  source_label: string
  post_excerpt: string
  engagement_signal: string
  why_it_worked: string
}

const EMPTY_SUCCESS_EXAMPLE: CalibrationSuccessExample = {
  source_label: '',
  post_excerpt: '',
  engagement_signal: '',
  why_it_worked: '',
}

const EMPTY_CALIBRATION_FEEDBACK: CalibrationFeedback = {
  prior_post_excerpt: '',
  success_examples: [{ ...EMPTY_SUCCESS_EXAMPLE }],
  engagement_signal: '',
  audience_context: '',
  revision_request: '',
  claim_boundaries: '',
}

function normalizeSuccessExamples(value: unknown, fallbackExcerpt = '', fallbackEngagement = ''): CalibrationSuccessExample[] {
  const examples = Array.isArray(value)
    ? value
        .map((item) => {
          const record = asRecord(item)
          if (!record) return null
          return {
            source_label: asString(record.source_label),
            post_excerpt: asString(record.post_excerpt),
            engagement_signal: asString(record.engagement_signal),
            why_it_worked: asString(record.why_it_worked),
          }
        })
        .filter((item): item is CalibrationSuccessExample => Boolean(item))
    : []

  const hasStructuredExample = examples.some((example) => (
    example.source_label.trim()
    || example.post_excerpt.trim()
    || example.engagement_signal.trim()
    || example.why_it_worked.trim()
  ))

  if (hasStructuredExample) return examples
  if (fallbackExcerpt.trim() || fallbackEngagement.trim()) {
    return [{
      source_label: '',
      post_excerpt: fallbackExcerpt,
      engagement_signal: fallbackEngagement,
      why_it_worked: '',
    }]
  }
  return [{ ...EMPTY_SUCCESS_EXAMPLE }]
}

function formatSuccessExamplesForPrompt(examples: CalibrationSuccessExample[]): string {
  return examples
    .filter((example) => (
      example.source_label.trim()
      || example.post_excerpt.trim()
      || example.engagement_signal.trim()
      || example.why_it_worked.trim()
    ))
    .map((example, index) => [
      `Example ${index + 1}${example.source_label.trim() ? `: ${example.source_label.trim()}` : ''}`,
      example.post_excerpt.trim(),
      example.engagement_signal.trim() ? `Engagement: ${example.engagement_signal.trim()}` : '',
      example.why_it_worked.trim() ? `Why it worked: ${example.why_it_worked.trim()}` : '',
    ].filter(Boolean).join('\n'))
    .join('\n\n')
}

function SocialContentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const backUrl = getBackUrl(searchParams, '/admin/social-content')
  const [item, setItem] = useState<SocialContentItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [regeneratingImage, setRegeneratingImage] = useState(false)
  const [regeneratingAudio, setRegeneratingAudio] = useState(false)
  const [convertingFormat, setConvertingFormat] = useState(false)
  const [capturingAppCarousel, setCapturingAppCarousel] = useState(false)
  const [preparingAssetPacket, setPreparingAssetPacket] = useState(false)
  const [creatingLinkedInDraft, setCreatingLinkedInDraft] = useState(false)
  const [reviewingRedactionId, setReviewingRedactionId] = useState<string | null>(null)
  const [selectedSlide, setSelectedSlide] = useState(0)
  const [publishing, setPublishing] = useState(false)
  const [refreshingEngagement, setRefreshingEngagement] = useState(false)
  const [savingCalibration, setSavingCalibration] = useState(false)
  const [revisingCalibration, setRevisingCalibration] = useState(false)
  const [requestingCopyRevision, setRequestingCopyRevision] = useState(false)
  const [savingSectionGate, setSavingSectionGate] = useState<SectionGateKey | null>(null)
  const [showSource, setShowSource] = useState(false)
  const [expandedSection, setExpandedSection] = useState<'rag' | 'transcript' | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [targetPlatforms, setTargetPlatforms] = useState<SocialPlatform[]>(['linkedin'])
  const [calibrationFeedback, setCalibrationFeedback] = useState<CalibrationFeedback>(EMPTY_CALIBRATION_FEEDBACK)

  const [postText, setPostText] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [imagePrompt, setImagePrompt] = useState('')
  const [voiceoverText, setVoiceoverText] = useState('')
  const [frameworkVisualType, setFrameworkVisualType] = useState<FrameworkVisualType | ''>('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [copyRevisionRequest, setCopyRevisionRequest] = useState('')
  const [sectionGateNotes, setSectionGateNotes] = useState<Record<SectionGateKey, string>>({
    visual_assets: '',
    asset_packet: '',
    privacy: '',
    linkedin_draft: '',
  })
  const [sectionGateRejecting, setSectionGateRejecting] = useState<Record<SectionGateKey, boolean>>({
    visual_assets: false,
    asset_packet: false,
    privacy: false,
    linkedin_draft: false,
  })
  const rejectedGateKeysRef = useRef<SectionGateKey[]>([])

  const fetchItem = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch(`/api/admin/social-content/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        const data = await res.json()
        const i = data.item as SocialContentItem
        setItem(i)
        setPostText(i.post_text || '')
        setCtaText(i.cta_text || '')
        setCtaUrl(i.cta_url || '')
        setHashtags(i.hashtags?.join(', ') || '')
        setImagePrompt(i.image_prompt || '')
        setVoiceoverText(i.voiceover_text || '')
        setFrameworkVisualType(i.framework_visual_type || '')
        setScheduledFor(i.scheduled_for ? new Date(i.scheduled_for).toISOString().slice(0, 16) : '')
        setAdminNotes(i.admin_notes || '')
        setTargetPlatforms(i.target_platforms?.length ? i.target_platforms : ['linkedin'])
        const rag = asRecord(i.rag_context)
        const calibration = asRecord(rag?.content_calibration)
        const operatorFeedback = asRecord(calibration?.operator_feedback)
        const priorPostExcerpt = asString(operatorFeedback?.prior_post_excerpt)
        const engagementSignal = asString(operatorFeedback?.engagement_signal)
        setCalibrationFeedback({
          prior_post_excerpt: priorPostExcerpt,
          success_examples: normalizeSuccessExamples(operatorFeedback?.success_examples, priorPostExcerpt, engagementSignal),
          engagement_signal: engagementSignal,
          audience_context: asString(operatorFeedback?.audience_context),
          revision_request: asString(operatorFeedback?.revision_request),
          claim_boundaries: asString(operatorFeedback?.claim_boundaries),
        })
        setCopyRevisionRequest(asString(operatorFeedback?.revision_request))
      }
    } catch (err) {
      console.error('Failed to fetch item:', err)
    } finally {
      if (!options.silent) setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchItem()
  }, [fetchItem])

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const getRejectedSectionGateKeys = useCallback((contentItem: SocialContentItem | null) => {
    const rag = asRecord(contentItem?.rag_context)
    const reviews = asRecord(rag?.section_gate_reviews) ?? {}
    return SECTION_GATE_KEYS.filter((gateKey) => asString(asRecord(reviews[gateKey])?.status) === 'rejected')
  }, [])

  useEffect(() => {
    if (!item) return
    const rejectedGateKeys = getRejectedSectionGateKeys(item)
    const previousRejectedGateKeys = rejectedGateKeysRef.current
    const returnedGateKey = previousRejectedGateKeys.find((gateKey) => !rejectedGateKeys.includes(gateKey))
    rejectedGateKeysRef.current = rejectedGateKeys

    if (returnedGateKey) {
      const href = SECTION_GATE_HREFS[returnedGateKey]
      window.requestAnimationFrame(() => {
        document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        window.history.replaceState(null, '', href)
      })
      showMsg('success', `${SECTION_GATE_LABELS[returnedGateKey]} revision returned for review`)
    }
  }, [getRejectedSectionGateKeys, item])

  useEffect(() => {
    if (!item || getRejectedSectionGateKeys(item).length === 0) return
    const poll = window.setInterval(() => {
      void fetchItem({ silent: true })
    }, 10000)
    return () => window.clearInterval(poll)
  }, [fetchItem, getRejectedSectionGateKeys, item])

  const getFormPayload = () => ({
    post_text: postText,
    cta_text: ctaText || null,
    cta_url: ctaUrl || null,
    hashtags: hashtags.split(',').map(t => t.trim()).filter(Boolean),
    image_prompt: imagePrompt || null,
    voiceover_text: voiceoverText || null,
    framework_visual_type: frameworkVisualType || null,
    scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
    admin_notes: adminNotes || null,
    target_platforms: targetPlatforms,
  })

  const saveForm = async (): Promise<boolean> => {
    try {
      const session = await getCurrentSession()
      if (!session) return false

      const res = await fetch(`/api/admin/social-content/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(getFormPayload()),
      })

      if (res.ok) {
        const data = await res.json()
        setItem(prev => prev ? { ...prev, ...data.item } : prev)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const handleSave = async () => {
    setSaving(true)
    const saved = await saveForm()
    showMsg(saved ? 'success' : 'error', saved ? 'Saved successfully' : 'Failed to save')
    setSaving(false)
  }

  const updateCalibrationFeedback = (key: Exclude<keyof CalibrationFeedback, 'success_examples'>, value: string) => {
    setCalibrationFeedback((current) => ({ ...current, [key]: value }))
  }

  const updateCalibrationSuccessExample = (
    index: number,
    key: keyof CalibrationSuccessExample,
    value: string,
  ) => {
    setCalibrationFeedback((current) => ({
      ...current,
      success_examples: current.success_examples.map((example, exampleIndex) => (
        exampleIndex === index ? { ...example, [key]: value } : example
      )),
    }))
  }

  const addCalibrationSuccessExample = () => {
    setCalibrationFeedback((current) => ({
      ...current,
      success_examples: [...current.success_examples, { ...EMPTY_SUCCESS_EXAMPLE }],
    }))
  }

  const removeCalibrationSuccessExample = (index: number) => {
    setCalibrationFeedback((current) => {
      const nextExamples = current.success_examples.filter((_, exampleIndex) => exampleIndex !== index)
      return {
        ...current,
        success_examples: nextExamples.length ? nextExamples : [{ ...EMPTY_SUCCESS_EXAMPLE }],
      }
    })
  }

  const buildOperatorFeedback = (revisionRequestOverride = calibrationFeedback.revision_request) => {
    const successExamples = calibrationFeedback.success_examples
      .map((example) => ({
        source_label: example.source_label.trim(),
        post_excerpt: example.post_excerpt.trim(),
        engagement_signal: example.engagement_signal.trim(),
        why_it_worked: example.why_it_worked.trim(),
      }))
      .filter((example) => (
        example.source_label
        || example.post_excerpt
        || example.engagement_signal
        || example.why_it_worked
      ))
    const structuredPriorPostExcerpt = formatSuccessExamplesForPrompt(successExamples)
    return {
      prior_post_excerpt: structuredPriorPostExcerpt || calibrationFeedback.prior_post_excerpt.trim(),
      success_examples: successExamples,
      engagement_signal: calibrationFeedback.engagement_signal.trim(),
      audience_context: calibrationFeedback.audience_context.trim(),
      revision_request: revisionRequestOverride.trim(),
      claim_boundaries: calibrationFeedback.claim_boundaries.trim(),
      updated_at: new Date().toISOString(),
    }
  }

  const handleSaveCalibrationFeedback = async () => {
    if (!item) return
    setSavingCalibration(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const existingRag = asRecord(item.rag_context) ?? {}
      const existingCalibration = asRecord(existingRag.content_calibration) ?? {}
      const feedback = buildOperatorFeedback()
      const hasFeedback = Object.entries(feedback)
        .filter(([key]) => key !== 'updated_at')
        .some(([, value]) => Array.isArray(value) ? value.length > 0 : Boolean(value))
      const rag_context = {
        ...existingRag,
        content_calibration: {
          ...existingCalibration,
          status: hasFeedback ? 'ready_for_draft_review' : asString(existingCalibration.status) || 'needs_operator_context',
          operator_feedback: feedback,
        },
      }

      const res = await fetch(`/api/admin/social-content/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rag_context }),
      })

      if (res.ok) {
        const data = await res.json()
        setItem(prev => prev ? { ...prev, ...data.item } : prev)
        showMsg('success', 'Calibration feedback saved')
      } else {
        const data = await res.json()
        showMsg('error', data.error || 'Failed to save calibration feedback')
      }
    } catch {
      showMsg('error', 'Failed to save calibration feedback')
    } finally {
      setSavingCalibration(false)
    }
  }

  const handleRequestCopyRevision = async (generateRevision: boolean) => {
    if (!item) return
    const revisionRequest = copyRevisionRequest.trim()
    if (!revisionRequest) {
      showMsg('error', 'Add revision feedback before reopening approval')
      return
    }
    setRequestingCopyRevision(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const existingRag = asRecord(item.rag_context) ?? {}
      const existingCalibration = asRecord(existingRag.content_calibration) ?? {}
      const feedback = buildOperatorFeedback(revisionRequest)
      const requestedAt = new Date().toISOString()
      const revisionRequests = Array.isArray(existingCalibration.revision_requests)
        ? existingCalibration.revision_requests
        : []
      const rag_context = {
        ...existingRag,
        content_calibration: {
          ...existingCalibration,
          status: generateRevision ? 'revision_generation_requested' : 'revision_requested',
          operator_feedback: feedback,
          approval_reversal: {
            reverted_at: requestedAt,
            previous_status: item.status,
            reason: revisionRequest,
          },
          revision_requests: [
            ...revisionRequests,
            {
              created_at: requestedAt,
              previous_status: item.status,
              request: revisionRequest,
              action: generateRevision ? 'reject_and_generate_revision' : 'reopen_for_revision',
            },
          ].slice(-10),
        },
      }
      const nextAdminNotes = [
        adminNotes,
        `Copy revision requested on ${requestedAt}.\n${revisionRequest}`,
      ].filter(Boolean).join('\n\n')

      const res = await fetch(`/api/admin/social-content/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'rejected',
          rag_context,
          admin_notes: nextAdminNotes,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        showMsg('error', data.error || 'Failed to reopen approval')
        return
      }

      const reopened = data.item as SocialContentItem
      setItem(prev => prev ? { ...prev, ...reopened } : reopened)
      setAdminNotes(reopened.admin_notes || nextAdminNotes)
      setCalibrationFeedback((current) => ({
        ...current,
        revision_request: revisionRequest,
      }))

      if (!generateRevision) {
        showMsg('success', 'Approval reverted. Revision feedback saved.')
        return
      }

      const revisionRes = await fetch(`/api/admin/social-content/${id}/calibration-revision`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operator_feedback: feedback }),
      })
      const revisionData = await revisionRes.json()
      if (!revisionRes.ok) {
        showMsg('error', revisionData.error || 'Approval reverted, but revision generation failed')
        return
      }

      const updated = revisionData.item as SocialContentItem
      setItem(updated)
      setPostText(updated.post_text || '')
      setCtaText(updated.cta_text || '')
      setHashtags(updated.hashtags?.join(', ') || '')
      setImagePrompt(updated.image_prompt || '')
      setAdminNotes(updated.admin_notes || '')
      showMsg('success', 'Approval reverted and revised draft generated.')
    } catch {
      showMsg('error', 'Failed to request copy revision')
    } finally {
      setRequestingCopyRevision(false)
    }
  }

  const handleSectionGateDecision = async (
    gateKey: SectionGateKey,
    decision: SectionGateDecision,
  ) => {
    if (!item) return
    const note = sectionGateNotes[gateKey]?.trim() || ''
    if (decision === 'rejected' && !note) {
      showMsg('error', 'Add a rejection note before rejecting this section')
      return
    }
    setSavingSectionGate(gateKey)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const existingRag = asRecord(item.rag_context) ?? {}
      const existingReviews = asRecord(existingRag.section_gate_reviews) ?? {}
      const decidedAt = new Date().toISOString()
      const existingReview = asRecord(existingReviews[gateKey]) ?? {}
      const section_gate_reviews = {
        ...existingReviews,
        [gateKey]: {
          ...existingReview,
          status: decision,
          decided_at: decidedAt,
          decided_by: (session as { user?: { id?: string } }).user?.id ?? null,
          note: note || null,
          repair_status: decision === 'rejected' ? 'requested' : null,
          repair_requested_at: decision === 'rejected' ? decidedAt : null,
        },
      }
      const rag_context = {
        ...existingRag,
        section_gate_reviews,
      }

      const res = await fetch(`/api/admin/social-content/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rag_context }),
      })
      const data = await res.json()
      if (!res.ok) {
        showMsg('error', data.error || 'Failed to save section decision')
        return
      }

      setItem(prev => prev ? { ...prev, ...data.item } : data.item)
      setSectionGateNotes((current) => ({ ...current, [gateKey]: '' }))
      setSectionGateRejecting((current) => ({ ...current, [gateKey]: false }))
      showMsg('success', decision === 'approved' ? 'Section approved' : 'Section rejected')
    } catch {
      showMsg('error', 'Failed to save section decision')
    } finally {
      setSavingSectionGate(null)
    }
  }

  const handleGenerateCalibrationRevision = async () => {
    if (!item) return
    setRevisingCalibration(true)
    try {
      const saved = await saveForm()
      if (!saved) {
        showMsg('error', 'Save the current draft before generating a calibrated revision')
        return
      }

      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch(`/api/admin/social-content/${id}/calibration-revision`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operator_feedback: calibrationFeedback }),
      })

      const data = await res.json()
      if (!res.ok) {
        showMsg('error', data.error || 'Failed to generate calibrated revision')
        return
      }

      const updated = data.item as SocialContentItem
      setItem(updated)
      setPostText(updated.post_text || '')
      setCtaText(updated.cta_text || '')
      setHashtags(updated.hashtags?.join(', ') || '')
      setImagePrompt(updated.image_prompt || '')
      setAdminNotes(updated.admin_notes || '')
      showMsg('success', 'Calibrated revision generated')
    } catch {
      showMsg('error', 'Failed to generate calibrated revision')
    } finally {
      setRevisingCalibration(false)
    }
  }

  const handleApprove = async () => {
    if (!canApproveAgentPilot) {
      showMsg('error', 'Agent Ops content must clear challenger QA before approval')
      return
    }
    if (videoPrivacyBlocked) {
      showMsg('error', redactionGate.message || 'Video privacy review required before publish readiness')
      return
    }
    setApproving(true)
    setShowConfirmModal(false)
    try {
      // Save form state first so DB has latest platforms + schedule
      const saved = await saveForm()
      if (!saved) {
        showMsg('error', 'Failed to save changes before approving')
        setApproving(false)
        return
      }

      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch(`/api/admin/social-content/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setItem(prev => prev ? { ...prev, ...data.item, publishes: data.publishes } : prev)

        if (data.reference_work_item) {
          showMsg('success', 'Draft approved and reference handoff queued.')
        } else if (scheduledFor) {
          showMsg('success', 'Approved and scheduled!')
        } else {
          showMsg('success', data.publish_triggered
            ? 'Approved and publishing triggered!'
            : 'Approved (publish not triggered — check configuration)')
        }
        // Re-fetch to get latest publish statuses
        setTimeout(() => fetchItem(), 1500)
      } else {
        const data = await res.json()
        showMsg('error', data.error || 'Failed to approve')
      }
    } catch {
      showMsg('error', 'Failed to approve')
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async () => {
    if (!confirm('Reject this post? It will return to draft state for re-editing.')) return
    setSaving(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      await fetch(`/api/admin/social-content/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'rejected', admin_notes: adminNotes }),
      })

      setItem(prev => prev ? { ...prev, status: 'rejected' as ContentStatus } : prev)
      showMsg('success', 'Rejected')
    } catch {
      showMsg('error', 'Failed to reject')
    } finally {
      setSaving(false)
    }
  }

  const handleRetryPublish = async (platforms?: SocialPlatform[]) => {
    if (videoPrivacyBlocked) {
      showMsg('error', redactionGate.message || 'Video privacy review required before publishing')
      return
    }
    setPublishing(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch(`/api/admin/social-content/${id}/publish`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(platforms ? { platforms } : {}),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.publishes) {
          setItem(prev => prev ? { ...prev, publishes: data.publishes } : prev)
        }
        showMsg(data.published ? 'success' : 'error',
          data.published ? 'Published successfully!' : 'No platforms published — check status below')
        fetchItem()
      } else {
        showMsg('error', 'Publish request failed')
      }
    } catch {
      showMsg('error', 'Failed to trigger publish')
    } finally {
      setPublishing(false)
    }
  }

  const handleRefreshEngagement = async () => {
    setRefreshingEngagement(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch('/api/admin/social-content/engagement/refresh', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ platform: 'linkedin', content_id: id, force: true }),
      })
      const data = await res.json()
      if (!res.ok || data.errors?.length) {
        showMsg('error', data.error || data.errors?.[0]?.message || 'Engagement refresh failed')
        return
      }
      await fetchItem()
      showMsg('success', data.refreshed ? 'Engagement metrics refreshed' : 'No published LinkedIn post found to refresh')
    } catch {
      showMsg('error', 'Engagement refresh failed')
    } finally {
      setRefreshingEngagement(false)
    }
  }

  const handleRegenerateImage = async () => {
    setRegeneratingImage(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch(`/api/admin/social-content/${id}/regenerate-image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_prompt: imagePrompt,
          framework_visual_type: frameworkVisualType || null,
        }),
      })

      const data = await res.json()
      if (data.triggered && data.image_url) {
        setItem(prev => prev ? { ...prev, image_url: data.image_url } : prev)
      }
      showMsg(data.triggered ? 'success' : 'error', data.message)
    } catch {
      showMsg('error', 'Failed to trigger image regeneration')
    } finally {
      setRegeneratingImage(false)
    }
  }

  const handleRegenerateAudio = async () => {
    setRegeneratingAudio(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch(`/api/admin/social-content/${id}/regenerate-audio`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ voiceover_text: voiceoverText }),
      })

      const data = await res.json()
      showMsg(data.triggered ? 'success' : 'error', data.message)
    } catch {
      showMsg('error', 'Failed to trigger audio regeneration')
    } finally {
      setRegeneratingAudio(false)
    }
  }

  const handleBuildAppScreenshotCarousel = async () => {
    if (!confirm('Build a carousel from Portfolio app screenshots? This captures admin review surfaces, uploads the screenshots, and replaces the current visual asset with a carousel. It will not publish this post.')) return
    setCapturingAppCarousel(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch(`/api/admin/social-content/${id}/capture-app-carousel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      const data = await res.json()
      if (data.success) {
        setItem(prev => prev ? {
          ...prev,
          content_format: 'carousel',
          carousel_slides: data.carousel_slides,
          carousel_slide_urls: data.carousel_slide_urls,
          carousel_pdf_url: data.carousel_pdf_url,
          rag_context: data.rag_context || prev.rag_context,
        } : prev)
        setSelectedSlide(0)
        showMsg('success', `App screenshot carousel built with ${data.slide_count} slides`)
      } else {
        showMsg('error', data.error || 'Failed to build app screenshot carousel')
      }
    } catch {
      showMsg('error', 'Failed to build app screenshot carousel')
    } finally {
      setCapturingAppCarousel(false)
    }
  }

  const handlePrepareAssetPacket = async () => {
    if (!confirm('Prepare the production asset packet with direct Chronicle ingestion? This creates review-only references, Chronicle evidence, b-roll hints, video script, and redaction checks. It will not call providers, publish, schedule, or upload a final video.')) return
    setPreparingAssetPacket(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch(`/api/admin/social-content/${id}/prepare-asset-packet`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chronicle_scope: {
            approved: true,
            source: 'social_content_detail',
            window_label: 'operator-approved current Social Content production review',
          },
        }),
      })

      const data = await res.json()
      if (data.success) {
        setItem(prev => prev ? { ...prev, rag_context: data.rag_context || prev.rag_context } : prev)
        showMsg('success', 'Production asset packet prepared for review')
      } else {
        showMsg('error', data.error || 'Failed to prepare production asset packet')
      }
    } catch {
      showMsg('error', 'Failed to prepare production asset packet')
    } finally {
      setPreparingAssetPacket(false)
    }
  }

  const handleCreateLinkedInDraft = async () => {
    if (!confirm('Create a LinkedIn-ready draft packet? This queues an internal draft handoff only. It will not publish, schedule, send to LinkedIn, or create a public post.')) return
    setCreatingLinkedInDraft(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch(`/api/admin/social-content/${id}/create-linkedin-draft`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await res.json()
      if (!res.ok) {
        showMsg('error', data.blockers?.length ? data.blockers[0] : data.error || 'Failed to create LinkedIn draft')
        return
      }

      setItem(prev => data.item ? { ...prev, ...data.item } : prev)
      showMsg('success', 'LinkedIn draft handoff created')
    } catch {
      showMsg('error', 'Failed to create LinkedIn draft')
    } finally {
      setCreatingLinkedInDraft(false)
    }
  }

  const handleReviewRedaction = async (itemId: string, decision: RedactionReviewDecision) => {
    setReviewingRedactionId(itemId)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch(`/api/admin/social-content/${id}/review-video-redaction`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ item_id: itemId, decision }),
      })

      const data = await res.json()
      if (data.success) {
        setItem(prev => prev ? { ...prev, rag_context: data.rag_context || prev.rag_context } : prev)
        showMsg('success', 'Redaction review updated')
      } else {
        showMsg('error', data.error || 'Failed to update redaction review')
      }
    } catch {
      showMsg('error', 'Failed to update redaction review')
    } finally {
      setReviewingRedactionId(null)
    }
  }

  const handleConvertToSingleImage = async () => {
    if (!confirm('Convert this post to a single image? This will clear all carousel data and regenerate the framework illustration.')) return
    await handleRegenerateImage()
  }

  const handleRegenerateCarousel = async () => {
    if (!item?.carousel_slides) return
    setConvertingFormat(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch('/api/admin/social-content/render-carousel', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content_id: id }),
      })

      const data = await res.json()
      if (data.success) {
        setItem(prev => prev ? {
          ...prev,
          carousel_slide_urls: data.carousel_slide_urls,
          carousel_pdf_url: data.carousel_pdf_url,
        } : prev)
        showMsg('success', 'Carousel re-rendered successfully')
      } else {
        showMsg('error', data.error || 'Failed to re-render carousel')
      }
    } catch {
      showMsg('error', 'Failed to re-render carousel')
    } finally {
      setConvertingFormat(false)
    }
  }

  const togglePlatform = (platform: SocialPlatform) => {
    setTargetPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <p className="text-gray-400">Content not found.</p>
        <Link href={backUrl} className="text-blue-400 hover:underline text-sm mt-2 inline-block">
          Back
        </Link>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft
  const isEditable = item.status === 'draft' || item.status === 'rejected'
  const enabledPlatformLabels = targetPlatforms
    .map(p => PLATFORMS.find(pl => pl.value === p)?.label || p)
    .join(', ')
  const ragContext = asRecord(item.rag_context)
  const isAgentSocialPilot = ragContext?.source === 'agent_ops_social_outreach_goal'
  const agentPilotGoalId = asString(ragContext?.goal_id)
  const agentPilotPacketId = asString(ragContext?.content_packet_id)
  const agentPilotPublishGate = asString(ragContext?.publish_gate)
  const agentPilotChronicleStatus = asString(ragContext?.chronicle_packet_status)
  const agentPilotVisualBrief = asString(ragContext?.visual_brief)
  const agentPilotProvenance = asStringArray(ragContext?.source_provenance_checklist)
  const agentPilotApprovalChecklist = asStringArray(ragContext?.approval_checklist)
  const agentPilotOpenBrainReferences = asStringArray(ragContext?.open_brain_references)
  const agentPilotCurrentGate = asString(ragContext?.current_gate)
  const agentPilotGateStatus = asString(ragContext?.gate_status)
  const agentPilotChallengerStatus = asString(ragContext?.challenger_status)
  const agentPilotPassToHuman = ragContext?.pass_to_human === true
  const agentPilotRequiredFixes = asStringArray(ragContext?.required_fixes)
  const agentPilotCalibration = asRecord(ragContext?.content_calibration)
  const agentPilotCalibrationStatus = asString(agentPilotCalibration?.status)
  const agentPilotLatestRevision = asRecord(agentPilotCalibration?.latest_revision)
  const agentPilotLatestRevisionCreatedAt = asString(agentPilotLatestRevision?.created_at)
  const agentPilotRevisionUnderstanding = asRecord(agentPilotLatestRevision?.shaka_understanding)
  const agentPilotRevisionNotes = asStringArray(agentPilotLatestRevision?.revision_notes)
  const agentPilotRevisionRequest = asString(agentPilotLatestRevision?.operator_request)
  const agentPilotWhatHeard = asString(agentPilotRevisionUnderstanding?.what_i_heard)
  const agentPilotPlannedChanges = asStringArray(agentPilotRevisionUnderstanding?.planned_changes)
  const agentPilotNotChanging = asStringArray(agentPilotRevisionUnderstanding?.not_changing)
  const agentPilotSeparateActions = asStringArray(agentPilotRevisionUnderstanding?.separate_actions)
  const agentPilotQuestionsOrAmbiguity = asStringArray(agentPilotRevisionUnderstanding?.questions_or_ambiguity)
  const hasAgentPilotRevisionReceipt = Boolean(agentPilotLatestRevision)
  const agentPilotPriorPatterns = asRecordArray(agentPilotCalibration?.prior_success_patterns)
  const agentPilotVoicePrinciples = asStringArray(agentPilotCalibration?.voice_principles)
  const agentPilotMissingContextPrompts = asStringArray(agentPilotCalibration?.missing_context_prompts)
  const agentPilotComparisonPrompt = asString(agentPilotCalibration?.comparison_prompt)
  const agentPilotOperatorFeedback = asRecord(agentPilotCalibration?.operator_feedback)
  const agentPilotFeedbackUpdatedAt = asString(agentPilotOperatorFeedback?.updated_at)
  const productionAssets = getProductionAssets(ragContext)
  const redactionGate = getVideoRedactionGate(productionAssets)
  const sectionGateReviews = asRecord(ragContext?.section_gate_reviews) ?? {}
  const getSectionGateReview = (gateKey: SectionGateKey) => asRecord(sectionGateReviews[gateKey])
  const getExplicitSectionGateState = (gateKey: SectionGateKey, fallback: GateState): GateState => {
    const status = asString(getSectionGateReview(gateKey)?.status)
    if (status === 'approved') return 'approved'
    if (status === 'rejected') return 'rejected'
    return fallback
  }
  const productionAssetSteps = productionAssets ? [
    { label: 'References', value: `${productionAssets.references.open_brain.length + productionAssets.references.public_sources.length} refs` },
    { label: 'Chronicle evidence', value: `${productionAssets.chronicle_evidence.proposals.length} proposals` },
    { label: 'Framework illustration', value: productionAssets.illustration.status.replace(/_/g, ' ') },
    { label: 'App screenshot carousel', value: `${productionAssets.app_screenshot_carousel.routes.length} routes` },
    { label: 'B-roll', value: `${productionAssets.broll.assets.length} assets` },
    { label: 'Video script', value: productionAssets.video_script.status.replace(/_/g, ' ') },
    { label: 'Privacy/redaction review', value: redactionGate.ready ? 'ready' : `${redactionGate.unresolvedItems.length} unresolved` },
    { label: 'Visual QA', value: productionAssets.visual_qa.status.replace(/_/g, ' ') },
  ] : []
  const hasCalibrationSuccessExampleInput = calibrationFeedback.success_examples
    .some((example) => (
      example.source_label.trim()
      || example.post_excerpt.trim()
      || example.engagement_signal.trim()
      || example.why_it_worked.trim()
    ))
  const hasCalibrationFeedbackInput = hasCalibrationSuccessExampleInput
    || calibrationFeedback.prior_post_excerpt.trim().length > 0
    || calibrationFeedback.engagement_signal.trim().length > 0
    || calibrationFeedback.audience_context.trim().length > 0
    || calibrationFeedback.revision_request.trim().length > 0
    || calibrationFeedback.claim_boundaries.trim().length > 0
  const hasAgentPilotCalibrationGuidance = agentPilotPriorPatterns.length > 0
    || agentPilotVoicePrinciples.length > 0
    || agentPilotMissingContextPrompts.length > 0
    || Boolean(agentPilotComparisonPrompt)
  const engagement = asRecord(ragContext?.engagement)
  const engagementLatest = asRecord(engagement?.latest)
  const engagementScore = typeof engagement?.latest_score === 'number' ? engagement.latest_score : null
  const engagementRecommendationLabel = asString(engagement?.recommendation_label)
  const engagementTheme = asString(engagement?.mapped_theme)
  const engagementCapturedAt = asString(engagementLatest?.capturedAt)
  const engagementComments = typeof engagementLatest?.comments === 'number' ? engagementLatest.comments : 0
  const engagementShares = (typeof engagementLatest?.shares === 'number' ? engagementLatest.shares : 0) + (typeof engagementLatest?.reposts === 'number' ? engagementLatest.reposts : 0)
  const engagementReactions = typeof engagementLatest?.reactions === 'number'
    ? engagementLatest.reactions
    : typeof engagementLatest?.likes === 'number'
      ? engagementLatest.likes
      : 0
  const isDraftOnlyPilot = isAgentSocialPilot && agentPilotPublishGate === 'draft_only'
  const canApproveAgentPilot = !isAgentSocialPilot || agentPilotPassToHuman
  const videoPrivacyBlocked = Boolean(productionAssets && !redactionGate.ready)
  const canRequestCopyRevision = isAgentSocialPilot && item.status === 'approved'
  const canEditVisualProduction = isEditable || (isDraftOnlyPilot && item.status === 'approved')
  const visualProductionUnlocked = canEditVisualProduction && isDraftOnlyPilot
  const frameworkIllustrationLabel = item.image_url
    ? 'Regenerate Framework Illustration'
    : 'Generate Framework Illustration'
  const isCarouselFormat = item.content_format === 'carousel'
  const isSingleImageFormat = !isCarouselFormat
  const frameworkActionLabel = isCarouselFormat
    ? 'Switch to Framework Illustration'
    : frameworkIllustrationLabel
  const carouselActionLabel = isCarouselFormat
    ? 'Rebuild App Screenshot Carousel'
    : 'Switch to App Screenshot Carousel'
  const approveActionLabel = isDraftOnlyPilot
    ? 'Approve Draft'
    : scheduledFor
      ? 'Approve & Schedule'
      : 'Approve & Publish'
  const copyGateState: GateState = item.status === 'approved'
    ? 'approved'
    : isEditable
      ? 'in_review'
      : gateStateFromRawStatus(item.status)
  const humanReviewGateState: GateState = agentPilotPassToHuman ? 'approved' : 'pending'
  const challengerGateState: GateState = gateStateFromRawStatus(agentPilotChallengerStatus)
  const chronicleGateState: GateState = gateStateFromRawStatus(agentPilotChronicleStatus)
  const supportingContextDetails: Array<{ label: string; state: GateState }> = [
    { label: 'Human review', state: humanReviewGateState },
    { label: 'Challenger', state: challengerGateState },
    { label: 'Chronicle', state: chronicleGateState },
  ]
  const supportingContextGateState: GateState = supportingContextDetails.some((gate) => gate.state === 'blocked')
    ? 'blocked'
    : supportingContextDetails.every((gate) => gate.state === 'approved')
      ? 'approved'
      : supportingContextDetails.some((gate) => gate.state === 'in_review')
        ? 'in_review'
        : 'pending'
  const visualAssetReady = isCarouselFormat
    ? Boolean(item.carousel_slide_urls?.length)
    : Boolean(item.image_url)
  const visualAssetsBaseGateState: GateState = visualAssetReady ? 'in_review' : 'pending'
  const visualAssetsGateState: GateState = getExplicitSectionGateState('visual_assets', visualAssetsBaseGateState)
  const visualAssetsRejected = visualAssetsGateState === 'rejected'
  const assetPacketBaseGateState: GateState = productionAssets ? 'in_review' : 'pending'
  const assetPacketGateState: GateState = getExplicitSectionGateState('asset_packet', assetPacketBaseGateState)
  const assetPacketRejected = assetPacketGateState === 'rejected'
  const privacyBaseGateState: GateState = productionAssets ? (redactionGate.ready ? 'in_review' : 'blocked') : 'pending'
  const privacyGateState: GateState = getExplicitSectionGateState('privacy', privacyBaseGateState)
  const privacyRejected = privacyGateState === 'rejected'
  const linkedinDraftHandoff = asRecord(ragContext?.linkedin_draft_handoff)
  const linkedinDraftWorkItem = asRecord(linkedinDraftHandoff?.work_item) ?? {}
  const linkedinDraftBlockers = [
    item.status !== 'approved' ? 'Copy must be approved first.' : '',
    !visualAssetReady ? 'Choose and generate a visual asset first.' : '',
    visualAssetsGateState !== 'approved' ? 'Approve the visual assets section first.' : '',
    !productionAssets ? 'Prepare the asset packet first.' : '',
    productionAssets && assetPacketGateState !== 'approved' ? 'Approve the asset packet section first.' : '',
    productionAssets && !redactionGate.ready ? redactionGate.message || 'Resolve video privacy review first.' : '',
    productionAssets && redactionGate.ready && privacyGateState !== 'approved' ? 'Approve the privacy review section first.' : '',
  ].filter(Boolean)
  const linkedinDraftBaseGateState: GateState = linkedinDraftHandoff
    ? 'approved'
    : videoPrivacyBlocked
      ? 'blocked'
      : linkedinDraftBlockers.length === 0
        ? 'in_review'
        : 'pending'
  const linkedinDraftGateState: GateState = getExplicitSectionGateState('linkedin_draft', linkedinDraftBaseGateState)
  const canCreateLinkedInDraft = isDraftOnlyPilot && linkedinDraftBlockers.length === 0 && linkedinDraftGateState === 'approved'
  const reviewGateSummary: Array<{ label: string; state: GateState; href: string }> = [
    {
      label: 'Copy',
      state: copyGateState,
      href: '#social-copy-gate',
    },
    {
      label: 'Supporting context',
      state: supportingContextGateState,
      href: '#social-supporting-context-gate',
    },
    {
      label: 'Visual assets',
      state: visualAssetsGateState,
      href: '#social-visual-assets-gate',
    },
    {
      label: 'Asset packet',
      state: assetPacketGateState,
      href: '#social-asset-packet-gate',
    },
    {
      label: 'Privacy',
      state: privacyGateState,
      href: '#social-asset-packet-gate',
    },
    {
      label: isDraftOnlyPilot ? 'LinkedIn draft' : 'Publish',
      state: isDraftOnlyPilot ? linkedinDraftGateState : gateStateFromRawStatus(agentPilotPublishGate),
      href: '#social-draft-approval-gate',
    },
  ]
  const overallGateState: GateState = reviewGateSummary.some((gate) => gate.state === 'blocked' || gate.state === 'rejected')
    ? 'blocked'
    : reviewGateSummary.every((gate) => gate.state === 'approved')
      ? 'approved'
      : reviewGateSummary.every((gate) => gate.state === 'pending')
        ? 'pending'
        : 'in_review'
  const nextReviewGate = reviewGateSummary.find((gate) => gate.state !== 'approved')
  const handleReviewGateJump = (href: string) => {
    const target = document.querySelector(href)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.history.replaceState(null, '', href)
  }
  const renderSectionGateControls = (
    gateKey: SectionGateKey,
    label: string,
    state: GateState,
    options: {
      approveLabel?: string
      rejectLabel?: string
      disabled?: boolean
      approveDisabled?: boolean
      rejectDisabled?: boolean
      notePlaceholder?: string
    } = {},
  ) => {
    const review = getSectionGateReview(gateKey)
    const decidedAt = asString(review?.decided_at)
    const note = asString(review?.note)
    const repairStatus = asString(review?.repair_status)
    const isSaving = savingSectionGate === gateKey
    const noteValue = sectionGateNotes[gateKey] || ''
    const isRejecting = sectionGateRejecting[gateKey]
    const isRejected = asString(review?.status) === 'rejected'
    const isRepairPending = isRejected && !isRejecting
    const rejectActionDisabled = isSaving || options.disabled || options.rejectDisabled || isRepairPending
    const rejectSubmitDisabled = rejectActionDisabled || !noteValue.trim()

    return (
      <div className="mt-3 rounded-lg border border-silicon-slate/70 bg-background/30 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">{label} decision</p>
            {decidedAt && (
              <p className="mt-1 text-xs text-gray-500">
                Last decision: {new Date(decidedAt).toLocaleString()}
              </p>
            )}
            {note && <p className="mt-1 text-xs leading-5 text-gray-300">Note: {note}</p>}
          </div>
          <span className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold ${GATE_STATE_CONFIG[state].className}`}>
            {label}: {GATE_STATE_CONFIG[state].label}
          </span>
        </div>
        {isRepairPending && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-red-100">{label} revision in progress</p>
                <p className="mt-1 text-xs leading-5 text-red-50/75">
                  Controls are locked until the revised section is returned for review.
                </p>
              </div>
              <span className="w-fit rounded-full border border-red-400/40 px-2 py-0.5 text-[10px] font-semibold text-red-100">
                {repairStatus || 'requested'}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-red-950/60">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-red-300" />
            </div>
          </div>
        )}
        {isRejecting && (
          <label className="mt-3 block text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
            Rejection note
            <textarea
              value={noteValue}
              onChange={(event) => setSectionGateNotes((current) => ({ ...current, [gateKey]: event.target.value }))}
              rows={2}
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm normal-case leading-6 tracking-normal text-gray-200 placeholder:text-gray-500"
              placeholder={options.notePlaceholder ?? 'What needs to change before this section can be approved?'}
            />
          </label>
        )}
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {isRejecting && (
            <button
              type="button"
              onClick={() => {
                setSectionGateRejecting((current) => ({ ...current, [gateKey]: false }))
                setSectionGateNotes((current) => ({ ...current, [gateKey]: '' }))
              }}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-3 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!isRejecting) {
                setSectionGateRejecting((current) => ({ ...current, [gateKey]: true }))
                return
              }
              handleSectionGateDecision(gateKey, 'rejected')
            }}
            disabled={isRejecting ? rejectSubmitDisabled : rejectActionDisabled}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/10 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            {isRepairPending ? 'Rejected' : isRejecting ? 'Submit Rejection' : (options.rejectLabel ?? `Reject ${label}`)}
          </button>
          <button
            type="button"
            onClick={() => handleSectionGateDecision(gateKey, 'approved')}
            disabled={isSaving || options.disabled || options.approveDisabled || isRepairPending}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 px-3 py-2 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {options.approveLabel ?? `Approve ${label}`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Toast */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium ${
              message.type === 'success'
                ? 'bg-green-900/80 text-green-300 border border-green-700'
                : 'bg-red-900/80 text-red-300 border border-red-700'
            }`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Header — slim, Save Draft only */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-gray-800 px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(backUrl)}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <Breadcrumbs items={[
              { label: 'Admin', href: '/admin' },
              { label: 'Social Content', href: '/admin/social-content' },
              { label: isEditable ? 'Edit Post' : 'View Post' },
            ]} />
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.bgColor} ${statusCfg.color} border ${statusCfg.borderColor}`}>
              {statusCfg.label}
            </span>
          </div>
          {isEditable && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Draft
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[90rem] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {isAgentSocialPilot && (
          <section className="admin-console-card rounded-xl border border-radiant-gold/25 p-4 sm:p-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,auto)] xl:items-start">
              <div className="min-w-0">
                <p className="admin-console-eyebrow">Agent Ops LinkedIn Pilot</p>
                <h2 className="mt-2 text-xl font-semibold text-gray-100">Draft-only content packet</h2>
                <p className="mt-1 max-w-4xl text-sm leading-6 text-gray-400">
                  Current state for this draft. Supporting evidence and checklists are collapsed below.
                </p>
              </div>
              <div className="min-w-0 xl:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Overall</p>
                <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${GATE_STATE_CONFIG[overallGateState].className}`}>
                  {GATE_STATE_CONFIG[overallGateState].label}
                </span>
                {nextReviewGate && (
                  <button
                    type="button"
                    onClick={() => {
                      handleReviewGateJump(nextReviewGate.href)
                    }}
                    className="mt-2 inline-flex text-xs text-blue-300 transition-colors hover:text-blue-200"
                  >
                    Next: {nextReviewGate.label}
                  </button>
                )}
              </div>
            </div>

            {!agentPilotPassToHuman && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm leading-6 text-amber-50">
                <p className="font-semibold">This draft is not ready for human approval yet.</p>
                <p className="mt-1 text-amber-100/85">
                  Current status: {(agentPilotGateStatus || 'research pending').replace(/_/g, ' ')}.
                </p>
                {agentPilotRequiredFixes.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {agentPilotRequiredFixes.slice(0, 4).map((fix) => <li key={fix}>- {fix}</li>)}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-4 rounded-lg border border-silicon-slate/80 bg-background/35 p-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Review path</p>
                  <p className="mt-1 text-sm text-gray-400">Click a gate to jump to its decision section.</p>
                </div>
                <nav aria-label="Social content review gates" className="flex flex-wrap gap-2 xl:max-w-4xl xl:justify-end">
                  {reviewGateSummary.map((gate) => (
                    <button
                      key={`${gate.label}-${gate.href}`}
                      type="button"
                      onClick={() => {
                        handleReviewGateJump(gate.href)
                      }}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-transform hover:-translate-y-0.5 ${GATE_STATE_CONFIG[gate.state].className}`}
                    >
                      {gate.label}: {GATE_STATE_CONFIG[gate.state].label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            <details id="social-supporting-context-gate" className="mt-4 scroll-mt-28 rounded-lg border border-silicon-slate/80 bg-background/35">
              <summary className="cursor-pointer list-none px-4 py-3">
                <span className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-semibold text-gray-200">Supporting context and checklists</span>
                  <span className="flex flex-col gap-1 text-left sm:text-right">
                    <span className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:ml-auto ${GATE_STATE_CONFIG[supportingContextGateState].className}`}>
                      Supporting context: {GATE_STATE_CONFIG[supportingContextGateState].label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {supportingContextDetails.map((gate) => `${gate.label} ${GATE_STATE_CONFIG[gate.state].label.toLowerCase()}`).join(' · ')}
                    </span>
                  </span>
                </span>
              </summary>
              <div className="grid gap-3 border-t border-silicon-slate/70 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(18rem,0.8fr)]">
                <div className="rounded-lg border border-silicon-slate/80 bg-imperial-navy/35 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Provenance</p>
                  <ul className="mt-3 space-y-2 text-sm text-gray-300">
                    {agentPilotProvenance.slice(0, 4).map((entry) => (
                      <li key={entry} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                        <span>{entry}</span>
                      </li>
                    ))}
                    {agentPilotProvenance.length === 0 && (
                      <li className="text-gray-500">No provenance checklist attached.</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-lg border border-silicon-slate/80 bg-imperial-navy/35 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Review Checklist</p>
                  <ul className="mt-3 space-y-2 text-sm text-gray-300">
                    {agentPilotApprovalChecklist.slice(0, 4).map((entry) => (
                      <li key={entry} className="flex gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                        <span>{entry}</span>
                      </li>
                    ))}
                    {agentPilotApprovalChecklist.length === 0 && (
                      <li className="text-gray-500">No approval checklist attached.</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-lg border border-silicon-slate/80 bg-imperial-navy/35 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Visual Brief</p>
                  <p className="mt-3 text-sm leading-6 text-gray-300">
                    {agentPilotVisualBrief || 'No visual brief attached.'}
                  </p>
                  {agentPilotPacketId && (
                    <p className="mt-3 truncate text-xs text-gray-500" title={agentPilotPacketId}>
                      Packet {agentPilotPacketId}
                    </p>
                  )}
                </div>
              </div>
            </details>

            {isAgentSocialPilot && (
              <details className="mt-3 rounded-lg border border-silicon-slate/80 bg-background/35">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm font-semibold text-gray-200">Content calibration</span>
                  <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                    {(agentPilotCalibrationStatus || 'needs operator context').replace(/_/g, ' ')}
                  </span>
                </summary>
                <div className="border-t border-silicon-slate/70 p-4">
                  <p className="text-sm leading-6 text-gray-300">
                    {agentPilotCalibration
                      ? 'Use this section to revise the draft against prior successful post patterns before it reaches publish review.'
                      : 'No calibration packet was seeded for this draft yet. Add a prior post, engagement signal, audience context, and revision request so Shaka can revise it in context.'}
                  </p>

                  {hasAgentPilotCalibrationGuidance ? (
                    <>
                      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                        <div className="grid gap-2">
                          {agentPilotPriorPatterns.slice(0, 3).map((pattern) => {
                            const label = asString(pattern.label)
                            return (
                              <div key={label || asString(pattern.pattern)} className="rounded-md border border-silicon-slate/80 bg-imperial-navy/45 p-3">
                                <p className="text-sm font-semibold text-gray-100">{label || 'Prior success pattern'}</p>
                                <p className="mt-1 text-sm leading-6 text-gray-300">{asString(pattern.pattern)}</p>
                                <p className="mt-2 text-xs leading-5 text-gray-400"><span className="text-amber-300">Why it worked:</span> {asString(pattern.why_it_worked)}</p>
                                <p className="mt-1 text-xs leading-5 text-gray-400"><span className="text-amber-300">Use now:</span> {asString(pattern.reuse_guidance)}</p>
                              </div>
                            )
                          })}
                          {agentPilotPriorPatterns.length === 0 && (
                            <div className="rounded-md border border-silicon-slate/80 bg-imperial-navy/45 p-3 text-sm leading-6 text-gray-300">
                              No prior success patterns are attached yet.
                            </div>
                          )}
                        </div>
                        <div className="grid gap-3">
                          {agentPilotVoicePrinciples.length > 0 && (
                            <div className="rounded-md border border-silicon-slate/80 bg-imperial-navy/45 p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Voice Checks</p>
                              <ul className="mt-2 space-y-1 text-sm text-gray-300">
                                {agentPilotVoicePrinciples.slice(0, 5).map((entry) => <li key={entry}>• {entry}</li>)}
                              </ul>
                            </div>
                          )}
                          {agentPilotMissingContextPrompts.length > 0 && (
                            <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Context to Add</p>
                              <ul className="mt-2 space-y-1 text-sm text-amber-50/90">
                                {agentPilotMissingContextPrompts.slice(0, 4).map((entry) => <li key={entry}>• {entry}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                      {agentPilotComparisonPrompt && (
                        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100">
                          {agentPilotComparisonPrompt}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-3 rounded-md border border-silicon-slate/80 bg-imperial-navy/45 p-3 text-sm leading-6 text-gray-300">
                      No calibration notes are attached yet. Start by adding a prior successful post, what made it work, and what should change in this draft.
                    </div>
                  )}

                {hasAgentPilotRevisionReceipt && (
                  <div className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">Shaka Revision Receipt</p>
                        <p className="mt-1 text-sm leading-6 text-gray-300">
                          Shaka records what he understood before the revised draft replaces the text.
                        </p>
                      </div>
                      {agentPilotLatestRevisionCreatedAt && (
                        <span className="w-fit rounded-full border border-emerald-500/30 px-3 py-1 text-xs text-emerald-100">
                          {new Date(agentPilotLatestRevisionCreatedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {agentPilotRevisionRequest && (
                      <div className="mt-3 rounded-lg border border-emerald-500/20 bg-background/35 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">Your request</p>
                        <p className="mt-2 text-sm leading-6 text-gray-200">{agentPilotRevisionRequest}</p>
                      </div>
                    )}
                    {agentPilotWhatHeard && (
                      <div className="mt-3 rounded-lg border border-emerald-500/20 bg-background/35 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">What I heard</p>
                        <p className="mt-2 text-sm leading-6 text-gray-200">{agentPilotWhatHeard}</p>
                      </div>
                    )}
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      {agentPilotPlannedChanges.length > 0 && (
                        <div className="rounded-lg border border-emerald-500/20 bg-background/35 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">Planned changes</p>
                          <ul className="mt-2 space-y-1 text-sm leading-6 text-gray-200">
                            {agentPilotPlannedChanges.map((change) => <li key={change}>• {change}</li>)}
                          </ul>
                        </div>
                      )}
                      {agentPilotRevisionNotes.length > 0 && (
                        <div className="rounded-lg border border-emerald-500/20 bg-background/35 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">What changed</p>
                          <ul className="mt-2 space-y-1 text-sm leading-6 text-gray-200">
                            {agentPilotRevisionNotes.map((note) => <li key={note}>• {note}</li>)}
                          </ul>
                        </div>
                      )}
                      {agentPilotSeparateActions.length > 0 && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Separate actions</p>
                          <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-50/90">
                            {agentPilotSeparateActions.map((action) => <li key={action}>• {action}</li>)}
                          </ul>
                        </div>
                      )}
                      {agentPilotNotChanging.length > 0 && (
                        <div className="rounded-lg border border-silicon-slate/80 bg-background/35 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Not changing</p>
                          <ul className="mt-2 space-y-1 text-sm leading-6 text-gray-300">
                            {agentPilotNotChanging.map((item) => <li key={item}>• {item}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                    {agentPilotQuestionsOrAmbiguity.length > 0 && (
                      <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Questions or ambiguity</p>
                        <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-50/90">
                          {agentPilotQuestionsOrAmbiguity.map((question) => <li key={question}>• {question}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 rounded-lg border border-silicon-slate/80 bg-imperial-navy/45 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Operator Feedback Loop</p>
                      <p className="mt-1 text-sm leading-6 text-gray-300">
                        Add the context Shaka should use to compare this draft against posts that already sounded right and performed well.
                      </p>
                    </div>
                    {agentPilotFeedbackUpdatedAt && (
                      <span className="w-fit rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-400">
                        Saved {new Date(agentPilotFeedbackUpdatedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 rounded-lg border border-silicon-slate/80 bg-background/35 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Successful Post References</p>
                        <p className="mt-1 text-sm leading-6 text-gray-300">
                          Add posts that sounded right, performed well, or captured the perspective this draft should match.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addCalibrationSuccessExample}
                        disabled={!isEditable}
                        className="inline-flex w-fit items-center gap-2 rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-200 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add reference
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3">
                      {calibrationFeedback.success_examples.map((example, index) => (
                        <div key={index} className="rounded-lg border border-silicon-slate/80 bg-imperial-navy/45 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">
                              Reference {index + 1}
                            </p>
                            <button
                              type="button"
                              onClick={() => removeCalibrationSuccessExample(index)}
                              disabled={!isEditable || calibrationFeedback.success_examples.length === 1}
                              className="inline-flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-400 transition-colors hover:border-red-400/60 hover:text-red-200 disabled:opacity-40"
                              aria-label={`Remove reference ${index + 1}`}
                            >
                              <Trash2 className="h-3 w-3" />
                              Remove
                            </button>
                          </div>
                          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                            <label className="block text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
                              Source or label
                              <input
                                value={example.source_label}
                                onChange={(event) => updateCalibrationSuccessExample(index, 'source_label', event.target.value)}
                                disabled={!isEditable}
                                className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm normal-case tracking-normal text-gray-200 disabled:opacity-60"
                                placeholder="LinkedIn post, date, topic, or link"
                              />
                            </label>
                            <label className="block text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
                              Why it worked
                              <input
                                value={example.why_it_worked}
                                onChange={(event) => updateCalibrationSuccessExample(index, 'why_it_worked', event.target.value)}
                                disabled={!isEditable}
                                className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm normal-case tracking-normal text-gray-200 disabled:opacity-60"
                                placeholder="Strong comments, better hook, clearer point of view..."
                              />
                            </label>
                            <label className="block text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
                              Engagement signal
                              <textarea
                                value={example.engagement_signal}
                                onChange={(event) => updateCalibrationSuccessExample(index, 'engagement_signal', event.target.value)}
                                disabled={!isEditable}
                                rows={3}
                                className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm normal-case leading-6 tracking-normal text-gray-200 disabled:opacity-60"
                                placeholder="Views, likes, comments, saves, or why you felt comfortable posting it."
                              />
                            </label>
                            <label className="block text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
                              Post excerpt
                              <textarea
                                value={example.post_excerpt}
                                onChange={(event) => updateCalibrationSuccessExample(index, 'post_excerpt', event.target.value)}
                                disabled={!isEditable}
                                rows={3}
                                className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm normal-case leading-6 tracking-normal text-gray-200 disabled:opacity-60"
                                placeholder="Paste the passage Shaka should compare against."
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <label className="block text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
                      Overall engagement context
                      <textarea
                        value={calibrationFeedback.engagement_signal}
                        onChange={(event) => updateCalibrationFeedback('engagement_signal', event.target.value)}
                        disabled={!isEditable}
                        rows={3}
                        className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm normal-case leading-6 tracking-normal text-gray-200 disabled:opacity-60"
                        placeholder="What performance pattern or audience response should Shaka optimize for?"
                      />
                    </label>
                    <label className="block text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
                      Audience and desired reaction
                      <textarea
                        value={calibrationFeedback.audience_context}
                        onChange={(event) => updateCalibrationFeedback('audience_context', event.target.value)}
                        disabled={!isEditable}
                        rows={3}
                        className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm normal-case leading-6 tracking-normal text-gray-200 disabled:opacity-60"
                        placeholder="Who should this speak to, and what should they feel or do after reading?"
                      />
                    </label>
                    <label className="block text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
                      Revision request
                      <textarea
                        value={calibrationFeedback.revision_request}
                        onChange={(event) => updateCalibrationFeedback('revision_request', event.target.value)}
                        disabled={!isEditable}
                        rows={3}
                        className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm normal-case leading-6 tracking-normal text-gray-200 disabled:opacity-60"
                        placeholder="What should Shaka change in the next draft?"
                      />
                    </label>
                    <label className="block text-xs font-medium uppercase tracking-[0.12em] text-gray-500 lg:col-span-2">
                      Claims or boundaries to avoid
                      <textarea
                        value={calibrationFeedback.claim_boundaries}
                        onChange={(event) => updateCalibrationFeedback('claim_boundaries', event.target.value)}
                        disabled={!isEditable}
                        rows={3}
                        className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm normal-case leading-6 tracking-normal text-gray-200 disabled:opacity-60"
                        placeholder="Private details, unsupported claims, client references, or angles that should stay out."
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs leading-5 text-gray-500">
                      Saved feedback stays inside this draft packet and does not publish, schedule, DM, or send anything externally.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveCalibrationFeedback}
                        disabled={!isEditable || savingCalibration || !hasCalibrationFeedbackInput}
                        className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-200 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
                      >
                        {savingCalibration ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save feedback
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateCalibrationRevision}
                        disabled={!isEditable || savingCalibration || revisingCalibration || !hasCalibrationFeedbackInput}
                        className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 disabled:opacity-50"
                      >
                        {revisingCalibration ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        Revise with feedback
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              </details>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              {agentPilotGoalId && (
                <Link
                  href={`/admin/agents/standup?goal=${encodeURIComponent(agentPilotGoalId)}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 px-3 py-2 text-amber-200 transition-colors hover:bg-amber-500/10"
                >
                  Open goal session <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
              <Link
                href="/admin/agents/swarm-board"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800"
              >
                View Kanban tasks <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              {agentPilotOpenBrainReferences.length > 0 && (
                <Link
                  href="/admin/agents/open-brain"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800"
                >
                  Open Brain references <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </section>
        )}

        {/* ================================================================ */}
        {/* SECTION 1: Content (two-col on lg: edit fields + preview)        */}
        {/* ================================================================ */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.45fr)]">
          <div className="min-w-0 space-y-4">
            {/* Post text */}
            <div id="social-copy-gate" className="scroll-mt-28 rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="text-sm font-medium text-gray-400">Post Text</label>
                <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold ${GATE_STATE_CONFIG[copyGateState].className}`}>
                  Copy: {GATE_STATE_CONFIG[copyGateState].label}
                </span>
              </div>
              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                disabled={!isEditable}
                rows={10}
                className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-y disabled:opacity-60"
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-500">{postText.length} characters</span>
                <span className="text-xs text-gray-500">LinkedIn optimal: 150-300 words</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">CTA Text</label>
                  <input
                    type="text"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    disabled={!isEditable}
                    placeholder="e.g. DM me 'AUDIT' for the free framework"
                    className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">CTA URL</label>
                  <input
                    type="url"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    disabled={!isEditable}
                    placeholder="https://amadutown.com/..."
                    className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-400 mb-1">Hashtags (comma-separated)</label>
                <input
                  type="text"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  disabled={!isEditable}
                  placeholder="automation, business, AI"
                  className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                />
              </div>
              {canRequestCopyRevision && (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Request copy revision
                      </p>
                      <p className="mt-1 text-sm leading-6 text-amber-50/85">
                        Revert approval with a note Shaka can use for the next draft.
                      </p>
                    </div>
                    <span className="w-fit rounded-full border border-amber-500/35 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                      Approval rollback
                    </span>
                  </div>
                  <label className="mt-3 block text-xs font-medium uppercase tracking-[0.12em] text-amber-100/80">
                    Revision feedback for Shaka
                    <textarea
                      value={copyRevisionRequest}
                      onChange={(event) => {
                        setCopyRevisionRequest(event.target.value)
                        updateCalibrationFeedback('revision_request', event.target.value)
                      }}
                      rows={3}
                      className="mt-2 w-full rounded-lg border border-amber-500/25 bg-gray-950/70 px-3 py-2 text-sm normal-case leading-6 tracking-normal text-gray-100 placeholder:text-gray-500"
                      placeholder="What should change before this can be approved?"
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs leading-5 text-amber-50/70">
                      Reopening keeps publishing, scheduling, and provider actions locked.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRequestCopyRevision(false)}
                        disabled={requestingCopyRevision || !copyRevisionRequest.trim()}
                        className="inline-flex items-center gap-2 rounded-lg border border-amber-400/45 px-3 py-2 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
                      >
                        {requestingCopyRevision ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                        Reopen for Revision
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRequestCopyRevision(true)}
                        disabled={requestingCopyRevision || !copyRevisionRequest.trim()}
                        className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 disabled:opacity-50"
                      >
                        {requestingCopyRevision ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        Reject and Generate Revision
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Visual Media section (single image or carousel) */}
            <div id="social-visual-assets-gate" className="scroll-mt-28 rounded-xl border border-gray-800 bg-gray-900 p-4">
              {canEditVisualProduction && (
                <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Visual Production</p>
                        <p className="mt-1 text-sm leading-6 text-amber-50/90">
                          {visualProductionUnlocked
                            ? 'Copy approved. Choose one visual format; either path replaces the current draft visual.'
                            : 'Choose one visual format for this draft. These actions stay separate from copy approval and publishing.'}
                        </p>
                      </div>
                      <span className={`inline-flex w-fit shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${GATE_STATE_CONFIG[visualAssetsGateState].className}`}>
                        Visual assets: {GATE_STATE_CONFIG[visualAssetsGateState].label}
                      </span>
                    </div>
                    <div className="rounded-lg border border-amber-500/20 bg-background/25 px-3 py-2 text-xs leading-5 text-amber-50/75">
                      Clicking a visual action may generate or replace assets; it does not publish or schedule.
                    </div>
                    <div className="mt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100/70">Choose one visual format</p>
                      <div className="mt-2 grid gap-3 lg:grid-cols-2">
                        <div className={`rounded-lg border p-3 ${isSingleImageFormat ? 'border-amber-400/70 bg-amber-400/10' : 'border-amber-500/25 bg-gray-950/30'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <ImageIcon className="h-4 w-4 text-amber-200" />
                              <p className="text-sm font-semibold text-amber-50">Framework illustration</p>
                            </div>
                            {isSingleImageFormat && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                                <CheckCircle2 className="h-3 w-3" />
                                Selected format
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-amber-50/80">
                            Best when the post needs a clean concept visual for the argument. Switching here clears carousel data and uses a single image.
                          </p>
                          <button
                            type="button"
                            onClick={isCarouselFormat ? handleConvertToSingleImage : handleRegenerateImage}
                            disabled={regeneratingImage || !imagePrompt || visualAssetsRejected}
                            className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                              isSingleImageFormat
                                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                                : 'border border-amber-500/45 text-amber-100 hover:bg-amber-500/10'
                            }`}
                          >
                            {regeneratingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                            {frameworkActionLabel}
                          </button>
                        </div>
                        <div className={`rounded-lg border p-3 ${isCarouselFormat ? 'border-blue-400/70 bg-blue-400/10' : 'border-amber-500/25 bg-gray-950/30'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <LayoutGrid className="h-4 w-4 text-blue-100" />
                              <p className="text-sm font-semibold text-amber-50">App screenshot carousel</p>
                            </div>
                            {isCarouselFormat && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-blue-300/50 bg-blue-300/10 px-2 py-0.5 text-[10px] font-semibold text-blue-100">
                                <CheckCircle2 className="h-3 w-3" />
                                Selected format
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-amber-50/80">
                            Best when the post needs proof from real Portfolio screens. Switching here replaces the single-image draft with a screenshot carousel.
                          </p>
                          <button
                            type="button"
                            onClick={handleBuildAppScreenshotCarousel}
                            disabled={capturingAppCarousel || visualAssetsRejected}
                            className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                              isCarouselFormat
                                ? 'bg-blue-400 text-slate-950 hover:bg-blue-300'
                                : 'border border-blue-400/45 text-blue-100 hover:bg-blue-500/10'
                            }`}
                          >
                            {capturingAppCarousel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LayoutGrid className="h-3.5 w-3.5" />}
                            {carouselActionLabel}
                          </button>
                        </div>
                      </div>
                    </div>
                    {renderSectionGateControls('visual_assets', 'Visual assets', visualAssetsGateState, {
                      approveLabel: 'Approve Visuals',
                      rejectLabel: 'Reject Visuals',
                      approveDisabled: !visualAssetReady,
                      rejectDisabled: !visualAssetReady,
                      notePlaceholder: 'What must change before the visual assets are approved?',
                    })}
                    <div id="social-asset-packet-gate" className="mt-4 scroll-mt-28 border-t border-amber-500/25 pt-4">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-100/70">Asset packet</p>
                              <p className="mt-1 text-xs leading-5 text-amber-50/70">
                                Required for repeatable b-roll, video, and privacy QA.
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${GATE_STATE_CONFIG[assetPacketGateState].className}`}>
                              Asset packet: {GATE_STATE_CONFIG[assetPacketGateState].label}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${GATE_STATE_CONFIG[privacyGateState].className}`}>
                              Privacy: {GATE_STATE_CONFIG[privacyGateState].label}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handlePrepareAssetPacket}
                          disabled={preparingAssetPacket || item.status !== 'approved' || assetPacketRejected}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-400/45 px-3 py-2 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
                        >
                          {preparingAssetPacket ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                          Prepare Asset Packet
                        </button>
                        {renderSectionGateControls('asset_packet', 'Asset packet', assetPacketGateState, {
                          approveLabel: 'Approve Asset Packet',
                          rejectLabel: 'Reject Asset Packet',
                          approveDisabled: !productionAssets,
                          rejectDisabled: !productionAssets,
                          notePlaceholder: 'What is missing from the asset packet?',
                        })}
                        {renderSectionGateControls('privacy', 'Privacy', privacyGateState, {
                          approveLabel: 'Approve Privacy Review',
                          rejectLabel: 'Reject Privacy Review',
                          approveDisabled: !productionAssets || !redactionGate.ready,
                          rejectDisabled: !productionAssets,
                          notePlaceholder: 'What privacy issue still needs redaction or review?',
                        })}
                      </div>

                  {productionAssets ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {productionAssetSteps.map((step) => (
                          <div key={step.label} className="rounded-lg border border-gray-700/80 bg-gray-950/50 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">{step.label}</p>
                            <p className="mt-1 text-sm text-gray-100">{step.value}</p>
                          </div>
                        ))}
                      </div>

                      <div className={`rounded-lg border p-3 text-sm leading-6 ${redactionGate.ready ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-50' : 'border-red-500/30 bg-red-500/10 text-red-50'}`}>
                        <div className="flex items-start gap-2">
                          <AlertCircle className={`mt-0.5 h-4 w-4 ${redactionGate.ready ? 'text-emerald-300' : 'text-red-300'}`} />
                          <div>
                            <p className="font-semibold">{redactionGate.ready ? 'Video privacy review ready' : 'Video privacy review required'}</p>
                            <p className="mt-1">
                              {redactionGate.ready
                                ? 'All redaction items have a reviewed decision. Final publish approval remains separate.'
                                : redactionGate.message}
                            </p>
                          </div>
                        </div>
                      </div>

                      {productionAssets.video_redaction_manifest.items.length > 0 && (
                        <div className="space-y-2">
                          {productionAssets.video_redaction_manifest.items.map((redactionItem) => (
                            <div key={redactionItem.id} className="rounded-lg border border-gray-700 bg-gray-950/60 p-3">
                              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-red-200">
                                      {redactionItem.issue_type.replace(/_/g, ' ')}
                                    </span>
                                    <span className="text-xs text-gray-500">{redactionItem.source.replace(/_/g, ' ')}</span>
                                    <span className="text-xs text-gray-500">{Math.round(redactionItem.confidence * 100)}% confidence</span>
                                  </div>
                                  <p className="mt-2 text-sm text-gray-100">{redactionItem.original_asset.label}</p>
                                  <p className="mt-1 text-xs text-gray-400">{redactionItem.evidence}</p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    Decision: {redactionItem.reviewer_decision ? redactionItem.reviewer_decision.replace(/_/g, ' ') : 'pending'} · Status: {redactionItem.status}
                                  </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                                  {([
                                    ['approve_redaction', 'Approve Blur'],
                                    ['adjust_redaction', 'Adjust'],
                                    ['safe_exception', 'Safe Exception'],
                                    ['reject_clip', 'Reject Clip'],
                                  ] as Array<[RedactionReviewDecision, string]>).map(([decision, label]) => (
                                    <button
                                      key={decision}
                                      type="button"
                                      onClick={() => handleReviewRedaction(redactionItem.id, decision)}
                                      disabled={privacyRejected || reviewingRedactionId === redactionItem.id}
                                      className="rounded-lg border border-gray-700 px-2 py-1 text-xs font-medium text-gray-200 transition-colors hover:bg-gray-800 disabled:opacity-50"
                                    >
                                      {reviewingRedactionId === redactionItem.id ? 'Saving...' : label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                        null
                  )}
                    </div>
                  </div>
                </div>
              )}
              {item.content_format === 'carousel' ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4" /> Carousel ({item.carousel_slide_urls?.length || 0} slides)
                    </h3>
                    <div className="flex items-center gap-2">
                      {item.carousel_pdf_url && (
                        <a
                          href={item.carousel_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1 bg-blue-900/50 hover:bg-blue-900/70 text-blue-300 rounded-lg text-xs transition-colors"
                        >
                          <Download className="w-3 h-3" /> PDF
                        </a>
                      )}
                      {canEditVisualProduction && (
                        <>
                          <button
                            onClick={handleRegenerateCarousel}
                            disabled={convertingFormat}
                            className="flex items-center gap-1 px-2 py-1 bg-purple-900/50 hover:bg-purple-900/70 text-purple-300 rounded-lg text-xs transition-colors disabled:opacity-50"
                          >
                            {convertingFormat ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Re-render
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {item.carousel_slide_urls && item.carousel_slide_urls.length > 0 ? (
                    <div className="space-y-3">
                      <div className="rounded-lg overflow-hidden bg-gray-800 relative w-full aspect-square">
                        <Image
                          src={item.carousel_slide_urls[selectedSlide] || item.carousel_slide_urls[0]}
                          alt={`Slide ${selectedSlide + 1}`}
                          className="object-contain"
                          fill
                          sizes="(max-width: 800px) 100vw, 800px"
                        />
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {item.carousel_slide_urls.map((url, i) => (
                          <button
                            key={i}
                            onClick={() => setSelectedSlide(i)}
                            className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                              selectedSlide === i ? 'border-purple-500' : 'border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            <Image src={url} alt={`Slide ${i + 1}`} width={64} height={64} className="object-cover w-full h-full" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-gray-800 h-48 flex items-center justify-center mb-3">
                      <div className="text-center text-gray-500">
                        <LayoutGrid className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">Slides not yet rendered</p>
                        {canEditVisualProduction && (
                          <button
                            onClick={handleRegenerateCarousel}
                            disabled={convertingFormat}
                            className="mt-2 text-xs text-purple-400 hover:text-purple-300"
                          >
                            {convertingFormat ? 'Rendering...' : 'Render now'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" /> Framework Illustration
                    </h3>
                  </div>
                  {item.image_url ? (
                    <div className="rounded-lg overflow-hidden mb-3 bg-gray-800 relative w-full h-[400px]">
                      <Image src={item.image_url} alt="Generated framework illustration" className="object-contain" fill sizes="(max-width: 800px) 100vw, 800px" />
                    </div>
                  ) : (
                    <div className="rounded-lg bg-gray-800 h-48 flex items-center justify-center mb-3">
                      <div className="text-center text-gray-500">
                        <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No image generated yet</p>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="space-y-2 mt-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Visual Type</label>
                  <select
                    value={frameworkVisualType}
                    onChange={(e) => setFrameworkVisualType(e.target.value as FrameworkVisualType | '')}
                    disabled={!canEditVisualProduction}
                    className="w-full bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 text-sm disabled:opacity-60"
                  >
                    <option value="">Auto-detect</option>
                    {FRAMEWORK_VISUAL_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label} — {t.description}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Image Prompt</label>
                  <textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    disabled={!canEditVisualProduction}
                    rows={3}
                    className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-xs resize-y disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            {/* Audio section */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  <Volume2 className="w-4 h-4" /> Voiceover
                </h3>
                {isEditable && (
                  <button
                    onClick={handleRegenerateAudio}
                    disabled={regeneratingAudio || !voiceoverText}
                    className="flex items-center gap-1 px-2 py-1 bg-emerald-900/50 hover:bg-emerald-900/70 text-emerald-300 rounded-lg text-xs transition-colors disabled:opacity-50"
                  >
                    {regeneratingAudio ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Re-record
                  </button>
                )}
              </div>
              {item.voiceover_url ? (
                <audio controls className="w-full mb-3" src={item.voiceover_url}>
                  <track kind="captions" />
                </audio>
              ) : (
                <div className="rounded-lg bg-gray-800 h-12 flex items-center justify-center mb-3 text-xs text-gray-500">
                  No voiceover generated yet
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Voiceover Script</label>
                <textarea
                  value={voiceoverText}
                  onChange={(e) => setVoiceoverText(e.target.value)}
                  disabled={!isEditable}
                  rows={3}
                  className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-xs resize-y disabled:opacity-60"
                />
              </div>
            </div>

            {/* Source Meeting Traceability */}
            {item.meeting_record && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                {/* Meeting header — always visible */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <h4 className="text-sm font-medium text-gray-200 truncate">
                        {item.meeting_record.meeting_title || `${item.meeting_record.meeting_type?.replace(/_/g, ' ')} meeting`}
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 ml-6">
                      <span className="capitalize">{item.meeting_record.meeting_type?.replace(/_/g, ' ')}</span>
                      <span>{new Date(item.meeting_record.meeting_date).toLocaleDateString()} {new Date(item.meeting_record.meeting_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {item.meeting_record.duration_minutes && (
                        <span>{item.meeting_record.duration_minutes}m</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.meeting_record.source_url && (
                      <a
                        href={item.meeting_record.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/30 hover:border-blue-500/50 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> Read.AI
                      </a>
                    )}
                    {item.meeting_record.recording_url && (
                      <a
                        href={item.meeting_record.recording_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/30 hover:border-emerald-500/50 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> Recording
                      </a>
                    )}
                  </div>
                </div>

                {/* Extracted topic — always visible when present */}
                {item.topic_extracted && (
                  <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400">
                    <div className="font-medium text-gray-300 mb-2">Extracted Topic</div>
                    <div className="space-y-1">
                      <div className="break-words"><span className="text-gray-500">Topic:</span> {item.topic_extracted.topic}</div>
                      <div className="break-words"><span className="text-gray-500">Angle:</span> {item.topic_extracted.angle}</div>
                      <div className="break-words"><span className="text-gray-500">Insight:</span> {item.topic_extracted.key_insight}</div>
                      {item.topic_extracted.personal_tie_in && (
                        <div className="break-words"><span className="text-gray-500">Personal tie-in:</span> {item.topic_extracted.personal_tie_in}</div>
                      )}
                      {item.topic_extracted.transcript_evidence && (
                        <div className="mt-2 border-t border-gray-700 pt-2">
                          <span className="text-gray-500">Transcript evidence:</span>
                          <blockquote className="mt-1 pl-3 border-l-2 border-amber-500/50 text-gray-300 italic break-words">
                            {item.topic_extracted.transcript_evidence}
                          </blockquote>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Collapsible deeper context */}
                <button
                  onClick={() => setShowSource(!showSource)}
                  className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-400 transition-colors"
                >
                  {showSource ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showSource ? 'Hide' : 'Show'} full context (framework, RAG, transcript)
                </button>

                {showSource && (
                  <div className="space-y-3 text-xs text-gray-400">
                    {item.hormozi_framework && (() => {
                      const hf = item.hormozi_framework as Record<string, unknown>
                      const entries = Object.entries(hf).filter(([, v]) => v && String(v).trim())
                      if (entries.length === 0) return null
                      return (
                        <div className="bg-gray-800 rounded-lg p-3">
                          <div className="font-medium text-gray-300 mb-1 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-400" /> Hormozi Framework
                          </div>
                          {entries.map(([key, val]) => (
                            <div key={key} className="break-words">
                              <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}:</span>{' '}
                              {String(val)}
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                    {item.rag_context && (
                      <div className="bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium text-gray-300">RAG Personal Context</div>
                          <button
                            onClick={() => setExpandedSection('rag')}
                            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                            title="Expand"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-xs text-gray-400 whitespace-pre-wrap break-words overflow-y-auto max-h-48">
                          {JSON.stringify(item.rag_context, null, 2)}
                        </div>
                      </div>
                    )}
                    {item.meeting_record.transcript && (
                      <div className="bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium text-gray-300">Full transcript</div>
                          <button
                            onClick={() => setExpandedSection('transcript')}
                            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                            title="Expand"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-xs text-gray-400 whitespace-pre-wrap break-words overflow-y-auto max-h-48">
                          {item.meeting_record.transcript}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Expanded content modal */}
            <AnimatePresence>
              {expandedSection && item?.meeting_record && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
                  onClick={() => setExpandedSection(null)}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between p-4 border-b border-gray-800">
                      <h3 className="text-sm font-semibold text-gray-200">
                        {expandedSection === 'rag' ? 'RAG Personal Context' : 'Full Transcript'}
                      </h3>
                      <button
                        onClick={() => setExpandedSection(null)}
                        className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      <div className="text-sm text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                        {expandedSection === 'rag'
                          ? JSON.stringify(item.rag_context, null, 2)
                          : item.meeting_record.transcript
                        }
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right column: Preview */}
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 lg:sticky lg:top-20">
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <Linkedin className="w-4 h-4 text-blue-400" /> LinkedIn Preview
              </h3>
              <div className="bg-white rounded-lg p-4 text-gray-900">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                    AT
                  </div>
                  <div>
                    <div className="font-semibold text-sm">AmaduTown</div>
                    <div className="text-xs text-gray-500">Just now</div>
                  </div>
                </div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed mb-3">
                  {getFullPostText({ ...item, post_text: postText, cta_text: ctaText, cta_url: ctaUrl, hashtags: hashtags.split(',').map(t => t.trim()).filter(Boolean) })}
                </div>
                {item.content_format === 'carousel' && item.carousel_slide_urls && item.carousel_slide_urls.length > 0 ? (
                  <div className="rounded-lg overflow-hidden border border-gray-200 relative w-full aspect-square">
                    <Image src={item.carousel_slide_urls[0]} alt="Carousel cover" className="object-cover" fill sizes="(max-width: 600px) 100vw, 600px" />
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                      1/{item.carousel_slide_urls.length}
                    </div>
                  </div>
                ) : item.image_url ? (
                  <div className="rounded-lg overflow-hidden border border-gray-200 relative w-full aspect-video">
                    <Image src={item.image_url} alt="Post image" className="object-cover" fill sizes="(max-width: 600px) 100vw, 600px" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION 2: "Where & When" Publish Panel                          */}
        {/* ================================================================ */}
        <div id="social-draft-approval-gate" className="scroll-mt-28 space-y-6 rounded-xl border-2 border-gray-700 bg-gray-900 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
              <Send className="w-5 h-5 text-green-400" />
              {isDraftOnlyPilot ? 'Draft Approval Gate' : 'Where & When'}
            </h2>
            {isDraftOnlyPilot && (
              <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold ${GATE_STATE_CONFIG[linkedinDraftGateState].className}`}>
                LinkedIn draft: {GATE_STATE_CONFIG[linkedinDraftGateState].label}
              </span>
            )}
          </div>

          {isDraftOnlyPilot && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">LinkedIn Draft Handoff</p>
                  <p className="mt-2 text-sm leading-6 text-amber-50/90">
                    Create the LinkedIn-ready draft packet after copy, visual assets, asset packet, and privacy gates are ready. Public publishing remains locked behind a later approval.
                  </p>
                  {linkedinDraftHandoff ? (
                    <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm leading-6 text-emerald-50">
                      <p className="font-semibold">Draft packet ready</p>
                      <p className="mt-1 text-emerald-50/80">
                        Created {asString(linkedinDraftHandoff.created_at) ? new Date(asString(linkedinDraftHandoff.created_at)).toLocaleString() : 'for LinkedIn handoff'}.
                        {asString(linkedinDraftWorkItem.id) ? ` Work item ${asString(linkedinDraftWorkItem.id)} is ${asString(linkedinDraftWorkItem.status) || 'assigned'}.` : ''}
                      </p>
                    </div>
                  ) : linkedinDraftBlockers.length > 0 ? (
                    <div className="mt-3 rounded-lg border border-amber-500/25 bg-background/35 p-3 text-sm leading-6 text-amber-50/90">
                      <p className="font-semibold">Still needed</p>
                      <ul className="mt-1 space-y-1">
                        {linkedinDraftBlockers.map((blocker) => <li key={blocker}>- {blocker}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {renderSectionGateControls('linkedin_draft', 'LinkedIn draft', linkedinDraftGateState, {
                    approveLabel: 'Approve LinkedIn Draft Handoff',
                    rejectLabel: 'Reject LinkedIn Draft Handoff',
                    approveDisabled: linkedinDraftBlockers.length > 0 && !linkedinDraftHandoff,
                    rejectDisabled: linkedinDraftBlockers.length > 0 && !linkedinDraftHandoff,
                    notePlaceholder: 'What must be resolved before LinkedIn draft handoff?',
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleCreateLinkedInDraft}
                  disabled={!canCreateLinkedInDraft || creatingLinkedInDraft}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed xl:w-auto ${
                    canCreateLinkedInDraft
                      ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                      : 'border border-amber-500/25 bg-gray-950/40 text-amber-100/50'
                  }`}
                >
                  {creatingLinkedInDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  {linkedinDraftHandoff ? 'Refresh LinkedIn Draft' : 'Create LinkedIn Draft'}
                </button>
              </div>
            </div>
          )}

          {videoPrivacyBlocked && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-50/90">
              <p className="font-semibold text-red-100">Video privacy review required</p>
              <p className="mt-1">
                {redactionGate.message} Approve redactions, mark safe exceptions, or reject risky clips before this content can become publish-ready.
              </p>
            </div>
          )}

          {/* Platform pills */}
          {!isDraftOnlyPilot && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-3">Publish to</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => {
                  const isActive = targetPlatforms.includes(p.value)
                  const colors = PLATFORM_COLORS[p.value] || PLATFORM_COLORS.linkedin
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => p.enabled && isEditable && togglePlatform(p.value)}
                      disabled={!isEditable || !p.enabled}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all disabled:cursor-not-allowed ${
                        !p.enabled
                          ? 'opacity-40 bg-gray-800 border-gray-700 text-gray-500'
                          : isActive
                            ? colors.active
                            : colors.inactive
                      }`}
                    >
                      {PLATFORM_ICONS[p.value]}
                      {p.label}
                      {!p.enabled && <span className="text-xs">(coming soon)</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Schedule radio */}
          {!isDraftOnlyPilot && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-3">When</label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="schedule"
                    checked={!scheduledFor}
                    onChange={() => setScheduledFor('')}
                    disabled={!isEditable}
                    className="text-green-500 focus:ring-green-500 bg-gray-800 border-gray-600"
                  />
                  <span className="text-sm text-gray-300">Publish immediately after approval</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="schedule"
                    checked={!!scheduledFor}
                    onChange={() => {
                      const tomorrow = new Date()
                      tomorrow.setDate(tomorrow.getDate() + 1)
                      tomorrow.setHours(9, 0, 0, 0)
                      setScheduledFor(tomorrow.toISOString().slice(0, 16))
                    }}
                    disabled={!isEditable}
                    className="text-amber-500 focus:ring-amber-500 bg-gray-800 border-gray-600"
                  />
                  <span className="text-sm text-gray-300">Schedule for later</span>
                </label>
                <AnimatePresence>
                  {scheduledFor && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <input
                        type="datetime-local"
                        value={scheduledFor}
                        onChange={(e) => setScheduledFor(e.target.value)}
                        disabled={!isEditable}
                        className="ml-7 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Admin Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Admin Notes</label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
              placeholder="Internal notes about this post..."
              className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-y"
            />
          </div>

          {/* Action buttons */}
          {isEditable && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
              <button
                onClick={handleReject}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-red-400 hover:bg-red-900/30 border border-red-900/50 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
              <button
                onClick={() => {
                  if (!isDraftOnlyPilot && targetPlatforms.length === 0) {
                    showMsg('error', 'Select at least one platform')
                    return
                  }
                  setShowConfirmModal(true)
                }}
                disabled={approving || !canApproveAgentPilot || videoPrivacyBlocked}
                title={videoPrivacyBlocked ? 'Video privacy review required before publish readiness' : canApproveAgentPilot ? undefined : 'Research/context evidence and challenger QA must pass before approval'}
                className="flex items-center gap-1.5 px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {approveActionLabel}
              </button>
            </div>
          )}

          {/* Published state info */}
          {!isEditable && item.published_at && (
            <div className="text-sm text-green-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Published {new Date(item.published_at).toLocaleString()}
            </div>
          )}
          {!isEditable && item.status === 'scheduled' && item.scheduled_for && (
            <div className="text-sm text-amber-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Scheduled for {new Date(item.scheduled_for).toLocaleString()}
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* SECTION 2B: Engagement Metrics                                   */}
        {/* ================================================================ */}
        {(item.status === 'published' || engagementLatest) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-gray-800 bg-gray-900 p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-200">
                  <BarChart3 className="h-5 w-5 text-amber-300" />
                  Automated engagement signal
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-400">
                  Metrics are refreshed from the configured read-only LinkedIn/Apify path and saved into this draft packet. This does not publish, schedule, DM, or trigger outbound work.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRefreshEngagement}
                disabled={refreshingEngagement}
                className="inline-flex w-fit items-center gap-2 rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-200 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
              >
                {refreshingEngagement ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh metrics
              </button>
            </div>

            {engagementLatest ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
                <div className="rounded-lg border border-gray-800 bg-gray-950/45 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Score</p>
                  <p className="mt-1 text-2xl font-semibold text-amber-200">{engagementScore ?? 0}</p>
                  <p className="mt-1 text-xs text-gray-500">{engagementRecommendationLabel || 'Keep watching'}</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950/45 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Comments</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-100">{engagementComments}</p>
                  <p className="mt-1 text-xs text-gray-500">High weight signal</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950/45 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Shares</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-100">{engagementShares}</p>
                  <p className="mt-1 text-xs text-gray-500">Reposts included</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950/45 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Reactions</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-100">{engagementReactions}</p>
                  <p className="mt-1 text-xs text-gray-500">{engagementCapturedAt ? `Captured ${new Date(engagementCapturedAt).toLocaleString()}` : 'Latest snapshot'}</p>
                </div>
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 lg:col-span-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Mapped backlog theme</p>
                  <p className="mt-1 text-sm leading-6 text-amber-50/90">
                    {engagementTheme || 'No backlog theme mapped yet.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950/45 p-4 text-sm leading-6 text-gray-400">
                No engagement snapshot has been captured yet. Refresh metrics after the LinkedIn post is published and visible to the configured Apify source.
              </div>
            )}
          </motion.div>
        )}

        {/* ================================================================ */}
        {/* SECTION 3: Publish Status                                         */}
        {/* ================================================================ */}
        {item.publishes && item.publishes.length > 0 && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
            className="space-y-3"
          >
            <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-400" />
              Publish Status
            </h2>

            {item.publishes.map((pub: SocialContentPublish) => {
              const pubStatusCfg = PUBLISH_STATUS_CONFIG[pub.status] || PUBLISH_STATUS_CONFIG.pending
              const platformLabel = PLATFORMS.find(p => p.value === pub.platform)?.label || pub.platform
              return (
                <motion.div
                  key={pub.id}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400">
                      {PLATFORM_ICONS[pub.platform]}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-200">{platformLabel}</div>
                      {pub.published_at && (
                        <div className="text-xs text-gray-500">
                          {new Date(pub.published_at).toLocaleString()}
                        </div>
                      )}
                      {pub.error_message && (
                        <div className="text-xs text-red-400 mt-0.5">{pub.error_message}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${pubStatusCfg.bgColor} ${pubStatusCfg.color} border ${pubStatusCfg.borderColor}`}>
                      {pubStatusCfg.label}
                    </span>
                    {pub.platform_post_url && (
                      <a
                        href={pub.platform_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        View post <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                      {pub.status === 'failed' && (
                        <button
                          onClick={() => handleRetryPublish([pub.platform as SocialPlatform])}
                          disabled={publishing || videoPrivacyBlocked}
                        className="flex items-center gap-1 px-3 py-1 bg-red-900/50 hover:bg-red-900/70 text-red-300 rounded-lg text-xs transition-colors disabled:opacity-50"
                      >
                        {publishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Retry
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {/* ================================================================ */}
        {/* SECTION 4: Metadata                                               */}
        {/* ================================================================ */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-500 space-y-1">
          <div>Created: {new Date(item.created_at).toLocaleString()}</div>
          <div>Updated: {new Date(item.updated_at).toLocaleString()}</div>
          <div>ID: <span className="font-mono text-gray-600">{item.id}</span></div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Confirmation Modal                                                */}
      {/* ================================================================ */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
            onClick={() => setShowConfirmModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-gray-200 mb-4">
                {isDraftOnlyPilot ? 'Confirm Draft Approval' : 'Confirm Publishing'}
              </h3>

              <div className="space-y-3 mb-6">
                {isDraftOnlyPilot && (
                  <div className={`rounded-lg border p-3 text-sm ${agentPilotPassToHuman ? 'border-amber-500/30 bg-amber-500/10 text-amber-100' : 'border-red-500/30 bg-red-500/10 text-red-100'}`}>
                    {agentPilotPassToHuman
                      ? 'This draft came from a draft-only Agent Ops pilot. Approving it queues the reference/source handoff and keeps publishing behind a separate action.'
                      : 'This Agent Ops draft has not cleared challenger QA. Close this modal and finish the upstream gate before approving.'}
                  </div>
                )}
                {!isDraftOnlyPilot && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Platforms</span>
                      <span className="text-gray-200">{enabledPlatformLabels}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Schedule</span>
                      <span className="text-gray-200">
                        {scheduledFor
                          ? new Date(scheduledFor).toLocaleString()
                          : 'Immediately (now)'}
                      </span>
                    </div>
                  </>
                )}
                {videoPrivacyBlocked && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
                    Video privacy review is blocking publish approval. Resolve the redaction manifest before continuing.
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500 mb-6">
                {isDraftOnlyPilot
                  ? 'Any unsaved changes will be saved before approval. Publishing, scheduling, provider generation, and external sends remain blocked.'
                  : 'Any unsaved changes will be saved before publishing.'}
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 text-gray-400 hover:bg-gray-800 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={approving || !canApproveAgentPilot || videoPrivacyBlocked}
                  className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {approveActionLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function SocialContentDetailRoute() {
  return (
    <ProtectedRoute requireAdmin>
      <SocialContentDetailPage />
    </ProtectedRoute>
  )
}
