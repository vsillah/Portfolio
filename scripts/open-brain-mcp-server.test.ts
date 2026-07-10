import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  asText,
  createProposalToolResult,
  extractUnifiedDiffPaths,
  proposalSchema,
  registerOpenBrainTools,
  resolveAllowedUpdatePath,
} from './open-brain-mcp-server'

type MockMemory = { id: string; title: string; body: string }
type MockSource = { id: string; title: string; summary: string; path: string | null }
type MockProposal = { id: string; status: string }
type MockSnapshot = {
  memories: MockMemory[]
  sources: MockSource[]
  proposals: MockProposal[]
  events: Array<Record<string, unknown>>
  contextPacket: Record<string, unknown>
}

const openBrainMocks = vi.hoisted(() => {
  const emptySnapshot = (): MockSnapshot => ({
    memories: [],
    sources: [],
    proposals: [],
    events: [],
    contextPacket: {},
  })

  return {
    compileKarpathyWikiOverlay: vi.fn(() => [{ slug: 'approved-overlay' }]),
    createOpenBrainProposal: vi.fn(async (input: Record<string, unknown>) => ({
      id: 'proposal:test-memory',
      status: 'pending',
      ...input,
    })),
    getOpenBrainSnapshot: vi.fn(async (): Promise<MockSnapshot> => emptySnapshot()),
    linkOpenBrainRecords: vi.fn(async (input: Record<string, unknown>) => ({
      id: 'link:test',
      ...input,
    })),
  }
})

vi.mock('../lib/open-brain', () => openBrainMocks)

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>
type RegisteredTool = {
  name: string
  config: {
    description?: string
    inputSchema?: Record<string, unknown>
  }
  handler: ToolHandler
}

function captureRegisteredTools() {
  const tools: RegisteredTool[] = []
  type RegisterableServer = Parameters<typeof registerOpenBrainTools>[0]
  const fakeServer: RegisterableServer = {
    registerTool: ((name: string, config: unknown, handler: unknown) => {
      tools.push({
        name,
        config: config as RegisteredTool['config'],
        handler: handler as ToolHandler,
      })
    }) as RegisterableServer['registerTool'],
  }

  registerOpenBrainTools(fakeServer)
  return tools
}

function requireTool(tools: RegisteredTool[], name: string) {
  const tool = tools.find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`Missing registered tool ${name}`)
  return tool
}

function parseTextResult<T>(result: unknown): T {
  const content = (result as { content?: Array<{ type?: string; text?: string }> }).content
  expect(content).toHaveLength(1)
  expect(content?.[0]).toEqual(expect.objectContaining({ type: 'text' }))
  return JSON.parse(content?.[0].text ?? 'null') as T
}

describe('open-brain MCP server tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers the standards-compliant Open Brain tool surface', () => {
    const tools = captureRegisteredTools()

    expect(tools).toHaveLength(10)
    expect(tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      'capture_memory',
      'search_memory',
      'get_context_packet',
      'propose_memory_write',
      'list_pending_memory_proposals',
      'link_memory_to_source',
      'compile_wiki_overlay',
      'get_update_workspace_context',
      'read_update_target',
      'apply_portfolio_patch',
    ]))

    const schema = proposalSchema()
    expect(schema.kind.safeParse('decision').success).toBe(true)
    expect(schema.kind.safeParse('unknown').success).toBe(false)
    expect(schema.privacyTier.safeParse('internal_ops').success).toBe(true)
    expect(schema.privacyTier.safeParse('public').success).toBe(false)
  })

  it('creates approval-gated proposals with the MCP server identity', async () => {
    const result = await createProposalToolResult({
      kind: 'workflow',
      title: 'Capture tested memory',
      body: 'Durable writes require approval before promotion.',
      privacyTier: 'internal_ops',
      reason: 'regression coverage',
    })

    expect(openBrainMocks.createOpenBrainProposal).toHaveBeenCalledWith(expect.objectContaining({
      createdBy: 'open-brain-mcp',
      sourceIds: [],
      title: 'Capture tested memory',
    }))

    const payload = parseTextResult<{
      approvalRequired: boolean
      proposal: { id: string; createdBy: string; status: string }
    }>(result)
    expect(payload.approvalRequired).toBe(true)
    expect(payload.proposal).toEqual(expect.objectContaining({
      id: 'proposal:test-memory',
      createdBy: 'open-brain-mcp',
      status: 'pending',
    }))
  })

  it('filters memory and source search results case-insensitively', async () => {
    openBrainMocks.getOpenBrainSnapshot.mockResolvedValueOnce({
      memories: [
        { id: 'memory:keep', title: 'Governance rule', body: 'Approval before publish' },
        { id: 'memory:skip', title: 'Unrelated', body: 'Separate operating note' },
      ],
      sources: [
        { id: 'source:keep', title: 'Runbook', summary: 'Governance checklist', path: 'docs/runbook.md' },
        { id: 'source:skip', title: 'Other', summary: 'No match', path: null },
      ],
      proposals: [],
      events: [],
      contextPacket: {},
    })

    const tools = captureRegisteredTools()
    const result = await requireTool(tools, 'search_memory').handler({ query: 'governance' })
    const payload = parseTextResult<{
      memories: Array<{ id: string }>
      sources: Array<{ id: string }>
    }>(result)

    expect(payload.memories.map((memory) => memory.id)).toEqual(['memory:keep'])
    expect(payload.sources.map((source) => source.id)).toEqual(['source:keep'])
  })

  it('prevents orphan source links before writing link records', async () => {
    openBrainMocks.getOpenBrainSnapshot.mockResolvedValueOnce({
      memories: [],
      sources: [{ id: 'source:existing', title: 'Runbook', summary: 'Summary', path: null }],
      proposals: [],
      events: [],
      contextPacket: {},
    })

    const tools = captureRegisteredTools()
    await expect(requireTool(tools, 'link_memory_to_source').handler({
      memoryId: 'memory:missing',
      sourceId: 'source:existing',
      relationship: 'derived_from',
    })).rejects.toThrow('Memory not found.')
    expect(openBrainMocks.linkOpenBrainRecords).not.toHaveBeenCalled()

    openBrainMocks.getOpenBrainSnapshot.mockResolvedValueOnce({
      memories: [{ id: 'memory:existing', title: 'Approved memory', body: 'Body' }],
      sources: [],
      proposals: [],
      events: [],
      contextPacket: {},
    })

    await expect(requireTool(tools, 'link_memory_to_source').handler({
      memoryId: 'memory:existing',
      sourceId: 'source:missing',
      relationship: 'derived_from',
    })).rejects.toThrow('Source not found.')
    expect(openBrainMocks.linkOpenBrainRecords).not.toHaveBeenCalled()
  })

  it('serializes tool payloads as MCP text content', () => {
    expect(asText({ ok: true })).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ ok: true }, null, 2),
        },
      ],
    })
  })

  it('extracts changed file paths from unified diffs', () => {
    expect(extractUnifiedDiffPaths([
      'diff --git a/docs/open-brain-local-service.md b/docs/open-brain-local-service.md',
      '--- a/docs/open-brain-local-service.md',
      '+++ b/docs/open-brain-local-service.md',
      '@@ -1,2 +1,2 @@',
      'diff --git a/scripts/open-brain-mcp-server.ts b/scripts/open-brain-mcp-server.ts',
      '--- a/scripts/open-brain-mcp-server.ts',
      '+++ b/scripts/open-brain-mcp-server.ts',
    ].join('\n'))).toEqual([
      'docs/open-brain-local-service.md',
      'scripts/open-brain-mcp-server.ts',
    ])
  })

  it('enforces scoped update paths for the LM Studio patch lane', () => {
    expect(resolveAllowedUpdatePath('docs/open-brain-local-service.md', 'open_brain', '/tmp/portfolio')).toEqual({
      relativePath: 'docs/open-brain-local-service.md',
      absolutePath: '/tmp/portfolio/docs/open-brain-local-service.md',
    })
    expect(() => resolveAllowedUpdatePath('components/Hero.tsx', 'open_brain', '/tmp/portfolio')).toThrow(
      'outside the open_brain update scope',
    )
    expect(resolveAllowedUpdatePath('components/Hero.tsx', 'portfolio', '/tmp/portfolio').relativePath).toBe(
      'components/Hero.tsx',
    )
    expect(() => resolveAllowedUpdatePath('../.env.local', 'portfolio', '/tmp/portfolio')).toThrow(
      'Path escapes Portfolio root',
    )
    expect(() => resolveAllowedUpdatePath('local-private/notes.md', 'portfolio', '/tmp/portfolio')).toThrow(
      'Blocked path segment',
    )
    expect(() => resolveAllowedUpdatePath('public/generated.png', 'portfolio', '/tmp/portfolio')).toThrow(
      'Blocked generated or binary file',
    )
  })
})
