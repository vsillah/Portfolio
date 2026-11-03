import copy
import html
import re
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
                article = re.search(rf'<article class="frame" id="{lid.lower()}">(.*?)</article>', review, re.S)
                self.assertIsNotNone(article)
                copy_block = re.search(r'<div class="copy">(.*?)</div>', article[1], re.S)
                self.assertIsNotNone(copy_block)
                visible = html.unescape(re.sub(r"<[^>]+>", " ", copy_block[1]))
                for line in scene["on_screen_copy"].splitlines():
                    self.assertIn(re.sub(r"^\d+\.\s*", "", line), visible)
                self.assertIsNone(re.search(r"→|\b[\w-]+\s*[·/]\s*[\w-]+\b", visible), f"Shorthand visible copy in {lid}")
                expected_steps = {"L05": 0, "L08": 5, "L11": 5, "L16": 3}[lid]
                self.assertEqual(expected_steps, len(re.findall(r"<li>", copy_block[1])))

    def test_frame_title_stays_larger_than_interior_copy(self):
        review = (OUT / "review.html").read_text()
        self.assertIn(".frame h3 { font:500 27px/1.15", review)
        self.assertIn(".canvas .copy strong { font:500 clamp(20px,1.8vw,23px)", review)
        self.assertIn(".canvas .copy .steps { margin:0; padding-left:1.45em; font:500 clamp(16px,1.35vw,20px)", review)
        self.assertIn(".canvas .copy strong { font-size:22px }", review)
        self.assertIn(".canvas .copy .steps { font-size:17px", review)


if __name__ == "__main__":
    unittest.main()
