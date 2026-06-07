import type { CarouselSlide, ContentFormat, ContentPillar, FrameworkVisualType, SocialPlatform } from './social-content'

export const AGENTIC_SOCIAL_LAUNCH_PACKET_PATH = 'docs/agentic-content-linkedin-drafts/2026-06-04-sales-outreach-launch-drafts.md'

export type AgenticSocialLaunchDraft = {
  assetId: string
  title: string
  launchDate: string
  channel: 'linkedin'
  format: ContentFormat
  postText: string
  companionPostText?: string
  ctaText: string
  hashtags: string[]
  contentPillar: ContentPillar
  frameworkVisualType: FrameworkVisualType
  sourceIds: string[]
  sourcePaths: string[]
  primaryClaim: string
  audience: string
  challengerNotes: string[]
  residualHumanDecision: string
  carouselSlides?: CarouselSlide[]
  salesFollowupSeed?: string
}

const sharedSourcePaths = [
  'docs/agentic-enterprise-value-map.md',
  'docs/agentic-value-communications-plan.md',
  'docs/agentic-content-review-packets/p0-challenger-review-packets.md',
  'docs/agentic-content-review-packets/p1-challenger-review-packets.md',
  'docs/agentic-content-review-packets/p2-challenger-review-packets.md',
  'docs/agentic-content-linkedin-drafts/wave-1-drafts.md',
  'docs/linkedin-voice.md',
]

export const AGENTIC_SOCIAL_LAUNCH_DRAFTS: AgenticSocialLaunchDraft[] = [
  {
    assetId: 'p0-linkedin-flagship-agentic-operating-system',
    title: 'Anyone can launch an agent now',
    launchDate: '2026-06-08',
    channel: 'linkedin',
    format: 'single_image',
    postText: `Anyone can launch an agent now.

That is the exciting part.

It is also the part that should make enterprise teams slow down.

The barrier used to be code. You needed enough technical skill to wire up the model, connect the tools, handle the workflow, and get something useful to happen.

That barrier is falling fast.

Open runtimes. Coding agents. Workflow agents. Browser agents. Local tools. Cloud tools. A small team can now get a working agent into motion in a weekend.

But a working agent is not the same thing as a trustworthy operating model.

The real questions start after the demo:

Who assigned the work?
Why did this agent get the task?
What data could it use?
What tools could it touch?
What did it cost?
What did it hand off?
Where did the human approve the side effect?
What proof would you show later if something went wrong?

That is the layer I have been building into Portfolio.

Agents need the operating system around them.

Trace records. Scope boundaries. Handoffs. Approval gates. Quality checks. Challenger review. Mission Control. Slack surfaces for mobile unblock. A client-safe way to explain what happened without exposing private raw material.

That may sound less exciting than watching an agent complete a task in real time.

Good.

Because enterprises do not need more impressive demos that become someone else's operational risk.

Small businesses do not need AI that adds another invisible mess.

Nonprofits do not need tools that create more work for teams already carrying too much.

The value starts when the team knows when it should act, what it was allowed to touch, how the work was evaluated, and where a person had the authority to say yes, pause, repair, or stop.

Execution is becoming cheap.

Governed execution is where the value is.

If your team is starting to adopt agents, what proof would you need before giving one more authority?

#AIProduct #ProductManagement #EnterpriseAI #AmadutownAdvisory`,
    ctaText: 'If your team is starting to adopt agents, what proof would you need before giving one more authority?',
    hashtags: ['#AIProduct', '#ProductManagement', '#EnterpriseAI', '#AmadutownAdvisory'],
    contentPillar: 'ai_product_management',
    frameworkVisualType: 'architecture',
    sourceIds: ['value-map', 'communications-plan', 'p0-challenger', 'linkedin-wave-1', 'linkedin-voice'],
    sourcePaths: sharedSourcePaths,
    primaryClaim: 'The demo is no longer the hard part; governed execution is where the value starts.',
    audience: 'product leaders, operators, founders, AI builders, enterprise leaders',
    challengerNotes: [
      'Unsupported claims resolved.',
      'No private logs, screenshots, client details, or raw chats.',
      'Frames Portfolio as a governed proof surface, not a finished autonomous enterprise platform.',
    ],
    residualHumanDecision: 'Decide whether "enterprise" is the right word for the first launch post, or whether "business" broadens the audience.',
  },
  {
    assetId: 'p0-carousel-seven-things-after-agent-demo',
    title: '7 things your enterprise agent needs after the demo',
    launchDate: '2026-06-09',
    channel: 'linkedin',
    format: 'carousel',
    postText: `The agent demo is usually the easy part now.

The harder question is what has to exist around the agent before a business should trust it with real work.

I keep coming back to seven things:

1. A receipt for every run.
2. A scope boundary the operator can explain.
3. A handoff packet when work changes owners.
4. A human approval gate before side effects.
5. A compliance path for risk and transactions.
6. A QA loop that evaluates the work before authority expands.
7. A Mission Control surface where a person can trace what happened.

That is the difference between an agent that performs and an agent system that can be governed.

I built this carousel because a lot of teams are about to bring agent runtimes into enterprise settings and discover that execution capacity is only the beginning.

Swipe through the operating layer most demos skip.

Which of these seven would you want in place first?

#AIProduct #EnterpriseAI #ProductManagement #AmadutownAdvisory`,
    companionPostText: `The agent demo is usually the easy part now.

The harder question is what has to exist around the agent before a business should trust it with real work.

Swipe through the operating layer most demos skip.

Which of these seven would you want in place first?

#AIProduct #EnterpriseAI #ProductManagement #AmadutownAdvisory`,
    ctaText: 'Which of these seven would you want in place first?',
    hashtags: ['#AIProduct', '#EnterpriseAI', '#ProductManagement', '#AmadutownAdvisory'],
    contentPillar: 'ai_product_management',
    frameworkVisualType: 'architecture',
    sourceIds: ['communications-plan', 'p0-challenger', 'linkedin-wave-1', 'linkedin-voice'],
    sourcePaths: sharedSourcePaths,
    primaryClaim: 'The demo is only one stage; teams need a component model for operational trust.',
    audience: 'enterprise AI evaluators, product leaders, founders, consultants',
    challengerNotes: [
      'Unsupported claims resolved in outline form.',
      'Final design must use diagrams or sanitized UI only.',
      'Does not imply every path is fully autonomous or production-mutating.',
    ],
    residualHumanDecision: 'Decide whether cover says "enterprise agent" or "business agent."',
    carouselSlides: [
      { type: 'cover', eyebrow: 'Agentic Operations', headline: 'The 7 things your enterprise agent needs after the demo', subhead: 'Execution capacity is only the beginning.', byline: 'Vambah Sillah' },
      { type: 'principle', number: 1, pill: 'Receipt', headline: 'Every run needs proof', body: 'Trace the run, artifacts, cost, approvals, and handoffs. The system needs a receipt a human can inspect later.', accent_word: 'proof' },
      { type: 'principle', number: 2, pill: 'Scope', headline: 'Bound the authority', body: 'Name the tools, data, writes, outbound actions, and spend limits. Scope should be explainable outside the prompt.', accent_word: 'authority' },
      { type: 'principle', number: 3, pill: 'Handoff', headline: 'Package the work', body: 'When work changes owners, the next agent or human needs a summary, acceptance criteria, and linked evidence.', accent_word: 'work' },
      { type: 'principle', number: 4, pill: 'Approval', headline: 'Gate the side effect', body: 'Let the agent prepare the work. Keep publishing, sending, spending, and production changes behind human approval.', accent_word: 'gate' },
      { type: 'principle', number: 5, pill: 'Compliance', headline: 'Give risk a path', body: 'Transactions and sensitive actions need traceability, escalation, and a governance export when the stakes rise.', accent_word: 'risk' },
      { type: 'principle', number: 6, pill: 'QA', headline: 'Evaluate before authority', body: 'Use rubrics, challenger review, and coaching signals before expanding what the agent can do.', accent_word: 'authority' },
      { type: 'principle', number: 7, pill: 'Mission Control', headline: 'Make work visible', body: 'Operators need a surface to see what happened, what is blocked, and what decision is needed next.', accent_word: 'visible' },
      { type: 'cta', headline: 'Governed execution is where the value is.', body: 'Which of these seven would you want in place first?', cta_label: 'Compare notes', hashtags: ['#AIProduct', '#EnterpriseAI', '#AmadutownAdvisory'] },
    ],
  },
  {
    assetId: 'p1-linkedin-scope-safety-model',
    title: 'Scope is the safety model',
    launchDate: '2026-06-10',
    channel: 'linkedin',
    format: 'single_image',
    postText: `Agent access should feel less like a blank check and more like a permission slip.

What can this agent read?

What can it write?

Can it touch client data?

Can it send a message, publish a post, change production, start a paid job, or spend money?

Those questions sound boring until an agent does something fast, confident, and wrong.

That is why scope matters.

In Portfolio, I have been treating scope as part of the product.

Not a security appendix.

Not a line buried in a prompt.

A product feature.

If an agent is going to act on behalf of a business, the operator should be able to explain its boundary in plain language:

- what tools it can call
- what data it can use
- what write actions are allowed
- what outbound actions are blocked
- what spending requires approval
- what happens when the risk changes

That last part matters.

Good scope goes past a permissions list. It gives the team a path for escalation.

The agent can prepare the work.

The system can record the evidence.

The human still approves the side effect when the action carries real risk.

That is how you avoid giving the agent more authority than the organization can explain.

The goal is not to make every agent powerful.

The goal is to make every agent appropriately bounded.

Can your team explain what your agents are allowed to read, write, send, spend, and change?

#AIProduct #EnterpriseAI #ProductManagement #AmadutownAdvisory`,
    ctaText: 'Can your team explain what your agents are allowed to read, write, send, spend, and change?',
    hashtags: ['#AIProduct', '#EnterpriseAI', '#ProductManagement', '#AmadutownAdvisory'],
    contentPillar: 'ai_product_management',
    frameworkVisualType: 'matrix',
    sourceIds: ['communications-plan', 'p1-challenger', 'linkedin-wave-1', 'linkedin-voice'],
    sourcePaths: sharedSourcePaths,
    primaryClaim: 'Scope is not a prompt detail; it is the operating boundary that makes agent authority explainable.',
    audience: 'product leaders, risk/compliance partners, founders, AI operators',
    challengerNotes: [
      'Unsupported claims resolved.',
      'The post describes operating discipline and does not claim unrestricted production authority.',
      'No privacy flags.',
    ],
    residualHumanDecision: 'Decide whether "blank check" should remain for a security-forward audience.',
  },
  {
    assetId: 'p1-linkedin-agent-qa-scorecards',
    title: 'Agent QA needs scorecards',
    launchDate: '2026-06-11',
    channel: 'linkedin',
    format: 'single_image',
    postText: `If an agent cannot evaluate its work, it should not get more power.

That is the management rule I keep coming back to.

A good answer is not enough.

I want to know how the work happened.

Did it choose the right tool?
Did it stay inside scope?
Did it route the work to the right owner?
Did it ask for approval when the task became sensitive?
Did it preserve the evidence?
Did the cost make sense for the value of the work?

That is why agent QA needs scorecards.

Rubrics.

Run evaluations.

Pass and fail signals.

Coaching notes.

Trend lines that show whether the system is getting better for the right reason.

Sometimes the lesson is that the agent needs a better prompt.

Sometimes it needs a smaller scope.

Sometimes it needs a different tool.

Sometimes it should stop and ask a human instead of trying to sound certain.

That is the part I think many teams will underestimate.

Agent quality includes the final output, but the path matters just as much.

In Portfolio, I have been pairing quality checks with challenger review before the work reaches human approval.

That matters because humans should not be doing the agent's first round of QA.

The human decision should be higher value:

Is this aligned?

Is this safe?

Is this ready to publish, send, spend, change, or escalate?

A human reviewer should receive a decision packet, not a mystery.

Where would your team draw the line between an agent that can draft and an agent that can act?

#AIProduct #ProductManagement #EnterpriseAI #AmadutownAdvisory`,
    ctaText: 'Where would your team draw the line between an agent that can draft and an agent that can act?',
    hashtags: ['#AIProduct', '#ProductManagement', '#EnterpriseAI', '#AmadutownAdvisory'],
    contentPillar: 'ai_product_management',
    frameworkVisualType: 'cycle',
    sourceIds: ['communications-plan', 'p1-challenger', 'linkedin-wave-1', 'linkedin-voice'],
    sourcePaths: sharedSourcePaths,
    primaryClaim: 'Agents should earn authority through evaluation, traces, and challenger loops.',
    audience: 'product leaders, AI program owners, operations leaders',
    challengerNotes: [
      'Unsupported claims resolved.',
      'The post describes scorecards and challenger review at the operating-pattern level.',
      'It does not claim all reflection loops are fully autonomous.',
    ],
    residualHumanDecision: 'Decide whether to expand this into a carousel on "how an agent earns authority."',
  },
  {
    assetId: 'p2-client-one-pager-governed-agentic-operations',
    title: 'Governed Agentic Operations',
    launchDate: '2026-06-12',
    channel: 'linkedin',
    format: 'single_image',
    postText: `I have been building my Portfolio site like a proof surface for one question:

What does it take to make AI agents useful in the real world?

The answer keeps getting more practical.

Launching the agent is only the opening move.

You need the harness around it.

The trace that shows what happened.

The scope boundary that limits what it can touch.

The memory model that separates raw input from approved knowledge.

The handoff packet that tells the next agent what to do.

The approval gate that keeps side effects under human authority.

The QA loop that tests work before a person is asked to approve it.

The Mission Control surface that lets an operator see the work instead of guessing.

That is what I mean by Governed Agentic Operations.

For a small business, that might mean an agent can prepare outreach but cannot send it without approval.

For a nonprofit, it might mean AI can summarize program work without exposing private participant context.

For an enterprise team, it might mean every agent run leaves a receipt, every handoff has an owner, and every production-changing action has a decision trail.

This is where AI consulting has to get more honest.

The demo can show what is possible.

The operating model shows whether it is responsible.

I am starting to package this work for leaders who want agents in their organization but do not want a loose pile of automation risk.

If that is the conversation you are having internally, I would be glad to compare notes.

#AIProduct #EnterpriseAI #Consulting #AmadutownAdvisory`,
    ctaText: 'If that is the conversation you are having internally, I would be glad to compare notes.',
    hashtags: ['#AIProduct', '#EnterpriseAI', '#Consulting', '#AmadutownAdvisory'],
    contentPillar: 'entrepreneurship',
    frameworkVisualType: 'architecture',
    sourceIds: ['value-map', 'communications-plan', 'p2-challenger', 'linkedin-wave-1', 'linkedin-voice'],
    sourcePaths: sharedSourcePaths,
    primaryClaim: 'The portfolio is useful because it shows the operating layer around agentic AI alongside the agent.',
    audience: 'founders, nonprofit executives, small business owners, enterprise AI sponsors',
    challengerNotes: [
      'Unsupported claims resolved.',
      'No private run logs, client data, or raw screenshots.',
      'Uses "might mean" examples rather than claiming all client workflows are deployed.',
    ],
    residualHumanDecision: 'Decide whether to keep the direct "glad to compare notes" close or turn it into a softer question.',
    salesFollowupSeed: 'Appreciate you engaging with the agentic operations post. The part I am trying to make more concrete for leaders is the operating layer after the demo: scope, trace, handoff, approval, QA, and client-safe proof. If your team is exploring agents, I would be glad to compare notes on what has to be in place before the system gets more authority.',
  },
]

export function getAgenticSocialLaunchDraftByAssetId(assetId: string) {
  return AGENTIC_SOCIAL_LAUNCH_DRAFTS.find((draft) => draft.assetId === assetId) ?? null
}

export function buildAgenticSocialLaunchDraftRow(draft: AgenticSocialLaunchDraft, seededByUserId: string) {
  return {
    platform: draft.channel as SocialPlatform,
    status: 'draft',
    post_text: draft.postText,
    companion_post_text: draft.companionPostText ?? null,
    cta_text: draft.ctaText,
    cta_url: null,
    hashtags: draft.hashtags,
    image_prompt: `Create an AmaduTown-branded ${draft.frameworkVisualType} visual for ${draft.title}. Use sanitized diagrams only; do not use private logs, screenshots, or client data.`,
    framework_visual_type: draft.frameworkVisualType,
    voiceover_text: draft.postText,
    topic_extracted: {
      topic: draft.title,
      angle: draft.primaryClaim,
      key_insight: draft.primaryClaim,
      personal_tie_in: 'Portfolio shows the operating layer around agentic AI: trace, scope, handoff, approval, QA, and human review.',
      framework_visual: draft.frameworkVisualType,
    },
    hormozi_framework: {
      framework_type: 'value_equation',
      hook_type: 'operational_tension',
      proof_pattern: 'source_packet_to_governed_draft',
      cta_pattern: 'operator_question',
    },
    rag_context: {
      source: 'agentic_sales_outreach_launch_draft',
      launch_draft_asset_id: draft.assetId,
      launch_packet_path: AGENTIC_SOCIAL_LAUNCH_PACKET_PATH,
      source_ids: draft.sourceIds,
      source_paths: draft.sourcePaths,
      challenger_agent: 'Amina',
      challenger_status: 'passed',
      approval_status: 'human_review_ready',
      pass_to_human: true,
      launch_date: draft.launchDate,
      audience: draft.audience,
      primary_claim: draft.primaryClaim,
      residual_human_decision: draft.residualHumanDecision,
      sales_followup_seed: draft.salesFollowupSeed ?? null,
      seeded_by_user_id: seededByUserId,
      approval_required_for: ['schedule', 'publish', 'outbound_send', 'visual_build', 'provider_execution'],
    },
    admin_notes: [
      `Seeded from ${AGENTIC_SOCIAL_LAUNCH_PACKET_PATH}.`,
      `Asset ID: ${draft.assetId}.`,
      'Draft only. Scheduling, publishing, outbound follow-up, visual build, and provider work require separate approval.',
      `Amina challenger notes: ${draft.challengerNotes.join(' ')}`,
      `Residual human decision: ${draft.residualHumanDecision}`,
    ].join('\n'),
    target_platforms: ['linkedin'],
    video_generation_method: 'none',
    content_format: draft.format,
    content_pillar: draft.contentPillar,
    carousel_slides: draft.carouselSlides ?? null,
  }
}
