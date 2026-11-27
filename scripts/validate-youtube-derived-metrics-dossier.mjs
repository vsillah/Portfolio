import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const SHA = /^[a-f0-9]{64}$/;
const PROJECT = "amadutown-advisory-solutions";
const LOCKS = [
  "audit_submission_enabled",
  "terms_acceptance_enabled",
  "policy_activation_enabled",
  "evidence_linkage_enabled",
  "scoring_enabled",
  "persistence_enabled",
  "live_collection_enabled",
  "provider_contact_enabled",
  "notification_enabled",
  "media_generation_enabled",
  "upload_enabled",
  "schedule_enabled",
  "publish_enabled",
  "production_mutation_enabled",
  "external_actions_enabled",
];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function validateDossier(candidate, root = process.cwd()) {
  const blockers = [];
  const add = (condition, message) => {
    if (!condition) blockers.push(message);
  };
  add(
    candidate?.version === "youtube-derived-metrics-compliance-dossier/v1",
    "Dossier version is unsupported.",
  );
  add(
    candidate?.status === "review_only_incomplete",
    "Dossier must remain review-only and incomplete.",
  );
  add(
    candidate?.google_cloud_project_id === PROJECT,
    "Google Cloud project binding differs.",
  );
  add(
    candidate?.oauth_client?.exact_client_id_sha256 === null &&
      candidate?.oauth_client?.project_match_verified_for_submission === false,
    "Unverified client identity was promoted.",
  );
  add(
    candidate?.oauth_client?.credential_material_in_packet === false,
    "Credential material must not enter the packet.",
  );
  add(
    candidate?.requested_use_case?.form_category === "Analytics & Reporting",
    "Derived-metrics request category differs.",
  );
  add(
    candidate?.requested_use_case?.public_distribution_of_creator_metrics ===
      false,
    "Public creator-metric distribution was enabled.",
  );
  add(
    candidate?.requested_use_case?.cross_platform_normalization === false,
    "Cross-platform normalization was enabled.",
  );
  add(
    candidate?.requested_use_case
      ?.minimum_same_channel_same_format_comparables >= 5,
    "Comparable minimum was weakened.",
  );
  const normalized = candidate?.requested_use_case?.calculations?.find(
    (entry) => entry?.name === "normalized_performance_score",
  );
  add(
    normalized?.youtube_metric === false && normalized?.enabled === false,
    "Portfolio score was presented as YouTube data or enabled.",
  );
  add(
    candidate?.retention
      ?.current_non_authorized_delete_or_refresh_ceiling_days === 30,
    "Current delete-or-refresh ceiling differs.",
  );
  add(
    candidate?.retention?.requested_extended_retention_days === null &&
      candidate?.retention?.extended_retention_basis === null,
    "Extended retention was inferred.",
  );
  add(
    candidate?.privacy_notice_candidate?.pull_request === 1348 &&
      candidate?.privacy_notice_candidate?.merged === false &&
      candidate?.privacy_notice_candidate?.deployed === false,
    "Draft privacy notice was presented as deployed.",
  );
  add(
    Array.isArray(candidate?.blockers) && candidate.blockers.length > 0,
    "Incomplete dossier lost its blockers.",
  );
  for (const key of LOCKS)
    add(
      candidate?.locks?.[key] === false,
      `Protected lock ${key} is not false.`,
    );
  add(
    candidate?.rollback?.production_records_unchanged === true &&
      candidate?.rollback?.provider_state_unchanged === true &&
      candidate?.rollback?.credentials_unchanged === true,
    "Rollback invariants changed.",
  );
  for (const source of candidate?.source_register ?? []) {
    add(
      typeof source?.url === "string" && source.url.startsWith("https://"),
      "Source URL is missing or non-HTTPS.",
    );
    add(
      SHA.test(source?.response_sha256 ?? ""),
      `Source hash is missing for ${source?.url ?? "unknown source"}.`,
    );
  }
  for (const [path, expected] of Object.entries(
    candidate?.api_client?.runtime_source_sha256 ?? {},
  )) {
    const bytes = readFileSync(resolve(root, path));
    add(sha(bytes) === expected, `Runtime source changed: ${path}.`);
  }
  const policy = candidate?.inactive_source_policy;
  if (policy?.path)
    add(
      sha(readFileSync(resolve(root, policy.path))) === policy.sha256,
      "Inactive source policy changed.",
    );
  return {
    status: blockers.length ? "blocked" : "review_only_incomplete",
    blockers,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const candidatePath = resolve(
    process.argv[2] ??
      "artifacts/research/youtube-derived-metrics-compliance-dossier-2026-11-27/application-candidate.json",
  );
  const result = validateDossier(
    JSON.parse(readFileSync(candidatePath, "utf8")),
    process.cwd(),
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.blockers.length) process.exitCode = 1;
}
