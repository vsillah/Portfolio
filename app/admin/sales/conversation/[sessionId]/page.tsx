'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getCurrentSession } from '@/lib/auth';
import {
  ContentWithRole,
  ContentType,
  FunnelStage,
  SessionOutcome,
  ResponseType,
  ConversationState,
  AIRecommendation,
  OfferStrategy,
  DynamicStep,
  StepType,
  OfferBundleWithStats,
  ResolvedBundleItem,
  OFFER_ROLE_LABELS,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_ICONS,
  STRATEGY_TO_STEP_TYPE,
  findObjectionHandlers,
  buildGrandSlamOffer,
  ProductWithRole,
  OfferRole,
  SalesScript,
} from '@/lib/sales-scripts';
import { FunnelStageSelector } from '@/components/admin/sales/FunnelStageSelector';
import { OfferStack, ContentOfferCard } from '@/components/admin/sales/OfferCard';
import { DynamicScriptFlow } from '@/components/admin/sales/DynamicScriptFlow';
import { ValueEvidencePanel } from '@/components/admin/sales/ValueEvidencePanel';
import { ProposalModal } from '@/components/admin/sales/ProposalModal';
import { ConversationTimeline } from '@/components/admin/sales/ConversationTimeline';
import { InPersonDiagnosticPanel } from '@/components/admin/sales/InPersonDiagnosticPanel';
import { CampaignContextPanel } from '@/components/admin/sales/CampaignContextPanel';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import {
  User, Building, Mail, MessageSquare, ChevronRight, ChevronDown,
  AlertCircle, Save, FileText, DollarSign, RefreshCw, ArrowLeft,
  Layers, Package, GitFork, CreditCard, ExternalLink, Copy, XCircle,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ContactInfo {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone?: string;
  industry?: string | null;
  employee_count?: string | null;
}

interface SalesSessionRow {
  id: string;
  diagnostic_audit_id: string | null;
  contact_submission_id: number | null;
  client_name: string | null;
  client_email: string | null;
  client_company: string | null;
  funnel_stage: FunnelStage;
  current_script_id: string | null;
  current_step_index: number;
  offers_presented: unknown[];
  products_presented: number[];
  internal_notes: string | null;
  outcome: SessionOutcome;
  next_follow_up: string | null;
}

/* ------------------------------------------------------------------ */
/* Page Component                                                      */
/* ------------------------------------------------------------------ */

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const sessionId = params.sessionId as string;

  /* ---- data state ---- */
  const [salesSession, setSalesSession] = useState<SalesSessionRow | null>(null);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [content, setContent] = useState<ContentWithRole[]>([]);
  const [scripts, setScripts] = useState<SalesScript[]>([]);
  const [bundles, setBundles] = useState<OfferBundleWithStats[]>([]);

  /* ---- ui state ---- */
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'script' | 'products' | 'objections'>('script');
  const [notes, setNotes] = useState('');
  const [objectionInput, setObjectionInput] = useState('');
  const [selectedContent, setSelectedContent] = useState<string[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [showBundleSelector, setShowBundleSelector] = useState(false);
  const [showSaveAsBundle, setShowSaveAsBundle] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [valueReportId, setValueReportId] = useState<string | null>(null);
  const [currentProposal, setCurrentProposal] = useState<{
    id: string; status: string; proposalLink: string;
  } | null>(null);
  const [collapsedContentGroups, setCollapsedContentGroups] = useState<Set<string>>(new Set());

  /* ---- value evidence ---- */
  const [scriptValueEvidence, setScriptValueEvidence] = useState<{
    painPoints: { display_name: string | null; monetary_indicator: number; monetary_context: string | null }[];
    totalAnnualValue: number | null;
  } | null>(null);
  const [priceOverrides, setPriceOverrides] = useState<
    Record<string, { retail_price: number; perceived_value: number }>
  >({});
  const [isApplyingEvidencePricing, setIsApplyingEvidencePricing] = useState(false);

  /* ---- conversation flow ---- */
  const [conversationState, setConversationState] = useState<ConversationState>({
    currentStep: 0,
    responseHistory: [],
    offersPresented: [],
    objectionsRaised: [],
    positiveSignals: 0,
    selectedProducts: [],
    dynamicSteps: [],
    isCallActive: false,
  });
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [isLoadingNextStep, setIsLoadingNextStep] = useState(false);

  /* ---- in-person diagnostic ---- */
  const [auditData, setAuditData] = useState<Record<string, unknown> | null>(null);
  const [diagnosticAuditId, setDiagnosticAuditId] = useState<string | null>(null);

  /* ================================================================ */
  /* Data loading                                                      */
  /* ================================================================ */

  const fetchData = useCallback(async () => {
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return;
    setIsLoading(true);
    setError(null);
    const headers = { Authorization: `Bearer ${authSession.access_token}` };

    try {
      const [sessionsRes, productsRes, scriptsRes, bundlesRes] = await Promise.all([
        fetch(`/api/admin/sales/sessions?id=${sessionId}`, { headers }),
        fetch('/api/admin/sales/products', { headers }),
        fetch('/api/admin/sales/scripts', { headers }),
        fetch('/api/admin/sales/bundles', { headers }),
      ]);

      if (!sessionsRes.ok) {
        throw new Error('Failed to fetch session');
      }
      const sessionsData = await sessionsRes.json();
      const session: SalesSessionRow | undefined = (sessionsData.sessions || [])[0];
      if (!session) { setError('Session not found'); setIsLoading(false); return; }

      setSalesSession(session);
      setNotes(session.internal_notes || '');
      setSelectedContent((session.products_presented || []).map((id: number) => `product:${id}`));
      if (session.diagnostic_audit_id) setDiagnosticAuditId(session.diagnostic_audit_id);

      // Load contact from lead API or build from session fields
      let contactData: ContactInfo | null = null;
      if (session.contact_submission_id) {
        const leadRes = await fetch(`/api/admin/outreach/leads/${session.contact_submission_id}`, { headers });
        if (leadRes.ok) {
          const lead = await leadRes.json();
          contactData = {
            id: String(lead.id),
            name: lead.name ?? '',
            email: lead.email ?? '',
            company: lead.company ?? null,
            phone: lead.phone_number,
            industry: lead.industry ?? null,
            employee_count: lead.employee_count ?? null,
          };
        }
      }
      if (!contactData) {
        contactData = {
          id: '',
          name: session.client_name ?? 'Client',
          email: session.client_email ?? '',
          company: session.client_company ?? null,
        };
      }
      setContact(contactData);

      const [productsData, scriptsData, bundlesData] = await Promise.all([
        productsRes.json(),
        scriptsRes.ok ? scriptsRes.json() : { scripts: [] },
        bundlesRes.ok ? bundlesRes.json() : { bundles: [] },
      ]);
      setContent(productsData.content || []);
      setScripts(scriptsData.scripts || []);
      setBundles(bundlesData.bundles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { if (user) fetchData(); }, [user, fetchData]);

  // Load existing audit data for script generation when session has a diagnostic
  useEffect(() => {
    if (!diagnosticAuditId) { setAuditData(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/diagnostic?auditId=${diagnosticAuditId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled || !data.audit) return;
        const a = data.audit;
        setAuditData({
          business_challenges: a.businessChallenges || {},
          tech_stack: a.techStack || {},
          automation_needs: a.automationNeeds || {},
          ai_readiness: a.aiReadiness || {},
          budget_timeline: a.budgetTimeline || {},
          decision_making: a.decisionMaking || {},
          urgency_score: a.urgencyScore,
          opportunity_score: a.opportunityScore,
          key_insights: a.keyInsights || [],
        });
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [diagnosticAuditId]);

  // Fetch value evidence when contact is set
  useEffect(() => {
    if (!contact?.id) { setScriptValueEvidence(null); return; }
    let cancelled = false;
    (async () => {
      const session = await getCurrentSession();
      if (!session?.access_token) return;
      const res = await fetch(
        `/api/admin/value-evidence/evidence?contact_id=${encodeURIComponent(contact.id)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      const painPoints = (data.evidence || [])
        .filter((e: { monetary_indicator?: number }) => e.monetary_indicator != null)
        .map((e: { display_name: string | null; monetary_indicator: number; monetary_context: string | null }) => ({
          display_name: e.display_name ?? null,
          monetary_indicator: Number(e.monetary_indicator),
          monetary_context: e.monetary_context ?? null,
        }))
        .slice(0, 8);
      const report = (data.reports || [])[0];
      setScriptValueEvidence({
        painPoints,
        totalAnnualValue: report?.total_annual_value != null ? Number(report.total_annual_value) : null,
      });
    })();
    return () => { cancelled = true; };
  }, [contact?.id]);

  /* ================================================================ */
  /* Session helpers                                                   */
  /* ================================================================ */

  const updateSession = async (updates: Partial<SalesSessionRow>) => {
    if (!salesSession) return;
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/sales/sessions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({ id: salesSession.id, ...updates }),
      });
      if (!res.ok) throw new Error('Failed to update session');
      const data = await res.json();
      setSalesSession(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStageChange = (stage: FunnelStage) => updateSession({ funnel_stage: stage });
  const handleOutcomeChange = (outcome: SessionOutcome) => updateSession({ outcome });
  const saveNotes = () => updateSession({ internal_notes: notes });

  /* ================================================================ */
  /* Bundle helpers                                                    */
  /* ================================================================ */

  const applyBundle = async (bundleId: string) => {
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return;
    try {
      const response = await fetch(`/api/admin/sales/bundles/${bundleId}/resolve`, {
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to load bundle');
      const data = await response.json();
      setSelectedContent(data.items.map((item: ResolvedBundleItem) => `${item.content_type}:${item.content_id}`));
      setSelectedBundleId(bundleId);
      setShowBundleSelector(false);
    } catch { setError('Failed to load bundle'); }
  };

  const saveAsBundle = async (name: string, description?: string) => {
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return;
    try {
      const items = content
        .filter(c => selectedContent.includes(`${c.content_type}:${c.content_id}`))
        .map((c, i) => ({
          content_type: c.content_type, content_id: c.content_id, display_order: i,
          title: c.title, offer_role: c.offer_role, role_retail_price: c.role_retail_price,
          perceived_value: c.perceived_value, has_overrides: false, is_optional: false,
        }));
      const response = await fetch('/api/admin/sales/bundles/save-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({ name, description, items, parent_bundle_id: selectedBundleId }),
      });
      if (!response.ok) throw new Error('Failed to save bundle');
      setShowSaveAsBundle(false);
      const bundlesRes = await fetch('/api/admin/sales/bundles', { headers: { Authorization: `Bearer ${authSession.access_token}` } });
      if (bundlesRes.ok) { const bd = await bundlesRes.json(); setBundles(bd.bundles || []); }
    } catch { setError('Failed to save bundle'); }
  };

  const toggleContent = (contentType: ContentType, contentId: string) => {
    const key = `${contentType}:${contentId}`;
    const next = selectedContent.includes(key) ? selectedContent.filter(k => k !== key) : [...selectedContent, key];
    setSelectedContent(next);
    updateSession({ products_presented: next.filter(k => k.startsWith('product:')).map(k => parseInt(k.split(':')[1], 10)) });
  };

  /* ================================================================ */
  /* Dynamic script / AI                                               */
  /* ================================================================ */

  const generateStep = async (
    stepType: StepType, previousSteps: DynamicStep[],
    lastResponse?: ResponseType, chosenStrategy?: OfferStrategy,
  ): Promise<DynamicStep | null> => {
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return null;
    try {
      const res = await fetch('/api/admin/sales/generate-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({
          stepType, audit: auditData || null,
          clientName: contact?.name, clientCompany: contact?.company,
          previousSteps, lastResponse, chosenStrategy,
          availableContent: content.filter(c => c.is_active),
          conversationHistory: conversationState.responseHistory,
          contactSubmissionId: contact?.id ? parseInt(contact.id, 10) : null,
        }),
      });
      if (res.ok) { const d = await res.json(); return d.step; }
    } catch (err) { console.error('Failed to generate step:', err); }
    return null;
  };

  const startCall = async () => {
    setIsLoadingNextStep(true);
    setConversationState(prev => ({ ...prev, isCallActive: true }));
    const openingStep = await generateStep('opening', []);
    if (openingStep) {
      openingStep.status = 'active';
      setConversationState(prev => ({ ...prev, dynamicSteps: [openingStep], currentStep: 0 }));
    }
    setIsLoadingNextStep(false);
  };

  const handleClientResponse = async (responseType: ResponseType, responseNotes?: string) => {
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return;
    const newResponse = { id: `resp-${Date.now()}`, stepId: 'no-script', responseType, notes: responseNotes, timestamp: new Date().toISOString() };
    const updatedState: ConversationState = {
      ...conversationState,
      responseHistory: [...conversationState.responseHistory, newResponse],
      objectionsRaised: responseType.includes('objection') ? [...conversationState.objectionsRaised, responseType] : conversationState.objectionsRaised,
      positiveSignals: responseType === 'positive' ? conversationState.positiveSignals + 1 : conversationState.positiveSignals,
    };
    setConversationState(updatedState);
    setIsLoadingRecommendations(true);
    try {
      const res = await fetch('/api/admin/sales/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({
          audit: auditData || null, currentObjection: responseType,
          conversationHistory: updatedState.responseHistory,
          contentPresented: selectedContent,
          availableContent: content.filter(c => c.is_active),
          clientName: contact?.name, clientCompany: contact?.company,
        }),
      });
      if (res.ok) { const d = await res.json(); setAiRecommendations(d.recommendations || []); }
    } catch { /* ignore */ } finally { setIsLoadingRecommendations(false); }
  };

  const handleSelectStrategy = async (recommendation: AIRecommendation) => {
    if (recommendation.products.length > 0) {
      const keys = recommendation.products.map(p => `product:${p.id}`);
      const merged = [...new Set([...selectedContent, ...keys])];
      setSelectedContent(merged);
      updateSession({ products_presented: merged.filter(k => k.startsWith('product:')).map(k => parseInt(k.split(':')[1], 10)) });
    }
    const lastResp = conversationState.responseHistory[conversationState.responseHistory.length - 1];
    const updatedSteps = conversationState.dynamicSteps.map((s, i) =>
      i === conversationState.currentStep ? { ...s, status: 'completed' as const, completedAt: new Date().toISOString(), response: lastResp?.responseType } : s,
    );
    const newOffers = [...conversationState.offersPresented, recommendation.strategy];
    setAiRecommendations([]);
    setIsLoadingNextStep(true);
    const nextType = STRATEGY_TO_STEP_TYPE[recommendation.strategy];
    const newStep = await generateStep(nextType, updatedSteps, lastResp?.responseType, recommendation.strategy);
    if (newStep) {
      newStep.status = 'active';
      setConversationState(prev => ({ ...prev, dynamicSteps: [...updatedSteps, newStep], currentStep: updatedSteps.length, offersPresented: newOffers }));
    }
    setIsLoadingNextStep(false);
  };

  const handleCompleteStep = (stepId: string) => {
    setConversationState(prev => ({
      ...prev,
      dynamicSteps: prev.dynamicSteps.map(s => s.id === stepId ? { ...s, status: 'completed' as const, completedAt: new Date().toISOString() } : s),
    }));
  };

  const refreshRecommendations = () => {
    const last = conversationState.responseHistory[conversationState.responseHistory.length - 1];
    if (last) handleClientResponse(last.responseType, last.notes);
  };

  /* ================================================================ */
  /* Derived data                                                      */
  /* ================================================================ */

  const selectedContentDetails = content.filter(c => selectedContent.includes(`${c.content_type}:${c.content_id}`));
  const selectedAsProducts: ProductWithRole[] = selectedContentDetails.map(c => {
    const key = `${c.content_type}:${c.content_id}`;
    const ov = priceOverrides[key];
    return {
      id: parseInt(c.content_id, 10) || 0, title: c.title, description: c.description,
      type: c.content_type, price: c.price, file_path: null, image_url: c.image_url,
      is_active: c.is_active, is_featured: false, display_order: c.display_order,
      role_id: c.role_id, offer_role: c.offer_role,
      dream_outcome_description: c.dream_outcome_description,
      likelihood_multiplier: c.likelihood_multiplier, time_reduction: c.time_reduction,
      effort_reduction: c.effort_reduction,
      role_retail_price: ov?.retail_price ?? c.role_retail_price,
      offer_price: c.offer_price,
      perceived_value: ov?.perceived_value ?? c.perceived_value,
      bonus_name: c.bonus_name, bonus_description: c.bonus_description,
      qualifying_actions: c.qualifying_actions, payout_type: c.payout_type,
    };
  });
  const grandSlamOffer = buildGrandSlamOffer(selectedAsProducts);
  const objectionHandlers = objectionInput ? findObjectionHandlers(objectionInput) : [];
  const contentByTypeAndRole = content.reduce((acc, item) => {
    const t = item.content_type;
    const r = item.offer_role || 'unclassified';
    if (!acc[t]) acc[t] = {};
    if (!acc[t][r]) acc[t][r] = [];
    acc[t][r].push(item);
    return acc;
  }, {} as Record<ContentType, Record<string, ContentWithRole[]>>);

  /* ================================================================ */
  /* Loading / error states                                            */
  /* ================================================================ */

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-gray-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (error || !salesSession) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-4">{error || 'Session not found'}</p>
          <button onClick={() => router.push('/admin/sales')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /* Render                                                            */
  /* ================================================================ */

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Breadcrumbs items={[{ label: 'Admin', href: '/admin' }, { label: 'Sales', href: '/admin/sales' }, { label: contact?.name || 'Conversation' }]} />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/sales')} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Conversation: {contact?.name}</h1>
              <p className="text-gray-400">{contact?.company || contact?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isSaving && <span className="text-sm text-gray-400 flex items-center gap-1"><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</span>}
            <select value={salesSession.outcome || 'in_progress'} onChange={e => handleOutcomeChange(e.target.value as SessionOutcome)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
              <option value="in_progress">In Progress</option>
              <option value="converted">Converted</option>
              <option value="downsold">Downsold</option>
              <option value="deferred">Needs Follow-up</option>
              <option value="lost">Lost</option>
            </select>
          </div>
        </div>

        {/* Funnel Stage */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Client Stage</h3>
          <FunnelStageSelector currentStage={salesSession.funnel_stage || 'prospect'} onChange={handleStageChange} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ---- Left Panel ---- */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="font-medium text-white mb-4 flex items-center gap-2"><User className="w-5 h-5 text-blue-500" /> Client Information</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-300"><Mail className="w-4 h-4 text-gray-500" /><span>{contact?.email}</span></div>
                {contact?.company && <div className="flex items-center gap-2 text-sm text-gray-300"><Building className="w-4 h-4 text-gray-500" /><span>{contact.company}</span></div>}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="font-medium text-white mb-3 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-yellow-500" /> Call Notes</h3>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes from the call..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500" rows={4} />
              <button onClick={saveNotes} className="mt-2 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 flex items-center gap-1"><Save className="w-4 h-4" /> Save Notes</button>
            </div>

            {/* Conversation Timeline */}
            {conversationState.responseHistory.length > 0 && (
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                <ConversationTimeline responses={conversationState.responseHistory} currentStep={0} compact={false} />
              </div>
            )}

            {/* In-Person Diagnostic */}
            <InPersonDiagnosticPanel
              sessionId={sessionId}
              diagnosticAuditId={diagnosticAuditId}
              contactSubmissionId={contact?.id ? parseInt(contact.id, 10) : null}
              clientName={contact?.name || null}
              clientCompany={contact?.company || null}
              onAuditCreated={(id) => {
                setDiagnosticAuditId(id);
                setSalesSession(prev => prev ? { ...prev, diagnostic_audit_id: id } : prev);
              }}
              onAuditUpdated={(data) => {
                setAuditData(data as unknown as Record<string, unknown>);
              }}
            />

            {/* Value Evidence */}
            <ValueEvidencePanel
              contactId={contact?.id ? parseInt(contact.id, 10) : null}
              industry={contact?.industry || null}
              companySize={contact?.employee_count || null}
              companyName={contact?.company || null}
              onReportGenerated={id => setValueReportId(id)}
            />

            {/* Campaign Context */}
            <CampaignContextPanel contactEmail={contact?.email || null} />
          </div>

          {/* ---- Center Panel ---- */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              {(['script', 'products', 'objections'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === tab ? 'bg-emerald-600 text-white' : 'bg-gray-900 border border-gray-700 text-gray-300 hover:border-purple-500/50'}`}>
                  {tab === 'script' && <><FileText className="w-4 h-4 inline mr-2" />Script Guide</>}
                  {tab === 'products' && <><DollarSign className="w-4 h-4 inline mr-2" />Products</>}
                  {tab === 'objections' && <><AlertCircle className="w-4 h-4 inline mr-2" />Objections</>}
                </button>
              ))}
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              {/* ============ SCRIPT TAB ============ */}
              {activeTab === 'script' && (
                <div>
                  {scriptValueEvidence && (scriptValueEvidence.painPoints.length > 0 || scriptValueEvidence.totalAnnualValue != null) && (
                    <div className="mb-4 p-4 rounded-lg border border-green-800/50 bg-green-950/30">
                      <h4 className="text-sm font-medium text-green-300 mb-2 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Value evidence for this call</h4>
                      <ul className="text-sm text-gray-300 space-y-1">
                        {scriptValueEvidence.painPoints.map((pp, i) => (
                          <li key={i}>{pp.display_name || 'Pain point'}: ${pp.monetary_indicator.toLocaleString()}/yr{pp.monetary_context && <span className="text-gray-500"> &mdash; {pp.monetary_context}</span>}</li>
                        ))}
                        {scriptValueEvidence.totalAnnualValue != null && (
                          <li className="font-medium text-green-400 pt-1 border-t border-green-800/30 mt-2">Total value (report): ${scriptValueEvidence.totalAnnualValue.toLocaleString()}/yr</li>
                        )}
                      </ul>
                    </div>
                  )}
                  <DynamicScriptFlow
                    steps={conversationState.dynamicSteps}
                    currentStepIndex={conversationState.currentStep}
                    onRecordResponse={handleClientResponse}
                    onSelectStrategy={handleSelectStrategy}
                    onCompleteStep={handleCompleteStep}
                    aiRecommendations={aiRecommendations}
                    isLoadingRecommendations={isLoadingRecommendations}
                    isLoadingNextStep={isLoadingNextStep}
                    isCallActive={conversationState.isCallActive}
                    onStartCall={startCall}
                    onRefreshRecommendations={refreshRecommendations}
                  />
                </div>
              )}

              {/* ============ PRODUCTS TAB ============ */}
              {activeTab === 'products' && (
                <div>
                  {/* Bundle Quick Start */}
                  {bundles.length > 0 && (
                    <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <span className="text-sm font-medium text-white flex items-center gap-2 mb-3"><Layers className="w-4 h-4 text-purple-400" /> Quick Start from Bundle</span>
                      <div className="flex flex-wrap gap-2">
                        {bundles.slice(0, 5).map(b => (
                          <button key={b.id} onClick={() => applyBundle(b.id)} className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${selectedBundleId === b.id ? 'bg-purple-900/50 border-purple-500 text-purple-200' : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'}`}>
                            {b.name}<span className="ml-1 text-xs text-gray-400">({b.item_count})</span>
                          </button>
                        ))}
                        {bundles.length > 5 && <button onClick={() => setShowBundleSelector(true)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">+{bundles.length - 5} more</button>}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-white">Select Content for Offer</h3>
                    <span className="text-sm text-gray-400">{selectedContent.length} selected</span>
                  </div>

                  {/* Content by type & role */}
                  {Object.entries(contentByTypeAndRole).map(([ct, roleGroups]) => {
                    const collapsed = collapsedContentGroups.has(ct);
                    const count = Object.values(roleGroups).flat().length;
                    const selCount = Object.values(roleGroups).flat().filter(i => selectedContent.includes(`${i.content_type}:${i.content_id}`)).length;
                    return (
                      <div key={ct} className="mb-4">
                        <button onClick={() => setCollapsedContentGroups(prev => { const n = new Set(prev); if (n.has(ct)) n.delete(ct); else n.add(ct); return n; })} className="w-full flex items-center gap-2 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700 transition-colors">
                          {collapsed ? <ChevronRight className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                          <span className="text-xl">{CONTENT_TYPE_ICONS[ct as ContentType]}</span>
                          <h3 className="font-medium text-white">{CONTENT_TYPE_LABELS[ct as ContentType]}</h3>
                          <span className="text-gray-500 text-sm">({count})</span>
                          {selCount > 0 && <span className="ml-auto px-2 py-0.5 text-xs bg-blue-900/50 text-blue-300 rounded">{selCount} selected</span>}
                        </button>
                        {!collapsed && (
                          <div className="mt-3 ml-2 pl-4 border-l border-gray-700">
                            {Object.entries(roleGroups).map(([role, items]) => (
                              <div key={`${ct}-${role}`} className="mb-4">
                                <h4 className="text-sm font-medium text-gray-400 mb-3">{OFFER_ROLE_LABELS[role as OfferRole] || 'Unclassified'} ({items.length})</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {items.map(item => {
                                    const k = `${item.content_type}:${item.content_id}`;
                                    return <ContentOfferCard key={k} content={item} compact showAddButton isSelected={selectedContent.includes(k)} onAdd={() => toggleContent(item.content_type, item.content_id)} />;
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Offer Stack */}
                  {selectedContent.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-700">
                      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <h4 className="font-medium text-white">Your Offer Stack</h4>
                        <div className="flex items-center gap-2">
                          {contact?.id && (
                            <button
                              onClick={async () => {
                                const s = await getCurrentSession();
                                if (!s?.access_token || !selectedContentDetails.length) return;
                                setIsApplyingEvidencePricing(true);
                                try {
                                  const next: Record<string, { retail_price: number; perceived_value: number }> = {};
                                  for (const c of selectedContentDetails) {
                                    const r = await fetch('/api/admin/value-evidence/suggest-pricing', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
                                      body: JSON.stringify({ content_type: c.content_type, content_id: c.content_id, contact_submission_id: parseInt(contact!.id, 10), industry: contact!.industry || undefined, company_size: contact!.employee_count || undefined }),
                                    });
                                    if (r.ok) { const d = await r.json(); const p = d.pricing; if (p?.suggestedRetailPrice != null && p?.suggestedPerceivedValue != null) next[`${c.content_type}:${c.content_id}`] = { retail_price: Number(p.suggestedRetailPrice), perceived_value: Number(p.suggestedPerceivedValue) }; }
                                  }
                                  setPriceOverrides(prev => ({ ...prev, ...next }));
                                } finally { setIsApplyingEvidencePricing(false); }
                              }}
                              disabled={isApplyingEvidencePricing}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-900/50 border border-green-700/50 text-green-300 hover:bg-green-900/70 rounded-lg disabled:opacity-50"
                            >
                              {isApplyingEvidencePricing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />} Apply evidence-based pricing
                            </button>
                          )}
                          <button onClick={() => setShowSaveAsBundle(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 rounded-lg"><Save className="w-3 h-3" /> Save as Bundle</button>
                        </div>
                      </div>
                      <OfferStack products={selectedAsProducts} totalPrice={grandSlamOffer.offerPrice} totalValue={grandSlamOffer.totalPerceivedValue} />

                      {/* Proposal */}
                      <div className="mt-6 pt-6 border-t border-gray-700">
                        <h4 className="font-medium text-white flex items-center gap-2 mb-1"><FileText className="w-4 h-4 text-blue-400" /> Convert to Proposal</h4>
                        {currentProposal ? (
                          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 mt-3">
                            <span className={`px-2 py-1 text-xs rounded ${currentProposal.status === 'paid' ? 'bg-green-900/50 text-green-300' : currentProposal.status === 'accepted' ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-700 text-gray-300'}`}>{currentProposal.status}</span>
                            <div className="flex items-center gap-2 mt-2">
                              <input type="text" value={currentProposal.proposalLink} readOnly className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300" />
                              <button onClick={() => navigator.clipboard.writeText(currentProposal.proposalLink)} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"><Copy className="w-4 h-4" /></button>
                              <a href={currentProposal.proposalLink} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"><ExternalLink className="w-4 h-4" /></a>
                            </div>
                            <button onClick={() => setShowProposalModal(true)} className="mt-3 w-full text-sm text-gray-400 hover:text-white">Generate new proposal</button>
                          </div>
                        ) : (
                          <button onClick={() => setShowProposalModal(true)} className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg"><CreditCard className="w-4 h-4" /> Generate Proposal &amp; Payment Link</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ============ OBJECTIONS TAB ============ */}
              {activeTab === 'objections' && (
                <div>
                  <h3 className="font-medium text-white mb-4">Objection Handler</h3>
                  <input type="text" value={objectionInput} onChange={e => setObjectionInput(e.target.value)} placeholder="e.g., too expensive, need to think about it..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 mb-6" />
                  {objectionHandlers.length > 0 ? (
                    <div className="space-y-4">
                      {objectionHandlers.map((h, i) => (
                        <div key={i} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                          <div className="text-sm font-medium text-gray-400 mb-2 capitalize">{h.category} Objection</div>
                          <p className="text-gray-200">{h.response}</p>
                        </div>
                      ))}
                    </div>
                  ) : objectionInput ? <p className="text-gray-400 text-center py-8">No specific handler found.</p> : (
                    <div className="text-gray-500 text-center py-8"><AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-600" /><p>Type an objection above to get suggested responses</p></div>
                  )}
                  <div className="mt-6 pt-6 border-t border-gray-700">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Quick Access</h4>
                    <div className="flex flex-wrap gap-2">
                      {['too expensive', 'need to think', 'talk to spouse', 'not the right time', 'tried before'].map(o => (
                        <button key={o} onClick={() => setObjectionInput(o)} className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-full text-sm hover:bg-gray-700">{o}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Modals ---- */}
      {showBundleSelector && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-lg max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Layers className="w-5 h-5 text-purple-400" /> Select Bundle</h3>
              <button onClick={() => setShowBundleSelector(false)} className="text-gray-400 hover:text-white"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {bundles.map(b => (
                <button key={b.id} onClick={() => applyBundle(b.id)} className="w-full text-left p-4 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between"><span className="font-medium text-white">{b.name}</span><span className="text-sm text-gray-400">{b.item_count} items</span></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSaveAsBundle && <SaveAsBundleModal onClose={() => setShowSaveAsBundle(false)} onSave={saveAsBundle} itemCount={selectedContent.length} parentBundleName={bundles.find(b => b.id === selectedBundleId)?.name} />}

      {showProposalModal && (
        <ProposalModal
          onClose={() => setShowProposalModal(false)}
          contactId={contact?.id ? parseInt(contact.id, 10) : null}
          defaultValueReportId={valueReportId}
          defaultClientName={contact?.name || ''}
          defaultClientEmail={contact?.email || ''}
          defaultClientCompany={contact?.company || ''}
          totalAmount={grandSlamOffer.offerPrice}
          onGenerate={async data => {
            const authSession = await getCurrentSession();
            if (!authSession?.access_token) return;
            const lineItems = selectedContentDetails.map(c => {
              const k = `${c.content_type}:${c.content_id}`;
              const ov = priceOverrides[k];
              return { content_type: c.content_type, content_id: c.content_id, title: c.title, description: c.description, offer_role: c.offer_role, price: ov?.retail_price ?? c.role_retail_price ?? c.price ?? 0, perceived_value: ov?.perceived_value ?? c.perceived_value ?? c.role_retail_price ?? c.price ?? 0 };
            });
            const response = await fetch('/api/proposals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
              body: JSON.stringify({ sales_session_id: salesSession?.id, client_name: data.clientName, client_email: data.clientEmail, client_company: data.clientCompany, bundle_id: selectedBundleId, bundle_name: bundles.find(b => b.id === selectedBundleId)?.name || 'Custom Offer', line_items: lineItems, subtotal: grandSlamOffer.offerPrice, discount_amount: data.discountAmount, discount_description: data.discountDescription, total_amount: grandSlamOffer.offerPrice - (data.discountAmount || 0), valid_days: data.validDays, value_report_id: data.valueReportId || undefined }),
            });
            if (response.ok) {
              const result = await response.json();
              setCurrentProposal({ id: result.proposal.id, status: result.proposal.status, proposalLink: result.proposalLink });
              setShowProposalModal(false);
            } else { throw new Error('Failed to create proposal'); }
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Save As Bundle Modal (inline)                                       */
/* ------------------------------------------------------------------ */

function SaveAsBundleModal({ onClose, onSave, itemCount, parentBundleName }: {
  onClose: () => void; onSave: (name: string, desc?: string) => void; itemCount: number; parentBundleName?: string;
}) {
  const [name, setName] = useState(parentBundleName ? `${parentBundleName} - Modified` : '');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Package className="w-5 h-5 text-purple-400" /> Save as New Bundle</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-300 mb-2">Bundle Name *</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Enterprise Premium Pack" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500" /></div>
          <div><label className="block text-sm font-medium text-gray-300 mb-2">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe this bundle..." rows={3} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 resize-none" /></div>
          <p className="text-sm text-gray-400">{itemCount} items{parentBundleName && <span className="block mt-1 text-purple-400"><GitFork className="w-3 h-3 inline mr-1" />Forked from &quot;{parentBundleName}&quot;</span>}</p>
        </div>
        <div className="flex items-center gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg">Cancel</button>
          <button onClick={async () => { if (!name.trim()) return; setSaving(true); await onSave(name.trim(), description.trim() || undefined); setSaving(false); }} disabled={!name.trim() || saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Bundle
          </button>
        </div>
      </div>
    </div>
  );
}
