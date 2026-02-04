'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getCurrentSession } from '@/lib/auth';
import { 
  ProductWithRole,
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
  FUNNEL_STAGE_LABELS,
  OFFER_ROLE_LABELS,
  RESPONSE_TYPE_LABELS,
  OFFER_STRATEGY_LABELS,
  STRATEGY_TO_STEP_TYPE,
  findObjectionHandlers,
  getRecommendedProducts,
  buildGrandSlamOffer,
} from '@/lib/sales-scripts';
import { FunnelStageSelector } from '@/components/admin/sales/FunnelStageSelector';
import { OfferCard, OfferStack } from '@/components/admin/sales/OfferCard';
import { ResponseBar } from '@/components/admin/sales/ResponseBar';
import { AIRecommendationPanel } from '@/components/admin/sales/AIRecommendationPanel';
import { ConversationTimeline, ConversationStats } from '@/components/admin/sales/ConversationTimeline';
import { DynamicScriptFlow } from '@/components/admin/sales/DynamicScriptFlow';
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
} from 'lucide-react';

interface DiagnosticAudit {
  id: string;
  session_id: string;
  contact_id: string | null;
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
  const [products, setProducts] = useState<ProductWithRole[]>([]);
  const [scripts, setScripts] = useState<SalesScript[]>([]);
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'script' | 'products' | 'objections'>('script');
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [expandedStep, setExpandedStep] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [objectionInput, setObjectionInput] = useState('');
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  
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

  // Load initial data
  const fetchData = useCallback(async () => {
    const authSession = await getCurrentSession();
    if (!authSession?.access_token) return;
    
    setIsLoading(true);
    setError(null);
    
    const headers = { Authorization: `Bearer ${authSession.access_token}` };
    
    try {
      // Fetch audit details, products, scripts in parallel
      const [auditRes, productsRes, scriptsRes, sessionsRes] = await Promise.all([
        fetch(`/api/admin/sales?status=completed`, { headers }),
        fetch('/api/admin/sales/products', { headers }),
        fetch('/api/admin/sales/scripts', { headers }),
        fetch(`/api/admin/sales/sessions?audit_id=${auditId}`, { headers }),
      ]);

      if (!auditRes.ok || !productsRes.ok || !scriptsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [auditData, productsData, scriptsData, sessionsData] = await Promise.all([
        auditRes.json(),
        productsRes.json(),
        scriptsRes.json(),
        sessionsRes.json(),
      ]);

      // Find the specific audit
      const foundAudit = auditData.audits?.find((a: DiagnosticAudit & { contact_submissions: ContactInfo }) => a.id === auditId);
      if (!foundAudit) {
        throw new Error('Audit not found');
      }

      setAudit(foundAudit);
      setContact(foundAudit.contact_submissions);
      setProducts(productsData.products || []);
      setScripts(scriptsData.scripts || []);

      // Check for existing session
      const existingSession = sessionsData.sessions?.[0];
      if (existingSession) {
        setSalesSession(existingSession);
        setNotes(existingSession.internal_notes || '');
        setSelectedProducts(existingSession.products_presented || []);
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
  }, [auditId, user]);

  // Fetch when user becomes available
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

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
  };

  // Handle product selection
  const toggleProduct = (productId: number) => {
    const newSelection = selectedProducts.includes(productId)
      ? selectedProducts.filter(id => id !== productId)
      : [...selectedProducts, productId];
    
    setSelectedProducts(newSelection);
    updateSession({ products_presented: newSelection });
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
          products: products.filter(p => p.is_active),
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
          productsPresented: selectedProducts,
          availableProducts: products.filter(p => p.is_active),
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

    // If strategy involves showing products, add them to presented list
    if (recommendation.products.length > 0) {
      const productIds = recommendation.products.map(p => p.id);
      const newPresented = [...new Set([...selectedProducts, ...productIds])];
      setSelectedProducts(newPresented);
      updateSession({ products_presented: newPresented });
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
          availableProducts: products.filter(p => p.is_active),
          conversationHistory: conversationState.responseHistory,
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

  // Get recommended products based on funnel stage
  const recommendedProducts = salesSession 
    ? getRecommendedProducts(products, salesSession.funnel_stage)
    : [];

  // Build grand slam offer from selected products
  const selectedProductDetails = products.filter(p => selectedProducts.includes(p.id));
  const grandSlamOffer = buildGrandSlamOffer(selectedProductDetails);

  // Find objection handlers
  const objectionHandlers = objectionInput 
    ? findObjectionHandlers(objectionInput)
    : [];

  // Group products by role
  const productsByRole = products.reduce((acc, product) => {
    const role = product.offer_role || 'unclassified';
    if (!acc[role]) acc[role] = [];
    acc[role].push(product);
    return acc;
  }, {} as Record<string, ProductWithRole[]>);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-gray-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading client information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
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
    <div className="min-h-screen bg-black text-white">
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
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-white">
                      Select Products for Offer
                    </h3>
                    <span className="text-sm text-gray-400">
                      {selectedProducts.length} selected
                    </span>
                  </div>

                  {/* Product categories */}
                  {Object.entries(productsByRole).map(([role, roleProducts]) => (
                    <div key={role} className="mb-6">
                      <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                        {OFFER_ROLE_LABELS[role as OfferRole] || 'Unclassified'}
                        <span className="text-gray-500">({roleProducts.length})</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {roleProducts.map((product) => (
                          <OfferCard
                            key={product.id}
                            product={product}
                            compact
                            showAddButton
                            isSelected={selectedProducts.includes(product.id)}
                            onAdd={() => toggleProduct(product.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Selected Offer Preview */}
                  {selectedProducts.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-700">
                      <h4 className="font-medium text-white mb-4">Your Offer Stack</h4>
                      <OfferStack
                        products={selectedProductDetails}
                        totalPrice={grandSlamOffer.offerPrice}
                        totalValue={grandSlamOffer.totalPerceivedValue}
                      />
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
