'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  ArrowRightLeft,
  Maximize2,
  X,
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

function SocialContentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [item, setItem] = useState<SocialContentItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [regeneratingImage, setRegeneratingImage] = useState(false)
  const [regeneratingAudio, setRegeneratingAudio] = useState(false)
  const [convertingFormat, setConvertingFormat] = useState(false)
  const [selectedSlide, setSelectedSlide] = useState(0)
  const [publishing, setPublishing] = useState(false)
  const [showSource, setShowSource] = useState(false)
  const [expandedSection, setExpandedSection] = useState<'rag' | 'transcript' | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [targetPlatforms, setTargetPlatforms] = useState<SocialPlatform[]>(['linkedin'])

  const [postText, setPostText] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [imagePrompt, setImagePrompt] = useState('')
  const [voiceoverText, setVoiceoverText] = useState('')
  const [frameworkVisualType, setFrameworkVisualType] = useState<FrameworkVisualType | ''>('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [adminNotes, setAdminNotes] = useState('')

  const fetchItem = useCallback(async () => {
    setLoading(true)
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
      }
    } catch (err) {
      console.error('Failed to fetch item:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchItem()
  }, [fetchItem])

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

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

  const handleApprove = async () => {
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

        if (scheduledFor) {
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

  const handleConvertToCarousel = async () => {
    if (!confirm('Convert this post to a carousel? This will generate slides from the post content and replace the current image.')) return
    setConvertingFormat(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch(`/api/admin/social-content/${id}/convert-to-carousel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      const data = await res.json()
      if (data.success) {
        setItem(prev => prev ? {
          ...prev,
          content_format: 'carousel',
          carousel_slides: data.carousel_slides,
          carousel_slide_urls: data.carousel_slide_urls,
          carousel_pdf_url: data.carousel_pdf_url,
        } : prev)
        setSelectedSlide(0)
        showMsg('success', `Carousel generated with ${data.slide_count} slides`)
      } else {
        showMsg('error', data.error || 'Failed to convert to carousel')
      }
    } catch {
      showMsg('error', 'Failed to convert to carousel')
    } finally {
      setConvertingFormat(false)
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
        <Link href="/admin/social-content" className="text-blue-400 hover:underline text-sm mt-2 inline-block">
          Back to queue
        </Link>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft
  const isEditable = item.status === 'draft' || item.status === 'rejected'
  const enabledPlatformLabels = targetPlatforms
    .map(p => PLATFORMS.find(pl => pl.value === p)?.label || p)
    .join(', ')

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
              onClick={() => router.push('/admin/social-content')}
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

      <div className="p-8 max-w-6xl mx-auto space-y-6">
        {/* ================================================================ */}
        {/* SECTION 1: Content (two-col on lg: edit fields + preview)        */}
        {/* ================================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Post text */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">Post Text</label>
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
            </div>

            {/* CTA */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {/* Hashtags */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
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

            {/* Visual Media section (single image or carousel) */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
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
                      {isEditable && (
                        <>
                          <button
                            onClick={handleRegenerateCarousel}
                            disabled={convertingFormat}
                            className="flex items-center gap-1 px-2 py-1 bg-purple-900/50 hover:bg-purple-900/70 text-purple-300 rounded-lg text-xs transition-colors disabled:opacity-50"
                          >
                            {convertingFormat ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Re-render
                          </button>
                          <button
                            onClick={handleConvertToSingleImage}
                            disabled={convertingFormat || regeneratingImage}
                            className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs transition-colors disabled:opacity-50"
                          >
                            <ArrowRightLeft className="w-3 h-3" /> Single Image
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
                        {isEditable && (
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
                    <div className="flex items-center gap-2">
                      {isEditable && (
                        <>
                          <button
                            onClick={handleRegenerateImage}
                            disabled={regeneratingImage || !imagePrompt}
                            className="flex items-center gap-1 px-2 py-1 bg-purple-900/50 hover:bg-purple-900/70 text-purple-300 rounded-lg text-xs transition-colors disabled:opacity-50"
                          >
                            {regeneratingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Regenerate
                          </button>
                          <button
                            onClick={handleConvertToCarousel}
                            disabled={convertingFormat}
                            className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs transition-colors disabled:opacity-50"
                          >
                            {convertingFormat ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRightLeft className="w-3 h-3" />}
                            Carousel
                          </button>
                        </>
                      )}
                    </div>
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
                    disabled={!isEditable}
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
                    disabled={!isEditable}
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
                    <div className="font-semibold text-sm">Amadou Town</div>
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
        <div className="bg-gray-900 border-2 border-gray-700 rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <Send className="w-5 h-5 text-green-400" />
            Where & When
          </h2>

          {/* Platform pills */}
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

          {/* Schedule radio */}
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
                  if (targetPlatforms.length === 0) {
                    showMsg('error', 'Select at least one platform')
                    return
                  }
                  setShowConfirmModal(true)
                }}
                disabled={approving}
                className="flex items-center gap-1.5 px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Approve & Publish
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
                        disabled={publishing}
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
              <h3 className="text-lg font-semibold text-gray-200 mb-4">Confirm Publishing</h3>

              <div className="space-y-3 mb-6">
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
              </div>

              <p className="text-xs text-gray-500 mb-6">
                Any unsaved changes will be saved before publishing.
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
                  disabled={approving}
                  className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {scheduledFor ? 'Approve & Schedule' : 'Approve & Publish'}
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
