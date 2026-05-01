'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  FileText,
  Download,
  CheckCircle,
  CreditCard,
  Clock,
  AlertCircle,
  Loader2,
  ExternalLink,
  Package,
  DollarSign,
  Calendar,
  User,
  Building,
  PenLine,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Target,
  Shield,
  LayoutDashboard,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';
import InstallmentOption from '@/components/checkout/InstallmentOption';
import SiteThemeCorner from '@/components/SiteThemeCorner';

interface LineItem {
  content_type: string;
  content_id: string;
  title: string;
  description?: string;
  offer_role?: string;
  price: number;
  perceived_value?: number;
}

interface ValueStatement {
  painPoint: string;
  painPointId?: string;
  annualValue: number;
  calculationMethod: string;
  formulaReadable: string;
  evidenceSummary: string;
  confidence: 'high' | 'medium' | 'low';
}

interface ValueAssessment {
  totalAnnualValue: number;
  industry: string;
  companySizeRange: string;
  valueStatements: ValueStatement[];
  roi?: number;
  roiStatement?: string;
}

interface Proposal {
  id: string;
  client_name: string;
  client_email: string;
  client_company?: string;
  bundle_name: string;
  line_items: LineItem[];
  subtotal: number;
  discount_amount: number;
  discount_description?: string;
  total_amount: number;
  terms_text?: string;
  valid_until?: string;
  status: string;
  pdf_url?: string;
  contract_pdf_url?: string | null;
  accepted_at?: string;
  paid_at?: string;
  created_at: string;
  value_assessment?: ValueAssessment;
  signed_at?: string;
  signed_by_name?: string;
  contract_signed_at?: string | null;
  contract_signed_by_name?: string | null;
  access_code?: string;
  service_term_months?: number | null;
  feasibility_view?: FeasibilityClientView | null;
  implementation_roadmap_snapshot?: ImplementationRoadmapSnapshot | null;
}

interface ImplementationRoadmapSnapshot {
  title: string;
  clientSummary: string;
  phases: Array<{ title: string; objective: string; acceptanceCriteria: string[] }>;
  tasks: Array<{ title: string; ownerType: 'client' | 'amadutown' | 'shared'; clientVisible: boolean; priority: string }>;
  costSummary: {
    oneTimeClientOwned: number;
    monthlyClientOwned: number;
    amadutownSetup: number;
    quoteRequiredCount: number;
  };
}

interface FeasibilityClientItem {
  title: string;
  fit_summary: string;
  effort_label: string;
  works_with: string[];
  connects_to: string[];
  we_set_up: string[];
}

interface FeasibilityClientView {
  generated_at: string;
  overall_fit_label: string;
  estimated_complexity_label: string;
  items: FeasibilityClientItem[];
  open_decisions: string[];
  headline: string;
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
};

const ROLE_COLORS: Record<string, string> = {
  core_offer: 'bg-blue-900/50 text-blue-300',
  bonus: 'bg-green-900/50 text-green-300',
  upsell: 'bg-purple-900/50 text-purple-300',
  downsell: 'bg-orange-900/50 text-orange-300',
  anchor: 'bg-gray-700 text-gray-300',
  decoy: 'bg-gray-700 text-gray-300',
  lead_magnet: 'bg-emerald-900/50 text-emerald-300',
  continuity: 'bg-indigo-900/50 text-indigo-300',
};

const CALC_METHOD_LABELS: Record<string, string> = {
  time_saved: 'Time Savings',
  error_reduction: 'Error Reduction',
  revenue_acceleration: 'Revenue Acceleration',
  opportunity_cost: 'Opportunity Cost',
  replacement_cost: 'Replacement Cost',
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  medium: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
  low: 'bg-gray-800 text-gray-400 border-gray-700/50',
};

// Wrapper component to handle Suspense for useSearchParams
export default function ProposalByCodePage() {
  return (
    <Suspense
      fallback={
        <div className="relative">
          <SiteThemeCorner />
          <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading proposal...</p>
            </div>
          </div>
        </div>
      }
    >
      <ProposalByCodeContent />
    </Suspense>
  );
}

function ProposalByCodeContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const code = params.code as string;

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [proposalDocuments, setProposalDocuments] = useState<Array<{ id: string; document_type: string; title: string; created_at: string; signedUrl: string | null }>>([]);
  const [canAccept, setCanAccept] = useState(false);
  const [canPay, setCanPay] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingPlanId, setOnboardingPlanId] = useState<string | null>(null);
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null);
  const [showSignForm, setShowSignForm] = useState(false);
  const [signName, setSignName] = useState('');
  const [showContractSignForm, setShowContractSignForm] = useState(false);
  const [contractSignName, setContractSignName] = useState('');
  const [paymentMode, setPaymentMode] = useState<'full' | 'installments'>('full');
  const [numInstallments, setNumInstallments] = useState<number>(3);

  const proposalId = proposal?.id ?? null;

  const paymentStatus = searchParams.get('payment');

  const fetchOnboardingPlan = useCallback(async (propId: string) => {
    try {
      const [planRes, dashRes] = await Promise.all([
        fetch(`/api/proposals/${propId}/onboarding-plan`),
        fetch(`/api/proposals/${propId}/dashboard-link`),
      ]);
      if (planRes.ok) {
        const data = await planRes.json();
        if (data.onboarding_plan_id) {
          setOnboardingPlanId(data.onboarding_plan_id);
        }
      }
      if (dashRes.ok) {
        const data = await dashRes.json();
        if (data.dashboard_url) {
          setDashboardUrl(data.dashboard_url);
        }
      }
    } catch {
      // Silently fail
    }
  }, []);

  const fetchProposal = useCallback(async () => {
    try {
      // Try by-code first (6-char access codes), then fallback to by-id (UUIDs for legacy links)
      let response = await fetch(`/api/proposals/by-code/${code}`);
      if (!response.ok && response.status === 404) {
        response = await fetch(`/api/proposals/${code}`);
      }
      if (!response.ok) {
        throw new Error('Proposal not found');
      }
      const data = await response.json();
      setProposal(data.proposal);
      setProposalDocuments(Array.isArray(data.proposalDocuments) ? data.proposalDocuments : []);
      setCanAccept(data.canAccept);
      setCanPay(data.canPay);
      setIsExpired(data.isExpired);
      if (data.proposal?.client_name) {
        setSignName(data.proposal.client_name);
      }
      if (data.proposal?.status === 'paid') {
        fetchOnboardingPlan(data.proposal.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposal');
    } finally {
      setIsLoading(false);
    }
  }, [code, fetchOnboardingPlan]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  const handleSignAndAccept = async () => {
    if (!proposalId) return;
    setIsAccepting(true);
    setError(null);
    try {
      const signRes = await fetch(`/api/proposals/${proposalId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signed_by_name: signName.trim() }),
      });
      if (!signRes.ok) {
        const data = await signRes.json();
        throw new Error(data.error || 'Failed to sign proposal');
      }
      // If there is a contract, do not proceed to checkout yet — show Sign Contract step
      if (proposal?.contract_pdf_url) {
        setProposal((p) => (p ? { ...p, signed_at: new Date().toISOString(), signed_by_name: signName.trim() } : null));
        setShowSignForm(false);
        setContractSignName(signName.trim());
        setIsAccepting(false);
        return;
      }
      const acceptBody: Record<string, unknown> = {};
      if (paymentMode === 'installments') {
        acceptBody.paymentMode = 'installments';
        acceptBody.numInstallments = numInstallments;
      }

      const acceptRes = await fetch(`/api/proposals/${proposalId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acceptBody),
      });
      if (!acceptRes.ok) {
        const data = await acceptRes.json();
        throw new Error(data.error || 'Failed to accept proposal');
      }
      const data = await acceptRes.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsAccepting(false);
    }
  };

  const handleSignContract = async () => {
    if (!proposalId) return;
    setIsAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/sign-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signed_by_name: contractSignName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sign contract');
      }
      const data = await res.json();
      setProposal((p) =>
        p
          ? {
              ...p,
              contract_signed_at: new Date().toISOString(),
              contract_signed_by_name: contractSignName.trim(),
            }
          : null
      );
      setShowContractSignForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign contract');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!proposalId) return;
    setIsAccepting(true);
    setError(null);
    try {
      const acceptBody: Record<string, unknown> = {};
      if (paymentMode === 'installments') {
        acceptBody.paymentMode = 'installments';
        acceptBody.numInstallments = numInstallments;
      }

      const response = await fetch(`/api/proposals/${proposalId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acceptBody),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout');
      }
      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to proceed to payment');
      setIsAccepting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="relative">
        <SiteThemeCorner />
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading proposal...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !proposal) {
    return (
      <div className="relative">
        <SiteThemeCorner />
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-white mb-2">Proposal Not Found</h1>
            <p className="text-gray-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!proposal) return null;

  const totalPerceivedValue = proposal.line_items.reduce(
    (sum, item) => sum + (item.perceived_value || item.price),
    0
  );
  const savings = totalPerceivedValue - proposal.total_amount;

  const getStatusDisplay = () => {
    if (paymentStatus === 'success' || proposal.status === 'paid') {
      return {
        icon: CheckCircle,
        color: 'text-green-500',
        bgColor: 'bg-green-900/20 border-green-800',
        title: 'Payment Complete',
        message: 'Thank you for your payment! Book your onboarding call below to get started.',
      };
    }
    if (paymentStatus === 'cancelled') {
      return {
        icon: AlertCircle,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-900/20 border-yellow-800',
        title: 'Payment Cancelled',
        message: 'Your payment was cancelled. You can still proceed when ready.',
      };
    }
    if (isExpired) {
      return {
        icon: Clock,
        color: 'text-red-500',
        bgColor: 'bg-red-900/20 border-red-800',
        title: 'Proposal Expired',
        message: 'This proposal has expired. Please contact us for a new quote.',
      };
    }
    if (proposal.status === 'accepted') {
      return {
        icon: CheckCircle,
        color: 'text-blue-500',
        bgColor: 'bg-blue-900/20 border-blue-800',
        title: 'Proposal Accepted',
        message: 'Please proceed to payment to complete your purchase.',
      };
    }
    return null;
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="relative">
      <SiteThemeCorner />
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Status Banner */}
        {statusDisplay && (
          <div className={`mb-6 p-4 rounded-lg border ${statusDisplay.bgColor}`}>
            <div className="flex items-center gap-3">
              <statusDisplay.icon className={`w-6 h-6 ${statusDisplay.color}`} />
              <div>
                <h3 className="font-semibold">{statusDisplay.title}</h3>
                <p className="text-sm text-gray-400">{statusDisplay.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Post-Payment CTAs */}
        {(paymentStatus === 'success' || proposal.status === 'paid') && (
          <div className="mb-6 p-6 rounded-xl border bg-blue-900/20 border-blue-800">
            <div className="text-center mb-5">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">Payment Successful!</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                Your project is now active. Here&apos;s what to do next:
              </p>
            </div>

            <div className="space-y-3 max-w-lg mx-auto">
              {dashboardUrl && (
                <a
                  href={dashboardUrl}
                  className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl text-lg font-semibold transition-all"
                >
                  <span className="flex items-center gap-3">
                    <LayoutDashboard className="w-5 h-5" />
                    <span>
                      <span className="block">View Your Client Portal</span>
                      <span className="block text-xs font-normal text-blue-200/70">Your home base for tracking progress</span>
                    </span>
                  </span>
                  <ArrowRight className="w-5 h-5" />
                </a>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {onboardingPlanId && (
                  <a
                    href={`/onboarding/${onboardingPlanId}`}
                    className="flex items-center gap-3 px-4 py-3 bg-gray-800/50 border border-gray-700 hover:border-gray-600 rounded-xl transition-colors"
                  >
                    <ClipboardList className="w-5 h-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-300">Onboarding Plan</span>
                  </a>
                )}
                <a
                  href={`https://calendly.com/amadutown/atas-onboarding-call?name=${encodeURIComponent(proposal.client_name)}&email=${encodeURIComponent(proposal.client_email)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 bg-gray-800/50 border border-gray-700 hover:border-gray-600 rounded-xl transition-colors"
                >
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-300">Book Onboarding Call</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-lg border bg-red-900/20 border-red-800">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-red-200">{error}</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <FileText className="w-4 h-4" />
                <span>Proposal #{proposal.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <h1 className="text-2xl font-bold">{proposal.bundle_name}</h1>
            </div>
            <div className="flex items-center gap-2">
              {proposal.pdf_url && (
                <a
                  href={proposal.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  Proposal PDF
                </a>
              )}
              {proposal.contract_pdf_url && (
                <a
                  href={proposal.contract_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm"
                >
                  <FileText className="w-4 h-4" />
                  Contract PDF
                </a>
              )}
            </div>
          </div>

          {/* Client Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500">Prepared For</p>
                <p className="font-medium">{proposal.client_name}</p>
              </div>
            </div>
            {proposal.client_company && (
              <div className="flex items-center gap-3">
                <Building className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500">Company</p>
                  <p className="font-medium">{proposal.client_company}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500">Valid Until</p>
                <p className="font-medium">
                  {proposal.valid_until ? formatDate(proposal.valid_until) : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Reports & documents (attached strategy/opportunity PDFs) */}
        {proposalDocuments.length > 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
              Reports &amp; Documents
            </h3>
            <div className="space-y-3">
              {proposalDocuments.map((doc) => {
                const typeLabel =
                  doc.document_type === 'strategy_report'
                    ? 'Strategy Report'
                    : doc.document_type === 'opportunity_quantification'
                      ? 'Opportunity Quantification'
                      : doc.document_type === 'proposal_package'
                        ? 'Proposal Package'
                        : doc.document_type === 'onboarding_preview'
                          ? 'Onboarding Preview'
                          : 'Document';
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <FileText className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">{doc.title}</p>
                        <p className="text-xs text-gray-500">
                          {typeLabel}
                          {' · '}
                          {new Date(doc.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    {doc.signedUrl ? (
                      <a
                        href={doc.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </a>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 shrink-0">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Unavailable
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Value Assessment Section */}
        {proposal.value_assessment &&
          proposal.value_assessment.valueStatements &&
          proposal.value_assessment.valueStatements.length > 0 && (
            <ValueAssessmentSection
              assessment={proposal.value_assessment}
              totalAmount={proposal.total_amount}
              clientCompany={proposal.client_company}
            />
          )}

        {/* Implementation Fit Section */}
        {proposal.feasibility_view && proposal.feasibility_view.items.length > 0 && (
          <ImplementationFitSection view={proposal.feasibility_view} />
        )}

        {proposal.implementation_roadmap_snapshot && (
          <ImplementationRoadmapSection snapshot={proposal.implementation_roadmap_snapshot} />
        )}

        {/* Line Items */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 mb-6 overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h2 className="font-semibold flex items-center gap-2">
              <Package className="w-5 h-5" />
              What&apos;s Included
            </h2>
          </div>

          <div className="divide-y divide-gray-800">
            {proposal.line_items.map((item, index) => (
              <div key={index} className="p-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{item.title}</span>
                    {item.offer_role && (
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${ROLE_COLORS[item.offer_role] || 'bg-gray-700 text-gray-300'}`}
                      >
                        {ROLE_LABELS[item.offer_role] || item.offer_role}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-sm text-gray-400">{item.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatCurrency(item.price)}</p>
                  {item.perceived_value && item.perceived_value > item.price && (
                    <p className="text-xs text-gray-500 line-through">
                      {formatCurrency(item.perceived_value)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
          <div className="space-y-3">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal</span>
              <span>{formatCurrency(proposal.subtotal)}</span>
            </div>

            {proposal.discount_amount > 0 && (
              <div className="flex justify-between text-green-400">
                <span>
                  Discount
                  {proposal.discount_description && (
                    <span className="text-gray-500 text-sm ml-2">
                      ({proposal.discount_description})
                    </span>
                  )}
                </span>
                <span>-{formatCurrency(proposal.discount_amount)}</span>
              </div>
            )}

            <div className="pt-3 border-t border-gray-800 flex justify-between items-center">
              <span className="text-lg font-semibold">Total</span>
              <div className="text-right">
                <span className="text-2xl font-bold text-blue-400">
                  {formatCurrency(proposal.total_amount)}
                </span>
                {savings > 0 && (
                  <p className="text-sm text-green-400">
                    Save {formatCurrency(savings)} (
                    {Math.round((savings / totalPerceivedValue) * 100)}% off)
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Payment Options */}
        {proposal.status !== 'paid' && paymentStatus !== 'success' && !isExpired && proposal.total_amount > 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
            <h2 className="font-semibold mb-4">Payment Options</h2>
            <InstallmentOption
              baseAmount={proposal.total_amount}
              defaultInstallments={proposal.service_term_months || 3}
              minInstallments={2}
              maxInstallments={Math.max(proposal.service_term_months || 12, 12)}
              selectedMode={paymentMode}
              onSelect={(mode, count) => {
                setPaymentMode(mode);
                if (count) setNumInstallments(count);
              }}
            />
          </div>
        )}

        {/* Terms */}
        {proposal.terms_text && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
            <h2 className="font-semibold mb-4">Terms & Conditions</h2>
            <div className="text-sm text-gray-400 whitespace-pre-line">
              {proposal.terms_text}
            </div>
          </div>
        )}

        {/* Sign & Accept Section */}
        {proposal.status !== 'paid' && paymentStatus !== 'success' && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            {canAccept && !proposal.signed_at && (
              <div className="space-y-4">
                {!showSignForm ? (
                  <button
                    onClick={() => setShowSignForm(true)}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl text-lg font-semibold transition-colors"
                  >
                    <PenLine className="w-5 h-5" />
                    Sign & Accept Proposal
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Type your full name to sign this proposal
                      </label>
                      <input
                        type="text"
                        value={signName}
                        onChange={(e) => setSignName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-lg"
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      By signing, you agree to the terms and conditions above and authorize
                      payment.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowSignForm(false)}
                        className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSignAndAccept}
                        disabled={isAccepting || !signName.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
                      >
                        {isAccepting ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-5 h-5" />
                        )}
                        Sign & Accept
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sign contract step: when proposal is signed and contract exists but not yet signed */}
            {proposal.signed_at && proposal.contract_pdf_url && !proposal.contract_signed_at && (
              <div className="space-y-4 p-4 rounded-xl border border-amber-800/50 bg-amber-950/20">
                <h3 className="font-semibold flex items-center gap-2 text-amber-200">
                  <FileText className="w-5 h-5" />
                  Sign Software Agreement
                </h3>
                <p className="text-sm text-gray-400">
                  Please review and sign the Software Agreement before payment. You can open it via the &quot;Contract PDF&quot; link above.
                </p>
                {!showContractSignForm ? (
                  <button
                    onClick={() => setShowContractSignForm(true)}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-amber-600 hover:bg-amber-700 rounded-xl text-lg font-semibold transition-colors"
                  >
                    <PenLine className="w-5 h-5" />
                    Sign Contract
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Type your full name to sign the contract
                      </label>
                      <input
                        type="text"
                        value={contractSignName}
                        onChange={(e) => setContractSignName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-lg"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowContractSignForm(false)}
                        className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSignContract}
                        disabled={isAccepting || !contractSignName.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
                      >
                        {isAccepting ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-5 h-5" />
                        )}
                        Sign Contract
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Proceed to payment: when proposal (and contract if any) are signed */}
            {proposal.signed_at && (!proposal.contract_pdf_url || proposal.contract_signed_at) && proposal.status !== 'paid' && paymentStatus !== 'success' && (
              <button
                onClick={handleProceedToPayment}
                disabled={isAccepting}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed rounded-xl text-lg font-semibold transition-colors"
              >
                {isAccepting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CreditCard className="w-5 h-5" />
                )}
                Proceed to Payment
              </button>
            )}

            {proposal.signed_at && proposal.status !== 'paid' && !canPay && proposal.contract_pdf_url && !proposal.contract_signed_at && (
              <div className="text-center text-gray-400 text-sm">
                <p>Proposal signed by {proposal.signed_by_name}. Sign the contract above to continue.</p>
              </div>
            )}

            {isExpired && (
              <div className="text-center text-gray-400">
                <p>This proposal has expired.</p>
                <p className="text-sm mt-1">Please contact us for a new quote.</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm mt-8">
          <p>Questions? Contact us at your convenience.</p>
          <p className="mt-2">Created on {formatDate(proposal.created_at)}</p>
        </div>
      </div>
    </div>
    </div>
  );
}

// ============================================================================
// Implementation Fit Section - Stack-aware feasibility (client projection)
// ============================================================================

function ImplementationFitSection({ view }: { view: FeasibilityClientView }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 mb-6 overflow-hidden">
      <div className="p-4 border-b border-gray-800 flex items-center gap-2">
        <Package className="w-5 h-5 text-blue-400" />
        <h2 className="font-semibold">Implementation Fit</h2>
      </div>
      <div className="p-5 space-y-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3">
            <div className="text-xs uppercase tracking-wide text-blue-300 mb-1">Overall fit</div>
            <div className="text-sm text-gray-100">{view.overall_fit_label}</div>
          </div>
          <div className="rounded-lg bg-purple-500/10 border border-purple-500/30 p-3">
            <div className="text-xs uppercase tracking-wide text-purple-300 mb-1">Estimated scope</div>
            <div className="text-sm text-gray-100">{view.estimated_complexity_label}</div>
          </div>
        </div>

        {view.headline && (
          <p className="text-sm text-gray-300">{view.headline}</p>
        )}

        <div className="space-y-3">
          {view.items.map((item, idx) => (
            <div key={idx} className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="font-medium text-gray-100">{item.title}</div>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300 whitespace-nowrap">
                  {item.effort_label}
                </span>
              </div>
              {item.fit_summary && (
                <p className="text-sm text-gray-400 mb-3">{item.fit_summary}</p>
              )}
              <div className="space-y-1.5 text-xs">
                {item.works_with.length > 0 && (
                  <div>
                    <span className="text-emerald-400 font-medium">Already on your stack:</span>{' '}
                    <span className="text-gray-300">{item.works_with.join(', ')}</span>
                  </div>
                )}
                {item.connects_to.length > 0 && (
                  <div>
                    <span className="text-blue-400 font-medium">Connects with:</span>{' '}
                    <span className="text-gray-300">{item.connects_to.join(', ')}</span>
                  </div>
                )}
                {item.we_set_up.length > 0 && (
                  <div>
                    <span className="text-amber-400 font-medium">We&apos;ll set up:</span>{' '}
                    <span className="text-gray-300">{item.we_set_up.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {view.open_decisions.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="text-xs uppercase tracking-wide text-amber-300 mb-1.5">
              Decisions to discuss together
            </div>
            <ul className="text-sm text-gray-200 space-y-1 list-disc list-inside">
              {view.open_decisions.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function ImplementationRoadmapSection({ snapshot }: { snapshot: ImplementationRoadmapSnapshot }) {
  const fmt = (amount: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)

  const clientTasks = snapshot.tasks.filter((task) => task.clientVisible)

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 mb-6 overflow-hidden">
      <div className="p-4 border-b border-gray-800 flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-emerald-400" />
        <h2 className="font-semibold">Implementation Roadmap & Startup Costs</h2>
      </div>
      <div className="p-5 space-y-5">
        <p className="text-sm text-gray-300">{snapshot.clientSummary}</p>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
            <div className="text-xs uppercase tracking-wide text-emerald-300 mb-1">Estimated startup</div>
            <div className="text-lg font-semibold text-gray-100">{fmt(snapshot.costSummary.oneTimeClientOwned)}</div>
            <p className="text-xs text-gray-500 mt-1">Client-owned one-time costs</p>
          </div>
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3">
            <div className="text-xs uppercase tracking-wide text-blue-300 mb-1">Monthly operating</div>
            <div className="text-lg font-semibold text-gray-100">{fmt(snapshot.costSummary.monthlyClientOwned)}</div>
            <p className="text-xs text-gray-500 mt-1">Estimated external subscriptions</p>
          </div>
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
            <div className="text-xs uppercase tracking-wide text-amber-300 mb-1">Quote-required</div>
            <div className="text-lg font-semibold text-gray-100">{snapshot.costSummary.quoteRequiredCount}</div>
            <p className="text-xs text-gray-500 mt-1">Items needing live vendor confirmation</p>
          </div>
        </div>

        <div className="space-y-3">
          {snapshot.phases.map((phase, index) => (
            <div key={`${phase.title}-${index}`} className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Phase {index + 1}</div>
              <h3 className="font-medium text-gray-100">{phase.title}</h3>
              <p className="text-sm text-gray-400 mt-1">{phase.objective}</p>
            </div>
          ))}
        </div>

        {clientTasks.length > 0 && (
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Client-visible setup tasks</div>
            <ul className="space-y-1.5 text-sm text-gray-300">
              {clientTasks.slice(0, 6).map((task, index) => (
                <li key={`${task.title}-${index}`} className="flex items-center justify-between gap-3">
                  <span>{task.title}</span>
                  <span className="text-xs text-gray-500 capitalize">{task.ownerType}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Value Assessment Section - Interactive Business Case
// ============================================================================

function ValueAssessmentSection({
  assessment,
  totalAmount,
  clientCompany,
}: {
  assessment: ValueAssessment;
  totalAmount: number;
  clientCompany?: string;
}) {
  const [showMethodology, setShowMethodology] = useState(false);

  const companyRef = clientCompany || 'your business';
  const roi =
    assessment.roi ??
    (totalAmount > 0 ? Math.round((assessment.totalAnnualValue / totalAmount) * 10) / 10 : 0);
  const monthlyCost = assessment.totalAnnualValue / 12;
  const paybackMonths =
    totalAmount > 0 ? Math.max(1, Math.ceil(totalAmount / monthlyCost)) : 0;

  const formatCurrencyShort = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Cost of Inaction Banner */}
      <div className="relative overflow-hidden rounded-xl border border-emerald-800/50 bg-gradient-to-br from-emerald-950/80 via-emerald-900/40 to-gray-900">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-4 right-4 w-32 h-32 border border-emerald-400 rounded-full" />
          <div className="absolute bottom-4 left-8 w-20 h-20 border border-emerald-400 rounded-full" />
        </div>

        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-emerald-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-emerald-300">Why This Matters</h2>
          </div>

          <p className="text-gray-300 text-sm mb-6 leading-relaxed max-w-2xl">
            Based on our analysis of businesses in{' '}
            <span className="text-emerald-300 font-medium">
              {assessment.industry || 'your industry'}
            </span>{' '}
            with{' '}
            <span className="text-emerald-300 font-medium">
              {assessment.companySizeRange || '11-50'} employees
            </span>
            , we&apos;ve identified{' '}
            <span className="text-white font-semibold">{assessment.valueStatements.length} areas</span>{' '}
            where {companyRef} may be losing an estimated{' '}
            <span className="text-emerald-300 font-bold">
              {formatCurrencyShort(assessment.totalAnnualValue)}/year
            </span>{' '}
            to operational inefficiencies and missed opportunities.
          </p>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900/60 border border-emerald-800/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-red-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                  Cost of Inaction
                </span>
              </div>
              <p className="text-2xl font-bold text-white">
                {formatCurrencyShort(assessment.totalAnnualValue)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrencyShort(monthlyCost)}/month lost
              </p>
            </div>

            <div className="bg-gray-900/60 border border-emerald-800/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                  Your Investment
                </span>
              </div>
              <p className="text-2xl font-bold text-blue-400">
                {formatCurrencyShort(totalAmount)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Pays for itself in ~{paybackMonths} month{paybackMonths !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="bg-gray-900/60 border border-emerald-800/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                  Return on Investment
                </span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{roi.toFixed(1)}x</p>
              <p className="text-xs text-gray-500 mt-1">
                ${roi.toFixed(1)} recovered per $1 invested
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pain Points Breakdown */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            Identified Pain Points
          </h3>
          <span className="text-xs text-gray-500">
            {assessment.valueStatements.length} area
            {assessment.valueStatements.length !== 1 ? 's' : ''} analyzed
          </span>
        </div>

        <div className="divide-y divide-gray-800">
          {assessment.valueStatements.map((stmt, index) => (
            <div key={index} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-white">{stmt.painPoint}</span>
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded border ${CONFIDENCE_STYLES[stmt.confidence] || CONFIDENCE_STYLES.low}`}
                    >
                      {stmt.confidence} confidence
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {CALC_METHOD_LABELS[stmt.calculationMethod] || stmt.calculationMethod} &middot;{' '}
                    {stmt.evidenceSummary}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-emerald-400">
                    {formatCurrencyShort(stmt.annualValue)}
                  </p>
                  <p className="text-xs text-gray-500">per year</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total Row */}
        <div className="p-4 bg-emerald-950/30 border-t border-emerald-800/30 flex items-center justify-between">
          <span className="font-semibold text-emerald-300">
            Total Estimated Annual Impact
          </span>
          <span className="text-xl font-bold text-emerald-400">
            {formatCurrencyShort(assessment.totalAnnualValue)}/yr
          </span>
        </div>
      </div>

      {/* Methodology Expandable */}
      <button
        onClick={() => setShowMethodology(!showMethodology)}
        className="w-full flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-800 text-sm text-gray-400 hover:text-gray-300 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          How we calculated this
        </span>
        {showMethodology ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showMethodology && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 text-sm text-gray-400 space-y-3">
          <p>
            Our value calculations use industry benchmarks, market intelligence, and proprietary
            analysis to estimate the annual cost of common business pain points.
          </p>
          <div className="space-y-2">
            <p className="text-gray-300 font-medium">Methods used:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-500">
              <li>
                <span className="text-gray-400">Time Savings</span> - Hours spent on manual tasks
                &times; hourly rate &times; efficiency gain
              </li>
              <li>
                <span className="text-gray-400">Error Reduction</span> - Error rate &times; cost
                per error &times; volume &times; reduction factor
              </li>
              <li>
                <span className="text-gray-400">Revenue Acceleration</span> - Pipeline value
                &times; conversion improvement &times; velocity increase
              </li>
              <li>
                <span className="text-gray-400">Opportunity Cost</span> - Market opportunity value
                &times; capture rate improvement
              </li>
              <li>
                <span className="text-gray-400">Replacement Cost</span> - What it would cost to
                achieve the same result through hiring or other tools
              </li>
            </ul>
          </div>
          <p className="text-xs text-gray-600 italic">
            Confidence levels reflect the quality and quantity of data supporting each calculation.
            Actual results may vary based on implementation and business-specific factors.
          </p>
        </div>
      )}
    </div>
  );
}
