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
  Mail,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Target,
  Shield,
} from 'lucide-react';

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
  accepted_at?: string;
  paid_at?: string;
  created_at: string;
  value_assessment?: ValueAssessment;
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
export default function ProposalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading proposal...</p>
        </div>
      </div>
    }>
      <ProposalPageContent />
    </Suspense>
  );
}

function ProposalPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const proposalId = params.id as string;
  
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [canAccept, setCanAccept] = useState(false);
  const [canPay, setCanPay] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingPlanId, setOnboardingPlanId] = useState<string | null>(null);
  
  // Check for payment status from URL params
  const paymentStatus = searchParams.get('payment');

  const fetchOnboardingPlan = useCallback(async (propId: string) => {
    try {
      const response = await fetch(`/api/proposals/${propId}/onboarding-plan`);
      if (response.ok) {
        const data = await response.json();
        if (data.onboarding_plan_id) {
          setOnboardingPlanId(data.onboarding_plan_id);
        }
      }
    } catch {
      // Silently fail - just won't show the onboarding link
    }
  }, []);

  const fetchProposal = useCallback(async () => {
    try {
      const response = await fetch(`/api/proposals/${proposalId}`);
      if (!response.ok) {
        throw new Error('Proposal not found');
      }
      const data = await response.json();
      setProposal(data.proposal);
      setCanAccept(data.canAccept);
      setCanPay(data.canPay);
      setIsExpired(data.isExpired);
      if (data.proposal?.status === 'paid') {
        fetchOnboardingPlan(data.proposal.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposal');
    } finally {
      setIsLoading(false);
    }
  }, [proposalId, fetchOnboardingPlan]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  const handleAccept = async () => {
    setIsAccepting(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/proposals/${proposalId}/accept`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to accept proposal');
      }
      
      const data = await response.json();
      
      // Redirect to Stripe Checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept proposal');
      setIsAccepting(false);
    }
  };

  const handleProceedToPayment = async () => {
    setIsAccepting(true);
    setError(null);
    
    try {
      // Re-create checkout session for already accepted proposal
      const response = await fetch(`/api/proposals/${proposalId}/accept`, {
        method: 'POST',
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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading proposal...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !proposal) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Proposal Not Found</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!proposal) return null;

  // Calculate savings
  const totalPerceivedValue = proposal.line_items.reduce(
    (sum, item) => sum + (item.perceived_value || item.price),
    0
  );
  const savings = totalPerceivedValue - proposal.total_amount;

  // Status display
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

        {/* Post-Payment Onboarding CTA */}
        {(paymentStatus === 'success' || proposal.status === 'paid') && (
          <div className="mb-6 p-6 rounded-xl border bg-blue-900/20 border-blue-800">
            <div className="text-center">
              <Calendar className="w-10 h-10 text-blue-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">Next Step: View Your Onboarding Plan</h3>
              <p className="text-sm text-gray-400 mb-4 max-w-md mx-auto">
                Your personalized onboarding plan is ready. It includes your project timeline,
                milestones, communication schedule, and everything you need to get started.
              </p>
              {onboardingPlanId ? (
                <a
                  href={`/onboarding/${onboardingPlanId}`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-lg font-semibold transition-colors"
                >
                  <Calendar className="w-5 h-5" />
                  View Onboarding Plan
                  <ExternalLink className="w-4 h-4" />
                </a>
              ) : (
                <a
                  href={`https://calendly.com/amadutown/atas-onboarding-call?name=${encodeURIComponent(proposal.client_name)}&email=${encodeURIComponent(proposal.client_email)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-lg font-semibold transition-colors"
                >
                  <Calendar className="w-5 h-5" />
                  Book Onboarding Call
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
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
            {proposal.pdf_url && (
              <a
                href={proposal.pdf_url}
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
                      <span className={`px-2 py-0.5 text-xs rounded ${ROLE_COLORS[item.offer_role] || 'bg-gray-700 text-gray-300'}`}>
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
                    Save {formatCurrency(savings)} ({Math.round((savings / totalPerceivedValue) * 100)}% off)
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Terms */}
        {proposal.terms_text && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
            <h2 className="font-semibold mb-4">Terms & Conditions</h2>
            <div className="text-sm text-gray-400 whitespace-pre-line">
              {proposal.terms_text}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {proposal.status !== 'paid' && paymentStatus !== 'success' && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            {canAccept && (
              <button
                onClick={handleAccept}
                disabled={isAccepting}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-xl text-lg font-semibold transition-colors"
              >
                {isAccepting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                Accept Proposal & Proceed to Payment
              </button>
            )}
            
            {canPay && (
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
          <p className="mt-2">
            Created on {formatDate(proposal.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
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
  const roi = assessment.roi ?? (
    totalAmount > 0 ? Math.round((assessment.totalAnnualValue / totalAmount) * 10) / 10 : 0
  );
  const monthlyCost = assessment.totalAnnualValue / 12;
  const paybackMonths = totalAmount > 0
    ? Math.max(1, Math.ceil(totalAmount / monthlyCost))
    : 0;

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
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-4 right-4 w-32 h-32 border border-emerald-400 rounded-full" />
          <div className="absolute bottom-4 left-8 w-20 h-20 border border-emerald-400 rounded-full" />
        </div>

        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-emerald-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-emerald-300">
              Why This Matters
            </h2>
          </div>

          <p className="text-gray-300 text-sm mb-6 leading-relaxed max-w-2xl">
            Based on our analysis of businesses in <span className="text-emerald-300 font-medium">{assessment.industry || 'your industry'}</span> with{' '}
            <span className="text-emerald-300 font-medium">{assessment.companySizeRange || '11-50'} employees</span>,
            we&apos;ve identified <span className="text-white font-semibold">{assessment.valueStatements.length} areas</span> where{' '}
            {companyRef} may be losing an estimated{' '}
            <span className="text-emerald-300 font-bold">{formatCurrencyShort(assessment.totalAnnualValue)}/year</span> to
            operational inefficiencies and missed opportunities.
          </p>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900/60 border border-emerald-800/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-red-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Cost of Inaction</span>
              </div>
              <p className="text-2xl font-bold text-white">{formatCurrencyShort(assessment.totalAnnualValue)}</p>
              <p className="text-xs text-gray-500 mt-1">{formatCurrencyShort(monthlyCost)}/month lost</p>
            </div>

            <div className="bg-gray-900/60 border border-emerald-800/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Your Investment</span>
              </div>
              <p className="text-2xl font-bold text-blue-400">{formatCurrencyShort(totalAmount)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Pays for itself in ~{paybackMonths} month{paybackMonths !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="bg-gray-900/60 border border-emerald-800/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Return on Investment</span>
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
            {assessment.valueStatements.length} area{assessment.valueStatements.length !== 1 ? 's' : ''} analyzed
          </span>
        </div>

        <div className="divide-y divide-gray-800">
          {assessment.valueStatements.map((stmt, index) => (
            <div key={index} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-white">{stmt.painPoint}</span>
                    <span className={`px-2 py-0.5 text-[10px] rounded border ${CONFIDENCE_STYLES[stmt.confidence] || CONFIDENCE_STYLES.low}`}>
                      {stmt.confidence} confidence
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {CALC_METHOD_LABELS[stmt.calculationMethod] || stmt.calculationMethod}
                    {' '}&middot;{' '}
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
          <span className="font-semibold text-emerald-300">Total Estimated Annual Impact</span>
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
            Our value calculations use industry benchmarks, market intelligence, and proprietary analysis
            to estimate the annual cost of common business pain points.
          </p>
          <div className="space-y-2">
            <p className="text-gray-300 font-medium">Methods used:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-500">
              <li><span className="text-gray-400">Time Savings</span> - Hours spent on manual tasks &times; hourly rate &times; efficiency gain</li>
              <li><span className="text-gray-400">Error Reduction</span> - Error rate &times; cost per error &times; volume &times; reduction factor</li>
              <li><span className="text-gray-400">Revenue Acceleration</span> - Pipeline value &times; conversion improvement &times; velocity increase</li>
              <li><span className="text-gray-400">Opportunity Cost</span> - Market opportunity value &times; capture rate improvement</li>
              <li><span className="text-gray-400">Replacement Cost</span> - What it would cost to achieve the same result through hiring or other tools</li>
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
