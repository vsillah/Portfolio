-- Seed Script: Test Lead for Sales Script Testing
-- Run this in Supabase SQL Editor to create a sample lead

-- Step 1: Create a test chat session
INSERT INTO chat_sessions (session_id, visitor_email, visitor_name, created_at)
VALUES (
  'test-lead-session-001',
  'sarah.mitchell@techflow.io',
  'Sarah Mitchell',
  NOW() - INTERVAL '2 days'
)
ON CONFLICT (session_id) DO NOTHING;

-- Step 2: Create a test contact submission
INSERT INTO contact_submissions (
  name, 
  email, 
  message,
  company,
  company_domain,
  linkedin_url,
  annual_revenue,
  interest_areas,
  interest_summary,
  is_decision_maker,
  lead_score,
  qualification_status,
  ai_readiness_score,
  created_at
)
VALUES (
  'Sarah Mitchell',
  'sarah.mitchell@techflow.io',
  'I am looking for help automating our sales pipeline and improving our AI capabilities. We currently use HubSpot for CRM and are interested in integrating AI-powered lead scoring and automated follow-ups.',
  'TechFlow Solutions',
  'techflow.io',
  'https://linkedin.com/in/sarahmitchell',
  '$1M-$5M',
  ARRAY['ai_automation', 'sales_pipeline', 'workflow_optimization'],
  'AI Automation, Sales Pipeline, Workflow Optimization',
  true,
  85,
  'qualified',
  7,
  NOW() - INTERVAL '2 days'
)
RETURNING id;

-- Step 3: Create a completed diagnostic audit for this lead
-- Note: You'll need to update the contact_submission_id below with the actual ID from Step 2
DO $$
DECLARE
  contact_id BIGINT;
BEGIN
  -- Get the contact submission ID we just created
  SELECT id INTO contact_id 
  FROM contact_submissions 
  WHERE email = 'sarah.mitchell@techflow.io' 
  LIMIT 1;

  -- Insert the diagnostic audit
  INSERT INTO diagnostic_audits (
    session_id,
    contact_submission_id,
    status,
    
    -- Business challenges identified
    business_challenges,
    
    -- Current tech stack
    tech_stack,
    
    -- Automation needs
    automation_needs,
    
    -- AI readiness assessment
    ai_readiness,
    
    -- Budget and timeline
    budget_timeline,
    
    -- Decision making info
    decision_making,
    
    -- Summary and insights
    diagnostic_summary,
    key_insights,
    recommended_actions,
    
    -- Scores
    urgency_score,
    opportunity_score,
    sales_notes,
    
    -- Timestamps
    started_at,
    completed_at
  )
  VALUES (
    'test-lead-session-001',
    contact_id,
    'completed',
    
    -- Business challenges
    '{
      "primary_challenges": ["Manual lead follow-up taking too long", "Inconsistent sales messaging", "No visibility into pipeline health"],
      "pain_points": ["Losing deals due to slow response times", "Sales team spending 60% of time on admin tasks"],
      "current_impact": "Estimated $200K in lost revenue due to slow follow-up",
      "attempted_solutions": ["Hired more sales reps", "Tried Zapier but hit limitations"]
    }'::jsonb,
    
    -- Tech stack
    '{
      "crm": "HubSpot",
      "email": "Google Workspace",
      "marketing": "Mailchimp",
      "analytics": "Google Analytics",
      "other_tools": ["Slack", "Notion", "Calendly"],
      "integration_readiness": "High - all tools have APIs"
    }'::jsonb,
    
    -- Automation needs
    '{
      "priority_areas": ["Lead scoring and routing", "Automated follow-up sequences", "Pipeline reporting"],
      "desired_outcomes": ["Respond to leads within 5 minutes", "Personalized outreach at scale", "Real-time deal insights"],
      "complexity_tolerance": "Medium - want results fast but willing to invest in setup"
    }'::jsonb,
    
    -- AI readiness
    '{
      "data_quality": "Good - clean CRM data",
      "team_readiness": "Excited about AI tools",
      "previous_ai_experience": "Used ChatGPT for email templates",
      "concerns": ["Data privacy", "Cost"],
      "readiness_score": 7
    }'::jsonb,
    
    -- Budget and timeline
    '{
      "budget_range": "$5,000-$15,000",
      "timeline": "Want to start within 30 days",
      "decision_timeline": "Can decide within 2 weeks",
      "budget_flexibility": "Could increase for proven ROI"
    }'::jsonb,
    
    -- Decision making
    '{
      "decision_maker": true,
      "stakeholders": ["CEO", "Sales Manager"],
      "approval_process": "Sarah has final say for tools under $20K",
      "previous_vendor_experience": "Good - currently using 3 SaaS tools"
    }'::jsonb,
    
    -- Summary
    'Sarah from TechFlow Solutions is a highly qualified lead looking to automate their sales pipeline. They have a clear pain point (slow lead response times costing ~$200K), a compatible tech stack (HubSpot + Google), and budget authority. The urgency is high as they want to implement within 30 days.',
    
    -- Key insights
    ARRAY[
      'High urgency: Currently losing deals due to slow response times',
      'Strong tech foundation: HubSpot CRM with clean data',
      'Budget approved: $5K-$15K range with flexibility',
      'Decision maker: Can approve within 2 weeks',
      'AI-ready: Team is excited, some ChatGPT experience'
    ],
    
    -- Recommended actions
    ARRAY[
      'Schedule demo of AI-powered lead scoring solution',
      'Show ROI calculator based on their $200K lost revenue estimate',
      'Propose HubSpot integration that can go live in 2 weeks',
      'Address data privacy concerns with security documentation',
      'Offer pilot program to reduce perceived risk'
    ],
    
    -- Scores
    8,  -- urgency_score (high - they want to start in 30 days)
    9,  -- opportunity_score (great fit, budget, and authority)
    'Hot lead - Sarah is the decision maker with approved budget. Follow up within 24 hours. She mentioned competing with a similar solution from a competitor.',
    
    -- Timestamps
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day'
  )
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Test lead created successfully! Contact ID: %', contact_id;
END $$;

-- Verify the seed data
SELECT 
  da.id as audit_id,
  da.status,
  da.urgency_score,
  da.opportunity_score,
  cs.name as contact_name,
  cs.email,
  cs.company,
  da.diagnostic_summary
FROM diagnostic_audits da
LEFT JOIN contact_submissions cs ON da.contact_submission_id = cs.id
WHERE da.session_id = 'test-lead-session-001';
