import importlib.util
import json
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch


PATH = Path(__file__).with_name("build.py")
spec = importlib.util.spec_from_file_location("authority_build", PATH)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class AuthorityPacketTests(unittest.TestCase):
    def test_inventory_is_bounded_and_all_lessons_blocked(self):
        outputs = builder.build()
        inventory = outputs["inventory.json"]
        self.assertEqual(inventory["total_presenter_seconds"], 1521.317)
        self.assertEqual([b["batch_id"] for b in inventory["batch_order"]],
                         ["L02-L04", "L05-L08", "L09-L12", "L13-L16"])
        self.assertIsNone(inventory["safest_first_executable_batch"])
        self.assertEqual(inventory["first_candidate_after_separate_authorization"], "L02 only; one job, no retry")
        lessons = [lesson for name, batch in outputs.items() if name.endswith("-authority.json") for lesson in batch["lessons"]]
        self.assertEqual(len(lessons), 15)
        self.assertTrue(all(lesson["execution_allowed"] is False and lesson["pre_job_missing_bindings"] for lesson in lessons))
        self.assertTrue(all(lesson["post_job_required_outputs"]["native_source_audio_sha256"] is None for lesson in lessons))
        self.assertNotIn("recorded_audio_sha256", inventory["pre_job_missing_bindings_for_every_lesson"])
        self.assertTrue(all(batch["pre_job_required_bindings"]["approved_avatar_id"] is None for name, batch in outputs.items() if name.endswith("-authority.json")))
        self.assertTrue(all(batch["post_job_required_outputs"]["exact_native_timing_receipt"] is None for name, batch in outputs.items() if name.endswith("-authority.json")))

    def test_l01_precedent_tampering_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            here = Path(directory)
            precedent = json.loads((builder.HERE / "l01-precedent.json").read_text())
            precedent["usage"]["historical_credits_consumed"] = 60
            (here / "l01-precedent.json").write_text(json.dumps(precedent))
            with patch.object(builder, "HERE", here):
                with self.assertRaisesRegex(ValueError, "precedent record tampered"):
                    builder.build()

    def test_validation_does_not_read_original_machine_local_receipt(self):
        original = builder.digest

        def local_only(path):
            self.assertTrue(path.resolve().is_relative_to(builder.ROOT.resolve()))
            return original(path)

        with patch.object(builder, "digest", side_effect=local_only):
            builder.build()

    def test_changed_request_text_fails_closed(self):
        original = builder.read

        def altered(path):
            value = original(path)
            if path.name == "l02-heygen-request.json":
                value = deepcopy(value)
                value["segments"][0]["narration_text"] = "Changed."
            return value

        with patch.object(builder, "read", side_effect=altered):
            with self.assertRaisesRegex(ValueError, "request differs from packet"):
                builder.build()

    def test_provider_execution_flag_fails_closed(self):
        original = builder.read

        def altered(path):
            value = original(path)
            if path.name == "l02-heygen-request.json":
                value = deepcopy(value)
                value["execution_allowed"] = True
            return value

        with patch.object(builder, "read", side_effect=altered):
            with self.assertRaisesRegex(ValueError, "executable request"):
                builder.build()


if __name__ == "__main__":
    unittest.main()
