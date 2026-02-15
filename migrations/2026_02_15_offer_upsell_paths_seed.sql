-- ============================================================================
-- Migration: Seed Offer Upsell Paths
-- Date: 2026-02-15
-- Purpose: Seed initial decoy-to-premium pairings and standalone upsell paths.
--          Each row follows the $100M Offers "next problem" prescription model.
-- Dependencies: 2026_02_15_offer_upsell_paths.sql
-- Apply order: Run AFTER offer_upsell_paths table creation
-- ============================================================================

-- ============================================================================
-- CI Starter -> Quick Win (3 paths)
-- ============================================================================

-- 1. Recorded Workshop -> Live Workshop
INSERT INTO offer_upsell_paths (
  source_content_type, source_content_id, source_title, source_tier_slug,
  next_problem, next_problem_timing, next_problem_signals,
  upsell_content_type, upsell_content_id, upsell_title, upsell_tier_slug, upsell_perceived_value,
  point_of_sale_steps, point_of_pain_steps,
  incremental_cost, incremental_value, value_frame_text, risk_reversal_text,
  credit_previous_investment, credit_note,
  display_order, is_active
) VALUES (
  'service', 'ci-recorded-workshop', 'AI Strategy Workshop (Recorded)', 'ci-starter',
  'I watched the recording but I don''t know which opportunities apply to MY business specifically. The framework makes sense in theory, but I need someone to look at my situation and tell me where to start.',
  '1-2 weeks after access',
  '["Client asks follow-up questions about their specific industry", "Client requests a call to discuss their situation", "Client mentions confusion about prioritization"]'::jsonb,
  'service', 'qw-live-workshop', 'Half-Day AI Strategy Workshop (Live)', 'quick-win', 3500,
  '[
    {"id":"pos-1","title":"Present the Decoy","talking_points":["We have a recorded AI strategy workshop you can go through at your own pace.","It covers the same framework we use in our live sessions — how to identify AI opportunities, prioritize them, and estimate ROI."],"actions":[]},
    {"id":"pos-2","title":"Show What It Does Well","talking_points":["You will come away with a clear understanding of where AI fits in your organization and a framework for evaluating any AI initiative."],"actions":[]},
    {"id":"pos-3","title":"Name the Next Problem","talking_points":["Here is what I want you to know upfront: the recording teaches you the framework, but it cannot answer YOUR questions.","When you are watching it, you will think ''does this apply to my industry?'' or ''how would this work with my tech stack?'' — and the recording cannot respond.","The live Half-Day Workshop is interactive. We work through YOUR business specifically. By the end, you have a prioritized list of AI opportunities ranked by ROI for YOUR company."],"actions":[]},
    {"id":"pos-4","title":"Incremental Value Frame","talking_points":["The recorded workshop is free with CI Starter. The live workshop is part of the Quick Win at $997.","For $997, you get a personalized AI roadmap instead of a generic one — plus follow-up calls and 30-day support to help you act on it."],"actions":[]},
    {"id":"pos-5","title":"Soft Close","talking_points":["Would you like the personalized live workshop, or would you prefer to start with the recording?"],"actions":["Record decision"]},
    {"id":"pos-6","title":"Graceful Acceptance","talking_points":["If recording: ''Great — I will send you access. And when you are ready for the personalized version, the Quick Win is always available.''","If live: ''Let us find a date for your workshop.''"],"actions":["Schedule or send access"]}
  ]'::jsonb,
  '[
    {"id":"pop-1","title":"Check In on Usage","talking_points":["Did you get a chance to go through the recorded workshop? What stood out to you?"],"actions":["Listen for specific opportunities or confusion"]},
    {"id":"pop-2","title":"Validate Their Experience","talking_points":["[Repeat their specific question or confusion point.] That is exactly the feedback we hear most.","The recording gives you the framework, but when it comes to ''does this apply to MY business?'' — you need someone who can look at your specific situation."],"actions":[]},
    {"id":"pop-3","title":"Prescribe the Solution","talking_points":["The Quick Win live workshop is exactly that. We take the framework you already understand and apply it to YOUR business in a half-day session.","You walk out with a prioritized list of AI opportunities, ranked by ROI, specific to your industry and tech stack."],"actions":[]},
    {"id":"pop-4","title":"Incremental Value Frame","talking_points":["The CI Starter was free. The Quick Win is $997 — and it includes the live workshop plus 2 follow-up strategy calls and 30-day email support.","You are not just getting a workshop — you are getting a 30-day advisory relationship."],"actions":[]},
    {"id":"pop-5","title":"Risk Reversal","talking_points":["The Quick Win comes with a 30-day money-back guarantee: identify 3+ actionable AI opportunities or get a full refund. No questions asked."],"actions":[]},
    {"id":"pop-6","title":"Soft Close","talking_points":["Would you like to schedule the live workshop so we can turn those ideas into a concrete plan?"],"actions":["Schedule or note follow-up"]}
  ]'::jsonb,
  997, 3500,
  'The recorded workshop is free. The live workshop is $997 — for that you get a personalized AI roadmap, 2 follow-up calls, and 30-day support.',
  'Quick Win Guarantee: Identify 3+ actionable AI opportunities or get a full refund. No questions asked.',
  false, NULL,
  1, true
);

-- 2. Implementation Playbook -> Follow-up Strategy Calls
INSERT INTO offer_upsell_paths (
  source_content_type, source_content_id, source_title, source_tier_slug,
  next_problem, next_problem_timing, next_problem_signals,
  upsell_content_type, upsell_content_id, upsell_title, upsell_tier_slug, upsell_perceived_value,
  incremental_cost, incremental_value, value_frame_text, risk_reversal_text,
  credit_previous_investment, credit_note,
  display_order, is_active
) VALUES (
  'product', 'ci-playbook', 'AI Implementation Playbook (PDF)', 'ci-starter',
  'The playbook is generic — I need someone to help me prioritize for my specific situation. There are too many options and I do not know where to start.',
  '1 week after download',
  '["Client asks for advice on which chapter applies to them", "Client requests personalized guidance", "Client mentions feeling overwhelmed by options"]'::jsonb,
  'service', 'qw-strategy-calls', '2 Follow-up Strategy Calls', 'quick-win', 500,
  997, 500,
  'The playbook is free. The Quick Win adds 2 personalized strategy calls where we prioritize the playbook for YOUR business — for $997.',
  'Quick Win Guarantee: 3+ actionable opportunities or full refund.',
  false, NULL,
  2, true
);

-- 3. ROI Templates -> AI Audit Calculator (deployed)
INSERT INTO offer_upsell_paths (
  source_content_type, source_content_id, source_title, source_tier_slug,
  next_problem, next_problem_timing, next_problem_signals,
  upsell_content_type, upsell_content_id, upsell_title, upsell_tier_slug, upsell_perceived_value,
  incremental_cost, incremental_value, value_frame_text, risk_reversal_text,
  credit_previous_investment, credit_note,
  display_order, is_active
) VALUES (
  'product', 'ci-roi-templates', 'ROI Template Spreadsheets', 'ci-starter',
  'I filled in the template but I am not confident in my numbers. The benchmarks feel generic and I do not know if my estimates are realistic for my industry.',
  '1-2 weeks after use',
  '["Client asks about industry benchmarks", "Client questions accuracy of their ROI estimates", "Client requests validation of their numbers"]'::jsonb,
  'lead_magnet', 'audit-calculator', 'AI Audit Calculator (Deployed)', 'quick-win', 500,
  997, 500,
  'The templates are manual. The AI Audit Calculator is automated, benchmarked against your industry, and gives you confidence in the numbers — included in the Quick Win at $997.',
  'Quick Win Guarantee: 3+ actionable opportunities or full refund.',
  false, NULL,
  3, true
);

-- ============================================================================
-- CI Accelerator -> Accelerator (3 paths)
-- ============================================================================

-- 4. Chatbot Template -> Deployed Chatbot
INSERT INTO offer_upsell_paths (
  source_content_type, source_content_id, source_title, source_tier_slug,
  next_problem, next_problem_timing, next_problem_signals,
  upsell_content_type, upsell_content_id, upsell_title, upsell_tier_slug, upsell_perceived_value,
  point_of_sale_steps, point_of_pain_steps,
  incremental_cost, incremental_value, value_frame_text, risk_reversal_text,
  credit_previous_investment, credit_note,
  display_order, is_active
) VALUES (
  'service', 'ci-chatbot-template', 'Pre-Built Chatbot Template', 'ci-accelerator',
  'The template is generic — it does not know my products, my pricing, or my customer history. Customers ask questions it cannot answer because it has not been trained on MY data. And it cannot connect to my CRM or ticketing system.',
  '2-4 weeks after install',
  '["Client reports chatbot giving wrong answers", "Client asks about CRM integration", "Client mentions customers complaining about bot responses", "Support tickets about chatbot limitations"]'::jsonb,
  'service', 'acc-deployed-chatbot', 'AI Customer Support Chatbot (Deployed)', 'accelerator', 15000,
  '[
    {"id":"pos-1","title":"Present the Decoy","talking_points":["We have a pre-built chatbot template you can install yourself. It handles basic customer questions, it is free to set up, and we give you a step-by-step guide.","A lot of nonprofits and smaller organizations start here."],"actions":[]},
    {"id":"pos-2","title":"Show What It Does Well","talking_points":["Out of the box, it handles FAQs, routes basic inquiries, and is available 24/7.","That alone saves most teams 5-10 hours a week on repetitive questions."],"actions":[]},
    {"id":"pos-3","title":"Name the Next Problem","talking_points":["Here is what I want you to know upfront: the template is generic. It does not know your products, your pricing, or your customer history.","The first thing you will notice after installing it is that customers ask questions it cannot answer — because it has not been trained on YOUR data.","That is the gap between a template and a deployed solution. The deployed version is trained on your knowledge base, connected to your CRM, and configured for your specific workflows. It does not just answer questions — it captures leads, routes them, and follows up automatically."],"actions":[]},
    {"id":"pos-4","title":"Incremental Value Frame","talking_points":["The template is included in the CI Accelerator at $1,997. The fully deployed chatbot — trained, integrated, and maintained — is part of the AI Accelerator at $7,497.","That is $5,500 more for a tool that is actually connected to your business, not just sitting on your website.","Most of our clients who start with the template end up upgrading within 30 days because they hit exactly this wall. I would rather save you that month."],"actions":[]},
    {"id":"pos-5","title":"Soft Close","talking_points":["Would you like to go with the deployed version, or would you prefer to start with the template and see how it goes?"],"actions":["Record decision"]},
    {"id":"pos-6","title":"Graceful Acceptance","talking_points":["If template: ''Great choice — let us get you set up. And just so you know, if you decide to upgrade later, the $1,997 you have invested applies as credit toward the Accelerator. You will not pay twice.''","If deployed: ''Perfect. Let us get your onboarding scheduled.''"],"actions":["Schedule or send template access"]}
  ]'::jsonb,
  '[
    {"id":"pop-1","title":"Check In on Usage","talking_points":["How is the chatbot working? How many conversations has it handled so far?"],"actions":["Listen for volume AND frustration points"]},
    {"id":"pop-2","title":"Validate Their Experience","talking_points":["That is actually really common. The template handles the basics well, but [repeat their specific frustration]."],"actions":[]},
    {"id":"pop-3","title":"Connect to the Predicted Problem","talking_points":["Remember when we first talked, I mentioned that the template does not know your business data? That is exactly what you are running into.","The template can handle maybe 60% of questions. The other 40% — the ones that actually convert to sales or prevent churn — need a system trained on YOUR data."],"actions":[]},
    {"id":"pop-4","title":"Prescribe the Solution","talking_points":["Here is what I would recommend: upgrade to the deployed chatbot. We take everything you have learned from running the template — which questions come up most, which ones it cannot handle — and we use that to train the deployed version.","You are not starting from scratch. You are starting from experience."],"actions":[]},
    {"id":"pop-5","title":"Incremental Value Frame","talking_points":["You have already invested $1,997 in the CI Accelerator. That applies as credit toward the AI Accelerator at $7,497 — so your net investment is $5,500.","And the deployed chatbot alone is valued at $15,000. You are getting it for a third of that."],"actions":[]},
    {"id":"pop-6","title":"Risk Reversal","talking_points":["The Accelerator comes with a 90-day guarantee: save 10+ hours per week or we keep coaching you until you do. The template has no guarantee. The deployed version does."],"actions":[]},
    {"id":"pop-7","title":"Soft Close","talking_points":["Based on what you have seen with the template, does it make sense to upgrade to the deployed version?"],"actions":["Record decision"]}
  ]'::jsonb,
  5500, 15000,
  'The template is $1,997. The deployed chatbot is part of the Accelerator at $7,497 — $5,500 more for a tool trained on YOUR data, connected to your systems.',
  'Accelerator Guarantee: Save 10+ hours per week within 90 days or we keep coaching you for free until you do.',
  true, 'Your $1,997 CI Accelerator investment applies as credit toward the AI Accelerator.',
  4, true
);

-- 5. Group Onboarding -> 1-on-1 Coaching
INSERT INTO offer_upsell_paths (
  source_content_type, source_content_id, source_title, source_tier_slug,
  next_problem, next_problem_timing, next_problem_signals,
  upsell_content_type, upsell_content_id, upsell_title, upsell_tier_slug, upsell_perceived_value,
  incremental_cost, incremental_value, value_frame_text, risk_reversal_text,
  credit_previous_investment, credit_note,
  display_order, is_active
) VALUES (
  'service', 'ci-group-onboarding', 'Group Onboarding Webinar (6 weeks)', 'ci-accelerator',
  'The group format is too slow — I need hands-on help with MY specific setup. Other participants have different tech stacks and the advice is too general for my situation.',
  '2-3 weeks into group program',
  '["Client asks questions specific to their stack during group calls", "Client requests 1-on-1 time", "Client falls behind the group pace"]'::jsonb,
  'service', 'acc-coaching', '4-Week Implementation Coaching (1-on-1)', 'accelerator', 3000,
  5500, 3000,
  'Group webinars are $1,997. The 1-on-1 coaching is part of the Accelerator at $7,497 — personalized to your stack, your pace, your goals.',
  'Accelerator Guarantee: Save 10+ hours per week within 90 days.',
  true, 'Your $1,997 CI Accelerator investment applies as credit.',
  5, true
);

-- 6. Email Support -> Priority Support
INSERT INTO offer_upsell_paths (
  source_content_type, source_content_id, source_title, source_tier_slug,
  next_problem, next_problem_timing, next_problem_signals,
  upsell_content_type, upsell_content_id, upsell_title, upsell_tier_slug, upsell_perceived_value,
  incremental_cost, incremental_value, value_frame_text, risk_reversal_text,
  credit_previous_investment, credit_note,
  display_order, is_active
) VALUES (
  'service', 'ci-email-support', '30-Day Email Support', 'ci-accelerator',
  'Email is too slow when something breaks. I need someone who can jump in and fix things quickly, not wait 24-48 hours for a reply.',
  '1-2 weeks after first support request',
  '["Client sends urgent support emails", "Client mentions downtime or broken functionality", "Client requests phone or chat support"]'::jsonb,
  'service', 'acc-priority-support', '90-Day Priority Support', 'accelerator', 2000,
  5500, 2000,
  'Email support is included at $1,997. Priority support with 24hr response is part of the Accelerator at $7,497.',
  'Accelerator Guarantee: Save 10+ hours per week within 90 days.',
  true, 'Your $1,997 CI Accelerator investment applies as credit.',
  6, true
);

-- ============================================================================
-- CI Growth -> Growth Engine (4 paths)
-- ============================================================================

-- 7. Lead Tracking Templates -> Deployed Lead Gen System
INSERT INTO offer_upsell_paths (
  source_content_type, source_content_id, source_title, source_tier_slug,
  next_problem, next_problem_timing, next_problem_signals,
  upsell_content_type, upsell_content_id, upsell_title, upsell_tier_slug, upsell_perceived_value,
  point_of_sale_steps, point_of_pain_steps,
  incremental_cost, incremental_value, value_frame_text, risk_reversal_text,
  credit_previous_investment, credit_note,
  display_order, is_active
) VALUES (
  'service', 'ci-lead-templates', 'Lead Tracking Templates', 'ci-growth',
  'I am tracking leads manually in a spreadsheet — it does not scale and I am missing follow-ups. Every lead requires manual entry, manual follow-up, and manual scoring.',
  '3-4 weeks after setup',
  '["Client mentions missed follow-ups", "Client reports spreadsheet is getting unwieldy", "Client asks about automation", "Lead volume exceeds manual capacity"]'::jsonb,
  'service', 'ge-lead-gen', 'Inbound Lead Tracking System (Deployed)', 'growth-engine', 12000,
  '[
    {"id":"pos-1","title":"Present the Decoy","talking_points":["We have a lead tracking template system — spreadsheet-based, with automation guides. You set it up yourself, and it gives you a structured way to track every lead."],"actions":[]},
    {"id":"pos-2","title":"Show What It Does Well","talking_points":["It is a huge step up from sticky notes or scattered emails. You will have a single view of every lead, where they came from, and what stage they are in."],"actions":[]},
    {"id":"pos-3","title":"Name the Next Problem","talking_points":["Here is what happens in practice: after about 2-3 weeks, you will have 50+ leads in the spreadsheet. And you will realize you are still manually entering every one.","You will miss follow-ups because there is no automation. And you will not know which leads are hot because there is no scoring.","The deployed Lead Generation Workflow Agent does all of that automatically. Leads flow in from your website, social, email, and ads. They are scored, routed, and followed up with — without you touching a spreadsheet."],"actions":[]},
    {"id":"pos-4","title":"Incremental Value Frame","talking_points":["The templates are part of CI Growth at $4,997. The deployed lead gen system is part of the Growth Engine at $14,997.","That is $10,000 more — but it replaces a full-time lead coordinator and never misses a follow-up. Most businesses at your size are spending $40,000-$60,000/year on that function."],"actions":[]},
    {"id":"pos-5","title":"Soft Close","talking_points":["Do you want the automated system, or would you prefer to start with the templates and upgrade when you are ready?"],"actions":["Record decision"]},
    {"id":"pos-6","title":"Graceful Acceptance","talking_points":["If templates: ''Let us get you started. Your CI Growth investment applies as credit if you upgrade.''","If deployed: ''Smart move. Let us map out your lead sources in the kickoff.''"],"actions":["Schedule or send template access"]}
  ]'::jsonb,
  '[
    {"id":"pop-1","title":"Check In","talking_points":["How is the lead tracking going? How many leads are you managing right now?"],"actions":["Listen for volume and frustration"]},
    {"id":"pop-2","title":"Validate","talking_points":["And how much time are you spending on manual entry and follow-ups?"],"actions":["They will say too much or describe missed follow-ups"]},
    {"id":"pop-3","title":"Connect to Predicted Problem","talking_points":["That is the exact bottleneck the templates create at scale. They organize your data, but they do not automate the flow.","Every lead still requires manual entry, manual follow-up, and manual scoring. At your volume, that is unsustainable."],"actions":[]},
    {"id":"pop-4","title":"Prescribe","talking_points":["The Growth Engine Lead Generation Workflow Agent automates the entire pipeline. Leads flow in automatically from every channel, they are scored by AI, and follow-ups happen without you touching anything.","Your templates become the foundation — we import your existing data and build the automation on top of it."],"actions":[]},
    {"id":"pop-5","title":"Incremental Value Frame","talking_points":["You have invested $4,997 in CI Growth. That applies as credit toward the Growth Engine at $14,997 — net investment of $10,000.","The lead gen system alone is valued at $25,000, and it replaces $40,000-$60,000/year in manual lead management."],"actions":[]},
    {"id":"pop-6","title":"Risk Reversal","talking_points":["Growth Engine guarantee: 3x ROI in year 1 or we continue supporting you at no additional cost."],"actions":[]},
    {"id":"pop-7","title":"Soft Close","talking_points":["Given the time you are spending on manual lead management, would you like to upgrade to the automated system?"],"actions":["Record decision"]}
  ]'::jsonb,
  10000, 12000,
  'Templates are $4,997. The deployed system is part of Growth Engine at $14,997 — $10,000 more but replaces $40,000-$60,000/year in manual lead management.',
  'Growth Engine Guarantee: 3x ROI in year 1 or continued support at no additional cost.',
  true, 'Your $4,997 CI Growth investment applies as credit toward the Growth Engine.',
  7, true
);

-- 8. Content Automation Templates -> Social Media Content Agent
INSERT INTO offer_upsell_paths (
  source_content_type, source_content_id, source_title, source_tier_slug,
  next_problem, next_problem_timing, next_problem_signals,
  upsell_content_type, upsell_content_id, upsell_title, upsell_tier_slug, upsell_perceived_value,
  incremental_cost, incremental_value, value_frame_text, risk_reversal_text,
  credit_previous_investment, credit_note,
  display_order, is_active
) VALUES (
  'service', 'ci-content-templates', 'Content Automation Templates', 'ci-growth',
  'I have the templates but I still have to write and post everything myself. The templates save time on formatting but the actual content creation and scheduling is still manual.',
  '2-3 weeks after setup',
  '["Client mentions still spending hours on content", "Client asks about scheduling automation", "Client posting frequency drops off"]'::jsonb,
  'service', 'ge-content-agent', 'Social Media Content Agent (Deployed)', 'growth-engine', 18000,
  10000, 18000,
  'Content templates are $4,997. The deployed content agent generates AND posts across all channels — part of the Growth Engine at $14,997.',
  'Growth Engine Guarantee: 3x ROI in year 1.',
  true, 'Your $4,997 CI Growth investment applies as credit.',
  8, true
);

-- 9. Group Implementation -> Dedicated Implementation Program
INSERT INTO offer_upsell_paths (
  source_content_type, source_content_id, source_title, source_tier_slug,
  next_problem, next_problem_timing, next_problem_signals,
  upsell_content_type, upsell_content_id, upsell_title, upsell_tier_slug, upsell_perceived_value,
  incremental_cost, incremental_value, value_frame_text, risk_reversal_text,
  credit_previous_investment, credit_note,
  display_order, is_active
) VALUES (
  'service', 'ci-group-implementation', 'Group Implementation Program (6 Weeks)', 'ci-growth',
  '6 weeks of group calls is not enough for my business. I need a dedicated program that moves at my pace and addresses my specific challenges.',
  '3-4 weeks into group program',
  '["Client falls behind group pace", "Client requests additional 1-on-1 time", "Client has unique requirements not covered in group"]'::jsonb,
  'service', 'ge-implementation', '12-Week Implementation Program (Dedicated)', 'growth-engine', 7500,
  10000, 7500,
  'Group implementation is $4,997. The dedicated 12-week program is part of the Growth Engine at $14,997 — twice the time, fully personalized.',
  'Growth Engine Guarantee: 3x ROI in year 1.',
  true, 'Your $4,997 CI Growth investment applies as credit.',
  9, true
);

-- 10. Shared Dashboard -> Custom Dashboard
INSERT INTO offer_upsell_paths (
  source_content_type, source_content_id, source_title, source_tier_slug,
  next_problem, next_problem_timing, next_problem_signals,
  upsell_content_type, upsell_content_id, upsell_title, upsell_tier_slug, upsell_perceived_value,
  incremental_cost, incremental_value, value_frame_text, risk_reversal_text,
  credit_previous_investment, credit_note,
  display_order, is_active
) VALUES (
  'service', 'ci-shared-dashboard', 'Shared Analytics Dashboard', 'ci-growth',
  'The shared dashboard does not show MY specific metrics. I need to see my own KPIs, not aggregated data from other organizations.',
  '2-3 weeks after access',
  '["Client asks about custom metrics", "Client requests specific KPI tracking", "Client mentions the dashboard is not useful for their reporting"]'::jsonb,
  'service', 'ge-custom-dashboard', 'Custom Analytics Dashboard', 'growth-engine', 5000,
  10000, 5000,
  'The shared dashboard is included at $4,997. A custom dashboard built for YOUR KPIs is part of the Growth Engine at $14,997.',
  'Growth Engine Guarantee: 3x ROI in year 1.',
  true, 'Your $4,997 CI Growth investment applies as credit.',
  10, true
);

-- ============================================================================
-- Standalone Service Upsell Paths (3 paths)
-- ============================================================================

-- 11. Workshop -> Consulting/Coaching
INSERT INTO offer_upsell_paths (
  source_content_type, source_content_id, source_title, source_tier_slug,
  next_problem, next_problem_timing, next_problem_signals,
  upsell_content_type, upsell_content_id, upsell_title, upsell_tier_slug, upsell_perceived_value,
  incremental_cost, incremental_value, value_frame_text, risk_reversal_text,
  credit_previous_investment, credit_note,
  display_order, is_active
) VALUES (
  'service', 'workshop-any', 'Half-Day AI Strategy Workshop', NULL,
  'Great workshop — I now have a roadmap. But I need help actually implementing what we discussed. The gap between strategy and execution is where I get stuck.',
  '1-2 weeks after workshop',
  '["Client asks implementation questions", "Client requests follow-up beyond included calls", "Client mentions they need ongoing guidance"]'::jsonb,
  'service', 'consulting-engagement', 'Consulting Engagement', NULL, 5000,
  NULL, 5000,
  'The workshop gave you the roadmap. A consulting engagement gives you a partner to execute it — hands-on, at your pace.',
  'All consulting engagements include a satisfaction guarantee.',
  false, NULL,
  11, true
);

-- 12. Consulting -> Advisory Retainer
INSERT INTO offer_upsell_paths (
  source_content_type, source_content_id, source_title, source_tier_slug,
  next_problem, next_problem_timing, next_problem_signals,
  upsell_content_type, upsell_content_id, upsell_title, upsell_tier_slug, upsell_perceived_value,
  incremental_cost, incremental_value, value_frame_text, risk_reversal_text,
  credit_previous_investment, credit_note,
  display_order, is_active
) VALUES (
  'service', 'consulting-engagement', 'Consulting Engagement', NULL,
  'The consulting advice was valuable but my needs are ongoing. I do not want to start from scratch every time I have a strategic question — I need a continuous advisory relationship.',
  'After consulting engagement ends',
  '["Client requests additional consulting sessions", "Client asks about ongoing support options", "Client mentions new challenges after initial engagement"]'::jsonb,
  'service', 'advisory-retainer', 'AI Advisory Retainer', NULL, 2500,
  2500, 30000,
  'A one-off consulting engagement solves today''s problem. The Advisory Retainer at $2,500/month gives you a strategic partner for every problem — monthly 1-on-1 calls, priority support, quarterly reviews.',
  'No long-term commitment. Cancel anytime.',
  false, NULL,
  12, true
);

-- 13. Any Deployed Tool -> Continuity (Growth Partner)
INSERT INTO offer_upsell_paths (
  source_content_type, source_content_id, source_title, source_tier_slug,
  next_problem, next_problem_timing, next_problem_signals,
  upsell_content_type, upsell_content_id, upsell_title, upsell_tier_slug, upsell_perceived_value,
  point_of_pain_steps,
  incremental_cost, incremental_value, value_frame_text, risk_reversal_text,
  credit_previous_investment, credit_note,
  display_order, is_active
) VALUES (
  'service', 'any-deployed-tool', 'Any Deployed AI Tool', NULL,
  'The tool is working but who maintains it? AI tools are not set-and-forget — they need tuning, updates, and someone watching the metrics. What happens when something breaks at 2am?',
  'After delivery milestones completed',
  '["Client asks about maintenance", "Client reports a tool issue", "Client asks who handles updates", "Tool performance degrades without optimization"]'::jsonb,
  'service', 'growth-partner', 'AI Growth Partner ($497/mo)', NULL, 5964,
  '[
    {"id":"pop-1","title":"Review Results","talking_points":["Let us look at what we have built together: [list deployed tools and metrics]. Everything is running and producing results."],"actions":["Pull up metrics"]},
    {"id":"pop-2","title":"Surface the Maintenance Question","talking_points":["Here is the question: who maintains and optimizes these tools going forward?","AI tools are not set-and-forget — they need tuning, updates, and someone watching the metrics."],"actions":[]},
    {"id":"pop-3","title":"Prescribe the Plan","talking_points":["Based on your setup, I would recommend the AI Growth Partner plan.","It includes: monthly group coaching, resource library access, community membership, basic maintenance for all deployed tools, and email support."],"actions":[]},
    {"id":"pop-4","title":"Incremental Value Frame","talking_points":["Your tools save you [X] hours per week — roughly $[Y] per month in recovered time.","The Growth Partner plan is $497/month — less than 2 hours of the time your tools already save you. It is insurance that keeps the savings flowing."],"actions":[]},
    {"id":"pop-5","title":"Risk Reversal","talking_points":["No long-term commitment. Cancel anytime. Most clients stay because the ROI is obvious — $497 to protect $[Y] in monthly savings."],"actions":[]},
    {"id":"pop-6","title":"Soft Close","talking_points":["Do you want me to set up the Growth Partner plan so your tools stay optimized?"],"actions":["Record decision"]}
  ]'::jsonb,
  497, 5964,
  'Your tools save you $[Y]/month. The Growth Partner plan is $497/month — less than 2 hours of the time your tools already save you.',
  'No long-term commitment. Cancel anytime.',
  false, NULL,
  13, true
);

-- ============================================================================
-- Standalone Product Upsell Paths (2 paths)
-- ============================================================================

-- 14. E-book/Training -> Workshop or Consulting
INSERT INTO offer_upsell_paths (
  source_content_type, source_content_id, source_title, source_tier_slug,
  next_problem, next_problem_timing, next_problem_signals,
  upsell_content_type, upsell_content_id, upsell_title, upsell_tier_slug, upsell_perceived_value,
  incremental_cost, incremental_value, value_frame_text, risk_reversal_text,
  credit_previous_investment, credit_note,
  display_order, is_active
) VALUES (
  'product', 'ebook-training-any', 'E-book or Training Curriculum', NULL,
  'I read the book or completed the training — now I want hands-on help applying it to my business. The concepts make sense but I need guidance on execution.',
  '1-2 weeks after completion',
  '["Client asks implementation questions", "Client requests a call to discuss application", "Client mentions gap between learning and doing"]'::jsonb,
  'service', 'workshop-or-consulting', 'Workshop or Consulting Session', NULL, 3500,
  NULL, 3500,
  'The book gave you the knowledge. A workshop or consulting session gives you the application — personalized to your business.',
  NULL,
  false, NULL,
  14, true
);

-- 15. AI Audit Calculator (Lead Magnet) -> Quick Win or Accelerator
INSERT INTO offer_upsell_paths (
  source_content_type, source_content_id, source_title, source_tier_slug,
  next_problem, next_problem_timing, next_problem_signals,
  upsell_content_type, upsell_content_id, upsell_title, upsell_tier_slug, upsell_perceived_value,
  incremental_cost, incremental_value, value_frame_text, risk_reversal_text,
  credit_previous_investment, credit_note,
  display_order, is_active
) VALUES (
  'lead_magnet', 'ai-audit-calculator', 'AI Audit Calculator', NULL,
  'The audit showed I have problems and opportunities — now what? I have the diagnosis but I need the treatment plan and someone to help me execute it.',
  'Immediately after audit completion',
  '["Client completes audit with high opportunity score", "Client requests follow-up call", "Client asks what to do next"]'::jsonb,
  'service', 'quick-win-or-accelerator', 'Quick Win ($997) or AI Accelerator ($7,497)', NULL, 5350,
  997, 5350,
  'The audit is free — it showed you where the opportunities are. The Quick Win at $997 gives you a personalized roadmap to act on them. The Accelerator at $7,497 builds and deploys the top solutions for you.',
  'Quick Win: 30-day money-back guarantee. Accelerator: 90-day outcome guarantee.',
  false, NULL,
  15, true
);
