#!/usr/bin/env npx tsx
/**
 * Seed Script: Pricing Model Shell Records
 *
 * Inserts shell records for products, services, bundles, guarantee templates,
 * continuity plans, and content offer roles via Supabase admin client.
 *
 * Idempotent: checks for existing records by title before inserting.
 *
 * Usage:
 *   npx tsx scripts/seed-pricing-model.ts
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================================================
// Product Definitions
// ============================================================================

const PRODUCTS = [
  {
    title: 'AI Audit Calculator',
    type: 'calculator',
    price: null, // FREE
    description: 'Comprehensive AI readiness assessment tool. Identify where AI can save you time and money.',
    is_active: true,
    is_featured: true,
    display_order: 1,
  },
  {
    title: 'AI Implementation Playbook',
    type: 'ebook',
    price: 29.00,
    description: 'Step-by-step guide to implementing AI in your business. Covers strategy, tool selection, and deployment.',
    is_active: true,
    is_featured: false,
    display_order: 2,
  },
  {
    title: 'Business Automation Toolkit',
    type: 'ebook',
    price: 49.00,
    description: 'Premium guide with templates, checklists, and frameworks for automating your business processes.',
    is_active: true,
    is_featured: false,
    display_order: 3,
  },
  {
    title: 'Automation ROI Templates Pack',
    type: 'ebook',
    price: 19.00,
    description: 'Ready-to-use spreadsheets and templates for calculating the ROI of any automation project.',
    is_active: true,
    is_featured: false,
    display_order: 4,
  },
  {
    title: 'AI Training Course — Self-Paced',
    type: 'training',
    price: 297.00,
    description: 'Comprehensive self-paced course covering AI fundamentals, prompt engineering, and practical business applications.',
    is_active: true,
    is_featured: true,
    display_order: 5,
  },
  {
    title: 'Premium AI Masterclass',
    type: 'training',
    price: 497.00,
    description: 'Advanced masterclass on building and deploying AI solutions. Includes hands-on projects and certification.',
    is_active: true,
    is_featured: true,
    display_order: 6,
  },
];

// ============================================================================
// Service Definitions
// ============================================================================

const SERVICES = [
  // --- AI Automation Build Services ---
  {
    title: 'AI Customer Support Chatbot',
    service_type: 'consulting',
    price: 3500.00,
    is_quote_based: false,
    delivery_method: 'hybrid',
    description: 'Custom AI-powered chatbot for 24/7 customer support. Handles FAQs, ticket routing, and escalation. Deployed and running in your business.',
    duration_hours: 40,
    duration_description: '2-4 weeks delivery',
    display_order: 1,
    is_featured: true,
    topics: ['Chatbot Design', 'NLP Configuration', 'CRM Integration', 'Training & Handoff'],
    deliverables: ['Deployed chatbot', 'Admin dashboard', 'Training documentation', '30-day support'],
  },
  {
    title: 'AI Inbound Lead Chatbot',
    service_type: 'consulting',
    price: 3500.00,
    is_quote_based: false,
    delivery_method: 'hybrid',
    description: 'AI chatbot that qualifies inbound leads, captures contact info, and routes to your sales team. Never miss a lead again.',
    duration_hours: 40,
    duration_description: '2-4 weeks delivery',
    display_order: 2,
    is_featured: true,
    topics: ['Lead Qualification', 'Conversation Design', 'CRM Integration', 'Analytics'],
    deliverables: ['Deployed lead chatbot', 'Lead scoring rules', 'CRM integration', 'Performance dashboard'],
  },
  {
    title: 'AI Voice Agent — Inbound',
    service_type: 'consulting',
    price: 5000.00,
    is_quote_based: false,
    delivery_method: 'virtual',
    description: 'AI-powered voice agent that handles inbound phone calls. Greets callers, answers questions, routes calls, and captures information automatically.',
    duration_hours: 60,
    duration_description: '3-5 weeks delivery',
    display_order: 3,
    is_featured: true,
    topics: ['Voice AI Configuration', 'Call Flow Design', 'Phone System Integration', 'Fallback Routing'],
    deliverables: ['Deployed voice agent', 'Call flow documentation', 'Phone integration', 'Call analytics dashboard'],
  },
  {
    title: 'Lead Generation Workflow Agent',
    service_type: 'consulting',
    price: 5000.00,
    is_quote_based: false,
    delivery_method: 'virtual',
    description: 'Automated lead generation pipeline that scrapes, qualifies, and delivers leads to your CRM. Your pipeline fills itself.',
    duration_hours: 60,
    duration_description: '3-5 weeks delivery',
    display_order: 4,
    is_featured: true,
    topics: ['Lead Sources', 'Scraping Automation', 'Qualification Rules', 'CRM Pipeline Setup'],
    deliverables: ['Automated lead pipeline', 'Source configurations', 'Qualification rules', 'Weekly lead reports'],
  },
  {
    title: 'Social Media Content Agent',
    service_type: 'consulting',
    price: 4000.00,
    is_quote_based: false,
    delivery_method: 'virtual',
    description: 'AI agent that generates, schedules, and posts content across your social media channels. Save 20+ hours per week on content creation.',
    duration_hours: 50,
    duration_description: '2-4 weeks delivery',
    display_order: 5,
    is_featured: false,
    topics: ['Content Strategy', 'AI Content Generation', 'Multi-Platform Scheduling', 'Analytics'],
    deliverables: ['Content generation agent', 'Scheduling automation', 'Brand voice configuration', 'Performance tracking'],
  },
  {
    title: 'Client Onboarding Automation',
    service_type: 'consulting',
    price: 3500.00,
    is_quote_based: false,
    delivery_method: 'hybrid',
    description: 'Automated client onboarding system. Welcome emails, document collection, task assignments, and progress tracking — all automated.',
    duration_hours: 40,
    duration_description: '2-4 weeks delivery',
    display_order: 6,
    is_featured: false,
    topics: ['Onboarding Flow Design', 'Email Automation', 'Document Collection', 'Task Management'],
    deliverables: ['Onboarding workflow', 'Email sequences', 'Client portal setup', 'Progress dashboard'],
  },
  {
    title: 'Inbound Lead Tracking System',
    service_type: 'consulting',
    price: 3000.00,
    is_quote_based: false,
    delivery_method: 'virtual',
    description: 'Comprehensive lead tracking system that captures leads from all channels, scores them, and ensures no opportunity falls through the cracks.',
    duration_hours: 35,
    duration_description: '2-3 weeks delivery',
    display_order: 7,
    is_featured: false,
    topics: ['Multi-Channel Capture', 'Lead Scoring', 'Pipeline Tracking', 'Notification System'],
    deliverables: ['Lead tracking system', 'Scoring model', 'Notification rules', 'Reporting dashboard'],
  },
  {
    title: 'Mobile App Generation',
    service_type: 'consulting',
    price: 7500.00,
    is_quote_based: false,
    delivery_method: 'hybrid',
    description: 'Custom mobile application built with AI-assisted development. Cross-platform (iOS and Android) with your branding.',
    duration_hours: 120,
    duration_description: '6-10 weeks delivery',
    display_order: 8,
    is_featured: true,
    topics: ['App Design', 'Cross-Platform Development', 'Backend Integration', 'App Store Submission'],
    deliverables: ['Mobile app (iOS + Android)', 'Backend API', 'Admin panel', 'App store listing'],
  },
  {
    title: 'Website Development',
    service_type: 'consulting',
    price: 5000.00,
    is_quote_based: false,
    delivery_method: 'hybrid',
    description: 'Modern, conversion-optimized website built with the latest technology. SEO-ready, mobile-responsive, and fast.',
    duration_hours: 80,
    duration_description: '4-6 weeks delivery',
    display_order: 9,
    is_featured: false,
    topics: ['UI/UX Design', 'Frontend Development', 'SEO Optimization', 'Analytics Setup'],
    deliverables: ['Live website', 'Content management system', 'SEO configuration', 'Analytics dashboard'],
  },
  {
    title: 'AI Email Sequence Builder',
    service_type: 'consulting',
    price: 2500.00,
    is_quote_based: false,
    delivery_method: 'virtual',
    description: 'AI-powered email nurture sequences that convert. Automated drip campaigns, follow-ups, and re-engagement flows.',
    duration_hours: 30,
    duration_description: '2-3 weeks delivery',
    display_order: 10,
    is_featured: false,
    topics: ['Email Strategy', 'Sequence Design', 'AI Copy Generation', 'A/B Testing'],
    deliverables: ['Email sequences', 'AI copy templates', 'Automation rules', 'Performance tracking'],
  },
  {
    title: 'RAG Knowledge Base System',
    service_type: 'consulting',
    price: 5000.00,
    is_quote_based: false,
    delivery_method: 'virtual',
    description: 'AI-powered internal knowledge management system. Your team asks questions in natural language and gets instant, accurate answers from your documents.',
    duration_hours: 60,
    duration_description: '3-5 weeks delivery',
    display_order: 11,
    is_featured: false,
    topics: ['Document Ingestion', 'RAG Architecture', 'Search & Retrieval', 'Access Control'],
    deliverables: ['Knowledge base system', 'Document pipeline', 'Search interface', 'Admin controls'],
  },
  // --- Advisory & Training Services ---
  {
    title: 'AI Strategy Workshop — Half-Day',
    service_type: 'workshop',
    price: 1500.00,
    is_quote_based: false,
    delivery_method: 'virtual',
    description: 'Intensive half-day workshop to identify your top AI opportunities. Walk away with a prioritized roadmap.',
    duration_hours: 4,
    duration_description: 'Half-day (4 hours)',
    display_order: 12,
    is_featured: false,
    min_participants: 1,
    max_participants: 20,
    topics: ['AI Opportunity Assessment', 'ROI Prioritization', 'Implementation Roadmap', 'Q&A'],
    deliverables: ['AI opportunity report', 'Prioritized roadmap', 'ROI estimates', 'Recording'],
  },
  {
    title: 'AI Strategy Workshop — Full-Day',
    service_type: 'workshop',
    price: 3500.00,
    is_quote_based: false,
    delivery_method: 'in_person',
    description: 'Comprehensive full-day workshop with deep-dive analysis, hands-on exercises, and detailed implementation planning.',
    duration_hours: 8,
    duration_description: 'Full day (8 hours)',
    display_order: 13,
    is_featured: false,
    min_participants: 1,
    max_participants: 30,
    topics: ['Deep-Dive Assessment', 'Hands-On Exercises', 'Architecture Planning', 'Team Alignment'],
    deliverables: ['Detailed AI strategy', 'Implementation plan', 'Architecture diagrams', 'Exercise materials'],
  },
  {
    title: 'Speaking Engagement',
    service_type: 'speaking',
    price: 3500.00,
    is_quote_based: false,
    delivery_method: 'in_person',
    description: 'Engaging keynote or breakout session on AI, automation, and digital transformation for your event or conference.',
    duration_hours: 2,
    duration_description: '1-2 hours',
    display_order: 14,
    is_featured: false,
    topics: ['AI in Business', 'Automation Strategy', 'Digital Transformation', 'Custom Topics'],
    deliverables: ['Keynote presentation', 'Audience Q&A', 'Follow-up resources'],
  },
  {
    title: 'Monthly Advisory Retainer',
    service_type: 'consulting',
    price: 2500.00,
    is_quote_based: true,
    delivery_method: 'virtual',
    description: 'Ongoing strategic AI advisory. Monthly 1-on-1 calls, priority support, and quarterly strategy reviews.',
    duration_hours: 4,
    duration_description: '4 hours/month',
    display_order: 15,
    is_featured: false,
    topics: ['Strategic Advisory', 'Implementation Review', 'Optimization', 'New Opportunities'],
    deliverables: ['Monthly strategy call', 'Priority support', 'Quarterly review', 'Action items'],
  },
  {
    title: '1-on-1 AI Coaching',
    service_type: 'coaching',
    price: 750.00,
    is_quote_based: false,
    delivery_method: 'virtual',
    description: 'Personalized 1-on-1 coaching to help you implement AI in your business. Weekly calls with actionable homework.',
    duration_hours: 4,
    duration_description: '4 sessions/month (1 hr each)',
    display_order: 16,
    is_featured: false,
    topics: ['Personalized AI Strategy', 'Implementation Support', 'Tool Selection', 'Accountability'],
    deliverables: ['Weekly coaching calls', 'Action plans', 'Resource recommendations', 'Progress tracking'],
  },
  {
    title: 'Group AI Coaching',
    service_type: 'coaching',
    price: 297.00,
    is_quote_based: false,
    delivery_method: 'virtual',
    description: 'Learn alongside peers in a small group setting. Monthly group calls with Q&A and community access.',
    duration_hours: 2,
    duration_description: '2 sessions/month (1 hr each)',
    display_order: 17,
    is_featured: false,
    min_participants: 5,
    max_participants: 20,
    topics: ['Group Learning', 'Peer Networking', 'Live Q&A', 'Resource Sharing'],
    deliverables: ['Group coaching calls', 'Community access', 'Resource library', 'Recordings'],
  },
  {
    title: 'Team AI Training — 3-Session Program',
    service_type: 'training',
    price: 2500.00,
    is_quote_based: false,
    delivery_method: 'hybrid',
    description: 'Get your whole team up to speed on AI tools and best practices. Three sessions covering fundamentals, hands-on practice, and advanced techniques.',
    duration_hours: 12,
    duration_description: '3 sessions (4 hours each)',
    display_order: 18,
    is_featured: false,
    min_participants: 5,
    max_participants: 50,
    topics: ['AI Fundamentals', 'Hands-On Practice', 'Advanced Techniques', 'Tool-Specific Training'],
    deliverables: ['Training materials', 'Exercise workbooks', 'Certificates', 'Recording access'],
  },
  {
    title: 'Implementation Warranty',
    service_type: 'warranty',
    price: 0,
    is_quote_based: false,
    delivery_method: 'virtual',
    description: 'Included with all build services. Covers bug fixes, minor adjustments, and support for deployed AI tools.',
    duration_hours: null,
    duration_description: '30-90 days (varies by tier)',
    display_order: 19,
    is_featured: false,
    topics: ['Bug Fixes', 'Minor Adjustments', 'Technical Support', 'Performance Monitoring'],
    deliverables: ['Bug fix coverage', 'Email support', 'Performance monitoring', 'Adjustment credits'],
  },
];

// ============================================================================
// Guarantee Template Definitions
// ============================================================================

const GUARANTEE_TEMPLATES = [
  {
    name: 'Quick Win Guarantee',
    description: 'Identify 3+ actionable AI opportunities or get a full refund. No questions asked.',
    guarantee_type: 'unconditional',
    duration_days: 30,
    default_payout_type: 'refund',
    payout_amount_type: 'full',
    conditions: [
      { description: 'Complete the AI Strategy Workshop', verification_method: 'admin' },
      { description: 'Receive AI opportunity report', verification_method: 'admin' },
    ],
  },
  {
    name: 'Accelerator Guarantee',
    description: 'Save 10+ hours per week within 90 days or we continue coaching you for free until you do.',
    guarantee_type: 'conditional',
    duration_days: 90,
    default_payout_type: 'rollover_upsell',
    payout_amount_type: 'full',
    conditions: [
      { description: 'AI tools deployed and operational', verification_method: 'admin' },
      { description: 'Team trained on tool usage', verification_method: 'admin' },
      { description: 'Time savings tracked for 30+ days', verification_method: 'client_report' },
    ],
  },
  {
    name: 'Growth Engine Guarantee',
    description: '3x ROI in year 1 or we continue supporting you at no additional cost.',
    guarantee_type: 'conditional',
    duration_days: 365,
    default_payout_type: 'rollover_continuity',
    payout_amount_type: 'full',
    conditions: [
      { description: 'All contracted tools deployed', verification_method: 'admin' },
      { description: 'Team fully trained and using tools', verification_method: 'admin' },
      { description: 'ROI tracking established and reported quarterly', verification_method: 'client_report' },
    ],
  },
  {
    name: 'Transformation Guarantee',
    description: 'Measurable efficiency gains within 90 days AND 5x ROI within 18 months, or continued support at no cost.',
    guarantee_type: 'conditional',
    duration_days: 540,
    default_payout_type: 'rollover_continuity',
    payout_amount_type: 'full',
    conditions: [
      { description: 'All contracted systems deployed and operational', verification_method: 'admin' },
      { description: 'Efficiency gains measured at 90-day checkpoint', verification_method: 'admin' },
      { description: 'ROI tracking established and reported quarterly', verification_method: 'client_report' },
      { description: 'Team adoption rate above 80%', verification_method: 'client_report' },
    ],
  },
];

// ============================================================================
// Continuity Plan Definitions
// ============================================================================

const CONTINUITY_PLANS = [
  {
    name: 'AI Growth Partner',
    description: 'Stay connected and keep growing with ongoing group support, resource access, and basic tool maintenance.',
    billing_interval: 'month',
    amount_per_interval: 497.00,
    features: [
      'Monthly group coaching call',
      'Resource library access',
      'Community membership',
      'Basic maintenance for deployed tools',
      'Email support',
    ],
  },
  {
    name: 'AI Advisory Retainer',
    description: 'Dedicated strategic partnership with full tool maintenance and priority support.',
    billing_interval: 'month',
    amount_per_interval: 2500.00,
    features: [
      'Monthly 1-on-1 advisory call',
      'Priority support (24hr response)',
      'Quarterly strategy review',
      'Full maintenance & optimization of all tools',
      'Dedicated Slack/Teams channel',
      'New feature requests (2/month)',
    ],
  },
  {
    name: 'White-Label License',
    description: 'License Amadutown-built tools under your own brand. Setup fee applies.',
    billing_interval: 'month',
    amount_per_interval: 5000.00,
    features: [
      'All tools branded under your company',
      'Custom domain and branding',
      'Client-facing dashboard',
      'Ongoing updates and maintenance',
      'Priority engineering support',
      'Setup fee applies (custom quote)',
    ],
  },
];

// ============================================================================
// Bundle Definitions (references product/service IDs after creation)
// ============================================================================

interface BundleItemRef {
  serviceTitle?: string;
  productTitle?: string;
  role: string;
  perceivedValue: number;
}

interface BundleDef {
  name: string;
  description: string;
  bundlePrice: number;
  totalRetailValue: number;
  totalPerceivedValue: number;
  targetFunnelStages: string[];
  items: BundleItemRef[];
}

const BUNDLES: BundleDef[] = [
  {
    name: 'AI Quick Win',
    description: 'Discover where AI fits in your business. Strategy workshop, audit tools, and expert guidance.',
    bundlePrice: 997,
    totalRetailValue: 5350,
    totalPerceivedValue: 5350,
    targetFunnelStages: ['prospect', 'interested'],
    items: [
      { productTitle: 'AI Audit Calculator', role: 'lead_magnet', perceivedValue: 500 },
      { productTitle: 'AI Implementation Playbook', role: 'bonus', perceivedValue: 200 },
      { productTitle: 'Automation ROI Templates Pack', role: 'bonus', perceivedValue: 150 },
      { serviceTitle: 'AI Strategy Workshop — Half-Day', role: 'core_offer', perceivedValue: 3500 },
    ],
  },
  {
    name: 'AI Accelerator',
    description: 'Deploy your first AI tools. Chatbot, lead tracking, coaching, and training — all included.',
    bundlePrice: 7497,
    totalRetailValue: 39850,
    totalPerceivedValue: 39850,
    targetFunnelStages: ['interested', 'informed'],
    items: [
      { productTitle: 'AI Audit Calculator', role: 'lead_magnet', perceivedValue: 500 },
      { productTitle: 'AI Implementation Playbook', role: 'bonus', perceivedValue: 200 },
      { productTitle: 'Automation ROI Templates Pack', role: 'bonus', perceivedValue: 150 },
      { serviceTitle: 'AI Strategy Workshop — Half-Day', role: 'core_offer', perceivedValue: 3500 },
      { serviceTitle: 'AI Customer Support Chatbot', role: 'core_offer', perceivedValue: 15000 },
      { serviceTitle: 'Inbound Lead Tracking System', role: 'core_offer', perceivedValue: 12000 },
      { serviceTitle: 'Team AI Training — 3-Session Program', role: 'bonus', perceivedValue: 2500 },
      { serviceTitle: '1-on-1 AI Coaching', role: 'bonus', perceivedValue: 3000 },
      { serviceTitle: 'Implementation Warranty', role: 'bonus', perceivedValue: 2000 },
    ],
  },
  {
    name: 'Growth Engine',
    description: 'AI across lead gen, sales, and operations. Complete pipeline automation with ongoing advisory.',
    bundlePrice: 14997,
    totalRetailValue: 127850,
    totalPerceivedValue: 127850,
    targetFunnelStages: ['informed', 'converted'],
    items: [
      { productTitle: 'AI Audit Calculator', role: 'lead_magnet', perceivedValue: 500 },
      { productTitle: 'AI Implementation Playbook', role: 'bonus', perceivedValue: 200 },
      { productTitle: 'Automation ROI Templates Pack', role: 'bonus', perceivedValue: 150 },
      { serviceTitle: 'AI Strategy Workshop — Half-Day', role: 'core_offer', perceivedValue: 3500 },
      { serviceTitle: 'AI Customer Support Chatbot', role: 'core_offer', perceivedValue: 15000 },
      { serviceTitle: 'Inbound Lead Tracking System', role: 'core_offer', perceivedValue: 12000 },
      { serviceTitle: 'Lead Generation Workflow Agent', role: 'core_offer', perceivedValue: 25000 },
      { serviceTitle: 'Social Media Content Agent', role: 'core_offer', perceivedValue: 18000 },
      { serviceTitle: 'Client Onboarding Automation', role: 'bonus', perceivedValue: 15000 },
      { serviceTitle: 'AI Email Sequence Builder', role: 'bonus', perceivedValue: 10000 },
      { serviceTitle: 'Team AI Training — 3-Session Program', role: 'bonus', perceivedValue: 2500 },
      { serviceTitle: 'Monthly Advisory Retainer', role: 'bonus', perceivedValue: 7500 },
      { serviceTitle: 'Implementation Warranty', role: 'bonus', perceivedValue: 3000 },
    ],
  },
  {
    name: 'Digital Transformation',
    description: 'Comprehensive AI across your entire business. Voice, mobile, web, knowledge base, and dedicated support.',
    bundlePrice: 29997,
    totalRetailValue: 254350,
    totalPerceivedValue: 254350,
    targetFunnelStages: ['informed', 'converted', 'active'],
    items: [
      { productTitle: 'AI Audit Calculator', role: 'lead_magnet', perceivedValue: 500 },
      { productTitle: 'AI Implementation Playbook', role: 'bonus', perceivedValue: 200 },
      { productTitle: 'Automation ROI Templates Pack', role: 'bonus', perceivedValue: 150 },
      { serviceTitle: 'AI Strategy Workshop — Full-Day', role: 'core_offer', perceivedValue: 7500 },
      { serviceTitle: 'AI Customer Support Chatbot', role: 'core_offer', perceivedValue: 15000 },
      { serviceTitle: 'Inbound Lead Tracking System', role: 'core_offer', perceivedValue: 12000 },
      { serviceTitle: 'Lead Generation Workflow Agent', role: 'core_offer', perceivedValue: 25000 },
      { serviceTitle: 'Social Media Content Agent', role: 'core_offer', perceivedValue: 18000 },
      { serviceTitle: 'Client Onboarding Automation', role: 'bonus', perceivedValue: 15000 },
      { serviceTitle: 'AI Email Sequence Builder', role: 'bonus', perceivedValue: 10000 },
      { serviceTitle: 'AI Voice Agent — Inbound', role: 'core_offer', perceivedValue: 20000 },
      { serviceTitle: 'Mobile App Generation', role: 'core_offer', perceivedValue: 35000 },
      { serviceTitle: 'Website Development', role: 'core_offer', perceivedValue: 20000 },
      { serviceTitle: 'RAG Knowledge Base System', role: 'bonus', perceivedValue: 20000 },
      { serviceTitle: 'Team AI Training — 3-Session Program', role: 'bonus', perceivedValue: 7500 },
      { serviceTitle: 'Monthly Advisory Retainer', role: 'bonus', perceivedValue: 7500 },
      { serviceTitle: 'Implementation Warranty', role: 'bonus', perceivedValue: 9000 },
    ],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

async function upsertProduct(product: typeof PRODUCTS[0]): Promise<{ id: number; title: string } | null> {
  // Check if exists
  const { data: existing } = await supabase
    .from('products')
    .select('id, title')
    .eq('title', product.title)
    .maybeSingle();

  if (existing) {
    console.log(`  [SKIP] Product already exists: "${product.title}" (id: ${existing.id})`);
    return existing;
  }

  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select('id, title')
    .single();

  if (error) {
    console.error(`  [ERROR] Failed to create product "${product.title}":`, error.message);
    return null;
  }

  console.log(`  [OK] Created product: "${data.title}" (id: ${data.id})`);
  return data;
}

async function upsertService(service: Record<string, unknown>): Promise<{ id: string; title: string } | null> {
  const title = service.title as string;
  // Check if exists
  const { data: existing } = await supabase
    .from('services')
    .select('id, title')
    .eq('title', title)
    .maybeSingle();

  if (existing) {
    console.log(`  [SKIP] Service already exists: "${title}" (id: ${existing.id})`);
    return existing;
  }

  const { data, error } = await supabase
    .from('services')
    .insert(service)
    .select('id, title')
    .single();

  if (error) {
    console.error(`  [ERROR] Failed to create service "${title}":`, error.message);
    return null;
  }

  console.log(`  [OK] Created service: "${data.title}" (id: ${data.id})`);
  return data;
}

// ============================================================================
// Main Seed Function
// ============================================================================

async function seed() {
  console.log('=== Amadutown Pricing Model Seed ===\n');

  // --- 1. Products ---
  console.log('1. Creating products...');
  const productMap = new Map<string, number>();
  for (const product of PRODUCTS) {
    const result = await upsertProduct(product);
    if (result) productMap.set(result.title, result.id);
  }
  console.log(`   ${productMap.size} products ready.\n`);

  // --- 2. Services ---
  console.log('2. Creating services...');
  const serviceMap = new Map<string, string>();
  for (const service of SERVICES) {
    const result = await upsertService(service as Record<string, unknown>);
    if (result) serviceMap.set(result.title, result.id);
  }
  console.log(`   ${serviceMap.size} services ready.\n`);

  // --- 3. Guarantee Templates ---
  console.log('3. Creating guarantee templates...');
  const guaranteeMap = new Map<string, string>();
  for (const gt of GUARANTEE_TEMPLATES) {
    const { data: existing } = await supabase
      .from('guarantee_templates')
      .select('id, name')
      .eq('name', gt.name)
      .maybeSingle();

    if (existing) {
      console.log(`  [SKIP] Guarantee template already exists: "${gt.name}" (id: ${existing.id})`);
      guaranteeMap.set(existing.name, existing.id);
      continue;
    }

    const { data, error } = await supabase
      .from('guarantee_templates')
      .insert(gt)
      .select('id, name')
      .single();

    if (error) {
      console.error(`  [ERROR] Failed to create guarantee template "${gt.name}":`, error.message);
    } else {
      console.log(`  [OK] Created guarantee template: "${data.name}" (id: ${data.id})`);
      guaranteeMap.set(data.name, data.id);
    }
  }
  console.log(`   ${guaranteeMap.size} guarantee templates ready.\n`);

  // --- 4. Continuity Plans ---
  console.log('4. Creating continuity plans...');
  const continuityMap = new Map<string, string>();
  for (const cp of CONTINUITY_PLANS) {
    const { data: existing } = await supabase
      .from('continuity_plans')
      .select('id, name')
      .eq('name', cp.name)
      .maybeSingle();

    if (existing) {
      console.log(`  [SKIP] Continuity plan already exists: "${cp.name}" (id: ${existing.id})`);
      continuityMap.set(existing.name, existing.id);
      continue;
    }

    const { data, error } = await supabase
      .from('continuity_plans')
      .insert(cp)
      .select('id, name')
      .single();

    if (error) {
      console.error(`  [ERROR] Failed to create continuity plan "${cp.name}":`, error.message);
    } else {
      console.log(`  [OK] Created continuity plan: "${data.name}" (id: ${data.id})`);
      continuityMap.set(data.name, data.id);
    }
  }
  console.log(`   ${continuityMap.size} continuity plans ready.\n`);

  // --- 5. Offer Bundles ---
  console.log('5. Creating offer bundles...');
  for (const bundle of BUNDLES) {
    const { data: existing } = await supabase
      .from('offer_bundles')
      .select('id, name')
      .eq('name', bundle.name)
      .maybeSingle();

    if (existing) {
      console.log(`  [SKIP] Bundle already exists: "${bundle.name}" (id: ${existing.id})`);
      continue;
    }

    // Resolve item references to actual IDs
    const bundleItems = bundle.items.map((item, index) => {
      let contentType = '';
      let contentId: string | number = '';

      if (item.productTitle) {
        contentType = 'product';
        contentId = productMap.get(item.productTitle) ?? '';
      } else if (item.serviceTitle) {
        contentType = 'service';
        contentId = serviceMap.get(item.serviceTitle) ?? '';
      }

      if (!contentId) {
        console.warn(`    [WARN] Could not resolve: ${item.productTitle || item.serviceTitle}`);
      }

      return {
        content_type: contentType,
        content_id: String(contentId),
        display_order: index,
        is_optional: false,
        override_role: item.role,
        override_perceived_value: item.perceivedValue,
      };
    }).filter(i => i.content_id);

    const { data, error } = await supabase
      .from('offer_bundles')
      .insert({
        name: bundle.name,
        description: bundle.description,
        bundle_items: bundleItems,
        bundle_price: bundle.bundlePrice,
        total_retail_value: bundle.totalRetailValue,
        total_perceived_value: bundle.totalPerceivedValue,
        target_funnel_stages: bundle.targetFunnelStages,
        bundle_type: 'standard',
        is_active: true,
      })
      .select('id, name')
      .single();

    if (error) {
      console.error(`  [ERROR] Failed to create bundle "${bundle.name}":`, error.message);
    } else {
      console.log(`  [OK] Created bundle: "${data.name}" (id: ${data.id})`);
    }
  }

  // --- 6. Content Offer Roles ---
  console.log('\n6. Creating content offer roles...');

  // Products
  const productRoles: Array<{ title: string; role: string; perceivedValue: number; retailPrice: number; offerPrice: number; dreamOutcome: string }> = [
    { title: 'AI Audit Calculator', role: 'lead_magnet', perceivedValue: 500, retailPrice: 500, offerPrice: 0, dreamOutcome: 'Understand exactly where AI can save your business time and money' },
    { title: 'AI Implementation Playbook', role: 'lead_magnet', perceivedValue: 200, retailPrice: 49, offerPrice: 29, dreamOutcome: 'Have a clear step-by-step plan to implement AI' },
    { title: 'Business Automation Toolkit', role: 'bonus', perceivedValue: 350, retailPrice: 97, offerPrice: 49, dreamOutcome: 'Systematize your business processes with proven templates' },
    { title: 'Automation ROI Templates Pack', role: 'lead_magnet', perceivedValue: 150, retailPrice: 39, offerPrice: 19, dreamOutcome: 'Justify any automation investment with hard numbers' },
    { title: 'AI Training Course — Self-Paced', role: 'core_offer', perceivedValue: 1500, retailPrice: 497, offerPrice: 297, dreamOutcome: 'Master AI tools and apply them to your business immediately' },
    { title: 'Premium AI Masterclass', role: 'core_offer', perceivedValue: 2500, retailPrice: 997, offerPrice: 497, dreamOutcome: 'Build and deploy production AI solutions with confidence' },
  ];

  for (const pr of productRoles) {
    const productId = productMap.get(pr.title);
    if (!productId) continue;

    const { data: existing } = await supabase
      .from('content_offer_roles')
      .select('id')
      .eq('content_type', 'product')
      .eq('content_id', String(productId))
      .maybeSingle();

    if (existing) {
      console.log(`  [SKIP] Offer role already exists for product: "${pr.title}"`);
      continue;
    }

    const { error } = await supabase.from('content_offer_roles').insert({
      content_type: 'product',
      content_id: String(productId),
      offer_role: pr.role,
      perceived_value: pr.perceivedValue,
      retail_price: pr.retailPrice,
      offer_price: pr.offerPrice,
      dream_outcome_description: pr.dreamOutcome,
      likelihood_multiplier: 7,
      time_reduction: 5,
      effort_reduction: 6,
      is_active: true,
    });

    if (error) {
      console.error(`  [ERROR] Failed to create offer role for "${pr.title}":`, error.message);
    } else {
      console.log(`  [OK] Offer role created for product: "${pr.title}"`);
    }
  }

  // Services (key build services)
  const serviceRoles: Array<{ title: string; role: string; perceivedValue: number; dreamOutcome: string; likelihood: number; timeReduction: number; effortReduction: number }> = [
    { title: 'AI Customer Support Chatbot', role: 'core_offer', perceivedValue: 15000, dreamOutcome: '24/7 customer support without hiring — reduce support costs by 50%+', likelihood: 8, timeReduction: 8, effortReduction: 9 },
    { title: 'AI Inbound Lead Chatbot', role: 'core_offer', perceivedValue: 12000, dreamOutcome: 'Never miss another lead — instant response 24/7', likelihood: 8, timeReduction: 9, effortReduction: 9 },
    { title: 'AI Voice Agent — Inbound', role: 'core_offer', perceivedValue: 20000, dreamOutcome: 'Every phone call answered professionally, every time', likelihood: 7, timeReduction: 9, effortReduction: 10 },
    { title: 'Lead Generation Workflow Agent', role: 'core_offer', perceivedValue: 25000, dreamOutcome: 'Pipeline that fills itself — wake up to qualified leads every morning', likelihood: 7, timeReduction: 8, effortReduction: 9 },
    { title: 'Social Media Content Agent', role: 'core_offer', perceivedValue: 18000, dreamOutcome: 'Consistent social media presence without spending 20+ hours per week', likelihood: 8, timeReduction: 9, effortReduction: 9 },
    { title: 'Client Onboarding Automation', role: 'core_offer', perceivedValue: 15000, dreamOutcome: 'Onboard new clients in days, not weeks — professional first impression every time', likelihood: 8, timeReduction: 8, effortReduction: 8 },
    { title: 'Inbound Lead Tracking System', role: 'core_offer', perceivedValue: 12000, dreamOutcome: 'No lead ever falls through the cracks again', likelihood: 9, timeReduction: 7, effortReduction: 8 },
    { title: 'Mobile App Generation', role: 'core_offer', perceivedValue: 35000, dreamOutcome: 'Your own branded mobile app in the App Store and Google Play', likelihood: 8, timeReduction: 6, effortReduction: 9 },
    { title: 'Website Development', role: 'core_offer', perceivedValue: 20000, dreamOutcome: 'A modern, conversion-optimized website that represents your brand', likelihood: 9, timeReduction: 7, effortReduction: 9 },
    { title: 'AI Email Sequence Builder', role: 'core_offer', perceivedValue: 10000, dreamOutcome: 'Email sequences that nurture leads on autopilot and close deals while you sleep', likelihood: 7, timeReduction: 8, effortReduction: 9 },
    { title: 'RAG Knowledge Base System', role: 'core_offer', perceivedValue: 20000, dreamOutcome: 'Institutional knowledge that never leaves when employees do', likelihood: 7, timeReduction: 7, effortReduction: 8 },
  ];

  for (const sr of serviceRoles) {
    const serviceId = serviceMap.get(sr.title);
    if (!serviceId) continue;

    const { data: existing } = await supabase
      .from('content_offer_roles')
      .select('id')
      .eq('content_type', 'service')
      .eq('content_id', serviceId)
      .maybeSingle();

    if (existing) {
      console.log(`  [SKIP] Offer role already exists for service: "${sr.title}"`);
      continue;
    }

    const { error } = await supabase.from('content_offer_roles').insert({
      content_type: 'service',
      content_id: serviceId,
      offer_role: sr.role,
      perceived_value: sr.perceivedValue,
      retail_price: sr.perceivedValue,
      offer_price: sr.perceivedValue,
      dream_outcome_description: sr.dreamOutcome,
      likelihood_multiplier: sr.likelihood,
      time_reduction: sr.timeReduction,
      effort_reduction: sr.effortReduction,
      is_active: true,
    });

    if (error) {
      console.error(`  [ERROR] Failed to create offer role for "${sr.title}":`, error.message);
    } else {
      console.log(`  [OK] Offer role created for service: "${sr.title}"`);
    }
  }

  // --- Summary ---
  console.log('\n=== Seed Complete ===');
  console.log(`Products: ${productMap.size}`);
  console.log(`Services: ${serviceMap.size}`);
  console.log(`Guarantee Templates: ${guaranteeMap.size}`);
  console.log(`Continuity Plans: ${continuityMap.size}`);
  console.log(`Bundles: ${BUNDLES.length}`);
  console.log('\nYou can now edit all records from the admin UI:');
  console.log('  Products:     /admin/sales/products');
  console.log('  Services:     /admin/content/services');
  console.log('  Bundles:      /admin/sales/bundles');
  console.log('  Guarantees:   /admin/guarantees');
  console.log('  Continuity:   /admin/continuity-plans');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
