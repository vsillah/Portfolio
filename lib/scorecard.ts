/**
 * AI Readiness Scorecard — questions, scoring, and result copy.
 * Used by the Resources page Scorecard component and submit API.
 */

export interface ScorecardOption {
  value: string
  label: string
  points: number
}

export interface ScorecardQuestion {
  id: string
  question: string
  options: ScorecardOption[]
}

export const SCORECARD_QUESTIONS: ScorecardQuestion[] = [
  {
    id: 'data',
    question: 'How would you describe your business data today?',
    options: [
      { value: 'scattered', label: 'Mostly in spreadsheets and emails', points: 0 },
      { value: 'some_systems', label: 'Some systems (CRM, tools), but not connected', points: 1 },
      { value: 'integrated', label: 'Integrated in a few core systems', points: 2 },
      { value: 'ready', label: 'Clean, structured, and accessible for automation', points: 3 },
    ],
  },
  {
    id: 'team',
    question: 'How is your team using AI or automation today?',
    options: [
      { value: 'not_yet', label: 'Not yet / exploring', points: 0 },
      { value: 'individual', label: 'A few people use tools ad hoc', points: 1 },
      { value: 'pilot', label: 'We have pilots or one team using it', points: 2 },
      { value: 'scaling', label: 'We’re scaling usage across teams', points: 3 },
    ],
  },
  {
    id: 'goals',
    question: "What's your main goal for AI in the next 12 months?",
    options: [
      { value: 'learn', label: 'Learn what’s possible', points: 0 },
      { value: 'efficiency', label: 'Save time on repetitive work', points: 1 },
      { value: 'growth', label: 'Grow revenue or pipeline with AI', points: 2 },
      { value: 'transform', label: 'Transform how we sell or deliver', points: 3 },
    ],
  },
  {
    id: 'buy_in',
    question: 'How would you rate leadership buy-in for AI initiatives?',
    options: [
      { value: 'low', label: 'Low or skeptical', points: 0 },
      { value: 'curious', label: 'Curious but not committed', points: 1 },
      { value: 'supportive', label: 'Supportive and willing to invest', points: 2 },
      { value: 'driving', label: 'Actively driving strategy', points: 3 },
    ],
  },
  {
    id: 'budget',
    question: 'Do you have budget or capacity to invest in AI/automation this year?',
    options: [
      { value: 'no', label: 'No / not yet', points: 0 },
      { value: 'small', label: 'Small budget or one project', points: 1 },
      { value: 'dedicated', label: 'Dedicated budget or headcount', points: 2 },
      { value: 'strategic', label: 'Strategic priority with clear ownership', points: 3 },
    ],
  },
  {
    id: 'speed',
    question: 'How quickly do you need to see results?',
    options: [
      { value: 'explore', label: 'Just exploring — no rush', points: 0 },
      { value: 'months', label: 'Within 3–6 months', points: 1 },
      { value: 'weeks', label: 'Within 4–8 weeks', points: 2 },
      { value: 'now', label: 'As soon as possible', points: 3 },
    ],
  },
]

const MAX_RAW = SCORECARD_QUESTIONS.reduce(
  (sum, q) => sum + Math.max(...q.options.map((o) => o.points)),
  0
)

/** Convert raw points to 0–10 scale for display and DB */
export function rawScoreToTen(raw: number): number {
  if (MAX_RAW <= 0) return 0
  const normalized = (raw / MAX_RAW) * 10
  return Math.min(10, Math.max(0, Math.round(normalized * 10) / 10))
}

export type ScoreBand = 'getting_started' | 'building' | 'ready'

export function getScoreBand(scoreOutOf10: number): ScoreBand {
  if (scoreOutOf10 < 4) return 'getting_started'
  if (scoreOutOf10 < 7) return 'building'
  return 'ready'
}

export interface ScorecardResultCopy {
  title: string
  summary: string
  bullets: string[]
}

const RESULT_COPY: Record<ScoreBand, ScorecardResultCopy> = {
  getting_started: {
    title: 'Getting started',
    summary: 'You’re in a good place to clarify goals and pick one or two high-impact areas.',
    bullets: [
      'Start with one process (e.g. lead follow-up or content) and map where AI can save time.',
      'Get one champion on the team to run a small pilot and share results.',
      'Use our templates and playbooks in Resources to standardize before automating.',
    ],
  },
  building: {
    title: 'Building momentum',
    summary: 'You have foundations in place; focus on connecting systems and scaling what works.',
    bullets: [
      'Connect your CRM and key tools so data flows where AI can use it.',
      'Document your best practices so automation can replicate them.',
      'Consider a dedicated owner or cross-team pilot to move from ad hoc to repeatable.',
    ],
  },
  ready: {
    title: 'Ready to scale',
    summary: 'You’re well positioned to scale AI and automation with clear ownership and intent.',
    bullets: [
      'Double down on the use cases that already show ROI and expand to adjacent teams.',
      'Set simple metrics (time saved, conversion, or quality) and review monthly.',
      'Use our ROI calculator and discovery resources to align offers with value delivered.',
    ],
  },
}

export function getResultCopy(scoreOutOf10: number): ScorecardResultCopy {
  return RESULT_COPY[getScoreBand(scoreOutOf10)]
}

/** Get the selected option for a question given the points the user chose */
export function getSelectedOption(
  questionId: string,
  points: number
): { value: string; label: string } | null {
  const q = SCORECARD_QUESTIONS.find((x) => x.id === questionId)
  if (!q) return null
  const opt = q.options.find((o) => o.points === points)
  return opt ? { value: opt.value, label: opt.label } : null
}

/** Minimal resource shape for recommendations */
export interface ScorecardResource {
  id: number
  title: string
  description: string | null
  slug?: string | null
}

/** Why this resource was recommended (which question + answer) */
export interface ScorecardTrigger {
  questionId: string
  questionText: string
  selectedLabel: string
}

export interface ScorecardRecommendation {
  resource: ScorecardResource
  triggeredBy: ScorecardTrigger[]
  outcome: string
}

/** Rules: when user's answer matches, recommend resources that match title/slug and show outcome */
const RECOMMENDATION_RULES: Array<{
  trigger: { questionId: string; optionValues: string[] }
  titleOrSlugMatch: (title: string, slug: string | null) => boolean
  outcome: string
}> = [
  {
    trigger: { questionId: 'data', optionValues: ['scattered', 'some_systems'] },
    titleOrSlugMatch: (t, s) => /automation audit|data|audit/i.test(t) || /audit|data/i.test(s || ''),
    outcome: 'Get your data and systems in shape so automation can run reliably.',
  },
  {
    trigger: { questionId: 'team', optionValues: ['not_yet', 'individual'] },
    titleOrSlugMatch: (t, s) => /hook library|vsl script|template|playbook/i.test(t),
    outcome: 'Get your team started with low-friction templates and repeatable scripts.',
  },
  {
    trigger: { questionId: 'goals', optionValues: ['learn', 'efficiency'] },
    titleOrSlugMatch: (t, s) => /referral playbook|script template|roadmap|playbook/i.test(t),
    outcome: 'Turn exploration into a repeatable process with scripts and playbooks.',
  },
  {
    trigger: { questionId: 'goals', optionValues: ['growth', 'transform'] },
    titleOrSlugMatch: (t, s) => /roi calculator|expectations|alignment/i.test(t) || /roi|expectations/i.test(s || ''),
    outcome: 'Quantify value and align scope so you can close and deliver with confidence.',
  },
  {
    trigger: { questionId: 'buy_in', optionValues: ['low', 'curious'] },
    titleOrSlugMatch: (t, s) => /expectations alignment|alignment doc|roadmap/i.test(t) || /expectations/i.test(s || ''),
    outcome: 'Build alignment and buy-in with leadership using clear scope and expectations.',
  },
  {
    trigger: { questionId: 'budget', optionValues: ['no', 'small'] },
    titleOrSlugMatch: (t, s) => /no-show|eliminator|quick|hook|retargeting roadmap/i.test(t) || /no-show/i.test(s || ''),
    outcome: 'See impact with minimal budget using high-leverage tactics and templates.',
  },
  {
    trigger: { questionId: 'speed', optionValues: ['explore', 'months'] },
    titleOrSlugMatch: (t, s) => /roadmap|playbook|retargeting|referral/i.test(t),
    outcome: 'Plan at a pace that fits your timeline with step-by-step roadmaps.',
  },
  {
    trigger: { questionId: 'speed', optionValues: ['weeks', 'now'] },
    titleOrSlugMatch: (t, s) => /no-show|eliminator|hook|script|template/i.test(t) || /no-show/i.test(s || ''),
    outcome: 'Get fast wins with ready-to-use scripts and tactics you can apply immediately.',
  },
]

/**
 * Given scorecard answers (questionId -> points) and the list of resources,
 * returns recommended resources with which questions triggered each and what the resource helps achieve.
 */
export function getRecommendations(
  answers: Record<string, number>,
  resources: ScorecardResource[]
): ScorecardRecommendation[] {
  const byResourceId = new Map<number, { triggeredBy: ScorecardTrigger[]; outcome: string }>()

  for (const rule of RECOMMENDATION_RULES) {
    const selected = getSelectedOption(rule.trigger.questionId, answers[rule.trigger.questionId] ?? -1)
    if (!selected || !rule.trigger.optionValues.includes(selected.value)) continue

    const question = SCORECARD_QUESTIONS.find((q) => q.id === rule.trigger.questionId)
    const trigger: ScorecardTrigger = {
      questionId: rule.trigger.questionId,
      questionText: question?.question ?? rule.trigger.questionId,
      selectedLabel: selected.label,
    }

    for (const res of resources) {
      const title = res.title ?? ''
      const slug = res.slug ?? null
      if (!rule.titleOrSlugMatch(title, slug)) continue

      const existing = byResourceId.get(res.id)
      if (existing) {
        if (!existing.triggeredBy.some((t) => t.questionId === trigger.questionId))
          existing.triggeredBy.push(trigger)
      } else {
        byResourceId.set(res.id, { triggeredBy: [trigger], outcome: rule.outcome })
      }
    }
  }

  return resources
    .filter((r) => byResourceId.has(r.id))
    .map((r) => {
      const { triggeredBy, outcome } = byResourceId.get(r.id)!
      return { resource: r, triggeredBy, outcome }
    })
}
