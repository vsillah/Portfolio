'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Circle,
  Clock,
  SkipForward,
  Send,
  Paperclip,
  X,
  Upload,
  Mail,
  Hash,
  Shield,
  Package,
  FileText,
  MessageSquare,
  AlertCircle,
  LayoutDashboard,
  Copy,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { useAuth } from '@/components/AuthProvider'
import { getCurrentSession } from '@/lib/auth'
import { useParams } from 'next/navigation'

// ============================================================================
// Types
// ============================================================================

interface Milestone {
  week: number | string
  title: string
  description: string
  deliverables: string[]
  phase: number
  target_date?: string
  status: 'pending' | 'in_progress' | 'complete' | 'skipped'
}

interface CommunicationPlan {
  cadence: string
  channels: string[]
  meetings: Array<{
    type: string
    frequency: string
    duration_minutes: number
    description: string
  }>
  escalation_path: string
  ad_hoc?: string
}

interface WarrantyTerms {
  duration_months: number
  coverage_description: string
  exclusions: string[]
  extended_support_available: boolean
  extended_support_description: string
}

interface ArtifactHandoff {
  artifact: string
  format: string
  description: string
  delivery_method: string
}

interface ProgressUpdateEntry {
  id: string
  update_type: string
  channel: string
  milestone_index: number
  rendered_subject: string | null
  rendered_body: string
  delivery_status: string
  attachments: Array<{ url: string; filename: string; content_type: string }>
  created_at: string
  sent_at: string | null
}

interface Attachment {
  url: string
  filename: string
  content_type: string
}

interface ProjectDetail {
  project: {
    id: string
    client_id: string
    client_name: string
    client_email: string
    client_company: string | null
    slack_channel: string | null
    project_status: string
    current_phase: number
    product_purchased: string | null
    project_start_date: string | null
    estimated_end_date: string | null
    payment_amount: number | null
  }
  onboarding_plan: {
    id: string
    milestones: Milestone[]
    communication_plan: CommunicationPlan
    warranty: WarrantyTerms
    artifacts_handoff: ArtifactHandoff[]
    status: string
    onboarding_plan_templates: {
      name: string
      content_type: string
      service_type: string | null
      estimated_duration_weeks: number | null
    } | null
  } | null
  progress_updates: ProgressUpdateEntry[]
  blockers: Array<{
    id: string
    message: string
    urgency: string
    status: string
    detected_at: string
  }>
}

// ============================================================================
// Status config
// ============================================================================

const MILESTONE_STATUS_CONFIG: Record<
  string,
  { icon: typeof CheckCircle2; color: string; bgColor: string; label: string }
> = {
  pending: {
    icon: Circle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/20',
    label: 'Pending',
  },
  in_progress: {
    icon: Clock,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    label: 'In Progress',
  },
  complete: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    label: 'Complete',
  },
  skipped: {
    icon: SkipForward,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    label: 'Skipped',
  },
}

// ============================================================================
// Main Page
// ============================================================================

export default function ClientProjectDetailPage() {
  return (
    <ProtectedRoute requireAdmin>
      <ProjectDetailContent />
    </ProtectedRoute>
  )
}

function ProjectDetailContent() {
  const { user } = useAuth()
  const params = useParams()
  const projectId = params.id as string

  const [data, setData] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    milestoneIndex: number
    milestone: Milestone
  } | null>(null)

  const fetchProject = useCallback(async () => {
    if (!user || !projectId) return
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return
      setAccessToken(session.access_token)

      const response = await fetch(
        `/api/admin/client-projects/${projectId}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      )
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Failed to fetch project:', error)
    } finally {
      setLoading(false)
    }
  }, [user, projectId])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto text-center py-20 text-gray-400">
          Loading project...
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto text-center py-20 text-gray-400">
          Project not found.
        </div>
      </div>
    )
  }

  const { project, onboarding_plan, progress_updates } = data
  const milestones = onboarding_plan?.milestones || []
  const completedCount = milestones.filter(
    (m) => m.status === 'complete'
  ).length
  const totalCount = milestones.length
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const channel = project.slack_channel ? 'Slack' : 'Email'

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Client Projects', href: '/admin/client-projects' },
            { label: project.client_name },
          ]}
        />

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-3xl font-bold">{project.client_name}</h1>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/50">
              {project.project_status.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            {project.client_company && <span>{project.client_company}</span>}
            <span className="flex items-center gap-1">
              <Mail size={12} /> {project.client_email}
            </span>
            {project.slack_channel && (
              <span className="flex items-center gap-1 text-blue-400">
                <Hash size={12} /> {project.slack_channel}
              </span>
            )}
          </div>
          {project.product_purchased && (
            <p className="text-gray-500 mt-1">{project.product_purchased}</p>
          )}
        </div>

        {/* Client Dashboard Management */}
        <DashboardManagement projectId={projectId} accessToken={accessToken || ''} />

        {/* Progress Bar */}
        <div className="mb-8 p-4 bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-gray-400">
              {completedCount}/{totalCount} milestones ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Updates delivered via {channel} {project.slack_channel ? `(#${project.slack_channel})` : `(${project.client_email})`}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main: Milestone Timeline */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold mb-4">Milestone Timeline</h2>
            {milestones.length === 0 ? (
              <p className="text-gray-500">
                No milestones defined. Create an onboarding plan first.
              </p>
            ) : (
              <div className="space-y-3">
                {milestones.map((milestone, index) => (
                  <MilestoneCard
                    key={index}
                    milestone={milestone}
                    index={index}
                    isLast={index === milestones.length - 1}
                    onMarkComplete={() =>
                      setConfirmModal({ milestoneIndex: index, milestone })
                    }
                  />
                ))}
              </div>
            )}

            {/* Project Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
              {/* Warranty */}
              {onboarding_plan?.warranty &&
                onboarding_plan.warranty.duration_months > 0 && (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield size={16} className="text-blue-400" />
                      <h3 className="font-semibold text-blue-400">Warranty</h3>
                    </div>
                    <p className="text-sm text-gray-300">
                      {onboarding_plan.warranty.duration_months}-month warranty
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {onboarding_plan.warranty.coverage_description}
                    </p>
                  </div>
                )}

              {/* Artifacts */}
              {onboarding_plan?.artifacts_handoff &&
                onboarding_plan.artifacts_handoff.length > 0 && (
                  <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Package size={16} className="text-purple-400" />
                      <h3 className="font-semibold text-purple-400">
                        Artifacts ({onboarding_plan.artifacts_handoff.length})
                      </h3>
                    </div>
                    <ul className="space-y-1">
                      {onboarding_plan.artifacts_handoff
                        .slice(0, 4)
                        .map((a, i) => (
                          <li
                            key={i}
                            className="text-xs text-gray-400 flex items-center gap-1"
                          >
                            <FileText size={10} /> {a.artifact} ({a.format})
                          </li>
                        ))}
                      {onboarding_plan.artifacts_handoff.length > 4 && (
                        <li className="text-xs text-gray-500">
                          +{onboarding_plan.artifacts_handoff.length - 4} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
            </div>
          </div>

          {/* Sidebar: Communication + Update Log */}
          <div className="space-y-6">
            {/* Communication Plan */}
            {onboarding_plan?.communication_plan && (
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare size={16} /> Communication
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cadence</span>
                    <span className="capitalize">
                      {onboarding_plan.communication_plan.cadence}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Channel</span>
                    <span className="flex items-center gap-1">
                      {project.slack_channel ? (
                        <>
                          <Hash size={12} className="text-blue-400" /> Slack
                        </>
                      ) : (
                        <>
                          <Mail size={12} className="text-gray-400" /> Email
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Channels</span>
                    <span className="text-xs text-gray-300">
                      {onboarding_plan.communication_plan.channels?.join(
                        ', '
                      ) || 'email'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Progress Update Log */}
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Send size={16} /> Progress Updates
              </h3>
              {progress_updates.length === 0 ? (
                <p className="text-sm text-gray-500">No updates sent yet.</p>
              ) : (
                <div className="space-y-3">
                  {progress_updates.slice(0, 10).map((update) => (
                    <div
                      key={update.id}
                      className="text-sm border-b border-gray-800 pb-2 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-blue-400 capitalize">
                          {update.update_type.replace(/_/g, ' ')}
                        </span>
                        <span
                          className={`text-xs ${
                            update.delivery_status === 'sent'
                              ? 'text-emerald-400'
                              : update.delivery_status === 'failed'
                                ? 'text-red-400'
                                : 'text-yellow-400'
                          }`}
                        >
                          {update.delivery_status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {update.channel === 'slack' ? (
                          <Hash size={10} className="text-gray-500" />
                        ) : (
                          <Mail size={10} className="text-gray-500" />
                        )}
                        <span className="text-xs text-gray-500">
                          {new Date(update.created_at).toLocaleDateString(
                            'en-US',
                            {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }
                          )}
                        </span>
                        {update.attachments && update.attachments.length > 0 && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Paperclip size={10} />{' '}
                            {update.attachments.length}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Blockers */}
            {data.blockers.filter((b) => b.status === 'open').length > 0 && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-red-400">
                  <AlertCircle size={16} /> Open Blockers
                </h3>
                {data.blockers
                  .filter((b) => b.status === 'open')
                  .map((blocker) => (
                    <div
                      key={blocker.id}
                      className="text-sm text-gray-300 mb-2"
                    >
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded mr-2 ${
                          blocker.urgency === 'critical'
                            ? 'bg-red-500/30 text-red-300'
                            : 'bg-yellow-500/30 text-yellow-300'
                        }`}
                      >
                        {blocker.urgency}
                      </span>
                      {blocker.message}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Confirmation Modal */}
        <AnimatePresence>
          {confirmModal && (
            <MilestoneCompleteModal
              projectId={projectId}
              milestone={confirmModal.milestone}
              milestoneIndex={confirmModal.milestoneIndex}
              clientName={project.client_name}
              channel={channel}
              accessToken={accessToken || ''}
              onClose={() => setConfirmModal(null)}
              onSuccess={() => {
                setConfirmModal(null)
                fetchProject() // Refresh data
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ============================================================================
// Milestone Card
// ============================================================================

function MilestoneCard({
  milestone,
  index,
  isLast,
  onMarkComplete,
}: {
  milestone: Milestone
  index: number
  isLast: boolean
  onMarkComplete: () => void
}) {
  const config = MILESTONE_STATUS_CONFIG[milestone.status] || MILESTONE_STATUS_CONFIG.pending
  const Icon = config.icon

  return (
    <div className="flex gap-4">
      {/* Timeline indicator */}
      <div className="flex flex-col items-center">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${config.bgColor}`}
        >
          <Icon size={16} className={config.color} />
        </div>
        {!isLast && (
          <div
            className={`w-0.5 flex-1 mt-1 ${
              milestone.status === 'complete' ? 'bg-emerald-500/50' : 'bg-gray-800'
            }`}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-blue-400">
                  {typeof milestone.week === 'number'
                    ? `Week ${milestone.week}`
                    : `Wk ${milestone.week}`}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${config.bgColor} ${config.color}`}
                >
                  {config.label}
                </span>
              </div>
              <h4 className="font-semibold mt-1">{milestone.title}</h4>
            </div>

            {/* Mark Complete button */}
            {milestone.status !== 'complete' &&
              milestone.status !== 'skipped' && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onMarkComplete}
                  className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  Mark Complete
                </motion.button>
              )}
          </div>

          <p className="text-sm text-gray-400 mb-2">
            {milestone.description}
          </p>

          {milestone.target_date && (
            <p className="text-xs text-gray-500 mb-2">
              Target:{' '}
              {new Date(milestone.target_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}

          {milestone.deliverables && milestone.deliverables.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {milestone.deliverables.map((d, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-300"
                >
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Milestone Complete Confirmation Modal
// ============================================================================

function MilestoneCompleteModal({
  projectId,
  milestone,
  milestoneIndex,
  clientName,
  channel,
  accessToken,
  onClose,
  onSuccess,
}: {
  projectId: string
  milestone: Milestone
  milestoneIndex: number
  clientName: string
  channel: string
  accessToken: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [note, setNote] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setError(null)

    for (const file of Array.from(files)) {
      // Validate file type
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
      ]
      if (!allowedTypes.includes(file.type)) {
        setError('Only images and PDFs are allowed.')
        setUploading(false)
        return
      }

      // Validate size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB.')
        setUploading(false)
        return
      }

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'products') // Reuse existing bucket
        formData.append(
          'folder',
          `progress-updates/${projectId}/${milestoneIndex}`
        )

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Upload failed')
        }

        const result = await response.json()
        setAttachments((prev) => [
          ...prev,
          {
            url: result.publicUrl,
            filename: file.name,
            content_type: file.type,
          },
        ])
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to upload file'
        )
      }
    }

    setUploading(false)
    // Reset file input
    e.target.value = ''
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/client-projects/${projectId}/milestones`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            milestone_index: milestoneIndex,
            new_status: 'complete',
            attachments:
              attachments.length > 0 ? attachments : undefined,
            note: note.trim() || undefined,
            sender_name: 'Your Project Lead',
          }),
        }
      )

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to update milestone')
      }

      onSuccess()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update milestone'
      )
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Mark Milestone Complete</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            Mark &quot;{milestone.title}&quot; as complete? This will send a
            progress update to <strong>{clientName}</strong> via{' '}
            <strong>{channel}</strong>.
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Paperclip size={14} /> Attach Files (optional)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Screenshots, mockups, or documents to include with the update.
            </p>

            <label className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 border border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-blue-500/50 transition-colors">
              <Upload size={16} className="text-gray-400" />
              <span className="text-sm text-gray-400">
                {uploading ? 'Uploading...' : 'Choose files or drag & drop'}
              </span>
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>

            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((att, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg"
                  >
                    <span className="text-sm text-gray-300 truncate">
                      {att.filename}
                    </span>
                    <button
                      onClick={() => removeAttachment(i)}
                      className="text-gray-500 hover:text-red-400 transition-colors ml-2"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Personal Note */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Personal Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., The chatbot is looking great -- check out the screenshot!"
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50 resize-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send size={14} />
            {submitting ? 'Sending...' : 'Mark Complete & Send Update'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ============================================================================
// Dashboard Management Section
// ============================================================================

function DashboardManagement({
  projectId,
  accessToken,
}: {
  projectId: string
  accessToken: string
}) {
  const [dashboardToken, setDashboardToken] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(true)

  // Check if dashboard already exists
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`/api/admin/client-projects/${projectId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (res.ok) {
          const data = await res.json()
          // Check for existing dashboard access
          if (data.dashboard_token) {
            setDashboardToken(data.dashboard_token)
          }
        }
      } catch {
        // Ignore
      } finally {
        setChecking(false)
      }
    }
    if (accessToken) check()
  }, [projectId, accessToken])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/admin/client-projects/${projectId}/dashboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (res.ok) {
        const data = await res.json()
        setDashboardToken(data.accessToken)
      }
    } catch {
      // Ignore
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    if (!dashboardToken) return
    const url = `${window.location.origin}/client/dashboard/${dashboardToken}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (checking) return null

  return (
    <div className="mb-8 p-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/30 rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
            <LayoutDashboard size={20} className="text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-300">Client Dashboard</h3>
            <p className="text-xs text-gray-500">
              {dashboardToken
                ? 'Dashboard active — share the link with your client'
                : 'Generate a personalized dashboard for this client'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {dashboardToken ? (
            <>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/50 rounded-lg text-blue-300 text-xs font-medium hover:bg-blue-500/30 flex items-center gap-1.5 transition-colors"
              >
                <Copy size={12} />
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <a
                href={`/client/dashboard/${dashboardToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-xs font-medium hover:bg-gray-700 flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink size={12} />
                View as Client
              </a>
            </>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <LayoutDashboard size={14} />
              )}
              {generating ? 'Generating...' : 'Generate Dashboard'}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  )
}
