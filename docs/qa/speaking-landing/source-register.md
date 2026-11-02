# Speaking landing page source register

## Selected public-page assets

| Asset | Origin | Use | Attribution / boundary |
| --- | --- | --- | --- |
| `public/speaking/vambah-profile.jpg` | `/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/2. AmaduTown Advisory Solutions/Artifacts /Company Materials/Profile Photo.jpg` | Hero portrait | Company Materials profile photo; no claim that this depicts a speaking event. Copied into this worktree. |
| `public/amadutown-logo-upscaled.png` | Existing Portfolio brand asset | Header mark | Natural portrait ratio preserved. |
| `public/The_Equity_Code_Cover.webp` | Existing Portfolio public book cover | Proof/media section | Cover shown as an authored work, without sales or reception claims. |
| `public/accelerated_cover_ebook.webp` | Existing Portfolio public book cover | Proof/media section | Cover shown as an authored work, without sales or reception claims. |
| `public/agentified-cover.jpg` | Existing Portfolio public book cover, bound by `lib/agentified-publication.ts` | Proof/media section | Canonical public `Agentified` title and cover; shown as an authored work, without sales or reception claims. |

## Publication entry copy and retailer actions

| Book | Description source | Retail action source | Boundary |
| --- | --- | --- | --- |
| The Equity Code | [Apple Books publisher description](https://books.apple.com/gb/book/the-equity-code-cracking-the-secrets/id6755512566) identifies five dimensions of digital inequality; page copy is a short paraphrase. | [Amazon product page](https://www.amazon.com/dp/B0G3J98KY8) identifies the book and Vambah K Sillah. | Direct product URL verified; no sales or review claim. The older `https://a.co/d/bVCvCyT` fallback in `components/Publications.tsx` returned 404 during this review and is not reused. |
| Accelerated | [Apple Books publisher description](https://books.apple.com/gb/book/accelerated-building-smarter-products-with-ai/id6759681729) describes practical AI product work and Sam's product-management journey; page copy is a short paraphrase. | [Apple Books book page](https://books.apple.com/gb/book/accelerated-building-smarter-products-with-ai/id6759681729). | No direct Amazon product URL was verified from Portfolio or an attributable Amazon page, so no Amazon action is shown. |
| Agentified | Portfolio canonical public description in `lib/agentified-publication.ts`; [Apple Books publisher description](https://books.apple.com/gb/book/agentified/id6790017665) corroborates the subject. | Portfolio canonical `amazonPaperbackUrl` in `lib/agentified-publication.ts` (`https://www.amazon.com/dp/B0H9Z44FVF`), recorded there as KDP-confirmed. | Title, cover, description, and Amazon URL read from the existing publication record. |

## Copy and route evidence

- Voice and topic framing: Portfolio `docs/vambah-personality-public-safe.md`, `docs/linkedin-voice.md`, and the local personality corpus's public-safe summaries. Private export material informed tone only; no private passage was quoted.
- The production catalog binding supplied in the development brief is service ID `a278e803-9328-490b-bf57-8fbee7d129ee` (`Speaking Engagement`, one-hour in-person, currently $5,000). This implementation reads the existing public service route and does not mutate catalog data.
- `https://ericajordanthomas.com/` was reviewed for its progression from speaker introduction to work, media, and invitation. No text, layout, branding, imagery, or proof was reused.
- Drive Company Materials and Portfolio `public`, `docs`, and `design-files` were searched. No attributable stage footage, event testimonial, audience count, or client logo was selected. The page makes no such claim.

## Review boundary

The Speaker Fit Brief is deterministic browser-side guidance. It sends nothing to a provider or email service. The service link holds four allowlisted choices in URL query parameters so the public service page can display the brief; it does not automatically submit an inquiry or preserve those choices through checkout.
