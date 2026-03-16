'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FileText,
  PenLine,
  CreditCard,
  LayoutDashboard,
  ExternalLink,
  Copy,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Search,
  ChevronRight,
  ArrowRight,
  Download,
  Eye,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProjectSummary {
  id: string
  project_name: string
  client_name: string
  client_email: string
  project_status: string
  created_at: string
  has_proposal: boolean
  proposal_status: string | null
  has_dashboard_token: boolean
}

interface LineItem {
  content_type: string
  content_id: string
  title: string
  description?: string
  offer_role?: string
  price: number
  perceived_value?: number
}

interface ProposalData {
  id: string
  access_code: string | null
  status: string
  client_name: string
  client_email: string
  client_company?: string
  bundle_name: string
  line_items: LineItem[]
  subtotal: number
  discount_amount: number
  discount_description?: string
  total_amount: number
  terms_text?: string
  valid_until?: string
  pdf_url?: string
  contract_pdf_url?: string | null
  signed_at?: string
  signed_by_name?: string
  contract_signed_at?: string | null
  contract_signed_by_name?: string | null
  accepted_at?: string
  paid_at?: string
  stripe_checkout_session_id?: string
  stripe_payment_intent_id?: string
  created_at: string
}

interface DashboardData {
  access_token: string
  is_active: boolean
  last_accessed_at: string | null
  created_at: string
}

interface ResolvedData {
  project: {
    id: string
    project_name: string
    client_name: string
    client_email: string
    project_status: string
    created_at: string
  }
  proposal: ProposalData | null
  dashboard: DashboardData | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'proposal', label: 'Proposal', icon: FileText },
  { id: 'signing', label: 'Signing', icon: PenLine },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
] as const

type StepId = (typeof STEPS)[number]['id']

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-700 text-gray-300',
  sent: 'bg-blue-900/50 text-blue-300',
  viewed: 'bg-purple-900/50 text-purple-300',
  signed: 'bg-indigo-900/50 text-indigo-300',
  accepted: 'bg-amber-900/50 text-amber-300',
  paid: 'bg-emerald-900/50 text-emerald-300',
}

const ROLE_LABELS: Record<string, string> = {
  core_offer: 'Core',
  bonus: 'Bonus',
  upsell: 'Add-on',
  downsell: 'Alternative',
  anchor: 'Reference',
  decoy: 'Compare',
  lead_magnet: 'Free',
  continuity: 'Ongoing',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function authFetch(url: string, options?: RequestInit) {
  const session = await getCurrentSession()
  const token = session?.access_token
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ClientExperiencePage() {
  return (
    <ProtectedRoute requireAdmin>
      <ClientExperienceContent />
    </ProtectedRoute>
  )
}

function ClientExperienceContent() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [resolved, setResolved] = useState<ResolvedData | null>(null)
  const [activeStep, setActiveStep] = useState<StepId>('proposal')
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingResolve, setLoadingResolve] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Signing preview state
  const [previewSignName, setPreviewSignName] = useState('')
  const [previewContractSignName, setPreviewContractSignName] = useState('')

  // Test payment state
  const [creatingCheckout, setCreatingCheckout] = useState(false)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)

  // Clipboard state
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true)
    try {
      const res = await authFetch('/api/admin/client-experience/projects')
      if (!res.ok) throw new Error('Failed to load projects')
      const data = await res.json()
      setProjects(data.projects || [])
    } catch {
      setError('Failed to load client projects.')
    } finally {
      setLoadingProjects(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleSelectProject = useCallback(async (projectId: string) => {
    setSelectedProjectId(projectId)
    setResolved(null)
    setActiveStep('proposal')
    setCheckoutUrl(null)
    setLoadingResolve(true)
    setError(null)
    try {
      const res = await authFetch(
        `/api/admin/client-experience/${projectId}/resolve`
      )
      if (!res.ok) throw new Error('Failed to resolve project')
      const data = await res.json()
      setResolved(data)
      if (data.proposal?.client_name) {
        setPreviewSignName(data.proposal.client_name)
        setPreviewContractSignName(data.proposal.client_name)
      }
    } catch {
      setError('Failed to load project details.')
    } finally {
      setLoadingResolve(false)
    }
  }, [])

  const handleCopy = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }, [])

  const handleTestPayment = useCallback(async () => {
    if (!resolved?.proposal) return
    setCreatingCheckout(true)
    setCheckoutUrl(null)
    try {
      const res = await authFetch('/api/admin/stripe-test-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: resolved.proposal.id,
          email: resolved.proposal.client_email,
          amount: resolved.proposal.total_amount,
        }),
      })
      if (!res.ok) throw new Error('Failed to create test checkout')
      const data = await res.json()
      setCheckoutUrl(data.checkoutUrl)
    } catch {
      setError('Failed to create test checkout session.')
    } finally {
      setCreatingCheckout(false)
    }
  }, [resolved])

  const filteredProjects = projects.filter((p) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      p.client_name.toLowerCase().includes(q) ||
      p.client_email.toLowerCase().includes(q) ||
      p.project_name.toLowerCase().includes(q)
    )
  })

  const hasProposal = !!resolved?.proposal
  const hasDashboard = !!resolved?.dashboard

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Client Experience Simulator' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Client Experience Simulator
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Walk through the post-sale journey as your client sees it
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 flex items-center gap-2 text-red-300 text-sm">
          <AlertCircle size={16} />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── Project Selector ─────────────────────────────────────────── */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
          Select Client Project
        </label>
        <div className="relative mb-3">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          />
        </div>

        {loadingProjects ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-4 justify-center">
            <Loader2 size={16} className="animate-spin" />
            Loading projects...
          </div>
        ) : filteredProjects.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            {searchQuery ? 'No projects match your search.' : 'No client projects found.'}
          </p>
        ) : (
          <div className="grid gap-2 max-h-60 overflow-y-auto">
            {filteredProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectProject(p.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  selectedProjectId === p.id
                    ? 'bg-cyan-900/30 border-cyan-700/50 ring-1 ring-cyan-500/30'
                    : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-white">
                      {p.client_name}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {p.client_email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.has_proposal && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[p.proposal_status || 'draft'] || STATUS_STYLES.draft}`}>
                        {p.proposal_status || 'draft'}
                      </span>
                    )}
                    <ChevronRight size={14} className="text-gray-600" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {p.project_name}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Step Navigator + Content ─────────────────────────────────── */}
      {loadingResolve && (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
          <Loader2 size={16} className="animate-spin" />
          Loading client experience data...
        </div>
      )}

      {resolved && !loadingResolve && (
        <>
          {/* Step tabs */}
          <div className="flex gap-1 bg-gray-900/50 border border-gray-800 rounded-xl p-1">
            {STEPS.map((step, idx) => {
              const Icon = step.icon
              const isActive = activeStep === step.id
              const isDisabled =
                (step.id !== 'proposal' && !hasProposal) ||
                (step.id === 'dashboard' && !hasDashboard)

              return (
                <button
                  key={step.id}
                  onClick={() => !isDisabled && setActiveStep(step.id)}
                  disabled={isDisabled}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-cyan-900/40 text-cyan-300 border border-cyan-700/50'
                      : isDisabled
                        ? 'text-gray-600 cursor-not-allowed'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="text-xs text-gray-600 hidden sm:inline">
                    {idx + 1}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Step content */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            {activeStep === 'proposal' && (
              <ProposalStep
                proposal={resolved.proposal}
                onCopy={handleCopy}
                copiedField={copiedField}
              />
            )}
            {activeStep === 'signing' && (
              <SigningStep
                proposal={resolved.proposal}
                previewSignName={previewSignName}
                setPreviewSignName={setPreviewSignName}
                previewContractSignName={previewContractSignName}
                setPreviewContractSignName={setPreviewContractSignName}
              />
            )}
            {activeStep === 'payment' && (
              <PaymentStep
                proposal={resolved.proposal}
                creatingCheckout={creatingCheckout}
                checkoutUrl={checkoutUrl}
                onTestPayment={handleTestPayment}
              />
            )}
            {activeStep === 'dashboard' && (
              <DashboardStep
                dashboard={resolved.dashboard}
                onCopy={handleCopy}
                copiedField={copiedField}
              />
            )}
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            <a
              href={`/admin/client-projects/${resolved.project.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-xs font-medium hover:bg-gray-700 transition-colors"
            >
              <ArrowRight size={12} />
              Go to Client Project
            </a>
            {resolved.proposal?.access_code && (
              <button
                onClick={() =>
                  handleCopy(
                    `${window.location.origin}/proposal/${resolved.proposal!.access_code}`,
                    'proposal-link'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-xs font-medium hover:bg-gray-700 transition-colors"
              >
                <Copy size={12} />
                {copiedField === 'proposal-link' ? 'Copied!' : 'Copy Proposal Link'}
              </button>
            )}
            {resolved.dashboard?.access_token && (
              <button
                onClick={() =>
                  handleCopy(
                    `${window.location.origin}/client/dashboard/${resolved.dashboard!.access_token}`,
                    'dashboard-link'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-xs font-medium hover:bg-gray-700 transition-colors"
              >
                <Copy size={12} />
                {copiedField === 'dashboard-link' ? 'Copied!' : 'Copy Dashboard Link'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Step Components ─────────────────────────────────────────────────────────

function ProposalStep({
  proposal,
  onCopy,
  copiedField,
}: {
  proposal: ProposalData | null
  onCopy: (text: string, field: string) => void
  copiedField: string | null
}) {
  if (!proposal) {
    return (
      <EmptyStepMessage message="No proposal created for this project yet." />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Proposal</h3>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[proposal.status] || STATUS_STYLES.draft}`}
        >
          {proposal.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Client</span>
          <p className="text-white">{proposal.client_name}</p>
        </div>
        <div>
          <span className="text-gray-500">Bundle</span>
          <p className="text-white">{proposal.bundle_name}</p>
        </div>
        <div>
          <span className="text-gray-500">Total</span>
          <p className="text-white font-medium">
            {formatCurrency(proposal.total_amount)}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Valid Until</span>
          <p className="text-white">{formatDate(proposal.valid_until)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        {proposal.access_code && (
          <a
            href={`/proposal/${proposal.access_code}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-900/40 border border-cyan-700/50 rounded-lg text-cyan-300 text-sm font-medium hover:bg-cyan-900/60 transition-colors"
          >
            <ExternalLink size={14} />
            Open Proposal as Client
          </a>
        )}
        {proposal.pdf_url && (
          <a
            href={proposal.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            <Download size={14} />
            Proposal PDF
          </a>
        )}
        {proposal.contract_pdf_url && (
          <a
            href={proposal.contract_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            <Download size={14} />
            Contract PDF
          </a>
        )}
      </div>
    </div>
  )
}

function SigningStep({
  proposal,
  previewSignName,
  setPreviewSignName,
  previewContractSignName,
  setPreviewContractSignName,
}: {
  proposal: ProposalData | null
  previewSignName: string
  setPreviewSignName: (v: string) => void
  previewContractSignName: string
  setPreviewContractSignName: (v: string) => void
}) {
  if (!proposal) {
    return (
      <EmptyStepMessage message="No proposal created for this project yet." />
    )
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">Signing Experience</h3>

      {/* Proposal signature */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-300">
            Proposal Signature
          </h4>
          {proposal.signed_at ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle size={12} />
              Signed {formatDate(proposal.signed_at)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Clock size={12} />
              Not yet signed
            </span>
          )}
        </div>

        {proposal.signed_at ? (
          <p className="text-sm text-gray-400">
            Signed by: <span className="text-white">{proposal.signed_by_name}</span>
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Preview: This is what the client sees when signing the proposal
            </p>
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
              <label className="block text-xs text-gray-400 mb-1">
                Type your full name to sign
              </label>
              <input
                type="text"
                value={previewSignName}
                onChange={(e) => setPreviewSignName(e.target.value)}
                placeholder="Full name"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
              {previewSignName && (
                <p
                  className="mt-3 text-2xl text-white italic"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  {previewSignName}
                </p>
              )}
              <button
                disabled
                className="mt-3 px-4 py-2 bg-gray-700 text-gray-500 rounded-lg text-sm cursor-not-allowed"
              >
                <Eye size={14} className="inline mr-1.5" />
                Preview Only — Sign via Proposal Page
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contract signature */}
      {proposal.contract_pdf_url && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-300">
              Contract Signature
            </h4>
            {proposal.contract_signed_at ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle size={12} />
                Signed {formatDate(proposal.contract_signed_at)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Clock size={12} />
                Not yet signed
              </span>
            )}
          </div>

          {proposal.contract_signed_at ? (
            <p className="text-sm text-gray-400">
              Signed by:{' '}
              <span className="text-white">
                {proposal.contract_signed_by_name}
              </span>
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                Preview: This is what the client sees when signing the contract
              </p>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <label className="block text-xs text-gray-400 mb-1">
                  Type your full name to sign the contract
                </label>
                <input
                  type="text"
                  value={previewContractSignName}
                  onChange={(e) => setPreviewContractSignName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                />
                {previewContractSignName && (
                  <p
                    className="mt-3 text-2xl text-white italic"
                    style={{ fontFamily: 'Georgia, serif' }}
                  >
                    {previewContractSignName}
                  </p>
                )}
                <button
                  disabled
                  className="mt-3 px-4 py-2 bg-gray-700 text-gray-500 rounded-lg text-sm cursor-not-allowed"
                >
                  <Eye size={14} className="inline mr-1.5" />
                  Preview Only — Sign via Proposal Page
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Link to open proposal for real signing */}
      {proposal.access_code && !proposal.signed_at && (
        <div className="bg-cyan-900/20 border border-cyan-800/40 rounded-lg p-3 flex items-center justify-between">
          <p className="text-xs text-cyan-300">
            To actually sign, open the proposal page and complete the flow there.
          </p>
          <a
            href={`/proposal/${proposal.access_code}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-900/40 border border-cyan-700/50 rounded-lg text-cyan-300 text-xs font-medium hover:bg-cyan-900/60 transition-colors shrink-0 ml-3"
          >
            <ExternalLink size={12} />
            Open Proposal
          </a>
        </div>
      )}
    </div>
  )
}

function PaymentStep({
  proposal,
  creatingCheckout,
  checkoutUrl,
  onTestPayment,
}: {
  proposal: ProposalData | null
  creatingCheckout: boolean
  checkoutUrl: string | null
  onTestPayment: () => void
}) {
  if (!proposal) {
    return (
      <EmptyStepMessage message="No proposal created for this project yet." />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Payment</h3>
        {proposal.paid_at ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
            <CheckCircle size={14} />
            Paid {formatDate(proposal.paid_at)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-amber-400">
            <Clock size={14} />
            Awaiting Payment
          </span>
        )}
      </div>

      {/* Line items */}
      <div className="border border-gray-700/50 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-2">Item</th>
              <th className="text-left px-4 py-2">Role</th>
              <th className="text-right px-4 py-2">Price</th>
            </tr>
          </thead>
          <tbody>
            {proposal.line_items.map((item, idx) => (
              <tr
                key={idx}
                className="border-t border-gray-800/50 text-gray-300"
              >
                <td className="px-4 py-2.5">
                  <span className="text-white">{item.title}</span>
                  {item.description && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.description}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-xs">
                    {ROLE_LABELS[item.offer_role || ''] || item.offer_role || '—'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {formatCurrency(item.price)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-gray-700">
            {proposal.discount_amount > 0 && (
              <tr className="text-gray-400 text-sm">
                <td colSpan={2} className="px-4 py-1.5 text-right">
                  Subtotal
                </td>
                <td className="px-4 py-1.5 text-right font-mono">
                  {formatCurrency(proposal.subtotal)}
                </td>
              </tr>
            )}
            {proposal.discount_amount > 0 && (
              <tr className="text-green-400 text-sm">
                <td colSpan={2} className="px-4 py-1.5 text-right">
                  Discount
                  {proposal.discount_description && (
                    <span className="text-gray-500 ml-1">
                      ({proposal.discount_description})
                    </span>
                  )}
                </td>
                <td className="px-4 py-1.5 text-right font-mono">
                  -{formatCurrency(proposal.discount_amount)}
                </td>
              </tr>
            )}
            <tr className="text-white font-semibold text-sm">
              <td colSpan={2} className="px-4 py-2 text-right">
                Total
              </td>
              <td className="px-4 py-2 text-right font-mono">
                {formatCurrency(proposal.total_amount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Stripe reference */}
      {(proposal.stripe_checkout_session_id || proposal.stripe_payment_intent_id) && (
        <div className="text-xs text-gray-500 space-y-1">
          {proposal.stripe_checkout_session_id && (
            <p>
              Checkout Session:{' '}
              <code className="text-gray-400">
                {proposal.stripe_checkout_session_id}
              </code>
            </p>
          )}
          {proposal.stripe_payment_intent_id && (
            <p>
              Payment Intent:{' '}
              <code className="text-gray-400">
                {proposal.stripe_payment_intent_id}
              </code>
            </p>
          )}
        </div>
      )}

      {/* Test payment button */}
      {!proposal.paid_at && (
        <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-4 space-y-3">
          <p className="text-sm text-amber-300 font-medium">
            Test Payment Flow
          </p>
          <p className="text-xs text-gray-400">
            Creates a Stripe test checkout session for this proposal. Use card{' '}
            <code className="text-gray-300">4242 4242 4242 4242</code> with any
            future expiry and CVC to complete the payment.
          </p>
          {checkoutUrl ? (
            <div className="space-y-2">
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-700/50 border border-amber-600/50 rounded-lg text-amber-200 text-sm font-medium hover:bg-amber-700/70 transition-colors"
              >
                <ExternalLink size={14} />
                Open Stripe Checkout
              </a>
              <p className="text-xs text-gray-500">
                Checkout session created. Complete payment in the new tab, then
                refresh this page to see the updated status.
              </p>
            </div>
          ) : (
            <button
              onClick={onTestPayment}
              disabled={creatingCheckout}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-700/50 border border-amber-600/50 rounded-lg text-amber-200 text-sm font-medium hover:bg-amber-700/70 transition-colors disabled:opacity-50"
            >
              {creatingCheckout ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CreditCard size={14} />
                  Create Test Checkout Session
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function DashboardStep({
  dashboard,
  onCopy,
  copiedField,
}: {
  dashboard: DashboardData | null
  onCopy: (text: string, field: string) => void
  copiedField: string | null
}) {
  if (!dashboard) {
    return (
      <EmptyStepMessage message="No dashboard token generated yet. Create one from the Client Projects page." />
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Client Dashboard</h3>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Status</span>
          <p className={dashboard.is_active ? 'text-emerald-400' : 'text-red-400'}>
            {dashboard.is_active ? 'Active' : 'Inactive'}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Last Accessed</span>
          <p className="text-white">
            {formatDate(dashboard.last_accessed_at)}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Created</span>
          <p className="text-white">{formatDate(dashboard.created_at)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <a
          href={`/client/dashboard/${dashboard.access_token}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-900/40 border border-cyan-700/50 rounded-lg text-cyan-300 text-sm font-medium hover:bg-cyan-900/60 transition-colors"
        >
          <ExternalLink size={14} />
          Open Dashboard as Client
        </a>
        <button
          onClick={() =>
            onCopy(
              `${window.location.origin}/client/dashboard/${dashboard.access_token}`,
              'dash-token'
            )
          }
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          <Copy size={14} />
          {copiedField === 'dash-token' ? 'Copied!' : 'Copy Link'}
        </button>
      </div>
    </div>
  )
}

function EmptyStepMessage({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle size={32} className="text-gray-600 mb-3" />
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  )
}
