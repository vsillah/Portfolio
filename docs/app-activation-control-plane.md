# App Activation Control Plane

Status: Phase 1 source foundation. No intake endpoint, operator console, invitation delivery, remote migration, or app integration is active.

## Purpose and ownership

Portfolio owns the reusable adult tester activation lifecycle for Trumpet Trainer and future apps. An app identifies itself with a registered `app_key` and consumes only its own grant. An interest record is not a sales lead, an invitation is not a grant, and neither interest nor consent authorizes external outreach by itself. Existing Portfolio lead and outreach systems remain separate; future intake may link provenance without silently enrolling a contact into sales automation.

Reference review: ReversR SIT's hosted commercial API and `useCommercialization` hook provide the invite, redemption, and grant pattern. Its beta intake n8n export has a webhook, Google Sheet append/update, and Gmail send node. These are reference patterns, not runtime dependencies or proof of enrollment. This design omits ReversR's app-specific plans, credits, billing, profile headers, and returned activation code. The original references remain in their own workspaces; no raw export is copied here.

## Lifecycle

1. **Interest:** Capture an adult contact email, registered app key, source reference, and a separately versioned consent decision. Do not collect child identity.
2. **Review:** A human operator moves `submitted → in_review` and then chooses `approved`, `waitlisted`, or `rejected`. A waitlisted record can return to review. Every decision needs an actor, timestamp, and audit event. Rejection is terminal in v1; a new request is required after reconsideration.
3. **Invitation:** Only an approved interest with current granted `interest_contact` consent may receive an invitation. Generate a cryptographically random token server-side, store only its SHA-256 digest, set a bounded expiry, and transmit the raw token only in the authorized delivery path. Never put it in an operator list, log, analytics event, or read model.
4. **Redemption:** An authenticated adult account must match the interest email. The private database function claims an issued, unexpired invitation by app key and digest with a conditional update. It creates one app-specific grant and audit events in the same transaction. A concurrent or repeated call returns no grant. The server must hash the supplied token and verify its authenticated caller before invoking the function; the function also checks the account email.
5. **Access:** The consuming app checks `app_key`, `auth_user_id`, `revoked_at is null`, and `expires_at > now()` for every entitlement decision. Revoking an invitation only stops an unredeemed invitation. Revoking a redeemed user's access changes the grant. An expired grant does not grant access even before an expiry sweep records its event.
6. **Audit and privacy:** Append a source/actor event for each lifecycle step and each consent version or withdrawal. Keep token material out of events. Preserve adult contact consent independently from auth identity and any child-facing profile. No child PII belongs in this control plane.

The tables are in `public` for repo schema convention, with RLS enabled and `anon`/`authenticated` privileges revoked. No client policies exist. Only a trusted server role may use the data; the redemption function is in non-exposed `activation_private` and callable only by `service_role`. Phase 2 must add explicit application authorization, rate limiting, anti-enumeration responses, operator audit, and local RLS/SQL tests before any route is exposed. The server role must never reach a client bundle.

## Source contract

`lib/app-activation.ts` is the product-neutral TypeScript domain contract. The generated migration `20261106234206_app_activation_control_plane.sql` is the local persistence contract. The SQL function is the atomic redemption boundary; the TypeScript redemption predicate is a preflight guard, not a substitute for the database claim. One unrevoked grant per app/account and one grant per invitation are enforced by indexes. Reissue after expiration requires explicit revocation or a future lifecycle design, so Phase 2 must not silently overwrite grants.

## Phase 2 implementation brief: operator review console

Build a private admin route that lists interest by app and state, shows consent version/source and a timeline, and supports review, waitlist, rejection, approval, invite issuance, and grant revocation. Require server-side admin authorization using Portfolio's current auth pattern. Every mutation must validate the lifecycle, write an audit event transactionally, and record actor/reason. Search by adult email with deliberate limits; do not show raw tokens or child identity. Invitation issuance must check current consent, use secure randomness, and return the raw token once only to an explicitly approved delivery adapter. No automatic Gmail/n8n send or sales-lead creation.

Add a separate adult-facing interest and redemption API only after privacy copy, consent version, abuse controls, response enumeration, and app-origin rules are reviewed. Use the private redemption function, then expose only an app-scoped entitlement check. Test concurrent double redemption, expired/revoked grants, role denials, cross-app reads/writes, consent withdrawal, and operator actions in a local database. Confirm the migrated schema and the complete source-to-grant path on synthetic data before proposing any hosted migration. Keep provider activation, recruitment, and any outbound invitation delivery behind explicit authorization.
