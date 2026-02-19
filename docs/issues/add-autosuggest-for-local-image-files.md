# Add autosuggest for local files in Image field

## TL;DR

Add autosuggest/autocomplete for files in the `public/` folder when the Image field is set to **Local (/public/)** on the product edit form. User types, gets dropdown of matching files; selecting fills the input.

## Current state

- Image field in Local mode is a plain text input
- User must type filename manually (e.g. `Chatbot_N8N_img.png`) with no suggestions
- No programmatic list of files in `public/`

## Expected outcome

- As user types in Local mode, show dropdown of matching paths from `public/`
- Selecting a suggestion fills the input
- External URL mode remains unchanged (no autosuggest)

## Relevant files

- `app/admin/content/products/[id]/page.tsx` — Product edit form with Image field and Local/External toggle
- **New:** `app/api/admin/files/public/route.ts` (or similar) — API route to list files in `public/` (admin-only)
- **Optional:** Shared autocomplete component if reusable elsewhere

## Implementation approach

1. **API route** — Admin-only GET endpoint that lists files under `public/` (e.g. `fs.readdir`), scoped to image extensions or all static assets
2. **Autocomplete UI** — Fetch list on mount or when switching to Local; filter as user types; fill input on select. Could use native `<datalist>` for simplicity or a custom combobox for richer UX
3. **Integration** — Only wire autosuggest when `imageSource === 'local'`

## Risks / notes

- Ensure API restricts to `public/` path (no traversal)
- Static/edge deployments may not support filesystem read—need Node API route
- Consider caching the file list to avoid repeated disk reads

## Labels

- **Type:** feature
- **Priority:** normal
- **Effort:** medium
