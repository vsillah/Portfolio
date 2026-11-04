import importlib.util
import json
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('batch_builder', HERE / 'build.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class BatchPacketTests(unittest.TestCase):
    def test_all_lessons_match_approved_sources_and_stay_locked(self):
        builder.build()
        for lid, scenes in [('L02', 7), ('L03', 6), ('L04', 7)]:
            packet = json.loads((HERE / f'{lid.lower()}-packet.json').read_text())
            request = json.loads((HERE / f'{lid.lower()}-heygen-request.json').read_text())
            self.assertEqual(len(packet['scenes']), scenes)
            self.assertEqual(packet['source_script_sha256'], builder.digest(builder.ROOT / packet['source_script']))
            self.assertEqual(packet['runtime_seconds'], packet['scenes'][-1]['end_seconds'])
            self.assertTrue(packet['production_lock']['app_locked'])
            self.assertFalse(request['execution_allowed'])
            self.assertFalse(request['avatar_generation_allowed'])
            self.assertEqual(request['spend_cap_usd'], 0)
            self.assertEqual(len(request['segments']), 4)
            for segment in request['segments']:
                self.assertGreater(segment['end_seconds'], segment['start_seconds'])
                self.assertIn(segment['narration_text'], next(s['narration'] for s in packet['scenes'] if s['id'] == segment['scene']))
                self.assertIn(segment['narration_text'][-1], '.?!')
            for a, b in zip(packet['audio_ownership'], packet['audio_ownership'][1:]):
                self.assertEqual(a['end_seconds'], b['start_seconds'])

    def test_source_drift_fails_closed(self):
        scene = {'id':'LXX-01','narration':'One complete sentence. Another complete sentence.', 'start_seconds':0,'end_seconds':10,'duration_seconds':10}
        self.assertEqual(' '.join(x['text'] for x in builder.timed_sentences(scene)), scene['narration'])
        with self.assertRaises(AssertionError):
            builder.sentences('An incomplete ending')


if __name__ == '__main__':
    unittest.main()
