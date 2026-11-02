export const SPEAKING_SERVICE_ID = 'a278e803-9328-490b-bf57-8fbee7d129ee'

export const audienceOptions = [
  { value: 'product', label: 'Product & technology leaders' },
  { value: 'community', label: 'Community & nonprofit leaders' },
  { value: 'founders', label: 'Founders & operators' },
  { value: 'mixed', label: 'Cross-sector audience' },
] as const

export const outcomeOptions = [
  { value: 'clarity', label: 'A clearer way to decide' },
  { value: 'action', label: 'A practical first move' },
  { value: 'dialogue', label: 'A stronger conversation' },
] as const

export const formatOptions = [
  { value: 'keynote', label: 'Keynote' },
  { value: 'fireside', label: 'Fireside conversation' },
  { value: 'panel', label: 'Panel' },
] as const

export const topicOptions = [
  { value: 'agentic', label: 'Agentic systems & AI governance' },
  { value: 'product', label: 'Practical AI & product transformation' },
  { value: 'access', label: 'Access, equity & technology' },
  { value: 'burden', label: 'Systems that reduce burden' },
  { value: 'books', label: 'Books, authorship & ideas' },
] as const

export type SpeakerFitInput = {
  audience: string
  outcome: string
  format: string
  topic: string
}

const directions: Record<string, { title: string; angle: string }> = {
  agentic: {
    title: 'Who is accountable when the agents act?',
    angle: 'An operating-system view of AI agents, human decision rights, and governance that survives the demo.',
  },
  product: {
    title: 'Move fast to discover. Slow down to scale.',
    angle: 'A practical conversation about where AI helps product teams learn, decide, and deliver with care.',
  },
  access: {
    title: 'The next innovation may already be at the margins.',
    angle: 'How access shapes who gets to build, benefit from, and govern technology.',
  },
  burden: {
    title: 'Make the work lighter for the people doing it.',
    angle: 'Designing systems around real operator capacity, especially where time and resources are scarce.',
  },
  books: {
    title: 'From a hard question to a usable blueprint.',
    angle: 'An author conversation drawing on The Equity Code and Accelerated to connect ideas with action.',
  },
}

const hasValue = (options: readonly { value: string }[], value: string) =>
  options.some((option) => option.value === value)

export function recommendSpeakerFit(input: SpeakerFitInput) {
  if (!hasValue(audienceOptions, input.audience) ||
      !hasValue(outcomeOptions, input.outcome) ||
      !hasValue(formatOptions, input.format) ||
      !hasValue(topicOptions, input.topic)) return null

  const direction = directions[input.topic]
  const audience = audienceOptions.find((item) => item.value === input.audience)!.label
  const format = formatOptions.find((item) => item.value === input.format)!.label
  const outcome = outcomeOptions.find((item) => item.value === input.outcome)!.label.toLowerCase()
  const formatNote = input.format === 'panel'
    ? 'Use one concrete tension to anchor the panel, then give each speaker room to respond.'
    : input.format === 'fireside'
      ? 'Build the conversation around a few real decisions and leave room for audience questions.'
      : 'Open with a human problem, then give the audience a framework they can carry into their work.'

  return {
    title: direction.title,
    angle: direction.angle,
    fit: `${format} direction for ${audience.toLowerCase()}, designed to leave people with ${outcome}.`,
    checklist: [
      `Name the decision or challenge facing ${audience.toLowerCase()}.`,
      formatNote,
      'Share the event date, location, audience size, and accessibility needs when you inquire.',
    ],
  }
}

export function speakingServiceHref(input?: SpeakerFitInput) {
  const base = `/services/${SPEAKING_SERVICE_ID}`
  if (!input || !recommendSpeakerFit(input)) return base
  const params = new URLSearchParams({
    speakerAudience: input.audience,
    speakerOutcome: input.outcome,
    speakerFormat: input.format,
    speakerTopic: input.topic,
  })
  return `${base}?${params.toString()}`
}
