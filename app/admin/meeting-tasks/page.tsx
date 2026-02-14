'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardCheck,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  Mail,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  RefreshCw,
  Filter,
  Edit3,
  User,
  Calendar,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { useAuth } from '@/components/AuthProvider'
import { getCurrentSession } from '@/lib/auth'

// ============================================================================
// Types
// ============================================================================

interface MeetingActionTask {
  id: string
  meeting_record_id: string
  client_project_id: string | null
  title: string
  description: string | null
  owner: string | null
  due_date: string | null
  status: 'pending' | 'in_progress' | 'complete' | 'cancelled'
  completed_at: string | null
  display_order: number
  created_at: string
}

interface ClientUpdateDraft {
  id: string
  client_project_id: string
  meeting_record_id: string | null
  subject: string
  body: string
  client_email: string
  client_name: string
  task_ids: string[]
  status: 'draft' | 'sent'
  sent_at: string | null
  sent_via: string | null
  created_at: string
}

type Tab = 'tasks' | 'drafts'
type TaskFilter = 'all' | 'pending' | 'in_progress' | 'complete' | 'cancelled'

// ============================================================================
// Status config
// ============================================================================

const STATUS_CONFIG: Record<string, {
  label: string
  icon: typeof Circle
  color: string
  bgColor: string
}> = {
  pending: {
    label: 'To Do',
    icon: Circle,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
  },
  in_progress: {
    label: 'In Progress',
    icon: Clock,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  complete: {
    label: 'Complete',
    icon: CheckCircle2,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
  },
}

// ============================================================================
// Page component
// ============================================================================

export default function MeetingTasksPage() {
  return (
    <ProtectedRoute requireAdmin>
      <MeetingTasksContent />
    </ProtectedRoute>
  )
}

function MeetingTasksContent() {
  const [activeTab, setActiveTab] = useState<Tab>('tasks')
  const [tasks, setTasks] = useState<MeetingActionTask[]>([])
  const [drafts, setDrafts] = useState<ClientUpdateDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all')
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
  const [generatingDraft, setGeneratingDraft] = useState(false)
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<ClientUpdateDraft | null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')

  // Fetch auth token for API calls
  const getHeaders = useCallback(async (): Promise<HeadersInit> => {
    const session = await getCurrentSession()
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`,
    }
  }, [])

  // ── Fetch tasks ──
  const fetchTasks = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const params = taskFilter !== 'all' ? `?status=${taskFilter}` : ''
      const res = await fetch(`/api/meeting-action-tasks${params}`, { headers })
      if (res.ok) {
        const data = await res.json()
        setTasks(data.tasks || [])
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    }
  }, [getHeaders, taskFilter])

  // ── Fetch drafts ──
  const fetchDrafts = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch('/api/client-update-drafts', { headers })
      if (res.ok) {
        const data = await res.json()
        setDrafts(data.drafts || [])
      }
    } catch (err) {
      console.error('Failed to fetch drafts:', err)
    }
  }, [getHeaders])

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchTasks(), fetchDrafts()])
      setLoading(false)
    }
    load()
  }, [fetchTasks, fetchDrafts])

  // ── Update task status ──
  const updateTaskStatus = async (taskId: string, newStatus: MeetingActionTask['status']) => {
    setUpdatingIds(prev => new Set(prev).add(taskId))
    try {
      const headers = await getHeaders()
      await fetch('/api/meeting-action-tasks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ updates: [{ id: taskId, status: newStatus }] }),
      })
      await fetchTasks()
    } catch (err) {
      console.error('Failed to update task:', err)
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  // ── Generate draft from all completed tasks ──
  const generateDraft = async (clientProjectId: string) => {
    setGeneratingDraft(true)
    try {
      const headers = await getHeaders()
      const res = await fetch('/api/client-update-drafts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ client_project_id: clientProjectId }),
      })
      if (res.ok) {
        await fetchDrafts()
        setActiveTab('drafts')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to generate draft')
      }
    } catch (err) {
      console.error('Failed to generate draft:', err)
    } finally {
      setGeneratingDraft(false)
    }
  }

  // ── Send draft ──
  const handleSendDraft = async (draftId: string) => {
    if (!confirm('Send this update email to the client?')) return
    setSendingDraftId(draftId)
    try {
      const headers = await getHeaders()
      const res = await fetch(`/api/client-update-drafts/${draftId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'send', channel: 'email' }),
      })
      if (res.ok) {
        await fetchDrafts()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to send')
      }
    } catch (err) {
      console.error('Failed to send draft:', err)
    } finally {
      setSendingDraftId(null)
    }
  }

  // ── Save draft edits ──
  const handleSaveDraft = async () => {
    if (!editingDraft) return
    try {
      const headers = await getHeaders()
      await fetch(`/api/client-update-drafts/${editingDraft.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ subject: editSubject, body: editBody }),
      })
      setEditingDraft(null)
      await fetchDrafts()
    } catch (err) {
      console.error('Failed to save draft:', err)
    }
  }

  // Compute stats
  const stats = {
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    complete: tasks.filter(t => t.status === 'complete').length,
    total: tasks.length,
    draftCount: drafts.filter(d => d.status === 'draft').length,
  }

  // Group completed tasks by project for "Generate update" buttons
  const completedByProject = tasks
    .filter(t => t.status === 'complete' && t.client_project_id)
    .reduce<Record<string, MeetingActionTask[]>>((acc, t) => {
      const pid = t.client_project_id!
      if (!acc[pid]) acc[pid] = []
      acc[pid].push(t)
      return acc
    }, {})

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Meeting Tasks' },
        ]} />

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center">
            <ClipboardCheck size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Meeting Action Tasks</h1>
            <p className="text-gray-400">Track action items between meetings and send client updates</p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'To Do', value: stats.pending, border: 'border-gray-500/30', bg: 'bg-gray-500/10' },
            { label: 'In Progress', value: stats.in_progress, border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
            { label: 'Complete', value: stats.complete, border: 'border-green-500/30', bg: 'bg-green-500/10' },
            { label: 'Total Tasks', value: stats.total, border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
            { label: 'Draft Updates', value: stats.draftCount, border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
          ].map(s => (
            <div key={s.label} className={`p-4 rounded-xl border ${s.border} ${s.bg}`}>
              <div className="text-sm text-gray-400">{s.label}</div>
              <div className="text-2xl font-bold mt-1">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-800">
          {[
            { id: 'tasks' as Tab, label: 'Action Items', count: stats.total },
            { id: 'drafts' as Tab, label: 'Client Update Drafts', count: stats.draftCount },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-violet-500 text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-violet-400" size={32} />
          </div>
        ) : (
          <>
            {/* ═══════════════ TASKS TAB ═══════════════ */}
            {activeTab === 'tasks' && (
              <div>
                {/* Filter row */}
                <div className="flex items-center gap-2 mb-6">
                  <Filter size={16} className="text-gray-500" />
                  {(['all', 'pending', 'in_progress', 'complete', 'cancelled'] as TaskFilter[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setTaskFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        taskFilter === f
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/50'
                          : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label || f}
                    </button>
                  ))}
                  <button
                    onClick={() => fetchTasks()}
                    className="ml-auto px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600 flex items-center gap-1"
                  >
                    <RefreshCw size={12} /> Refresh
                  </button>
                </div>

                {/* Task list */}
                {tasks.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <ClipboardCheck size={48} className="mx-auto mb-4 opacity-30" />
                    <p>No action items yet</p>
                    <p className="text-sm mt-1">Tasks will appear here when meeting records are processed</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {tasks.map(task => {
                        const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending
                        const StatusIcon = cfg.icon
                        const isUpdating = updatingIds.has(task.id)
                        return (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              {/* Status icon / quick toggle */}
                              <button
                                disabled={isUpdating}
                                onClick={() => {
                                  const next = task.status === 'pending' ? 'in_progress'
                                    : task.status === 'in_progress' ? 'complete'
                                    : task.status === 'complete' ? 'pending'
                                    : 'pending'
                                  updateTaskStatus(task.id, next)
                                }}
                                className={`mt-0.5 ${cfg.color} hover:opacity-80 transition-opacity`}
                                title={`Click to cycle status (current: ${cfg.label})`}
                              >
                                {isUpdating
                                  ? <Loader2 size={20} className="animate-spin" />
                                  : <StatusIcon size={20} />}
                              </button>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className={`font-medium ${task.status === 'complete' ? 'line-through text-gray-500' : ''}`}>
                                  {task.title}
                                </div>
                                {task.description && (
                                  <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                                  {task.owner && (
                                    <span className="flex items-center gap-1">
                                      <User size={12} /> {task.owner}
                                    </span>
                                  )}
                                  {task.due_date && (
                                    <span className="flex items-center gap-1">
                                      <Calendar size={12} /> {new Date(task.due_date).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Quick status buttons */}
                              <div className="flex items-center gap-1">
                                {task.status !== 'complete' && (
                                  <button
                                    onClick={() => updateTaskStatus(task.id, 'complete')}
                                    className="px-2 py-1 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20"
                                  >
                                    Done
                                  </button>
                                )}
                                {task.status !== 'cancelled' && task.status !== 'complete' && (
                                  <button
                                    onClick={() => updateTaskStatus(task.id, 'cancelled')}
                                    className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </div>
                )}

                {/* Generate update email section */}
                {Object.keys(completedByProject).length > 0 && (
                  <div className="mt-8 p-4 border border-amber-500/30 bg-amber-500/5 rounded-xl">
                    <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                      <Mail size={16} /> Generate Client Update Email
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                      Create a draft email summarising completed action items for a client.
                    </p>
                    <div className="space-y-2">
                      {Object.entries(completedByProject).map(([pid, projectTasks]) => (
                        <button
                          key={pid}
                          onClick={() => generateDraft(pid)}
                          disabled={generatingDraft}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-amber-500/50 text-sm transition-colors"
                        >
                          <span>
                            Project {pid.slice(0, 8)}... — {projectTasks.length} completed task(s)
                          </span>
                          {generatingDraft
                            ? <Loader2 size={14} className="animate-spin text-amber-400" />
                            : <FileText size={14} className="text-amber-400" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════ DRAFTS TAB ═══════════════ */}
            {activeTab === 'drafts' && (
              <div>
                {drafts.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <Mail size={48} className="mx-auto mb-4 opacity-30" />
                    <p>No client update drafts</p>
                    <p className="text-sm mt-1">Generate a draft from the Tasks tab when actions are completed</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {drafts.map(draft => (
                      <motion.div
                        key={draft.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`p-5 rounded-xl border ${
                          draft.status === 'sent'
                            ? 'bg-gray-900/50 border-gray-800'
                            : 'bg-gray-900 border-amber-500/30'
                        }`}
                      >
                        {/* Draft header */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              draft.status === 'sent'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {draft.status === 'sent' ? 'Sent' : 'Draft'}
                            </span>
                            <h3 className="text-lg font-semibold mt-2">{draft.subject}</h3>
                            <p className="text-sm text-gray-500 mt-1">
                              To: {draft.client_name} ({draft.client_email})
                              {draft.task_ids?.length > 0 && ` — ${draft.task_ids.length} task(s)`}
                            </p>
                          </div>
                          <span className="text-xs text-gray-600">
                            {new Date(draft.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Body preview */}
                        <pre className="whitespace-pre-wrap text-sm text-gray-400 bg-gray-800/50 p-3 rounded-lg max-h-40 overflow-y-auto font-sans">
                          {draft.body}
                        </pre>

                        {/* Actions */}
                        {draft.status === 'draft' && (
                          <div className="flex items-center gap-2 mt-4">
                            <button
                              onClick={() => {
                                setEditingDraft(draft)
                                setEditSubject(draft.subject)
                                setEditBody(draft.body)
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-600 flex items-center gap-1"
                            >
                              <Edit3 size={12} /> Edit
                            </button>
                            <button
                              onClick={() => handleSendDraft(draft.id)}
                              disabled={sendingDraftId === draft.id}
                              className="px-3 py-1.5 rounded-lg text-xs bg-violet-500/20 text-violet-300 border border-violet-500/50 hover:bg-violet-500/30 flex items-center gap-1"
                            >
                              {sendingDraftId === draft.id
                                ? <Loader2 size={12} className="animate-spin" />
                                : <Send size={12} />}
                              Send to Client
                            </button>
                          </div>
                        )}
                        {draft.status === 'sent' && draft.sent_at && (
                          <p className="text-xs text-gray-600 mt-3">
                            Sent {new Date(draft.sent_at).toLocaleString()} via {draft.sent_via || 'email'}
                          </p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ═══════════════ EDIT DRAFT MODAL ═══════════════ */}
        <AnimatePresence>
          {editingDraft && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              onClick={() => setEditingDraft(null)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6"
                onClick={e => e.stopPropagation()}
              >
                <h2 className="text-xl font-bold mb-4">Edit Draft</h2>

                <label className="block text-sm text-gray-400 mb-1">Subject</label>
                <input
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4"
                />

                <label className="block text-sm text-gray-400 mb-1">Body</label>
                <textarea
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm mb-4"
                />

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingDraft(null)}
                    className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDraft}
                    className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500"
                  >
                    Save Changes
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
