"""Local, read-only inspection of an owner-supplied LinkedIn Creator Analytics XLSX.

No network, database, output file, or raw-row logging. The public report contains
only row numbers, identity digests, classifications, and blockers. This module is
not connected to the scoring or acquisition pipeline.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import zipfile
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree as ET


CONTRACT = "linkedin-owner-export-review-v1"
INITIAL_SOURCE_SHA256 = "235d0302a761205ed835a8c7e05502024690823d6d9358c8af48b31da035a79c"
INITIAL_SCHEMA_SHA256 = "4f49c84ac68a2a76507c32a7ad846d64e2e539106cda56e2eab9fb749abfcbe8"
MAX_FRESHNESS_DAYS = 30  # Inactive Portfolio governance ceiling, not a LinkedIn rule.
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
URN_RE = re.compile(r"urn:li:(ugcPost|share):([0-9]+)", re.IGNORECASE)
POST_SLUG_RE = re.compile(r"-(ugcPost|share)-([0-9]+)(?:-|$)", re.IGNORECASE)
DAY_RE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")


@dataclass(frozen=True)
class ParsedRow:
    number: int
    identity: str | None  # Exact exported identity stays in process memory only.
    identity_kind: str | None
    publication_day: str | None
    format: str | None
    reported_impressions: int | None
    blockers: tuple[str, ...]


@dataclass(frozen=True)
class Inspection:
    source_sha256: str
    schema_sha256: str | None
    rows: tuple[ParsedRow, ...]
    blockers: tuple[str, ...]


def _digest(data: bytes | str) -> str:
    return hashlib.sha256(data.encode("utf-8") if isinstance(data, str) else data).hexdigest()


def _column(ref: str) -> int:
    letters = re.match(r"^[A-Z]+", ref)
    if not letters:
        raise ValueError("Malformed cell reference")
    result = 0
    for letter in letters.group():
        result = result * 26 + ord(letter) - 64
    return result - 1


def _read_rows(data: bytes) -> list[list[str]]:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or any(name.startswith("/") or ".." in Path(name).parts for name in names):
            raise ValueError("Unsafe workbook archive")
        if "xl/worksheets/sheet1.xml" not in names or "xl/workbook.xml" not in names:
            raise ValueError("Required workbook sheet is absent")
        if any(name.startswith("xl/externalLinks/") or name.endswith("vbaProject.bin") for name in names):
            raise ValueError("External links or macros are unsupported")
        if sum(name.startswith("xl/worksheets/sheet") and name.endswith(".xml") for name in names) != 1:
            raise ValueError("Exactly one worksheet is required")
        if len(data) > 5_000_000:
            raise ValueError("Workbook exceeds local review limit")
        for info in archive.infolist():
            if info.file_size > 10_000_000:
                raise ValueError("Expanded workbook member exceeds review limit")
        if sum(info.file_size for info in archive.infolist()) > 20_000_000:
            raise ValueError("Expanded workbook exceeds review limit")
        shared: list[str] = []
        if "xl/sharedStrings.xml" in names:
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = ["".join(node.text or "" for node in item.findall(".//m:t", NS))
                      for item in root.findall("m:si", NS)]
        root = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        result: list[list[str]] = []
        for row in root.findall(".//m:sheetData/m:row", NS):
            cells: dict[int, str] = {}
            for cell in row.findall("m:c", NS):
                index = _column(cell.attrib.get("r", ""))
                value = cell.find("m:v", NS)
                inline = cell.find("m:is", NS)
                raw = value.text or "" if value is not None else ""
                if cell.attrib.get("t") == "s":
                    raw = shared[int(raw)]
                elif cell.attrib.get("t") == "inlineStr" and inline is not None:
                    raw = "".join(node.text or "" for node in inline.findall(".//m:t", NS))
                cells[index] = raw
            result.append([cells.get(index, "") for index in range(max(cells, default=-1) + 1)])
        return result


def _identity(url: str) -> tuple[str | None, str | None]:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in {"linkedin.com", "www.linkedin.com"}:
        return None, None
    matches = URN_RE.findall(parsed.path) or POST_SLUG_RE.findall(parsed.path)
    if len(matches) != 1 or "activity" in parsed.path.lower():
        return None, None
    kind, number = matches[0]
    return f"urn:li:{'ugcPost' if kind.lower() == 'ugcpost' else 'share'}:{number}", kind.lower()


def _day(value: str) -> str | None:
    match = DAY_RE.fullmatch(value.strip())
    if not match:
        return None
    try:
        return date(int(match[3]), int(match[1]), int(match[2])).isoformat()
    except ValueError:
        return None


def inspect_export(data: bytes, expected_sha256: str) -> Inspection:
    actual = _digest(data)
    if not re.fullmatch(r"[a-f0-9]{64}", expected_sha256) or actual != expected_sha256:
        return Inspection(actual, None, (), ("Source SHA-256 drift; review requires the exact supplied hash.",))
    try:
        rows = _read_rows(data)
    except (ValueError, KeyError, IndexError, ET.ParseError, zipfile.BadZipFile, RuntimeError):
        return Inspection(actual, None, (), ("Unsupported or malformed XLSX structure.",))
    if not rows:
        return Inspection(actual, None, (), ("Workbook has no header row.",))
    header = rows[0]
    schema = _digest("\x1f".join(header))
    if len(header) != 15 or schema != INITIAL_SCHEMA_SHA256:
        return Inspection(actual, schema, (), ("Export schema drift; review the new schema before parsing.",))
    parsed_rows: list[ParsedRow] = []
    seen_identities: set[str] = set()
    for number, values in enumerate(rows[1:], start=2):
        too_many_columns = len(values) > 15
        values = values + [""] * max(0, 15 - len(values))
        blockers: list[str] = []
        if too_many_columns:
            blockers.append("Row has unexpected additional columns.")
        identity, kind = _identity(values[0])
        if identity is None:
            blockers.append("Missing explicit ugcPost/share identity; activity URLs cannot be inferred.")
        elif identity in seen_identities:
            blockers.append("Duplicate post identity in export.")
        else:
            seen_identities.add(identity)
        publication_day = _day(values[1])
        if publication_day is None:
            blockers.append("Publication day is absent or has unsupported precision.")
        format_name = "image" if values[2].strip().lower() == "image" else None
        if format_name is None:
            blockers.append("Export row is not an image; text and image cohorts cannot be mixed.")
        try:
            impressions = int(values[3].replace(",", ""))
            if impressions < 0:
                raise ValueError
        except ValueError:
            impressions = None
            blockers.append("Reported impression cell is invalid.")
        parsed_rows.append(ParsedRow(number, identity, kind, publication_day, format_name,
                                     impressions, tuple(blockers)))
    if not parsed_rows:
        return Inspection(actual, schema, (), ("Export has no post rows.",))
    return Inspection(actual, schema, tuple(parsed_rows), ())


def review_report(inspection: Inspection, *, owner_action: str = "review",
                  prior_source_sha256: str | None = None, policy_approval: dict | None = None) -> dict:
    """Return a redacted, always Unscored review. Never issues an approval or receipt."""
    blockers = list(inspection.blockers)
    if owner_action not in {"review", "delete", "refresh"}:
        blockers.append("Owner action must be review, delete, or refresh.")
    if owner_action == "delete":
        blockers.append("Owner-directed deletion requires rollback to Unscored and removal from any future store.")
    if owner_action == "refresh":
        if not prior_source_sha256 or prior_source_sha256 == inspection.source_sha256:
            blockers.append("Refresh requires a newly hashed export distinct from the previous source.")
        blockers.append("Refresh supersedes prior evidence and rolls back to Unscored pending new review.")
    if not policy_approval or not all(policy_approval.get(key) for key in
                                      ("policy_id", "version", "source_sha256", "issued_at", "expires_at", "approval_receipt")) \
       or policy_approval.get("source_sha256") != inspection.source_sha256:
        blockers.append("Explicit version-bound owning-store source-policy approval is unissued.")
    # Even a supplied policy claim cannot prove the other independent gates.
    blockers.extend((
        "Publication precision is day only; exact publication timestamps are unproved.",
        "Activity-to-entity binding is unproved.",
        "Exact complete seven-day windows and same-format baselines are unproved.",
        "Rights, retention, owner-directed delete/refresh, and expiry require separate approval before persisted use.",
    ))
    summaries = [{"row": row.number, "identity_kind": row.identity_kind,
                  "identity_sha256": _digest(row.identity) if row.identity else None,
                  "publication_precision": "day" if row.publication_day else "unproved",
                  "format": row.format, "blockers": list(row.blockers)}
                 for row in inspection.rows]
    return {
        "contract_version": CONTRACT, "status": "Unscored", "source_sha256": inspection.source_sha256,
        "schema_sha256": inspection.schema_sha256, "row_count": len(summaries), "rows": summaries,
        "blockers": sorted(set(blockers + [b for row in inspection.rows for b in row.blockers])),
        "portfolio_freshness_ceiling_days": MAX_FRESHNESS_DAYS,
        "freshness_ceiling_active": False,
        "production_evidence_sufficient": False, "scoring_enabled": False,
        "receipt_enabled": False, "packet_linkage_enabled": False,
        "preparation_rerun_enabled": False, "notification_enabled": False,
        "persistence_enabled": False, "external_actions_enabled": False,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Read-only local LinkedIn owner-export review")
    parser.add_argument("--source", required=True, help="Explicit local XLSX path; never printed")
    parser.add_argument("--expected-sha256", required=True)
    args = parser.parse_args(argv)
    try:
        data = Path(args.source).read_bytes()
    except OSError:
        print("Unable to read the explicitly supplied local source.", file=sys.stderr)
        return 2
    print(json.dumps(review_report(inspect_export(data, args.expected_sha256)), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
