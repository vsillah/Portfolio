#!/usr/bin/env python3
"""Build the review-only L09 word correction without touching bound media."""

from hashlib import sha256
from pathlib import Path


ROOT = Path(__file__).resolve().parents[5]
PACKAGE = Path(__file__).resolve().parent
SOURCE = ROOT / "public/agentified/lessons/l09/approved-277c85aa/agentified-l09-native-captions.vtt"
OUTPUT = PACKAGE / "agentified-l09-caption-candidate.vtt"
SOURCE_SHA256 = "68371ffd0a983e3f599be63acb57851bd96dd9bceebc574516db86680c093f3d"
BEFORE = (
    b"00:02:27.780 --> 00:02:30.980\n"
    b"Make reject and request-revision as visible as approve.\n"
)
AFTER = (
    b"00:02:27.780 --> 00:02:30.980\n"
    b"Make reject and request-revision as visible as approved.\n"
)


def digest(data: bytes) -> str:
    return sha256(data).hexdigest()


source = SOURCE.read_bytes()
assert digest(source) == SOURCE_SHA256, "L09 bound VTT changed"
assert source.count(BEFORE) == 1, "Expected exactly one source cue"
candidate = source.replace(BEFORE, AFTER, 1)
assert candidate.replace(AFTER, BEFORE, 1) == source, "Unexpected VTT changes"
OUTPUT.write_bytes(candidate)
print(f"source_sha256={digest(source)}")
print(f"candidate_sha256={digest(candidate)}")
print(f"candidate_path={OUTPUT}")
