// API Route: AI-Powered Real-Time Sales Recommendations
// Generates context-aware offer recommendations based on diagnostic data and conversation flow

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import {
  ResponseType,
  OfferStrategy,
  AIRecommendation,
  ProductWithRole,
  ContentWithRole,
  ConversationResponse,
  OBJECTION_STRATEGY_MAP,
  OfferRole,
} from '@/lib/sales-scripts';
import { getAllActiveUpsellPaths, UpsellPath } from '@/lib/upsell-paths';

interface DiagnosticData {
  business_challenges?: {
    primary_challenges?: string[];
    pain_points?: string[];
    current_impact?: string;
    attempted_solutions?: string[];
  };
  tech_stack?: {
    crm?: string;
    other_tools?: string[];
    integration_readiness?: string;
  };
  automation_needs?: {
    priority_areas?: string[];
    desired_outcomes?: string[];
    complexity_tolerance?: string;
  };
  ai_readiness?: {
    concerns?: string[];
    team_readiness?: string;
    data_quality?: string;
    readiness_score?: number;
  };
  budget_timeline?: {
    budget_range?: string;
    timeline?: string;
    decision_timeline?: string;
    budget_flexibility?: string;
  };
  decision_making?: {
    decision_maker?: boolean;
    stakeholders?: string[];
    approval_process?: string;
  };
  key_insights?: string[];
  urgency_score?: number;
  opportunity_score?: number;
  sales_notes?: string;
}

interface RecommendRequest {
  audit: DiagnosticData;
  currentObjection: ResponseType;
  conversationHistory: ConversationResponse[];
  productsPresented?: number[]; // Legacy support
  contentPresented?: string[]; // Format: "content_type:content_id"
  availableProducts?: ProductWithRole[]; // Legacy support
  availableContent?: ContentWithRole[]; // New format
  clientName?: string;
  clientCompany?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const body: RecommendRequest = await request.json();
    const {
      audit,
      currentObjection,
      conversationHistory,
      productsPresented,
      contentPresented,
      availableProducts,
      availableContent,
      clientName,
      clientCompany,
    } = body;

    // Convert content to products format for backward compatibility
    let products: ProductWithRole[] = availableProducts || [];
    let presented: number[] = productsPresented || [];
    
    if (availableContent && availableContent.length > 0) {
      products = availableContent.map(c => ({
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
    }
    
    if (contentPresented && contentPresented.length > 0) {
      // Convert content keys to product IDs (for products only)
      presented = contentPresented
        .filter(k => k.startsWith('product:'))
        .map(k => parseInt(k.split(':')[1]));
    }

    // Generate base recommendations from objection strategies
    const recommendations = generateRecommendations({
      audit,
      currentObjection,
      conversationHistory,
      productsPresented: presented,
      availableProducts: products,
      clientName,
      clientCompany,
    });

    // Enrich with offer-level upsell paths (two-touch prescription model)
    const upsellPaths = await getAllActiveUpsellPaths();
    const upsellRecommendations = generateUpsellRecommendations({
      upsellPaths,
      contentPresented: contentPresented || [],
      currentObjection,
      clientName: clientName || 'the client',
    });

    // Merge: upsell recommendations get a slight boost, then re-sort
    const merged = [...recommendations, ...upsellRecommendations]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    return NextResponse.json({ recommendations: merged });
  } catch (error) {
    console.error('AI recommend API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateRecommendations(context: RecommendRequest): AIRecommendation[] {
  const {
    audit,
    currentObjection,
    conversationHistory,
    productsPresented,
    availableProducts,
    clientName = 'the client',
    clientCompany = 'their company',
  } = context;

  // Get base strategies for this objection type
  const baseStrategies = OBJECTION_STRATEGY_MAP[currentObjection] || ['continue_script'];
  
  // Calculate context factors for scoring
  const urgency = audit?.urgency_score || 5;
  const opportunity = audit?.opportunity_score || 5;
  const budgetConcern = audit?.ai_readiness?.concerns?.includes('Cost') || 
                        currentObjection === 'price_objection';
  const isDecisionMaker = audit?.decision_making?.decision_maker !== false;
  const hasTimePressure = audit?.budget_timeline?.timeline?.toLowerCase().includes('30 days') ||
                          urgency >= 7;
  const previousObjections = conversationHistory.filter(r => 
    r.responseType.includes('objection')
  ).length;

  // Build recommendations with contextual scoring
  const recommendations: AIRecommendation[] = [];

  for (const strategy of baseStrategies) {
    const recommendation = buildRecommendation(strategy, {
      audit,
      currentObjection,
      productsPresented: productsPresented || [],
      availableProducts: availableProducts || [],
      clientName,
      clientCompany,
      urgency,
      opportunity,
      budgetConcern,
      isDecisionMaker,
      hasTimePressure,
      previousObjections,
    });
    
    if (recommendation) {
      recommendations.push(recommendation);
    }
  }

  // Sort by confidence and return top 3
  return recommendations
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

interface BuildContext {
  audit: DiagnosticData;
  currentObjection: ResponseType;
  productsPresented: number[];
  availableProducts: ProductWithRole[];
  clientName: string;
  clientCompany: string;
  urgency: number;
  opportunity: number;
  budgetConcern: boolean;
  isDecisionMaker: boolean;
  hasTimePressure: boolean;
  previousObjections: number;
}

function buildRecommendation(
  strategy: OfferStrategy,
  context: BuildContext
): AIRecommendation | null {
  const {
    audit,
    currentObjection,
    productsPresented,
    availableProducts,
    clientName,
    clientCompany,
    urgency,
    opportunity,
    budgetConcern,
    isDecisionMaker,
    hasTimePressure,
    previousObjections,
  } = context;

  // Find relevant products for this strategy
  const strategyToRole: Partial<Record<OfferStrategy, OfferRole[]>> = {
    stack_bonuses: ['bonus'],
    show_decoy: ['decoy'],
    show_anchor: ['anchor'],
    payment_plan: ['downsell'],
    different_product: ['core_offer', 'upsell'],
    trial_offer: ['lead_magnet', 'downsell'],
  };

  const relevantRoles = strategyToRole[strategy];
  let relevantProducts: ProductWithRole[] = [];
  
  if (relevantRoles) {
    relevantProducts = availableProducts.filter(p => 
      p.offer_role && 
      relevantRoles.includes(p.offer_role) &&
      !productsPresented.includes(p.id)
    );
  }

  // Calculate confidence based on context
  let confidence = 0.5; // Base confidence
  let why = '';
  let talkingPoint = '';

  switch (strategy) {
    case 'stack_bonuses':
      confidence = budgetConcern && opportunity >= 6 ? 0.85 : 0.65;
      why = budgetConcern 
        ? `Budget concern with high opportunity (${opportunity}/10) - showing more value can tip the scale`
        : 'Adding bonuses increases perceived value without changing price';
      talkingPoint = relevantProducts.length > 0
        ? `"Let me show you what's included with this. ${relevantProducts[0]?.bonus_name || relevantProducts[0]?.title} alone is worth $${relevantProducts[0]?.perceived_value || relevantProducts[0]?.price}..."`
        : `"Let me walk you through the full value of what you're getting..."`;
      break;

    case 'show_decoy':
      confidence = budgetConcern ? 0.70 : 0.50;
      why = 'Showing a stripped-down option creates contrast and makes the main offer more attractive';
      talkingPoint = relevantProducts.length > 0
        ? `"We also have ${relevantProducts[0]?.title} at $${relevantProducts[0]?.price}, but you'd miss out on [key benefits]..."`
        : `"We could do a lighter version, but honestly you'd be leaving results on the table..."`;
      break;

    case 'show_anchor':
      confidence = budgetConcern ? 0.65 : 0.45;
      why = 'Anchoring with a higher-priced option makes the main offer feel more reasonable';
      talkingPoint = relevantProducts.length > 0
        ? `"Our enterprise clients typically invest $${relevantProducts[0]?.price} for the full implementation. For ${clientCompany}, the $[main price] option gives you 80% of the results..."`
        : `"Companies like [bigger competitor] pay 3-5x what we're discussing for similar outcomes..."`;
      break;

    case 'payment_plan':
      confidence = budgetConcern && hasTimePressure ? 0.75 : 0.55;
      const budgetRange = audit?.budget_timeline?.budget_range;
      why = budgetRange 
        ? `Budget of ${budgetRange} with urgency ${urgency}/10 - payment plan removes the barrier`
        : 'Splitting payments reduces the perceived commitment';
      talkingPoint = `"What if we split this into 3 payments? That way you can start seeing results now without the full upfront investment."`;
      break;

    case 'limited_time':
      confidence = hasTimePressure ? 0.80 : 0.50;
      why = hasTimePressure 
        ? `High urgency (${urgency}/10) and timeline pressure - they're ready but need a push`
        : 'Creating urgency can accelerate decision-making';
      talkingPoint = `"I can include [bonus] if we get started this week. After that, I can't guarantee availability..."`;
      break;

    case 'case_study':
      confidence = currentObjection === 'past_failure' ? 0.85 : 0.60;
      const challenges = audit?.business_challenges?.primary_challenges?.[0] || 'similar challenges';
      why = currentObjection === 'past_failure'
        ? 'Past failure suggests they need proof it works - social proof is critical'
        : 'Case studies build credibility and reduce perceived risk';
      talkingPoint = `"Let me share what happened with [similar client]. They were dealing with ${challenges} too..."`;
      break;

    case 'guarantee':
      confidence = currentObjection === 'past_failure' ? 0.80 : 0.55;
      why = 'Guarantees eliminate risk and address fear of making a bad decision';
      talkingPoint = `"Here's what I can do - if you don't see [specific result] within 90 days, I'll [guarantee terms]. Fair enough?"`;
      break;

    case 'trial_offer':
      confidence = previousObjections >= 2 ? 0.75 : 0.50;
      why = previousObjections >= 2
        ? `Multiple objections (${previousObjections}) suggest they need a low-risk way to start`
        : 'Trials let them experience value before full commitment';
      talkingPoint = relevantProducts.length > 0
        ? `"What if we started with ${relevantProducts[0]?.title}? It's a lower commitment but you'll see exactly how this works for ${clientCompany}..."`
        : `"What if we did a 2-week pilot? You'd see real results before making the full investment..."`;
      break;

    case 'stakeholder_call':
      confidence = !isDecisionMaker ? 0.90 : 0.40;
      const stakeholders = audit?.decision_making?.stakeholders?.join(', ') || 'your team';
      why = !isDecisionMaker
        ? `They're not the decision maker - need to include ${stakeholders}`
        : 'Even with authority, involving stakeholders builds buy-in';
      talkingPoint = !isDecisionMaker
        ? `"I'd love to answer any questions ${stakeholders} might have. Can we schedule a quick call with them this week?"`
        : `"Would it help to loop in anyone else from your team to make sure we're all aligned?"`;
      break;

    case 'roi_calculator':
      confidence = currentObjection === 'diy' ? 0.80 : 0.60;
      const impact = audit?.business_challenges?.current_impact;
      why = impact 
        ? `They mentioned "${impact}" - showing ROI makes the investment obvious`
        : 'ROI calculation makes the value concrete and justifiable';
      talkingPoint = impact
        ? `"You mentioned ${impact}. Let me show you exactly how this pays for itself - if we solve that, what's the value to ${clientCompany}?"`
        : `"Let's do the math together. How much time does your team spend on [pain point] each week?"`;
      break;

    case 'different_product':
      confidence = currentObjection === 'feature_concern' ? 0.85 : 0.45;
      why = 'Feature concerns often mean we\'re showing the wrong product';
      talkingPoint = relevantProducts.length > 0
        ? `"Based on what you're describing, ${relevantProducts[0]?.title} might actually be a better fit. It's designed specifically for..."`
        : `"Let me suggest a different approach that might align better with what you're looking for..."`;
      break;

    case 'schedule_followup':
      confidence = currentObjection === 'timing_objection' ? 0.70 : 0.40;
      const timeline = audit?.budget_timeline?.decision_timeline || 'soon';
      why = `Timing objection with decision timeline "${timeline}" - schedule concrete follow-up`;
      talkingPoint = `"I understand. When would be the right time to revisit this? Let's put something on the calendar so we don't lose momentum."`;
      break;

    case 'continue_script':
      confidence = currentObjection === 'positive' ? 0.90 : 0.30;
      why = currentObjection === 'positive'
        ? 'Positive response - keep momentum going'
        : 'Moving forward might help uncover the real objection';
      talkingPoint = `"Great! Let me show you the next piece..."`;
      break;

    default:
      return null;
  }

  // Boost confidence for high opportunity scores
  if (opportunity >= 8) {
    confidence = Math.min(confidence + 0.1, 0.95);
  }

  // Reduce confidence if strategy was already tried
  // (would need to check conversationHistory)

  return {
    strategy,
    offerRole: relevantRoles?.[0] || null,
    products: relevantProducts.slice(0, 2).map(p => ({
      id: p.id,
      name: p.title,
      reason: p.dream_outcome_description || `Addresses their ${audit?.automation_needs?.priority_areas?.[0] || 'needs'}`,
    })),
    confidence: Math.round(confidence * 100) / 100,
    talkingPoint,
    why,
  };
}

// ============================================================================
// Offer-Level Upsell Recommendations (Two-Touch Prescription Model)
// ============================================================================

interface UpsellRecommendContext {
  upsellPaths: UpsellPath[];
  contentPresented: string[]; // Format: "content_type:content_id"
  currentObjection: ResponseType;
  clientName: string;
}

function generateUpsellRecommendations(context: UpsellRecommendContext): AIRecommendation[] {
  const { upsellPaths, contentPresented, currentObjection, clientName } = context;
  const recommendations: AIRecommendation[] = [];

  // For each content item already presented, check if there is an upsell path
  for (const contentKey of contentPresented) {
    const [contentType, contentId] = contentKey.split(':');
    if (!contentType || !contentId) continue;

    const matchingPaths = upsellPaths.filter(
      (p) => p.source_content_type === contentType && p.source_content_id === contentId
    );

    for (const path of matchingPaths) {
      // Only suggest if the path has point-of-sale steps (we are at point of sale)
      if (path.point_of_sale_steps.length === 0) continue;

      let confidence = 0.70; // Base confidence for offer-level upsell
      let talkingPoint = '';

      // Boost confidence based on objection type
      if (currentObjection === 'positive') {
        confidence = 0.85; // Client is receptive — great time for upsell
      } else if (currentObjection === 'price_objection') {
        confidence = 0.45; // Price concern — upsell may not land
      } else if (currentObjection === 'feature_concern') {
        confidence = 0.80; // Feature concern — upsell may address it
      }

      // Use the first point-of-sale step's talking points
      const firstStep = path.point_of_sale_steps[0];
      if (firstStep?.talking_points?.length > 0) {
        talkingPoint = firstStep.talking_points[0];
      } else if (path.value_frame_text) {
        talkingPoint = path.value_frame_text;
      } else {
        talkingPoint = `"${clientName}, let me tell you about the ${path.upsell_title} — it solves the exact problem you will hit next."`;
      }

      recommendations.push({
        strategy: 'different_product' as OfferStrategy,
        offerRole: 'upsell',
        products: [{
          id: 0,
          name: path.upsell_title,
          reason: `Solves the predicted next problem: "${path.next_problem.substring(0, 100)}..."`,
        }],
        confidence: Math.round(confidence * 100) / 100,
        talkingPoint,
        why: `Offer-level upsell: ${path.source_title} → ${path.upsell_title}. ${
          path.credit_previous_investment ? 'Previous investment applies as credit.' : ''
        }`,
      });
    }
  }

  return recommendations;
}
