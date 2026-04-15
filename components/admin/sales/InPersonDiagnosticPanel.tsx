'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  ClipboardList, ChevronDown, ChevronUp, Save, CheckCircle,
  AlertCircle, RefreshCw, Loader2, Sparkles, FileText, Cpu,
} from 'lucide-react';
import { getCurrentSession } from '@/lib/auth';

/** True if a field value counts as "filled" for completion. */
function isFieldFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') {
    const t = value.trim();
    return t !== '' && t !== 'Not discussed';
  }
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return true;
  if (typeof value === 'boolean') return true;
  return false;
}

/** Normalize value for display in inputs (arrays from API -> comma-separated string). */
function displayValue(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(String).join(', ');
  return String(value);
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  { key: 'business_challenges', label: 'Business Challenges', description: 'Primary challenges, pain points, current impact' },
  { key: 'tech_stack', label: 'Tech Stack', description: 'Current tools, platforms, integrations' },
  { key: 'automation_needs', label: 'Automation Needs', description: 'Priority areas, desired outcomes, manual processes' },
  { key: 'ai_readiness', label: 'AI Readiness', description: 'Current AI use, concerns, data availability' },
  { key: 'budget_timeline', label: 'Budget & Timeline', description: 'Budget range, timeline, decision timeline' },
  { key: 'decision_making', label: 'Decision Making', description: 'Decision maker, stakeholders, approval process' },
] as const;

type CategoryKey = typeof CATEGORIES[number]['key'];

interface CategoryData {
  [key: string]: string | string[] | number | boolean | null | undefined;
}

/** Tech stack category: form fields (primitives) plus optional BuiltWith result object. */
interface TechStackCategoryData {
  [key: string]:
    | string
    | string[]
    | number
    | boolean
    | null
    | undefined
    | {
        domain: string;
        technologies?: Array<{ name: string; tag?: string; categories?: string[]; parent?: string }>;
        byTag?: Record<string, string[]>;
      };
  website_technologies?: {
    domain: string;
    technologies?: Array<{ name: string; tag?: string; categories?: string[]; parent?: string }>;
    byTag?: Record<string, string[]>;
  };
}

interface DiagnosticData {
  business_challenges: CategoryData;
  tech_stack: TechStackCategoryData;
  automation_needs: CategoryData;
  ai_readiness: CategoryData;
  budget_timeline: CategoryData;
  decision_making: CategoryData;
}

export interface InPersonDiagnosticPanelProps {
  sessionId: string;
  diagnosticAuditId: string | null;
  contactSubmissionId: number | null;
  clientName: string | null;
  clientCompany: string | null;
  /** Company website domain for BuiltWith tech stack fetch; when set, "Fetch tech stack" is shown in Tech Stack section. */
  companyDomain?: string | null;
  /** When true, "Fetch tech stack" is disabled (already fetched for this contact). */
  hasWebsiteTechStack?: boolean;
  onAuditCreated?: (auditId: string) => void;
  onAuditUpdated?: (data: DiagnosticData) => void;
}

/* ------------------------------------------------------------------ */
/* Prompt templates for each category                                  */
/* ------------------------------------------------------------------ */

const CATEGORY_FIELDS: Record<CategoryKey, { field: string; label: string; type: 'text' | 'textarea' | 'number' | 'select'; options?: string[] }[]> = {
  business_challenges: [
    { field: 'primary_challenges', label: 'Primary challenges (comma-separated)', type: 'textarea' },
    { field: 'pain_points', label: 'Pain points (comma-separated)', type: 'textarea' },
    { field: 'current_impact', label: 'Current business impact', type: 'textarea' },
  ],
  tech_stack: [
    { field: 'current_tools', label: 'Current tools & platforms', type: 'textarea' },
    { field: 'integrations', label: 'Existing integrations', type: 'textarea' },
    { field: 'tech_debt', label: 'Technical debt / limitations', type: 'textarea' },
  ],
  automation_needs: [
    { field: 'priority_areas', label: 'Priority areas for automation (comma-separated)', type: 'textarea' },
    { field: 'desired_outcomes', label: 'Desired outcomes (comma-separated)', type: 'textarea' },
    { field: 'manual_processes', label: 'Manual processes to eliminate', type: 'textarea' },
  ],
  ai_readiness: [
    { field: 'current_ai_use', label: 'Current AI usage', type: 'textarea' },
    { field: 'concerns', label: 'Concerns about AI (comma-separated)', type: 'textarea' },
    { field: 'data_availability', label: 'Data availability & quality', type: 'text' },
  ],
  budget_timeline: [
    { field: 'budget_range', label: 'Budget range', type: 'select', options: ['Under $5k', '$5k-$15k', '$15k-$50k', '$50k-$100k', '$100k+', 'Not discussed'] },
    { field: 'timeline', label: 'Implementation timeline', type: 'select', options: ['Immediate', '1-3 months', '3-6 months', '6-12 months', 'Not discussed'] },
    { field: 'decision_timeline', label: 'Decision timeline', type: 'select', options: ['This week', 'This month', 'This quarter', 'No rush', 'Not discussed'] },
  ],
  decision_making: [
    { field: 'decision_maker', label: 'Is this person the decision maker?', type: 'select', options: ['Yes', 'No', 'Partial', 'Unknown'] },
    { field: 'stakeholders', label: 'Other stakeholders (comma-separated)', type: 'textarea' },
    { field: 'approval_process', label: 'Approval process', type: 'textarea' },
  ],
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function InPersonDiagnosticPanel({
  sessionId,
  diagnosticAuditId,
  contactSubmissionId,
  clientName,
  clientCompany,
  companyDomain,
  hasWebsiteTechStack = false,
  onAuditCreated,
  onAuditUpdated,
}: InPersonDiagnosticPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [auditId, setAuditId] = useState<string | null>(diagnosticAuditId);
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData>({
    business_challenges: {},
    tech_stack: {},
    automation_needs: {},
    ai_readiness: {},
    budget_timeline: {},
    decision_making: {},
  });
  const [expandedCategories, setExpandedCategories] = useState<Set<CategoryKey>>(new Set(['business_challenges']));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [completionStatus, setCompletionStatus] = useState<'in_progress' | 'completed'>('in_progress');
  const [generatedInsights, setGeneratedInsights] = useState<{
    summary: string | null;
    insights: string[];
    actions: string[];
    urgency: number | null;
    opportunity: number | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auditType, setAuditType] = useState<string | null>(null);
  const [sourceMeetingIds, setSourceMeetingIds] = useState<string[]>([]);
  const [populatingFromMeetings, setPopulatingFromMeetings] = useState(false);
  const [techStackFetchLoading, setTechStackFetchLoading] = useState(false);
  const [techStackFetchError, setTechStackFetchError] = useState<string | null>(null);

  useEffect(() => {
    setAuditId(diagnosticAuditId);
  }, [diagnosticAuditId]);

  // Load existing audit data if auditId is provided
  useEffect(() => {
    if (!auditId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/chat/diagnostic?auditId=${auditId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled || !data.audit) return;
        const a = data.audit;
        setDiagnosticData({
          business_challenges: a.businessChallenges || {},
          tech_stack: a.techStack || {},
          automation_needs: a.automationNeeds || {},
          ai_readiness: a.aiReadiness || {},
          budget_timeline: a.budgetTimeline || {},
          decision_making: a.decisionMaking || {},
        });
        setCompletionStatus(a.status === 'completed' ? 'completed' : 'in_progress');
        if (a.auditType) setAuditType(a.auditType);
        if (Array.isArray(a.sourceMeetingIds) && a.sourceMeetingIds.length > 0) setSourceMeetingIds(a.sourceMeetingIds);
        if (a.diagnosticSummary || (a.keyInsights && a.keyInsights.length > 0)) {
          setGeneratedInsights({
            summary: a.diagnosticSummary,
            insights: a.keyInsights || [],
            actions: a.recommendedActions || [],
            urgency: a.urgencyScore,
            opportunity: a.opportunityScore,
          });
        }
      } catch { /* ignore */ } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [auditId]);

  // Create or update audit. Returns the audit id (current or newly created) or null on failure.
  const saveAudit = useCallback(async (complete = false): Promise<string | null> => {
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return null;
    setSaving(true);
    setError(null);

    try {
      if (!auditId) {
        // Create new audit via admin API
        const res = await fetch('/api/admin/sales/in-person-diagnostic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
          body: JSON.stringify({
            sales_session_id: sessionId,
            contact_submission_id: contactSubmissionId,
            diagnostic_data: diagnosticData,
            status: complete ? 'completed' : 'in_progress',
            business_name: clientCompany?.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to create diagnostic');
        }
        const data = await res.json();
        const newId = data.auditId ?? null;
        if (newId) {
          setAuditId(newId);
          onAuditCreated?.(newId);
        }
        if (complete) setCompletionStatus('completed');
        onAuditUpdated?.(diagnosticData);
        return newId;
      } else {
        // Update existing audit
        const res = await fetch('/api/chat/diagnostic', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auditId,
            status: complete ? 'completed' : 'in_progress',
            diagnosticData,
            businessName: clientCompany?.trim() || undefined,
          }),
        });
        if (!res.ok) throw new Error('Failed to update diagnostic');
        if (complete) setCompletionStatus('completed');
        onAuditUpdated?.(diagnosticData);
        return auditId;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      return null;
    } finally {
      setSaving(false);
    }
  }, [auditId, sessionId, contactSubmissionId, clientCompany, diagnosticData, onAuditCreated, onAuditUpdated]);

  // Generate AI insights from filled-in data
  const generateInsights = useCallback(async () => {
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return;
    setGenerating(true);
    setError(null);

    try {
      // Save current data and get the audit id (current or newly created)
      const targetAuditId = await saveAudit(false);
      if (!targetAuditId) {
        setError('Could not save the diagnostic. Please try again.');
        setGenerating(false);
        return;
      }

      const res = await fetch('/api/admin/sales/in-person-diagnostic/generate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({
          audit_id: targetAuditId,
          client_name: clientName,
          client_company: clientCompany,
          diagnostic_data: diagnosticData,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = typeof data?.error === 'string' ? data.error : 'Failed to generate insights. Please try again.';
        throw new Error(message);
      }
      setGeneratedInsights({
        summary: data.summary ?? null,
        insights: data.insights || [],
        actions: data.actions || [],
        urgency: data.urgency_score ?? null,
        opportunity: data.opportunity_score ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [diagnosticData, clientName, clientCompany, saveAudit]);

  const populateFromMeetings = useCallback(async () => {
    if (contactSubmissionId == null) return;
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return;
    setPopulatingFromMeetings(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/audit-from-meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({
          contact_submission_id: contactSubmissionId,
          sales_session_id: sessionId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = typeof data?.error === 'string' ? data.error : 'Failed to populate from meetings.';
        throw new Error(message);
      }
      const newAuditId = data.auditId;
      if (newAuditId) {
        setAuditId(newAuditId);
        onAuditCreated?.(newAuditId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to populate from meetings.');
    } finally {
      setPopulatingFromMeetings(false);
    }
  }, [contactSubmissionId, sessionId, onAuditCreated]);

  const updateField = (category: CategoryKey, field: string, value: string) => {
    setDiagnosticData(prev => ({
      ...prev,
      [category]: { ...prev[category], [field]: value },
    }));
  };

  const toggleCategory = (key: CategoryKey) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const totalFields = CATEGORIES.reduce((sum, c) => sum + CATEGORY_FIELDS[c.key].length, 0);
  const filledFields = CATEGORIES.reduce((count, c) => {
    const catData = diagnosticData[c.key];
    return count + CATEGORY_FIELDS[c.key].filter(f => isFieldFilled(catData[f.field])).length;
  }, 0);
  const filledCategoriesCount = CATEGORIES.filter(c =>
    CATEGORY_FIELDS[c.key].some(f => isFieldFilled(diagnosticData[c.key][f.field]))
  ).length;
  const completionPct = totalFields === 0 ? 0 : Math.round((filledFields / totalFields) * 100);
  const completionLabel =
    filledFields === 0 ? 'Not started' : filledFields === totalFields ? 'Completed' : 'Partially complete';

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-orange-500" />
          <div className="text-left">
            <h3 className="font-medium text-white">In-Person Diagnostic</h3>
            <p className="text-xs text-gray-400">
              {completionLabel} — {completionPct}% ({filledFields}/{totalFields} fields)
              {auditId && <span className="ml-2 text-green-500">Saved</span>}
            </p>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-800 p-4 space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-6 h-6 text-gray-500 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-400">Loading diagnostic data...</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-500/20 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}

              {/* Populate from meeting transcripts (when this contact has meetings) */}
              {contactSubmissionId != null && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={populateFromMeetings}
                    disabled={populatingFromMeetings || loading || saving}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {populatingFromMeetings ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 text-orange-500" />
                    )}
                    Populate from meetings
                  </button>
                  <span className="text-xs text-gray-500">
                    Fills the sections below from this contact&apos;s meeting transcripts. Then use Generate Insights to refine.
                  </span>
                </div>
              )}

              {/* Category sections */}
              {CATEGORIES.map(cat => {
                const isOpen = expandedCategories.has(cat.key);
                const catData = diagnosticData[cat.key];
                const isFilled = CATEGORY_FIELDS[cat.key].some(f => isFieldFilled(catData[f.field]));
                return (
                  <div key={cat.key} className="border border-gray-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleCategory(cat.key)}
                      className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isFilled ? <CheckCircle className="w-4 h-4 text-green-500" /> : <div className="w-4 h-4 rounded-full border border-gray-600" />}
                        <span className="font-medium text-sm text-white">{cat.label}</span>
                        <span className="text-xs text-gray-500">{cat.description}</span>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </button>
                    {isOpen && (
                      <div className="p-3 space-y-3">
                        {/* Fetch tech stack (BuiltWith) — only when contact has company domain; disabled if already fetched */}
                        {cat.key === 'tech_stack' && companyDomain?.trim() && contactSubmissionId != null && (
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={
                                  techStackFetchLoading ||
                                  hasWebsiteTechStack ||
                                  !!((diagnosticData.tech_stack as Record<string, unknown>)?.website_technologies as { domain?: string } | undefined)?.domain
                                }
                                onClick={async () => {
                                  const session = await getCurrentSession();
                                  if (!session?.access_token || !contactSubmissionId) return;
                                  setTechStackFetchError(null);
                                  setTechStackFetchLoading(true);
                                  try {
                                    const res = await fetch(
                                      `/api/admin/tech-stack-lookup?domain=${encodeURIComponent(companyDomain.trim())}`,
                                      { headers: { Authorization: `Bearer ${session.access_token}` } }
                                    );
                                    const data = await res.json();
                                    if (!res.ok) {
                                      const message = typeof data?.error === 'string' ? data.error : 'Tech stack lookup failed';
                                      setTechStackFetchError(message);
                                      setError(message);
                                      return;
                                    }
                                    const payload = {
                                      domain: data.domain,
                                      technologies: data.technologies,
                                      byTag: data.byTag,
                                    };
                                    await fetch(`/api/admin/outreach/leads/${contactSubmissionId}`, {
                                      method: 'PATCH',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${session.access_token}`,
                                      },
                                      body: JSON.stringify({
                                        website_tech_stack: payload,
                                        website_tech_stack_fetched_at: new Date().toISOString(),
                                      }),
                                    });
                                    setDiagnosticData((prev) => ({
                                      ...prev,
                                      tech_stack: { ...prev.tech_stack, website_technologies: payload },
                                    }));
                                    onAuditUpdated?.({ ...diagnosticData, tech_stack: { ...diagnosticData.tech_stack, website_technologies: payload } });
                                    if (auditId) {
                                      saveAudit(false).catch(() => {});
                                    }
                                  } catch {
                                    const message = 'Request failed. Add BUILTWITH_API_KEY to .env.local to enable tech stack lookup.';
                                    setTechStackFetchError(message);
                                    setError(message);
                                  } finally {
                                    setTechStackFetchLoading(false);
                                  }
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {techStackFetchLoading ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Cpu className="w-4 h-4 text-orange-500" />
                                )}
                                {techStackFetchLoading ? 'Loading…' : hasWebsiteTechStack || (diagnosticData.tech_stack as Record<string, unknown>)?.website_technologies ? 'Tech stack loaded' : 'Fetch tech stack from website'}
                              </button>
                            </div>
                            {techStackFetchError && (
                              <div className="bg-red-500/20 text-red-400 p-2 rounded-lg text-xs flex items-center gap-2">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                {techStackFetchError}
                              </div>
                            )}
                          </div>
                        )}
                        {CATEGORY_FIELDS[cat.key].map(f => (
                          <div key={f.field}>
                            <label className="block text-xs font-medium text-gray-400 mb-1">{f.label}</label>
                            {f.type === 'textarea' ? (
                              <textarea
                                value={displayValue(catData[f.field])}
                                onChange={e => updateField(cat.key, f.field, e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-orange-500/50"
                                placeholder={`Enter ${f.label.toLowerCase()}...`}
                              />
                            ) : f.type === 'select' ? (
                              <select
                                value={displayValue(catData[f.field])}
                                onChange={e => updateField(cat.key, f.field, e.target.value)}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500/50"
                              >
                                <option value="">Select...</option>
                                {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <input
                                type={f.type}
                                value={displayValue(catData[f.field])}
                                onChange={e => updateField(cat.key, f.field, e.target.value)}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
                                placeholder={`Enter ${f.label.toLowerCase()}...`}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Traceability: link to source meeting transcripts */}
              {auditType === 'from_meetings' && sourceMeetingIds.length > 0 && (
                <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-3 flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-300 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-orange-500" />
                    Built from {sourceMeetingIds.length} meeting transcript{sourceMeetingIds.length !== 1 ? 's' : ''}
                  </span>
                  <Link
                    href={contactSubmissionId != null ? `/admin/meetings?contact_submission_id=${contactSubmissionId}` : '/admin/meetings'}
                    className="text-sm font-medium text-orange-500 hover:text-orange-400 transition-colors"
                  >
                    View source transcripts →
                  </Link>
                </div>
              )}

              {/* Generated insights */}
              {generatedInsights && (
                <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 space-y-3">
                  <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-500" /> AI-Generated Insights
                  </h4>
                  {generatedInsights.summary && (
                    <p className="text-sm text-gray-300">{generatedInsights.summary}</p>
                  )}
                  {generatedInsights.insights.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-gray-400">Key Insights:</span>
                      <ul className="mt-1 space-y-1">
                        {generatedInsights.insights.map((ins, i) => (
                          <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                            <span className="text-yellow-500 mt-0.5">•</span> {ins}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {generatedInsights.actions.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-gray-400">Recommended Actions:</span>
                      <ul className="mt-1 space-y-1">
                        {generatedInsights.actions.map((act, i) => (
                          <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">•</span> {act}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {generatedInsights.urgency != null && generatedInsights.opportunity != null && (
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-400">Urgency: <span className="font-bold text-white">{generatedInsights.urgency}/10</span></span>
                      <span className="text-gray-400">Opportunity: <span className="font-bold text-white">{generatedInsights.opportunity}/10</span></span>
                    </div>
                  )}
                  {!generatedInsights.summary && generatedInsights.insights.length === 0 && generatedInsights.actions.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No insights were generated. Add more detail to the sections above and click Generate Insights again.</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => saveAudit(false)}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Progress
                  </button>
                  <button
                    onClick={generateInsights}
                    disabled={generating || filledCategoriesCount < 2}
                    className="flex items-center gap-1 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title={filledCategoriesCount < 2 ? 'Fill in at least 2 sections to generate insights' : undefined}
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate Insights
                  </button>
                  <button
                    onClick={() => saveAudit(true)}
                    disabled={saving || filledCategoriesCount < 3}
                    className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title={filledCategoriesCount < 3 ? 'Fill in at least 3 sections to mark complete' : undefined}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark Complete
                  </button>
                </div>
                {(filledCategoriesCount < 2 || filledCategoriesCount < 3) && (
                  <p className="text-xs text-gray-500">
                    {filledCategoriesCount < 2 && 'Fill in at least 2 sections to enable Generate Insights (or use Populate from meetings to fill from transcripts). '}
                    {filledCategoriesCount < 3 && 'Fill in at least 3 sections to enable Mark Complete.'}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
