#!/usr/bin/env tsx
import { createInterface } from 'readline'
import {
  compileKarpathyWikiOverlay,
  createOpenBrainProposal,
  getOpenBrainSnapshot,
  type OpenBrainMemoryKind,
  type OpenBrainPrivacyTier,
} from '../lib/open-brain'

type RpcRequest = {
  id?: string | number
  method?: string
  params?: {
    name?: string
    arguments?: Record<string, unknown>
  }
}

const tools = [
  {
    name: 'capture_memory',
    description: 'Create an approval-gated Open Brain memory proposal. Durable memory writes still require approval.',
    inputSchema: proposalSchema(),
  },
  {
    name: 'search_memory',
    description: 'Search approved local Open Brain memories and source projections.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'get_context_packet',
    description: 'Return the compact context packet agents should read before acting.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'propose_memory_write',
    description: 'Create an approval-gated proposed memory write.',
    inputSchema: proposalSchema(),
  },
  {
    name: 'list_pending_memory_proposals',
    description: 'List pending Open Brain memory proposals.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'link_memory_to_source',
    description: 'Return a proposal payload for linking memory and source records. Link persistence is approval-gated in V1.',
    inputSchema: {
      type: 'object',
      properties: {
        memoryId: { type: 'string' },
        sourceId: { type: 'string' },
        relationship: { type: 'string' },
      },
      required: ['memoryId', 'sourceId', 'relationship'],
    },
  },
  {
    name: 'compile_wiki_overlay',
    description: 'Compile Karpathy Wiki overlay previews from approved non-private memories.',
    inputSchema: { type: 'object', properties: {} },
  },
]

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })

rl.on('line', async (line) => {
  if (!line.trim()) return
  let request: RpcRequest
  try {
    request = JSON.parse(line)
  } catch {
    write({ error: { code: -32700, message: 'Parse error' } })
    return
  }

  try {
    if (request.method === 'initialize') {
      write({ id: request.id, result: { protocolVersion: '2024-11-05', serverInfo: { name: 'portfolio-open-brain', version: '0.1.0' }, capabilities: { tools: {} } } })
      return
    }
    if (request.method === 'tools/list') {
      write({ id: request.id, result: { tools } })
      return
    }
    if (request.method === 'tools/call') {
      write({ id: request.id, result: await callTool(request.params?.name || '', request.params?.arguments || {}) })
      return
    }
    write({ id: request.id, error: { code: -32601, message: 'Method not found' } })
  } catch (err) {
    write({ id: request.id, error: { code: -32000, message: err instanceof Error ? err.message : 'Tool call failed' } })
  }
})

async function callTool(name: string, args: Record<string, unknown>) {
  const snapshot = await getOpenBrainSnapshot()
  if (name === 'get_context_packet') return asText(snapshot.contextPacket)
  if (name === 'list_pending_memory_proposals') return asText(snapshot.proposals.filter((proposal) => proposal.status === 'pending'))
  if (name === 'compile_wiki_overlay') return asText({ mode: 'preview', pages: compileKarpathyWikiOverlay(snapshot.memories) })
  if (name === 'search_memory') {
    const query = String(args.query || '').toLowerCase()
    return asText({
      memories: snapshot.memories.filter((memory) => `${memory.title} ${memory.body}`.toLowerCase().includes(query)),
      sources: snapshot.sources.filter((source) => `${source.title} ${source.summary} ${source.path || ''}`.toLowerCase().includes(query)),
    })
  }
  if (name === 'capture_memory' || name === 'propose_memory_write') {
    const proposal = await createOpenBrainProposal({
      kind: args.kind as OpenBrainMemoryKind,
      title: String(args.title || ''),
      body: String(args.body || ''),
      privacyTier: args.privacyTier as OpenBrainPrivacyTier,
      confidence: typeof args.confidence === 'number' ? args.confidence : undefined,
      sourceIds: Array.isArray(args.sourceIds) ? args.sourceIds.filter((item): item is string => typeof item === 'string') : [],
      reason: String(args.reason || ''),
      createdBy: 'open-brain-mcp',
    })
    return asText({ proposal, approvalRequired: true })
  }
  if (name === 'link_memory_to_source') {
    return asText({
      approvalRequired: true,
      link: {
        memoryId: args.memoryId,
        sourceId: args.sourceId,
        relationship: args.relationship,
      },
      note: 'V1 returns a link proposal payload only; durable link persistence should go through proposal review.',
    })
  }
  throw new Error(`Unknown tool: ${name}`)
}

function asText(value: unknown) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2),
      },
    ],
  }
}

function write(value: unknown) {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

function proposalSchema() {
  return {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['fact', 'decision', 'preference', 'workflow', 'risk', 'operating_rule'] },
      title: { type: 'string' },
      body: { type: 'string' },
      privacyTier: { type: 'string', enum: ['public_safe', 'client_safe', 'internal_ops', 'private'] },
      confidence: { type: 'number' },
      sourceIds: { type: 'array', items: { type: 'string' } },
      reason: { type: 'string' },
    },
    required: ['kind', 'title', 'body', 'privacyTier', 'reason'],
  }
}
