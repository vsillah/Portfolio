import type { ReactNode } from 'react'

/*
 * Wayfinding marks for the Commons Economy Map: one small ink mark for each
 * walkthrough step, keyed by the step's own id from the envelope.
 *
 * Presentation only. Each mark pictures the step's printed title and the hand
 * that does it, so a reader can match a stop on the rail to its place on the
 * plate at a glance. The title, the place and the step number stay in the
 * model and stay printed; a mark is hidden from assistive technology and is
 * never the only carrier of anything. A step with no entry prints no mark.
 *
 * All marks are drawn here on a 24 unit square as cut ink: solid shapes and
 * square-ended 2 unit rules in the current colour, with gaps cut through the
 * shape itself so a mark sits on any ground. `cue` says in plain words what
 * is drawn, for whoever maintains the set; it describes the drawing only, it
 * repeats nothing from the model, and the page does not print it.
 */

export type StepMark = {
  /* What is drawn. Not printed. */
  cue: string
  /* SVG children on a 0 0 24 24 view box. `fill` and `stroke` default to currentColor. */
  art: ReactNode
}

export type StepMarks = Record<string, StepMark>

const rule = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' } as const

export const commonsEconomyStepMarks: StepMarks = {
  /* meal */
  'meal-1': {
    cue: 'A slatted crate with leaves standing in it',
    art: <>
      <path d="M3 12h18l-.65 3.7H3.65z" />
      <path d="M3.95 17.3h16.1L19.4 21H4.6z" />
      <path d="M12 12c0-4 1.2-6.6 4.6-8.2.6 3.6-.6 6.6-4.6 8.2z" />
      <path d="M11 12c-.2-2.8-1.6-4.6-4.4-5.4-.2 2.9 1.2 4.8 4.4 5.4z" />
    </>,
  },
  'meal-2': {
    cue: 'A lidded pot with steam rising',
    art: <>
      <path d="M4 11h16v6.5A3.5 3.5 0 0 1 16.5 21h-9A3.5 3.5 0 0 1 4 17.5z" />
      <path d="M1.5 12.5h3M19.5 12.5h3" {...rule} />
      <path d="M3 9h18" {...rule} />
      <path d="M9 6.5c-1-1.2 1-2 0-3.5M14 6.5c-1-1.2 1-2 0-3.5" {...rule} strokeWidth={1.7} />
    </>,
  },
  'meal-3': {
    cue: 'A bicycle with a box on its rack',
    art: <>
      <circle cx="5.5" cy="17" r="3.5" {...rule} />
      <circle cx="18.5" cy="17" r="3.5" {...rule} />
      <path d="M5.5 17l4-7h6.5l2.5 7M9.5 10l4 7h-8M14 7h3" {...rule} strokeWidth={1.7} />
      <path d="M6.5 4.5h6v4.5h-6z" />
    </>,
  },
  'meal-4': {
    cue: 'An open door with a parcel on the threshold',
    art: <>
      <path d="M5 21V3h10v18" {...rule} />
      <path d="M15 3l4.5 2.5v13L15 21z" />
      <path d="M2 21h20" {...rule} />
      <path d="M7.5 14.5h5V19h-5z" />
    </>,
  },
  /* dollar */
  'dollar-1': {
    cue: 'A closed chest with its latch down',
    art: <>
      <path fillRule="evenodd" d="M3 10h18v10H3zM10.2 10v4.2h3.6V10z" />
      <path d="M4 10l1.6-4.5h12.8L20 10" {...rule} />
      <path d="M11.3 11.2h1.4v1.8h-1.4z" />
    </>,
  },
  'dollar-2': {
    cue: 'Shelves with two boxes placed on them',
    art: <>
      <path d="M4 2.5v19M20 2.5v19M4 8.5h16M4 14.5h16M4 20.5h16" {...rule} />
      <path d="M7 10.5h5v4H7z" />
      <path d="M13.5 16.8h4v3.7h-4z" />
    </>,
  },
  'dollar-3': {
    cue: 'An arrow turning back down into a box',
    art: <>
      <path d="M3 14h18v7H3z" />
      <path d="M17.5 12V8.5a5.5 5.5 0 0 0-11 0V9" {...rule} />
      <path d="M2.6 7.6h7.8L6.5 12.6z" />
    </>,
  },
  'dollar-4': {
    cue: 'A wrench with a blank tag tied to it',
    art: <>
      <path d="M14.2 2.6a5 5 0 0 0-3.9 7.2L2.8 17.3l3.9 3.9 7.5-7.5a5 5 0 0 0 7.2-3.9l-3.3 1.7-2.9-2.9z" />
      <path d="M15 16.5h6.5V22H15z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12.6 14.4l2.9 2.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
    </>,
  },
  /* vote */
  'vote-1': {
    cue: 'One filled seat in a ring of open seats',
    art: <>
      <circle cx="12" cy="4.2" r="3.2" />
      <circle cx="4.6" cy="9.6" r="1.9" {...rule} strokeWidth={1.5} />
      <circle cx="19.4" cy="9.6" r="1.9" {...rule} strokeWidth={1.5} />
      <circle cx="7.4" cy="18.6" r="1.9" {...rule} strokeWidth={1.5} />
      <circle cx="16.6" cy="18.6" r="1.9" {...rule} strokeWidth={1.5} />
    </>,
  },
  'vote-2': {
    cue: 'A balance with a card set on its beam',
    art: <>
      <path d="M12 6v14M6.5 21h11M4 8.5h16" {...rule} />
      <path d="M9.3 1.5h5.4v4.4H9.3z" />
      <path d="M1.2 15.5h5.6L4 9.5zM17.2 15.5h5.6L20 9.5z" />
    </>,
  },
  'vote-3': {
    cue: 'An envelope with an arrow rising out of it',
    art: <>
      <path d="M2.5 7h19v13h-19z" {...rule} />
      <path d="M2.5 7l9.5 7.5L21.5 7z" />
      <path d="M12 2.5v4M9.6 4.3L12 2l2.4 2.3" {...rule} strokeWidth={1.7} />
    </>,
  },
}
