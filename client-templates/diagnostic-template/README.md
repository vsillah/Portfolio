# Diagnostic Template

Client-facing diagnostic (audit) flow that captures pain points and routes to sales.

## Features

- Diagnostic conversation flow with structured questions
- Audit storage and completion webhook
- Link to sales session / proposal path
- Optional n8n integration for post-completion actions

## Template metadata

See `template.json` for `template_content_type`, `use_case`, and `dependencies`.

## Quick Start

1. Copy this folder into your project or clone the repo.
2. Run database migrations in `database/` (Supabase).
3. Configure env: `N8N_DIAGNOSTIC_COMPLETION_WEBHOOK_URL` (optional), Supabase keys.
4. See `INSTALL.md` for full install and deploy steps.

## Status

This template is extracted from the portfolio diagnostic flow. Schema and API contracts match the main app; customize prompts and questions for your use case.
