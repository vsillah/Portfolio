"""Synthetic-only checks for the disconnected lifetime shadow constructor."""

import ast
import json
import socket
import sqlite3
import sys
import unittest
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
from linkedin_owner_export_review import Inspection, ParsedRow
from linkedin_lifetime_cohort_shadow import Authority, CandidatePolicy, PolicyApproval, construct_shadow


SOURCE = "a" * 64
SCHEMA = "b" * 64
POLICY = CandidatePolicy("synthetic", 14, 15, 60)


def fixture(count=6):
    rows = tuple(ParsedRow(n + 2, f"urn:li:share:{n + 100}", "share", "2026-10-20",
                           "image", n + 1, ()) for n in range(count))
    return Inspection(SOURCE, SCHEMA, rows, ())


def authority(rows, **changes):
    values = dict(source_sha256=SOURCE, schema_sha256=SCHEMA,
                  observation_day=date(2026, 11, 28), observation_day_verified=True,
                  account_id="synthetic-member", account_verified=True,
                  metric_definition_verified=True, provenance_approved=True,
                  privacy_approved=True, rights_approved=True,
                  owning_policy_approval_verified=True, deletion_and_refresh_approved=True,
                  policy_approval=PolicyApproval("synthetic-policy", "v1", SOURCE, SCHEMA,
                      datetime(2026, 11, 27, tzinfo=timezone.utc),
                      datetime(2026, 11, 30, tzinfo=timezone.utc), "synthetic-receipt"),
                  review_time=datetime(2026, 11, 28, tzinfo=timezone.utc),
                  age_effect_stability_verified=True, source_current=True,
                  row_decisions={row.identity: ("synthetic-member", "topic-a", "promise-a") for row in rows})
    values.update(changes)
    return Authority(**values)


class LifetimeShadowTests(unittest.TestCase):
    def test_six_valid_synthetic_rows_form_review_only_cohort(self):
        source = fixture()
        result = construct_shadow(source, authority(source.rows), POLICY)
        self.assertEqual(result.status, "Unscored")
        self.assertEqual(result.eligible_sample_size, 6)
        self.assertEqual(result.reasons, ())
        serialized = json.dumps(result.__dict__)
        self.assertNotIn("urn:li", serialized)
        self.assertNotIn("impressions", serialized)
        self.assertNotIn("2026-10-20", serialized)

    def test_five_rows_cannot_supply_five_other_comparables(self):
        source = fixture(5)
        result = construct_shadow(source, authority(source.rows), POLICY)
        self.assertEqual(result.eligible_sample_size, 0)
        self.assertTrue(any("Fewer than five" in reason for reason in result.reasons))

    def test_cross_account_topic_promise_and_format_fail_closed(self):
        source = fixture()
        for override in (
            {source.rows[0].identity: ("other-member", "topic-a", "promise-a")},
            {source.rows[0].identity: ("synthetic-member", None, "promise-a")},
            {source.rows[0].identity: ("synthetic-member", "topic-a", "promise-b")},
        ):
            with self.subTest(override=override):
                decisions = authority(source.rows).row_decisions | override
                result = construct_shadow(source, authority(source.rows, row_decisions=decisions), POLICY)
                self.assertEqual(result.eligible_sample_size, 0)
        bad = Inspection(SOURCE, SCHEMA, source.rows[:-1] +
                         (ParsedRow(7, "urn:li:share:105", "share", "2026-10-20", "text", 6, ()),), ())
        self.assertEqual(construct_shadow(bad, authority(bad.rows), POLICY).eligible_sample_size, 0)

    def test_each_authority_gate_rolls_back_to_unscored(self):
        source = fixture()
        for change in (
            {"source_sha256": "c" * 64}, {"schema_sha256": "c" * 64},
            {"observation_day_verified": False}, {"account_verified": False},
            {"metric_definition_verified": False}, {"provenance_approved": False},
            {"privacy_approved": False}, {"rights_approved": False},
            {"owning_policy_approval_verified": False}, {"deletion_and_refresh_approved": False},
            {"policy_approval": None},
            {"age_effect_stability_verified": False}, {"source_current": False},
        ):
            with self.subTest(change=change):
                result = construct_shadow(source, authority(source.rows, **change), POLICY)
                self.assertEqual(result.status, "Unscored")
                self.assertEqual(result.eligible_sample_size, 0)

    def test_day_precision_maturity_boundary_and_missing_denominator(self):
        source = fixture()
        boundary = CandidatePolicy("boundary", 39, 39, 60)
        self.assertEqual(construct_shadow(source, authority(source.rows), boundary).eligible_sample_size, 0)
        rows = source.rows[:-1] + (ParsedRow(7, "urn:li:share:105", "share", "2026-10-20", "image", None, ()),)
        missing = Inspection(SOURCE, SCHEMA, rows, ())
        result = construct_shadow(missing, authority(missing.rows), POLICY)
        self.assertEqual(result.eligible_sample_size, 0)
        self.assertTrue(any("impression" in reason for reason in result.reasons))

    def test_expired_or_mismatched_approval_rolls_back(self):
        source = fixture()
        valid = authority(source.rows).policy_approval
        assert valid is not None
        for change in (
            {"policy_approval": PolicyApproval(valid.policy_id, valid.version, "c" * 64, SCHEMA,
                                                 valid.issued_at, valid.expires_at, valid.approval_receipt)},
            {"review_time": valid.expires_at},
        ):
            with self.subTest(change=change):
                result = construct_shadow(source, authority(source.rows, **change), POLICY)
                self.assertEqual(result.eligible_sample_size, 0)
                self.assertTrue(any("expiry" in reason for reason in result.reasons))

    def test_no_side_effects_and_no_production_imports(self):
        source = fixture()
        module = Path(__file__).with_name("linkedin_lifetime_cohort_shadow.py")
        imports = [node for node in ast.walk(ast.parse(module.read_text()))
                   if isinstance(node, (ast.Import, ast.ImportFrom))]
        imported = {alias.name.split(".")[0] for node in imports for alias in node.names}
        self.assertEqual(imported, {"annotations", "dataclass", "date", "datetime", "Inspection"})
        with patch.object(socket, "socket", side_effect=AssertionError("provider/network")), \
             patch.object(sqlite3, "connect", side_effect=AssertionError("persistence")), \
             patch.object(Path, "write_text", side_effect=AssertionError("file write")), \
             patch.object(Path, "write_bytes", side_effect=AssertionError("file write")):
            result = construct_shadow(source, authority(source.rows), POLICY)
        self.assertEqual(result.status, "Unscored")
        self.assertFalse(any(hasattr(result, name) for name in
                             ("score", "receipt", "packet", "notification", "calendar", "provider_call")))


if __name__ == "__main__":
    unittest.main()
