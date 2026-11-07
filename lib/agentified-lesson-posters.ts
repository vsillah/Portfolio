/** Static Agentified cover URLs. Approved video sources are supplied separately when available. */
export const agentifiedLessonPosters = {
  L01: '/agentified/posters/l01-poster.webp',
  L02: '/agentified/posters/l02-poster.webp',
  L03: '/agentified/posters/l03-poster.webp',
  L04: '/agentified/posters/l04-poster.webp',
  L05: '/agentified/posters/l05-poster.webp',
  L06: '/agentified/posters/l06-poster.webp',
  L07: '/agentified/posters/l07-poster.webp',
  L08: '/agentified/posters/l08-poster.webp',
  L09: '/agentified/posters/l09-poster.webp',
  L10: '/agentified/posters/l10-poster.webp',
  L11: '/agentified/posters/l11-poster.webp',
  L12: '/agentified/posters/l12-poster.webp',
  L13: '/agentified/posters/l13-poster.webp',
  L14: '/agentified/posters/l14-poster.webp',
  L15: '/agentified/posters/l15-poster.webp',
  L16: '/agentified/posters/l16-poster.webp',
} as const

const diagram = {
  L01: 'first receipt', L02: 'SAM trust layer', L03: 'first receipt',
  L04: 'A.M.I.N.A. inside SAM', L05: 'portfolio-first operating stack',
  L06: 'authority ladder', L07: 'authority ladder', L08: 'first receipt',
  L09: 'SAM trust layer', L10: 'authority ladder',
  L11: 'portfolio-first operating stack', L12: 'first receipt',
  L13: 'A.M.I.N.A. inside SAM', L14: 'portfolio-first operating stack',
  L15: 'SAM trust layer', L16: 'A.M.I.N.A. inside SAM',
} as const

export function agentifiedPosterAlt(lesson: { id: string; title: string }) {
  return `${lesson.id} ${lesson.title} lesson cover: Vambah presents the ${diagram[lesson.id as keyof typeof diagram]} diagram.`
}
