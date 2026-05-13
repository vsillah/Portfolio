# Google Cloud Project Suspension Incident - 2026-05-13

## Status

- **Incident state:** Appeal submitted; remediation blocked by suspended project access.
- **Project impacted:** AmaduTown Advisory Solutions (`amadutown-advisory-solutions`)
- **Reported by:** Google Cloud suspension notice and Google Cloud Console appeal page.
- **Google classification:** Abusive activity consistent with hijacking.
- **Likely category:** Published, harvested, or insufficiently restricted service account credentials or API keys.

## Known Facts

- Google suspended the Google Cloud project `amadutown-advisory-solutions`.
- The Google Cloud Console appeal page said the project may have published affected service account credentials or API keys on public sources or websites, where a third party harvested them to initiate resources in the project.
- The appeal was submitted on 2026-05-13.
- The appeal stated that AmaduTown Advisory Solutions did not authorize abusive activity, unauthorized resource creation, hijacking behavior, or third-party use of the project.
- The current blocker is lack of access to the affected credential values and suspended project resources.

## Local Portfolio Evidence

Read-only local checks were run against Portfolio and nearby project files.

- No local reference to `amadutown-advisory-solutions` was found in Portfolio during the initial scan.
- Portfolio has Google-related integration surfaces that should be reviewed before any resumed production use:
  - `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`
  - `GEMINI_API_KEY`
  - `GOOGLE_DRIVE_SCRIPTS_FOLDER_ID`
  - `GOOGLE_SERVICE_ACCOUNT_KEY`
  - Gmail OAuth client variables documented in env examples and app code.
- The local `GOOGLE_SERVICE_ACCOUNT_KEY` in Portfolio `.env.local` parsed as project `my-portfolio-483603`, not `amadutown-advisory-solutions`.
- `gcloud` was not available in the local shell, so direct Cloud project inspection was not performed from the terminal.

Do not treat local `.env` files as credential source of truth. Portfolio's credential management docs define 1Password and Infisical as sources of truth, while `.env.local`, Vercel, n8n, and other runtime stores are sinks.

## Appeal Summary

The submitted appeal should be treated as a request for reinstatement or enough restricted access to remediate. It did not claim credential rotation or resource deletion was complete.

Key appeal posture:

- Possible credential compromise.
- Activity was not intentional.
- Current access is insufficient to confirm and rotate every impacted credential directly.
- Requested Google details about affected credential, service account, API key, resource, or activity.
- Committed remediation plan once access is restored.

## Immediate Actions While Access Is Suspended

- Preserve the Google Cloud suspension email, headers if available, and screenshots of the appeal page.
- Audit non-Google locations for exposed Google credentials:
  - GitHub repositories.
  - Vercel environment variables.
  - n8n variables and credentials.
  - local ignored `.env` files.
  - downloads folders and shared folders.
  - Google Drive folders where service account JSON files may have been uploaded.
- Confirm whether the suspended project has any historical ownership records, billing account records, OAuth consent screen records, API key records, or service account JSON files in 1Password or Infisical.
- Do not create replacement production Google credentials in another project until the compromised project is understood, unless an outage requires a separate emergency migration and Vambah approves it.

## Reinstatement Runbook

When Google restores access, perform these steps before resuming normal use.

1. Review IAM principals and remove unknown, unnecessary, or over-broad access.
2. Review service accounts and delete or disable unknown service accounts.
3. Rotate or delete all service account keys in the impacted project.
4. Regenerate API keys that may have been compromised.
5. Restrict remaining API keys by API and by application restriction, such as HTTP referrer, IP address, Android app, or iOS app.
6. Reset OAuth client secrets if the project has OAuth clients.
7. Revoke local Application Default Credentials and stale Google Cloud CLI credentials for users connected to the incident.
8. Delete unauthorized resources, especially Compute Engine VMs, App Engine apps, Cloud Storage buckets, and any unexpected service-created resources.
9. Review Cloud Audit Logs, Security Command Center findings if available, API usage, and billing usage for the compromise window.
10. Re-sync approved replacement credentials from source of truth into runtime sinks.
11. Run Portfolio credential smoke checks and any affected workflow smoke tests.

## Portfolio Validation After Rotation

Use the existing Portfolio credential governance flow after replacement credentials are available.

```bash
npm run credentials:report -- --env staging
npm run credentials:report -- --env prod
npm run credentials:smoke -- --env staging
```

If provider access is configured:

```bash
npm run credentials:smoke -- --env staging --require-provider-access
```

Affected Portfolio areas to verify:

- Google Drive script sync.
- Google Places checkout address autocomplete.
- Gemini/n8n social content workflows.
- Gmail OAuth draft flow if enabled.
- Vercel runtime env propagation after redeploy.
- n8n variables and credentials after sync.

## Decision Gates

- **Production credential rotation:** Requires approval before changing production runtime sinks or revoking credentials that may affect live workflows.
- **Emergency migration to a new Google Cloud project:** Requires approval because it may bypass evidence collection and create long-term cleanup risk.
- **Deleting suspicious resources:** Approved once verified as unauthorized; preserve enough evidence for the incident record before deletion when practical.
- **Restoring normal automation:** Blocked until credentials are rotated/restricted and affected workflows pass smoke checks.

## External References

- Google Cloud: Handle compromised Google Cloud credentials - https://docs.cloud.google.com/docs/security/compromised-credentials
- Google Cloud: Respond to abuse notifications and warnings - https://cloud.google.com/docs/security/respond-to-abuse-misuse
- Google Cloud: Project suspension guidelines - https://cloud.google.com/resource-manager/docs/project-suspension-guidelines

