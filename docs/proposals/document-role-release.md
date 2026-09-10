# Native document roles — release review required

Prepared on `codex/native-proposal-document-roles` from merged #965 (`b145e1fd`). No hosted migration, upload, signature, send, provider operation, deployment, or merge was performed. Held #964 is excluded. This is a security-sensitive draft for captain/human review.

## Behavior and scope

The existing Sales conversation **Proposal & documents → Attach report or document** modal offers supporting attachment, primary proposal PDF, and reviewed customer agreement PDF. Type remains available for supporting attachments; primary maps to `proposal_package`, agreement to `other`. The separate binding role determines signing behavior. A successful save shows a receipt; Done refreshes the existing drawer. Historical upload replay says it is history rather than claiming it replaced the current primary. Primary/agreement history cannot be deleted. Titles use the full content row on mobile.

Primary/agreement binding requires an unissued, unviewed, unsigned draft with no payment state. The server validates admin authorization before reads/uploads, UUID targets, title, role/type, size up to 10 MB, PDF magic bytes and actual unencrypted PDF parsing. It never fetches a remote URL. Ordinary attachment selection remains available; legacy callers may omit request identity for supporting uploads, but only updated clients get retry deduplication. Invalid document types now return 400 rather than silently falling back to Other.

## Migration and public signing contract

CLI-generated migration: `supabase/migrations/20260910112415_native_proposal_document_consistency.sql`.

- Adds `proposals.document_revision` and document `binding_role`/`content_sha256`; existing documents default to supporting. No new table, ledger, identity, customer, payment, or project model.
- Service-role-only, SECURITY INVOKER helpers with empty `search_path` lock the proposal row for bind, sign, and supporting deletion. PUBLIC, anon, and authenticated EXECUTE is revoked explicitly. Existing table privileges/RLS remain unchanged.
- Document UUID is the request identity. Exact retry returns the original record, including whether it remains current; changed content/metadata using that identity conflicts. Storage paths are unique and immutable per upload attempt.
- Proposal revision advances on relevant document, terms, items, price, client, or expiry changes. Relevant content changes after either signature and overwriting existing signatures are rejected. Payment/status/timestamp updates continue to work. No signature evidence is cleared.
- Both existing signing endpoints now require `document_identity: {revision, pdf_url, contract_pdf_url}` from readback. Those are stable stored references, not expiring read URLs. Old tabs/API callers lacking identity get 409 with a reload instruction. The updated public page supplies it and exposes Reload documents. Contract signing requires the proposal signature first. Exact same-name replay preserves the first signature; a different signer conflicts.
- Old issued URLs continue to work. New `storage:documents/…` bindings get temporary signed read URLs only at readback, never persisted. Newly bound unissued documents are excluded from existing public read routes before viewed-state mutation, and cannot be signed until issued. The broader legacy public UUID/capability model is unchanged and remains a separate security concern.

## Failure semantics

Missing migration columns/RPCs fail closed: upload preflight or signing returns service unavailable without fallback writes. A definitive RPC transaction rejection permits removal of that attempt's unique object. An ambiguous response retains bytes rather than risking deletion of a committed document; retry uses the same request ID. A replay removes only its new redundant attempt, never the canonical object. Storage cleanup failures are returned as `cleanup_pending`.

A lost response that never committed can leave an unreferenced immutable object; this slice deliberately has no background cleanup service. Any orphan cleanup must first compare Storage paths with document records and both proposal references. Do not blindly delete objects after a timeout. API authorization and SQL correctness do not make Storage and Postgres one distributed transaction.

## Validation and compatibility sweep

- 27 checks using real PostgreSQL 17 in a dedicated network-disabled Docker container, synthetic schema/rows only: bind/sign lock orders, competing signatures, bind/delete ordering, exact and historical replay, rollback, null/locked states, legacy URL retention, post-sign content immutability, and helper privilege inspection. The fixture mirrors relevant columns and exercises the actual migration; it is not a full production RLS or schema-parity test.
- 63 focused route/component/readback tests passed across 12 files. Tests cover supporting/primary/agreement uploads, unauthorized/invalid/locked requests, missing migration, definite/ambiguous failure and cleanup, same-request retry, pending double-click protection, historical receipts, public signing reload, and private URL identity separation.
- Compatibility surfaces: native conversation drawer; public by-code and UUID readback; public signing page; admin Client Experience resolver; existing dashboard document assembly including retained history. The admin resolver now resolves private references. Dashboard code is unchanged and its storage-path signing behavior is regression-tested. No payment/provisioning execution was tested or changed.
- Actual local conversation route with all API writes intercepted and synthetic PDF bytes, at 360/390/768/1440. Role selection, ordinary type, upload, same-request retry/reload, completed receipt/Done, document read link, supporting deletion, locked role options and Cancel exercised. The attachment overlay was fixed above the existing drawer. Public signing-page QA is local-only with non-real IDs/codes and fully intercepted API responses; no real public proposal endpoint was called.
- Desktop/mobile MP4s and screenshots: ignored `local-private/document-roles/` and `local-private/document-roles/mobile/`. Receipts distinguish mocked writes from real requests and record `externalRequests: []`; attempted existing analytics requests are blocked separately.
- Full typecheck remains blocked by existing duplicate properties in `lib/social-comment-inbox-ui.test.ts` and the preserved ignored legacy staged renderer. No new product type errors were observed. No full production build, hosted smoke, production RLS test, or live provider workflow is claimed.

Reproduce focused checks with the explicit file list in the PR. SQL harness: `node scripts/qa/proposal-document-sql.cjs` against its dedicated test container only. UI: `node scripts/qa/proposal-document-roles.cjs`, with `QA_MOBILE=true` or `QA_SCREENSHOTS=true` as needed. Use localhost and synthetic provider configuration; never point this harness at a hosted deployment.

## Release order and rollback gate

1. Review and approve the exact migration, helper grants, signing contract, content immutability, and unissued-private-document gate. This draft provides no authority to apply it.
2. Captain validates schema compatibility and helper permissions in the separately approved environment. Apply migration before application deployment; it is wrapped in one SQL transaction. It must not be partially installed.
3. Deploy the matching readback, upload, signing and client code together. Existing open tabs must reload. Verify both `Vercel – portfolio` and `Vercel – portfolio-staging`, then controlled synthetic smoke under separate authority.
4. If migration is absent, leave writes/signing unavailable; never bypass the RPCs. Before any new-role binding has occurred, the migration can be reverted after application compatibility is restored and evidence retained.
5. After any `storage:` bindings exist, **do not blindly revert to the old application or drop the new columns/helpers**: old consumers cannot resolve those references, and older signing writes lack the guards. Roll back the UI entry point while retaining compatible readback and consistency enforcement, or prepare a reviewed forward fix. Preserve all role history, objects, revisions and signatures. A data-dependent rollback plan needs a fresh scoped review; none is applied here.

Human review is required before release. Two milestone payments, issuance, emails, checkout, dashboards, and project provisioning remain outside this phase.

Local SQL runtime used (existing installed image; no ports or network):

```sh
docker run --rm -d --name codex-proposal-sql-01a0896e --network none --user postgres --entrypoint /bin/bash public.ecr.aws/supabase/postgres:17.6.1.106 -c 'initdb -D /tmp/proposal-pg --auth=trust >/tmp/init.log && postgres -D /tmp/proposal-pg -k /tmp'
node scripts/qa/proposal-document-sql.cjs
docker stop codex-proposal-sql-01a0896e
```

The SQL harness refuses a different container name or enabled networking before resetting its synthetic schema. Final MP4s decode successfully with FFmpeg: desktop 34.28 seconds, mobile 31.84 seconds; the separate mobile signature-conflict clip is 16.84 seconds. Changed-file ESLint and git diff --check passed.

## Captain review corrections

Reordering uses the same enriched readback as GET: binding/current/history roles, signed links and deletion eligibility survive Move up/down. Each document carries `can_delete` and a disabled reason matching the existing SQL helper; missing metadata disables removal. Supporting attachments are deliberately not removable after issuance, viewing or signing (or other SQL-locked states), while unreferenced supporting attachments on eligible drafts remain removable. Stale delete conflicts keep inline feedback and Reload documents. No SQL restriction was relaxed.

Signing conflict feedback is directly below the initiating proposal/contract action, receives focus and scrolls into view. Reload clears both signer-name inputs and closes both signing forms before a fresh review. There are no separate consent-checkbox states on this existing page. The global banner no longer duplicates signing conflict feedback.

Updated native-route screenshots at 360/390/768/1440 and desktop/mobile MP4s exercise reordering after binding, retained metadata, successful supporting deletion, a simulated stale 409, reload and disabled supporting removal. `scripts/qa/proposal-signature-conflict.cjs` separately tests both signing locations at all four widths plus a mobile MP4, using fully intercepted synthetic public-page calls. Accept/checkout/provider writes are prohibited by the harness. Evidence is in ignored `local-private/document-roles/signature-conflict/`; no live signatures or public reads occurred.
