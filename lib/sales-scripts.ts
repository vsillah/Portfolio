// Sales Scripts Library - Hormozi Framework Implementation
// Handles script logic, recommendations, and offer calculations

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export type ContentType = 
  | 'product'
  | 'project'
  | 'video'
  | 'publication'
  | 'music'
  | 'lead_magnet'
  | 'prototype'
  | 'service';

export type OfferRole = 
  | 'core_offer' 
  | 'bonus' 
  | 'upsell' 
  | 'downsell' 
  | 'continuity' 
  | 'lead_magnet' 
  | 'decoy' 
  | 'anchor';

export type OfferType = 
  | 'attraction' 
  | 'upsell' 
  | 'downsell' 
  | 'continuity' 
  | 'core' 
  | 'objection';

export type FunnelStage = 
  | 'prospect' 
  | 'interested' 
  | 'informed' 
  | 'converted' 
  | 'active' 
  | 'upgraded';

export type SessionOutcome = 
  | 'converted' 
  | 'downsold' 
  | 'deferred' 
  | 'lost' 
  | 'in_progress';

export type PayoutType = 'credit' | 'refund' | 'rollover' | 'rollover_upsell' | 'rollover_continuity';

// ============================================================================
// Response Tracking Types (for Dynamic Sales Flow)
// ============================================================================

export type ResponseType = 
  | 'positive'           // Client showed interest
  | 'price_objection'    // Too expensive / budget concerns
  | 'timing_objection'   // Not the right time
  | 'authority_objection'// Needs approval from others
  | 'feature_concern'    // Feature/fit doesn't match needs
  | 'past_failure'       // Had bad experience before
  | 'diy'                // Wants to do it themselves
  | 'competitor'         // Considering alternatives
  | 'neutral'            // No clear signal
  | 'budget_constrained_nonprofit'; // Nonprofit/education with budget constraints

export type OfferStrategy = 
  | 'stack_bonuses'      // Add more value with bonuses
  | 'show_decoy'         // Present decoy to reframe value
  | 'show_anchor'        // Present anchor for price contrast
  | 'payment_plan'       // Offer payment terms (downsell)
  | 'limited_time'       // Create urgency with limited offer
  | 'case_study'         // Show social proof
  | 'guarantee'          // Reduce risk with guarantees
  | 'trial_offer'        // Low-risk trial option
  | 'stakeholder_call'   // Schedule call with decision makers
  | 'roi_calculator'     // Show ROI/value breakdown
  | 'different_product'  // Suggest alternative product
  | 'schedule_followup'  // Schedule future call
  | 'continue_script';   // Move to next script step

export interface ConversationResponse {
  id: string;
  stepId: string;
  responseType: ResponseType;
  notes?: string;
  timestamp: string;
  offerPresented?: string;
  strategyChosen?: OfferStrategy;
  aiRecommendations?: AIRecommendation[];
}

export interface ConversationState {
  currentStep: number;
  responseHistory: ConversationResponse[];
  offersPresented: string[];
  objectionsRaised: ResponseType[];
  positiveSignals: number;
  selectedProducts: number[];
  dynamicSteps: DynamicStep[];
  isCallActive: boolean;
}

// ============================================================================
// Dynamic Script Generation Types
// ============================================================================

export type StepType = 
  | 'opening'           // Initial rapport building
  | 'discovery'         // Understanding their situation
  | 'presentation'      // Presenting core offer
  | 'value_stack'       // Adding bonuses/value
  | 'objection_handle'  // Responding to objection
  | 'social_proof'      // Case studies/testimonials
  | 'risk_reversal'     // Guarantees/trials
  | 'pricing'           // Presenting pricing options
  | 'close'             // Asking for the sale
  | 'followup';         // Scheduling next steps

export interface DynamicStep {
  id: string;
  stepNumber: number;
  type: StepType;
  title: string;
  objective: string;
  talkingPoints: string[];
  suggestedActions: string[];
  productsToPresent: number[];
  triggeredBy?: {
    responseType: ResponseType;
    strategy: OfferStrategy;
  };
  status: 'pending' | 'active' | 'completed' | 'skipped';
  completedAt?: string;
  response?: ResponseType;
}

export interface GenerateStepRequest {
  stepType: StepType;
  audit: {
    business_challenges?: Record<string, unknown>;
    budget_timeline?: Record<string, unknown>;
    ai_readiness?: Record<string, unknown>;
    automation_needs?: Record<string, unknown>;
    decision_making?: Record<string, unknown>;
    urgency_score?: number;
    opportunity_score?: number;
    key_insights?: string[];
    sales_notes?: string;
  };
  clientName?: string;
  clientCompany?: string;
  previousSteps: DynamicStep[];
  lastResponse?: ResponseType;
  chosenStrategy?: OfferStrategy;
  availableProducts: ProductWithRole[];
  conversationHistory: ConversationResponse[];
}

export interface AIRecommendation {
  strategy: OfferStrategy;
  offerRole: OfferRole | null;
  products: Array<{
    id: number;
    name: string;
    reason: string;
  }>;
  confidence: number;
  talkingPoint: string;
  why: string;
}

export interface RecommendationRequest {
  audit: {
    business_challenges?: Record<string, unknown>;
    budget_timeline?: Record<string, unknown>;
    ai_readiness?: Record<string, unknown>;
    urgency_score?: number;
    opportunity_score?: number;
  };
  currentObjection: ResponseType;
  conversationHistory: ConversationResponse[];
  productsPresented: number[];
  availableProducts: ProductWithRole[];
}

export interface ProductOfferRole {
  id: string;
  product_id: number;
  offer_role: OfferRole;
  dream_outcome_description: string | null;
  likelihood_multiplier: number | null;
  time_reduction: number | null;
  effort_reduction: number | null;
  retail_price: number | null;
  offer_price: number | null;
  perceived_value: number | null;
  bonus_name: string | null;
  bonus_description: string | null;
  qualifying_actions: Record<string, unknown> | null;
  payout_type: PayoutType | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  title: string;
  description: string | null;
  type: string;
  price: number | null;
  file_path: string | null;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
}

export interface ProductWithRole extends Product {
  role_id: string | null;
  offer_role: OfferRole | null;
  dream_outcome_description: string | null;
  likelihood_multiplier: number | null;
  time_reduction: number | null;
  effort_reduction: number | null;
  role_retail_price: number | null;
  offer_price: number | null;
  perceived_value: number | null;
  bonus_name: string | null;
  bonus_description: string | null;
  qualifying_actions: Record<string, unknown> | null;
  payout_type: PayoutType | null;
}

// Generic content item that can be any content type
export interface ContentItem {
  content_type: ContentType;
  content_id: string;
  title: string;
  description: string | null;
  subtype: string | null;
  price: number | null;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface ContentWithRole extends ContentItem {
  role_id: string | null;
  offer_role: OfferRole | null;
  dream_outcome_description: string | null;
  likelihood_multiplier: number | null;
  time_reduction: number | null;
  effort_reduction: number | null;
  role_retail_price: number | null;
  offer_price: number | null;
  perceived_value: number | null;
  bonus_name: string | null;
  bonus_description: string | null;
  qualifying_actions: Record<string, unknown> | null;
  payout_type: PayoutType | null;
}

// ============================================================================
// Offer Bundle Types
// ============================================================================

// Bundle item with override capabilities
// Overrides take precedence over content_offer_roles - they do NOT modify original content
export interface BundleItem {
  content_type: ContentType;
  content_id: string;
  display_order: number;
  is_optional?: boolean;
  
  // Override fields - take precedence over content_offer_roles when set
  // These are LOCAL to the bundle and do NOT affect the canonical classification
  override_title?: string;
  override_description?: string;
  override_role?: OfferRole;
  override_price?: number;
  override_perceived_value?: number;
  override_dream_outcome?: string;
  override_bonus_name?: string;
  override_bonus_goal_relation?: string;
  override_likelihood?: number;
  override_time_reduction?: number;
  override_effort_reduction?: number;
}

// Resolved item with canonical + override values merged for display
export interface ResolvedBundleItem extends ContentWithRole {
  display_order: number;
  is_optional: boolean;
  has_overrides: boolean;  // true if any override_* field was applied
  // Store original values for comparison/display
  original_role?: OfferRole;
  original_price?: number;
  original_perceived_value?: number;
  // Override fields for admin editing (stored in bundle_items JSONB)
  override_title?: string;
  override_description?: string;
}

// Offer bundle template
export interface OfferBundle {
  id: string;
  name: string;
  description?: string;
  parent_bundle_id?: string;  // For lineage tracking (forked bundles)
  base_bundle_id?: string;    // When set, includes all items from base bundle plus bundle_items (add-ons)
  bundle_type: 'standard' | 'custom' | 'decoy';
  bundle_items: BundleItem[];
  total_retail_value?: number;
  total_perceived_value?: number;
  bundle_price?: number;
  default_discount_percent?: number;
  target_funnel_stages?: FunnelStage[];
  notes?: string;
  is_active: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  // Community Impact (decoy) fields
  is_decoy?: boolean;
  target_audience?: string[];     // e.g. ['nonprofit', 'education']
  mirrors_tier_id?: string;       // The premium tier this decoy contrasts against
  has_guarantee?: boolean;
  // Pricing page display
  pricing_page_segments?: string[];  // smb, midmarket, nonprofit
  pricing_tier_slug?: string;
  tagline?: string;
  target_audience_display?: string;
  pricing_display_order?: number;
  is_featured?: boolean;
  guarantee_name?: string;
  guarantee_description?: string;
  cta_text?: string;
  cta_href?: string;
}

// Working bundle during a sales session
export interface SessionBundle {
  source_bundle_id?: string;  // Original template (if started from one)
  source_bundle_name?: string;
  items: ResolvedBundleItem[];
  is_modified: boolean;       // true if any changes made from source
  modifications_count: number;
}

// Bundle with stats for list views
export interface BundlePreviewItem {
  content_type: ContentType;
  content_id: string;
  title: string;
}

export interface OfferBundleWithStats extends OfferBundle {
  item_count: number;
  parent_name?: string;
  base_bundle_name?: string;
  fork_count: number;
  preview_items?: BundlePreviewItem[];
}

// ============================================================================
// Bundle Helper Functions
// ============================================================================

// Resolve a single bundle item by merging overrides with canonical classification
export function resolveBundleItem(
  item: BundleItem, 
  contentRole: ContentWithRole
): ResolvedBundleItem {
  const hasOverrides = !!(
    item.override_title !== undefined ||
    item.override_description !== undefined ||
    item.override_role !== undefined ||
    item.override_price !== undefined ||
    item.override_perceived_value !== undefined ||
    item.override_dream_outcome !== undefined ||
    item.override_bonus_name !== undefined
  );
  
  return {
    ...contentRole,
    display_order: item.display_order,
    is_optional: item.is_optional ?? false,
    has_overrides: hasOverrides,
    // Apply overrides (or keep canonical)
    title: item.override_title ?? contentRole.title,
    description: item.override_description ?? contentRole.description,
    offer_role: item.override_role ?? contentRole.offer_role,
    role_retail_price: item.override_price ?? contentRole.role_retail_price,
    perceived_value: item.override_perceived_value ?? contentRole.perceived_value,
    dream_outcome_description: item.override_dream_outcome ?? contentRole.dream_outcome_description,
    bonus_name: item.override_bonus_name ?? contentRole.bonus_name,
    likelihood_multiplier: item.override_likelihood ?? contentRole.likelihood_multiplier,
    time_reduction: item.override_time_reduction ?? contentRole.time_reduction,
    effort_reduction: item.override_effort_reduction ?? contentRole.effort_reduction,
    // Store originals for comparison
    original_role: contentRole.offer_role ?? undefined,
    original_price: contentRole.role_retail_price ?? undefined,
    original_perceived_value: contentRole.perceived_value ?? undefined,
    // Preserve override fields for admin UI round-tripping
    override_title: item.override_title,
    override_description: item.override_description,
  };
}

// Calculate bundle totals from resolved items
export function calculateBundleTotals(items: ResolvedBundleItem[]): {
  totalRetailValue: number;
  totalPerceivedValue: number;
  itemCount: number;
  coreOfferCount: number;
  bonusCount: number;
} {
  return items.reduce((acc, item) => {
    acc.totalRetailValue += item.role_retail_price ?? item.price ?? 0;
    acc.totalPerceivedValue += item.perceived_value ?? item.role_retail_price ?? item.price ?? 0;
    acc.itemCount++;
    if (item.offer_role === 'core_offer') acc.coreOfferCount++;
    if (item.offer_role === 'bonus') acc.bonusCount++;
    return acc;
  }, {
    totalRetailValue: 0,
    totalPerceivedValue: 0,
    itemCount: 0,
    coreOfferCount: 0,
    bonusCount: 0,
  });
}

// Create a BundleItem from a ResolvedBundleItem (for saving as new bundle)
export function createBundleItemFromResolved(
  resolved: ResolvedBundleItem,
  includeOverrides: boolean = true
): BundleItem {
  const item: BundleItem = {
    content_type: resolved.content_type,
    content_id: resolved.content_id,
    display_order: resolved.display_order,
    is_optional: resolved.is_optional,
  };
  
  if (includeOverrides && resolved.has_overrides) {
    // Only include overrides if they differ from originals
    if (resolved.offer_role !== resolved.original_role) {
      item.override_role = resolved.offer_role ?? undefined;
    }
    if (resolved.role_retail_price !== resolved.original_price) {
      item.override_price = resolved.role_retail_price ?? undefined;
    }
    if (resolved.perceived_value !== resolved.original_perceived_value) {
      item.override_perceived_value = resolved.perceived_value ?? undefined;
    }
    // Title and description overrides
    if (resolved.override_title) {
      item.override_title = resolved.override_title;
    }
    if (resolved.override_description) {
      item.override_description = resolved.override_description;
    }
  }
  
  return item;
}

export interface ScriptStep {
  id: string;
  title: string;
  talking_points: string[];
  actions: string[];
  duration_minutes?: number;
}

export interface ObjectionHandler {
  trigger: string;
  response: string;
  category: string;
}

export interface SalesScript {
  id: string;
  name: string;
  description: string | null;
  offer_type: OfferType;
  script_content: {
    steps: ScriptStep[];
    objection_handlers: ObjectionHandler[];
    success_metrics: string[];
  };
  target_funnel_stage: FunnelStage[];
  qualifying_criteria: Record<string, unknown> | null;
  associated_products: number[];
  is_active: boolean;
  created_at: string;
}

export interface SalesSession {
  id: string;
  diagnostic_audit_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_company: string | null;
  sales_agent_id: string;
  funnel_stage: FunnelStage;
  current_script_id: string | null;
  current_step_index: number;
  offers_presented: Record<string, unknown>[];
  products_presented: number[];
  scripts_used: string[];
  client_responses: Record<string, unknown> | null;
  objections_handled: Record<string, unknown>[];
  internal_notes: string | null;
  outcome: SessionOutcome;
  next_follow_up: string | null;
  follow_up_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiagnosticAudit {
  id: string;
  session_id: string;
  contact_id: string | null;
  status: string;
  urgency_score: number | null;
  opportunity_score: number | null;
  audit_summary: Record<string, unknown> | null;
  recommendations: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================================
// Offer Role Display Helpers
// ============================================================================

export const OFFER_ROLE_LABELS: Record<OfferRole, string> = {
  core_offer: 'Core Offer',
  bonus: 'Bonus',
  upsell: 'Upsell',
  downsell: 'Downsell',
  continuity: 'Continuity',
  lead_magnet: 'Lead Magnet',
  decoy: 'Decoy',
  anchor: 'Anchor',
};

export const OFFER_ROLE_DESCRIPTIONS: Record<OfferRole, string> = {
  core_offer: 'The main product or service you are selling',
  bonus: 'Added value to increase perceived worth of the core offer',
  upsell: 'More, better, or new products for existing customers',
  downsell: 'Reduced feature or payment plan option for objections',
  continuity: 'Subscription or recurring offer for ongoing revenue',
  lead_magnet: 'Free offer to generate leads and build trust',
  decoy: 'Lower value option to make premium look more attractive',
  anchor: 'High-price item to make main offer seem more reasonable',
};

export const OFFER_ROLE_COLORS: Record<OfferRole, string> = {
  core_offer: 'bg-blue-900/50 text-blue-300 border-blue-500',
  bonus: 'bg-green-900/50 text-green-300 border-green-500',
  upsell: 'bg-purple-900/50 text-purple-300 border-purple-500',
  downsell: 'bg-orange-900/50 text-orange-300 border-orange-500',
  continuity: 'bg-teal-900/50 text-teal-300 border-teal-500',
  lead_magnet: 'bg-pink-900/50 text-pink-300 border-pink-500',
  decoy: 'bg-gray-700/50 text-gray-300 border-gray-500',
  anchor: 'bg-yellow-900/50 text-yellow-300 border-yellow-500',
};

// ============================================================================
// Content Type Display Helpers
// ============================================================================

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  product: 'Merchandise',
  project: 'Project',
  video: 'Video',
  publication: 'Publication',
  music: 'Music',
  lead_magnet: 'Lead Magnet',
  prototype: 'Prototype',
  service: 'Service',
};

export const CONTENT_TYPE_ICONS: Record<ContentType, string> = {
  product: '🛍️',
  project: '📁',
  video: '🎬',
  publication: '📚',
  music: '🎵',
  lead_magnet: '📥',
  prototype: '✨',
  service: '🎯',
};

export const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
  product: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  project: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  video: 'bg-red-500/20 text-red-400 border-red-500/50',
  publication: 'bg-teal-500/20 text-teal-400 border-teal-500/50',
  music: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  lead_magnet: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  prototype: 'bg-pink-500/20 text-pink-400 border-pink-500/50',
  service: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
};

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  prospect: 'Prospect',
  interested: 'Interested',
  informed: 'Informed',
  converted: 'Converted',
  active: 'Active Customer',
  upgraded: 'Upgraded',
};

export const FUNNEL_STAGE_RECOMMENDED_OFFERS: Record<FunnelStage, OfferType[]> = {
  prospect: ['core', 'attraction'],
  interested: ['core', 'attraction'],
  informed: ['core', 'downsell'],
  converted: ['upsell', 'continuity'],
  active: ['upsell', 'continuity'],
  upgraded: ['continuity'],
};

// ============================================================================
// Dynamic Step Type Display Helpers
// ============================================================================

export const STEP_TYPE_LABELS: Record<StepType, string> = {
  opening: 'Build Rapport',
  discovery: 'Discovery',
  presentation: 'Present Offer',
  value_stack: 'Stack Value',
  objection_handle: 'Handle Objection',
  social_proof: 'Social Proof',
  risk_reversal: 'Risk Reversal',
  pricing: 'Pricing Options',
  close: 'Close',
  followup: 'Follow-up',
};

export const STEP_TYPE_ICONS: Record<StepType, string> = {
  opening: '👋',
  discovery: '🔍',
  presentation: '🎯',
  value_stack: '🎁',
  objection_handle: '💬',
  social_proof: '📊',
  risk_reversal: '🛡️',
  pricing: '💰',
  close: '🤝',
  followup: '📅',
};

export const STEP_TYPE_COLORS: Record<StepType, string> = {
  opening: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  discovery: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  presentation: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  value_stack: 'bg-green-500/20 text-green-400 border-green-500/50',
  objection_handle: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  social_proof: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  risk_reversal: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  pricing: 'bg-pink-500/20 text-pink-400 border-pink-500/50',
  close: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  followup: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
};

// Map strategies to step types they should generate
export const STRATEGY_TO_STEP_TYPE: Record<OfferStrategy, StepType> = {
  stack_bonuses: 'value_stack',
  show_decoy: 'pricing',
  show_anchor: 'pricing',
  payment_plan: 'pricing',
  limited_time: 'close',
  case_study: 'social_proof',
  guarantee: 'risk_reversal',
  trial_offer: 'risk_reversal',
  stakeholder_call: 'followup',
  roi_calculator: 'presentation',
  different_product: 'presentation',
  schedule_followup: 'followup',
  continue_script: 'presentation',
};

// ============================================================================
// Response Type Display Helpers
// ============================================================================

export const RESPONSE_TYPE_LABELS: Record<ResponseType, string> = {
  positive: 'Positive',
  price_objection: 'Price Objection',
  timing_objection: 'Timing Objection',
  authority_objection: 'Needs Authority',
  feature_concern: 'Feature Concern',
  past_failure: 'Past Failure',
  diy: 'DIY',
  competitor: 'Competitor',
  neutral: 'Neutral',
  budget_constrained_nonprofit: 'Nonprofit Budget',
};

export const RESPONSE_TYPE_ICONS: Record<ResponseType, string> = {
  positive: '✓',
  price_objection: '💰',
  timing_objection: '⏰',
  authority_objection: '👤',
  feature_concern: '🔧',
  past_failure: '⚠️',
  diy: '🛠️',
  competitor: '🏢',
  neutral: '➖',
  budget_constrained_nonprofit: '🏛️',
};

export const RESPONSE_TYPE_COLORS: Record<ResponseType, string> = {
  positive: 'bg-green-500/20 text-green-400 border-green-500/50',
  price_objection: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  timing_objection: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  authority_objection: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  feature_concern: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  past_failure: 'bg-red-500/20 text-red-400 border-red-500/50',
  diy: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  competitor: 'bg-pink-500/20 text-pink-400 border-pink-500/50',
  neutral: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  budget_constrained_nonprofit: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
};

export const OFFER_STRATEGY_LABELS: Record<OfferStrategy, string> = {
  stack_bonuses: 'Stack Bonuses',
  show_decoy: 'Show Decoy',
  show_anchor: 'Show Anchor',
  payment_plan: 'Payment Plan',
  limited_time: 'Limited Time Offer',
  case_study: 'Show Case Study',
  guarantee: 'Offer Guarantee',
  trial_offer: 'Trial Offer',
  stakeholder_call: 'Stakeholder Call',
  roi_calculator: 'ROI Calculator',
  different_product: 'Different Product',
  schedule_followup: 'Schedule Follow-up',
  continue_script: 'Continue Script',
};

export const OFFER_STRATEGY_DESCRIPTIONS: Record<OfferStrategy, string> = {
  stack_bonuses: 'Add more value by presenting bonuses included with the offer',
  show_decoy: 'Present a lower-value option to make the main offer more attractive',
  show_anchor: 'Show a high-priced option to make the main offer seem more reasonable',
  payment_plan: 'Offer payment terms to reduce the upfront cost barrier',
  limited_time: 'Create urgency with a time-sensitive bonus or discount',
  case_study: 'Share success stories from similar clients',
  guarantee: 'Reduce perceived risk with a money-back or results guarantee',
  trial_offer: 'Offer a low-risk trial or pilot program',
  stakeholder_call: 'Schedule a call that includes decision makers',
  roi_calculator: 'Walk through the ROI and value breakdown',
  different_product: 'Suggest an alternative product that better fits their needs',
  schedule_followup: 'Schedule a follow-up call for a better time',
  continue_script: 'Move forward with the next step in the script',
};

// Strategy recommendations by objection type (primary, secondary, tertiary)
export const OBJECTION_STRATEGY_MAP: Record<ResponseType, OfferStrategy[]> = {
  positive: ['continue_script', 'stack_bonuses', 'limited_time'],
  price_objection: ['stack_bonuses', 'show_decoy', 'payment_plan'],
  timing_objection: ['limited_time', 'stack_bonuses', 'schedule_followup'],
  authority_objection: ['stakeholder_call', 'roi_calculator', 'case_study'],
  feature_concern: ['different_product', 'stack_bonuses', 'trial_offer'],
  past_failure: ['case_study', 'guarantee', 'trial_offer'],
  diy: ['roi_calculator', 'case_study', 'trial_offer'],
  competitor: ['stack_bonuses', 'show_anchor', 'guarantee'],
  neutral: ['continue_script', 'roi_calculator', 'case_study'],
  budget_constrained_nonprofit: ['show_decoy', 'payment_plan', 'roi_calculator'],
};

// ============================================================================
// Value Equation Calculator
// ============================================================================

/**
 * Calculate the perceived value using Hormozi's Value Equation
 * Value = (Dream Outcome × Likelihood of Achievement) / (Time Delay × Effort & Sacrifice)
 */
export function calculateValueScore(
  dreamOutcome: number = 5,    // 1-10 scale
  likelihood: number = 5,      // 1-10 scale
  timeDelay: number = 5,       // 1-10 scale (lower is better)
  effort: number = 5           // 1-10 scale (lower is better)
): number {
  // Avoid division by zero
  const denominator = Math.max(timeDelay * effort, 1);
  const value = (dreamOutcome * likelihood) / denominator;
  
  // Normalize to 0-100 scale
  return Math.round(value * 10);
}

/**
 * Calculate total offer value from multiple products
 */
export function calculateOfferStackValue(products: ProductWithRole[]): {
  totalRetailValue: number;
  totalPerceivedValue: number;
  valueScore: number;
} {
  let totalRetailValue = 0;
  let totalPerceivedValue = 0;
  let totalLikelihood = 0;
  let totalTimeReduction = 0;
  let totalEffortReduction = 0;
  let productCount = 0;

  for (const product of products) {
    totalRetailValue += product.role_retail_price || product.price || 0;
    totalPerceivedValue += product.perceived_value || product.price || 0;
    
    if (product.likelihood_multiplier) {
      totalLikelihood += product.likelihood_multiplier;
      productCount++;
    }
    if (product.time_reduction) {
      totalTimeReduction += product.time_reduction;
    }
    if (product.effort_reduction) {
      totalEffortReduction += product.effort_reduction;
    }
  }

  // Average likelihood, sum time/effort reductions
  const avgLikelihood = productCount > 0 ? totalLikelihood / productCount : 5;
  
  // Calculate value score (higher time/effort reduction = lower denominator)
  const effectiveTimeDelay = Math.max(10 - (totalTimeReduction / 7), 1);
  const effectiveEffort = Math.max(10 - (totalEffortReduction / products.length), 1);
  
  const valueScore = calculateValueScore(
    8, // Dream outcome (assuming high for bundled offers)
    avgLikelihood,
    effectiveTimeDelay,
    effectiveEffort
  );

  return {
    totalRetailValue,
    totalPerceivedValue,
    valueScore,
  };
}

// ============================================================================
// Script Recommendations
// ============================================================================

/**
 * Get recommended scripts based on funnel stage and diagnostic data
 */
export function getRecommendedScripts(
  scripts: SalesScript[],
  funnelStage: FunnelStage,
  diagnosticData?: DiagnosticAudit
): SalesScript[] {
  const recommendedOfferTypes = FUNNEL_STAGE_RECOMMENDED_OFFERS[funnelStage];
  
  return scripts.filter(script => {
    // Must be active
    if (!script.is_active) return false;
    
    // Must match funnel stage (if specified)
    if (script.target_funnel_stage.length > 0 && 
        !script.target_funnel_stage.includes(funnelStage)) {
      return false;
    }
    
    // Must be a recommended offer type for this stage
    if (!recommendedOfferTypes.includes(script.offer_type)) {
      return false;
    }
    
    // Check qualifying criteria against diagnostic data
    if (script.qualifying_criteria && diagnosticData) {
      // Add custom criteria matching logic here
      // For now, return true if any criteria matches
    }
    
    return true;
  });
}

/**
 * Get recommended products based on funnel stage and offer role
 */
export function getRecommendedProducts(
  products: ProductWithRole[],
  funnelStage: FunnelStage,
  offerType?: OfferType
): ProductWithRole[] {
  const rolesByFunnel: Record<FunnelStage, OfferRole[]> = {
    prospect: ['lead_magnet', 'core_offer'],
    interested: ['core_offer', 'bonus', 'anchor'],
    informed: ['core_offer', 'bonus', 'downsell', 'decoy'],
    converted: ['upsell', 'continuity', 'bonus'],
    active: ['upsell', 'continuity'],
    upgraded: ['continuity'],
  };

  const recommendedRoles = rolesByFunnel[funnelStage];
  
  return products.filter(product => {
    if (!product.offer_role) return false;
    return recommendedRoles.includes(product.offer_role);
  }).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
}

// ============================================================================
// Objection Handling
// ============================================================================

export const COMMON_OBJECTIONS: ObjectionHandler[] = [
  {
    trigger: 'too expensive',
    category: 'price',
    response: 'I understand budget is a concern. Let me ask you this - on a scale of 1-10, how interested are you in achieving [desired outcome]? [If 7+] Great! What would need to happen for this to be a 10? [Address specific concerns]',
  },
  {
    trigger: 'need to think about it',
    category: 'stall',
    response: 'That makes sense. What specifically would you like to think about? Is it the [price/timing/fit]? Let\'s address that concern together right now so you have all the information you need.',
  },
  {
    trigger: 'need to talk to spouse/partner',
    category: 'authority',
    response: 'Of course! What questions do you think they\'ll have? Let me give you the information you\'ll need to have that conversation. Also, would it help if we scheduled a call together with them?',
  },
  {
    trigger: 'not the right time',
    category: 'timing',
    response: 'I hear you. When would be the right time? And what would make that the right time? Often, the best time is when you\'re most aware of the problem - like right now.',
  },
  {
    trigger: 'already tried something similar',
    category: 'past_failure',
    response: 'I appreciate your honesty. What specifically didn\'t work before? Our approach is different because [differentiation]. The reason it didn\'t work before is likely [reason], which we specifically address.',
  },
  {
    trigger: 'can do it myself',
    category: 'diy',
    response: 'You absolutely could! The question is: what\'s the cost of figuring it out yourself? How much time would that take? Our clients typically save [X hours/weeks] and avoid [common mistakes]. What\'s your time worth?',
  },
];

/**
 * Find relevant objection handlers for a given objection
 */
export function findObjectionHandlers(
  objection: string,
  customHandlers: ObjectionHandler[] = []
): ObjectionHandler[] {
  const allHandlers = [...COMMON_OBJECTIONS, ...customHandlers];
  const lowerObjection = objection.toLowerCase();
  
  return allHandlers.filter(handler => 
    lowerObjection.includes(handler.trigger.toLowerCase()) ||
    handler.category === lowerObjection
  );
}

// ============================================================================
// Grand Slam Offer Builder
// ============================================================================

export interface GrandSlamOffer {
  coreOffer: ProductWithRole | null;
  bonuses: ProductWithRole[];
  anchor: ProductWithRole | null;
  decoy: ProductWithRole | null;
  totalRetailValue: number;
  totalPerceivedValue: number;
  offerPrice: number;
  savings: number;
  savingsPercent: number;
}

/**
 * Build a Grand Slam Offer from available products
 */
export function buildGrandSlamOffer(products: ProductWithRole[]): GrandSlamOffer {
  const coreOffer = products.find(p => p.offer_role === 'core_offer') || null;
  const bonuses = products.filter(p => p.offer_role === 'bonus');
  const anchor = products.find(p => p.offer_role === 'anchor') || null;
  const decoy = products.find(p => p.offer_role === 'decoy') || null;

  const { totalRetailValue, totalPerceivedValue } = calculateOfferStackValue([
    ...(coreOffer ? [coreOffer] : []),
    ...bonuses,
  ]);

  // Calculate offer price (core + small portion of bonuses)
  const corePrice = coreOffer?.offer_price || coreOffer?.price || 0;
  const offerPrice = corePrice;
  
  const savings = totalPerceivedValue - offerPrice;
  const savingsPercent = totalPerceivedValue > 0 
    ? Math.round((savings / totalPerceivedValue) * 100) 
    : 0;

  return {
    coreOffer,
    bonuses,
    anchor,
    decoy,
    totalRetailValue,
    totalPerceivedValue,
    offerPrice,
    savings,
    savingsPercent,
  };
}
