#!/usr/bin/env python3
"""Audit Accelerated workshop teaching-overlay plans against the shared contract."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from accelerated_overlay_style import CONTRACT_ID, audit_plan


ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "docs/accelerated-course-modules/visual-production/teaching-overlay-workshop-manifest.json"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", action="store_true", help="Fail when a review-ready lesson is not compliant")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    issues: list[str] = []
    counts = {"compliant": 0, "needs_normalization": 0, "pending": 0}
    lessons = manifest.get("lessons", [])

    if manifest.get("contract") != CONTRACT_ID:
        issues.append(f"manifest contract must be {CONTRACT_ID}")
    if len(lessons) != 16:
        issues.append("manifest must cover L01-L16 exactly once")

    seen: set[str] = set()
    for lesson in lessons:
        lesson_id = lesson.get("lesson")
        status = lesson.get("status")
        if lesson_id in seen:
            issues.append(f"duplicate lesson {lesson_id}")
        seen.add(lesson_id)
        if status not in counts:
            issues.append(f"{lesson_id}: unsupported status {status!r}")
            continue
        counts[status] += 1
        plan_path = lesson.get("plan")
        if status == "compliant":
            if not plan_path:
                issues.append(f"{lesson_id}: compliant lesson requires a plan")
                continue
            absolute = ROOT / plan_path
            if not absolute.exists():
                issues.append(f"{lesson_id}: missing plan {plan_path}")
                continue
            plan = json.loads(absolute.read_text(encoding="utf-8"))
            issues.extend(audit_plan(plan, plan_path))
        elif args.strict and lesson.get("review_ready"):
            issues.append(f"{lesson_id}: review-ready lesson is {status}, not compliant")

    report = {
        "contract": CONTRACT_ID,
        "lesson_count": len(lessons),
        "counts": counts,
        "issues": issues,
        "strict": args.strict,
        "result": "pass" if not issues else "fail",
    }
    print(json.dumps(report, indent=2))
    if issues:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
