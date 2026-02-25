# Troubleshoot Supabase MCP Connection

## TL;DR

Supabase MCP is configured in Cursor's `mcp.json` but is not available when invoking tools. `apply_migration` and other Supabase MCP calls fail with "MCP server does not exist: supabase."

## Current state

- **Config:** Supabase MCP is present in `~/.cursor/mcp.json`:
  ```json
  "supabase": {
    "url": "https://mcp.supabase.com/mcp?project_ref=byoriebhtbysanjhimlu",
    "headers": {}
  }
  ```
- **Behavior:** When calling `call_mcp_tool` with `server: "supabase"`, Cursor returns "MCP server does not exist"
- **Available servers:** filesystem, github, memory, brave-search, stripe, actors, n8n-mcp, n8n-cloud, docs, n8n-workflows — **supabase is not listed**
- **Impact:** Cannot run migrations (e.g. `apply_migration`) or other DB ops via MCP; must use Supabase Dashboard SQL Editor manually

## Expected outcome

- Supabase MCP appears in the available servers list
- `apply_migration` and `execute_sql` (and other Supabase tools) work when invoked via `call_mcp_tool` or equivalent
- No manual SQL Editor fallback needed for schema changes

## Relevant files / locations

- `~/.cursor/mcp.json` — Supabase MCP config
- [Supabase MCP docs](https://github.com/supabase-community/supabase-mcp) — setup, OAuth, feature groups
- [Supabase MCP connection tab](https://supabase.com/dashboard/project/byoriebhtbysanjhimlu/settings?showConnect=true&connectTab=mcp) — dashboard-based setup

## Risks / notes

- Supabase MCP uses OAuth — Cursor may require one-time login during setup; connection might have failed or never completed
- HTTP-type MCP servers (url-based) may behave differently from stdio (command-based) ones
- Cursor may load MCP from workspace-specific config; verify which config is active
- Read-only mode: if `read_only=true` is in the URL, `apply_migration` is disabled — ensure it's not set when write access is needed

## Troubleshooting steps to try

1. Restart Cursor — server may have failed to load
2. Re-add Supabase MCP from the Supabase Dashboard MCP connection tab (generates fresh config)
3. Check Cursor MCP settings / logs for Supabase connection errors
4. Compare Supabase MCP config format with working HTTP servers (e.g. Stripe) in the same `mcp.json`

## Labels

- **Type:** bug
- **Priority:** normal
- **Effort:** small
