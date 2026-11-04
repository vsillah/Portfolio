#!/usr/bin/env python3
import hashlib
import json
import unittest
from pathlib import Path


HERE = Path(__file__).resolve().parent


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class CompositeReceiptTest(unittest.TestCase):
    def test_receipt_binds_approved_source_and_exact_output(self) -> None:
        receipt = json.loads((HERE / "composite-receipt.json").read_text())
        self.assertEqual(
            sha256(HERE / "accelerated-l02-heygen-native.mp4"),
            receipt["approved_source_sha256"],
        )
        self.assertEqual(
            sha256(HERE / receipt["composite"]["filename"]),
            receipt["composite"]["sha256"],
        )
        self.assertEqual(receipt["verification"]["full_decode"], "pass")
        self.assertEqual(receipt["external_actions"]["provider_calls"], 0)
        self.assertEqual(receipt["external_actions"]["incremental_cost_usd"], 0)

    def test_manifest_uses_every_native_frame_once(self) -> None:
        manifest = json.loads((HERE / "composite-manifest.json").read_text())
        source_ranges = [item["source"] for item in manifest["timeline"] if "source" in item]
        self.assertEqual(source_ranges, [[0, 744], [744, 1101], [1101, 1356], [1356, 1690]])
        self.assertEqual(sum(item["frames"] for item in manifest["timeline"]), 15000)
        self.assertEqual(manifest["output_duration_seconds"], 600.0)
        self.assertEqual(manifest["constraints"]["source_speed"], 1.0)
        self.assertFalse(manifest["constraints"]["source_crop"])


if __name__ == "__main__":
    unittest.main()
