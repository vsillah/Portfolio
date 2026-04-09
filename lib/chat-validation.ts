import { z } from 'zod'

const MAX_MESSAGE_LENGTH = 4000
const MAX_NAME_LENGTH = 200
const MAX_EMAIL_LENGTH = 320

/**
 * Client-generated chat session IDs (see lib/chat-utils `generateSessionId`, E2E test-client)
 * are not UUIDs. DB stores `session_id` as TEXT.
 */
export const chatSessionIdSchema = z
  .string()
  .min(8, 'Session ID too short')
  .max(200, 'Session ID too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid session ID format')

const diagnosticCategoryValues = [
  'business_challenges',
  'tech_stack',
  'automation_needs',
  'ai_readiness',
  'budget_timeline',
  'decision_making',
] as const

const diagnosticProgressSchema = z.object({
  completedCategories: z.array(z.enum(diagnosticCategoryValues)).default([]),
  questionsAsked: z.array(z.string()).default([]),
  responsesReceived: z.record(z.string(), z.unknown()).default({}),
  currentCategory: z.enum(diagnosticCategoryValues).optional(),
})

/**
 * Zod schema for POST /api/chat body.
 * Validates and constrains all fields before DB writes or n8n calls.
 */
export const chatMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'Message is required')
    .max(MAX_MESSAGE_LENGTH, `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer`)
    .transform((s) => s.trim()),
  sessionId: chatSessionIdSchema.optional(),
  userId: z.string().uuid().optional(),
  visitorEmail: z.string().email().max(MAX_EMAIL_LENGTH).optional().or(z.literal('')),
  visitorName: z.string().max(MAX_NAME_LENGTH).optional().or(z.literal('')),
  diagnosticMode: z.boolean().optional(),
  diagnosticAuditId: z.string().uuid().optional(),
  diagnosticProgress: diagnosticProgressSchema.optional().nullable(),
})

export type ChatMessageInput = z.infer<typeof chatMessageSchema>

/**
 * Schema for GET query params on /api/chat/history and /api/chat/context.
 */
export const sessionIdParamSchema = z.object({
  sessionId: chatSessionIdSchema,
})

/**
 * Schema for GET query params on /api/chat/diagnostic.
 */
export const diagnosticGetSchema = z
  .object({
    sessionId: chatSessionIdSchema.optional(),
    auditId: z.string().uuid().optional(),
  })
  .refine((d) => d.sessionId || d.auditId, {
    message: 'sessionId or auditId is required',
  })

/**
 * Schema for PUT /api/chat/diagnostic body.
 */
export const diagnosticPutSchema = z.object({
  auditId: z.string().uuid('Invalid auditId format'),
  status: z.enum(['completed', 'in_progress', 'abandoned']).optional(),
  diagnosticData: z.record(z.string(), z.unknown()).optional(),
  currentCategory: z.enum(diagnosticCategoryValues).optional(),
  progress: diagnosticProgressSchema.optional(),
})

/**
 * Schema for POST /api/chat/send-email body.
 */
export const sendEmailSchema = z.object({
  to: z.string().email().max(MAX_EMAIL_LENGTH),
  templateType: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
  sessionId: chatSessionIdSchema,
})

/**
 * Helper: returns a user-safe 400 response for Zod validation errors.
 */
export function zodErrorResponse(error: z.ZodError) {
  const firstIssue = error.issues[0]
  const detail = firstIssue
    ? `${firstIssue.path.join('.')}: ${firstIssue.message}`
    : 'Invalid request data'
  return { error: 'Invalid request', detail, status: 400 as const }
}
