#!/usr/bin/env python3
"""Check the local licensed archive and exclude recoverable asset files from Git."""

import argparse
import hashlib
from pathlib import Path
import struct
import subprocess
import sys


EXPECTED_SHA256 = "5d7d57de0da0cd1defe1c2b61c48bf9d66c73b0d698644bb0715ba75b92526fa"
PROOF_DIR = "docs/qa/trumpet-recruitment-visual-story/imeshh-topology/"
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
    restricted = [
        str(path) for path in paths
        if "decorations_instruments_trumpet_01" in str(path).lower()
        or (str(path).startswith(PROOF_DIR) and path.suffix.lower() in RESTRICTED_EXTENSIONS)
    ]
    if restricted:
        raise ValueError(f"Recoverable licensed source in Git candidate files: {restricted}")
    stills = sorted(path for path in paths if str(path).startswith(PROOF_DIR) and path.suffix.lower() == ".png")
    for still in stills:
        check_png(root / still)
    print(f"PASS: source SHA-256 verified; {len(paths)} Git candidate paths exclude licensed source; {len(stills)} PNG stills contain image chunks only")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
