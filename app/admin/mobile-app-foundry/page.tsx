import Link from 'next/link'
import {
  Bot,
  Clock3,
  ExternalLink,
  GitBranch,
  ShieldCheck,
  Smartphone,
  TrendingUp,
} from 'lucide-react'
import {
  MOBILE_APP_FOUNDRY_VIDEO,
  mobileFoundryAgents,
  mobileFoundryGates,
  mobileFoundryPatterns,
  mobileFoundryScoreFactors,
} from '@/lib/mobile-app-foundry'
import { MOBILE_FOUNDRY_WORK_ITEMS_CONFIRMATION } from '@/lib/mobile-app-foundry-work-items'
import OperatingMatrix, { type MobileFoundryOperationRow } from './OperatingMatrix'
import PacketPreviewWorkspace from './PacketPreviewWorkspace'

export const metadata = {
  title: 'Mobile App Foundry | Admin',
}

const operationRows: MobileFoundryOperationRow[] = [
  {
    phase: '2',
    title: 'Rank backlog',
    owner: 'Amina',
    mode: 'Read-only',
    summary: 'Generate scored app opportunities from source packets, market evidence, and private builder-fit summaries.',
    command: 'npm run --silent mobile-foundry:analyze -- --input local-private/mobile-foundry/source-packet.json',
    endpoint: null,
    status: 'Ready to run',
    statusTone: 'ready',
    statusDetail: 'Read-only analyst output. Every backlog record stays review_required until routed.',
    gateHref: '/admin/agents/runs?kind=mobile_app_foundry',
    gateLabel: 'View Foundry traces',
    authorization: 'No approval required to generate the artifact. Approval starts when a record is selected for work-item routing.',
    gate: 'No work items, repos, accounts, tester outreach, store submissions, or pricing changes.',
  },
  {
    phase: '3',
    title: 'Propose work item',
    owner: 'Shaka + Piye',
    mode: 'Approval-gated',
    summary: 'Convert a selected backlog record into one proposed Agent Ops work item after explicit confirmation.',
    command: null,
    endpoint: 'POST /api/admin/mobile-app-foundry/work-items',
    status: 'Approval required',
    statusTone: 'pending',
    statusDetail: 'This is the first mutating step. It can only create a proposed Agent Ops work item after confirmation.',
    gateHref: '/admin/agents/coordination',
    gateLabel: 'Open Decision Queue',
    authorization: 'Authorize from Decision Queue or the linked run detail after reviewing the proposal, evidence, risk, and owner.',
    gate: `Confirmation required: ${MOBILE_FOUNDRY_WORK_ITEMS_CONFIRMATION}`,
  },
  {
    phase: '4',
    title: 'Prepare prototype packet',
    owner: 'Imhotep',
    mode: 'Read-only',
    summary: 'Create a builder handoff with MVP scope, proposed repo slug, suggested branch, smoke tests, and demo evidence.',
    command: 'npm run --silent mobile-foundry:prototype-packet -- --input local-private/mobile-foundry/backlog-record.json --format markdown',
    endpoint: 'POST /api/admin/mobile-app-foundry/prototype-packet',
    status: 'Evidence packet',
    statusTone: 'ready',
    statusDetail: 'Read-only packet. Repo creation and prototype build authority stay in Agent Ops.',
    gateHref: '/admin/agents/runs?status=waiting_for_approval',
    gateLabel: 'Pending approvals',
    authorization: 'If the packet asks for repo creation, paid APIs, or a build sprint, approve that request on the Agent Ops run detail.',
    gate: 'Repo creation, paid APIs, tester outreach, and store credentials remain separate approvals.',
  },
  {
    phase: '5',
    title: 'Prepare commercialization packet',
    owner: 'Kandake',
    mode: 'Read-only',
    summary: 'Create tester, pricing, privacy, store-readiness, and public-launch review material after prototype validation.',
    command: 'npm run --silent mobile-foundry:commercialization-packet -- --input local-private/mobile-foundry/prototype-validation.json --format markdown',
    endpoint: 'POST /api/admin/mobile-app-foundry/commercialization-packet',
    status: 'Commercial gate',
    statusTone: 'review',
    statusDetail: 'Review-only until a human approves testers, pricing, store work, claims, or outbound activity.',
    gateHref: '/admin/agents/runs?status=waiting_for_approval',
    gateLabel: 'Pending approvals',
    authorization: 'Approve or reject tester, pricing, store, payment, data, or public-claim requests only from the linked run approval card.',
    gate: 'No tester invites, tester lists, data collection, store submissions, pricing, payment products, claims, or outbound sends.',
  },
]

const agentOpsRoutes = [
  { label: 'Mission Control', href: '/admin/agents', description: 'System status and attention queue' },
  { label: 'Decision Queue', href: '/admin/agents/coordination', description: 'Human approval and controller packets' },
  { label: 'Agent Kanban', href: '/admin/agents/swarm-board', description: 'Central work-item board' },
  { label: 'Standup Room', href: '/admin/agents/standup', description: 'Daily routing and unblock context' },
  { label: 'Run Console', href: '/admin/agents/runs', description: 'Trace and execution evidence' },
]

export default function AdminMobileAppFoundryPage() {
  return (
    <div className="agent-ops-page min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="agent-ops-surface-header rounded-xl border p-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <p className="agent-ops-eyebrow">
                <Smartphone size={16} /> Mobile App Foundry
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Private operating layer for Mobile App Generation
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                Keep the client-facing offer under Services. Use this console to rank opportunities, create approved
                Agent Ops work items, and prepare prototype or commercialization packets without exposing sources,
                private repo inventory, tester data, store evidence, or unapproved app ideas.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:w-52 lg:grid-cols-1">
              <Link
                href={MOBILE_APP_FOUNDRY_VIDEO.url}
                target="_blank"
                rel="noopener noreferrer"
                className="agent-ops-button-primary inline-flex items-center justify-center gap-2 px-3 py-2 text-sm"
              >
                Source video
                <ExternalLink size={15} />
              </Link>
              <Link
                href="/services"
                className="agent-ops-button-muted inline-flex items-center justify-center gap-2 px-3 py-2 text-sm"
              >
                Service catalog
                <ExternalLink size={15} />
              </Link>
            </div>
          </div>
        </section>

        <section className="agent-ops-card mt-5 rounded-xl border p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-radiant-gold" size={19} />
                <h2 className="text-lg font-semibold text-foreground">Central Agent Ops Routing</h2>
              </div>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
                Mobile Foundry prepares research, proposed work items, and packets. Backlog state, standup context,
                Kanban lanes, run traces, and approvals stay in the existing Agent Ops system.
              </p>
            </div>
            <span className="w-fit rounded-full border border-radiant-gold/20 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-radiant-gold">
              No parallel board
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {agentOpsRoutes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className="rounded-lg border border-radiant-gold/10 bg-background/35 p-3 transition-colors hover:border-radiant-gold/30 hover:bg-radiant-gold/5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">{route.label}</h3>
                  <ExternalLink className="h-3.5 w-3.5 text-radiant-gold" />
                </div>
                <p className="mt-1 hidden text-xs leading-5 text-muted-foreground sm:block">{route.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="agent-ops-card mt-5 rounded-xl border p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Clock3 className="text-radiant-gold" size={19} />
                <h2 className="text-lg font-semibold text-foreground">Approval & Status</h2>
              </div>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
                Foundry status is summarized here. Real approval decisions live in Agent Ops so the evidence, run trace,
                and approve/reject buttons stay attached to the same packet.
              </p>
            </div>
            <Link
              href="/admin/agents/runs?status=waiting_for_approval"
              className="agent-ops-button-primary inline-flex w-fit items-center gap-2 px-3 py-2 text-sm"
            >
              Pending approvals
              <ExternalLink size={15} />
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <StatusSummaryCard
              label="Approval home"
              value="Decision Queue"
              detail="Use this when a Foundry item needs a controller decision."
              href="/admin/agents/coordination"
            />
            <StatusSummaryCard
              label="Authorize here"
              value="Run detail"
              detail="Open the waiting approval trace and use its approval card."
              href="/admin/agents/runs?status=waiting_for_approval"
            />
            <StatusSummaryCard
              label="Work state"
              value="Agent Kanban"
              detail="Once approved, the work item belongs on the central board."
              href="/admin/agents/swarm-board"
            />
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="agent-ops-card rounded-xl border p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Bot className="text-radiant-gold" size={19} />
                <h2 className="text-lg font-semibold text-foreground">Agents & Gates</h2>
              </div>
              <span className="rounded-full border border-radiant-gold/20 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-radiant-gold">
                Private
              </span>
            </div>

            <div className="divide-y divide-radiant-gold/10">
              {mobileFoundryAgents.map((agent) => (
                <article key={agent.name} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-radiant-gold/20 bg-radiant-gold/10 text-radiant-gold">
                      <Bot size={15} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-radiant-gold/80">{agent.role}</p>
                      </div>
                      <p className="mt-1 hidden text-xs leading-5 text-muted-foreground sm:block">{agent.mandate}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-radiant-gold/10 bg-background/35 p-4">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="text-radiant-gold" size={17} />
                <h3 className="text-sm font-semibold text-foreground">Human gates</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {mobileFoundryGates.map((gate) => (
                  <div key={gate.stage}>
                    <p className="font-heading text-[10px] uppercase tracking-[0.16em] text-radiant-gold">
                      {gate.owner}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{gate.stage}</p>
                    <p className="mt-1 hidden text-xs leading-5 text-muted-foreground sm:block">
                      {gate.exitCriteria.join(' / ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-5">
            <section className="agent-ops-card rounded-xl border p-5">
              <div className="mb-4 flex items-center gap-3">
                <TrendingUp className="text-radiant-gold" size={19} />
                <h2 className="text-lg font-semibold text-foreground">Score Contract</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mobileFoundryScoreFactors.map((factor) => (
                  <article key={factor.label} className="rounded-lg border border-radiant-gold/10 bg-background/35 p-3">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-foreground">{factor.label}</h3>
                      <span className="font-heading text-xs text-radiant-gold">{factor.weight}%</span>
                    </div>
                    <p className="hidden text-xs leading-5 text-muted-foreground sm:line-clamp-2">{factor.evidence.join(' / ')}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="agent-ops-card rounded-xl border p-5">
              <div className="mb-4 flex items-center gap-3">
                <GitBranch className="text-radiant-gold" size={19} />
                <h2 className="text-lg font-semibold text-foreground">Builder Fit Signals</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {mobileFoundryPatterns.map((pattern) => (
                  <article key={pattern.label} className="rounded-lg border border-radiant-gold/10 bg-background/35 p-3">
                    <h3 className="text-sm font-semibold text-foreground">{pattern.label}</h3>
                    <p className="mt-1 hidden text-xs leading-5 text-muted-foreground sm:block">{pattern.signal}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>

        <PacketPreviewWorkspace />

        <OperatingMatrix rows={operationRows} />
      </div>
    </div>
  )
}

function StatusSummaryCard({
  label,
  value,
  detail,
  href,
}: {
  label: string
  value: string
  detail: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-radiant-gold/10 bg-background/35 p-3 transition-colors hover:border-radiant-gold/30 hover:bg-radiant-gold/5"
    >
      <p className="font-heading text-[10px] uppercase tracking-[0.16em] text-radiant-gold">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{value}</h3>
        <ExternalLink className="h-3.5 w-3.5 text-radiant-gold" />
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </Link>
  )
}
