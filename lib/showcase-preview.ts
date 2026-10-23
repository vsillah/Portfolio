/**
 * Review-only card visuals. A replacement is used only while the public record
 * still points at the audited source URL (or still has no image). The canonical
 * database fields and the existing visual-assets approval workflow stay intact.
 * Merging this branch is a separate captain/Human QA decision.
 */
export const SHOWCASE_PREVIEW_REVISION = '2026-10-22-a' as const

type Entity = 'project' | 'prototype' | 'service' | 'product'
type Kind = 'live_capture' | 'source_capture_composition' | 'illustrative_concept'

interface PreviewVisual {
  entity: Entity
  id: string
  expectedCurrentUrl: string | null
  previewUrl: string
  kind: Kind
  alt: string
}

export const SHOWCASE_PREVIEW_VISUALS: readonly PreviewVisual[] = [
  { entity: 'product', id: '11', expectedCurrentUrl: '/audit_calculator_img.png', previewUrl: '/showcases/product-ai-audit-capture.png', kind: 'source_capture_composition', alt: 'AI Audit Calculator source UI capture showing an assessment result' },
  { entity: 'product', id: '17', expectedCurrentUrl: '/Chatbot_N8N_img.png', previewUrl: '/showcases/product-chatbot-capture.png', kind: 'source_capture_composition', alt: 'Chatbot Template source capture showing the conversation workflow' },
  { entity: 'product', id: '18', expectedCurrentUrl: '/Leadgen_N8N_img.png', previewUrl: '/showcases/product-leadgen-workflow-v2.png', kind: 'illustrative_concept', alt: 'Illustrative concept of the Lead Generation Template workflow, derived from a public source image' },
  { entity: 'product', id: '19', expectedCurrentUrl: '/Eval_Template_SS.png', previewUrl: '/showcases/product-eval-capture.png', kind: 'source_capture_composition', alt: 'Eval Template source capture showing the LLM grading interface' },
  { entity: 'product', id: '20', expectedCurrentUrl: '/Chatbot_diagnostic_img.png', previewUrl: '/showcases/product-diagnostic-concept-v2.png', kind: 'illustrative_concept', alt: 'Illustrative concept for Diagnostic Template with empty intake fields and no customer data' },
  { entity: 'product', id: '21', expectedCurrentUrl: '/FB_WarmLead_Pack.png', previewUrl: '/showcases/product-warm-lead-capture.png', kind: 'source_capture_composition', alt: 'n8n Warm Lead Pack source capture showing a workflow graph' },
  { entity: 'project', id: '1', expectedCurrentUrl: 'https://www.fidelity.com/bin-public/060_www_fidelity_com/images/LandingZones/full-view_desktop.png', previewUrl: '/showcases/fidelity-fullview-concept.svg', kind: 'illustrative_concept', alt: 'Illustrative concept of workplace and retail accounts joining in one view' },
  { entity: 'project', id: '2', expectedCurrentUrl: 'https://www.fidelity.com/bin-public/600_Fidelity_Com_English/images/migration/article/content_10/use_alerts_banner.png', previewUrl: '/showcases/fidelity-dividend-alert-concept.svg', kind: 'illustrative_concept', alt: 'Illustrative concept of a dividend event reaching a mobile investor' },
  { entity: 'project', id: '3', expectedCurrentUrl: 'https://www.fidelity.com/bin-public/600_Fidelity_Com_English/images/homepage/at/jpeg_at/Trader-HP-self-directed-new.jpg', previewUrl: '/showcases/fidelity-portfolio-summary-concept.svg', kind: 'illustrative_concept', alt: 'Illustrative concept of configurable portfolio summary cards' },
  { entity: 'project', id: '4', expectedCurrentUrl: 'https://byoriebhtbysanjhimlu.supabase.co/storage/v1/object/public/projects/project-4/dark-castle-welcome-poster.png', previewUrl: '/showcases/dark-castle-live-20261022.png', kind: 'live_capture', alt: 'Live Dark Castle Chess welcome page with chess board and Play free action' },
  { entity: 'prototype', id: '448d2fc4-6aac-404d-9f69-cd6056341ba2', expectedCurrentUrl: 'https://byoriebhtbysanjhimlu.supabase.co/storage/v1/object/public/projects/project-4/dark-castle-welcome-poster.png', previewUrl: '/showcases/dark-castle-live-20261022.png', kind: 'live_capture', alt: 'Live Dark Castle Chess welcome page with chess board and Play free action' },
  { entity: 'prototype', id: 'fba647d5-0431-4097-9cfd-72dc1e9f8b58', expectedCurrentUrl: 'https://byoriebhtbysanjhimlu.supabase.co/storage/v1/object/public/prototypes/prototypes/fba647d5-0431-4097-9cfd-72dc1e9f8b58/thumbnails/1768590541747-sbb5dx.png', previewUrl: '/showcases/reversr-drive-capture-20261022.png', kind: 'live_capture', alt: 'ReversR app capture showing the Design step and product concept drawing' },
  { entity: 'prototype', id: 'ea1505af-2ddf-43ff-a6fd-015ac8445ad6', expectedCurrentUrl: 'https://byoriebhtbysanjhimlu.supabase.co/storage/v1/object/public/prototypes/prototypes/ea1505af-2ddf-43ff-a6fd-015ac8445ad6/thumbnails/1768590641469-p18cts.png', previewUrl: '/showcases/inclusivo-live-20261022.png', kind: 'live_capture', alt: 'Live InclusivO landing page with document style extraction steps' },
  { entity: 'service', id: 'a479ce70-4856-4d3f-917b-c37bfff1f0a2', expectedCurrentUrl: null, previewUrl: '/showcases/service-inbound-chatbot-concept.svg', kind: 'illustrative_concept', alt: 'Illustrative concept of an inbound chat inquiry becoming a reviewed lead' },
  { entity: 'service', id: 'f463891c-e703-403b-97c2-e122aca42f29', expectedCurrentUrl: null, previewUrl: '/showcases/service-lead-workflow-concept.svg', kind: 'illustrative_concept', alt: 'Illustrative concept of signal, qualification, review, and CRM handoff' },
  { entity: 'service', id: 'a34b8a0a-d65c-42c8-970b-9a77e043e329', expectedCurrentUrl: null, previewUrl: '/showcases/service-website-ux-concept.svg', kind: 'illustrative_concept', alt: 'Illustrative concept comparing a cluttered page with a clear next action' },
  { entity: 'service', id: 'cd2c086a-26ec-4637-b7a3-129021c0bc19', expectedCurrentUrl: null, previewUrl: '/showcases/service-accelerated-cohort-concept.svg', kind: 'illustrative_concept', alt: 'Illustrative concept of a cohort moving from problem to plan to build' },
  { entity: 'service', id: 'e5c198bd-1276-45ee-abe3-9d9f85e1e3d2', expectedCurrentUrl: null, previewUrl: '/showcases/service-self-paced-course-concept.svg', kind: 'illustrative_concept', alt: 'Illustrative concept of self-paced lessons and course path' },
  { entity: 'service', id: '1d797450-f350-457e-b7c4-d75164a76654', expectedCurrentUrl: null, previewUrl: '/showcases/service-masterclass-concept.svg', kind: 'illustrative_concept', alt: 'Illustrative concept of masterclass build lab and review checkpoint' },
] as const

export function resolveShowcasePreview(entity: Entity, id: string | number, currentUrl: string | null | undefined) {
  const current = currentUrl || null
  return SHOWCASE_PREVIEW_VISUALS.find((visual) =>
    visual.entity === entity && visual.id === String(id) && visual.expectedCurrentUrl === current
  ) || null
}
