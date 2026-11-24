import 'server-only'

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import packet from '@/agentified/campaign/portfolio-campaign-packet.json'
import manifest from '@/public/agentified/campaign-review/2026-11-23/manifest.json'

const COPY_PATH = 'agentified/campaign/draft-assets.md'
const PACKET_PATH = 'agentified/campaign/portfolio-campaign-packet.json'
const MANIFEST_PATH = 'public/agentified/campaign-review/2026-11-23/manifest.json'
const REVIEW_ROOT = '/agentified/campaign-review/2026-11-23/'

function sha256(content: Buffer | string) {
  return createHash('sha256').update(content).digest('hex')
}

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path))
}

function sectionFor(copy: string, assetId: string) {
  const heading = new RegExp(`^## ${assetId}[^\n]*$`, 'm')
  const match = heading.exec(copy)
  if (!match) throw new Error(`Missing Agentified copy section: ${assetId}`)
  const next = copy.indexOf('\n## ', match.index + match[0].length)
  return copy.slice(match.index, next < 0 ? undefined : next).trimEnd()
}

function mediaFor(assetId: string) {
  const prefix = `${assetId.toLowerCase()}-`
  return manifest.outputs
    .filter((output) => output.path.split('/').at(-1)?.startsWith(prefix))
    .map((output) => ({
      path: output.path,
      url: `${REVIEW_ROOT}${output.path.split('/').at(-1)}`,
      sha256: output.sha256,
      type: output.path.endsWith('.mp4') ? 'video' as const : 'image' as const,
    }))
}

export function agentifiedCalendarDrafts() {
  const copy = readSource(COPY_PATH).toString('utf8')
  const packetHash = sha256(readSource(PACKET_PATH))
  const manifestHash = sha256(readSource(MANIFEST_PATH))
  const ids = new Set<string>()

  if (packet.packet_status !== 'draft_prepare_only' || packet.campaign.status !== 'draft') {
    throw new Error('Agentified packet is no longer draft-only')
  }

  return packet.calendar_items.map((item) => {
    const id = `agentified-draft:${item.metadata.idempotency_key}`
    if (ids.has(id)) throw new Error(`Duplicate Agentified calendar identity: ${id}`)
    ids.add(id)
    if (item.authorization_status !== 'pending' || item.autonomy_eligible !== false
      || item.metadata.draft_state !== 'draft' || item.metadata.publication_status !== 'not_authorized'
      || Object.values(item.metadata.external_action_locks).some((locked) => locked !== true)
      || item.metadata.cta_url !== 'https://amadutown.com/agentified') {
      throw new Error(`Agentified draft gate drift: ${item.asset_id}`)
    }
    const media = mediaFor(item.asset_id)
    for (const asset of media) {
      if (sha256(readSource(asset.path)) !== asset.sha256) {
        throw new Error(`Agentified visual drift: ${asset.path}`)
      }
    }

    return {
      id,
      asset_id: item.asset_id,
      campaign_slug: item.campaign_slug,
      campaign_name: packet.campaign.name,
      template_key: packet.campaign.template_key,
      campaign_phase: item.campaign_phase,
      channel: item.channel,
      title: item.title,
      planned_angle: item.planned_angle,
      scheduled_for: item.scheduled_for,
      preparation_deadline: item.preparation_deadline,
      authorization_status: 'draft' as const,
      autonomy_eligible: false as const,
      external_execution_enabled: false as const,
      cta_url: item.metadata.cta_url,
      source_paths: item.metadata.source_paths,
      draft_asset_path: item.metadata.draft_asset_path,
      copy: sectionFor(copy, item.asset_id),
      copy_sha256: sha256(sectionFor(copy, item.asset_id)),
      packet_path: PACKET_PATH,
      packet_sha256: packetHash,
      manifest_path: MANIFEST_PATH,
      manifest_sha256: manifestHash,
      media,
      gate: 'Internal draft review only. Source, visual, challenger, and human decisions are pending. Provider, upload, schedule, publish, and send actions are locked.',
    }
  })
}

export function agentifiedCalendarRows() {
  return agentifiedCalendarDrafts().map((draft) => ({
    id: draft.id,
    campaign_id: null,
    agent_work_item_id: null,
    social_content_id: null,
    channel: draft.channel,
    campaign_phase: draft.campaign_phase,
    title: draft.title,
    planned_angle: draft.planned_angle,
    scheduled_for: draft.scheduled_for,
    due_status: 'planned',
    authorization_status: draft.authorization_status,
    authorization_due_at: draft.preparation_deadline,
    autonomy_eligible: false,
    metadata: {
      agentified_draft: true,
      agentified_asset_id: draft.asset_id,
      campaign_slug: draft.campaign_slug,
      template_key: draft.template_key,
      template_label: 'Whisper to Shout',
      source_packet_path: draft.packet_path,
      source_packet_sha256: draft.packet_sha256,
      copy_sha256: draft.copy_sha256,
      visual_manifest_sha256: draft.manifest_sha256,
      draft_asset_path: draft.draft_asset_path,
      source_paths: draft.source_paths,
      cta_url: draft.cta_url,
      provider_blocked: true,
      provider_boundary: draft.gate,
      external_execution_enabled: false,
      external_action_locks: {
        provider_generation: true,
        render: true,
        upload: true,
        schedule: true,
        publish: true,
        send: true,
      },
    },
    attraction_campaigns: {
      id: draft.campaign_slug,
      name: draft.campaign_name,
      slug: draft.campaign_slug,
      status: 'draft',
      starts_at: packet.campaign.starts_at,
      ends_at: packet.campaign.ends_at,
    },
    agent_work_items: null,
    social_content_queue: null,
  }))
}
