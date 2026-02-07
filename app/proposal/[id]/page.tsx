'use client';

import { useState, useEffect, Suspense } from 'react';
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

  useEffect(() => {
    fetchProposal();
  }, [proposalId]);

  const fetchProposal = async () => {
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
      
      // If proposal is paid, look up the onboarding plan
      if (data.proposal?.status === 'paid') {
        fetchOnboardingPlan(data.proposal.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposal');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOnboardingPlan = async (propId: string) => {
    try {
      // Check if a client project exists for this proposal with an onboarding plan
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
  };

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

        {/* Line Items */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 mb-6 overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h2 className="font-semibold flex items-center gap-2">
              <Package className="w-5 h-5" />
              What's Included
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
