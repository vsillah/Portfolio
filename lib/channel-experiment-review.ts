export const CHANNEL_EXPERIMENT_PACKET_IDS = [
  '407df879-a539-40a1-a20e-75de31b9c494',
  '61d0ab8a-29fa-40de-aa7a-49b15c74cafa',
  '048a80bb-bcfa-48d7-9d90-ce66d36f4523',
] as const

export type ChannelExperimentPacketId = (typeof CHANNEL_EXPERIMENT_PACKET_IDS)[number]
export type ExperimentChannel = 'linkedin' | 'youtube'

export type EvidenceLink = {
  label: string
  href: string
  kind: 'public_source' | 'research_packet' | 'owned_proof'
}

export type ExperimentScore = {
  label: string
  value: number | null
  input: string
  inputLink: string
}

export type LinkedInExperiment = {
  id: string
  label: string
  hypothesis: string
  hook: string
  bodyStructure: string[]
  cta: string
  productTieIn: string
  visualBrief: string
}

export type YouTubeExperiment = {
  id: string
  label: string
  hypothesis: string
  title: string
  thumbnailConcept: string
  openingHook: string
  outline: string[]
  description: string
  cta: string
  productTieIn: string
  visualEvidence: string[]
}

export type ChannelExperimentReview = {
  packetId: ChannelExperimentPacketId
  campaignTitle: string
  audience: string
  approvedClaims: string[]
  evidenceBoundary: string[]
  uniqueVambahAngle: string
  outlierBasis: string
  originalityRisk: string
  evidenceLinks: EvidenceLink[]
  formula: string
  scores: ExperimentScore[]
  missingEvidence: string[]
  linkedin: LinkedInExperiment[]
  youtube: YouTubeExperiment[]
}

const packetHref = (packetId: ChannelExperimentPacketId) => `/admin/agents/content-intelligence?section=research&packet=${packetId}`

const sharedScoreLinks = (packetId: ChannelExperimentPacketId, outlier: number, sourceFit: number, productEvidence: number, originality: number): ExperimentScore[] => [
  { label: 'Outlier', value: outlier, input: 'Public YouTube cohort score recorded in the packet', inputLink: packetHref(packetId) },
  { label: 'Source fit', value: sourceFit, input: 'Strategic fit and source review recorded in the packet', inputLink: packetHref(packetId) },
  { label: 'Product evidence', value: productEvidence, input: 'Existing owned proof named in the packet', inputLink: packetHref(packetId) },
  { label: 'Originality', value: originality, input: 'Packet originality review', inputLink: packetHref(packetId) },
  { label: 'Variant performance', value: null, input: 'No channel experiment has run yet', inputLink: packetHref(packetId) },
]

export const CHANNEL_EXPERIMENT_REVIEWS: Record<ChannelExperimentPacketId, ChannelExperimentReview> = {
  '407df879-a539-40a1-a20e-75de31b9c494': {
    packetId: '407df879-a539-40a1-a20e-75de31b9c494',
    campaignTitle: 'Stop Counting AI Licenses',
    audience: 'Business, nonprofit, and transformation leaders who need to know whether AI adoption is producing governed operating value.',
    approvedClaims: [
      'A license count measures inventory. It does not show whether AI improved a decision, completed delegated work, or left evidence behind.',
      'A useful readiness review checks delegated work, decision ownership, evidence coverage, recovery paths, and measured outcomes.',
      'The AI Audit Calculator can make those operating questions concrete with a privacy-safe example.',
    ],
    evidenceBoundary: [
      'Use the public enterprise report for context without transferring its benchmarks to AmaduTown.',
      'Use synthetic or privacy-safe audit examples only.',
      'Keep ROI and performance claims qualitative until an approved outcome receipt exists.',
    ],
    uniqueVambahAngle: 'Vambah has built an AI readiness assessment and operates agent workflows with explicit evidence, review, and privacy gates. The campaign connects executive measurement language to the mechanics an operator can inspect.',
    outlierBasis: 'Five-video public YouTube cohort observed October 15, 2026. The selected source reached a 13.47 view-to-follower ratio against a 3.66 cohort median. Two distribution anomalies were excluded from comparison.',
    originalityRisk: 'Low to medium. Readiness assessments are familiar; delegated work and evidence coverage make this version specific. Avoid generic maturity-model language.',
    evidenceLinks: [
      { label: 'Approved research packet', href: packetHref('407df879-a539-40a1-a20e-75de31b9c494'), kind: 'research_packet' },
      { label: 'Primary public source', href: 'https://www.youtube.com/watch?v=C4m8LS2Jzqs', kind: 'public_source' },
      { label: 'AI Audit Calculator screenshot', href: '/audit_calculator_img.png', kind: 'owned_proof' },
    ],
    formula: 'Campaign readiness = 0.50 x outlier + 0.20 x source fit + 0.20 x product evidence + 0.10 x originality = 78/100.',
    scores: sharedScoreLinks('407df879-a539-40a1-a20e-75de31b9c494', 64, 93, 90, 91),
    missingEvidence: ['AmaduTown outcome benchmark', 'LinkedIn variant results', 'YouTube variant results'],
    linkedin: [
      {
        id: 'licenses-li-a',
        label: 'Variant A · CFO dashboard',
        hypothesis: 'A familiar executive dashboard frame will make the measurement gap easy to recognize and discuss.',
        hook: 'Your AI dashboard says 312 licenses are active. What decision got better?',
        bodyStructure: [
          'Open on the gap between a clean adoption dashboard and an operator who still cannot trace a delegated task to a result.',
          'Replace the seat count with five review questions: delegated work, decision owner, evidence, recovery path, and measured outcome.',
          'Show how the AI Audit Calculator turns the questions into a bounded readiness review without promising ROI.',
        ],
        cta: 'What does your AI dashboard measure today: activity or operating value?',
        productTieIn: 'Use the existing AI Audit Calculator screen as the owned proof point. Crop to the scored dimensions and remove any identifying input.',
        visualBrief: 'Single-image dashboard contrast. Left: a large license count. Right: the five operating questions with the calculator screenshot inset. Label the audit data as a privacy-safe sample.',
      },
      {
        id: 'licenses-li-b',
        label: 'Variant B · Monday morning test',
        hypothesis: 'A practical operating scene will earn attention from leaders who tune out maturity-model language.',
        hook: 'Monday morning. The AI pilot is live. Nobody can explain what happens when the agent is wrong.',
        bodyStructure: [
          'Stay with the meeting: one person reports seats, another reports prompts, and the recovery question has no owner.',
          'Name the four receipts the meeting needs before scale: delegated task, decision boundary, evidence trail, and recovery owner.',
          'Close with a small test leaders can run against one workflow before buying another license.',
        ],
        cta: 'Pick one AI workflow. Who owns the decision when the model is wrong?',
        productTieIn: 'Use a privacy-safe audit report excerpt only after the screen is captured from the real product flow. Until then, keep this as a screenshot brief.',
        visualBrief: 'Four-panel document carousel: meeting tension, missing owner, receipt checklist, one-workflow audit. No practitioner anecdote or invented company scene should be presented as fact.',
      },
    ],
    youtube: [
      {
        id: 'licenses-yt-a',
        label: 'Variant A · Scorecard teardown',
        hypothesis: 'A diagnostic teardown will attract operators searching for a concrete alternative to adoption counts.',
        title: 'Stop Counting AI Licenses: Build a Readiness Scorecard That Shows the Work',
        thumbnailConcept: 'Split screen: "312 LICENSES" with a red question mark versus "5 OPERATING RECEIPTS" beside the real calculator screen.',
        openingHook: 'If your AI scorecard begins with licenses and ends with weekly users, it stops before the work starts.',
        outline: [
          'Audit a typical adoption dashboard and explain exactly what each activity metric cannot prove.',
          'Walk through the five operating dimensions with one synthetic workflow.',
          'Open the AI Audit Calculator and show how the same questions become a repeatable review.',
          'End with the evidence still missing: approved outcomes, cost baselines, and longitudinal results.',
        ],
        description: 'A practical walkthrough for leaders who need evidence of delegated work, decision ownership, recovery, and outcomes. The example is synthetic and does not claim an AmaduTown ROI benchmark.',
        cta: 'Run the five-question review on one workflow, then comment with the dimension your current dashboard misses.',
        productTieIn: 'Screen-record the real AI Audit Calculator with a synthetic sample. Do not recreate the interface or invent a completed customer audit.',
        visualEvidence: ['Existing calculator screenshot', 'Screen-recording brief for the real calculator flow', 'On-screen source card for the public enterprise context'],
      },
      {
        id: 'licenses-yt-b',
        label: 'Variant B · Failed handoff story',
        hypothesis: 'A workflow failure and recovery story will make governance concrete without relying on an unsupported practitioner testimonial.',
        title: 'Your AI Pilot Worked. Then the Handoff Broke.',
        thumbnailConcept: 'A clean green demo card feeding into a broken handoff arrow. Text: "WHO OWNS THE MISS?"',
        openingHook: 'The demo answered the prompt. The team still had to guess who could approve the result, where the evidence lived, and how to recover.',
        outline: [
          'Use a clearly labeled composite scenario, not a claimed client story.',
          'Follow the handoff through task delegation, decision ownership, evidence capture, and recovery.',
          'Map each failure to one AI Audit Calculator dimension.',
          'Finish with the minimum evidence needed before expanding the pilot.',
        ],
        description: 'A composite operating scenario that tests whether an AI pilot can survive the handoff after a successful demo. No practitioner anecdote or client result is claimed.',
        cta: 'Pause one pilot expansion and test the recovery path before adding more seats.',
        productTieIn: 'Use the calculator as the closing diagnostic, supported by a real screen capture and synthetic inputs.',
        visualEvidence: ['Explicitly labeled composite workflow diagram', 'Existing calculator screenshot', 'Screenshot brief: evidence-coverage result with synthetic data'],
      },
    ],
  },
  '61d0ab8a-29fa-40de-aa7a-49b15c74cafa': {
    packetId: '61d0ab8a-29fa-40de-aa7a-49b15c74cafa',
    campaignTitle: "The Product Manager's New Operating System",
    audience: 'Product managers, product leaders, and operators expected to deliver with AI without losing judgment or accountability.',
    approvedClaims: [
      'The modern PM increasingly owns the loop from signal to decision to evidence.',
      'AI-assisted building can shorten discovery and prototyping while increasing the need for explicit judgment and governance.',
      'The SAM Loop provides an original teaching structure for signal, assumption, making, and measured learning.',
    ],
    evidenceBoundary: [
      'Treat public audience demand as directional evidence rather than guaranteed performance.',
      'Use the SAM Loop and Vambah\'s products as the original teaching structure.',
      'Do not imply that cited creators endorse Accelerated.',
    ],
    uniqueVambahAngle: 'Vambah wrote Accelerated, built the SAM Loop, leads product work, and uses Portfolio to turn the framework into an operating system. The teaching can move between executive product judgment and the actual review screens behind the work.',
    outlierBasis: 'Five-video public YouTube cohort observed October 15, 2026. The source recorded an 11.35 view-to-follower ratio against a 2.42 cohort median. One extreme distribution anomaly was excluded.',
    originalityRisk: 'Medium. AI product-management courses are crowded. Keep the piece anchored in the SAM Loop, Vambah\'s own product screens, and decisions he can substantiate.',
    evidenceLinks: [
      { label: 'Approved research packet', href: packetHref('61d0ab8a-29fa-40de-aa7a-49b15c74cafa'), kind: 'research_packet' },
      { label: 'Primary public source', href: 'https://www.youtube.com/watch?v=KjYCEiBTHFo', kind: 'public_source' },
      { label: 'Accelerated cover', href: '/accelerated_cover_ebook.jpg', kind: 'owned_proof' },
    ],
    formula: 'Campaign readiness = 0.50 x outlier + 0.20 x source fit + 0.20 x product evidence + 0.10 x originality = 75/100.',
    scores: sharedScoreLinks('61d0ab8a-29fa-40de-aa7a-49b15c74cafa', 59, 96, 90, 84),
    missingEvidence: ['Channel-specific comparable cohort', 'Approved Accelerated course-screen receipt', 'LinkedIn and YouTube experiment results'],
    linkedin: [
      {
        id: 'pm-os-li-a',
        label: 'Variant A · Job description rewrite',
        hypothesis: 'A before-and-after operating model will help experienced PMs name work they already feel shifting.',
        hook: 'The product manager job description changed before most companies rewrote it.',
        bodyStructure: [
          'Start with the old handoff: collect requirements, rank the backlog, wait for delivery.',
          'Show the new loop: capture a signal, test an assumption, build a bounded artifact, decide, and retain the evidence.',
          'Connect each move to the SAM Loop and one real Portfolio review surface.',
        ],
        cta: 'Which part of your PM job changed first: discovery, building, or governance?',
        productTieIn: 'Pair the Accelerated cover with a sourced screenshot brief for the Portfolio evidence scorecard. The screenshot must come from the actual review route.',
        visualBrief: 'Six-frame carousel built around the SAM Loop. Use the real book cover on the final frame and an exact-route Portfolio screenshot only after capture.',
      },
      {
        id: 'pm-os-li-b',
        label: 'Variant B · Builder confession',
        hypothesis: 'A first-person builder reflection will separate the post from generic AI-PM advice.',
        hook: 'I can move from an idea to a working product before the meeting that requested it ends. That speed changes the PM job.',
        bodyStructure: [
          'Name the useful speed: prototypes can answer questions while the question is still alive.',
          'Name the cost: weak assumptions now travel into working software faster.',
          'Share the operating rule from Accelerated: move fast to discover, then slow down to scale with evidence and a decision owner.',
        ],
        cta: 'Where has faster building improved your judgment, and where has it made review harder?',
        productTieIn: 'Use a real Portfolio screen and the Accelerated cover as two separate proof points. Do not imply the screen is part of the book unless the source register says so.',
        visualBrief: 'Single-image desk composition: Accelerated cover, a real Portfolio review screenshot, and the line "Speed moved. Judgment still belongs to us."',
      },
    ],
    youtube: [
      {
        id: 'pm-os-yt-a',
        label: 'Variant A · SAM Loop lesson',
        hypothesis: 'A named framework lesson will attract PMs who want a repeatable method instead of another tool roundup.',
        title: "The Product Manager's New Operating System: The SAM Loop for AI Work",
        thumbnailConcept: 'Vambah beside a four-step SAM Loop diagram. Text: "PMs OWN THE LOOP".',
        openingHook: 'AI can shorten the distance between an assumption and a working artifact. It cannot decide whether the assumption deserves to survive.',
        outline: [
          'Explain how the PM handoff changed and what did not move: accountability for the decision.',
          'Teach each SAM Loop stage with a bounded product example.',
          'Show the Portfolio review and evidence surfaces that retain the decision trail.',
          'Close with a one-week exercise PMs can run on one live assumption.',
        ],
        description: 'A product-backed lesson on using the SAM Loop to move from signal to evidence while keeping human judgment visible. Public trend sources indicate interest; they do not endorse Accelerated.',
        cta: 'Choose one assumption in your backlog and run it through the SAM Loop this week.',
        productTieIn: 'Use the Accelerated cover, the approved infographic only after it is staged with provenance, and a real Portfolio review capture.',
        visualEvidence: ['Existing Accelerated cover', 'Screenshot brief: Portfolio evidence scorecard', 'Provenance-gated brief for the Drive-hosted Accelerated infographic'],
      },
      {
        id: 'pm-os-yt-b',
        label: 'Variant B · Build-with-me operating review',
        hypothesis: 'A screen-led working session will prove the operating method more clearly than a classroom-style explainer.',
        title: 'I Built the Product Brief With AI. Then I Audited Every Decision.',
        thumbnailConcept: 'Real review screen with two labels: "BUILT FAST" and "REVIEWED SLOW".',
        openingHook: 'Watch what happens after the AI produces a convincing first draft. That is where the product-management work begins.',
        outline: [
          'Start with a privacy-safe product brief and identify the assumptions the draft hid.',
          'Trace sources, mark unsupported fields Unscored, and assign the human decision.',
          'Revise the artifact with the SAM Loop visible on screen.',
          'Compare the first and reviewed versions without claiming a productivity benchmark.',
        ],
        description: 'A privacy-safe working session that shows the review work behind an AI-assisted product brief. The episode demonstrates a method, not a universal speed or quality claim.',
        cta: 'Audit one AI-assisted brief and count the assumptions that arrived without evidence.',
        productTieIn: 'The Portfolio evidence workflow is the working environment; Accelerated supplies the teaching frame.',
        visualEvidence: ['Exact-route Portfolio screen recording brief', 'Accelerated cover', 'Before-and-after synthetic product brief'],
      },
    ],
  },
  '048a80bb-bcfa-48d7-9d90-ce66d36f4523': {
    packetId: '048a80bb-bcfa-48d7-9d90-ce66d36f4523',
    campaignTitle: 'The Agent Harness Is the Product',
    audience: 'Product, operations, and transformation leaders moving from AI demos to governed execution.',
    approvedClaims: [
      'An operational agent needs memory, permissions, evaluation, human decisions, and receipts around the model.',
      'A successful demo does not establish safe operation or recovery.',
      'Portfolio and Agentified contain concrete examples of version-bound decisions, challenger checks, privacy gates, and provider-off review paths.',
    ],
    evidenceBoundary: [
      'Use public engagement metadata as directional evidence, not causal proof.',
      'Show Vambah\'s own products and workflows without copying source wording or visual composition.',
      'Do not claim client outcomes without an approved attributable receipt.',
    ],
    uniqueVambahAngle: 'Vambah has built the surrounding systems and documented the operating model in Agentified. The strongest proof is the visible decision trail: what the agent saw, what it could do, what challenged it, and who approved the next move.',
    outlierBasis: 'Five-video public YouTube cohort observed October 15, 2026. The selected source recorded an 8.33 view-to-follower ratio against a 5.66 cohort median. Two extreme distribution anomalies were excluded.',
    originalityRisk: 'Medium. Agent-stack explainers are common. Lead with receipts, governed execution, and real product screens instead of another architecture diagram.',
    evidenceLinks: [
      { label: 'Approved research packet', href: packetHref('048a80bb-bcfa-48d7-9d90-ce66d36f4523'), kind: 'research_packet' },
      { label: 'Primary public source', href: 'https://www.youtube.com/watch?v=_w-jVw8Uhc0', kind: 'public_source' },
      { label: 'Agentified cover', href: '/agentified-cover.jpg', kind: 'owned_proof' },
      { label: 'Agent QA scorecards', href: '/agentified/social-visuals/2026-07-31/linkedin-agent-qa-scorecards.png', kind: 'owned_proof' },
    ],
    formula: 'Campaign readiness = 0.50 x outlier + 0.20 x source fit + 0.20 x product evidence + 0.10 x originality = 73/100.',
    scores: sharedScoreLinks('048a80bb-bcfa-48d7-9d90-ce66d36f4523', 52, 95, 95, 88),
    missingEvidence: ['Approved client outcome receipt', 'Channel-specific variant benchmark', 'Completed experiment results'],
    linkedin: [
      {
        id: 'harness-li-a',
        label: 'Variant A · Seven-layer teardown',
        hypothesis: 'A saveable architecture breakdown will give technical and operating leaders a shared review language.',
        hook: 'Your agent demo worked. That proves the model can answer. The other six systems still have to hold.',
        bodyStructure: [
          'Name the seven layers: model, memory, permission, evaluation, human decision, receipt, and operating result.',
          'Use a real Portfolio receipt to show how one layer connects to the next.',
          'Ask readers to identify the first missing layer in their current stack.',
        ],
        cta: 'Which layer is missing from your current agent stack?',
        productTieIn: 'Use the existing Agentified QA scorecard visual and a real Portfolio decision-receipt crop. Keep the two sources separately labeled.',
        visualBrief: 'Seven-frame architecture carousel. Each frame pairs one layer with the exact question an operator should ask. The final frame uses the Agentified cover.',
      },
      {
        id: 'harness-li-b',
        label: 'Variant B · Receipt-first proof',
        hypothesis: 'Opening with a real decision receipt will make governance feel like product design rather than policy overhead.',
        hook: 'I trust an agent more when I can see what it was forbidden to do.',
        bodyStructure: [
          'Open on the permission boundary and the decision that stayed with a human.',
          'Trace the receipt backward to source evidence and forward to the next allowed action.',
          'Explain why the harness creates operational trust without claiming that it eliminates failure.',
        ],
        cta: 'Could your team reconstruct one agent decision tomorrow without asking the model to explain itself?',
        productTieIn: 'Use the source-trace and decision-receipt screens from Portfolio after exact-route capture. The Agentified scope-safety visual can support the boundary explanation.',
        visualBrief: 'Single-image annotated receipt. Callouts: source, scope, challenger, human decision, next action. Use a synthetic or already-public record.',
      },
    ],
    youtube: [
      {
        id: 'harness-yt-a',
        label: 'Variant A · Systems breakdown',
        hypothesis: 'A product-backed systems lesson will outperform a model-centric agent tutorial for the target audience.',
        title: 'The Agent Harness Is the Product: 7 Systems Your Demo Still Needs',
        thumbnailConcept: 'Small model box inside a larger ring of six systems. Text: "THE MODEL ISN\'T THE SYSTEM".',
        openingHook: 'The model is usually the easiest part to replace. The permission boundary, evidence trail, and recovery path are where the product earns trust.',
        outline: [
          'Separate the model from the operating harness.',
          'Walk through all seven layers with a privacy-safe Portfolio example.',
          'Show the Agentified scorecard and scope-safety visual as owned teaching assets.',
          'End with a pre-production review leaders can run without calling a provider.',
        ],
        description: 'A seven-layer review of the systems around an AI agent, grounded in Agentified and Portfolio. Public engagement signals are directional; no client outcome is claimed.',
        cta: 'Map your agent against the seven layers and mark every missing receipt before the next demo.',
        productTieIn: 'Agentified supplies the operating model; Portfolio supplies the real review and receipt mechanics.',
        visualEvidence: ['Agentified cover', 'Existing agent QA scorecard visual', 'Screenshot brief: exact Portfolio decision-receipt and source-trace screens'],
      },
      {
        id: 'harness-yt-b',
        label: 'Variant B · Receipt reconstruction',
        hypothesis: 'A forensic reconstruction will make the value of the harness memorable to leaders who have already seen agent diagrams.',
        title: 'Can You Reconstruct What Your AI Agent Did? A Receipt Test',
        thumbnailConcept: 'A missing evidence trail between "AGENT ACTED" and "HUMAN APPROVED." Text: "PROVE THE PATH".',
        openingHook: 'Imagine the decision is challenged tomorrow. Can your team show the source, scope, evaluation, and human approval that produced it?',
        outline: [
          'Present a synthetic disputed decision and define the reconstruction test.',
          'Recover the source, permission scope, evaluation, and human decision from the Portfolio trail.',
          'Show where a demo-only stack fails the test.',
          'Translate the findings into a minimum harness checklist.',
        ],
        description: 'A synthetic receipt reconstruction using real Portfolio mechanics. The episode tests traceability and recovery without presenting a client story or claiming that the harness prevents every failure.',
        cta: 'Try the receipt test on one agent decision and write down the first missing link.',
        productTieIn: 'Use real Portfolio receipt screens with synthetic data and close on the Agentified scope-safety model.',
        visualEvidence: ['Synthetic disputed-decision card', 'Exact-route Portfolio trace capture brief', 'Existing Agentified scope-safety visual'],
      },
    ],
  },
}

export function channelExperimentReviewForPacket(packetId: string): ChannelExperimentReview | null {
  return CHANNEL_EXPERIMENT_REVIEWS[packetId as ChannelExperimentPacketId] ?? null
}
