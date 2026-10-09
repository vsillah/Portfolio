export type PlumbingStage = 'marketing' | 'sales' | 'delivery' | 'expansion'

export interface PlumbingStep {
  id: string
  /** Full name shown in the explanation console */
  name: string
  /** Label lines shown on the map chip */
  label: string[]
  stage: PlumbingStage
  /** Chip rectangle on the 1680 x 1470 map canvas */
  x: number
  y: number
  w: number
  h: number
  /** Point on the pipe where this step's leak springs */
  lx: number
  ly: number
  leak: string
  fix: string
}

export const STAGE_LABELS: Record<PlumbingStage, string> = {
  marketing: 'Marketing',
  sales: 'Sales & onboarding',
  delivery: 'Delivery & proof',
  expansion: 'Expansion',
}

export const STAGE_ORDER: PlumbingStage[] = ['marketing', 'sales', 'delivery', 'expansion']

export const MAP_WIDTH = 1680
export const MAP_HEIGHT = 1470

/** Steps in the order value flows through the pipe. */
export const PLUMBING_STEPS: PlumbingStep[] = [
  { id: 'hook', name: 'Hook', label: ['Hook'], stage: 'marketing', x: 456, y: 500, w: 64, h: 36, lx: 550, ly: 510, leak: 'The first line talks about you. The right buyer scrolls past before any value enters the pipe.', fix: "Open with the buyer's problem in their own words, and test three hooks for every offer." },
  { id: 'offer', name: 'Offer', label: ['Offer'], stage: 'marketing', x: 624, y: 460, w: 72, h: 36, lx: 660, ly: 520, leak: "The offer is vague or sounds like everyone else's. Attention arrives with nothing specific to say yes to.", fix: 'Name one outcome, one buyer and one timeframe. Make the next step low-risk.' },
  { id: 'cta', name: 'CTA Link', label: ['CTA Link'], stage: 'marketing', x: 726, y: 460, w: 88, h: 36, lx: 770, ly: 520, leak: 'The link is buried, broken, or one of five competing asks.', fix: 'One call to action per asset. Click it yourself every week.' },
  { id: 'optin', name: 'Opt-in', label: ['Opt-in'], stage: 'marketing', x: 842, y: 460, w: 76, h: 36, lx: 880, ly: 520, leak: 'The form asks for too much too soon, and people abandon it halfway.', fix: "Ask for name and email only. Collect the rest once they're in." },
  { id: 'vsl', name: 'Offer Video', label: ['Offer', 'Video'], stage: 'marketing', x: 938, y: 460, w: 60, h: 52, lx: 968, ly: 520, leak: 'The video runs long and saves the point for the end. Viewers leave before the ask.', fix: 'Lead with the result, keep it tight, and put the booking button beside the video.' },
  { id: 'emails', name: 'Emails', label: ['Emails'], stage: 'marketing', x: 944, y: 392, w: 72, h: 36, lx: 1040, ly: 410, leak: 'Leads opt in and hear nothing for days. Interest cools quickly.', fix: 'Send the first email within minutes, then a short sequence that teaches and invites.' },
  { id: 'retarget', name: 'Retarget', label: ['Retarget'], stage: 'marketing', x: 1044, y: 316, w: 92, h: 36, lx: 1090, ly: 380, leak: 'People who watched and left never see you again.', fix: "Retarget everyone who viewed and didn't book, with proof-led creative." },
  { id: 'rehook', name: 'Re-hook', label: ['Re-hook'], stage: 'marketing', x: 1166, y: 392, w: 86, h: 36, lx: 1140, ly: 410, leak: 'Follow-up repeats the same pitch that already missed.', fix: 'Come back with a new angle: a client story, a common objection, a fresh result.' },
  { id: 'calform', name: 'Booking Form', label: ['Booking', 'Form'], stage: 'marketing', x: 1004, y: 546, w: 92, h: 52, lx: 1050, ly: 520, leak: 'The booking form has too many questions, or no open slots this week.', fix: 'Keep only the questions that qualify, and keep availability inside 48 hours.' },
  { id: 'schedule', name: 'Schedule', label: ['Schedule'], stage: 'marketing', x: 1114, y: 546, w: 92, h: 36, lx: 1160, ly: 520, leak: 'The earliest slot is ten days out. Motivation fades before the call.', fix: 'Protect near-term call blocks so warm leads can book within two days.' },
  { id: 'confcall', name: 'Confirm Call', label: ['Confirm Call'], stage: 'marketing', x: 1250, y: 460, w: 112, h: 36, lx: 1306, ly: 520, leak: 'Nobody confirms the appointment, so the lead treats it as optional.', fix: 'Confirm by text or a quick call the same day they book.' },
  { id: 'confemail', name: 'Confirm Email', label: ['Confirm Email'], stage: 'marketing', x: 1404, y: 448, w: 124, h: 36, lx: 1460, ly: 530, leak: 'The confirmation is a bare calendar invite with no reason to show up.', fix: 'Restate what the call will accomplish and what to bring.' },
  { id: 'repintro', name: 'Rep Intro Email', label: ['Rep introduce', 'email'], stage: 'marketing', x: 1496, y: 604, w: 122, h: 52, lx: 1470, ly: 630, leak: 'The prospect meets a stranger on the call, and trust starts at zero.', fix: 'Have the rep send a short personal intro before the call. A 30-second video works well.' },
  { id: 'calremind', name: 'Booking Reminders', label: ['Booking', 'Reminders'], stage: 'marketing', x: 1496, y: 704, w: 122, h: 52, lx: 1460, ly: 730, leak: 'No reminders go out, and the call slips off their calendar.', fix: 'Automate reminders at 24 hours and 1 hour, with the join link at the top.' },
  { id: 'show', name: 'Show', label: ['Show'], stage: 'sales', x: 1346, y: 680, w: 68, h: 36, lx: 1380, ly: 740, leak: 'No-shows. Every booked call that never happens wastes the marketing spend that produced it.', fix: 'Track show rate weekly and run a same-day rebook sequence for every miss.' },
  { id: 'agenda', name: 'Agenda', label: ['Agenda'], stage: 'sales', x: 1240, y: 680, w: 80, h: 36, lx: 1280, ly: 740, leak: 'The call wanders, runs out of time, and ends without a decision.', fix: 'Open with the agenda and agree up front on what a good outcome looks like.' },
  { id: 'qualify', name: 'Qualify', label: ['Qualify'], stage: 'sales', x: 1139, y: 680, w: 82, h: 36, lx: 1180, ly: 740, leak: "Time goes to people who can't buy or shouldn't. Good fits wait in line.", fix: 'Check need, budget, authority and timing early, and refer poor fits elsewhere.' },
  { id: 'discover', name: 'Discover', label: ['Discover'], stage: 'sales', x: 1029, y: 680, w: 92, h: 36, lx: 1075, ly: 740, leak: 'The rep pitches before understanding the problem. The prospect never feels heard.', fix: 'Spend most of the call on their situation and what the problem costs them.' },
  { id: 'pitch', name: 'Pitch', label: ['Pitch'], stage: 'sales', x: 943, y: 680, w: 64, h: 36, lx: 975, ly: 740, leak: 'A generic feature walkthrough with no link to what they said in discovery.', fix: 'Present only what solves the problems they named, in their words.' },
  { id: 'answer', name: "Answer Q's", label: ['Answer', "Q's"], stage: 'sales', x: 840, y: 664, w: 80, h: 52, lx: 880, ly: 740, leak: 'Questions get dodged or over-answered, and doubt grows.', fix: 'Answer plainly, confirm it landed, and keep a living FAQ from every call.' },
  { id: 'price', name: 'Pitch Price', label: ['Pitch', 'Price'], stage: 'sales', x: 744, y: 664, w: 72, h: 52, lx: 780, ly: 740, leak: 'Price arrives late, mumbled, or with an apology.', fix: 'State the price once, with confidence, anchored to the value of the outcome.' },
  { id: 'objections', name: 'Handle Objections', label: ['Handle', 'Objections'], stage: 'sales', x: 556, y: 664, w: 104, h: 52, lx: 620, ly: 750, leak: '"Let me think about it" gets accepted and the deal goes quiet.', fix: 'Surface the real concern, address it, and set a dated next step before you hang up.' },
  { id: 'payterm', name: 'Payment Term Negotiation', label: ['Payment Term', 'Negotiation'], stage: 'sales', x: 454, y: 800, w: 132, h: 52, lx: 610, ly: 826, leak: 'Terms get improvised deal by deal. Discounts eat margin and delay signatures.', fix: 'Offer two or three standard payment options and hold to them.' },
  { id: 'financing', name: 'Financing / Payment', label: ['Financing/Payment'], stage: 'sales', x: 430, y: 912, w: 156, h: 36, lx: 620, ly: 950, leak: "The buyer wants in and can't pay in one shot. Failed payments follow.", fix: 'Offer a payment plan or financing partner, and take the first payment on the call.' },
  { id: 'expectations', name: 'Expectations', label: ['Expectations'], stage: 'sales', x: 640, y: 986, w: 120, h: 36, lx: 700, ly: 960, leak: 'The client hears promises you never made. Disappointment starts on day one.', fix: "Put scope, timeline and the client's own responsibilities in writing before they sign." },
  { id: 'contract', name: 'Contract Send / Sign', label: ['Contract', 'Send/Sign'], stage: 'sales', x: 692, y: 884, w: 96, h: 52, lx: 740, ly: 960, leak: 'The contract goes out days later and sits unsigned while enthusiasm cools.', fix: 'Send an e-sign contract during the call and follow up within 24 hours.' },
  { id: 'skool', name: 'Community Access', label: ['Community', 'Access'], stage: 'sales', x: 808, y: 884, w: 84, h: 52, lx: 850, ly: 960, leak: 'The client asks to join the community and waits on a manual approval.', fix: 'Approve requests daily, or automate approval once payment clears.' },
  { id: 'stripe', name: 'Billing Setup', label: ['Billing', 'Setup'], stage: 'sales', x: 917, y: 884, w: 76, h: 52, lx: 955, ly: 960, leak: 'Billing is set up by hand. Wrong amounts and failed charges go unnoticed.', fix: 'Template your products and plans, and turn on failed-payment alerts.' },
  { id: 'wait', name: 'Wait 24hr', label: ['Wait', '24hr'], stage: 'sales', x: 1021, y: 884, w: 68, h: 52, lx: 1055, ly: 960, leak: "A day of silence after payment is where buyer's remorse sets in.", fix: 'Fill the wait with a welcome message and one small action to complete.' },
  { id: 'grant', name: 'Grant Access', label: ['Grant', 'Access'], stage: 'sales', x: 1115, y: 884, w: 80, h: 52, lx: 1155, ly: 960, leak: 'Access arrives late or incomplete. The client starts out locked out.', fix: 'Use a checklist or automation that grants every login at once, then verify it.' },
  { id: 'introvideo', name: 'Intro Video', label: ['Intro', 'Video'], stage: 'delivery', x: 1224, y: 884, w: 72, h: 52, lx: 1260, ly: 960, leak: "New clients land with no orientation and don't know where to begin.", fix: 'Record a short welcome video that shows the first three things to do.' },
  { id: 'intropost', name: 'Intro Post', label: ['Intro Post'], stage: 'delivery', x: 1496, y: 916, w: 122, h: 36, lx: 1460, ly: 970, leak: 'The client never introduces themselves, so they stay a spectator in the community.', fix: 'Prompt an intro post on day one and make sure someone replies.' },
  { id: 'aiaudit', name: 'AI Audit', label: ['AI Audit'], stage: 'delivery', x: 1496, y: 1000, w: 122, h: 36, lx: 1470, ly: 1018, leak: 'The audit ends as a report nobody acts on. Findings sit in a PDF while the same manual work keeps costing hours.', fix: 'Close every audit with three ranked automations, an owner for each, and a start date for the first one.' },
  { id: 'training', name: 'Team Training', label: ['Team', 'Training'], stage: 'delivery', x: 1496, y: 1084, w: 122, h: 52, lx: 1470, ly: 1110, leak: 'The automation goes live and the team keeps working the old way. Tools nobody trusts get switched off quietly.', fix: 'Train the people who touch the workflow before launch, and name one internal owner who can answer questions.' },
  { id: 'followup', name: 'Post-Release Follow-Up', label: ['Post-Release', 'Follow-Up'], stage: 'delivery', x: 1304, y: 1216, w: 116, h: 52, lx: 1362, ly: 1180, leak: "You've delivered and can't yet tell whether it is meeting the mark. With no follow-up there is no feedback, and the client goes to a competitor to fill the gaps left after release.", fix: 'Book the follow-up before you release. Ask what is still missing, then close those gaps yourself while the client is still looking to you.' },
  { id: 'outbound', name: 'Outbound Motion', label: ['Outbound', 'Motion'], stage: 'delivery', x: 1344, y: 1104, w: 92, h: 52, lx: 1390, ly: 1180, leak: 'Outreach gets built once and never runs consistently.', fix: 'Set a daily outbound quota and review the numbers every week.' },
  { id: 'sales', name: 'Sales Process', label: ['Sales', 'Process'], stage: 'delivery', x: 1243, y: 1104, w: 84, h: 52, lx: 1285, ly: 1180, leak: 'Leads come in and the client has no repeatable way to close them.', fix: 'Install a simple call script and pipeline tracker before driving volume.' },
  { id: 'programbuild', name: 'Service Build', label: ['Service Build'], stage: 'delivery', x: 1168, y: 1356, w: 124, h: 36, lx: 1230, ly: 1330, leak: "The client's own program stays half-built, so there is nothing solid to sell.", fix: 'Ship a minimum version first and improve it with live clients.' },
  { id: 'launch', name: 'Launch', label: ['Launch'], stage: 'delivery', x: 1072, y: 1224, w: 80, h: 36, lx: 1180, ly: 1215, leak: 'The launch keeps slipping while everything gets polished.', fix: 'Set a launch date early and work backward from it.' },
  { id: 'inbound', name: 'Inbound Motion', label: ['Inbound', 'Motion'], stage: 'delivery', x: 1143, y: 1104, w: 84, h: 52, lx: 1185, ly: 1180, leak: 'Content goes out with no path from attention to a booked call.', fix: 'Connect every piece of content to one offer and one booking link.' },
  { id: 'paid', name: 'Paid Acquisition', label: ['Paid', 'Acquisition'], stage: 'delivery', x: 1043, y: 1104, w: 84, h: 52, lx: 1085, ly: 1180, leak: 'Ad spend scales before the funnel converts, and cash burns.', fix: 'Prove conversion with organic and outbound first, then add paid in small tests.' },
  { id: 'time', name: 'TIME!!!', label: ['TIME!!!'], stage: 'delivery', x: 947, y: 1112, w: 76, h: 36, lx: 985, ly: 1180, leak: 'Results take longer than the client expected. Patience runs out before the systems compound.', fix: 'Set honest timelines up front and show leading indicators along the way.' },
  { id: 'first', name: 'First Results', label: ['First', 'Results'], stage: 'delivery', x: 847, y: 1104, w: 76, h: 52, lx: 885, ly: 1180, leak: 'The first win takes too long, and belief drains with it.', fix: 'Design a quick win for the first 30 days and celebrate it publicly.' },
  { id: 'winposts', name: 'Win Posts', label: ['Win Posts'], stage: 'delivery', x: 826, y: 1224, w: 96, h: 36, lx: 800, ly: 1215, leak: 'Wins happen and nobody shares them. Proof never reaches the market.', fix: 'Make posting a win part of the process, with a template that takes two minutes.' },
  { id: 'trustpilot', name: 'Public Review', label: ['Public Review'], stage: 'delivery', x: 702, y: 1356, w: 96, h: 36, lx: 750, ly: 1330, leak: 'Happy clients are never asked for a review.', fix: 'Ask at the moment of a win and send the direct link.' },
  { id: 'interviews', name: 'Client Interviews', label: ['Client', 'Interviews'], stage: 'delivery', x: 566, y: 1216, w: 104, h: 52, lx: 700, ly: 1215, leak: 'Great stories stay in private messages.', fix: 'Book a 20-minute interview after each milestone and cut it into case studies.' },
  { id: 'more1', name: 'More Results', label: ['More', 'Results'], stage: 'delivery', x: 752, y: 1104, w: 76, h: 52, lx: 790, ly: 1180, leak: 'After the first result the client coasts, and momentum fades.', fix: 'Set the next target the same week the first one lands.' },
  { id: 'more2', name: 'More Results', label: ['More', 'Results'], stage: 'delivery', x: 657, y: 1104, w: 76, h: 52, lx: 695, ly: 1180, leak: "Results depend on one person's heroics and can't be repeated.", fix: 'Document what worked and turn it into a process someone else can run.' },
  { id: 'more3', name: 'More Results', label: ['More', 'Results'], stage: 'delivery', x: 562, y: 1104, w: 76, h: 52, lx: 600, ly: 1180, leak: 'Growth plateaus because nobody reviews what is working.', fix: 'Run a monthly review and put more behind the top two channels.' },
  { id: 'upgrade', name: 'Tier Upgrade / Renewal', label: ['Tier Upgrade /', 'Renewal'], stage: 'expansion', x: 344, y: 1096, w: 176, h: 56, lx: 410, ly: 1190, leak: 'The engagement ends with no next conversation. A Plug & Play client who is ready for Guided Setup or Managed Automation never hears the offer.', fix: 'Set a checkpoint by date and by result, show the gains so far, and propose the next tier before the term ends.' },
]

/** Pipe couplings: [x, y, width, height] on the map canvas. */
export const PIPE_COUPLINGS: Array<[number, number, number, number]> = [
  [520, 452, 40, 14],
  ...[603, 708, 818, 923, 998, 1083, 1168, 1233, 1358].map((x): [number, number, number, number] => [x, 500, 14, 40]),
  [1020, 443, 40, 14],
  [1120, 443, 40, 14],
  [1450, 623, 40, 14],
  ...[1323, 1223, 1123, 1018, 921, 823, 693].map((x): [number, number, number, number] => [x, 720, 14, 40]),
  [590, 863, 40, 14],
  ...[673, 791, 898, 1000, 1095, 1203, 1323].map((x): [number, number, number, number] => [x, 940, 14, 40]),
  [1450, 1063, 40, 14],
  ...[1330, 1228, 1128, 1028, 928, 831, 743, 641, 533].map((x): [number, number, number, number] => [x, 1160, 14, 40]),
  [680, 1243, 40, 14],
  [780, 1243, 40, 14],
  [1160, 1243, 40, 14],
  [1260, 1243, 40, 14],
  [380, 1250, 40, 14],
]

export const PIPE_RUN_PATH =
  'M 540 452 L 540 480 Q 540 520 580 520 L 1430 520 Q 1470 520 1470 560 L 1470 700 Q 1470 740 1430 740 L 650 740 Q 610 740 610 780 L 610 920 Q 610 960 650 960 L 1430 960 Q 1470 960 1470 1000 L 1470 1140 Q 1470 1180 1430 1180 L 440 1180 Q 400 1180 400 1220 L 400 1262'

export const PIPE_LOOPS_PATH =
  'M 1040 520 L 1040 420 Q 1040 380 1080 380 L 1100 380 Q 1140 380 1140 420 L 1140 520 M 800 1180 L 800 1290 Q 800 1330 760 1330 L 740 1330 Q 700 1330 700 1290 L 700 1180 M 1280 1180 L 1280 1290 Q 1280 1330 1240 1330 L 1220 1330 Q 1180 1330 1180 1290 L 1180 1180'

export const FAUCET_PATH = 'M 344 380 L 500 380 Q 540 380 540 420 L 540 436'

export const FLYWHEEL_PATH = 'M 336 1404 C 150 1404, 130 1150, 190 960 C 240 800, 404 760, 404 428'
