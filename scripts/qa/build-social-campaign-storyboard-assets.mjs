import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const outputDir = path.join(root, 'public/review-assets/social-content/storyboard-review')
const receiptDir = path.join(root, 'artifacts/research/social-campaign-storyboard-assets-2026-10-19')
const logoPath = path.join(root, 'public/amadutown-logo-upscaled.png')
const fontPath = path.join(root, 'public/fonts/inter-latin-variable.ttf')

await mkdir(outputDir, { recursive: true })
await mkdir(receiptDir, { recursive: true })

for (const filename of ['explore-position.jpg', 'explore-start.jpg', 'explore-computer.jpg']) {
  await copyFile(
    path.join(root, 'artifacts/human-qa/artifact-video-review-2026-10-14/inputs', filename),
    path.join(outputDir, filename),
  )
}

const fontData = (await readFile(fontPath)).toString('base64')
const fontFace = `@font-face{font-family:InterReview;src:url(data:font/ttf;base64,${fontData}) format('truetype');font-weight:100 900;}`
const logo = await sharp(logoPath).resize({ height: 78, fit: 'inside', withoutEnlargement: true }).png().toBuffer()

function svg(markup) {
  return Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg"><style>${fontFace}.label{font-family:InterReview,Arial,sans-serif;font-weight:750;letter-spacing:3px}.headline{font-family:InterReview,Arial,sans-serif;font-weight:860;letter-spacing:-3px}.small{font-family:InterReview,Arial,sans-serif;font-weight:620;letter-spacing:.3px}</style>${markup}</svg>`)
}

async function sha256(file) {
  return `sha256:${createHash('sha256').update(await readFile(file)).digest('hex')}`
}

async function buildJev() {
  const source = path.join(root, 'public/review-assets/social-content/source-proof/jev-operator-field-guide.png')
  const output = path.join(outputDir, 'jev-when-should-ai-stop-provider-none.png')
  const background = await sharp(source).resize(1280, 720, { fit: 'cover', position: 'attention' }).blur(10).modulate({ brightness: 0.48, saturation: 0.78 }).png().toBuffer()
  const proof = await sharp(source).resize(900, 554, { fit: 'cover', position: 'center' }).png().toBuffer()
  const treatment = svg(`
    <defs>
      <linearGradient id="shade" x1="0" x2="1"><stop offset="0" stop-color="#06182d" stop-opacity=".99"/><stop offset=".42" stop-color="#0a2039" stop-opacity=".94"/><stop offset=".70" stop-color="#0a2039" stop-opacity=".30"/><stop offset="1" stop-color="#06182d" stop-opacity=".12"/></linearGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#020817" flood-opacity=".55"/></filter>
    </defs>
    <rect width="1280" height="720" fill="url(#shade)"/>
    <rect x="478" y="96" width="742" height="528" rx="28" fill="none" stroke="#55d6cc" stroke-opacity=".65" stroke-width="3" filter="url(#shadow)"/>
    <rect x="0" y="0" width="1280" height="10" fill="#f4c51f"/>
    <text x="84" y="132" class="label" font-size="24" fill="#f4c51f">JEV · DECISION OWNERSHIP</text>
    <text x="80" y="274" class="headline" font-size="76" fill="#f8fafc">WHEN SHOULD</text>
    <rect x="76" y="306" width="365" height="102" rx="22" fill="#ff756b"/>
    <text x="103" y="382" class="headline" font-size="80" fill="#07182a">AI STOP?</text>
    <text x="82" y="476" class="small" font-size="25" fill="#d7e5f4">The score informs the call.</text>
    <text x="82" y="512" class="small" font-size="25" fill="#ffffff">A person still owns it.</text>
    <text x="82" y="638" class="label" font-size="17" fill="#8fb8d7">AMADUTOWN · REVIEW DIRECTION</text>
  `)
  await sharp(background).composite([
    { input: proof, left: 450, top: 84 },
    { input: treatment, left: 0, top: 0 },
    { input: logo, left: 1160, top: 618 },
  ]).png().toFile(output)
  return {
    asset_id: 'asset:jev:provider-none-thumbnail:20261019:v1',
    campaign_identity: 'jev',
    role: 'youtube_thumbnail_review',
    public_path: '/review-assets/social-content/storyboard-review/jev-when-should-ai-stop-provider-none.png',
    width: 1280,
    height: 720,
    aspect_ratio: '16:9',
    title: 'AI Scored It. Who Makes the Call?',
    teaser: 'WHEN SHOULD AI STOP?',
    focal_subject: 'Owned Jev operator field guide',
    focal_hierarchy: ['short decision question', 'owned operator field guide', 'AmaduTown shield'],
    product_proof_path: '/review-assets/social-content/source-proof/jev-operator-field-guide.png',
    source_receipt_ids: ['source:jev:approved-composite-20261014', 'privacy:jev:public-safe-20261014', 'rights:jev:owned-public-assets-20261014'],
    provider: 'none',
    review_only: true,
    sha256: await sha256(output),
  }
}

async function buildDarkCastle() {
  const source = path.join(root, 'artifacts/human-qa/artifact-video-review-2026-10-14/inputs/explore-position.jpg')
  const output = path.join(outputDir, 'dark-castle-remember-the-why-provider-none.png')
  const background = await sharp(source).resize(1280, 720, { fit: 'cover', position: 'left' }).modulate({ brightness: 0.66, saturation: 0.84 }).png().toBuffer()
  const treatment = svg(`
    <defs>
      <linearGradient id="dark" x1="0" x2="1"><stop offset="0" stop-color="#061529" stop-opacity=".04"/><stop offset=".48" stop-color="#061529" stop-opacity=".30"/><stop offset=".68" stop-color="#061529" stop-opacity=".92"/><stop offset="1" stop-color="#061529" stop-opacity=".99"/></linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="#f5c62a" stop-opacity=".24"/><stop offset="1" stop-color="#f5c62a" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#dark)"/>
    <ellipse cx="966" cy="328" rx="340" ry="300" fill="url(#glow)"/>
    <rect x="0" y="0" width="1280" height="10" fill="#f5c62a"/>
    <text x="820" y="142" class="label" font-size="22" fill="#8fe1d3">DARK CASTLE CHESS</text>
    <text x="814" y="270" class="headline" font-size="70" fill="#ffffff">REMEMBER</text>
    <text x="814" y="354" class="headline" font-size="70" fill="#f5c62a">THE WHY</text>
    <rect x="818" y="398" width="96" height="6" rx="3" fill="#8fe1d3"/>
    <text x="818" y="470" class="small" font-size="24" fill="#d9e6f4">The position survives.</text>
    <text x="818" y="505" class="small" font-size="24" fill="#ffffff">So should the lesson.</text>
    <text x="818" y="638" class="label" font-size="17" fill="#9fb7cf">AMADUTOWN · REVIEW DIRECTION</text>
  `)
  await sharp(background).composite([
    { input: treatment, left: 0, top: 0 },
    { input: logo, left: 1160, top: 618 },
  ]).png().toFile(output)
  return {
    asset_id: 'asset:dark-castle:provider-none-thumbnail:20261019:v1',
    campaign_identity: 'dark-castle-chess',
    role: 'youtube_thumbnail_review',
    public_path: '/review-assets/social-content/storyboard-review/dark-castle-remember-the-why-provider-none.png',
    width: 1280,
    height: 720,
    aspect_ratio: '16:9',
    title: 'I Rebuilt the Chess Lesson Around the Decision',
    teaser: 'REMEMBER THE WHY',
    focal_subject: 'Owned Dark Castle Chess Explore position',
    focal_hierarchy: ['owned gameplay position', 'three-word learning tension', 'AmaduTown shield'],
    product_proof_path: '/review-assets/social-content/dark-castle-customer-facing-poster.png',
    source_receipt_ids: ['source:dark-castle-chess:approved-composite-20261014', 'privacy:dark-castle-chess:public-safe-20261014', 'rights:dark-castle-chess:owned-public-assets-20261014'],
    provider: 'none',
    review_only: true,
    sha256: await sha256(output),
  }
}

const assets = [await buildJev(), await buildDarkCastle()]
const receipt = {
  version: 'social-campaign-storyboard-asset-receipt/v1',
  receipt_id: 'receipt:social-campaign-storyboard-assets:20261019:v1',
  generated_at: '2026-10-19T20:30:00.000Z',
  generator: 'scripts/qa/build-social-campaign-storyboard-assets.mjs',
  provider_calls: 0,
  paid_media_generations: 0,
  external_writes: 0,
  logo: {
    public_path: '/amadutown-logo-upscaled.png',
    placement_rule: 'Natural portrait aspect ratio preserved; height constrained and width derived automatically.',
  },
  assets,
  boundary: 'Repository-local review assets only. No provider, production record, upload, platform draft, schedule, publication, credential change, spending, or external send was used.',
}
await writeFile(path.join(receiptDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`)
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`)
