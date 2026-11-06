#!/usr/bin/env python3
"""Check the local licensed archive and exclude recoverable asset files from Git."""

import argparse
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys


EXPECTED_SHA256 = "5d7d57de0da0cd1defe1c2b61c48bf9d66c73b0d698644bb0715ba75b92526fa"
PROOF_DIRS = (
    "docs/qa/trumpet-recruitment-visual-story/imeshh-topology/",
    "docs/qa/trumpet-recruitment-visual-story/imeshh-repair/",
    "public/work/trumpet-trainer/recruitment-motion/",
)
REVIEW_DIRS = (
    "docs/qa/trumpet-recruitment-visual-story/imeshh-integration/",
    "docs/qa/trumpet-recruitment-visual-story/imeshh-vertical-correction/",
    "docs/qa/trumpet-recruitment-visual-story/imeshh-timeline-rail/",
    "docs/qa/trumpet-recruitment-visual-story/imeshh-chronological-branch/",
)
RESTRICTED_EXTENSIONS = {
    ".blend", ".blend1", ".fbx", ".glb", ".gltf", ".obj", ".mtl",
    ".zip", ".jpg", ".jpeg", ".tga", ".exr", ".hdr",
}
ALLOWED_PNG_CHUNKS = {b"IHDR", b"IDAT", b"IEND"}


def check_png(path: Path) -> None:
    data = path.read_bytes()
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError(f"Invalid PNG: {path}")
    if path.name == "poster.png" and path.parent.name == "recruitment-motion":
        if struct.unpack_from(">II", data, 16) != (800, 800):
            raise ValueError(f"Unexpected vertical poster dimensions: {path}")
        if data[25] != 6:
            raise ValueError(f"Poster must be RGBA: {path}")
    offset = 8
    types = []
    while offset + 12 <= len(data):
        length = struct.unpack_from(">I", data, offset)[0]
        end = offset + length + 12
        if end > len(data):
            raise ValueError(f"Truncated PNG: {path}")
        kind = data[offset + 4 : offset + 8]
        if kind not in ALLOWED_PNG_CHUNKS:
            raise ValueError(f"Ancillary or embedded data in {path}: {kind!r}")
        types.append(kind)
        offset = end
        if kind == b"IEND":
            break
    if types[0] != b"IHDR" or types[-1] != b"IEND" or b"IDAT" not in types or offset != len(data):
        raise ValueError(f"Invalid PNG structure or trailing data: {path}")
    if path.name == "poster.png" and path.parent.name == "recruitment-motion":
        check_alpha_frame(path, is_webm=False)


def check_alpha_frame(path: Path, *, is_webm: bool) -> None:
    command = ["ffmpeg", "-v", "error"]
    if is_webm:
        command += ["-c:v", "libvpx-vp9"]
    command += ["-i", str(path), "-frames:v", "1", "-pix_fmt", "rgba", "-f", "rawvideo", "-"]
    decoded = subprocess.run(command, check=True, capture_output=True).stdout
    if len(decoded) != 800 * 800 * 4:
        raise ValueError(f"Unexpected decoded RGBA frame size: {path}")
    alpha = decoded[3::4]
    if not any(value > 0 for value in alpha) or any(alpha[index] != 0 for index in (0, 799, 800 * 799, 800 * 800 - 1)):
        raise ValueError(f"Frame lacks a transparent surround and visible trumpet: {path}")


def check_mp4(path: Path) -> None:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
        check=True, capture_output=True, text=True,
    )
    media = json.loads(result.stdout)
    streams = media.get("streams", [])
    if len(streams) != 1 or streams[0].get("codec_type") != "video" or streams[0].get("codec_name") != "h264":
        raise ValueError(f"Unexpected stream or embedded attachment in {path}")
    video = streams[0]
    if path.name == "repaired-mechanical-proof.mp4":
        expected_frames = 96
        expected_size = (960, 600)
    else:
        raise ValueError(f"Unexpected iMeshh-derived video name: {path}")
    if (video.get("width"), video.get("height"), video.get("nb_frames")) != (*expected_size, str(expected_frames)):
        raise ValueError(f"Unexpected proof dimensions or frame count in {path}")
    if abs(float(media["format"]["duration"]) - expected_frames / 24) > 0.01:
        raise ValueError(f"Unexpected proof duration in {path}")


def check_webm(path: Path) -> None:
    if path.name not in {f"step-{step:02d}.webm" for step in range(1, 7)}:
        raise ValueError(f"Unexpected transparent clip name: {path}")
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", str(path)],
        check=True, capture_output=True, text=True,
    )
    media = json.loads(result.stdout)
    streams = media.get("streams", [])
    expected_frames = 36 if path.name == "step-06.webm" else 24
    if len(streams) != 1 or streams[0].get("codec_name") != "vp9" or streams[0].get("codec_type") != "video":
        raise ValueError(f"Unexpected VP9 stream: {path}")
    stream = streams[0]
    tags = {key.lower(): value for key, value in stream.get("tags", {}).items()}
    if (stream.get("width"), stream.get("height"), stream.get("nb_read_frames"), tags.get("alpha_mode")) != (800, 800, str(expected_frames), "1"):
        raise ValueError(f"Unexpected transparent clip dimensions, frames, or alpha tag: {path}")
    if abs(float(media["format"]["duration"]) - expected_frames / 24) > 0.01:
        raise ValueError(f"Unexpected transparent clip duration: {path}")
    check_alpha_frame(path, is_webm=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset-zip", type=Path, required=True, help="Caller-supplied local iMeshh ZIP")
    args = parser.parse_args()
    if not args.asset_zip.is_file():
        parser.error("Licensed ZIP is missing")
    digest = hashlib.sha256(args.asset_zip.read_bytes()).hexdigest()
    if digest != EXPECTED_SHA256:
        parser.error("Licensed ZIP SHA-256 mismatch; refusing to validate a different source")

    root = Path(__file__).resolve().parents[2]
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=root, check=True, capture_output=True,
    )
    paths = [Path(raw.decode()) for raw in result.stdout.split(b"\0") if raw]
    in_proof = lambda path: any(str(path).startswith(directory) for directory in PROOF_DIRS)
    in_review = lambda path: any(str(path).startswith(directory) for directory in REVIEW_DIRS)
    restricted = [
        str(path) for path in paths
        if "decorations_instruments_trumpet_01" in str(path).lower()
        or ((in_proof(path) or in_review(path)) and path.suffix.lower() in RESTRICTED_EXTENSIONS)
    ]
    if restricted:
        raise ValueError(f"Recoverable licensed source in Git candidate files: {restricted}")
    stills = sorted(path for path in paths if in_proof(path) and path.suffix.lower() == ".png")
    for still in stills:
        check_png(root / still)
    videos = sorted(path for path in paths if in_proof(path) and path.suffix.lower() in {".mp4", ".webm"})
    for video in videos:
        (check_webm if video.suffix.lower() == ".webm" else check_mp4)(root / video)
    print(f"PASS: source SHA-256 verified; {len(paths)} Git candidate paths exclude licensed source; {len(stills)} PNG stills checked; {len(videos)} video streams and transparent clip frames checked")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
