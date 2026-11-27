import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const SHA = /^[a-f0-9]{64}$/;
const PROJECT = "amadutown-advisory-solutions";
const BASE = "2df663832b6b5868fc5f2dbe0a5d67b54e2f6c6b";
const PRODUCTION = "dpl_EunLzGy1LzjFjJz4dbip3tjYWvY7";
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
  add(candidate?.portfolio_commit === BASE, "Reconciliation base differs.");
  add(
    candidate?.oauth_client?.exact_client_id_sha256 === null &&
      SHA.test(candidate?.oauth_client?.owner_reported_fingerprint_sha256 ?? "") &&
      candidate?.oauth_client?.fingerprint_provenance === "owner_reported_in_review_addendum_not_independently_verified" &&
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
  add(candidate?.retention?.user_deletion_request_deadline_days === 7,
    "User deletion request deadline differs.");
  add(candidate?.retention?.review_only_design_merge_commit === BASE &&
    candidate?.retention?.review_only_design_merged === true &&
    candidate?.retention?.live_enforcement_implemented === false,
    "Review-only retention design was promoted to live enforcement.");
  add(
    candidate?.retention?.requested_extended_retention_days === null &&
      candidate?.retention?.extended_retention_basis === null,
    "Extended retention was inferred.",
  );
  add(
    candidate?.privacy_notice_candidate?.pull_request === 1348 &&
      candidate?.privacy_notice_candidate?.merged === true &&
      candidate?.privacy_notice_candidate?.deployed === true &&
      candidate?.privacy_notice_candidate?.production_source_commit === "90e567a5f683ed7d7b3e984c36a820b40c9a9d13" &&
      candidate?.privacy_notice_candidate?.production_deployment_id === PRODUCTION &&
      candidate?.privacy_notice_candidate?.deletion_request_route_rendered === true &&
      candidate?.privacy_notice_candidate?.live_purge_verified === false &&
      sha(readFileSync(resolve(root, "app/legal/privacy/page.tsx"))) === candidate?.privacy_notice_candidate?.privacy_source_sha256 &&
      sha(readFileSync(resolve(root, "app/legal/data-deletion/page.tsx"))) === candidate?.privacy_notice_candidate?.deletion_source_sha256,
    "Production privacy/deletion evidence is unbound or live purge was claimed.",
  );
  add(candidate?.submission_readiness?.whole_client_scope_inventory === true &&
    candidate?.submission_readiness?.privacy_notice_deployed === true &&
    candidate?.submission_readiness?.deletion_route_smoked === true &&
    candidate?.submission_readiness?.synthetic_demo_ready === true &&
    candidate?.submission_readiness?.retention_design_merged === true &&
    candidate?.submission_readiness?.live_deletion_execution_verified === false &&
    candidate?.submission_readiness?.derived_metrics_authority_accepted === false &&
    candidate?.submission_readiness?.privacy_and_rights_receipts_issued === false &&
    candidate?.submission_readiness?.live_form_answers_captured === false &&
    candidate?.submission_readiness?.owner_approved_exact_packet === false,
    "Resolved evidence or unresolved authority gates were misclassified.");
  const form = candidate?.audit_form_review_candidate;
  add(candidate?.current_official_policy_review?.retrieval === "read_only_rendered_official_pages_no_new_response_byte_hash_claim" &&
    candidate?.current_official_policy_review?.provider_determination_received === false &&
    JSON.stringify(candidate?.current_official_policy_review?.urls) === JSON.stringify([
      "https://support.google.com/youtube/contact/yt_api_form?hl=en",
      "https://developers.google.com/youtube/data/guides/quota_and_compliance_audits",
      "https://developers.google.com/youtube/terms/developer-policies",
      "https://developers.google.com/youtube/terms/derived-metrics-policy",
    ]), "Current policy review sources or determination changed.");
  add(form?.official_form_url === "https://support.google.com/youtube/contact/yt_api_form?hl=en" &&
    form?.request_type_interpretation === "Complete a compliance audit to request for additional quota" &&
    form?.request_type_basis === "non_reaudit_path_for_derived_metrics_review_only_not_a_submitted_answer" &&
    form?.project_quota_selection_interpretation === "No change / Default quota (10k quota points)" &&
    form?.quota_increase_requested === false &&
    form?.project_number === null &&
    form?.expected_api_usage_volume === null &&
    form?.derived_metrics_acknowledgement_accepted === false &&
    form?.all_attestations_accepted === false &&
    form?.demo_credentials_in_packet === false &&
    form?.owner_review_workbook === "artifacts/research/youtube-derived-metrics-compliance-dossier-2026-11-27/owner-review-audit-workbook.md" &&
    form?.form_submitted === false,
    "Audit form candidate asserted quota, acceptance, credentials, or submission.");
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
