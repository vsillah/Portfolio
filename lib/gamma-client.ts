/**
 * Gamma API client — thin wrapper around the Gamma Generate API v1.0.
 * Handles authentication, generation requests, polling, and status checks.
 *
 * API docs: https://developers.gamma.app/reference
 */

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0'

function getApiKey(): string {
  const key = process.env.GAMMA_API_KEY
  if (!key) throw new Error('GAMMA_API_KEY environment variable is not set')
  return key
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GammaGenerateOptions {
  textMode?: 'generate' | 'condense' | 'preserve'
  format?: 'presentation' | 'document' | 'webpage' | 'social'
  themeId?: string
  numCards?: number
  cardSplit?: 'auto' | 'inputTextBreaks'
  additionalInstructions?: string
  exportAs?: 'pdf' | 'pptx'
  textOptions?: {
    amount?: 'brief' | 'medium' | 'detailed' | 'extensive'
    tone?: string
    audience?: string
    language?: string
  }
  imageOptions?: {
    source?: 'aiGenerated' | 'pictographic' | 'unsplash' | 'webAllImages' | 'noImages'
    model?: string
    style?: string
  }
  cardOptions?: {
    dimensions?: string
    headerFooter?: Record<string, unknown>
  }
  sharingOptions?: {
    workspaceAccess?: 'noAccess' | 'view' | 'comment' | 'edit' | 'fullAccess'
    externalAccess?: 'noAccess' | 'view' | 'comment' | 'edit'
  }
}

export interface GammaGenerateResult {
  generationId: string
}

export interface GammaStatusResult {
  generationId: string
  status: 'pending' | 'completed' | 'failed'
  gammaUrl?: string
  credits?: { deducted: number; remaining: number }
  error?: { message: string; statusCode: number }
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * Start a Gamma generation. Returns immediately with a generationId.
 */
export async function generateGamma(
  inputText: string,
  options: GammaGenerateOptions = {}
): Promise<GammaGenerateResult> {
  const body: Record<string, unknown> = {
    inputText,
    textMode: options.textMode ?? 'generate',
  }

  if (options.format) body.format = options.format
  if (options.themeId) body.themeId = options.themeId
  if (options.numCards) body.numCards = options.numCards
  if (options.cardSplit) body.cardSplit = options.cardSplit
  if (options.additionalInstructions) body.additionalInstructions = options.additionalInstructions
  if (options.exportAs) body.exportAs = options.exportAs
  if (options.textOptions) body.textOptions = options.textOptions
  if (options.imageOptions) body.imageOptions = options.imageOptions
  if (options.cardOptions) body.cardOptions = options.cardOptions
  if (options.sharingOptions) body.sharingOptions = options.sharingOptions

  const res = await fetch(`${GAMMA_API_BASE}/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': getApiKey(),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(
      `Gamma API error ${res.status}: ${(errBody as Record<string, unknown>).message || res.statusText}`
    )
  }

  return (await res.json()) as GammaGenerateResult
}

/**
 * Check the status of a generation.
 */
export async function getGenerationStatus(generationId: string): Promise<GammaStatusResult> {
  const res = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
    method: 'GET',
    headers: { 'X-API-KEY': getApiKey() },
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(
      `Gamma status check error ${res.status}: ${(errBody as Record<string, unknown>).message || res.statusText}`
    )
  }

  return (await res.json()) as GammaStatusResult
}

/**
 * Poll until generation completes or fails.
 * Default: poll every 5s, timeout after 5 minutes.
 */
export async function waitForGeneration(
  generationId: string,
  opts?: { intervalMs?: number; timeoutMs?: number }
): Promise<GammaStatusResult> {
  const interval = opts?.intervalMs ?? 5000
  const timeout = opts?.timeoutMs ?? 300_000
  const start = Date.now()

  while (Date.now() - start < timeout) {
    const status = await getGenerationStatus(generationId)

    if (status.status === 'completed' || status.status === 'failed') {
      return status
    }

    await new Promise((r) => setTimeout(r, interval))
  }

  throw new Error(`Gamma generation ${generationId} timed out after ${timeout / 1000}s`)
}

/**
 * Generate a Gamma presentation and wait for completion.
 * Convenience wrapper that combines generateGamma + waitForGeneration.
 */
export async function generateAndWait(
  inputText: string,
  options: GammaGenerateOptions = {}
): Promise<GammaStatusResult> {
  const { generationId } = await generateGamma(inputText, options)
  return waitForGeneration(generationId)
}
