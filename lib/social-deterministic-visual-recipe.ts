import type { FrameworkVisualType } from '@/lib/social-content'
import type { DeterministicVisualSpec } from '@/lib/social-practitioner-content'

export type DeterministicVisualTemplate = DeterministicVisualSpec['template']
export type DeterministicVisualAspectRatio = DeterministicVisualSpec['aspect_ratio']

export type DeterministicVisualRecipeSelection = {
  template: DeterministicVisualTemplate
  visual_type: FrameworkVisualType
  aspect_ratio: DeterministicVisualAspectRatio
}

export const DETERMINISTIC_VISUAL_RENDER_MODE = 'provider_none_structured_html_svg' as const

export const DETERMINISTIC_VISUAL_TEMPLATE_OPTIONS: Array<{
  value: DeterministicVisualTemplate
  label: string
  description: string
  allowed_visual_types: FrameworkVisualType[]
}> = [
  {
    value: 'constraint_decision_result',
    label: 'Constraint → decision → result',
    description: 'Three connected proof nodes arranged as one ordered operating path.',
    allowed_visual_types: ['architecture'],
  },
  {
    value: 'practitioner_signal_card',
    label: 'Practitioner signal card',
    description: 'Reserved for a future deterministic composition; no renderer is enabled yet.',
    allowed_visual_types: [],
  },
]

export const DETERMINISTIC_VISUAL_ASPECT_RATIO_OPTIONS: Array<{
  value: DeterministicVisualAspectRatio
  label: string
}> = [
  { value: '1.91:1', label: '1.91:1 · landscape social' },
  { value: '1:1', label: '1:1 · square' },
  { value: '4:5', label: '4:5 · portrait feed' },
  { value: '9:16', label: '9:16 · vertical story' },
]

export function deterministicVisualTemplateOption(template: string | null | undefined) {
  return DETERMINISTIC_VISUAL_TEMPLATE_OPTIONS.find((option) => option.value === template) ?? null
}

export function deterministicVisualTemplateLabel(template: string | null | undefined) {
  return deterministicVisualTemplateOption(template)?.label ?? 'Unsupported template'
}

export function deterministicVisualAllowedTypes(template: string | null | undefined) {
  return deterministicVisualTemplateOption(template)?.allowed_visual_types ?? []
}

export function deterministicVisualRecipeCombinationIssue(
  selection: Partial<DeterministicVisualRecipeSelection>,
): string | null {
  const template = deterministicVisualTemplateOption(selection.template)
  if (!template) return 'Choose a supported deterministic template before rebuilding the recipe.'
  if (!selection.visual_type) {
    return template.allowed_visual_types.length
      ? `Choose ${template.allowed_visual_types.join(' or ')} for the ${template.label} template.`
      : `${template.label} does not have an enabled deterministic renderer. Choose Constraint → decision → result to continue.`
  }
  if (!template.allowed_visual_types.includes(selection.visual_type)) {
    return `${template.label} cannot render the ${selection.visual_type.replace(/_/g, ' ')} composition. Choose a supported template and visual-type pair; the renderer will not substitute an architecture graphic.`
  }
  if (!DETERMINISTIC_VISUAL_ASPECT_RATIO_OPTIONS.some((option) => option.value === selection.aspect_ratio)) {
    return 'Choose a supported aspect ratio before rebuilding the recipe.'
  }
  return null
}
