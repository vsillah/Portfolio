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
    if (video.get("width"), video.get("height"), video.get("nb_frames")) != (960, 600, "96"):
        raise ValueError(f"Unexpected proof dimensions or frame count in {path}")
    if abs(float(media["format"]["duration"]) - 4.0) > 0.01:
        raise ValueError(f"Unexpected proof duration in {path}")


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
    restricted = [
        str(path) for path in paths
        if "decorations_instruments_trumpet_01" in str(path).lower()
        or (in_proof(path) and path.suffix.lower() in RESTRICTED_EXTENSIONS)
    ]
    if restricted:
        raise ValueError(f"Recoverable licensed source in Git candidate files: {restricted}")
    stills = sorted(path for path in paths if in_proof(path) and path.suffix.lower() == ".png")
    for still in stills:
        check_png(root / still)
    videos = sorted(path for path in paths if in_proof(path) and path.suffix.lower() == ".mp4")
    for video in videos:
        check_mp4(root / video)
    print(f"PASS: source SHA-256 verified; {len(paths)} Git candidate paths exclude licensed source; {len(stills)} PNG stills contain image chunks only; {len(videos)} MP4 files contain one video stream only")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
