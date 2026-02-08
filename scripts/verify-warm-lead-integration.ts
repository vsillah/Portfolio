#!/usr/bin/env tsx

/**
 * Verification Script for Warm Lead Workflow Integration
 * 
 * Tests:
 * 1. Trigger API endpoint
 * 2. Ingest API endpoint
 * 3. Mock data generation
 * 4. Database schema
 * 5. E2E scenario definition
 */

import { createClient } from '@supabase/supabase-js'
import { generateMockWarmLeads } from '../lib/testing/mock-warm-leads'
import { warmLeadPipelineScenario } from '../lib/testing/scenarios'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const N8N_INGEST_SECRET = process.env.N8N_INGEST_SECRET!
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

interface VerificationResult {
  test: string
  status: 'pass' | 'fail' | 'skip'
  message: string
  details?: unknown
}

const results: VerificationResult[] = []

function logResult(test: string, status: 'pass' | 'fail' | 'skip', message: string, details?: unknown) {
  results.push({ test, status, message, details })
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏭️'
  console.log(`${icon} ${test}: ${message}`)
  if (details) {
    console.log('   Details:', JSON.stringify(details, null, 2))
  }
}

async function verifyDatabaseSchema() {
  console.log('\n🔍 Verifying Database Schema...')
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    // Check if warm_lead_trigger_audit table exists
    const { data: tables, error } = await supabase
      .from('warm_lead_trigger_audit')
      .select('id')
      .limit(1)
    
    if (error) {
      if (error.message.includes('does not exist')) {
        logResult(
          'Database Schema',
          'fail',
          'warm_lead_trigger_audit table does not exist. Run database_schema_cold_lead_pipeline.sql'
        )
        return false
      }
      throw error
    }
    
    logResult('Database Schema', 'pass', 'warm_lead_trigger_audit table exists')
    return true
  } catch (error) {
    logResult('Database Schema', 'fail', `Error: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

async function verifyMockDataGeneration() {
  console.log('\n🔍 Verifying Mock Data Generation...')
  
  try {
    const leads = generateMockWarmLeads({
      facebook: 2,
      google_contacts: 1,
      linkedin: 2
    })
    
    if (leads.length !== 5) {
      logResult('Mock Data Generation', 'fail', `Expected 5 leads, got ${leads.length}`)
      return false
    }
    
    // Verify lead structure
    const fbLead = leads.find(l => l.lead_source.startsWith('warm_facebook'))
    const gcLead = leads.find(l => l.lead_source === 'warm_google_contacts')
    const liLead = leads.find(l => l.lead_source.startsWith('warm_linkedin'))
    
    if (!fbLead || !gcLead || !liLead) {
      logResult('Mock Data Generation', 'fail', 'Missing required lead sources')
      return false
    }
    
    // Verify required fields
    const requiredFields = ['name', 'email', 'lead_source', 'relationship_strength', 'warm_source_detail']
    for (const field of requiredFields) {
      if (!fbLead[field as keyof typeof fbLead]) {
        logResult('Mock Data Generation', 'fail', `Missing field: ${field}`)
        return false
      }
    }
    
    logResult('Mock Data Generation', 'pass', 'Generated 5 mock leads with correct structure', {
      facebook: leads.filter(l => l.lead_source.startsWith('warm_facebook')).length,
      google_contacts: leads.filter(l => l.lead_source === 'warm_google_contacts').length,
      linkedin: leads.filter(l => l.lead_source.startsWith('warm_linkedin')).length
    })
    return true
  } catch (error) {
    logResult('Mock Data Generation', 'fail', `Error: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

async function verifyE2EScenario() {
  console.log('\n🔍 Verifying E2E Scenario Definition...')
  
  try {
    if (!warmLeadPipelineScenario) {
      logResult('E2E Scenario', 'fail', 'warmLeadPipelineScenario is undefined')
      return false
    }
    
    if (warmLeadPipelineScenario.id !== 'warm_lead_pipeline') {
      logResult('E2E Scenario', 'fail', `Wrong scenario ID: ${warmLeadPipelineScenario.id}`)
      return false
    }
    
    if (warmLeadPipelineScenario.steps.length === 0) {
      logResult('E2E Scenario', 'fail', 'No steps defined')
      return false
    }
    
    // Check for required step types
    const stepTypes = warmLeadPipelineScenario.steps.map(s => s.type)
    const requiredTypes: Array<typeof stepTypes[number]> = ['apiCall', 'waitForData', 'adminAction', 'validateDatabase']
    
    for (const type of requiredTypes) {
      if (!stepTypes.includes(type)) {
        logResult('E2E Scenario', 'fail', `Missing step type: ${type}`)
        return false
      }
    }
    
    logResult('E2E Scenario', 'pass', `Scenario has ${warmLeadPipelineScenario.steps.length} steps`, {
      id: warmLeadPipelineScenario.id,
      name: warmLeadPipelineScenario.name,
      steps: warmLeadPipelineScenario.steps.length,
      estimatedDuration: warmLeadPipelineScenario.estimatedDuration,
      tags: warmLeadPipelineScenario.tags
    })
    return true
  } catch (error) {
    logResult('E2E Scenario', 'fail', `Error: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

async function verifyIngestAPI() {
  console.log('\n🔍 Verifying Ingest API...')
  
  if (!N8N_INGEST_SECRET) {
    logResult('Ingest API', 'skip', 'N8N_INGEST_SECRET not set, skipping test')
    return false
  }
  
  try {
    const testLead = {
      name: 'Verification Test Lead',
      email: `verify-${Date.now()}@test.amadutown.com`,
      company: 'Test Company',
      lead_source: 'warm_facebook_friends',
      relationship_strength: 'strong' as const,
      warm_source_detail: 'Verification test'
    }
    
    const response = await fetch(`${BASE_URL}/api/admin/outreach/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${N8N_INGEST_SECRET}`
      },
      body: JSON.stringify({ leads: [testLead] })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      logResult('Ingest API', 'fail', `API returned ${response.status}: ${errorText}`)
      return false
    }
    
    const data = await response.json()
    
    logResult('Ingest API', 'pass', 'Successfully ingested test lead', data)
    
    // Clean up test lead
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    await supabase
      .from('contact_submissions')
      .delete()
      .eq('email', testLead.email)
    
    return true
  } catch (error) {
    logResult('Ingest API', 'fail', `Error: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

async function verifyTriggerAPI() {
  console.log('\n🔍 Verifying Trigger API...')
  
  // This test requires admin authentication
  // We'll just verify the endpoint exists by checking the route file
  try {
    const fs = await import('fs/promises')
    const routePath = './app/api/admin/outreach/trigger/route.ts'
    
    const fileExists = await fs.access(routePath).then(() => true).catch(() => false)
    
    if (!fileExists) {
      logResult('Trigger API', 'fail', 'Trigger API route file does not exist')
      return false
    }
    
    const content = await fs.readFile(routePath, 'utf-8')
    
    // Check for required exports
    if (!content.includes('export async function POST') || !content.includes('export async function GET')) {
      logResult('Trigger API', 'fail', 'Missing POST or GET handler in trigger route')
      return false
    }
    
    // Check for key functionality
    const requiredFeatures = [
      'triggerWarmLeadScrape',
      'warm_lead_trigger_audit',
      'verifyAdmin'
    ]
    
    for (const feature of requiredFeatures) {
      if (!content.includes(feature)) {
        logResult('Trigger API', 'fail', `Missing feature: ${feature}`)
        return false
      }
    }
    
    logResult('Trigger API', 'pass', 'Trigger API route exists with required handlers')
    return true
  } catch (error) {
    logResult('Trigger API', 'fail', `Error: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

async function verifyDashboardUI() {
  console.log('\n🔍 Verifying Dashboard UI...')
  
  try {
    const fs = await import('fs/promises')
    const dashboardPath = './app/admin/outreach/dashboard/page.tsx'
    
    const fileExists = await fs.access(dashboardPath).then(() => true).catch(() => false)
    
    if (!fileExists) {
      logResult('Dashboard UI', 'fail', 'Dashboard page file does not exist')
      return false
    }
    
    const content = await fs.readFile(dashboardPath, 'utf-8')
    
    // Check for required UI elements
    const requiredElements = [
      'Trigger Warm Lead Scraping',
      'triggerScraping',
      'showTriggerSection',
      'warm_lead_trigger_audit'
    ]
    
    for (const element of requiredElements) {
      if (!content.includes(element)) {
        logResult('Dashboard UI', 'fail', `Missing UI element: ${element}`)
        return false
      }
    }
    
    logResult('Dashboard UI', 'pass', 'Dashboard UI has trigger section with required elements')
    return true
  } catch (error) {
    logResult('Dashboard UI', 'fail', `Error: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

async function main() {
  console.log('🚀 Warm Lead Workflow Integration Verification\n')
  console.log('Configuration:')
  console.log('  BASE_URL:', BASE_URL)
  console.log('  SUPABASE_URL:', SUPABASE_URL)
  console.log('  N8N_INGEST_SECRET:', N8N_INGEST_SECRET ? '✓ Set' : '✗ Not set')
  console.log('')
  
  // Run all verification tests
  await verifyDatabaseSchema()
  await verifyMockDataGeneration()
  await verifyE2EScenario()
  await verifyTriggerAPI()
  await verifyDashboardUI()
  await verifyIngestAPI()
  
  // Summary
  console.log('\n📊 Verification Summary\n')
  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  const skipped = results.filter(r => r.status === 'skip').length
  
  console.log(`Total Tests: ${results.length}`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`⏭️  Skipped: ${skipped}`)
  
  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Review the output above for details.')
    process.exit(1)
  } else {
    console.log('\n✨ All tests passed! Warm lead workflow integration is ready.')
    process.exit(0)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}
