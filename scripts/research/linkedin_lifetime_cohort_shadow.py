"""Pure, review-only lifetime cohort construction for a retained owner export.

No scorer or I/O is imported here. Callers must supply independently verified
authority; an export filename, row URL, or policy-shaped dictionary is not proof.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from linkedin_owner_export_review import Inspection


@dataclass(frozen=True)
class CandidatePolicy:
    name: str
    minimum_age_days: int
    band_start_days: int
    band_end_days: int  # Inclusive; no unbounded or normalized lifetime band.


@dataclass(frozen=True)
class PolicyApproval:
    policy_id: str
    version: str
    source_sha256: str
    schema_sha256: str
    issued_at: datetime
    expires_at: datetime
    approval_receipt: str


@dataclass(frozen=True)
class Authority:
    source_sha256: str
    schema_sha256: str
    observation_day: date | None
    observation_day_verified: bool
    account_id: str | None
    account_verified: bool
    metric_definition_verified: bool
    provenance_approved: bool
    privacy_approved: bool
    rights_approved: bool
    owning_policy_approval_verified: bool
    policy_approval: PolicyApproval | None
    review_time: datetime
    deletion_and_refresh_approved: bool
    age_effect_stability_verified: bool
    source_current: bool
    # Exact entity -> (verified account, topic class, promise class).
    # All three must be independently reviewed; None means unresolved.
    row_decisions: dict[str, tuple[str | None, str | None, str | None]]


@dataclass(frozen=True)
class ShadowResult:
    candidate: str
    status: str
    eligible_sample_size: int
    unresolved_cases: int
    unsupported_change_count: int
    total_rows: int
    reasons: tuple[str, ...]
    # No metric, identity, publication date, ranking, or row-level record leaves.


def construct_shadow(inspection: Inspection, authority: Authority, policy: CandidatePolicy) -> ShadowResult:
    reasons: set[str] = set(inspection.blockers)
    if policy.minimum_age_days <= 0 or policy.band_start_days < policy.minimum_age_days \
            or policy.band_end_days < policy.band_start_days:
        reasons.add("Invalid maturity threshold or finite age band.")
    if inspection.source_sha256 != authority.source_sha256 or inspection.schema_sha256 != authority.schema_sha256:
        reasons.add("Source or schema drift.")
    if not authority.observation_day_verified or authority.observation_day is None:
        reasons.add("Exact owner-export observation date is unverified.")
    if not authority.account_verified or not authority.account_id:
        reasons.add("Same owner account is unverified.")
    if not authority.metric_definition_verified:
        reasons.add("Directly reported lifetime impression definition is unapproved.")
    if not authority.provenance_approved or not authority.privacy_approved or not authority.rights_approved:
        reasons.add("Provenance, privacy, or rights review is incomplete.")
    approval = authority.policy_approval
    if (not authority.owning_policy_approval_verified or approval is None
            or not all((approval.policy_id, approval.version, approval.approval_receipt))):
        reasons.add("Owning source-policy approval is unissued.")
    elif approval.source_sha256 != inspection.source_sha256 or approval.schema_sha256 != inspection.schema_sha256 \
            or approval.issued_at.tzinfo is None or approval.expires_at.tzinfo is None \
            or authority.review_time.tzinfo is None \
            or not (approval.issued_at <= authority.review_time < approval.expires_at):
        reasons.add("Source-policy binding or explicit expiry is invalid.")
    if not authority.deletion_and_refresh_approved or not authority.source_current:
        reasons.add("Deletion, refresh, or source-current gate is incomplete.")
    if not authority.age_effect_stability_verified:
        reasons.add("Age effects are unverified or unstable.")

    groups: dict[tuple[str, str, str], list[int]] = {}
    unresolved = 0
    for row in inspection.rows:
        row_reasons = list(row.blockers)
        decision = authority.row_decisions.get(row.identity or "")
        if row.identity is None or decision is None or not all(decision):
            row_reasons.append("Exact entity, account, topic, or promise decision is missing.")
        elif decision[0] != authority.account_id:
            row_reasons.append("Cross-account row.")
        if row.format != "image" or row.reported_impressions is None:
            row_reasons.append("Image format or directly reported impression is missing.")
        if authority.observation_day is not None and row.publication_day is not None:
            try:
                elapsed = (authority.observation_day - date.fromisoformat(row.publication_day)).days
                # Publication and observation times are unknown. Both ends of the
                # possible age interval must fit; never invent a timestamp.
                if elapsed - 1 < policy.minimum_age_days or elapsed - 1 < policy.band_start_days \
                        or elapsed + 1 > policy.band_end_days:
                    row_reasons.append("Immature, ambiguous, or outside the age band.")
            except ValueError:
                row_reasons.append("Publication day is invalid.")
        else:
            row_reasons.append("Publication or observation day is missing.")
        if row_reasons:
            unresolved += 1
            reasons.update(row_reasons)
        else:
            assert decision is not None
            groups.setdefault((decision[0], decision[1], decision[2]), []).append(row.number)

    # A target needs five OTHER distinct eligible comparables in its own group.
    eligible = sum(len(members) for members in groups.values() if len(members) >= 6)
    if eligible == 0:
        reasons.add("Fewer than five distinct same-account, image, age-band, topic, and promise comparables per target.")
    if reasons:
        eligible = 0  # No partial cohort qualifies across missing global authority.
    return ShadowResult(policy.name, "Unscored", eligible, unresolved,
                        len(inspection.rows) if reasons else 0, len(inspection.rows), tuple(sorted(reasons)))


def shadow_calibration(inspection: Inspection, authority: Authority,
                       policies: tuple[CandidatePolicy, ...]) -> tuple[ShadowResult, ...]:
    return tuple(construct_shadow(inspection, authority, policy) for policy in policies)
