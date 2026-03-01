// API Route: AI-Powered Sales Insights
// Generates customized talking points, objections, and product recommendations
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';

interface DiagnosticData {
  business_challenges?: {
    primary_challenges?: string[];
    pain_points?: string[];
    current_impact?: string;
  };
  tech_stack?: {
    crm?: string;
    other_tools?: string[];
  };
  automation_needs?: {
    priority_areas?: string[];
    desired_outcomes?: string[];
  };
  ai_readiness?: {
    concerns?: string[];
    team_readiness?: string;
  };
  budget_timeline?: {
    budget_range?: string;
    timeline?: string;
    decision_timeline?: string;
  };
  decision_making?: {
    decision_maker?: boolean;
    stakeholders?: string[];
  };
  key_insights?: string[];
  urgency_score?: number;
  opportunity_score?: number;
}

interface Product {
  id: number;
  name: string;
  description?: string;
  price?: number;
  offer_role?: string;
}

interface Contact {
  name?: string;
  company?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const body = await request.json();
    const { audit, contact, products } = body as {
      audit: DiagnosticData;
      contact: Contact;
      products: Product[];
    };

    // Generate AI insights based on diagnostic data
    const insights = generateInsights(audit, contact, products);

    return NextResponse.json({ insights });
  } catch (error) {
    console.error('AI insights API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateInsights(
  audit: DiagnosticData,
  contact: Contact,
  products: Product[]
) {
  const clientName = contact?.name?.split(' ')[0] || 'there';
  const companyName = contact?.company || 'your company';
  
  // Extract key information
  const painPoints = audit?.business_challenges?.pain_points || [];
  const challenges = audit?.business_challenges?.primary_challenges || [];
  const impact = audit?.business_challenges?.current_impact;
  const concerns = audit?.ai_readiness?.concerns || [];
  const budgetRange = audit?.budget_timeline?.budget_range;
  const timeline = audit?.budget_timeline?.timeline;
  const decisionTimeline = audit?.budget_timeline?.decision_timeline;
  const isDecisionMaker = audit?.decision_making?.decision_maker;
  const stakeholders = audit?.decision_making?.stakeholders || [];
  const priorityAreas = audit?.automation_needs?.priority_areas || [];
  const desiredOutcomes = audit?.automation_needs?.desired_outcomes || [];
  const urgency = audit?.urgency_score || 5;
  const opportunity = audit?.opportunity_score || 5;
  
  // Generate personalized opening line
  let openingLine = `Hi ${clientName}, thank you for taking the time to complete our diagnostic assessment. `;
  
  if (urgency >= 7) {
    openingLine += `I can see from your responses that you're dealing with some pressing challenges`;
    if (challenges.length > 0) {
      openingLine += ` around ${challenges[0].toLowerCase()}`;
    }
    openingLine += `, and I'm excited to show you how we can help.`;
  } else if (opportunity >= 7) {
    openingLine += `I noticed some great opportunities for ${companyName} to improve efficiency`;
    if (priorityAreas.length > 0) {
      openingLine += ` in ${priorityAreas[0].toLowerCase()}`;
    }
    openingLine += `.`;
  } else {
    openingLine += `I've reviewed your diagnostic results and I have some ideas that could help ${companyName} move forward.`;
  }

  // Generate key pain points to address
  const keyPainPoints: string[] = [];
  
  if (painPoints.length > 0) {
    keyPainPoints.push(...painPoints.slice(0, 3));
  }
  if (challenges.length > 0 && keyPainPoints.length < 4) {
    keyPainPoints.push(...challenges.slice(0, 2));
  }
  if (impact && keyPainPoints.length < 5) {
    keyPainPoints.push(impact);
  }

  // Generate anticipated objections based on diagnostic data
  const anticipatedObjections: Array<{
    objection: string;
    likelyTrigger: string;
    response: string;
  }> = [];

  // Price objection if budget concerns
  if (concerns.includes('Cost') || (budgetRange && budgetRange.includes('$'))) {
    anticipatedObjections.push({
      objection: "That's more than we budgeted for",
      likelyTrigger: `They mentioned a budget of ${budgetRange || 'limited funds'}`,
      response: `I understand budget is a factor. Let me ask you this - ${impact ? `you mentioned you're losing ${impact.toLowerCase()}. ` : ''}If we could show you a clear ROI within 90 days, would that change how you view this investment?`
    });
  }

  // Timing objection if timeline concerns
  if (timeline && timeline.toLowerCase().includes('later')) {
    anticipatedObjections.push({
      objection: "We're not ready to start right now",
      likelyTrigger: `Their timeline indicates: "${timeline}"`,
      response: `I hear you. What would need to happen for ${companyName} to be ready? Is it a matter of resources, approval, or something else I can help address?`
    });
  }

  // Decision maker objection
  if (!isDecisionMaker && stakeholders.length > 0) {
    anticipatedObjections.push({
      objection: "I need to run this by my team",
      likelyTrigger: `They're not the final decision maker - stakeholders include: ${stakeholders.join(', ')}`,
      response: `Absolutely, that makes sense. What questions do you think ${stakeholders[0]} will have? I'd love to help you present this in a way that addresses their specific concerns.`
    });
  }

  // AI concerns
  if (concerns.includes('Data privacy') || concerns.some(c => c.toLowerCase().includes('security'))) {
    anticipatedObjections.push({
      objection: "We're worried about data privacy",
      likelyTrigger: `They listed "${concerns.find(c => c.toLowerCase().includes('privacy') || c.toLowerCase().includes('security'))}" as a concern`,
      response: `Data security is crucial, and I'm glad you're thinking about it. We're SOC 2 compliant and all data is encrypted. Would it help if I walked you through exactly how we handle your data?`
    });
  }

  // Technical complexity
  if (audit?.ai_readiness?.team_readiness?.toLowerCase().includes('hesitant')) {
    anticipatedObjections.push({
      objection: "This seems too complex for our team",
      likelyTrigger: `Team readiness assessment: "${audit.ai_readiness.team_readiness}"`,
      response: `I completely understand that concern. The good news is we handle all the technical setup, and we provide full training. Most of our clients are up and running within 2 weeks with minimal disruption.`
    });
  }

  // Default objections if we don't have enough
  if (anticipatedObjections.length < 2) {
    anticipatedObjections.push({
      objection: "Let me think about it",
      likelyTrigger: "Standard hesitation - need to create more urgency",
      response: `Of course. To help you think it through - on a scale of 1-10, how interested are you in solving ${challenges[0] || 'these challenges'}? What would it take to get you to a 10?`
    });
  }

  // Generate customized talking points
  const customizedTalkingPoints = [
    {
      step: "Build Rapport",
      points: [
        `Reference their diagnostic: "I noticed ${companyName} is dealing with ${challenges[0] || 'some interesting challenges'}"`,
        `Show you understand: "Many companies in your situation have ${painPoints[0] || 'similar pain points'}"`,
        `Create connection: "Before we dive in, how has business been going lately?"`,
      ],
      personalizedNote: urgency >= 7 
        ? "High urgency - they're actively looking for solutions. Move quickly but don't be pushy."
        : "Moderate urgency - take time to understand their full situation."
    },
    {
      step: "Present the Solution",
      points: [
        impact 
          ? `Lead with their impact: "You mentioned ${impact.toLowerCase()} - let me show you how we eliminate that"` 
          : "Start with their biggest challenge and how we solve it",
        ...desiredOutcomes.slice(0, 2).map(o => `Address outcome: "${o}" - here's how we deliver that`),
        budgetRange 
          ? `Frame value against budget: "Within your ${budgetRange} range, here's the ROI you can expect"` 
          : "Show clear ROI expectations",
      ],
      personalizedNote: opportunity >= 7
        ? "High opportunity score - they're a great fit. Emphasize premium solutions."
        : "Focus on proven results and case studies similar to their situation."
    },
    {
      step: "Close or Follow-up",
      points: [
        decisionTimeline 
          ? `Work with their timeline: "You mentioned you can decide ${decisionTimeline.toLowerCase()}"` 
          : "Establish a clear decision timeline",
        isDecisionMaker 
          ? "They're the decision maker - ask for the sale directly" 
          : `Involve stakeholders: "Let's schedule a call with ${stakeholders[0] || 'your team'}"`,
        timeline?.toLowerCase().includes('30 days') || urgency >= 7
          ? "Create urgency: Offer a time-sensitive bonus or early-start discount"
          : "Propose a pilot or trial to reduce perceived risk",
      ],
    }
  ];

  // Generate product recommendations
  const productRecommendations = products
    .filter(p => p.offer_role === 'core_offer' || p.offer_role === 'upsell')
    .slice(0, 3)
    .map(p => ({
      productId: p.id,
      reason: `Aligns with their need for ${priorityAreas[0] || 'automation'}`,
      talkingPoint: `"Based on what you shared about ${challenges[0] || 'your challenges'}, I'd recommend starting with ${p.name}"`
    }));

  return {
    openingLine,
    keyPainPoints: keyPainPoints.slice(0, 5),
    anticipatedObjections: anticipatedObjections.slice(0, 4),
    customizedTalkingPoints,
    productRecommendations,
  };
}
