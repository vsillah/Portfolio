/**
 * Pricing Model — Hormozi Value Equation Framework
 *
 * Tier definitions, value calculations, and pricing logic
 * for both public (top-of-funnel) and personalized (post-discovery) views.
 *
 * Integrates with lib/value-calculations.ts for ROI and benchmark data.
 */

import {
  calculateROI,
  findBestBenchmark,
  normalizeCompanySize,
  type IndustryBenchmark,
  type CalculationMethod,
} from './value-calculations';

// ============================================================================
// Types
// ============================================================================

/** Outcome group for pricing chart grouping (from outcome_groups table). */
export interface TierItemOutcomeGroup {
  id: string;
  label: string;
  display_order?: number;
}

export interface TierItem {
  title: string;
  perceivedValue: number;
  offerRole: 'core_offer' | 'bonus' | 'lead_magnet' | 'upsell' | 'continuity';
  description: string;
  isDeployed?: boolean; // true for AI tools that are actually built and deployed
  /** When set, pricing UI groups this item under this outcome (e.g. "Capture & Convert Leads"). */
  outcomeGroup?: TierItemOutcomeGroup | null;
}

export interface GuaranteeDef {
  name: string;
  type: 'conditional' | 'unconditional';
  durationDays: number;
  description: string;
  payoutType: 'refund' | 'credit' | 'rollover_upsell' | 'rollover_continuity';
}

export interface PricingTier {
  id: string;
  name: string;
  tagline: string;
  targetAudience: string;
  price: number;
  isCustomPricing: boolean; // true for "from $X" tiers
  totalRetailValue: number;
  savingsPercent: number;
  items: TierItem[];
  guarantee: GuaranteeDef | null; // null for Community Impact (no guarantee) tiers
  ctaText: string;
  ctaHref: string;
  featured?: boolean; // highlight this tier
  isDecoy?: boolean; // true for Community Impact decoy tiers
  mirrorsTierId?: string; // the premium tier this decoy contrasts against
}

/**
 * Pairs a Community Impact (decoy) tier with its premium counterpart
 * for side-by-side comparison rendering.
 */
export interface DecoyComparison {
  decoyTier: PricingTier;
  premiumTier: PricingTier;
  keyDifferences: {
    feature: string;
    decoyValue: string;
    premiumValue: string;
  }[];
  /** Upsell context from offer_upsell_paths — populated by the pricing API when available */
  upsellContext?: {
    nextProblem: string;
    valueFrame: string | null;
    riskReversal: string | null;
    creditNote: string | null;
    incrementalCost: number | null;
    incrementalValue: number | null;
  } | null;
}

export interface ContinuityPlan {
  id: string;
  name: string;
  pricePerMonth: number;
  billingInterval: 'month';
  features: string[];
  description: string;
}

export interface HormoziScore {
  dreamOutcome: number;    // 1-10
  likelihood: number;      // 1-10
  timeDelay: number;       // 1-10 (lower is better for client)
  effortSacrifice: number; // 1-10 (lower is better for client)
  valueScore: number;      // computed: (dreamOutcome * likelihood) / (timeDelay * effortSacrifice)
}

export interface PublicROIEstimate {
  industry: string;
  companySize: string;
  estimatedAnnualWaste: number;
  estimatedAnnualSavings: number;
  roiMultiple: number;
  paybackMonths: number;
  disclaimer: string;
}

export interface ValueStackItem {
  name: string;
  retailValue: number;
  bundlePrice: number; // what they actually pay (proportional)
  savings: number;
  role: string;
}

export interface ValueStack {
  items: ValueStackItem[];
  totalRetailValue: number;
  bundlePrice: number;
  totalSavings: number;
  savingsPercent: number;
}

// ============================================================================
// Tier Definitions
// ============================================================================

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'quick-win',
    name: 'AI Quick Win',
    tagline: 'Discover where AI fits in your business',
    targetAudience: 'Solopreneurs and small teams (1-10 employees)',
    price: 997,
    isCustomPricing: false,
    totalRetailValue: 6023,
    savingsPercent: 83,
    items: [
      { title: 'AI Audit Calculator', perceivedValue: 504, offerRole: 'lead_magnet', description: 'Comprehensive AI readiness assessment tool', isDeployed: false },
      { title: 'AI Implementation Playbook', perceivedValue: 504, offerRole: 'bonus', description: 'Step-by-step guide to implementing AI in your business' },
      { title: 'Automation ROI Templates Pack', perceivedValue: 378, offerRole: 'bonus', description: 'Ready-to-use templates for calculating automation ROI' },
      { title: 'Half-Day AI Strategy Workshop', perceivedValue: 3528, offerRole: 'core_offer', description: 'Intensive workshop to identify your top AI opportunities' },
      { title: '2 Follow-up Strategy Calls', perceivedValue: 504, offerRole: 'bonus', description: 'Personalized follow-up to refine your AI roadmap' },
      { title: '30-Day Email Support', perceivedValue: 605, offerRole: 'bonus', description: 'Direct access to our team for questions and guidance' },
    ],
    guarantee: {
      name: 'Quick Win Guarantee',
      type: 'unconditional',
      durationDays: 30,
      description: 'Identify 3+ actionable AI opportunities or get a full refund. No questions asked.',
      payoutType: 'refund',
    },
    ctaText: 'Get Started',
    ctaHref: '#contact',
  },
  {
    id: 'accelerator',
    name: 'AI Accelerator',
    tagline: 'Deploy your first AI tools',
    targetAudience: 'Small businesses ready to automate (1-25 employees)',
    price: 7497,
    isCustomPricing: false,
    totalRetailValue: 38749,
    savingsPercent: 81,
    featured: true,
    items: [
      { title: 'Everything in AI Quick Win', perceivedValue: 6023, offerRole: 'bonus', description: 'Full Quick Win package included' },
      { title: 'AI Customer Support Chatbot', perceivedValue: 15053, offerRole: 'core_offer', description: '24/7 AI-powered customer support — deployed and running', isDeployed: true },
      { title: 'Inbound Lead Tracking System', perceivedValue: 12230, offerRole: 'core_offer', description: 'Never miss a lead — automated tracking and follow-up', isDeployed: true },
      { title: '4-Week Implementation Coaching', perceivedValue: 2688, offerRole: 'bonus', description: 'Hands-on coaching through your AI tool deployment' },
      { title: 'Team Training Session', perceivedValue: 1344, offerRole: 'bonus', description: 'Get your whole team up to speed on the new tools' },
      { title: '90-Day Priority Support', perceivedValue: 1411, offerRole: 'bonus', description: 'Priority access to our support team for 90 days' },
    ],
    guarantee: {
      name: 'Accelerator Guarantee',
      type: 'conditional',
      durationDays: 90,
      description: 'Save 10+ hours per week within 90 days or we continue coaching you for free until you do.',
      payoutType: 'rollover_upsell',
    },
    ctaText: 'Start Accelerating',
    ctaHref: '#contact',
  },
  {
    id: 'growth-engine',
    name: 'Growth Engine',
    tagline: 'AI across lead gen, sales, and operations',
    targetAudience: 'Growing businesses scaling with AI (10-100 employees)',
    price: 14997,
    isCustomPricing: false,
    totalRetailValue: 115491,
    savingsPercent: 87,
    items: [
      { title: 'Everything in AI Accelerator', perceivedValue: 38749, offerRole: 'bonus', description: 'Full Accelerator package included' },
      { title: 'Lead Generation Workflow Agent', perceivedValue: 19757, offerRole: 'core_offer', description: 'Automated lead pipeline that fills itself', isDeployed: true },
      { title: 'Social Media Content Agent', perceivedValue: 17405, offerRole: 'core_offer', description: 'AI-generated content across all your social channels', isDeployed: true },
      { title: 'Client Onboarding Automation', perceivedValue: 12230, offerRole: 'bonus', description: 'Onboard new clients in days, not weeks', isDeployed: true },
      { title: 'AI Email Sequence Builder', perceivedValue: 9878, offerRole: 'bonus', description: 'Automated email nurture sequences that convert', isDeployed: true },
      { title: '12-Week Implementation Program', perceivedValue: 8064, offerRole: 'core_offer', description: 'Comprehensive rollout across your business' },
      { title: 'Monthly Advisory Calls (3 months)', perceivedValue: 3024, offerRole: 'bonus', description: 'Strategic guidance as you scale' },
      { title: 'Custom Analytics Dashboard', perceivedValue: 5174, offerRole: 'bonus', description: 'Real-time visibility into your AI tool performance' },
      { title: 'Priority Support Channel', perceivedValue: 1210, offerRole: 'bonus', description: 'Dedicated support channel for your team' },
    ],
    guarantee: {
      name: 'Growth Engine Guarantee',
      type: 'conditional',
      durationDays: 365,
      description: '3x ROI in year 1 or we continue supporting you at no additional cost.',
      payoutType: 'rollover_continuity',
    },
    ctaText: 'Start Growing',
    ctaHref: '#contact',
  },
  {
    id: 'digital-transformation',
    name: 'Digital Transformation',
    tagline: 'Comprehensive AI across your entire business',
    targetAudience: 'Mid-market companies (50-500 employees)',
    price: 29997,
    isCustomPricing: true,
    totalRetailValue: 218979,
    savingsPercent: 86,
    items: [
      { title: 'Everything in Growth Engine', perceivedValue: 115491, offerRole: 'bonus', description: 'Full Growth Engine package included' },
      { title: 'AI Voice Agent (Inbound)', perceivedValue: 16934, offerRole: 'core_offer', description: 'AI handles your phone calls 24/7', isDeployed: true },
      { title: 'Mobile App Generation', perceivedValue: 29165, offerRole: 'core_offer', description: 'Your own branded mobile application' },
      { title: 'Website Development / Redesign', perceivedValue: 17405, offerRole: 'core_offer', description: 'Modern, conversion-optimized web presence' },
      { title: 'RAG Knowledge Base System', perceivedValue: 17405, offerRole: 'bonus', description: 'AI-powered internal knowledge management', isDeployed: true },
      { title: 'Dedicated Account Manager (6 months)', perceivedValue: 13104, offerRole: 'bonus', description: 'Your single point of contact for everything' },
      { title: 'Quarterly Strategy Reviews', perceivedValue: 4032, offerRole: 'bonus', description: 'Regular strategic alignment and optimization' },
      { title: 'Maintenance & Optimization (6 months)', perceivedValue: 5443, offerRole: 'bonus', description: 'Ongoing tuning and improvement of all deployed tools' },
    ],
    guarantee: {
      name: 'Transformation Guarantee',
      type: 'conditional',
      durationDays: 540,
      description: 'Measurable efficiency gains within 90 days AND 5x ROI within 18 months, or continued support at no cost.',
      payoutType: 'rollover_continuity',
    },
    ctaText: 'Schedule a Call',
    ctaHref: '#contact',
  },
];

// ============================================================================
// Community Impact (Decoy) Tier Definitions
// Same outcomes, self-serve delivery, no guarantees, lower prices.
// Designed for nonprofits and educational institutions.
// ============================================================================

export const COMMUNITY_IMPACT_TIERS: PricingTier[] = [
  {
    id: 'ci-starter',
    name: 'CI Starter',
    tagline: 'Discover where AI fits in your organization',
    targetAudience: 'Nonprofits & educational institutions',
    price: 0,
    isCustomPricing: false,
    totalRetailValue: 2545,
    savingsPercent: 100,
    isDecoy: true,
    mirrorsTierId: 'quick-win',
    items: [
      { title: 'AI Strategy Workshop (Recorded)', perceivedValue: 630, offerRole: 'core_offer', description: 'Self-paced recorded workshop — discover your top AI opportunities' },
      { title: 'AI Implementation Playbook (PDF)', perceivedValue: 504, offerRole: 'bonus', description: 'Downloadable step-by-step guide' },
      { title: 'ROI Template Spreadsheets', perceivedValue: 378, offerRole: 'bonus', description: 'Ready-to-use templates for calculating automation ROI' },
      { title: 'Community Forum Access', perceivedValue: 403, offerRole: 'bonus', description: 'Peer support from similar organizations' },
      { title: 'AI Training Library Access', perceivedValue: 630, offerRole: 'bonus', description: '20+ hours of recorded AI training content' },
    ],
    guarantee: null,
    ctaText: 'Get Started',
    ctaHref: '#contact',
  },
  {
    id: 'ci-accelerator',
    name: 'CI Accelerator',
    tagline: 'Deploy your first AI tool',
    targetAudience: 'Nonprofits & educational institutions',
    price: 1997,
    isCustomPricing: false,
    totalRetailValue: 7955,
    savingsPercent: 75,
    isDecoy: true,
    mirrorsTierId: 'accelerator',
    items: [
      { title: 'Everything in CI Starter', perceivedValue: 2545, offerRole: 'bonus', description: 'Full CI Starter package included' },
      { title: 'Pre-Built Chatbot Template', perceivedValue: 3293, offerRole: 'core_offer', description: 'Self-install AI chatbot with step-by-step guide' },
      { title: 'Group Onboarding Webinar', perceivedValue: 1512, offerRole: 'bonus', description: 'Bi-weekly group calls over 6 weeks' },
      { title: '30-Day Email Support', perceivedValue: 605, offerRole: 'bonus', description: 'Email support for setup questions' },
    ],
    guarantee: null,
    ctaText: 'Start Building',
    ctaHref: '#contact',
  },
  {
    id: 'ci-growth',
    name: 'CI Growth',
    tagline: 'AI across lead gen, content, and operations',
    targetAudience: 'Nonprofits & educational institutions',
    price: 4997,
    isCustomPricing: false,
    totalRetailValue: 21429,
    savingsPercent: 77,
    isDecoy: true,
    mirrorsTierId: 'growth-engine',
    items: [
      { title: 'Everything in CI Accelerator', perceivedValue: 7955, offerRole: 'bonus', description: 'Full CI Accelerator package included' },
      { title: 'Lead Tracking Templates', perceivedValue: 4234, offerRole: 'core_offer', description: 'Template-based lead tracking system' },
      { title: 'Content Automation Templates', perceivedValue: 3293, offerRole: 'core_offer', description: 'Social media content templates and automation guides' },
      { title: 'Group Implementation Program (6 Weeks)', perceivedValue: 3024, offerRole: 'bonus', description: 'Bi-weekly group implementation calls' },
      { title: 'Shared Analytics Dashboard', perceivedValue: 2117, offerRole: 'bonus', description: 'Shared (not custom) performance dashboard' },
      { title: '60-Day Email Support', perceivedValue: 806, offerRole: 'bonus', description: 'Extended email support for your team' },
    ],
    guarantee: null,
    ctaText: 'Start Growing',
    ctaHref: '#contact',
  },
];

// Pre-built comparisons between CI and premium tiers
export const DECOY_COMPARISONS: DecoyComparison[] = COMMUNITY_IMPACT_TIERS.map((ciTier) => {
  const premiumTier = PRICING_TIERS.find(t => t.id === ciTier.mirrorsTierId)!;
  return {
    decoyTier: ciTier,
    premiumTier,
    keyDifferences: ciTier.id === 'ci-starter'
      ? [
          { feature: 'Workshop', decoyValue: 'Recorded (self-paced)', premiumValue: 'Live half-day session' },
          { feature: 'Follow-up', decoyValue: 'Community forum only', premiumValue: '2 personal strategy calls' },
          { feature: 'Support', decoyValue: 'None', premiumValue: '30-day email support' },
          { feature: 'Guarantee', decoyValue: 'None', premiumValue: '30-day money-back guarantee' },
        ]
      : ciTier.id === 'ci-accelerator'
      ? [
          { feature: 'Chatbot', decoyValue: 'Template (self-install)', premiumValue: 'Custom-deployed & configured' },
          { feature: 'Coaching', decoyValue: 'Group webinar (6 weeks)', premiumValue: '4-week 1-on-1 coaching' },
          { feature: 'Training', decoyValue: 'Recorded library', premiumValue: 'Live team session' },
          { feature: 'Support', decoyValue: '30-day email', premiumValue: '90-day priority support' },
          { feature: 'Guarantee', decoyValue: 'None', premiumValue: '90-day outcome guarantee' },
        ]
      : [
          { feature: 'Tools', decoyValue: 'Template-based (self-setup)', premiumValue: 'Custom-deployed & running' },
          { feature: 'Implementation', decoyValue: 'Group calls (6 weeks)', premiumValue: '12-week dedicated program' },
          { feature: 'Advisory', decoyValue: 'None', premiumValue: 'Monthly advisory calls (3 months)' },
          { feature: 'Dashboard', decoyValue: 'Shared template', premiumValue: 'Custom analytics dashboard' },
          { feature: 'Support', decoyValue: '60-day email', premiumValue: 'Priority support channel' },
          { feature: 'Guarantee', decoyValue: 'None', premiumValue: '365-day ROI guarantee' },
        ],
  };
});

// Hormozi scores for CI tiers (lower likelihood + more effort = lower value score)
export const CI_TIER_HORMOZI_SCORES: Record<string, HormoziScore> = {
  'ci-starter': calculateHormoziScore({ dreamOutcome: 6, likelihood: 6, timeDelay: 7, effortSacrifice: 5 }),
  'ci-accelerator': calculateHormoziScore({ dreamOutcome: 8, likelihood: 5, timeDelay: 6, effortSacrifice: 4 }),
  'ci-growth': calculateHormoziScore({ dreamOutcome: 9, likelihood: 5, timeDelay: 5, effortSacrifice: 4 }),
};

export const CONTINUITY_PLANS: ContinuityPlan[] = [
  {
    id: 'growth-partner',
    name: 'AI Growth Partner',
    pricePerMonth: 497,
    billingInterval: 'month',
    description: 'Stay connected and keep growing with ongoing group support.',
    features: [
      'Monthly group coaching call',
      'Resource library access',
      'Community membership',
      'Basic maintenance for deployed tools',
      'Email support',
    ],
  },
  {
    id: 'advisory-retainer',
    name: 'AI Advisory Retainer',
    pricePerMonth: 2500,
    billingInterval: 'month',
    description: 'Dedicated strategic partnership with full tool maintenance.',
    features: [
      'Monthly 1-on-1 advisory call',
      'Priority support (24hr response)',
      'Quarterly strategy review',
      'Full maintenance & optimization of all tools',
      'Dedicated Slack/Teams channel',
      'New feature requests (2/month)',
    ],
  },
  {
    id: 'white-label',
    name: 'White-Label License',
    pricePerMonth: 5000,
    billingInterval: 'month',
    description: 'License Amadutown-built tools under your own brand.',
    features: [
      'All tools branded under your company',
      'Custom domain and branding',
      'Client-facing dashboard',
      'Ongoing updates and maintenance',
      'Priority engineering support',
      'Setup fee applies (custom quote)',
    ],
  },
];

// ============================================================================
// Hormozi Value Equation Scoring
// ============================================================================

/**
 * Calculate a Hormozi Value Equation score for an offer.
 *
 * Score = (Dream Outcome × Perceived Likelihood) ÷ (Time Delay × Effort & Sacrifice)
 *
 * Each component is rated 1-10. Higher score = more compelling offer.
 */
export function calculateHormoziScore(params: {
  dreamOutcome: number;    // 1-10: How desirable is the end result?
  likelihood: number;      // 1-10: How confident are they it will work?
  timeDelay: number;       // 1-10: How long until they see results? (10 = instant, 1 = years)
  effortSacrifice: number; // 1-10: How easy is it for them? (10 = zero effort, 1 = massive effort)
}): HormoziScore {
  const { dreamOutcome, likelihood, timeDelay, effortSacrifice } = params;

  // Invert time and effort so higher = better for client
  // (In the formula, these are in the denominator, so we use them as-is for division)
  const timeInverse = Math.max(11 - timeDelay, 1); // 10 -> 1 (fast), 1 -> 10 (slow)
  const effortInverse = Math.max(11 - effortSacrifice, 1);

  const valueScore = (dreamOutcome * likelihood) / (timeInverse * effortInverse);

  return {
    dreamOutcome,
    likelihood,
    timeDelay,
    effortSacrifice,
    valueScore: Math.round(valueScore * 100) / 100,
  };
}

// Pre-computed scores for each tier
export const TIER_HORMOZI_SCORES: Record<string, HormoziScore> = {
  'quick-win': calculateHormoziScore({ dreamOutcome: 6, likelihood: 9, timeDelay: 9, effortSacrifice: 9 }),
  'accelerator': calculateHormoziScore({ dreamOutcome: 8, likelihood: 8, timeDelay: 8, effortSacrifice: 8 }),
  'growth-engine': calculateHormoziScore({ dreamOutcome: 9, likelihood: 8, timeDelay: 7, effortSacrifice: 9 }),
  'digital-transformation': calculateHormoziScore({ dreamOutcome: 10, likelihood: 9, timeDelay: 6, effortSacrifice: 10 }),
};

// ============================================================================
// Public ROI Estimation (Top-of-Funnel)
// ============================================================================

/**
 * Generate generic ROI estimates for the public pricing page.
 * Uses industry benchmarks without specific client data.
 */
export function generatePublicROI(
  industry: string,
  companySize: string,
  benchmarks: IndustryBenchmark[]
): PublicROIEstimate {
  const normalizedSize = normalizeCompanySize(companySize);

  // Look up key benchmarks
  const wageBenchmark = findBestBenchmark(benchmarks, industry, normalizedSize, 'avg_hourly_wage');
  const dealBenchmark = findBestBenchmark(benchmarks, industry, normalizedSize, 'avg_deal_size');
  const employeeCost = findBestBenchmark(benchmarks, industry, normalizedSize, 'avg_employee_cost');

  const hourlyRate = wageBenchmark?.value ?? 40;
  const dealSize = dealBenchmark?.value ?? 5000;
  const annualEmployeeCost = employeeCost?.value ?? 60000;

  // Conservative estimates for a typical SMB:
  // - 15 hrs/week wasted on manual processes
  // - 50 missed leads/year due to slow follow-up
  // - 0.2 FTE that could be redirected
  const manualProcessWaste = 15 * hourlyRate * 52; // time_saved
  const missedLeadValue = 50 * dealSize * 0.20;     // opportunity_cost
  const redirectedLabor = 0.2 * annualEmployeeCost;  // replacement_cost

  const estimatedAnnualWaste = Math.round(manualProcessWaste + missedLeadValue + redirectedLabor);

  // Conservative savings assumption: 40-60% of waste addressed
  const savingsRate = normalizedSize === '1-10' ? 0.40 : 0.55;
  const estimatedAnnualSavings = Math.round(estimatedAnnualWaste * savingsRate);

  // Use mid-tier pricing for ROI calc
  const investmentAmount = normalizedSize === '1-10' ? 7497 : 14997;
  const roi = calculateROI(estimatedAnnualSavings, investmentAmount);

  return {
    industry: industry || 'General',
    companySize: normalizedSize,
    estimatedAnnualWaste,
    estimatedAnnualSavings,
    roiMultiple: Math.round((estimatedAnnualSavings / investmentAmount) * 10) / 10,
    paybackMonths: roi.paybackMonths,
    disclaimer: 'Estimates based on industry benchmarks. Actual results depend on your specific situation. Schedule a free AI audit for personalized projections.',
  };
}

// ============================================================================
// Tier Recommendation
// ============================================================================

/**
 * Recommend a tier based on company size, opportunity score, and budget signals.
 * For nonprofit/education orgs, recommends Community Impact tiers instead.
 */
export function determineTier(params: {
  companySize: string;
  opportunityScore?: number; // 1-10 from diagnostic
  urgencyScore?: number;     // 1-10 from diagnostic
  budgetSignal?: 'low' | 'medium' | 'high' | 'enterprise';
  orgType?: 'for_profit' | 'nonprofit' | 'education';
}): string {
  const { companySize, opportunityScore = 5, budgetSignal, orgType } = params;
  const size = normalizeCompanySize(companySize);

  // Nonprofit/education orgs get Community Impact tiers
  if (orgType === 'nonprofit' || orgType === 'education') {
    if (budgetSignal === 'high' || budgetSignal === 'enterprise') {
      // If they signal high budget, offer premium despite org type
      return 'accelerator';
    }
    if (size === '1-10' || budgetSignal === 'low') return 'ci-starter';
    if (size === '11-50') return 'ci-accelerator';
    return 'ci-growth';
  }

  // Budget signal overrides
  if (budgetSignal === 'enterprise') return 'digital-transformation';
  if (budgetSignal === 'low') return 'quick-win';

  // Size-based defaults
  if (size === '1-10') {
    return opportunityScore >= 7 ? 'accelerator' : 'quick-win';
  }
  if (size === '11-50') {
    return opportunityScore >= 7 ? 'growth-engine' : 'accelerator';
  }
  if (size === '51-200' || size === '201-1000') {
    return opportunityScore >= 7 ? 'digital-transformation' : 'growth-engine';
  }

  return 'accelerator'; // safe default
}

// ============================================================================
// Value Stack Calculation
// ============================================================================

/**
 * Compute the visual value stack for a tier — shows what each item is "worth"
 * vs. what the client actually pays.
 */
export function calculateValueStack(tier: PricingTier): ValueStack {
  const items: ValueStackItem[] = tier.items.map((item) => {
    const proportion = item.perceivedValue / tier.totalRetailValue;
    const bundlePrice = Math.round(tier.price * proportion);
    return {
      name: item.title,
      retailValue: item.perceivedValue,
      bundlePrice,
      savings: item.perceivedValue - bundlePrice,
      role: item.offerRole,
    };
  });

  return {
    items,
    totalRetailValue: tier.totalRetailValue,
    bundlePrice: tier.price,
    totalSavings: tier.totalRetailValue - tier.price,
    savingsPercent: tier.savingsPercent,
  };
}

// ============================================================================
// Comparison Data (What's Included vs Competitors)
// ============================================================================

export interface ComparisonRow {
  capability: string;
  typicalAgency: boolean | string;
  ottleyMorningside: boolean | string;
  saraevLeftClick: boolean | string;
  amadutown: boolean | string;
}

export const COMPARISON_DATA: ComparisonRow[] = [
  { capability: 'AI Chatbots', typicalAgency: 'Single tool', ottleyMorningside: true, saraevLeftClick: false, amadutown: 'Customer + Lead' },
  { capability: 'AI Voice Agents', typicalAgency: false, ottleyMorningside: 'Emerging', saraevLeftClick: false, amadutown: true },
  { capability: 'Workflow Automation', typicalAgency: 'Sometimes', ottleyMorningside: false, saraevLeftClick: true, amadutown: true },
  { capability: 'Lead Gen Agents', typicalAgency: false, ottleyMorningside: false, saraevLeftClick: 'Partial', amadutown: true },
  { capability: 'Social Media Automation', typicalAgency: false, ottleyMorningside: false, saraevLeftClick: false, amadutown: true },
  { capability: 'Client Onboarding', typicalAgency: false, ottleyMorningside: false, saraevLeftClick: false, amadutown: true },
  { capability: 'Website Development', typicalAgency: false, ottleyMorningside: false, saraevLeftClick: false, amadutown: true },
  { capability: 'Mobile App Generation', typicalAgency: false, ottleyMorningside: false, saraevLeftClick: false, amadutown: true },
  { capability: 'Outcome Guarantees', typicalAgency: 'Rare', ottleyMorningside: false, saraevLeftClick: false, amadutown: 'Tracked & Conditional' },
  { capability: 'Transparent ROI Calculations', typicalAgency: false, ottleyMorningside: false, saraevLeftClick: false, amadutown: 'Formula-level' },
  { capability: 'Self-Serve Products', typicalAgency: false, ottleyMorningside: 'Limited', saraevLeftClick: 'Courses', amadutown: 'E-books, courses, tools' },
  { capability: 'Continuity / Retainer', typicalAgency: 'Project-to-project', ottleyMorningside: 'Retainer', saraevLeftClick: 'Retainer', amadutown: 'Structured plans + maintenance' },
];

// ============================================================================
// Formatting Helpers
// ============================================================================

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Formatted dollar amount without symbol (commas, no cents). Use with DollarSign icon or when building "$" + amount. */
export function formatDollarAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(amount));
}

/** Format price for display; returns "Free" when amount is 0 */
export function formatPriceOrFree(amount: number): string {
  return amount === 0 ? 'Free' : formatCurrency(amount);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
