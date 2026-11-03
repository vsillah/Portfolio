#!/usr/bin/env python3
"""Build and validate review-only visual packets from the approved L01-L16 scripts."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "docs/accelerated-course-modules/curriculum/scripts"
OUT = Path(__file__).resolve().parent
APPROVED_COMMIT = "932870eccabd393fa7401145b2e38db142891133"
ASSETS = {
    "book": "accelerated_ebook_leadmagnet.epub",
    "cover": "public/accelerated_cover_ebook.webp",
    "logo": "public/amadutown-logo-upscaled.png",
    "sam_map": "public/showcases/service-prototypes/accelerated-sam-infographic.png",
    "signals": "public/showcases/service-prototypes/v2/sam-signals-plate.webp",
    "alignment": "public/showcases/service-prototypes/v2/sam-alignment-plate.webp",
    "momentum": "public/showcases/service-prototypes/v2/sam-momentum-plate.webp",
}
MANIFESTS = ["manifest.json", "manifest-l05-l08.json", "manifest-l09-l12.json", "manifest-l13-l16.json"]
BRIEFS = ["storyboard-brief.md", "storyboard-brief-l05-l08.md", "storyboard-brief-l09-l12.md", "storyboard-brief-l13-l16.md"]
EARLY_VISIBLE = {
    "L01": ["Q3 Innovation Plan", "Signal → decision → learning", "Signals / Alignment / Momentum", "Public | approved for this use | restricted", "Decision owner", "What must we learn before choosing?"],
    "L02": ["What can we not afford to get wrong?", "Choose one. Keep two alternatives.", "Customer / Company / Competition / Product", "Pain | value | learning | risk | reversibility", "What can we not afford to get wrong?", "Choose one. Keep two alternatives.", "What could overturn this choice?"],
    "L03": ["What decision is being made?", "Current answer", "Strongest fair objection", "Evidence that could change it", "Quick change | deeper bet | deliberate delay", "Source + date + uncertainty"],
    "L04": ["One moment. One test.", "Job + context", "Observed signal ≠ proposed signal", "Uncertainty", "Next validation question", "Source + review date", "Decision file: boundary → priority → evidence → persona"],
}
VISUAL_COPY_OVERRIDES = {
    # Human QA revision: keep narration and source bindings, but render the
    # representative teaching sequences as actions a learner can read.
    "L08-03": "1. Define the problem\n2. Name the cohort\n3. State the hypothesis\n4. Bound the scope\n5. Choose the metrics",
    "L11-03": "1. Notice the signal\n2. Turn it into insight\n3. Run the test\n4. Make the decision\n5. Build repeatable momentum",
    "L16-06": "1. Choose one pain point\n2. Run one test\n3. Set one review",
}
SCENE_RE = re.compile(r"^## Scene (\d+) · (\d\d:\d\d)–(\d\d:\d\d) · (.+)$", re.M)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def seconds(value: str) -> int:
    minutes, sec = map(int, value.split(":"))
    return minutes * 60 + sec


def source_scenes(path: Path) -> list[dict]:
    content = path.read_text()
    matches = list(SCENE_RE.finditer(content))
    result = []
    for index, match in enumerate(matches):
        section = content[match.end():matches[index + 1].start() if index + 1 < len(matches) else content.find("## On-screen copy", match.end()) if "## On-screen copy" in content[match.end():] else len(content)]
        narration = re.search(r"```narration\n(.*?)\n```", section, re.S)
        if not narration:
            raise ValueError(f"Missing narration: {path.name} scene {match[1]}")
        source = re.search(r"\*\*Source:\*\* (.*?)(?= \*\*|\n)", section, re.S)
        avatar = re.search(r"\*\*Avatar:\*\* (.*?)(?= \*\*|\n)", section, re.S)
        broll = re.search(r"\*\*B-roll:\*\* (.*?)(?= \*\*|\n)", section, re.S)
        delivery = re.search(r"\*\*Delivery:\*\* (.*?)(?= \*\*|\n)", section, re.S)
        visible = re.search(r"\*\*Visible copy:\*\* (.*?)(?=\n)", section)
        result.append({"number": int(match[1]), "start": match[2], "end": match[3], "title": match[4], "narration": narration[1], "source": source[1].strip() if source else "", "avatar": avatar[1].strip() if avatar else "off", "broll": broll[1].strip() if broll else "See storyboard brief", "delivery": delivery[1].strip() if delivery else "Deliberate read", "visible": visible[1].strip().strip("` ") if visible else ""})
    return result


def brief_rows() -> dict[str, dict]:
    rows = {}
    for name in BRIEFS:
        for line in (SCRIPTS / name).read_text().splitlines():
            if not line.startswith("| L"):
                continue
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            match = re.match(r"(L\d\d)-(\d+) (\d\d:\d\d)–(\d\d:\d\d)", cells[0])
            if match:
                rows[f"{match[1]}-{int(match[2]):02d}"] = {"cells": cells, "brief": f"docs/accelerated-course-modules/curriculum/scripts/{name}", "start": match[3], "end": match[4]}
    return rows


def build() -> tuple[dict, dict]:
    lessons = [lesson for name in MANIFESTS for lesson in json.loads((SCRIPTS / name).read_text())["lessons"]]
    rows = brief_rows()
    origins = {"book": "Canonical local EPUB named in curriculum/production-and-provenance.md", "sam_map": "AmaduTown Drive original in production-and-provenance.md, D1; source copy agentified/source-assets/accelerated/accelerated-sam-infographic.png", "signals": "Merged Portfolio workshop plate, production-and-provenance.md A2", "alignment": "Merged Portfolio workshop plate, production-and-provenance.md A2", "momentum": "Merged Portfolio workshop plate, production-and-provenance.md A2", "cover": "Portfolio public ebook cover, production-and-provenance.md A3", "logo": "Portfolio AGENTS.md default AmaduTown logo asset"}
    register = {key: {"path": path, "sha256": digest(ROOT / path), "origin": origins[key], "classification": "approved local source" if key != "book" else "canonical book source", "use": "review-only source; no provider or publication license inferred", "privacy": "Public brand/book art; check source legibility and rights again before final render"} for key, path in ASSETS.items()}
    packets = []
    for lesson in lessons:
        lid = lesson["id"]
        source_path = SCRIPTS / f"{lid}.md"
        source_sha = digest(source_path)
        allowed_art = [key for path in lesson["sam_assets"] for key, asset in ASSETS.items() if path == asset]
        scenes = []
        for item in source_scenes(source_path):
            sid = f"{lid}-{item['number']:02d}"
            row = rows.get(sid)
            if not row or (row["start"], row["end"]) != (item["start"], item["end"]):
                raise ValueError(f"Storyboard time binding missing or changed: {sid}")
            cells = row["cells"]
            refs = []
            joined = " ".join(cells).lower()
            if "sam_map" in allowed_art and ("infographic" in joined or "full sam" in joined or "a1;" in joined):
                refs.append("sam_map")
            for key in ("signals", "alignment", "momentum"):
                if key in allowed_art and (key in joined or not refs and len(allowed_art) == 1):
                    refs.append(key)
            if "cover" in joined and "book cover" in joined:
                refs.append("cover")
            if sid == "L16-06":
                refs.append("cover")
            refs = list(dict.fromkeys(refs))
            visible = item["visible"] or (cells[3].strip("` ") if len(cells) == 5 else "")
            visible = visible.strip("` .")
            if lid in EARLY_VISIBLE:
                visible = EARLY_VISIBLE[lid][item["number"] - 1]
            visible = VISUAL_COPY_OVERRIDES.get(sid, visible)
            if not visible:
                visible = item["title"]
            avatar = item["avatar"]
            if avatar == "off" and len(cells) == 5:
                avatar = cells[4]
            frame = cells[1]
            art = cells[2]
            motion = cells[3] if len(cells) > 5 else "Reveal only the concept named in narration, then hold the complete card for at least six seconds; cut at scene end."
            safe = cells[4] if len(cells) > 5 else "Reflow each card into a single-column portrait stack; keep source and decision labels together."
            access = cells[5] if len(cells) > 5 else "Narration names the instructional relationship; add a text alternative for each worksheet and art panel."
            scenes.append({
                "id": sid, "lesson_id": lid, "scene_number": item["number"], "title": item["title"],
                "start_tc": item["start"], "end_tc": item["end"], "start_seconds": seconds(item["start"]), "end_seconds": seconds(item["end"]), "duration_seconds": seconds(item["end"]) - seconds(item["start"]),
                "narration": item["narration"], "narration_sha256": hashlib.sha256(item["narration"].encode()).hexdigest(), "script_path": str(source_path.relative_to(ROOT)), "script_sha256": source_sha,
                "on_screen_copy": visible, "captions": {"source": "Exact approved narration; final SRT/VTT must be checked against the final audio mix", "placement": "Bottom 18% caption band, two lines maximum, speaker and meaningful sound identified", "audience_copy_review": "Remove production notes from visible and spoken surfaces"},
                "asset_refs": refs, "shot": {"composition": frame, "artifact_behavior": art, "framing": "16:9 master; subject and copy in central 80%; preserve original SAM art and its natural aspect ratio", "safe_area": safe, "portrait": "9:16 reflow, not a crop of text; one worksheet field or comparison option per view; preserve captions below content"},
                "motion": {"choreography": motion, "pacing": item["delivery"], "transition": "Cut or restrained dissolve at scene boundary; avoid meaning conveyed by movement alone", "reduced_motion": "Show the final labeled state as a still for the same reading hold"},
                "avatar": {"window": avatar, "placement": "When active, upper third or side window clear of captions, book labels, and worksheet text; portrait uses a separate top window", "entry_exit": "Hard cut into direct address, then cut away before dense instructional art", "gesture": "Emphasize the decision or question named in narration; no pointing to unverified results", "must_not_appear": "Dense worksheets, source text, SAM plate labels, simulated reactions, and any scene marked off"},
                "audio": {"owner": "One spoken owner at a time: approved narration or later native avatar audio for its exact window", "mix": "If native avatar audio is used, mute the matching narration span; no double speech. Music/effects below intelligibility and absent during worksheet holds; no audio asset approved now", "sync": "Final native composite must match source frame count, rate, duration, and lip sync"},
                "accessibility": {"contrast": "At least 4.5:1 body text and 3:1 large text; verify on rendered frame", "reading_order": "Title, decision or question, evidence/source, next action; align visual reveals with narration", "caption_legibility": "Never place instructional text in caption band; check 16:9 and 9:16", "meaningful_text_alternative": access, "reduced_motion": "Static labeled end state with equivalent hold time"},
                "lineage": {"epub_files": lesson["epub_files"], "scene_source": item["source"], "storyboard_brief": row["brief"], **({"visual_copy_revision": "Book concepts rendered as short action labels for human QA; narration and script source unchanged"} if sid in VISUAL_COPY_OVERRIDES else {}), "book_status": "Book case or argument, never current product/customer proof", "artifact_status": "Synthetic instructional card or approved local art; no real customer/admin capture", "new_synthetic_identity": f"synthetic-course-card:{sid}:{source_sha[:16]}", "claim_boundary": "No invented result, customer record, live tool status, or unsupported performance claim"},
                "implementation": "Local storyboard/review only. Later renderer must bind exact source hashes, preserve captions and native-audio ownership, and require separate provider and final-media approval.",
            })
        packets.append({"id": lid, "title": lesson["title"], "runtime_seconds": lesson["runtime_seconds"], "learner_artifact": lesson["learner_artifact"], "source_manifest": next(name for name in MANIFESTS if any(x["id"] == lid for x in json.loads((SCRIPTS / name).read_text())["lessons"])), "scenes": scenes})
    return ({"schema_version": 1, "status": "review_only", "approved_base_commit": APPROVED_COMMIT, "provider_execution": "locked", "external_execution": "locked", "lessons": packets}, {"schema_version": 1, "approved_base_commit": APPROVED_COMMIT, "assets": register})


def render_packet(group: list[dict]) -> str:
    lines = [f"# Visual production packet: {group[0]['id']}–{group[-1]['id']}", "", "Review-only scene handoff. Narration is copied exactly from the approved scripts. Production metadata belongs in this protected packet, not on audience screens. Provider, avatar, voice, upload, and final render execution remain locked.", ""]
    for lesson in group:
        lines += [f"## {lesson['id']} · {lesson['title']}", "", f"Runtime: {lesson['runtime_seconds']} seconds. Learner artifact: {lesson['learner_artifact']}.", ""]
        for s in lesson["scenes"]:
            copy = s["on_screen_copy"]
            screen_block = f"On screen: `{copy}`. Captions: exact narration in bottom 18%, two lines maximum, manually checked against final audio." if "\n" not in copy else f"On screen:\n\n```text\n{copy}\n```\n\nCaptions: exact narration in bottom 18%, two lines maximum, manually checked against final audio."
            lineage_note = f" Visual copy revision: {s['lineage']['visual_copy_revision']}." if s["lineage"].get("visual_copy_revision") else ""
            lines += [f"### {s['id']} · {s['start_tc']}–{s['end_tc']} ({s['duration_seconds']} s) · {s['title']}", "", screen_block, "", f"Shot: {s['shot']['composition']} Artifact: {s['shot']['artifact_behavior']}", "", f"Art: {', '.join(s['asset_refs'])}. 16:9: {s['shot']['framing']} Safe area: {s['shot']['safe_area']} 9:16: {s['shot']['portrait']}", "", f"Motion: {s['motion']['choreography']} Pace: {s['motion']['pacing']} Transition: {s['motion']['transition']} Reduced motion: {s['motion']['reduced_motion']}", "", f"Avatar: {s['avatar']['window']}. {s['avatar']['placement']} {s['avatar']['entry_exit']} Gesture: {s['avatar']['gesture']} Off during: {s['avatar']['must_not_appear']}", "", f"Audio: {s['audio']['owner']} {s['audio']['mix']}", "", f"Accessibility: {s['accessibility']['contrast']} {s['accessibility']['reading_order']} {s['accessibility']['meaningful_text_alternative']}", "", f"Lineage: {s['script_path']} SHA-256 `{s['script_sha256']}`; {s['lineage']['storyboard_brief']}; EPUB {', '.join(s['lineage']['epub_files'])}. {s['lineage']['scene_source']} Synthetic identity `{s['lineage']['new_synthetic_identity']}`.{lineage_note} {s['lineage']['claim_boundary']}", "", f"Provider handoff: {s['implementation']}", "", "Approved narration:", "", f"> {s['narration']}", ""]
    return "\n".join(lines)


def validate(manifest: dict, register: dict) -> list[str]:
    errors = []
    expected, expected_assets = build()
    if manifest != expected:
        errors.append("Manifest differs from approved scripts, briefs, source hashes, or deterministic packet fields")
    if register != expected_assets:
        errors.append("Asset register differs from local approved source hashes")
    if [x["id"] for x in manifest.get("lessons", [])] != [f"L{i:02d}" for i in range(1, 17)]:
        errors.append("Lesson coverage is not L01–L16")
    for lesson in manifest.get("lessons", []):
        cursor = 0
        for number, scene in enumerate(lesson.get("scenes", []), 1):
            if scene.get("id") != f"{lesson['id']}-{number:02d}" or scene.get("start_seconds") != cursor or scene.get("duration_seconds", 0) <= 0:
                errors.append(f"Scene identity or timing gap: {scene.get('id')}")
            cursor = scene.get("end_seconds", -1)
            for key in ("narration", "on_screen_copy", "captions", "shot", "motion", "avatar", "audio", "accessibility", "lineage", "implementation"):
                if not scene.get(key):
                    errors.append(f"Missing {key}: {scene.get('id')}")
            if not isinstance(scene.get("asset_refs"), list) or any(ref not in register["assets"] for ref in scene["asset_refs"]):
                errors.append(f"Invalid approved art reference: {scene.get('id')}")
        if cursor != lesson.get("runtime_seconds"):
            errors.append(f"Runtime mismatch: {lesson.get('id')}")
    if manifest.get("provider_execution") != "locked" or manifest.get("external_execution") != "locked":
        errors.append("External/provider execution activated")
    return errors


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["build", "check"])
    args = parser.parse_args()
    manifest, register = build()
    if args.mode == "build":
        (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
        (OUT / "asset-register.json").write_text(json.dumps(register, indent=2, ensure_ascii=False) + "\n")
        for start in (0, 4, 8, 12):
            group = manifest["lessons"][start:start + 4]
            (OUT / f"packet-{group[0]['id'].lower()}-{group[-1]['id'].lower()}.md").write_text(render_packet(group))
    else:
        actual = json.loads((OUT / "manifest.json").read_text())
        assets = json.loads((OUT / "asset-register.json").read_text())
        errors = validate(actual, assets)
        for start in (0, 4, 8, 12):
            group = manifest["lessons"][start:start + 4]
            path = OUT / f"packet-{group[0]['id'].lower()}-{group[-1]['id'].lower()}.md"
            if path.read_text() != render_packet(group):
                errors.append(f"Human packet drift: {path.name}")
        if errors:
            raise SystemExit("\n".join(errors))
        print(f"PASS: {len(actual['lessons'])} lessons, {sum(len(x['scenes']) for x in actual['lessons'])} scenes, exact source/asset bindings, locked execution")


if __name__ == "__main__":
    main()
