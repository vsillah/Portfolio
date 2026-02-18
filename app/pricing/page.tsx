'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Check, Shield, Zap, BarChart } from 'lucide-react';
import Navigation from '@/components/Navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Heart } from 'lucide-react';
import { PricingCard } from '@/components/pricing/PricingCard';
import { ROICalculator } from '@/components/pricing/ROICalculator';
import { ComparisonChecklist } from '@/components/pricing/ComparisonChecklist';
import { ContinuityPlans } from '@/components/pricing/ContinuityPlans';
import { CommunityImpactComparison } from '@/components/pricing/CommunityImpactComparison';
import {
  PRICING_TIERS,
  CONTINUITY_PLANS,
  COMMUNITY_IMPACT_TIERS,
  DECOY_COMPARISONS,
  type PricingTier,
  type DecoyComparison,
} from '@/lib/pricing-model';

// --- Animation Components (Adapted from Hero.tsx) ---

const CircuitLine = ({ d, delay = 0, duration = 8 }: { d: string, delay?: number, duration?: number }) => (
  <motion.path
    d={d}
    stroke="url(#pricingGoldGradient)"
    strokeWidth="1"
    fill="none"
    initial={{ pathLength: 0, opacity: 0 }}
    animate={{ 
      pathLength: [0, 1, 1, 0],
      opacity: [0, 0.6, 0.6, 0]
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      ease: "easeInOut"
    }}
  />
);

const PulsingNode = ({ cx, cy, delay = 0 }: { cx: number, cy: number, delay?: number }) => (
  <motion.circle
    cx={cx}
    cy={cy}
    r="3"
    fill="#D4AF37"
    initial={{ scale: 0, opacity: 0 }}
    animate={{ 
      scale: [0, 1.5, 1, 1.5, 0],
      opacity: [0, 0.8, 0.4, 0.8, 0]
    }}
    transition={{
      duration: 4,
      delay,
      repeat: Infinity,
      ease: "easeInOut"
    }}
  />
);

// --- Main Page Component ---

type Segment = 'smb' | 'midmarket' | 'nonprofit';

const SEGMENT_TIERS: Record<Segment, string[]> = {
  smb: ['quick-win', 'accelerator', 'growth-engine'],
  midmarket: ['mm-accelerator', 'mm-growth-engine', 'mm-digital-transformation'],
  nonprofit: ['ci-starter', 'ci-accelerator', 'ci-growth'],
};

const SEGMENT_INTRO: Record<Segment, { title: string; description: string }> = {
  smb: {
    title: 'Small Business Packages',
    description:
      'Outcome-backed AI solutions for teams of 1–50. Start with a quick win, scale to full deployment with guarantees and dedicated support.',
  },
  midmarket: {
    title: 'Mid-Market Programs',
    description:
      'Enterprise-grade AI deployment for 50–500 employees. Accelerate operations, growth, and digital transformation with dedicated delivery.',
  },
  nonprofit: {
    title: 'Community Impact Program',
    description:
      'Same outcomes. Budget-friendly. No guarantees. Designed for nonprofits and educational institutions to access AI tools through self-serve delivery.',
  },
};

function PricingCardSkeleton() {
  return (
    <div className="relative flex flex-col rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 animate-pulse">
      <div className="h-6 w-3/4 rounded bg-gray-200 dark:bg-gray-700 mb-2" />
      <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800 mb-4" />
      <div className="h-12 w-1/2 rounded bg-gray-200 dark:bg-gray-700 mb-6" />
      <div className="h-4 w-1/3 rounded bg-gray-100 dark:bg-gray-800 mb-2" />
      <div className="space-y-3 mt-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 rounded bg-gray-100 dark:bg-gray-800" style={{ width: `${80 - i * 10}%` }} />
        ))}
      </div>
    </div>
  );
}

function PricingPageContent() {
  const searchParams = useSearchParams();
  const [segment, setSegment] = useState<Segment>(() => {
    const s = searchParams.get('segment');
    if (s === 'smb' || s === 'midmarket' || s === 'nonprofit') return s;
    return 'smb';
  });
  const [tiersLoading, setTiersLoading] = useState(true);
  const [showNonprofitComparison, setShowNonprofitComparison] = useState(false);
  const [showFAQ, setShowFAQ] = useState<string | null>(null);
  const containerRef = useRef(null);
  const segmentRef = useRef<Segment>(segment);
  segmentRef.current = segment;

  // Deep link: read ?segment= on mount
  useEffect(() => {
    const seg = searchParams.get('segment');
    if (seg === 'smb' || seg === 'midmarket' || seg === 'nonprofit') {
      setSegment(seg);
    }
  }, [searchParams]);

  // Scroll to tier when #tier-slug or ?tier=tier-slug (after tiers load)
  useEffect(() => {
    if (tiersLoading) return;
    const tierFromQuery = searchParams.get('tier');
    const tierFromHash = typeof window !== 'undefined' ? window.location.hash?.slice(1) || null : null;
    const slug = tierFromQuery || tierFromHash;
    if (!slug) return;
    const el = document.getElementById(slug);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  }, [tiersLoading, searchParams]);

  // Dynamic pricing context — set when ROI Calculator provides industry/size
  const [pricingIndustry, setPricingIndustry] = useState<string | undefined>();
  const [pricingCompanySize, setPricingCompanySize] = useState<string | undefined>();
  const [calculationContext, setCalculationContext] = useState<{
    segment: string;
    industry: string;
    companySize: string;
    hourlyWageUsed: number;
    benchmarkSource: string;
    isDefault: boolean;
  } | null>(null);

  // API-driven tiers; fallback to lib/pricing-model on error or empty
  const [apiTiers, setApiTiers] = useState<PricingTier[] | null>(null);
  const [apiDecoyComparisons, setApiDecoyComparisons] = useState<DecoyComparison[] | null>(null);
  useEffect(() => {
    const requestedSegment = segment;
    const params = new URLSearchParams({ segment: requestedSegment });
    if (pricingIndustry) params.set('industry', pricingIndustry);
    if (pricingCompanySize) params.set('companySize', pricingCompanySize);

    fetch(`/api/pricing/tiers?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Fetch failed');
        return res.json();
      })
      .then((data) => {
        if (segmentRef.current !== requestedSegment) return;
        if (Array.isArray(data.tiers) && data.tiers.length > 0) {
          setApiTiers(data.tiers);
          setApiDecoyComparisons(data.decoyComparisons ?? null);
          setCalculationContext(data.calculationContext ?? null);
        } else {
          setApiTiers(null);
          setApiDecoyComparisons(null);
          setCalculationContext(null);
        }
        setTiersLoading(false);
      })
      .catch(() => {
        if (segmentRef.current !== requestedSegment) return;
        setApiTiers(null);
        setApiDecoyComparisons(null);
        setCalculationContext(null);
        setTiersLoading(false);
      });
  }, [segment, pricingIndustry, pricingCompanySize]);

  /** Called by ROI Calculator when user selects industry + company size */
  const handlePricingContextChange = (industry: string, companySize: string) => {
    setPricingIndustry(industry);
    setPricingCompanySize(companySize);
  };

  // Reset comparison view when switching away from nonprofit
  const handleSegmentChange = (newSegment: Segment) => {
    if (newSegment !== 'nonprofit') setShowNonprofitComparison(false);
    setSegment(newSegment);
    setTiersLoading(true);
    setApiTiers(null);
    setApiDecoyComparisons(null);
    setCalculationContext(null);
  };

  // Use API tiers when available; fallback to lib/pricing-model
  const visibleTierIds = SEGMENT_TIERS[segment];
  const fallbackTiers = [...PRICING_TIERS, ...COMMUNITY_IMPACT_TIERS];
  const fallbackVisible = fallbackTiers.filter((t) => visibleTierIds.includes(t.id));
  const visibleTiers =
    apiTiers && apiTiers.length > 0
      ? apiTiers
      : fallbackVisible;

  // Use API decoy comparisons when segment=nonprofit and available; else fallback
  const decoyComparisons =
    segment === 'nonprofit' && showNonprofitComparison && apiDecoyComparisons && apiDecoyComparisons.length > 0
      ? apiDecoyComparisons
      : DECOY_COMPARISONS;

  const faqs = [
    {
      id: 'what-is-included',
      q: 'What exactly is included in each tier?',
      a: 'Each tier includes a specific set of AI tools, training, and support. The items listed on each card are everything you receive. Higher tiers build on lower tiers — so the Growth Engine includes everything in the Accelerator, plus additional tools and services.',
    },
    {
      id: 'guarantee',
      q: 'How do your guarantees work?',
      a: 'Every tier comes with a guarantee. The Quick Win tier has an unconditional 30-day money-back guarantee. Higher tiers have conditional outcome-based guarantees — if you don\'t hit the specified results (e.g., 10+ hrs/week saved, 3x ROI), we continue working with you at no additional cost until you do.',
    },
    {
      id: 'timeline',
      q: 'How long does implementation take?',
      a: 'The Quick Win tier is delivered in a single half-day workshop. The Accelerator deploys tools within 2-4 weeks. The Growth Engine runs over 12 weeks. Digital Transformation is typically 3-6 months depending on scope.',
    },
    {
      id: 'custom-pricing',
      q: 'Can I get custom pricing?',
      a: 'Yes. After a free AI audit, we provide personalized pricing based on your specific situation, pain points, and potential ROI. The prices shown here are starting points. Schedule a call to discuss your needs.',
    },
    {
      id: 'continuity',
      q: 'What happens after the project is complete?',
      a: 'All deployed tools include a warranty period (30-90 days depending on tier). After that, our continuity plans provide ongoing maintenance, support, and optimization. You\'re never left without support.',
    },
    {
      id: 'competitors',
      q: 'How are you different from other AI agencies?',
      a: 'We cover the full business lifecycle — from lead generation to client retention. We deploy actual working AI tools (not just advice), back them with outcome-based guarantees, and provide transparent ROI calculations. Most agencies specialize in one area; we provide comprehensive coverage.',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-body">
      <Navigation />
      
      {/* --- Redesigned Hero Section --- */}
      <section 
        ref={containerRef}
        className="relative overflow-hidden bg-imperial-navy pt-32 pb-24 lg:pt-40 lg:pb-32"
      >
        {/* Breadcrumbs */}
        <div className="relative z-20 mx-auto max-w-5xl px-6 mb-8">
          <Breadcrumbs items={[{ label: 'Pricing' }]} />
        </div>

        {/* Dynamic Circuit Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <svg 
            className="absolute inset-0 w-full h-full opacity-40"
            viewBox="0 0 1920 800"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <linearGradient id="pricingGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B6914" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#F5D060" stopOpacity="0.3" />
              </linearGradient>
              <filter id="pricingGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            <g filter="url(#pricingGlow)">
              {/* Simplified circuits for pricing header */}
              <CircuitLine d="M 0 100 Q 300 150, 500 100 T 800 150" delay={0} duration={10} />
              <CircuitLine d="M 1920 200 Q 1600 150, 1400 250 T 1100 200" delay={2} duration={12} />
              <CircuitLine d="M 0 600 Q 400 550, 600 650 T 1000 600" delay={1} duration={15} />
              <CircuitLine d="M 1920 700 Q 1500 750, 1200 650 T 900 700" delay={3} duration={14} />
            </g>
            
            <g>
              <PulsingNode cx={500} cy={100} delay={0} />
              <PulsingNode cx={1400} cy={250} delay={2} />
              <PulsingNode cx={600} cy={650} delay={1} />
              <PulsingNode cx={1200} cy={650} delay={3} />
            </g>
          </svg>
        </div>

        {/* Ambient Auroras (Subtle) */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
           <div className="absolute top-0 left-1/4 w-96 h-96 bg-radiant-gold/20 rounded-full blur-[100px] animate-pulse" />
           <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-900/40 rounded-full blur-[100px]" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          {/* Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-8 flex justify-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-radiant-gold/30 bg-silicon-slate/30 px-4 py-1.5 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-radiant-gold" />
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] font-heading text-platinum-white/90">
                Transparent Pricing
              </span>
            </div>
          </motion.div>

          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="font-premium text-5xl sm:text-6xl lg:text-7xl text-platinum-white leading-[1.1] tracking-tight mb-6"
          >
            AI Solutions That <br className="hidden sm:block" />
            <span className="italic text-radiant-gold">Pay for Themselves</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mx-auto max-w-2xl text-lg sm:text-xl text-platinum-white/70 leading-relaxed font-light mb-10"
          >
            Transparent pricing backed by outcome guarantees. Every package includes deployed AI tools, not just strategy decks.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm font-heading tracking-wide text-platinum-white/80"
          >
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-radiant-gold" />
              Outcome Guarantees
            </span>
            <span className="hidden sm:inline text-platinum-white/20">|</span>
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-radiant-gold" />
              Deployed AI Tools
            </span>
            <span className="hidden sm:inline text-platinum-white/20">|</span>
            <span className="flex items-center gap-2">
              <BarChart className="w-4 h-4 text-radiant-gold" />
              Transparent ROI
            </span>
          </motion.div>
        </div>

        {/* Decorative Bottom Fade to blend with next section */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-50 dark:from-gray-950 to-transparent pointer-events-none" />
      </section>

      {/* Segment Selector */}
      <section className="relative z-20 -mt-8 mx-auto max-w-7xl px-4">
        <div className="flex justify-center">
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-800 dark:bg-gray-900/90 dark:backdrop-blur-md">
            <button
              onClick={() => handleSegmentChange('smb')}
              className={`rounded-lg px-6 py-2.5 text-sm font-heading tracking-wide transition-all duration-300 ${
                segment === 'smb'
                  ? 'bg-imperial-navy text-radiant-gold shadow-md'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-platinum-white'
              }`}
            >
              Small Business (1-50)
            </button>
            <button
              onClick={() => handleSegmentChange('midmarket')}
              className={`rounded-lg px-6 py-2.5 text-sm font-heading tracking-wide transition-all duration-300 ${
                segment === 'midmarket'
                  ? 'bg-imperial-navy text-radiant-gold shadow-md'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-platinum-white'
              }`}
            >
              Mid-Market (50-500)
            </button>
            <button
              onClick={() => handleSegmentChange('nonprofit')}
              className={`rounded-lg px-6 py-2.5 text-sm font-heading tracking-wide transition-all duration-300 flex items-center gap-1.5 ${
                segment === 'nonprofit'
                  ? 'bg-emerald-700 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-platinum-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              Nonprofit / Education
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:py-24">
        <motion.div
          key={segment}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-12 text-center max-w-2xl mx-auto"
        >
          <h2 className="font-premium text-3xl text-gray-900 dark:text-white mb-3">
            {SEGMENT_INTRO[segment].title}
          </h2>
          <p className="text-lg text-gray-500 dark:text-gray-400">
            {SEGMENT_INTRO[segment].description}
          </p>
        </motion.div>

        {segment === 'nonprofit' && showNonprofitComparison ? (
          /* Side-by-side CI vs Full-Service comparison (opt-in) */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <CommunityImpactComparison comparisons={decoyComparisons} showIntroHeader />
            <div className="mt-8 text-center">
              <button
                onClick={() => setShowNonprofitComparison(false)}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline transition-colors"
              >
                View Community Impact only
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid gap-8 md:grid-cols-3"
          >
            {tiersLoading
              ? [1, 2, 3].map((i) => <PricingCardSkeleton key={i} />)
              : visibleTiers.map((tier) => (
                  <div key={tier.id} id={tier.id} className="scroll-mt-32">
                    <PricingCard tier={tier} calculationContext={calculationContext} />
                  </div>
                ))}
            {segment === 'nonprofit' && (
              <div className="md:col-span-3 flex flex-col items-center justify-center py-8 px-4 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center max-w-md">
                  Want to see how Community Impact compares to our full-service packages?
                </p>
                <button
                  onClick={() => setShowNonprofitComparison(true)}
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-radiant-gold bg-transparent px-6 py-3 text-sm font-heading font-bold uppercase tracking-wide text-radiant-gold transition-all hover:bg-radiant-gold hover:text-imperial-navy"
                >
                  Compare with full-service options
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}
        
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            All prices in USD. Payment plans available.{' '}
            <Link href="/services" className="text-imperial-navy dark:text-radiant-gold underline hover:opacity-80 transition-opacity">
              View individual services
            </Link>{' '}
            or{' '}
            <Link href="/store" className="text-imperial-navy dark:text-radiant-gold underline hover:opacity-80 transition-opacity">
              browse our store
            </Link>.
            {segment === 'nonprofit' && (
              <>
                {' '}Looking for our full-service packages?{' '}
                <button
                  onClick={() => handleSegmentChange('smb')}
                  className="text-imperial-navy dark:text-radiant-gold underline hover:opacity-80 transition-opacity"
                >
                  View premium tiers
                </button>.
              </>
            )}
          </p>
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="bg-white px-4 py-20 dark:bg-gray-900 border-y border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-start gap-16 lg:grid-cols-2">
            <div>
              <h2 className="font-premium text-4xl text-gray-900 dark:text-white mb-6">
                What&apos;s AI Automation <br />
                <span className="italic text-imperial-navy dark:text-radiant-gold">Worth to Your Business?</span>
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed mb-8">
                Most businesses waste thousands of hours on manual processes, miss leads due to slow
                response times, and underutilize their team. Our ROI calculator gives you a
                conservative estimate of what you could save.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-heading text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-white">Manual processes</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Hours spent on tasks that could be automated</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-heading text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-white">Missed opportunities</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Leads that fall through the cracks from slow follow-up</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-heading text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-white">Redirectable labor</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Team members doing work that AI could handle</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-radiant-gold/20 to-imperial-navy/20 rounded-2xl blur-xl opacity-50" />
              <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                <ROICalculator onContextChange={handlePricingContextChange} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Continuity Plans */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-premium text-4xl text-gray-900 dark:text-white mb-4">
            Ongoing Support &amp; Growth
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            After your initial project, stay supported with a continuity plan. Maintenance,
            coaching, and strategic guidance — so your AI tools keep delivering results.
          </p>
        </div>
        <ContinuityPlans plans={CONTINUITY_PLANS} className="mt-8" />
      </section>

      {/* Comparison */}
      <section className="bg-white px-4 py-20 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-premium text-4xl text-gray-900 dark:text-white mb-4">
              How We Compare
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Amadutown covers the full business lifecycle with deployed AI tools and outcome guarantees.
              Most agencies specialize in one area — we provide comprehensive coverage.
            </p>
          </div>
          <ComparisonChecklist className="mt-8" />
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-center font-premium text-4xl text-gray-900 dark:text-white mb-12">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <div
              key={faq.id}
              className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden transition-all duration-200 hover:border-radiant-gold/30"
            >
              <button
                onClick={() => setShowFAQ(showFAQ === faq.id ? null : faq.id)}
                className="flex w-full items-center justify-between px-6 py-5 text-left"
              >
                <span className="font-medium text-gray-900 dark:text-white pr-8">{faq.q}</span>
                <span className={`flex-shrink-0 text-radiant-gold transition-transform duration-200 ${showFAQ === faq.id ? 'rotate-180' : ''}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              {showFAQ === faq.id && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-5 bg-gray-50/50 dark:bg-gray-800/20">
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA - Redesigned */}
      <section className="relative overflow-hidden bg-imperial-navy px-4 py-24 text-center">
        {/* Background Accents */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_rgba(212,175,55,0.15)_0%,_transparent_70%)]" />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-radiant-gold/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl">
          <h2 className="font-premium text-4xl sm:text-5xl text-platinum-white mb-6">
            Ready to See What AI Can Do for You?
          </h2>
          <p className="text-xl text-platinum-white/70 mb-10 max-w-2xl mx-auto">
            Schedule a free AI audit and get personalized pricing based on your specific situation.
          </p>
          
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
            <a
              href="#contact"
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-radiant-gold px-8 py-4 text-sm font-heading font-bold uppercase tracking-widest text-imperial-navy transition-all hover:bg-white hover:scale-105"
            >
              <span>Schedule Free AI Audit</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </a>
            
            <Link
              href="/services"
              className="inline-flex items-center gap-2 rounded-full border border-platinum-white/20 px-8 py-4 text-sm font-heading font-bold uppercase tracking-widest text-platinum-white transition-all hover:bg-platinum-white/10 hover:border-platinum-white/40"
            >
              Browse Individual Services
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function PricingPageFallback() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-body">
      <div className="h-16 bg-imperial-navy" />
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <PricingCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingPageFallback />}>
      <PricingPageContent />
    </Suspense>
  );
}
