# create-issue

Capture a bug, feature, or improvement as an issue and save it locally.

## Your Goal

Create a complete issue and **write it to a local markdown file** (not GitHub):

- Clear title
- TL;DR of what this is about
- Current state vs expected outcome
- Relevant files that need touching
- Risk/notes if applicable
- Proper type/priority/effort labels

**Output:** Save the issue to `docs/issues/{slug}.md` where `{slug}` is a kebab-case version of the title (e.g. `add-autosuggest-for-local-files.md`). Do not create GitHub issues.

## How to Get There

**Ask questions** to fill gaps — be concise, respect the user's time. Usually need:

- What's the issue/feature
- Current behavior vs desired behavior
- Type (bug/feature/improvement) and priority if not obvious

Keep questions brief. One message with 2–3 targeted questions beats multiple back-and-forths.

**Search for context** only when helpful:

- Grep codebase to find relevant files
- Note any risks or dependencies you spot

**Skip what's obvious** — If it's a straightforward bug, don't search. If type/priority is clear, don't ask.

**Write the file** — Use the existing format in `docs/issues/` (see `add-autosuggest-for-local-image-files.md` as reference). Include:

- `# Title` (h1)
- `## TL;DR`
- `## Current state` / `## Expected outcome`
- `## Relevant files`
- `## Risks / notes` (optional)
- `## Labels` with type, priority, effort

## Behavior Rules

- Be conversational — ask what makes sense, not a checklist
- Default priority: normal, effort: medium (ask only if unclear)
- Max 3 files in context — most relevant only
- Bullet points over paragraphs
- **Always create the file** — don't just output the content; write it to `docs/issues/{slug}.md`
