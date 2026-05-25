import PptxGenJS from 'pptxgenjs'

export interface ContentPackagePptxOutput {
  output_type: string
  title: string
  body: string | null
  payload: Record<string, unknown> | null
}

export interface ContentPackagePptxInput {
  title: string
  sourcePacket: Record<string, unknown>
  researchPacket: Record<string, unknown>
  presentationPlan: Record<string, unknown>
  outputs: ContentPackagePptxOutput[]
}

const COLORS = {
  navy: '071525',
  ink: '111827',
  slate: '334155',
  muted: '64748B',
  gold: 'D4AF37',
  cream: 'F8F3E8',
  white: 'FFFFFF',
  line: 'CBD5E1',
}

export async function buildContentPackagePptxBuffer(input: ContentPackagePptxInput): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'AmaduTown Advisory'
  pptx.company = 'AmaduTown Advisory'
  pptx.subject = 'Voice-note content package'
  pptx.title = input.title
  pptx.theme = {
    headFontFace: 'Aptos Display',
    bodyFontFace: 'Aptos',
  }

  addCoverSlide(pptx, input)
  addSourceSlide(pptx, input)
  addFrameworkSlide(pptx, input)
  addContentSlide(pptx, input)
  addMediaSlide(pptx, input)
  addApprovalSlide(pptx, input)
  addAppendixSlide(pptx, input)

  const stream = await pptx.write({ outputType: 'nodebuffer' })
  if (Buffer.isBuffer(stream)) return stream
  if (stream instanceof Uint8Array) return Buffer.from(stream)
  if (stream instanceof ArrayBuffer) return Buffer.from(stream)
  throw new Error('PPTX generation returned an unsupported output type.')
}

export function contentPackagePptxFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'content-package'
  return `${slug}.pptx`
}

function addCoverSlide(pptx: PptxGenJS, input: ContentPackagePptxInput) {
  const slide = pptx.addSlide()
  paintHeader(slide, 'Voice-note content package')
  slide.addText(input.title, {
    x: 0.75,
    y: 1.25,
    w: 7.2,
    h: 1.4,
    fontFace: 'Aptos Display',
    fontSize: 34,
    bold: true,
    color: COLORS.white,
    breakLine: false,
    fit: 'shrink',
  })
  slide.addText(String(input.sourcePacket.topic ?? input.sourcePacket.title ?? 'Source-backed content system'), {
    x: 0.8,
    y: 2.75,
    w: 7.5,
    h: 0.65,
    fontSize: 15,
    color: COLORS.cream,
    fit: 'shrink',
  })
  slide.addShape(pptx.ShapeType.rect, {
    x: 8.65,
    y: 1.15,
    w: 3.75,
    h: 4.9,
    fill: { color: COLORS.cream },
    line: { color: COLORS.gold, width: 1 },
  })
  addStat(slide, 'Source', String(input.sourcePacket.source_type ?? 'voice_note'), 9, 1.55)
  addStat(slide, 'Outputs', String(input.sourcePacket.target_outputs ? asList(input.sourcePacket.target_outputs).length : input.outputs.length), 9, 2.45)
  addStat(slide, 'Approval gates', '3', 9, 3.35)
  addStat(slide, 'Deck status', 'Draft', 9, 4.25)
  addFooter(slide, 1)
}

function addSourceSlide(pptx: PptxGenJS, input: ContentPackagePptxInput) {
  const slide = baseSlide(pptx, '01', 'The raw note stays attached to the work')
  const excerpt = String(input.sourcePacket.transcript_excerpt ?? '')
  slide.addText('Source excerpt', headingBox(0.8, 1.25, 4.8))
  slide.addText(truncate(excerpt, 800), bodyBox(0.8, 1.75, 5.15, 4.5))
  slide.addText('Operating boundary', headingBox(6.35, 1.25, 4.8))
  slide.addText([
    'Private corpus and Chronicle material inform framing.',
    'Raw private material should not be quoted in public output without explicit approval.',
    'The transcript, framework context, proof routes, and drafts remain separable.',
  ].join('\n'), bulletBox(6.35, 1.75, 5.6, 2.35))
  addMiniTable(slide, 6.35, 4.45, [
    ['Audience', String(input.sourcePacket.target_audience ?? 'operators and builders')],
    ['Audio', input.sourcePacket.audio_file_name ? String(input.sourcePacket.audio_file_name) : 'No audio file attached'],
    ['Characters', String(input.sourcePacket.transcript_characters ?? 'n/a')],
  ])
  addFooter(slide, 2)
}

function addFrameworkSlide(pptx: PptxGenJS, input: ContentPackagePptxInput) {
  const slide = baseSlide(pptx, '02', 'Frameworks structure the idea without erasing the voice')
  const frameworks = asRecordArray(input.researchPacket.framework_summary)
  const routes = asRecordArray(input.researchPacket.amadutown_proof_routes)
  addSectionCard(slide, 0.8, 1.2, 5.45, 4.85, 'Framework influence', frameworks.length
    ? frameworks.map((item) => `${item.creator_name ?? 'Framework'}: ${item.display_name ?? item.summary ?? ''}`).join('\n')
    : 'Vambah voice system and AmaduTown operating proof.')
  addSectionCard(slide, 6.65, 1.2, 5.45, 4.85, 'Portfolio proof routes', routes.length
    ? routes.map((item) => `${item.label ?? 'Route'} - ${item.route ?? ''}`).join('\n')
    : 'Agent Ops, Social Content Queue, Presentation Generator, and Video Generation surfaces.')
  addFooter(slide, 3)
}

function addContentSlide(pptx: PptxGenJS, input: ContentPackagePptxInput) {
  const slide = baseSlide(pptx, '03', 'One idea becomes platform-specific drafts')
  const linkedin = input.outputs.find((output) => output.output_type === 'linkedin_post')
  const carousel = input.outputs.find((output) => output.output_type === 'linkedin_carousel')
  addSectionCard(slide, 0.75, 1.15, 5.75, 5.1, 'LinkedIn post', linkedin?.body ? truncate(linkedin.body, 900) : 'LinkedIn draft was not requested.')
  const slides = asRecordArray(carousel?.payload?.slides)
  addSectionCard(slide, 6.85, 1.15, 5.75, 5.1, 'Carousel spine', slides.length
    ? slides.map((item, index) => `${index + 1}. ${item.headline ?? item.type ?? 'Slide'}`).join('\n')
    : carousel?.body ?? 'Carousel draft was not requested.')
  addFooter(slide, 4)
}

function addMediaSlide(pptx: PptxGenJS, input: ContentPackagePptxInput) {
  const slide = baseSlide(pptx, '04', 'Media handoffs are ready, but provider calls stay gated')
  const video = input.outputs.find((output) => output.output_type === 'video_script')
  const heygen = input.outputs.find((output) => output.output_type === 'heygen_video')
  const audio = input.outputs.find((output) => output.output_type === 'elevenlabs_audio')
  addSectionCard(slide, 0.75, 1.15, 5.75, 5.1, 'Script excerpt', video?.body ? truncate(video.body, 850) : 'Video script was not requested.')
  addSectionCard(slide, 6.85, 1.15, 5.75, 2.35, 'HeyGen handoff', heygen?.body ?? 'HeyGen handoff was not requested.')
  addSectionCard(slide, 6.85, 3.9, 5.75, 2.35, 'ElevenLabs handoff', audio?.body ?? 'Audio handoff was not requested.')
  addFooter(slide, 5)
}

function addApprovalSlide(pptx: PptxGenJS, input: ContentPackagePptxInput) {
  const slide = baseSlide(pptx, '05', 'The swarm pauses at the right gates')
  const steps = [
    ['Script packet', 'Approve source packet, narrative, claims, and editorial direction.'],
    ['Media generation', 'Allow PPTX storage, avatar/audio jobs, and render preparation.'],
    ['Publishing', 'Approve public posting, sending, or delivery after final review.'],
  ]
  steps.forEach(([title, body], index) => {
    const x = 0.85 + index * 4.15
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y: 1.55,
      w: 3.65,
      h: 3.65,
      fill: { color: index === 1 ? COLORS.cream : COLORS.white },
      line: { color: index === 1 ? COLORS.gold : COLORS.line, width: 1 },
    })
    slide.addText(`0${index + 1}`, { x: x + 0.25, y: 1.85, w: 0.75, h: 0.45, fontSize: 15, bold: true, color: COLORS.gold })
    slide.addText(title, { x: x + 0.25, y: 2.35, w: 3.05, h: 0.45, fontSize: 17, bold: true, color: COLORS.ink, fit: 'shrink' })
    slide.addText(body, { x: x + 0.25, y: 3.05, w: 3.05, h: 1.45, fontSize: 11, color: COLORS.slate, fit: 'shrink', breakLine: false })
  })
  const requested = input.outputs.map((output) => output.output_type.replace(/_/g, ' ')).join(', ')
  slide.addText(`Requested outputs: ${requested}`, { x: 0.85, y: 5.75, w: 11.2, h: 0.4, fontSize: 10.5, color: COLORS.muted, fit: 'shrink' })
  addFooter(slide, 6)
}

function addAppendixSlide(pptx: PptxGenJS, input: ContentPackagePptxInput) {
  const slide = baseSlide(pptx, 'A', 'Source appendix for review')
  const candidates = asList(input.researchPacket.source_candidates)
  const broll = asList(input.researchPacket.broll_hints)
  const planItems = asList(input.presentationPlan.requiredAssets)
  addSectionCard(slide, 0.75, 1.15, 3.8, 5.1, 'Research candidates', candidates.length ? candidates.join('\n') : 'No source candidates attached.')
  addSectionCard(slide, 4.75, 1.15, 3.8, 5.1, 'B-roll hints', broll.length ? broll.join('\n') : 'No b-roll hints attached.')
  addSectionCard(slide, 8.75, 1.15, 3.8, 5.1, 'Deck proof assets', planItems.length ? planItems.join('\n') : 'No required assets attached.')
  addFooter(slide, 7)
}

function paintHeader(slide: PptxGenJS.Slide, eyebrow: string) {
  slide.background = { color: COLORS.navy }
  slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.32, fill: { color: COLORS.gold }, line: { color: COLORS.gold } })
  slide.addText('AMADUTOWN ADVISORY', { x: 0.75, y: 0.5, w: 3.2, h: 0.28, fontSize: 8.5, bold: true, color: COLORS.gold })
  slide.addText(eyebrow.toUpperCase(), { x: 8.5, y: 0.5, w: 4.1, h: 0.28, fontSize: 8.5, color: COLORS.cream, align: 'right' })
}

function baseSlide(pptx: PptxGenJS, section: string, title: string) {
  const slide = pptx.addSlide()
  slide.background = { color: 'F8FAFC' }
  slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.22, fill: { color: COLORS.gold }, line: { color: COLORS.gold } })
  slide.addText(section, { x: 0.75, y: 0.48, w: 0.55, h: 0.35, fontSize: 10, bold: true, color: COLORS.gold })
  slide.addText(title, { x: 1.35, y: 0.42, w: 10.8, h: 0.5, fontSize: 19, bold: true, color: COLORS.ink, fit: 'shrink' })
  return slide
}

function addSectionCard(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number, title: string, body: string) {
  slide.addShape('rect', { x, y, w, h, fill: { color: COLORS.white }, line: { color: COLORS.line, width: 1 } })
  slide.addText(title, { x: x + 0.25, y: y + 0.25, w: w - 0.5, h: 0.38, fontSize: 12, bold: true, color: COLORS.ink, fit: 'shrink' })
  slide.addShape('line', { x: x + 0.25, y: y + 0.78, w: w - 0.5, h: 0, line: { color: COLORS.gold, width: 1 } })
  slide.addText(body, { x: x + 0.25, y: y + 1, w: w - 0.5, h: h - 1.25, fontSize: 10.5, color: COLORS.slate, fit: 'shrink', breakLine: false })
}

function addStat(slide: PptxGenJS.Slide, label: string, value: string, x: number, y: number) {
  slide.addText(label.toUpperCase(), { x, y, w: 2.7, h: 0.25, fontSize: 7.5, bold: true, color: COLORS.muted })
  slide.addText(value, { x, y: y + 0.28, w: 2.85, h: 0.45, fontSize: 16, bold: true, color: COLORS.ink, fit: 'shrink' })
}

function addMiniTable(slide: PptxGenJS.Slide, x: number, y: number, rows: Array<[string, string]>) {
  rows.forEach(([label, value], index) => {
    const rowY = y + index * 0.5
    slide.addText(label, { x, y: rowY, w: 1.5, h: 0.3, fontSize: 9, bold: true, color: COLORS.muted })
    slide.addText(value, { x: x + 1.65, y: rowY, w: 4, h: 0.3, fontSize: 9, color: COLORS.slate, fit: 'shrink' })
  })
}

function addFooter(slide: PptxGenJS.Slide, page: number) {
  slide.addText('Private draft - approval required before public use', { x: 0.75, y: 7.03, w: 6, h: 0.22, fontSize: 7.5, color: COLORS.muted })
  slide.addText(String(page).padStart(2, '0'), { x: 12.2, y: 7.03, w: 0.45, h: 0.22, fontSize: 7.5, color: COLORS.muted, align: 'right' })
}

function headingBox(x: number, y: number, w: number) {
  return { x, y, w, h: 0.35, fontSize: 13, bold: true, color: COLORS.ink, fit: 'shrink' as const }
}

function bodyBox(x: number, y: number, w: number, h: number) {
  return { x, y, w, h, fontSize: 11, color: COLORS.slate, fit: 'shrink' as const, breakLine: false }
}

function bulletBox(x: number, y: number, w: number, h: number) {
  return { x, y, w, h, fontSize: 11, color: COLORS.slate, fit: 'shrink' as const, breakLine: false, bullet: { type: 'bullet' as const } }
}

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? '').trim()).filter(Boolean)
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, Math.max(0, max - 3)).trimEnd()}...`
}
