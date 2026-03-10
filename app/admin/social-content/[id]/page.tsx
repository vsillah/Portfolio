'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Share2,
  ArrowLeft,
  Save,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Loader2,
  Image as ImageIcon,
  Volume2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Linkedin,
  FileText,
  Calendar,
  Sparkles,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import {
  STATUS_CONFIG,
  PLATFORMS,
  FRAMEWORK_VISUAL_TYPES,
  formatHashtags,
  getFullPostText,
} from '@/lib/social-content'
import type { SocialContentItem, ContentStatus, FrameworkVisualType } from '@/lib/social-content'
import Link from 'next/link'

function SocialContentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [item, setItem] = useState<SocialContentItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [regeneratingImage, setRegeneratingImage] = useState(false)
  const [regeneratingAudio, setRegeneratingAudio] = useState(false)
  const [showSource, setShowSource] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Editable fields
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

  const handleSave = async () => {
    setSaving(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch(`/api/admin/social-content/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_text: postText,
          cta_text: ctaText || null,
          cta_url: ctaUrl || null,
          hashtags: hashtags.split(',').map(t => t.trim()).filter(Boolean),
          image_prompt: imagePrompt || null,
          voiceover_text: voiceoverText || null,
          framework_visual_type: frameworkVisualType || null,
          scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
          admin_notes: adminNotes || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setItem(prev => prev ? { ...prev, ...data.item } : prev)
        showMsg('success', 'Saved successfully')
      } else {
        showMsg('error', 'Failed to save')
      }
    } catch {
      showMsg('error', 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async () => {
    setApproving(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch(`/api/admin/social-content/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setItem(prev => prev ? { ...prev, ...data.item } : prev)
        showMsg('success', data.publish_triggered
          ? 'Approved and publishing triggered!'
          : 'Approved (publish workflow not reached — check n8n)')
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

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <Breadcrumbs items={[
        { label: 'Admin', href: '/admin' },
        { label: 'Social Content', href: '/admin/social-content' },
        { label: 'Edit Post' },
      ]} />

      {/* Message toast */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium ${
            message.type === 'success'
              ? 'bg-green-900/80 text-green-300 border border-green-700'
              : 'bg-red-900/80 text-red-300 border border-red-700'
          }`}
        >
          {message.text}
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/social-content')}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.bgColor} ${statusCfg.color} border ${statusCfg.borderColor}`}>
              {statusCfg.label}
            </span>
            {item.platform === 'linkedin' && <Linkedin className="w-4 h-4 text-blue-400" />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditable && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Draft
              </button>
              <button
                onClick={handleReject}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/50 hover:bg-red-900/70 text-red-300 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </button>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/50 hover:bg-green-900/70 text-green-300 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Approve & Publish
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Edit form */}
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

          {/* Image section */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Framework Illustration
              </h3>
              {isEditable && (
                <button
                  onClick={handleRegenerateImage}
                  disabled={regeneratingImage || !imagePrompt}
                  className="flex items-center gap-1 px-2 py-1 bg-purple-900/50 hover:bg-purple-900/70 text-purple-300 rounded-lg text-xs transition-colors disabled:opacity-50"
                >
                  {regeneratingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Regenerate
                </button>
              )}
            </div>
            {item.image_url ? (
              <div className="rounded-lg overflow-hidden mb-3 bg-gray-800">
                <img src={item.image_url} alt="Generated framework illustration" className="w-full max-h-[400px] object-contain" />
              </div>
            ) : (
              <div className="rounded-lg bg-gray-800 h-48 flex items-center justify-center mb-3">
                <div className="text-center text-gray-500">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No image generated yet</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
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

          {/* Source context */}
          {item.meeting_record && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <button
                onClick={() => setShowSource(!showSource)}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-400"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Source Meeting Context
                </span>
                {showSource ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showSource && (
                <div className="mt-3 space-y-3 text-xs text-gray-400">
                  <div>
                    <span className="text-gray-500">Type:</span>{' '}
                    <span className="capitalize">{item.meeting_record.meeting_type?.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Date:</span>{' '}
                    {new Date(item.meeting_record.meeting_date).toLocaleDateString()}
                  </div>
                  {item.topic_extracted && (
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="font-medium text-gray-300 mb-1">Extracted Topic</div>
                      <div><span className="text-gray-500">Topic:</span> {item.topic_extracted.topic}</div>
                      <div><span className="text-gray-500">Angle:</span> {item.topic_extracted.angle}</div>
                      <div><span className="text-gray-500">Insight:</span> {item.topic_extracted.key_insight}</div>
                      {item.topic_extracted.personal_tie_in && (
                        <div><span className="text-gray-500">Personal tie-in:</span> {item.topic_extracted.personal_tie_in}</div>
                      )}
                    </div>
                  )}
                  {item.hormozi_framework && (
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="font-medium text-gray-300 mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" /> Hormozi Framework
                      </div>
                      <div><span className="text-gray-500">Type:</span> {item.hormozi_framework.framework_type}</div>
                      <div><span className="text-gray-500">Hook:</span> {item.hormozi_framework.hook_type}</div>
                      <div><span className="text-gray-500">Proof:</span> {item.hormozi_framework.proof_pattern}</div>
                      <div><span className="text-gray-500">CTA:</span> {item.hormozi_framework.cta_pattern}</div>
                    </div>
                  )}
                  {item.rag_context && (
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="font-medium text-gray-300 mb-1">RAG Personal Context</div>
                      <pre className="text-xs text-gray-400 whitespace-pre-wrap overflow-auto max-h-40">
                        {JSON.stringify(item.rag_context, null, 2)}
                      </pre>
                    </div>
                  )}
                  {item.meeting_record.transcript && (
                    <div>
                      <div className="text-gray-500 mb-1">Transcript excerpt:</div>
                      <pre className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400 whitespace-pre-wrap overflow-auto max-h-60">
                        {item.meeting_record.transcript.slice(0, 2000)}
                        {item.meeting_record.transcript.length > 2000 ? '\n...(truncated)' : ''}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column: Preview + metadata */}
        <div className="space-y-4">
          {/* LinkedIn Preview */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
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
                {getFullPostText(item)}
              </div>
              {item.image_url && (
                <div className="rounded-lg overflow-hidden border border-gray-200">
                  <img src={item.image_url} alt="" className="w-full" />
                </div>
              )}
            </div>
          </div>

          {/* Scheduling */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Schedule
            </h3>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              disabled={!isEditable}
              className="w-full bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
            />
            {item.published_at && (
              <p className="text-xs text-green-400 mt-2">
                Published: {new Date(item.published_at).toLocaleString()}
              </p>
            )}
            {item.platform_post_id && (
              <p className="text-xs text-gray-500 mt-1">
                Post ID: {item.platform_post_id}
              </p>
            )}
          </div>

          {/* Admin notes */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">Admin Notes</label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes about this post..."
              className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-y"
            />
          </div>

          {/* Metadata */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-500 space-y-1">
            <div>Created: {new Date(item.created_at).toLocaleString()}</div>
            <div>Updated: {new Date(item.updated_at).toLocaleString()}</div>
            <div>ID: <span className="font-mono text-gray-600">{item.id}</span></div>
          </div>
        </div>
      </div>
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
