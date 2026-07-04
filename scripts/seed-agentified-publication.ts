#!/usr/bin/env npx tsx
/**
 * Seed Agentified as a Portfolio publication.
 *
 * Usage:
 *   npx tsx scripts/seed-agentified-publication.ts --target dev
 *   npx tsx scripts/seed-agentified-publication.ts --target prod
 *   npx tsx scripts/seed-agentified-publication.ts --target prod --dry-run
 *
 * Requires:
 *   dev:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   prod: PROD_SUPABASE_URL, PROD_SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { agentifiedPublication } from '../lib/agentified-publication'

type Target = 'dev' | 'prod'

function readFlag(name: string): string | null {
  const index = process.argv.indexOf(name)
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1]
  }
  return null
}

function resolveEnvFile(): string {
  return path.resolve(process.cwd(), readFlag('--env-file') || '.env.local')
}

function resolveTarget(): Target {
  const target = readFlag('--target') || 'dev'
  if (target !== 'dev' && target !== 'prod') {
    console.error(`Unsupported target "${target}". Use --target dev or --target prod.`)
    process.exit(1)
  }
  return target
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing required environment variable: ${name}`)
    process.exit(1)
  }
  return value
}

dotenv.config({ path: resolveEnvFile() })

const target = resolveTarget()
const dryRun = process.argv.includes('--dry-run')
const supabaseUrl = target === 'prod'
  ? requireEnv('PROD_SUPABASE_URL')
  : requireEnv('NEXT_PUBLIC_SUPABASE_URL')
const serviceRoleKey = target === 'prod'
  ? requireEnv('PROD_SUPABASE_SERVICE_ROLE_KEY')
  : requireEnv('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const publicationPayload = {
  title: agentifiedPublication.title,
  description: agentifiedPublication.description,
  publication_url: agentifiedPublication.route,
  author: agentifiedPublication.author,
  publication_date: null as string | null,
  publisher: agentifiedPublication.publisher,
  display_order: 2,
  is_published: true,
  file_path: agentifiedPublication.coverImage,
  file_type: 'image/svg+xml',
  file_size: null as number | null,
  lead_magnet_id: null as string | null,
  audiobook_lead_magnet_id: null as string | null,
  audio_preview_url: null as string | null,
  audio_file_path: null as string | null,
  elevenlabs_project_id: null as string | null,
  elevenlabs_public_user_id: null as string | null,
  elevenlabs_player_url: null as string | null,
}

async function main() {
  console.log(`Target: ${target}`)
  console.log(`Env file: ${resolveEnvFile()}`)
  console.log(`Supabase project: ${new URL(supabaseUrl).hostname}`)
  console.log(`Dry run: ${dryRun ? 'yes' : 'no'}`)

  const { data: existing, error: lookupError } = await supabase
    .from('publications')
    .select('id, title, display_order, is_published, publication_url')
    .eq('title', agentifiedPublication.title)
    .maybeSingle()

  if (lookupError) {
    console.error('Failed to look up existing publication:', lookupError)
    process.exit(1)
  }

  if (dryRun) {
    console.log(existing ? `Would update publication id=${existing.id}` : 'Would insert publication')
    console.log({
      title: publicationPayload.title,
      publication_url: publicationPayload.publication_url,
      publisher: publicationPayload.publisher,
      display_order: publicationPayload.display_order,
      is_published: publicationPayload.is_published,
      file_path: publicationPayload.file_path,
    })
    return
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('publications')
      .update(publicationPayload)
      .eq('id', existing.id)

    if (error) {
      console.error(`Failed to update Agentified publication id=${existing.id}:`, error)
      process.exit(1)
    }

    console.log(`Updated Agentified publication id=${existing.id}`)
  } else {
    const { data, error } = await supabase
      .from('publications')
      .insert([publicationPayload])
      .select('id')
      .single()

    if (error) {
      console.error('Failed to insert Agentified publication:', error)
      process.exit(1)
    }

    console.log(`Inserted Agentified publication id=${data.id}`)
  }

  const { data: verification, error: verifyError } = await supabase
    .from('publications')
    .select('id, title, publication_url, publisher, display_order, is_published, file_path, file_type')
    .eq('title', agentifiedPublication.title)
    .single()

  if (verifyError) {
    console.error('Seed wrote but verification failed:', verifyError)
    process.exit(1)
  }

  console.log('Verified publication:')
  console.log(verification)
}

main()
