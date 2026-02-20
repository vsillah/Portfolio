'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { AnimatePresence } from 'framer-motion'
import {
  Search,
  FolderKanban,
  CheckCircle2,
  Clock,
  Truck,
  Archive,
  ArrowRight,
  Hash,
  Mail,
  Plus,
  X,
  Loader2,
  DollarSign,
  Calendar,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Link from 'next/link'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { useAuth } from '@/components/AuthProvider'
import { getCurrentSession } from '@/lib/auth'

interface ProjectSummary {
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
  created_at: string
  milestone_total: number
  milestone_completed: number
  milestone_in_progress: number
}

interface Stats {
  active: number
  testing: number
  delivering: number
  complete: number
  total: number
}

interface EligibleProposal {
  id: string
  client_name: string
  client_email: string
  client_company: string | null
  bundle_name: string
  total_amount: number
  status: string
  paid_at: string | null
  created_at: string
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  payment_received: {
    label: 'Payment Received',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/50',
  },
  onboarding_scheduled: {
    label: 'Onboarding',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/20',
    borderColor: 'border-indigo-500/50',
  },
  kickoff_scheduled: {
    label: 'Kickoff',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/20',
    borderColor: 'border-violet-500/50',
  },
  active: {
    label: 'Active',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/50',
  },
  testing: {
    label: 'Testing',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/50',
  },
  delivering: {
    label: 'Delivering',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/50',
  },
  complete: {
    label: 'Complete',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/50',
  },
  archived: {
    label: 'Archived',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/50',
  },
}

export default function ClientProjectsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <ClientProjectsContent />
    </ProtectedRoute>
  )
}

function ClientProjectsContent() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [stats, setStats] = useState<Stats>({
    active: 0,
    testing: 0,
    delivering: 0,
    complete: 0,
    total: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const fetchProjects = useCallback(async () => {
    if (!user) return
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)

      const response = await fetch(
        `/api/admin/client-projects?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
        setStats(prev => data.stats ?? prev)
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setLoading(false)
    }
  }, [user, statusFilter, search])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Client Projects' },
          ]}
        />

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Client Projects</h1>
            <p className="text-gray-400">
              Track project milestones and send progress updates
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg text-white text-sm font-medium flex items-center gap-2"
          >
            <Plus size={16} />
            Create Project
          </motion.button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<FolderKanban size={20} />}
            label="Active"
            value={stats.active}
            color="green"
          />
          <StatCard
            icon={<Clock size={20} />}
            label="Testing"
            value={stats.testing}
            color="yellow"
          />
          <StatCard
            icon={<Truck size={20} />}
            label="Delivering"
            value={stats.delivering}
            color="purple"
          />
          <StatCard
            icon={<CheckCircle2 size={20} />}
            label="Complete"
            value={stats.complete}
            color="emerald"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="text"
              placeholder="Search by client name, email, or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
          >
            <option value="all">All Statuses</option>
            <option value="payment_received">Payment Received</option>
            <option value="active">Active</option>
            <option value="testing">Testing</option>
            <option value="delivering">Delivering</option>
            <option value="complete">Complete</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Projects List */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No client projects found.
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        {/* Create Project Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <CreateProjectModal
              onClose={() => setShowCreateModal(false)}
              onSuccess={() => {
                setShowCreateModal(false)
                fetchProjects()
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const statusConfig = STATUS_CONFIG[project.project_status] || STATUS_CONFIG.active
  const milestonePercent =
    project.milestone_total > 0
      ? Math.round(
          (project.milestone_completed / project.milestone_total) * 100
        )
      : 0

  return (
    <Link href={`/admin/client-projects/${project.id}`}>
      <motion.div
        whileHover={{ scale: 1.005 }}
        className="p-5 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between">
          {/* Left: Client Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-lg font-semibold truncate">
                {project.client_name}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor} border`}
              >
                {statusConfig.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              {project.client_company && (
                <span>{project.client_company}</span>
              )}
              <span className="flex items-center gap-1">
                <Mail size={12} />
                {project.client_email}
              </span>
              {project.slack_channel && (
                <span className="flex items-center gap-1 text-blue-400">
                  <Hash size={12} />
                  {project.slack_channel}
                </span>
              )}
            </div>
            {project.product_purchased && (
              <p className="text-sm text-gray-500 mt-1">
                {project.product_purchased}
              </p>
            )}
          </div>

          {/* Right: Milestone Progress + Arrow */}
          <div className="flex items-center gap-6 ml-4">
            <div className="text-right">
              <div className="text-sm font-medium mb-1">
                {project.milestone_completed}/{project.milestone_total}{' '}
                milestones
              </div>
              <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${milestonePercent}%` }}
                />
              </div>
            </div>
            <ArrowRight size={18} className="text-gray-600" />
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

// ============================================================================
// Create Project Modal -- picks from eligible (paid) proposals
// ============================================================================

function CreateProjectModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [proposals, setProposals] = useState<EligibleProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<string | null>(null) // proposal ID being created
  const [error, setError] = useState<string | null>(null)
  const [overrideDate, setOverrideDate] = useState('')

  useEffect(() => {
    fetchEligibleProposals()
  }, [])

  const fetchEligibleProposals = async () => {
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const response = await fetch('/api/admin/proposals/eligible', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      console.log('[CreateModal] Response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('[CreateModal] Proposals received:', data)
        setProposals(data.proposals || [])
      } else {
        const errBody = await response.text()
        console.error('[CreateModal] Error response:', response.status, errBody)
        setError('Failed to fetch eligible proposals')
      }
    } catch {
      setError('Failed to load proposals')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (proposalId: string) => {
    setCreating(proposalId)
    setError(null)

    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const body: Record<string, string> = { proposal_id: proposalId }
      if (overrideDate) {
        body.override_start_date = overrideDate
      }

      const response = await fetch('/api/client-projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        onSuccess()
      } else if (response.status === 409) {
        setError('A project already exists for this proposal.')
        setCreating(null)
      } else {
        const err = await response.json()
        setError(err.error || 'Failed to create project')
        setCreating(null)
      }
    } catch {
      setError('Failed to create project')
      setCreating(null)
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
        className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Create Project from Proposal</h2>
            <p className="text-sm text-gray-400 mt-1">
              Select a paid proposal to create a project with auto-generated milestones.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Optional start date override */}
        <div className="px-6 pt-4">
          <label className="block text-xs text-gray-400 mb-1">
            Project Start Date (optional -- defaults to 1 week from now)
          </label>
          <input
            type="date"
            value={overrideDate}
            onChange={(e) => setOverrideDate(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
          />
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-400 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Loading eligible proposals...
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No eligible proposals found.</p>
              <p className="text-xs text-gray-600 mt-2">
                Only paid proposals without an existing project are shown here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map((proposal) => (
                <div
                  key={proposal.id}
                  className="p-4 bg-gray-800 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">
                        {proposal.client_name}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {proposal.client_email}
                      </p>
                      {proposal.client_company && (
                        <p className="text-xs text-gray-500">
                          {proposal.client_company}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span className="font-medium text-white">
                          {proposal.bundle_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign size={10} />
                          {proposal.total_amount.toLocaleString()}
                        </span>
                        {proposal.paid_at && (
                          <span className="flex items-center gap-1">
                            <Calendar size={10} />
                            Paid{' '}
                            {new Date(proposal.paid_at).toLocaleDateString(
                              'en-US',
                              { month: 'short', day: 'numeric' }
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleCreate(proposal.id)}
                      disabled={creating !== null}
                      className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/50 rounded-lg text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ml-3 shrink-0"
                    >
                      {creating === proposal.id ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus size={12} />
                          Create
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: 'green' | 'yellow' | 'purple' | 'emerald'
}) {
  const colorClasses = {
    green: 'bg-green-500/20 border-green-500/50',
    yellow: 'bg-yellow-500/20 border-yellow-500/50',
    purple: 'bg-purple-500/20 border-purple-500/50',
    emerald: 'bg-emerald-500/20 border-emerald-500/50',
  }

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}
