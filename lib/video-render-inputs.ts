export type EffectiveVideoRenderInputs = Readonly<{ templateId: string | null; brandVoiceId: string | null }>

/** Resolve once before qualification; the provider must consume this exact snapshot. */
export function resolveVideoRenderInputs(input: { templateId?: unknown; brandVoiceId?: unknown } = {}): EffectiveVideoRenderInputs {
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
  return Object.freeze({
    templateId: text(input.templateId) || text(process.env.HEYGEN_TEMPLATE_ID) || null,
    brandVoiceId: text(input.brandVoiceId) || text(process.env.HEYGEN_BRAND_VOICE_ID) || null,
  })
}
