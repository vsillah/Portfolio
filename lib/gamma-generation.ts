/**
 * Shared Gamma generation logic — used by the admin POST handler and auto-audit-summary worker.
 * Encapsulates: insert row → call Gamma API → poll → update row status.
 */

import { supabaseAdmin } from './supabase'
import { generateGamma, waitForGeneration, type GammaGenerateOptions } from './gamma-client'

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 3000

export interface GammaRowInsertParams {
  reportType: string
  title: string
  contactSubmissionId: number | null
  diagnosticAuditId: number | string | null
  valueReportId: string | null
  proposalId: string | null
  inputText: string
  externalInputs: Record<string, unknown>
  gammaOptions: GammaGenerateOptions
  createdBy: string | null
}

export interface GammaGenerationResult {
  reportId: string
  title: string
  gammaUrl: string | null
  generationId: string | null
  status: 'completed' | 'failed'
  credits?: { deducted: number; remaining: number }
  errorMessage?: string
}

/**
 * Insert a gamma_reports row. Returns the row id, or null if a conflict (duplicate) was hit.
 */
export async function insertGammaReportRow(
  params: GammaRowInsertParams
): Promise<{ id: string } | null> {
  if (!supabaseAdmin) throw new Error('supabaseAdmin not available')

  const { data: row, error } = await supabaseAdmin
    .from('gamma_reports')
    .insert({
      report_type: params.reportType,
      title: params.title,
      contact_submission_id: params.contactSubmissionId,
      diagnostic_audit_id: params.diagnosticAuditId,
      value_report_id: params.valueReportId,
      proposal_id: params.proposalId,
      input_text: params.inputText,
      external_inputs: params.externalInputs,
      gamma_options: params.gammaOptions,
      status: 'generating',
      created_by: params.createdBy,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return null
    throw error
  }
  return row
}

/**
 * Run Gamma API generation for an existing gamma_reports row:
 * call generateGamma → poll waitForGeneration → update row to completed/failed.
 * Retries transient API errors up to MAX_RETRIES times.
 */
export async function runGammaGeneration(
  reportId: string,
  inputText: string,
  options: GammaGenerateOptions
): Promise<GammaGenerationResult> {
  if (!supabaseAdmin) throw new Error('supabaseAdmin not available')

  let lastError: string | undefined

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.info(`[gamma-generation] Retry ${attempt}/${MAX_RETRIES} for report ${reportId}`)
      }

      const { generationId } = await generateGamma(inputText, options)

      await supabaseAdmin
        .from('gamma_reports')
        .update({ gamma_generation_id: generationId })
        .eq('id', reportId)

      const result = await waitForGeneration(generationId)

      if (result.status === 'failed') {
        lastError = result.error?.message || 'Generation failed'
        if (attempt < MAX_RETRIES) {
          console.warn(`[gamma-generation] Gamma returned failed for report ${reportId}, will retry`)
          await sleep(RETRY_DELAY_MS * (attempt + 1))
          continue
        }
        break
      }

      await supabaseAdmin
        .from('gamma_reports')
        .update({
          status: 'completed',
          gamma_url: result.gammaUrl,
          gamma_generation_id: result.generationId,
        })
        .eq('id', reportId)

      return {
        reportId,
        title: '',
        gammaUrl: result.gammaUrl ?? null,
        generationId: result.generationId,
        status: 'completed',
        credits: result.credits,
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown Gamma error'
      if (attempt < MAX_RETRIES && isTransient(err)) {
        console.warn(`[gamma-generation] Transient error for report ${reportId}: ${lastError}, will retry`)
        await sleep(RETRY_DELAY_MS * (attempt + 1))
        continue
      }
      break
    }
  }

  const errorMessage = lastError || 'Gamma generation failed after retries'
  await supabaseAdmin
    .from('gamma_reports')
    .update({ status: 'failed', error_message: errorMessage })
    .eq('id', reportId)

  return {
    reportId,
    title: '',
    gammaUrl: null,
    generationId: null,
    status: 'failed',
    errorMessage,
  }
}

function isTransient(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return msg.includes('timeout') || msg.includes('429') || msg.includes('503') || msg.includes('network')
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
