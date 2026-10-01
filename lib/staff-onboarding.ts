/** Public-safe orientation copy. Evidence and review limits: docs/staff-onboarding/sources.md. */
export const onboardingRoute = '/admin/help/onboarding'
export const onboardingReviewed = 'October 1, 2026'
export const onboardingIntro = 'A client asks for an update. You need to find the work, see who owns the next step, and know what you can safely do. Portfolio brings those decisions into one workspace.'
export const onboardingDefinition = 'Portfolio is AmaduTown’s website and operating workspace. Visitors explore services and resources; staff use the protected admin area to review client work, content, and agent activity. Connected tools handle specialized jobs, while people remain responsible for approvals and outcomes.'

export interface GuideBlock { title: string; text: string }
export interface GuideSection { id: string; title: string; summary: string; blocks: GuideBlock[] }

export const evolution: GuideBlock[] = [
  { title: 'Show the work', text: 'The public website introduces services, projects, publications, and products.' },
  { title: 'Manage the work', text: 'The admin workspace brings leads, proposals, client delivery, and content into reviewable workflows.' },
  { title: 'Coordinate and learn', text: 'Agent Ops tracks assisted work and approvals. Open Brain holds approved memory for reuse.' },
]
export const systemFlow: GuideBlock[] = [
  { title: '1 · Bring context', text: 'An authorized source or request gives the work a starting point.' },
  { title: '2 · Review in Portfolio', text: 'Find the record, check the evidence, and identify the next owner.' },
  { title: '3 · Get approval', text: 'Confirm the exact action, destination, content, and scope with the authorized reviewer.' },
  { title: '4 · Act and verify', text: 'An approved workflow uses the connected tool. Check its receipt before reporting completion.' },
]
export const stackMap: GuideBlock[] = [
  { title: 'Workspace and records', text: 'Portfolio → hosted on Vercel → records and access through Supabase / Postgres' },
  { title: 'Assisted work', text: 'Portfolio → n8n for configured workflows; model providers, including OpenAI, for approved analysis' },
  { title: 'External action boundary', text: 'Specific approval → configured Slack, Gmail / Workspace, Telnyx, or Stripe action → receipt in Portfolio' },
  { title: 'Supporting the work', text: '1Password: access · GitHub / Codex: changes · Open Brain: approved memory' },
  { title: 'Outside the live path', text: 'JEV: offline mock evaluation; live use on HOLD' },
]
export const tools: GuideBlock[] = [
  { title: 'Portfolio · your working surface', text: 'The Next.js/React app is where staff review work and its status. Start with the assigned record or Help. A visible button or an AI suggestion is not permission to act.' },
  { title: 'Vercel · the place the app runs', text: 'Vercel builds and hosts Portfolio deployments. The repo tracks portfolio and portfolio-staging separately. Staff use the review link supplied by the work owner; deployment health belongs to the integration captain.' },
  { title: 'Supabase / Postgres · records and access', text: 'Supabase provides application database and authentication services; Postgres is the database underneath. Staff work through approved Portfolio screens. Missing access should go to the owner rather than being worked around in the database.' },
  { title: 'n8n · repeatable workflows', text: 'n8n connects steps such as intake and follow-up through configured workflows. Portfolio can trigger work and show results. A workflow existing in the repo does not establish that it is enabled or safe to run.' },
  { title: 'Slack · coordination and review', text: 'Slack integrations carry review requests and action receipts. Check the corresponding Portfolio record for the outcome; a Slack click or card update alone does not prove the requested action finished.' },
  { title: 'Gmail / Google Workspace · correspondence', text: 'Portfolio has Gmail draft, send, and response-review paths. Creating a mailbox draft and sending a message are separate actions with separate authorization. Ask the owner which work account and shared materials you should use.' },
  { title: '1Password · approved access', text: 'The credential runbook assigns human logins and recovery details to 1Password. Request the correct vault or item from its owner. Never paste passwords, tokens, or recovery codes into tasks, screenshots, or guide notes.' },
  { title: 'OpenAI / model providers · draft and analysis help', text: 'The code includes OpenAI and Anthropic model calls for assisted work. Review generated content against its sources. Provider calls may send data outside Portfolio; use only the approved data and workflow for the task.' },
  { title: 'Telnyx · SMS provider path', text: 'The repo contains Telnyx SMS readiness and execution gates. Treat SMS as restricted until the owner verifies provider readiness, recipient eligibility, and approval for the exact message. This guide makes no live-delivery claim.' },
  { title: 'Stripe · payments', text: 'Stripe supports payment and checkout flows. Test and live modes are distinct. Route billing changes, refunds, or payment questions to the responsible owner; onboarding does not authorize a charge.' },
  { title: 'GitHub / Codex · building and reviewing changes', text: 'GitHub holds source changes and pull requests; Codex helps prepare implementation and validation. Report a bug with its route and reproduction steps. Engineers use scoped branches and review before integration.' },
  { title: 'Open Brain · approved organizational memory', text: 'Open Brain is the local-first memory core. Portfolio displays status and proposals; approved summaries can become reusable memory. Raw private material and unapproved guesses stay out of shared knowledge and public outputs.' },
  { title: 'JEV · offline evaluation only', text: 'The current repo has a JEV-shaped mock benchmark for classifying and scoring Engagement Inbox cases. Live use is on HOLD. The mock does not prove model quality, and a classifier result never grants permission to reply or send.' },
]
export const firstWeek: GuideBlock[] = [
  { title: 'Day 1 · Find your starting point', text: 'Ask your onboarding owner for the correct Portfolio URL, approved account access, and assigned workspace. Open this guide and bookmark it. Confirm who approves your work.' },
  { title: 'Day 2 · Follow one example', text: 'With your owner, open an approved practice record. Identify its source, current status, next action, and owner. Keep private client material out of practice notes.' },
  { title: 'Day 3 · Prepare a small handoff', text: 'Write a sample update with the source, proposed next step, and open question. Keep it in the agreed practice space. Ask the owner to review it before any external action.' },
  { title: 'Day 4 · Rehearse a blocked action', text: 'Walk through a missing-approval or missing-access example with your owner. Practice reporting the route, safe error summary, and next decision without retrying a send.' },
  { title: 'Day 5 · Close the loop', text: 'Show your owner how you check a result receipt and find help. Agree on your first real assignment and its approval boundaries. Completion of this checklist grants no new permissions.' },
]
export const sections: GuideSection[] = [
  { id: 'workspace', title: 'How the workspace fits together', summary: 'A map of the work, from first request to a verified result.', blocks: [
    { title: 'How to read the evolution', text: 'These three layers describe the capabilities visible in the repo. They are an orientation map, not a dated company history or a claim that every integration is active.' },
    { title: 'Find your starting point', text: 'Your owner will identify the workspace and record for your assignment. Use the admin menu to reach that area and the Help link to return to guidance. You do not need an account in every connected tool to begin learning Portfolio.' },
  ] },
  { id: 'day', title: 'A day in the life', summary: 'Practice with a sample client update before taking on live work.', blocks: [
    { title: 'Begin with the assignment', text: 'Open the record your owner assigned. Check the latest source and status. If you cannot tell who owns the next step, ask before changing it.' },
    { title: 'Prepare something reviewable', text: 'Draft the update in the approved practice or work area. Include what happened, the supporting source, and the next decision. Mark uncertain facts as questions.' },
    { title: 'Pause at the boundary', text: 'Before a message, provider call, payment, publish, or schedule action, verify the exact approval and destination. A general “proceed” does not identify a recipient or authorize a send.' },
    { title: 'Check the result', text: 'Look for the operation’s recorded receipt and outcome. Queued, drafted, approved, and delivered describe different states. Report a missing receipt as unconfirmed; do not create a duplicate action to make the status look complete.' },
    { title: 'Leave a useful handoff', text: 'Record the result, source link, next owner, and any blocker in the agreed workspace. Propose useful learning for review before it becomes durable memory.' },
  ] },
  { id: 'boundaries', title: 'Approvals and no-egress boundaries', summary: 'Know when preparation becomes an external action.', blocks: [
    { title: 'Read and prepare within your assignment', text: 'Use only records and materials you are authorized to access. Drafting locally, reviewing evidence, and proposing a next step are distinct from changing a live system.' },
    { title: 'No-egress means no data leaves the agreed boundary', text: 'For an exercise designated no-egress, use synthetic or approved redacted data in the designated practice environment. Do not call model providers, create Gmail drafts, post to Slack, send SMS, publish, schedule, or upload private material. An environment labeled preview or staging is not proof that outbound calls are disabled.' },
    { title: 'Approval is specific', text: 'The authorized owner must approve the action, current content, destination or recipient, and scope. A changed draft needs renewed review where required by the workflow. Sending to a provider, creating a mailbox draft, and sending to a person are separate gates.' },
    { title: 'Blocked means stop and route', text: 'Read the blocker, preserve a safe summary, and return it to the owner. Never bypass access controls, enable a provider, change credentials, alter billing, or repeatedly retry an uncertain external action as part of onboarding.' },
    { title: 'Protect the source', text: 'Keep passwords, private messages, contact details, and raw exports out of screenshots and shared notes. Use sanitized summaries. Approval of a summary does not authorize publication of the underlying private source.' },
  ] },
  { id: 'tools', title: 'Meet the tools', summary: 'Plain-language roles and limits; no setup work required.', blocks: tools },
  { id: 'week', title: 'Your first week', summary: 'Five conversations and practice steps to complete with your owner.', blocks: firstWeek },
  { id: 'glossary', title: 'Words you will see', summary: 'A short translation of common workflow terms.', blocks: [
    { title: 'Record / source', text: 'A record tracks a piece of work. Its source is the material supporting what it says. Check both before relying on a claim.' },
    { title: 'Workflow / provider', text: 'A workflow is a sequence of steps. A provider is another service used for a step, such as sending email or generating text.' },
    { title: 'API / webhook', text: 'An API is a way software requests data or an action from other software. A webhook is an automatic notification between systems. Either can move data outside the workspace.' },
    { title: 'Environment / deployment', text: 'An environment is a separately configured version of the system. A deployment is a built version of the app. A preview is for review, but its connections still need to be checked.' },
    { title: 'Approval / receipt', text: 'Approval is permission for a specific action. A receipt is evidence of what the system actually did. One cannot substitute for the other.' },
    { title: 'Agent / model', text: 'An agent carries out a defined role using tools. A model generates or evaluates content. Both need boundaries and human review appropriate to the work.' },
    { title: 'PR / integration captain', text: 'A pull request (PR) presents code changes for review. The integration captain coordinates validation, merges, and deployment checks.' },
    { title: 'No-egress / fail-closed', text: 'No-egress keeps data inside the agreed boundary. Fail-closed means missing permission or evidence blocks the action rather than allowing it by default.' },
  ] },
  { id: 'help', title: 'When something goes wrong', summary: 'Recover safely and give the owner enough context to help.', blocks: [
    { title: 'I see a login screen or access denied', text: 'Use the approved work account. Ask your onboarding owner to confirm the account and required role; this guide currently uses the existing admin access gate. After access is restored, reopen /admin/help/onboarding. Never borrow another person’s session.' },
    { title: 'The page is empty or the expected item is missing', text: 'Confirm the URL and environment with the owner. Check the page’s filters and search, then clear them if appropriate. Refresh once. If the item is still absent, report the route and expected item using a safe reference.' },
    { title: 'An action is blocked or a tool is unavailable', text: 'Read the reason next to the action. Give the owner the route, attempted step, and safe error summary. Ask for the stated prerequisite or the correct reviewer; do not enable or reconnect the tool yourself.' },
    { title: 'I clicked something but cannot confirm the outcome', text: 'Check the related record and receipt. If it remains queued, failed, or unconfirmed, stop retries and ask the owner to reconcile it. State “outcome unconfirmed” rather than “sent.”' },
    { title: 'The PDF will not download', text: 'Retry Download PDF once and check your browser’s Downloads list. If it still fails, use the on-screen guide and report the browser name plus the safe error shown. The checklist is a practice aid for this visit; its checks are not saved or included in the PDF.' },
    { title: 'I need to report a problem', text: 'Share the page route, environment, time, what you expected, what happened, and a redacted screenshot if safe. Send it through the channel your onboarding owner designates. Never include credentials or private client details.' },
  ] },
]
