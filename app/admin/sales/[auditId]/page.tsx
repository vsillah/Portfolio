'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getCurrentSession } from '@/lib/auth';
import { 
  ProductWithRole,
  ContentWithRole,
  ContentType,
  SalesScript,
  FunnelStage,
  SessionOutcome,
  OfferRole,
  ResponseType,
  ConversationResponse,
  ConversationState,
  AIRecommendation,
  OfferStrategy,
  DynamicStep,
  StepType,
  OfferBundleWithStats,
  ResolvedBundleItem,
  FUNNEL_STAGE_LABELS,
  OFFER_ROLE_LABELS,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_ICONS,
  CONTENT_TYPE_COLORS,
  RESPONSE_TYPE_LABELS,
  OFFER_STRATEGY_LABELS,
  STRATEGY_TO_STEP_TYPE,
  findObjectionHandlers,
  getRecommendedProducts,
  buildGrandSlamOffer,
} from '@/lib/sales-scripts';
import { formatCurrency } from '@/lib/pricing-model';
import { FunnelStageSelector } from '@/components/admin/sales/FunnelStageSelector';
import { OfferCard, OfferStack, ContentOfferCard } from '@/components/admin/sales/OfferCard';
import { ResponseBar } from '@/components/admin/sales/ResponseBar';
import { AIRecommendationPanel } from '@/components/admin/sales/AIRecommendationPanel';
import { ConversationTimeline, ConversationStats } from '@/components/admin/sales/ConversationTimeline';
import { DynamicScriptFlow } from '@/components/admin/sales/DynamicScriptFlow';
import { ValueEvidencePanel } from '@/components/admin/sales/ValueEvidencePanel';
import { ProposalModal } from '@/components/admin/sales/ProposalModal';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import { 
  User, 
  Building,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Save,
  Plus,
  FileText,
  Target,
  DollarSign,
  RefreshCw,
  ArrowLeft,
  Send,
  Layers,
  Package,
  GitFork,
  CreditCard,
  ExternalLink,
  Copy,
  Loader2,
  LayoutDashboard,
} from 'lucide-react';

interface DiagnosticAudit {
  id: string;
  session_id: string;
  contact_id: string | null;
  contact_submission_id?: number | null;
  status: string;
  urgency_score: number | null;
  opportunity_score: number | null;
  audit_summary: Record<string, unknown> | null;
  recommendations: string[] | null;
  created_at: string;
  // Full diagnostic data
  business_challenges: {
    primary_challenges?: string[];
    pain_points?: string[];
    current_impact?: string;
    attempted_solutions?: string[];
  } | null;
  tech_stack: {
    crm?: string;
    email?: string;
    marketing?: string;
    analytics?: string;
    other_tools?: string[];
    integration_readiness?: string;
  } | null;
  automation_needs: {
    priority_areas?: string[];
    desired_outcomes?: string[];
    complexity_tolerance?: string;
  } | null;
  ai_readiness: {
    data_quality?: string;
    team_readiness?: string;
    previous_ai_experience?: string;
    concerns?: string[];
    readiness_score?: number;
  } | null;
  budget_timeline: {
    budget_range?: string;
    timeline?: string;
    decision_timeline?: string;
    budget_flexibility?: string;
  } | null;
  decision_making: {
    decision_maker?: boolean;
    stakeholders?: string[];
    approval_process?: string;
    previous_vendor_experience?: string;
  } | null;
  diagnostic_summary: string | null;
  key_insights: string[] | null;
  recommended_actions: string[] | null;
  sales_notes: string | null;
}

interface AIInsights {
  customizedTalkingPoints: Array<{
    step: string;
    points: string[];
    personalizedNote?: string;
  }>;
  productRecommendations: Array<{
    productId: number;
    reason: string;
    talkingPoint: string;
  }>;
  anticipatedObjections: Array<{
    objection: string;
    likelyTrigger: string;
    response: string;
  }>;
  openingLine: string;
  keyPainPoints: string[];
}

interface ContactInfo {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone?: string;
  industry?: string | null;
  employee_count?: string | null;
}

interface SalesSession {
  id: string;
  diagnostic_audit_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_company: string | null;
  funnel_stage: FunnelStage;
  current_script_id: string | null;
  current_step_index: number;
  offers_presented: Record<string, unknown>[];
  products_presented: number[];
  client_responses: Record<string, unknown> | null;
  objections_handled: Record<string, unknown>[];
  internal_notes: string | null;
  outcome: SessionOutcome;
  loss_reason: string | null;
  next_follow_up: string | null;
}

// Expandable diagnostic section component
function DiagnosticSection({ 
  title, 
  icon, 
  isExpanded, 
  onToggle, 
  children 
}: { 
  title: string; 
  icon: string; 
  isExpanded: boolean; 
  onToggle: () => void; 
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between bg-gray-800/50 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <span>{icon}</span>
          {title}
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {isExpanded && (
        <div className="p-3 bg-gray-800/30">
          {children}
        </div>
      )}
    </div>
  );
}

export default function ClientWalkthroughPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const auditId = params.auditId as string;

  // Data state
  const [audit, setAudit] = useState<DiagnosticAudit | null>(null);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [salesSession, setSalesSession] = useState<SalesSession | null>(null);
  const [content, setContent] = useState<ContentWithRole[]>([]);
  const [scripts, setScripts] = useState<SalesScript[]>([]);
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'script' | 'products' | 'objections'>('script');
  const [selectedContent, setSelectedContent] = useState<string[]>([]); // Format: "content_type:content_id"
  const [expandedStep, setExpandedStep] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [objectionInput, setObjectionInput] = useState('');
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  
  // Bundle state
  const [bundles, setBundles] = useState<OfferBundleWithStats[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [showBundleSelector, setShowBundleSelector] = useState(false);
  const [showSaveAsBundle, setShowSaveAsBundle] = useState(false);
  
  // Proposal state
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [valueReportId, setValueReportId] = useState<string | null>(null);
  const [currentProposal, setCurrentProposal] = useState<{
    id: string;
    status: string;
    proposalLink: string;
  } | null>(null);
  
  // Content group collapse state
  const [collapsedContentGroups, setCollapsedContentGroups] = useState<Set<string>>(new Set());
  
  // Diagnostic details expansion
  const [expandedDiagnosticSection, setExpandedDiagnosticSection] = useState<string | null>(null);
  
  // AI Insights
  const [aiInsights, setAiInsights] = useState<AIInsights | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  
  // Dynamic conversation flow state
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
  /** Value evidence summary for script (pain points + total value) to guide the conversation */
  const [scriptValueEvidence, setScriptValueEvidence] = useState<{
    painPoints: { display_name: string | null; monetary_indicator: number; monetary_context: string | null }[];
    totalAnnualValue: number | null;
  } | null>(null);
  /** Evidence-based price overrides per content key (retail_price, perceived_value) for proposal line items */
  const [priceOverrides, setPriceOverrides] = useState<Record<string, { retail_price: number; perceived_value: number }>>({});
  const [isApplyingEvidencePricing, setIsApplyingEvidencePricing] = useState(false);
  const [leadDashboardUrl, setLeadDashboardUrl] = useState<string | null>(null);
  const [leadDashboardCopied, setLeadDashboardCopied] = useState(false);
  const [isCreatingLeadDashboard, setIsCreatingLeadDashboard] = useState(false);

  // Load initial data
  const fetchData = useCallback(async () => {
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return;
    
    setIsLoading(true);
    setError(null);
    
    const headers = { Authorization: `Bearer ${authSession.access_token}` };
    
    try {
      // Fetch audit details, products, scripts, bundles in parallel
      const [auditRes, productsRes, scriptsRes, sessionsRes, bundlesRes] = await Promise.all([
        fetch(`/api/admin/sales?status=completed`, { headers }),
        fetch('/api/admin/sales/products', { headers }),
        fetch('/api/admin/sales/scripts', { headers }),
        fetch(`/api/admin/sales/sessions?audit_id=${auditId}`, { headers }),
        fetch('/api/admin/sales/bundles', { headers }),
      ]);

      if (!auditRes.ok || !productsRes.ok || !scriptsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [auditData, productsData, scriptsData, sessionsData, bundlesData] = await Promise.all([
        auditRes.json(),
        productsRes.json(),
        scriptsRes.json(),
        sessionsRes.json(),
        bundlesRes.ok ? bundlesRes.json() : { bundles: [] },
      ]);

      // Find the specific audit
      const foundAudit = auditData.audits?.find((a: DiagnosticAudit & { contact_submissions: ContactInfo }) => a.id === auditId);
      if (!foundAudit) {
        throw new Error('Audit not found');
      }

      setAudit(foundAudit);
      setContact(foundAudit.contact_submissions);
      // Use content (all content types) instead of just products
      setContent(productsData.content || []);
      setScripts(scriptsData.scripts || []);
      setBundles(bundlesData.bundles || []);

      // Check for existing session
      const existingSession = sessionsData.sessions?.[0];
      if (existingSession) {
        setSalesSession(existingSession);
        setNotes(existingSession.internal_notes || '');
        // Convert legacy product IDs to content keys
        const legacyProducts = existingSession.products_presented || [];
        setSelectedContent(legacyProducts.map((id: number) => `product:${id}`));
      } else {
        // Create a new session
        const newSessionRes = await fetch('/api/admin/sales/sessions', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            diagnostic_audit_id: auditId,
            client_name: foundAudit.contact_submissions?.name,
            client_email: foundAudit.contact_submissions?.email,
            client_company: foundAudit.contact_submissions?.company,
            funnel_stage: 'prospect',
            contact_submission_id: foundAudit.contact_submission_id ?? foundAudit.contact_submissions?.id ?? null,
          }),
        });

        if (newSessionRes.ok) {
          const newSession = await newSessionRes.json();
          setSalesSession(newSession.data);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [auditId]);

  // Fetch when user becomes available
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [fetchData]);

  // Fetch value evidence for script (pain points + total value) when contact is set
  useEffect(() => {
    if (!contact?.id) {
      setScriptValueEvidence(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const session = await getCurrentSession();
      if (!session?.access_token) return;
      const res = await fetch(
        `/api/admin/value-evidence/evidence?contact_id=${encodeURIComponent(contact.id)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
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

  // Update session
  const updateSession = async (updates: Partial<SalesSession>) => {
    if (!salesSession) return;
    
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return;
    
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/sales/sessions', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.access_token}`,
        },
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

  // Handle funnel stage change
  const handleStageChange = (stage: FunnelStage) => {
    updateSession({ funnel_stage: stage });
  };

  // Handle outcome change
  const handleOutcomeChange = (outcome: SessionOutcome) => {
    updateSession({ outcome });
    // Clear loss_reason if outcome is no longer 'lost'
    if (outcome !== 'lost' && salesSession?.loss_reason) {
      updateSession({ loss_reason: null });
    }
  };

  // Handle loss reason change
  const handleLossReasonChange = (lossReason: string | null) => {
    updateSession({ loss_reason: lossReason });
  };

  // Apply a bundle to the current selection
  const applyBundle = async (bundleId: string) => {
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return;
    
    try {
      const response = await fetch(`/api/admin/sales/bundles/${bundleId}/resolve`, {
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to load bundle');
      
      const data = await response.json();
      const bundleContentKeys = data.items.map((item: ResolvedBundleItem) => 
        `${item.content_type}:${item.content_id}`
      );
      
      setSelectedContent(bundleContentKeys);
      setSelectedBundleId(bundleId);
      setShowBundleSelector(false);
    } catch (err) {
      console.error('Error applying bundle:', err);
      setError('Failed to load bundle');
    }
  };

  // Save current selection as a new bundle
  const saveAsBundle = async (name: string, description?: string) => {
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return;
    
    try {
      const items = content
        .filter(c => selectedContent.includes(`${c.content_type}:${c.content_id}`))
        .map((c, index) => ({
          content_type: c.content_type,
          content_id: c.content_id,
          display_order: index,
          title: c.title,
          offer_role: c.offer_role,
          role_retail_price: c.role_retail_price,
          perceived_value: c.perceived_value,
          has_overrides: false,
          is_optional: false,
        }));
      
      const response = await fetch('/api/admin/sales/bundles/save-as', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({
          name,
          description,
          items,
          parent_bundle_id: selectedBundleId,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to save bundle');
      
      setShowSaveAsBundle(false);
      // Refresh bundles list
      const bundlesRes = await fetch('/api/admin/sales/bundles', {
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      });
      if (bundlesRes.ok) {
        const bundlesData = await bundlesRes.json();
        setBundles(bundlesData.bundles || []);
      }
    } catch (err) {
      console.error('Error saving bundle:', err);
      setError('Failed to save bundle');
    }
  };

  // Handle content selection (for offer stack)
  const toggleContent = (contentType: ContentType, contentId: string) => {
    const key = `${contentType}:${contentId}`;
    const newSelection = selectedContent.includes(key)
      ? selectedContent.filter(k => k !== key)
      : [...selectedContent, key];
    
    setSelectedContent(newSelection);
    // For backward compatibility, also update products_presented with product IDs
    const productIds = newSelection
      .filter(k => k.startsWith('product:'))
      .map(k => parseInt(k.split(':')[1]));
    updateSession({ products_presented: productIds });
  };

  // Generate AI insights based on diagnostic data
  const generateAIInsights = async () => {
    if (!audit) return;
    
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return;
    
    setIsGeneratingAI(true);
    try {
      const res = await fetch('/api/admin/sales/ai-insights', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({ 
          audit,
          contact,
          content: content.filter(c => c.is_active),
          currentScript: scripts.find(s => s.id === selectedScriptId),
        }),
      });

      if (!res.ok) throw new Error('Failed to generate insights');
      
      const data = await res.json();
      setAiInsights(data.insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate AI insights');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Save notes
  const saveNotes = () => {
    updateSession({ internal_notes: notes });
  };

  // Handle client response and fetch AI recommendations
  const handleClientResponse = async (responseType: ResponseType, responseNotes?: string) => {
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return;

    // Create the response record
    const newResponse: ConversationResponse = {
      id: `resp-${Date.now()}`,
      stepId: selectedScriptId ? `step-${expandedStep}` : 'no-script',
      responseType,
      notes: responseNotes,
      timestamp: new Date().toISOString(),
      offerPresented: selectedScriptId || undefined,
    };

    // Update conversation state
    const newObjections = responseType.includes('objection') 
      ? [...conversationState.objectionsRaised, responseType]
      : conversationState.objectionsRaised;
    
    const newPositiveSignals = responseType === 'positive' 
      ? conversationState.positiveSignals + 1 
      : conversationState.positiveSignals;

    const updatedState: ConversationState = {
      ...conversationState,
      responseHistory: [...conversationState.responseHistory, newResponse],
      objectionsRaised: newObjections,
      positiveSignals: newPositiveSignals,
    };

    setConversationState(updatedState);

    // Fetch AI recommendations based on the response
    setIsLoadingRecommendations(true);
    try {
      const res = await fetch('/api/admin/sales/ai-recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({
          audit: {
            business_challenges: audit?.business_challenges,
            budget_timeline: audit?.budget_timeline,
            ai_readiness: audit?.ai_readiness,
            decision_making: audit?.decision_making,
            urgency_score: audit?.urgency_score,
            opportunity_score: audit?.opportunity_score,
          },
          currentObjection: responseType,
          conversationHistory: updatedState.responseHistory,
          contentPresented: selectedContent,
          availableContent: content.filter(c => c.is_active),
          clientName: contact?.name,
          clientCompany: contact?.company,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiRecommendations(data.recommendations);

        // Update the response with AI recommendations
        newResponse.aiRecommendations = data.recommendations;
      }
    } catch (err) {
      console.error('Failed to fetch AI recommendations:', err);
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  // Handle strategy selection from AI recommendations
  const handleSelectStrategy = async (recommendation: AIRecommendation) => {
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return;

    // Record which strategy was chosen
    const lastResponse = conversationState.responseHistory[conversationState.responseHistory.length - 1];
    if (lastResponse) {
      lastResponse.strategyChosen = recommendation.strategy;
    }

    // If strategy involves showing content, add them to presented list
    if (recommendation.products.length > 0) {
      // Note: recommendation.products still uses product format for compatibility
      const contentKeys = recommendation.products.map(p => `product:${p.id}`);
      const newPresented = [...new Set([...selectedContent, ...contentKeys])];
      setSelectedContent(newPresented);
      // Update session with product IDs for backward compatibility
      const productIds = newPresented
        .filter(k => k.startsWith('product:'))
        .map(k => parseInt(k.split(':')[1]));
      updateSession({ products_presented: productIds });
    }

    // Update offers presented
    const newOffersPresented = [...conversationState.offersPresented, recommendation.strategy];
    
    // Mark current step as completed
    const updatedSteps = conversationState.dynamicSteps.map((step, idx) => 
      idx === conversationState.currentStep 
        ? { ...step, status: 'completed' as const, completedAt: new Date().toISOString(), response: lastResponse?.responseType }
        : step
    );

    // Clear recommendations
    setAiRecommendations([]);

    // Generate next step based on chosen strategy
    const nextStepType = STRATEGY_TO_STEP_TYPE[recommendation.strategy];
    await generateNextStep(nextStepType, lastResponse?.responseType, recommendation.strategy, updatedSteps, newOffersPresented);
  };

  // Generate a dynamic step
  const generateStep = async (
    stepType: StepType,
    previousSteps: DynamicStep[],
    lastResponse?: ResponseType,
    chosenStrategy?: OfferStrategy
  ): Promise<DynamicStep | null> => {
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return null;

    try {
      const res = await fetch('/api/admin/sales/generate-step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({
          stepType,
          audit: {
            business_challenges: audit?.business_challenges,
            budget_timeline: audit?.budget_timeline,
            ai_readiness: audit?.ai_readiness,
            automation_needs: audit?.automation_needs,
            decision_making: audit?.decision_making,
            urgency_score: audit?.urgency_score,
            opportunity_score: audit?.opportunity_score,
            key_insights: audit?.key_insights,
            sales_notes: audit?.sales_notes,
          },
          clientName: contact?.name,
          clientCompany: contact?.company,
          previousSteps,
          lastResponse,
          chosenStrategy,
          availableContent: content.filter(c => c.is_active),
          conversationHistory: conversationState.responseHistory,
          contactSubmissionId: contact?.id ? parseInt(contact.id, 10) : null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return data.step;
      }
    } catch (err) {
      console.error('Failed to generate step:', err);
    }
    return null;
  };

  // Start the call - generate opening step
  const startCall = async () => {
    setIsLoadingNextStep(true);
    setConversationState(prev => ({ ...prev, isCallActive: true }));

    const openingStep = await generateStep('opening', []);
    
    if (openingStep) {
      openingStep.status = 'active';
      setConversationState(prev => ({
        ...prev,
        dynamicSteps: [openingStep],
        currentStep: 0,
      }));
    }
    
    setIsLoadingNextStep(false);
  };

  // Generate next step after strategy selection
  const generateNextStep = async (
    stepType: StepType,
    lastResponse?: ResponseType,
    chosenStrategy?: OfferStrategy,
    currentSteps?: DynamicStep[],
    currentOffers?: string[]
  ) => {
    setIsLoadingNextStep(true);
    
    const stepsToUse = currentSteps || conversationState.dynamicSteps;
    const offersToUse = currentOffers || conversationState.offersPresented;

    const newStep = await generateStep(stepType, stepsToUse, lastResponse, chosenStrategy);
    
    if (newStep) {
      newStep.status = 'active';
      setConversationState(prev => ({
        ...prev,
        dynamicSteps: [...stepsToUse, newStep],
        currentStep: stepsToUse.length,
        offersPresented: offersToUse,
      }));
    }
    
    setIsLoadingNextStep(false);
  };

  // Complete current step
  const handleCompleteStep = (stepId: string) => {
    setConversationState(prev => ({
      ...prev,
      dynamicSteps: prev.dynamicSteps.map(step =>
        step.id === stepId 
          ? { ...step, status: 'completed' as const, completedAt: new Date().toISOString() }
          : step
      ),
    }));
  };

  // Refresh AI recommendations
  const refreshRecommendations = () => {
    if (conversationState.responseHistory.length > 0) {
      const lastResponse = conversationState.responseHistory[conversationState.responseHistory.length - 1];
      handleClientResponse(lastResponse.responseType, lastResponse.notes);
    }
  };

  // Convert content to ProductWithRole format for compatibility with existing helpers
  const contentAsProducts: ProductWithRole[] = content.map(c => ({
    id: parseInt(c.content_id) || 0,
    title: c.title,
    description: c.description,
    type: c.content_type,
    price: c.price,
    file_path: null,
    image_url: c.image_url,
    is_active: c.is_active,
    is_featured: false,
    display_order: c.display_order,
    role_id: c.role_id,
    offer_role: c.offer_role,
    dream_outcome_description: c.dream_outcome_description,
    likelihood_multiplier: c.likelihood_multiplier,
    time_reduction: c.time_reduction,
    effort_reduction: c.effort_reduction,
    role_retail_price: c.role_retail_price,
    offer_price: c.offer_price,
    perceived_value: c.perceived_value,
    bonus_name: c.bonus_name,
    bonus_description: c.bonus_description,
    qualifying_actions: c.qualifying_actions,
    payout_type: c.payout_type,
  }));

  // Get recommended content based on funnel stage
  const recommendedProducts = salesSession 
    ? getRecommendedProducts(contentAsProducts, salesSession.funnel_stage)
    : [];

  // Build grand slam offer from selected content
  const selectedContentDetails = content.filter(c => 
    selectedContent.includes(`${c.content_type}:${c.content_id}`)
  );
  const contentKey = (c: ContentWithRole) => `${c.content_type}:${c.content_id}`;
  const selectedAsProducts: ProductWithRole[] = selectedContentDetails.map(c => {
    const key = contentKey(c);
    const override = priceOverrides[key];
    return {
      id: parseInt(c.content_id) || 0,
      title: c.title,
      description: c.description,
      type: c.content_type,
      price: c.price,
      file_path: null,
      image_url: c.image_url,
      is_active: c.is_active,
      is_featured: false,
      display_order: c.display_order,
      role_id: c.role_id,
      offer_role: c.offer_role,
      dream_outcome_description: c.dream_outcome_description,
      likelihood_multiplier: c.likelihood_multiplier,
      time_reduction: c.time_reduction,
      effort_reduction: c.effort_reduction,
      role_retail_price: override?.retail_price ?? c.role_retail_price,
      offer_price: c.offer_price,
      perceived_value: override?.perceived_value ?? c.perceived_value,
      bonus_name: c.bonus_name,
      bonus_description: c.bonus_description,
      qualifying_actions: c.qualifying_actions,
      payout_type: c.payout_type,
    };
  });
  const grandSlamOffer = buildGrandSlamOffer(selectedAsProducts);

  // Find objection handlers
  const objectionHandlers = objectionInput 
    ? findObjectionHandlers(objectionInput)
    : [];

  // Group content by type first, then by role
  const contentByTypeAndRole = content.reduce((acc, item) => {
    const type = item.content_type;
    const role = item.offer_role || 'unclassified';
    if (!acc[type]) acc[type] = {};
    if (!acc[type][role]) acc[type][role] = [];
    acc[type][role].push(item);
    return acc;
  }, {} as Record<ContentType, Record<string, ContentWithRole[]>>);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-gray-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading client information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-white mb-2">Error Loading Data</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/admin/sales')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Breadcrumbs 
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Sales', href: '/admin/sales' },
            { label: contact?.name || 'Client Walkthrough' },
          ]} 
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/sales')}
              className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">
                Sales Call: {contact?.name}
              </h1>
              <p className="text-gray-400">{contact?.company || contact?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isSaving && (
              <span className="text-sm text-gray-400 flex items-center gap-1">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            )}

            {/* Lead dashboard link (when diagnostic completed and has contact) */}
            {audit?.status === 'completed' && (contact || audit.contact_submission_id) && (
              <div className="flex items-center gap-2">
                {leadDashboardUrl ? (
                  <>
                    <a
                      href={leadDashboardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-blue-600/20 border border-blue-500/50 rounded-lg text-blue-300 text-sm hover:bg-blue-600/30 flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open dashboard
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(leadDashboardUrl);
                        setLeadDashboardCopied(true);
                        setTimeout(() => setLeadDashboardCopied(false), 2000);
                      }}
                      className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      {leadDashboardCopied ? 'Copied' : 'Copy link'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={isCreatingLeadDashboard}
                    onClick={async () => {
                      const authSession = await getCurrentSession();
                      if (!authSession?.access_token) return;
                      setIsCreatingLeadDashboard(true);
                      try {
                        const res = await fetch('/api/admin/lead-dashboard', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${authSession.access_token}`,
                          },
                          body: JSON.stringify({ diagnostic_audit_id: auditId }),
                        });
                        const data = await res.json();
                        if (res.ok && data.url) {
                          setLeadDashboardUrl(data.url);
                        }
                      } finally {
                        setIsCreatingLeadDashboard(false);
                      }
                    }}
                    className="px-3 py-2 bg-blue-600/20 border border-blue-500/50 rounded-lg text-blue-300 text-sm hover:bg-blue-600/30 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isCreatingLeadDashboard ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LayoutDashboard className="w-4 h-4" />
                    )}
                    Share lead dashboard
                  </button>
                )}
              </div>
            )}
            
            {/* Outcome selector */}
            <select
              value={salesSession?.outcome || 'in_progress'}
              onChange={(e) => handleOutcomeChange(e.target.value as SessionOutcome)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            >
              <option value="in_progress">In Progress</option>
              <option value="converted">Converted</option>
              <option value="downsold">Downsold</option>
              <option value="deferred">Needs Follow-up</option>
              <option value="lost">Lost</option>
            </select>

            {/* Loss reason dropdown — shown only when outcome is 'lost' */}
            {salesSession?.outcome === 'lost' && (
              <select
                value={salesSession?.loss_reason || ''}
                onChange={(e) => handleLossReasonChange(e.target.value || null)}
                className="px-3 py-2 bg-gray-800 border border-red-700/50 rounded-lg text-white"
              >
                <option value="">Select reason...</option>
                <option value="price">Price Too High</option>
                <option value="timing">Bad Timing</option>
                <option value="feature_gap">Feature Gap</option>
                <option value="competitor">Chose Competitor</option>
                <option value="no_budget">No Budget</option>
                <option value="no_need">No Need</option>
                <option value="ghosted">Ghosted</option>
                <option value="other">Other</option>
              </select>
            )}
          </div>
        </div>

        {/* Funnel Stage */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Client Stage</h3>
          <FunnelStageSelector
            currentStage={salesSession?.funnel_stage || 'prospect'}
            onChange={handleStageChange}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Client Context */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="font-medium text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-500" />
                Client Information
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span>{contact?.email}</span>
                </div>
                {contact?.company && (
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Building className="w-4 h-4 text-gray-500" />
                    <span>{contact.company}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Diagnostic Summary */}
            {audit && (
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                <h3 className="font-medium text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-500" />
                  Diagnostic Results
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                    <div className="text-2xl font-bold text-red-400">
                      {audit.urgency_score ?? '-'}/10
                    </div>
                    <div className="text-xs text-red-400">Urgency</div>
                  </div>
                  <div className="text-center p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
                    <div className="text-2xl font-bold text-green-400">
                      {audit.opportunity_score ?? '-'}/10
                    </div>
                    <div className="text-xs text-green-400">Opportunity</div>
                  </div>
                </div>

                {/* Key Insights */}
                {audit.key_insights && audit.key_insights.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Key Insights</h4>
                    <ul className="space-y-1">
                      {audit.key_insights.map((insight, i) => (
                        <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Expandable Diagnostic Details */}
                <div className="space-y-2 border-t border-gray-700 pt-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Detailed Assessment</h4>
                  
                  {/* Business Challenges */}
                  {audit.business_challenges && (
                    <DiagnosticSection
                      title="Business Challenges"
                      icon="🎯"
                      isExpanded={expandedDiagnosticSection === 'challenges'}
                      onToggle={() => setExpandedDiagnosticSection(
                        expandedDiagnosticSection === 'challenges' ? null : 'challenges'
                      )}
                    >
                      {audit.business_challenges.primary_challenges && (
                        <div className="mb-3">
                          <span className="text-xs text-gray-500">Primary Challenges:</span>
                          <ul className="mt-1 space-y-1">
                            {audit.business_challenges.primary_challenges.map((c, i) => (
                              <li key={i} className="text-sm text-red-300">• {c}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {audit.business_challenges.pain_points && (
                        <div className="mb-3">
                          <span className="text-xs text-gray-500">Pain Points:</span>
                          <ul className="mt-1 space-y-1">
                            {audit.business_challenges.pain_points.map((p, i) => (
                              <li key={i} className="text-sm text-orange-300">• {p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {audit.business_challenges.current_impact && (
                        <div className="p-2 bg-red-500/10 rounded text-sm text-red-300">
                          💰 Impact: {audit.business_challenges.current_impact}
                        </div>
                      )}
                    </DiagnosticSection>
                  )}
                  
                  {/* Tech Stack */}
                  {audit.tech_stack && (
                    <DiagnosticSection
                      title="Current Tech Stack"
                      icon="🔧"
                      isExpanded={expandedDiagnosticSection === 'tech'}
                      onToggle={() => setExpandedDiagnosticSection(
                        expandedDiagnosticSection === 'tech' ? null : 'tech'
                      )}
                    >
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {audit.tech_stack.crm && (
                          <div><span className="text-gray-500">CRM:</span> <span className="text-blue-300">{audit.tech_stack.crm}</span></div>
                        )}
                        {audit.tech_stack.email && (
                          <div><span className="text-gray-500">Email:</span> <span className="text-blue-300">{audit.tech_stack.email}</span></div>
                        )}
                        {audit.tech_stack.marketing && (
                          <div><span className="text-gray-500">Marketing:</span> <span className="text-blue-300">{audit.tech_stack.marketing}</span></div>
                        )}
                        {audit.tech_stack.analytics && (
                          <div><span className="text-gray-500">Analytics:</span> <span className="text-blue-300">{audit.tech_stack.analytics}</span></div>
                        )}
                      </div>
                      {audit.tech_stack.other_tools && audit.tech_stack.other_tools.length > 0 && (
                        <div className="mt-2 text-sm">
                          <span className="text-gray-500">Other:</span>{' '}
                          <span className="text-gray-300">{audit.tech_stack.other_tools.join(', ')}</span>
                        </div>
                      )}
                      {audit.tech_stack.integration_readiness && (
                        <div className="mt-2 p-2 bg-blue-500/10 rounded text-sm text-blue-300">
                          ✓ {audit.tech_stack.integration_readiness}
                        </div>
                      )}
                    </DiagnosticSection>
                  )}
                  
                  {/* Automation Needs */}
                  {audit.automation_needs && (
                    <DiagnosticSection
                      title="Automation Needs"
                      icon="⚡"
                      isExpanded={expandedDiagnosticSection === 'automation'}
                      onToggle={() => setExpandedDiagnosticSection(
                        expandedDiagnosticSection === 'automation' ? null : 'automation'
                      )}
                    >
                      {audit.automation_needs.priority_areas && (
                        <div className="mb-3">
                          <span className="text-xs text-gray-500">Priority Areas:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {audit.automation_needs.priority_areas.map((area, i) => (
                              <span key={i} className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">
                                {area}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {audit.automation_needs.desired_outcomes && (
                        <div>
                          <span className="text-xs text-gray-500">Desired Outcomes:</span>
                          <ul className="mt-1 space-y-1">
                            {audit.automation_needs.desired_outcomes.map((o, i) => (
                              <li key={i} className="text-sm text-green-300">✓ {o}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </DiagnosticSection>
                  )}
                  
                  {/* AI Readiness */}
                  {audit.ai_readiness && (
                    <DiagnosticSection
                      title="AI Readiness"
                      icon="🤖"
                      isExpanded={expandedDiagnosticSection === 'ai'}
                      onToggle={() => setExpandedDiagnosticSection(
                        expandedDiagnosticSection === 'ai' ? null : 'ai'
                      )}
                    >
                      <div className="space-y-2 text-sm">
                        {audit.ai_readiness.data_quality && (
                          <div><span className="text-gray-500">Data Quality:</span> <span className="text-gray-300">{audit.ai_readiness.data_quality}</span></div>
                        )}
                        {audit.ai_readiness.team_readiness && (
                          <div><span className="text-gray-500">Team Readiness:</span> <span className="text-gray-300">{audit.ai_readiness.team_readiness}</span></div>
                        )}
                        {audit.ai_readiness.previous_ai_experience && (
                          <div><span className="text-gray-500">AI Experience:</span> <span className="text-gray-300">{audit.ai_readiness.previous_ai_experience}</span></div>
                        )}
                      </div>
                      {audit.ai_readiness.concerns && audit.ai_readiness.concerns.length > 0 && (
                        <div className="mt-2 p-2 bg-yellow-500/10 rounded">
                          <span className="text-xs text-yellow-400">⚠️ Concerns:</span>
                          <div className="text-sm text-yellow-300 mt-1">
                            {audit.ai_readiness.concerns.join(', ')}
                          </div>
                        </div>
                      )}
                    </DiagnosticSection>
                  )}
                  
                  {/* Budget & Timeline */}
                  {audit.budget_timeline && (
                    <DiagnosticSection
                      title="Budget & Timeline"
                      icon="💰"
                      isExpanded={expandedDiagnosticSection === 'budget'}
                      onToggle={() => setExpandedDiagnosticSection(
                        expandedDiagnosticSection === 'budget' ? null : 'budget'
                      )}
                    >
                      <div className="space-y-2 text-sm">
                        {audit.budget_timeline.budget_range && (
                          <div className="p-2 bg-green-500/10 rounded text-green-300">
                            💵 Budget: {audit.budget_timeline.budget_range}
                          </div>
                        )}
                        {audit.budget_timeline.timeline && (
                          <div><span className="text-gray-500">Timeline:</span> <span className="text-gray-300">{audit.budget_timeline.timeline}</span></div>
                        )}
                        {audit.budget_timeline.decision_timeline && (
                          <div><span className="text-gray-500">Decision Timeline:</span> <span className="text-gray-300">{audit.budget_timeline.decision_timeline}</span></div>
                        )}
                        {audit.budget_timeline.budget_flexibility && (
                          <div className="text-xs text-gray-400 italic">{audit.budget_timeline.budget_flexibility}</div>
                        )}
                      </div>
                    </DiagnosticSection>
                  )}
                  
                  {/* Decision Making */}
                  {audit.decision_making && (
                    <DiagnosticSection
                      title="Decision Making"
                      icon="👤"
                      isExpanded={expandedDiagnosticSection === 'decision'}
                      onToggle={() => setExpandedDiagnosticSection(
                        expandedDiagnosticSection === 'decision' ? null : 'decision'
                      )}
                    >
                      <div className="space-y-2 text-sm">
                        {audit.decision_making.decision_maker !== undefined && (
                          <div className={`p-2 rounded ${audit.decision_making.decision_maker ? 'bg-green-500/10 text-green-300' : 'bg-yellow-500/10 text-yellow-300'}`}>
                            {audit.decision_making.decision_maker ? '✓ Is the decision maker' : '⚠️ Not the final decision maker'}
                          </div>
                        )}
                        {audit.decision_making.stakeholders && audit.decision_making.stakeholders.length > 0 && (
                          <div><span className="text-gray-500">Stakeholders:</span> <span className="text-gray-300">{audit.decision_making.stakeholders.join(', ')}</span></div>
                        )}
                        {audit.decision_making.approval_process && (
                          <div><span className="text-gray-500">Process:</span> <span className="text-gray-300">{audit.decision_making.approval_process}</span></div>
                        )}
                      </div>
                    </DiagnosticSection>
                  )}
                </div>

                {/* Sales Notes from Diagnostic */}
                {audit.sales_notes && (
                  <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <h4 className="text-sm font-medium text-yellow-400 mb-1">📌 Sales Notes</h4>
                    <p className="text-sm text-yellow-200">{audit.sales_notes}</p>
                  </div>
                )}
              </div>
            )}
            
            {/* AI Insights Generator */}
            {audit && (
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-white flex items-center gap-2">
                    <span className="text-lg">✨</span>
                    AI Sales Assistant
                  </h3>
                  <button
                    onClick={generateAIInsights}
                    disabled={isGeneratingAI}
                    className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isGeneratingAI ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Generate Insights
                      </>
                    )}
                  </button>
                </div>
                
                {aiInsights ? (
                  <div className="space-y-4">
                    {/* Opening Line */}
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <h4 className="text-xs font-medium text-emerald-400 mb-1">Suggested Opening</h4>
                      <p className="text-sm text-emerald-200">&quot;{aiInsights.openingLine}&quot;</p>
                    </div>
                    
                    {/* Key Pain Points to Address */}
                    <div>
                      <h4 className="text-xs font-medium text-gray-400 mb-2">Key Pain Points to Address</h4>
                      <div className="flex flex-wrap gap-1">
                        {aiInsights.keyPainPoints.map((point, i) => (
                          <span key={i} className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs">
                            {point}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Anticipated Objections */}
                    <div>
                      <h4 className="text-xs font-medium text-gray-400 mb-2">Anticipated Objections</h4>
                      <div className="space-y-2">
                        {aiInsights.anticipatedObjections.map((obj, i) => (
                          <div key={i} className="p-2 bg-orange-500/10 rounded text-sm">
                            <div className="text-orange-400 font-medium">&quot;{obj.objection}&quot;</div>
                            <div className="text-xs text-gray-500 my-1">Likely because: {obj.likelyTrigger}</div>
                            <div className="text-gray-300">→ {obj.response}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    Click &quot;Generate Insights&quot; to get AI-powered talking points, 
                    product recommendations, and objection handlers customized for this client&apos;s diagnostic data.
                  </p>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-yellow-500" />
                Call Notes
              </h3>
              
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes from the call..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500"
                rows={4}
              />
              <button
                onClick={saveNotes}
                className="mt-2 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 flex items-center gap-1"
              >
                <Save className="w-4 h-4" />
                Save Notes
              </button>
            </div>

            {/* Conversation Timeline */}
            {conversationState.responseHistory.length > 0 && (
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                <ConversationTimeline
                  responses={conversationState.responseHistory}
                  currentStep={expandedStep}
                  compact={false}
                />
              </div>
            )}

            {/* Value Evidence Panel */}
            <ValueEvidencePanel
              contactId={contact?.id ? parseInt(contact.id, 10) : null}
              industry={contact?.industry || null}
              companySize={contact?.employee_count || null}
              companyName={contact?.company || null}
              onReportGenerated={(id: string) => setValueReportId(id)}
            />
          </div>

          {/* Center Panel - Main Content */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('script')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  activeTab === 'script'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-900 border border-gray-700 text-gray-300 hover:border-purple-500/50'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Script Guide
              </button>
              <button
                onClick={() => setActiveTab('products')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  activeTab === 'products'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-900 border border-gray-700 text-gray-300 hover:border-purple-500/50'
                }`}
              >
                <DollarSign className="w-4 h-4 inline mr-2" />
                Products
              </button>
              <button
                onClick={() => setActiveTab('objections')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  activeTab === 'objections'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-900 border border-gray-700 text-gray-300 hover:border-purple-500/50'
                }`}
              >
                <AlertCircle className="w-4 h-4 inline mr-2" />
                Objections
              </button>
            </div>

            {/* Tab Content */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              {activeTab === 'script' && (
                <div>
                  {/* Value evidence summary for conversation guidance */}
                  {scriptValueEvidence && (scriptValueEvidence.painPoints.length > 0 || scriptValueEvidence.totalAnnualValue != null) && (
                    <div className="mb-4 p-4 rounded-lg border border-green-800/50 bg-green-950/30">
                      <h4 className="text-sm font-medium text-green-300 mb-2 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Value evidence for this call
                      </h4>
                      <ul className="text-sm text-gray-300 space-y-1">
                        {scriptValueEvidence.painPoints.map((pp, i) => (
                          <li key={i}>
                            {pp.display_name || 'Pain point'}: ${pp.monetary_indicator.toLocaleString()}/yr
                            {pp.monetary_context && <span className="text-gray-500"> — {pp.monetary_context}</span>}
                          </li>
                        ))}
                        {scriptValueEvidence.totalAnnualValue != null && (
                          <li className="font-medium text-green-400 pt-1 border-t border-green-800/30 mt-2">
                            Total value (report): ${scriptValueEvidence.totalAnnualValue.toLocaleString()}/yr
                          </li>
                        )}
                      </ul>
                      <p className="text-xs text-gray-500 mt-2">Use these numbers to guide the conversation and price the offer.</p>
                    </div>
                  )}
                  {/* Dynamic Script Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-medium text-white text-lg">
                        Dynamic Sales Script
                      </h3>
                      <p className="text-sm text-gray-400">
                        {conversationState.isCallActive 
                          ? `Adapts in real-time based on ${contact?.name || 'client'}'s responses`
                          : 'AI-powered script that evolves with the conversation'
                        }
                      </p>
                    </div>
                    {conversationState.isCallActive && conversationState.dynamicSteps.length > 0 && (
                      <div className="text-right text-sm">
                        <div className="text-gray-400">
                          {conversationState.dynamicSteps.filter(s => s.status === 'completed').length} / {conversationState.dynamicSteps.length} steps
                        </div>
                        <div className="flex items-center gap-2 text-xs mt-1">
                          <span className="text-green-400">{conversationState.positiveSignals} positive</span>
                          <span className="text-gray-600">|</span>
                          <span className="text-orange-400">{conversationState.objectionsRaised.length} objections</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dynamic Script Flow */}
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

              {activeTab === 'products' && (
                <div>
                  {/* Bundle Quick Start */}
                  {bundles.length > 0 && (
                    <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-purple-400" />
                          <span className="text-sm font-medium text-white">Quick Start from Bundle</span>
                        </div>
                        {selectedBundleId && (
                          <span className="text-xs text-purple-400 flex items-center gap-1">
                            <GitFork className="w-3 h-3" />
                            Using bundle template
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {bundles.slice(0, 5).map((bundle) => (
                          <button
                            key={bundle.id}
                            onClick={() => applyBundle(bundle.id)}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                              selectedBundleId === bundle.id
                                ? 'bg-purple-900/50 border-purple-500 text-purple-200'
                                : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                            }`}
                          >
                            {bundle.name}
                            <span className="ml-1 text-xs text-gray-400">({bundle.item_count})</span>
                          </button>
                        ))}
                        {bundles.length > 5 && (
                          <button
                            onClick={() => setShowBundleSelector(true)}
                            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
                          >
                            +{bundles.length - 5} more
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-white">
                      Select Content for Offer
                    </h3>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          const allTypes = Object.keys(contentByTypeAndRole);
                          if (collapsedContentGroups.size === allTypes.length) {
                            setCollapsedContentGroups(new Set());
                          } else {
                            setCollapsedContentGroups(new Set(allTypes));
                          }
                        }}
                        className="text-xs text-gray-400 hover:text-white transition-colors"
                      >
                        {collapsedContentGroups.size === Object.keys(contentByTypeAndRole).length 
                          ? 'Expand All' 
                          : 'Collapse All'}
                      </button>
                      <span className="text-sm text-gray-400">
                        {selectedContent.length} selected
                      </span>
                    </div>
                  </div>

                  {/* Content by type, then by role */}
                  {Object.entries(contentByTypeAndRole).map(([contentType, roleGroups]) => {
                    const isCollapsed = collapsedContentGroups.has(contentType);
                    const itemCount = Object.values(roleGroups).flat().length;
                    const selectedInGroup = Object.values(roleGroups).flat().filter(
                      item => selectedContent.includes(`${item.content_type}:${item.content_id}`)
                    ).length;
                    
                    return (
                      <div key={contentType} className="mb-4">
                        {/* Content Type Header - Clickable */}
                        <button
                          onClick={() => {
                            setCollapsedContentGroups(prev => {
                              const next = new Set(prev);
                              if (next.has(contentType)) {
                                next.delete(contentType);
                              } else {
                                next.add(contentType);
                              }
                              return next;
                            });
                          }}
                          className="w-full flex items-center gap-2 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700 transition-colors"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                          <span className="text-xl">{CONTENT_TYPE_ICONS[contentType as ContentType]}</span>
                          <h3 className="font-medium text-white">
                            {CONTENT_TYPE_LABELS[contentType as ContentType]}
                          </h3>
                          <span className="text-gray-500 text-sm">
                            ({itemCount})
                          </span>
                          {selectedInGroup > 0 && (
                            <span className="ml-auto px-2 py-0.5 text-xs bg-blue-900/50 text-blue-300 rounded">
                              {selectedInGroup} selected
                            </span>
                          )}
                        </button>

                        {/* Roles within this content type - Collapsible */}
                        {!isCollapsed && (
                          <div className="mt-3 ml-2 pl-4 border-l border-gray-700">
                            {Object.entries(roleGroups).map(([role, items]) => (
                              <div key={`${contentType}-${role}`} className="mb-4">
                                <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                                  {OFFER_ROLE_LABELS[role as OfferRole] || 'Unclassified'}
                                  <span className="text-gray-500">({items.length})</span>
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {items.map((item) => {
                                    const contentKey = `${item.content_type}:${item.content_id}`;
                                    return (
                                      <ContentOfferCard
                                        key={contentKey}
                                        content={item}
                                        compact
                                        showAddButton
                                        isSelected={selectedContent.includes(contentKey)}
                                        onAdd={() => toggleContent(item.content_type, item.content_id)}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Selected Offer Preview */}
                  {selectedContent.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-700">
                      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <h4 className="font-medium text-white">Your Offer Stack</h4>
                        <div className="flex items-center gap-2">
                          {contact?.id && (
                            <button
                              onClick={async () => {
                                const session = await getCurrentSession();
                                if (!session?.access_token || selectedContentDetails.length === 0) return;
                                setIsApplyingEvidencePricing(true);
                                try {
                                  const next: Record<string, { retail_price: number; perceived_value: number }> = {};
                                  for (const c of selectedContentDetails) {
                                    const res = await fetch('/api/admin/value-evidence/suggest-pricing', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${session.access_token}`,
                                      },
                                      body: JSON.stringify({
                                        content_type: c.content_type,
                                        content_id: c.content_id,
                                        contact_submission_id: parseInt(contact.id, 10),
                                        industry: contact.industry || undefined,
                                        company_size: contact.employee_count || undefined,
                                      }),
                                    });
                                    if (res.ok) {
                                      const data = await res.json();
                                      const p = data.pricing;
                                      if (p?.suggestedRetailPrice != null && p?.suggestedPerceivedValue != null) {
                                        next[`${c.content_type}:${c.content_id}`] = {
                                          retail_price: Number(p.suggestedRetailPrice),
                                          perceived_value: Number(p.suggestedPerceivedValue),
                                        };
                                      }
                                    }
                                  }
                                  setPriceOverrides(prev => ({ ...prev, ...next }));
                                } finally {
                                  setIsApplyingEvidencePricing(false);
                                }
                              }}
                              disabled={isApplyingEvidencePricing}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-900/50 border border-green-700/50 text-green-300 hover:bg-green-900/70 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {isApplyingEvidencePricing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                              Apply evidence-based pricing
                            </button>
                          )}
                          <button
                            onClick={() => setShowSaveAsBundle(true)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                          >
                            <Save className="w-3 h-3" />
                            Save as Bundle
                          </button>
                        </div>
                      </div>
                      <OfferStack
                        products={selectedAsProducts}
                        totalPrice={grandSlamOffer.offerPrice}
                        totalValue={grandSlamOffer.totalPerceivedValue}
                      />
                      
                      {/* Generate Proposal Section */}
                      <div className="mt-6 pt-6 border-t border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-medium text-white flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-400" />
                              Convert to Proposal
                            </h4>
                            <p className="text-sm text-gray-400 mt-1">
                              Generate a proposal document for the client to review and accept
                            </p>
                          </div>
                        </div>
                        
                        {currentProposal ? (
                          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-xs rounded ${
                                  currentProposal.status === 'paid' 
                                    ? 'bg-green-900/50 text-green-300'
                                    : currentProposal.status === 'accepted'
                                    ? 'bg-blue-900/50 text-blue-300'
                                    : currentProposal.status === 'viewed'
                                    ? 'bg-yellow-900/50 text-yellow-300'
                                    : 'bg-gray-700 text-gray-300'
                                }`}>
                                  {currentProposal.status.charAt(0).toUpperCase() + currentProposal.status.slice(1)}
                                </span>
                                <span className="text-sm text-gray-400">
                                  Proposal #{currentProposal.id.slice(0, 8).toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={currentProposal.proposalLink}
                                readOnly
                                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300"
                              />
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(currentProposal.proposalLink);
                                }}
                                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                                title="Copy link"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <a
                                href={currentProposal.proposalLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                                title="Open proposal"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                            <button
                              onClick={() => setShowProposalModal(true)}
                              className="mt-3 w-full text-sm text-gray-400 hover:text-white transition-colors"
                            >
                              Generate new proposal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowProposalModal(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            <CreditCard className="w-4 h-4" />
                            Generate Proposal & Payment Link
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'objections' && (
                <div>
                  <h3 className="font-medium text-white mb-4">Objection Handler</h3>
                  
                  <div className="mb-6">
                    <label className="block text-sm text-gray-400 mb-2">
                      What objection did they raise?
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={objectionInput}
                        onChange={(e) => setObjectionInput(e.target.value)}
                        placeholder="e.g., too expensive, need to think about it..."
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                      />
                    </div>
                  </div>

                  {objectionHandlers.length > 0 ? (
                    <div className="space-y-4">
                      {objectionHandlers.map((handler, i) => (
                        <div key={i} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                          <div className="text-sm font-medium text-gray-400 mb-2 capitalize">
                            {handler.category} Objection
                          </div>
                          <p className="text-gray-200">{handler.response}</p>
                        </div>
                      ))}
                    </div>
                  ) : objectionInput ? (
                    <p className="text-gray-400 text-center py-8">
                      No specific handler found. Try describing the objection differently.
                    </p>
                  ) : (
                    <div className="text-gray-500 text-center py-8">
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                      <p>Type an objection above to get suggested responses</p>
                    </div>
                  )}

                  {/* Common objection buttons */}
                  <div className="mt-6 pt-6 border-t border-gray-700">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Quick Access</h4>
                    <div className="flex flex-wrap gap-2">
                      {['too expensive', 'need to think', 'talk to spouse', 'not the right time', 'tried before'].map((obj) => (
                        <button
                          key={obj}
                          onClick={() => setObjectionInput(obj)}
                          className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-full text-sm hover:bg-gray-700"
                        >
                          {obj}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bundle Selector Modal */}
      {showBundleSelector && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-lg max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                Select Bundle Template
              </h3>
              <button 
                onClick={() => setShowBundleSelector(false)}
                className="text-gray-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {bundles.map((bundle) => (
                <button
                  key={bundle.id}
                  onClick={() => applyBundle(bundle.id)}
                  className="w-full text-left p-4 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">{bundle.name}</span>
                    <span className="text-sm text-gray-400">{bundle.item_count} items</span>
                  </div>
                  {bundle.description && (
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">{bundle.description}</p>
                  )}
                  {bundle.bundle_price && (
                    <p className="text-sm text-green-400 mt-2">
                      {formatCurrency(bundle.bundle_price)}
                      {bundle.total_perceived_value && (
                        <span className="text-gray-500 line-through ml-2">
                          {formatCurrency(bundle.total_perceived_value)}
                        </span>
                      )}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Save As Bundle Modal */}
      {showSaveAsBundle && (
        <SaveAsBundleModal
          onClose={() => setShowSaveAsBundle(false)}
          onSave={saveAsBundle}
          itemCount={selectedContent.length}
          parentBundleName={bundles.find(b => b.id === selectedBundleId)?.name}
        />
      )}
      
      {/* Generate Proposal Modal */}
      {showProposalModal && (
        <ProposalModal
          onClose={() => setShowProposalModal(false)}
          contactId={contact?.id ? parseInt(contact.id, 10) : null}
          defaultValueReportId={valueReportId}
          onGenerate={async (data) => {
            const authSession = await getCurrentSession();
            if (!authSession?.access_token) return;
            
            // Build line items from selected content (use evidence-based overrides when set)
            const lineItems = selectedContentDetails.map(c => {
              const key = `${c.content_type}:${c.content_id}`;
              const override = priceOverrides[key];
              return {
                content_type: c.content_type,
                content_id: c.content_id,
                title: c.title,
                description: c.description,
                offer_role: c.offer_role,
                price: override?.retail_price ?? c.role_retail_price ?? c.price ?? 0,
                perceived_value: override?.perceived_value ?? c.perceived_value ?? c.role_retail_price ?? c.price ?? 0,
              };
            });
            
            const response = await fetch('/api/proposals', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authSession.access_token}`,
              },
              body: JSON.stringify({
                sales_session_id: salesSession?.id,
                client_name: data.clientName,
                client_email: data.clientEmail,
                client_company: data.clientCompany,
                bundle_id: selectedBundleId,
                bundle_name: bundles.find(b => b.id === selectedBundleId)?.name || 'Custom Offer',
                line_items: lineItems,
                subtotal: grandSlamOffer.offerPrice,
                discount_amount: data.discountAmount,
                discount_description: data.discountDescription,
                total_amount: grandSlamOffer.offerPrice - (data.discountAmount || 0),
                valid_days: data.validDays,
                value_report_id: data.valueReportId || undefined,
              }),
            });
            
            if (response.ok) {
              const result = await response.json();
              setCurrentProposal({
                id: result.proposal.id,
                status: result.proposal.status,
                proposalLink: result.proposalLink,
              });
              setShowProposalModal(false);
            } else {
              throw new Error('Failed to create proposal');
            }
          }}
          defaultClientName={contact?.name || ''}
          defaultClientEmail={contact?.email || ''}
          defaultClientCompany={contact?.company || ''}
          totalAmount={grandSlamOffer.offerPrice}
        />
      )}
    </div>
  );
}

// Save As Bundle Modal
function SaveAsBundleModal({
  onClose,
  onSave,
  itemCount,
  parentBundleName,
}: {
  onClose: () => void;
  onSave: (name: string, description?: string) => void;
  itemCount: number;
  parentBundleName?: string;
}) {
  const [name, setName] = useState(parentBundleName ? `${parentBundleName} - Modified` : '');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    await onSave(name.trim(), description.trim() || undefined);
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-400" />
            Save as New Bundle
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Bundle Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Enterprise Premium Pack"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this bundle..."
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          <div className="text-sm text-gray-400">
            This bundle will contain <span className="text-white font-medium">{itemCount} items</span>
            {parentBundleName && (
              <span className="block mt-1 text-purple-400">
                <GitFork className="w-3 h-3 inline mr-1" />
                Forked from &quot;{parentBundleName}&quot;
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Bundle
          </button>
        </div>
      </div>
    </div>
  );
}

// Script Step Component
interface ScriptStepProps {
  step: number;
  title: string;
  talkingPoints: string[];
  isExpanded: boolean;
  onToggle: () => void;
}

function ScriptStep({ step, title, talkingPoints, isExpanded, onToggle }: ScriptStepProps) {
  return (
    <div className="border border-gray-700 bg-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center font-medium">
            {step}
          </span>
          <span className="font-medium text-white">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-700">
          <ul className="mt-3 space-y-2">
            {talkingPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
