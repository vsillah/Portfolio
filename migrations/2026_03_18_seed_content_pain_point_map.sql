-- ============================================================================
-- Migration: Seed content_pain_point_map
-- Date: 2026-03-18
-- Purpose: Map services, templates, and tools to pain point categories
--          so "Suggest from Evidence" pricing and value reports work.
-- ============================================================================

-- Helper: look up pain point category IDs by name
-- We use subselects so the migration is idempotent regardless of UUID values.

-- ============================================================================
-- Services → Pain Points
-- ============================================================================

-- AI Customer Support Chatbot → slow_response_times (85%), customer_churn (60%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 85, 'AI chatbot eliminates response delays'
FROM services s, pain_point_categories ppc
WHERE s.title = 'AI Customer Support Chatbot' AND ppc.name = 'slow_response_times'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 60, 'Proactive support reduces churn'
FROM services s, pain_point_categories ppc
WHERE s.title = 'AI Customer Support Chatbot' AND ppc.name = 'customer_churn'
ON CONFLICT DO NOTHING;

-- AI Inbound Lead Chatbot → poor_lead_qualification (80%), slow_response_times (70%), inconsistent_followup (65%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 80, 'AI qualifies leads automatically'
FROM services s, pain_point_categories ppc
WHERE s.title = 'AI Inbound Lead Chatbot' AND ppc.name = 'poor_lead_qualification'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 70, 'Instant lead response via chatbot'
FROM services s, pain_point_categories ppc
WHERE s.title = 'AI Inbound Lead Chatbot' AND ppc.name = 'slow_response_times'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 65, 'Automated follow-up sequences'
FROM services s, pain_point_categories ppc
WHERE s.title = 'AI Inbound Lead Chatbot' AND ppc.name = 'inconsistent_followup'
ON CONFLICT DO NOTHING;

-- AI Voice Agent — Inbound → slow_response_times (80%), poor_lead_qualification (70%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 80, 'Voice AI answers calls instantly'
FROM services s, pain_point_categories ppc
WHERE s.title = 'AI Voice Agent — Inbound' AND ppc.name = 'slow_response_times'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 70, 'Voice AI qualifies callers before routing'
FROM services s, pain_point_categories ppc
WHERE s.title = 'AI Voice Agent — Inbound' AND ppc.name = 'poor_lead_qualification'
ON CONFLICT DO NOTHING;

-- AI Email Sequence Builder → inconsistent_followup (85%), manual_processes (50%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 85, 'Automated email sequences ensure consistent follow-up'
FROM services s, pain_point_categories ppc
WHERE s.title = 'AI Email Sequence Builder' AND ppc.name = 'inconsistent_followup'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 50, 'Reduces manual email composition'
FROM services s, pain_point_categories ppc
WHERE s.title = 'AI Email Sequence Builder' AND ppc.name = 'manual_processes'
ON CONFLICT DO NOTHING;

-- Lead Generation Workflow Agent → poor_lead_qualification (85%), inconsistent_followup (75%), poor_lead_tracking (70%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 85, 'Automated lead gen with built-in qualification'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Lead Generation Workflow Agent' AND ppc.name = 'poor_lead_qualification'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 75, 'Workflow ensures no lead is missed'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Lead Generation Workflow Agent' AND ppc.name = 'inconsistent_followup'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 70, 'Centralized lead tracking in workflow'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Lead Generation Workflow Agent' AND ppc.name = 'poor_lead_tracking'
ON CONFLICT DO NOTHING;

-- Inbound Lead Tracking System → poor_lead_tracking (90%), poor_lead_qualification (60%), scattered_tools (55%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 90, 'Dedicated system for tracking all inbound leads'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Inbound Lead Tracking System' AND ppc.name = 'poor_lead_tracking'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 60, 'Tracking enables better qualification'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Inbound Lead Tracking System' AND ppc.name = 'poor_lead_qualification'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 55, 'Consolidates lead data into one system'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Inbound Lead Tracking System' AND ppc.name = 'scattered_tools'
ON CONFLICT DO NOTHING;

-- Custom Reporting & Analytics Dashboard → manual_reporting (90%), no_analytics (85%), scattered_tools (70%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 90, 'Automated dashboards replace manual report building'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Custom Reporting & Analytics Dashboard' AND ppc.name = 'manual_reporting'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 85, 'Provides analytics where none existed'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Custom Reporting & Analytics Dashboard' AND ppc.name = 'no_analytics'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 70, 'Unifies scattered data sources into one view'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Custom Reporting & Analytics Dashboard' AND ppc.name = 'scattered_tools'
ON CONFLICT DO NOTHING;

-- Client Onboarding Automation → employee_onboarding (85%), manual_processes (75%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 85, 'Streamlines client/employee onboarding'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Client Onboarding Automation' AND ppc.name = 'employee_onboarding'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 75, 'Replaces manual onboarding steps and data collection with automation'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Client Onboarding Automation' AND ppc.name = 'manual_processes'
ON CONFLICT DO NOTHING;

-- Data Migration & Onboarding → scattered_tools (80%), manual_processes (70%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 80, 'Consolidates tools and unifies scattered data during migration'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Data Migration & Onboarding' AND ppc.name = 'scattered_tools'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 70, 'Automates data entry during migration'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Data Migration & Onboarding' AND ppc.name = 'manual_processes'
ON CONFLICT DO NOTHING;

-- Custom API / ERP Integrations → scattered_tools (85%), manual_processes (70%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 85, 'Connects disconnected systems and eliminates data silos via API'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Custom API / ERP Integrations' AND ppc.name = 'scattered_tools'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 70, 'Automates data flow between systems'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Custom API / ERP Integrations' AND ppc.name = 'manual_processes'
ON CONFLICT DO NOTHING;

-- RAG Knowledge Base System → knowledge_loss (90%), employee_onboarding (60%), scattered_tools (55%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 90, 'Captures tribal knowledge in searchable AI system'
FROM services s, pain_point_categories ppc
WHERE s.title = 'RAG Knowledge Base System' AND ppc.name = 'knowledge_loss'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 60, 'New hires self-serve answers from knowledge base'
FROM services s, pain_point_categories ppc
WHERE s.title = 'RAG Knowledge Base System' AND ppc.name = 'employee_onboarding'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 55, 'Centralizes scattered institutional knowledge'
FROM services s, pain_point_categories ppc
WHERE s.title = 'RAG Knowledge Base System' AND ppc.name = 'scattered_tools'
ON CONFLICT DO NOTHING;

-- Social Media Content Agent → manual_processes (70%), scaling_bottlenecks (60%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 70, 'Automates content creation and social posting that were manual'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Social Media Content Agent' AND ppc.name = 'manual_processes'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 60, 'Removes content production as scaling bottleneck'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Social Media Content Agent' AND ppc.name = 'scaling_bottlenecks'
ON CONFLICT DO NOTHING;

-- Management Consulting → scaling_bottlenecks (80%), knowledge_loss (50%), missed_deadlines (55%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 80, 'Strategic consulting identifies and removes growth blockers'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Management Consulting' AND ppc.name = 'scaling_bottlenecks'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 50, 'Consulting documents processes and reduces knowledge gaps'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Management Consulting' AND ppc.name = 'knowledge_loss'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 55, 'Project management consulting reduces missed deadlines'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Management Consulting' AND ppc.name = 'missed_deadlines'
ON CONFLICT DO NOTHING;

-- Website Development → inconsistent_branding (75%), scaling_bottlenecks (50%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 75, 'Professional website establishes consistent brand'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Website Development' AND ppc.name = 'inconsistent_branding'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 50, 'Modern website removes growth bottleneck'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Website Development' AND ppc.name = 'scaling_bottlenecks'
ON CONFLICT DO NOTHING;

-- Website UX Refresh → inconsistent_branding (70%), customer_churn (45%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 70, 'UX refresh aligns brand experience'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Website UX Refresh' AND ppc.name = 'inconsistent_branding'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 45, 'Better UX reduces bounce and churn'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Website UX Refresh' AND ppc.name = 'customer_churn'
ON CONFLICT DO NOTHING;

-- Mobile App Generation → scaling_bottlenecks (65%), no_automation (55%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 65, 'Mobile app extends reach beyond desktop'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Mobile App Generation' AND ppc.name = 'scaling_bottlenecks'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 55, 'App automates client interactions'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Mobile App Generation' AND ppc.name = 'manual_processes'
ON CONFLICT DO NOTHING;

-- AI Strategy Workshop (Full-Day, Half-Day, Recorded) → scaling_bottlenecks (60%), no_automation (65%), knowledge_loss (50%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 60, 'Workshop identifies AI-solvable scaling bottlenecks'
FROM services s, pain_point_categories ppc
WHERE s.title LIKE 'AI Strategy Workshop%' AND ppc.name = 'scaling_bottlenecks'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 65, 'Workshop maps automation opportunities'
FROM services s, pain_point_categories ppc
WHERE s.title LIKE 'AI Strategy Workshop%' AND ppc.name = 'manual_processes'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 50, 'Workshop documents processes to reduce knowledge gaps'
FROM services s, pain_point_categories ppc
WHERE s.title LIKE 'AI Strategy Workshop%' AND ppc.name = 'knowledge_loss'
ON CONFLICT DO NOTHING;

-- AI Training (courses, library, masterclass, team program, group program) → knowledge_loss (70%), employee_onboarding (55%), no_automation (50%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 70, 'Training builds AI competency and reduces knowledge gaps'
FROM services s, pain_point_categories ppc
WHERE s.service_type = 'training' AND ppc.name = 'knowledge_loss'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 55, 'Training accelerates onboarding for AI tools'
FROM services s, pain_point_categories ppc
WHERE s.service_type = 'training' AND ppc.name = 'employee_onboarding'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 50, 'Training enables team to implement automation'
FROM services s, pain_point_categories ppc
WHERE s.service_type = 'training' AND ppc.name = 'manual_processes'
ON CONFLICT DO NOTHING;

-- 1-on-1 AI Coaching → scaling_bottlenecks (65%), knowledge_loss (60%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 65, 'Personalized coaching addresses specific growth blockers'
FROM services s, pain_point_categories ppc
WHERE s.title = '1-on-1 AI Coaching' AND ppc.name = 'scaling_bottlenecks'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 60, 'Coaching transfers AI knowledge to the individual'
FROM services s, pain_point_categories ppc
WHERE s.title = '1-on-1 AI Coaching' AND ppc.name = 'knowledge_loss'
ON CONFLICT DO NOTHING;

-- Group AI Coaching → scaling_bottlenecks (55%), knowledge_loss (55%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 55, 'Group coaching addresses team-level growth blockers'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Group AI Coaching' AND ppc.name = 'scaling_bottlenecks'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 55, 'Group coaching builds shared AI knowledge'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Group AI Coaching' AND ppc.name = 'knowledge_loss'
ON CONFLICT DO NOTHING;

-- Monthly Advisory Retainer → scaling_bottlenecks (70%), missed_deadlines (60%), no_automation (55%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 70, 'Ongoing advisory identifies and removes bottlenecks'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Monthly Advisory Retainer' AND ppc.name = 'scaling_bottlenecks'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 60, 'Regular check-ins prevent missed deadlines'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Monthly Advisory Retainer' AND ppc.name = 'missed_deadlines'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 55, 'Advisory identifies automation opportunities'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Monthly Advisory Retainer' AND ppc.name = 'manual_processes'
ON CONFLICT DO NOTHING;

-- Shared Analytics Dashboard → no_analytics (80%), manual_reporting (70%), scattered_tools (60%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 80, 'Provides analytics visibility to the team'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Shared Analytics Dashboard' AND ppc.name = 'no_analytics'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 70, 'Automated shared dashboard replaces manual reports'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Shared Analytics Dashboard' AND ppc.name = 'manual_reporting'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 60, 'Dashboard unifies scattered data sources'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Shared Analytics Dashboard' AND ppc.name = 'scattered_tools'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Products (Templates & Tools) → Pain Points
-- ============================================================================

-- Chatbot Template → slow_response_times (60%), poor_lead_qualification (50%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'product', p.id::text, ppc.id, 60, 'Pre-built chatbot template for faster response'
FROM products p, pain_point_categories ppc
WHERE p.title = 'Chatbot Template' AND ppc.name = 'slow_response_times'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'product', p.id::text, ppc.id, 50, 'Template includes lead qualification flows'
FROM products p, pain_point_categories ppc
WHERE p.title = 'Chatbot Template' AND ppc.name = 'poor_lead_qualification'
ON CONFLICT DO NOTHING;

-- Lead Generation Template → poor_lead_qualification (65%), inconsistent_followup (60%), poor_lead_tracking (55%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'product', p.id::text, ppc.id, 65, 'Template with built-in lead scoring'
FROM products p, pain_point_categories ppc
WHERE p.title = 'Lead Generation Template' AND ppc.name = 'poor_lead_qualification'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'product', p.id::text, ppc.id, 60, 'Template includes follow-up sequences'
FROM products p, pain_point_categories ppc
WHERE p.title = 'Lead Generation Template' AND ppc.name = 'inconsistent_followup'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'product', p.id::text, ppc.id, 55, 'Template provides lead tracking structure'
FROM products p, pain_point_categories ppc
WHERE p.title = 'Lead Generation Template' AND ppc.name = 'poor_lead_tracking'
ON CONFLICT DO NOTHING;

-- Diagnostic Template → no_analytics (55%), knowledge_loss (45%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'product', p.id::text, ppc.id, 55, 'Diagnostic template provides structured analysis'
FROM products p, pain_point_categories ppc
WHERE p.title = 'Diagnostic Template' AND ppc.name = 'no_analytics'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'product', p.id::text, ppc.id, 45, 'Diagnostic captures institutional knowledge'
FROM products p, pain_point_categories ppc
WHERE p.title = 'Diagnostic Template' AND ppc.name = 'knowledge_loss'
ON CONFLICT DO NOTHING;

-- n8n Warm Lead Pack → poor_lead_qualification (70%), inconsistent_followup (65%), manual_processes (60%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'product', p.id::text, ppc.id, 70, 'Warm lead workflows with qualification logic'
FROM products p, pain_point_categories ppc
WHERE p.title = 'n8n Warm Lead Pack' AND ppc.name = 'poor_lead_qualification'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'product', p.id::text, ppc.id, 65, 'Automated follow-up in warm lead workflows'
FROM products p, pain_point_categories ppc
WHERE p.title = 'n8n Warm Lead Pack' AND ppc.name = 'inconsistent_followup'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'product', p.id::text, ppc.id, 60, 'Pre-built automation workflows'
FROM products p, pain_point_categories ppc
WHERE p.title = 'n8n Warm Lead Pack' AND ppc.name = 'manual_processes'
ON CONFLICT DO NOTHING;

-- AI Audit Calculator → no_analytics (65%), scaling_bottlenecks (50%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'product', p.id::text, ppc.id, 65, 'Calculator provides AI readiness analytics'
FROM products p, pain_point_categories ppc
WHERE p.title = 'AI Audit Calculator' AND ppc.name = 'no_analytics'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'product', p.id::text, ppc.id, 50, 'Audit identifies scaling bottlenecks'
FROM products p, pain_point_categories ppc
WHERE p.title = 'AI Audit Calculator' AND ppc.name = 'scaling_bottlenecks'
ON CONFLICT DO NOTHING;

-- Content Automation Templates → manual_processes (65%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 65, 'Pre-built automation templates reduce manual content creation'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Content Automation Templates' AND ppc.name = 'manual_processes'
ON CONFLICT DO NOTHING;

-- Lead Tracking Templates → poor_lead_tracking (65%), inconsistent_followup (50%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 65, 'Templates for structured lead tracking'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Lead Tracking Templates' AND ppc.name = 'poor_lead_tracking'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 50, 'Templates include follow-up reminders'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Lead Tracking Templates' AND ppc.name = 'inconsistent_followup'
ON CONFLICT DO NOTHING;

-- AI Email Sequence Templates → inconsistent_followup (70%), manual_processes (45%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 70, 'Pre-built email sequences for consistent follow-up'
FROM services s, pain_point_categories ppc
WHERE s.title = 'AI Email Sequence Templates' AND ppc.name = 'inconsistent_followup'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 45, 'Templates reduce manual email writing'
FROM services s, pain_point_categories ppc
WHERE s.title = 'AI Email Sequence Templates' AND ppc.name = 'manual_processes'
ON CONFLICT DO NOTHING;

-- Pre-Built Chatbot Template — Self-Install → slow_response_times (55%), manual_processes (50%)
INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 55, 'Self-install chatbot for faster responses'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Pre-Built Chatbot Template — Self-Install' AND ppc.name = 'slow_response_times'
ON CONFLICT DO NOTHING;

INSERT INTO content_pain_point_map (content_type, content_id, pain_point_category_id, impact_percentage, notes)
SELECT 'service', s.id::text, ppc.id, 50, 'Pre-built automation template'
FROM services s, pain_point_categories ppc
WHERE s.title = 'Pre-Built Chatbot Template — Self-Install' AND ppc.name = 'manual_processes'
ON CONFLICT DO NOTHING;
