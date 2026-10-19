import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const proofPath = path.join(root, 'public/review-assets/social-content/source-proof/kicklab-gameplay-capture-2026-10-17.jpg')
const backgroundPath = path.join(root, 'public/review-assets/social-content/source-proof/kicklab-football-photo-backdrop-2026-10-19.png')
const outputPath = path.join(root, 'public/review-assets/kicklab-youtube-thumbnail.png')
const receiptPath = path.join(root, 'artifacts/research/kicklab-typography-style-receipt-2026-10-19/thumbnail-provenance.json')
const fontPath = path.join(root, 'public/fonts/inter-latin-variable.ttf')

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const proofBytes = await readFile(proofPath)
const backgroundBytes = await readFile(backgroundPath)
const background = await sharp(backgroundBytes).resize(1280, 720, { fit: 'cover' }).modulate({ brightness: 0.96, saturation: 0.92 }).png().toBuffer()

// Keep this exact product UI as the proof. Crop only the native captured pixels;
// no product labels, scores, gameplay controls, or outcome are redrawn.
const proof = await sharp(proofBytes)
  .extract({ left: 24, top: 112, width: 1060, height: 442 })
  .resize(620, 258, { fit: 'cover', position: 'centre' })
  .sharpen({ sigma: 0.5, m1: 0.35, m2: 0.4 })
  .png()
  .toBuffer()

const shade = Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="leftShade" x1="0" x2="1"><stop offset="0" stop-color="#071326" stop-opacity=".38"/><stop offset=".54" stop-color="#071326" stop-opacity=".18"/><stop offset="1" stop-color="#071326" stop-opacity="0"/></linearGradient></defs><rect width="1280" height="720" fill="url(#leftShade)"/></svg>`)
const type = Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg"><style>@font-face{font-family:KickLabInter;src:url('file://${fontPath}') format('truetype');font-weight:100 900}.headline{font-family:KickLabInter,Inter,sans-serif;font-size:57px;font-weight:800;letter-spacing:-1.7px}</style><text x="58" y="126" class="headline" fill="#061426" opacity=".56" transform="translate(0 3)">MATH IN THE MOVE</text><text x="58" y="123" class="headline" fill="#F8FAFC">MATH IN THE MOVE</text></svg>`)

const thumbnail = await sharp(background)
  .composite([
    { input: shade, blend: 'over' },
    { input: proof, left: 42, top: 235, blend: 'over' },
    { input: type, blend: 'over' },
  ])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer()
await sharp(thumbnail).toFile(outputPath)

const metadata = await sharp(thumbnail).metadata()
const provenance = {
  version: 'kicklab-raster-thumbnail-provenance/v1',
  output: '/review-assets/kicklab-youtube-thumbnail.png',
  output_sha256: hash(thumbnail),
  dimensions: { width: metadata.width, height: metadata.height, format: metadata.format },
  generated_at: '2026-10-19',
  backdrop: {
    asset: '/review-assets/social-content/source-proof/kicklab-football-photo-backdrop-2026-10-19.png',
    sha256: hash(backgroundBytes),
    provenance: 'ImageGen photo backdrop; generated 2026-10-19. Reference image was used only to guide contemporary lighting/cohesion; no reference-image interface, text, brand, or claims were reproduced.',
    proof_boundary: 'Photographic background only; not evidence of KickLab product behavior or an actual athlete identity.',
  },
  product_proof: {
    asset: '/review-assets/social-content/source-proof/kicklab-gameplay-capture-2026-10-17.jpg',
    sha256: hash(proofBytes),
    original_source: '/Users/vambahsillah/Projects/Portfolio/artifacts/human-qa/next-week-campaign-batch-2026-10-17/assets/kicklab.png',
    source_note: 'Owned KickLab gameplay capture, documented in the 2026-10-17 Human-QA packet. Used as unmodified native UI pixels apart from crop, scale, and raster sharpening.',
    generated_ui: false,
    fabricated_results: false,
  },
  typography_receipt: 'typography-style:kicklab-youtube:20261019:v1',
  composition: {
    source_canvas: '1280x720',
    display_copy: 'MATH IN THE MOVE',
    font: 'Bundled Inter variable font; weight 800; warm white; no outline, glow, bevel, or extrusion.',
    prohibited_elements_absent: ['SVG output', 'generated arrows or trajectory graphics', 'fake score/result', 'generated interface', 'brand logo'],
    source_native_elements_retained: ['KickLab screenshot includes its real gameplay trajectory and native controls; these are original product pixels, not added thumbnail graphics.'],
  },
  self_evaluation: {
    status: 'direction_review_only',
    dated_arcade_type: 'rejected; no condensed arcade face, gradient, stroke, or glow used',
    generic_default_type: 'rejected; bundled Inter is deliberately art-directed, and performance support remains Unscored',
    procedural_svg_or_arrows: 'pass; final is PNG, no generated arrows or SVG illustration; native in-product path remains visible in source screenshot',
    cohesion: 'pass for photographic color grade and evidence placement; human visual review still required',
    overlap: 'pass by layout; headline clears player/ball and proof pixels',
    feed_legibility: 'directional pass for four-word headline at 320x180; screenshot detail is intentionally evidentiary, not a claim that all UI text is readable at feed size',
    typography_performance: 'Unscored; public view counts do not isolate font treatment, no same-channel matched-style baseline is recorded, and matched-style sample size is 0 of required 4',
    recovery_action: 'Complete a four-example matched-style cohort and same-channel age-normalized baseline before treating typography as approval-ready.',
  },
  review_gate: 'Human QA pending; preview composition and feed-size readability before any release or publication.',
}
await mkdir(path.dirname(receiptPath), { recursive: true })
await writeFile(receiptPath, `${JSON.stringify(provenance, null, 2)}\n`)
console.log(JSON.stringify({ outputPath, receiptPath, bytes: thumbnail.length, output_sha256: hash(thumbnail) }))
