# Agentified workshop guest review

Source commit: `599df64c`. The production build was started from this commit at `http://localhost:3241` with outbound n8n disabled. Review routes:

- `http://localhost:3241/agentified/learningplan?lesson=L01&revision=599df64c`
- `http://localhost:3241/agentified/learningplan?lesson=L06&revision=599df64c`
- `http://localhost:3241/agentified/operating-file?revision=599df64c`

The MP4 is a timed walkthrough assembled from privacy-safe captures of the live Chrome route. It shows direct L01–L02 lesson selection, the locked video state, the approved plate, the exact transcript, worksheet editing, completion status, the consolidated Operating File, and narrow-width lesson/file views. The synthetic response was entered only in guest local storage. No learner account, intake, provider, or client record was created.

Chrome was the fallback because this chat's integrated browser was unavailable. The signed-in member route, cross-device resume, actual assessment submission, and production/staging deployments were not exercised. Human QA remains pending until the exact final commit can be loaded in the integrated browser and a signed-in fixture or approved safe account path can be reviewed.

Validation: `ffprobe` reported H.264, 1920×1080, 22.5 seconds. A decoded midpoint frame was visually inspected. The eight source PNG captures are retained; `render-walkthrough.sh` reproduces the MP4 from them.
