import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateDossier } from "./validate-youtube-derived-metrics-dossier.mjs";

const root = process.cwd();
const path = resolve(
  root,
  "artifacts/research/youtube-derived-metrics-compliance-dossier-2026-11-27/application-candidate.json",
);
const candidate = () => JSON.parse(readFileSync(path, "utf8"));

describe("YouTube derived-metrics compliance dossier", () => {
  it("keeps the exact packet review-only with every protected action disabled", () => {
    const result = validateDossier(candidate(), root);
    expect(result).toEqual({ status: "review_only_incomplete", blockers: [] });
  });

  it("fails closed if scoring or submission becomes enabled", () => {
    const changed = candidate();
    changed.locks.scoring_enabled = true;
    changed.locks.audit_submission_enabled = true;
    changed.requested_use_case.calculations.at(-1).enabled = true;
    const result = validateDossier(changed, root);
    expect(result.status).toBe("blocked");
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "Portfolio score was presented as YouTube data or enabled.",
        "Protected lock scoring_enabled is not false.",
        "Protected lock audit_submission_enabled is not false.",
      ]),
    );
  });

  it("rejects invented project authority, extended retention, or unsupported live purge", () => {
    const changed = candidate();
    changed.oauth_client.exact_client_id_sha256 = "a".repeat(64);
    changed.oauth_client.project_match_verified_for_submission = true;
    changed.retention.requested_extended_retention_days = 1095;
    changed.retention.extended_retention_basis = "assumed";
    changed.privacy_notice_candidate.live_purge_verified = true;
    const result = validateDossier(changed, root);
    expect(result.status).toBe("blocked");
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "Unverified client identity was promoted.",
        "Extended retention was inferred.",
        "Production privacy/deletion evidence is unbound or live purge was claimed.",
      ]),
    );
  });

  it("rejects quota, acknowledgement, or submission promoted from the review candidate", () => {
    const changed = candidate();
    changed.audit_form_review_candidate.quota_increase_requested = true;
    changed.audit_form_review_candidate.derived_metrics_acknowledgement_accepted = true;
    changed.audit_form_review_candidate.form_submitted = true;
    expect(validateDossier(changed, root).blockers).toContain(
      "Audit form candidate asserted quota, acceptance, credentials, or submission.",
    );
  });

  it("rejects notice hash drift and a claimed live retention job", () => {
    const changed = candidate();
    changed.privacy_notice_candidate.deletion_source_sha256 = "a".repeat(64);
    changed.retention.live_enforcement_implemented = true;
    expect(validateDossier(changed, root).blockers).toEqual(expect.arrayContaining([
      "Production privacy/deletion evidence is unbound or live purge was claimed.",
      "Review-only retention design was promoted to live enforcement.",
    ]));
  });

  it("rejects an unsourced policy determination or a claimed completed form", () => {
    const changed = candidate();
    changed.current_official_policy_review.provider_determination_received = true;
    changed.submission_readiness.live_form_answers_captured = true;
    expect(validateDossier(changed, root).blockers).toEqual(expect.arrayContaining([
      "Current policy review sources or determination changed.",
      "Resolved evidence or unresolved authority gates were misclassified.",
    ]));
  });
});
