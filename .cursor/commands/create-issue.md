# create-issue

Capture a bug, feature, or improvement as a GitHub issue.

## Your Goal

Create a complete GitHub issue on the workspace's repository:

- Clear title
- TL;DR of what this is about
- Current state vs expected outcome
- Relevant files that need touching
- Risk/notes if applicable
- Proper labels (type: bug/enhancement/improvement, priority if applicable)

**Output:** Create the issue on GitHub using `gh issue create` (via Shell tool). Do not create local markdown files in `docs/issues/`.

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

**Create the GitHub issue:**

1. Resolve repo: `git remote get-url origin` to get owner/repo.
2. Write the body to a temp file to avoid shell quoting issues:
   ```bash
   cat > /tmp/gh-issue-body.md <<'ENDOFBODY'
   ## TL;DR
   ...
   ## Current state
   ...
   ## Expected outcome
   ...
   ## Relevant files
   ...
   ## Risks / notes
   ...
   ENDOFBODY
   ```
3. Create the issue:
   ```bash
   gh issue create --repo owner/repo \
     --title "Issue title" \
     --label "enhancement" \
     --body-file /tmp/gh-issue-body.md
   ```
4. Return the issue URL to the user.

## Issue Body Format

Use this structure in the body:

- `## TL;DR`
- `## Current state` / `## Expected outcome`
- `## Relevant files`
- `## Implementation approach` (optional, for features)
- `## Risks / notes` (optional)

## Behavior Rules

- Be conversational — ask what makes sense, not a checklist
- Default label: `enhancement` for features, `bug` for bugs, `improvement` for improvements
- Max 3 files in context — most relevant only
- Bullet points over paragraphs
- **Always create on GitHub** — do not write to `docs/issues/` or any local file
- Return the GitHub issue URL when done
