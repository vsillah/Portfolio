# Commons Economy Map photo story: provenance

2026-11-26. Eleven fictional frames, one for each walkthrough step of the Commons Economy Map (`meal-1` to `meal-4`, `dollar-1` to `dollar-4`, `vote-1` to `vote-3`).

- **Scenes, casting, alt text, captions and crops:** authored by Claude for this page. They live in `components/insights/commons-economy/photo-story.ts`, keyed by step id. They are presentation copy that describes the pictures. Nothing here was added to the canonical model, the transport or the adapter.
- **Generation:** by the coordinating lane with its built-in no-charge `image_gen` tool, from the shared treatment and the scene for each frame below. One frame, `vote-2`, was regenerated once to replace figure-shaped pegs with neutral cylindrical counters. No source photograph or real likeness was supplied, and nothing was downloaded from a third party.
- **Originals:** kept outside the repository under the coordinating lane's generated-images directory. Their file names were not passed to this record; the coordinating lane holds them.
- **Conversion:** each original once, `cwebp -q 82 -m 6 -sharp_yuv`, to 1200×800 WebP under `public/insights/commons-economy-map/`.
- **Screening:** the coordinating lane screened all eleven for faces, readable text, real likeness, recognizable address or landmark, logo, currency and real resident data. Claude then screened the original files in grayscale with the page filter and in the rendered page at 390, 768 and 1440, rejecting `vote-2` because its pegs resembled figures. The coordinating lane generated and screened the one replacement against that exact objection; the production browser matrix then passed with the replacement at every required viewport. Findings are in the table.
- **Printed treatment:** every frame prints 4:3 from the 3:2 source with `filter: grayscale(.9) contrast(1.08)`, square-cut with a keyline, as the Commons prints its photographs. `position` is the CSS `object-position` of the crop.

Every person is a fictional composite. No frame documents a real person, place, event, record, payment, vote or decision, and every caption says the picture is staged.

## Shared treatment

> Black-and-white documentary photograph for a fictional neighborhood prototype, silver-gelatin look, fine natural film grain, soft available light, shallow depth of field, candid and mid-action. Framed from the chest down or closer: hands, forearms, tools and objects carry the picture. No faces anywhere in the frame. Fictional composite people who resemble no real person. No readable text, letters or numbers on any surface; every card, slip, label, tag, ledger page and envelope is blank or blurred to abstract pencil marks. No logos, no signage, no street names, no house numbers, no recognizable building or landmark, no uniforms, no police, no currency. Landscape 3:2.

## Asset manifest

| Step | File | Bytes | SHA-256 | Crop position | Screening |
|---|---|---:|---|---|---|
| `meal-1` | `public/insights/commons-economy-map/meal-1.webp` | 101,400 | `210c2e50795c3fd1569f3e19aa01101af4e9862bdb9e8acb27b0a4fe72cf1c84` | `40% 50%` | Accepted |
| `meal-2` | `public/insights/commons-economy-map/meal-2.webp` | 78,422 | `771771df433712db410ca2e4df637edbd51cb11b97cf1c5add565212954e4bad` | `60% 50%` | Accepted |
| `meal-3` | `public/insights/commons-economy-map/meal-3.webp` | 72,704 | `120a064cd54c3781dc0c92677d788ec10cd63be3654871497db7e6a7a04f2c7b` | `100% 50%` | Accepted with required crop |
| `meal-4` | `public/insights/commons-economy-map/meal-4.webp` | 76,014 | `7e12d9a905dde92649ccc74ff004e4ea2c1f3ff181717477097fdd760a4a51b4` | `55% 50%` | Accepted |
| `dollar-1` | `public/insights/commons-economy-map/dollar-1.webp` | 64,518 | `3027f55944ff7d4e06b30d575bd5c2d86f5174f7a715fd0cb90e80d5536c8ff8` | `35% 50%` | Accepted |
| `dollar-2` | `public/insights/commons-economy-map/dollar-2.webp` | 74,894 | `894d5c627341f7e7dea7e3adc5ca3e8ddfd47ea679fc2912e340f8cf6663d7d0` | `45% 50%` | Accepted |
| `dollar-3` | `public/insights/commons-economy-map/dollar-3.webp` | 59,368 | `b203562c3ba6a901758fd976a5cb5b50dd4197cbc8ade6344380a94c305ccbad` | `40% 50%` | Accepted |
| `dollar-4` | `public/insights/commons-economy-map/dollar-4.webp` | 95,978 | `0a69e5303398d9e9c2b05d4bab13a7c4b1878390f55c16263cf16e11e713e853` | `50% 50%` | Accepted |
| `vote-1` | `public/insights/commons-economy-map/vote-1.webp` | 80,288 | `b2c218c84bc10ce87bf0c6dab372c911851bea6772b4eb5b55526e2b938cbde9` | `55% 50%` | Accepted |
| `vote-2` | `public/insights/commons-economy-map/vote-2.webp` | 92,652 | `656a84e1d9c0c9c1de9266f890fcd4d18a6fbb28fc18aa112f356da51b1940d4` | `50% 50%` | Accepted after one regeneration |
| `vote-3` | `public/insights/commons-economy-map/vote-3.webp` | 82,400 | `53549e8ef60c70b9862d7b9276b105fe9777a0693c200383b0a0284ec950689b` | `50% 50%` | Accepted |

Total payload: 878,638 bytes. The console panel loads the current step's frame eagerly; the strip loads lazily.

## Frames

### meal-1

- **Scene given to the generator:** Early morning at a market stand’s back table under a canvas awning. The grower lifts bunches of greens and squash from the selling table into one wooden crate with a single painted band, set apart on the ground. Behind him, soft and out of focus, the steward holds a closed hardback ledger and a pencil and counts two stacked crates with a pointing finger.
- **Casting as it prints:** Grower: Black man in his sixties, deep brown skin, canvas work jacket. Steward: man in his fifties, medium-brown skin, corduroy jacket, closed ledger and pencil.
- **Alt text:** Illustrative market stand: an older Black man in a canvas work jacket sets a striped squash and bunched greens into a wooden crate with a painted band, while a second man holding a closed ledger and a pencil points at stacked crates behind him. No faces are shown.
- **Caption:** What the stand will not sell goes into one crate, set apart, and someone counts the crates. A staged picture: no real stand, grower or count.
- **Screening note:** Accepted. The crate’s painted band reads clearly.

### meal-2

- **Scene given to the generator:** A plain shared kitchen with a scrubbed wooden work table. The same banded wooden crate sits open at the table’s end, half emptied. The kitchen lead ladles stew from a steel pot into a row of plain lidded containers. Beside her the second cook presses lids on and stacks the containers in twos.
- **Casting as it prints:** Kitchen lead: Black woman in her forties, medium-deep brown skin, striped apron. Second cook: woman in her twenties, light-brown skin, dark apron, woven bracelet.
- **Alt text:** Illustrative kitchen table: a cook with deep brown hands, in a striped apron, ladles stew from a steel pot into a paper tub; beside her a second cook with lighter brown hands presses a lid onto a stack of filled tubs. The banded crate sits open at the end of the table. No faces are shown.
- **Caption:** The crate becomes packed meals. A staged picture: no real kitchen or crew.
- **Screening note:** Accepted. Tubs are paper tubs with lids rather than the flat boxes of meal-3 and meal-4; the banded crate carries the continuity.

### meal-3

- **Scene given to the generator:** A doorway onto a quiet sidewalk in soft daylight. The dispatcher, seated in a manual wheelchair, holds out a clipboard with one blank sheet and points along the street. The rider stands astride a front-loading cargo bike and settles a stack of plain lidded containers into the bike’s box, where the banded crate lines the bottom. A bicycle pump and a rag rest against the doorframe.
- **Casting as it prints:** Dispatcher: man in his thirties, medium-brown skin, seated in a manual wheelchair, wristwatch, blank clipboard. Rider: woman in her twenties, dark brown skin, fingerless cycling gloves, cargo bike.
- **Alt text:** Illustrative doorway on a quiet sidewalk: a man seated in a wheelchair holds a clipboard with a blank sheet and points up the street, while a rider in fingerless gloves sets lidded meal boxes into a wooden crate in the front of a cargo bike. A bicycle pump leans in the doorway. No faces are shown.
- **Caption:** One handoff is planned at the door, then carried by bike. A staged picture: no real route, rider or address.
- **Screening note:** Accepted with a required crop. The source frame shows part of a bearded jaw in its top-left corner (about the left 90 px, top 40 px). The printed 4:3 crop is pinned to the right edge (`100% 50%`), which removes the left 133 px at every size. A unit test pins that position. The crate in the bike shows no band.

### meal-4

- **Scene given to the generator:** An interior hallway threshold, the door open inward, seen from inside at waist height. The rider’s gloved hands pass two plain lidded containers across the threshold. The household member takes them with one hand; her other hand rests on a small blank card and a pencil on a hall shelf. The cargo bike’s front wheel is just visible outside.
- **Casting as it prints:** Rider: dark jacket and full gloves, so no skin shows. Household: woman in her seventies, light-brown skin, knitted cardigan, plain ring.
- **Alt text:** Illustrative front door, seen from inside: gloved hands pass two lidded meal boxes across the threshold to an older woman in a knitted cardigan, whose other hand rests beside a blank card and a pencil on the hall table. A bicycle stands outside. No faces are shown.
- **Caption:** The meal arrives, and the card for saying what came is the household’s. A staged picture: no real household or door.
- **Screening note:** Accepted. The rider wears full gloves here and fingerless gloves in meal-3.

### dollar-1

- **Scene given to the generator:** A plain desk by a window. A closed steel document box with a simple latch sits in the centre. Beside it lies the steward’s closed hardback ledger with a pencil across it. The steward rests one open hand flat on the closed ledger and does not open it. Across the desk an empty wooden chair is pulled out, a folded coat over its back.
- **Casting as it prints:** Steward: man in his fifties, medium-brown skin, corduroy jacket. The holder is an empty chair.
- **Alt text:** Illustrative desk by a window: a closed metal box with a latch, and a man’s brown hand resting flat on a closed ledger with a pencil lying on it. Across the desk a chair stands empty with a coat over its back. No face is shown.
- **Caption:** Something held for shared things only, the books closed, and the holder’s chair still empty. A staged picture: no real fund, account or holder.
- **Screening note:** Accepted.

### dollar-2

- **Scene given to the generator:** The same shared kitchen and scrubbed wooden work table, cleared. One blank sheet lies on the table. The kitchen lead slides the sheet forward with two fingers. The approver holds folded reading glasses in one hand and lays a steel tape measure along an empty run of open shelving. A second blank sheet waits under a plain paperweight.
- **Casting as it prints:** Kitchen lead (requester): Black woman in her forties, medium-deep brown skin, striped apron. Approver: woman in her sixties, deep brown skin, dark blouse, folded glasses, tape measure.
- **Alt text:** Illustrative kitchen table: a cook in a striped apron slides a blank sheet of paper forward with two fingers, while a second woman beside her, folded glasses in one hand, runs a tape measure along an empty shelf. Another blank sheet lies under a paperweight. No faces are shown.
- **Caption:** A request for shared kitchen space, checked by someone other than the person asking. A staged picture: nothing here was bought, approved or adopted.
- **Screening note:** Accepted. Tape-measure ticks are not legible.

### dollar-3

- **Scene given to the generator:** The same desk by the window. The steel document box is open and visibly empty. The steward’s ledger lies open to two pages of soft grey pencil lines blurred into abstract marks, the lower half of the right page blank. The steward’s hand holds the pencil lifted above the blank half, not writing. An empty glass jar stands with its lid off beside it.
- **Casting as it prints:** Steward: medium-brown skin. The frame shows a knitted sweater, not the corduroy jacket.
- **Alt text:** Illustrative desk: a metal box standing open and empty and an empty glass jar with its lid off, beside an open ledger of blurred pencil lines; a brown hand holds a pencil at the top of a blank half page. No face is shown.
- **Caption:** If an enterprise ever had a surplus, a share would be written in here. The box and the jar are empty. A staged picture: no surplus exists and none is promised.
- **Screening note:** Accepted with a wording change. The pencil rests on the page instead of being held above it, so the alt text says only where the pencil is, and the caption carries the meaning (box and jar empty, nothing exists or is promised). The ledger lines are abstract marks with no letters or numbers. Wardrobe differs from the other steward frames.

### dollar-4

- **Scene given to the generator:** A workshop bench with a pegboard of hand tools, soft daylight. The steward hands a rolled canvas tool roll across the bench; a plain blank paper tag hangs from its tie. The apprentice takes it with both hands. A forearm crutch leans against the bench. The closed ledger and pencil sit at the bench’s corner, and the cargo bike’s rear wheel stands behind.
- **Casting as it prints:** Steward: man in his fifties, medium-brown skin, corduroy jacket. Apprentice: man in his early twenties, medium-brown skin, hooded sweatshirt.
- **Alt text:** Illustrative workshop bench: an older man in a corduroy jacket hands a rolled canvas tool roll with a blank paper tag to a younger man in a hooded sweatshirt, who takes it in both hands. A forearm crutch leans on the bench, a closed ledger lies at its corner, and a cargo bike stands behind. No faces are shown.
- **Caption:** Shared tools lent for a while, with a tag for the day they come back. A staged picture: no wage, cash or real lending record.
- **Screening note:** Accepted. The forearm crutch leans on the bench between the two people; the alt text does not assign it to either.

### vote-1

- **Scene given to the generator:** The doorway of a plain ground-floor community room with painted brick walls, a circle of mismatched chairs soft in the background. A small table holds a short stack of blank card stock and a pencil. The member who posts lifts one blank card from the stack. Beside the stack lies a single blank sheet under a paperweight, untouched.
- **Casting as it prints:** Member who posts: person in their thirties, light-brown skin, denim overshirt, thin bangle.
- **Alt text:** Illustrative doorway of a community room: a person in a denim overshirt lifts one blank card from a small stack on a table, a pencil beside it, and next to them a blank sheet lies under a stone paperweight. Empty chairs stand in a loose circle behind. No face is shown.
- **Caption:** One resident takes a card. The sheet where the joining rule would be written is still blank. A staged picture: no real member or roll.
- **Screening note:** Accepted.

### vote-2

- **Scene given to the generator:** The scrubbed wooden work table against a wall with a cork board. One blank card is pinned alone in the centre of the cork. Below it stand two identical shallow wooden trays. Three different hands reach in from three sides, each placing a single plain wooden peg. A few pegs already lie in each tray. Nothing marks either tray.
- **Casting as it prints:** Three hands: light-brown skin in a denim sleeve; dark brown skin in a wool coat sleeve; medium-brown skin in a sweatshirt cuff.
- **Alt text:** Illustrative table under a cork board with one blank card pinned to it: three hands of different skin tones each set one plain cylindrical wooden counter into one of two unmarked wooden trays that already hold a few counters. No faces are shown.
- **Caption:** A posted seat is weighed, one counter from each member. A counter stands for a vote on the post, never for a person. A staged picture: no real vote or count.
- **Screening note:** Accepted after one regeneration. The replacement uses identical plain cylindrical wooden counters with no head, neck or figure shape, so the objects read as vote counters rather than people being sorted. No readable marks appear on the card, counters or trays.

### vote-3

- **Scene given to the generator:** A front stoop with a wrought-iron rail in soft afternoon light, no house number or street visible. The member who posts holds out a plain sealed envelope. The invited neighbor takes it with one hand; her other hand already holds a blank card and a pencil ready against the rail.
- **Casting as it prints:** Member who posts: light-brown skin, denim overshirt. Invited neighbor: woman in her fifties, dark brown skin, wool coat, canvas tote, plain ring.
- **Alt text:** Illustrative front steps with an iron rail: a hand in a denim sleeve offers a plain sealed envelope to a woman in a wool coat with a canvas tote, who takes it while her other hand holds a blank card and a pencil against the rail. No faces are shown.
- **Caption:** A private invitation changes hands, and the answer belongs to the person invited. A staged picture: no real invitation, seat or address.
- **Screening note:** Accepted. No house number, street or signage is visible.
