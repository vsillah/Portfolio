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

  it("rejects invented project authority, extended retention, or privacy deployment", () => {
    const changed = candidate();
    changed.oauth_client.exact_client_id_sha256 = "a".repeat(64);
    changed.oauth_client.project_match_verified_for_submission = true;
    changed.retention.requested_extended_retention_days = 1095;
    changed.retention.extended_retention_basis = "assumed";
    changed.privacy_notice_candidate.merged = true;
    changed.privacy_notice_candidate.deployed = true;
    const result = validateDossier(changed, root);
    expect(result.status).toBe("blocked");
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "Unverified client identity was promoted.",
        "Extended retention was inferred.",
        "Draft privacy notice was presented as deployed.",
      ]),
    );
  });
});
