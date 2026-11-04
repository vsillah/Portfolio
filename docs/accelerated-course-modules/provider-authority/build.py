"""Validate source-bound, non-executable L02-L16 provider authority packets."""

import argparse
import hashlib
import json
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
COURSE = HERE.parent
BATCHES = ((2, 4), (5, 8), (9, 12), (13, 16))
PRE_JOB_MISSING = (
    "authorized_provider_account", "approved_avatar_id", "avatar_rights_receipt",
    "approved_voice_id", "voice_rights_receipt", "privacy_review_receipt",
    "binding_all_in_quote", "provider_billing_units_and_rounding",
    "enforceable_credit_or_spend_cap", "current_exact_batch_authorization",
)
POST_JOB_OUTPUTS = (
    "provider_job_receipt", "native_source_clip_sha256", "native_source_audio_sha256",
    "exact_native_timing_receipt", "actual_credit_cost_receipt",
)
PRECEDENT_SHA256 = "c4874607f494f08a2c6f766c272fb2b60171cbe17ea908cca4bc66da4649b62a"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text())


def require(test, message):
    if not test:
        raise ValueError(message)


def build():
    precedent_path = HERE / "l01-precedent.json"
    require(digest(precedent_path) == PRECEDENT_SHA256, "L01 precedent record tampered")
    precedent = read(precedent_path)
    require(precedent["source_receipt"]["sha256"] == "6abe8568e425f4d74a13db6104f39a41bf7a3a73ae2a5fd86cf3b8e53bb4b7cc", "L01 source receipt identity drift")
    require(precedent["native_composite_method"]["source_speed"] == 1 and precedent["native_composite_method"]["source_audio_only_in_presenter_windows"] is True, "L01 native source method drift")
    inventory = {"schema_version": 1, "status": "blocked_no_provider_authority",
                 "source_base_commit": "211ab30eaf537c1688828de6c5c0f5206e6c9535",
                 "batch_order": [], "total_presenter_seconds": 0,
                 "safest_first_executable_batch": None,
                 "first_candidate_after_separate_authorization": "L02 only; one job, no retry",
                 "pre_job_missing_bindings_for_every_lesson": list(PRE_JOB_MISSING),
                 "post_job_required_outputs_for_every_lesson": list(POST_JOB_OUTPUTS)}
    total = Decimal(0)
    outputs = {}
    for lo, hi in BATCHES:
        batch_id = f"L{lo:02d}-L{hi:02d}"
        folder = COURSE / f"l{lo:02d}-l{hi:02d}-guided-video"
        batch = {"schema_version": 1, "batch_id": batch_id, "status": "review_only_blocked",
                 "execution_allowed": False, "upload_allowed": False, "retry_allowed": False,
                 "spend_cap_usd": 0, "provider": "HeyGen",
                 "provider_precedent_record": "docs/accelerated-course-modules/provider-authority/l01-precedent.json",
                 "provider_precedent_sha256": PRECEDENT_SHA256,
                 "provider_precedent": {"avatar_display_name": precedent["avatar_display_name"],
                     "voice_display_name": precedent["voice_display_name"],
                     "historical_credits_consumed": precedent["usage"]["historical_credits_consumed"],
                     "historical_incremental_cost_usd": precedent["usage"]["historical_incremental_cost_usd"],
                     "limitation": precedent["limitations"]},
                 "pre_job_required_bindings": {key: None for key in PRE_JOB_MISSING},
                 "post_job_required_outputs": {key: None for key in POST_JOB_OUTPUTS},
                 "provider_input": "Exact approved narration_text in each source request segment, spoken with the approved avatar-native voice; no separately recorded audio is a pre-job input.",
                 "quote_and_cap_rule": "Obtain a current binding quote for each exact job and all-in batch total, including provider rounding, fees, taxes and any credit purchase. Verify an enforceable account/job cap before execution; historical credits are not a cap.",
                 "stop_no_retry": ["source or approved text/hash drift", "missing or changed avatar/voice rights", "quote or cap absent/exceeded", "privacy concern", "provider error or unexpected output; inspect before any new authorization", "post-job native clip/audio hash or exact timing missing or mismatched; stop before composite"],
                 "batch_boundary": "No later lesson or batch follows automatically; each job needs exact current authority and its own receipt.",
                 "lessons": [], "total_presenter_seconds": 0}
        batch_total = Decimal(0)
        for n in range(lo, hi + 1):
            lid = f"L{n:02d}"
            stem = lid.lower()
            packet_path = folder / f"{stem}-packet.json"
            request_path = folder / f"{stem}-heygen-request.json"
            asset_path = folder / f"{stem}-asset-map.json"
            audio_path = folder / f"{stem}-audio-map.json"
            packet, request, assets, audio = map(read, (packet_path, request_path, asset_path, audio_path))
            require(packet["lesson_id"] == request["lesson_id"] == assets["lesson_id"] == audio["lesson_id"] == lid, f"{lid}: lesson mismatch")
            script = ROOT / packet["source_script"]
            require(digest(script) == packet["source_script_sha256"] == request["source_script_sha256"] == assets["source_script_sha256"], f"{lid}: script drift")
            require(digest(ROOT / "accelerated_ebook_leadmagnet.epub") == packet["book_epub_sha256"] == assets["book_epub_sha256"], f"{lid}: book drift")
            require(digest(COURSE / "visual-production/manifest.json") == packet["source_visual_manifest_sha256"], f"{lid}: visual manifest drift")
            brief = "storyboard-brief.md" if lo == 2 else f"storyboard-brief-l{lo:02d}-l{hi:02d}.md"
            require(digest(COURSE / "curriculum/scripts" / brief) == packet["source_storyboard_brief_sha256"], f"{lid}: storyboard brief drift")
            require(request["segments"] == packet["provider_request"]["segments"], f"{lid}: request differs from packet")
            require(request["stop_no_retry"] == packet["provider_request"]["stop_no_retry"], f"{lid}: stop rules differ")
            require(len(request["stop_no_retry"]) >= 6 and any("retry" in rule for rule in request["stop_no_retry"]), f"{lid}: no-retry rule missing")
            require(audio["segments"] == packet["audio_ownership"], f"{lid}: audio ownership drift")
            require(packet["assets"] == assets["approved_assets"], f"{lid}: approved asset map drift")
            require(request["execution_allowed"] is False and request["upload_allowed"] is False and request["spend_cap_usd"] == 0, f"{lid}: executable request")
            require(all(request[k] is None for k in ("avatar_identity", "voice_identity", "likeness_rights_receipt", "estimated_cost_usd")), f"{lid}: unexpected provider binding")
            for asset in assets["approved_assets"].values():
                require(digest(ROOT / asset["path"]) == asset["sha256"], f"{lid}: asset drift: {asset['path']}")
            segment_total = Decimal(0)
            for segment in request["segments"]:
                scene = next((s for s in packet["scenes"] if s["id"] == segment["scene"]), None)
                require(scene is not None and scene["presenter"] == segment, f"{lid}: scene/presenter drift")
                require(hashlib.sha256(scene["narration"].encode()).hexdigest() == scene["narration_sha256"], f"{lid}: scene narration hash drift")
                require(scene["narration"].startswith(segment["narration_text"]) or segment["narration_text"] in scene["narration"], f"{lid}: narration drift")
                require(segment["narration_text"].rstrip().endswith((".", "!", "?", ".”", "!”", "?”")), f"{lid}: incomplete sentence {segment['id']}")
                duration = Decimal(str(segment["end_seconds"])) - Decimal(str(segment["start_seconds"]))
                require(duration == Decimal(str(segment["duration_seconds"])) and duration > 0, f"{lid}: duration drift")
                require("exact recorded audio required" in segment["timing_status"], f"{lid}: timing incorrectly bound")
                segment_total += duration
            require(len(request["segments"]) == 4, f"{lid}: expected four presenter windows")
            batch_total += segment_total
            batch["lessons"].append({"lesson_id": lid, "title": packet["title"],
                "request_path": str(request_path.relative_to(ROOT)), "request_sha256": digest(request_path),
                "packet_path": str(packet_path.relative_to(ROOT)), "packet_sha256": digest(packet_path),
                "asset_map_sha256": digest(asset_path), "audio_map_sha256": digest(audio_path),
                "script_sha256": packet["source_script_sha256"],
                "visual_manifest_sha256": packet["source_visual_manifest_sha256"],
                "book_epub_sha256": packet["book_epub_sha256"], "book_sections": packet["book_sections"],
                "presenter_segments": [{"id": s["id"], "scene": s["scene"], "start_seconds": s["start_seconds"], "end_seconds": s["end_seconds"], "duration_seconds": s["duration_seconds"]} for s in request["segments"]],
                "presenter_seconds": float(segment_total),
                "approved_narration_text_sha256": hashlib.sha256("\n".join(s["narration_text"] for s in request["segments"]).encode()).hexdigest(),
                "provider_input_status": "source-bound approved text; avatar-native voice pending exact ID and rights",
                "timing_status": "storyboard estimate; verify native source timing after job before composite",
                "pre_job_missing_bindings": list(PRE_JOB_MISSING),
                "post_job_required_outputs": {key: None for key in POST_JOB_OUTPUTS},
                "execution_allowed": False})
        batch["total_presenter_seconds"] = float(batch_total)
        total += batch_total
        outputs[f"{batch_id.lower()}-authority.json"] = batch
        inventory["batch_order"].append({"batch_id": batch_id, "lessons": [x["lesson_id"] for x in batch["lessons"]], "presenter_seconds": float(batch_total), "execution_allowed": False})
    inventory["total_presenter_seconds"] = float(total)
    outputs["inventory.json"] = inventory
    return outputs


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="validate committed output without writing")
    args = parser.parse_args()
    for name, value in build().items():
        serialized = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
        path = HERE / name
        if args.check:
            require(path.read_text() == serialized, f"stale authority packet: {name}")
        else:
            path.write_text(serialized)
    print("Provider authority packets valid; all 15 lessons blocked; no provider calls")


if __name__ == "__main__":
    main()
