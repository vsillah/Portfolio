#!/usr/bin/env npx tsx
/**
 * Preflight Doctor
 *
 * Run with: npm run doctor
 * Validates that your chatbot is correctly configured before you start it.
 */

import * as fs from 'fs'
import * as path from 'path'

interface Check {
  name: string
  pass: boolean
  message: string
  fix?: string
}

const checks: Check[] = []

function addCheck(name: string, pass: boolean, message: string, fix?: string) {
  checks.push({ name, pass, message, fix })
}

function print(msg: string) { console.log(msg) }

async function main() {
  print('')
  print('╔══════════════════════════════════════════════════════╗')
  print('║          AI Chatbot — Preflight Check               ║')
  print('╚══════════════════════════════════════════════════════╝')
  print('')

  // ── 1. Check .env.local exists ────────────────────────────────────────
  const envPath = path.join(__dirname, '..', '.env.local')
  const envExists = fs.existsSync(envPath)
  addCheck(
    '.env.local file',
    envExists,
    envExists ? 'Found' : 'Missing',
    'Run: npm run setup'
  )

  if (!envExists) {
    printResults()
    return
  }

  // Parse env file
  const envContent = fs.readFileSync(envPath, 'utf-8')
  const env: Record<string, string> = {}
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) env[match[1].trim()] = match[2].trim()
  })

  // ── 2. Check required env vars ────────────────────────────────────────
  const requiredVars = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'Supabase URL' },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Supabase anon key' },
    { key: 'N8N_WEBHOOK_URL', label: 'n8n webhook URL' },
  ]

  const placeholders = ['your-', 'https://your-', 'your_']

  for (const { key, label } of requiredVars) {
    const value = env[key]
    const isSet = Boolean(value) && !placeholders.some(p => value.startsWith(p))
    addCheck(
      label,
      isSet,
      isSet ? 'Set' : value ? 'Still has placeholder value' : 'Not set',
      `Set ${key} in .env.local (or re-run: npm run setup)`
    )
  }

  // Service role key (optional but recommended)
  const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY']
  const serviceKeySet = Boolean(serviceKey) && !placeholders.some(p => serviceKey.startsWith(p))
  addCheck(
    'Supabase service role key',
    serviceKeySet,
    serviceKeySet ? 'Set' : 'Missing (chat history may not persist)',
    'Add SUPABASE_SERVICE_ROLE_KEY to .env.local'
  )

  // VAPI (optional)
  const vapiKey = env['NEXT_PUBLIC_VAPI_PUBLIC_KEY']
  const vapiId = env['NEXT_PUBLIC_VAPI_ASSISTANT_ID']
  if (vapiKey || vapiId) {
    addCheck(
      'VAPI voice chat',
      Boolean(vapiKey) && Boolean(vapiId),
      vapiKey && vapiId ? 'Configured' : 'Partially configured (need both key and assistant ID)',
      'Set both NEXT_PUBLIC_VAPI_PUBLIC_KEY and NEXT_PUBLIC_VAPI_ASSISTANT_ID'
    )
  } else {
    addCheck('VAPI voice chat', true, 'Skipped (not configured — this is fine)')
  }

  // ── 3. Check Supabase connectivity ────────────────────────────────────
  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
  if (supabaseUrl && !placeholders.some(p => supabaseUrl.startsWith(p))) {
    try {
      const healthUrl = `${supabaseUrl}/rest/v1/`
      const response = await fetch(healthUrl, {
        headers: {
          'apikey': env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || '',
          'Authorization': `Bearer ${env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || ''}`,
        },
      })
      addCheck(
        'Supabase reachable',
        response.ok || response.status === 200,
        response.ok ? 'Connected' : `HTTP ${response.status}`,
        'Check your NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
      )
    } catch (err) {
      addCheck(
        'Supabase reachable',
        false,
        `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'Check your NEXT_PUBLIC_SUPABASE_URL — is the project running?'
      )
    }

    // Check database tables
    const anonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
    const svcKey = env['SUPABASE_SERVICE_ROLE_KEY']
    const checkKey = svcKey || anonKey
    if (checkKey && !placeholders.some(p => checkKey.startsWith(p))) {
      const tables = ['chat_sessions', 'chat_messages', 'system_prompts']
      for (const table of tables) {
        try {
          const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=count&limit=0`, {
            headers: {
              'apikey': checkKey,
              'Authorization': `Bearer ${checkKey}`,
            },
          })
          const tableExists = response.ok
          addCheck(
            `Table: ${table}`,
            tableExists,
            tableExists ? 'Exists' : `Not found (HTTP ${response.status})`,
            `Run database/schema.sql in your Supabase SQL Editor`
          )
        } catch {
          addCheck(`Table: ${table}`, false, 'Could not check', 'Run database/schema.sql in Supabase SQL Editor')
        }
      }
    }
  }

  // ── 4. Check n8n webhook ──────────────────────────────────────────────
  const n8nUrl = env['N8N_WEBHOOK_URL']
  if (n8nUrl && !placeholders.some(p => n8nUrl.startsWith(p))) {
    try {
      const response = await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendMessage',
          sessionId: 'doctor-check',
          chatInput: '__health_check__',
        }),
      })
      addCheck(
        'n8n webhook reachable',
        response.ok,
        response.ok ? 'Connected' : `HTTP ${response.status} — is the workflow active?`,
        'Make sure your n8n workflow is active and the webhook URL is correct'
      )
    } catch (err) {
      addCheck(
        'n8n webhook reachable',
        false,
        `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'Check your N8N_WEBHOOK_URL and make sure n8n is running'
      )
    }
  }

  // ── 5. Check node_modules ─────────────────────────────────────────────
  const nodeModulesExists = fs.existsSync(path.join(__dirname, '..', 'node_modules'))
  addCheck(
    'Dependencies installed',
    nodeModulesExists,
    nodeModulesExists ? 'Found' : 'Missing',
    'Run: npm install'
  )

  printResults()
}

function printResults() {
  print('')
  const passed = checks.filter(c => c.pass)
  const failed = checks.filter(c => !c.pass)

  for (const check of checks) {
    const icon = check.pass ? '✓' : '✗'
    const color = check.pass ? '  ' : '  '
    print(`${color}${icon} ${check.name}: ${check.message}`)
    if (!check.pass && check.fix) {
      print(`    Fix: ${check.fix}`)
    }
  }

  print('')
  print(`Results: ${passed.length} passed, ${failed.length} failed`)
  print('')

  if (failed.length === 0) {
    print('All checks passed! Run: npm run dev')
  } else {
    print('Fix the issues above, then run: npm run doctor')
  }
  print('')

  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Doctor check failed:', err)
  process.exit(1)
})
