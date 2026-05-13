#!/usr/bin/env tsx
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import {
  compileKarpathyWikiOverlay,
  createOpenBrainProposal,
  getOpenBrainSnapshot,
  linkOpenBrainRecords,
  type OpenBrainMemoryKind,
  type OpenBrainPrivacyTier,
} from '../lib/open-brain'

type OpenBrainMcpServer = Pick<McpServer, 'registerTool'>

export function registerOpenBrainTools(target: OpenBrainMcpServer) {
  target.registerTool('capture_memory', {
    description: 'Create an approval-gated Open Brain memory proposal. Durable memory writes still require approval.',
    inputSchema: proposalSchema(),
  }, async (args) => createProposalToolResult(args))

  target.registerTool('search_memory', {
    description: 'Search approved local Open Brain memories and source projections.',
    inputSchema: {
      query: z.string(),
    },
  }, async ({ query }) => {
    const snapshot = await getOpenBrainSnapshot()
    const normalizedQuery = query.toLowerCase()
    return asText({
      memories: snapshot.memories.filter((memory) => `${memory.title} ${memory.body}`.toLowerCase().includes(normalizedQuery)),
      sources: snapshot.sources.filter((source) => `${source.title} ${source.summary} ${source.path || ''}`.toLowerCase().includes(normalizedQuery)),
    })
  })

  target.registerTool('get_context_packet', {
    description: 'Return the compact context packet agents should read before acting.',
    inputSchema: {},
  }, async () => {
    const snapshot = await getOpenBrainSnapshot()
    return asText(snapshot.contextPacket)
  })

  target.registerTool('propose_memory_write', {
    description: 'Create an approval-gated proposed memory write.',
    inputSchema: proposalSchema(),
  }, async (args) => createProposalToolResult(args))

  target.registerTool('list_pending_memory_proposals', {
    description: 'List pending Open Brain memory proposals.',
    inputSchema: {},
  }, async () => {
    const snapshot = await getOpenBrainSnapshot()
    return asText(snapshot.proposals.filter((proposal) => proposal.status === 'pending'))
  })

  target.registerTool('link_memory_to_source', {
    description: 'Create an auditable local Open Brain link between an approved memory and source record.',
    inputSchema: {
      memoryId: z.string(),
      sourceId: z.string(),
      relationship: z.string(),
    },
  }, async ({ memoryId, sourceId, relationship }) => {
    const snapshot = await getOpenBrainSnapshot()
    if (!snapshot.memories.some((memory) => memory.id === memoryId)) throw new Error('Memory not found.')
    if (!snapshot.sources.some((source) => source.id === sourceId)) throw new Error('Source not found.')
    const link = await linkOpenBrainRecords({ fromId: memoryId, toId: sourceId, relationship })
    return asText({
      link,
      note: 'Link recorded locally. This does not promote any memory, mutate agent config, or write to public docs.',
    })
  })

  target.registerTool('compile_wiki_overlay', {
    description: 'Compile Karpathy Wiki overlay previews from approved non-private memories.',
    inputSchema: {},
  }, async () => {
    const snapshot = await getOpenBrainSnapshot()
    return asText({ mode: 'preview', pages: compileKarpathyWikiOverlay(snapshot.memories, snapshot.events) })
  })
}

export async function createProposalToolResult(args: {
  kind: OpenBrainMemoryKind
  title: string
  body: string
  privacyTier: OpenBrainPrivacyTier
  confidence?: number
  sourceIds?: string[]
  reason: string
}) {
  const proposal = await createOpenBrainProposal({
    kind: args.kind,
    title: args.title,
    body: args.body,
    privacyTier: args.privacyTier,
    confidence: args.confidence,
    sourceIds: args.sourceIds || [],
    reason: args.reason,
    createdBy: 'open-brain-mcp',
  })
  return asText({ proposal, approvalRequired: true })
}

export function asText(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  }
}

export function proposalSchema() {
  return {
    kind: z.enum(['fact', 'decision', 'preference', 'workflow', 'risk', 'operating_rule']),
    title: z.string(),
    body: z.string(),
    privacyTier: z.enum(['public_safe', 'client_safe', 'internal_ops', 'private']),
    confidence: z.number().optional(),
    sourceIds: z.array(z.string()).optional(),
    reason: z.string(),
  }
}

async function main() {
  const server = new McpServer({
    name: 'portfolio-open-brain',
    version: '0.2.0',
  })
  registerOpenBrainTools(server)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[open-brain-mcp] Server error:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
