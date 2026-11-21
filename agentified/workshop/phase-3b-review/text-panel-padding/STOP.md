# Measured-padding qualification stop

Status: **STOP / review-only / unbound**. Base: PR #1290 `0e5550097b15070480d3d83dfaf3428f3d4fde50`. No learner media or approved source frame was replaced.

The reproducible `--padding-review --headlines-only --scenes=L06-03,L10-03` render fits both overflowing headline boxes to their measured glyph footprints with 28 px padding. In the 1920×1080 candidate stills, L06-03 changes its headline box from 690×700 to 711×183 px and L10-03 to 712×183 px. The underlying approved plates, other labels, diagrams, and background pixels outside the old/new headline area remain identical to the original render. Desktop stills show both headline borders clear of their text and the neighboring plate.

The first contextual caption-on check at L06-03 **fails**. At lesson time 77 seconds (8-second review clip beginning at 75 seconds), Chrome renders the active source VTT cue across the lower part of the video, obscuring both “Prepare” and “Human gate.” The browser screenshot `checks/L06-03-desktop-caption-on-stop.png` records the collision. The candidate renderer did not move those two labels, and the source VTT is unchanged, so the collision is a pre-existing desktop caption/teaching-label conflict exposed by this review. At the approved stacked code head, L06 uses native in-video captions on desktop; its mobile caption band is external. The direct MP4 and local `review.html` are review aids, not proof of a learner-route pass.

Stop at this first collision under Vambah's explicit instruction. L10-03's headline-only still was inspected, but its caption-on/off context is not qualified. The remaining lesson-order padding candidates, consolidated before/after MP4, and Human QA are pending. Do not call the two scene repairs passed or bind them to learner media. The two pre-existing untracked L10 WAVs remain untouched.

## Reproduction

```bash
node agentified/workshop/phase-3b-review/text-panel-padding/audit.mjs
node agentified/workshop/presentation-illustration-audit/render-semantic-visuals.mjs --padding-review --headlines-only --scenes=L06-03,L10-03
bash agentified/workshop/phase-3b-review/text-panel-padding/render-overflow-context.sh
```

Open `http://127.0.0.1:8765/agentified/workshop/phase-3b-review/text-panel-padding/checks/review.html?scene=L06-03&layout=desktop`, play to about 0:02 with English captions on, and compare the active cue with the two lower teaching labels. The page is a local review surface; no provider, deployment, publication, or release action is involved.
