# L08-01 desktop caption overlap — stop receipt

Draft PR #1290 remains **HOLD**. This read-only check used the exact stacked PR #1293 code at `404656cca67eb48d57261520a1a54179ed87095e` in an isolated localhost preview. The stacked source worktree was not edited. The preview used placeholder Supabase configuration and disabled outbound n8n calls.

Route: `http://127.0.0.1:3112/agentified/learningplan?lesson=L08&rev=404656cca` at 1280×720 and 390×844. The browser confirmed the selected video label began with `L08` before seeking. At 00:12.717 in non-mapped scene L08-01, one native desktop caption cue (`00:11.160–00:13.040`, “What does ‘maybe’ permit the drafter to”) crosses the lower-left headline “A handoff must be testable.” Controls were hidden. Disabling the native text track reveals the full headline. The VTT is unchanged: `public/agentified/lessons/l08/continuous-3c5b399f/agentified-l08-continuous-narration-captions.vtt`.

The same scene at 390×844 uses the external caption band beneath the player; the band is readable and does not cover the headline. The desktop issue remains reproducible and is the first failure in the resumed ordered L08–L16 non-plate sweep. See `404-L08-01-desktop-on.png`, `404-L08-01-desktop-off.png`, and `404-L08-01-mobile-on.png` in `agentified/workshop/phase-3b-review/`. The desktop MP4 in that directory records the caption-on and caption-off comparison.

The L08-02–L16 sequence is not qualified. L10's 02:46–03:16 acoustic/caption review, L16 resting-card handoff, final spoken-transcript provenance, and consolidated full-scope MP4 remain pending under the explicit stop condition. No provider, generation, spending, media binding, learner or production mutation, merge, deployment, or publication occurred.

Next gate: a separately scoped, source-faithful desktop L08-01 caption placement correction on the exact stacked code. Verify captions on/off at the cited cue and 1280×720/390×844 before resuming the ordered sweep.
