-- Sales Script Seed Data
-- Initial scripts based on Alex Hormozi's offer frameworks
-- Run after database_schema_sales.sql

-- ============================================================================
-- Core Offer Presentation Script
-- ============================================================================
INSERT INTO sales_scripts (name, description, offer_type, target_funnel_stage, script_content, is_active) 
VALUES (
  'Core Offer Presentation',
  'Main script for presenting your core offer using the Grand Slam Offer framework',
  'core',
  ARRAY['prospect', 'interested', 'informed']::text[],
  '{
    "steps": [
      {
        "id": "1",
        "title": "Build Rapport & Acknowledge",
        "talking_points": [
          "Thank them for completing the diagnostic assessment",
          "Acknowledge specific challenges they mentioned in the assessment",
          "Ask how their business is doing today and what prompted them to take action now",
          "Listen actively and take notes on their specific situation"
        ],
        "actions": ["Log rapport notes", "Identify key pain points"]
      },
      {
        "id": "2",
        "title": "Review Diagnostic Results",
        "talking_points": [
          "Walk through their urgency score and what it means for their business",
          "Highlight their opportunity score and the potential they have",
          "Discuss 2-3 key recommendations from their assessment",
          "Ask: \"Which of these challenges is costing you the most right now?\""
        ],
        "actions": ["Share screen with results if on video", "Mark primary challenge"]
      },
      {
        "id": "3",
        "title": "Paint the Dream Outcome",
        "talking_points": [
          "\"Imagine 90 days from now, [specific outcome based on their challenges]\"",
          "Quantify the outcome: revenue increase, time saved, problems solved",
          "Make it personal to their specific situation",
          "Ask: \"What would achieving this mean for you and your business?\""
        ],
        "actions": ["Document their dream outcome in their words"]
      },
      {
        "id": "4",
        "title": "Present the Solution (Value Stack)",
        "talking_points": [
          "\"Based on what you told me, here is how we can help...\"",
          "Present the core offer first - what it is and what it does",
          "Stack each bonus and explain how it relates to their specific goals",
          "For each item: Name it with the benefit (e.g., \"Quick Start Templates That Save 10 Hours\")",
          "Show the total value vs the investment"
        ],
        "actions": ["Present offer card", "Calculate savings"]
      },
      {
        "id": "5",
        "title": "Handle the Investment Question",
        "talking_points": [
          "\"The total value of everything is $X, but your investment today is just $Y\"",
          "Frame it in terms of ROI: \"If this just gets you [one specific result], it pays for itself\"",
          "Offer payment options if available",
          "Create urgency with a time-limited bonus or discount"
        ],
        "actions": ["Show pricing options", "Note any hesitation"]
      },
      {
        "id": "6",
        "title": "Close or Schedule Follow-up",
        "talking_points": [
          "\"Based on everything we discussed, are you ready to get started?\"",
          "If yes: Walk through the onboarding process",
          "If maybe: \"What information would help you make a decision?\"",
          "If no: Ask what would need to be different, schedule follow-up"
        ],
        "actions": ["Process payment or schedule callback"]
      }
    ],
    "objection_handlers": [],
    "success_metrics": [
      "Call completed",
      "Diagnostic reviewed",
      "Offer presented",
      "Decision made or follow-up scheduled"
    ]
  }'::jsonb,
  true
);

-- ============================================================================
-- Attraction Offer Script (Win Your Money Back)
-- ============================================================================
INSERT INTO sales_scripts (name, description, offer_type, target_funnel_stage, script_content, is_active) 
VALUES (
  'Attraction Offer - Money Back Guarantee',
  'Script for presenting attraction offers that remove risk from the purchase decision',
  'attraction',
  ARRAY['interested', 'informed']::text[],
  '{
    "steps": [
      {
        "id": "1",
        "title": "Acknowledge Their Hesitation",
        "talking_points": [
          "\"I completely understand the hesitation - you want to make sure this works for you\"",
          "\"Let me share something that should help you feel more confident...\"",
          "Show that you understand their risk concern"
        ],
        "actions": []
      },
      {
        "id": "2",
        "title": "Introduce the Guarantee",
        "talking_points": [
          "\"We have a performance guarantee that puts the risk on us, not you\"",
          "Explain the specific conditions (what they need to do)",
          "Be clear about the timeframe",
          "\"If you [specific actions] and dont get [specific result], we [refund/credit/rollover]\""
        ],
        "actions": ["Show guarantee terms"]
      },
      {
        "id": "3",
        "title": "Make It Easy to Qualify",
        "talking_points": [
          "\"The conditions are simple - they are things you would do anyway if you are serious about results\"",
          "Walk through each qualifying action",
          "\"These actions are designed to maximize your success, not to create hoops\"",
          "\"Most clients who follow the program exceed their goals\""
        ],
        "actions": []
      },
      {
        "id": "4",
        "title": "Flip the Risk",
        "talking_points": [
          "\"Think of it this way - you either get the result you want, or you get your money back\"",
          "\"The only way you lose is by not trying\"",
          "\"What do you have to lose at this point?\""
        ],
        "actions": ["Ask for the decision"]
      }
    ],
    "objection_handlers": [
      {
        "trigger": "What if I cant complete the conditions?",
        "response": "The conditions are designed to be achievable - they are the minimum actions anyone serious about results would take. If something comes up, we work with you. The guarantee exists for edge cases, not as the norm.",
        "category": "conditions"
      }
    ],
    "success_metrics": [
      "Risk concern acknowledged",
      "Guarantee presented",
      "Conditions explained",
      "Decision made"
    ]
  }'::jsonb,
  true
);

-- ============================================================================
-- Upsell Script (Prescription Upselling)
-- ============================================================================
INSERT INTO sales_scripts (name, description, offer_type, target_funnel_stage, script_content, is_active) 
VALUES (
  'Prescription Upsell Flow',
  'Script for upselling after initial purchase or during conversation',
  'upsell',
  ARRAY['converted', 'active']::text[],
  '{
    "steps": [
      {
        "id": "1",
        "title": "Celebrate the Decision",
        "talking_points": [
          "\"Congratulations on making this decision for your business!\"",
          "\"You are going to love the results\"",
          "Reinforce they made the right choice"
        ],
        "actions": []
      },
      {
        "id": "2",
        "title": "Ask About Goals (Prescription)",
        "talking_points": [
          "\"Before we wrap up, I want to make sure you have everything you need to succeed\"",
          "\"What is your main goal for the next 90 days?\"",
          "\"How fast do you want to see results?\"",
          "Listen for opportunities to enhance their purchase"
        ],
        "actions": ["Document goals"]
      },
      {
        "id": "3",
        "title": "Prescribe the Enhancement",
        "talking_points": [
          "\"Based on what you told me, I would recommend adding [upsell item]\"",
          "\"This will help you [specific benefit related to their stated goal]\"",
          "Frame it as a prescription, not a sales pitch",
          "\"Clients who add this typically see [specific result] X% faster\""
        ],
        "actions": ["Present upsell product"]
      },
      {
        "id": "4",
        "title": "Handle the Add-On Decision",
        "talking_points": [
          "\"It is an additional $X, which brings your total to $Y\"",
          "\"Do you want me to add that on for you?\"",
          "If hesitation: \"No pressure - just wanted to make sure you knew about it since you mentioned [goal]\"",
          "Accept either answer gracefully"
        ],
        "actions": ["Update order or proceed with original"]
      }
    ],
    "objection_handlers": [
      {
        "trigger": "I just want the basic for now",
        "response": "Absolutely! You can always add this later. Let me make a note so we can follow up in a few weeks to see how you are progressing.",
        "category": "timing"
      }
    ],
    "success_metrics": [
      "Initial purchase confirmed",
      "Goals documented",
      "Upsell offered",
      "Final order completed"
    ]
  }'::jsonb,
  true
);

-- ============================================================================
-- Downsell Script (Payment Plans & Alternatives)
-- ============================================================================
INSERT INTO sales_scripts (name, description, offer_type, target_funnel_stage, script_content, is_active) 
VALUES (
  'Downsell - Payment Plans',
  'Script for when price is the main objection',
  'downsell',
  ARRAY['informed']::text[],
  '{
    "steps": [
      {
        "id": "1",
        "title": "Acknowledge the Budget Concern",
        "talking_points": [
          "\"I hear you - the investment is significant\"",
          "\"Let me ask you this: if money were not a factor, would this be something you want to do?\"",
          "If yes, proceed. If no, dig deeper into the real objection."
        ],
        "actions": ["Identify if price is the real issue"]
      },
      {
        "id": "2",
        "title": "Use the 1-10 Scale",
        "talking_points": [
          "\"On a scale of 1-10, how much do you want to solve [their problem]?\"",
          "If 7+: \"Great! What would need to happen to make this a 10?\"",
          "If below 7: \"What is holding you back from being more committed?\"",
          "Address the specific concern they raise"
        ],
        "actions": ["Note their score and concern"]
      },
      {
        "id": "3",
        "title": "Present Payment Options",
        "talking_points": [
          "\"We have a few options to make this work for your budget...\"",
          "Option 1: Full payment (best value)",
          "Option 2: Payment plan (small premium for flexibility)",
          "\"Which option works better for your situation?\""
        ],
        "actions": ["Show payment calculator"]
      },
      {
        "id": "4",
        "title": "If Still Too Much - Feature Downsell",
        "talking_points": [
          "\"I want to find a way to help you get started...\"",
          "\"We have a [smaller/starter] option that includes [core features]\"",
          "\"You can always upgrade later once you see results\"",
          "\"Would that be more comfortable for you to start with?\""
        ],
        "actions": ["Present alternative offer"]
      }
    ],
    "objection_handlers": [
      {
        "trigger": "I need to save up first",
        "response": "I understand. The challenge is that while you are saving, the problem is still costing you [X per month]. If you start now with a payment plan, you will be making progress while paying it off.",
        "category": "timing"
      }
    ],
    "success_metrics": [
      "Budget concern identified",
      "Commitment level assessed",
      "Payment option selected or alternative presented"
    ]
  }'::jsonb,
  true
);

-- ============================================================================
-- Continuity Offer Script (Subscriptions)
-- ============================================================================
INSERT INTO sales_scripts (name, description, offer_type, target_funnel_stage, script_content, is_active) 
VALUES (
  'Continuity Offer - Membership',
  'Script for offering ongoing subscription or membership',
  'continuity',
  ARRAY['converted', 'active']::text[],
  '{
    "steps": [
      {
        "id": "1",
        "title": "Review Results & Progress",
        "talking_points": [
          "\"Let us look at what you have accomplished so far...\"",
          "Highlight specific wins and improvements",
          "\"How has this impacted your [business/life]?\"",
          "Build on the positive momentum"
        ],
        "actions": ["Document success stories"]
      },
      {
        "id": "2",
        "title": "Identify Ongoing Needs",
        "talking_points": [
          "\"What is the next challenge you want to tackle?\"",
          "\"How can we continue to support your growth?\"",
          "\"What would help you maintain and build on these results?\""
        ],
        "actions": ["Note future goals"]
      },
      {
        "id": "3",
        "title": "Present Continuity Option",
        "talking_points": [
          "\"We have a membership that gives you ongoing access to [benefits]\"",
          "\"Members get [exclusive features, updates, support]\"",
          "\"It is $X per month, which includes [value breakdown]\"",
          "\"Many clients find the ongoing support helps them [specific outcome]\""
        ],
        "actions": ["Present membership options"]
      },
      {
        "id": "4",
        "title": "Offer Prepay Incentive",
        "talking_points": [
          "\"If you prepay for [6/12 months], you get [X months free]\"",
          "\"That brings your effective monthly cost down to $Y\"",
          "\"Which option makes more sense for you?\"",
          "Let them choose between monthly and prepay"
        ],
        "actions": ["Show prepay calculator"]
      }
    ],
    "objection_handlers": [
      {
        "trigger": "I want to see if I need it first",
        "response": "That makes sense. Let us set a reminder for [30 days] to check in. In the meantime, keep track of any questions or challenges that come up - those are usually the things the membership helps with most.",
        "category": "timing"
      }
    ],
    "success_metrics": [
      "Results reviewed",
      "Future needs identified",
      "Continuity offer presented",
      "Subscription started or follow-up scheduled"
    ]
  }'::jsonb,
  true
);

-- ============================================================================
-- Objection Handling Script
-- ============================================================================
INSERT INTO sales_scripts (name, description, offer_type, target_funnel_stage, script_content, is_active) 
VALUES (
  'Common Objection Handlers',
  'Quick reference for handling common sales objections',
  'objection',
  ARRAY['prospect', 'interested', 'informed']::text[],
  '{
    "steps": [
      {
        "id": "1",
        "title": "Price Objection (Too Expensive)",
        "talking_points": [
          "\"I understand budget is a concern. Let me ask - on a scale of 1-10, how interested are you in achieving [desired outcome]?\"",
          "If 7+: \"Great! What would need to happen for this to be a 10?\"",
          "Address their specific concern, then return to value",
          "\"If this just gets you [one specific result], would it be worth it?\""
        ],
        "actions": ["Use 1-10 scale", "Focus on specific value"]
      },
      {
        "id": "2",
        "title": "Need to Think About It",
        "talking_points": [
          "\"I appreciate that. What specifically would you like to think about?\"",
          "\"Is it the [price/timing/fit]?\"",
          "\"Let me address that concern right now so you have all the information\"",
          "Help them make a decision today, even if it is no"
        ],
        "actions": ["Identify the real concern"]
      },
      {
        "id": "3",
        "title": "Need to Talk to Spouse/Partner",
        "talking_points": [
          "\"Of course! What questions do you think they will have?\"",
          "\"Let me give you the information you will need for that conversation\"",
          "\"Would it help if we scheduled a call with both of you?\"",
          "Offer to be present for the discussion"
        ],
        "actions": ["Prepare them for the conversation"]
      },
      {
        "id": "4",
        "title": "Not the Right Time",
        "talking_points": [
          "\"I hear you. When would be the right time?\"",
          "\"What would make that the right time?\"",
          "\"Here is the thing - the best time is when you are most aware of the problem, like right now\"",
          "\"The cost of waiting is [specific cost of delay]\""
        ],
        "actions": ["Quantify the cost of waiting"]
      },
      {
        "id": "5",
        "title": "Already Tried Something Similar",
        "talking_points": [
          "\"I appreciate you sharing that. What specifically did not work?\"",
          "\"Our approach is different because [specific differentiation]\"",
          "\"The reason it did not work before is likely [common reason], which we specifically address\"",
          "Position as the solution to why past attempts failed"
        ],
        "actions": ["Differentiate from past failures"]
      }
    ],
    "objection_handlers": [],
    "success_metrics": [
      "Objection identified",
      "Underlying concern addressed",
      "Decision made"
    ]
  }'::jsonb,
  true
);
