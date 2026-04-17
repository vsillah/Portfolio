'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
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
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Filter,
  Edit3,
  User,
  Calendar,
  Link2,
  MessageSquare,
  ArrowUpDown,
  Trash2,
  UserPlus,
} from 'lucide-react'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import { buildLinkWithReturn } from '@/lib/admin-return-context'

// ============================================================================
// Types
// ============================================================================

type TaskCategory = 'internal' | 'outreach'

interface MeetingActionTask {
  id: string
  meeting_record_id: string | null
  client_project_id: string | null
  title: string
  description: string | null
  owner: string | null
  due_date: string | null
  status: 'pending' | 'in_progress' | 'complete' | 'cancelled'
  completed_at: string | null
  display_order: number
  created_at: string
  task_category: TaskCategory
  outreach_queue_id: string | null
  project_name?: string | null
  client_name?: string | null
  meeting_type?: string | null
  meeting_date?: string | null
  contact_submission_id?: number | null
  lead_name?: string | null
  lead_email?: string | null
}

interface LeadOption {
  id: number
  name: string
  email: string | null
}

interface TaskProject {
  id: string
  project_name: string | null
  client_name: string | null
}

interface ClientUpdateDraft {
  id: string
  client_project_id: string | null
  contact_submission_id: number | null
  draft_type: 'client_update' | 'lead_followup'
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

interface CommTemplate {
  id: string
  update_type: string
  content_type: string | null
  service_type: string | null
  tone: string
  email_subject: string
  email_body: string
  slack_body: string
  is_active: boolean
  created_at: string
  updated_at: string
}

type Tab = 'tasks' | 'comms' | 'templates'
type TaskFilter = 'all' | 'pending' | 'in_progress' | 'complete' | 'cancelled'
type CategoryFilter = 'all' | TaskCategory
type SortField = 'meeting_date' | 'owner' | 'status' | 'title' | 'created_at'
type SortDir = 'asc' | 'desc'

const TASKS_PER_PAGE = 10

const SELF_NAMES = new Set(['amadou town', 'vambah sillah', 'amadou', 'vambah'])

// ============================================================================
// Status config
// ============================================================================

const STATUS_CONFIG: Record<string, {
  label: string
  icon: typeof Circle
  color: string
  bgColor: string
}> = {
  pending: { label: 'To Do', icon: Circle, color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  complete: { label: 'Complete', icon: CheckCircle2, color: 'text-green-400', bgColor: 'bg-green-500/20' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-500/20' },
}

const STATUS_ORDER: Record<string, number> = { pending: 0, in_progress: 1, complete: 2, cancelled: 3 }

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
  const searchParams = useSearchParams()

  // Pre-filter from URL query params. Meeting detail page links to
  // /admin/meeting-tasks?meeting_record_id=<id> so we auto-scope the list.
  const initialMeetingRecordId = searchParams.get('meeting_record_id') || ''
  const initialContactSubmissionId = searchParams.get('contact_submission_id') || ''

  const [activeTab, setActiveTab] = useState<Tab>('tasks')
  const [allTasks, setAllTasks] = useState<MeetingActionTask[]>([])
  const [drafts, setDrafts] = useState<ClientUpdateDraft[]>([])
  const [projects, setProjects] = useState<TaskProject[]>([])
  const [selectedClientProjectId, setSelectedClientProjectId] = useState<string>('')
  const [selectedMeetingRecordId, setSelectedMeetingRecordId] = useState<string>(initialMeetingRecordId)
  const [selectedMeetingDate, setSelectedMeetingDate] = useState<string>('')
  const [selectedLead, setSelectedLead] = useState<string>(initialContactSubmissionId)
  const [loading, setLoading] = useState(true)
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
  const [generatingDraft, setGeneratingDraft] = useState(false)
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<ClientUpdateDraft | null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [assigningMeetingId, setAssigningMeetingId] = useState<string | null>(null)
  const [assignLeadValue, setAssignLeadValue] = useState<string>('')
  const [assigningInProgress, setAssigningInProgress] = useState(false)
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([])
  const [commsBarExpanded, setCommsBarExpanded] = useState(false)
  const [commsTypeFilter, setCommsTypeFilter] = useState<'all' | 'client_update' | 'lead_followup'>('all')
  const [reportModal, setReportModal] = useState<{ contactId: number; contactName: string; tasks: MeetingActionTask[] } | null>(null)
  const [reportSelectedIds, setReportSelectedIds] = useState<Set<string>>(new Set())
  const [reportTargetDates, setReportTargetDates] = useState<Record<string, string>>({})
  const [sortField, setSortField] = useState<SortField>('meeting_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [editingTask, setEditingTask] = useState<MeetingActionTask | null>(null)
  const [editTaskTitle, setEditTaskTitle] = useState('')
  const [editTaskDescription, setEditTaskDescription] = useState('')
  const [editTaskOwner, setEditTaskOwner] = useState('')
  const [editTaskDueDate, setEditTaskDueDate] = useState('')
  const [editTaskStatus, setEditTaskStatus] = useState<MeetingActionTask['status']>('pending')
  const [editTaskCategory, setEditTaskCategory] = useState<TaskCategory>('internal')
  const [editTaskContactId, setEditTaskContactId] = useState<string>('')
  const [savingTask, setSavingTask] = useState(false)
  const [sendingToOutreachId, setSendingToOutreachId] = useState<string | null>(null)
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<CommTemplate[]>([])
  const [editingTemplate, setEditingTemplate] = useState<CommTemplate | null>(null)
  const [tplSubject, setTplSubject] = useState('')
  const [tplEmailBody, setTplEmailBody] = useState('')
  const [tplSlackBody, setTplSlackBody] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [siteSettings, setSiteSettings] = useState<{ key: string; value: unknown; description: string | null }[]>([])
  const [editingSettingKey, setEditingSettingKey] = useState<string | null>(null)
  const [editingSettingValue, setEditingSettingValue] = useState('')
  const [savingSetting, setSavingSetting] = useState(false)

  const getHeaders = useCallback(async (): Promise<HeadersInit> => {
    const session = await getCurrentSession()
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`,
    }
  }, [])

  const fetchProjects = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch('/api/meeting-action-tasks/projects', { headers })
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects || [])
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    }
  }, [getHeaders])

  const fetchTasks = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const params = new URLSearchParams()
      if (selectedClientProjectId) params.set('client_project_id', selectedClientProjectId)
      if (selectedMeetingRecordId) params.set('meeting_record_id', selectedMeetingRecordId)
      const qs = params.toString()
      const res = await fetch(`/api/meeting-action-tasks${qs ? `?${qs}` : ''}`, { headers })
      if (res.ok) {
        const data = await res.json()
        setAllTasks(data.tasks || [])
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    }
  }, [getHeaders, selectedClientProjectId, selectedMeetingRecordId])

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

  const fetchTemplates = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch('/api/admin/communication-templates', { headers })
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates || [])
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err)
    }
  }, [getHeaders])

  const fetchSiteSettings = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch('/api/admin/site-settings', { headers })
      if (res.ok) {
        const data = await res.json()
        setSiteSettings(data.settings || [])
      }
    } catch (err) {
      console.error('Failed to fetch site settings:', err)
    }
  }, [getHeaders])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchProjects(), fetchTasks(), fetchDrafts(), fetchTemplates(), fetchSiteSettings()])
      setLoading(false)
    }
    load()
  }, [fetchProjects, fetchTasks, fetchDrafts, fetchTemplates, fetchSiteSettings])

  // ── Client-side filtering ──
  // Note: meeting_record_id and client_project_id filters are applied server-side
  // in fetchTasks. Status/category/date/lead filters are applied here so they can
  // be toggled instantly without refetching.
  const filteredTasks = useMemo(() => {
    return allTasks.filter(t => {
      if (taskFilter !== 'all' && t.status !== taskFilter) return false
      if (categoryFilter !== 'all' && t.task_category !== categoryFilter) return false
      if (selectedMeetingDate && t.meeting_date?.slice(0, 10) !== selectedMeetingDate) return false
      if (selectedLead === '__unlinked__' && t.contact_submission_id) return false
      if (selectedLead && selectedLead !== '__unlinked__' && String(t.contact_submission_id) !== selectedLead) return false
      return true
    })
  }, [allTasks, taskFilter, categoryFilter, selectedMeetingDate, selectedLead])

  // ── Client-side sorting ──
  const sortedTasks = useMemo(() => {
    const sorted = [...filteredTasks]
    const dir = sortDir === 'asc' ? 1 : -1
    sorted.sort((a, b) => {
      switch (sortField) {
        case 'meeting_date': {
          const da = a.meeting_date || ''
          const db = b.meeting_date || ''
          return da.localeCompare(db) * dir
        }
        case 'owner': {
          const oa = (a.owner || '').toLowerCase()
          const ob = (b.owner || '').toLowerCase()
          return oa.localeCompare(ob) * dir
        }
        case 'status': {
          return ((STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)) * dir
        }
        case 'title': {
          return a.title.localeCompare(b.title) * dir
        }
        case 'created_at': {
          return a.created_at.localeCompare(b.created_at) * dir
        }
        default:
          return 0
      }
    })
    return sorted
  }, [filteredTasks, sortField, sortDir])

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / TASKS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const pagedTasks = sortedTasks.slice((safePage - 1) * TASKS_PER_PAGE, safePage * TASKS_PER_PAGE)

  // Reset page when filters/sort change
  useEffect(() => { setPage(1) }, [taskFilter, categoryFilter, selectedMeetingDate, selectedLead, selectedClientProjectId, selectedMeetingRecordId, sortField, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'meeting_date' ? 'desc' : 'asc')
    }
  }

  // ── Derived filter options ──
  const uniqueMeetingDates = [...new Set(allTasks.map(t => t.meeting_date?.slice(0, 10)).filter(Boolean) as string[])].sort().reverse()
  const uniqueLeads = allTasks
    .filter(t => t.contact_submission_id && t.lead_name)
    .reduce<Map<number, string>>((acc, t) => {
      if (!acc.has(t.contact_submission_id!)) acc.set(t.contact_submission_id!, t.lead_name!)
      return acc
    }, new Map())
  const hasUnlinkedTasks = allTasks.some(t => !t.contact_submission_id)

  // ── Task actions ──
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

  const openReportModal = (contactId: number, contactName: string, contactTasks: MeetingActionTask[]) => {
    setReportModal({ contactId, contactName, tasks: contactTasks })
    setReportSelectedIds(new Set(contactTasks.map(t => t.id)))
    setReportTargetDates({})
  }

  const generateStatusReport = async () => {
    if (!reportModal || reportSelectedIds.size === 0) return
    setGeneratingDraft(true)
    try {
      const headers = await getHeaders()
      const tasks = [...reportSelectedIds].map(id => ({
        taskId: id,
        targetDate: reportTargetDates[id] || null,
      }))
      const res = await fetch('/api/client-update-drafts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contact_submission_id: reportModal.contactId,
          tasks,
        }),
      })
      if (res.ok) {
        await fetchDrafts()
        setReportModal(null)
        setActiveTab('comms')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to generate report')
      }
    } catch (err) {
      console.error('Failed to generate report:', err)
    } finally {
      setGeneratingDraft(false)
    }
  }

  const handleSendDraft = async (draftId: string) => {
    if (!confirm('Send this email?')) return
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

  const fetchLeadOptions = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch('/api/admin/contact-submissions?limit=200', { headers })
      if (res.ok) {
        const data = await res.json()
        setLeadOptions((data.submissions || []).map((s: { id: number; name: string; email: string | null }) => ({
          id: s.id, name: s.name, email: s.email,
        })))
      }
    } catch {
      const fromTasks: LeadOption[] = []
      const seen = new Set<number>()
      for (const t of allTasks) {
        if (t.contact_submission_id && t.lead_name && !seen.has(t.contact_submission_id)) {
          seen.add(t.contact_submission_id)
          fromTasks.push({ id: t.contact_submission_id, name: t.lead_name, email: t.lead_email ?? null })
        }
      }
      setLeadOptions(fromTasks)
    }
  }, [getHeaders, allTasks])

  const handleAssignLead = async () => {
    if (!assigningMeetingId || !assignLeadValue) return
    setAssigningInProgress(true)
    try {
      const headers = await getHeaders()
      const csId = assignLeadValue === 'null' ? null : Number(assignLeadValue)
      const res = await fetch(`/api/meetings/${assigningMeetingId}/assign-lead`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ contact_submission_id: csId }),
      })
      if (res.ok) {
        setAssigningMeetingId(null)
        setAssignLeadValue('')
        await fetchTasks()
      }
    } catch (err) {
      console.error('Failed to assign lead:', err)
    } finally {
      setAssigningInProgress(false)
    }
  }

  const openEditTask = (task: MeetingActionTask) => {
    setEditingTask(task)
    setEditTaskTitle(task.title)
    setEditTaskDescription(task.description ?? '')
    setEditTaskOwner(task.owner ?? '')
    setEditTaskDueDate(task.due_date ? task.due_date.slice(0, 10) : '')
    setEditTaskStatus(task.status)
    setEditTaskCategory(task.task_category || 'internal')
    setEditTaskContactId(task.contact_submission_id ? String(task.contact_submission_id) : '')
    // Lead options are needed in the edit modal so the admin can attribute the
    // task directly to a contact. Ensure they're loaded.
    if (leadOptions.length === 0) fetchLeadOptions()
  }

  const saveTaskEdit = async () => {
    if (!editingTask) return
    setSavingTask(true)
    try {
      const headers = await getHeaders()
      // Attribution policy: empty string = explicit unlink (null). A numeric value
      // retargets the task. Because the assign-lead cascade only touches tasks that
      // match the meeting's contact, this manual override is preserved across
      // future meeting reassignments.
      const contactIdNormalized =
        editTaskContactId === '' ? null : Number(editTaskContactId)

      const res = await fetch('/api/meeting-action-tasks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          updates: [{
            id: editingTask.id,
            title: editTaskTitle,
            description: editTaskDescription || null,
            owner: editTaskOwner || null,
            due_date: editTaskDueDate || null,
            status: editTaskStatus,
            task_category: editTaskCategory,
            contact_submission_id: contactIdNormalized,
          }],
        }),
      })
      if (res.ok) {
        setEditingTask(null)
        await fetchTasks()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to update task')
      }
    } catch (err) {
      console.error('Failed to save task:', err)
    } finally {
      setSavingTask(false)
    }
  }

  const handleSendToOutreach = async (task: MeetingActionTask) => {
    if (!task.contact_submission_id) {
      alert('This task is not attributed to a contact yet. Edit the task and pick a contact before sending to outreach.')
      return
    }
    if (task.status === 'complete' || task.status === 'cancelled') {
      alert(`Task is ${task.status}. Reopen it before sending to outreach.`)
      return
    }
    setSendingToOutreachId(task.id)
    try {
      const headers = await getHeaders()
      const res = await fetch(`/api/meeting-action-tasks/${task.id}/send-to-outreach`, {
        method: 'POST',
        headers,
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        await fetchTasks()
        alert(data.reused
          ? 'Outreach draft already exists — opened in the outreach queue.'
          : 'Outreach draft created. Review and send it from the outreach queue.')
      } else {
        alert(data.error || 'Could not send to outreach')
      }
    } catch (err) {
      console.error('Failed to send to outreach:', err)
      alert('Something went wrong sending this task to outreach.')
    } finally {
      setSendingToOutreachId(null)
    }
  }

  const handleDeleteDraft = async (draftId: string) => {
    if (!confirm('Delete this communication? This cannot be undone.')) return
    setDeletingDraftId(draftId)
    try {
      const headers = await getHeaders()
      const res = await fetch(`/api/client-update-drafts/${draftId}`, { method: 'DELETE', headers })
      if (res.ok) {
        await fetchDrafts()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete')
      }
    } catch (err) {
      console.error('Failed to delete draft:', err)
    } finally {
      setDeletingDraftId(null)
    }
  }

  // ── Stats ──
  const stats = {
    pending: allTasks.filter(t => t.status === 'pending').length,
    in_progress: allTasks.filter(t => t.status === 'in_progress').length,
    complete: allTasks.filter(t => t.status === 'complete').length,
    cancelled: allTasks.filter(t => t.status === 'cancelled').length,
    total: allTasks.length,
    draftCount: drafts.filter(d => d.status === 'draft').length,
  }

  // ── Communication-ready contacts (all tasks, excluding self) ──
  const tasksByContact = useMemo(() => {
    const map = new Map<number, { name: string; tasks: MeetingActionTask[] }>()
    for (const t of allTasks) {
      if (!t.contact_submission_id || !t.lead_name) continue
      if (SELF_NAMES.has(t.lead_name.toLowerCase())) continue
      if (t.status === 'cancelled') continue
      if (!map.has(t.contact_submission_id)) {
        map.set(t.contact_submission_id, { name: t.lead_name, tasks: [] })
      }
      map.get(t.contact_submission_id)!.tasks.push(t)
    }
    return map
  }, [allTasks])

  const totalCommsReady = tasksByContact.size

  const hasActiveFilters =
    selectedMeetingDate ||
    selectedClientProjectId ||
    selectedLead ||
    selectedMeetingRecordId ||
    taskFilter !== 'all' ||
    categoryFilter !== 'all'

  const filteredDrafts = commsTypeFilter === 'all'
    ? drafts
    : drafts.filter(d => d.draft_type === commsTypeFilter)

  // ── Sort header helper ──
  const SortHeader = ({ field, label }: { field: SortField; label: string }) => {
    const active = sortField === field
    return (
      <button onClick={() => toggleSort(field)}
        className={`flex items-center gap-1 text-xs font-medium transition-colors ${active ? 'text-violet-400' : 'text-gray-500 hover:text-gray-300'}`}>
        {label}
        {active ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} className="opacity-40" />}
      </button>
    )
  }

  // ── Render ──
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
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
            <p className="text-gray-400">Track action items between meetings and send follow-ups</p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'To Do', value: stats.pending, border: 'border-gray-500/30', bg: 'bg-gray-500/10' },
            { label: 'In Progress', value: stats.in_progress, border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
            { label: 'Complete', value: stats.complete, border: 'border-green-500/30', bg: 'bg-green-500/10' },
            { label: 'Total Tasks', value: stats.total, border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
            { label: 'Ready to Send', value: totalCommsReady, border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
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
            { id: 'comms' as Tab, label: 'Communications', count: stats.draftCount },
            { id: 'templates' as Tab, label: 'Message Templates', count: templates.length },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-violet-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-xs">{tab.count}</span>
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
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Filter size={16} className="text-gray-500" />

                  {(uniqueLeads.size > 0 || hasUnlinkedTasks) && (
                    <select value={selectedLead} onChange={e => { setSelectedLead(e.target.value) }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500">
                      <option value="">All contacts</option>
                      {hasUnlinkedTasks && <option value="__unlinked__">Unlinked (no contact)</option>}
                      {[...uniqueLeads.entries()].map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
                    </select>
                  )}

                  <select value={selectedMeetingDate} onChange={e => { setSelectedMeetingDate(e.target.value) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500">
                    <option value="">All dates</option>
                    {uniqueMeetingDates.map(d => (
                      <option key={d} value={d}>{new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</option>
                    ))}
                  </select>

                  {projects.length > 0 && (
                    <select value={selectedClientProjectId} onChange={e => { setSelectedClientProjectId(e.target.value) }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500">
                      <option value="">All clients</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{[p.client_name, p.project_name].filter(Boolean).join(' — ') || p.id.slice(0, 8)}</option>
                      ))}
                    </select>
                  )}

                  <select value={taskFilter} onChange={e => { setTaskFilter(e.target.value as TaskFilter) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500">
                    <option value="all">All statuses ({stats.total})</option>
                    <option value="pending">To Do ({stats.pending})</option>
                    <option value="in_progress">In Progress ({stats.in_progress})</option>
                    <option value="complete">Complete ({stats.complete})</option>
                    <option value="cancelled">Cancelled ({stats.cancelled})</option>
                  </select>

                  <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value as CategoryFilter) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    title="Filter by task category (outreach tasks can be sent to the outreach queue)">
                    <option value="all">All categories</option>
                    <option value="outreach">Outreach</option>
                    <option value="internal">Internal</option>
                  </select>

                  {selectedMeetingRecordId && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-violet-500/10 text-violet-300 border border-violet-500/30">
                      <MessageSquare size={11} />
                      Scoped to one meeting
                      <button
                        onClick={() => setSelectedMeetingRecordId('')}
                        className="ml-1 text-violet-400 hover:text-white"
                        title="Clear meeting scope"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {hasActiveFilters && (
                    <button onClick={() => {
                      setSelectedMeetingDate(''); setSelectedClientProjectId(''); setSelectedLead('');
                      setSelectedMeetingRecordId(''); setTaskFilter('all'); setCategoryFilter('all')
                    }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors">
                      Clear filters
                    </button>
                  )}

                  <button onClick={() => { fetchProjects(); fetchTasks() }}
                    className="ml-auto px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600 flex items-center gap-1">
                    <RefreshCw size={12} /> Refresh
                  </button>
                </div>

                {/* ── Sticky Communication Actions Bar ── */}
                <div className="mb-4 rounded-xl border border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
                  <button onClick={() => setCommsBarExpanded(!commsBarExpanded)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={16} className={totalCommsReady > 0 ? 'text-amber-400' : 'text-gray-600'} />
                      <span className={totalCommsReady > 0 ? 'text-amber-300 font-medium' : 'text-gray-500'}>
                        {totalCommsReady > 0
                          ? `${totalCommsReady} contact${totalCommsReady !== 1 ? 's' : ''} with action items`
                          : 'No contacts with action items'}
                      </span>
                    </div>
                    {totalCommsReady > 0 && (
                      commsBarExpanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />
                    )}
                  </button>

                  <AnimatePresence>
                    {commsBarExpanded && totalCommsReady > 0 && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                          {[...tasksByContact.entries()].map(([csId, { name, tasks: contactTasks }]) => {
                            const doneCount = contactTasks.filter(t => t.status === 'complete').length
                            return (
                              <button key={csId} onClick={() => openReportModal(csId, name, contactTasks)}
                                className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-violet-500/50 text-sm transition-colors text-left">
                                <div>
                                  <span className="font-medium">{name}</span>
                                  <span className="text-gray-500 ml-2">
                                    {contactTasks.length} task{contactTasks.length !== 1 ? 's' : ''}
                                    {doneCount > 0 && <span className="text-green-400 ml-1">({doneCount} done)</span>}
                                  </span>
                                </div>
                                <FileText size={14} className="text-violet-400 shrink-0" />
                              </button>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── Sort headers ── */}
                <div className="flex items-center gap-6 px-4 py-2 mb-1 border-b border-gray-800">
                  <div className="w-5" />
                  <div className="flex-1"><SortHeader field="title" label="Task" /></div>
                  <div className="w-32 hidden md:block"><SortHeader field="meeting_date" label="Date" /></div>
                  <div className="w-24 hidden md:block"><SortHeader field="status" label="Status" /></div>
                  <div className="w-24 shrink-0" />
                </div>

                {/* ── Task list ── */}
                {sortedTasks.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <ClipboardCheck size={48} className="mx-auto mb-4 opacity-30" />
                    {hasActiveFilters ? (
                      <>
                        <p>No tasks match the current filters</p>
                        <p className="text-sm mt-1">
                          {allTasks.length > 0 ? `${allTasks.length} total — try adjusting filters` : 'No tasks have been created yet'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p>No action items yet</p>
                        <p className="text-sm mt-1">Tasks will appear here when meeting records are processed</p>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-gray-800/50 border border-gray-800 rounded-xl overflow-hidden">
                      {pagedTasks.map(task => {
                        const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending
                        const StatusIcon = cfg.icon
                        const isUpdating = updatingIds.has(task.id)
                        return (
                          <div key={task.id} className="px-4 py-3 hover:bg-gray-900/30 transition-colors">
                            <div className="flex items-start gap-3">
                              <button disabled={isUpdating}
                                onClick={() => {
                                  const next = task.status === 'pending' ? 'in_progress'
                                    : task.status === 'in_progress' ? 'complete'
                                    : task.status === 'complete' ? 'pending' : 'pending'
                                  updateTaskStatus(task.id, next)
                                }}
                                className={`mt-0.5 ${cfg.color} hover:opacity-80 transition-opacity`}
                                title={`Click to cycle status (current: ${cfg.label})`}>
                                {isUpdating ? <Loader2 size={18} className="animate-spin" /> : <StatusIcon size={18} />}
                              </button>

                              <div className="flex-1 min-w-0">
                                {(task.client_name || task.project_name || task.lead_name) && (
                                  <div className="text-xs text-gray-500 mb-0.5 flex items-center gap-2">
                                    {task.lead_name && !task.client_name && task.contact_submission_id && (
                                      <Link
                                        href={buildLinkWithReturn(`/admin/outreach?tab=leads&id=${task.contact_submission_id}`, '/admin/meeting-tasks')}
                                        className="flex items-center gap-1 text-violet-400 hover:text-violet-300"
                                      >
                                        <Link2 size={10} /> {task.lead_name}
                                      </Link>
                                    )}
                                    {task.lead_name && !task.client_name && !task.contact_submission_id && (
                                      <span className="flex items-center gap-1 text-violet-400"><Link2 size={10} /> {task.lead_name}</span>
                                    )}
                                    {(task.client_name || task.project_name) && (
                                      <span>{[task.client_name, task.project_name].filter(Boolean).join(' — ')}</span>
                                    )}
                                    {!task.contact_submission_id && task.meeting_record_id && (
                                      <button onClick={(e) => { e.stopPropagation(); setAssigningMeetingId(task.meeting_record_id); setAssignLeadValue(''); fetchLeadOptions() }}
                                        className="text-amber-400 hover:text-amber-300 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                        Assign lead
                                      </button>
                                    )}
                                    {!task.contact_submission_id && !task.meeting_record_id && (
                                      <button onClick={(e) => { e.stopPropagation(); openEditTask(task) }}
                                        className="text-amber-400 hover:text-amber-300 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20"
                                        title="This task has no parent meeting. Edit to attribute it to a contact directly.">
                                        Attribute to contact
                                      </button>
                                    )}
                                  </div>
                                )}
                                {!task.client_name && !task.project_name && !task.lead_name && !task.contact_submission_id && (
                                  <div className="text-xs mb-0.5">
                                    {task.meeting_record_id ? (
                                      <button onClick={(e) => { e.stopPropagation(); setAssigningMeetingId(task.meeting_record_id); setAssignLeadValue(''); fetchLeadOptions() }}
                                        className="text-amber-400 hover:text-amber-300 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                        Assign lead
                                      </button>
                                    ) : (
                                      <button onClick={(e) => { e.stopPropagation(); openEditTask(task) }}
                                        className="text-amber-400 hover:text-amber-300 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20"
                                        title="This task has no parent meeting. Edit to attribute it to a contact directly.">
                                        Attribute to contact
                                      </button>
                                    )}
                                  </div>
                                )}
                                <div className={`font-medium text-sm ${task.status === 'complete' ? 'line-through text-gray-500' : ''}`}>
                                  {task.title}
                                </div>
                                {task.description && <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>}
                                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide ${
                                      task.task_category === 'outreach'
                                        ? 'bg-violet-500/10 text-violet-300 border border-violet-500/30'
                                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                                    }`}
                                    title={task.task_category === 'outreach'
                                      ? 'Outreach task — eligible to be sent to the outreach queue'
                                      : 'Internal task — will not be sent to the outreach queue'}
                                  >
                                    {task.task_category}
                                  </span>
                                  {task.owner && <span className="flex items-center gap-1"><User size={11} /> {task.owner}</span>}
                                  {task.meeting_date && (
                                    <span className="flex items-center gap-1 md:hidden">
                                      <Calendar size={11} /> {new Date(task.meeting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                  {task.meeting_record_id && (
                                    <Link
                                      href={buildLinkWithReturn(`/admin/meetings/${task.meeting_record_id}`, '/admin/meeting-tasks')}
                                      className="flex items-center gap-1 text-violet-400 hover:text-violet-300"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MessageSquare size={11} /> View meeting
                                    </Link>
                                  )}
                                  {task.due_date && <span className="text-amber-600">Due {new Date(task.due_date).toLocaleDateString()}</span>}
                                </div>
                              </div>

                              <div className="w-32 hidden md:flex items-center text-xs text-gray-400 shrink-0">
                                {task.meeting_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar size={11} />
                                    {new Date(task.meeting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    {task.meeting_type && <span className="capitalize ml-1">({task.meeting_type})</span>}
                                  </span>
                                )}
                              </div>

                              <div className="w-24 hidden md:flex items-center shrink-0">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => openEditTask(task)}
                                  className="p-1.5 rounded text-gray-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                                  title="Edit task">
                                  <Edit3 size={14} />
                                </button>
                                {task.task_category === 'outreach'
                                  && task.status !== 'complete'
                                  && task.status !== 'cancelled'
                                  && task.contact_submission_id
                                  && (
                                  task.outreach_queue_id ? (
                                    <Link
                                      href={buildLinkWithReturn(
                                        `/admin/outreach?tab=leads&id=${task.contact_submission_id}`,
                                        '/admin/meeting-tasks'
                                      )}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-violet-500/10 text-violet-300 border border-violet-500/30 hover:bg-violet-500/20"
                                      title="A draft is already linked to this task. Open outreach to review or send."
                                    >
                                      <Mail size={12} /> Draft ready
                                    </Link>
                                  ) : (
                                    <button
                                      onClick={() => handleSendToOutreach(task)}
                                      disabled={sendingToOutreachId === task.id}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-violet-500/10 text-violet-300 border border-violet-500/30 hover:bg-violet-500/20 disabled:opacity-50"
                                      title="Generate an outreach draft for this task's attributed contact"
                                    >
                                      {sendingToOutreachId === task.id
                                        ? <Loader2 size={12} className="animate-spin" />
                                        : <Send size={12} />}
                                      Send to outreach
                                    </button>
                                  )
                                )}
                                {task.status !== 'complete' && (
                                  <button onClick={() => updateTaskStatus(task.id, 'complete')}
                                    className="px-2 py-1 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20">
                                    Done
                                  </button>
                                )}
                                {task.status !== 'cancelled' && task.status !== 'complete' && (
                                  <button onClick={() => updateTaskStatus(task.id, 'cancelled')}
                                    className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20">
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* ── Pagination ── */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                        <span className="text-sm text-gray-400">
                          Showing {(safePage - 1) * TASKS_PER_PAGE + 1}–{Math.min(safePage * TASKS_PER_PAGE, sortedTasks.length)} of {sortedTasks.length}
                        </span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-gray-800 border border-gray-700 hover:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            <ChevronLeft size={16} /> Prev
                          </button>
                          <span className="text-sm text-gray-400 px-2">
                            Page {safePage} of {totalPages}
                          </span>
                          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-gray-800 border border-gray-700 hover:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            Next <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ═══════════════ COMMUNICATIONS TAB ═══════════════ */}
            {activeTab === 'comms' && (
              <div>
                <div className="flex items-center gap-2 mb-6">
                  {(['all', 'client_update', 'lead_followup'] as const).map(f => (
                    <button key={f} onClick={() => setCommsTypeFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        commsTypeFilter === f
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/50'
                          : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                      }`}>
                      {f === 'all' ? 'All' : f === 'client_update' ? 'Client Updates' : 'Lead Follow-ups'}
                      <span className="ml-1.5 opacity-60">
                        {f === 'all' ? drafts.length : drafts.filter(d => d.draft_type === f).length}
                      </span>
                    </button>
                  ))}
                </div>

                {filteredDrafts.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <Mail size={48} className="mx-auto mb-4 opacity-30" />
                    <p>No communications yet</p>
                    <p className="text-sm mt-1">Generate a follow-up from the Action Items tab when tasks are completed</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredDrafts.map(draft => (
                      <motion.div key={draft.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className={`p-5 rounded-xl border ${
                          draft.status === 'sent' ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-900 border-amber-500/30'
                        }`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                draft.status === 'sent' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {draft.status === 'sent' ? 'Sent' : 'Draft'}
                              </span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                draft.draft_type === 'lead_followup' ? 'bg-violet-500/20 text-violet-400' : 'bg-gray-700 text-gray-400'
                              }`}>
                                {draft.draft_type === 'lead_followup' ? 'Lead Follow-up' : 'Client Update'}
                              </span>
                            </div>
                            <h3 className="text-lg font-semibold mt-2">{draft.subject}</h3>
                            <p className="text-sm text-gray-500 mt-1">
                              To: {draft.client_name} ({draft.client_email})
                              {draft.task_ids?.length > 0 && ` — ${draft.task_ids.length} task(s)`}
                            </p>
                          </div>
                          <span className="text-xs text-gray-600">{new Date(draft.created_at).toLocaleDateString()}</span>
                        </div>

                        {draft.body.startsWith('<') ? (
                          <div
                            className="text-sm text-gray-400 bg-gray-800/50 p-3 rounded-lg max-h-40 overflow-y-auto prose prose-invert prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_p]:mb-2 [&_p:last-child]:mb-0"
                            dangerouslySetInnerHTML={{ __html: draft.body }}
                          />
                        ) : (
                          <pre className="whitespace-pre-wrap text-sm text-gray-400 bg-gray-800/50 p-3 rounded-lg max-h-40 overflow-y-auto font-sans">
                            {draft.body}
                          </pre>
                        )}

                        {draft.status === 'draft' && (
                          <div className="flex items-center gap-2 mt-4">
                            <button onClick={() => { setEditingDraft(draft); setEditSubject(draft.subject); setEditBody(draft.body) }}
                              className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-600 flex items-center gap-1">
                              <Edit3 size={12} /> Edit
                            </button>
                            <button onClick={() => handleSendDraft(draft.id)} disabled={sendingDraftId === draft.id}
                              className="px-3 py-1.5 rounded-lg text-xs bg-violet-500/20 text-violet-300 border border-violet-500/50 hover:bg-violet-500/30 flex items-center gap-1">
                              {sendingDraftId === draft.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                              Send
                            </button>
                            <button onClick={() => handleDeleteDraft(draft.id)} disabled={deletingDraftId === draft.id}
                              className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 flex items-center gap-1">
                              {deletingDraftId === draft.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              Delete
                            </button>
                          </div>
                        )}
                        {draft.status === 'sent' && (
                          <div className="flex items-center gap-2 mt-4">
                            <button onClick={() => handleDeleteDraft(draft.id)} disabled={deletingDraftId === draft.id}
                              className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 flex items-center gap-1">
                              {deletingDraftId === draft.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              Delete
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

            {/* ═══════════════ TEMPLATES TAB ═══════════════ */}
            {activeTab === 'templates' && (
              <div>
                <p className="text-sm text-gray-400 mb-6">
                  Edit the message templates used for status report emails and Slack messages.
                  Templates use <code className="text-violet-400">{'{{token}}'}</code> placeholders that are replaced with real data at send time.
                </p>

                {templates.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FileText size={32} className="mx-auto mb-3 opacity-50" />
                    <p>No communication templates found.</p>
                    <p className="text-sm mt-1">Run the migration to seed the default template.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {templates.map(tpl => {
                      const isEditing = editingTemplate?.id === tpl.id
                      const typeLabel = tpl.update_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                      return (
                        <div key={tpl.id} className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-violet-300">{typeLabel}</span>
                              {tpl.content_type && <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">{tpl.content_type}</span>}
                              {tpl.service_type && <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">{tpl.service_type}</span>}
                              <span className={`text-xs px-2 py-0.5 rounded ${tpl.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {tpl.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                if (isEditing) {
                                  setEditingTemplate(null)
                                } else {
                                  setEditingTemplate(tpl)
                                  setTplSubject(tpl.email_subject)
                                  setTplEmailBody(tpl.email_body)
                                  setTplSlackBody(tpl.slack_body)
                                }
                              }}
                              className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
                            >
                              <Edit3 size={14} />
                              {isEditing ? 'Cancel' : 'Edit'}
                            </button>
                          </div>

                          {isEditing ? (
                            <div className="space-y-4">
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Email Subject</label>
                                <input value={tplSubject} onChange={e => setTplSubject(e.target.value)}
                                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Email Body (HTML)</label>
                                <textarea value={tplEmailBody} onChange={e => setTplEmailBody(e.target.value)} rows={10}
                                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-xs" />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Slack Body (mrkdwn)</label>
                                <textarea value={tplSlackBody} onChange={e => setTplSlackBody(e.target.value)} rows={10}
                                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-xs" />
                              </div>
                              <div className="bg-gray-800/50 rounded-lg p-3">
                                <p className="text-xs text-gray-400 mb-2 font-medium">Available tokens:</p>
                                <div className="flex flex-wrap gap-2">
                                  {['first_name', 'completed_count', 'total_count', 'estimated_completion', 'task_list_html', 'task_list_mrkdwn', 'custom_note', 'sign_off_name'].map(tok => (
                                    <code key={tok} className="text-xs bg-gray-700 text-violet-300 px-2 py-0.5 rounded">{`{{${tok}}}`}</code>
                                  ))}
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setEditingTemplate(null)}
                                  className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700 text-sm">
                                  Cancel
                                </button>
                                <button
                                  disabled={savingTemplate}
                                  onClick={async () => {
                                    setSavingTemplate(true)
                                    try {
                                      const headers = await getHeaders()
                                      const res = await fetch('/api/admin/communication-templates', {
                                        method: 'PUT',
                                        headers,
                                        body: JSON.stringify({
                                          id: tpl.id,
                                          email_subject: tplSubject,
                                          email_body: tplEmailBody,
                                          slack_body: tplSlackBody,
                                        }),
                                      })
                                      if (res.ok) {
                                        await fetchTemplates()
                                        setEditingTemplate(null)
                                      }
                                    } catch (err) {
                                      console.error('Failed to save template:', err)
                                    } finally {
                                      setSavingTemplate(false)
                                    }
                                  }}
                                  className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 text-sm flex items-center gap-2"
                                >
                                  {savingTemplate && <Loader2 size={14} className="animate-spin" />}
                                  Save Template
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Email Subject</p>
                                <p className="text-sm text-gray-300 bg-gray-800/50 rounded p-2 font-mono">{tpl.email_subject}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Tone</p>
                                <p className="text-sm text-gray-300">{tpl.tone}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Email Body (preview)</p>
                                <pre className="text-xs text-gray-400 bg-gray-800/50 rounded p-2 overflow-x-auto max-h-32 whitespace-pre-wrap">{tpl.email_body.slice(0, 300)}{tpl.email_body.length > 300 ? '...' : ''}</pre>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Slack Body (preview)</p>
                                <pre className="text-xs text-gray-400 bg-gray-800/50 rounded p-2 overflow-x-auto max-h-32 whitespace-pre-wrap">{tpl.slack_body.slice(0, 300)}{tpl.slack_body.length > 300 ? '...' : ''}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Site Settings */}
                <div className="mt-8 pt-6 border-t border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Communication Settings</h3>
                  <div className="space-y-3">
                    {siteSettings.filter(s => s.key === 'business_owner_email').map(setting => {
                      const isEditing = editingSettingKey === setting.key
                      const displayValue = typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value)
                      return (
                        <div key={setting.key} className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-200">Business Owner Email</p>
                              {setting.description && <p className="text-xs text-gray-500 mt-0.5">{setting.description}</p>}
                            </div>
                            {!isEditing && (
                              <button
                                onClick={() => { setEditingSettingKey(setting.key); setEditingSettingValue(displayValue) }}
                                className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
                              >
                                <Edit3 size={14} /> Edit
                              </button>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="mt-3 flex items-center gap-2">
                              <input value={editingSettingValue} onChange={e => setEditingSettingValue(e.target.value)}
                                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                                placeholder="email@example.com" />
                              <button onClick={() => setEditingSettingKey(null)}
                                className="px-3 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700 text-sm">
                                Cancel
                              </button>
                              <button
                                disabled={savingSetting || !editingSettingValue.trim()}
                                onClick={async () => {
                                  setSavingSetting(true)
                                  try {
                                    const headers = await getHeaders()
                                    const res = await fetch('/api/admin/site-settings', {
                                      method: 'PUT',
                                      headers,
                                      body: JSON.stringify({ key: setting.key, value: editingSettingValue.trim() }),
                                    })
                                    if (res.ok) {
                                      await fetchSiteSettings()
                                      setEditingSettingKey(null)
                                    }
                                  } catch (err) {
                                    console.error('Failed to save setting:', err)
                                  } finally {
                                    setSavingSetting(false)
                                  }
                                }}
                                className="px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 text-sm flex items-center gap-2"
                              >
                                {savingSetting && <Loader2 size={14} className="animate-spin" />}
                                Save
                              </button>
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-violet-300 font-mono">{displayValue}</p>
                          )}
                        </div>
                      )
                    })}
                    {siteSettings.filter(s => s.key === 'business_owner_email').length === 0 && (
                      <p className="text-sm text-gray-500">No communication settings found. Run the site_settings migration to configure.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════ ASSIGN LEAD MODAL ═══════════════ */}
        <AnimatePresence>
          {assigningMeetingId && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              onClick={() => setAssigningMeetingId(null)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6"
                onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Link2 size={18} className="text-violet-400" /> Assign Meeting to Lead
                </h2>
                <p className="text-sm text-gray-400 mb-4">
                  Link this meeting to a contact submission so it appears in the lead&apos;s journey.
                </p>
                <select value={assignLeadValue} onChange={e => setAssignLeadValue(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4">
                  <option value="">Select a lead...</option>
                  {leadOptions.map(l => <option key={l.id} value={String(l.id)}>{l.name}{l.email ? ` (${l.email})` : ''}</option>)}
                </select>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setAssigningMeetingId(null)} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700">Cancel</button>
                  <button onClick={handleAssignLead} disabled={!assignLeadValue || assigningInProgress}
                    className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 flex items-center gap-2">
                    {assigningInProgress && <Loader2 size={14} className="animate-spin" />}
                    Assign
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════ EDIT TASK MODAL ═══════════════ */}
        <AnimatePresence>
          {editingTask && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              onClick={() => setEditingTask(null)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg p-6"
                onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Edit3 size={18} className="text-violet-400" /> Edit Action Item
                </h2>

                <label className="block text-sm text-gray-400 mb-1">Title</label>
                <input value={editTaskTitle} onChange={e => setEditTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4" />

                <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
                <textarea value={editTaskDescription} onChange={e => setEditTaskDescription(e.target.value)} rows={2}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-4" />

                <label className="block text-sm text-gray-400 mb-1">Owner (optional)</label>
                <input value={editTaskOwner} onChange={e => setEditTaskOwner(e.target.value)}
                  placeholder="e.g. Pesh Chalise"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4" />

                <label className="block text-sm text-gray-400 mb-1">Target completion date (optional)</label>
                <input type="date" value={editTaskDueDate} onChange={e => setEditTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4" />

                <label className="block text-sm text-gray-400 mb-1">Status</label>
                <select value={editTaskStatus} onChange={e => setEditTaskStatus(e.target.value as MeetingActionTask['status'])}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4">
                  <option value="pending">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="complete">Complete</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <select value={editTaskCategory} onChange={e => setEditTaskCategory(e.target.value as TaskCategory)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-1">
                  <option value="internal">Internal (no outreach)</option>
                  <option value="outreach">Outreach (can be sent to queue)</option>
                </select>
                <p className="text-[11px] text-gray-500 mb-4">
                  Outreach tasks show a &quot;Send to outreach&quot; action and are eligible for follow-up emails.
                </p>

                <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                  <UserPlus size={12} /> Attributed contact
                </label>
                <select value={editTaskContactId} onChange={e => setEditTaskContactId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-1">
                  <option value="">Not attributed</option>
                  {leadOptions.map(l => (
                    <option key={l.id} value={String(l.id)}>
                      {l.name}{l.email ? ` (${l.email})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mb-4">
                  Overrides the meeting&apos;s cascaded attribution. Preserved when the meeting is reassigned.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setEditingTask(null)}
                    className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700">
                    Cancel
                  </button>
                  <button onClick={saveTaskEdit} disabled={savingTask || !editTaskTitle.trim()}
                    className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 flex items-center gap-2">
                    {savingTask && <Loader2 size={14} className="animate-spin" />}
                    Save
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════ EDIT DRAFT MODAL ═══════════════ */}
        <AnimatePresence>
          {editingDraft && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              onClick={() => setEditingDraft(null)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6"
                onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">Edit Draft</h2>
                <label className="block text-sm text-gray-400 mb-1">Subject</label>
                <input value={editSubject} onChange={e => setEditSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4" />
                <label className="block text-sm text-gray-400 mb-1">Body</label>
                <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={12}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm mb-4" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingDraft(null)} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700">Cancel</button>
                  <button onClick={handleSaveDraft} className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500">Save Changes</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════ GENERATE STATUS REPORT MODAL ═══════════════ */}
        <AnimatePresence>
          {reportModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              onClick={() => setReportModal(null)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6"
                onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                  <FileText size={18} className="text-violet-400" /> Generate Status Report
                </h2>
                <p className="text-sm text-gray-400 mb-4">
                  Select tasks and set target dates for <span className="text-white font-medium">{reportModal.contactName}</span>
                </p>

                {/* Select all / none */}
                <div className="flex items-center gap-3 mb-3">
                  <button onClick={() => setReportSelectedIds(new Set(reportModal.tasks.map(t => t.id)))}
                    className="text-xs text-violet-400 hover:text-violet-300">Select all</button>
                  <button onClick={() => setReportSelectedIds(new Set())}
                    className="text-xs text-gray-500 hover:text-gray-300">Select none</button>
                  <span className="text-xs text-gray-600 ml-auto">{reportSelectedIds.size} of {reportModal.tasks.length} selected</span>
                </div>

                {/* Task list with checkboxes and date inputs */}
                <div className="space-y-2 mb-4">
                  {reportModal.tasks.map(task => {
                    const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending
                    const isSelected = reportSelectedIds.has(task.id)
                    return (
                      <div key={task.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        isSelected ? 'bg-gray-800/80 border-gray-700' : 'bg-gray-900/50 border-gray-800 opacity-50'
                      }`}>
                        <input type="checkbox" checked={isSelected}
                          onChange={() => {
                            setReportSelectedIds(prev => {
                              const next = new Set(prev)
                              if (next.has(task.id)) next.delete(task.id)
                              else next.add(task.id)
                              return next
                            })
                          }}
                          className="mt-1 rounded border-gray-600 bg-gray-800 text-violet-500 focus:ring-violet-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
                            <span className="text-sm font-medium truncate">{task.title}</span>
                          </div>
                          {task.owner && <p className="text-xs text-gray-500 mt-0.5">{task.owner}</p>}
                        </div>
                        <div className="shrink-0">
                          <input type="date"
                            value={reportTargetDates[task.id] || task.due_date || ''}
                            onChange={e => setReportTargetDates(prev => ({ ...prev, [task.id]: e.target.value }))}
                            className="px-2 py-1 rounded-lg text-xs bg-gray-800 text-gray-300 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-violet-500"
                            title="Target completion date"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                  <button onClick={() => setReportModal(null)}
                    className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700">
                    Cancel
                  </button>
                  <button onClick={generateStatusReport}
                    disabled={reportSelectedIds.size === 0 || generatingDraft}
                    className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 flex items-center gap-2">
                    {generatingDraft && <Loader2 size={14} className="animate-spin" />}
                    Generate Report ({reportSelectedIds.size} task{reportSelectedIds.size !== 1 ? 's' : ''})
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
