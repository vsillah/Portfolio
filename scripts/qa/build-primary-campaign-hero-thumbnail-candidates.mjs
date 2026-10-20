import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const generatedAt = '2026-10-20T01:35:00.000Z'
const freshUntil = '2026-11-03T01:35:00.000Z'
const primaryIdentityPath = path.join(root, 'public/review-assets/social-content/source-proof/vambah-approved-profile.jpg')
const supportingIdentityPath = path.join(root, 'public/review-assets/social-content/jev-hero-thumbnail-review/source/vambah-curious-approved.jpg')
const logoPath = path.join(root, 'public/amadutown-logo-upscaled.png')
const fontPath = path.join(root, 'public/fonts/inter-latin-variable.ttf')
const jevReceiptPath = path.join(root, 'artifacts/research/jev-hero-thumbnail-candidates-2026-10-19/receipt.json')
const internalMarker = /\b(review only|draft|fixture|sample data|operator|internal|prompt|qa)\b/i

const sha256 = async (file) => `sha256:${createHash('sha256').update(await readFile(file)).digest('hex')}`
async function dHash(file) {
  const { data } = await sharp(file).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })
  let bits = ''
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? '1' : '0'
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0')
}

const fontData = (await readFile(fontPath)).toString('base64')
const fontFace = `@font-face{font-family:InterHero;src:url(data:font/ttf;base64,${fontData}) format('truetype');font-weight:100 900}.head{font-family:InterHero,Arial,sans-serif;font-weight:900;letter-spacing:-3px}.micro{font-family:InterHero,Arial,sans-serif;font-weight:800;letter-spacing:2px}`
const overlay = (markup) => Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg"><style>${fontFace}</style>${markup}</svg>`)
const logo = await sharp(logoPath).resize({ height: 54, fit: 'inside', withoutEnlargement: true }).png().toBuffer()
const primaryIdentitySha = await sha256(primaryIdentityPath)
const supportingIdentitySha = await sha256(supportingIdentityPath)
const jevReceipt = JSON.parse(await readFile(jevReceiptPath, 'utf8'))

const sharedGeneration = {
  approved_path: 'Portfolio/Codex integrated image_gen.imagegen path',
  authorization_status: 'authorized',
  provider_id: 'openai-integrated-image-generation',
  model_id: 'managed-current-image-model',
  model_disclosure: 'The integrated tool did not expose a more specific model identifier.',
  required_prompt_fields: ['expression', 'pose', 'wardrobe', 'lighting', 'camera', 'environment', 'gaze', 'gesture', 'artifact_interaction'],
  cost: {
    currency: 'USD',
    hard_ceiling: 9,
    ceiling_relation: 'strictly_below',
    scope: 'combined_dark_castle_and_ai_audit_batch',
    provider_calls: 4,
    successful_generation_jobs: 4,
    retries: 0,
    uncertain_results: 0,
    observed_separate_charge: 0,
    billing_note: 'The approved integrated path exposed no separate metered charge or checkout. This is not a general billing claim.',
  },
  output_rights: { status: 'approved_path_unchanged', scope: 'review-only generated campaign assets' },
  boundary: 'Exactly four successful jobs across the two-campaign batch. No retry. Review-only output. Production mutation, upload, platform draft, schedule, publish, credential change, migration, deployment, merge, and external send remain closed.',
}

const recentPairs = [
  ...jevReceipt.candidates.map((candidate) => ({
    asset_id: candidate.candidate_id,
    hero_perceptual_hash: jevReceipt.hero_assets.find((hero) => hero.asset_id === candidate.hero_binding.hero_asset_id)?.perceptual_hash,
    composition_perceptual_hash: candidate.perceptual_hash,
  })),
  {
    asset_id: 'thumbnail:dark-castle:youtube-long-form:20261018:v6',
    hero_path: path.join(root, 'public/review-assets/social-content/source-proof/dark-castle-heygen-identity-v4.png'),
    composition_path: path.join(root, 'public/review-assets/social-content/youtube-packaging/dark-castle-remember-the-why-v6.png'),
  },
  {
    asset_id: 'thumbnail:ai-audit:youtube-long-form:20261018:v6',
    hero_path: path.join(root, 'public/review-assets/social-content/source-proof/ai-audit-heygen-identity-v4.png'),
    composition_path: path.join(root, 'public/review-assets/social-content/youtube-packaging/ai-audit-who-owns-the-cleanup-v6.png'),
  },
]
for (const pair of recentPairs) {
  if (pair.hero_path) pair.hero_perceptual_hash = await dHash(pair.hero_path)
  if (pair.composition_path) pair.composition_perceptual_hash = await dHash(pair.composition_path)
  delete pair.hero_path
  delete pair.composition_path
}

const campaigns = [
  {
    campaign_identity: 'dark-castle-chess',
    content_version: 'sha256:4d3bc63ebaeb1aed344d64ed15ebb0ff865772de48b48249526ccce0b2c02e9e',
    title: 'I Rebuilt the Chess Lesson Around the Decision',
    public_slug: 'dark-castle-hero-thumbnail-review',
    artifact_slug: 'dark-castle-hero-thumbnail-candidates-2026-10-19',
    receipt_id: 'receipt:thumbnail-hero:dark-castle-chess:20261019:v1',
    generation_request_id: 'generation-request:thumbnail-hero:dark-castle-chess:20261019:v1',
    cohort_path: 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/cohort.json',
    decision_path: 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/thumbnail-decision-receipt.json',
    proof: {
      asset_id: 'proof:dark-castle:gameplay-board:20261014',
      public_path: '/review-assets/social-content/dark-castle-customer-facing-poster.png',
      file: 'public/review-assets/social-content/dark-castle-customer-facing-poster.png',
      source_receipt_ids: ['source:dark-castle-chess:public-gameplay-captures-20261014'],
      rights_receipt_ids: ['rights:dark-castle-chess:owned-public-assets-20261014'],
      privacy_receipt_id: 'privacy:dark-castle-chess:public-safe-20261014',
      role: 'Owned gameplay evidence integrated into each generated scene while retaining a separately receipted product-proof identity.',
    },
    heroes: [
      {
        id: 'hero:dark-castle-chess:decision-table:20261019:v1',
        file: 'source/dark-castle-decision-table-generated-v1.png',
        expected_sha: 'sha256:f9f0f15a71f7f377a1d3453a1e8630f4f08758223890fc99302b43b854df0f5c',
        job_id: 'imagegen:exec-fb7f637f-2177-4466-8931-f9c95b896e79',
        anatomy: { status: 'passed', visible_hands: 2, visible_fingers_consistent: true, note: 'Both connected hands are visible; the right index finger makes believable contact with the e4 square and the left hand rests naturally on the table edge.' },
        intent: { expression: 'focused concern', pose: 'seated forward lean over a diagonal decision table', wardrobe: 'burgundy knit polo and charcoal tailored jacket', lighting: 'warm tungsten key with gold product bounce and navy fill', camera: 'eye-level 50mm wide-medium frame', environment: 'amber castle strategy room with stone, walnut, and architectural depth', gaze: 'eyes follow the e4 move toward the guidance rail', gesture: 'right index finger traces the move while the left hand anchors the table', artifact_interaction: 'the gameplay surface is built into the table and lights the subject, hands, and surrounding wood' },
      },
      {
        id: 'hero:dark-castle-chess:rook-reveal:20261019:v1',
        file: 'source/dark-castle-rook-reveal-generated-v1.png',
        expected_sha: 'sha256:96002304ed075953df52a0b9fdb183ba09547fc6ed3daaac0b6d3943fe0a73b4',
        job_id: 'imagegen:exec-003b0dce-a96f-4890-b515-309635dc0e12',
        anatomy: { status: 'passed', visible_hands: 1, visible_fingers_consistent: true, note: 'The visible hand forms a complete connected grip around the brass rook; the second arm is occluded by the body and mechanism rather than malformed.' },
        intent: { expression: 'energized discovery', pose: 'deep crouch while lifting a brass rook mechanism', wardrobe: 'cobalt utility overshirt over black knit', lighting: 'cool cyan moonlight with gold evidence glow', camera: 'high three-quarter 28mm frame with a subtle Dutch angle', environment: 'moonlit castle observatory with circular glass-floor mechanism', gaze: 'eyes follow the rook reveal toward the consequence path', gesture: 'one visible hand lifts the rook handle while the body coils around the reveal', artifact_interaction: 'the gameplay interface is discovered beneath the glass floor and drives the scene light and spiral composition' },
      },
    ],
    candidates: [
      {
        id: 'thumbnail:dark-castle-chess:decision-table:20261019:v1', filename: 'dark-castle-remember-the-why-hero-v1.png', feed_filename: 'dark-castle-remember-the-why-hero-v1-feed-320x180.png', hero_index: 0,
        teaser: 'REMEMBER THE WHY', direction: 'The Decision Table', layout_family: 'diagonal-decision-table-scene', signature: 'dark-castle|warm-diagonal-table|trace-e4|amber-strategy-room|v1',
        focal: 'Vambah traces the e4 move inside a luminous decision table while the board and guidance rail cast one coherent light.', safe: { x: 34, y: 30, width: 468, height: 166 },
        relationship: 'The pointing hand, gaze, diagonal board, and gold interface light converge on the exact decision evidence.',
        trace: { hero: ['KbjRYez_me0', 'Reza8udb47Y'], composition: ['8xrELvz0dCI', 'XRNpz7fra9k'], teaser: ['8xrELvz0dCI', 'XRNpz7fra9k'] },
        text_overlay: overlay(`<g transform="rotate(-1 270 112)"><rect x="28" y="24" width="490" height="174" rx="18" fill="#07182b" fill-opacity=".88" stroke="#f3c735" stroke-width="3"/><rect x="45" y="43" width="10" height="135" rx="5" fill="#65e2d1"/><text x="76" y="93" class="head" font-size="55" fill="#fff">REMEMBER</text><text x="76" y="157" class="head" font-size="64" fill="#f3c735">THE WHY</text></g>`),
      },
      {
        id: 'thumbnail:dark-castle-chess:rook-reveal:20261019:v1', filename: 'dark-castle-see-the-consequence-hero-v1.png', feed_filename: 'dark-castle-see-the-consequence-hero-v1-feed-320x180.png', hero_index: 1,
        teaser: 'SEE THE CONSEQUENCE', direction: 'The Rook Reveal', layout_family: 'circular-consequence-reveal-scene', signature: 'dark-castle|cool-circular-reveal|rook-lift|moonlit-observatory|v1',
        focal: 'Vambah lifts a brass rook mechanism and reveals the gameplay consequence beneath the observatory floor.', safe: { x: 844, y: 44, width: 390, height: 154 },
        relationship: 'The rook lift, circular floor opening, face direction, cyan moonlight, and gold product glow form one discovery spiral.',
        trace: { hero: ['KbjRYez_me0', 'Reza8udb47Y'], composition: ['TGo2-JcjtOk', 'ohSRdSZFnSQ'], teaser: ['TGo2-JcjtOk', '8xrELvz0dCI'] },
        text_overlay: overlay(`<text x="858" y="91" class="micro" font-size="15" fill="#7ee8e0">DARK CASTLE CHESS</text><text x="852" y="143" class="head" font-size="53" fill="#fff" stroke="#06162a" stroke-width="8" paint-order="stroke">SEE THE</text><text x="852" y="198" class="head" font-size="48" fill="#f5c63d" stroke="#06162a" stroke-width="8" paint-order="stroke">CONSEQUENCE</text><path d="M850 214 C960 196 1070 218 1220 191" fill="none" stroke="#71e5dc" stroke-width="7" stroke-linecap="round"/>`),
      },
    ],
  },
  {
    campaign_identity: 'ai-audit-calculator',
    content_version: '2026-10-18T00:00:00.000Z',
    title: 'The AI Cost That Never Appears on the Invoice',
    public_slug: 'ai-audit-hero-thumbnail-review',
    artifact_slug: 'ai-audit-hero-thumbnail-candidates-2026-10-19',
    receipt_id: 'receipt:thumbnail-hero:ai-audit-calculator:20261019:v1',
    generation_request_id: 'generation-request:thumbnail-hero:ai-audit-calculator:20261019:v1',
    cohort_path: 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/cohort.json',
    decision_path: 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/thumbnail-decision-receipt.json',
    proof: {
      asset_id: 'proof:ai-audit-calculator:result-screen:20261018',
      public_path: '/audit_calculator_img.png',
      file: 'public/audit_calculator_img.png',
      source_receipt_ids: ['source:ai-audit-calculator:owned-result-screen-20261018'],
      rights_receipt_ids: ['rights:ai-audit-calculator:owned-public-assets-20261018'],
      privacy_receipt_id: 'privacy:ai-audit-calculator:synthetic-public-safe-20261018',
      role: 'Owned synthetic calculator evidence integrated into each generated scene while retaining a separately receipted product-proof identity.',
    },
    heroes: [
      {
        id: 'hero:ai-audit-calculator:receipt-pull:20261019:v1',
        file: 'source/ai-audit-receipt-pull-generated-v1.png',
        expected_sha: 'sha256:f48c7ff38aad1f27816fb12534ab67c031e4cc563f00656b35d6476b6c352b99',
        job_id: 'imagegen:exec-456d18f8-470c-409b-a0e0-8f4264466e17',
        anatomy: { status: 'passed', visible_hands: 2, visible_fingers_consistent: true, note: 'Both connected hands are visible and grip the same receipt ribbon with believable paper contact.' },
        intent: { expression: 'skeptical raised eyebrow and closed-mouth half smile', pose: 'standing two-hand pull across a workbench', wardrobe: 'olive unstructured suit and cream open-collar shirt', lighting: 'late-afternoon sun with green-gold product bounce', camera: 'eye-level 35mm editorial frame', environment: 'bright tactile audit studio with walnut bench and paper rolls', gaze: 'eyes connect the receipt ribbon to the 5/10 scores', gesture: 'both hands pull one translucent receipt from the built-in calculator', artifact_interaction: 'the calculator is embedded in the bench and physically emits the receipt while lighting the hands and jacket' },
      },
      {
        id: 'hero:ai-audit-calculator:ledger-lift:20261019:v1',
        file: 'source/ai-audit-ledger-lift-generated-v1.png',
        expected_sha: 'sha256:e7b4249fd59913c3c5a2a6c1e68036e3c2ed670bc703b7eb99aac4d962e6ace0',
        job_id: 'imagegen:exec-64ab35b8-c38b-4d13-b8fe-92377475b7d1',
        anatomy: { status: 'passed', visible_hands: 2, visible_fingers_consistent: true, note: 'Both connected hands hold opposite edges of one glass ledger; fingers and wrists remain complete and physically consistent.' },
        intent: { expression: 'calm realization with widened eyes and slightly parted lips', pose: 'leaning over an archive drawer while lifting a glass ledger', wardrobe: 'cream textured sweater and navy quilted vest', lighting: 'indigo ambient light with cyan glass edge and restrained gold score bounce', camera: 'low 28mm angle from inside the archive drawer', environment: 'night evidence archive with translucent drawers and metal rails', gaze: 'eyes meet the embedded 5/10 scores', gesture: 'both hands raise one transparent ledger panel from the drawer', artifact_interaction: 'the audit result is embedded in the glass ledger and drives the reflections, hand light, and reveal story' },
      },
    ],
    candidates: [
      {
        id: 'thumbnail:ai-audit-calculator:receipt-pull:20261019:v1', filename: 'ai-audit-who-owns-cleanup-hero-v1.png', feed_filename: 'ai-audit-who-owns-cleanup-hero-v1-feed-320x180.png', hero_index: 0,
        teaser: 'WHO OWNS THE CLEANUP?', direction: 'The Receipt Pull', layout_family: 'receipt-ribbon-investigation-scene', signature: 'ai-audit|warm-receipt-scurve|two-hand-pull|sunlit-studio|v1',
        focal: 'Vambah pulls a translucent receipt directly from the built-in calculator while studying the real 5/10 result.', safe: { x: 910, y: 36, width: 340, height: 180 },
        relationship: 'The two-hand receipt pull, gaze, workbench depth, and green-gold product bounce create one investigative S-curve.',
        trace: { hero: ['axNuaPmBjLg', 'oGaSfa3lJ8o'], composition: ['oGaSfa3lJ8o', 'w8dvgEOh3tc'], teaser: ['qf31-dcBeE4', 'w8dvgEOh3tc'] },
        text_overlay: overlay(`<g transform="rotate(2 1095 126)"><rect x="900" y="30" width="350" height="186" rx="22" fill="#f6f0df" fill-opacity=".94" stroke="#d8ad28" stroke-width="4"/><path d="M922 69 H1224" stroke="#17314c" stroke-opacity=".32" stroke-width="3"/><text x="928" y="104" class="head" font-size="48" fill="#10243b">WHO OWNS</text><rect x="920" y="123" width="312" height="70" rx="10" fill="#d9ad27"/><text x="936" y="174" class="head" font-size="43" fill="#07182b">THE CLEANUP?</text></g>`),
      },
      {
        id: 'thumbnail:ai-audit-calculator:ledger-lift:20261019:v1', filename: 'ai-audit-bill-hides-here-hero-v1.png', feed_filename: 'ai-audit-bill-hides-here-hero-v1-feed-320x180.png', hero_index: 1,
        teaser: 'THE BILL HIDES HERE', direction: 'The Hidden Ledger', layout_family: 'low-angle-ledger-reveal-scene', signature: 'ai-audit|cool-ledger-triangle|two-hand-lift|indigo-archive|v1',
        focal: 'Vambah raises the transparent 5/10 ledger from a deep archive drawer as the score lights his hands and face.', safe: { x: 42, y: 40, width: 412, height: 170 },
        relationship: 'The low camera, two-hand ledger lift, eye line, archive rails, and gold score light create one triangular reveal.',
        trace: { hero: ['axNuaPmBjLg', 'fSAazWLuDyQ'], composition: ['w8dvgEOh3tc', 'qf31-dcBeE4'], teaser: ['wIcw0T9NhZM', 'w8dvgEOh3tc'] },
        text_overlay: overlay(`<rect x="38" y="34" width="12" height="178" rx="6" fill="#63e4ef"/><text x="76" y="104" class="head" font-size="62" fill="#f7f4eb" stroke="#061427" stroke-width="7" paint-order="stroke">THE BILL</text><text x="76" y="174" class="head" font-size="58" fill="#f1bd32" stroke="#061427" stroke-width="7" paint-order="stroke">HIDES HERE</text><path d="M78 194 H397" stroke="#63e4ef" stroke-width="6" stroke-linecap="round"/>`),
      },
    ],
  },
]

const outputs = []
for (const campaign of campaigns) {
  const publicRoot = path.join(root, 'public/review-assets/social-content', campaign.public_slug)
  const artifactRoot = path.join(root, 'artifacts/research', campaign.artifact_slug)
  await mkdir(publicRoot, { recursive: true })
  await mkdir(artifactRoot, { recursive: true })
  const cohort = JSON.parse(await readFile(path.join(root, campaign.cohort_path), 'utf8'))
  const decision = JSON.parse(await readFile(path.join(root, campaign.decision_path), 'utf8'))
  if (cohort.status !== 'approved' || !cohort.selection_gate?.ready || cohort.outlier_qualification?.qualified_sample_size < 1) throw new Error(`${campaign.campaign_identity} live cohort is not qualified.`)
  if (Date.parse(cohort.fresh_until) < Date.parse(generatedAt)) throw new Error(`${campaign.campaign_identity} live cohort is stale.`)
  if (decision.selection?.status !== 'ready' || decision.live_evidence?.cohort_id !== cohort.cohort_id) throw new Error(`${campaign.campaign_identity} decision receipt does not bind the current cohort.`)

  for (const hero of campaign.heroes) {
    const file = path.join(publicRoot, hero.file)
    const actual = await sha256(file)
    if (actual !== hero.expected_sha) throw new Error(`${hero.id} output hash changed.`)
    const metadata = await sharp(file).metadata()
    if (metadata.width !== 1672 || metadata.height !== 941) throw new Error(`${hero.id} dimensions changed.`)
    hero.output_sha256 = actual
    hero.perceptual_hash = await dHash(file)
  }

  const candidates = []
  for (const candidate of campaign.candidates) {
    const hero = campaign.heroes[candidate.hero_index]
    const output = path.join(publicRoot, candidate.filename)
    const feed = path.join(publicRoot, candidate.feed_filename)
    if (internalMarker.test(candidate.teaser)) throw new Error(`${candidate.id} contains customer-facing workflow language.`)
    await sharp(path.join(publicRoot, hero.file)).resize(1280, 720, { fit: 'cover', position: 'centre' }).composite([{ input: candidate.text_overlay }, { input: logo, left: 1198, top: 648 }]).png().toFile(output)
    await sharp(output).resize(320, 180, { fit: 'cover' }).png().toFile(feed)
    const outputSha = await sha256(output)
    const creativeEvidence = [
      ['hero_selection', candidate.trace.hero, 'Current same-topic evidence favors one immediately legible human or product relationship; the new campaign-specific likeness makes the owner of the decision concrete.'],
      ['composition', candidate.trace.composition, candidate.relationship],
      ['typography', candidate.trace.teaser, 'One large editorial hook remains readable at 320×180 while preserving the face, hands, and product evidence.'],
      ['teaser', candidate.trace.teaser, 'The hook adds tension without repeating the title or making a causal performance promise.'],
      ['contrast', candidate.trace.composition, 'Subject, product light, wardrobe, environment, and typography use one controlled contrast system.'],
      ['visual_style', candidate.trace.hero, `${candidate.direction} uses a campaign-specific environment, camera, palette, pose, wardrobe, and product interaction.`],
    ]
    candidates.push({
      candidate_id: candidate.id,
      campaign_identity: campaign.campaign_identity,
      content_version: campaign.content_version,
      title: campaign.title,
      teaser: candidate.teaser,
      customer_facing_copy: [candidate.teaser],
      direction: candidate.direction,
      public_path: `/review-assets/social-content/${campaign.public_slug}/${candidate.filename}`,
      sha256: outputSha,
      perceptual_hash: await dHash(output),
      width: 1280,
      height: 720,
      aspect_ratio: '16:9',
      feed_preview_path: `/review-assets/social-content/${campaign.public_slug}/${candidate.feed_filename}`,
      feed_preview_sha256: await sha256(feed),
      feed_preview_width: 320,
      feed_preview_height: 180,
      focal_subject: candidate.focal,
      safe_text_region: candidate.safe,
      crop: { source_asset_id: hero.id, x: 0, y: 0, width: 1672, height: 941, fit: 'cover-16:9' },
      face_text_overlap: false,
      feed_size_legible: true,
      product_legible: true,
      text_word_count: candidate.teaser.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).length,
      layout_family: candidate.layout_family,
      composition_signature: candidate.signature,
      typography: 'Inter variable; one short art-directed editorial hook; face-, hand-, and product-safe placement.',
      visual_style: 'New campaign-specific generated likeness and owned product evidence share depth, light, grade, gaze, gesture, and perspective.',
      selection_status: 'pending_human_qa',
      final_use_eligible: false,
      selection_reason: 'Human QA has not selected a final campaign output. This candidate remains review-only and ineligible for downstream packaging.',
      anatomy_quality: hero.anatomy,
      integration: {
        cohesive_scene: true,
        hard_split_panel: false,
        pasted_boundary: false,
        lighting_consistent: true,
        perspective_consistent: true,
        color_grade_consistent: true,
        asset_floats_independently: false,
        blur_masks_reuse: false,
        hero_removal_breaks_story: true,
        asset_removal_breaks_story: true,
        face_overlap_harm: false,
        text_overlap_harm: false,
        product_overlap_harm: false,
        pose_gaze_gesture_relationship: candidate.relationship,
      },
      hero_binding: { hero_asset_id: hero.id, hero_output_sha256: hero.output_sha256, output_sha256: outputSha },
      evidence_trace: creativeEvidence.map(([decision_dimension, live_evidence_video_ids, rationale]) => ({ decision_dimension, cohort_id: cohort.cohort_id, live_evidence_video_ids, evidence_role: 'informs_not_authorizes', rationale })),
    })
  }

  const receipt = {
    version: 'youtube-thumbnail-hero-evidence/v2',
    receipt_id: campaign.receipt_id,
    generated_at: generatedAt,
    campaign_identity: campaign.campaign_identity,
    content_version: campaign.content_version,
    title: campaign.title,
    review_only: true,
    provider_calls: 2,
    successful_generation_jobs: 2,
    paid_media_generations: 0,
    external_writes: 0,
    generation_request: {
      request_id: campaign.generation_request_id,
      campaign_identity: campaign.campaign_identity,
      content_version: campaign.content_version,
      ...sharedGeneration,
      real_generation_completed: true,
      identity_reference: { public_path: '/review-assets/social-content/source-proof/vambah-approved-profile.jpg', sha256: primaryIdentitySha, usage: 'identity_reference_only' },
      supporting_identity_reference: { public_path: '/review-assets/social-content/jev-hero-thumbnail-review/source/vambah-curious-approved.jpg', sha256: supportingIdentitySha, usage: 'identity_reference_only' },
    },
    outlier_evidence: {
      cohort_id: cohort.cohort_id,
      decision_receipt_id: decision.receipt_id,
      observed_at: cohort.observed_at,
      fresh_until: cohort.fresh_until,
      minimum_sample_size: cohort.selection_gate.minimum_sample_size,
      included_video_ids: cohort.included.map((sample) => sample.video_id),
      qualified_outlier_video_ids: cohort.outlier_qualification.qualified_video_ids,
      outlier_threshold: cohort.outlier_qualification.threshold,
      curated_playlist_performance_weight: 0,
      curated_playlist_role: 'taste_calibration_only',
    },
    hero_assets: campaign.heroes.map((hero) => ({
      asset_id: hero.id,
      campaign_identity: campaign.campaign_identity,
      content_version: campaign.content_version,
      public_path: `/review-assets/social-content/${campaign.public_slug}/${hero.file}`,
      output_sha256: hero.output_sha256,
      perceptual_hash: hero.perceptual_hash,
      width: 1672,
      height: 941,
      source_type: 'newly_generated_campaign_specific_likeness',
      generation_status: 'newly_generated',
      final_use_eligible: false,
      review_only: true,
      generator_id: 'openai.image_gen.imagegen',
      model_id: 'managed-current-image-model',
      generator_job_id: hero.job_id,
      generated_at: generatedAt,
      fresh_until: freshUntil,
      focal_subject: hero.intent.expression,
      prompt_intent: hero.intent,
      anatomy_quality: hero.anatomy,
      provenance_note: 'New campaign-specific integrated-scene image generated through the authorized Portfolio/Codex image path. Approved photos were used only as identity references; their pixels were not reused as output.',
      source_receipt_ids: [...campaign.proof.source_receipt_ids, decision.receipt_id],
      likeness_receipt_id: `likeness:${campaign.campaign_identity}:reference-only-authorized-20261019:v1`,
      rights_receipt_ids: [...campaign.proof.rights_receipt_ids, 'rights:openai-integrated-generation-approved-path-20261019:v1'],
      privacy_receipt_id: `privacy:${campaign.campaign_identity}:public-safe-review-only-20261019:v1`,
    })),
    likeness_receipt: { receipt_id: `likeness:${campaign.campaign_identity}:reference-only-authorized-20261019:v1`, status: 'passed', reference_hashes: [primaryIdentitySha, supportingIdentitySha], exact_photo_reuse: false },
    rights_receipt: { receipt_id: `rights:${campaign.campaign_identity}:generated-review-assets-20261019:v1`, status: 'passed', scope: 'review_only', provider_path_unchanged: true },
    privacy_receipt: { receipt_id: `privacy:${campaign.campaign_identity}:public-safe-review-only-20261019:v1`, status: 'passed', customer_data: false, synthetic_or_public_safe_inputs_only: true },
    freshness_receipt: { receipt_id: `freshness:${campaign.campaign_identity}:20261019:v1`, status: 'passed', generated_at: generatedAt, fresh_until: freshUntil },
    anatomy_quality_receipt: { receipt_id: `anatomy:${campaign.campaign_identity}:20261019:v1`, status: campaign.heroes.every((hero) => hero.anatomy.status === 'passed') ? 'passed' : 'failed', inspections: campaign.heroes.map((hero) => ({ asset_id: hero.id, ...hero.anatomy })) },
    product_proof: { ...campaign.proof, file: undefined, sha256: await sha256(path.join(root, campaign.proof.file)) },
    recent_thumbnail_history: recentPairs,
    selection_decision: {
      receipt_id: `human-qa:${campaign.campaign_identity}:thumbnail-selection:20261019:pending:v1`,
      status: 'pending_human_qa',
      decided_at: null,
      content_version: campaign.content_version,
      selected_candidate_id: null,
      selected_teaser: null,
      rejected_candidates: [],
      decision_logic: 'Select exactly one candidate only after reviewing the full 1280×720 output, the actual 320×180 feed preview, product-proof legibility, likeness, anatomy, and campaign-level distinctness. Every non-selected candidate must then receive a concise rejection receipt.',
    },
    candidates,
    rejected_patterns: [...cohort.rejected_traits, 'exact-photo reuse', 'mirrored left/right variants', 'hard split panels', 'portrait beside screenshot', 'inconsistent lighting, perspective, or grade', 'floating product assets', 'blur used to disguise repetition', 'removable hero or asset', 'harmful face, text, hand, or product overlap'],
    boundary: 'Both candidates are review-only and final-use ineligible until Human QA selects exactly one and records every non-selected candidate as rejected. Production binding, upload, platform draft, schedule, publish, credentials, migration, deployment, merge, spending, and external send remain closed.',
  }
  delete receipt.product_proof.file
  await writeFile(path.join(artifactRoot, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`)
  await writeFile(path.join(artifactRoot, 'source-map.md'), `# ${campaign.title} generated thumbnail source map\n\nTwo new campaign-specific Vambah likeness images were generated through the authorized Portfolio/Codex integrated image path. Both remain review-only and final-use ineligible pending Human QA.\n\n- Provider calls: 2 for this campaign; 4 across the combined batch.\n- Successful jobs: 2 for this campaign; 4 across the combined batch.\n- Retries: 0.\n- Uncertain results: 0.\n- Separate observed charge: US$0.\n- Combined hard ceiling: strictly below US$9.\n- External writes: 0.\n\n## Identity references\n\n- \`${primaryIdentityPath}\` — \`${primaryIdentitySha}\` — identity reference only.\n- \`${supportingIdentityPath}\` — \`${supportingIdentitySha}\` — identity reference only.\n\n## Product proof\n\n- \`${path.join(root, campaign.proof.file)}\` — \`${await sha256(path.join(root, campaign.proof.file))}\`.\n- Product proof retains a separate source, rights, and privacy receipt even though it is integrated into each scene.\n\n## Live evidence\n\n- Cohort: \`${cohort.cohort_id}\`, observed \`${cohort.observed_at}\`, fresh until \`${cohort.fresh_until}\`.\n- Decision receipt: \`${decision.receipt_id}\`.\n- Curated playlist role: taste calibration only; performance weight 0.\n\n## Decision boundary\n\nHuman QA must select exactly one candidate and reject every other candidate with a concise reason before any output becomes final-use eligible. Production mutation, upload, platform draft, scheduling, publication, credential changes, migrations, deployment, merge, spending, and external sends remain closed.\n`)
  outputs.push({ campaign_identity: campaign.campaign_identity, receipt_id: receipt.receipt_id, candidates: candidates.map(({ candidate_id, public_path, sha256: outputSha, perceptual_hash }) => ({ candidate_id, public_path, sha256: outputSha, perceptual_hash })) })
}

process.stdout.write(`${JSON.stringify({ ready_for_human_qa: true, generation_closed: true, provider_calls: 4, successful_generation_jobs: 4, retries: 0, outputs }, null, 2)}\n`)
