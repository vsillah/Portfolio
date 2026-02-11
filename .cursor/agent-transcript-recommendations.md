# Rules, Skills, and Agents — Recommendations from Agent Transcript

Based on transcript `b8ab6052-61d9-4d44-a125-a507b6335179.txt`, the following were identified for future runs.

## Implemented

### 1. n8n MCP first (rule — added)
**Source:** User request: "add a comment to your customer instructions to always use n8n mcp when n8n steps are required."

**Change:** Added a **"When to use n8n MCP (CRITICAL)"** section to `.cursor/rules/N8N-MCP-System-Instructions.mdc`:
- When investigating, debugging, or modifying n8n workflows, use n8n MCP tools first.
- Do not manually parse n8n export JSON when MCP is available; do not assume workflow state without checking via MCP.

### 2. Debug instrumentation cleanup (rule — new)
**Source:** Repeated add/remove cycles of `#region agent log`, `fetch('http://127.0.0.1:7242/ingest/...')`, and `console.log('[DEBUG]'...)`; user had to ask to "clean up the instrumentation."

**Change:** New rule `.cursor/rules/debug-instrumentation-cleanup.mdc` (always apply):
- Before considering a debugging or fix-and-verify task complete, search for and remove temporary agent log regions, debug ingest URLs, and `[DEBUG]` logs.
- Do not leave temporary instrumentation in committed code.

---

## Recommended (not yet implemented)

### 3. Lead pipeline / warm vs cold labeling (rule or doc)
**Source:** Confusion between "Trigger All Sources" and "all warm sources"; button was renamed to "Trigger All Warm Sources."

**Suggestion:** Add to admin/outreach guidance (e.g. in `admin-features.mdc` or `n8n-integration.mdc`):
- In lead pipeline / outreach UI, clearly distinguish warm vs cold and scope of "all" (e.g. "Trigger All Warm Sources" not "Trigger All Sources").
- When adding trigger or filter options, ensure labels match actual scope (warm-only, cold-only, or both).

### 4. Aggregate option keys (e.g. `maxLeads['all']`) (rule or convention)
**Source:** `maxLeads['all']` was undefined when triggering "all" sources; agent had to reason about and fix payload.

**Suggestion:** When an API or UI has an aggregate option (e.g. `source: 'all'`), ensure option payloads (e.g. `max_leads`) either have a defined value for that aggregate key or omit the option explicitly (e.g. don’t send `max_leads` when source is `'all'`). Could be a short note in `nextjs-api-routes.mdc` or a small rule for admin API routes.

### 5. Ask mode → Agent mode for rule/config changes (skill or rule)
**Source:** User asked to add the n8n rule while in Ask mode; agent could not edit and had to say "switch to Agent mode."

**Suggestion:** When the user asks to add or change a rule, skill, or project config and the agent cannot edit (e.g. Ask mode): state that the change requires Agent mode, and offer to apply the change as soon as they switch.

### 6. Optional: Dedicated “debug mode” behavior (rule or agent instructions)
**Source:** Transcript referenced "DEBUG MODE" and hypothesis-driven instrumentation; behavior was inconsistent (e.g. when to add vs remove instrumentation, when to use console vs ingest).

**Suggestion:** If you use a formal "debug mode" again, add a short rule or agent instruction that defines: when to add instrumentation, what format to use (e.g. `#region agent log`), and that instrumentation is temporary and must be removed before task complete (already partly covered by the new debug-instrumentation-cleanup rule).

---

## Summary

| Item                         | Type   | Status        |
|------------------------------|--------|---------------|
| n8n MCP first                | Rule   | Done (in N8N-MCP) |
| Debug instrumentation cleanup | Rule   | Done (new file)   |
| Lead pipeline labeling       | Rule   | Recommended       |
| Aggregate option keys        | Convention | Recommended   |
| Ask → Agent for rules        | Skill/rule | Recommended   |
| Debug mode behavior           | Rule   | Optional          |
