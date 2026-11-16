# L02–L16 clean-shell visual review

Status: review only. [Receipt](receipt.json) binds 91 scene previews to the current approved script, visual MP4, VTT, renderer, and source audit hashes. Four contact sheets show all in-scope frames: [1](clean-contact-sheet-01.jpg), [2](clean-contact-sheet-02.jpg), [3](clean-contact-sheet-03.jpg), [4](clean-contact-sheet-04.jpg). L16-06 is excluded because the separate end-screen lane owns it.

Every preview uses the renderer's existing clean path, which removes the scene code, repeated learner-artifact footer, and decorative progress dots. Current source-art beats are exported as additional review frames. The 960×540 previews are visual review images, not replacement lesson videos.

## Dense-card decisions

| Scene and source time | Review treatment | Script and evidence boundary |
| --- | --- | --- |
| L02-04, 273–366s | Three larger option cards replace the six-column blank ledger. | Welcome email, guided first task, and staff dashboard phrases come from the approved scene narration. No scores or customer results were added. |
| L05-01, 0–100s | Six large ID cards retained after inspection; the shell footer is removed. | The narration introduces six fictional notes. This scene's ID cards were not the text-density defect. |
| L05-02, 100–200s | Two large F01/F02 cards, then a separate F03/F04 beat beginning at source VTT 157.674s. | The approved Scene 2 narration supports F01–F04. The current renderer's premature `F05 · source note pending` and `F06 · source note pending` rows are omitted. |
| L05-03, 200–300s | Keep the opening book-case comparison; reveal F05 at source VTT 252.093s and F06 at 273.953s. | Approved Scene 3 gives the exact fictional F05/F06 wording. [F05 frame](frames/L05-03-f05.jpg) and [F06 frame](frames/L05-03-f06.jpg) preserve that six-note teaching sequence without inventing customer evidence. |
| L06-02, 110–220s | Three large option cards replace the five-column blank ledger. | The card phrases come from the approved scene narration; the approved Alignment source-art beat remains available. |
| L07-02, 100–200s | Three focused cards replace the checkpoint diagram whose lines crossed labels. | Each phrase comes from the approved scene narration. |
| L09-02, 110–220s | The six blueprint parts become two three-card beats, in script order. The second starts at source VTT 152.664s. | The part names and examples come from the approved scene narration. |
| L12-01, 0–110s | Three upper-half source/context/outcome cards replace the blank feedback table. | The phrases come from the approved scene narration. |

The [L05-02 before/after MP4](l05-02-before-after-24s.mp4) compares the same 112–124s source excerpt. The first 12s show the current visual; the second 12s show the F01/F02 clean card. The [caption review page](l05-02-caption-review.html) applies an excerpt of the existing source VTT to both clips. At 1728×962 desktop and 390×844 mobile (350px player), the revised card words remained above the native caption band. The first candidate failed this mobile check because caption text covered the lower card words; this packet contains the corrected upper-half layout. Browser controls can still cover part of the caption while visible. Full-lesson caption timing is not qualified by this excerpt.

The review page's 8s control checks each video's actual time and displays a success or error state. A local static server that has no seekable media range is handled by muted fast playback to the target. Chrome localhost review at 1728×962 and 390×844 reached and paused both videos at 8.00s with `readyState` 4; a repeated mobile click kept the same verified state. The integrated in-app Browser was unavailable in this worktree, so that surface still needs a captain recheck.

This packet preserves all canonical lesson MP4s, learner bindings, native presenter media, audio, and source captions. It creates no provider request or generated speech. The earlier [L08 native-presenter clean-shell comparison](../visual-text-audit/l08-01-clean-shell-before-after.mp4) remains the presenter proof. F05/F06 are synthetic teaching notes supported by L05 Scene 3, not Scene 2 or real customer evidence.

The [full-lesson visual EDL](full-lesson-edl.json) binds clean scene beats, source cue times, 25 fps frame boundaries, original MP4/VTT hashes, and native presenter windows for L02–L15. It stops L16 before the separately owned end screen. The L05 note reveals begin at 252.08s and 273.96s after frame quantization, within 13 ms of the source VTT cues. The optional [L05 visual-only candidate](l05-clean-visual-full-review.mp4) copies the native AAC and subtitle streams and retains the source cutaway silence. It is a timing and visual review file, not a narrated finished lesson. Final speech, caption retiming, full-lesson visual QA, and learner binding remain separate gates.

Focused Chrome localhost review of the 254–262s and 277–285s excerpts showed the F05/F06 cards and source captions clear at desktop width and 390×844 mobile width when the player matched the product's 280px mobile video stage. A shorter 16:9 test player put the same long cues over the cards, so caption clearance depends on the product player geometry. This observation qualifies only these two excerpts; it does not qualify the whole L05 render or any other lesson.
