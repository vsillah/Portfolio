# Admin Page UX Structure

Use this rule when creating or materially expanding Portfolio admin pages.

## Default Structure

- Start with the smallest useful working surface. Use tabs for major workflows so only one primary area is open at a time.
- Put secondary, setup, provenance, and long review context behind expand/collapse panels.
- Turn explanatory copy into tooltips or short helper labels when the text does not require constant reading.
- Keep status and approval gates close to the section, row, or item they control.
- Preserve traceability through links, expandable detail, and source metadata without forcing every source note into the default viewport.

## Lists And Results

- Use searchable, sortable, filterable, paginated tables for result sets that can grow beyond a handful of items.
- Use cards for summary metrics, short action panels, repeated visual assets, and mobile-friendly item detail.
- Avoid long stacks of repeated cards for scan-and-compare workflows unless the data is explicitly visual.
- Keep empty states short and actionable.

## Approval And Side Effects

- External side effects must remain explicit: publishing, scheduling, uploads, provider generation, paid scraping, and production mutation need their own visible gate.
- Do not hide a required human decision inside another button action.
- If a section can reject or return work for revision, show the decision note in that same section and make the resulting status visible there.

## Mobile And Readability

- Design compactly enough that the first viewport shows the page purpose, section navigation, and the first active action.
- Avoid repeating the same explanatory paragraph in multiple sections.
- Prevent horizontal overflow except inside intentional table scroll containers.
- Use stable dimensions for controls, status pills, and tab labels so data changes do not shift the page.
