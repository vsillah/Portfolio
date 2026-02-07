-- ============================================================================
-- Test Seed: One paid proposal for testing the project creation flow.
-- Run this, then use the admin UI "Create Project" button to create the project.
-- ============================================================================

INSERT INTO proposals (
  client_name,
  client_email,
  client_company,
  bundle_name,
  line_items,
  subtotal,
  total_amount,
  status,
  paid_at,
  terms_text,
  valid_until
) VALUES (
  'Jordan Rivera',
  'jordan@acmecorp.com',
  'Acme Corporation',
  'AI Chatbot Solution - Full Package',
  '[
    {
      "content_type": "project",
      "content_id": "00000000-0000-0000-0000-000000000001",
      "title": "Custom AI Chatbot",
      "description": "Full-stack AI chatbot with RAG pipeline, custom knowledge base, and multi-channel deployment.",
      "offer_role": "core_offer",
      "price": 4500.00,
      "perceived_value": 7500.00
    },
    {
      "content_type": "service",
      "content_id": "00000000-0000-0000-0000-000000000002",
      "title": "Chatbot Training & Handoff",
      "description": "Training session for client team on chatbot management and customization.",
      "offer_role": "upsell",
      "price": 500.00,
      "perceived_value": 1000.00
    }
  ]',
  5000.00,
  5000.00,
  'paid',
  NOW(),
  'Standard terms apply. 12-month warranty included.',
  NOW() + INTERVAL '30 days'
);
