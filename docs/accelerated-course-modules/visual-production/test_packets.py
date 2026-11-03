import copy
import unittest

from build_packets import OUT, build, validate


class PacketRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest, cls.register = build()

    def test_complete_scene_sequence_and_locked_execution(self):
        self.assertEqual([], validate(self.manifest, self.register))
        self.assertEqual(16, len(self.manifest["lessons"]))
        self.assertEqual(98, sum(len(x["scenes"]) for x in self.manifest["lessons"]))

    def test_narration_or_source_drift_fails(self):
        changed = copy.deepcopy(self.manifest)
        changed["lessons"][0]["scenes"][0]["narration"] += " Added sentence."
        self.assertTrue(validate(changed, self.register))
        changed = copy.deepcopy(self.manifest)
        changed["lessons"][0]["scenes"][0]["lineage"]["epub_files"] = []
        self.assertTrue(validate(changed, self.register))

    def test_missing_scene_required_field_and_provider_activation_fail(self):
        for mutation in ("missing_scene", "missing_audio", "provider"):
            with self.subTest(mutation=mutation):
                changed = copy.deepcopy(self.manifest)
                if mutation == "missing_scene":
                    changed["lessons"][3]["scenes"].pop()
                elif mutation == "missing_audio":
                    changed["lessons"][3]["scenes"][1]["audio"] = {}
                else:
                    changed["provider_execution"] = "enabled"
                self.assertTrue(validate(changed, self.register))

    def test_review_frames_use_exact_scene_copy(self):
        review = (OUT / "review.html").read_text()
        for lid, number in (("L05", 1), ("L08", 3), ("L11", 3), ("L16", 6)):
            with self.subTest(lesson=lid):
                scene = next(x for x in self.manifest["lessons"] if x["id"] == lid)["scenes"][number - 1]
                self.assertIn(scene["on_screen_copy"], review)


if __name__ == "__main__":
    unittest.main()
