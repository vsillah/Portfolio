/*
 * The photo story for the Commons Economy Map: one staged frame for each
 * walkthrough step, keyed by the step's own id from the envelope.
 *
 * This is presentation only. The frames are fictional composites generated
 * for this page (see docs/insights/commons-economy-photo-provenance.md); the
 * alt text and captions describe the picture and are written here, never read
 * from or added to the model. A step with no entry prints no picture.
 *
 * `position` is the printed crop: every frame is shown 4:3 from a 3:2 source,
 * so it sets which part of the width survives. meal-3 must stay at 100%.
 */

export type StepPhoto = {
  /* Site path of the 1200×800 WebP under public/. */
  src: string
  /* What the picture shows. Starts with "Illustrative": nothing in it is a record. */
  alt: string
  /* One line under the picture: the staged transaction and role, and that it is staged. */
  caption: string
  /* CSS object-position for the 4:3 crop. */
  position: string
}

export type PhotoStory = Record<string, StepPhoto>

const at = (name: string) => `/insights/commons-economy-map/${name}.webp`

export const commonsEconomyPhotoStory: PhotoStory = {
  'meal-1': {
    src: at('meal-1'),
    alt: 'Illustrative market stand: an older Black man in a canvas work jacket sets a striped squash and bunched greens into a wooden crate with a painted band, while a second man holding a closed ledger and a pencil points at stacked crates behind him. No faces are shown.',
    caption: 'What the stand will not sell goes into one crate, set apart, and someone counts the crates. A staged picture: no real stand, grower or count.',
    position: '40% 50%',
  },
  'meal-2': {
    src: at('meal-2'),
    alt: 'Illustrative kitchen table: a cook with deep brown hands, in a striped apron, ladles stew from a steel pot into a paper tub; beside her a second cook with lighter brown hands presses a lid onto a stack of filled tubs. The banded crate sits open at the end of the table. No faces are shown.',
    caption: 'The crate becomes packed meals. A staged picture: no real kitchen or crew.',
    position: '60% 50%',
  },
  'meal-3': {
    src: at('meal-3'),
    alt: 'Illustrative doorway on a quiet sidewalk: a man seated in a wheelchair holds a clipboard with a blank sheet and points up the street, while a rider in fingerless gloves sets lidded meal boxes into a wooden crate in the front of a cargo bike. A bicycle pump leans in the doorway. No faces are shown.',
    caption: 'One handoff is planned at the door, then carried by bike. A staged picture: no real route, rider or address.',
    position: '100% 50%',
  },
  'meal-4': {
    src: at('meal-4'),
    alt: 'Illustrative front door, seen from inside: gloved hands pass two lidded meal boxes across the threshold to an older woman in a knitted cardigan, whose other hand rests beside a blank card and a pencil on the hall table. A bicycle stands outside. No faces are shown.',
    caption: 'The meal arrives, and the card for saying what came is the household’s. A staged picture: no real household or door.',
    position: '55% 50%',
  },
  'dollar-1': {
    src: at('dollar-1'),
    alt: 'Illustrative desk by a window: a closed metal box with a latch, and a man’s brown hand resting flat on a closed ledger with a pencil lying on it. Across the desk a chair stands empty with a coat over its back. No face is shown.',
    caption: 'Something held for shared things only, the books closed, and the holder’s chair still empty. A staged picture: no real fund, account or holder.',
    position: '35% 50%',
  },
  'dollar-2': {
    src: at('dollar-2'),
    alt: 'Illustrative kitchen table: a cook in a striped apron slides a blank sheet of paper forward with two fingers, while a second woman beside her, folded glasses in one hand, runs a tape measure along an empty shelf. Another blank sheet lies under a paperweight. No faces are shown.',
    caption: 'A request for shared kitchen space, checked by someone other than the person asking. A staged picture: nothing here was bought, approved or adopted.',
    position: '45% 50%',
  },
  'dollar-3': {
    src: at('dollar-3'),
    alt: 'Illustrative desk: a metal box standing open and empty and an empty glass jar with its lid off, beside an open ledger of blurred pencil lines; a brown hand holds a pencil at the top of a blank half page. No face is shown.',
    caption: 'If an enterprise ever had a surplus, a share would be written in here. The box and the jar are empty. A staged picture: no surplus exists and none is promised.',
    position: '40% 50%',
  },
  'dollar-4': {
    src: at('dollar-4'),
    alt: 'Illustrative workshop bench: an older man in a corduroy jacket hands a rolled canvas tool roll with a blank paper tag to a younger man in a hooded sweatshirt, who takes it in both hands. A forearm crutch leans on the bench, a closed ledger lies at its corner, and a cargo bike stands behind. No faces are shown.',
    caption: 'Shared tools lent for a while, with a tag for the day they come back. A staged picture: no wage, cash or real lending record.',
    position: '50% 50%',
  },
  'vote-1': {
    src: at('vote-1'),
    alt: 'Illustrative doorway of a community room: a person in a denim overshirt lifts one blank card from a small stack on a table, a pencil beside it, and next to them a blank sheet lies under a stone paperweight. Empty chairs stand in a loose circle behind. No face is shown.',
    caption: 'One resident takes a card. The sheet where the joining rule would be written is still blank. A staged picture: no real member or roll.',
    position: '55% 50%',
  },
  'vote-2': {
    src: at('vote-2'),
    alt: 'Illustrative table under a cork board with one blank card pinned to it: three hands of different skin tones each set one plain cylindrical wooden counter into one of two unmarked wooden trays that already hold a few counters. No faces are shown.',
    caption: 'A posted seat is weighed, one counter from each member. A counter stands for a vote on the post, never for a person. A staged picture: no real vote or count.',
    position: '50% 50%',
  },
  'vote-3': {
    src: at('vote-3'),
    alt: 'Illustrative front steps with an iron rail: a hand in a denim sleeve offers a plain sealed envelope to a woman in a wool coat with a canvas tote, who takes it while her other hand holds a blank card and a pencil against the rail. No faces are shown.',
    caption: 'A private invitation changes hands, and the answer belongs to the person invited. A staged picture: no real invitation, seat or address.',
    position: '50% 50%',
  },
}
