'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
  Briefcase,
  GraduationCap,
  Users,
  Mic,
  Wrench,
  Bot,
  X,
} from 'lucide-react';
import Breadcrumbs from '@/components/admin/Breadcrumbs';

// ============================================================================
// Types
// ============================================================================

interface OnboardingTemplate {
  id: string;
  name: string;
  content_type: string;
  service_type: string | null;
  offer_role: string | null;
  setup_requirements: any[];
  milestones_template: any[];
  communication_plan: any;
  win_conditions: any[];
  warranty: any;
  artifacts_handoff: any[];
  estimated_duration_weeks: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Icons by content_type/service_type
// ============================================================================

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  consulting: Briefcase,
  training: GraduationCap,
  coaching: Users,
  workshop: Wrench,
  speaking: Mic,
  product: Package,
  project: Bot,
  service: Briefcase,
};

const typeColors: Record<string, string> = {
  consulting: 'bg-blue-900/50 text-blue-300',
  training: 'bg-green-900/50 text-green-300',
  coaching: 'bg-purple-900/50 text-purple-300',
  workshop: 'bg-orange-900/50 text-orange-300',
  speaking: 'bg-pink-900/50 text-pink-300',
  product: 'bg-gray-700 text-gray-300',
  project: 'bg-indigo-900/50 text-indigo-300',
  service: 'bg-blue-900/50 text-blue-300',
};

// ============================================================================
// Page Component
// ============================================================================

const CONTENT_TYPES = ['product', 'project', 'video', 'publication', 'music', 'lead_magnet', 'prototype', 'service'] as const;
const SERVICE_TYPES = ['training', 'speaking', 'consulting', 'coaching', 'workshop', 'warranty'] as const;
const OFFER_ROLES = ['core_offer', 'bonus', 'upsell', 'downsell', 'continuity', 'lead_magnet', 'decoy', 'anchor'] as const;

export default function OnboardingTemplatesPage() {
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/admin/onboarding-templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTemplate = (id: string) => {
    setExpandedTemplate((prev) => (prev === id ? null : id));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Breadcrumbs
          items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Onboarding Templates' },
          ]}
        />
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Onboarding Plan Templates</h1>
            <p className="text-gray-400 text-sm mt-1">
              Manage templates that drive auto-generated onboarding plans for clients.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-sm bg-gray-800 text-gray-300 rounded-lg">
              {templates.length} template{templates.length !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create template
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border bg-red-900/20 border-red-800">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-red-200">{error}</p>
            </div>
          </div>
        )}

        {/* Create Template Modal */}
        {showCreateModal && (
          <CreateTemplateModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              fetchTemplates();
            }}
          />
        )}

        {/* Templates List */}
        <div className="space-y-3">
          {templates.map((template) => {
            const typeKey = template.service_type || template.content_type;
            const TypeIcon = typeIcons[typeKey] || FileText;
            const typeColor = typeColors[typeKey] || 'bg-gray-700 text-gray-300';
            const isExpanded = expandedTemplate === template.id;

            return (
              <div
                key={template.id}
                className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
              >
                {/* Template Header */}
                <button
                  onClick={() => toggleTemplate(template.id)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-gray-800/50 transition-colors text-left"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeColor}`}>
                    <TypeIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{template.name}</h3>
                      {!template.is_active && (
                        <span className="px-2 py-0.5 text-xs bg-red-900/50 text-red-300 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                      <span className={`px-2 py-0.5 text-xs rounded ${typeColor}`}>
                        {template.content_type}
                        {template.service_type && ` / ${template.service_type}`}
                      </span>
                      {template.offer_role && (
                        <span className="text-xs text-gray-500">
                          Role: {template.offer_role}
                        </span>
                      )}
                      {template.estimated_duration_weeks && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {template.estimated_duration_weeks} weeks
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-gray-500">
                    <div className="hidden md:flex items-center gap-4 text-xs">
                      <span>{template.setup_requirements.length} setup items</span>
                      <span>{template.milestones_template.length} milestones</span>
                      <span>{template.artifacts_handoff.length} artifacts</span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-gray-800 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Setup Requirements */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-400" />
                          Setup Requirements ({template.setup_requirements.length})
                        </h4>
                        <div className="space-y-2">
                          {template.setup_requirements.map((req: any, i: number) => (
                            <div key={i} className="p-2 bg-gray-800/50 rounded text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{req.title}</span>
                                {req.is_client_action && (
                                  <span className="text-xs text-blue-400">Client</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{req.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Milestones */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-green-400" />
                          Milestones ({template.milestones_template.length})
                        </h4>
                        <div className="space-y-2">
                          {template.milestones_template.map((ms: any, i: number) => (
                            <div key={i} className="p-2 bg-gray-800/50 rounded text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-blue-400 font-mono">
                                  Wk {ms.week}
                                </span>
                                <span className="font-medium">{ms.title}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {ms.deliverables?.join(', ')}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Communication Plan */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300 mb-3">
                          Communication Plan
                        </h4>
                        <div className="p-3 bg-gray-800/50 rounded text-sm space-y-2">
                          <p>
                            <span className="text-gray-500">Cadence:</span>{' '}
                            {template.communication_plan.cadence}
                          </p>
                          <p>
                            <span className="text-gray-500">Channels:</span>{' '}
                            {template.communication_plan.channels?.join(', ')}
                          </p>
                          <p>
                            <span className="text-gray-500">Meetings:</span>{' '}
                            {template.communication_plan.meetings?.length || 0} types
                          </p>
                        </div>
                      </div>

                      {/* Warranty */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300 mb-3">
                          Warranty
                        </h4>
                        <div className="p-3 bg-gray-800/50 rounded text-sm space-y-2">
                          {template.warranty.duration_months > 0 ? (
                            <>
                              <p className="font-medium text-blue-300">
                                {template.warranty.duration_months}-month warranty
                              </p>
                              <p className="text-xs text-gray-500">
                                {template.warranty.coverage_description}
                              </p>
                            </>
                          ) : (
                            <p className="text-gray-500">No warranty period</p>
                          )}
                        </div>
                      </div>

                      {/* Win Conditions */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300 mb-3">
                          Win Conditions ({template.win_conditions.length})
                        </h4>
                        <div className="space-y-1">
                          {template.win_conditions.map((wc: any, i: number) => (
                            <div key={i} className="p-2 bg-gray-800/50 rounded text-xs">
                              <span className="font-medium">{wc.metric}</span>
                              <span className="text-gray-500 ml-2">{wc.target}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Artifacts */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300 mb-3">
                          Artifacts ({template.artifacts_handoff.length})
                        </h4>
                        <div className="space-y-1">
                          {template.artifacts_handoff.map((art: any, i: number) => (
                            <div key={i} className="p-2 bg-gray-800/50 rounded text-xs">
                              <span className="font-medium">{art.artifact}</span>
                              <span className="text-gray-500 ml-2">({art.format})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Raw JSON Preview */}
                    <details className="mt-4">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                        View Raw JSON
                      </summary>
                      <pre className="mt-2 p-3 bg-gray-800 rounded text-xs text-gray-400 overflow-auto max-h-96">
                        {JSON.stringify(template, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {templates.length === 0 && !error && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 mb-2">
              No Templates Found
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Run the seed SQL to populate initial templates: in Supabase Dashboard → SQL Editor, execute{' '}
              <code className="text-gray-400 bg-gray-800 px-1 rounded">database_seed_onboarding_templates.sql</code>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Create Template Modal
// ============================================================================

function CreateTemplateModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [contentType, setContentType] = useState<string>(CONTENT_TYPES[0]);
  const [serviceType, setServiceType] = useState<string>('');
  const [offerRole, setOfferRole] = useState<string>('');
  const [estimatedWeeks, setEstimatedWeeks] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Name is required.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/onboarding-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          content_type: contentType,
          service_type: serviceType || null,
          offer_role: offerRole || null,
          estimated_duration_weeks: estimatedWeeks ? parseInt(estimatedWeeks, 10) : null,
          is_active: isActive,
          setup_requirements: [],
          milestones_template: [],
          communication_plan: {},
          win_conditions: [],
          warranty: {},
          artifacts_handoff: [],
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create template');
      }
      onSuccess();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold">Create template</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-200 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {formError}
            </div>
          )}
          <div>
            <label htmlFor="create-template-name" className="block text-sm font-medium text-gray-300 mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              id="create-template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. Consulting Engagement Onboarding"
              required
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="create-template-content-type" className="block text-sm font-medium text-gray-300 mb-1">
              Content type <span className="text-red-400">*</span>
            </label>
            <select
              id="create-template-content-type"
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {CONTENT_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="create-template-service-type" className="block text-sm font-medium text-gray-300 mb-1">
              Service type
            </label>
            <select
              id="create-template-service-type"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">— None —</option>
              {SERVICE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="create-template-offer-role" className="block text-sm font-medium text-gray-300 mb-1">
              Offer role
            </label>
            <select
              id="create-template-offer-role"
              value={offerRole}
              onChange={(e) => setOfferRole(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">— None —</option>
              {OFFER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="create-template-weeks" className="block text-sm font-medium text-gray-300 mb-1">
              Estimated duration (weeks)
            </label>
            <input
              id="create-template-weeks"
              type="number"
              min={1}
              value={estimatedWeeks}
              onChange={(e) => setEstimatedWeeks(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. 12"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="create-template-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="create-template-active" className="text-sm text-gray-300">
              Active (template is available for use)
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Setup requirements, milestones, communication plan, and other sections can be added later by editing the template (or via SQL/API).
          </p>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create template'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
