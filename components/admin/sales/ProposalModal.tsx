'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { FileText, XCircle, Loader2, AlertTriangle, CheckSquare, Square, ChevronDown, ChevronUp, Sparkles, Trash2, ExternalLink } from 'lucide-react';
import { getCurrentSession } from '@/lib/auth';
import { formatCurrency } from '@/lib/pricing-model';
import type { AIOnboardingContent } from '@/lib/ai-onboarding-generator';

const MARGIN_ALERT_THRESHOLD = typeof process.env.NEXT_PUBLIC_MARGIN_ALERT_THRESHOLD_PERCENT === 'string'
  ? parseFloat(process.env.NEXT_PUBLIC_MARGIN_ALERT_THRESHOLD_PERCENT) || 20
  : 20;

interface GammaReport {
  id: string;
  title: string | null;
  report_type: string;
  pdf_url: string | null;
  status: string;
  created_at: string;
}

export interface ProposalModalProps {
  onClose: () => void;
  onGenerate: (data: {
    clientName: string;
    clientEmail: string;
    clientCompany?: string;
    discountAmount?: number;
    discountDescription?: string;
    validDays: number;
    valueReportId?: string;
    includeContract: boolean;
    includeOnboardingPreview: boolean;
    onboardingContent?: AIOnboardingContent;
    attachedReportIds: string[];
    serviceTermMonths?: number;
  }) => Promise<void>;
  defaultClientName: string;
  defaultClientEmail: string;
  defaultClientCompany: string;
  totalAmount: number;
  contactId: number | null;
  defaultValueReportId: string | null;
  blendedMarginPercent?: number | null;
  blendedMarginDollar?: number | null;
  contactSubmissionId?: number | null;
  diagnosticAuditId?: number | null;
  lineItems?: Array<{
    title: string;
    description?: string;
    content_type: string;
    offer_role?: string;
    price: number;
  }>;
  bundleName?: string;
  defaultServiceTermMonths?: number | null;
  /** Slide-in panel from the right (e.g. conversation page) vs centered modal */
  presentation?: 'modal' | 'drawer';
  /** Shown above the generate form (e.g. existing proposal link, documents, email draft) */
  reviewSection?: ReactNode;
  /** Header title when not using default "Generate Proposal" */
  heading?: string;
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  value_quantification: 'Value Report',
  implementation_strategy: 'Strategy',
  audit_summary: 'Audit',
  prospect_overview: 'Overview',
};

export function ProposalModal({
  onClose,
  onGenerate,
  defaultClientName,
  defaultClientEmail,
  defaultClientCompany,
  totalAmount,
  contactId,
  defaultValueReportId,
  blendedMarginPercent,
  blendedMarginDollar,
  contactSubmissionId,
  diagnosticAuditId,
  lineItems,
  bundleName,
  defaultServiceTermMonths,
  presentation = 'modal',
  reviewSection,
  heading,
}: ProposalModalProps) {
  const [clientName, setClientName] = useState(defaultClientName);
  const [clientEmail, setClientEmail] = useState(defaultClientEmail);
  const [clientCompany, setClientCompany] = useState(defaultClientCompany);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountDescription, setDiscountDescription] = useState('');
  const [validDays, setValidDays] = useState(30);
  const [serviceTermMonths, setServiceTermMonths] = useState<number | ''>(defaultServiceTermMonths ?? '');
  const [valueReportId, setValueReportId] = useState<string | null>(defaultValueReportId);
  const [reports, setReports] = useState<Array<{ id: string; title: string | null; total_annual_value: number | null; created_at: string }>>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Document Package state
  const [includeContract, setIncludeContract] = useState(true);
  const [includeOnboarding, setIncludeOnboarding] = useState(false);
  const [onboardingContent, setOnboardingContent] = useState<AIOnboardingContent | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingExpanded, setOnboardingExpanded] = useState(false);
  const [gammaReports, setGammaReports] = useState<GammaReport[]>([]);
  const [gammaReportsLoading, setGammaReportsLoading] = useState(false);
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set());

  // Fetch value reports
  useEffect(() => {
    if (!contactId) {
      setReports([]);
      setValueReportId(defaultValueReportId);
      return;
    }
    let cancelled = false;
    setReportsLoading(true);
    getCurrentSession().then((session) => {
      if (!session?.access_token || cancelled) return;
      fetch(`/api/admin/value-evidence/reports?contact_id=${contactId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          const list = data.reports || [];
          setReports(list);
          setValueReportId((prev) => prev || defaultValueReportId || list[0]?.id || null);
        })
        .finally(() => {
          if (!cancelled) setReportsLoading(false);
        });
    });
    return () => { cancelled = true; };
  }, [contactId, defaultValueReportId]);

  useEffect(() => {
    if (defaultValueReportId) setValueReportId(defaultValueReportId);
  }, [defaultValueReportId]);

  // Fetch gamma reports for this contact
  useEffect(() => {
    if (!contactSubmissionId) return;
    let cancelled = false;
    setGammaReportsLoading(true);
    getCurrentSession().then((session) => {
      if (!session?.access_token || cancelled) return;
      fetch(`/api/admin/gamma-reports?contactId=${contactSubmissionId}&status=completed`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          const list = (data.reports || []).filter((r: GammaReport) => r.pdf_url);
          setGammaReports(list);
        })
        .finally(() => {
          if (!cancelled) setGammaReportsLoading(false);
        });
    });
    return () => { cancelled = true; };
  }, [contactSubmissionId]);

  const generateOnboardingPreview = useCallback(async () => {
    if (!lineItems || lineItems.length === 0) return;
    setOnboardingLoading(true);
    try {
      const session = await getCurrentSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/admin/proposals/generate-onboarding-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          line_items: lineItems,
          client_name: clientName,
          client_company: clientCompany,
          bundle_name: bundleName,
          contact_submission_id: contactSubmissionId,
          diagnostic_audit_id: diagnosticAuditId,
          value_report_id: valueReportId,
          gamma_report_id: selectedReportIds.size > 0 ? Array.from(selectedReportIds)[0] : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOnboardingContent(data.content);
        setOnboardingExpanded(true);
      }
    } catch (err) {
      console.error('Failed to generate onboarding preview:', err);
    } finally {
      setOnboardingLoading(false);
    }
  }, [lineItems, clientName, clientCompany, bundleName, contactSubmissionId, diagnosticAuditId, valueReportId, selectedReportIds]);

  useEffect(() => {
    if (includeOnboarding && !onboardingContent && !onboardingLoading) {
      generateOnboardingPreview();
    }
  }, [includeOnboarding, onboardingContent, onboardingLoading, generateOnboardingPreview]);

  const toggleReportSelection = (id: string) => {
    setSelectedReportIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeSetupRequirement = (index: number) => {
    if (!onboardingContent) return;
    setOnboardingContent({
      ...onboardingContent,
      setup_requirements: onboardingContent.setup_requirements.filter((_, i) => i !== index),
    });
  };

  const updateSetupRequirement = (index: number, field: 'title' | 'description', value: string) => {
    if (!onboardingContent) return;
    const updated = [...onboardingContent.setup_requirements];
    updated[index] = { ...updated[index], [field]: value };
    setOnboardingContent({ ...onboardingContent, setup_requirements: updated });
  };

  const handleGenerate = async () => {
    if (!clientName.trim() || !clientEmail.trim()) {
      setError('Client name and email are required');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      await onGenerate({
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        clientCompany: clientCompany.trim() || undefined,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        discountDescription: discountDescription.trim() || undefined,
        validDays,
        valueReportId: valueReportId || undefined,
        includeContract,
        includeOnboardingPreview: includeOnboarding,
        onboardingContent: includeOnboarding && onboardingContent ? onboardingContent : undefined,
        attachedReportIds: Array.from(selectedReportIds),
        serviceTermMonths: serviceTermMonths ? Number(serviceTermMonths) : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate proposal');
    } finally {
      setIsGenerating(false);
    }
  };

  const finalAmount = totalAmount - (discountAmount || 0);

  const headerTitle = heading ?? 'Generate Proposal';

  const header = (
    <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <FileText className="w-5 h-5 text-blue-400" />
        {headerTitle}
      </h3>
      <button type="button" onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close">
        <XCircle className="w-5 h-5" />
      </button>
    </div>
  );

  const body = (
    <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
      {reviewSection ? (
        <div className="-mx-6 -mt-6 mb-2 px-6 py-4 border-b border-gray-800 bg-gray-800/20">
          {reviewSection}
        </div>
      ) : null}
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-200">{error}</div>
          )}

          {/* Client Information */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">Client Information</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Client Name *</label>
                <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="John Smith" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email *</label>
                <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="john@company.com" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Company</label>
                <input type="text" value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} placeholder="Company Inc." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500" />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="pt-4 border-t border-gray-700">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Pricing</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <span className="text-gray-400">Offer Total</span>
                <span className="font-medium">{formatCurrency(totalAmount)}</span>
              </div>
              {blendedMarginPercent != null && totalAmount > 0 && (
                <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <span className="text-gray-400">Blended Margin</span>
                  <span className="font-medium">
                    {Math.round(blendedMarginPercent)}%
                    {blendedMarginDollar != null && ` (${formatCurrency(blendedMarginDollar)} profit)`}
                  </span>
                </div>
              )}
              {blendedMarginPercent != null && blendedMarginPercent < MARGIN_ALERT_THRESHOLD && (
                <div className="flex items-start gap-2 p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg text-amber-200 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Margin is below {MARGIN_ALERT_THRESHOLD}%. Consider adjusting pricing or costs.</span>
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Discount Amount ($)</label>
                <input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))} min={0} step={0.01} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" />
              </div>
              {discountAmount > 0 && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Discount Reason</label>
                  <input type="text" value={discountDescription} onChange={(e) => setDiscountDescription(e.target.value)} placeholder="e.g., Early bird, Referral, Loyalty" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500" />
                </div>
              )}
              <div className="flex items-center justify-between p-3 bg-blue-900/30 border border-blue-800 rounded-lg">
                <span className="text-blue-300 font-medium">Final Amount</span>
                <span className="text-xl font-bold text-blue-400">{formatCurrency(finalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Value Report */}
          {contactId != null && (
            <div className="pt-4 border-t border-gray-700">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Value Report</h4>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Attach value assessment to proposal</label>
                <select
                  value={valueReportId ?? ''}
                  onChange={(e) => setValueReportId(e.target.value || null)}
                  disabled={reportsLoading}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white disabled:opacity-50"
                >
                  <option value="">None</option>
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title ?? 'Report'} {r.total_annual_value != null ? `· $${r.total_annual_value}` : ''} ·{' '}
                      {new Date(r.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Document Package */}
          <div className="pt-4 border-t border-gray-700">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Document Package</h4>
            <div className="space-y-3">
              {/* Sales Agreement checkbox */}
              <button
                type="button"
                onClick={() => setIncludeContract(!includeContract)}
                className="w-full flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-left"
              >
                {includeContract ? <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <Square className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-200">Sales Agreement (Software Agreement)</span>
                  <p className="text-xs text-gray-500 mt-0.5">Formal contract with terms, compensation, and signature fields</p>
                </div>
              </button>

              {/* Onboarding Preview checkbox */}
              <div>
                <button
                  type="button"
                  onClick={() => setIncludeOnboarding(!includeOnboarding)}
                  className="w-full flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-left"
                >
                  {includeOnboarding ? <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <Square className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-200">Client Onboarding Preview</span>
                    <p className="text-xs text-gray-500 mt-0.5">AI-generated setup requirements and timeline based on line items</p>
                  </div>
                  {includeOnboarding && onboardingContent && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOnboardingExpanded(!onboardingExpanded); }}
                      className="p-1 text-gray-400 hover:text-white"
                    >
                      {onboardingExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </button>

                {/* AI Loading state */}
                {includeOnboarding && onboardingLoading && (
                  <div className="mt-2 p-3 bg-gray-800/30 rounded-lg border border-gray-700/50 flex items-center gap-2 text-sm text-gray-400">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                    Generating project-specific onboarding content...
                  </div>
                )}

                {/* Editable onboarding preview */}
                {includeOnboarding && onboardingContent && onboardingExpanded && (
                  <div className="mt-2 p-3 bg-gray-800/30 rounded-lg border border-gray-700/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Setup Requirements</span>
                      <button
                        type="button"
                        onClick={generateOnboardingPreview}
                        disabled={onboardingLoading}
                        className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" /> Regenerate
                      </button>
                    </div>
                    {onboardingContent.setup_requirements.map((req, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 bg-gray-900/50 rounded">
                        <div className="flex-1 min-w-0 space-y-1">
                          <input
                            type="text"
                            value={req.title}
                            onChange={(e) => updateSetupRequirement(i, 'title', e.target.value)}
                            className="w-full px-2 py-1 bg-transparent border-b border-gray-700 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                          />
                          <input
                            type="text"
                            value={req.description}
                            onChange={(e) => updateSetupRequirement(i, 'description', e.target.value)}
                            className="w-full px-2 py-0.5 bg-transparent text-xs text-gray-500 focus:text-gray-300 focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {req.is_client_action && <span className="text-[10px] text-amber-400 font-medium">CLIENT</span>}
                          <button type="button" onClick={() => removeSetupRequirement(i)} className="p-0.5 text-gray-600 hover:text-red-400">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {onboardingContent.tools_and_platforms.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Tools &amp; Platforms</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {onboardingContent.tools_and_platforms.map((tool, i) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-700/50 text-xs text-gray-300 rounded">{tool}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {onboardingContent.milestones.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Timeline ({onboardingContent.milestones.length} milestones)</span>
                        <div className="mt-1 space-y-1">
                          {onboardingContent.milestones.slice(0, 4).map((ms, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="text-amber-400 font-medium w-10 flex-shrink-0">Wk {ms.week}</span>
                              <span className="text-gray-300 truncate">{ms.title}</span>
                            </div>
                          ))}
                          {onboardingContent.milestones.length > 4 && (
                            <span className="text-xs text-gray-500">+{onboardingContent.milestones.length - 4} more</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Attach Reports */}
              {contactSubmissionId != null && (
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Attach Strategy / Value Reports</label>
                  {gammaReportsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading reports...
                    </div>
                  ) : gammaReports.length === 0 ? (
                    <p className="text-xs text-gray-500 py-1">No completed reports with PDFs available for this contact.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {gammaReports.map((gr) => (
                        <div
                          key={gr.id}
                          className="flex items-center gap-2 p-2 bg-gray-800/50 rounded border border-gray-700/50"
                        >
                          <button
                            type="button"
                            onClick={() => toggleReportSelection(gr.id)}
                            className="flex flex-1 min-w-0 items-center gap-2 text-left rounded hover:bg-gray-800/80 transition-colors"
                          >
                            {selectedReportIds.has(gr.id) ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> : <Square className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <span className="text-xs text-gray-200 truncate block">{gr.title || 'Untitled Report'}</span>
                              <span className="text-[10px] text-gray-500">
                                {REPORT_TYPE_LABELS[gr.report_type] || gr.report_type} · {new Date(gr.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </button>
                          {gr.pdf_url ? (
                            <a
                              href={gr.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-blue-400 hover:text-blue-300 px-2 py-1 rounded border border-blue-500/40"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Preview PDF
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Validity & Service Term */}
          <div className="pt-4 border-t border-gray-700">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Validity & Service Term</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Valid for (days)</label>
                <select
                  value={validDays}
                  onChange={(e) => setValidDays(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Service term (months)</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={serviceTermMonths}
                  onChange={(e) => setServiceTermMonths(e.target.value ? parseInt(e.target.value, 10) : '')}
                  placeholder="e.g. 3, 6, 12"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                />
                <p className="text-[11px] text-gray-600 mt-1">
                  Default installment count when client chooses to pay in installments.
                  {defaultServiceTermMonths ? ` Pre-filled from bundle (${defaultServiceTermMonths} months).` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
  );

  const footer = (
    <div className="p-4 border-t border-gray-800 flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !clientName.trim() || !clientEmail.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Generate Proposal
          </button>
        </div>
  );

  const shellClass =
    presentation === 'drawer'
      ? 'h-full w-full max-w-xl sm:max-w-2xl flex flex-col bg-gray-900 border-l border-gray-800 shadow-2xl'
      : 'bg-gray-900 rounded-xl border border-gray-800 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col';

  const panel = (
    <div className={shellClass} role="dialog" aria-modal="true" aria-labelledby="proposal-modal-title">
      <div id="proposal-modal-title" className="sr-only">
        {headerTitle}
      </div>
      {header}
      {body}
      {footer}
    </div>
  );

  if (presentation === 'drawer') {
    // pointer-events-none so the conversation page (e.g. offer column) stays usable while open; close via header X.
    return (
      <div className="fixed inset-0 z-[100] pointer-events-none flex justify-end">
        <div className="pointer-events-auto h-full flex max-w-full shadow-2xl">{panel}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      {panel}
    </div>
  );
}
