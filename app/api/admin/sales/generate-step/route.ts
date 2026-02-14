// API Route: Dynamic Script Step Generation
// Generates personalized script steps based on conversation context

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  StepType,
  DynamicStep,
  ResponseType,
  OfferStrategy,
  ProductWithRole,
  ContentWithRole,
  ConversationResponse,
  STRATEGY_TO_STEP_TYPE,
} from '@/lib/sales-scripts';

interface DiagnosticData {
  business_challenges?: {
    primary_challenges?: string[];
    pain_points?: string[];
    current_impact?: string;
    attempted_solutions?: string[];
  };
  budget_timeline?: {
    budget_range?: string;
    timeline?: string;
    decision_timeline?: string;
    budget_flexibility?: string;
  };
  ai_readiness?: {
    concerns?: string[];
    team_readiness?: string;
    data_quality?: string;
    readiness_score?: number;
  };
  automation_needs?: {
    priority_areas?: string[];
    desired_outcomes?: string[];
    complexity_tolerance?: string;
  };
  decision_making?: {
    decision_maker?: boolean;
    stakeholders?: string[];
    approval_process?: string;
  };
  urgency_score?: number;
  opportunity_score?: number;
  key_insights?: string[];
  sales_notes?: string;
  org_type?: 'for_profit' | 'nonprofit' | 'education';
}

interface GenerateStepRequest {
  stepType: StepType;
  audit: DiagnosticData;
  clientName?: string;
  clientCompany?: string;
  previousSteps: DynamicStep[];
  lastResponse?: ResponseType;
  chosenStrategy?: OfferStrategy;
  availableProducts?: ProductWithRole[]; // Legacy support
  availableContent?: ContentWithRole[]; // New format
  conversationHistory: ConversationResponse[];
  /** When set, value evidence (pain points + dollar impact) is fetched and used in script steps */
  contactSubmissionId?: number | null;
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const body: GenerateStepRequest = await request.json();
    const {
      stepType,
      audit,
      clientName = 'the client',
      clientCompany = 'their company',
      previousSteps,
      lastResponse,
      chosenStrategy,
      availableProducts,
      availableContent,
      conversationHistory,
      contactSubmissionId,
    } = body;

    // Fetch value evidence for this contact so script steps can reference quantified pain and value
    let valueEvidenceSummary: string | null = null;
    if (contactSubmissionId && Number.isInteger(contactSubmissionId)) {
      const [
        { data: evidenceRows },
        { data: reports },
      ] = await Promise.all([
        supabaseAdmin
          .from('pain_point_evidence')
          .select(`
            source_excerpt,
            confidence_score,
            monetary_indicator,
            monetary_context,
            pain_point_categories(display_name)
          `)
          .eq('contact_submission_id', contactSubmissionId)
          .order('confidence_score', { ascending: false })
          .limit(20),
        supabaseAdmin
          .from('value_reports')
          .select('title, total_annual_value')
          .eq('contact_submission_id', contactSubmissionId)
          .order('created_at', { ascending: false })
          .limit(1),
      ]);
      const parts: string[] = [];
      if (evidenceRows?.length) {
        const painPoints = evidenceRows
          .filter((r: { monetary_indicator?: number }) => r.monetary_indicator != null)
          .map((r: { pain_point_categories: { display_name: string } | null; monetary_indicator: number; monetary_context?: string }) =>
            `${r.pain_point_categories?.display_name ?? 'Pain point'}: $${Number(r.monetary_indicator).toLocaleString()}/yr${r.monetary_context ? ` (${r.monetary_context})` : ''}`
          );
        if (painPoints.length) parts.push(`Quantified pain points: ${painPoints.slice(0, 5).join('; ')}.`);
      }
      const report = reports?.[0] as { title?: string; total_annual_value?: number } | undefined;
      if (report?.total_annual_value != null) {
        parts.push(`Total value from report: $${Number(report.total_annual_value).toLocaleString()}/yr.`);
      }
      if (parts.length) valueEvidenceSummary = parts.join(' ');
    }

    // Convert content to products format for backward compatibility
    let products: ProductWithRole[] = availableProducts || [];
    
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

    // Generate the step (include value evidence so script steps reference quantified pain and value)
    const step = generateStep({
      stepType,
      audit,
      clientName,
      clientCompany,
      previousSteps,
      lastResponse,
      chosenStrategy,
      availableProducts: products,
      conversationHistory,
      valueEvidenceSummary,
    });

    return NextResponse.json({ step });
  } catch (error) {
    console.error('Generate step API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateStep(context: GenerateStepRequest & { valueEvidenceSummary?: string | null }): DynamicStep {
  const {
    stepType,
    audit,
    clientName,
    clientCompany,
    previousSteps,
    lastResponse,
    chosenStrategy,
    availableProducts,
    valueEvidenceSummary,
  } = context;

  const stepNumber = previousSteps.length + 1;
  const stepId = `step-${Date.now()}`;

  // Extract relevant context
  const challenges = audit?.business_challenges?.primary_challenges || [];
  const painPoints = audit?.business_challenges?.pain_points || [];
  const impact = audit?.business_challenges?.current_impact;
  const budgetRange = audit?.budget_timeline?.budget_range;
  const timeline = audit?.budget_timeline?.timeline;
  const decisionTimeline = audit?.budget_timeline?.decision_timeline;
  const concerns = audit?.ai_readiness?.concerns || [];
  const priorityAreas = audit?.automation_needs?.priority_areas || [];
  const desiredOutcomes = audit?.automation_needs?.desired_outcomes || [];
  const isDecisionMaker = audit?.decision_making?.decision_maker !== false;
  const stakeholders = audit?.decision_making?.stakeholders || [];
  const urgency = audit?.urgency_score || 5;
  const opportunity = audit?.opportunity_score || 5;
  const keyInsights = audit?.key_insights || [];

  // Get products by role
  const products = availableProducts || [];
  const bonusProducts = products.filter(p => p.offer_role === 'bonus');
  const coreProducts = products.filter(p => p.offer_role === 'core_offer');
  const decoyProducts = products.filter(p => p.offer_role === 'decoy');
  const downsellProducts = products.filter(p => p.offer_role === 'downsell');

  let title = '';
  let objective = '';
  let talkingPoints: string[] = [];
  let suggestedActions: string[] = [];
  let productsToPresent: number[] = [];

  switch (stepType) {
    case 'opening':
      title = 'Build Rapport & Set Agenda';
      objective = `Connect with ${clientName} and establish trust before diving into solutions`;
      talkingPoints = [
        `"Hi ${clientName}, thank you for taking the time to complete our diagnostic. I've reviewed your results and I'm excited to discuss how we can help ${clientCompany}."`,
        keyInsights.length > 0 
          ? `"I noticed from your assessment that ${keyInsights[0].toLowerCase()}. Before we dive in, I'd love to hear more about what prompted you to reach out."` 
          : `"Before we dive into solutions, I'd love to understand a bit more about what's happening at ${clientCompany} right now."`,
        `"My goal for our call today is to understand your situation, show you some options, and see if there's a fit. Sound good?"`,
      ];
      if (valueEvidenceSummary) talkingPoints.push(`[Use value evidence during call: ${valueEvidenceSummary}]`);
      suggestedActions = [
        'Let them talk - take notes on specific pain points',
        'Listen for emotional triggers (frustration, urgency)',
        'Identify their primary motivation',
      ];
      if (valueEvidenceSummary) suggestedActions.push('Reference quantified pain/value from evidence when relevant');
      break;

    case 'discovery':
      title = 'Explore Their Situation';
      objective = 'Deepen understanding of their challenges and qualify the opportunity';
      talkingPoints = [
        challenges.length > 0 
          ? `"You mentioned ${challenges[0].toLowerCase()}. Can you walk me through what that looks like day-to-day?"` 
          : `"Tell me about the biggest challenge you're facing right now with your business."`,
        impact 
          ? `"You noted this is costing you ${impact.toLowerCase()}. How did you arrive at that number?"` 
          : (valueEvidenceSummary ? `"We've identified some areas that may be costing you. What's this problem costing you - in time, money, or missed opportunities?"` : `"What's this problem costing you - in time, money, or missed opportunities?"`),
        `"If we could solve this completely, what would that mean for ${clientCompany}?"`,
        desiredOutcomes.length > 0 
          ? `"You said you want to ${desiredOutcomes[0].toLowerCase()}. What's stopped you from achieving that so far?"` 
          : `"What have you tried before to solve this?"`,
      ];
      if (valueEvidenceSummary) talkingPoints.push(`[Evidence summary to reference: ${valueEvidenceSummary}]`);
      suggestedActions = [
        'Quantify the pain (get specific numbers)',
        'Understand timeline urgency',
        'Identify who else is affected',
      ];
      if (valueEvidenceSummary) suggestedActions.push('Use evidence numbers to anchor the cost of inaction');
      break;

    case 'presentation':
      title = 'Present the Solution';
      objective = 'Show how your offer solves their specific problems';
      productsToPresent = coreProducts.slice(0, 2).map(p => p.id);
      talkingPoints = [
        `"Based on what you've shared, let me show you exactly how we can help ${clientCompany}."`,
        challenges.length > 0 
          ? `"Remember you mentioned ${challenges[0].toLowerCase()}? Here's how we address that specifically..."` 
          : `"Here's what we do and why it's relevant to your situation..."`,
        coreProducts.length > 0 
          ? `"Our ${coreProducts[0].title} is designed to ${coreProducts[0].dream_outcome_description || 'deliver results quickly'}."` 
          : `"Our solution is specifically designed for companies like ${clientCompany}."`,
        desiredOutcomes.length > 0 
          ? `"This directly addresses your goal to ${desiredOutcomes[0].toLowerCase()}."` 
          : `"This will help you achieve the outcomes you're looking for."`,
      ];
      if (valueEvidenceSummary) talkingPoints.push(`"The value we've identified for you aligns with what we're solving—use the evidence numbers when presenting."`);
      suggestedActions = [
        'Connect each feature to their specific pain point',
        'Use their language back to them',
        'Watch for buying signals (nodding, questions)',
      ];
      if (valueEvidenceSummary) suggestedActions.push('Anchor offer value to evidence-based pain/value numbers');
      break;

    case 'value_stack':
      title = 'Stack the Value';
      objective = 'Increase perceived value by presenting bonuses and additional benefits';
      productsToPresent = bonusProducts.slice(0, 3).map(p => p.id);
      talkingPoints = [
        `"Now, here's where it gets exciting. When you work with us, you also get..."`,
        ...bonusProducts.slice(0, 3).map(p => 
          `"${p.bonus_name || p.title}" - ${p.bonus_description || p.dream_outcome_description || 'adds significant value'} (worth $${p.perceived_value || p.price})`
        ),
        bonusProducts.length > 0 
          ? `"Together, these bonuses are worth over $${bonusProducts.reduce((sum, p) => sum + (p.perceived_value || p.price || 0), 0)}, but they're included when you work with us."` 
          : `"All of these are included as part of your investment."`,
      ];
      suggestedActions = [
        'Present each bonus as solving a specific problem',
        'Stack the total value visually',
        'Pause after each bonus for reaction',
      ];
      break;

    case 'objection_handle':
      const objectionContext = getObjectionContext(lastResponse, {
        budgetRange,
        timeline,
        isDecisionMaker,
        stakeholders,
        concerns,
        impact,
        challenges,
      });
      title = objectionContext.title;
      objective = objectionContext.objective;
      talkingPoints = objectionContext.talkingPoints;
      suggestedActions = objectionContext.suggestedActions;
      break;

    case 'social_proof':
      title = 'Share Success Stories';
      objective = 'Build confidence with relevant case studies and testimonials';
      talkingPoints = [
        `"Let me share what happened with a client in a similar situation to ${clientCompany}..."`,
        challenges.length > 0 
          ? `"They were also dealing with ${challenges[0].toLowerCase()}. Within 90 days, they..."` 
          : `"They faced similar challenges. Here's what changed for them..."`,
        `"What made the difference was [specific approach]. That's exactly what we'd do for you."`,
        `"Would you like to speak with them directly? I can arrange an introduction."`,
      ];
      suggestedActions = [
        'Choose a case study similar to their industry/size',
        'Focus on measurable results',
        'Offer to connect them with a reference',
      ];
      break;

    case 'risk_reversal':
      title = 'Remove the Risk';
      objective = 'Address fears and reduce perceived risk of moving forward';
      talkingPoints = [
        `"I understand you want to be confident this will work. Let me address that directly."`,
        `"We stand behind our work with a [guarantee type]. If you don't see [specific result] within [timeframe], here's what happens..."`,
        concerns.includes('Cost') 
          ? `"And from an investment standpoint - if this doesn't pay for itself within [timeframe], we'll [specific action]."` 
          : `"We're committed to your success, which is why we offer this guarantee."`,
        `"Does that help you feel more confident about moving forward?"`,
      ];
      suggestedActions = [
        'Present specific, measurable guarantee terms',
        'Address their specific concern directly',
        'Make the guarantee feel personal',
      ];
      if (downsellProducts.length > 0) {
        productsToPresent = downsellProducts.slice(0, 1).map(p => p.id);
        talkingPoints.push(
          `"We also have a trial option: ${downsellProducts[0].title} at $${downsellProducts[0].price || downsellProducts[0].offer_price}, so you can experience the value first."`
        );
      }
      break;

    case 'pricing': {
      const isNonprofitOrg = audit?.org_type === 'nonprofit' || audit?.org_type === 'education';
      title = isNonprofitOrg ? 'Present Community Impact Options' : 'Present Pricing Options';
      objective = isNonprofitOrg
        ? 'Present budget-friendly Community Impact tiers while showing the premium upgrade path'
        : 'Frame the investment in context of value and ROI';
      productsToPresent = [
        ...coreProducts.slice(0, 1).map(p => p.id),
        ...decoyProducts.slice(0, 1).map(p => p.id),
      ];
      const corePrice = coreProducts[0]?.offer_price || coreProducts[0]?.price || 0;

      if (isNonprofitOrg) {
        // Auto-present CI tiers for nonprofit/education orgs
        talkingPoints = [
          `"We have a Community Impact program specifically designed for organizations like yours."`,
          `"These packages deliver the same outcomes as our full-service tiers, with self-paced and template-based delivery to keep costs accessible."`,
          decoyProducts.length > 0
            ? `"Let me walk you through the options: starting at $${decoyProducts[0].price} for ${decoyProducts[0].title}."`
            : `"Let me walk you through the Community Impact options and help you find the right fit."`,
          `"The main difference from our premium tiers is delivery method — self-paced instead of live, templates instead of custom builds, and community support instead of dedicated 1-on-1."`,
          `"I also want you to know about our full-service options in case your budget allows or you secure additional funding."`,
          budgetRange
            ? `"You mentioned a budget of ${budgetRange}. Let me find the best fit within that range."`
            : '',
        ].filter(Boolean);
        suggestedActions = [
          'Present CI Starter, CI Accelerator, and CI Growth side by side',
          'Show side-by-side comparison of CI vs premium tiers',
          'Ask about budget range and decision timeline',
          'Mention grant funding or professional development budgets as potential funding sources',
        ];
      } else {
        talkingPoints = [
          `"Let's talk about the investment. You have a few options..."`,
          decoyProducts.length > 0 
            ? `"Option 1: ${decoyProducts[0].title} at $${decoyProducts[0].price} - this gives you [basic features]."` 
            : '',
          coreProducts.length > 0 
            ? `"Option 2 (recommended): ${coreProducts[0].title} at $${corePrice} - this includes everything we discussed plus all the bonuses."` 
            : '',
          impact 
            ? `"Remember, you mentioned this problem is costing you ${impact.toLowerCase()}. This investment pays for itself when we solve that."` 
            : (valueEvidenceSummary ? `"Based on the value we've identified for your situation, this investment pays for itself when we address those areas."` : `"This investment typically pays for itself within 90 days."`),
          budgetRange 
            ? `"You mentioned a budget of ${budgetRange}. This fits right in that range, and here's how we can structure it..."` 
            : '',
        ].filter(Boolean);
        if (valueEvidenceSummary) talkingPoints.push(`[Use evidence-based retail/perceived value for this contact when stating "value" or "worth"].`);
        suggestedActions = [
          'Present 2-3 options with clear differentiation',
          'Highlight the recommended option',
          'Connect price to the cost of not solving their problem',
        ];
        if (valueEvidenceSummary) suggestedActions.push('Price using evidence-based retail and perceived value for this contact');
      }
      break;
    }

    case 'close':
      title = 'Ask for the Decision';
      objective = 'Guide them to a clear yes or identify remaining concerns';
      talkingPoints = [
        urgency >= 7 
          ? `"${clientName}, you mentioned wanting to start ${timeline || 'soon'}. Based on everything we've discussed, are you ready to move forward?"` 
          : `"${clientName}, what questions do you have before we move forward?"`,
        `"On a scale of 1-10, how confident are you that this is the right solution for ${clientCompany}?"`,
        `"What would need to happen for you to feel completely confident about this?"`,
        isDecisionMaker 
          ? `"If we started today, we could have you [specific outcome] by [timeframe]. Shall we get you set up?"` 
          : `"What's the best way to get ${stakeholders[0] || 'your team'} involved in this decision?"`,
      ];
      suggestedActions = [
        'Ask a direct closing question',
        'If not ready, identify the specific blocker',
        'Get a commitment to next step regardless',
      ];
      break;

    case 'followup':
      title = 'Schedule Next Steps';
      objective = 'Lock in concrete follow-up and maintain momentum';
      talkingPoints = [
        `"Let's make sure we don't lose momentum. When works best for our next conversation?"`,
        !isDecisionMaker && stakeholders.length > 0 
          ? `"I'd love to include ${stakeholders[0]} on our next call. Can we schedule that for [specific time]?"` 
          : `"Let me send you some additional information to review. When can we reconnect to discuss?"`,
        `"I'll send over a summary of what we discussed, along with [specific resource]. What's your email?"`,
        `"Between now and our next call, here's what I'll prepare for you: [specific items]."`,
      ];
      suggestedActions = [
        'Get calendar commitment (not just "I\'ll call you")',
        'Send follow-up materials within 24 hours',
        'Set specific agenda for next call',
      ];
      break;

    default:
      title = 'Continue Conversation';
      objective = 'Keep the dialogue going';
      talkingPoints = ['Continue building rapport and understanding their needs.'];
      suggestedActions = ['Listen actively and ask follow-up questions.'];
  }

  return {
    id: stepId,
    stepNumber,
    type: stepType,
    title,
    objective,
    talkingPoints: talkingPoints.filter(Boolean),
    suggestedActions,
    productsToPresent,
    triggeredBy: lastResponse && chosenStrategy 
      ? { responseType: lastResponse, strategy: chosenStrategy }
      : undefined,
    status: 'pending',
  };
}

function getObjectionContext(
  objection: ResponseType | undefined,
  context: {
    budgetRange?: string;
    timeline?: string;
    isDecisionMaker: boolean;
    stakeholders: string[];
    concerns: string[];
    impact?: string;
    challenges: string[];
  }
): {
  title: string;
  objective: string;
  talkingPoints: string[];
  suggestedActions: string[];
} {
  const { budgetRange, timeline, isDecisionMaker, stakeholders, concerns, impact, challenges } = context;

  switch (objection) {
    case 'price_objection':
      return {
        title: 'Address Price Concern',
        objective: 'Reframe the investment in terms of value and ROI',
        talkingPoints: [
          `"I appreciate you being direct about the investment. Help me understand - is it the total amount, or the timing of the payment?"`,
          impact 
            ? `"You mentioned this problem is costing you ${impact.toLowerCase()}. If we solve that, what's the ROI look like?"` 
            : `"Let me ask - what would solving this problem be worth to you?"`,
          `"On a scale of 1-10, how interested are you in the solution itself? [If 7+] Great, so it's really about making the numbers work. Let me see what I can do..."`,
          budgetRange 
            ? `"Your budget of ${budgetRange} - is that a hard limit, or is there flexibility if we can show clear ROI?"` 
            : `"What budget range would make this a no-brainer for you?"`,
        ],
        suggestedActions: [
          'Isolate: Is it price, or something else?',
          'Connect to cost of inaction',
          'Offer payment options if price is firm barrier',
        ],
      };

    case 'timing_objection':
      return {
        title: 'Address Timing Concern',
        objective: 'Create appropriate urgency and understand real timeline',
        talkingPoints: [
          `"I hear you. When would be the right time, and what would make that the right time?"`,
          `"Often, the best time to solve a problem is when you're most aware of it - like right now. What's holding you back?"`,
          `"If we could start with something small and expand later, would that change the timing?"`,
          timeline 
            ? `"You mentioned ${timeline}. What would need to happen between now and then?"` 
            : `"What's happening in your business that makes now not ideal?"`,
        ],
        suggestedActions: [
          'Understand what\'s driving the delay',
          'Create urgency around cost of waiting',
          'Offer phased approach if appropriate',
        ],
      };

    case 'authority_objection':
      return {
        title: 'Navigate Decision Process',
        objective: 'Understand the approval process and involve key stakeholders',
        talkingPoints: [
          `"That makes total sense. Who else needs to be involved in this decision?"`,
          stakeholders.length > 0 
            ? `"You mentioned ${stakeholders.join(' and ')}. What questions do you think they'll have?"` 
            : `"Tell me about your decision-making process. Who needs to sign off?"`,
          `"Would it help if I prepared a summary specifically for them? What points would be most important?"`,
          `"Can we schedule a call that includes them? I'd love to answer their questions directly."`,
        ],
        suggestedActions: [
          'Map out the full decision process',
          'Prepare champion with answers to likely questions',
          'Get commitment to specific next step with stakeholders',
        ],
      };

    case 'feature_concern':
      return {
        title: 'Address Fit Concerns',
        objective: 'Understand their specific needs and show how you address them',
        talkingPoints: [
          `"Help me understand what's not clicking. What specifically doesn't seem like a fit?"`,
          `"What would the ideal solution look like for you?"`,
          challenges.length > 0 
            ? `"When you think about solving ${challenges[0].toLowerCase()}, what's most important to you?"` 
            : `"What features or capabilities are non-negotiable for you?"`,
          `"Let me see if I can show you how we address that specific concern..."`,
        ],
        suggestedActions: [
          'Get specific about what\'s missing',
          'Show how current solution addresses their need (if possible)',
          'Suggest alternative product if better fit exists',
        ],
      };

    case 'past_failure':
      return {
        title: 'Address Past Experience',
        objective: 'Acknowledge their concern and differentiate your approach',
        talkingPoints: [
          `"I appreciate you sharing that. What specifically didn't work before?"`,
          `"That's frustrating. What was the biggest reason it failed?"`,
          `"Here's how our approach is different: [specific differentiation]..."`,
          `"We actually see a lot of clients who tried other solutions first. The reason they succeed with us is..."`,
          `"What would make you confident that this time would be different?"`,
        ],
        suggestedActions: [
          'Acknowledge the pain of past failure',
          'Clearly differentiate your approach',
          'Offer specific guarantees or proof points',
        ],
      };

    case 'diy':
      return {
        title: 'Address DIY Consideration',
        objective: 'Show the value of expertise vs. figuring it out alone',
        talkingPoints: [
          `"You absolutely could do this yourself. The question is - should you?"`,
          `"What would it cost in time to figure this out? And what's that time worth?"`,
          `"Our clients typically save [X hours/weeks] by working with us. They also avoid [common mistakes]."`,
          `"Think of it this way: you could learn plumbing, or you could hire a plumber. Which makes more sense for your business?"`,
          `"What would you do with that time if you didn't have to figure this out yourself?"`,
        ],
        suggestedActions: [
          'Quantify the cost of their time',
          'Highlight expertise and shortcuts you provide',
          'Show the opportunity cost of DIY',
        ],
      };

    case 'competitor':
      return {
        title: 'Address Competition',
        objective: 'Understand their options and differentiate your value',
        talkingPoints: [
          `"Great that you're doing your research. What other options are you considering?"`,
          `"What do you like about [competitor]? And what concerns do you have?"`,
          `"Here's how we're different: [key differentiators]..."`,
          `"The main reason clients choose us over alternatives is [specific advantage]."`,
          `"Would it help to speak with a client who evaluated similar options and chose us?"`,
        ],
        suggestedActions: [
          'Understand what they like about alternatives',
          'Focus on your unique strengths, not competitor weaknesses',
          'Offer social proof from clients who compared',
        ],
      };

    default:
      return {
        title: 'Address Concerns',
        objective: 'Understand and resolve any remaining hesitation',
        talkingPoints: [
          `"I want to make sure I understand your concerns. What's holding you back from moving forward?"`,
          `"What questions do you still have?"`,
          `"What would need to be true for this to be a clear yes for you?"`,
        ],
        suggestedActions: [
          'Ask open-ended questions to uncover the real objection',
          'Listen more than you talk',
          'Address specific concerns directly',
        ],
      };
  }
}
