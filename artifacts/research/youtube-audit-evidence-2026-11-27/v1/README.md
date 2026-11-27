# YouTube audit evidence package v1 — review only

**Frozen source base:** `a9c4ea9f0cf2f7cf3454a89e569ee3f748d68585`. **Captured:** 2026-11-27 UTC. **Project:** `amadutown-advisory-solutions` / `329708734708`. **One client:** Portfolio. No file in this directory was uploaded to YouTube or Google, and no form answer, amendment, or attestation was submitted or accepted. The [manifest](manifest.json) binds every evidence file by SHA-256; Git binds the manifest itself. A change requires a new package version.

The current [Audit and Quota Extension Form](https://support.google.com/youtube/contact/yt_api_form?hl=en) asks for three core documents: privacy screenshots (PNG/JPEG), a homepage screenshot showing both the privacy link and YouTube branding (PNG/JPEG), and Terms documentation (PNG/JPEG/PDF). With OAuth, video uploading, an internal tool, and analytics selected, it also requests conditional OAuth, upload-interface, and dashboard evidence. Static UI evidence alone does not satisfy its upload/internal-tool request: the form asks for a complete working upload script or end-to-end screencast through the final video live on YouTube. This package makes no claim to have met that last requirement.

## Included evidence and exact form mapping

| File | Form field | Status and limit |
| --- | --- | --- |
| `privacy-policy-public-route.jpg` | §5 Privacy Policy Screenshots | Captured from `https://amadutown.com/legal/privacy`; includes YouTube metadata, Google Privacy Policy and deletion links, and 30-day text. **Candidate only:** browser capture did not include the address bar. |
| `data-deletion-public-route.jpg` | §5 Privacy Policy Screenshots supplement | Captured from `https://amadutown.com/legal/data-deletion`; shows the public request route. It proves route copy, not live purge. **Candidate only:** no browser address bar. |
| `terms-of-service-public-route.jpg` | §5 Terms of Service Documentation | Full public Terms page from `https://amadutown.com/legal/terms`, in accepted JPEG format. Owner must confirm the current route before any upload. |
| `architecture.mmd` | §6 supporting architecture | Source-bound Mermaid diagram. Review artifact; render to an accepted format only after owner review. |
| `user-flow.mmd` | §6 user flow | Source-bound Mermaid diagram. Provider outcome is shown as a gated future step, not accomplished evidence. |
| `conditional-evidence.md` | §5 OAuth / upload / dashboard conditional evidence | Source inventory and capture plan. **Not screenshots.** No consent screen, revocation UI, private dashboard, or upload screenshot is represented as captured. |
| `screencast-candidate.md` | §5 conditional upload proof / §6 other supporting materials | Reproducible recording script. Stops before provider upload. **Does not satisfy the live YouTube outcome requirement.** |

## Explicit evidence gaps

1. The rendered `https://amadutown.com/` homepage has no `a[href="/legal/privacy"]` and no YouTube text/branding in the inspected DOM. The separate public `/personal` route has videos but no privacy link. A composite or relabeled route would misrepresent the form's homepage requirement. This field remains **missing**, not upload-ready.
2. The browser's content-only screenshot API omitted the address bar. The two legal captures therefore do not satisfy the requested address-bar proof. Capture it later using a privacy-safe browser/window method, with unrelated tabs and account identifiers excluded.
3. The authenticated admin route, Google OAuth consent, granted-scope screen, account revocation, upload interface, and internal dashboard were not captured. A current, approved synthetic account/fixture and owner-controlled consent/revocation access are required. No credential or OAuth state belongs in this package.
4. A live end-to-end screencast through an uploaded YouTube video would create a provider write and possible publication. It is outside this review-only authority. A complete working script that actually uploads would also violate this lane's execution lock. The script here is a safe shot list and stop point.
5. The current Terms page describes Portfolio publishing but has no YouTube-specific section. The owner must decide whether the existing Terms are accurate and sufficient; this packet does not amend them.

## Provenance, privacy, and rollback

The three JPEGs are full-page captures of public production routes. Only the top-right signed-in account badge was covered with a solid rectangle; page text and links were not altered. The browser address bar was never present in the captured pixels. No private dashboard data, account credentials, token, client ID, raw provider response, creator cohort, or customer record is included. Public route content is owned Portfolio material; the conditional ledger and diagrams quote only repository behavior. The owner must review rights and final screenshot suitability before any provider upload.

Production legal deployment `dpl_EunLzGy1LzjFjJz4dbip3tjYWvY7` was previously verified for the privacy/deletion pages from `90e567a5f683ed7d7b3e984c36a820b40c9a9d13`; this package recaptured the live routes and rechecked source hashes at the frozen base. Rollback is a repository revert of this evidence-only directory. There is no migration, runtime flag, credential, provider configuration, production row, calendar count, policy receipt, or external action to undo.

**Submission gate:** keep the audit form unsubmitted. Before owner action, recapture the missing required evidence, verify each source and hash, resolve the live outcome requirement under a separately authorized provider-action plan, and have Vambah review every answer, amendment, and attestation on the live form. No existing form state is modified by this package.
