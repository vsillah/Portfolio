import { calculateHormoziScore, type HormoziScore } from './pricing-model'
import type { CampaignType, CriteriaType, TrackingSource } from './campaigns'
import type { GuaranteePayoutType, PayoutAmountType } from './guarantees'

export type OfferArchitectureStage =
  | 'attraction'
  | 'core'
  | 'upsell'
  | 'downsell'
  | 'continuity'
  | 'risk_reversal'

export interface OfferArchitectureItem {
  id: string
  stage: OfferArchitectureStage
  title: string
  buyerQuestion: string
  offer: string
  priceFrame: string
  valueFrame: string
  proofRequired: string[]
  nextAction: string
}

export interface OfferArchitectureEvidenceItem {
  label: string
  value: string
  source: string
  confidence: 'high' | 'medium' | 'low'
}

export interface OfferArchitectureCostLine {
  label: string
  estimatedRange: string
  rationale: string
}

export interface OfferArchitectureScoreComponent {
  key: keyof Pick<HormoziScore, 'dreamOutcome' | 'likelihood' | 'timeDelay' | 'effortSacrifice'>
  label: string
  score: number
  denominator: number
  direction: string
  rationale: string
  evidence: string[]
}

export interface OfferArchitectureClientBrief {
  routeHint: string
  shareStatus: 'draft' | 'ready_for_client_review' | 'internal_only'
  title: string
  audienceLabel: string
  summary: string
  pricingFrame: string
  evidenceSummary: string[]
  recommendedOptions: Array<{
    label: string
    priceFrame: string
    clientSafeDescription: string
  }>
  excludes: string[]
}

export interface OfferArchitectureCampaignTemplate {
  surfaceLabel: string
  surfaceHref: string
  reuseRationale: string
  suggestedName: string
  suggestedSlug: string
  campaignType: CampaignType
  payoutType: GuaranteePayoutType
  payoutAmountType: PayoutAmountType
  payoutAmountValue: number
  rolloverBonusMultiplier: number
  completionWindowDays: number
  minPurchaseAmount: number
  eligibleStage: OfferArchitectureStage
  criteriaTemplates: Array<{
    labelTemplate: string
    descriptionTemplate: string
    criteriaType: CriteriaType
    trackingSource: TrackingSource
    required: boolean
  }>
}

export interface ProductAssetOfferArchitecture {
  id: string
  title: string
  audience: string
  privacyBoundary: string
  thesis: string
  valueEquation: HormoziScore
  anchors: {
    replacementCost: string
    primaryFee: string
    annualLicense: string
    revenueShare: string
  }
  principles: string[]
  clientBrief: OfferArchitectureClientBrief
  evidence: OfferArchitectureEvidenceItem[]
  replacementCostLines: OfferArchitectureCostLine[]
  scoreComponents: OfferArchitectureScoreComponent[]
  campaignTemplate: OfferArchitectureCampaignTemplate
  items: OfferArchitectureItem[]
}

export const REVERSR_PRODUCT_ASSET_OFFER_ARCHITECTURE: ProductAssetOfferArchitecture = {
  id: 'reversr-product-asset-commercialization',
  title: 'ReversR Product Asset Commercialization',
  audience: 'Manufacturing, R&D, precision engineering, and equipment rebuild decision makers',
  privacyBoundary:
    'Admin/private strategy only. Do not expose client names, offline materials, private repositories, or raw evidence in public Portfolio surfaces.',
  thesis:
    'Position ReversR as original IP plus commercialization work: a product asset with verified rebuild evidence, not a custom software invoice.',
  valueEquation: calculateHormoziScore({
    dreamOutcome: 10,
    likelihood: 8,
    timeDelay: 7,
    effortSacrifice: 9,
  }),
  anchors: {
    replacementCost: '$100,000+',
    primaryFee: '$30,000 development and commercialization contribution',
    annualLicense: '$6,000-$12,000 annual commercial license',
    revenueShare: '5% revenue share where commercialization upside is shared',
  },
  principles: [
    'Lead with the asset and IP rights, then support the case with repo evidence.',
    'Use hours, commits, files, and release gates as proof of investment, not as the billing unit.',
    'Make the next purchase feel like risk reduction: clearer ownership, cleaner release gates, and a more credible path to market.',
    'Give a lower-friction path without giving away commercial rights.',
    'Use continuity for stewardship, managed infrastructure, and commercialization support after the transaction.',
  ],
  clientBrief: {
    routeHint: '/proposal/[code]',
    shareStatus: 'draft',
    title: 'ReversR Rebuild Product Asset Proposal',
    audienceLabel: 'Engineering and commercialization decision maker',
    summary:
      'ReversR Rebuild is a working product asset for machine reconstruction workflow evaluation. It connects scan or description intake, inventory validation, machine matching, reconstruction package generation, BOM and pricing estimate output, quote packet export, and human-reviewed vendor request support.',
    pricingFrame:
      'The recommended client proposal should price the asset and next commercialization step, not bill commits, hours, or lines of code as the unit of sale.',
    evidenceSummary: [
      '149 all-branch commits and 140 current-branch commits in the commercialization repository.',
      '271 tracked files and 36,775 tracked text/code/doc lines, excluding build output, Expo output, assets, and lockfile.',
      '151 files changed from root to current branch, with 30,973 insertions and 4,990 deletions.',
      'Release evidence currently shows 38 passing gates and 1 remaining store-console/TestFlight readiness gate.',
      'The original AI Studio repository is lineage evidence for the prior concept; the ReversR Rebuild repository is the primary commercialization evidence.',
    ],
    recommendedOptions: [
      {
        label: 'Readiness Credit',
        priceFrame: '$7,500',
        clientSafeDescription:
          'A focused engineering evidence packet and option window. If the client proceeds, the amount can credit into the commercialization offer.',
      },
      {
        label: 'Commercialization Sprint',
        priceFrame: '$30,000 anchor',
        clientSafeDescription:
          'Commercial access plus a governed sprint to finalize handoff, release gates, pilot setup, and market positioning.',
      },
      {
        label: 'License And Stewardship',
        priceFrame: '$6,000-$12,000 annual license or defined monthly support',
        clientSafeDescription:
          'Ongoing release stewardship, support, and licensing terms after the first transaction.',
      },
    ],
    excludes: [
      'Private offline client material',
      'Raw AI chat transcripts',
      'Private repository details beyond approved summaries',
      'Internal pricing strategy language',
    ],
  },
  evidence: [
    {
      label: 'Commercial rebuild repository',
      value: 'vsillah/ReversR-Rebuild',
      source: 'repo-evidence-snapshot.json',
      confidence: 'high',
    },
    {
      label: 'All-branch commits',
      value: '149',
      source: 'git metrics captured 2026-06-12',
      confidence: 'high',
    },
    {
      label: 'Tracked implementation surface',
      value: '271 tracked files; 36,775 tracked text/code/doc lines',
      source: 'repo-evidence-snapshot.json',
      confidence: 'high',
    },
    {
      label: 'Root-to-head change volume',
      value: '151 files changed; 30,973 insertions; 4,990 deletions',
      source: 'repo-evidence-snapshot.json',
      confidence: 'high',
    },
    {
      label: 'Release readiness',
      value: '38 passing gates; 1 pending store-console/TestFlight gate',
      source: 'release:status snapshot',
      confidence: 'high',
    },
    {
      label: 'Prototype lineage',
      value: 'Private AI Studio predecessor repo created November 2025',
      source: 'repo-evidence-snapshot.json',
      confidence: 'medium',
    },
  ],
  replacementCostLines: [
    {
      label: 'Product strategy and workflow architecture',
      estimatedRange: '$10,000-$20,000',
      rationale: 'Define the machine reconstruction workflow, product boundaries, and buyer-ready handoff logic.',
    },
    {
      label: 'Mobile application implementation',
      estimatedRange: '$25,000-$45,000',
      rationale: 'Build and QA the app identity, scan/description flow, native evidence, and release surfaces.',
    },
    {
      label: 'Backend/API and inventory workflow',
      estimatedRange: '$15,000-$30,000',
      rationale: 'Support hosted API readiness, inventory validation, machine matching, and structured package generation.',
    },
    {
      label: 'AI, BOM, quote packet, and vendor draft logic',
      estimatedRange: '$20,000-$40,000',
      rationale: 'Create the connective workflow from machine input to BOM/pricing estimate, manufacturer packet, and human-reviewed vendor request.',
    },
    {
      label: 'QA, release evidence, and store readiness',
      estimatedRange: '$10,000-$20,000',
      rationale: 'Create review packets, native QA records, policy/support routes, release evidence, and remaining gate tracking.',
    },
    {
      label: 'Documentation and commercial handoff',
      estimatedRange: '$5,000-$10,000',
      rationale: 'Package ownership, license, support boundaries, and pilot/commercialization decision materials.',
    },
  ],
  scoreComponents: [
    {
      key: 'dreamOutcome',
      label: 'Dream outcome',
      score: 10,
      denominator: 10,
      direction: 'Higher is better.',
      rationale:
        'The buyer is not buying screens; the outcome is a commercializable reconstruction workflow that can turn ambiguous machine inputs into reviewable manufacturing artifacts.',
      evidence: [
        'Scan or describe a machine',
        'Validate inventory connector',
        'Generate reconstruction package, BOM, pricing estimate, and quote packet',
      ],
    },
    {
      key: 'likelihood',
      label: 'Perceived likelihood',
      score: 8,
      denominator: 10,
      direction: 'Higher is better.',
      rationale:
        'Likelihood is strong because the repo and release packet show working implementation depth, but it should not be scored 10 until the final external review gate is closed.',
      evidence: [
        '149 all-branch commits',
        '38 passing release gates',
        '1 remaining store-console/TestFlight readiness gate',
      ],
    },
    {
      key: 'timeDelay',
      label: 'Time delay',
      score: 7,
      denominator: 10,
      direction: 'Higher means faster path to value.',
      rationale:
        'The asset is already built enough to shorten the path to pilot or handoff, while final store-console readiness and signoff still create a real delay.',
      evidence: [
        'Hosted API and policy URL readiness',
        'Native Android/iOS QA evidence',
        'Remaining final signoff gate',
      ],
    },
    {
      key: 'effortSacrifice',
      label: 'Effort burden',
      score: 9,
      denominator: 10,
      direction: 'Higher means less client effort.',
      rationale:
        'The client can evaluate a packaged product asset and decision path rather than starting with a blank-slate build team.',
      evidence: [
        'Evidence packet exists',
        'Handoff scope can be defined',
        'Creditable readiness path reduces decision risk',
      ],
    },
  ],
  campaignTemplate: {
    surfaceLabel: 'Attraction Campaigns',
    surfaceHref: '/admin/campaigns',
    reuseRationale:
      'Use the existing campaign engine for the attraction and downsell bridge: completion windows, criteria templates, eligible bundles, manual enrollment, and rollover credits already match this offer path.',
    suggestedName: 'Rebuild Readiness Credit',
    suggestedSlug: 'rebuild-readiness-credit',
    campaignType: 'bonus_credit',
    payoutType: 'rollover_upsell',
    payoutAmountType: 'fixed',
    payoutAmountValue: 7500,
    rolloverBonusMultiplier: 1,
    completionWindowDays: 30,
    minPurchaseAmount: 7500,
    eligibleStage: 'core',
    criteriaTemplates: [
      {
        labelTemplate: 'Review the engineering asset evidence packet',
        descriptionTemplate:
          'Confirm the repo evidence, release gates, market comparators, and IP lineage are sufficient for a commercial decision.',
        criteriaType: 'action',
        trackingSource: 'manual',
        required: true,
      },
      {
        labelTemplate: 'Define the first pilot or commercialization target',
        descriptionTemplate:
          'Name the operating use case, buyer path, or pilot environment that the core sprint should support.',
        criteriaType: 'action',
        trackingSource: 'manual',
        required: true,
      },
      {
        labelTemplate: 'Choose the rights path before the option window expires',
        descriptionTemplate:
          'Select license, acquisition, stewardship, or no-go so the credit can roll into the right commercial offer.',
        criteriaType: 'result',
        trackingSource: 'manual',
        required: true,
      },
    ],
  },
  items: [
    {
      id: 'attraction-engineering-brief',
      stage: 'attraction',
      title: 'Rebuild Readiness Credit Campaign',
      buyerQuestion: 'Is this real enough for an engineering buyer to take seriously?',
      offer:
        'A concise evidence brief and option-window assessment showing product lineage, rebuild workflow, repo activity, release gates, and market comparators.',
      priceFrame: '$7,500 readiness credit that can roll into the core product-asset offer within a fixed decision window.',
      valueFrame:
        'Reduces skepticism before the commercial offer by using the existing campaign system to track criteria, preserve the asset price, and make the next step feel lower risk.',
      proofRequired: [
        'Repo metrics snapshot',
        'Release status gate count',
        'Market comparator map',
        'IP lineage summary',
      ],
      nextAction: 'Create this in Attraction Campaigns as a Bonus Credit campaign with rollover-to-upsell payout terms.',
    },
    {
      id: 'core-asset-license-sprint',
      stage: 'core',
      title: 'Product Asset License And Commercialization Sprint',
      buyerQuestion: 'What am I actually buying?',
      offer:
        'Commercial access to the ReversR rebuild asset plus a governed sprint to finish handoff, release gates, pilot setup, and market positioning.',
      priceFrame: '$30,000 anchor, with final structure set by ownership, license, and support terms.',
      valueFrame:
        'Frames the transaction around commercialization rights and replacement cost instead of hourly labor.',
      proofRequired: [
        'IP positioning paragraph',
        'Release evidence bundle',
        'Handoff scope',
        'License boundary',
      ],
      nextAction: 'Present as the recommended offer when the buyer wants a serious commercial path.',
    },
    {
      id: 'upsell-managed-commercialization',
      stage: 'upsell',
      title: 'Managed Commercialization Buildout',
      buyerQuestion: 'What happens if we want to sell, pilot, or operate this seriously?',
      offer:
        'Additional implementation for production connector hardening, pilot operations, demo assets, QA expansion, and stakeholder-ready reporting.',
      priceFrame: '$15,000-$35,000 depending on connector depth, pilot scope, and production hardening.',
      valueFrame:
        'Captures the next problem after asset acquisition: making the product credible in a real operating or sales environment.',
      proofRequired: [
        'Pilot goal',
        'Connector source boundary',
        'QA plan',
        'Commercial demo requirements',
      ],
      nextAction: 'Offer after core buy-in, especially if the client asks how to take the asset to market.',
    },
    {
      id: 'downsell-readiness-packet',
      stage: 'downsell',
      title: 'Readiness Packet And Option Hold',
      buyerQuestion: 'What if I am not ready to commit to the full asset/license structure?',
      offer:
        'A limited paid packet with evidence, technical handoff, decision memo, and a defined option window that can credit into the core offer.',
      priceFrame: '$7,500-$12,500, creditable toward the core offer within a fixed decision window.',
      valueFrame:
        'Protects the relationship and preserves pricing integrity without discounting the asset.',
      proofRequired: [
        'Packet scope',
        'Credit window',
        'Excluded commercial rights',
        'Next decision date',
      ],
      nextAction: 'Use when the buyer needs internal alignment or wants proof before rights discussions.',
    },
    {
      id: 'continuity-commercial-stewardship',
      stage: 'continuity',
      title: 'Commercial Stewardship Plan',
      buyerQuestion: 'Who keeps this alive after the first transaction?',
      offer:
        'Monthly or annual support for managed releases, roadmap decisions, connector maintenance, QA checks, and commercialization guidance.',
      priceFrame: '$2,500-$5,000 monthly or $6,000-$12,000 annual license depending on rights and service level.',
      valueFrame:
        'Turns the product from a one-time handoff into a governed asset with maintenance, learning, and commercial follow-through.',
      proofRequired: [
        'Support SLA',
        'Release cadence',
        'Issue triage boundary',
        'License renewal terms',
      ],
      nextAction: 'Attach to the core offer as the default post-sprint operating model.',
    },
    {
      id: 'risk-reversal-credit-and-gates',
      stage: 'risk_reversal',
      title: 'Milestone Credit And Gate-Based Risk Reversal',
      buyerQuestion: 'How do I know I am not paying for uncertainty?',
      offer:
        'Use milestone gates, creditable downsell fees, and support extensions if defined release or pilot gates are delayed by implementation issues inside the agreed scope.',
      priceFrame: 'Risk reversal is built into terms instead of discounting the fee.',
      valueFrame:
        'Increases perceived likelihood while protecting the asset price and avoiding open-ended guarantees.',
      proofRequired: [
        'Gate list',
        'Client-owned blockers',
        'Provider/account blockers',
        'Support extension rules',
      ],
      nextAction: 'Write into the proposal terms before client review.',
    },
  ],
}

export const PRODUCT_ASSET_OFFER_ARCHITECTURES = [
  REVERSR_PRODUCT_ASSET_OFFER_ARCHITECTURE,
]

export function getOfferStageLabel(stage: OfferArchitectureStage): string {
  switch (stage) {
    case 'attraction':
      return 'Attraction'
    case 'core':
      return 'Core Offer'
    case 'upsell':
      return 'Upsell'
    case 'downsell':
      return 'Downsell'
    case 'continuity':
      return 'Continuity'
    case 'risk_reversal':
      return 'Risk Reversal'
  }
}
