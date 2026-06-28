# Accelerated Course B-Roll Capture List

Use this list to capture proof clips and screenshots after human approval. Prefer demo or seed data for admin screens. Blur or crop any private records, emails, raw Chronicle notes, client names, account IDs, tokens, or internal-only rows.

## Primary Routes

| Proof Moment | Route / Source | Use In Modules | Capture Type | Privacy Notes |
| --- | --- | --- | --- | --- |
| Accelerated as a public product | `/`, publication card, store/ebook surface | 0, 1 | Screenshot and slow scroll | Public-safe if the page uses published product copy. |
| Public site vs. operating layer | `/`, `/admin` | 1 | Split-screen or two short clips | Admin side must use sanitized rows or cropped dashboard cards. |
| Diagnostic intake | `/tools/audit` | 2, 7 | Click-through or slow scroll | Public-safe; avoid submitting real personal data. |
| Value Evidence Pipeline | `/admin/value-evidence` | 3, 5 | Dashboard clip | Use seed/demo rows; blur real companies or people. |
| Module Sync | `/admin/module-sync` | 4, 6 | Table interaction clip | Repo names are generally safe, but crop tokens, branches, and private URLs if visible. |
| Chat Eval | `/admin/chat-eval` | 4, 6 | Review-loop clip | Use public-safe prompts only. |
| Analytics and funnel | `/admin/analytics/funnel` | 4 | Dashboard clip | Avoid exposing live customer/session identifiers. |
| Cost and revenue | `/admin/cost-revenue` | 4, 6 | Dashboard clip | Use aggregate/cropped values only. |
| n8n workflow proof | `n8n-exports/` or sanitized screenshot | 6 | Diagram or still image | Never show credentials, webhook secrets, or raw private payloads. |
| Agent Ops / campaign proof | `/admin/agents/content-intelligence`, `/admin/agents/social-insights/[id]` | 6, 7 | Workflow clip | Use the Accelerated campaign fixture or other public-safe demo data. |

## Capture Pattern

Each proof clip should answer three questions:

1. What principle is being taught?
2. What does the system do?
3. What should a product leader take from it?

Keep each clip short. The lesson should not become a product tour.

## Review Gate

Before any clip is used in a course render:

- confirm the route is public-safe or demo-data-safe,
- inspect every visible row,
- blur/crop sensitive fields,
- save original and redacted review assets separately,
- record reviewer decision in the module packet,
- and keep final export locked until the module is approved.
