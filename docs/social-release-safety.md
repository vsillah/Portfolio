# Social release safety

The final platform-submission gate is separate from copy approval. Its POST requires `expected_updated_at` from the displayed queue item. Missing/stale versions return 409 before publish-row preparation or dispatch. The gate stores a SHA256 fingerprint of the queue content, excluding its own gate and the server-maintained timestamp. Legacy final approvals require fresh review.

The dispatcher verifies that fingerprint and the existing lifecycle/provider gates, then atomically claims the queue with its original `updated_at` and status. The claim sets `rag_context.platform_submission_gate.status=submitting` and a `release_id`. Only the winning request reaches adapters. Completion uses the database-returned timestamp because the existing timestamp trigger owns the actual version.

LinkedIn additionally checks the queue claim and approved payload and atomically claims its publish row. Direct calls without the current dispatcher claim fail closed. A missing post identity, network exception, non-success post response or failed outcome persistence retains a non-retryable state. Image upload failure cannot silently drop approved media and publish text only.

The queue becomes published only when the selected provider calls and every publish-row identity confirm publication. A confirmed partial result keeps copy immutable and permits fresh final approval of untouched pending platforms only when every existing attempt is confirmed, retained provider IDs match, and the original reviewed fingerprint is intact. Asynchronous, failed or uncertain attempts retain a reconciliation lock. No automatic unlock or blind retry is provided. A saved approval followed by failed submission returns the downstream failure and current queue evidence; approval does not imply dispatch success.

## Preparation writes

`lib/social-queue-write.ts` rejects locked rows and legacy queue/child publication or schedule evidence and uses the original `updated_at` and status for each final queue write. Preparation invalidates the previous final approval and cannot inject replacement approval evidence. A stale asynchronous result returns 409 instead of overwriting a newer edit or release claim.

Version-fenced routes: create-linkedin-draft, capture-app-carousel, convert-to-carousel, prepare-avatar-video, prepare-asset-packet, review-video-redaction and calibration-revision. Legacy regenerate-audio/image routes now return authenticated 409 before database or network access; attach a reviewed asset instead. Carousel and screenshot uploads use unique per-operation paths, protecting already-reviewed bytes even when the eventual queue write loses its version check. Unattached preparation artifacts/jobs can remain after a conflict; they are not evidence of a published release.

The coordinated social UI/manual-update lane must land with these changes: send `expected_updated_at` at final approval; guard copy, reject, image and generic metadata edits; preserve server-owned final gate evidence; use queue-version CAS for calendar and non-calendar rows. No new database schema or global middleware is introduced.

## Evidence limits

Tests mock the database, storage and all providers. They verify conditional updates including server-generated timestamps, one dispatch under contention, stale/locked writers, late completion, missing configuration, ambiguous responses and persistence failures. They do not establish actual production transactions or provider delivery.

The local HeyGen completion handler updates video-job/Drive state, and workflow-complete updates extraction-run state; neither writes the Social Content queue. A captain read-only audit confirmed legacy external regeneration writes are not version-fenced, and SOC-002 bypasses final approval and the native claim. Repository regeneration routes and `triggerSocialContentPublish` therefore fail closed without an override flag. Native reviewed-asset attachment remains available. This prevents new requests from these repository entry points; it does not pause external workflows, cancel in-flight requests, or prove there are no other external callers. The captain owns the separate live pause gate. No external workflow activation or security/schema change is authorized by this implementation.


Copy approval also requires an undecided, writable draft for every source, uses original-version CAS, and inserts child publish rows with `ignoreDuplicates: true`. Existing in-flight or uncertain rows cannot be reset to pending by reapproval. Calendar copy-version and source checks from the coordinated UI lane remain in place. Child publication reads are bounded legacy-reconciliation checks, not a cross-table transaction or a replacement for the queue dispatch claim.
