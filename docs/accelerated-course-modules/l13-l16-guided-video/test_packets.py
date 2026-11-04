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
        for lid in ('L13', 'L14', 'L15', 'L16'):
            packet = json.loads((HERE / f'{lid.lower()}-packet.json').read_text())
            request = json.loads((HERE / f'{lid.lower()}-heygen-request.json').read_text())
            scene_source = next(x for x in source['lessons'] if x['id'] == lid)
            self.assertEqual(len(packet['scenes']), 6)
            self.assertEqual(packet['source_script_sha256'], builder.digest(builder.ROOT / packet['source_script']))
            self.assertEqual(packet['runtime_seconds'], packet['scenes'][-1]['end_seconds'])
            self.assertEqual(''.join(x['narration'] for x in packet['scenes']), ''.join(x['narration'] for x in scene_source['scenes']))
            self.assertEqual([x['on_screen_copy'] for x in packet['scenes']], [x['on_screen_copy'] for x in scene_source['scenes']])
            self.assertEqual(' '.join(x['text'] for x in packet['cues']), ' '.join(x['narration'] for x in packet['scenes']))
            self.assertEqual(packet['cues'][0]['start'], 0)
            self.assertEqual(packet['cues'][-1]['end'], packet['runtime_seconds'])
            self.assertEqual(packet['book_sections'], next(x for x in json.loads(builder.SCRIPT_MANIFEST.read_text())['lessons'] if x['id'] == lid)['epub_files'])
            self.assertTrue(packet['production_lock']['app_locked'])
            for flag in ('execution_allowed', 'upload_allowed', 'publication_allowed', 'distribution_allowed', 'external_send_allowed', 'voice_generation_allowed', 'avatar_generation_allowed'):
                self.assertFalse(request[flag], f'{lid} {flag}')
            self.assertEqual(request['spend_cap_usd'], 0)
            for missing in ('avatar_identity', 'voice_identity', 'likeness_rights_receipt', 'voice_rights_receipt', 'recorded_audio_sha256', 'provider_account', 'provider_job_mode', 'provider_terms_acceptance', 'binding_quote', 'enforceable_cap', 'privacy_review_receipt', 'upload_authorization', 'upload_destination', 'publication_authorization', 'publication_destination', 'distribution_authorization', 'distribution_destination', 'external_send_authorization', 'external_send_destination'):
                self.assertIsNone(request[missing], f'{lid} {missing}')
            self.assertEqual(len(request['segments']), 4)
            for segment in request['segments']:
                scene = next(x for x in packet['scenes'] if x['id'] == segment['scene'])
                self.assertIn(segment['narration_text'], scene['narration'])
                self.assertIn(segment['narration_text'][-1], '.?!')
                self.assertGreater(segment['end_seconds'], segment['start_seconds'])
                self.assertIn(segment['start_seconds'], [cue['start'] for cue in packet['cues']])
                self.assertIn(segment['end_seconds'], [cue['end'] for cue in packet['cues']])
            self.assertLess(request['segments'][-1]['end_seconds'], packet['runtime_seconds'] - 4)
            for a, b in zip(packet['audio_ownership'], packet['audio_ownership'][1:]):
                self.assertEqual(a['end_seconds'], b['start_seconds'])
            for asset in packet['assets'].values():
                self.assertEqual(asset['sha256'], builder.digest(builder.ROOT / asset['path']))
            self.assertEqual((HERE / f'{lid.lower()}-storyboard.srt').read_text().count(' --> '), len(packet['cues']))
        self.assertEqual(set(json.loads((HERE / 'l16-packet.json').read_text())['assets']), {'sam_map', 'cover'})

    def test_source_drift_fails_closed(self):
        original = builder.SOURCE_PINS['docs/accelerated-course-modules/curriculum/scripts/L13.md']
        try:
            builder.SOURCE_PINS['docs/accelerated-course-modules/curriculum/scripts/L13.md'] = '0' * 64
            with self.assertRaisesRegex(AssertionError, 'approved source drift'):
                builder.validate_sources()
        finally:
            builder.SOURCE_PINS['docs/accelerated-course-modules/curriculum/scripts/L13.md'] = original

        scene = {'id': 'LXX-01', 'narration': 'One complete sentence. Another complete sentence.', 'start_seconds': 0, 'end_seconds': 10, 'duration_seconds': 10}
        self.assertEqual(' '.join(x['text'] for x in builder.timed_sentences(scene)), scene['narration'])
        with self.assertRaises(AssertionError):
            builder.sentences('An incomplete ending')

    def test_hash_register_is_deterministic(self):
        files = [x.strip().split('  ', 1)[1] for x in (HERE / 'hashes.sha256').read_text().splitlines() if x.strip()]
        self.assertEqual(files, sorted(files))
        self.assertEqual(len(files), len(set(files)))
        self.assertEqual(files, sorted(p.name for p in HERE.iterdir() if p.is_file() and p.name != 'hashes.sha256'))
        for line in (HERE / 'hashes.sha256').read_text().splitlines():
            expected, name = line.split('  ', 1)
            self.assertEqual(expected, hashlib.sha256((HERE / name).read_bytes()).hexdigest(), name)

    def test_storyboard_specific_visual_boundaries(self):
        review = (HERE / 'review.html').read_text()
        for phrase in ('Book case: StratQuest', 'Book case: VisionScope', 'Book case: MarketCraft',
                       'Simulation · fictional member', 'Simulation · fictional director',
                       'Observed · pending', 'Interpretation · review', 'Simulation · fictional',
                       'Book story: Sam', '1. Choose one pain point', '3. Set one review',
                       'Approved public book cover', 'Approved SAM teaching plate'):
            self.assertIn(phrase, review)
        self.assertIn("lessonId==='L16'&&n===5", review)
        self.assertIn('object-fit:contain', review)

    def test_long_provenance_wraps_on_mobile(self):
        review = (HERE / 'review.html').read_text()
        self.assertIn('details{min-width:0}', review)
        self.assertIn('.provenance{overflow-wrap:anywhere}', review)


if __name__ == '__main__':
    unittest.main()
