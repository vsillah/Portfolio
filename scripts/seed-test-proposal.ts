/**
 * Quick script to seed a test proposal for project creation testing.
 * Run with: npx tsx scripts/seed-test-proposal.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Parse .env.local manually (no dotenv dependency needed)
const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx)
  const value = trimmed.slice(eqIdx + 1)
  if (!process.env[key]) process.env[key] = value
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('Seeding test proposal...')

  // Check if test proposal already exists
  const { data: existing } = await supabase
    .from('proposals')
    .select('id')
    .eq('client_email', 'jordan@acmecorp.com')
    .eq('status', 'paid')
    .limit(1)

  if (existing && existing.length > 0) {
    console.log('Test proposal already exists:', existing[0].id)
    console.log('Go to /admin/client-projects and click "Create Project" to use it.')
    return
  }

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      client_name: 'Jordan Rivera',
      client_email: 'jordan@acmecorp.com',
      client_company: 'Acme Corporation',
      bundle_name: 'AI Chatbot Solution - Full Package',
      line_items: [
        {
          content_type: 'project',
          content_id: '00000000-0000-0000-0000-000000000001',
          title: 'Custom AI Chatbot',
          description:
            'Full-stack AI chatbot with RAG pipeline, custom knowledge base, and multi-channel deployment.',
          offer_role: 'core_offer',
          price: 4500.0,
          perceived_value: 7500.0,
        },
        {
          content_type: 'service',
          content_id: '00000000-0000-0000-0000-000000000002',
          title: 'Chatbot Training & Handoff',
          description:
            'Training session for client team on chatbot management and customization.',
          offer_role: 'upsell',
          price: 500.0,
          perceived_value: 1000.0,
        },
      ],
      subtotal: 5000.0,
      total_amount: 5000.0,
      status: 'paid',
      paid_at: new Date().toISOString(),
      terms_text: 'Standard terms apply. 12-month warranty included.',
      valid_until: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    })
    .select('id, client_name, bundle_name')
    .single()

  if (error) {
    console.error('Error seeding proposal:', error)
    process.exit(1)
  }

  console.log('Test proposal created successfully!')
  console.log('  ID:', data.id)
  console.log('  Client:', data.client_name)
  console.log('  Bundle:', data.bundle_name)
  console.log('')
  console.log('Next: Go to /admin/client-projects and click "Create Project".')
}

main()
