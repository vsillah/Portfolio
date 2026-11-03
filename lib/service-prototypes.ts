import captureManifest from '@/docs/qa/service-prototypes/capture-manifest.json'

export const SERVICE_PROTOTYPES = {
  'a479ce70-4856-4d3f-917b-c37bfff1f0a2': { slug: 'ai-lead-chatbot', title: 'AI Lead Chatbot', views: ['Website conversation', 'Operator inbox', 'Human handoff'] },
  'f463891c-e703-403b-97c2-e122aca42f29': { slug: 'lead-workflow-agent', title: 'Lead Workflow Agent', views: ['Intake board', 'Routing review', 'Recovery log'] },
  'a34b8a0a-d65c-42c8-970b-9a77e043e329': { slug: 'website-ux-refresh', title: 'Website UX Refresh', views: ['Built homepage', 'Family pathway', 'Mobile experience'] },
  'cd2c086a-26ec-4637-b7a3-129021c0bc19': { slug: 'accelerated-cohort', title: 'Accelerated Cohort Workshop', views: ['Cohort home', 'Live session', 'Learning plan'] },
  'e5c198bd-1276-45ee-abe3-9d9f85e1e3d2': { slug: 'self-paced-course', title: 'AI Training Course (Self-Paced)', views: ['Course home', 'Lesson player', 'Assessment'] },
  '1d797450-f350-457e-b7c4-d75164a76654': { slug: 'premium-masterclass', title: 'Premium AI Masterclass', views: ['Masterclass stage', 'Workbook', 'Executive Q&A'] },
} as const

export type PrototypeServiceId = keyof typeof SERVICE_PROTOTYPES
export type PrototypeSlug = (typeof SERVICE_PROTOTYPES)[PrototypeServiceId]['slug']

export function prototypeForService(id: string, currentUrl: string | null | undefined) {
  if (currentUrl) return null
  return SERVICE_PROTOTYPES[id as PrototypeServiceId] || null
}

export function prototypeForSlug(slug: string) {
  return Object.values(SERVICE_PROTOTYPES).find((prototype) => prototype.slug === slug) || null
}

export function prototypeGallery(id: string, currentUrl: string | null | undefined) {
  const prototype = prototypeForService(id, currentUrl)
  if (!prototype) return []
  const captures = captureManifest.filter((capture) => capture.slug === prototype.slug)
  if (captures.length !== 3 || captures.some((capture, index) => capture.view !== index + 1 || capture.imageUrl !== `/showcases/service-prototypes/${prototype.slug}-${index + 1}.webp`)) return []
  return prototype.views.map((view, index) => ({
    imageUrl: captures[index].imageUrl,
    alt: `${prototype.title}: ${view} in the working, synthetic-data prototype`,
    role: index === 0 ? 'hero' as const : 'product-in-use' as const,
    status: 'source capture' as const,
    label: 'Interactive prototype',
  }))
}
