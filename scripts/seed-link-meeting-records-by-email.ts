#!/usr/bin/env npx tsx
/**
 * Seed: Link meeting_records to contacts by email
 *
 * Finds meeting_records that don't have contact_submission_id set and links them
 * to the matching contact (contact_submissions) by email. Email is resolved from:
 * 1) client_projects.client_email when meeting_record has client_project_id
 * 2) meeting_data->>'clientEmail' or attendees JSON when no project
 *
 * Also backfills contact_submission_id from client_projects when the project
 * already has contact_submission_id (no email match needed).
 *
 * Usage: npx tsx scripts/seed-link-meeting-records-by-email.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type MeetingRow = {
  id: string
  client_project_id: string | null
  contact_submission_id: number | null
  meeting_data: Record<string, unknown> | null
  attendees: unknown
}

type ProjectRow = {
  id: string
  client_email: string | null
  contact_submission_id: number | null
}

type ContactRow = {
  id: number
  email: string | null
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (email == null || typeof email !== 'string') return null
  const s = email.trim().toLowerCase()
  return s === '' ? null : s
}

function parseAttendees(attendees: unknown): Array<{ email?: string; is_host?: boolean }> {
  if (Array.isArray(attendees)) return attendees as Array<{ email?: string; is_host?: boolean }>
  if (typeof attendees === 'string') {
    try {
      const parsed = JSON.parse(attendees) as unknown
      return Array.isArray(parsed) ? (parsed as Array<{ email?: string; is_host?: boolean }>) : []
    } catch {
      return []
    }
  }
  return []
}

function getEmailFromMeeting(m: MeetingRow, projectEmail: string | null): string | null {
  const fromProject = normalizeEmail(projectEmail)
  if (fromProject) return fromProject
  const fromData = normalizeEmail((m.meeting_data as Record<string, unknown> | null)?.clientEmail as string | undefined)
  if (fromData) return fromData
  const attendees = parseAttendees(m.attendees)
  if (attendees.length === 0) return null
  const client = attendees.find((a) => a?.email && !a?.is_host) ?? attendees[0]
  if (client?.email) return normalizeEmail(client.email)
  return null
}

async function main() {
  console.log('Fetching meeting_records without contact_submission_id...')
  const { data: meetings, error: meetingsErr } = await supabase
    .from('meeting_records')
    .select('id, client_project_id, contact_submission_id, meeting_data, attendees')
    .is('contact_submission_id', null)

  if (meetingsErr) {
    console.error('Failed to fetch meeting_records:', meetingsErr)
    process.exit(1)
  }

  const toLink = (meetings ?? []) as MeetingRow[]
  if (toLink.length === 0) {
    console.log('No meeting_records with null contact_submission_id. Nothing to do.')
    return
  }

  console.log(`Found ${toLink.length} meeting record(s) to consider for linking.`)

  const projectIds = [...new Set(toLink.map((m) => m.client_project_id).filter(Boolean))] as string[]
  const { data: projects, error: projectsErr } = await supabase
    .from('client_projects')
    .select('id, client_email, contact_submission_id')
    .in('id', projectIds)

  if (projectsErr) {
    console.error('Failed to fetch client_projects:', projectsErr)
    process.exit(1)
  }

  const projectMap = new Map<string, ProjectRow>((projects ?? []).map((p) => [p.id, p as ProjectRow]))

  const emailsToResolve = new Set<string>()
  for (const m of toLink) {
    const project = m.client_project_id ? projectMap.get(m.client_project_id) : null
    const email = getEmailFromMeeting(m, project?.client_email ?? null)
    if (email) emailsToResolve.add(email)
  }

  const contactByEmail = new Map<string, number>()
  if (emailsToResolve.size > 0) {
    const { data: contacts, error: contactsErr } = await supabase
      .from('contact_submissions')
      .select('id, email')
      .not('email', 'is', null)

    if (contactsErr) {
      console.error('Failed to fetch contact_submissions:', contactsErr)
      process.exit(1)
    }

    for (const c of (contacts ?? []) as ContactRow[]) {
      const e = normalizeEmail(c.email)
      if (e) contactByEmail.set(e, c.id)
    }
  }

  let linkedFromProject = 0
  let linkedFromEmail = 0
  let skippedNoContact = 0

  for (const m of toLink) {
    const project = m.client_project_id ? projectMap.get(m.client_project_id) : null
    let contactId: number | null = null
    let source: 'project' | 'email' | null = null

    if (project?.contact_submission_id != null) {
      contactId = project.contact_submission_id
      source = 'project'
    }
    if (contactId == null) {
      const email = getEmailFromMeeting(m, project?.client_email ?? null)
      contactId = email ? contactByEmail.get(email) ?? null : null
      if (contactId != null) source = 'email'
    }

    if (contactId == null) {
      skippedNoContact++
      continue
    }
    if (source === 'project') linkedFromProject++
    else linkedFromEmail++

    const updates: { contact_submission_id: number; client_project_id?: string } = { contact_submission_id: contactId }
    if (project?.id) {
      updates.client_project_id = project.id
    } else {
      const { data: contactProject } = await supabase
        .from('client_projects')
        .select('id')
        .eq('contact_submission_id', contactId)
        .limit(1)
        .maybeSingle()
      if (contactProject?.id) updates.client_project_id = contactProject.id
    }

    const { error: updateErr } = await supabase
      .from('meeting_records')
      .update(updates)
      .eq('id', m.id)

    if (updateErr) {
      console.error(`Failed to update meeting ${m.id}:`, updateErr)
      continue
    }

    if (updates.client_project_id) {
      await supabase
        .from('meeting_action_tasks')
        .update({ client_project_id: updates.client_project_id })
        .eq('meeting_record_id', m.id)
        .is('client_project_id', null)
    }
  }

  console.log('Done.')
  console.log(`  Linked from project.contact_submission_id: ${linkedFromProject}`)
  console.log(`  Linked by email match: ${linkedFromEmail}`)
  console.log(`  Skipped (no matching contact): ${skippedNoContact}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
