'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle,
  Circle,
  Clock,
  Calendar,
  MessageSquare,
  Target,
  Shield,
  Package,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  User,
  Building,
  Mail,
  FileText,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface SetupRequirement {
  title: string;
  description: string;
  category: string;
  is_client_action: boolean;
}

interface Milestone {
  week: number | string;
  title: string;
  description: string;
  deliverables: string[];
  phase: number;
  target_date?: string;
  status: 'pending' | 'in_progress' | 'complete' | 'skipped';
}

interface MeetingSchedule {
  type: string;
  frequency: string;
  duration_minutes: number;
  description: string;
}

interface CommunicationPlan {
  cadence: string;
  channels: string[];
  meetings: MeetingSchedule[];
  escalation_path: string;
  ad_hoc?: string;
}

interface WinCondition {
  metric: string;
  target: string;
  measurement_method: string;
  timeframe: string;
}

interface WarrantyTerms {
  duration_months: number;
  coverage_description: string;
  exclusions: string[];
  extended_support_available: boolean;
  extended_support_description: string;
}

interface ArtifactHandoff {
  artifact: string;
  format: string;
  description: string;
  delivery_method: string;
}

interface OnboardingPlan {
  id: string;
  setup_requirements: SetupRequirement[];
  milestones: Milestone[];
  communication_plan: CommunicationPlan;
  win_conditions: WinCondition[];
  warranty: WarrantyTerms;
  artifacts_handoff: ArtifactHandoff[];
  pdf_url: string | null;
  status: string;
  created_at: string;
  client_projects: {
    id: string;
    client_name: string;
    client_email: string;
    client_company: string | null;
    project_status: string;
    current_phase: number;
    product_purchased: string;
    project_start_date: string | null;
    estimated_end_date: string | null;
  } | null;
  onboarding_plan_templates: {
    id: string;
    name: string;
    content_type: string;
    service_type: string | null;
    estimated_duration_weeks: number | null;
  } | null;
}

// ============================================================================
// Section navigation
// ============================================================================

const SECTIONS = [
  { id: 'setup', label: 'Setup & Access', icon: CheckCircle, number: 1 },
  { id: 'milestones', label: 'Milestones', icon: Target, number: 2 },
  { id: 'communication', label: 'Communication', icon: MessageSquare, number: 3 },
  { id: 'win-conditions', label: 'Win Conditions', icon: Target, number: 4 },
  { id: 'warranty', label: 'Warranty', icon: Shield, number: 5 },
  { id: 'artifacts', label: 'Artifacts', icon: Package, number: 6 },
];

// ============================================================================
// Helpers
// ============================================================================

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const formatShortDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

const channelLabels: Record<string, string> = {
  slack: 'Slack',
  email: 'Email',
  video_call: 'Video Call',
  phone: 'Phone',
};

// ============================================================================
// Page component
// ============================================================================

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading your onboarding plan...</p>
          </div>
        </div>
      }
    >
      <OnboardingPageContent />
    </Suspense>
  );
}

function OnboardingPageContent() {
  const params = useParams();
  const planId = params.id as string;

  const [plan, setPlan] = useState<OnboardingPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['setup', 'milestones'])
  );

  useEffect(() => {
    fetchPlan();
  }, [planId]);

  const fetchPlan = async () => {
    try {
      const response = await fetch(`/api/onboarding-plans/${planId}`);
      if (!response.ok) throw new Error('Onboarding plan not found');
      const data = await response.json();
      setPlan(data.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plan');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your onboarding plan...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error || !plan) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Plan Not Found</h1>
          <p className="text-gray-400">{error || 'This onboarding plan could not be found.'}</p>
        </div>
      </div>
    );
  }

  const project = plan.client_projects;
  const template = plan.onboarding_plan_templates;
  const hasWarranty = plan.warranty && plan.warranty.duration_months > 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <FileText className="w-4 h-4" />
                <span>Onboarding Plan #{plan.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <h1 className="text-2xl font-bold">
                {project?.product_purchased || 'Client Onboarding Plan'}
              </h1>
              {template && (
                <p className="text-gray-400 text-sm mt-1">{template.name}</p>
              )}
            </div>
            {plan.pdf_url && (
              <a
                href={plan.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </a>
            )}
          </div>

          {/* Client Info */}
          {project && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500">Prepared For</p>
                  <p className="font-medium">{project.client_name}</p>
                </div>
              </div>
              {project.client_company && (
                <div className="flex items-center gap-3">
                  <Building className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">Company</p>
                    <p className="font-medium">{project.client_company}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500">Estimated Timeline</p>
                  <p className="font-medium">
                    {project.project_start_date
                      ? formatShortDate(project.project_start_date)
                      : 'TBD'}
                    {project.estimated_end_date && (
                      <> &ndash; {formatShortDate(project.estimated_end_date)}</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Book Onboarding Call CTA */}
        {project && (
          <div className="mb-6 p-6 rounded-xl border bg-blue-900/20 border-blue-800">
            <div className="text-center">
              <Calendar className="w-10 h-10 text-blue-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">
                Step 1: Book Your Onboarding Call
              </h3>
              <p className="text-sm text-gray-400 mb-4 max-w-md mx-auto">
                In this 30-minute call, we&apos;ll walk through this plan together,
                discuss your goals, and answer any questions before kickoff.
              </p>
              <a
                href={`https://calendly.com/amadutown/atas-onboarding-call?name=${encodeURIComponent(project.client_name)}&email=${encodeURIComponent(project.client_email)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-lg font-semibold transition-colors"
              >
                <Calendar className="w-5 h-5" />
                Book Onboarding Call
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}

        {/* Section Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => {
                setExpandedSections((prev) => new Set([...prev, section.id]));
                document
                  .getElementById(`section-${section.id}`)
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
            >
              <section.icon className="w-3.5 h-3.5" />
              {section.label}
            </button>
          ))}
        </div>

        {/* ============================================ */}
        {/* Section 1: Setup & Access Requirements      */}
        {/* ============================================ */}
        <CollapsibleSection
          id="setup"
          number={1}
          title="Initial Setup & Access Requirements"
          icon={CheckCircle}
          isExpanded={expandedSections.has('setup')}
          onToggle={() => toggleSection('setup')}
        >
          <p className="text-sm text-gray-400 mb-4">
            Complete the following items to get started. Items marked &ldquo;Client Action&rdquo; require your input.
          </p>
          <div className="space-y-3">
            {plan.setup_requirements.map((req, index) => (
              <div
                key={index}
                className="flex gap-3 p-3 bg-gray-800/50 rounded-lg"
              >
                <Circle className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{req.title}</span>
                    {req.is_client_action && (
                      <span className="px-2 py-0.5 text-xs rounded bg-blue-900/50 text-blue-300">
                        Client Action
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{req.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* ============================================ */}
        {/* Section 2: Expected Milestones              */}
        {/* ============================================ */}
        <CollapsibleSection
          id="milestones"
          number={2}
          title="Expected Milestones"
          icon={Target}
          isExpanded={expandedSections.has('milestones')}
          onToggle={() => toggleSection('milestones')}
        >
          <div className="space-y-4">
            {plan.milestones.map((milestone, index) => (
              <div
                key={index}
                className="flex gap-4 p-4 bg-gray-800/50 rounded-lg border-l-2 border-blue-500/50"
              >
                <div className="w-16 flex-shrink-0 text-center">
                  <div className="text-sm font-bold text-blue-400">
                    {typeof milestone.week === 'number'
                      ? `Wk ${milestone.week}`
                      : `Wk ${milestone.week}`}
                  </div>
                  {milestone.target_date && (
                    <div className="text-xs text-gray-500 mt-1">
                      {formatShortDate(milestone.target_date)}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{milestone.title}</h4>
                    <MilestoneStatusBadge status={milestone.status} />
                  </div>
                  <p className="text-sm text-gray-400 mb-2">
                    {milestone.description}
                  </p>
                  {milestone.deliverables && milestone.deliverables.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {milestone.deliverables.map((d, di) => (
                        <span
                          key={di}
                          className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* ============================================ */}
        {/* Section 3: Communication Plan               */}
        {/* ============================================ */}
        <CollapsibleSection
          id="communication"
          number={3}
          title="Communication Plan"
          icon={MessageSquare}
          isExpanded={expandedSections.has('communication')}
          onToggle={() => toggleSection('communication')}
        >
          {/* Meeting Schedule */}
          {plan.communication_plan.meetings &&
            plan.communication_plan.meetings.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">
                  Meeting Schedule
                </h4>
                <div className="space-y-2">
                  {plan.communication_plan.meetings.map((meeting, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 p-3 bg-gray-800/50 rounded-lg"
                    >
                      <Calendar className="w-4 h-4 text-blue-400 mt-1 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-medium">{meeting.type}</span>
                          <span className="text-xs text-gray-500">
                            {meeting.frequency} &middot;{' '}
                            {meeting.duration_minutes}min
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">
                          {meeting.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Channels & Escalation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-500 mb-2">Channels</p>
              <div className="flex flex-wrap gap-2">
                {plan.communication_plan.channels?.map((ch, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded"
                  >
                    {channelLabels[ch] || ch}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-500 mb-2">Escalation Path</p>
              <p className="text-sm">
                {plan.communication_plan.escalation_path}
              </p>
            </div>
          </div>

          {plan.communication_plan.ad_hoc && (
            <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Ad-Hoc Communication</p>
              <p className="text-sm text-gray-300">
                {plan.communication_plan.ad_hoc}
              </p>
            </div>
          )}
        </CollapsibleSection>

        {/* ============================================ */}
        {/* Section 4: Win Conditions                   */}
        {/* ============================================ */}
        <CollapsibleSection
          id="win-conditions"
          number={4}
          title="Win Conditions"
          icon={Target}
          isExpanded={expandedSections.has('win-conditions')}
          onToggle={() => toggleSection('win-conditions')}
        >
          <p className="text-sm text-gray-400 mb-4">
            Success metrics that define a successful engagement outcome.
          </p>
          <div className="space-y-3">
            {plan.win_conditions.map((wc, index) => (
              <div
                key={index}
                className="p-4 bg-gray-800/50 rounded-lg border-l-2 border-green-500/50"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-green-300">{wc.metric}</h4>
                  <span className="text-xs text-gray-500">{wc.timeframe}</span>
                </div>
                <p className="text-sm text-gray-300 mb-1">{wc.target}</p>
                <p className="text-xs text-gray-500">
                  Measured by: {wc.measurement_method}
                </p>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* ============================================ */}
        {/* Section 5: Warranty Period                  */}
        {/* ============================================ */}
        <CollapsibleSection
          id="warranty"
          number={5}
          title={hasWarranty ? 'Warranty Period' : 'Support'}
          icon={Shield}
          isExpanded={expandedSections.has('warranty')}
          onToggle={() => toggleSection('warranty')}
        >
          {hasWarranty ? (
            <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-blue-400" />
                <h4 className="text-lg font-semibold text-blue-300">
                  {plan.warranty.duration_months}-Month Warranty
                </h4>
              </div>
              <p className="text-sm text-gray-300 mb-4">
                {plan.warranty.coverage_description}
              </p>

              {plan.warranty.exclusions &&
                plan.warranty.exclusions.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 mb-2">
                      Exclusions:
                    </p>
                    <ul className="space-y-1">
                      {plan.warranty.exclusions.map((exc, i) => (
                        <li
                          key={i}
                          className="text-sm text-gray-400 flex items-center gap-2"
                        >
                          <span className="text-gray-600">&bull;</span>
                          {exc}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {plan.warranty.extended_support_available && (
                <div className="p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-xs font-semibold text-gray-400 mb-1">
                    Extended Support Available
                  </p>
                  <p className="text-sm text-gray-300">
                    {plan.warranty.extended_support_description}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              {plan.warranty.coverage_description ||
                'Support is included as part of this engagement.'}
            </p>
          )}
        </CollapsibleSection>

        {/* ============================================ */}
        {/* Section 6: Artifacts Handoff                */}
        {/* ============================================ */}
        <CollapsibleSection
          id="artifacts"
          number={6}
          title="Artifacts Handoff"
          icon={Package}
          isExpanded={expandedSections.has('artifacts')}
          onToggle={() => toggleSection('artifacts')}
        >
          <p className="text-sm text-gray-400 mb-4">
            The following deliverables will be handed off during and after the
            engagement.
          </p>
          <div className="space-y-3">
            {plan.artifacts_handoff.map((artifact, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-3 bg-gray-800/50 rounded-lg"
              >
                <Package className="w-4 h-4 text-purple-400 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{artifact.artifact}</span>
                    <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">
                      {artifact.format}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{artifact.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Delivery: {artifact.delivery_method}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm mt-8 mb-4">
          <p>
            This onboarding plan outlines a clear roadmap from initial setup to
            project delivery.
          </p>
          <p className="mt-1">Questions? Contact us at your convenience.</p>
          <p className="mt-2 text-gray-600">
            Created on {formatDate(plan.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function CollapsibleSection({
  id,
  number,
  title,
  icon: Icon,
  isExpanded,
  onToggle,
  children,
}: {
  id: string;
  number: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      id={`section-${id}`}
      className="bg-gray-900 rounded-xl border border-gray-800 mb-4 overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 flex items-center justify-center bg-blue-600 text-white text-xs font-bold rounded-full">
            {number}
          </span>
          <Icon className="w-5 h-5 text-gray-400" />
          <h2 className="font-semibold text-lg">{title}</h2>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>
      {isExpanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function MilestoneStatusBadge({
  status,
}: {
  status: 'pending' | 'in_progress' | 'complete' | 'skipped';
}) {
  const config = {
    pending: { label: 'Upcoming', color: 'bg-gray-700 text-gray-300' },
    in_progress: { label: 'In Progress', color: 'bg-yellow-900/50 text-yellow-300' },
    complete: { label: 'Complete', color: 'bg-green-900/50 text-green-300' },
    skipped: { label: 'Skipped', color: 'bg-gray-700 text-gray-500' },
  };

  const c = config[status] || config.pending;

  return (
    <span className={`px-2 py-0.5 text-xs rounded ${c.color}`}>{c.label}</span>
  );
}
