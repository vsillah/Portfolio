# show-issues

List all captured issues that are not yet resolved so the user can pick one to work on.

## Your Goal

Return a **scannable list** of unresolved issues:

- **Source 1 — GitHub:** List open issues for this workspace’s GitHub repo (from `git remote`). Include: issue number, title, labels if any, and link. Sort by updated (newest first) or created.
- **Source 2 — Memory (optional):** If the user has stored issues in Memory (e.g. via /create-issue), search for issue-like entities and list those that are not marked resolved.

Combine into one list. If both sources are used, group by source (e.g. "GitHub" then "Memory") so the user can tell where each item came from.

## How to Get There

1. **Resolve repo:** From the workspace root, run `git remote get-url origin` (or equivalent) to get owner/repo. Use that for GitHub API (e.g. `mcp_github_list_issues` with `state: "open"`).
2. **Fetch GitHub issues:** Call the GitHub MCP to list open issues. Include title, number, URL, and labels. No need to fetch full body unless the user asks for details.
3. **Optional — Memory:** If your tooling has access to Memory MCP, run a search for entities/observations related to "issue" or "backlog" and filter out any marked resolved. Add those to the list with a short summary.
4. **Output:** Bullet or numbered list with: `#123 · Title` and link (and label if present). Add a single line at the top: "Pick one to work on, or say 'dive into #N' / 'implement #N'."

## Behavior Rules

- **No exploration:** Do not open or analyze issue contents. Only list titles and links.
- **Unresolved only:** GitHub = `state: "open"`. Memory = exclude entities/observations that say resolved/closed/done.
- **Brief:** Max 1–2 lines per issue in the list. No long descriptions unless the user asks.
- **If no issues:** Say "No open issues found" and suggest creating one with /create-issue or checking the repo URL.
