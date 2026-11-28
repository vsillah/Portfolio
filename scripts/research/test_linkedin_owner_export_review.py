"""Synthetic-only tests for the local owner-export review boundary."""

import hashlib
import io
import json
import sys
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
from xml.sax.saxutils import escape

sys.path.insert(0, str(Path(__file__).parent))
import linkedin_owner_export_review as review


HEADERS = [f"synthetic-column-{i}" for i in range(15)]
SCHEMA_HASH = hashlib.sha256("\x1f".join(HEADERS).encode()).hexdigest()


def workbook(*, header=HEADERS, date="11/20/2026", kind="Image",
             url="https://www.linkedin.com/posts/synthetic-ugcPost-1234567890-example",
             impressions="42"):
    rows = [header, [url, date, kind, impressions] + ["0"] * 11]
    cells = []
    for row_number, values in enumerate(rows, 1):
        row_cells = []
        for index, value in enumerate(values):
            col = chr(65 + index)
            row_cells.append(f'<c r="{col}{row_number}" t="inlineStr"><is><t>{escape(value)}</t></is></c>')
        cells.append(f'<row r="{row_number}">{"".join(row_cells)}</row>')
    sheet = ('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
             f'<sheetData>{"".join(cells)}</sheetData></worksheet>')
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("xl/workbook.xml", '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>')
        archive.writestr("xl/worksheets/sheet1.xml", sheet)
    return buffer.getvalue()


def inspect(data, *, expected=None):
    with patch.object(review, "INITIAL_SCHEMA_SHA256", SCHEMA_HASH):
        return review.inspect_export(data, expected or hashlib.sha256(data).hexdigest())


class OwnerExportReviewTests(unittest.TestCase):
    def test_valid_shape_is_still_unscored_and_redacted(self):
        source = workbook()
        result = review.review_report(inspect(source))
        self.assertEqual(result["status"], "Unscored")
        self.assertEqual(result["rows"][0]["identity_kind"], "ugcpost")
        self.assertEqual(result["rows"][0]["format"], "image")
        self.assertEqual(result["rows"][0]["publication_precision"], "day")
        self.assertTrue(all(value is False for key, value in result.items() if key.endswith("_enabled") or key == "production_evidence_sufficient"))
        serialized = json.dumps(result)
        self.assertNotIn("synthetic-ugcPost", serialized)
        self.assertNotIn("/Users/", serialized)
        self.assertFalse(result["freshness_ceiling_active"])
        self.assertEqual(result["portfolio_freshness_ceiling_days"], 30)

    def test_source_hash_drift_blocks_before_parse(self):
        result = inspect(workbook(), expected="0" * 64)
        self.assertEqual(result.rows, ())
        self.assertIn("Source SHA-256 drift", result.blockers[0])

    def test_schema_drift_blocks_before_rows(self):
        result = inspect(workbook(header=["changed"] + HEADERS[1:]))
        self.assertEqual(result.rows, ())
        self.assertIn("schema drift", result.blockers[0])

    def test_inferred_timestamp_and_missing_seven_day_window_remain_blocked(self):
        report = review.review_report(inspect(workbook(date="11/20/2026")))
        self.assertTrue(any("exact publication timestamps" in value for value in report["blockers"]))
        self.assertTrue(any("seven-day windows" in value for value in report["blockers"]))
        self.assertNotIn("publication_timestamp", report["rows"][0])

    def test_text_image_mismatch(self):
        report = review.review_report(inspect(workbook(kind="Text")))
        self.assertIsNone(report["rows"][0]["format"])
        self.assertTrue(any("text and image" in value for value in report["blockers"]))

    def test_missing_entity_identity_and_activity_link(self):
        for url in ("https://www.linkedin.com/posts/synthetic", "https://www.linkedin.com/feed/update/urn:li:activity:1234567890"):
            with self.subTest(url=url):
                report = review.review_report(inspect(workbook(url=url)))
                self.assertIsNone(report["rows"][0]["identity_kind"])
                self.assertTrue(any("identity" in value for value in report["blockers"]))

    def test_explicit_share_identity_preserved_only_in_memory(self):
        source = workbook(url="https://www.linkedin.com/posts/synthetic-share-9876543210-example")
        result = inspect(source)
        self.assertEqual(result.rows[0].identity, "urn:li:share:9876543210")
        self.assertNotIn("9876543210", json.dumps(review.review_report(result)))

    def test_unissued_policy_and_version_mismatch(self):
        result = inspect(workbook())
        approval = {"policy_id": "test", "version": "v1", "source_sha256": "0" * 64,
                    "issued_at": "2026-11-28T00:00:00Z", "expires_at": "2026-11-29T00:00:00Z",
                    "approval_receipt": "synthetic"}
        for policy in (None, approval):
            report = review.review_report(result, policy_approval=policy)
            self.assertTrue(any("approval is unissued" in value for value in report["blockers"]))
            self.assertFalse(report["persistence_enabled"])

    def test_delete_refresh_and_rollback(self):
        result = inspect(workbook())
        deleted = review.review_report(result, owner_action="delete")
        self.assertEqual(deleted["status"], "Unscored")
        self.assertTrue(any("deletion" in value for value in deleted["blockers"]))
        same = review.review_report(result, owner_action="refresh", prior_source_sha256=result.source_sha256)
        self.assertTrue(any("newly hashed export" in value for value in same["blockers"]))
        changed = review.review_report(result, owner_action="refresh", prior_source_sha256="0" * 64)
        self.assertEqual(changed["status"], "Unscored")
        self.assertTrue(any("supersedes prior evidence" in value for value in changed["blockers"]))

    def test_private_path_redacted_on_read_error(self):
        with patch.object(review.Path, "read_bytes", side_effect=OSError("/private/secret.xlsx")):
            with patch("sys.stderr", new_callable=io.StringIO) as stderr:
                result = review.main(["--source", "/private/secret.xlsx", "--expected-sha256", "0" * 64])
            self.assertEqual(result, 2)
            self.assertNotIn("/private/", stderr.getvalue())

    def test_zero_network_database_and_file_writes(self):
        source = workbook()
        with patch("socket.socket", side_effect=AssertionError("network")), \
             patch.object(Path, "write_bytes", side_effect=AssertionError("file write")), \
             patch.object(Path, "write_text", side_effect=AssertionError("file write")), \
             patch("sqlite3.connect", side_effect=AssertionError("database")):
            report = review.review_report(inspect(source))
        self.assertFalse(report["external_actions_enabled"])
        self.assertFalse(report["persistence_enabled"])


if __name__ == "__main__":
    unittest.main()
