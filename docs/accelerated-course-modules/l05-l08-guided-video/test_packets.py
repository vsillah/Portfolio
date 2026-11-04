import hashlib
import importlib.util
import json
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('batch_builder', HERE / 'build.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class BatchPacketTests(unittest.TestCase):
    def test_approved_sources_and_closed_gates(self):
        builder.build()
        source = json.loads(builder.VISUAL.read_text())
        for lid in ('L05', 'L06', 'L07', 'L08'):
            packet = json.loads((HERE / f'{lid.lower()}-packet.json').read_text())
            request = json.loads((HERE / f'{lid.lower()}-heygen-request.json').read_text())
            scene_source = next(x for x in source['lessons'] if x['id'] == lid)
            self.assertEqual(len(packet['scenes']), 6)
            self.assertEqual(packet['source_script_sha256'], builder.digest(builder.ROOT / packet['source_script']))
            self.assertEqual(packet['runtime_seconds'], packet['scenes'][-1]['end_seconds'])
            self.assertEqual(''.join(x['narration'] for x in packet['scenes']), ''.join(x['narration'] for x in scene_source['scenes']))
            self.assertEqual([x['on_screen_copy'] for x in packet['scenes']], [x['on_screen_copy'] for x in scene_source['scenes']])
            self.assertTrue(packet['production_lock']['app_locked'])
            for flag in ('execution_allowed', 'upload_allowed', 'publication_allowed', 'distribution_allowed', 'external_send_allowed', 'voice_generation_allowed', 'avatar_generation_allowed'):
                self.assertFalse(request[flag], f'{lid} {flag}')
            self.assertEqual(request['spend_cap_usd'], 0)
            for missing in ('avatar_identity', 'voice_identity', 'likeness_rights_receipt', 'voice_rights_receipt', 'recorded_audio_sha256', 'provider_account', 'binding_quote', 'enforceable_cap', 'privacy_review_receipt', 'upload_authorization', 'publication_authorization', 'external_send_authorization'):
                self.assertIsNone(request[missing], f'{lid} {missing}')
            self.assertEqual(len(request['segments']), 4)
            for segment in request['segments']:
                scene = next(x for x in packet['scenes'] if x['id'] == segment['scene'])
                self.assertIn(segment['narration_text'], scene['narration'])
                self.assertIn(segment['narration_text'][-1], '.?!')
                self.assertGreater(segment['end_seconds'], segment['start_seconds'])
            for a, b in zip(packet['audio_ownership'], packet['audio_ownership'][1:]):
                self.assertEqual(a['end_seconds'], b['start_seconds'])
            for asset in packet['assets'].values():
                self.assertEqual(asset['sha256'], builder.digest(builder.ROOT / asset['path']))
            self.assertEqual((HERE / f'{lid.lower()}-storyboard.srt').read_text().count(' --> '), len(packet['cues']))

    def test_source_drift_fails_closed(self):
        scene = {'id': 'LXX-01', 'narration': 'One complete sentence. Another complete sentence.', 'start_seconds': 0, 'end_seconds': 10, 'duration_seconds': 10}
        self.assertEqual(' '.join(x['text'] for x in builder.timed_sentences(scene)), scene['narration'])
        with self.assertRaises(AssertionError):
            builder.sentences('An incomplete ending')

    def test_hash_register_is_deterministic(self):
        files = [x.strip().split('  ', 1)[1] for x in (HERE / 'hashes.sha256').read_text().splitlines() if x.strip()]
        self.assertEqual(files, sorted(files))
        self.assertEqual(len(files), len(set(files)))
        for line in (HERE / 'hashes.sha256').read_text().splitlines():
            expected, name = line.split('  ', 1)
            self.assertEqual(expected, hashlib.sha256((HERE / name).read_bytes()).hexdigest(), name)

    def test_long_provenance_wraps_on_mobile(self):
        review = (HERE / 'review.html').read_text()
        self.assertIn('details{min-width:0}', review)
        self.assertIn('.provenance{overflow-wrap:anywhere}', review)


if __name__ == '__main__':
    unittest.main()
