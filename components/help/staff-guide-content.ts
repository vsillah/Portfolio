// Client-safe teaching copy. Evidence and claim limits: docs/staff-onboarding-source-map.md.
export const guideSections = [
  { id: 'business-map', title: 'How the business fits together', hint: 'From a website to a shared workspace' },
  { id: 'workday', title: 'A day in the life', hint: 'Follow one request through six steps' },
  { id: 'boundaries', title: 'Where people make the decisions', hint: 'Approvals, privacy, and safe practice' },
  { id: 'first-week', title: 'Your first week', hint: 'A checklist for your assigned role' },
  { id: 'tool-map', title: 'The tools behind the work', hint: 'What each tool does and how it connects' },
  { id: 'help-glossary', title: 'When you get stuck', hint: 'Recovery steps and a short glossary' },
] as const

export const evolution = [
  ['Show the work', 'A website introduces services, projects, and resources.'],
  ['Organize delivery', 'Intake, proposals, client work, and payments connect around a request.'],
  ['Coordinate assistance', 'Agents and workflows prepare work; people review decisions and inspect receipts.'],
  ['Carry learning forward', 'Open Brain keeps reviewed knowledge with its sources for future work.'],
] as const

export const workday = [
  ['Intake', 'A fictional client asks for help organizing follow-up. Record the need, source, and owner in the assigned workspace.'],
  ['Agent work', 'An assigned assistant prepares a summary and proposed next step. Treat its output as a draft.'],
  ['Review', 'Check the source, facts, recipient, and wording. Return unclear work for revision.'],
  ['Approval', 'The authorized reviewer approves the exact action and version. Approval to prepare a draft does not authorize a send.'],
  ['Execution', 'An authorized person or enabled workflow performs only the approved action after its checks pass.'],
  ['Receipt / audit', 'Check the recorded outcome. A request or approval alone does not prove delivery. Escalate an uncertain result before retrying.'],
] as const

export const toolGroups = [
  { category: 'Core runtime', tools: [
    ['Portfolio · Next.js / React', 'The browser workspace where staff see requests, drafts, decisions, and results. Next.js and React build its pages and actions.'],
  ] },
  { category: 'Data and memory', tools: [
    ['Supabase / Postgres', 'Supabase connects sign-in, database records, and file storage. Postgres is the database underneath. Permissions determine what each account can access.'],
    ['Open Brain', 'The local-first memory core: sources become proposals, then approved memories. Portfolio shows a projection; compiled wiki pages are summaries of approved records.'],
  ] },
  { category: 'Automation', tools: [
    ['n8n', 'Runs configured sequences of tasks behind a workflow. Portfolio can hand work to n8n and receive results. A workflow must be enabled and authorized for its specific action.'],
  ] },
  { category: 'Communication', tools: [
    ['Slack', 'Brings work notifications and review requests to the team. A receipt confirms what was recorded; it does not by itself prove an email or message was sent.'],
    ['Gmail / Google Workspace', 'Supports business email and shared working materials. Portfolio has email review and draft workflows; draft creation and sending have separate permission gates.'],
    ['Telnyx', 'The SMS provider supported by the outreach code. Sending requires provider readiness, an enabled execution gate, and approval for the exact recipient and message.'],
  ] },
  { category: 'AI assistance', tools: [
    ['OpenAI / model providers', 'Help draft, summarize, and classify information through configured AI workflows. Models can be wrong. Use approved inputs and verify output before acting.'],
  ] },
  { category: 'Access and payments', tools: [
    ['1Password', 'Holds approved credentials for people and services. Request access through your supervisor; never copy a password or API key into a task or chat.'],
    ['Infisical', 'The documented secret-management system for runtime/API credentials. Technical owners manage scoped access; staff should use the approved access process.'],
    ['Stripe', 'Handles supported checkout and payment events. Portfolio records related order or proposal status. A prepared proposal is not evidence of payment.'],
  ] },
  { category: 'Build and deployment', tools: [
    ['GitHub / Codex', 'GitHub keeps code history and proposed changes. Codex assists with implementation and review work. A pull request is a proposal until reviewed and merged.'],
    ['Vercel', 'Builds and hosts the site. Preview, staging, and production are different environments; a successful preview does not prove a production release.'],
  ] },
  { category: 'Observability', tools: [
    ['Run history, audit records, deployment metrics', 'Show what ran, what was approved, and where an error occurred. Vercel Speed Insights measures page performance; workflow and provider receipts answer different questions.'],
  ] },
  { category: 'Optional / experimental', tools: [
    ['Jev shadow benchmark', 'An offline, synthetic comparison harness exists in the repo. It uses a mock adapter; live model quality and production readiness are unproven. It grants no permission to send or activate a provider.'],
  ] },
] as const

export const roleChecklists = {
  'Support and coordination': [
    'Day 1: Confirm your supervisor, assigned workspace, and approved sign-in method. Read this guide.',
    'Day 2: With your supervisor, trace one practice request from its source to its recorded outcome.',
    'Day 3: Review a synthetic draft for names, facts, tone, and missing information.',
    'Day 4: Practice returning a draft with a clear correction. Observe an authorized approval.',
    'Day 5: Explain the difference between prepared, approved, and completed. Agree on your next supervised task.',
  ],
  'Reviewer': [
    'Day 1: Confirm which decisions you may approve and which belong to Vambah or another owner.',
    'Day 2: Compare a practice draft with its source; identify unsupported claims.',
    'Day 3: Check the exact recipient, channel, message version, and scope before a practice approval.',
    'Day 4: Walk through a blocked action and its recovery with the owner; avoid bypassing the gate.',
    'Day 5: Inspect an outcome receipt and explain what it proves, what it does not, and when to escalate.',
  ],
  'Technical operator': [
    'Day 1: Confirm access scope, environment, and the current runbook with the technical owner.',
    'Day 2: Trace a synthetic request through Portfolio, its workflow, and its audit record.',
    'Day 3: Verify a blocked provider path without enabling it or using real client data.',
    'Day 4: Prepare a scoped change with tests and a reviewable pull request.',
    'Day 5: Review rollback and deployment evidence with the Integration Captain; keep activation authority separate.',
  ],
} as const

export const glossary = [
  ['Agent', 'Software assigned a bounded task, such as preparing a draft. It is not the decision owner.'],
  ['Workflow', 'A defined sequence of steps, sometimes automated.'],
  ['Approval gate', 'A checkpoint that requires the right person and evidence before proceeding.'],
  ['No egress', 'A bounded task is kept from sending data or actions to outside systems. This is a task-specific restriction, not a claim that the whole company runs offline.'],
  ['Receipt / audit trail', 'A record of an action and its outcome. Check whether it records a request, acceptance, or actual completion.'],
  ['Source of truth', 'The authoritative record. A dashboard or summary may only show a copy.'],
  ['API / webhook', 'A structured way for tools to request work or report an event to another tool.'],
  ['Credential', 'A password, token, or key that grants access. Keep it in the approved password manager.'],
  ['Preview / staging / production', 'A change under review, a testing environment, and the live environment used for real work.'],
  ['Shadow / mock', 'A comparison that does not control real actions / a simulated provider used for testing.'],
] as const
