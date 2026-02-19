'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Edit,
  Trash2,
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

export default function OnboardingTemplatesPage() {
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

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
          <span className="px-3 py-1 text-sm bg-gray-800 text-gray-300 rounded-lg">
            {templates.length} template{templates.length !== 1 ? 's' : ''}
          </span>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border bg-red-900/20 border-red-800">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-red-200">{error}</p>
            </div>
          </div>
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
            <p className="text-gray-500">
              Run the seed SQL to populate initial onboarding plan templates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
