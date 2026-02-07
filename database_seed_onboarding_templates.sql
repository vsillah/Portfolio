-- ============================================================================
-- Seed Data: Onboarding Plan Templates
-- Initial templates for each content_type / service_type combination.
-- The AI Chatbot Solution template mirrors the original PDF onboarding plan.
-- ============================================================================

-- ============================================================================
-- 1. Service: Consulting (8-12 weeks, weekly check-ins, 12-month warranty)
-- ============================================================================
INSERT INTO onboarding_plan_templates (
  name, content_type, service_type, offer_role, estimated_duration_weeks,
  setup_requirements, milestones_template, communication_plan,
  win_conditions, warranty, artifacts_handoff
) VALUES (
  'Consulting Engagement Onboarding',
  'service', 'consulting', 'core_offer', 12,
  '[
    {"title": "CRM & Sales Platform Access", "description": "Provide integration permissions to connect with existing CRM software and sales platforms for data syncing.", "category": "access", "is_client_action": true},
    {"title": "Business Process Documentation", "description": "Share current workflows, SOPs, and process documentation relevant to the consulting scope.", "category": "documentation", "is_client_action": true},
    {"title": "Stakeholder Introductions", "description": "Schedule introductions with key team members who will be involved in the engagement.", "category": "team", "is_client_action": true},
    {"title": "Data Security Clearance", "description": "Ensure compliance and clearances are in place for handling and processing data per privacy policies and regulatory requirements.", "category": "security", "is_client_action": true},
    {"title": "Project Workspace Setup", "description": "We will set up a shared project workspace with all necessary tools and access.", "category": "setup", "is_client_action": false},
    {"title": "Communication Channel Setup", "description": "Establish a dedicated Slack channel or communication channel for the project.", "category": "communication", "is_client_action": false}
  ]',
  '[
    {"week": 1, "title": "Kickoff & Discovery", "description": "Conduct kickoff meeting to confirm project scope, gather detailed requirements, and set expectations.", "deliverables": ["Signed project charter", "Requirements document"], "phase": 0},
    {"week": 2, "title": "Current State Assessment", "description": "Analyze existing processes, identify gaps, and document findings.", "deliverables": ["Current state assessment report"], "phase": 1},
    {"week": 3, "title": "Strategy Development", "description": "Develop recommended strategy and solution architecture based on assessment.", "deliverables": ["Strategy recommendation document"], "phase": 2},
    {"week": 4, "title": "Solution Design", "description": "Create detailed solution design and implementation roadmap.", "deliverables": ["Solution design document", "Implementation roadmap"], "phase": 2},
    {"week": "5-8", "title": "Implementation & Integration", "description": "Execute the implementation plan, integrate solutions with existing systems.", "deliverables": ["Configured solution", "Integration documentation"], "phase": 2},
    {"week": "9-10", "title": "Testing & Validation", "description": "Perform rigorous testing across all platforms, validate against requirements.", "deliverables": ["Test results report", "Issue resolution log"], "phase": 3},
    {"week": 11, "title": "Training & Knowledge Transfer", "description": "Conduct training sessions for client teams and transfer operational knowledge.", "deliverables": ["Training materials", "Knowledge transfer sessions"], "phase": 4},
    {"week": 12, "title": "Go-Live & Handoff", "description": "Full deployment, final review, and formal project handoff.", "deliverables": ["Go-live confirmation", "Final project documentation"], "phase": 4}
  ]',
  '{
    "cadence": "weekly",
    "channels": ["slack", "email", "video_call"],
    "meetings": [
      {"type": "Weekly Status Call", "frequency": "weekly", "duration_minutes": 30, "description": "Discuss progress, address issues, ensure project remains on track."},
      {"type": "Monthly Strategy Review", "frequency": "monthly", "duration_minutes": 60, "description": "Comprehensive review of performance data, feedback, and strategic adjustments."},
      {"type": "Office Hours", "frequency": "weekly", "duration_minutes": 30, "description": "Open time for the client to discuss ongoing concerns or ideas without formal scheduling."}
    ],
    "escalation_path": "Project Lead → Account Manager → Director",
    "ad_hoc": "Open lines via email or dedicated Slack channel for urgent needs."
  }',
  '[
    {"metric": "Process Efficiency Improvement", "target": "25% improvement in target process efficiency", "measurement_method": "Before/after process metrics comparison", "timeframe": "Within first quarter post-deployment"},
    {"metric": "Client Satisfaction", "target": "High satisfaction ratings (8+/10) from stakeholders", "measurement_method": "Post-engagement satisfaction survey", "timeframe": "At project completion"},
    {"metric": "ROI Achievement", "target": "Demonstrable return on investment through cost savings or revenue increase", "measurement_method": "Financial impact analysis", "timeframe": "Within first quarter post-deployment"},
    {"metric": "Knowledge Transfer Completion", "target": "100% of team members trained and certified on new processes", "measurement_method": "Training completion records", "timeframe": "By project end"}
  ]',
  '{
    "duration_months": 12,
    "coverage_description": "Standard 12-month warranty period during which any issues with delivered solutions can be addressed free of charge.",
    "exclusions": ["Changes to scope beyond original agreement", "Third-party system failures", "Client-initiated modifications"],
    "extended_support_available": true,
    "extended_support_description": "Extended support and maintenance post-warranty available at a negotiated monthly retainer fee."
  }',
  '[
    {"artifact": "Comprehensive Project Documentation", "format": "PDF + Google Docs", "description": "Detailed documentation covering solution design, integration points, functionality, and maintenance guides.", "delivery_method": "Shared project folder"},
    {"artifact": "Performance Reports", "format": "PDF", "description": "Regular performance reports for the first three months post-launch.", "delivery_method": "Email delivery, monthly"},
    {"artifact": "Customized Training Materials", "format": "PDF + Video", "description": "Training materials tailored to the client''s specific configuration and use cases.", "delivery_method": "Shared project folder"},
    {"artifact": "Standard Operating Procedures", "format": "Google Docs", "description": "SOPs for ongoing operation and maintenance of delivered solutions.", "delivery_method": "Shared project folder"}
  ]'
);

-- ============================================================================
-- 2. Service: Training (4-6 weeks, milestone-based, 6-month support)
-- ============================================================================
INSERT INTO onboarding_plan_templates (
  name, content_type, service_type, offer_role, estimated_duration_weeks,
  setup_requirements, milestones_template, communication_plan,
  win_conditions, warranty, artifacts_handoff
) VALUES (
  'Training Program Onboarding',
  'service', 'training', 'core_offer', 6,
  '[
    {"title": "Learning Management System Access", "description": "Provide access to client''s LMS or training platform if applicable.", "category": "access", "is_client_action": true},
    {"title": "Participant List", "description": "Provide finalized list of training participants with roles and contact information.", "category": "documentation", "is_client_action": true},
    {"title": "Training Environment Setup", "description": "We will configure training environments and prepare course materials.", "category": "setup", "is_client_action": false},
    {"title": "Pre-Training Assessment", "description": "Distribute pre-training skill assessment to participants.", "category": "assessment", "is_client_action": false}
  ]',
  '[
    {"week": 1, "title": "Kickoff & Needs Assessment", "description": "Conduct kickoff meeting, confirm training objectives, and assess participant skill levels.", "deliverables": ["Training needs assessment", "Customized curriculum outline"], "phase": 0},
    {"week": 2, "title": "Content Customization", "description": "Customize training materials and exercises based on client-specific use cases.", "deliverables": ["Customized training materials", "Exercise workbooks"], "phase": 1},
    {"week": "3-4", "title": "Training Delivery", "description": "Deliver training sessions (live or virtual) with hands-on exercises.", "deliverables": ["Completed training sessions", "Session recordings"], "phase": 2},
    {"week": 5, "title": "Practice & Application", "description": "Guided practice period with support for applying learned skills.", "deliverables": ["Practice assignments", "Q&A sessions"], "phase": 3},
    {"week": 6, "title": "Assessment & Certification", "description": "Final skill assessment and certificate of completion.", "deliverables": ["Assessment results", "Certificates of completion"], "phase": 4}
  ]',
  '{
    "cadence": "bi-weekly",
    "channels": ["email", "video_call"],
    "meetings": [
      {"type": "Bi-Weekly Check-in", "frequency": "bi-weekly", "duration_minutes": 30, "description": "Review training progress, address questions, and adjust pace if needed."},
      {"type": "Post-Training Review", "frequency": "once", "duration_minutes": 60, "description": "Comprehensive review of training outcomes and next steps."}
    ],
    "escalation_path": "Training Lead → Program Manager",
    "ad_hoc": "Email support for training-related questions between sessions."
  }',
  '[
    {"metric": "Skill Assessment Improvement", "target": "80% of participants score 80%+ on post-training assessment", "measurement_method": "Pre/post assessment comparison", "timeframe": "At training completion"},
    {"metric": "Participant Satisfaction", "target": "Average satisfaction score of 4.5+/5", "measurement_method": "Post-training survey", "timeframe": "Within 1 week of completion"},
    {"metric": "Knowledge Application", "target": "70% of participants applying skills within 30 days", "measurement_method": "Follow-up survey at 30 days", "timeframe": "30 days post-training"}
  ]',
  '{
    "duration_months": 6,
    "coverage_description": "6-month support period with access to updated training materials and Q&A support.",
    "exclusions": ["New training topics beyond original scope", "Individual coaching sessions"],
    "extended_support_available": true,
    "extended_support_description": "Ongoing coaching and refresher training available as add-on packages."
  }',
  '[
    {"artifact": "Training Materials", "format": "PDF + Slides", "description": "Complete training deck, workbooks, and reference materials.", "delivery_method": "Shared project folder"},
    {"artifact": "Session Recordings", "format": "Video (MP4)", "description": "Recordings of all live training sessions for on-demand review.", "delivery_method": "Shared video link"},
    {"artifact": "Assessment Results Report", "format": "PDF", "description": "Individual and aggregate assessment results with recommendations.", "delivery_method": "Email delivery"},
    {"artifact": "Certificates of Completion", "format": "PDF", "description": "Individual certificates for each participant who completed the program.", "delivery_method": "Email to participants"}
  ]'
);

-- ============================================================================
-- 3. Service: Coaching (Ongoing, monthly reviews)
-- ============================================================================
INSERT INTO onboarding_plan_templates (
  name, content_type, service_type, offer_role, estimated_duration_weeks,
  setup_requirements, milestones_template, communication_plan,
  win_conditions, warranty, artifacts_handoff
) VALUES (
  'Coaching Engagement Onboarding',
  'service', 'coaching', 'core_offer', NULL,
  '[
    {"title": "Goal Setting Document", "description": "Complete the pre-coaching questionnaire to define goals, challenges, and desired outcomes.", "category": "documentation", "is_client_action": true},
    {"title": "Calendar Access", "description": "Share calendar availability for scheduling recurring coaching sessions.", "category": "access", "is_client_action": true},
    {"title": "Coaching Platform Setup", "description": "We will set up the coaching workspace and resource library.", "category": "setup", "is_client_action": false}
  ]',
  '[
    {"week": 1, "title": "Discovery & Goal Setting", "description": "Initial deep-dive session to understand goals, challenges, and define success metrics.", "deliverables": ["Coaching agreement", "Goal framework document"], "phase": 0},
    {"week": 2, "title": "Action Plan Development", "description": "Co-create a personalized action plan with milestones and accountability checkpoints.", "deliverables": ["Personalized action plan"], "phase": 1},
    {"week": "3+", "title": "Ongoing Coaching Sessions", "description": "Regular coaching sessions (weekly or bi-weekly) focused on progress, challenges, and skill development.", "deliverables": ["Session notes", "Progress tracking"], "phase": 2},
    {"week": "Monthly", "title": "Monthly Progress Review", "description": "Comprehensive review of progress against goals with plan adjustments.", "deliverables": ["Monthly progress report"], "phase": 2}
  ]',
  '{
    "cadence": "weekly",
    "channels": ["video_call", "email", "slack"],
    "meetings": [
      {"type": "Coaching Session", "frequency": "weekly", "duration_minutes": 60, "description": "Core coaching session focused on goals, challenges, and skill development."},
      {"type": "Monthly Progress Review", "frequency": "monthly", "duration_minutes": 45, "description": "Review progress, adjust goals, and plan for the next month."}
    ],
    "escalation_path": "Coach → Program Director",
    "ad_hoc": "Unlimited email/Slack support between sessions for quick questions."
  }',
  '[
    {"metric": "Goal Progress", "target": "Measurable progress on 80%+ of defined goals", "measurement_method": "Monthly goal tracking assessment", "timeframe": "Ongoing, reviewed monthly"},
    {"metric": "Client Satisfaction", "target": "Satisfaction score of 9+/10", "measurement_method": "Monthly pulse survey", "timeframe": "Ongoing"},
    {"metric": "Skill Development", "target": "Demonstrable improvement in targeted competencies", "measurement_method": "Self-assessment + coach assessment", "timeframe": "Quarterly review"}
  ]',
  '{
    "duration_months": 0,
    "coverage_description": "Support is included as part of the ongoing coaching engagement. No separate warranty applies.",
    "exclusions": [],
    "extended_support_available": false,
    "extended_support_description": ""
  }',
  '[
    {"artifact": "Coaching Session Notes", "format": "Google Docs", "description": "Summary notes from each coaching session with action items.", "delivery_method": "Shared workspace"},
    {"artifact": "Monthly Progress Reports", "format": "PDF", "description": "Monthly report tracking progress against defined goals.", "delivery_method": "Email delivery"},
    {"artifact": "Resource Library", "format": "Mixed", "description": "Curated resources, frameworks, and tools relevant to coaching goals.", "delivery_method": "Shared folder"}
  ]'
);

-- ============================================================================
-- 4. Service: Workshop (1-2 weeks prep + delivery + follow-up)
-- ============================================================================
INSERT INTO onboarding_plan_templates (
  name, content_type, service_type, offer_role, estimated_duration_weeks,
  setup_requirements, milestones_template, communication_plan,
  win_conditions, warranty, artifacts_handoff
) VALUES (
  'Workshop Delivery Onboarding',
  'service', 'workshop', 'core_offer', 3,
  '[
    {"title": "Venue / Platform Details", "description": "Confirm the workshop venue (in-person) or video platform (virtual) details.", "category": "logistics", "is_client_action": true},
    {"title": "Participant Registration", "description": "Complete participant registration and share attendee list.", "category": "documentation", "is_client_action": true},
    {"title": "Pre-Workshop Survey", "description": "Distribute pre-workshop survey to gauge participant expectations and skill levels.", "category": "assessment", "is_client_action": false},
    {"title": "Materials Preparation", "description": "We will prepare all workshop materials, handouts, and exercises.", "category": "setup", "is_client_action": false}
  ]',
  '[
    {"week": 1, "title": "Preparation & Customization", "description": "Finalize workshop content, customize exercises for the audience, and prepare all materials.", "deliverables": ["Customized workshop agenda", "Participant pre-read materials"], "phase": 1},
    {"week": 2, "title": "Workshop Delivery", "description": "Deliver the hands-on workshop with interactive exercises and real-world applications.", "deliverables": ["Completed workshop", "Participant outputs"], "phase": 2},
    {"week": 3, "title": "Follow-Up & Reinforcement", "description": "Post-workshop follow-up with additional resources and Q&A session.", "deliverables": ["Follow-up resources", "Workshop recording", "Q&A session"], "phase": 4}
  ]',
  '{
    "cadence": "as-needed",
    "channels": ["email", "video_call"],
    "meetings": [
      {"type": "Pre-Workshop Planning Call", "frequency": "once", "duration_minutes": 45, "description": "Align on workshop goals, logistics, and customization needs."},
      {"type": "Post-Workshop Debrief", "frequency": "once", "duration_minutes": 30, "description": "Review outcomes, gather feedback, and discuss follow-up actions."}
    ],
    "escalation_path": "Workshop Facilitator → Program Manager",
    "ad_hoc": "Email support for logistics and content questions."
  }',
  '[
    {"metric": "Participant Engagement", "target": "90%+ active participation rate", "measurement_method": "Facilitator observation and exercise completion", "timeframe": "During workshop"},
    {"metric": "Satisfaction Score", "target": "Average rating of 4.5+/5", "measurement_method": "Post-workshop evaluation survey", "timeframe": "Within 48 hours of completion"},
    {"metric": "Actionable Takeaways", "target": "Each participant identifies 3+ actionable items", "measurement_method": "Workshop exit survey", "timeframe": "At workshop completion"}
  ]',
  '{
    "duration_months": 3,
    "coverage_description": "3-month post-workshop support for questions about applying workshop concepts.",
    "exclusions": ["Additional workshop sessions", "Individual consulting"],
    "extended_support_available": true,
    "extended_support_description": "Follow-up coaching sessions available to reinforce workshop learning."
  }',
  '[
    {"artifact": "Workshop Materials", "format": "PDF + Slides", "description": "Complete workshop deck, exercises, and reference materials.", "delivery_method": "Shared folder"},
    {"artifact": "Workshop Recording", "format": "Video (MP4)", "description": "Full recording of the workshop session.", "delivery_method": "Shared video link"},
    {"artifact": "Participant Workbooks", "format": "PDF", "description": "Completed workbooks with exercises and notes.", "delivery_method": "Email to participants"},
    {"artifact": "Action Plan Template", "format": "Google Docs", "description": "Post-workshop action plan template for continued learning.", "delivery_method": "Email delivery"}
  ]'
);

-- ============================================================================
-- 5. Service: Speaking Engagement (2-3 weeks)
-- ============================================================================
INSERT INTO onboarding_plan_templates (
  name, content_type, service_type, offer_role, estimated_duration_weeks,
  setup_requirements, milestones_template, communication_plan,
  win_conditions, warranty, artifacts_handoff
) VALUES (
  'Speaking Engagement Onboarding',
  'service', 'speaking', 'core_offer', 3,
  '[
    {"title": "Event Details", "description": "Provide event date, time, venue, audience size, and format (keynote, panel, etc.).", "category": "logistics", "is_client_action": true},
    {"title": "Audience Profile", "description": "Share information about the expected audience (roles, industry, knowledge level).", "category": "documentation", "is_client_action": true},
    {"title": "A/V Requirements", "description": "Confirm audio-visual setup, presentation format, and any technical requirements.", "category": "logistics", "is_client_action": true},
    {"title": "Content Preparation", "description": "We will prepare the presentation deck and supporting materials.", "category": "setup", "is_client_action": false}
  ]',
  '[
    {"week": 1, "title": "Discovery & Content Planning", "description": "Align on topic focus, key messages, audience expectations, and desired outcomes.", "deliverables": ["Content brief", "Presentation outline"], "phase": 0},
    {"week": 2, "title": "Content Development & Review", "description": "Develop the full presentation with client review and feedback cycle.", "deliverables": ["Draft presentation", "Supporting materials"], "phase": 2},
    {"week": 3, "title": "Delivery & Follow-Up", "description": "Deliver the speaking engagement and provide follow-up materials.", "deliverables": ["Delivered presentation", "Follow-up resources for attendees"], "phase": 4}
  ]',
  '{
    "cadence": "as-needed",
    "channels": ["email", "video_call"],
    "meetings": [
      {"type": "Content Alignment Call", "frequency": "once", "duration_minutes": 45, "description": "Align on key messages, audience, and presentation structure."},
      {"type": "Presentation Review", "frequency": "once", "duration_minutes": 30, "description": "Review and finalize the presentation content."}
    ],
    "escalation_path": "Speaker → Event Coordinator",
    "ad_hoc": "Email for logistics coordination."
  }',
  '[
    {"metric": "Audience Engagement", "target": "Active Q&A participation and positive audience response", "measurement_method": "Audience interaction metrics", "timeframe": "During event"},
    {"metric": "Event Organizer Satisfaction", "target": "Positive feedback from event organizers", "measurement_method": "Post-event feedback", "timeframe": "Within 1 week of event"}
  ]',
  '{
    "duration_months": 0,
    "coverage_description": "Speaking engagements are one-time deliveries. No warranty period applies.",
    "exclusions": [],
    "extended_support_available": false,
    "extended_support_description": ""
  }',
  '[
    {"artifact": "Presentation Deck", "format": "PDF + PowerPoint", "description": "Final presentation slides.", "delivery_method": "Email delivery"},
    {"artifact": "Speaker Notes", "format": "PDF", "description": "Detailed speaker notes and talking points.", "delivery_method": "Email delivery"},
    {"artifact": "Attendee Resources", "format": "PDF", "description": "Follow-up resources and references for attendees.", "delivery_method": "Shared link for distribution"}
  ]'
);

-- ============================================================================
-- 6. Product: Default (simplified plan)
-- ============================================================================
INSERT INTO onboarding_plan_templates (
  name, content_type, service_type, offer_role, estimated_duration_weeks,
  setup_requirements, milestones_template, communication_plan,
  win_conditions, warranty, artifacts_handoff
) VALUES (
  'Product Delivery Onboarding',
  'product', NULL, NULL, 2,
  '[
    {"title": "Account Setup", "description": "Create your account to access purchased products and downloads.", "category": "access", "is_client_action": true},
    {"title": "Product Delivery", "description": "We will prepare and deliver all purchased products to your account.", "category": "setup", "is_client_action": false}
  ]',
  '[
    {"week": 1, "title": "Product Delivery", "description": "All purchased products are delivered and access is confirmed.", "deliverables": ["Product access", "Download links"], "phase": 1},
    {"week": 2, "title": "Follow-Up & Support", "description": "Check-in to ensure everything is working and address any questions.", "deliverables": ["Support confirmation"], "phase": 4}
  ]',
  '{
    "cadence": "as-needed",
    "channels": ["email"],
    "meetings": [],
    "escalation_path": "Support → Account Manager",
    "ad_hoc": "Email support for product-related questions."
  }',
  '[
    {"metric": "Product Access Confirmed", "target": "Client confirms access to all purchased items", "measurement_method": "Delivery confirmation email", "timeframe": "Within 48 hours of purchase"}
  ]',
  '{
    "duration_months": 3,
    "coverage_description": "3-month support period for product access issues and basic questions.",
    "exclusions": ["Product customization", "Additional training"],
    "extended_support_available": false,
    "extended_support_description": ""
  }',
  '[
    {"artifact": "Product Files", "format": "Digital download", "description": "All purchased digital products.", "delivery_method": "Download portal"},
    {"artifact": "Getting Started Guide", "format": "PDF", "description": "Quick start guide for using the product.", "delivery_method": "Email delivery"}
  ]'
);

-- ============================================================================
-- 7. Project: AI Chatbot Solution (Original PDF template - 12 weeks)
-- This mirrors the original ATAS Client Onboarding Plan PDF.
-- ============================================================================
INSERT INTO onboarding_plan_templates (
  name, content_type, service_type, offer_role, estimated_duration_weeks,
  setup_requirements, milestones_template, communication_plan,
  win_conditions, warranty, artifacts_handoff
) VALUES (
  'AI Chatbot Solution Onboarding',
  'project', NULL, 'core_offer', 12,
  '[
    {"title": "CRM & Sales Platform Access", "description": "Provide integration permissions to connect the AI chatbot with existing CRM software and sales platforms to enable data syncing and functionality.", "category": "access", "is_client_action": true},
    {"title": "Website & Communication Channel Integration", "description": "Provide access to the client''s website backend and other digital communication platforms (like social media) where the chatbot will be deployed.", "category": "access", "is_client_action": true},
    {"title": "Data Security Clearance", "description": "Ensure compliance and clearances are in place for handling and processing data, adhering to both our privacy policies and client''s regulatory requirements.", "category": "security", "is_client_action": true},
    {"title": "Brand Guidelines & Tone", "description": "Share brand guidelines, preferred tone of voice, and any existing chatbot scripts or FAQs.", "category": "documentation", "is_client_action": true},
    {"title": "Project Workspace Setup", "description": "We will set up the project workspace, development environment, and communication channels.", "category": "setup", "is_client_action": false}
  ]',
  '[
    {"week": 1, "title": "Kickoff & Requirements Gathering", "description": "Conduct a kickoff meeting to confirm project scope, gather detailed requirements, and set expectations.", "deliverables": ["Project charter", "Requirements document", "Timeline confirmation"], "phase": 0},
    {"week": "2-3", "title": "AI Chatbot Customization & Integration", "description": "Customize the chatbot''s responses, workflows, and user interaction interfaces based on the client''s specific needs and integrate with existing systems.", "deliverables": ["Customized chatbot configuration", "Integration documentation"], "phase": 2},
    {"week": 4, "title": "Internal Testing & Review", "description": "Perform rigorous internal testing to ensure the chatbot functions correctly across all required platforms.", "deliverables": ["Test results report", "Bug resolution log"], "phase": 3},
    {"week": 5, "title": "Client Training & Pilot Testing", "description": "Provide training sessions for client teams and initiate a pilot phase where the chatbot is live with limited user interaction.", "deliverables": ["Training sessions", "Pilot launch"], "phase": 3},
    {"week": 6, "title": "Evaluation & Adjustments", "description": "Analyze chatbot interactions, gather feedback from client team and adjust functionalities as necessary.", "deliverables": ["Evaluation report", "Adjustment log"], "phase": 3},
    {"week": 7, "title": "Official Launch", "description": "Full-scale deployment of the AI chatbot across all platforms.", "deliverables": ["Production deployment", "Launch confirmation"], "phase": 4},
    {"week": "8-12", "title": "Post-Launch Monitoring & Optimization", "description": "Regular monitoring and tweaking of the AI chatbot to optimize performance and user engagement.", "deliverables": ["Weekly performance reports", "Optimization updates"], "phase": 4}
  ]',
  '{
    "cadence": "weekly",
    "channels": ["slack", "email", "video_call"],
    "meetings": [
      {"type": "Weekly Status Call", "frequency": "weekly", "duration_minutes": 30, "description": "Discuss progress, address any issues, and ensure the project remains on track."},
      {"type": "Monthly Review Meeting", "frequency": "monthly", "duration_minutes": 60, "description": "Comprehensive review of performance data, feedback, and detailed strategic adjustments."},
      {"type": "Office Hours", "frequency": "weekly", "duration_minutes": 30, "description": "Regular office hours where the client can discuss ongoing concerns or ideas without formal scheduling."}
    ],
    "escalation_path": "Project Lead → Account Manager → Director",
    "ad_hoc": "Open lines for ad-hoc communication via email or dedicated Slack channel to address urgent needs promptly."
  }',
  '[
    {"metric": "Lead Qualification Rate", "target": "25% improvement in lead qualification rates", "measurement_method": "CRM analytics comparison (before vs after)", "timeframe": "First quarter post-deployment"},
    {"metric": "Lead Response Time", "target": "50% reduction in lead response time", "measurement_method": "Average response time metrics", "timeframe": "First quarter post-deployment"},
    {"metric": "Customer Interactions", "target": "30% increase in customer interactions", "measurement_method": "Chatbot engagement analytics", "timeframe": "First quarter post-deployment"},
    {"metric": "Client Satisfaction", "target": "High satisfaction ratings from the client regarding functionality and impact", "measurement_method": "Client satisfaction survey", "timeframe": "At project completion"},
    {"metric": "ROI Achievement", "target": "Demonstrable return on investment through cost savings or increased sales", "measurement_method": "Financial impact analysis", "timeframe": "First quarter post-deployment"}
  ]',
  '{
    "duration_months": 12,
    "coverage_description": "Standard 12-month warranty period during which any issues with the AI chatbot can be addressed free of charge.",
    "exclusions": ["Feature additions beyond original scope", "Third-party API changes", "Client-initiated modifications"],
    "extended_support_available": true,
    "extended_support_description": "Extended support and maintenance post-warranty available at a negotiated fee."
  }',
  '[
    {"artifact": "Comprehensive Project Documentation", "format": "PDF + Google Docs", "description": "Detailed documentation covering the AI chatbot''s design, integration points, functionality, and user guides.", "delivery_method": "Shared project folder"},
    {"artifact": "Performance Reports", "format": "PDF", "description": "Regular performance reports for the first three months post-launch.", "delivery_method": "Email delivery, monthly"},
    {"artifact": "Customized Training Materials", "format": "PDF + Video", "description": "Training materials tailored to the client''s specific configuration and use cases.", "delivery_method": "Shared project folder"},
    {"artifact": "Standard Operating Procedures", "format": "Google Docs", "description": "SOPs for chatbot monitoring, escalation handling, and routine maintenance.", "delivery_method": "Shared project folder"},
    {"artifact": "E2E Testing Documentation", "format": "PDF", "description": "Complete end-to-end testing documentation with test cases and results.", "delivery_method": "Shared project folder"}
  ]'
);
